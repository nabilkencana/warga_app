import { TransactionType } from '@prisma/client';

export class Transaction {
    id: number;
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    date: Date;
    proofImage?: string;
    createdBy: number;
    userId?: number;
    paymentId?: number;
    createdAt: Date;
    updatedAt: Date;

    // Relations
    user?: any;
    createdByUser?: any;
    payment?: any;
}