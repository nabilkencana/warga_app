// src/security/security.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
    prisma: any;
    constructor(private securityService: SecurityService) { }

    @Get('health')
    async healthCheck() {
        return {
            status: 'ok',
            service: 'security',
            timestamp: new Date().toISOString()
        };
    }

    @Get('dashboard/:securityId')
    async getSecurityDashboard(@Param('securityId') securityId: string) {
        return this.securityService.getDashboardData(parseInt(securityId));
    }

    @Post('check-in')
    async checkIn(@Body() data: { securityId: number; location?: string }) {
        return this.securityService.checkIn(data.securityId, data.location);
    }

    @Post('check-out')
    async checkOut(@Body() data: { securityId: number }) {
        return this.securityService.checkOut(data.securityId);
    }

    @Post('update-location')
    async updateLocation(@Body() data: {
        securityId: number;
        latitude: string;
        longitude: string;
    }) {
        return this.securityService.updateLocation(data.securityId, data.latitude, data.longitude);
    }

    @Get('emergencies/:securityId')
    async getAssignedEmergencies(@Param('securityId') securityId: string) {
        return this.securityService.getAssignedEmergencies(parseInt(securityId));
    }

    @Post('emergency/accept')
    async acceptEmergency(@Body() data: { securityId: number; emergencyId: number }) {
        return this.securityService.acceptEmergency(data.securityId, data.emergencyId);
    }

    @Post('emergency/arrive')
    async arriveAtEmergency(@Body() data: { securityId: number; emergencyId: number }) {
        return this.securityService.arriveAtEmergency(data.securityId, data.emergencyId);
    }

    @Post('emergency/complete')
    async completeEmergency(@Body() data: {
        securityId: number;
        emergencyId: number;
        actionTaken: string;
        notes?: string;
    }) {
        return this.securityService.completeEmergency(
            data.securityId,
            data.emergencyId,
            data.actionTaken,
            data.notes
        );
    }

    @Get('all')
    async getAllSecurities() {
        return this.securityService.getAllSecurities();
    }

    @Get(':id')
    async getSecurityById(@Param('id') id: string) {
        console.log('[DEBUG] getSecurityById called with id:', id);
        console.log('[DEBUG] id type:', typeof id);
        console.log('[DEBUG] id parsed:', parseInt(id));
        console.log('[DEBUG] isNaN:', isNaN(parseInt(id)));

        try {
            const securityId = parseInt(id);

            if (isNaN(securityId) || securityId <= 0) {
                console.log('[WARN] Invalid security ID provided:', id);
                return {
                    success: false,
                    message: 'ID security tidak valid',
                    providedId: id,
                    timestamp: new Date().toISOString()
                };
            }

            console.log('[DEBUG] Fetching security with ID:', securityId);
            const security = await this.securityService.getSecurityById(securityId);

            return {
                success: true,
                message: 'Security data retrieved successfully',
                data: security,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ERROR] getSecurityById error:', error);
            return {
                success: false,
                message: error.message || 'Gagal mendapatkan data security',
                error: error.toString(),
                timestamp: new Date().toISOString()
            };
        }
    }

    @Post('create')
    async createSecurity(@Body() data: {
        nama: string;
        nik: string;
        email: string;
        nomorTelepon: string;
        shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
    }) {
        console.log('=== CREATE SECURITY START ===');
        console.log('Request data:', JSON.stringify(data, null, 2));

        try {
            const result = await this.securityService.createSecurity(data);
            console.log('Create security result:', JSON.stringify(result, null, 2));
            console.log('=== CREATE SECURITY SUCCESS ===');
            return result;
        } catch (error) {
            console.error('Create security error:', error);
            console.log('=== CREATE SECURITY ERROR ===');
            return {
                success: false,
                message: error.message || 'Gagal membuat security',
                error: error.toString(),
                timestamp: new Date().toISOString()
            };
        }
    }

    @Put('update/:id')
    async updateSecurity(
        @Param('id') id: string,
        @Body() data: {
            nama?: string;
            email?: string;
            nomorTelepon?: string;
            shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
            status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
        }
    ) {
        return this.securityService.updateSecurity(parseInt(id), data);
    }

    @Delete('delete/:id')
    async deleteSecurity(@Param('id') id: string) {
        return this.securityService.deleteSecurity(parseInt(id));
    }

    @Get('logs')
    async getSecurityLogs(@Query('securityId') securityId?: string) {
        const id = securityId ? parseInt(securityId) : undefined;
        return this.securityService.getSecurityLogs(id);
    }

    @Get('active')
    async getActiveSecurities() {
        return this.securityService.getActiveSecurities();
    }

    @Post('device-token')
    async updateDeviceToken(@Body() data: { securityId: number; deviceToken: string }) {
        return this.securityService.updateDeviceToken(data.securityId, data.deviceToken);
    }

    @Post('patrol/start')
    async startPatrol(@Body() data: { securityId: number; location?: string }) {
        return this.securityService.startPatrol(data.securityId, data.location);
    }

    @Post('patrol/end')
    async endPatrol(@Body() data: { securityId: number }) {
        return this.securityService.endPatrol(data.securityId);
    }

    @Post('incident/report')
    async reportIncident(@Body() data: {
        securityId: number;
        details: string;
        location?: string;
        latitude?: string;
        longitude?: string;
    }) {
        return this.securityService.reportIncident(data.securityId, data);
    }

    @Get('responses/:securityId')
    async getEmergencyResponses(@Param('securityId') securityId: string) {
        return this.securityService.getEmergencyResponses(parseInt(securityId));
    }

    @Get('performance/:securityId')
    async getPerformanceMetrics(@Param('securityId') securityId: string) {
        return this.securityService.getPerformanceMetrics(parseInt(securityId));
    }

    @Get('check-security/:userId')
    async checkSecurity(@Param('userId') userId: string) {
        const security = await this.prisma.security_personnel.findFirst({
            where: { userId: parseInt(userId) }
        });

        return {
            isSecurity: !!security,
            securityId: security?.id
        };
    }
}