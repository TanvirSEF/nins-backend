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
import { MedicalRecordService } from './medical-record.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordFilterDto } from './dto/medical-record-filter.dto';
import { MedicalRecordDocument, MedicalRecord } from './medical-record.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('medical-records')
@ApiBearerAuth('JWT-auth')
@Controller('medical-records')
export class MedicalRecordController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
  ) {}

  @Post()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a medical record (DOCTOR role)' })
  @ApiResponse({ status: 201, description: 'Medical record created', type: MedicalRecord })
  @ApiResponse({ status: 400, description: 'Appointment not completed' })
  @ApiResponse({ status: 403, description: 'Not your appointment' })
  @ApiResponse({ status: 409, description: 'Record already exists for this appointment' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  create(
    @Body() dto: CreateMedicalRecordDto,
    @CurrentUser() user: UserDocument,
  ): Promise<MedicalRecordDocument> {
    return this.medicalRecordService.create(dto, String(user._id));
  }

  @Get('patient/my-records')
  @ApiOperation({ summary: 'Get current patient\'s medical records' })
  @ApiPaginatedResponse(MedicalRecord)
  @ApiResponse({ status: 200, description: 'Paginated list of your medical records' })
  findMyRecords(
    @CurrentUser() user: UserDocument,
    @Query() filters: MedicalRecordFilterDto,
  ) {
    return this.medicalRecordService.findMyRecords(String(user._id), filters);
  }

  @Get('appointment/:appointmentId')
  @ApiOperation({ summary: 'Get medical record by appointment ID' })
  @ApiParam({ name: 'appointmentId', description: 'Appointment ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Medical record found', type: MedicalRecord })
  @ApiResponse({ status: 404, description: 'No medical record for this appointment' })
  findByAppointment(
    @Param('appointmentId') appointmentId: string,
  ): Promise<MedicalRecordDocument> {
    return this.medicalRecordService.findByAppointment(appointmentId);
  }

  @Get()
  @Roles(Role.DOCTOR, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List medical records (filtered, paginated)' })
  @ApiPaginatedResponse(MedicalRecord)
  @ApiResponse({ status: 200, description: 'Paginated list of medical records' })
  findAll(@Query() filters: MedicalRecordFilterDto) {
    return this.medicalRecordService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a medical record by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Medical record found', type: MedicalRecord })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  findOne(@Param('id') id: string): Promise<MedicalRecordDocument> {
    return this.medicalRecordService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a medical record (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Medical record updated', type: MedicalRecord })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordDocument> {
    return this.medicalRecordService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a medical record (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Medical record deleted', type: MedicalRecord })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  remove(@Param('id') id: string): Promise<MedicalRecordDocument> {
    return this.medicalRecordService.remove(id);
  }
}
