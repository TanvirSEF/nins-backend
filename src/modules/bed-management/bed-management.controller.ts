import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BedManagementService } from './bed-management.service';
import { UpdateBedStatusDto } from './dto/update-bed-status.dto';
import { BedDocument } from './schemas/bed.schema';
import { Bed, BedType } from './schemas/bed.schema';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('bed-management')
@ApiBearerAuth('JWT-auth')
@Controller('bed-management')
export class BedManagementController {
  constructor(
    private readonly bedManagementService: BedManagementService,
  ) {}

  @Get('live-board')
  @Public()
  @ApiOperation({
    summary: 'Live bed availability board (ICU/HDU breakdown)',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated availability stats grouped by bed type',
  })
  getLiveBoard() {
    return this.bedManagementService.getLiveAvailabilityBoard();
  }

  @Get('beds')
  @Public()
  @ApiOperation({ summary: 'List all beds (optionally filter by type)' })
  @ApiQuery({
    name: 'type',
    description: 'Filter by bed type',
    enum: BedType,
    required: false,
  })
  @ApiResponse({ status: 200, description: 'List of beds', type: [Bed] })
  findAll(@Query('type') type?: BedType): Promise<BedDocument[]> {
    return this.bedManagementService.findAll(type);
  }

  @Get('beds/:id')
  @Public()
  @ApiOperation({ summary: 'Get a single bed by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Bed found', type: Bed })
  @ApiResponse({ status: 404, description: 'Bed not found' })
  findOne(@Param('id') id: string): Promise<BedDocument> {
    return this.bedManagementService.findOne(id);
  }

  @Patch('beds/:id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({
    summary: 'Assign or release a bed (SUPER_ADMIN, HOSPITAL_STAFF)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Bed status updated', type: Bed })
  @ApiResponse({ status: 400, description: 'Bed already occupied or missing patient name' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Bed not found' })
  updateBedStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBedStatusDto,
  ): Promise<BedDocument> {
    return this.bedManagementService.updateBedStatus(id, dto);
  }
}
