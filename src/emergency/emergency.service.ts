// src/emergency/emergency.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef , Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityWebSocketGateway } from 'src/security/security-websocket.gateway';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from '@prisma/client';

// Import atau define enums
type EmergencySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
// Ganti import NotificationType dari Prisma dengan type yang kita butuhkan
type PrismaNotificationType = 'SYSTEM' | 'ANNOUNCEMENT' | 'REPORT' | 'EMERGENCY' | 'BILL' | 'PAYMENT' | 'SECURITY' | 'PROFILE' | 'COMMUNITY' | 'REMINDER' | 'CUSTOM' | 'SOS_ALERT' | 'PATROL';

type SecurityAction = 'CHECK_IN' | 'CHECK_OUT' | 'PATROL_START' | 'PATROL_END' | 'EMERGENCY_RESPONSE' | 'LOCATION_UPDATE' | 'STATUS_CHANGE' | 'INCIDENT_REPORT';

@Injectable()
export class EmergencyService {
    private readonly logger = new Logger(EmergencyService.name);

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        private securityWebSocketGateway: SecurityWebSocketGateway, // Hapus forwardRef
    ) { 
        this.logger.log('EmergencyService initialized')
    }

    // Create new emergency SOS dengan auto-trigger alarm
    async createSOS(data: {
        type: string;
        details?: string;
        location?: string;
        latitude?: string;
        longitude?: string;
        needVolunteer?: boolean;
        volunteerCount?: number;
        userId?: number;
        severity?: EmergencySeverity;
    }) {
        try {
            this.logger.log(`Creating new SOS emergency: ${data.type}`);

            // ======== PERBAIKAN: Validasi userId ========
            let validUserId = data.userId;
            let createdByUserId = data.userId || 0;

            if (validUserId) {
                // Validasi apakah user ada
                const userExists = await this.prisma.user.findUnique({
                    where: { id: validUserId },
                    select: { id: true }
                });

                if (!userExists) {
                    this.logger.warn(`User ID ${validUserId} not found, emergency will be anonymous`);
                    validUserId = undefined;
                    createdByUserId = 0;
                }
            }

            // Jika userId tidak ada atau tidak valid, cari admin sebagai fallback
            if (!createdByUserId || createdByUserId === 0) {
                const adminUser = await this.prisma.user.findFirst({
                    where: { role: 'ADMIN' },
                    select: { id: true }
                });

                if (adminUser) {
                    createdByUserId = adminUser.id;
                } else {
                    // Jika tidak ada admin, cari user pertama
                    const firstUser = await this.prisma.user.findFirst({
                        orderBy: { id: 'asc' },
                        select: { id: true }
                    });
                    if (firstUser) {
                        createdByUserId = firstUser.id;
                    }
                }
            }

            // ======== Create emergency ========
            const emergency = await this.prisma.emergency.create({
                data: {
                    type: data.type,
                    details: data.details,
                    location: data.location,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    needVolunteer: data.needVolunteer || false,
                    volunteerCount: data.volunteerCount || 0,
                    severity: (data.severity as any) || 'MEDIUM',
                    status: 'ACTIVE',
                    userId: validUserId, // Gunakan yang sudah divalidasi
                    alarmSent: false,
                    needSatpam: true,
                    satpamAlertSent: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            namaLengkap: true,
                            nomorTelepon: true,
                            email: true
                        }
                    }
                }
            });

            this.logger.log(`Emergency created: #${emergency.id} - ${emergency.type}`);


            // ========== TRIGGER ALARM KE SECURITY DASHBOARD ==========
            await this.triggerSecurityAlarm(emergency);

            // ========== KIRIM NOTIFIKASI KE USER ==========
            if (validUserId) {
                try {
                    await this.notificationService.createNotification({
                        title: 'SOS Emergency Terkirim',
                        message: `Emergency ${emergency.type} berhasil dilaporkan. Security akan segera menanggapi.`,
                        type: NotificationType.EMERGENCY,
                        userId: validUserId,
                        createdBy: createdByUserId, // Gunakan createdBy yang sudah divalidasi
                        data: { emergencyId: emergency.id }
                    });

                    this.logger.log(`Notification sent to user ${validUserId} created by ${createdByUserId}`);
                } catch (notifError) {
                    this.logger.warn(`Failed to send notification to user ${validUserId}:`, notifError.message);
                    // Lanjutkan proses meskipun notifikasi gagal
                }
            } else {
                this.logger.log('Emergency created anonymously, no user notification sent');
            }

            return {
                success: true,
                message: 'SOS emergency berhasil dikirim dan alarm diaktifkan',
                data: emergency,
                alarmTriggered: true
            };

        } catch (error) {
            this.logger.error('Error creating SOS:', error);
            throw error;
        }
    }

    /**
     * Trigger alarm ke semua security dashboard
     */
    // Perbaikan juga method triggerSecurityAlarm untuk notification
    private async triggerSecurityAlarm(emergency: any) {
        try {
            this.logger.log(`Triggering security alarm for emergency #${emergency.id}`);

            // 1. Update flag alarm di database
            await this.prisma.emergency.update({
                where: { id: emergency.id },
                data: {
                    alarmSent: true,
                    alarmSentAt: new Date(),
                    satpamAlertSent: true,
                    satpamAlertSentAt: new Date()
                }
            });

            this.logger.log(`Emergency #${emergency.id} alarm flags updated`);

            // 2. Broadcast alarm via WebSocket
            const alarmResult = await this.securityWebSocketGateway.broadcastEmergencyAlarm(emergency);

            // 3. Buat notifikasi di database untuk security
            const activeSecurities = await this.prisma.security.findMany({
                where: {
                    isOnDuty: true,
                    status: 'ACTIVE'
                }
            });

            this.logger.log(`Found ${activeSecurities.length} active securities`);

            if (activeSecurities.length > 0) {
                // Cari user admin untuk createdBy fallback
                const adminUser = await this.prisma.user.findFirst({
                    where: { role: 'ADMIN' },
                    select: { id: true }
                });

                const createdByFallback = adminUser?.id || emergency.userId || 1;

                const notifications = activeSecurities.map(security => ({
                    title: `🚨 EMERGENCY ALARM - ${emergency.type.toUpperCase()}`,
                    message: `Emergency di ${emergency.location || 'lokasi tidak diketahui'}. Severity: ${emergency.severity}`,
                    type: NotificationType.SOS_ALERT,
                    icon: 'alert-triangle',
                    iconColor: '#FF0000',
                    data: {
                        emergencyId: emergency.id,
                        type: emergency.type,
                        location: emergency.location,
                        latitude: emergency.latitude,
                        longitude: emergency.longitude,
                        severity: emergency.severity,
                        timestamp: new Date().toISOString()
                    },
                    isRead: false,
                    userId: security.id,
                    relatedEntityId: emergency.id.toString(),
                    relatedEntityType: 'EMERGENCY',
                    createdBy: createdByFallback, // Gunakan fallback yang valid
                    createdAt: new Date()
                }));

                try {
                    await this.prisma.notification.createMany({
                        data: notifications
                    });
                    this.logger.log(`Created ${notifications.length} notifications for active securities`);
                } catch (notifError) {
                    this.logger.warn(`Failed to create notifications: ${notifError.message}`);
                    // Lanjutkan meskipun notifications gagal
                }
            }

            // 4. Log aktivitas
            this.logger.log(`🚨 ALARM TRIGGERED: Emergency #${emergency.id} - ${emergency.type}`);
            this.logger.log(`📡 Broadcast to ${activeSecurities.length} active securities`);

            return alarmResult;

        } catch (error) {
            this.logger.error('Error triggering security alarm:', error);
            throw error;
        }
    }

    /**
     * Update flag alarm sent
     */
    async updateAlarmSent(emergencyId: number) {
        return this.prisma.emergency.update({
            where: { id: emergencyId },
            data: {
                alarmSent: true,
                alarmSentAt: new Date()
            }
        });
    }


    // === METHODS UNTUK CONTROLLER ===

    // Get all active emergencies
    async getActiveEmergencies() {
        return this.prisma.emergency.findMany({
            where: {
                status: 'ACTIVE',
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
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Get all emergencies
    async getAllEmergencies() {
        return this.prisma.emergency.findMany({
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
    }

    // Get emergencies that need volunteers
    async getEmergenciesNeedVolunteers() {
        return this.prisma.emergency.findMany({
            where: {
                status: 'ACTIVE',
                needVolunteer: true,
            },
            include: {
                volunteers: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Get emergency by ID
    async getEmergencyById(id: number) {
        const emergency = await this.prisma.emergency.findUnique({
            where: { id },
            include: {
                volunteers: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
                emergencyResponses: {
                    include: {
                        security: {
                            select: {
                                id: true,
                                nama: true,
                                nomorTelepon: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        id: true,
                        namaLengkap: true,
                        nomorTelepon: true,
                        email: true
                    }
                }
            },
        });

        if (!emergency) {
            throw new NotFoundException(`Emergency dengan ID ${id} tidak ditemukan`);
        }

        return emergency;
    }

    // Update emergency status
    async updateStatus(id: number, status: string) {
        await this.getEmergencyById(id);

        return this.prisma.emergency.update({
            where: { id },
            data: { status },
        });
    }

    // Toggle need volunteer
    async toggleNeedVolunteer(id: number, needVolunteer: boolean, volunteerCount?: number) {
        await this.getEmergencyById(id);

        const updateData: any = {
            needVolunteer: needVolunteer,
        };

        if (volunteerCount !== undefined) {
            updateData.volunteerCount = volunteerCount;
        }

        return this.prisma.emergency.update({
            where: { id },
            data: updateData,
        });
    }

    // Register as volunteer
    async registerVolunteer(emergencyId: number, data: {
        userId?: number;
        userName?: string;
        userPhone?: string;
        skills?: string;
    }) {
        // Check if emergency exists
        await this.getEmergencyById(emergencyId);

        return this.prisma.volunteer.create({
            data: {
                emergencyId: emergencyId,
                userId: data.userId,
                userName: data.userName,
                userPhone: data.userPhone,
                skills: data.skills,
                status: 'REGISTERED',
            },
        });
    }

    // Update volunteer status
    async updateVolunteerStatus(volunteerId: number, status: string) {
        const volunteer = await this.prisma.volunteer.findUnique({
            where: { id: volunteerId },
        });

        if (!volunteer) {
            throw new NotFoundException(`Relawan dengan ID ${volunteerId} tidak ditemukan`);
        }

        return this.prisma.volunteer.update({
            where: { id: volunteerId },
            data: { status },
        });
    }

    // Get volunteers for an emergency
    async getEmergencyVolunteers(emergencyId: number) {
        return this.prisma.volunteer.findMany({
            where: {
                emergencyId: emergencyId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Cancel emergency
    async cancelEmergency(id: number) {
        return this.updateStatus(id, 'CANCELLED');
    }

    // Resolve emergency
    async resolveEmergency(id: number) {

        // Update semua emergency response yang masih aktif
        await this.prisma.emergencyResponse.updateMany({
            where: {
                emergencyId: id,
                status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'HANDLING'] }
            },
            data: {
                status: 'RESOLVED',
                completedAt: new Date()
            }
        });

        return this.updateStatus(id, 'RESOLVED');
    }

    // Get emergencies by type
    async getEmergenciesByType(type: string) {
        return this.prisma.emergency.findMany({
            where: {
                type: type,
                status: 'ACTIVE',
            },
            include: {
                volunteers: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Get emergency statistics
    async getEmergencyStats() {
        const total = await this.prisma.emergency.count();
        const active = await this.prisma.emergency.count({
            where: { status: 'ACTIVE' },
        });
        const resolved = await this.prisma.emergency.count({
            where: { status: 'RESOLVED' },
        });
        const cancelled = await this.prisma.emergency.count({
            where: { status: 'CANCELLED' },
        });
        const needVolunteers = await this.prisma.emergency.count({
            where: {
                status: 'ACTIVE',
                needVolunteer: true,
            },
        });

        // Stats untuk security
        const securityResponses = await this.prisma.emergencyResponse.count();
        const securityActive = await this.prisma.emergencyResponse.count({
            where: {
                status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'HANDLING'] }
            }
        });

        // Stats berdasarkan severity
        const lowSeverity = await this.prisma.emergency.count({
            where: { severity: 'LOW' }
        });
        const mediumSeverity = await this.prisma.emergency.count({
            where: { severity: 'MEDIUM' }
        });
        const highSeverity = await this.prisma.emergency.count({
            where: { severity: 'HIGH' }
        });
        const criticalSeverity = await this.prisma.emergency.count({
            where: { severity: 'CRITICAL' }
        });

        return {
            overview: {
                total,
                active,
                resolved,
                cancelled,
                needVolunteers,
            },
            severity: {
                low: lowSeverity,
                medium: mediumSeverity,
                high: highSeverity,
                critical: criticalSeverity
            },
            security: {
                totalResponses: securityResponses,
                activeResponses: securityActive,
                securityOnDuty: await this.prisma.security.count({
                    where: { isOnDuty: true }
                })
            },
            volunteers: {
                total: await this.prisma.volunteer.count(),
                approved: await this.prisma.volunteer.count({
                    where: { status: 'APPROVED' }
                }),
                pending: await this.prisma.volunteer.count({
                    where: { status: 'REGISTERED' }
                })
            }
        };
    }

    // === METHODS UNTUK SECURITY INTEGRATION ===

    // Security menerima emergency
    async acceptEmergency(securityId: number, emergencyId: number) {
        const emergency = await this.getEmergencyById(emergencyId);

        // Update emergency response status
        await this.prisma.emergencyResponse.updateMany({
            where: {
                emergencyId,
                securityId
            },
            data: {
                status: 'EN_ROUTE',
                responseTime: Math.floor((new Date().getTime() - new Date(emergency.createdAt).getTime()) / 1000)
            }
        });

        // Update security status
        await this.prisma.security.update({
            where: { id: securityId },
            data: {
                emergencyCount: { increment: 1 }
            }
        });

        // Buat notifikasi untuk user
        if (emergency.userId) {
            await this.prisma.notification.create({
                data: {
                    title: 'Security Sedang Menuju Lokasi',
                    message: `Security sedang dalam perjalanan menuju lokasi emergency Anda.`,
                    type: 'EMERGENCY' as any,
                    userId: emergency.userId,
                    relatedEntityId: emergencyId.toString(),
                    relatedEntityType: 'EMERGENCY',
                    createdBy: securityId,
                    icon: 'shield',
                    iconColor: '#007AFF'
                }
            });
        }

        return { success: true, message: 'Emergency accepted' };
    }

    // Security tiba di lokasi
    async arriveAtEmergency(securityId: number, emergencyId: number) {
        const response = await this.prisma.emergencyResponse.findFirst({
            where: {
                emergencyId,
                securityId,
                status: 'EN_ROUTE'
            }
        });

        if (!response) {
            throw new BadRequestException('Security belum menerima emergency ini');
        }

        await this.prisma.emergencyResponse.update({
            where: { id: response.id },
            data: {
                status: 'ARRIVED',
                arrivedAt: new Date()
            }
        });

        // Notify user
        const emergency = await this.getEmergencyById(emergencyId);
        if (emergency.userId) {
            await this.prisma.notification.create({
                data: {
                    title: 'Security Telah Tiba',
                    message: `Security telah tiba di lokasi emergency.`,
                    type: 'EMERGENCY' as any,
                    userId: emergency.userId,
                    relatedEntityId: emergencyId.toString(),
                    relatedEntityType: 'EMERGENCY',
                    createdBy: securityId,
                    icon: 'check-circle',
                    iconColor: '#34C759'
                }
            });
        }

        return { success: true, message: 'Arrival confirmed' };
    }

    // Security selesaikan emergency
    async completeEmergency(securityId: number, emergencyId: number, actionTaken: string, notes?: string) {
        const response = await this.prisma.emergencyResponse.findFirst({
            where: {
                emergencyId,
                securityId,
                status: { in: ['ARRIVED', 'HANDLING'] }
            }
        });

        if (!response) {
            throw new BadRequestException('Security belum tiba di lokasi emergency');
        }

        await this.prisma.emergencyResponse.update({
            where: { id: response.id },
            data: {
                status: 'RESOLVED',
                actionTaken,
                notes,
                completedAt: new Date()
            }
        });

        // Update emergency status
        await this.prisma.emergency.update({
            where: { id: emergencyId },
            data: {
                status: 'RESOLVED',
                updatedAt: new Date()
            }
        });

        // Notify user
        const emergency = await this.getEmergencyById(emergencyId);
        if (emergency.userId) {
            await this.prisma.notification.create({
                data: {
                    title: 'Emergency Telah Ditangani',
                    message: `Emergency telah berhasil ditangani oleh security.`,
                    type: 'EMERGENCY' as any,
                    userId: emergency.userId,
                    relatedEntityId: emergencyId.toString(),
                    relatedEntityType: 'EMERGENCY',
                    createdBy: securityId,
                    icon: 'thumbs-up',
                    iconColor: '#FF9500'
                }
            });
        }

        return { success: true, message: 'Emergency completed' };
    }

    // Get emergencies untuk security dashboard
    async getSecurityEmergencies() {
        return this.prisma.emergency.findMany({
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
                                id: true,
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
                createdAt: 'desc'
            }
        });
    }

    // Get security statistics
    async getSecurityStats(securityId?: number) {
        const whereClause = securityId ? { securityId } : {};

        const totalResponses = await this.prisma.emergencyResponse.count({
            where: whereClause
        });

        const activeResponses = await this.prisma.emergencyResponse.count({
            where: {
                ...whereClause,
                status: {
                    in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'HANDLING']
                }
            }
        });

        const averageResponseTime = await this.prisma.emergencyResponse.aggregate({
            where: {
                ...whereClause,
                responseTime: { gt: 0 }
            },
            _avg: {
                responseTime: true
            }
        });

        const resolvedResponses = await this.prisma.emergencyResponse.count({
            where: {
                ...whereClause,
                status: 'RESOLVED'
            }
        });

        return {
            totalResponses,
            activeResponses,
            resolvedResponses,
            averageResponseTime: Math.round(averageResponseTime._avg.responseTime || 0),
            completionRate: totalResponses > 0 ?
                ((resolvedResponses / totalResponses) * 100).toFixed(2) : '0.00'
        };
    }
}