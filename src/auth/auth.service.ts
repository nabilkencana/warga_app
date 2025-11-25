import { Injectable, UnauthorizedException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

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

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

      await this.prisma.user.update({
        where: { email },
        data: { otpCode: otp, otpExpire },
      });

      this.logger.log(`OTP generated for ${email}: ${otp}`);

      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: this.config.get('EMAIL_USER'),
            pass: this.config.get('EMAIL_PASS'),
          },
        });

        await transporter.sendMail({
          from: `"WargaApp" <${this.config.get('EMAIL_USER')}>`,
          to: email,
          subject: '🔐 Kode OTP untuk Login - WargaApp',
          html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 8px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 WargaApp</h1>
          <p>Kode Verifikasi Login Anda</p>
        </div>
        <div class="content">
          <h2>Halo!</h2>
          <p>Anda baru saja meminta kode OTP untuk login ke akun WargaApp. Gunakan kode berikut:</p>
          
          <div class="otp-code">${otp}</div>
          
          <div class="warning">
            <strong>⏰ Masa Berlaku:</strong> 5 menit<br>
            <br>  
            <strong>🔒 Jangan bagikan kode ini kepada siapapun!</strong>
          </div>
          
          <p>Jika Anda tidak meminta kode ini, silakan abaikan email ini.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 WargaApp. All rights reserved.</p>
          <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
        </div>
      </div>
    </body>
    </html>
  `,
          text: `Kode OTP Anda: ${otp}. Berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.`
        });

        this.logger.log(`OTP email sent successfully to: ${email}`);
        return { message: 'OTP berhasil dikirim ke email, Cek folder spam' };

      } catch (emailError) {
        this.logger.error(`Failed to send email to ${email}:`, emailError);
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