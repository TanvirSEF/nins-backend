import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupCron } from './backup.cron';
import { BackupController } from './backup.controller';

@Module({
  controllers: [BackupController],
  providers: [BackupService, BackupCron],
  exports: [BackupService],
})
export class BackupModule {}
