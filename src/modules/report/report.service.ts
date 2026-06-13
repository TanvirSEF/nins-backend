import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from '../payment/payment.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import { User, UserDocument, Role } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { generateExcelWorkbook } from './exporters/excel.helper';
import { generatePdfReport } from './exporters/pdf.helper';

export type ReportFormat = 'excel' | 'pdf';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
  ) {}

  // ─── Revenue Report ──────────────────────────────────────────────────────────
  async generateRevenueReport(
    startDateStr: string,
    endDateStr: string,
    format: ReportFormat,
  ): Promise<Buffer> {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    // Fetch validated payments in range
    const payments = await this.paymentModel
      .find({
        status: PaymentStatus.VALIDATED,
        paidAt: { $gte: startDate, $lte: endDate },
      })
      .populate('patientId', 'name email phone')
      .populate('appointmentId', 'serialNumber appointmentDate')
      .sort({ paidAt: 1 })
      .exec();

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalTransactions = payments.length;
    const avgTransaction =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Daily breakdown
    const dailyMap = new Map<string, { count: number; total: number }>();
    payments.forEach((p) => {
      const day = (p.paidAt || p.createdAt || new Date())
        .toISOString()
        .split('T')[0];
      const existing = dailyMap.get(day) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += p.amount;
      dailyMap.set(day, existing);
    });
    const dailyBreakdown = Array.from(dailyMap.entries()).map(([day, v]) => ({
      date: day,
      transactions: v.count,
      revenue: v.total.toFixed(2),
    }));

    const periodLabel = `${startDateStr} to ${endDateStr}`;

    if (format === 'excel') {
      return generateExcelWorkbook([
        {
          name: 'Payments',
          columns: [
            { header: 'Date', key: 'date', width: 22 },
            { header: 'Transaction ID', key: 'tranId', width: 28 },
            { header: 'Patient', key: 'patient', width: 22 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Serial', key: 'serial', width: 10 },
            { header: 'Method', key: 'method', width: 18 },
            { header: 'Amount (BDT)', key: 'amount', width: 14 },
          ],
          rows: payments.map((p: any) => ({
            date: (p.paidAt || p.createdAt).toLocaleString(),
            tranId: p.tranId,
            patient: p.patientId?.name || 'Unknown',
            phone: p.patientId?.phone || '-',
            serial: p.appointmentId?.serialNumber || '-',
            method: p.cardType || p.gatewayName || '-',
            amount: p.amount,
          })),
          summary: [
            { label: 'Total Revenue (BDT)', value: totalRevenue.toFixed(2) },
            { label: 'Total Transactions', value: totalTransactions },
            { label: 'Average (BDT)', value: avgTransaction.toFixed(2) },
            { label: 'Period', value: periodLabel },
          ],
        },
        {
          name: 'Daily Summary',
          columns: [
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Transactions', key: 'transactions', width: 16 },
            { header: 'Revenue (BDT)', key: 'revenue', width: 16 },
          ],
          rows: dailyBreakdown,
        },
      ]);
    }

    // PDF
    return generatePdfReport({
      title: 'Revenue Report',
      subtitle: `NINS Hospital — ${periodLabel}`,
      summary: [
        { label: 'Total Revenue', value: `${totalRevenue.toFixed(2)} BDT` },
        { label: 'Total Transactions', value: String(totalTransactions) },
        { label: 'Average', value: `${avgTransaction.toFixed(2)} BDT` },
      ],
      columns: [
        { header: 'Date', width: 70 },
        { header: 'Patient', width: 130 },
        { header: 'Tran ID', width: 150 },
        { header: 'Amount', width: 75, align: 'right' },
      ],
      rows: payments.map((p: any) => [
        new Date(p.paidAt || p.createdAt).toLocaleDateString('en-GB'),
        (p.patientId?.name || 'Unknown').substring(0, 20),
        p.tranId.substring(0, 22),
        `${p.amount.toFixed(2)}`,
      ]),
    });
  }

  // ─── Patient Report ──────────────────────────────────────────────────────────
  async generatePatientReport(
    startDateStr: string | undefined,
    endDateStr: string | undefined,
    format: ReportFormat,
  ): Promise<Buffer> {
    const query: any = { role: Role.PATIENT };
    let periodLabel = 'All time';
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      endDate.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
      periodLabel = `${startDateStr} to ${endDateStr}`;
    }

    const patients = await this.userModel
      .find(query)
      .select('name email phone createdAt')
      .sort({ createdAt: -1 })
      .exec();

    const totalPatients = patients.length;

    if (format === 'excel') {
      return generateExcelWorkbook([
        {
          name: 'Patients',
          columns: [
            { header: 'Name', key: 'name', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Registered On', key: 'registered', width: 22 },
          ],
          rows: patients.map((p) => ({
            name: p.name,
            email: p.email,
            phone: p.phone || '-',
            registered: p.createdAt
              ? p.createdAt.toLocaleString()
              : '-',
          })),
          summary: [
            { label: 'Total Patients', value: totalPatients },
            { label: 'Period', value: periodLabel },
          ],
        },
      ]);
    }

    // PDF
    return generatePdfReport({
      title: 'Patient Report',
      subtitle: `NINS Hospital — ${periodLabel}`,
      summary: [{ label: 'Total Patients', value: String(totalPatients) }],
      columns: [
        { header: 'Name', width: 160 },
        { header: 'Email', width: 180 },
        { header: 'Phone', width: 100 },
        { header: 'Registered', width: 70 },
      ],
      rows: patients.map((p) => [
        p.name.substring(0, 25),
        (p.email || '').substring(0, 28),
        p.phone || '-',
        p.createdAt
          ? p.createdAt.toLocaleDateString('en-GB')
          : '-',
      ]),
    });
  }
}
