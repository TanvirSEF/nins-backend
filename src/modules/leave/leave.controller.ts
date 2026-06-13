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
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { LeaveFilterDto } from './dto/leave-filter.dto';
import { LeaveDocument, Leave } from './leave.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('leave')
@ApiBearerAuth('JWT-auth')
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Request leave (DOCTOR)' })
  @ApiResponse({ status: 201, description: 'Leave requested', type: Leave })
  @ApiResponse({ status: 400, description: 'Invalid dates or overlapping leave' })
  @ApiResponse({ status: 403, description: 'Doctor profile not found' })
  create(
    @Body() dto: CreateLeaveDto,
    @CurrentUser() user: UserDocument,
  ): Promise<LeaveDocument> {
    return this.leaveService.create(dto, String(user._id));
  }

  @Get('my-leaves')
  @ApiOperation({ summary: "Get current doctor's leave requests" })
  @ApiPaginatedResponse(Leave)
  findMyLeaves(
    @CurrentUser() user: UserDocument,
    @Query() filters: LeaveFilterDto,
  ) {
    return this.leaveService.findMyLeaves(String(user._id), filters);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List all leave requests (filtered)' })
  @ApiPaginatedResponse(Leave)
  findAll(@Query() filters: LeaveFilterDto) {
    return this.leaveService.findAll(filters);
  }

  @Get(':id')
  @Roles(Role.DOCTOR, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get a leave request by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Leave found', type: Leave })
  @ApiResponse({ status: 404, description: 'Leave not found' })
  findOne(@Param('id') id: string): Promise<LeaveDocument> {
    return this.leaveService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Approve or reject a leave request (ADMIN)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Leave reviewed', type: Leave })
  @ApiResponse({ status: 400, description: 'Already reviewed or missing reason' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @CurrentUser() user: UserDocument,
  ): Promise<LeaveDocument> {
    return this.leaveService.review(id, dto, String(user._id));
  }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Update own pending leave request (DOCTOR)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Leave updated', type: Leave })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveDto,
    @CurrentUser() user: UserDocument,
  ): Promise<LeaveDocument> {
    return this.leaveService.update(id, dto, String(user._id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/delete a leave request (owner or ADMIN)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Leave cancelled/deleted', type: Leave })
  @ApiResponse({ status: 403, description: 'Not your leave request' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<LeaveDocument> {
    return this.leaveService.remove(
      id,
      String(user._id),
      user.role === Role.SUPER_ADMIN,
    );
  }
}
