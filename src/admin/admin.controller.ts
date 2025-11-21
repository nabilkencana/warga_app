import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('dashboard/stats')
    async getDashboardStats() {
        return this.adminService.getDashboardStats();
    }

    @Get('recent/reports')
    async getRecentReports() {
        return this.adminService.getRecentReports();
    }

    @Get('recent/emergencies')
    async getRecentEmergencies() {
        return this.adminService.getRecentEmergencies();
    }

    @Get('recent/announcements')
    async getRecentAnnouncements() {
        return this.adminService.getRecentAnnouncements();
    }

    @Get('recent/users')
    async getRecentUsers() { // DIUBAH: getRecentusers -> getRecentUsers
        return this.adminService.getRecentUsers();
    }

    // TAMBAHKAN ENDPOINT BARU UNTUK SEMUA USER
    @Get('all/users')
    async getAllUsers() {
        return this.adminService.getAllUsers();
    }
}