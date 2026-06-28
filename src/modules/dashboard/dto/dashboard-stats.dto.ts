import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Bed Type Stats
export class BedTypeStats {
  @ApiProperty({ description: 'Total beds', example: 16 })
  total: number;

  @ApiProperty({ description: 'Occupied beds', example: 10 })
  occupied: number;

  @ApiProperty({ description: 'Available beds', example: 6 })
  available: number;
}

// Overview Stats
export class OverviewStats {
  @ApiProperty({ description: 'Total registered patients', example: 1250 })
  totalPatients: number;

  @ApiProperty({ description: 'Total doctor profiles', example: 45 })
  totalDoctors: number;

  @ApiProperty({ description: 'Total departments', example: 8 })
  totalDepartments: number;

  @ApiProperty({ description: 'Total appointments (all time)', example: 5200 })
  totalAppointments: number;

  @ApiProperty({ description: "Today's appointments", example: 32 })
  todayAppointments: number;

  @ApiProperty({ description: "Today's completed appointments", example: 18 })
  todayCompleted: number;

  @ApiProperty({ description: "Today's cancelled appointments", example: 3 })
  todayCancelled: number;
}

// Appointment Trend Day
export class AppointmentTrendDay {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-06-13' })
  date: string;

  @ApiProperty({ description: 'Total appointments', example: 45 })
  total: number;

  @ApiProperty({ description: 'Completed', example: 30 })
  completed: number;

  @ApiProperty({ description: 'Cancelled', example: 5 })
  cancelled: number;

  @ApiProperty({ description: 'Pending', example: 10 })
  pending: number;
}

// Top Department
export class TopDepartment {
  @ApiProperty({
    description: 'Department ID',
    example: '507f1f77bcf86cd799439011',
  })
  departmentId: string;

  @ApiProperty({ description: 'Department name', example: 'Neurology' })
  name: string;

  @ApiProperty({ description: 'Total appointments', example: 320 })
  appointmentCount: number;
}

// Recent Appointment
export class RecentAppointment {
  @ApiProperty({ description: 'Appointment ID' })
  id: string;

  @ApiProperty({ description: 'Patient name', example: 'Rahim Uddin' })
  patientName: string;

  @ApiProperty({ description: 'Doctor designation', example: 'Neurologist' })
  doctorName: string;

  @ApiProperty({ description: 'Appointment date' })
  date: Date;

  @ApiProperty({ description: 'Status', example: 'PENDING' })
  status: string;

  @ApiProperty({ description: 'Serial number', example: 5 })
  serialNumber: number;
}

// Full Dashboard Stats Response
export class DashboardStatsResponse {
  @ApiProperty({ description: 'Overview statistics', type: OverviewStats })
  overview: OverviewStats;

  @ApiProperty({
    description: 'Bed status breakdown',
    type: Object,
    example: {
      icu: { total: 16, occupied: 10, available: 6 },
      hdu: { total: 12, occupied: 8, available: 4 },
    },
  })
  bedStatus: {
    icu: BedTypeStats;
    hdu: BedTypeStats;
  };

  @ApiProperty({
    description: 'Last 7 days appointment trend',
    type: [AppointmentTrendDay],
  })
  appointmentTrends: AppointmentTrendDay[];

  @ApiProperty({
    description: 'Top 5 departments by appointments',
    type: [TopDepartment],
  })
  topDepartments: TopDepartment[];

  @ApiProperty({
    description: '10 most recent appointments',
    type: [RecentAppointment],
  })
  recentAppointments: RecentAppointment[];
}
