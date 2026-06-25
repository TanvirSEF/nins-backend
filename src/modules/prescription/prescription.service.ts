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
import { Prescription, PrescriptionDocument } from './prescription.schema';
import {
  MedicalRecord,
  MedicalRecordDocument,
  MedicalRecordStatus,
} from '../medical-record/medical-record.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionFilterDto } from './dto/prescription-filter.dto';

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
export class PrescriptionService {
  constructor(
    @InjectModel(Prescription.name)
    private prescriptionModel: Model<PrescriptionDocument>,
    @InjectModel(MedicalRecord.name)
    private medicalRecordModel: Model<MedicalRecordDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Create Prescription ──────────────────────────────────────────────────────
  async create(
    dto: CreatePrescriptionDto,
    userId: string,
  ): Promise<PrescriptionDocument> {
    // 1. Validate at least one medicine or test
    const hasMedicines = dto.medicines && dto.medicines.length > 0;
    const hasTests = dto.tests && dto.tests.length > 0;
    if (!hasMedicines && !hasTests) {
      throw new BadRequestException(
        'Prescription must contain at least one medicine or test',
      );
    }

    // 2. Find the medical record
    const medicalRecord = await this.medicalRecordModel
      .findById(dto.medicalRecordId)
      .exec();
    if (!medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }

    // 3. Verify medical record is ACTIVE
    if (medicalRecord.status !== MedicalRecordStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot create prescription for an archived medical record',
      );
    }

    // 4. Find doctor profile for the current user
    const doctorProfile = await this.doctorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doctorProfile) {
      throw new ForbiddenException('Doctor profile not found');
    }

    // 5. Verify doctor owns this medical record
    if (!medicalRecord.doctorId.equals(doctorProfile._id)) {
      throw new ForbiddenException(
        'You can only create prescriptions for your own medical records',
      );
    }

    // 6. Check no existing prescription for this medical record
    const existing = await this.prescriptionModel
      .findOne({
        medicalRecordId: new Types.ObjectId(dto.medicalRecordId),
      })
      .exec();
    if (existing) {
      throw new ConflictException(
        'A prescription already exists for this medical record',
      );
    }

    // 7. Create prescription
    const prescription = new this.prescriptionModel({
      medicalRecordId: new Types.ObjectId(dto.medicalRecordId),
      appointmentId: medicalRecord.appointmentId,
      patientId: medicalRecord.patientId,
      doctorId: doctorProfile._id,
      medicines: dto.medicines,
      tests: dto.tests || [],
      advice: dto.advice || [],
      notes: dto.notes,
      nextVisitDate: dto.nextVisitDate
        ? new Date(dto.nextVisitDate)
        : undefined,
    });
    const saved = await prescription.save();

    await this.invalidatePrescriptionCache(
      String(saved._id),
      String(saved.patientId),
      String(saved.doctorId),
    );

    return saved;
  }

  // ─── Find All (Paginated + Cached) ───────────────────────────────────────────
  async findAll(
    filters: PrescriptionFilterDto,
  ): Promise<PaginatedResult<PrescriptionDocument>> {
    const { page, limit, patientId, doctorId } = filters;

    const cacheKey = `prescriptions:patient:${patientId || 'all'}:doctor:${doctorId || 'all'}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<PrescriptionDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = {};
    if (patientId) query.patientId = new Types.ObjectId(patientId);
    if (doctorId) query.doctorId = new Types.ObjectId(doctorId);

    const [prescriptions, total] = await Promise.all([
      this.prescriptionModel
        .find(query)
        .populate('patientId', 'name email phone')
        .populate('doctorId', 'designation specialties')
        .populate('medicalRecordId', 'chiefComplaint diagnosis')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.prescriptionModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<PrescriptionDocument> = {
      data: prescriptions,
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

  // ─── Find One ─────────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<PrescriptionDocument> {
    const cacheKey = `prescriptions:${id}`;
    const cached = await this.cacheManager.get<PrescriptionDocument>(cacheKey);
    if (cached) return cached;

    const prescription = await this.prescriptionModel
      .findById(id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation specialties')
      .populate('medicalRecordId', 'chiefComplaint diagnosis vitals')
      .populate('appointmentId', 'appointmentDate serialNumber status')
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription #${id} not found`);
    }

    await this.cacheManager.set(cacheKey, prescription, 300);
    return prescription;
  }

  // ─── Patient's Own Prescriptions ──────────────────────────────────────────────
  async findMyPrescriptions(
    userId: string,
    filters: PrescriptionFilterDto,
  ): Promise<PaginatedResult<PrescriptionDocument>> {
    const { page, limit } = filters;

    const cacheKey = `prescriptions:patient-self:${userId}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<PrescriptionDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query = { patientId: new Types.ObjectId(userId) };

    const [prescriptions, total] = await Promise.all([
      this.prescriptionModel
        .find(query)
        .populate('doctorId', 'designation specialties')
        .populate('medicalRecordId', 'chiefComplaint diagnosis')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.prescriptionModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<PrescriptionDocument> = {
      data: prescriptions,
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

  // ─── Find by Medical Record ───────────────────────────────────────────────────
  async findByMedicalRecord(
    medicalRecordId: string,
  ): Promise<PrescriptionDocument> {
    const cacheKey = `prescriptions:medical-record:${medicalRecordId}`;
    const cached = await this.cacheManager.get<PrescriptionDocument>(cacheKey);
    if (cached) return cached;

    const prescription = await this.prescriptionModel
      .findOne({
        medicalRecordId: new Types.ObjectId(medicalRecordId),
      })
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation specialties')
      .populate('medicalRecordId', 'chiefComplaint diagnosis')
      .exec();

    if (!prescription) {
      throw new NotFoundException(
        `No prescription found for medical record #${medicalRecordId}`,
      );
    }

    await this.cacheManager.set(cacheKey, prescription, 300);
    return prescription;
  }

  // ─── Find by Appointment ──────────────────────────────────────────────────────
  async findByAppointment(
    appointmentId: string,
  ): Promise<PrescriptionDocument> {
    const cacheKey = `prescriptions:appointment:${appointmentId}`;
    const cached = await this.cacheManager.get<PrescriptionDocument>(cacheKey);
    if (cached) return cached;

    const prescription = await this.prescriptionModel
      .findOne({
        appointmentId: new Types.ObjectId(appointmentId),
      })
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation specialties')
      .populate('medicalRecordId', 'chiefComplaint diagnosis')
      .exec();

    if (!prescription) {
      throw new NotFoundException(
        `No prescription found for appointment #${appointmentId}`,
      );
    }

    await this.cacheManager.set(cacheKey, prescription, 300);
    return prescription;
  }

  // ─── Update ───────────────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionDocument> {
    const prescription = await this.prescriptionModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription #${id} not found`);
    }

    await this.invalidatePrescriptionCache(
      String(prescription._id),
      String(prescription.patientId),
      String(prescription.doctorId),
    );

    return prescription;
  }

  // ─── Remove ───────────────────────────────────────────────────────────────────
  async remove(id: string): Promise<PrescriptionDocument> {
    const prescription = await this.prescriptionModel
      .findByIdAndDelete(id)
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription #${id} not found`);
    }

    await this.invalidatePrescriptionCache(
      String(prescription._id),
      String(prescription.patientId),
      String(prescription.doctorId),
    );

    return prescription;
  }

  // ─── Cache Invalidation ───────────────────────────────────────────────────────
  private async invalidatePrescriptionCache(
    id: string,
    patientId: string,
    doctorId: string,
  ): Promise<void> {
    const keysToDelete: Promise<any>[] = [];

    // Single record cache
    keysToDelete.push(this.cacheManager.del(`prescriptions:${id}`));

    // List caches (all filter/page combinations)
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        // Global list caches
        for (const pat of ['all', patientId]) {
          for (const doc of ['all', doctorId]) {
            keysToDelete.push(
              this.cacheManager.del(
                `prescriptions:patient:${pat}:doctor:${doc}:page:${p}:limit:${l}`,
              ),
            );
          }
        }
        // Patient self caches
        keysToDelete.push(
          this.cacheManager.del(
            `prescriptions:patient-self:${patientId}:page:${p}:limit:${l}`,
          ),
        );
      }
    }

    await Promise.all(keysToDelete);
  }
}
