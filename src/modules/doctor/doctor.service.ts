import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DoctorProfile, DoctorProfileDocument } from './doctor-profile.schema';
import {
  Department,
  DepartmentDocument,
} from '../department/department.schema';
import { User, UserDocument } from '../user/user.schema';
import { Role } from '../user/user.schema';
import { ImageService } from '../upload/image.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { DoctorFilterDto } from './dto/doctor-filter.dto';

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
export class DoctorService {
  constructor(
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Department.name)
    private deptModel: Model<DepartmentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private imageService: ImageService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Upload profile picture ──────────────────────────────────────────────────
  async updateProfilePicture(
    id: string,
    file: Express.Multer.File,
  ): Promise<DoctorProfileDocument> {
    const { url } = await this.imageService.uploadImage(file, 'doctors');

    const updated = await this.doctorModel
      .findByIdAndUpdate(id, { profilePicture: url }, { new: true })
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name code')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Doctor profile #${id} not found`);
    }

    await this.invalidateDoctorCache(id);
    return updated;
  }

  async onboard(dto: CreateDoctorProfileDto): Promise<DoctorProfileDocument> {
    // ─── Duplicate Checks ──────────────────────────────────────────────────
    const existingProfile = await this.doctorModel
      .findOne({ userId: dto.userId })
      .exec();
    if (existingProfile) {
      throw new ConflictException(
        'Doctor profile already exists for this user',
      );
    }

    const existingBmdc = await this.doctorModel
      .findOne({ bmdcReg: dto.bmdcReg })
      .exec();
    if (existingBmdc) {
      throw new ConflictException('BMDC registration number already exists');
    }

    // ─── User Validation ───────────────────────────────────────────────────
    const user = await this.userModel.findById(dto.userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== Role.DOCTOR) {
      throw new BadRequestException('User does not have DOCTOR role');
    }

    // ─── Department Validation ─────────────────────────────────────────────
    const department = await this.deptModel.findById(dto.departmentId).exec();
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // ─── Unit Validation (if provided) ─────────────────────────────────────
    if (dto.unitId) {
      const unitObjectId = new Types.ObjectId(dto.unitId);
      const unitExists = department.units?.some((u) =>
        (u as any)._id.equals(unitObjectId),
      );
      if (!unitExists) {
        throw new BadRequestException(
          'Unit not found in the specified department',
        );
      }
    }

    // ─── Create Profile ────────────────────────────────────────────────────
    const doctor = new this.doctorModel({
      ...dto,
      userId: new Types.ObjectId(dto.userId),
      departmentId: new Types.ObjectId(dto.departmentId),
      unitId: dto.unitId ? new Types.ObjectId(dto.unitId) : undefined,
    });
    const saved = await doctor.save();
    await this.invalidateListCache();
    return saved;
  }

  async findAll(
    filters: DoctorFilterDto,
  ): Promise<PaginatedResult<DoctorProfileDocument>> {
    const { page, limit, departmentId, designation, specialty } = filters;

    const cacheKey = `doctors:dept:${departmentId || 'all'}:desig:${designation || 'all'}:spec:${specialty || 'all'}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<DoctorProfileDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    // Build query filters
    const query: any = {};
    if (departmentId) query.departmentId = new Types.ObjectId(departmentId);
    if (designation) query.designation = designation;
    if (specialty) query.specialties = { $regex: specialty, $options: 'i' };

    const [doctors, total] = await Promise.all([
      this.doctorModel
        .find(query)
        .populate('userId', 'name email phone')
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.doctorModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<DoctorProfileDocument> = {
      data: doctors,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async findOne(id: string): Promise<DoctorProfileDocument> {
    const cacheKey = `doctors:${id}`;
    const cached = await this.cacheManager.get<DoctorProfileDocument>(cacheKey);
    if (cached) return cached;

    const doctor = await this.doctorModel
      .findById(id)
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name code')
      .exec();

    if (!doctor) {
      throw new NotFoundException(`Doctor profile #${id} not found`);
    }
    await this.cacheManager.set(cacheKey, doctor, 300);
    return doctor;
  }

  async update(
    id: string,
    dto: UpdateDoctorProfileDto,
  ): Promise<DoctorProfileDocument> {
    // Validate departmentId if being changed
    if (dto.departmentId) {
      const department = await this.deptModel.findById(dto.departmentId).exec();
      if (!department) {
        throw new NotFoundException('Department not found');
      }

      // Validate unitId against the (new) department
      if (dto.unitId) {
        const unitObjectId = new Types.ObjectId(dto.unitId);
        const unitExists = department.units?.some((u) =>
          (u as any)._id.equals(unitObjectId),
        );
        if (!unitExists) {
          throw new BadRequestException(
            'Unit not found in the specified department',
          );
        }
      }
    }

    // Convert ObjectId strings
    const updateData: any = { ...dto };
    if (dto.userId) updateData.userId = new Types.ObjectId(dto.userId);
    if (dto.departmentId)
      updateData.departmentId = new Types.ObjectId(dto.departmentId);
    if (dto.unitId) updateData.unitId = new Types.ObjectId(dto.unitId);

    const doctor = await this.doctorModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name code')
      .exec();

    if (!doctor) {
      throw new NotFoundException(`Doctor profile #${id} not found`);
    }
    await this.invalidateDoctorCache(id);
    return doctor;
  }

  async remove(id: string): Promise<DoctorProfileDocument> {
    const doctor = await this.doctorModel.findByIdAndDelete(id).exec();
    if (!doctor) {
      throw new NotFoundException(`Doctor profile #${id} not found`);
    }
    await this.invalidateDoctorCache(id);
    return doctor;
  }

  private async invalidateDoctorCache(id: string): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`doctors:${id}`),
      this.invalidateListCache(),
    ]);
  }

  private async invalidateListCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        keysToDelete.push(
          this.cacheManager.del(
            `doctors:dept:all:desig:all:spec:all:page:${p}:limit:${l}`,
          ),
        );
      }
    }
    await Promise.all(keysToDelete);
  }
}
