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
import { PathologyReportService } from './pathology-report.service';
import { CreatePathologyDto } from './dto/create-pathology.dto';
import { UpdatePathologyDto } from './dto/update-pathology.dto';
import { AddResultDto } from './dto/add-result.dto';
import { PathologyFilterDto } from './dto/pathology-filter.dto';
import {
  PathologyReportDocument,
  PathologyReport,
} from './pathology-report.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('pathology-reports')
@ApiBearerAuth('JWT-auth')
@Controller('pathology-reports')
export class PathologyReportController {
  constructor(private readonly pathologyService: PathologyReportService) {}

  @Post()
  @Roles(Role.DOCTOR, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Order a pathology test (DOCTOR/STAFF)' })
  @ApiResponse({
    status: 201,
    description: 'Test ordered',
    type: PathologyReport,
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  create(
    @Body() dto: CreatePathologyDto,
    @CurrentUser() user: UserDocument,
  ): Promise<PathologyReportDocument> {
    return this.pathologyService.create(dto, String(user._id));
  }

  @Get('my-reports')
  @ApiOperation({ summary: "Get current patient's pathology reports" })
  @ApiPaginatedResponse(PathologyReport)
  findMyReports(
    @CurrentUser() user: UserDocument,
    @Query() filters: PathologyFilterDto,
  ) {
    return this.pathologyService.findMyReports(String(user._id), filters);
  }

  @Get('patient/:patientId')
  @Roles(Role.DOCTOR, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: "Get a patient's pathology reports" })
  @ApiParam({ name: 'patientId', description: 'User ObjectId', type: String })
  @ApiPaginatedResponse(PathologyReport)
  findPatientReports(
    @Param('patientId') patientId: string,
    @Query() filters: PathologyFilterDto,
  ) {
    return this.pathologyService.findPatientReports(patientId, filters);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List all pathology reports (filtered)' })
  @ApiPaginatedResponse(PathologyReport)
  findAll(@Query() filters: PathologyFilterDto) {
    return this.pathologyService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a pathology report by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Report found',
    type: PathologyReport,
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  findOne(@Param('id') id: string): Promise<PathologyReportDocument> {
    return this.pathologyService.findOne(id);
  }

  @Patch(':id/result')
  @Roles(Role.HOSPITAL_STAFF, Role.DOCTOR)
  @ApiOperation({ summary: 'Add/upload pathology result (STAFF)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Result added',
    type: PathologyReport,
  })
  @ApiResponse({ status: 400, description: 'Result file not confirmed' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  addResult(
    @Param('id') id: string,
    @Body() dto: AddResultDto,
  ): Promise<PathologyReportDocument> {
    return this.pathologyService.addResult(id, dto);
  }

  @Patch(':id')
  @Roles(Role.DOCTOR, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Update a pathology test order' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Order updated',
    type: PathologyReport,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePathologyDto,
  ): Promise<PathologyReportDocument> {
    return this.pathologyService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a pathology report (SUPER_ADMIN)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Report deleted',
    type: PathologyReport,
  })
  remove(@Param('id') id: string): Promise<PathologyReportDocument> {
    return this.pathologyService.remove(id);
  }
}
