import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StoredFile,
  StoredFileDocument,
  FileStatus,
  FileCategory,
} from './file.schema';
import { User, UserDocument } from '../user/user.schema';
import { RequestUploadDto } from './dto/request-upload.dto';
import { FileFilterDto } from './dto/file-filter.dto';

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

// Allowed MIME types for medical files
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/dicom',
  'application/dicom',
  'text/plain',
];

const PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour
const READ_URL_EXPIRY_SECONDS = 86400; // 24 hours

@Injectable()
export class FileService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectModel(StoredFile.name)
    private fileModel: Model<StoredFileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME')!;
    this.publicBaseUrl = this.configService.get<string>('R2_PUBLIC_BASE_URL');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });

    this.logger.log(
      `R2 configured — bucket: ${this.bucket}, public: ${!!this.publicBaseUrl}`,
    );
  }

  // ─── Request a presigned PUT URL ────────────────────────────────────────────
  async requestUpload(
    dto: RequestUploadDto,
    uploadedBy: string,
  ): Promise<{ fileId: string; presignedUrl: string; expiresIn: number }> {
    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException(
        `File type ${dto.mimeType} is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // 2. Determine owner (staff can set; patient defaults to self)
    const ownerId = dto.ownerId || uploadedBy;
    const owner = await this.userModel.findById(ownerId).exec();
    if (!owner) {
      throw new NotFoundException('Owner user not found');
    }

    // 3. Generate R2 key
    const sanitized = dto.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const r2Key = `uploads/${ownerId}/${randomUUID()}-${sanitized}`;

    // 4. Create PENDING file record
    const file = new this.fileModel({
      ownerId: new Types.ObjectId(ownerId),
      uploadedBy: new Types.ObjectId(uploadedBy),
      category: dto.category,
      originalName: dto.originalName,
      r2Key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      status: FileStatus.PENDING,
    });
    const saved = await file.save();

    // 5. Generate presigned PUT URL
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: r2Key,
        ContentType: dto.mimeType,
        ContentLength: dto.sizeBytes,
      });
      const presignedUrl = await getSignedUrl(
        this.s3,
        command,
        { expiresIn: PRESIGN_EXPIRY_SECONDS },
      );

      return {
        fileId: String(saved._id),
        presignedUrl,
        expiresIn: PRESIGN_EXPIRY_SECONDS,
      };
    } catch (error) {
      // Cleanup the PENDING record if URL generation failed
      await this.fileModel.findByIdAndDelete(saved._id).exec();
      throw new BadRequestException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }
  }

  // ─── Confirm upload completed (verify R2 object exists) ──────────────────────
  async confirmUpload(
    fileId: string,
    userId: string,
  ): Promise<StoredFileDocument> {
    const file = await this.fileModel.findById(fileId).exec();
    if (!file) {
      throw new NotFoundException(`File #${fileId} not found`);
    }
    if (!file.uploadedBy.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('You can only confirm your own uploads');
    }
    if (file.status === FileStatus.UPLOADED) {
      return file; // idempotent
    }

    // Verify object exists in R2 via HEAD
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: file.r2Key }),
      );
    } catch (error) {
      file.status = FileStatus.FAILED;
      await file.save();
      throw new BadRequestException(
        'File not found in storage. Did you complete the PUT request?',
      );
    }

    // Mark uploaded + generate read URL
    file.status = FileStatus.UPLOADED;
    file.uploadedAt = new Date();
    file.publicUrl = await this.resolveReadUrl(file.r2Key);
    const updated = await file.save();

    await this.invalidateFileCache(String(updated._id), String(updated.ownerId));
    return updated;
  }

  // ─── Get a fresh presigned read URL ──────────────────────────────────────────
  async getSignedReadUrl(fileId: string): Promise<{ url: string }> {
    const file = await this.fileModel.findById(fileId).exec();
    if (!file) {
      throw new NotFoundException(`File #${fileId} not found`);
    }
    if (file.status !== FileStatus.UPLOADED) {
      throw new BadRequestException('File upload is not yet confirmed');
    }
    return { url: await this.resolveReadUrl(file.r2Key) };
  }

  // ─── Patient's own files ─────────────────────────────────────────────────────
  async findMyFiles(
    userId: string,
    filters: FileFilterDto,
  ): Promise<PaginatedResult<StoredFileDocument>> {
    return this.listFiles(
      { ownerId: new Types.ObjectId(userId), ...this.buildQuery(filters) },
      `files:owner:${userId}:cat:${filters.category || 'all'}:status:${filters.status || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // ─── All files (admin/staff) ─────────────────────────────────────────────────
  async findAll(
    filters: FileFilterDto,
  ): Promise<PaginatedResult<StoredFileDocument>> {
    return this.listFiles(
      this.buildQuery(filters),
      `files:all:owner:${filters.ownerId || 'all'}:cat:${filters.category || 'all'}:status:${filters.status || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // ─── Single file ─────────────────────────────────────────────────────────────
  async findOne(fileId: string): Promise<StoredFileDocument> {
    const file = await this.fileModel
      .findById(fileId)
      .populate('ownerId', 'name email')
      .populate('uploadedBy', 'name email')
      .exec();
    if (!file) {
      throw new NotFoundException(`File #${fileId} not found`);
    }
    return file;
  }

  // ─── Delete file (R2 + DB) ───────────────────────────────────────────────────
  async remove(
    fileId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<StoredFileDocument> {
    const file = await this.fileModel.findById(fileId).exec();
    if (!file) {
      throw new NotFoundException(`File #${fileId} not found`);
    }
    if (
      !isAdmin &&
      !file.ownerId.equals(new Types.ObjectId(userId)) &&
      !file.uploadedBy.equals(new Types.ObjectId(userId))
    ) {
      throw new ForbiddenException('You can only delete your own files');
    }

    // Delete from R2 (best-effort)
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: file.r2Key }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete R2 object ${file.r2Key}: ${error.message}`);
    }

    await this.fileModel.findByIdAndDelete(fileId).exec();
    await this.invalidateFileCache(String(file._id), String(file.ownerId));
    return file;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  private async resolveReadUrl(r2Key: string): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${r2Key}`;
    }
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: r2Key }),
      { expiresIn: READ_URL_EXPIRY_SECONDS },
    );
  }

  private buildQuery(filters: FileFilterDto): any {
    const query: any = {};
    if (filters.ownerId) query.ownerId = new Types.ObjectId(filters.ownerId);
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    return query;
  }

  private async listFiles(
    query: any,
    cacheKey: string,
    filters: FileFilterDto,
  ): Promise<PaginatedResult<StoredFileDocument>> {
    const { page, limit } = filters;
    const cached =
      await this.cacheManager.get<PaginatedResult<StoredFileDocument>>(cacheKey);
    if (cached) return cached;

    const [files, total] = await Promise.all([
      this.fileModel
        .find(query)
        .populate('ownerId', 'name email')
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.fileModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const result: PaginatedResult<StoredFileDocument> = {
      data: files,
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

  private async invalidateFileCache(
    fileId: string,
    ownerId: string,
  ): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        for (const cat of ['all', ...Object.values(FileCategory)]) {
          for (const st of ['all', ...Object.values(FileStatus)]) {
            keysToDelete.push(
              this.cacheManager.del(
                `files:owner:${ownerId}:cat:${cat}:status:${st}:page:${p}:limit:${l}`,
              ),
              this.cacheManager.del(
                `files:all:owner:all:cat:${cat}:status:${st}:page:${p}:limit:${l}`,
              ),
              this.cacheManager.del(
                `files:all:owner:${ownerId}:cat:${cat}:status:${st}:page:${p}:limit:${l}`,
              ),
            );
          }
        }
      }
    }
    await Promise.all(keysToDelete);
  }
}
