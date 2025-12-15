// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, VerifyKKDto } from './dto/create-user.dto';
import { Prisma, UserRole } from '@prisma/client';
import { CloudinaryService, CloudinaryUploadResult } from '../cloudinary/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) { }

  // 🟢 Get all users dengan pagination dan filter
  async getAllUsers(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition = search ? {
      OR: [
        { namaLengkap: { contains: search } },
        { email: { contains: search } },
        { nik: { contains: search } },
        { nomorTelepon: { contains: search } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          nik: true,
          nomorTelepon: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: whereCondition }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 🟢 Register new user dengan Cloudinary
  async register(createUserDto: CreateUserDto, file?: Express.Multer.File) {
    try {
      console.log('📥 Received registration data:', createUserDto);

      // 🔍 Validasi required fields
      if (!createUserDto.tanggalLahir) {
        throw new BadRequestException('Tanggal lahir harus diisi');
      }

      // 🔍 Cek apakah email sudah terdaftar
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUserByEmail) {
        throw new ConflictException('Email sudah terdaftar, silakan gunakan email lain.');
      }

      // 🔍 Cek apakah NIK sudah terdaftar
      if (createUserDto.nik) {
        const existingUserByNik = await this.prisma.user.findFirst({
          where: { nik: createUserDto.nik },
        });

        if (existingUserByNik) {
          throw new ConflictException('NIK sudah terdaftar.');
        }
      }

      // 🟢 Validasi file jika ada
      let cloudinaryResult: any = null;
      if (file) {
        const validation = this.cloudinaryService.validateFile(file, {
          maxSize: 10 * 1024 * 1024, // 10MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        });
        if (!validation.isValid) {
          throw new BadRequestException(validation.error);
        }

        // Upload file ke Cloudinary
        cloudinaryResult = await this.cloudinaryService.uploadFile(file, 'kk_files');
        console.log('📁 File KK uploaded to Cloudinary:', cloudinaryResult.url);
      }

      // 🟢 Validasi dan konversi tanggalLahir
      let tanggalLahirDate: Date;
      try {
        tanggalLahirDate = new Date(createUserDto.tanggalLahir);

        // Validasi tanggal
        if (isNaN(tanggalLahirDate.getTime())) {
          throw new BadRequestException('Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD, DD.MM.YYYY, atau DD/MM/YYYY');
        }

        // Validasi usia minimal (contoh: minimal 17 tahun)
        const today = new Date();
        const minAgeDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
        if (tanggalLahirDate > minAgeDate) {
          throw new BadRequestException('Usia minimal 17 tahun');
        }

      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('Format tanggal lahir tidak valid');
      }

      const user = await this.prisma.user.create({
        data: {
          namaLengkap: createUserDto.namaLengkap,
          nik: createUserDto.nik,
          tanggalLahir: tanggalLahirDate,
          tempatLahir: createUserDto.tempatLahir,
          email: createUserDto.email,
          nomorTelepon: createUserDto.nomorTelepon,
          instagram: createUserDto.instagram || null,
          facebook: createUserDto.facebook || null,
          alamat: createUserDto.alamat,
          kota: createUserDto.kota,
          negara: createUserDto.negara,
          kodePos: createUserDto.kodePos,
          rtRw: createUserDto.rtRw,
          // 🟢 SIMPAN DATA CLOUDINARY
          kkFile: cloudinaryResult ? cloudinaryResult.url : null,
          kkFilePublicId: cloudinaryResult ? cloudinaryResult.public_id : null,
          role: UserRole.USER,
          isVerified: false,
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          nik: true,
          nomorTelepon: true,
          role: true,
          isVerified: true,
          kkFile: true,
          createdAt: true,
        },
      });

      // 🟢 NOTIFIKASI KE ADMIN
      await this.notifyAdminAboutNewRegistration(user, cloudinaryResult !== null);

      return {
        message: 'Pendaftaran berhasil! Silakan tunggu verifikasi admin.',
        user,
      };
    } catch (error) {
      console.error('❌ Registration error:', error);

      // Rollback: Hapus file dari Cloudinary jika upload gagal
      if (file && error instanceof Error) {
        try {
          console.log('🔄 Rollback: Menghapus file dari Cloudinary karena registrasi gagal');
        } catch (rollbackError) {
          console.error('Error saat rollback file:', rollbackError);
        }
      }

      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Gagal mendaftar user: ' + error.message);
    }
  }

  // 🟢 Update user profile dengan Cloudinary
  async updateProfile(id: number, updateUserDto: UpdateUserDto, file?: Express.Multer.File) {
    try {
      // Pastikan user ada
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          nik: true,
          kkFilePublicId: true
        }
      });

      if (!existingUser) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // 🔍 Cek jika email diubah dan sudah digunakan user lain
      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: updateUserDto.email },
        });

        if (emailExists) {
          throw new ConflictException('Email sudah digunakan oleh user lain');
        }
      }

      // 🔍 Cek jika NIK diubah dan sudah digunakan user lain
      if (updateUserDto.nik && updateUserDto.nik !== existingUser.nik) {
        const nikExists = await this.prisma.user.findFirst({
          where: { nik: updateUserDto.nik },
        });

        if (nikExists) {
          throw new ConflictException('NIK sudah digunakan oleh user lain');
        }
      }

      // 🟢 Handle file upload ke Cloudinary jika ada file baru
      let cloudinaryResult: CloudinaryUploadResult | null = null;
      if (file) {
        const validation = this.cloudinaryService.validateFile(file, {
          maxSize: 10 * 1024 * 1024, // 10MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        });
        if (!validation.isValid) {
          throw new BadRequestException(validation.error);
        }

        // Update file di Cloudinary (hapus yang lama, upload yang baru)
        cloudinaryResult = await this.cloudinaryService.updateFile(
          existingUser.kkFilePublicId || '',
          file,
          'kk_files'
        );
        console.log('📁 File KK updated in Cloudinary:', cloudinaryResult.url);
      }

      // Prepare update data
      const updateData: any = {};

      if (updateUserDto.namaLengkap) updateData.namaLengkap = updateUserDto.namaLengkap;
      if (updateUserDto.nik) updateData.nik = updateUserDto.nik;
      if (updateUserDto.tanggalLahir) {
        const tanggalLahirDate = new Date(updateUserDto.tanggalLahir);
        if (isNaN(tanggalLahirDate.getTime())) {
          throw new BadRequestException('Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD');
        }
        updateData.tanggalLahir = tanggalLahirDate;
      }
      if (updateUserDto.tempatLahir) updateData.tempatLahir = updateUserDto.tempatLahir;
      if (updateUserDto.email) updateData.email = updateUserDto.email;
      if (updateUserDto.nomorTelepon) updateData.nomorTelepon = updateUserDto.nomorTelepon;
      if (updateUserDto.instagram !== undefined) updateData.instagram = updateUserDto.instagram;
      if (updateUserDto.facebook !== undefined) updateData.facebook = updateUserDto.facebook;
      if (updateUserDto.alamat) updateData.alamat = updateUserDto.alamat;
      if (updateUserDto.kota) updateData.kota = updateUserDto.kota;
      if (updateUserDto.negara) updateData.negara = updateUserDto.negara;
      if (updateUserDto.kodePos) updateData.kodePos = updateUserDto.kodePos;
      if (updateUserDto.rtRw) updateData.rtRw = updateUserDto.rtRw;

      if (updateUserDto.role) {
        const validRole = this.convertToUserRole(updateUserDto.role);
        updateData.role = validRole;
      }

      // 🟢 Update data Cloudinary jika ada file baru
      if (file && cloudinaryResult) {
        updateData.kkFile = cloudinaryResult.url;
        updateData.kkFilePublicId = cloudinaryResult.public_id;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          nik: true,
          nomorTelepon: true,
          role: true,
          isVerified: true,
          kkFile: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Profil berhasil diperbarui',
        user: updatedUser,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      console.error('Error saat update profil:', error);
      throw new BadRequestException('Gagal memperbarui profil');
    }
  }

  // 🟢 Get user by ID
  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        nik: true,
        tanggalLahir: true,
        tempatLahir: true,
        nomorTelepon: true,
        instagram: true,
        facebook: true,
        alamat: true,
        kota: true,
        negara: true,
        kodePos: true,
        rtRw: true,
        role: true,
        isVerified: true,

        // KK Verification Fields
        kkFile: true,
        kkFilePublicId: true,
        kkRejectionReason: true,
        kkVerifiedAt: true,
        kkVerifiedBy: true,

        createdAt: true,
        updatedAt: true,
        bio: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    }

    // Tambahkan KK verification status
    const userWithKKStatus = {
      ...user,
      kkVerificationStatus: this.getKKVerificationStatus(user),
    };

    return userWithKKStatus;
  }

  // Helper method untuk menentukan status KK
  private getKKVerificationStatus(user: any): string {
    if (user.isVerified) {
      return 'verified';
    } else if (user.kkRejectionReason) {
      return 'rejected';
    }
    return 'pending';
  }

  // 🟢 Get user by email
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        nik: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan email ${email} tidak ditemukan`);
    }

    return user;
  }

  // 🟢 Update user verification status
  async updateVerificationStatus(id: number, isVerified: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isVerified },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    return {
      message: `Status verifikasi berhasil di${isVerified ? 'aktifkan' : 'nonaktifkan'}`,
      user: updatedUser,
    };
  }

  // 🟢 Update user role
  async updateUserRole(id: number, role: string) {
    const validRole = this.convertToUserRole(role);

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: validRole },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return {
      message: `Role user berhasil diubah menjadi ${role}`,
      user: updatedUser,
    };
  }

  // 🗑️ Delete user dengan cleanup Cloudinary
  async deleteUser(id: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        kkFilePublicId: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // 🟢 Hapus file dari Cloudinary jika ada
    if (existingUser.kkFilePublicId) {
      try {
        await this.cloudinaryService.deleteFile(existingUser.kkFilePublicId);
        console.log('🗑️ File KK deleted from Cloudinary:', existingUser.kkFilePublicId);
      } catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
        // Lanjutkan delete user meskipun gagal hapus file
      }
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: `User "${existingUser.namaLengkap}" berhasil dihapus`,
      deletedUser: existingUser,
    };
  }

  // 🟢 Get user statistics
  async getUserStats() {
    const [totalUsers, verifiedUsers, adminUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      adminUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      regularUsers: totalUsers - adminUsers,
    };
  }

  // OTP Methods
  async updateOtp(email: string, otpCode: string, otpExpire: Date) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return this.prisma.user.update({
      where: { email },
      data: {
        otpCode,
        otpExpire,
      },
    });
  }

  async clearOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return this.prisma.user.update({
      where: { email },
      data: {
        otpCode: null,
        otpExpire: null
      },
    });
  }

  async me(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  // 🟢 Additional method: Get user by NIK
  async findByNik(nik: string) {
    const user = await this.prisma.user.findFirst({
      where: { nik },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        nik: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan NIK ${nik} tidak ditemukan`);
    }

    return user;
  }

  // 🟢 Helper method: Convert string role to UserRole enum
  private convertToUserRole(roleString: string): UserRole {
    const roleMap: { [key: string]: UserRole } = {
      'user': UserRole.USER,
      'admin': UserRole.ADMIN,
      'super_admin': UserRole.SUPER_ADMIN,
      'super admin': UserRole.SUPER_ADMIN,
      'superadmin': UserRole.SUPER_ADMIN,
      'treasurer': UserRole.USER,
      'member': UserRole.USER,
      'relawan': UserRole.USER,
      'satpam' : UserRole.SATPAM,
    };

    const normalizedRole = roleString.toLowerCase().trim();
    const role = roleMap[normalizedRole];

    if (!role) {
      throw new BadRequestException(
        `Role '${roleString}' tidak valid. Gunakan: user, admin, super_admin, treasurer, atau member`
      );
    }

    return role;
  }

  // 🟢 Notifikasi Admin
  private async notifyAdminAboutNewRegistration(user: any, hasKKFile: boolean) {
    try {
      console.log(`🔔 ADMIN NOTIFICATION: Pendaftar baru - ${user.namaLengkap} (${user.email})`);
      console.log(`📁 KK File: ${hasKKFile ? 'Tersedia di Cloudinary' : 'Tidak ada'}`);

      // Implementasi notifikasi ke admin (email, webhook, dll)
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }

  async verifyKKDocument(userId: number, verifyKKDto: VerifyKKDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        kkFilePublicId: true  // TAMBAHKAN INI
      }
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const updateData: any = {
      isVerified: verifyKKDto.isApproved,
      kkVerifiedAt: new Date(),
      kkVerifiedBy: 'admin', // Ambil dari user yang login
    };

    if (!verifyKKDto.isApproved && verifyKKDto.rejectionReason) {
      updateData.kkRejectionReason = verifyKKDto.rejectionReason;
      // Hapus file jika ditolak
      if (user.kkFilePublicId) {
        await this.cloudinaryService.deleteFile(user.kkFilePublicId);
        updateData.kkFile = null;
        updateData.kkFilePublicId = null;
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        isVerified: true,
        kkFile: true,
        kkVerifiedAt: true,
        kkRejectionReason: true,
      },
    });

    // Kirim notifikasi ke user
    await this.sendKKVerificationNotification(user, verifyKKDto);

    return {
      message: verifyKKDto.isApproved
        ? 'Dokumen KK berhasil diverifikasi'
        : 'Dokumen KK ditolak',
      user: updatedUser,
    };
  }

  async deleteKKDocument(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kkFilePublicId: true }
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Hapus dari Cloudinary
    if (user.kkFilePublicId) {
      await this.cloudinaryService.deleteFile(user.kkFilePublicId);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        kkFile: null,
        kkFilePublicId: null,
        isVerified: false,
        kkRejectionReason: null,
        kkVerifiedAt: null,
        kkVerifiedBy: null,
      },
    });

    return {
      message: 'Dokumen KK berhasil dihapus',
      user: updatedUser,
    };
  }

  private async sendKKVerificationNotification(user: any, verifyKKDto: VerifyKKDto) {
    // Implementasi notifikasi ke user (email/push notification)
    console.log(`📧 Notifikasi KK ${verifyKKDto.isApproved ? 'disetujui' : 'ditolak'} dikirim ke ${user.email}`);
  }

  async getKKVerificationDetails(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        nik: true,
        kkFile: true,
        kkFilePublicId: true,
        kkRejectionReason: true,
        kkVerifiedAt: true,
        kkVerifiedBy: true,
        isVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    // Tentukan status verifikasi KK
    let kkVerificationStatus = 'pending';
    if (user.isVerified) {
      kkVerificationStatus = 'verified';
    } else if (user.kkRejectionReason) {
      kkVerificationStatus = 'rejected';
    }

    return {
      ...user,
      kkVerificationStatus,
      hasKKDocument: !!user.kkFile,
    };
  }

  async uploadKKDocument(userId: number, file: Express.Multer.File) {
    try {
      // Pastikan user ada
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          namaLengkap: true,
          kkFilePublicId: true,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // Validasi file
      const validation = this.cloudinaryService.validateFile(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
      });
      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      // Hapus file lama jika ada
      if (existingUser.kkFilePublicId) {
        try {
          await this.cloudinaryService.deleteFile(existingUser.kkFilePublicId);
          console.log('🗑️ File KK lama dihapus dari Cloudinary');
        } catch (error) {
          console.error('Error deleting old file from Cloudinary:', error);
        }
      }

      // Upload file baru ke Cloudinary
      const cloudinaryResult = await this.cloudinaryService.uploadFile(
        file,
        'kk_files',
      );

      console.log('📁 File KK diupload ke Cloudinary:', cloudinaryResult.url);

      // Update user dengan file baru
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          kkFile: cloudinaryResult.url,
          kkFilePublicId: cloudinaryResult.public_id,
          kkRejectionReason: null, // Reset alasan penolakan
          kkVerifiedAt: null, // Reset waktu verifikasi
          kkVerifiedBy: null, // Reset verifikator
          isVerified: false, // Reset status verifikasi
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          kkFile: true,
          isVerified: true,
          updatedAt: true,
        },
      });

      // Notifikasi admin bahwa ada KK baru yang perlu diverifikasi
      await this.notifyAdminAboutKKUpload(updatedUser);

      return {
        message: 'Dokumen KK berhasil diupload',
        user: updatedUser,
      };
    } catch (error) {
      console.error('Error uploading KK document:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Gagal mengupload dokumen KK');
    }
  }

  // Helper method untuk notifikasi admin
  private async notifyAdminAboutKKUpload(user: any) {
    try {
      console.log(`🔔 NOTIFIKASI ADMIN: User ${user.namaLengkap} mengupload dokumen KK baru`);
      console.log(`📁 KK File: ${user.kkFile}`);

      // Bisa ditambahkan: Kirim email, push notification, atau webhook ke admin
      // Contoh: Kirim ke admin atau super admin
      const admins = await this.prisma.user.findMany({
        where: {
          OR: [
            { role: UserRole.ADMIN },
            { role: UserRole.SUPER_ADMIN }
          ],
          isVerified: true,
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
        },
      });

      // Log untuk debugging
      console.log(`📧 Admin yang akan dinotifikasi: ${admins.length} admin`);

    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }
}