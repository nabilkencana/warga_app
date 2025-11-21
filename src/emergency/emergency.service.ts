// src/emergency/emergency.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmergencyService {
    constructor(private prisma: PrismaService) { }

    // Create new emergency SOS dengan fitur relawan
    async createSOS(data: {
        type: string;
        details?: string;
        location?: string;
        latitude?: string;
        longitude?: string;
        needVolunteer?: boolean;
        volunteerCount?: number;
        userId?: number;
    }) {
        return this.prisma.emergency.create({
            data: {
                type: data.type,
                details: data.details,
                location: data.location,
                latitude: data.latitude,
                longitude: data.longitude,
                needVolunteer: data.needVolunteer || false,
                volunteerCount: data.volunteerCount || 0,
                status: 'ACTIVE',
                userId: data.userId,
            },
            include: {
                volunteers: true, // Include data relawan
            },
        });
    }

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
        const needVolunteers = await this.prisma.emergency.count({
            where: {
                status: 'ACTIVE',
                needVolunteer: true,
            },
        });

        return {
            total,
            active,
            resolved,
            needVolunteers,
        };
    }
}