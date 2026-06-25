import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { GalleryService } from './gallery.service';
import { CreateGalleryDto, UpdateGalleryDto } from './dto/gallery.dto';
import { GalleryFilterDto } from './dto/gallery-filter.dto';
import { GalleryItemDocument, GalleryItem } from './gallery.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role, UserDocument } from '../user/user.schema';

@ApiTags('gallery')
@ApiBearerAuth('JWT-auth')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a gallery image (ADMIN/STAFF)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Gallery item created',
    type: GalleryItem,
  })
  @ApiResponse({ status: 400, description: 'Invalid image or size > 5MB' })
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateGalleryDto,
    @CurrentUser() user: UserDocument,
  ): Promise<GalleryItemDocument> {
    return this.galleryService.create(file, dto, String(user._id));
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List gallery images (public, paginated)' })
  @ApiPaginatedResponse(GalleryItem)
  findAll(@Query() filters: GalleryFilterDto) {
    return this.galleryService.findAll(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a gallery item by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Gallery item found',
    type: GalleryItem,
  })
  @ApiResponse({ status: 404, description: 'Gallery item not found' })
  findOne(@Param('id') id: string): Promise<GalleryItemDocument> {
    return this.galleryService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Update gallery item metadata (ADMIN/STAFF)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Gallery item updated',
    type: GalleryItem,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGalleryDto,
  ): Promise<GalleryItemDocument> {
    return this.galleryService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a gallery image (SUPER_ADMIN)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Gallery item deleted',
    type: GalleryItem,
  })
  remove(@Param('id') id: string): Promise<GalleryItemDocument> {
    return this.galleryService.remove(id);
  }
}
