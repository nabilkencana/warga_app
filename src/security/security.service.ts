// src/security/security.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmergencyService } from '../emergency/emergency.service';

@Injectable()
export class SecurityService {
    constructor(private prisma: PrismaService) { }

    // Get dashboard data for security
    async getDashboardData(securityId: number) {
        const [emergencies, assignedEmergencies, stats, securityInfo] = await Promise.all([
            this.prisma.emergency.findMany({
                where: {
                    status: 'ACTIVE',
                    alarmSent: true
                },
                include: {
                    emergencyResponses: {
                        where: { securityId },
                        select: { status: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),
            this.prisma.emergencyResponse.count({
                where: {
                    securityId,
                    status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'HANDLING'] }
                }
            }),
            this.getSecurityStats(securityId),
            // PERBAIKAN: Gunakan nama tabel yang benar
            this.prisma.security_personnel.findUnique({
                where: { id: securityId },
                select: {
                    id: true,
                    nama: true,
                    shift: true,
                    isOnDuty: true,
                    emergencyCount: true,
                    email: true,
                    nomorTelepon: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            })
        ]);

        return {
            securityInfo,
            emergencies,
            assignedEmergencies,
            stats,
            totalActiveEmergencies: emergencies.length
        };
    }

    // Security check in - PERBAIKAN
    async checkIn(securityId: number, location?: string) {
        const security = await this.prisma.security_personnel.update({
            where: { id: securityId },
            data: {
                isOnDuty: true,
                lastActiveAt: new Date(),
                ...(location && { currentLocation: location })
            }
        });

        // Log check in
        await this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'CHECK_IN',
                details: 'Security mulai bertugas',
                location: location,
                timestamp: new Date()
            }
        });

        return security;
    }

    // Security check out - PERBAIKAN
    async checkOut(securityId: number) {
        const security = await this.prisma.security_personnel.update({
            where: { id: securityId },
            data: {
                isOnDuty: false,
                lastActiveAt: new Date()
            }
        });

        // Log check out
        await this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'CHECK_OUT',
                details: 'Security selesai bertugas',
                timestamp: new Date()
            }
        });

        return security;
    }

    // Update security location - PERBAIKAN
    async updateLocation(securityId: number, latitude: string, longitude: string) {
        const security = await this.prisma.security_personnel.update({
            where: { id: securityId },
            data: {
                currentLatitude: latitude,
                currentLongitude: longitude,
                lastActiveAt: new Date()
            }
        });

        // Log location update
        await this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'LOCATION_UPDATE',
                details: 'Security update lokasi',
                latitude: latitude,
                longitude: longitude,
                timestamp: new Date()
            }
        });

        return security;
    }

    // Get assigned emergencies for a security
    async getAssignedEmergencies(securityId: number) {
        const responses = await this.prisma.emergencyResponse.findMany({
            where: {
                securityId,
                status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'HANDLING'] }
            },
            include: {
                emergency: {
                    include: {
                        user: {
                            select: {
                                namaLengkap: true,
                                nomorTelepon: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return responses.map(response => ({
            ...response,
            emergency: response.emergency
        }));
    }

    // Get security statistics - PERBAIKAN
    async getSecurityStats(securityId?: number) {
        const whereClause = securityId ? { securityId } : {};

        const [totalResponses, completedResponses, avgResponseTime] = await Promise.all([
            this.prisma.emergencyResponse.count({
                where: whereClause
            }),
            this.prisma.emergencyResponse.count({
                where: {
                    ...whereClause,
                    status: 'RESOLVED'
                }
            }),
            this.prisma.emergencyResponse.aggregate({
                where: {
                    ...whereClause,
                    responseTime: { gt: 0 }
                },
                _avg: {
                    responseTime: true
                }
            })
        ]);

        return {
            totalResponses,
            completedResponses,
            completionRate: totalResponses > 0 ? (completedResponses / totalResponses * 100).toFixed(2) : '0.00',
            avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0)
        };
    }

    // Get all securities - PERBAIKAN
    async getAllSecurities() {
        return this.prisma.security_personnel.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    // Create new security - PERBAIKAN
    async createSecurity(data: {
        nama: string;
        nik: string;
        email: string;
        nomorTelepon: string;
        shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
    }) {
        return this.prisma.security_personnel.create({
            data: {
                nama: data.nama,
                nik: data.nik,
                email: data.email,
                nomorTelepon: data.nomorTelepon,
                shift: data.shift || 'MORNING',
                status: 'ACTIVE',
                isOnDuty: false,
                emergencyCount: 0
            }
        });
    }

    // Update security - PERBAIKAN
    async updateSecurity(id: number, data: {
        nama?: string;
        email?: string;
        nomorTelepon?: string;
        shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
        status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
    }) {
        const updateData: any = {};

        if (data.nama) updateData.nama = data.nama;
        if (data.email) updateData.email = data.email;
        if (data.nomorTelepon) updateData.nomorTelepon = data.nomorTelepon;
        if (data.shift) updateData.shift = data.shift;
        if (data.status) updateData.status = data.status;

        return this.prisma.security_personnel.update({
            where: { id },
            data: updateData
        });
    }

    // Delete security - PERBAIKAN
    async deleteSecurity(id: number) {
        return this.prisma.security_personnel.delete({
            where: { id }
        });
    }

    // Get security logs
    async getSecurityLogs(securityId?: number) {
        const whereClause = securityId ? { securityId } : {};

        return this.prisma.securityLog.findMany({
            where: whereClause,
            include: {
                security: {
                    select: {
                        id: true,
                        nama: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });
    }

    // Get active securities on duty - PERBAIKAN
    async getActiveSecurities() {
        return this.prisma.security_personnel.findMany({
            where: {
                isOnDuty: true,
                status: 'ACTIVE'
            },
            select: {
                id: true,
                nama: true,
                currentLatitude: true,
                currentLongitude: true,
                currentLocation: true,
                shift: true,
                lastActiveAt: true
            },
            orderBy: { lastActiveAt: 'desc' }
        });
    }

    // Get security by ID - PERBAIKAN BESAR
    async getSecurityById(id: number) {
        if (!id) {
            throw new Error('ID is required');
        }

        return this.prisma.security_personnel.findUnique({
            where: { id },
            include: {
                emergencyResponses: {
                    include: {
                        emergency: {
                            select: {
                                id: true,
                                type: true,
                                status: true,
                                createdAt: true
                            }
                        }
                    }
                }
            }
        });
    }

    // Update device token for push notifications - PERBAIKAN
    async updateDeviceToken(securityId: number, deviceToken: string) {
        return this.prisma.security_personnel.update({
            where: { id: securityId },
            data: { deviceToken }
        });
    }

    // Start patrol - PERBAIKAN
    async startPatrol(securityId: number, location?: string) {
        const security = await this.prisma.security_personnel.update({
            where: { id: securityId },
            data: {
                isOnDuty: true,
                lastActiveAt: new Date(),
                ...(location && { currentLocation: location })
            }
        });

        await this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'PATROL_START',
                details: 'Security mulai patroli',
                location: location,
                timestamp: new Date()
            }
        });

        return security;
    }

    // End patrol - PERBAIKAN
    async endPatrol(securityId: number) {
        const security = await this.prisma.security_personnel.update({
            where: { id: securityId },
            data: {
                isOnDuty: false,
                lastActiveAt: new Date()
            }
        });

        await this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'PATROL_END',
                details: 'Security selesai patroli',
                timestamp: new Date()
            }
        });

        return security;
    }

    // Report incident
    async reportIncident(securityId: number, data: {
        details: string;
        location?: string;
        latitude?: string;
        longitude?: string;
    }) {
        return this.prisma.securityLog.create({
            data: {
                securityId,
                action: 'INCIDENT_REPORT',
                details: data.details,
                location: data.location,
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: new Date()
            }
        });
    }

    // Get emergency responses for security
    async getEmergencyResponses(securityId: number) {
        return this.prisma.emergencyResponse.findMany({
            where: { securityId },
            include: {
                emergency: {
                    select: {
                        id: true,
                        type: true,
                        severity: true,
                        location: true,
                        status: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Get security performance metrics
    async getPerformanceMetrics(securityId: number) {
        const responses = await this.prisma.emergencyResponse.findMany({
            where: { securityId },
            select: {
                responseTime: true,
                status: true,
                arrivedAt: true,
                completedAt: true
            }
        });

        const totalResponses = responses.length;
        const completedResponses = responses.filter(r => r.status === 'RESOLVED').length;
        const avgResponseTime = responses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / totalResponses;

        const resolvedResponses = responses.filter(r => r.arrivedAt && r.completedAt && r.status === 'RESOLVED');
        const avgResolutionTime = resolvedResponses.length > 0
            ? resolvedResponses.reduce((sum, r) => {
                const resolutionTime = (r.completedAt!.getTime() - r.arrivedAt!.getTime()) / 1000;
                return sum + resolutionTime;
            }, 0) / resolvedResponses.length
            : 0;

        return {
            totalResponses,
            completedResponses,
            completionRate: totalResponses > 0 ? (completedResponses / totalResponses * 100).toFixed(2) : '0.00',
            avgResponseTime: Math.round(avgResponseTime),
            avgResolutionTime: Math.round(avgResolutionTime)
        };
    }

    // Accept emergency (simplified version)
    async acceptEmergency(securityId: number, emergencyId: number) {
        // Check if already assigned
        const existingResponse = await this.prisma.emergencyResponse.findFirst({
            where: {
                securityId,
                emergencyId
            }
        });

        if (existingResponse) {
            throw new Error('Already assigned to this emergency');
        }

        // Create new response
        return this.prisma.emergencyResponse.create({
            data: {
                securityId,
                emergencyId,
                status: 'DISPATCHED',
                responseTime: 0
            }
        });
    }
}