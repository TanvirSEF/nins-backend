import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('doctor-dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('doctor-dashboard')
export class DoctorDashboardController {
  constructor(
    private readonly doctorDashboardService: DoctorDashboardService,
  ) {}

  @Get()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: "Get current doctor's full dashboard" })
  @ApiResponse({ status: 200, description: 'Doctor dashboard data' })
  @ApiResponse({ status: 403, description: 'Not a doctor' })
  getDashboard(@CurrentUser() user: UserDocument) {
    return this.doctorDashboardService.getDashboard(String(user._id));
  }

  @Get('today-queue')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: "Get today's appointment queue for current doctor" })
  @ApiResponse({ status: 200, description: 'Today queue' })
  getTodayQueue(@CurrentUser() user: UserDocument) {
    return this.doctorDashboardService.getTodayQueue(String(user._id));
  }

  @Get('stats')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Get stats summary for current doctor' })
  @ApiResponse({ status: 200, description: 'Stats summary' })
  getStats(@CurrentUser() user: UserDocument) {
    return this.doctorDashboardService.getStats(String(user._id));
  }
}
