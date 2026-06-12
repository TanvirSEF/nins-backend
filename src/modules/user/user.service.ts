import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel(createUserDto);
    const saved = await user.save();
    // Invalidate list cache
    await this.cacheManager.del('users:all');
    return saved;
  }

  async findAll(): Promise<UserDocument[]> {
    const cached = await this.cacheManager.get<UserDocument[]>('users:all');
    if (cached) return cached;

    const users = await this.userModel.find().exec();
    await this.cacheManager.set('users:all', users, 30); // cache 30s
    return users;
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
    const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    // Invalidate caches
    await Promise.all([
      this.cacheManager.del(`users:${id}`),
      this.cacheManager.del('users:all'),
    ]);
    return user;
  }

  async remove(id: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    // Invalidate caches
    await Promise.all([
      this.cacheManager.del(`users:${id}`),
      this.cacheManager.del('users:all'),
    ]);
    return user;
  }
}
