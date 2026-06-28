import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  PathologyReport,
  PathologyReportDocument,
  PathologyStatus,
} from './pathology-report.schema';
import { User, UserDocument } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { FileService } from '../upload/file.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';
import { CreatePathologyDto } from './dto/create-pathology.dto';
import { UpdatePathologyDto } from './dto/update-pathology.dto';
import { AddResultDto } from './dto/add-result.dto';
import { PathologyFilterDto } from './dto/pathology-filter.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class PathologyReportService {
  constructor(
    @InjectModel(PathologyReport.name)
    private reportModel: Model<PathologyReportDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    private fileService: FileService,
    private notificationService: NotificationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Create test order
  async create(
    dto: CreatePathologyDto,
    userId: string,
  ): Promise<PathologyReportDocument> {
    // Validate patient
    const patient = await this.userModel.findById(dto.patientId).exec();
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Resolve ordering doctor
    const doctorProfile = await this.doctorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doctorProfile) {
      throw new ForbiddenException('Doctor profile not found');
    }

    const report = new this.reportModel({
      patientId: new Types.ObjectId(dto.patientId),
      doctorId: doctorProfile._id,
      appointmentId: dto.appointmentId
        ? new Types.ObjectId(dto.appointmentId)
        : undefined,
      testName: dto.testName,
      testCategory: dto.testCategory,
      notes: dto.notes,
      orderedAt: new Date(),
    });
    const saved = await report.save();

    // Notify patient about the new test order
    await this.notificationService
      .notify(dto.patientId, NotificationType.TEST_ORDERED, {
        testName: dto.testName,
        testCategory: dto.testCategory,
      })
      .catch(() => null);

    await this.invalidateReportCache(String(saved._id), dto.patientId);
    return saved;
  }

  // Add result (staff uploads findings + optional file)
  async addResult(
    id: string,
    dto: AddResultDto,
  ): Promise<PathologyReportDocument> {
    const report = await this.reportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException(`Pathology report #${id} not found`);
    }

    // Verify result file is confirmed, if provided
    if (dto.resultFileId) {
      const file = await this.fileService.findOne(dto.resultFileId);
      report.resultFileId = file._id;
    }

    if (dto.resultSummary !== undefined) {
      report.resultSummary = dto.resultSummary;
    }
    if (dto.resultValues) {
      report.resultValues = dto.resultValues;
    }

    // Default to COMPLETED when results are added
    report.status = dto.status || PathologyStatus.COMPLETED;
    if (report.status === PathologyStatus.COMPLETED && !report.completedAt) {
      report.completedAt = new Date();
    }

    const updated = await report.save();

    // Notify patient: report ready
    if (updated.status === PathologyStatus.COMPLETED) {
      await this.notificationService
        .notify(
          String(updated.patientId),
          NotificationType.PATHOLOGY_REPORT_READY,
          {
            testName: updated.testName,
            reportId: String(updated._id),
          },
        )
        .catch(() => null);
    }

    await this.invalidateReportCache(
      String(updated._id),
      String(updated.patientId),
    );
    return updated;
  }

  // Update order
  async update(
    id: string,
    dto: UpdatePathologyDto,
  ): Promise<PathologyReportDocument> {
    const report = await this.reportModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!report) {
      throw new NotFoundException(`Pathology report #${id} not found`);
    }
    await this.invalidateReportCache(
      String(report._id),
      String(report.patientId),
    );
    return report;
  }

  // Single report
  async findOne(id: string): Promise<PathologyReportDocument> {
    const report = await this.reportModel
      .findById(id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation')
      .exec();
    if (!report) {
      throw new NotFoundException(`Pathology report #${id} not found`);
    }
    return report;
  }

  // Patient's own reports
  async findMyReports(
    userId: string,
    filters: PathologyFilterDto,
  ): Promise<PaginatedResult<PathologyReportDocument>> {
    return this.listReports(
      { patientId: new Types.ObjectId(userId), ...this.buildQuery(filters) },
      `pathology:patient:${userId}:status:${filters.status || 'all'}:cat:${filters.testCategory || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // Patient's reports (staff/doctor view)
  async findPatientReports(
    patientId: string,
    filters: PathologyFilterDto,
  ): Promise<PaginatedResult<PathologyReportDocument>> {
    return this.listReports(
      { patientId: new Types.ObjectId(patientId), ...this.buildQuery(filters) },
      `pathology:patient:${patientId}:status:${filters.status || 'all'}:cat:${filters.testCategory || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // All reports (admin)
  async findAll(
    filters: PathologyFilterDto,
  ): Promise<PaginatedResult<PathologyReportDocument>> {
    return this.listReports(
      this.buildQuery(filters),
      `pathology:all:patient:${filters.patientId || 'all'}:doctor:${filters.doctorId || 'all'}:status:${filters.status || 'all'}:cat:${filters.testCategory || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // Delete
  async remove(id: string): Promise<PathologyReportDocument> {
    const report = await this.reportModel.findByIdAndDelete(id).exec();
    if (!report) {
      throw new NotFoundException(`Pathology report #${id} not found`);
    }
    await this.invalidateReportCache(
      String(report._id),
      String(report.patientId),
    );
    return report;
  }

  // Helpers
  private buildQuery(filters: PathologyFilterDto): any {
    const query: any = {};
    if (filters.patientId)
      query.patientId = new Types.ObjectId(filters.patientId);
    if (filters.doctorId) query.doctorId = new Types.ObjectId(filters.doctorId);
    if (filters.status) query.status = filters.status;
    if (filters.testCategory) query.testCategory = filters.testCategory;
    return query;
  }

  private async listReports(
    query: any,
    cacheKey: string,
    filters: PathologyFilterDto,
  ): Promise<PaginatedResult<PathologyReportDocument>> {
    const { page, limit } = filters;
    const cached =
      await this.cacheManager.get<PaginatedResult<PathologyReportDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(query)
        .populate('patientId', 'name email phone')
        .populate('doctorId', 'designation')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const result: PaginatedResult<PathologyReportDocument> = {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  private async invalidateReportCache(
    id: string,
    patientId: string,
  ): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        for (const st of ['all', ...Object.values(PathologyStatus)]) {
          keysToDelete.push(
            this.cacheManager.del(
              `pathology:patient:${patientId}:status:${st}:cat:all:page:${p}:limit:${l}`,
            ),
            this.cacheManager.del(
              `pathology:all:patient:all:doctor:all:status:${st}:cat:all:page:${p}:limit:${l}`,
            ),
            this.cacheManager.del(
              `pathology:all:patient:${patientId}:doctor:all:status:${st}:cat:all:page:${p}:limit:${l}`,
            ),
          );
        }
      }
    }
    await Promise.all(keysToDelete);
  }
}
