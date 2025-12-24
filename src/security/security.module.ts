import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { SecurityWebSocketGateway } from './security-websocket.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        PrismaModule,
        NotificationModule,
    ],
    controllers: [SecurityController],
    providers: [SecurityService, SecurityWebSocketGateway],
    exports: [SecurityService, SecurityWebSocketGateway],
})
export class SecurityModule { }
