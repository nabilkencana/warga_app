// src/security/security.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmergencyService } from '../emergency/emergency.service';

@Injectable()
export class SecurityService {
    private readonly logger = new Logger(SecurityService.name);

    constructor(
        private prisma: PrismaService
    ) {
        this.logger.log('SecurityService initialized');

        // Debug: List semua model Prisma
        const prismaModels = Object.keys(this.prisma)
            .filter(key => !key.startsWith('_') && !key.startsWith('$'))
            .sort();

        this.logger.log(`Available Prisma models: ${prismaModels.join(', ')}`);
        this.logger.log(`Has 'security' model: ${'security' in this.prisma}`);
    }


    // Get dashboard data for security
    async getDashboardData(securityId: number) {
        this.logger.log(`Getting dashboard data for securityId: ${securityId}`);

        // Debug: Check prisma instance
        if (!this.prisma) {
            this.logger.error('PrismaService is undefined!');
            throw new Error('Database service is not available');
        }

        try {
            // First, verify security exists
            const securityExists = await this.prisma.security.findUnique({
                where: { id: securityId }
            });

            if (!securityExists) {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }

            this.logger.log(`Security found: ${securityExists.nama}`);

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
                this.prisma.security.findUnique({
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
                        userId: true,
                        currentLocation: true,
                        currentLatitude: true,
                        currentLongitude: true,
                        lastActiveAt: true,
                        createdAt: true,
                        updatedAt: true
                    }
                })
            ]);

            return {
                success: true,
                message: 'Dashboard data retrieved successfully',
                securityInfo,
                emergencies,
                assignedEmergencies,
                stats,
                totalActiveEmergencies: emergencies.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error(`Error in getDashboardData: ${error.message}`, error.stack);
            throw error;
        }
    }

    // Security check in
    async checkIn(securityId: number, location?: string) {
        this.logger.log(`Check-in requested for securityId: ${securityId}`);

        try {
            // Verify security exists first
            const existingSecurity = await this.prisma.security.findUnique({
                where: { id: securityId }
            });

            if (!existingSecurity) {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }

            const security = await this.prisma.security.update({
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

            this.logger.log(`Check-in successful for security: ${security.nama}`);

            return {
                success: true,
                message: 'Check-in berhasil',
                data: {
                    id: security.id,
                    nama: security.nama,
                    isOnDuty: security.isOnDuty,
                    lastActiveAt: security.lastActiveAt
                }
            };
        } catch (error) {
            this.logger.error(`Error in checkIn: ${error.message}`, error.stack);
            if (error.code === 'P2025') {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }
            throw error;
        }
    }

    // Security check out
    async checkOut(securityId: number) {
        this.logger.log(`Check-out requested for securityId: ${securityId}`);

        try {
            // Verify security exists first
            const existingSecurity = await this.prisma.security.findUnique({
                where: { id: securityId }
            });

            if (!existingSecurity) {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }

            const security = await this.prisma.security.update({
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

            this.logger.log(`Check-out successful for security: ${security.nama}`);

            return {
                success: true,
                message: 'Check-out berhasil',
                data: {
                    id: security.id,
                    nama: security.nama,
                    isOnDuty: security.isOnDuty,
                    lastActiveAt: security.lastActiveAt
                }
            };
        } catch (error) {
            this.logger.error(`Error in checkOut: ${error.message}`, error.stack);
            if (error.code === 'P2025') {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }
            throw error;
        }
    }

    // Update security location - PERBAIKAN
    async updateLocation(securityId: number, latitude: string, longitude: string) {
        try {
            const security = await this.prisma.security.update({
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

            return {
                success: true,
                message: 'Lokasi berhasil diupdate',
                data: {
                    id: security.id,
                    nama: security.nama,
                    latitude: security.currentLatitude,
                    longitude: security.currentLongitude
                }
            };
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }
            throw error;
        }
    }

    // Implementasi method yang belum diimplementasi
    async arriveAtEmergency(securityId: number, emergencyId: number) {
        this.logger.log(`Arrive at emergency: securityId=${securityId}, emergencyId=${emergencyId}`);

        try {
            // Find the response
            const response = await this.prisma.emergencyResponse.findFirst({
                where: {
                    securityId,
                    emergencyId
                }
            });

            if (!response) {
                throw new NotFoundException('Emergency response not found');
            }

            // Update response status
            const updatedResponse = await this.prisma.emergencyResponse.update({
                where: { id: response.id },
                data: {
                    status: 'ARRIVED',
                    arrivedAt: new Date()
                }
            });

            // Log the action
            await this.prisma.securityLog.create({
                data: {
                    securityId,
                    action: 'EMERGENCY_RESPONSE',
                    details: `Tiba di lokasi emergency ${emergencyId}`,
                    timestamp: new Date()
                }
            });

            return {
                success: true,
                message: 'Telah tiba di lokasi emergency',
                data: updatedResponse
            };
        } catch (error) {
            this.logger.error(`Error in arriveAtEmergency: ${error.message}`, error.stack);
            throw error;
        }
    }

    async completeEmergency(securityId: number, emergencyId: number, actionTaken: string, notes?: string) {
        this.logger.log(`Complete emergency: securityId=${securityId}, emergencyId=${emergencyId}`);

        try {
            // Find the response
            const response = await this.prisma.emergencyResponse.findFirst({
                where: {
                    securityId,
                    emergencyId
                }
            });

            if (!response) {
                throw new NotFoundException('Emergency response not found');
            }

            // Update response status
            const updatedResponse = await this.prisma.emergencyResponse.update({
                where: { id: response.id },
                data: {
                    status: 'RESOLVED',
                    actionTaken: actionTaken,
                    notes: notes,
                    completedAt: new Date()
                }
            });

            // Update emergency status
            await this.prisma.emergency.update({
                where: { id: emergencyId },
                data: {
                    status: 'RESOLVED'
                }
            });

            // Increment emergency count for security
            await this.prisma.security.update({
                where: { id: securityId },
                data: {
                    emergencyCount: {
                        increment: 1
                    }
                }
            });

            // Log the action
            await this.prisma.securityLog.create({
                data: {
                    securityId,
                    action: 'EMERGENCY_RESPONSE',
                    details: `Menyelesaikan emergency ${emergencyId}: ${actionTaken}`,
                    timestamp: new Date()
                }
            });

            return {
                success: true,
                message: 'Emergency berhasil diselesaikan',
                data: updatedResponse
            };
        } catch (error) {
            this.logger.error(`Error in completeEmergency: ${error.message}`, error.stack);
            throw error;
        }
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
        return this.prisma.security.findMany({
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
        this.logger.log(`Creating new security: ${data.nama}`);

        try {
            // Check if email already exists
            const existingEmail = await this.prisma.security.findUnique({
                where: { email: data.email }
            });

            if (existingEmail) {
                throw new Error('Email sudah terdaftar');
            }

            // Check if NIK already exists
            const existingNIK = await this.prisma.security.findUnique({
                where: { nik: data.nik }
            });

            if (existingNIK) {
                throw new Error('NIK sudah terdaftar');
            }

            // Create security
            const newSecurity = await this.prisma.security.create({
                data: {
                    nama: data.nama,
                    nik: data.nik,
                    email: data.email,
                    nomorTelepon: data.nomorTelepon,
                    shift: data.shift || 'MORNING',
                    status: 'ACTIVE',
                    isOnDuty: false,
                    emergencyCount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });

            this.logger.log(`Security created successfully with ID: ${newSecurity.id}`);

            // Return simplified response
            return {
                success: true,
                message: 'Security berhasil dibuat',
                data: {
                    id: newSecurity.id,
                    nama: newSecurity.nama,
                    email: newSecurity.email,
                    nik: newSecurity.nik,
                    nomorTelepon: newSecurity.nomorTelepon,
                    shift: newSecurity.shift,
                    status: newSecurity.status,
                    isOnDuty: newSecurity.isOnDuty,
                    emergencyCount: newSecurity.emergencyCount
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error(`Error creating security: ${error.message}`);

            if (error.code === 'P2002') { // Prisma unique constraint error
                const target = error.meta?.target || [];
                if (target.includes('email')) {
                    throw new Error('Email sudah terdaftar');
                }
                if (target.includes('nik')) {
                    throw new Error('NIK sudah terdaftar');
                }
            }

            throw new Error(`Gagal membuat security: ${error.message}`);
        }
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

        return this.prisma.security.update({
            where: { id },
            data: updateData
        });
    }

    // Delete security - PERBAIKAN
    async deleteSecurity(id: number) {
        return this.prisma.security.delete({
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
        return this.prisma.security.findMany({
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

        // Perbaiki validasi
        if (!id || isNaN(id) || id <= 0) {
            this.logger.warn(`Invalid ID provided: ${id}`);
            throw new NotFoundException('ID security tidak valid');
        }

        return this.prisma.security.findUnique({
            where: { id },
            include: {
                emergencyResponses: {
                    include: {
                        emergency: {
                            select: {
                                id: true,
                                type: true,
                                status: true,
                                createdAt: true,
                                location: true,
                                severity: true
                            }
                        }
                    }
                },
                securityLogs: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });
    }

    // Update device token for push notifications - PERBAIKAN
    async updateDeviceToken(securityId: number, deviceToken: string) {
        return this.prisma.security.update({
            where: { id: securityId },
            data: { deviceToken }
        });
    }

    // Start patrol - PERBAIKAN
    async startPatrol(securityId: number, location?: string) {
        try {
            const security = await this.prisma.security.update({
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

            return {
                success: true,
                message: 'Patroli dimulai',
                data: security
            };
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }
            throw error;
        }
    }

    // End patrol - PERBAIKAN
    async endPatrol(securityId: number) {
        try {
            const security = await this.prisma.security.update({
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

            return {
                success: true,
                message: 'Patroli selesai',
                data: security
            };
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Security dengan ID ${securityId} tidak ditemukan`);
            }
            throw error;
        }
    }

    // Report incident
    async reportIncident(securityId: number, data: {
        details: string;
        location?: string;
        latitude?: string;
        longitude?: string;
    }) {
        const log = await this.prisma.securityLog.create({
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

        return {
            success: true,
            message: 'Laporan insiden berhasil dikirim',
            data: log
        };
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
        const avgResponseTime = totalResponses > 0
            ? responses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / totalResponses
            : 0;

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
        try {
            // Check if emergency exists
            const emergency = await this.prisma.emergency.findUnique({
                where: { id: emergencyId }
            });

            if (!emergency) {
                throw new NotFoundException(`Emergency dengan ID ${emergencyId} tidak ditemukan`);
            }

            // Check if already assigned
            const existingResponse = await this.prisma.emergencyResponse.findFirst({
                where: {
                    securityId,
                    emergencyId
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
                    emergencyId,
                    status: 'DISPATCHED',
                    responseTime: 0
                }
            });

            // Update emergency satpamAssigned status
            await this.prisma.emergency.update({
                where: { id: emergencyId },
                data: {
                    satpamAssigned: true
                }
            });

            // Log emergency response
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

            return {
                success: true,
                message: 'Emergency berhasil diterima',
                data: response
            };
        } catch (error) {
            throw error;
        }
    }
}