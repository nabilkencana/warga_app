// src/bills/bills.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { BillQueryDto } from './dto/bill-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentMethod, BillStatus } from '@prisma/client';

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) { }

  @Post()
  create(@Body() createBillDto: CreateBillDto, @Request() req) {
    console.log('🔍 Request User:', req.user);
    console.log('🔍 User ID (id):', req.user?.id);
    console.log('🔍 User ID (userId):', req.user?.userId);
    console.log('🔍 User ID (sub):', req.user?.sub);

    // Coba berbagai kemungkinan field ID
    const createdBy = req.user?.id || req.user?.userId || req.user?.sub;

    console.log('🔍 Final createdBy:', createdBy);

    if (!createdBy) {
      throw new Error('User ID not found in request');
    }
    // Set createdBy dari authenticated user
    return this.billsService.create(createBillDto , createdBy);
  }

  @Get()
  findAll(@Query() filters: BillQueryDto) {
    return this.billsService.findAll(filters);
  }

  @Get('my-bills')
  getMyBills(@Query() filters: BillQueryDto, @Request() req) {
    return this.billsService.getUserBills(req.user.id, filters);
  }

  @Get('summary')
  getSummary(@Query('userId') userId?: number) {
    const parsedUserId = userId ? parseInt(userId.toString(), 10) : undefined;
    return this.billsService.getSummary(parsedUserId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBillDto: UpdateBillDto) {
    return this.billsService.update(id, updateBillDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.billsService.remove(id);
  }

  @Post(':id/pay')
  payBill(
    @Param('id') id: string,
    @Body() paymentData: {
      method: string; // Terima string, service akan convert ke enum
      receiptImage?: string
    },
    @Request() req,
  ) {
    return this.billsService.payBill(id, {
      ...paymentData,
      method: paymentData.method as PaymentMethod, // Convert ke enum
      paidDate: new Date(),
    });
  }

  @Post('cron/update-overdue')
  updateOverdueBills() {
    return this.billsService.updateOverdueBills();
  }
  
  // ✅ ENDPOINT BARU: Generate QRIS
  @Post(':id/generate-qris')
  async generateQRIS(@Param('id') id: string) {
    return this.billsService.generateQRIS(id);
  }

  // ✅ ENDPOINT BARU: Create pending payment (untuk user)
  @Post(':id/pending-payment')
  async createPendingPayment(
    @Param('id') id: string,
    @Body() paymentData: {
      method: string;
      receiptImage?: string;
      qrData?: string;
    },
  ) {
    return this.billsService.createPendingPayment(id, paymentData);
  }

  // ✅ ENDPOINT BARU: Confirm payment (untuk admin)
  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(@Param('id') id: string) {
    return this.billsService.confirmPayment(id);
  }

  // ✅ ENDPOINT BARU: Get pending payments (untuk admin)
  @Get('admin/pending-payments')
  @UseGuards(JwtAuthGuard)
  async getPendingPayments() {
    return this.billsService.getPendingPayments();
  }
}