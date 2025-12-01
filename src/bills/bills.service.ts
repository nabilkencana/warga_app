// src/bills/bills.service.ts
import { Injectable, NotFoundException, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { BillQueryDto } from './dto/bill-query.dto';
import { IBill, IBillCreate, IBillSummary } from './interfaces/bill.interface';
import { PaymentMethod, PaymentStatus, BillStatus } from '@prisma/client';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(private prisma: PrismaService) { }

  async create(createBillDto: CreateBillDto, createdBy: number): Promise<IBill> {
    try {
      console.log('🔄 Creating bill with createdBy:', createdBy);

      // Validasi bahwa user exists
      const user = await this.prisma.user.findUnique({
        where: { id: createBillDto.userId },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${createBillDto.userId} not found`);
      }

      // Gunakan UncheckedCreate untuk menghindari relation complexity
      const billData = {
        title: createBillDto.title,
        description: createBillDto.description,
        amount: createBillDto.amount,
        dueDate: new Date(createBillDto.dueDate),
        userId: createBillDto.userId, // Langsung assign userId
        createdBy: createdBy, // Langsung assign createdBy
      };

      console.log('📝 Bill data to create:', billData);

      const bill = await this.prisma.bill.create({
        data: billData,
        include: {
          user: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(`✅ Bill created successfully: ${bill.id}`);
      return bill as IBill;
    } catch (error) {
      this.logger.error('❌ Error creating bill:', error);

      if (error.code === 'P2003') {
        throw new BadRequestException('Foreign key constraint failed - User not found');
      }

      throw error;
    }
  }

  async findAll(filters: BillQueryDto): Promise<{
    bills: IBill[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const {
      status,
      userId,
      page = 1,
      limit = 10,
    } = filters;

    // Convert string parameters to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const where: any = {};

    if (status) where.status = status;
    if (userId) {
      where.userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    }

    const skip = (pageNum - 1) * limitNum;

    console.log('🔍 Bills query:', { where, skip, take: limitNum, pageNum, limitNum });

    const [bills, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
            },
          },
          payment: true,
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limitNum, // Sekarang number
      }),
      this.prisma.bill.count({ where }),
    ]);

    return {
      bills: bills as IBill[],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: string): Promise<IBill> {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
            nomorTelepon: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    if (!bill) {
      throw new NotFoundException(`Bill with ID ${id} not found`);
    }

    return bill as IBill;
  }

  async update(id: string, updateBillDto: UpdateBillDto): Promise<IBill> {
    const existingBill = await this.findOne(id);

    const updateData: any = { ...updateBillDto };

    const bill = await this.prisma.bill.update({
      where: { id  },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    this.logger.log(`Bill updated: ${bill.id}`);
    return bill as IBill;
  }

  async remove(id: string): Promise<void> {
    const bill = await this.findOne(id);

    await this.prisma.bill.delete({
      where: { id },
    });

    this.logger.log(`Bill deleted: ${id}`);
  }

  async getUserBills(userId: number, filters?: BillQueryDto): Promise<{
    bills: IBill[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    // Convert userId ke number jika perlu
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    return this.findAll({
      ...filters,
      userId: userIdNum,
    });
  }

  async payBill(billId: string, paymentData: {
    method: string;
    paidDate?: Date;
    receiptImage?: string;
  }): Promise<IBill> {
    const bill = await this.findOne(billId);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill already paid');
    }

    if (bill.status === BillStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay cancelled bill');
    }

    // Convert string method to PaymentMethod enum
    let paymentMethod: PaymentMethod;
    try {
      paymentMethod = this.convertToPaymentMethod(paymentData.method);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        amount: bill.amount,
        method: paymentMethod,
        status: PaymentStatus.PAID,
        description: `Payment for bill: ${bill.title}`,
        dueDate: bill.dueDate,
        paidDate: paymentData.paidDate || new Date(),
        receiptImage: paymentData.receiptImage,
        userId: bill.userId,
      },
    });

    // Update bill status and link to payment
    const updatedBill = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.PAID,
        paymentId: payment.id,
        paidAt: paymentData.paidDate || new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    // Create transaction record for the income
    await this.prisma.transaction.create({
      data: {
        amount: bill.amount,
        type: 'INCOME',
        category: 'Iuran',
        description: `Pembayaran: ${bill.title}`,
        date: new Date(),
        createdBy: bill.createdBy,
        userId: bill.userId,
        paymentId: payment.id,
      },
    });

    this.logger.log(`Bill paid: ${billId} by user ${bill.userId}`);
    return updatedBill as IBill;
  }

  async getSummary(userId?: number): Promise<IBillSummary> {
    const where: any = {};

    // Convert userId ke number jika perlu
    if (userId) {
      where.userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    }

    const [
      totalBills,
      pendingBills,
      paidBills,
      overdueBills,
      totalAmountResult,
      pendingAmountResult,
      paidAmountResult,
    ] = await Promise.all([
      this.prisma.bill.count({ where }),
      this.prisma.bill.count({ where: { ...where, status: BillStatus.PENDING } }),
      this.prisma.bill.count({ where: { ...where, status: BillStatus.PAID } }),
      this.prisma.bill.count({ where: { ...where, status: BillStatus.OVERDUE } }),
      this.prisma.bill.aggregate({  
        where,
        _sum: { amount: true },
      }),
      this.prisma.bill.aggregate({
        where: { ...where, status: BillStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.bill.aggregate({
        where: { ...where, status: BillStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalBills,
      pendingBills,
      paidBills,
      overdueBills,
      totalAmount: totalAmountResult._sum.amount || 0,
      pendingAmount: pendingAmountResult._sum.amount || 0,
      paidAmount: paidAmountResult._sum.amount || 0,
    };
  }

  async updateOverdueBills(): Promise<void> {
    const now = new Date();

    const result = await this.prisma.bill.updateMany({
      where: {
        status: BillStatus.PENDING,
        dueDate: { lt: now },
      },
      data: {
        status: BillStatus.OVERDUE,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Updated ${result.count} bills to OVERDUE status`);
    }
  }

  private convertToPaymentMethod(method: string): PaymentMethod {
    const upperMethod = method.toUpperCase();

    switch (upperMethod) {
      case 'CASH':
        return PaymentMethod.CASH;
      case 'QRIS':
        return PaymentMethod.QRIS;
      case 'MOBILE_BANKING':
        return PaymentMethod.MOBILE_BANKING;
      case 'BANK_TRANSFER':
        return PaymentMethod.BANK_TRANSFER;
      default:
        throw new BadRequestException(`Invalid payment method: ${method}`);
    }
  }

  // ✅ METHOD BARU: Create pending payment (menunggu konfirmasi)
  async createPendingPayment(
    billId: string,
    paymentData: {
      method: string;
      receiptImage?: string;
      qrData?: string;
    }
  ): Promise<IBill> {
    const bill = await this.findOne(billId);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill already paid');
    }

    if (bill.status === BillStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay cancelled bill');
    }

    // Convert string method to PaymentMethod enum
    let paymentMethod: PaymentMethod;
    try {
      paymentMethod = this.convertToPaymentMethod(paymentData.method);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    // Create payment record dengan status PENDING
    const payment = await this.prisma.payment.create({
      data: {
        amount: bill.amount,
        method: paymentMethod,
        status: PaymentStatus.PENDING, // ✅ Status PENDING, bukan PAID
        description: `Payment for bill: ${bill.title}`,
        dueDate: bill.dueDate,
        paidDate: null, // Belum ada tanggal bayar
        receiptImage: paymentData.receiptImage,
        qrCode: paymentData.qrData, // ✅ Simpan QR data
        userId: bill.userId,
      },
    });

    // Update bill status tetap PENDING (belum PAID)
    const updatedBill = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.PENDING, // Tetap PENDING menunggu konfirmasi
        paymentId: payment.id,
        paidAt: null, // Belum ada tanggal bayar
      },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    this.logger.log(`Pending payment created for bill: ${billId}`);
    return updatedBill as IBill;
  }

  // ✅ METHOD BARU: Generate QRIS data
  async generateQRIS(billId: string): Promise<{
    qrString: string;
    qrData: any;
    expiryTime: string;
    status: string;
  }> {
    const bill = await this.findOne(billId);

    // Generate unique QR data
    const qrData = {
      billId: bill.id,
      amount: bill.amount,
      description: bill.title,
      merchant: 'Dana Community',
      timestamp: new Date().getTime(),
      merchantCity: 'Jakarta',
      countryCode: 'ID',
      currency: 'IDR',
    };

    // Format QRIS string (standard Indonesia)
    const qrString = this.generateQRISString(qrData);

    return {
      qrString: qrString,
      qrData: qrData,
      expiryTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 menit
      status: 'ACTIVE',
    };
  }

  // ✅ METHOD BARU: Generate QRIS string sesuai standard
  private generateQRISString(qrData: any): string {
    const { billId, amount, description, merchant, merchantCity, countryCode, currency } = qrData;

    // Format sesuai standard QRIS Indonesia
    const qrisComponents = [
      `000201`,
      `010211`,
      `26650013ID.OR.GPNQR.W021`,
      `0106${merchant.substring(0, 6)}`,
      `0208${billId}`,
      `0306${description.substring(0, 6)}`,
      `5303${currency}`,
      `5406${amount.toFixed(0)}`,
      `5802ID`,
      `5906${merchant.substring(0, 6)}`,
      `6007${merchantCity}`,
      `6105${countryCode}`,
      `6207${new Date().getTime()}`,
      `6304`
    ];

    let qrString = qrisComponents.join('');

    // Add CRC16 checksum
    const crc = this.calculateCRC16(qrString);
    qrString += crc.toString(16).toUpperCase().padStart(4, '0');

    return qrString;
  }

  // ✅ METHOD BARU: Calculate CRC16 checksum
  private calculateCRC16(data: string): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
      }
    }
    return crc & 0xFFFF;
  }

  // ✅ METHOD BARU: Confirm payment (untuk admin)
  async confirmPayment(billId: string): Promise<IBill> {
    const bill = await this.findOne(billId);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill already paid');
    }

    if (!bill.paymentId) {
      throw new BadRequestException('No payment record found for this bill');
    }

    // Update payment status to PAID
    await this.prisma.payment.update({
      where: { id: bill.paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: new Date(),
      },
    });

    // Update bill status to PAID
    const updatedBill = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.PAID,
        paidAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    // Create transaction record for the income
    await this.prisma.transaction.create({
      data: {
        amount: bill.amount,
        type: 'INCOME',
        category: 'Iuran',
        description: `Pembayaran: ${bill.title}`,
        date: new Date(),
        createdBy: bill.createdBy,
        userId: bill.userId,
        paymentId: bill.paymentId,
      },
    });

    this.logger.log(`Payment confirmed for bill: ${billId}`);
    return updatedBill as IBill;
  }

  // ✅ METHOD BARU: Get pending payments (untuk admin)
  async getPendingPayments(): Promise<IBill[]> {
    const bills = await this.prisma.bill.findMany({
      where: {
        status: BillStatus.PENDING,
        paymentId: { not: null }, // Hanya yang sudah ada payment record
        payment: {
          status: PaymentStatus.PENDING,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
            nomorTelepon: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return bills as IBill[];
  }
}