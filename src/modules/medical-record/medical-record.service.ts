import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  MedicalRecord,
  MedicalRecordDocument,
  MedicalRecordStatus,
} from './medical-record.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordFilterDto } from './dto/medical-record-filter.dto';

export interface PaginatedResult<T> {
  data: T[];
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
export class MedicalRecordService {
  constructor(
    @InjectModel(MedicalRecord.name)
    private medicalRecordModel: Model<MedicalRecordDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Create Medical Record
  async create(
    dto: CreateMedicalRecordDto,
    userId: string,
  ): Promise<MedicalRecordDocument> {
    // 1. Find the appointment
    const appointment = await this.appointmentModel
      .findById(dto.appointmentId)
      .exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // 2. Verify appointment is COMPLETED
    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Medical records can only be created for completed appointments',
      );
    }

    // 3. Find doctor profile for the current user
    const doctorProfile = await this.doctorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doctorProfile) {
      throw new ForbiddenException('Doctor profile not found');
    }

    // 4. Verify doctor owns this appointment
    if (!appointment.doctorId.equals(doctorProfile._id)) {
      throw new ForbiddenException(
        'You can only create records for your own appointments',
      );
    }

    // 5. Check no existing record for this appointment
    const existing = await this.medicalRecordModel
      .findOne({ appointmentId: new Types.ObjectId(dto.appointmentId) })
      .exec();
    if (existing) {
      throw new ConflictException(
        'A medical record already exists for this appointment',
      );
    }

    // 6. Create the record
    const record = new this.medicalRecordModel({
      appointmentId: new Types.ObjectId(dto.appointmentId),
      patientId: appointment.patientId,
      doctorId: doctorProfile._id,
      chiefComplaint: dto.chiefComplaint,
      presentIllness: dto.presentIllness,
      pastHistory: dto.pastHistory,
      examinationFindings: dto.examinationFindings,
      vitals: dto.vitals,
      diagnosis: dto.diagnosis,
      notes: dto.notes,
      followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
    });
    const saved = await record.save();

    await this.invalidateRecordCache(
      String(saved._id),
      String(saved.patientId),
      String(saved.doctorId),
    );

    return saved;
  }

  // Find All (Paginated + Cached)
  async findAll(
    filters: MedicalRecordFilterDto,
  ): Promise<PaginatedResult<MedicalRecordDocument>> {
    const { page, limit, patientId, doctorId, status } = filters;

    const cacheKey = `medical-records:patient:${patientId || 'all'}:doctor:${doctorId || 'all'}:status:${status || 'all'}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<MedicalRecordDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = {};
    if (patientId) query.patientId = new Types.ObjectId(patientId);
    if (doctorId) query.doctorId = new Types.ObjectId(doctorId);
    if (status) query.status = status;

    const [records, total] = await Promise.all([
      this.medicalRecordModel
        .find(query)
        .populate('patientId', 'name email phone')
        .populate('doctorId', 'designation specialties')
        .populate('appointmentId', 'appointmentDate serialNumber status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.medicalRecordModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<MedicalRecordDocument> = {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  // Find One
  async findOne(id: string): Promise<MedicalRecordDocument> {
    const cacheKey = `medical-records:${id}`;
    const cached = await this.cacheManager.get<MedicalRecordDocument>(cacheKey);
    if (cached) return cached;

    const record = await this.medicalRecordModel
      .findById(id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation specialties')
      .populate('appointmentId', 'appointmentDate serialNumber status')
      .exec();

    if (!record) {
      throw new NotFoundException(`Medical record #${id} not found`);
    }

    await this.cacheManager.set(cacheKey, record, 300);
    return record;
  }

  // Patient's Own Records
  async findMyRecords(
    userId: string,
    filters: MedicalRecordFilterDto,
  ): Promise<PaginatedResult<MedicalRecordDocument>> {
    const { page, limit, status } = filters;

    const cacheKey = `medical-records:patient-self:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<MedicalRecordDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = { patientId: new Types.ObjectId(userId) };
    if (status) query.status = status;

    const [records, total] = await Promise.all([
      this.medicalRecordModel
        .find(query)
        .populate('doctorId', 'designation specialties')
        .populate('appointmentId', 'appointmentDate serialNumber')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.medicalRecordModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<MedicalRecordDocument> = {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  // Find by Appointment
  async findByAppointment(
    appointmentId: string,
  ): Promise<MedicalRecordDocument> {
    const cacheKey = `medical-records:appointment:${appointmentId}`;
    const cached = await this.cacheManager.get<MedicalRecordDocument>(cacheKey);
    if (cached) return cached;

    const record = await this.medicalRecordModel
      .findOne({ appointmentId: new Types.ObjectId(appointmentId) })
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation specialties')
      .populate('appointmentId', 'appointmentDate serialNumber status')
      .exec();

    if (!record) {
      throw new NotFoundException(
        `No medical record found for appointment #${appointmentId}`,
      );
    }

    await this.cacheManager.set(cacheKey, record, 300);
    return record;
  }

  // Update
  async update(
    id: string,
    dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordDocument> {
    const record = await this.medicalRecordModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();

    if (!record) {
      throw new NotFoundException(`Medical record #${id} not found`);
    }

    await this.invalidateRecordCache(
      String(record._id),
      String(record.patientId),
      String(record.doctorId),
    );

    return record;
  }

  // Remove
  async remove(id: string): Promise<MedicalRecordDocument> {
    const record = await this.medicalRecordModel.findByIdAndDelete(id).exec();

    if (!record) {
      throw new NotFoundException(`Medical record #${id} not found`);
    }

    await this.invalidateRecordCache(
      String(record._id),
      String(record.patientId),
      String(record.doctorId),
    );

    return record;
  }

  // Cache Invalidation
  private async invalidateRecordCache(
    id: string,
    patientId: string,
    doctorId: string,
  ): Promise<void> {
    const keysToDelete: Promise<any>[] = [];

    // Single record cache
    keysToDelete.push(this.cacheManager.del(`medical-records:${id}`));
    keysToDelete.push(this.cacheManager.del(`medical-records:appointment:*`));

    // List caches (all filter/page combinations)
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        // Global list caches
        for (const pat of ['all', patientId]) {
          for (const doc of ['all', doctorId]) {
            for (const st of [
              'all',
              MedicalRecordStatus.ACTIVE,
              MedicalRecordStatus.ARCHIVED,
            ]) {
              keysToDelete.push(
                this.cacheManager.del(
                  `medical-records:patient:${pat}:doctor:${doc}:status:${st}:page:${p}:limit:${l}`,
                ),
              );
            }
          }
        }
        // Patient self caches
        keysToDelete.push(
          this.cacheManager.del(
            `medical-records:patient-self:${patientId}:status:all:page:${p}:limit:${l}`,
          ),
        );
        keysToDelete.push(
          this.cacheManager.del(
            `medical-records:patient-self:${patientId}:status:${MedicalRecordStatus.ACTIVE}:page:${p}:limit:${l}`,
          ),
        );
      }
    }

    await Promise.all(keysToDelete);
  }
}
