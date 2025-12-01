// src/cloudinary/cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export interface CloudinaryUploadResult {
  public_id: string;
  url: string;
  format: string;
  bytes: number;
  created_at: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) { }

  async uploadFile(file: Express.Multer.File, folder: string = 'kk_files'): Promise<CloudinaryUploadResult> {
    try {
      return new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const uploadOptions: any = {
          folder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        };

        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error: UploadApiErrorResponse, result: UploadApiResponse) => {
            if (error) {
              reject(new Error(`Cloudinary upload failed: ${error.message}`));
            } else {
              resolve({
                public_id: result.public_id,
                url: result.secure_url,
                format: result.format,
                bytes: result.bytes,
                created_at: result.created_at,
              });
            }
          }
        );

        if (file.buffer) {
          uploadStream.end(file.buffer);
        } else if (file.path) {
          // Untuk development - upload dari path lokal
          cloudinary.uploader.upload(file.path, uploadOptions)
            .then((result: UploadApiResponse) => resolve({
              public_id: result.public_id,
              url: result.secure_url,
              format: result.format,
              bytes: result.bytes,
              created_at: result.created_at,
            }))
            .catch(reject);
        } else {
          reject(new Error('No valid file data provided'));
        }
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  async deleteFile(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
  }

  async updateFile(oldPublicId: string, newFile: Express.Multer.File, folder: string = 'kk_files'): Promise<CloudinaryUploadResult> {
    try {
      // Delete old file if exists
      if (oldPublicId) {
        await this.deleteFile(oldPublicId);
      }

      // Upload new file
      return await this.uploadFile(newFile, folder);
    } catch (error) {
      console.error('Cloudinary update error:', error);
      throw new Error(`Failed to update file in Cloudinary: ${error.message}`);
    }
  }

  validateFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'Ukuran file maksimal 5MB'
      };
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Format file harus JPG, JPEG, PNG, atau PDF'
      };
    }

    return { isValid: true };
  }
}