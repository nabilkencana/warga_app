import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ReportsModule } from './reports/reports.module';
import { EmergencyModule } from './emergency/emergency.module';
import { AdminModule } from './admin/admin.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BillsModule } from './bills/bills.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [UsersModule, AuthModule, PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }), AnnouncementsModule, ReportsModule, EmergencyModule, AdminModule, TransactionsModule, BillsModule, CloudinaryModule// 🔥 aktifkan .env
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
