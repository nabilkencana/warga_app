// src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule], // 🟢 TAMBAHKAN CloudinaryModule
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService, FilesService],
  exports: [ReportsService],
})
export class ReportsModule { }