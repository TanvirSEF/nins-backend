import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BedManagementService } from './bed-management.service';
import { BedManagementController } from './bed-management.controller';
import { Bed, BedSchema } from './schemas/bed.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Bed.name, schema: BedSchema }])],
  controllers: [BedManagementController],
  providers: [BedManagementService],
  exports: [BedManagementService],
})
export class BedManagementModule {}
