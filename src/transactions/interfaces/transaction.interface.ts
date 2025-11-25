import { TransactionType } from '@prisma/client';

export interface ITransaction {
    id: number;
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    date: Date;
    proofImage?: string | null; // FIX: Tambahkan null
    createdBy: number;
    userId?: number | null;
    paymentId?: number | null;
    createdAt: Date;
    updatedAt: Date;

    // Relations (opsional)
    user?: any;
    createdByUser?: any;
    payment?: any;
}

export interface ITransactionCreate {
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    date?: Date;
    proofImage?: string | null; // FIX: Tambahkan null
    createdBy: number;
    userId?: number | null;
    paymentId?: number | null;
}

export interface ITransactionUpdate {
    amount?: number;
    type?: TransactionType;
    category?: string;
    description?: string;
    date?: Date;
    proofImage?: string | null; // FIX: Tambahkan null
    userId?: number | null;
    paymentId?: number | null;
}


export interface ITransactionFilter {
    type?: TransactionType;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    createdBy?: number;
    page?: number;
    limit?: number;
}

export interface ITransactionSummary {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
}