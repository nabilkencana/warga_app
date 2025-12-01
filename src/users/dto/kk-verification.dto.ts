// src/users/dto/kk-verification.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class VerifyKKDto {
    @IsString()
    @IsOptional()
    notes?: string;
}

export class RejectKKDto {
    @IsString()
    @MinLength(10, { message: 'Alasan penolakan minimal 10 karakter' })
    reason: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class SendReminderDto {
    @IsString()
    @MinLength(10, { message: 'Pesan minimal 10 karakter' })
    message: string;
}

export class UpdateKKDocumentDto {
    @IsString()
    @IsOptional()
    notes?: string;
}