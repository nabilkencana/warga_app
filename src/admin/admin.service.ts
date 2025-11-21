import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) { }

    async getDashboardStats() {
        const [
            totalUsers,
            totalReports,
            totalEmergencies,
            totalVolunteers,
            activeEmergencies,
            totalAnnouncements,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.report.count(),
            this.prisma.emergency.count(),
            this.prisma.volunteer.count(),
            this.prisma.emergency.count({ where: { status: 'ACTIVE' } }),
            this.prisma.announcement.count(),
        ]);

        return {
            totalUsers,
            totalReports,
            totalEmergencies,
            totalVolunteers,
            activeEmergencies,
            totalAnnouncements,
        };
    }

    async getRecentUsers() { // DIUBAH: getRecentusers -> getRecentUsers
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                namaLengkap: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    // TAMBAHKAN METHOD BARU UNTUK MENGAMBIL SEMUA USER
    async getAllUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            // HAPUS take: 5 untuk mengambil semua data
            select: {
                id: true,
                namaLengkap: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    async getRecentReports() {
        return this.prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { user: true },
        });
    }

    async getRecentEmergencies() {
        return this.prisma.emergency.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { user: true },
        });
    }

    async getRecentAnnouncements() {
        return this.prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { admin: true },
        });
    }
}