import { IsEnum, IsNumber, IsString, IsOptional, IsDate, IsPositive } from 'class-validator';
import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsEnum(TransactionType)
    type: TransactionType;

    @IsString()
    category: string;

    @IsString()
    description: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    date?: Date;

    @IsOptional()
    @IsString()
    proofImage?: string;

    @IsNumber()
    createdBy: number;

    @IsOptional()
    @IsNumber()
    userId?: number;

    @IsOptional()
    @IsNumber()
    paymentId?: number;
}