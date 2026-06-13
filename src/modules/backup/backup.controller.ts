import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('backup')
@ApiBearerAuth('JWT-auth')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all database backups (from R2)' })
  @ApiResponse({ status: 200, description: 'List of backups' })
  listBackups() {
    return this.backupService.listBackups();
  }

  @Post('run')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trigger an immediate backup (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Backup result' })
  runBackup() {
    return this.backupService.runBackup();
  }

  @Get('status')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get last backup status' })
  @ApiResponse({ status: 200, description: 'Last backup status' })
  getStatus() {
    return this.backupService.getStatus();
  }
}
