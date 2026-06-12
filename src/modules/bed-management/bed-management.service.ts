import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Bed, BedDocument, BedType } from './schemas/bed.schema';
import { UpdateBedStatusDto } from './dto/update-bed-status.dto';

export interface BedAvailability {
  type: BedType;
  total: number;
  occupied: number;
  available: number;
  wards: string[];
}

@Injectable()
export class BedManagementService {
  constructor(
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Lifecycle: Seed beds on startup if collection is empty ──────────────
  async onModuleInit() {
    const count = await this.bedModel.countDocuments().exec();
    if (count > 0) return;

    const beds: Partial<BedDocument>[] = [];

    // 16 ICU beds across 2 wards
    for (let i = 1; i <= 8; i++) {
      beds.push({
        bedNumber: `ICU-${String(i).padStart(2, '0')}`,
        type: BedType.ICU,
        wardName: 'Neuro-Trauma ICU',
        isOccupied: false,
      });
    }
    for (let i = 9; i <= 16; i++) {
      beds.push({
        bedNumber: `ICU-${String(i).padStart(2, '0')}`,
        type: BedType.ICU,
        wardName: 'Stroke ICU',
        isOccupied: false,
      });
    }

    // 12 HDU beds across 2 wards
    for (let i = 1; i <= 6; i++) {
      beds.push({
        bedNumber: `HDU-${String(i).padStart(2, '0')}`,
        type: BedType.HDU,
        wardName: 'Neuro-Recovery HDU',
        isOccupied: false,
      });
    }
    for (let i = 7; i <= 12; i++) {
      beds.push({
        bedNumber: `HDU-${String(i).padStart(2, '0')}`,
        type: BedType.HDU,
        wardName: 'Stroke HDU',
        isOccupied: false,
      });
    }

    await this.bedModel.insertMany(beds);
    console.log(`✅ Seeded ${beds.length} beds (16 ICU + 12 HDU)`);
  }

  // ─── Public: Live Availability Board ──────────────────────────────────────
  async getLiveAvailabilityBoard(): Promise<BedAvailability[]> {
    const cacheKey = 'bed-management:live-board';
    const cached = await this.cacheManager.get<BedAvailability[]>(cacheKey);
    if (cached) return cached;

    const [icuStats, hduStats] = await Promise.all([
      this.getAggregatedStats(BedType.ICU),
      this.getAggregatedStats(BedType.HDU),
    ]);

    const result = [icuStats, hduStats];
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  // ─── Public: Get all beds with optional type filter ───────────────────────
  async findAll(type?: BedType): Promise<BedDocument[]> {
    const query = type ? { type } : {};
    return this.bedModel.find(query).sort({ type: 1, bedNumber: 1 }).exec();
  }

  // ─── Public: Get single bed ───────────────────────────────────────────────
  async findOne(id: string): Promise<BedDocument> {
    const bed = await this.bedModel.findById(id).exec();
    if (!bed) {
      throw new NotFoundException(`Bed #${id} not found`);
    }
    return bed;
  }

  // ─── Staff: Update bed status (assign/release) ───────────────────────────
  async updateBedStatus(
    id: string,
    dto: UpdateBedStatusDto,
  ): Promise<BedDocument> {
    const bed = await this.bedModel.findById(id).exec();
    if (!bed) {
      throw new NotFoundException(`Bed #${id} not found`);
    }

    if (dto.isOccupied) {
      // ─── Assigning a patient ────────────────────────────────────────────
      if (!dto.currentPatientName) {
        throw new BadRequestException(
          'Patient name is required when occupying a bed',
        );
      }
      if (bed.isOccupied) {
        throw new BadRequestException(
          'Bed is already occupied — release it first',
        );
      }
      bed.isOccupied = true;
      bed.currentPatientName = dto.currentPatientName;
      bed.admittedAt = new Date();
    } else {
      // ─── Releasing a bed ────────────────────────────────────────────────
      bed.isOccupied = false;
      bed.currentPatientName = undefined;
      bed.admittedAt = undefined;
    }

    const updated = await bed.save();
    await this.invalidateCache();
    return updated;
  }

  // ─── Private: Aggregation helper ──────────────────────────────────────────
  private async getAggregatedStats(
    bedType: BedType,
  ): Promise<BedAvailability> {
    const [total, occupied, wards] = await Promise.all([
      this.bedModel.countDocuments({ type: bedType }).exec(),
      this.bedModel.countDocuments({ type: bedType, isOccupied: true }).exec(),
      this.bedModel.distinct('wardName', { type: bedType }).exec(),
    ]);

    return {
      type: bedType,
      total,
      occupied,
      available: total - occupied,
      wards,
    };
  }

  // ─── Private: Cache invalidation ──────────────────────────────────────────
  private async invalidateCache(): Promise<void> {
    await this.cacheManager.del('bed-management:live-board');
  }
}
