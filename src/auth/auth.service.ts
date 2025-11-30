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
  googleMobileLogin(body: any) {
    throw new Error('Method not implemented.');
  }
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

    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  // ============================================================
  // 📌 SEND OTP VIA RESEND (NO MORE SMTP)
  // ============================================================
  async sendOtp(email: string) {
    try {
      this.logger.log(`Attempting to send OTP to: ${email}`);

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedException('Email tidak ditemukan');

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpire = new Date(Date.now() + 5 * 60 * 1000);

      await this.prisma.user.update({
        where: { email },
        data: { otpCode: otp, otpExpire },
      });

      this.logger.log(`OTP generated for ${email}: ${otp}`);

      // EMAIL TEMPLATE HTML
      const htmlTemplate = `
      <div style="font-family: Arial; padding: 20px; background: #f4f4f4;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
          <div style="background: #667eea; color: #fff; padding: 20px; text-align: center;">
            <h2>🔐 WargaKita</h2>
            <p>Kode OTP Login Anda</p>
          </div>
          <div style="padding: 20px;">
            <p>Halo, berikut kode OTP Anda:</p>
            <h1 style="text-align: center; letter-spacing: 8px; color: #667eea;">${otp}</h1>
            <p style="background: #fff3cd; padding: 10px; border-radius: 6px;">
              Berlaku selama <strong>5 menit</strong>
            </p>
            <p>Jangan bagikan kode ini kepada siapapun.</p>
          </div>
          <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px;">
            © ${new Date().getFullYear()} WargaKita App
          </div>
        </div>
      </div>
      `;

      try {
        await this.resend.emails.send({
          from: this.config.get('RESEND_FROM_EMAIL') || 'WargaKita <no-reply@wargakita.dev>',
          to: email,
          subject: 'Kode OTP Login - WargaKita',
          html: htmlTemplate,
        });

        this.logger.log(`OTP email sent successfully to: ${email}`);
        return { message: 'OTP berhasil dikirim ke email (cek spam juga)' };

      } catch (emailError) {
        this.logger.error(`Failed to send email to ${email}:`, emailError);
        throw new InternalServerErrorException('Gagal mengirim OTP via email');
      }

    } catch (error) {
      this.logger.error(`Error in sendOtp for ${email}:`, error);
      throw new InternalServerErrorException('Gagal mengirim OTP');
    }
  }

  // ============================================================
  // 📌 VERIFY OTP
  // ============================================================
  async verifyOtp(email: string, otp: string) {
    try {
      this.logger.log(`Verifying OTP for: ${email}`);

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedException('Email tidak ditemukan');
      if (user.otpCode !== otp) throw new UnauthorizedException('OTP salah');
      if (!user.otpExpire || user.otpExpire < new Date()) throw new UnauthorizedException('OTP sudah kadaluarsa');

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.namaLengkap,
      };

      const token = this.jwtService.sign(payload);

      await this.usersService.clearOtp(email);

      return {
        message: 'Login berhasil',
        user: {
          id: user.id,
          email: user.email,
          name: user.namaLengkap,
          role: user.role,
        },
        access_token: token,
      };

    } catch (error) {
      this.logger.error(`Error in verifyOtp for ${email}:`, error);
      throw new InternalServerErrorException('Gagal memverifikasi OTP');
    }
  }

  // ============================================================
  // 📌 GOOGLE OAUTH (NO CHANGES)
  // ============================================================

  async googleLogin(req: any) {
    try {
      if (!req.user) throw new BadRequestException('No user data from Google');

      const googleUser = req.user;

      let user = await this.prisma.user.findUnique({
        where: { email: googleUser.email }
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            namaLengkap: `${googleUser.firstName} ${googleUser.lastName}`.trim(),
            nik: `GOOGLE_${Date.now()}`,
            tanggalLahir: new Date('1990-01-01'),
            tempatLahir: 'Unknown',
            nomorTelepon: '000000000000',
            alamat: 'Unknown Address',
            kota: 'Unknown City',
            negara: 'Unknown',
            kodePos: '00000',
            rtRw: '00/00',
            role: UserRole.USER,
            isVerified: true,
          }
        });
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.namaLengkap,
      };

      const token = this.jwtService.sign(payload);

      return {
        message: 'Google login successful',
        user,
        access_token: token,
      };

    } catch (error) {
      this.logger.error('Error in googleLogin:', error);
      throw new InternalServerErrorException('Google login failed');
    }
  }

  // ============================================================
  // 📌 VALIDATION
  // ============================================================
  async validateUser(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
