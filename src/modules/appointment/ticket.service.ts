import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument = require('pdfkit');
import QRCode = require('qrcode');
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from './appointment.schema';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from '../payment/payment.schema';
import { User, UserDocument, Role } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import {
  Department,
  DepartmentDocument,
} from '../department/department.schema';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Department.name)
    private deptModel: Model<DepartmentDocument>,
  ) {}

  /**
   * Generate an appointment ticket PDF for a confirmed + paid appointment.
   */
  async generateTicketPdf(appointmentId: string): Promise<Buffer> {
    // 1. Find appointment
    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .populate('patientId', 'name phone email')
      .exec();
    if (!appointment) {
      throw new NotFoundException(`Appointment #${appointmentId} not found`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        'Ticket is only available for confirmed appointments',
      );
    }

    // 2. Find validated payment
    const payment = await this.paymentModel
      .findOne({
        appointmentId: appointment._id,
        status: PaymentStatus.VALIDATED,
      })
      .exec();
    if (!payment) {
      throw new BadRequestException(
        'Appointment is not yet paid. Please complete payment first.',
      );
    }

    // 3. Resolve doctor + department
    const doctor = await this.doctorModel.findById(appointment.doctorId).exec();
    const department = doctor
      ? await this.deptModel.findById(doctor.departmentId).select('name').exec()
      : null;

    const patient: any = appointment.patientId;
    const doctorName = doctor ? doctor.designation : '';
    const departmentName = department?.name || '—';

    // 4. Generate QR code (PNG buffer)
    const qrPayload = JSON.stringify({
      appointmentId: String(appointment._id),
      serialNumber: appointment.serialNumber,
      tranId: payment.tranId,
      patientName: patient?.name || '',
    });
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      type: 'png',
      width: 160,
      margin: 1,
    });

    // 5. Build PDF
    return this.buildPdf({
      appointment,
      payment,
      patient,
      doctorName,
      departmentName,
      qrBuffer,
    });
  }

  /**
   * Get ticket with ownership check.
   */
  async getTicket(
    appointmentId: string,
    userId: string,
    isStaff: boolean,
  ): Promise<Buffer> {
    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .exec();
    if (!appointment) {
      throw new NotFoundException(`Appointment #${appointmentId} not found`);
    }

    if (
      !isStaff &&
      !appointment.patientId.equals(
        new (require('mongoose').Types.ObjectId)(userId),
      )
    ) {
      throw new ForbiddenException(
        'You can only download tickets for your own appointments',
      );
    }

    return this.generateTicketPdf(appointmentId);
  }

  // Build the ticket PDF
  private async buildPdf(data: {
    appointment: any;
    payment: PaymentDocument;
    patient: any;
    doctorName: string;
    departmentName: string;
    qrBuffer: Buffer;
  }): Promise<Buffer> {
    const {
      appointment,
      payment,
      patient,
      doctorName,
      departmentName,
      qrBuffer,
    } = data;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 495; // A4 width minus margins (595 - 100)

      // Header band
      doc.rect(50, 50, pageWidth, 70).fill('#1a56db');
      doc
        .fillColor('#ffffff')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('NINS Hospital', 50, 70, { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('National Institute of Neuro-Sciences', 50, 98, {
          align: 'center',
        });

      doc.moveDown(3);

      // Title
      doc
        .fillColor('#111827')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('APPOINTMENT TICKET', { align: 'center' });

      doc.moveDown(1);

      // Serial number (large, prominent)
      doc.rect(50, doc.y, pageWidth, 50).fill('#dcfce7');
      doc
        .fillColor('#15803d')
        .fontSize(11)
        .font('Helvetica')
        .text('SERIAL NUMBER', 50, doc.y + 8, { align: 'center' });
      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(`#${appointment.serialNumber}`, 50, doc.y + 4, {
          align: 'center',
        });

      doc.moveDown(2);

      // Details (two-column)
      const detailsY = doc.y;
      const leftCol = 60;
      const labelColor = '#6b7280';
      const valueColor = '#111827';

      const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

      const rows: [string, string][] = [
        ['Patient Name', patient?.name || '—'],
        ['Patient Phone', patient?.phone || '—'],
        ['Doctor', doctorName || '—'],
        ['Department', departmentName],
        ['Appointment Date', formatDate(appointment.appointmentDate)],
        ['Status', appointment.status],
        ['Amount Paid', `${payment.amount.toFixed(2)} BDT`],
        ['Transaction ID', payment.tranId],
        ['Paid On', payment.paidAt ? formatDate(payment.paidAt) : '—'],
        ['Ticket ID', String(appointment._id).slice(-12).toUpperCase()],
      ];

      rows.forEach(([label, value]) => {
        doc
          .fillColor(labelColor)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(label, leftCol, doc.y + 4, { continued: true });
        doc
          .fillColor(valueColor)
          .font('Helvetica')
          .text(`  ${value}`, { align: 'left' });
      });

      // QR code (right side, aligned with details)
      doc.image(qrBuffer, 380, detailsY, { width: 110 });
      doc
        .fillColor('#6b7280')
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text('Scan at hospital check-in', 380, detailsY + 115, {
          width: 110,
          align: 'center',
        });

      doc.moveDown(8);

      // Footer
      doc.rect(50, doc.y, pageWidth, 45).fill('#fef3c7');
      doc
        .fillColor('#92400e')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Please bring this ticket to the hospital.', 50, doc.y + 8, {
          align: 'center',
          width: pageWidth,
        });
      doc
        .font('Helvetica')
        .text(
          'Arrive at least 15 minutes before your scheduled time.',
          50,
          doc.y + 4,
          {
            align: 'center',
            width: pageWidth,
          },
        );

      // Generated timestamp
      doc
        .fillColor('#9ca3af')
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text(
          `Generated ${new Date().toLocaleString()} — NINS Hospital Management System`,
          50,
          800,
          { align: 'center', width: pageWidth },
        );

      doc.end();
    });
  }
}
