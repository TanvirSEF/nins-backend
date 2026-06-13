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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionFilterDto } from './dto/prescription-filter.dto';
import { PrescriptionDocument, Prescription } from './prescription.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('prescriptions')
@ApiBearerAuth('JWT-auth')
@Controller('prescriptions')
export class PrescriptionController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
  ) {}

  @Post()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a prescription (DOCTOR role)' })
  @ApiResponse({ status: 201, description: 'Prescription created', type: Prescription })
  @ApiResponse({ status: 400, description: 'No medicines or tests provided' })
  @ApiResponse({ status: 403, description: 'Not your medical record' })
  @ApiResponse({ status: 409, description: 'Prescription already exists for this record' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: UserDocument,
  ): Promise<PrescriptionDocument> {
    return this.prescriptionService.create(dto, String(user._id));
  }

  @Get('patient/my-prescriptions')
  @ApiOperation({ summary: 'Get current patient\'s prescriptions' })
  @ApiPaginatedResponse(Prescription)
  @ApiResponse({ status: 200, description: 'Paginated list of your prescriptions' })
  findMyPrescriptions(
    @CurrentUser() user: UserDocument,
    @Query() filters: PrescriptionFilterDto,
  ) {
    return this.prescriptionService.findMyPrescriptions(
      String(user._id),
      filters,
    );
  }

  @Get('medical-record/:medicalRecordId')
  @ApiOperation({ summary: 'Get prescription by medical record ID' })
  @ApiParam({ name: 'medicalRecordId', description: 'MedicalRecord ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Prescription found', type: Prescription })
  @ApiResponse({ status: 404, description: 'No prescription for this medical record' })
  findByMedicalRecord(
    @Param('medicalRecordId') medicalRecordId: string,
  ): Promise<PrescriptionDocument> {
    return this.prescriptionService.findByMedicalRecord(medicalRecordId);
  }

  @Get('appointment/:appointmentId')
  @ApiOperation({ summary: 'Get prescription by appointment ID' })
  @ApiParam({ name: 'appointmentId', description: 'Appointment ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Prescription found', type: Prescription })
  @ApiResponse({ status: 404, description: 'No prescription for this appointment' })
  findByAppointment(
    @Param('appointmentId') appointmentId: string,
  ): Promise<PrescriptionDocument> {
    return this.prescriptionService.findByAppointment(appointmentId);
  }

  @Get()
  @Roles(Role.DOCTOR, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List prescriptions (filtered, paginated)' })
  @ApiPaginatedResponse(Prescription)
  @ApiResponse({ status: 200, description: 'Paginated list of prescriptions' })
  findAll(@Query() filters: PrescriptionFilterDto) {
    return this.prescriptionService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a prescription by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Prescription found', type: Prescription })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  findOne(@Param('id') id: string): Promise<PrescriptionDocument> {
    return this.prescriptionService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a prescription (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Prescription updated', type: Prescription })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionDocument> {
    return this.prescriptionService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a prescription (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Prescription deleted', type: Prescription })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  remove(@Param('id') id: string): Promise<PrescriptionDocument> {
    return this.prescriptionService.remove(id);
  }
}
