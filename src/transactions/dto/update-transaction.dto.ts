import { PartialType } from '@nestjs/mapped-types';
import { CreateTransactionDto } from './create-transaction.dto';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
    @IsOptional()
    @IsNumber()
    @IsPositive()
    amount?: number;

    @IsOptional()
    @IsEnum(TransactionType)
    type?: TransactionType;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    description?: string;
}