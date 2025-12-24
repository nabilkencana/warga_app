import { Module } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { SecurityModule } from '../security/security.module';

@Module({
    imports: [
        PrismaModule,
        NotificationModule,
        SecurityModule, // Import SecurityModule untuk akses SecurityWebSocketGateway
    ],
    controllers: [EmergencyController],
    providers: [EmergencyService],
    exports: [EmergencyService],
})
export class EmergencyModule { }