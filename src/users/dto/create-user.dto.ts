// src/users/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsDateString, Matches, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
    @ApiProperty({ description: 'Nama lengkap sesuai KTP' })
    @IsString()
    @Length(3, 100)
    namaLengkap: string;

    @ApiProperty({ description: 'Nomor Induk Kependudukan (16 digit)' })
    @IsString()
    @Length(16, 16)
    @Matches(/^[0-9]+$/, { message: 'NIK harus berupa angka' })
    nik: string;

    @ApiProperty({ description: 'Tanggal lahir (format: YYYY-MM-DD)' })
    @IsString()
    @Transform(({ value }) => {
        // Handle berbagai format tanggal
        if (!value) return value;

        // Format DD.MM.YYYY ke YYYY-MM-DD
        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        // Format DD/MM/YYYY ke YYYY-MM-DD
        if (value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        return value;
    })
    tanggalLahir: string;

    @ApiProperty({ description: 'Tempat lahir' })
    @IsString()
    tempatLahir: string;

    @ApiProperty({ description: 'Alamat email' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Nomor telepon' })
    @IsString()
    nomorTelepon: string;

    @ApiPropertyOptional({ description: 'Username Instagram' })
    @IsOptional()
    @IsString()
    instagram?: string;

    @ApiPropertyOptional({ description: 'Username Facebook' })
    @IsOptional()
    @IsString()
    facebook?: string;

    @ApiProperty({ description: 'Alamat lengkap' })
    @IsString()
    alamat: string;

    @ApiProperty({ description: 'Kota' })
    @IsString()
    kota: string;

    @ApiProperty({ description: 'Negara' })
    @IsString()
    negara: string;

    @ApiProperty({ description: 'Kode pos' })
    @IsString()
    @Length(5, 5)
    @Matches(/^[0-9]+$/, { message: 'Kode pos harus berupa angka' })
    kodePos: string;

    @ApiProperty({ description: 'RT/RW (format: 001/002)' })
    @IsString()
    @Matches(/^[0-9]{3}\/[0-9]{3}$/, { message: 'Format RT/RW harus 001/002' })
    rtRw: string;

    // 🟢 NEW: KK Notes field
    @IsString()
    @IsOptional()
    kkNotes?: string;
}

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'Nama lengkap sesuai KTP' })
    @IsOptional()
    @IsString()
    @Length(3, 100)
    namaLengkap?: string;

    @ApiPropertyOptional({ description: 'Nomor Induk Kependudukan (16 digit)' })
    @IsOptional()
    @IsString()
    @Length(16, 16)
    @Matches(/^[0-9]+$/, { message: 'NIK harus berupa angka' })
    nik?: string;

    @ApiPropertyOptional({ description: 'Tanggal lahir (format: YYYY-MM-DD)' })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => {
        if (!value) return value;

        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        if (value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        return value;
    })
    tanggalLahir?: string;

    @ApiPropertyOptional({ description: 'Tempat lahir' })
    @IsOptional()
    @IsString()
    tempatLahir?: string;

    @ApiPropertyOptional({ description: 'Alamat email' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'Nomor telepon' })
    @IsOptional()
    @IsString()
    nomorTelepon?: string;

    @ApiPropertyOptional({ description: 'Username Instagram' })
    @IsOptional()
    @IsString()
    instagram?: string;

    @ApiPropertyOptional({ description: 'Username Facebook' })
    @IsOptional()
    @IsString()
    facebook?: string;

    @ApiPropertyOptional({ description: 'Alamat lengkap' })
    @IsOptional()
    @IsString()
    alamat?: string;

    @ApiPropertyOptional({ description: 'Kota' })
    @IsOptional()
    @IsString()
    kota?: string;

    @ApiPropertyOptional({ description: 'Negara' })
    @IsOptional()
    @IsString()
    negara?: string;

    @ApiPropertyOptional({ description: 'Kode pos' })
    @IsOptional()
    @IsString()
    @Length(5, 5)
    @Matches(/^[0-9]+$/, { message: 'Kode pos harus berupa angka' })
    kodePos?: string;

    @ApiPropertyOptional({ description: 'RT/RW (format: 001/002)' })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]{3}\/[0-9]{3}$/, { message: 'Format RT/RW harus 001/002' })
    rtRw?: string;

    @ApiPropertyOptional({ description: 'Role user', enum: ['user', 'admin', 'super_admin'] })
    @IsOptional()
    @IsString()
    role?: string;

    // 🟢 NEW: KK Notes field
    @IsString()
    @IsOptional()
    kkNotes?: string;
}


// 🟢 NEW: DTO for KK Verification
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