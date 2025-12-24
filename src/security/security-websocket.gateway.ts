import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, Inject } from '@nestjs/common';
import { SecurityService } from './security.service';
import { EmergencyService } from '../emergency/emergency.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';


@WebSocketGateway({
    cors: {
        origin: 'https://wargakita.canadev.my.id',
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    namespace: '/security',
})

@Injectable()
export class SecurityWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(SecurityWebSocketGateway.name);

    // Map untuk menyimpan koneksi security
    private securityConnections = new Map<number, Socket>();
    private securityUserMap = new Map<string, number>(); // socket.id -> securityId

    constructor(
        private readonly securityService: SecurityService,
        private readonly notificationService: NotificationService,
        @Inject(PrismaService) private prisma: PrismaService,
    ) {
        this.logger.log('Security WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const securityId = client.handshake.query.securityId;
            const userId = client.handshake.query.userId;

            if (securityId && !isNaN(Number(securityId))) {
                const secId = Number(securityId);

                // Verify security exists and is on duty
                const security = await this.securityService.getSecurityById(secId);

                if (!security) {
                    client.disconnect();
                    this.logger.warn(`Security ${secId} not found, disconnecting`);
                    return;
                }

                // Simpan koneksi
                this.securityConnections.set(secId, client);
                this.securityUserMap.set(client.id, secId);

                // Join ke room security
                await client.join(`security_${secId}`);
                // Join ke room umum untuk semua security
                await client.join('all_securities');

                this.logger.log(`Security connected: ${security.nama} (ID: ${secId}, Socket: ${client.id})`);

                // Kirim welcome message
                client.emit('security_connected', {
                    type: 'SECURITY_CONNECTED',
                    data: {
                        securityId: secId,
                        securityName: security.nama,
                        isOnDuty: security.isOnDuty,
                        timestamp: new Date().toISOString(),
                        message: 'Security dashboard connected successfully'
                    }
                });

                // Kirim update status online ke semua security
                this.server.to('all_securities').emit('security_status_update', {
                    type: 'SECURITY_ONLINE',
                    data: {
                        securityId: secId,
                        securityName: security.nama,
                        isOnline: true,
                        isOnDuty: security.isOnDuty,
                        timestamp: new Date().toISOString()
                    }
                });

            } else if (userId && !isNaN(Number(userId))) {
                // Handle user yang juga SATPAM
                const userIdNum = Number(userId);

                // Cari security berdasarkan userId
                const security = await this.securityService.getSecurityByUserId(userIdNum);

                if (security) {
                    const secId = security.id;
                    this.securityConnections.set(secId, client);
                    this.securityUserMap.set(client.id, secId);

                    await client.join(`security_${secId}`);
                    await client.join('all_securities');

                    this.logger.log(`SATPA M user connected: User ${userIdNum} -> Security ${secId}`);

                    client.emit('security_connected', {
                        type: 'SECURITY_CONNECTED',
                        data: {
                            securityId: secId,
                            securityName: security.nama,
                            isOnDuty: security.isOnDuty,
                            userId: userIdNum,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            } else {
                this.logger.warn(`Invalid connection attempt from ${client.id}`);
                client.disconnect();
            }

        } catch (error) {
            this.logger.error('Error in security handleConnection:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (securityId) {
                this.securityConnections.delete(securityId);
                this.securityUserMap.delete(client.id);

                this.logger.log(`Security disconnected: ID ${securityId}, Socket: ${client.id}`);

                // Kirim update status offline ke semua security
                this.server.to('all_securities').emit('security_status_update', {
                    type: 'SECURITY_OFFLINE',
                    data: {
                        securityId: securityId,
                        isOnline: false,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        } catch (error) {
            this.logger.error('Error in handleDisconnect:', error);
        }
    }

    // ==================== EMERGENCY ALARM METHODS ====================

    /**
     * Kirim alarm emergency ke semua security yang online
     */
    async broadcastEmergencyAlarm(emergency: any) {
        try {
            const alarmData = {
                type: 'EMERGENCY_ALARM',
                data: {
                    emergencyId: emergency.id,
                    emergencyType: emergency.type,
                    severity: emergency.severity,
                    location: emergency.location,
                    latitude: emergency.latitude,
                    longitude: emergency.longitude,
                    reporterName: emergency.user?.namaLengkap || 'Anonymous',
                    reporterPhone: emergency.user?.nomorTelepon || 'N/A',
                    createdAt: emergency.createdAt,
                    timestamp: new Date().toISOString(),
                    alarmPriority: this.getAlarmPriority(emergency.severity),
                    soundUrl: '/sounds/emergency-alarm.mp3',
                    vibrationPattern: [500, 200, 500]
                }
            };

            // 1. Broadcast ke semua security yang online
            this.server.to('all_securities').emit('emergency_alarm', alarmData);

            // 2. Dispatch ke security terdekat (jika ada lokasi)
            if (emergency.latitude && emergency.longitude) {
                await this.dispatchToNearestSecurity(emergency, alarmData);
            }

            // 3. Log broadcast
            this.logger.log(`🚨 EMERGENCY ALARM Broadcasted: #${emergency.id} - ${emergency.type} at ${emergency.location}`);

            // 4. Update flag alarm sent di database
            await this.updateAlarmSent(emergency.id);

            return {
                success: true,
                alarmId: emergency.id,
                broadcastTo: this.securityConnections.size,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Error broadcasting emergency alarm:', error);
            return { success: false, error: error.message };
        }
    }

    /**
    * Update flag alarm sent (helper method)
    */
    private async updateAlarmSent(emergencyId: number) {
        try {
            await this.prisma.emergency.update({
                where: { id: emergencyId },
                data: {
                    alarmSent: true,
                    alarmSentAt: new Date()
                }
            });
        } catch (error) {
            this.logger.error('Error updating alarm sent flag:', error);
        }
    }

    /**
     * Dispatch emergency ke security terdekat
     */
    private async dispatchToNearestSecurity(emergency: any, alarmData: any) {
        try {
            // Dapatkan semua security yang sedang bertugas
            const activeSecurities = await this.securityService.getActiveSecurities();

            if (!activeSecurities || activeSecurities.length === 0) return;

            const emergencyLat = parseFloat(emergency.latitude);
            const emergencyLng = parseFloat(emergency.longitude);

            // Hitung jarak untuk setiap security yang memiliki lokasi
            const securityDistances = activeSecurities
                .filter(sec => sec.currentLatitude && sec.currentLongitude)
                .map(sec => {
                    const distance = this.calculateDistance(
                        emergencyLat,
                        emergencyLng,
                        parseFloat(sec.currentLatitude!),
                        parseFloat(sec.currentLongitude!)
                    );
                    return { ...sec, distance };
                })
                .sort((a, b) => a.distance - b.distance);

            // Ambil 3 security terdekat
            const nearestSecurities = securityDistances.slice(0, 3);

            for (const security of nearestSecurities) {
                // Kirim dispatch khusus ke security ini
                const dispatchData = {
                    ...alarmData,
                    type: 'EMERGENCY_DISPATCH',
                    data: {
                        ...alarmData.data,
                        dispatchType: 'NEAREST',
                        distance: Math.round(security.distance * 100) / 100 + ' km',
                        securityId: security.id,
                        securityName: security.nama,
                        priority: 'HIGH'
                    }
                };

                // Kirim ke security tertentu
                this.server.to(`security_${security.id}`).emit('emergency_dispatch', dispatchData);

                // Buat emergency response di database
                await this.createEmergencyResponse(emergency.id, security.id);

                this.logger.log(`📍 Dispatched to nearest security: ${security.nama} (${security.distance.toFixed(2)} km)`);
            }

        } catch (error) {
            this.logger.error('Error dispatching to nearest security:', error);
        }
    }

    /**
     * Buat emergency response record di database
     */
    private async createEmergencyResponse(emergencyId: number, securityId: number) {
        try {
            await this.prisma.emergencyResponse.create({
                data: {
                    emergencyId: emergencyId,
                    securityId: securityId,
                    responseTime: 0,
                    status: 'DISPATCHED',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            this.logger.error('Error creating emergency response:', error);
        }
    }

    /**
     * Security menerima emergency
     */
    @SubscribeMessage('accept_emergency')
    async handleAcceptEmergency(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { emergencyId: number }
    ) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            // Gunakan Prisma langsung untuk menghindari circular dependency
            const emergency = await this.prisma.emergency.findUnique({
                where: { id: data.emergencyId }
            });

            if (!emergency) {
                return { success: false, error: 'Emergency not found' };
            }

            // Check if already assigned
            const existingResponse = await this.prisma.emergencyResponse.findFirst({
                where: {
                    securityId,
                    emergencyId: data.emergencyId
                }
            });

            if (existingResponse) {
                return {
                    success: false,
                    message: 'Anda sudah ditugaskan untuk emergency ini',
                    data: existingResponse
                };
            }

            // Create new response
            const response = await this.prisma.emergencyResponse.create({
                data: {
                    securityId,
                    emergencyId: data.emergencyId,
                    status: 'EN_ROUTE',
                    responseTime: Math.floor((new Date().getTime() - new Date(emergency.createdAt).getTime()) / 1000)
                }
            });

            // Update emergency satpamAssigned status
            await this.prisma.emergency.update({
                where: { id: data.emergencyId },
                data: {
                    satpamAssigned: true
                }
            });

            // Broadcast acceptance ke semua security
            this.server.to('all_securities').emit('emergency_accepted', {
                type: 'EMERGENCY_ACCEPTED',
                data: {
                    emergencyId: data.emergencyId,
                    securityId: securityId,
                    timestamp: new Date().toISOString()
                }
            });

            // Log ke activity log
            await this.prisma.securityLog.create({
                data: {
                    securityId,
                    action: 'EMERGENCY_RESPONSE',
                    details: `Menerima emergency ${emergency.type} di ${emergency.location}`,
                    location: emergency.location,
                    latitude: emergency.latitude,
                    longitude: emergency.longitude,
                    timestamp: new Date()
                }
            });

            // Log ke notification
            const security = await this.securityService.getSecurityById(securityId);
            if (security) {
                await this.notificationService.createNotification({
                    title: 'Emergency Accepted',
                    message: `${security.nama} has accepted emergency #${data.emergencyId}`,
                    type: NotificationType.SECURITY,
                    userId: securityId,
                    createdBy: securityId,
                    data: { emergencyId: data.emergencyId }
                });
            }

            return {
                success: true,
                message: 'Emergency berhasil diterima',
                data: response
            };

        } catch (error) {
            this.logger.error('Error accepting emergency:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Security tiba di lokasi emergency
     */
    @SubscribeMessage('arrive_at_emergency')
    async handleArriveAtEmergency(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { emergencyId: number }
    ) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            const result = await this.securityService.arriveAtEmergency(securityId, data.emergencyId);

            // Broadcast arrival ke semua security
            this.server.to('all_securities').emit('emergency_arrived', {
                type: 'EMERGENCY_ARRIVED',
                data: {
                    emergencyId: data.emergencyId,
                    securityId: securityId,
                    timestamp: new Date().toISOString()
                }
            });

            return { ...result };

        } catch (error) {
            this.logger.error('Error in arrive at emergency:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Security menyelesaikan emergency
     */
    @SubscribeMessage('complete_emergency')
    async handleCompleteEmergency(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { emergencyId: number; actionTaken: string; notes?: string }
    ) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            // Find the response
            const response = await this.prisma.emergencyResponse.findFirst({
                where: {
                    securityId,
                    emergencyId: data.emergencyId,
                    status: { in: ['ARRIVED', 'HANDLING'] }
                }
            });

            if (!response) {
                return { success: false, error: 'Emergency response not found or not in correct status' };
            }

            // Update response status
            const updatedResponse = await this.prisma.emergencyResponse.update({
                where: { id: response.id },
                data: {
                    status: 'RESOLVED',
                    actionTaken: data.actionTaken,
                    notes: data.notes,
                    completedAt: new Date()
                }
            });

            // Update emergency status
            await this.prisma.emergency.update({
                where: { id: data.emergencyId },
                data: {
                    status: 'RESOLVED'
                }
            });

            // Broadcast completion ke semua security
            this.server.to('all_securities').emit('emergency_resolved', {
                type: 'EMERGENCY_RESOLVED',
                data: {
                    emergencyId: data.emergencyId,
                    securityId: securityId,
                    actionTaken: data.actionTaken,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                success: true,
                message: 'Emergency berhasil diselesaikan',
                data: updatedResponse
            };

        } catch (error) {
            this.logger.error('Error completing emergency:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update lokasi security (real-time tracking)
     */
    @SubscribeMessage('update_location')
    async handleUpdateLocation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { latitude: string; longitude: string; location?: string }
    ) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            const result = await this.securityService.updateLocation(
                securityId,
                data.latitude,
                data.longitude
            );

            // Broadcast lokasi update ke admin (jika perlu)
            this.server.to('admin_dashboard').emit('security_location_update', {
                type: 'SECURITY_LOCATION_UPDATE',
                data: {
                    securityId: securityId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    location: data.location,
                    timestamp: new Date().toISOString()
                }
            });

            return { ...result };

        } catch (error) {
            this.logger.error('Error updating location:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Security check-in
     */
    @SubscribeMessage('check_in')
    async handleCheckIn(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { location?: string }
    ) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            const result = await this.securityService.checkIn(securityId, data.location);

            // Broadcast status update
            this.server.to('all_securities').emit('security_status_update', {
                type: 'SECURITY_ON_DUTY',
                data: {
                    securityId: securityId,
                    isOnDuty: true,
                    timestamp: new Date().toISOString()
                }
            });

            return { ...result };

        } catch (error) {
            this.logger.error('Error in check in:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Security check-out
     */
    @SubscribeMessage('check_out')
    async handleCheckOut(@ConnectedSocket() client: Socket) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            const result = await this.securityService.checkOut(securityId);

            // Broadcast status update
            this.server.to('all_securities').emit('security_status_update', {
                type: 'SECURITY_OFF_DUTY',
                data: {
                    securityId: securityId,
                    isOnDuty: false,
                    timestamp: new Date().toISOString()
                }
            });

            return { ...result };

        } catch (error) {
            this.logger.error('Error in check out:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get real-time emergency updates
     */
    @SubscribeMessage('get_emergency_updates')
    async handleGetEmergencyUpdates(@ConnectedSocket() client: Socket) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            // Get active emergencies - gunakan Prisma langsung
            const emergencies = await this.prisma.emergency.findMany({
                where: {
                    status: 'ACTIVE',
                    alarmSent: true
                },
                include: {
                    volunteers: {
                        where: {
                            status: 'APPROVED',
                        },
                    },
                    emergencyResponses: {
                        include: {
                            security: {
                                select: {
                                    nama: true,
                                    nomorTelepon: true
                                }
                            }
                        }
                    },
                    user: {
                        select: {
                            namaLengkap: true,
                            nomorTelepon: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            // Get assigned emergencies
            const assignedEmergencies = await this.securityService.getAssignedEmergencies(securityId);

            this.logger.log(`Sending emergency updates to security ${securityId}`);

            return {
                success: true,
                data: {
                    activeEmergencies: emergencies,
                    assignedEmergencies: assignedEmergencies,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('Error getting emergency updates:', error);
            return { success: false, error: error.message };
        }
    }

    // method untuk get active emergencies via Prisma
    async getActiveEmergencies() {
        try {
            return await this.prisma.emergency.findMany({
                where: {
                    status: 'ACTIVE',
                    alarmSent: true
                },
                include: {
                    volunteers: true,
                    emergencyResponses: {
                        include: {
                            security: {
                                select: {
                                    nama: true,
                                    nomorTelepon: true
                                }
                            }
                        }
                    },
                    user: {
                        select: {
                            namaLengkap: true,
                            nomorTelepon: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        } catch (error) {
            this.logger.error('Error getting active emergencies:', error);
            return [];
        }
    }

    /**
     * Sinyal test alarm
     */
    @SubscribeMessage('test_alarm')
    async handleTestAlarm(@ConnectedSocket() client: Socket) {
        try {
            const securityId = this.securityUserMap.get(client.id);
            if (!securityId) {
                return { success: false, error: 'Security not authenticated' };
            }

            const testAlarm = {
                type: 'TEST_ALARM',
                data: {
                    emergencyId: 999,
                    emergencyType: 'TEST',
                    severity: 'HIGH',
                    location: 'Test Location',
                    latitude: '-6.2088',
                    longitude: '106.8456',
                    reporterName: 'System',
                    reporterPhone: 'N/A',
                    createdAt: new Date(),
                    timestamp: new Date().toISOString(),
                    alarmPriority: 'HIGH',
                    isTest: true
                }
            };

            client.emit('emergency_alarm', testAlarm);

            return {
                success: true,
                message: 'Test alarm sent successfully'
            };

        } catch (error) {
            this.logger.error('Error sending test alarm:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Tentukan priority alarm berdasarkan severity
     */
    private getAlarmPriority(severity: string): string {
        switch (severity) {
            case 'CRITICAL':
                return 'CRITICAL';
            case 'HIGH':
                return 'HIGH';
            case 'MEDIUM':
                return 'MEDIUM';
            case 'LOW':
                return 'LOW';
            default:
                return 'MEDIUM';
        }
    }

    /**
     * Hitung jarak antara dua titik koordinat (Haversine formula)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius bumi dalam km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Get all connected securities
     */
    getConnectedSecurities() {
        const result = {};
        for (const [securityId, socket] of this.securityConnections.entries()) {
            result[securityId] = {
                socketId: socket.id,
                connectedAt: socket.conn.remoteAddress,
                rooms: Array.from(socket.rooms)
            };
        }
        return result;
    }

    /**
     * Get connection stats
     */
    getConnectionStats() {
        return {
            totalSecuritiesConnected: this.securityConnections.size,
            connectedSecurityIds: Array.from(this.securityConnections.keys()),
            totalRooms: this.server.sockets.adapter.rooms.size,
            timestamp: new Date()
        };
    }
}