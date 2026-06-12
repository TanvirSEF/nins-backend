import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel(createUserDto);
    const saved = await user.save();
    // Invalidate all paginated list caches
    await this.invalidateListCache();
    return saved;
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<UserDocument>> {
    const { page, limit } = pagination;
    const cacheKey = `users:page:${page}:limit:${limit}`;

    const cached = await this.cacheManager.get<PaginatedResult<UserDocument>>(cacheKey);
    if (cached) return cached;

    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<UserDocument> = {
      data: users,
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

  async findOne(id: string): Promise<UserDocument> {
    const cacheKey = `users:${id}`;
    const cached = await this.cacheManager.get<UserDocument>(cacheKey);
    if (cached) return cached;

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    await this.cacheManager.set(cacheKey, user, 60); // cache 60s
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true, runValidators: true })
      .exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    await this.invalidateUserCache(id);
    return user;
  }

  async remove(id: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    await this.invalidateUserCache(id);
    return user;
  }

  /** Invalidate a single user + all paginated list caches */
  private async invalidateUserCache(id: string): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`users:${id}`),
      this.invalidateListCache(),
    ]);
  }

  /** Invalidate all paginated list caches (up to 50 pages safety net) */
  private async invalidateListCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        keysToDelete.push(this.cacheManager.del(`users:page:${p}:limit:${l}`));
      }
    }
    await Promise.all(keysToDelete);
  }
}
