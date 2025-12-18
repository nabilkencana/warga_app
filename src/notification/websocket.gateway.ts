// src/notification/websocket.gateway.ts
import {
    WebSocketGateway as NestWebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';

@NestWebSocketGateway({
    cors: {
        origin: 'https://wargakita.canadev.my.id', // Ganti dengan domain Flutter di production
        credentials: true,
    },
    transports: ['websocket', 'polling'], // ✅ Tambahkan transport options
})
export class NotificationWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(NotificationWebSocketGateway.name);
    private userSocketMap = new Map<number, string>();

    constructor() {
        this.logger.log('WebSocket Gateway initialized');
    }

    async handleConnection(@ConnectedSocket() client: Socket) {
        try {
            const userId = client.handshake.query.userId;
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization;

            this.logger.debug(`Connection attempt: userId=${userId}, clientId=${client.id}`);

            // Validasi userId
            if (!userId || isNaN(Number(userId))) {
                this.logger.warn(`Invalid userId: ${userId}`);
                client.disconnect();
                return;
            }

            const userIdNum = Number(userId);

            // TODO: Validasi token JWT di sini (opsional untuk sekarang)
            if (!this.validateToken(token)) {
                client.disconnect();
                return;
            }

            // Simpan mapping
            this.userSocketMap.set(userIdNum, client.id);

            // Join rooms
            await client.join(`user_${userIdNum}`);
            await client.join('general');

            this.logger.log(`✅ Client connected: ${client.id} for user ${userIdNum}`);
            this.logger.log(`📊 Total connected users: ${this.userSocketMap.size}`);

            // Kirim welcome message
            client.emit('connected', {
                type: 'CONNECTED',
                data: {
                    message: 'WebSocket connected successfully',
                    userId: userIdNum,
                    timestamp: new Date(),
                    serverInfo: {
                        connections: this.userSocketMap.size,
                        version: '1.0.0'
                    }
                }
            });

        } catch (error) {
            this.logger.error(`Connection error: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(@ConnectedSocket() client: Socket) {
        try {
            for (const [userId, socketId] of this.userSocketMap.entries()) {
                if (socketId === client.id) {
                    this.userSocketMap.delete(userId);
                    this.logger.log(`❌ Client disconnected: ${client.id} for user ${userId}`);
                    this.logger.log(`📊 Remaining connections: ${this.userSocketMap.size}`);
                    break;
                }
            }
        } catch (error) {
            this.logger.error(`Disconnection error: ${error.message}`);
        }
    }

    // Method untuk mengirim notifikasi ke user tertentu
    async sendNotificationToUser(userId: number, notificationData: any): Promise<boolean> {
        try {
            const socketId = this.userSocketMap.get(userId);

            if (!socketId) {
                this.logger.warn(`User ${userId} is not connected via WebSocket`);
                return false;
            }

            const payload = {
                type: notificationData.type || 'NEW_NOTIFICATION',
                data: {
                    ...notificationData.data,
                    serverTime: new Date(),
                    id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                }
            };

            this.server.to(`user_${userId}`).emit('notification', payload);
            this.logger.log(`📨 Notification sent to user ${userId}`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to send notification to user ${userId}: ${error.message}`);
            return false;
        }
    }

    // Method untuk broadcast ke semua user
    async broadcastNotification(notificationData: any): Promise<number> {
        try {
            const payload = {
                type: notificationData.type || 'BROADCAST',
                data: {
                    ...notificationData.data,
                    serverTime: new Date(),
                    id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                }
            };

            this.server.to('general').emit('notification', payload);
            const count = this.userSocketMap.size;

            this.logger.log(`📢 Broadcast sent to ${count} users`);
            return count;

        } catch (error) {
            this.logger.error(`Broadcast failed: ${error.message}`);
            return 0;
        }
    }

    // Method untuk broadcast ke RT tertentu
    async broadcastToRT(rtNumber: string, notificationData: any): Promise<number> {
        try {
            const payload = {
                type: notificationData.type || 'RT_BROADCAST',
                data: {
                    ...notificationData.data,
                    rt: rtNumber,
                    serverTime: new Date(),
                    id: `rt_${rtNumber}_${Date.now()}`
                }
            };

            this.server.to(`rt_${rtNumber}`).emit('notification', payload);
            this.logger.log(`📍 RT ${rtNumber} broadcast sent`);
            return 1;

        } catch (error) {
            this.logger.error(`RT broadcast failed: ${error.message}`);
            return 0;
        }
    }

    // Helper method untuk mendapatkan info connections
    getConnectionStats() {
        return {
            totalConnections: this.userSocketMap.size,
            connectedUsers: Array.from(this.userSocketMap.keys()),
            timestamp: new Date()
        };
    }

    // Validasi token (basic implementation)
    private validateToken(token: string): boolean {
        // Untuk development, kita bypass validation dulu
        // Di production, validasi JWT token di sini
        return true;
    }
}