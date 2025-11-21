import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
    constructor(private prisma: PrismaService) { }

    // 🟢 Admin membuat pengumuman
    async create(adminId: number, data: any) {
        try {
            const announcement = await this.prisma.announcement.create({
                data: {
                    title: data.title,
                    description: data.description,
                    targetAudience: data.targetAudience,
                    date: new Date(data.date),
                    day: data.day,
                    createdBy: adminId,
                },
            });
            return { message: 'Pengumuman berhasil dibuat', announcement };
        } catch (error) {
            console.error('Error saat membuat pengumuman:', error);
            throw new Error('Gagal membuat pengumuman');
        }
    }

    // 🟡 Semua user bisa lihat daftar pengumuman
    async findAll() {
        return this.prisma.announcement.findMany({
            include: {
                admin: { select: { id: true, namaLengkap: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // 🟡 Lihat detail pengumuman berdasarkan ID
    async findOne(id: number) {
        const announcement = await this.prisma.announcement.findUnique({
            where: { id },
            include: {
                admin: { select: { id: true, namaLengkap: true, email: true } },
            },
        });

        if (!announcement) throw new NotFoundException('Pengumuman tidak ditemukan');
        return announcement;
    }

    // 🟠 Admin bisa update
    async update(id: number, adminId: number, data: any) {
        const existing = await this.prisma.announcement.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Pengumuman tidak ditemukan');

        if (existing.createdBy !== adminId)
            throw new ForbiddenException('Anda tidak punya izin untuk mengubah pengumuman ini');

        return this.prisma.announcement.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                targetAudience: data.targetAudience,
                date: new Date(data.date), // ✅ ubah jadi Date object
                day: data.day,
            },
        });
    }

    // 🔴 Admin bisa hapus
    async delete(id: number, adminId: number) {
        const existing = await this.prisma.announcement.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Pengumuman tidak ditemukan');

        if (existing.createdBy !== adminId)
            throw new ForbiddenException('Anda tidak punya izin untuk menghapus pengumuman ini');

        await this.prisma.announcement.delete({ where: { id } });
        return { message: 'Pengumuman berhasil dihapus' };
    }
}
