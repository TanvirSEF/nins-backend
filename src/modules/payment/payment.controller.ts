import {
  Controller,
  Get,
  Post,
  All,
  Param,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { PaymentDocument, Payment } from './payment.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Build the frontend return URL the browser is redirected to after the
   * SSLCommerz hosted checkout. `result` = which callback was hit;
   * the frontend re-fetches the appointment to show the authoritative status.
   */
  private paymentReturnUrl(
    result: 'success' | 'fail' | 'cancel',
    data: Record<string, any>,
  ): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const params = new URLSearchParams({
      result,
      appointmentId: String(data?.value_a ?? ''),
      tranId: String(data?.tran_id ?? ''),
    });
    return `${frontendUrl}/dashboard/patient/book/return?${params.toString()}`;
  }

  @Post('init/:appointmentId')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Initiate payment for an appointment (PATIENT)' })
  @ApiParam({ name: 'appointmentId', description: 'Appointment ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Returns GatewayPageURL for payment' })
  @ApiResponse({ status: 400, description: 'Appointment not pending or gateway error' })
  @ApiResponse({ status: 403, description: 'Not your appointment' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Already paid' })
  async initPayment(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<{ tranId: string; gatewayPageURL: string }> {
    return this.paymentService.initPayment(appointmentId, String(user._id));
  }

  @Post('ipn')
  @Public()
  @ApiOperation({
    summary: 'SSLCommerz IPN listener (public, server-to-server)',
  })
  @ApiResponse({ status: 200, description: 'IPN processed' })
  async handleIPN(@Body() body: Record<string, any>): Promise<{ status: string }> {
    await this.paymentService.handleIPN(body);
    return { status: 'OK' };
  }

  @All('callback/success')
  @Public()
  @ApiOperation({
    summary: 'SSLCommerz success redirect handler (public) — 302 to frontend',
  })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 302, description: 'Redirect to frontend return page' })
  async handleSuccess(
    @Query() query: Record<string, any>,
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    // SSLCommerz may send data via query (GET redirect) or body (POST).
    // Fire the in-the-moment handler; IPN remains the authoritative confirmer.
    const data = Object.keys(body || {}).length > 0 ? body : query;
    this.paymentService.handleSuccess(data).catch(() => null);
    res.redirect(302, this.paymentReturnUrl('success', data));
  }

  @All('callback/fail')
  @Public()
  @ApiOperation({
    summary: 'SSLCommerz fail redirect handler (public) — 302 to frontend',
  })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 302, description: 'Redirect to frontend return page' })
  async handleFail(
    @Query() query: Record<string, any>,
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const data = Object.keys(body || {}).length > 0 ? body : query;
    this.paymentService.handleFail(data).catch(() => null);
    res.redirect(302, this.paymentReturnUrl('fail', data));
  }

  @All('callback/cancel')
  @Public()
  @ApiOperation({
    summary: 'SSLCommerz cancel redirect handler (public) — 302 to frontend',
  })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 302, description: 'Redirect to frontend return page' })
  async handleCancel(
    @Query() query: Record<string, any>,
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const data = Object.keys(body || {}).length > 0 ? body : query;
    this.paymentService.handleCancel(data).catch(() => null);
    res.redirect(302, this.paymentReturnUrl('cancel', data));
  }

  @Get('history')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: "Get current patient's payment history" })
  @ApiPaginatedResponse(Payment)
  @ApiResponse({ status: 200, description: 'Paginated payment history' })
  findMyPayments(
    @CurrentUser() user: UserDocument,
    @Query() filters: PaymentFilterDto,
  ) {
    return this.paymentService.findMyPayments(String(user._id), filters);
  }

  @Get('transaction/:tranId')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({
    summary: 'Query live transaction status from SSLCommerz (admin)',
  })
  @ApiParam({ name: 'tranId', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 200, description: 'Live transaction status' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  queryTransaction(@Param('tranId') tranId: string) {
    return this.paymentService.queryTransactionStatus(tranId);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List all payments (filtered, paginated)' })
  @ApiPaginatedResponse(Payment)
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
  findAll(@Query() filters: PaymentFilterDto) {
    return this.paymentService.findAll(filters);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get payment details by ID (admin/staff)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Payment details', type: Payment })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id') id: string): Promise<PaymentDocument> {
    return this.paymentService.findOne(id);
  }
}
