import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { User, UserDocument, Role } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import {
  Department,
  DepartmentDocument,
} from '../department/department.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import {
  Bed,
  BedDocument,
  BedType,
} from '../bed-management/schemas/bed.schema';
import {
  DashboardStatsResponse,
  OverviewStats,
  BedTypeStats,
  AppointmentTrendDay,
  TopDepartment,
  RecentAppointment,
} from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Department.name)
    private deptModel: Model<DepartmentDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Full Dashboard Stats
  async getFullStats(): Promise<DashboardStatsResponse> {
    const cacheKey = 'dashboard:stats';
    const cached =
      await this.cacheManager.get<DashboardStatsResponse>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const endOfToday = this.endOfDay(now);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [
      totalPatients,
      totalDoctors,
      totalDepartments,
      totalAppointments,
      todayAppointments,
      todayCompleted,
      todayCancelled,
      icuStats,
      hduStats,
      appointmentTrends,
      topDepartments,
      recentAppointments,
    ] = await Promise.all([
      // Patient count
      this.userModel.countDocuments({ role: Role.PATIENT }).exec(),

      // Doctor count
      this.doctorModel.countDocuments().exec(),

      // Department count
      this.deptModel.countDocuments().exec(),

      // Total appointments
      this.appointmentModel.countDocuments().exec(),

      // Today's appointments
      this.appointmentModel
        .countDocuments({
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
        })
        .exec(),

      // Today completed
      this.appointmentModel
        .countDocuments({
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: AppointmentStatus.COMPLETED,
        })
        .exec(),

      // Today cancelled
      this.appointmentModel
        .countDocuments({
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: AppointmentStatus.CANCELLED,
        })
        .exec(),

      // ICU bed aggregation
      this.bedModel
        .aggregate<{ total: number; occupied: number }>([
          { $match: { type: BedType.ICU } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              occupied: {
                $sum: { $cond: ['$isOccupied', 1, 0] },
              },
            },
          },
        ])
        .exec(),

      // HDU bed aggregation
      this.bedModel
        .aggregate<{ total: number; occupied: number }>([
          { $match: { type: BedType.HDU } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              occupied: {
                $sum: { $cond: ['$isOccupied', 1, 0] },
              },
            },
          },
        ])
        .exec(),

      // 7-day appointment trend
      this.appointmentModel
        .aggregate<{
          _id: string;
          total: number;
          completed: number;
          cancelled: number;
          pending: number;
        }>([
          {
            $match: {
              appointmentDate: { $gte: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$appointmentDate',
                },
              },
              total: { $sum: 1 },
              completed: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', AppointmentStatus.COMPLETED] },
                    1,
                    0,
                  ],
                },
              },
              cancelled: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', AppointmentStatus.CANCELLED] },
                    1,
                    0,
                  ],
                },
              },
              pending: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', AppointmentStatus.PENDING] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),

      // Top 5 departments by appointment count
      this.appointmentModel
        .aggregate<{
          appointmentCount: number;
          department: { _id: Types.ObjectId; name: string };
        }>([
          {
            $lookup: {
              from: 'doctorprofiles',
              localField: 'doctorId',
              foreignField: '_id',
              as: 'doctor',
            },
          },
          { $unwind: '$doctor' },
          {
            $group: {
              _id: '$doctor.departmentId',
              appointmentCount: { $sum: 1 },
            },
          },
          { $sort: { appointmentCount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'departments',
              localField: '_id',
              foreignField: '_id',
              as: 'department',
            },
          },
          { $unwind: '$department' },
        ])
        .exec(),

      // Recent 10 appointments
      this.appointmentModel
        .find()
        .populate('patientId', 'name')
        .populate('doctorId', 'designation')
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
    ]);

    // Assemble Response

    const overview: OverviewStats = {
      totalPatients,
      totalDoctors,
      totalDepartments,
      totalAppointments,
      todayAppointments,
      todayCompleted,
      todayCancelled,
    };

    const buildBedStats = (
      raw: { total: number; occupied: number }[],
    ): BedTypeStats => {
      const s = raw[0] || { total: 0, occupied: 0 };
      return {
        total: s.total,
        occupied: s.occupied,
        available: s.total - s.occupied,
      };
    };

    const bedStatus = {
      icu: buildBedStats(icuStats),
      hdu: buildBedStats(hduStats),
    };

    const trends: AppointmentTrendDay[] = appointmentTrends.map((t) => ({
      date: t._id,
      total: t.total,
      completed: t.completed,
      cancelled: t.cancelled,
      pending: t.pending,
    }));

    const topDepts: TopDepartment[] = topDepartments.map((d) => ({
      departmentId: String(d.department._id),
      name: d.department.name,
      appointmentCount: d.appointmentCount,
    }));

    const recent: RecentAppointment[] = recentAppointments.map((a: any) => ({
      id: String(a._id),
      patientName: a.patientId?.name || 'Unknown',
      doctorName: a.doctorId?.designation || 'Unknown',
      date: a.appointmentDate,
      status: a.status,
      serialNumber: a.serialNumber,
    }));

    const response: DashboardStatsResponse = {
      overview,
      bedStatus,
      appointmentTrends: trends,
      topDepartments: topDepts,
      recentAppointments: recent,
    };

    await this.cacheManager.set(cacheKey, response, 60);
    return response;
  }

  // Sub-endpoints (extract from full stats via cache)
  async getOverview(): Promise<OverviewStats> {
    const stats = await this.getFullStats();
    return stats.overview;
  }

  async getAppointmentTrend(): Promise<AppointmentTrendDay[]> {
    const stats = await this.getFullStats();
    return stats.appointmentTrends;
  }

  async getBedStatus(): Promise<{ icu: BedTypeStats; hdu: BedTypeStats }> {
    const stats = await this.getFullStats();
    return stats.bedStatus;
  }

  // Helpers
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
}
