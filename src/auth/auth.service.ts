import { Injectable, UnauthorizedException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '@prisma/client';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;
  private resend: Resend;

  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET')
    );

    // Inisialisasi Resend dengan validasi API key
    const resendApiKey = this.config.get('RESEND_API_KEY');
    if (!resendApiKey) {
      this.logger.error('RESEND_API_KEY is not configured!');
      throw new Error('RESEND_API_KEY is required');
    }
    this.resend = new Resend(resendApiKey);
  }

  private validateAndFormatFromField(): string {
    const emailConfig = this.config.get('RESEND_FROM_EMAIL', '').trim();
    const fromName = this.config.get('RESEND_FROM_NAME', 'WargaApp').trim();

    if (!emailConfig) {
      this.logger.error('RESEND_FROM_EMAIL is not configured');
      throw new InternalServerErrorException('Email configuration missing');
    }

    // Debug log untuk melihat format asli
    this.logger.log(`Raw email config: "${emailConfig}"`);
    this.logger.log(`Raw from name: "${fromName}"`);

    // Ekstrak email dari berbagai format
    let pureEmail = emailConfig;

    // Jika format: "Name <email@domain.com>", ekstrak bagian emailnya
    if (emailConfig.includes('<') && emailConfig.includes('>')) {
      const match = emailConfig.match(/<([^>]+)>/);
      if (match && match[1]) {
        pureEmail = match[1].trim();
        this.logger.log(`Extracted email from brackets: ${pureEmail}`);
      }
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(pureEmail)) {
      this.logger.error(`Invalid email format after extraction: "${pureEmail}"`);
      this.logger.error(`Original config: "${emailConfig}"`);
      throw new InternalServerErrorException(`Invalid email format: ${pureEmail}`);
    }

    // Format akhir untuk Resend
    const result = `${fromName} <${pureEmail}>`;
    this.logger.log(`Final formatted from field: "${result}"`);

    return result;
  }

  async sendOtp(email: string) {
    try {
      this.logger.log(`Attempting to send OTP to: ${email}`);

      const user = await Promise.race([
        this.prisma.user.findUnique({ where: { email } }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database timeout')), 15000)
        )
      ]) as any;

      if (!user) {
        this.logger.warn(`Email not found: ${email}`);
        throw new UnauthorizedException('Email tidak ditemukan');
      }

      const demoMode = this.config.get('DEMO_MODE') === 'true';
      const demoOtp = this.config.get('DEMO_OTP') || '123456';
      const demoAccounts = (this.config.get('DEMO_ACCOUNTS') || '')
        .split(',')
        .map(e => e.trim());

      // 🔥 KHUSUS DEMO JURI
      if (demoMode && demoAccounts.includes(email)) {
        await this.prisma.user.update({
          where: { email },
          data: {
            otpCode: demoOtp,
            otpExpire: new Date(Date.now() + 60 * 60 * 1000), // 1 jam
          },
        });

        this.logger.warn(`⚠️ DEMO MODE OTP for ${email}: ${demoOtp}`);

        return {
          message: 'OTP demo aktif (untuk juri)',
          demo: true,
        };
      }

      // ===== OTP NORMAL (USER BIASA) =====
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

      await this.prisma.user.update({
        where: { email },
        data: { otpCode: otp, otpExpire },
      });

      this.logger.log(`OTP generated for ${email}: ${otp}`);

      try {
        // Gunakan method helper untuk format yang benar
        const fromField = this.validateAndFormatFromField();

        this.logger.log(`Sending OTP email with from field: ${fromField}`);
        // Menggunakan Resend untuk mengirim email[citation:2][citation:6]
        const { data, error } = await this.resend.emails.send({
          from: fromField,
          to: email,
          subject: '🔐 Kode OTP untuk Login - WargaApp',
          html: `
            <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f7fa;
      line-height: 1.6;
      color: #333;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 82, 204, 0.08);
      border: 1px solid #e6f0ff;
    }

    .header {
      background: linear-gradient(135deg, #0066cc 0%, #004d99 100%);
      padding: 32px 20px;
      text-align: center;
      color: white;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }

    .content {
      padding: 40px 32px;
    }

    .greeting {
      color: #004d99;
      margin-bottom: 24px;
      font-size: 20px;
      font-weight: 600;
    }

    .message {
      color: #4d4d4d;
      margin-bottom: 32px;
      font-size: 16px;
    }

    .otp-container {
      background: #f0f7ff;
      border: 1px solid #cce0ff;
      border-radius: 10px;
      padding: 24px;
      margin: 32px 0;
      text-align: center;
    }

    .otp-label {
      color: #0066cc;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .otp-code {
      font-size: 40px;
      font-weight: 700;
      color: #004d99;
      letter-spacing: 8px;
      margin: 0;
      font-family: 'Courier New', monospace;
      padding: 8px 0;
    }

    .info-box {
      background: #e6f2ff;
      border-left: 4px solid #0066cc;
      padding: 16px 20px;
      margin: 32px 0;
      border-radius: 0 8px 8px 0;
    }

    .info-title {
      color: #004d99;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 15px;
    }

    .info-text {
      color: #4d4d4d;
      margin: 4px 0;
      font-size: 14px;
    }

    .warning {
      color: #cc3300;
      font-size: 14px;
      font-weight: 600;
      margin-top: 12px;
    }

    .footer {
      background: #f5f7fa;
      padding: 24px 32px;
      text-align: center;
      color: #666;
      font-size: 13px;
      border-top: 1px solid #e6e6e6;
    }

    .footer p {
      margin: 8px 0;
    }

    .copyright {
      font-size: 12px;
      color: #999;
      margin-top: 16px;
    }

    .highlight {
      color: #0066cc;
      font-weight: 600;
    }

    @media (max-width: 480px) {
      .content {
        padding: 24px 20px;
      }

      .header {
        padding: 24px 20px;
      }

      .otp-code {
        font-size: 32px;
        letter-spacing: 6px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔐 WargaApp</div>
      <p>Kode Verifikasi Login</p>
    </div>

    <div class="content">
      <div class="greeting">Halo!</div>

      <div class="message">
        Anda baru saja meminta kode OTP untuk login ke akun WargaApp.
        Gunakan kode berikut untuk melanjutkan:
      </div>

      <div class="otp-container">
        <div class="otp-label">Kode OTP Anda</div>
        <div class="otp-code">${otp}</div>
      </div>
      
      <div class="info-box">
        <div class="info-title">⏰ Informasi Penting</div>
        <p class="info-text"><span class="highlight">Masa Berlaku:</span> 5 menit</p>
        <p class="info-text"><span class="highlight">Jangan bagikan</span> kode ini kepada siapapun</p>
        <p class="warning">Termasuk staf WargaApp yang tidak akan pernah memintanya</p>
      </div>
      
      <div class="message" style="font-size: 14px; color: #666; margin-top: 32px;">
        Jika Anda tidak meminta kode ini, silakan abaikan email ini atau 
        hubungi tim dukungan kami jika merasa ada aktivitas mencurigakan.
      </div>
    </div>
    
    <div class="footer">
      <p><span class="highlight">WargaApp</span> — Platform digital untuk warga</p>
      <p>Email ini dikirim secara otomatis, mohon tidak membalas</p>
      <div class="copyright">
        &copy; 2025 WargaApp. Hak cipta dilindungi undang-undang.
      </div>
    </div>
  </div>
</body>
</html>
          `,
          text: `Kode OTP Anda: ${otp}. Berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.`
        });

        if (error) {
          // Log detail error dari Resend
          this.logger.error(`Resend API Error Details:`, {
            statusCode: error.statusCode,
            name: error.name,
            message: error.message
          });

          // Berikan pesan error yang lebih spesifik
          if (error.statusCode === 422) {
            throw new InternalServerErrorException('Format email pengirim tidak valid. Periksa konfigurasi RESEND_FROM_EMAIL.');
          } else if (error.statusCode === 403) {
            throw new InternalServerErrorException('API key tidak valid atau expired. Periksa RESEND_API_KEY.');
          } else if (error.statusCode === 429) {
            throw new InternalServerErrorException('Limit email harian terlampaui. Coba lagi besok.');
          }

          throw new InternalServerErrorException('Gagal mengirim OTP via email');
        }

        this.logger.log(`OTP email sent successfully. Email ID: ${data.id}`);
        return {
          message: 'OTP berhasil dikirim ke email',
          emailId: data.id
        };

      } catch (emailError) {
        this.logger.error(`Email sending failed for ${email}:`, emailError);
        throw new InternalServerErrorException('Gagal mengirim OTP via email');
      }

    } catch (error) {
      this.logger.error(`Error in sendOtp for ${email}:`, error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error.message.includes('timeout') || error.code === 'P2024') {
        throw new InternalServerErrorException('Database sedang sibuk, coba lagi dalam beberapa saat');
      }

      throw new InternalServerErrorException('Gagal mengirim OTP');
    }
  }

  async verifyOtp(email: string, otp: string) {
    try {
      this.logger.log(`Verifying OTP for: ${email}`);

      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        throw new UnauthorizedException('Email tidak ditemukan');
      }

      if (!user.otpCode || user.otpCode !== otp) {
        throw new UnauthorizedException('OTP salah');
      }

      if (!user.otpExpire || user.otpExpire < new Date()) {
        throw new UnauthorizedException('OTP sudah kadaluarsa');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.namaLengkap,
      };

      const token = this.jwtService.sign(payload);

      // Reset OTP setelah berhasil login
      await this.usersService.clearOtp(email);

      // Kembalikan data user yang lengkap
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.namaLengkap,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      this.logger.log(`OTP verification successful for: ${email}`);

      return {
        message: 'Login berhasil',
        user: userResponse,
        access_token: token,
      };

    } catch (error) {
      this.logger.error(`Error in verifyOtp for ${email}:`, error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Gagal memverifikasi OTP');
    }
  }

  // 🔐 GOOGLE OAUTH METHODS
  async googleLogin(req: any) {
    try {
      this.logger.log('Google OAuth login attempt');

      if (!req.user) {
        throw new BadRequestException('No user data from Google');
      }

      const googleUser = req.user;

      // Cek apakah user sudah ada di database
      let user = await this.prisma.user.findUnique({
        where: { email: googleUser.email }
      });

      // Jika user belum ada, buat user baru dengan SEMUA required fields
      if (!user) {
        const userData = {
          email: googleUser.email,
          namaLengkap: `${googleUser.firstName} ${googleUser.lastName}`.trim() || 'Google User',
          // ✅ Semua required fields berdasarkan error message
          nik: `GOOGLE_${Date.now()}`, // Unique NIK untuk Google users
          tanggalLahir: new Date('1990-01-01'), // Default tanggal lahir
          tempatLahir: 'Unknown',
          nomorTelepon: '000000000000',
          alamat: 'Unknown Address',
          kota: 'Unknown City',
          negara: 'Unknown',    // required by Prisma schema
          kodePos: '00000',     // required by Prisma schema
          rtRw: '00/00',        // required by Prisma schema
          // Optional fields dengan default values
          instagram: null,
          facebook: null,
          // System fields
          role: UserRole.USER,
          isVerified: true,
        };

        user = await this.prisma.user.create({
          data: userData
        });
        this.logger.log(`New user created via Google OAuth: ${googleUser.email}`);
      } else {
        this.logger.log(`Existing user logged in via Google OAuth: ${googleUser.email}`);
      }

      // Generate JWT token
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.namaLengkap,
      };

      const token = this.jwtService.sign(payload);

      // Response data user
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.namaLengkap,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      this.logger.log(`Google OAuth login successful for: ${user.email}`);

      return {
        message: 'Google login successful',
        user: userResponse,
        access_token: token,
      };

    } catch (error) {
      this.logger.error('Error in googleLogin:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Google login failed');
    }
  }

  // src/auth/auth.service.ts - Update googleMobileLogin method
  async googleMobileLogin(body: any) {
    const { idToken, accessToken, email, name, picture } = body;

    this.logger.log(`Google mobile login attempt`);

    try {
      let googlePayload: any;

      // Priority: Verify with ID Token first
      if (idToken) {
        this.logger.log('Verifying Google ID token...');
        const ticket = await this.googleClient.verifyIdToken({
          idToken: idToken,
          audience: this.config.get('GOOGLE_CLIENT_ID'),
        });
        googlePayload = ticket.getPayload();
        

        if (!googlePayload) {
          throw new UnauthorizedException('Invalid Google ID token');
        }

        this.logger.log(`Google user verified: ${googlePayload.email}`);
      }
      // Fallback: Use access token or direct data
      else if (accessToken) {
        this.logger.log('Getting user info using access token...');
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          throw new UnauthorizedException('Invalid access token');
        }

        googlePayload = await response.json();
      }
      // Development fallback
      else if (email) {
        this.logger.warn('Development mode: Using email without verification');
        googlePayload = { email, name, picture };
      }
      else {
        throw new BadRequestException('ID token, access token, or email is required');
      }

      // Cek atau buat user di database
      let user = await this.prisma.user.findUnique({
        where: { email: googlePayload.email }
      });

      // Jika user belum terdaftar, kembalikan error khusus
      if (!user) {
        this.logger.log(`User tidak ditemukan: ${googlePayload.email}`);

        // Buat response error khusus untuk frontend
        throw new UnauthorizedException('USER_NOT_REGISTERED: Akun Google belum terdaftar. Silakan daftar terlebih dahulu.');
      }

      // Jika user ditemukan, lanjutkan proses seperti biasa
      this.logger.log(`Existing user logged in via Google: ${user.email}`);

      if (!user) {
        this.logger.log(`Creating new user for: ${googlePayload.email}`);
        user = await this.prisma.user.create({
          data: {
            email: googlePayload.email,
            namaLengkap: googlePayload.name || 'Google User',
            fotoProfil: googlePayload.picture,
            role: UserRole.USER,
            isVerified: true,
            nik: `GOOGLE_${Date.now()}`, // Unique NIK untuk Google users
            tanggalLahir: new Date('1990-01-01'), // Default tanggal lahir
            tempatLahir: 'Unknown',
            nomorTelepon: '000000000000',
            alamat: 'Unknown Address',
            kota: 'Unknown City',
            negara: 'Unknown',    // required by Prisma schema
            kodePos: '00000',     // required by Prisma schema
            rtRw: '00/00',        // required by Prisma schema
            instagram: null,
            facebook: null,
          }
        });
      }

      // Generate JWT token
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.namaLengkap,
      };

      const token = this.jwtService.sign(payload);

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.namaLengkap,
        role: user.role,
        picture: user.fotoProfil,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return {
        message: 'Google login successful',
        user: userResponse,
        access_token: token,
      };
    } catch (error) {
      this.logger.error('Google mobile login failed:', error);
      throw new UnauthorizedException(`Google authentication failed: ${error.message}`);
    }
  }

  // 🔐 VALIDATION METHOD
  async validateUser(payload: any) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub }
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        userId: user.id,
        email: user.email,
        name: user.namaLengkap,
        role: user.role,
      };
    } catch (error) {
      this.logger.error('Error in validateUser:', error);
      throw new UnauthorizedException('User validation failed');
    }
  }
}