// src/cloudinary/cloudinary.module.ts
import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // 🟢 IMPORT ConfigModule untuk akses environment variables
  providers: [CloudinaryProvider, CloudinaryService],
  controllers: [], // Kosongkan jika tidak butuh controller
  exports: [CloudinaryService, CloudinaryProvider], // 🟢 EXPORT CloudinaryService
})
export class CloudinaryModule { }