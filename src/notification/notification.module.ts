import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationWebSocketGateway } from './websocket.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationWebSocketGateway
  ],
  exports: [
    NotificationService,
    NotificationWebSocketGateway
  ],
})
export class NotificationModule { }