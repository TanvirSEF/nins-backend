import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import {
  MedicalRecord,
  MedicalRecordDocument,
} from '../medical-record/medical-record.schema';
import {
  Prescription,
  PrescriptionDocument,
} from '../prescription/prescription.schema';
import {
  Department,
  DepartmentDocument,
} from '../department/department.schema';

@Injectable()
export class DoctorDashboardService {
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(MedicalRecord.name)
    private medicalRecordModel: Model<MedicalRecordDocument>,
    @InjectModel(Prescription.name)
    private prescriptionModel: Model<PrescriptionDocument>,
    @InjectModel(Department.name)
    private deptModel: Model<DepartmentDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Full Doctor Dashboard ───────────────────────────────────────────────────
  async getDashboard(userId: string): Promise<any> {
    const doctorProfile = await this.resolveDoctor(userId);
    const todayStr = new Date().toISOString().split('T')[0];
    const cacheKey = `doctor-dashboard:${doctorProfile._id}:date:${todayStr}`;

    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const data = await this.buildDashboard(doctorProfile);
    await this.cacheManager.set(cacheKey, data, 60);
    return data;
  }

  // ─── Today's Queue only ──────────────────────────────────────────────────────
  async getTodayQueue(userId: string): Promise<any[]> {
    const doctorProfile = await this.resolveDoctor(userId);
    const data = await this.buildDashboard(doctorProfile);
    return data.todayQueue;
  }

  // ─── Stats only ──────────────────────────────────────────────────────────────
  async getStats(userId: string): Promise<any> {
    const doctorProfile = await this.resolveDoctor(userId);
    const data = await this.buildDashboard(doctorProfile);
    return {
      doctor: data.doctor,
      stats: data.stats,
    };
  }

  // ─── Build the dashboard data ────────────────────────────────────────────────
  private async buildDashboard(doctor: DoctorProfileDocument): Promise<any> {
    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const endOfToday = this.endOfDay(now);
    const sevenDaysAhead = new Date(now);
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

    const department = doctor.departmentId
      ? await this.deptModel.findById(doctor.departmentId).select('name').exec()
      : null;

    const [
      todayAppointments,
      totalToday,
      completedToday,
      pendingToday,
      upcomingThisWeek,
      totalPatientsSeen,
      recentRecords,
      recentPrescriptions,
    ] = await Promise.all([
      // Today's appointments (queue)
      this.appointmentModel
        .find({
          doctorId: doctor._id,
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: { $ne: AppointmentStatus.CANCELLED },
        })
        .populate('patientId', 'name phone email')
        .sort({ serialNumber: 1 })
        .exec(),

      // Total today
      this.appointmentModel
        .countDocuments({
          doctorId: doctor._id,
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: { $ne: AppointmentStatus.CANCELLED },
        })
        .exec(),

      // Completed today
      this.appointmentModel
        .countDocuments({
          doctorId: doctor._id,
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: AppointmentStatus.COMPLETED,
        })
        .exec(),

      // Pending today
      this.appointmentModel
        .countDocuments({
          doctorId: doctor._id,
          appointmentDate: { $gte: startOfToday, $lt: endOfToday },
          status: AppointmentStatus.PENDING,
        })
        .exec(),

      // Upcoming this week (future, not cancelled)
      this.appointmentModel
        .countDocuments({
          doctorId: doctor._id,
          appointmentDate: { $gte: endOfToday, $lte: sevenDaysAhead },
          status: { $ne: AppointmentStatus.CANCELLED },
        })
        .exec(),

      // Total distinct patients seen (all-time)
      this.appointmentModel
        .aggregate<{
          count: number;
        }>([
          { $match: { doctorId: doctor._id } },
          { $group: { _id: '$patientId' } },
          { $count: 'count' },
        ])
        .exec(),

      // Recent medical records
      this.medicalRecordModel
        .find({ doctorId: doctor._id })
        .populate('patientId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('chiefComplaint diagnosis createdAt')
        .exec(),

      // Recent prescriptions
      this.prescriptionModel
        .find({ doctorId: doctor._id })
        .populate('patientId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('medicines createdAt')
        .exec(),
    ]);

    return {
      doctor: {
        id: String(doctor._id),
        designation: doctor.designation,
        departmentName: department?.name || null,
        profilePicture: doctor.profilePicture,
      },
      todayQueue: todayAppointments.map((a: any) => ({
        appointmentId: String(a._id),
        serialNumber: a.serialNumber,
        patientName: a.patientId?.name || 'Unknown',
        patientPhone: a.patientId?.phone || null,
        status: a.status,
        appointmentDate: a.appointmentDate,
      })),
      stats: {
        totalToday,
        completedToday,
        pendingToday,
        upcomingThisWeek,
        totalPatientsSeen: totalPatientsSeen[0]?.count || 0,
      },
      recentRecords,
      recentPrescriptions,
    };
  }

  // ─── Resolve DoctorProfile from JWT userId ───────────────────────────────────
  private async resolveDoctor(userId: string): Promise<DoctorProfileDocument> {
    const doctor = await this.doctorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doctor) {
      throw new ForbiddenException('Doctor profile not found for this user');
    }
    return doctor;
  }

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
