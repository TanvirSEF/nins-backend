import { Controller, Get, Query, Res, Header } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('revenue/excel')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Download revenue report as Excel (.xlsx)' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Excel file' })
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async revenueExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportService.generateRevenueReport(
      startDate,
      endDate,
      'excel',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=revenue-${startDate}-to-${endDate}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('revenue/pdf')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Download revenue report as PDF' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @Header('Content-Type', 'application/pdf')
  async revenuePdf(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportService.generateRevenueReport(
      startDate,
      endDate,
      'pdf',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=revenue-${startDate}-to-${endDate}.pdf`,
    );
    res.send(buffer);
  }

  @Get('patients/excel')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Download patient report as Excel (.xlsx)' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Excel file' })
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async patientsExcel(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.reportService.generatePatientReport(
        startDate,
        endDate,
        'excel',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=patients-report.xlsx`,
      );
      res.send(buffer);
    } catch (error) {
      console.error('PATIENT EXCEL ERROR:', error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  }

  @Get('patients/pdf')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Download patient report as PDF' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @Header('Content-Type', 'application/pdf')
  async patientsPdf(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.reportService.generatePatientReport(
      startDate,
      endDate,
      'pdf',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=patients-report.pdf`,
    );
    res.send(buffer);
  }
}
