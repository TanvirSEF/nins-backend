import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createReadStream, mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const execFileAsync = promisify(execFile);

export interface BackupInfo {
  key: string;
  size: number;
  lastModified: Date;
}

export interface BackupResult {
  success: boolean;
  key?: string;
  sizeBytes?: number;
  error?: string;
}

@Injectable()
export class BackupService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly retentionDays: number;
  private readonly logger = new Logger(BackupService.name);
  private lastBackup: BackupResult | null = null;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME')!;
    this.retentionDays = parseInt(
      this.configService.get<string>('BACKUP_RETENTION_DAYS', '30'),
      10,
    );

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  // Run a full backup: mongodump → tar.gz → R2
  async runBackup(): Promise<BackupResult> {
    const mongoUri = this.configService.get<string>('MONGO_URI')!;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpDir = `/tmp/backup-${timestamp}`;
    const archivePath = `${dumpDir}.tar.gz`;
    const r2Key = `backups/backup-${timestamp}.tar.gz`;

    this.logger.log(`Starting backup → ${r2Key}`);

    try {
      // 1. mongodump
      this.logger.log('Running mongodump...');
      await execFileAsync('mongodump', ['--uri', mongoUri, '--out', dumpDir], {
        timeout: 5 * 60 * 1000, // 5 min cap
        maxBuffer: 10 * 1024 * 1024,
      });

      // 2. tar + gzip the dump dir
      this.logger.log('Compressing backup...');
      await execFileAsync(
        'tar',
        ['-czf', archivePath, '-C', '/tmp', `backup-${timestamp}`],
        { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
      );

      // 3. Upload to R2
      this.logger.log('Uploading to R2...');
      const { stat, readFile } = await import('fs/promises');
      const stats = await stat(archivePath);
      const fileBuffer = await readFile(archivePath);

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: r2Key,
          Body: fileBuffer,
          ContentType: 'application/gzip',
        }),
      );

      // 4. Cleanup local temp files
      rmSync(dumpDir, { recursive: true, force: true });
      rmSync(archivePath, { force: true });

      // 5. Enforce retention
      await this.enforceRetention();

      const result: BackupResult = {
        success: true,
        key: r2Key,
        sizeBytes: stats.size,
      };
      this.lastBackup = result;
      this.logger.log(`Backup complete → ${r2Key} (${stats.size} bytes)`);
      return result;
    } catch (error) {
      // Cleanup on failure
      try {
        rmSync(dumpDir, { recursive: true, force: true });
        rmSync(archivePath, { force: true });
      } catch {
        // ignore
      }
      const result: BackupResult = {
        success: false,
        error: error.message,
      };
      this.lastBackup = result;
      this.logger.error(`Backup failed: ${error.message}`);
      return result;
    }
  }

  // List all backups in R2
  async listBackups(): Promise<BackupInfo[]> {
    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'backups/',
      }),
    );

    return (response.Contents || [])
      .filter((obj) => obj.Key && obj.Key.endsWith('.tar.gz'))
      .map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  // Last backup status
  getStatus(): { lastBackup: BackupResult | null } {
    return { lastBackup: this.lastBackup };
  }

  // Delete backups older than retention window
  private async enforceRetention(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'backups/',
      }),
    );

    const toDelete = (response.Contents || []).filter(
      (obj) => obj.Key && (obj.LastModified || new Date()) < cutoff,
    );

    if (toDelete.length === 0) return;

    this.logger.log(`Deleting ${toDelete.length} expired backups`);
    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: toDelete.map((obj) => ({ Key: obj.Key! })),
        },
      }),
    );
  }
}
