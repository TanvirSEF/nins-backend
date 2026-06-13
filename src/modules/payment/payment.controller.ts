import {
  Controller,
  Get,
  Post,
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
  constructor(private readonly paymentService: PaymentService) {}

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

  @Get('callback/success')
  @Public()
  @ApiOperation({ summary: 'SSLCommerz success redirect handler (public)' })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 200, description: 'Payment success info' })
  async handleSuccess(
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    return this.paymentService.handleSuccess(query);
  }

  @Get('callback/fail')
  @Public()
  @ApiOperation({ summary: 'SSLCommerz fail redirect handler (public)' })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 200, description: 'Payment failure info' })
  async handleFail(
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    return this.paymentService.handleFail(query);
  }

  @Get('callback/cancel')
  @Public()
  @ApiOperation({ summary: 'SSLCommerz cancel redirect handler (public)' })
  @ApiQuery({ name: 'tran_id', description: 'Transaction ID', type: String })
  @ApiResponse({ status: 200, description: 'Payment cancelled info' })
  async handleCancel(
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean; tranId?: string; message: string }> {
    return this.paymentService.handleCancel(query);
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
