// src/reports/reports.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    // Create new report - FIXED VERSION
    async create(data: {
        title: string;
        description: string;
        category: string;
        imageUrl?: string;
        userId?: number;
    }) {
        // Prepare data dengan type yang sesuai
        const createData: any = {
            title: data.title,
            description: data.description,
            category: data.category,
            status: 'PENDING'
        };

        // Hanya tambahkan field jika ada value-nya
        if (data.imageUrl) {
            createData.imageUrl = data.imageUrl;
        }

        // Handle userId - convert ke number atau undefined
        if (data.userId !== undefined && data.userId !== null) {
            createData.userId = Number(data.userId);
        }

        return this.prisma.report.create({
            data: createData,
        });
    }

    // Get all reports
    async findAll() {
        return this.prisma.report.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Get report by ID
    async findOne(id: number) {
        const report = await this.prisma.report.findUnique({
            where: { id },
        });

        if (!report) {
            throw new NotFoundException(`Laporan dengan ID ${id} tidak ditemukan`);
        }

        return report;
    }

    // Update report
    async update(id: number, data: {
        title?: string;
        description?: string;
        category?: string;
        imageUrl?: string;
    }) {
        // Check if report exists
        await this.findOne(id);

        // Prepare update data
        const updateData: any = {};

        if (data.title) updateData.title = data.title;
        if (data.description) updateData.description = data.description;
        if (data.category) updateData.category = data.category;
        if (data.imageUrl) updateData.imageUrl = data.imageUrl;

        return this.prisma.report.update({
            where: { id },
            data: updateData,
        });
    }

    // Delete report
    async remove(id: number) {
        // Check if report exists
        await this.findOne(id);

        return this.prisma.report.delete({
            where: { id },
        });
    }

    // Update report status
    async updateStatus(id: number, status: string) {
        // Check if report exists
        await this.findOne(id);

        return this.prisma.report.update({
            where: { id },
            data: { status },
        });
    }

    // Get reports by category
    async findByCategory(category: string) {
        return this.prisma.report.findMany({
            where: {
                category: category
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Get reports by status
    async findByStatus(status: string) {
        return this.prisma.report.findMany({
            where: {
                status: status
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Search reports by title - FIXED VERSION (tanpa mode)
    async searchByTitle(keyword: string) {
        return this.prisma.report.findMany({
            where: {
                title: {
                    contains: keyword,
                    // Hapus mode: 'insensitive' jika tidak didukung
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Alternative search dengan query raw jika perlu case insensitive
    async searchByTitleInsensitive(keyword: string) {
        return this.prisma.$queryRaw`
      SELECT * FROM reports 
      WHERE title LIKE ${'%' + keyword + '%'}
      ORDER BY createdAt DESC
    `;
    }
}