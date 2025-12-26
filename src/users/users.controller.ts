// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
  NotFoundException,
  ValidationPipe,
  UsePipes,
  Patch,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, VerifyKKDto } from './dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  prisma: any;
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @ApiOperation({ summary: 'Get all users dengan pagination dan search' })
  @ApiResponse({ status: 200, description: 'List of users retrieved successfully' })
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.usersService.getAllUsers(
      parseInt(page),
      parseInt(limit),
      search,
    );
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['namaLengkap', 'nik', 'tanggalLahir', 'tempatLahir', 'email', 'nomorTelepon', 'alamat', 'kota', 'negara', 'kodePos', 'rtRw'],
      properties: {
        namaLengkap: {
          type: 'string',
          example: 'John Doe'
        },
        nik: {
          type: 'string',
          example: '3501234567890123',
          minLength: 16,
          maxLength: 16
        },
        tanggalLahir: {
          type: 'string',
          description: 'Format: YYYY-MM-DD, DD.MM.YYYY, atau DD/MM/YYYY',
          example: '1990-01-15'
        },
        tempatLahir: {
          type: 'string',
          example: 'Jakarta'
        },
        email: {
          type: 'string',
          format: 'email',
          example: 'john@example.com'
        },
        nomorTelepon: {
          type: 'string',
          example: '+6281234567890'
        },
        instagram: {
          type: 'string',
          nullable: true,
          example: '@johndoe'
        },
        facebook: {
          type: 'string',
          nullable: true,
          example: 'johndoe'
        },
        alamat: {
          type: 'string',
          example: 'Jl. Contoh No. 123'
        },
        kota: {
          type: 'string',
          example: 'Jakarta Selatan'
        },
        negara: {
          type: 'string',
          example: 'Indonesia'
        },
        kodePos: {
          type: 'string',
          example: '12345',
          minLength: 5,
          maxLength: 5
        },
        rtRw: {
          type: 'string',
          example: '001/002',
          pattern: '^[0-9]{3}/[0-9]{3}$'
        },
        kkFile: {
          type: 'string',
          format: 'binary',
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('kkFile'))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() kkFile?: Express.Multer.File,
  ) {
    console.log('📨 Received file:', kkFile?.originalname);
    console.log('📨 Received DTO:', createUserDto);

    return this.usersService.register(createUserDto, kkFile);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get user by email' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Get('nik/:nik')
  @ApiOperation({ summary: 'Get user by NIK' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByNik(@Param('nik') nik: string) {
    return this.usersService.findByNik(nik);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        namaLengkap: { type: 'string', nullable: true },
        nik: { type: 'string', nullable: true },
        tanggalLahir: { type: 'string', nullable: true },
        tempatLahir: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        nomorTelepon: { type: 'string', nullable: true },
        instagram: { type: 'string', nullable: true },
        facebook: { type: 'string', nullable: true },
        alamat: { type: 'string', nullable: true },
        kota: { type: 'string', nullable: true },
        negara: { type: 'string', nullable: true },
        kodePos: { type: 'string', nullable: true },
        rtRw: { type: 'string', nullable: true },
        role: { type: 'string', nullable: true, enum: ['user', 'admin'] },
        kkFile: {
          type: 'string',
          format: 'binary',
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('kkFile'))
  async updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() kkFile?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(id, updateUserDto, kkFile);
  }

  @Put(':id/verify')
  @ApiOperation({ summary: 'Update user verification status' })
  @ApiResponse({ status: 200, description: 'Verification status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body('isVerified') isVerified: boolean,
  ) {
    if (typeof isVerified !== 'boolean') {
      throw new BadRequestException('isVerified harus boolean');
    }
    return this.usersService.updateVerificationStatus(id, isVerified);
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
  ) {
    if (!role) {
      throw new BadRequestException('Role harus diisi');
    }
    return this.usersService.updateUserRole(id, role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(id);
  }

  // OTP endpoints untuk kompatibilitas
  @Get('me/:email')
  @ApiOperation({ summary: 'Get current user profile by email' })
  async getMe(@Param('email') email: string) {
    const user = await this.usersService.me(email);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return user;
  }

  // 🟢 Get KK verification details
  @Get(':id/kk-details')
  @UseGuards(JwtAuthGuard)
  async getKKDetails(@Param('id') id: string) {
    return this.usersService.getKKVerificationDetails(+id);
  }

  // 🟢 Verify or reject KK document
  @Patch(':id/verify-kk')
  @UseGuards(JwtAuthGuard)
  async verifyKKDocument(
    @Param('id') id: string,
    @Body() verifyKKDto: VerifyKKDto,
  ) {
    return this.usersService.verifyKKDocument(+id, verifyKKDto);
  }

  // 🟢 Delete KK document
  @Delete(':id/kk-document')
  @UseGuards(JwtAuthGuard)
  async deleteKKDocument(@Param('id') id: string) {
    return this.usersService.deleteKKDocument(+id);
  }

  // 🟢 Upload KK document (untuk user update)
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
        kkUploadedAt: true,

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

}