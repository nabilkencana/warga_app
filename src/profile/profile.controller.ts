import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import {
  UpdateProfileDto,
  EmailChangeRequestDto,
  VerifyEmailChangeDto,
  UpdatePhoneNumberDto,
  UpdateBioDto,
} from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Profile')
@Controller('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  // Helper method untuk mendapatkan user ID dari request
  private getUserIdFromRequest(req): number {
    console.log('🔐 JWT Payload from request:', JSON.stringify(req.user, null, 2));

    // Dari JWT strategy Anda, payload memiliki:
    // - id: payload.id
    // - userId: payload.sub
    // - email: payload.email
    // - name: payload.name
    // - role: payload.role

    // Prioritaskan berdasarkan struktur dari jwt.strategy.ts
    let userId: any = null;

    // Coba urutan berdasarkan kemungkinan
    if (req.user?.id !== undefined && req.user?.id !== null) {
      userId = req.user.id;
      console.log('✅ Found user ID in req.user.id:', userId);
    } else if (req.user?.userId !== undefined && req.user?.userId !== null) {
      userId = req.user.userId; // Ini adalah payload.sub dari JWT
      console.log('✅ Found user ID in req.user.userId (JWT sub):', userId);
    } else if (req.user?.sub !== undefined && req.user?.sub !== null) {
      userId = req.user.sub;
      console.log('✅ Found user ID in req.user.sub:', userId);
    } else {
      console.error('❌ No user ID found in request.user');
      console.error('❌ Available keys:', Object.keys(req.user || {}));
      throw new BadRequestException('User ID tidak ditemukan dalam token JWT');
    }

    // Debug: Tampilkan tipe data
    console.log('🔍 User ID value:', userId);
    console.log('🔍 User ID type:', typeof userId);

    // Convert ke number dengan hati-hati
    let numericUserId: number;

    if (typeof userId === 'number') {
      numericUserId = userId;
    } else if (typeof userId === 'string') {
      // Coba parse sebagai integer
      numericUserId = parseInt(userId, 10);

      // Coba parse sebagai float jika integer gagal
      if (isNaN(numericUserId)) {
        const floatId = parseFloat(userId);
        if (!isNaN(floatId)) {
          numericUserId = Math.floor(floatId); // Ambil integer bagian
          console.log('⚠️ Parsed as float and converted to integer:', numericUserId);
        }
      }
    } else {
      console.error('❌ Unsupported user ID type:', typeof userId);
      throw new BadRequestException(`Tipe User ID tidak didukung: ${typeof userId}`);
    }

    if (isNaN(numericUserId)) {
      console.error('❌ Failed to parse user ID as number:', userId);
      console.error('❌ Original value:', userId);
      console.error('❌ Parsed as:', numericUserId);
      throw new BadRequestException(`User ID harus berupa angka. Dapat: ${userId} (${typeof userId})`);
    }

    console.log('✅ Final numeric user ID:', numericUserId);
    return numericUserId;
  }

  // ========== PROFILE ENDPOINTS ==========

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.getUserProfile(userId);
  }

  @Put('update')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data provided' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.updateProfile(userId, updateProfileDto);
  }

  @Post('upload-picture')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('profilePicture'))
  async uploadProfilePicture(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.uploadProfilePicture(userId, file);
  }

  @Delete('picture')
  @ApiOperation({ summary: 'Delete profile picture' })
  async deleteProfilePicture(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.deleteProfilePicture(userId);
  }

  @Put('bio')
  @ApiOperation({ summary: 'Update user bio' })
  async updateBio(@Request() req, @Body() updateBioDto: UpdateBioDto) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.updateBio(userId, updateBioDto.bio);
  }

  // ========== KK DOCUMENT ENDPOINTS ==========

  @Get('kk-status')
  @ApiOperation({ summary: 'Get KK verification status' })
  async getKKVerificationStatus(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.getKKVerificationStatus(userId);
  }

  @Post('upload-kk')
  @ApiOperation({ summary: 'Upload KK document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File KK (JPG, PNG, PDF) maksimal 5MB',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('kkFile')) // Gunakan 'file' bukan 'kkFile'
  async uploadKKDocument(
    @Request() req,
    @UploadedFile() kkFile: Express.Multer.File,
  ) {
    const userId = this.getUserIdFromRequest(req);
    console.log(`📤 Uploading KK document for userId: ${userId}`);

    if (!kkFile) {
      throw new BadRequestException('Tidak ada kkFile yang diupload');
    }

    return this.profileService.uploadKKDocument(userId, kkFile);
  }

  @Delete('kk')
  @ApiOperation({ summary: 'Delete KK document' })
  async deleteKKDocument(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    console.log(`🗑️ Deleting KK document for userId: ${userId}`);

    return this.profileService.deleteKKDocument(userId);
  }

  @Get('kk')
  @ApiOperation({ summary: 'Get KK document' })
  @ApiResponse({ status: 200, description: 'KK document retrieved successfully' })
  @ApiResponse({ status: 404, description: 'KK document not found' })
  async getKKDocument(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    console.log(`📄 Getting KK document for userId: ${userId}`);

    try {
      const result = await this.profileService.getKKDocument(userId);
      console.log('✅ KK document retrieved successfully');
      return result;
    } catch (error) {
      console.error('❌ Error getting KK document:', error);
      throw error;
    }
  }

  @Get('kk/view')
  @ApiOperation({ summary: 'View KK document (get file URL)' })
  async viewKKDocument(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    console.log(`👁️ Viewing KK document for userId: ${userId}`);

    return this.profileService.getKKDocument(userId);
  }

  // ========== OTHER ENDPOINTS ==========

  @Post('request-email-change')
  @ApiOperation({ summary: 'Request email change (requires OTP)' })
  async requestEmailChange(
    @Request() req,
    @Body() emailChangeDto: EmailChangeRequestDto,
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.requestEmailChange(userId, emailChangeDto.newEmail);
  }

  @Post('verify-email-change')
  @ApiOperation({ summary: 'Verify email change with OTP' })
  async verifyEmailChange(
    @Request() req,
    @Body() verifyEmailChangeDto: VerifyEmailChangeDto,
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.verifyEmailChange(userId, verifyEmailChangeDto.otpCode);
  }

  @Put('phone-number')
  @ApiOperation({ summary: 'Update phone number' })
  async updatePhoneNumber(
    @Request() req,
    @Body() updatePhoneNumberDto: UpdatePhoneNumberDto,
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.updatePhoneNumber(userId, updatePhoneNumberDto.phoneNumber);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get user activity logs' })
  async getProfileActivity(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.getProfileActivity(userId, page, limit);
  }

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get user dashboard statistics' })
  async getUserDashboardStats(@Request() req) {
    const userId = this.getUserIdFromRequest(req);
    return this.profileService.getUserDashboardStats(userId);
  }

  // ========== ADMIN ENDPOINTS (PINDHKAN KE CONTROLLER TERPISAH) ==========

  // NOTE: Pindahkan endpoint admin ke controller terpisah atau urutkan dengan benar
  // @Get(':userId') - INI HARUS DIBAWAH SEMUA ROUTE SPESIFIK LAINNYA

  @Get('admin/verify-kk-requests')
  @ApiOperation({ summary: 'Get KK verification requests (admin only)' })
  async getKKVerificationRequests(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: 'pending' | 'verified' | 'rejected',
  ) {
    const adminId = this.getUserIdFromRequest(req);
    // TODO: Cek apakah user adalah admin

    return this.profileService.getKKVerificationRequests(page, limit, status);
  }

  @Put('admin/verify-kk/:userId')
  @ApiOperation({ summary: 'Verify KK document (admin only)' })
  async verifyKKDocument(
    @Param('userId') targetUserId: string,
    @Body() body: { verified: boolean; rejectionReason?: string },
    @Request() req,
  ) {
    console.log('🔥 VERIFY KK CONTROLLER HIT');
    const adminId = this.getUserIdFromRequest(req);
    // TODO: Cek apakah user adalah admin

    return this.profileService.verifyKKDocument(
      Number(targetUserId),
      body.verified,
      body.rejectionReason,
      adminId,
    );
  }

  // ========== PUBLIC/ADMIN ENDPOINTS (HARUS DIBAWAH) ==========

  // INI HARUS DIBAWAH SEMUA ROUTE SPESIFIK LAINNYA
  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile by ID (admin only)' })
  async getUserProfileById(@Param('userId') userId: string) {
    console.log('📋 Getting profile for userId:', userId);

    // Validasi bahwa userId adalah number
    const numericUserId = Number(userId);
    if (isNaN(numericUserId)) {
      throw new BadRequestException(`User ID harus berupa angka. Dapat: ${userId}`);
    }

    return this.profileService.getUserProfile(numericUserId);
  }
}