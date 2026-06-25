import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileService } from './file.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { FileFilterDto } from './dto/file-filter.dto';
import { StoredFileDocument, StoredFile } from './file.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('files')
@ApiBearerAuth('JWT-auth')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('request')
  @ApiOperation({ summary: 'Get a presigned PUT URL for direct R2 upload' })
  @ApiResponse({ status: 201, description: 'Presigned URL generated' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 404, description: 'Owner user not found' })
  requestUpload(
    @Body() dto: RequestUploadDto,
    @CurrentUser() user: UserDocument,
  ): Promise<{ fileId: string; presignedUrl: string; expiresIn: number }> {
    return this.fileService.requestUpload(dto, String(user._id));
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm upload completed (verifies R2 object)' })
  @ApiParam({ name: 'id', description: 'File ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Upload confirmed',
    type: StoredFile,
  })
  @ApiResponse({ status: 400, description: 'Object not found in storage' })
  @ApiResponse({ status: 403, description: 'Not your upload' })
  confirmUpload(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<StoredFileDocument> {
    return this.fileService.confirmUpload(id, String(user._id));
  }

  @Get('my-files')
  @ApiOperation({ summary: "List current user's files" })
  @ApiPaginatedResponse(StoredFile)
  findMyFiles(
    @CurrentUser() user: UserDocument,
    @Query() filters: FileFilterDto,
  ) {
    return this.fileService.findMyFiles(String(user._id), filters);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get a fresh presigned read URL for a file' })
  @ApiParam({ name: 'id', description: 'File ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Read URL' })
  @ApiResponse({ status: 400, description: 'Upload not confirmed' })
  getReadUrl(@Param('id') id: string): Promise<{ url: string }> {
    return this.fileService.getSignedReadUrl(id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'List all files (filtered, paginated)' })
  @ApiPaginatedResponse(StoredFile)
  findAll(@Query() filters: FileFilterDto) {
    return this.fileService.findAll(filters);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file (owner or SUPER_ADMIN)' })
  @ApiParam({ name: 'id', description: 'File ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'File deleted', type: StoredFile })
  @ApiResponse({ status: 403, description: 'Not your file' })
  @ApiResponse({ status: 404, description: 'File not found' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<StoredFileDocument> {
    return this.fileService.remove(
      id,
      String(user._id),
      user.role === Role.SUPER_ADMIN,
    );
  }
}
