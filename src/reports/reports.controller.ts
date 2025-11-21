// src/reports/reports.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseInterceptors,
    UploadedFile,
    ParseIntPipe,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { FilesService } from '../files/files.service';

@Controller('reports')
export class ReportsController {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly filesService: FilesService,
    ) { }

    // CREATE - Buat laporan baru
    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async create(
        @Body() body: any,
        @UploadedFile() image?: Express.Multer.File,
    ) {
        try {
            let imageUrl: string | undefined;

            // Handle file upload jika ada
            if (image) {
                imageUrl = await this.filesService.saveFile(image);
            }

            // Validasi field required
            if (!body.title || !body.description || !body.category) {
                throw new BadRequestException('Judul, deskripsi, dan kategori harus diisi');
            }

            // Handle userId - pastikan number atau undefined
            let userId: number | undefined;
            if (body.userId && !isNaN(Number(body.userId))) {
                userId = Number(body.userId);
            }

            const reportData = {
                title: body.title,
                description: body.description,
                category: body.category,
                imageUrl: imageUrl,
                userId: userId,
            };

            return this.reportsService.create(reportData);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new BadRequestException(message || 'Gagal ...');
        }
    }

    // READ - Get semua laporan
    @Get()
    async findAll(
        @Query('category') category?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
    ) {
        if (category) {
            return this.reportsService.findByCategory(category);
        }

        if (status) {
            return this.reportsService.findByStatus(status);
        }

        if (search) {
            return this.reportsService.searchByTitle(search);
        }

        return this.reportsService.findAll();
    }

    // READ - Get laporan by ID
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return this.reportsService.findOne(id);
    }

    // UPDATE - Update laporan
    @Put(':id')
    @UseInterceptors(FileInterceptor('image'))
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UploadedFile() image?: Express.Multer.File,
    ) {
        try {
            let imageUrl: string | undefined;

            // Handle file upload jika ada
            if (image) {
                imageUrl = await this.filesService.saveFile(image);
            }

            const updateData: any = {};

            if (body.title) updateData.title = body.title;
            if (body.description) updateData.description = body.description;
            if (body.category) updateData.category = body.category;
            if (imageUrl) updateData.imageUrl = imageUrl;

            return this.reportsService.update(id, updateData);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new BadRequestException(message || 'Gagal ...');
        }
    }

    // DELETE - Hapus laporan
    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.reportsService.remove(id);
    }

    // UPDATE STATUS - Update status laporan
    @Patch(':id/status')
    async updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        if (!body.status) {
            throw new BadRequestException('Status harus diisi');
        }

        return this.reportsService.updateStatus(id, body.status);
    }

    // GET BY CATEGORY - Get laporan by kategori
    @Get('category/:category')
    async findByCategory(@Param('category') category: string) {
        return this.reportsService.findByCategory(category);
    }

    // GET BY STATUS - Get laporan by status
    @Get('status/:status')
    async findByStatus(@Param('status') status: string) {
        return this.reportsService.findByStatus(status);
    }

    // SEARCH - Cari laporan
    @Get('search/:keyword')
    async search(@Param('keyword') keyword: string) {
        return this.reportsService.searchByTitle(keyword);
    }
}