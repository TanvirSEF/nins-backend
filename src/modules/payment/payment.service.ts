import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument, PaymentStatus } from './payment.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import { User, UserDocument } from '../user/user.schema';
import { SslCommerzService } from './sslcommerz.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';
import { PaymentFilterDto } from './dto/payment-filter.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly appointmentFee: number;
  private readonly backendUrl: string;

  constructor(
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private sslCommerzService: SslCommerzService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {
    this.appointmentFee = parseFloat(
      this.configService.get<string>('APPOINTMENT_FEE', '50'),
    );
    this.backendUrl = this.configService.get<string>('BACKEND_URL')!;
  }

  // ─── Initiate Payment ────────────────────────────────────────────────────────
  async initPayment(
    appointmentId: string,
    userId: string,
  ): Promise<{ tranId: string; gatewayPageURL: string }> {
    // 1. Validate appointment
    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        'Payment can only be initiated for pending appointments',
      );
    }

    // 2. Verify ownership
    const patientObjectId = new Types.ObjectId(userId);
    if (!appointment.patientId.equals(patientObjectId)) {
      throw new ForbiddenException(
        'You can only pay for your own appointments',
      );
    }

    // 3. Check existing payment
    const existingPayment = await this.paymentModel
      .findOne({ appointmentId: new Types.ObjectId(appointmentId) })
      .sort({ createdAt: -1 })
      .exec();

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.VALIDATED) {
        throw new ConflictException('This appointment is already paid');
      }
      if (existingPayment.status === PaymentStatus.PENDING) {
        const ageMs = Date.now() - (existingPayment.createdAt?.getTime() ?? 0);
        if (ageMs < 15 * 60 * 1000) {
          // Less than 15 min — return existing session
          const session = await this.sslCommerzService.queryByTransactionId(
            existingPayment.tranId,
          );
          if (session?.status === 'VALID' || session?.status === 'VALIDATED') {
            // Payment actually completed — update records
            existingPayment.status = PaymentStatus.VALIDATED;
            existingPayment.paidAt = new Date();
            await existingPayment.save();
            appointment.status = AppointmentStatus.CONFIRMED;
            await appointment.save();
            throw new ConflictException('This appointment is already paid');
          }
          // Still pending — re-initiate for fresh session
          existingPayment.status = PaymentStatus.CANCELLED;
          await existingPayment.save();
        } else {
          // Expired — cancel it
          existingPayment.status = PaymentStatus.CANCELLED;
          await existingPayment.save();
        }
      }
    }

    // 4. Generate transaction ID
    const tranId = `NINS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 5. Fetch user for customer info
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 6. Create payment record
    const payment = new this.paymentModel({
      appointmentId: new Types.ObjectId(appointmentId),
      patientId: patientObjectId,
      tranId,
      amount: this.appointmentFee,
      currency: 'BDT',
      status: PaymentStatus.PENDING,
    });
    await payment.save();

    // 7. Build SSLCommerz payload
    const sslData = {
      total_amount: this.appointmentFee,
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${this.backendUrl}/api/payments/callback/success`,
      fail_url: `${this.backendUrl}/api/payments/callback/fail`,
      cancel_url: `${this.backendUrl}/api/payments/callback/cancel`,
      ipn_url: `${this.backendUrl}/api/payments/ipn`,
      product_name: 'Appointment Registration Fee',
      product_category: 'healthcare',
      product_profile: 'general',
      shipping_method: 'NO',
      num_of_item: 1,
      product_amount: this.appointmentFee,
      cus_name: user.name || 'Patient',
      cus_email: user.email,
      cus_add1: 'NINS Hospital',
      cus_city: 'Dhaka',
      cus_postcode: '1207',
      cus_country: 'Bangladesh',
      cus_phone: user.phone || '0000000000',
      value_a: appointmentId, // passthrough appointment ID
    };

    // 8. Call SSLCommerz init
    try {
      const response = await this.sslCommerzService.init(sslData);

      if (response?.status === 'SUCCESS' && response?.GatewayPageURL) {
        // Store session key
        payment.sessionKey = response.sessionkey;
        await payment.save();

        this.logger.log(
          `Payment initiated — tranId: ${tranId}, appointment: ${appointmentId}`,
        );

        return {
          tranId,
          gatewayPageURL: response.GatewayPageURL,
        };
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.errorReason =
          response?.failedreason || 'SSLCommerz init failed';
        await payment.save();
        throw new BadRequestException(
          `Payment gateway error: ${response?.failedreason || 'Unknown error'}`,
        );
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      payment.status = PaymentStatus.FAILED;
      payment.errorReason = error.message;
      await payment.save();
      throw new BadRequestException(
        `Failed to connect to payment gateway: ${error.message}`,
      );
    }
  }

  // ─── Handle IPN (SSLCommerz server-to-server) ───────────────────────────────
  async handleIPN(ipnData: Record<string, any>): Promise<void> {
    const {
      tran_id,
      val_id,
      amount,
      status,
      bank_tran_id,
      card_type,
      card_no,
      card_brand,
      card_issuer,
      store_amount,
      risk_level,
      value_a,
    } = ipnData;

    this.logger.log(
      `IPN received — tranId: ${tran_id}, status: ${status}, amount: ${amount}`,
    );

    // 1. Find payment
    const payment = await this.paymentModel.findOne({ tranId: tran_id }).exec();
    if (!payment) {
      this.logger.warn(`IPN: Payment not found for tranId: ${tran_id}`);
      return;
    }

    // 2. Idempotency — already processed
    if (payment.status === PaymentStatus.VALIDATED) {
      this.logger.log(`IPN: Already validated — tranId: ${tran_id}`);
      return;
    }

    // 3. Amount tamper check
    const ipnAmount = parseFloat(amount);
    if (ipnAmount !== payment.amount) {
      this.logger.error(
        `IPN: Amount mismatch! Expected: ${payment.amount}, Got: ${ipnAmount}`,
      );
      payment.status = PaymentStatus.FAILED;
      payment.errorReason = `Amount mismatch: expected ${payment.amount}, got ${ipnAmount}`;
      await payment.save();
      return;
    }

    // 4. Check status
    if (status !== 'VALID') {
      payment.status =
        status === 'FAILED'
          ? PaymentStatus.FAILED
          : status === 'CANCELLED'
            ? PaymentStatus.CANCELLED
            : PaymentStatus.FAILED;
      payment.bankTransactionId = bank_tran_id;
      payment.errorReason = `SSLCommerz status: ${status}`;
      await payment.save();
      this.logger.warn(`IPN: Payment ${status} — tranId: ${tran_id}`);
      return;
    }

    // 5. Validate with SSLCommerz server-to-server
    try {
      const validation = await this.sslCommerzService.validate(val_id);

      if (
        validation?.status === 'VALID' ||
        validation?.status === 'VALIDATED'
      ) {
        // 6. Update payment — SUCCESS
        payment.status = PaymentStatus.VALIDATED;
        payment.valId = val_id;
        payment.bankTransactionId = bank_tran_id;
        payment.cardType = card_type;
        payment.cardNo = card_no;
        payment.cardBrand = card_brand;
        payment.cardIssuer = card_issuer;
        payment.storeAmount = parseFloat(store_amount) || 0;
        payment.riskLevel = risk_level;
        payment.paidAt = new Date();
        await payment.save();

        // 7. Update appointment status to CONFIRMED
        await this.appointmentModel
          .findByIdAndUpdate(payment.appointmentId, {
            status: AppointmentStatus.CONFIRMED,
          })
          .exec();

        this.logger.log(
          `Payment validated — tranId: ${tran_id}, appointment confirmed`,
        );

        // 8. Notification: Appointment Confirmed (real-time + email)
        const appointment = await this.appointmentModel
          .findById(payment.appointmentId)
          .exec();
        await this.notificationService
          .notify(
            String(payment.patientId),
            NotificationType.APPOINTMENT_CONFIRMED,
            {
              appointmentDate: appointment?.appointmentDate,
              serialNumber: appointment?.serialNumber,
              amount: payment.amount,
              tranId: payment.tranId,
              appointmentId: String(payment.appointmentId),
            },
          )
          .catch(() => null);
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.errorReason = `Validation failed: ${validation?.status || 'Unknown'}`;
        await payment.save();
        this.logger.warn(
          `IPN: Validation failed — tranId: ${tran_id}, validation status: ${validation?.status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `IPN: Validation error — tranId: ${tran_id}, error: ${error.message}`,
      );
      // Don't update status — will retry on next IPN
    }
  }

  // ─── Callback Handlers (read-only, informational) ────────────────────────────
  async handleSuccess(
    queryParams: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    const { tran_id } = queryParams;
    const payment = await this.paymentModel.findOne({ tranId: tran_id }).exec();

    if (!payment) {
      return { success: false, message: 'Payment record not found' };
    }

    if (payment.status === PaymentStatus.VALIDATED) {
      return {
        success: true,
        tranId: payment.tranId,
        message: 'Payment successful! Your appointment is confirmed.',
      };
    }

    // Payment might still be processing (IPN hasn't arrived yet)
    // Try to validate now
    if (payment.valId) {
      try {
        const validation = await this.sslCommerzService.validate(payment.valId);
        if (
          validation?.status === 'VALID' ||
          validation?.status === 'VALIDATED'
        ) {
          payment.status = PaymentStatus.VALIDATED;
          payment.paidAt = new Date();
          await payment.save();

          await this.appointmentModel
            .findByIdAndUpdate(payment.appointmentId, {
              status: AppointmentStatus.CONFIRMED,
            })
            .exec();

          return {
            success: true,
            tranId: payment.tranId,
            message: 'Payment successful! Your appointment is confirmed.',
          };
        }
      } catch {
        // Ignore — return pending status
      }
    }

    return {
      success: false,
      tranId: payment.tranId,
      message: 'Payment is being processed. Please wait for confirmation.',
    };
  }

  async handleFail(
    queryParams: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    const { tran_id } = queryParams;
    const payment = await this.paymentModel.findOne({ tranId: tran_id }).exec();

    if (payment && payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.FAILED;
      await payment.save();
    }

    return {
      success: false,
      tranId: tran_id,
      message: 'Payment failed. Please try again.',
    };
  }

  async handleCancel(
    queryParams: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    const { tran_id } = queryParams;
    const payment = await this.paymentModel.findOne({ tranId: tran_id }).exec();

    if (payment && payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.CANCELLED;
      await payment.save();
    }

    return {
      success: false,
      tranId: tran_id,
      message: 'Payment was cancelled.',
    };
  }

  // ─── Patient Payment History ─────────────────────────────────────────────────
  async findMyPayments(
    userId: string,
    filters: PaymentFilterDto,
  ): Promise<PaginatedResult<PaymentDocument>> {
    const { page, limit, status } = filters;

    const cacheKey = `payments:patient:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;
    const cached =
      await this.cacheManager.get<PaginatedResult<PaymentDocument>>(cacheKey);
    if (cached) return cached;

    const query: any = { patientId: new Types.ObjectId(userId) };
    if (status) query.status = status;

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .populate('appointmentId', 'appointmentDate serialNumber status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<PaymentDocument> = {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  // ─── Admin: All Payments ─────────────────────────────────────────────────────
  async findAll(
    filters: PaymentFilterDto,
  ): Promise<PaginatedResult<PaymentDocument>> {
    const { page, limit, status, appointmentId } = filters;

    const cacheKey = `payments:all:status:${status || 'all'}:appt:${appointmentId || 'all'}:page:${page}:limit:${limit}`;
    const cached =
      await this.cacheManager.get<PaginatedResult<PaymentDocument>>(cacheKey);
    if (cached) return cached;

    const query: any = {};
    if (status) query.status = status;
    if (appointmentId) query.appointmentId = new Types.ObjectId(appointmentId);

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .populate('patientId', 'name email phone')
        .populate('appointmentId', 'appointmentDate serialNumber status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<PaymentDocument> = {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  // ─── Single Payment Detail ───────────────────────────────────────────────────
  async findOne(id: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel
      .findById(id)
      .populate('patientId', 'name email phone')
      .populate('appointmentId', 'appointmentDate serialNumber status')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment #${id} not found`);
    }
    return payment;
  }

  // ─── Live Transaction Query (admin) ─────────────────────────────────────────
  async queryTransactionStatus(tranId: string): Promise<Record<string, any>> {
    const payment = await this.paymentModel.findOne({ tranId }).exec();
    if (!payment) {
      throw new NotFoundException(`Payment with tranId ${tranId} not found`);
    }

    const liveStatus =
      await this.sslCommerzService.queryByTransactionId(tranId);
    return {
      local: {
        tranId: payment.tranId,
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paidAt,
      },
      sslcommerz: liveStatus,
    };
  }
}
