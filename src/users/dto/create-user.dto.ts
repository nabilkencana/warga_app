// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsDateString, IsPhoneNumber, IsPostalCode } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'Nama lengkap user' })
    @IsNotEmpty()
    @IsString()
    namaLengkap!: string;

    @ApiProperty({ description: 'NIK (Nomor Induk Kependudukan)' })
    @IsNotEmpty()
    @IsString()
    nik!: string;

    @ApiProperty({ description: 'Tanggal lahir' })
    @IsNotEmpty()
    @IsDateString()
    tanggalLahir!: string;

    @ApiProperty({ description: 'Tempat lahir' })
    @IsNotEmpty()
    @IsString()
    tempatLahir!: string;

    @ApiProperty({ description: 'Email user' })
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @ApiProperty({ description: 'Nomor telepon' })
    @IsNotEmpty()
    @IsPhoneNumber('ID')
    nomorTelepon!: string;

    @ApiProperty({ description: 'Username Instagram', required: false })
    @IsOptional()
    @IsString()
    instagram?: string;

    @ApiProperty({ description: 'Username Facebook', required: false })
    @IsOptional()
    @IsString()
    facebook?: string;

    @ApiProperty({ description: 'Alamat lengkap' })
    @IsNotEmpty()
    @IsString()
    alamat!: string;

    @ApiProperty({ description: 'Kota' })
    @IsNotEmpty()
    @IsString()
    kota!: string;

    @ApiProperty({ description: 'Negara' })
    @IsNotEmpty()
    @IsString()
    negara!: string;

    @ApiProperty({ description: 'Kode pos' })
    @IsNotEmpty()
    @IsPostalCode('ID')
    kodePos!: string;

    @ApiProperty({ description: 'RT/RW' })
    @IsNotEmpty()
    @IsString()
    rtRw!: string;
}

export class UpdateUserDto {
    @ApiProperty({ description: 'Nama lengkap user', required: false })
    @IsOptional()
    @IsString()
    namaLengkap?: string;

    @ApiProperty({ description: 'NIK (Nomor Induk Kependudukan)', required: false })
    @IsOptional()
    @IsString()
    nik?: string;

    @ApiProperty({ description: 'Tanggal lahir', required: false })
    @IsOptional()
    @IsDateString()
    tanggalLahir?: string;

    @ApiProperty({ description: 'Tempat lahir', required: false })
    @IsOptional()
    @IsString()
    tempatLahir?: string;

    @ApiProperty({ description: 'Email user', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'Nomor telepon', required: false })
    @IsOptional()
    @IsPhoneNumber('ID')
    nomorTelepon?: string;

    @ApiProperty({ description: 'Username Instagram', required: false })
    @IsOptional()
    @IsString()
    instagram?: string;

    @ApiProperty({ description: 'Username Facebook', required: false })
    @IsOptional()
    @IsString()
    facebook?: string;

    @ApiProperty({ description: 'Alamat lengkap', required: false })
    @IsOptional()
    @IsString()
    alamat?: string;

    @ApiProperty({ description: 'Kota', required: false })
    @IsOptional()
    @IsString()
    kota?: string;

    @ApiProperty({ description: 'Negara', required: false })
    @IsOptional()
    @IsString()
    negara?: string;

    @ApiProperty({ description: 'Kode pos', required: false })
    @IsOptional()
    @IsPostalCode('ID')
    kodePos?: string;

    @ApiProperty({ description: 'RT/RW', required: false })
    @IsOptional()
    @IsString()
    rtRw?: string;

    @ApiProperty({ description: 'Role user', required: false, enum: ['user', 'admin'] })
    @IsOptional()
    @IsString()
    role?: string;
}