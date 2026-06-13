import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileService } from './file.service';
import { ImageService } from './image.service';
import { FileController } from './file.controller';
import { StoredFile, StoredFileSchema } from './file.schema';
import { User, UserSchema } from '../user/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoredFile.name, schema: StoredFileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FileController],
  providers: [FileService, ImageService],
  exports: [FileService, ImageService],
})
export class UploadModule {}
