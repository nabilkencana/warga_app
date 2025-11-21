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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
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
      properties: {
        namaLengkap: { type: 'string' },
        nik: { type: 'string' },
        tanggalLahir: { type: 'string' },
        tempatLahir: { type: 'string' },
        email: { type: 'string' },
        nomorTelepon: { type: 'string' },
        instagram: { type: 'string', nullable: true },
        facebook: { type: 'string', nullable: true },
        alamat: { type: 'string' },
        kota: { type: 'string' },
        negara: { type: 'string' },
        kodePos: { type: 'string' },
        rtRw: { type: 'string' },
        kkFile: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('kkFile'))
  async register(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() kkFile?: Express.Multer.File,
  ) {
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
}