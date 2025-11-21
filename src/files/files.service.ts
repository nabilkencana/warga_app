// src/files/files.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class FilesService {
    private readonly uploadPath = join(process.cwd(), 'uploads');

    constructor() {
        if (!existsSync(this.uploadPath)) {
            mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    async saveFile(file: Express.Multer.File): Promise<string> {
        if (!file) {
            throw new BadRequestException('File tidak ditemukan');
        }
        // Validasi ukuran file (optional)
        if (file.size && file.size > 10 * 1024 * 1024) {
            throw new BadRequestException('Ukuran file maksimal 10MB');
        }

        try {
            let extension = extname(file.originalname || '').replace('.', '').toLowerCase();
            if (!extension) extension = 'bin';

            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 10);
            const fileName = `upload_${timestamp}_${randomString}.${extension}`;
            const destPath = join(this.uploadPath, fileName);

            if (file.buffer && file.buffer.length > 0) {
                await fs.writeFile(destPath, file.buffer);
            } else if ((file as any).path) {
                const data = await fs.readFile((file as any).path);
                await fs.writeFile(destPath, data);
                try { await fs.unlink((file as any).path); } catch { }
            } else {
                throw new BadRequestException('File tidak dapat diproses');
            }

            return `/uploads/${fileName}`;
        } catch (err) {
            throw new InternalServerErrorException('Gagal menyimpan file');
        }
    }
}
