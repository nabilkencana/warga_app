// dto/transaction-query.dto.ts - Tambahkan validation dan transformation
import { IsOptional, IsNumber, IsString, IsDateString, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class TransactionQueryDto {
    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
    @IsNumber()
    userId?: number;

    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
    @IsNumber()
    createdBy?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10) || 1)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10) || 10)
    @IsNumber()
    @Min(1)
    limit?: number = 10;
}