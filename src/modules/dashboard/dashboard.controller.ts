import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardStatsResponse,
  OverviewStats,
  AppointmentTrendDay,
  BedTypeStats,
} from './dto/dashboard-stats.dto';
import { Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get full dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Full dashboard stats',
    type: DashboardStatsResponse,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getFullStats(): Promise<DashboardStatsResponse> {
    return this.dashboardService.getFullStats();
  }

  @Get('stats/overview')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get overview statistics only' })
  @ApiResponse({
    status: 200,
    description: 'Overview stats',
    type: OverviewStats,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getOverview(): Promise<OverviewStats> {
    return this.dashboardService.getOverview();
  }

  @Get('stats/appointments-trend')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get 7-day appointment trend' })
  @ApiResponse({
    status: 200,
    description: 'Appointment trends',
    type: [AppointmentTrendDay],
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getAppointmentTrend(): Promise<AppointmentTrendDay[]> {
    return this.dashboardService.getAppointmentTrend();
  }

  @Get('stats/bed-status')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get bed availability summary' })
  @ApiResponse({
    status: 200,
    description: 'Bed status',
    type: Object,
    example: {
      icu: { total: 16, occupied: 10, available: 6 },
      hdu: { total: 12, occupied: 8, available: 4 },
    },
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getBedStatus(): Promise<{ icu: BedTypeStats; hdu: BedTypeStats }> {
    return this.dashboardService.getBedStatus();
  }
}
