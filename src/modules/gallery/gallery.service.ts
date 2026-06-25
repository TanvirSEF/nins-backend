import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  GalleryItem,
  GalleryItemDocument,
  GalleryCategory,
} from './gallery.schema';
import { ImageService } from '../upload/image.service';
import { CreateGalleryDto, UpdateGalleryDto } from './dto/gallery.dto';
import { GalleryFilterDto } from './dto/gallery-filter.dto';

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
export class GalleryService {
  constructor(
    @InjectModel(GalleryItem.name)
    private galleryModel: Model<GalleryItemDocument>,
    private imageService: ImageService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Create gallery item (upload image to R2) ────────────────────────────────
  async create(
    file: Express.Multer.File,
    dto: CreateGalleryDto,
    userId: string,
  ): Promise<GalleryItemDocument> {
    const { url, r2Key } = await this.imageService.uploadImage(file, 'gallery');

    const item = new this.galleryModel({
      title: dto.title,
      description: dto.description,
      category: dto.category || GalleryCategory.OTHER,
      imageUrl: url,
      r2Key,
      uploadedBy: new Types.ObjectId(userId),
    });
    const saved = await item.save();
    await this.invalidateGalleryCache();
    return saved;
  }

  // ─── List gallery (public, paginated) ────────────────────────────────────────
  async findAll(
    filters: GalleryFilterDto,
  ): Promise<PaginatedResult<GalleryItemDocument>> {
    const { page, limit, category } = filters;
    const cacheKey = `gallery:cat:${category || 'all'}:page:${page}:limit:${limit}`;
    const cached =
      await this.cacheManager.get<PaginatedResult<GalleryItemDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = { isActive: true };
    if (category) query.category = category;

    const [items, total] = await Promise.all([
      this.galleryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.galleryModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const result: PaginatedResult<GalleryItemDocument> = {
      data: items,
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

  // ─── Single item ─────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<GalleryItemDocument> {
    const item = await this.galleryModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Gallery item #${id} not found`);
    }
    return item;
  }

  // ─── Update metadata ─────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateGalleryDto,
  ): Promise<GalleryItemDocument> {
    const item = await this.galleryModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!item) {
      throw new NotFoundException(`Gallery item #${id} not found`);
    }
    await this.invalidateGalleryCache();
    return item;
  }

  // ─── Delete (R2 + DB) ────────────────────────────────────────────────────────
  async remove(id: string): Promise<GalleryItemDocument> {
    const item = await this.galleryModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Gallery item #${id} not found`);
    }

    // Delete from R2 (best-effort)
    await this.imageService.deleteImage(item.r2Key);
    await this.galleryModel.findByIdAndDelete(id).exec();
    await this.invalidateGalleryCache();
    return item;
  }

  // ─── Cache invalidation ──────────────────────────────────────────────────────
  private async invalidateGalleryCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        for (const cat of ['all', ...Object.values(GalleryCategory)]) {
          keysToDelete.push(
            this.cacheManager.del(`gallery:cat:${cat}:page:${p}:limit:${l}`),
          );
        }
      }
    }
    await Promise.all(keysToDelete);
  }
}
