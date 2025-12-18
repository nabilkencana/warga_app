import { Global, Module } from '@nestjs/common';
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
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';
import { SecurityController } from './security/security.controller';
import { SecurityService } from './security/security.service';
import { SecurityModule } from './security/security.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { HealthController } from './health/health.controller';
import { HealthModule } from './health/health.module';
import { DebugModule } from 'debug/debug.module';

@Global() // Tambahkan @Global() agar bisa diakses di semua module
@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public', // URL path untuk akses file static
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AnnouncementsModule,
    ReportsModule,
    EmergencyModule,
    AdminModule,
    TransactionsModule,
    BillsModule,
    CloudinaryModule,
    ProfileModule,
    NotificationModule,
    SecurityModule,
    HealthModule,
    DebugModule// 🔥 aktifkan .env
  ],
  controllers: [AppController, SecurityController, HealthController],
  providers: [AppService, SecurityService],
})
export class AppModule { }
