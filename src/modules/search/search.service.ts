import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { User, UserDocument, Role } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import { SearchDto } from './dto/search.dto';

interface SearchResult {
  type: 'patient' | 'doctor' | 'appointment';
  id: string;
  [key: string]: any;
}

export interface PaginatedResult {
  results: SearchResult[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Global search across patients, doctors, appointments
  async search(dto: SearchDto): Promise<PaginatedResult> {
    const term = dto.q.trim();
    const rx = { $regex: term, $options: 'i' };
    const { page, limit, type } = dto;

    const cacheKey = `search:q:${term}:type:${type || 'all'}:page:${page}:limit:${limit}`;
    const cached = await this.cacheManager.get<PaginatedResult>(cacheKey);
    if (cached) return cached;

    const tasks: Promise<SearchResult[]>[] = [];

    // Patients
    if (!type || type === 'patient') {
      tasks.push(
        this.userModel
          .find({
            role: Role.PATIENT,
            $or: [{ name: rx }, { email: rx }, { phone: rx }],
          })
          .select('name email phone createdAt')
          .limit(100)
          .exec()
          .then((users) =>
            users.map((u) => ({
              type: 'patient' as const,
              id: String(u._id),
              name: u.name,
              email: u.email,
              phone: u.phone,
              createdAt: u.createdAt,
            })),
          ),
      );
    }

    // Doctors
    if (!type || type === 'doctor') {
      tasks.push(
        this.doctorModel
          .find({
            $or: [{ designation: rx }, { bmdcReg: rx }, { specialties: rx }],
          })
          .populate('userId', 'name email phone')
          .populate('departmentId', 'name')
          .limit(100)
          .exec()
          .then((doctors) =>
            doctors.map((d: any) => ({
              type: 'doctor' as const,
              id: String(d._id),
              name: d.userId?.name || 'Unknown',
              email: d.userId?.email,
              phone: d.userId?.phone,
              designation: d.designation,
              department: d.departmentId?.name || null,
              bmdcReg: d.bmdcReg,
              profilePicture: d.profilePicture,
            })),
          ),
      );
    }

    // Appointments (by patient name/phone)
    if (!type || type === 'appointment') {
      tasks.push(
        this.appointmentModel
          .aggregate<SearchResult>([
            {
              $lookup: {
                from: 'users',
                localField: 'patientId',
                foreignField: '_id',
                as: 'patient',
              },
            },
            { $unwind: '$patient' },
            {
              $match: {
                status: { $ne: AppointmentStatus.CANCELLED },
                $or: [
                  { 'patient.name': rx },
                  { 'patient.phone': rx },
                  { 'patient.email': rx },
                ],
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 100 },
          ])
          .exec()
          .then((appts) =>
            appts.map((a: any) => ({
              type: 'appointment' as const,
              id: String(a._id),
              patientName: a.patient?.name || 'Unknown',
              patientPhone: a.patient?.phone || null,
              appointmentDate: a.appointmentDate,
              serialNumber: a.serialNumber,
              status: a.status,
            })),
          ),
      );
    }

    const groups = await Promise.all(tasks);
    const allResults = groups.flat();

    // Sort: patients first, then doctors, then appointments
    const typeOrder = { patient: 0, doctor: 1, appointment: 2 };
    allResults.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    const total = allResults.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const pagedResults = allResults.slice(
      (page - 1) * limit,
      (page - 1) * limit + limit,
    );

    const result: PaginatedResult = {
      results: pagedResults,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 30);
    return result;
  }
}
