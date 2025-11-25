// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { Prisma, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

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

  // 🟢 Register new user - FIXED VERSION
  async register(createUserDto: CreateUserDto, file?: Express.Multer.File) {
    try {
      // 🔍 Cek apakah email sudah terdaftar
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUserByEmail) {
        throw new ConflictException('Email sudah terdaftar, silakan gunakan email lain.');
      }

      // 🔍 Cek apakah NIK sudah terdaftar - FIXED: gunakan findFirst untuk field non-unique
      if (createUserDto.nik) {
        const existingUserByNik = await this.prisma.user.findFirst({
          where: { nik: createUserDto.nik },
        });

        if (existingUserByNik) {
          throw new ConflictException('NIK sudah terdaftar.');
        }
      }

      // 🟢 FIX: Validasi dan konversi tanggalLahir
      let tanggalLahirDate: Date;
      if (createUserDto.tanggalLahir) {
        tanggalLahirDate = new Date(createUserDto.tanggalLahir);

        // Validasi apakah tanggal valid
        if (isNaN(tanggalLahirDate.getTime())) {
          throw new BadRequestException('Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD');
        }
      } else {
        throw new BadRequestException('Tanggal lahir harus diisi');
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
          kkFile: file ? file.filename : null,
          role: UserRole.USER, // FIXED: Gunakan enum UserRole.USER 
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
          createdAt: true,
        },
      });

      return {
        message: 'Pendaftaran berhasil',
        user,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Error saat register:', error);
      throw new BadRequestException('Gagal mendaftar user');
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
        kkFile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    }

    return user;
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

  // 🟢 Update user profile - FIXED VERSION
  async updateProfile(id: number, updateUserDto: UpdateUserDto, file?: Express.Multer.File) {
    try {
      // Pastikan user ada
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, nik: true }
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

      // 🔍 Cek jika NIK diubah dan sudah digunakan user lain - FIXED: gunakan findFirst
      if (updateUserDto.nik && updateUserDto.nik !== existingUser.nik) {
        const nikExists = await this.prisma.user.findFirst({
          where: { nik: updateUserDto.nik },
        });

        if (nikExists) {
          throw new ConflictException('NIK sudah digunakan oleh user lain');
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (updateUserDto.namaLengkap) updateData.namaLengkap = updateUserDto.namaLengkap;
      if (updateUserDto.nik) updateData.nik = updateUserDto.nik;
      // 🟢 FIX: Validasi dan konversi tanggalLahir untuk update
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

      // FIXED: Handle role dengan enum UserRole
      if (updateUserDto.role) {
        const validRole = this.convertToUserRole(updateUserDto.role);
        updateData.role = validRole;
      }

      if (file) updateData.kkFile = file.filename;

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

  // 🟢 Update user role - FIXED VERSION
  async updateUserRole(id: number, role: string) {
    // FIXED: Convert string role ke enum UserRole
    const validRole = this.convertToUserRole(role);

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: validRole }, // FIXED: Gunakan enum UserRole
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

  // 🗑️ Delete user
  async deleteUser(id: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        namaLengkap: true,
        email: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User tidak ditemukan');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: `User "${existingUser.namaLengkap}" berhasil dihapus`,
      deletedUser: existingUser,
    };
  }

  // 🟢 Get user statistics - FIXED VERSION
  async getUserStats() {
    const [totalUsers, verifiedUsers, adminUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }), // FIXED: Gunakan enum
    ]);

    return {
      totalUsers,
      verifiedUsers,
      adminUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      regularUsers: totalUsers - adminUsers,
    };
  }

  // OTP Methods (untuk kompatibilitas dengan auth system)
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

  // 🟢 Helper method: Convert string role to UserRole enum - NEW METHOD
  private convertToUserRole(roleString: string): UserRole {
    const roleMap: { [key: string]: UserRole } = {
      'user': UserRole.USER,
      'admin': UserRole.ADMIN,
      'super_admin': UserRole.SUPER_ADMIN,
      'super admin': UserRole.SUPER_ADMIN,
      'superadmin': UserRole.SUPER_ADMIN,
      'treasurer': UserRole.USER,
      'member': UserRole.USER,
      'relawan': UserRole.USER, // Map 'relawan' ke MEMBER atau buat enum baru jika diperlukan
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

  // 🟢 Additional method: Get users by role dengan enum - NEW METHOD
  async getUsersByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role },
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

  // 🟢 Additional method: Get admin count dengan enum - NEW METHOD
  async getAdminCount(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: UserRole.ADMIN
      }
    });
  }
}