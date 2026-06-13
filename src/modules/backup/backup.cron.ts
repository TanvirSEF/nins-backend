import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService } from './backup.service';

/**
 * Scheduled backup jobs. The cron expression comes from the
 * BACKUP_CRON env var (defaults to daily 2 AM).
 */
@Injectable()
export class BackupCron {
  private readonly logger = new Logger(BackupCron.name);

  constructor(private backupService: BackupService) {}

  @Cron(process.env.BACKUP_CRON || '0 2 * * *')
  async handleDailyBackup() {
    this.logger.log('Scheduled backup triggered');
    await this.backupService.runBackup();
  }
}
