import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import {
  ITransaction,
  ITransactionCreate,
  ITransactionFilter,
  ITransactionSummary
} from './interfaces/transaction.interface';
import { TransactionType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private prisma: PrismaService) { }

  async create(createTransactionDto: CreateTransactionDto): Promise<ITransaction> {
    const transactionData: ITransactionCreate = {
      ...createTransactionDto,
      date: createTransactionDto.date || new Date(),
    };

    const transaction = await this.prisma.transaction.create({
      data: transactionData,
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

    this.logger.log(`Transaction created: ${transaction.id}`);

    // Update financial summary dengan error handling
    try {
      await this.updateFinancialSummary(transaction.date);
      this.logger.log('Financial summary updated successfully');
    } catch (error) {
      this.logger.error('Failed to update financial summary:', error);
      // Jangan throw error, biarkan transaction tetap created
    }

    return transaction;
  }

  // Di transactions.service.ts - Perbaiki findAll method

  async findAll(filters: TransactionQueryDto): Promise<{
    transactions: ITransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const {
      type,
      category,
      startDate,
      endDate,
      userId,
      createdBy,
      page = 1,
      limit = 10,
    } = filters;

    // Convert string parameters to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const where: any = {};

    if (type) where.type = type;
    if (category) where.category = category;

    // Convert userId and createdBy to numbers if they exist
    if (userId) where.userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (createdBy) where.createdBy = typeof createdBy === 'string' ? parseInt(createdBy, 10) : createdBy;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const skip = (pageNum - 1) * limitNum;

    this.logger.debug(`FindAll query: skip=${skip}, take=${limitNum}, where=${JSON.stringify(where)}`);

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
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
        orderBy: { date: 'desc' },
        skip,
        take: limitNum, // Now this is a number
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: number): Promise<ITransaction> {
    const transaction = await this.prisma.transaction.findUnique({
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
        payment: {
          include: {
            memberPayment: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async update(id: number, updateTransactionDto: UpdateTransactionDto): Promise<ITransaction> {
    const existingTransaction = await this.findOne(id);

    const transaction = await this.prisma.transaction.update({
      where: { id },
      data: updateTransactionDto,
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

    // Update financial summary if amount or type changed
    if (updateTransactionDto.amount || updateTransactionDto.type) {
      try {
        await this.updateFinancialSummary(transaction.date);
        this.logger.log('Financial summary updated after transaction update');
      } catch (error) {
        this.logger.error('Failed to update financial summary after update:', error);
      }
    }

    return transaction;
  }

  async remove(id: number): Promise<void> {
    const transaction = await this.findOne(id);

    await this.prisma.transaction.delete({
      where: { id },
    });

    // Update financial summary after deletion
    try {
      await this.updateFinancialSummary(transaction.date);
      this.logger.log('Financial summary updated after deletion');
    } catch (error) {
      this.logger.error('Failed to update financial summary after deletion:', error);
    }
  }

  // Di transactions.service.ts - Perbaiki getSummary method

  async getSummary(filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
  }): Promise<ITransactionSummary> {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    // Convert userId to number if it's a string
    if (filters?.userId) {
      where.userId = typeof filters.userId === 'string' ? parseInt(filters.userId, 10) : filters.userId;
    }

    const [incomeResult, expenseResult, countResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const totalIncome = incomeResult._sum.amount || 0;
    const totalExpense = expenseResult._sum.amount || 0;
    const balance = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      balance,
      transactionCount: countResult,
    };
  } catch(error) {
    this.logger.error('Error in getSummary:', error);
    throw error;
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.prisma.transaction.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
    });

    return categories.map(cat => cat.category);
  }

  async getMonthlySummary(month: number, year: number): Promise<ITransactionSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // End of month

    this.logger.debug(`Monthly summary for ${month}/${year}: ${startDate} to ${endDate}`);

    return this.getSummary({
      startDate,
      endDate,
    });
  }

  private async updateFinancialSummary(date: Date): Promise<void> {
    try {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      this.logger.log(`Updating financial summary for ${month}/${year}`);

      const summary = await this.getMonthlySummary(month, year);

      this.logger.debug(`Summary to update: Income=${summary.totalIncome}, Expense=${summary.totalExpense}, Balance=${summary.balance}`);

      // Cek dulu apakah financial summary sudah ada
      const existingSummary = await this.prisma.financialSummary.findUnique({
        where: {
          month_year: {
            month,
            year,
          },
        },
      });

      if (existingSummary) {
        // Update existing
        await this.prisma.financialSummary.update({
          where: {
            month_year: {
              month,
              year,
            },
          },
          data: {
            totalIncome: summary.totalIncome,
            totalExpense: summary.totalExpense,
            balance: summary.balance,
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Financial summary updated for ${month}/${year}`);
      } else {
        // Create new
        // Cari createdBy dari user yang ada, atau gunakan default
        const defaultUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });

        await this.prisma.financialSummary.create({
          data: {
            month,
            year,
            totalIncome: summary.totalIncome,
            totalExpense: summary.totalExpense,
            balance: summary.balance,
            createdBy: defaultUser?.id || 1,
          },
        });
        this.logger.log(`Financial summary created for ${month}/${year}`);
      }

    } catch (error) {
      this.logger.error('Error in updateFinancialSummary:', error);
      throw error;
    }
  }

  // Method untuk manual trigger update summary
  async updateFinancialSummaryManually(month: number, year: number): Promise<void> {
    try {
      this.logger.log(`Manual update financial summary for ${month}/${year}`);
      const date = new Date(year, month - 1, 1);
      await this.updateFinancialSummary(date);
    } catch (error) {
      this.logger.error('Manual update failed:', error);
      throw error;
    }
  }

  // Method untuk get current financial summary
  async getCurrentFinancialSummary(): Promise<any> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return this.prisma.financialSummary.findUnique({
      where: {
        month_year: {
          month,
          year,
        },
      },
    });
  }

  async getUserTransactions(userId: number, filters?: TransactionQueryDto): Promise<{
    transactions: ITransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return this.findAll({
      ...filters,
      userId,
    });
  }

  async getRecentTransactions(limit: number = 10): Promise<ITransaction[]> {
    // Convert limit to number if it's a string
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    return this.prisma.transaction.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: limitNum, // Now this is a number
    });
  }
}