import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ImageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly logger = new Logger(ImageService.name);

  constructor(private configService: ConfigService) {
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
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Upload an image buffer to R2 and return a permanent public URL.
   * Used for public-facing images (profile pics, logos, gallery).
   */
  async uploadImage(
    file: Express.Multer.File,
    keyPrefix: string,
  ): Promise<{ url: string; r2Key: string }> {
    // 1. Validate file is present
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // 2. Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Image type ${file.mimetype} is not allowed. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    // 3. Validate size
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `Image size exceeds 5MB limit (received ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      );
    }

    // 4. Generate R2 key
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = sanitized.split('.').pop() || 'jpg';
    const r2Key = `images/${keyPrefix}/${randomUUID()}.${extension}`;

    // 5. Upload buffer to R2
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: r2Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (error) {
      this.logger.error(`R2 image upload failed: ${error.message}`);
      throw new BadRequestException(
        `Failed to upload image: ${error.message}`,
      );
    }

    // 6. Build public URL
    const url = await this.resolvePublicUrl(r2Key);
    return { url, r2Key };
  }

  /**
   * Delete an image from R2 by its key.
   */
  async deleteImage(r2Key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: r2Key }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete R2 image ${r2Key}: ${error.message}`);
    }
  }

  /**
   * Resolve a permanent public URL for an R2 key.
   * Falls back to presigned GET (24h) if R2_PUBLIC_BASE_URL is not configured.
   */
  private async resolvePublicUrl(r2Key: string): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${r2Key}`;
    }
    // Fallback: presigned GET (24h) — works but expires. Public access recommended.
    this.logger.warn(
      'R2_PUBLIC_BASE_URL is not set — returning presigned URL. Enable public access for permanent image URLs.',
    );
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: r2Key }),
      { expiresIn: 86400 },
    );
  }
}
