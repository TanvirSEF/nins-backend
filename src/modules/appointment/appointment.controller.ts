import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentFilterDto } from './dto/appointment-filter.dto';
import { AppointmentDocument, AppointmentStatus } from './appointment.schema';
import { Appointment } from './appointment.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../user/user.schema';
import { UserDocument } from '../user/user.schema';

@ApiTags('appointments')
@ApiBearerAuth('JWT-auth')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Book an appointment (PATIENT role)' })
  @ApiResponse({ status: 201, description: 'Appointment booked', type: Appointment })
  @ApiResponse({ status: 400, description: 'Invalid date, day mismatch, or slots full' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Duplicate booking — already booked this doctor on this date' })
  @ApiResponse({ status: 404, description: 'Doctor or schedule not found' })
  createAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: UserDocument,
  ): Promise<AppointmentDocument> {
    return this.appointmentService.createAppointment(dto, String(user._id));
  }

  @Get('my-tickets')
  @ApiOperation({ summary: 'Get current user\'s appointment history' })
  @ApiPaginatedResponse(Appointment)
  @ApiResponse({ status: 200, description: 'Paginated list of your appointments' })
  findMyTickets(
    @CurrentUser() user: UserDocument,
    @Query() filters: AppointmentFilterDto,
  ) {
    return this.appointmentService.findMyTickets(String(user._id), filters);
  }

  @Get('doctor/:doctorId')
  @Public()
  @ApiOperation({ summary: 'Get appointments for a specific doctor (public)' })
  @ApiParam({ name: 'doctorId', description: 'DoctorProfile ObjectId', type: String })
  @ApiQuery({ name: 'date', description: 'Filter by date (YYYY-MM-DD)', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Appointments for the doctor' })
  findByDoctor(
    @Param('doctorId') doctorId: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentService.findByDoctor(doctorId, date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Appointment found', type: Appointment })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  findOne(@Param('id') id: string): Promise<AppointmentDocument> {
    return this.appointmentService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status (role-based)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Status updated', type: Appointment })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: UserDocument,
  ): Promise<AppointmentDocument> {
    return this.appointmentService.updateStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an appointment (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Appointment deleted', type: Appointment })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  remove(@Param('id') id: string): Promise<AppointmentDocument> {
    return this.appointmentService.remove(id);
  }
}
