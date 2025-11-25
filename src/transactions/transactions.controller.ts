import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(createTransactionDto);
  }

  @Get()
  findAll(@Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId', ParseIntPipe) userId?: number,
  ) {
    return this.transactionsService.getSummary({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
    });
  }

  @Get('monthly-summary')
  getMonthlySummary(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
  ) {
    return this.transactionsService.getMonthlySummary(month, year);
  }

  @Get('categories')
  getCategories() {
    return this.transactionsService.getCategories();
  }

  @Get('recent')
  getRecentTransactions(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.transactionsService.getRecentTransactions(limit);
  }

  @Get('user/:userId')
  getUserTransactions(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionsService.getUserTransactions(userId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, updateTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.remove(id);
  }

  // Debug endpoints
  @Get('debug/summary')
  async getDebugSummary() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const transactionSummary = await this.transactionsService.getMonthlySummary(month, year);
    const financialSummary = await this.transactionsService.getCurrentFinancialSummary();

    return {
      currentMonth: `${month}/${year}`,
      transactionSummary,
      financialSummary,
      match: financialSummary ?
        financialSummary.totalIncome === transactionSummary.totalIncome &&
        financialSummary.totalExpense === transactionSummary.totalExpense &&
        financialSummary.balance === transactionSummary.balance
        : 'No financial summary found'
    };
  }

  @Post('debug/update-summary')
  async updateSummaryManually(
    @Body() body: { month?: number; year?: number }
  ) {
    const now = new Date();
    const month = body.month || now.getMonth() + 1;
    const year = body.year || now.getFullYear();

    await this.transactionsService.updateFinancialSummaryManually(month, year);

    return {
      message: `Financial summary updated for ${month}/${year}`,
      success: true
    };
  }
}