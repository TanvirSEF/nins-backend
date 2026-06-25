import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { DoctorService } from './doctor.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { DoctorFilterDto } from './dto/doctor-filter.dto';
import { DoctorProfileDocument } from './doctor-profile.schema';
import { DoctorProfile } from './doctor-profile.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('doctors')
@ApiBearerAuth('JWT-auth')
@Controller('doctors')
export class DoctorProfileController {
  constructor(private readonly doctorService: DoctorService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({
    summary: 'Onboard a doctor — create profile (SUPER_ADMIN, HOSPITAL_STAFF)',
  })
  @ApiResponse({
    status: 201,
    description: 'Doctor profile created',
    type: DoctorProfile,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or validation error',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 409,
    description: 'Doctor profile already exists or BMDC already registered',
  })
  onboard(@Body() dto: CreateDoctorProfileDto): Promise<DoctorProfileDocument> {
    return this.doctorService.onboard(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all doctor profiles (paginated, filterable)' })
  @ApiPaginatedResponse(DoctorProfile)
  @ApiResponse({ status: 200, description: 'Paginated list of doctors' })
  findAll(@Query() filters: DoctorFilterDto) {
    return this.doctorService.findAll(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a doctor profile by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Doctor profile found',
    type: DoctorProfile,
  })
  @ApiResponse({ status: 404, description: 'Doctor profile not found' })
  findOne(@Param('id') id: string): Promise<DoctorProfileDocument> {
    return this.doctorService.findOne(id);
  }

  @Patch(':id/profile-picture')
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload doctor profile picture (SUPER_ADMIN)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'DoctorProfile ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Profile picture updated',
    type: DoctorProfile,
  })
  @ApiResponse({ status: 400, description: 'Invalid image or size > 5MB' })
  @ApiResponse({ status: 404, description: 'Doctor profile not found' })
  uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DoctorProfileDocument> {
    return this.doctorService.updateProfilePicture(id, file);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a doctor profile (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Doctor profile updated',
    type: DoctorProfile,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Doctor profile not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorProfileDto,
  ): Promise<DoctorProfileDocument> {
    return this.doctorService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a doctor profile (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Doctor profile deleted',
    type: DoctorProfile,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Doctor profile not found' })
  remove(@Param('id') id: string): Promise<DoctorProfileDocument> {
    return this.doctorService.remove(id);
  }
}
