import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Department, DepartmentDocument } from './department.schema';
import { ImageService } from '../upload/image.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationDto } from '../../common/dto';

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
export class DepartmentService {
  constructor(
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    private imageService: ImageService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Upload department image/logo
  async updateImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<DepartmentDocument> {
    const { url } = await this.imageService.uploadImage(file, 'departments');

    const updated = await this.deptModel
      .findByIdAndUpdate(id, { image: url }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Department #${id} not found`);
    }

    await this.invalidateListCache();
    return updated;
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentDocument> {
    const dept = new this.deptModel(dto);
    const saved = await dept.save();
    await this.invalidateListCache();
    return saved;
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<DepartmentDocument>> {
    const { page, limit } = pagination;
    const cacheKey = `departments:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<DepartmentDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const [departments, total] = await Promise.all([
      this.deptModel
        .find()
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.deptModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<DepartmentDocument> = {
      data: departments,
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

  async findOne(id: string): Promise<DepartmentDocument> {
    const cacheKey = `departments:${id}`;
    const cached = await this.cacheManager.get<DepartmentDocument>(cacheKey);
    if (cached) return cached;

    const dept = await this.deptModel.findById(id).exec();
    if (!dept) {
      throw new NotFoundException(`Department #${id} not found`);
    }
    await this.cacheManager.set(cacheKey, dept, 300);
    return dept;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentDocument> {
    const dept = await this.deptModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!dept) {
      throw new NotFoundException(`Department #${id} not found`);
    }
    await this.invalidateDepartmentCache(id);
    return dept;
  }

  async remove(id: string): Promise<DepartmentDocument> {
    const dept = await this.deptModel.findByIdAndDelete(id).exec();
    if (!dept) {
      throw new NotFoundException(`Department #${id} not found`);
    }
    await this.invalidateDepartmentCache(id);
    return dept;
  }

  private async invalidateDepartmentCache(id: string): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`departments:${id}`),
      this.invalidateListCache(),
    ]);
  }

  private async invalidateListCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        keysToDelete.push(
          this.cacheManager.del(`departments:page:${p}:limit:${l}`),
        );
      }
    }
    await Promise.all(keysToDelete);
  }
}
