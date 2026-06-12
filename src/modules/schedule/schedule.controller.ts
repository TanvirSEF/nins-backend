import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleDocument } from './schedule.schema';
import { Schedule } from './schedule.schema';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('schedules')
@ApiBearerAuth('JWT-auth')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({
    summary: 'Create a doctor schedule (SUPER_ADMIN, HOSPITAL_STAFF)',
  })
  @ApiResponse({ status: 201, description: 'Schedule created', type: Schedule })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 409,
    description: 'Schedule already exists for this doctor on the specified day',
  })
  create(@Body() dto: CreateScheduleDto): Promise<ScheduleDocument> {
    return this.scheduleService.create(dto);
  }

  @Get('doctor/:doctorId')
  @Public()
  @ApiOperation({ summary: 'Get all schedules for a specific doctor' })
  @ApiParam({
    name: 'doctorId',
    description: 'DoctorProfile ObjectId',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of schedules for the doctor',
    type: [Schedule],
  })
  findByDoctor(
    @Param('doctorId') doctorId: string,
  ): Promise<ScheduleDocument[]> {
    return this.scheduleService.findByDoctor(doctorId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Schedule found', type: Schedule })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  findOne(@Param('id') id: string): Promise<ScheduleDocument> {
    return this.scheduleService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({
    summary: 'Update a schedule (SUPER_ADMIN, HOSPITAL_STAFF)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Schedule updated', type: Schedule })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDocument> {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a schedule (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Schedule deleted', type: Schedule })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  remove(@Param('id') id: string): Promise<ScheduleDocument> {
    return this.scheduleService.remove(id);
  }
}
