import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) { }

  // 🟢 Get user profile - TAMBAHKAN ERROR HANDLING
  async getUserProfile(userId: number) {
    console.log(`🔍 Getting profile for userId: ${userId}`);

    try {
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: Number(userId)
        },
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
          bio: true,
          fotoProfil: true,

          // KK Verification Fields
          kkFile: true,
          kkFilePublicId: true,
          kkUploadedAt: true,
          kkRejectionReason: true,
          kkVerifiedAt: true,
          verifiedByAdmin: {
            select: {
              namaLengkap: true,
            },
          },


          createdAt: true,
          updatedAt: true,
        },
      });
      const significantChanges: string[] = [];

      if (UpdateProfileDto.namaLengkap && UpdateProfileDto.namaLengkap) {
        significantChanges.push('nama lengkap');
      }

      if (UpdateProfileDto.email && UpdateProfileDto.email) {
        significantChanges.push('email');
      }

      if (UpdateProfileDto.nomorTelepon && UpdateProfileDto.nomorTelepon) {
        significantChanges.push('nomor telepon');
      }

      if (UpdateProfileDto.alamat && UpdateProfileDto.alamat) {
        significantChanges.push('alamat');
      }

      if (!user) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      // Pastikan semua field yang diperlukan ada
      const safeUser = {
        ...user,
        namaLengkap: user.namaLengkap || '',
        email: user.email || '',
        nik: user.nik || '',
        nomorTelepon: user.nomorTelepon || '',
        alamat: user.alamat || '',
        kota: user.kota || '',
        kodePos: user.kodePos || '',
        rtRw: user.rtRw || '',
        bio: user.bio || '',
      };

      // Hitung usia dari tanggal lahir
      const usia = user.tanggalLahir
        ? this.calculateAge(user.tanggalLahir)
        : null;

      // Tentukan status verifikasi KK
      const kkVerificationStatus = this.determineKKVerificationStatus(safeUser);

      return {
        ...safeUser,
        usia,
        kkVerificationStatus,
        hasKKDocument: !!user.kkFile,
        kkVerifiedBy: user.verifiedByAdmin?.namaLengkap ?? null,
      };
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      throw new BadRequestException('Gagal mengambil data profil: ' + error.message);
    }
  }

  // 🟢 Get KK verification status (public method)
  async getKKVerificationStatus(userId: number) {
    console.log(`🔍 Getting KK status for userId: ${userId}`);

    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: Number(userId)
      },
      include: {
        verifiedByAdmin: {
          select: {
            id: true,
            namaLengkap: true,
            kkFile: true,
            isVerified: true,
            kkRejectionReason: true,
            kkVerifiedAt: true,
            kkVerifiedBy: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    const status = this.determineKKVerificationStatus(user);

    return {
      kkVerificationStatus: this.determineKKVerificationStatus(user),
      kkVerifiedAt: user.kkVerifiedAt,
      verifiedBy: user.verifiedByAdmin?.namaLengkap ?? null,
      kkUploadedAt: user.kkUploadedAt,
      kkRejectionReason: user.kkRejectionReason,
    };

  }

  // 🟢 Update user profile
  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto, file?: Express.Multer.File) {
    console.log(`🔧 Updating profile for userId: ${userId}`);

    try {
      // Validasi userId
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      const numericUserId = Number(userId);

      // Cek apakah user ada
      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: numericUserId
        },
        select: {
          id: true,
          email: true,
          nik: true,
          nomorTelepon: true,
          fotoProfil: true,
        },
      });

      if (!existingUser) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      // 🔍 Validasi email unik jika diubah
      if (updateProfileDto.email && updateProfileDto.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: updateProfileDto.email },
        });

        if (emailExists) {
          throw new ConflictException('Email sudah digunakan oleh user lain');
        }
      }

      // 🔍 Validasi NIK unik jika diubah
      if (updateProfileDto.nik && updateProfileDto.nik !== existingUser.nik) {
        const nikExists = await this.prisma.user.findFirst({
          where: { nik: updateProfileDto.nik },
        });

        if (nikExists) {
          throw new ConflictException('NIK sudah digunakan oleh user lain');
        }
      }

      // 🔍 Validasi nomor telepon unik jika diubah
      if (updateProfileDto.nomorTelepon && updateProfileDto.nomorTelepon !== existingUser.nomorTelepon) {
        const phoneExists = await this.prisma.user.findFirst({
          where: {
            nomorTelepon: updateProfileDto.nomorTelepon,
            NOT: { id: numericUserId }
          },
        });

        if (phoneExists) {
          throw new ConflictException('Nomor telepon sudah digunakan oleh user lain');
        }
      }

      // 🟢 Handle file upload ke Cloudinary jika ada file baru
      let cloudinaryResult: any = null;
      if (file) {
        console.log('📁 Processing profile picture upload...');

        const validation = this.cloudinaryService.validateFile(file, {
          maxSize: 5 * 1024 * 1024, // 5MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        });

        if (!validation.isValid) {
          throw new BadRequestException(validation.error);
        }

        // Hapus foto lama jika ada
        if (existingUser.fotoProfil) {
          try {
            // Ekstrak public_id dari URL Cloudinary
            const urlParts = existingUser.fotoProfil.split('/');
            const filename = urlParts[urlParts.length - 1];
            const publicId = filename.split('.')[0]; // Hapus ekstensi

            if (publicId && !publicId.includes('http')) {
              await this.cloudinaryService.deleteFile(`profile_pictures/${publicId}`);
              console.log('🗑️ Foto profil lama dihapus dari Cloudinary');
            }
          } catch (error) {
            console.warn('⚠️ Tidak dapat menghapus foto lama:', error.message);
          }
        }

        // Upload file ke Cloudinary
        cloudinaryResult = await this.cloudinaryService.uploadFile(file, 'profile_pictures');
        console.log('✅ Foto profil diupload ke Cloudinary:', cloudinaryResult.url);
      }

      // Prepare update data
      const updateData: any = {};

      if (updateProfileDto.namaLengkap) updateData.namaLengkap = updateProfileDto.namaLengkap;
      if (updateProfileDto.nik) updateData.nik = updateProfileDto.nik;
      if (updateProfileDto.tanggalLahir) {
        const tanggalLahirDate = new Date(updateProfileDto.tanggalLahir);
        if (isNaN(tanggalLahirDate.getTime())) {
          throw new BadRequestException('Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD');
        }
        updateData.tanggalLahir = tanggalLahirDate;
      }
      if (updateProfileDto.tempatLahir) updateData.tempatLahir = updateProfileDto.tempatLahir;
      if (updateProfileDto.email) updateData.email = updateProfileDto.email;
      if (updateProfileDto.nomorTelepon) updateData.nomorTelepon = updateProfileDto.nomorTelepon;
      if (updateProfileDto.instagram !== undefined) updateData.instagram = updateProfileDto.instagram;
      if (updateProfileDto.facebook !== undefined) updateData.facebook = updateProfileDto.facebook;
      if (updateProfileDto.alamat) updateData.alamat = updateProfileDto.alamat;
      if (updateProfileDto.kota) updateData.kota = updateProfileDto.kota;
      if (updateProfileDto.negara) updateData.negara = updateProfileDto.negara;
      if (updateProfileDto.kodePos) updateData.kodePos = updateProfileDto.kodePos;
      if (updateProfileDto.rtRw) updateData.rtRw = updateProfileDto.rtRw;
      if (updateProfileDto.bio !== undefined) updateData.bio = updateProfileDto.bio;

      // 🟢 Update foto profil jika ada
      if (file && cloudinaryResult) {
        updateData.fotoProfil = cloudinaryResult.url;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: numericUserId },
        data: updateData,
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          nik: true,
          nomorTelepon: true,
          tanggalLahir: true,
          tempatLahir: true,
          instagram: true,
          facebook: true,
          alamat: true,
          kota: true,
          negara: true,
          kodePos: true,
          rtRw: true,
          bio: true,
          fotoProfil: true,
          role: true,
          isVerified: true,
          updatedAt: true,
        },
      });

      console.log('✅ Profile updated successfully for user:', updatedUser.id);

      return {
        message: 'Profil berhasil diperbarui',
        user: updatedUser,
      };
    } catch (error) {
      console.error('❌ Error saat update profil:', error);

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Gagal memperbarui profil: ' + error.message);
    }
  }

  // 🟢 Upload foto profil
  async uploadProfilePicture(userId: number, file: Express.Multer.File) {
    console.log(`📸 Uploading profile picture for userId: ${userId}`);

    try {
      // Validasi userId
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      const numericUserId = Number(userId);

      const user = await this.prisma.user.findUnique({
        where: {
          id: numericUserId
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          fotoProfil: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      // Validasi keberadaan file
      if (!file) {
        throw new BadRequestException('Tidak ada file yang diupload');
      }

      // Validasi ukuran file (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException(`Ukuran file maksimal ${maxSize / (1024 * 1024)}MB`);
      }

      // Validasi tipe file - PERBAIKI INI
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];

      // Juga terima MIME type dengan capital letters
      const fileMimeType = file.mimetype.toLowerCase();
      const validMimeTypes = allowedMimeTypes.map(m => m.toLowerCase());

      if (!validMimeTypes.includes(fileMimeType)) {
        throw new BadRequestException(
          `Format file tidak didukung. Gunakan: ${allowedMimeTypes.join(', ')}`
        );
      }

      // Validasi ekstensi file
      const allowedExtensions = ['.jpg', '.jpeg', '.png'];
      const originalName = file.originalname || '';
      const fileExtension = originalName.toLowerCase().slice(
        originalName.lastIndexOf('.')
      );

      if (fileExtension && !allowedExtensions.includes(fileExtension)) {
        throw new BadRequestException(
          `Ekstensi file tidak didukung. Gunakan: ${allowedExtensions.join(', ')}`
        );
      }

      console.log(`✅ File validated: ${originalName}, MIME: ${file.mimetype}, Size: ${file.size} bytes`);

      // Hapus foto lama jika ada
      if (user.fotoProfil) {
        try {
          // Ekstrak public_id dari URL Cloudinary
          const urlParts = user.fotoProfil.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0]; // Hapus ekstensi

          if (publicId && !publicId.includes('http')) {
            await this.cloudinaryService.deleteFile(`profile_pictures/${publicId}`);
            console.log('🗑️ Foto profil lama dihapus dari Cloudinary');
          }
        } catch (error) {
          console.warn('⚠️ Tidak dapat menghapus foto lama:', error.message);
        }
      }

      // Upload foto baru ke Cloudinary
      const cloudinaryResult = await this.cloudinaryService.uploadFile(
        file,
        'profile_pictures',
      );

      console.log('✅ Foto profil diupload ke Cloudinary:', cloudinaryResult.url);

      // Update user dengan foto baru
      const updatedUser = await this.prisma.user.update({
        where: { id: numericUserId },
        data: {
          fotoProfil: cloudinaryResult.url,
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          fotoProfil: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Foto profil berhasil diupload',
        user: updatedUser,
      };
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Gagal mengupload foto profil: ' + error.message);
    }
  }

  // 🟢 Delete foto profil
  async deleteProfilePicture(userId: number) {
    console.log(`🗑️ Deleting profile picture for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
      select: {
        id: true,
        namaLengkap: true,
        fotoProfil: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    if (!user.fotoProfil) {
      throw new BadRequestException('Tidak ada foto profil yang bisa dihapus');
    }

    // Hapus dari Cloudinary
    try {
      // Ekstrak public_id dari URL Cloudinary
      const urlParts = user.fotoProfil.split('/');
      const filename = urlParts[urlParts.length - 1];
      const publicId = filename.split('.')[0]; // Hapus ekstensi

      if (publicId && !publicId.includes('http')) {
        await this.cloudinaryService.deleteFile(`profile_pictures/${publicId}`);
        console.log('✅ Foto profil dihapus dari Cloudinary');
      }
    } catch (error) {
      console.warn('⚠️ Gagal menghapus file dari Cloudinary:', error.message);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: numericUserId },
      data: {
        fotoProfil: null,
      },
    });

    return {
      message: 'Foto profil berhasil dihapus',
      user: {
        id: updatedUser.id,
        namaLengkap: updatedUser.namaLengkap,
      },
    };
  }

  // 🟢 Update bio
  async updateBio(userId: number, bio: string) {
    console.log(`📝 Updating bio for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: numericUserId },
      data: { bio },
      select: {
        id: true,
        namaLengkap: true,
        bio: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Bio berhasil diperbarui',
      user: updatedUser,
    };
  }

  // 🟢 Change email request (membutuhkan OTP)
  async requestEmailChange(userId: number, newEmail: string) {
    console.log(`📧 Requesting email change for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    // Cek apakah email baru sudah digunakan
    const emailExists = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (emailExists) {
      throw new ConflictException('Email sudah digunakan oleh user lain');
    }

    // Generate OTP untuk verifikasi email baru
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Simpan OTP dan email baru yang diminta
    await this.prisma.user.update({
      where: { id: numericUserId },
      data: {
        newEmailRequested: newEmail,
        otpCode,
        otpExpire,
      },
    });

    // Kirim OTP ke email baru
    // Implementasi: this.emailService.sendOtpToNewEmail(newEmail, otpCode);

    return {
      message: 'OTP telah dikirim ke email baru untuk verifikasi',
      otpExpiresIn: 10, // menit
    };
  }

  // 🟢 Verify email change with OTP
  async verifyEmailChange(userId: number, otpCode: string) {
    console.log(`✅ Verifying email change for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
      select: {
        id: true,
        email: true,
        newEmailRequested: true,
        otpCode: true,
        otpExpire: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    if (!user.newEmailRequested) {
      throw new BadRequestException('Tidak ada permintaan perubahan email');
    }

    // Validasi OTP
    if (!user.otpCode || user.otpCode !== otpCode) {
      throw new BadRequestException('Kode OTP tidak valid');
    }

    if (!user.otpExpire || user.otpExpire < new Date()) {
      throw new BadRequestException('Kode OTP telah kedaluwarsa');
    }

    // Update email
    const updatedUser = await this.prisma.user.update({
      where: { id: numericUserId },
      data: {
        email: user.newEmailRequested,
        newEmailRequested: null,
        otpCode: null,
        otpExpire: null,
      },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Email berhasil diubah',
      user: updatedUser,
    };
  }

  // 🟢 Update phone number (mungkin butuh OTP juga)
  async updatePhoneNumber(userId: number, phoneNumber: string) {
    console.log(`📱 Updating phone number for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    // Cek apakah nomor telepon sudah digunakan
    const phoneExists = await this.prisma.user.findFirst({
      where: {
        nomorTelepon: phoneNumber,
        id: { not: numericUserId }
      },
    });

    if (phoneExists) {
      throw new ConflictException('Nomor telepon sudah digunakan oleh user lain');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: numericUserId },
      data: { nomorTelepon: phoneNumber },
      select: {
        id: true,
        namaLengkap: true,
        nomorTelepon: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Nomor telepon berhasil diperbarui',
      user: updatedUser,
    };
  }

  // 🟢 Get profile activity (riwayat aktivitas user)
  async getProfileActivity(userId: number, page: number = 1, limit: number = 10) {
    console.log(`📊 Getting profile activity for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);
    const skip = (page - 1) * limit;

    const activities = await this.prisma.activityLog.findMany({
      where: { userId: numericUserId },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        action: true,
        description: true,
        ipAddress: true,
        userAgent: true,
        timestamp: true,
      },
    });

    const total = await this.prisma.activityLog.count({
      where: { userId: numericUserId }
    });

    // Log aktivitas (opsional)
    await this.logActivity(numericUserId, 'GET_PROFILE_ACTIVITY', 'Melihat riwayat aktivitas profil');

    return {
      data: activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 🟢 Get user dashboard statistics
  async getUserDashboardStats(userId: number) {
    console.log(`📈 Getting dashboard stats for userId: ${userId}`);

    // Validasi userId
    if (!userId || isNaN(userId)) {
      throw new BadRequestException('User ID tidak valid');
    }

    const numericUserId = Number(userId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: numericUserId
      },
      select: {
        id: true,
        namaLengkap: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
    }

    // Hitung berbagai statistik
    const [
      totalReports,
      verifiedStatus,
    ] = await Promise.all([
      // Jumlah laporan yang dibuat user
      this.prisma.report.count({ where: { userId: numericUserId } }),

      // Status verifikasi
      this.prisma.user.findUnique({
        where: { id: numericUserId },
        select: {
          isVerified: true,
          kkVerifiedAt: true,
        },
      }),
    ]);

    return {
      user: {
        id: user.id,
        namaLengkap: user.namaLengkap,
        role: user.role,
        isVerified: user.isVerified,
        joinDate: user.createdAt,
      },
      stats: {
        totalReports,
        totalActivities: 0,
        totalDonations: 0,
        verifiedStatus: verifiedStatus?.isVerified ? 'verified' : 'not_verified',
        verificationDate: verifiedStatus?.kkVerifiedAt,
      },
    };
  }

  // TAMBAHKAN DI BAGIAN SERVICE

  // 🟢 Upload KK Document
  async uploadKKDocument(userId: number, file: Express.Multer.File) {
    console.log(`📄 Uploading KK document for userId: ${userId}`);

    try {
      // Validasi userId
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      const numericUserId = Number(userId);

      // Cek apakah user ada
      const user = await this.prisma.user.findUnique({
        where: { id: numericUserId },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          kkFile: true,
          kkFilePublicId: true,
          kkUploadedAt: true, // ✅ TAMBAHKAN INI
          kkRejectionReason: true,
          isVerified: true,
          kkVerifiedAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      // Validasi file
      if (!file) {
        throw new BadRequestException('Tidak ada file yang diupload');
      }

      // Validasi ukuran file (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException(`Ukuran file maksimal ${maxSize / (1024 * 1024)}MB`);
      }

      // Validasi tipe file
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const fileMimeType = file.mimetype.toLowerCase();
      const validMimeTypes = allowedMimeTypes.map(m => m.toLowerCase());

      if (!validMimeTypes.includes(fileMimeType)) {
        throw new BadRequestException(
          `Format file tidak didukung. Gunakan: ${allowedMimeTypes.join(', ')}`
        );
      }

      console.log(`✅ KK File validated: ${file.originalname}, MIME: ${file.mimetype}, Size: ${file.size} bytes`);

      // Hapus file KK lama jika ada
      if (user.kkFile || user.kkFilePublicId) {
        try {
          if (user.kkFilePublicId) {
            await this.cloudinaryService.deleteFile(user.kkFilePublicId);
            console.log('🗑️ KK file lama dihapus dari Cloudinary');
          }
        } catch (error) {
          console.warn('⚠️ Tidak dapat menghapus KK file lama:', error.message);
        }
      }

      // Upload KK file ke Cloudinary
      const cloudinaryResult = await this.cloudinaryService.uploadFile(
        file,
        'kk_files'
      );

      console.log('✅ KK file diupload ke Cloudinary:', cloudinaryResult.url);

      // Update user dengan KK file baru
      const updatedUser = await this.prisma.user.update({
        where: { id: numericUserId },
        data: {
          kkFile: cloudinaryResult.url,
          kkFilePublicId: cloudinaryResult.public_id,
          kkUploadedAt: new Date(), // Untuk format date time data
          kkRejectionReason: null, // Reset rejection reason jika ada
          isVerified: false, // Reset status verifikasi
          kkVerifiedAt: null,
          kkVerifiedBy: null,
        },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          kkFile: true,
          kkFilePublicId: true,
          kkRejectionReason: true,
          isVerified: true,
          kkVerifiedAt: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Dokumen KK berhasil diupload',
        user: updatedUser,
        kkVerificationStatus: this.determineKKVerificationStatus(updatedUser),
      };
    } catch (error) {
      console.error('❌ Error uploading KK document:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Gagal mengupload dokumen KK: ' + error.message);
    }
  }

  // 🟢 Delete KK Document
  async deleteKKDocument(userId: number) {
    console.log(`🗑️ Deleting KK document for userId: ${userId}`);

    try {
      // Validasi userId
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      const numericUserId = Number(userId);

      const user = await this.prisma.user.findUnique({
        where: { id: numericUserId },
        select: {
          id: true,
          namaLengkap: true,
          kkFile: true,
          kkFilePublicId: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      if (!user.kkFile) {
        throw new BadRequestException('Tidak ada dokumen KK yang bisa dihapus');
      }

      // Hapus dari Cloudinary
      if (user.kkFilePublicId) {
        try {
          await this.cloudinaryService.deleteFile(user.kkFilePublicId);
          console.log('✅ KK file dihapus dari Cloudinary');
        } catch (error) {
          console.warn('⚠️ Gagal menghapus KK file dari Cloudinary:', error.message);
        }
      }

      // Update database
      const updatedUser = await this.prisma.user.update({
        where: { id: numericUserId },
        data: {
          kkFile: null,
          kkFilePublicId: null,
          kkRejectionReason: null,
          isVerified: false,
          kkVerifiedAt: null,
          kkVerifiedBy: null,
        },
        select: {
          id: true,
          namaLengkap: true,
          kkFile: true,
          isVerified: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Dokumen KK berhasil dihapus',
        user: updatedUser,
        kkVerificationStatus: this.determineKKVerificationStatus(updatedUser),
      };
    } catch (error) {
      console.error('❌ Error deleting KK document:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Gagal menghapus dokumen KK: ' + error.message);
    }
  }

  // 🟢 Get KK Document (public URL)
  async getKKDocument(userId: number) {
    console.log(`📄 Service: Getting KK document for userId: ${userId}`);

    try {
      // Validasi userId
      if (!userId || isNaN(userId)) {
        console.error('❌ Invalid userId:', userId);
        throw new BadRequestException('User ID tidak valid: ' + userId);
      }

      const numericUserId = Number(userId);

      // Debug: Cek apakah user ada
      const userExists = await this.prisma.user.findUnique({
        where: { id: numericUserId },
        select: { id: true }
      });

      console.log('🔍 User exists check:', userExists);

      const user = await this.prisma.user.findUnique({
        where: { id: numericUserId },
        include: {
          verifiedByAdmin: {
            select: {
              namaLengkap: true,
              email: true,
              kkFile: true,
              kkFilePublicId: true,
              isVerified: true,
              kkRejectionReason: true,
              kkVerifiedAt: true,
            },
          },
        },
      });

      if (!user) {
        console.error('❌ User not found with ID:', numericUserId);
        throw new NotFoundException(`User dengan ID ${numericUserId} tidak ditemukan`);
      }

      if (!user.kkFile) {
        console.log('⚠️ No KK file for user:', numericUserId);
        return {
          success: false,
          message: 'Dokumen KK belum diupload',
          data: {
            hasKKDocument: false,
            kkFile: null,
            kkVerificationStatus: 'not_uploaded'
          }
        };
      }

      const kkVerificationStatus = this.determineKKVerificationStatus(user);

      console.log('✅ KK document found:', {
        userId: numericUserId,
        hasFile: !!user.kkFile,
        status: kkVerificationStatus
      });

      return {
        success: true,
        message: 'Dokumen KK ditemukan',
        data: {
          hasKKDocument: true,
          kkFile: user.kkFile,
          kkVerificationStatus: kkVerificationStatus,
          verificationInfo: {
            isVerified: user.isVerified,
            rejectionReason: user.kkRejectionReason,
            verifiedAt: user.kkVerifiedAt,
            verifiedBy: user.verifiedByAdmin
              ? user.verifiedByAdmin.namaLengkap
              : null,
          },
        },
      };
    } catch (error) {
      console.error('❌ Service error getting KK document:', error);

      // Re-throw error yang sudah berupa HttpException
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Untuk error lain, wrap dengan BadRequestException
      throw new BadRequestException('Gagal mengambil dokumen KK: ' + error.message);
    }
  }

  // 🟢 Get KK verification requests (admin)
  async getKKVerificationRequests(page: number, limit: number, status?: string) {
    console.log(`🔍 Getting KK verification requests - Page: ${page}, Limit: ${limit}, Status: ${status}`);

    try {
      const skip = (page - 1) * limit;

      // Build where clause based on status
      const whereClause: any = {
        OR: [
          { kkFile: { not: null } },
          { kkVerifiedAt: { not: null } },
          { kkRejectionReason: { not: null } }
        ]
      };

      if (status) {
        switch (status.toLowerCase()) {
          case 'pending':
          case 'pending_review':
            whereClause.isVerified = false;
            whereClause.kkFile = { not: null };
            whereClause.kkRejectionReason = null;
            break;
          case 'verified':
            whereClause.isVerified = true;
            whereClause.kkVerifiedAt = { not: null };
            break;
          case 'rejected':
            whereClause.isVerified = false;
            whereClause.kkRejectionReason = { not: null };
            break;
          case 'not_uploaded':
            whereClause.kkFile = null;
            break;
        }
      }

      // Get users with pagination
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            namaLengkap: true,
            email: true,
            nik: true,
            nomorTelepon: true,
            kkFile: true,
            kkFilePublicId: true,
            kkRejectionReason: true,
            isVerified: true,
            kkVerifiedAt: true,
            kkVerifiedBy: true,
            createdAt: true,
            updatedAt: true,
            // Admin info if verified
            verifiedByAdmin: {
              select: {
                id: true,
                namaLengkap: true,
                email: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where: whereClause }),
      ]);

      // Determine verification status for each user
      const usersWithStatus = users.map(user => ({
        ...user,
        kkVerifiedByName: user.verifiedByAdmin?.namaLengkap ?? null,
        kkVerificationStatus: this.determineKKVerificationStatus(user),
        hasKKDocument: !!user.kkFile,
      }));

      return {
        success: true,
        message: 'KK verification requests retrieved successfully',
        data: usersWithStatus,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('❌ Error getting KK verification requests:', error);
      throw new BadRequestException('Gagal mengambil permintaan verifikasi KK: ' + error.message);
    }
  }



  // 🟢 Verify KK document (admin)
  async verifyKKDocument(userId: number, verified: boolean, rejectionReason: string | undefined, adminId: number) {
    console.log(`✅ Verifying KK document - User: ${userId}, Verified: ${verified}, Admin: ${adminId}`);

    try {
      // Validate inputs
      if (!userId || isNaN(userId)) {
        throw new BadRequestException('User ID tidak valid');
      }

      if (typeof verified !== 'boolean') {
        throw new BadRequestException('Verified harus berupa boolean');
      }

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          namaLengkap: true,
          email: true,
          kkFile: true,
          isVerified: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
      }

      // Check if user has KK document
      if (!user.kkFile) {
        throw new BadRequestException('User belum mengupload dokumen KK');
      }

      // Prepare update data
      const updateData: any = {
        isVerified: verified,
        kkVerifiedAt: new Date(),
        kkVerifiedBy: adminId,
      };

      if (verified) {
        // If verified, clear rejection reason
        updateData.kkRejectionReason = null;
      } else {
        // If rejected, validate rejection reason
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new BadRequestException('Alasan penolakan harus diisi jika dokumen ditolak');
        }

        if (rejectionReason.length < 10) {
          throw new BadRequestException('Alasan penolakan harus minimal 10 karakter');
        }

        updateData.kkRejectionReason = rejectionReason.trim();
      }

      // Update user verification status
      const updatedUser = await this.prisma.user.update({
        where: { id: Number(userId) },
        data: updateData,
        include: {
          verifiedByAdmin: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
              kkFile: true,
              isVerified: true,
              kkRejectionReason: true,
              kkVerifiedAt: true,
              updatedAt: true,
            },
          },
        },
      });

      // Log activity
      await this.logActivity(
        userId,
        verified ? 'KK_VERIFIED' : 'KK_REJECTED',
        `Dokumen KK ${verified ? 'diverifikasi' : 'ditolak'} oleh admin ID: ${adminId}`,
      );

      // Also log admin activity
      await this.logActivity(
        adminId,
        verified ? 'VERIFY_KK' : 'REJECT_KK',
        `${verified ? 'Memverifikasi' : 'Menolak'} dokumen KK user: ${user.namaLengkap} (ID: ${userId})`,
      );

      return {
        success: true,
        message: `Dokumen KK berhasil ${verified ? 'diverifikasi' : 'ditolak'}`,
        data: {
          userId: updatedUser.id,
          isVerified: updatedUser.isVerified,
          kkVerifiedAt: updatedUser.kkVerifiedAt,

          // 🔥 INI UNTUK UI
          verifiedBy: updatedUser.verifiedByAdmin
            ? updatedUser.verifiedByAdmin.namaLengkap
            : null,

          // 🔒 INTERNAL (OPTIONAL)
          kkVerifiedBy: updatedUser.kkVerifiedBy,
        },
      };


    } catch (error) {
      console.error('❌ Error verifying KK document:', error);

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Gagal memverifikasi dokumen KK: ' + error.message);
    }
  }



  // ========== HELPER METHODS ==========

  // 🟢 Helper method: Hitung usia
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  // 🟢 Helper method: Tentukan status verifikasi KK
  private determineKKVerificationStatus(user: any): string {
    if (user.isVerified) {
      return 'verified';
    } else if (user.kkRejectionReason) {
      return 'rejected';
    } else if (user.kkFile) {
      return 'pending_review';
    }
    return 'not_uploaded';
  }

  // 🟢 Helper method: Log aktivitas
  private async logActivity(userId: number, action: string, description: string) {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action,
          description,
        },
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}