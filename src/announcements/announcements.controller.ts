import { Controller, Get, Post, Body, Param, Put, Delete, Req } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { Request } from 'express'; // at the top of your file

// 🟢 Buat interface khusus agar TS tahu req.user punya id
interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        // tambahkan properti lain jika perlu, misal email, name, dll
    };
}

@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    // 🟢 Buat pengumuman (hanya admin)
    @Post()
    async create(@Req() req : AuthenticatedRequest, @Body() data: any) {
        const adminId = req.user?.id || 1; // contoh default admin (nanti bisa pakai JWT)
        return this.announcementsService.create(adminId, data);
    }

    // 🟡 Lihat semua pengumuman
    @Get()
    async findAll() {
        return this.announcementsService.findAll();
    }

    // 🟡 Lihat satu pengumuman
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.announcementsService.findOne(Number(id));
    }

    // 🟠 Update (admin)
    @Put(':id')
    async update(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body() data: any) {
        const adminId = req.user?.id || 1;
        return this.announcementsService.update(Number(id), adminId, data);
    }

    // 🔴 Hapus (admin)
    @Delete(':id')
    async delete(@Param('id') id: string, @Req() req : AuthenticatedRequest) {
        const adminId = req.user?.id || 1;
        return this.announcementsService.delete(Number(id), adminId);
    }
}
