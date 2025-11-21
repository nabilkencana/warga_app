import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) { }

  async sendOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Email tidak ditemukan');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    await this.prisma.user.update({
      where: { email },
      data: { otpCode: otp, otpExpire },
    });

    try {
      // 🔥 Gmail Transporter
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // gunakan TLS
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

      return { message: 'OTP berhasil dikirim ke email , Cek folder spam' };
    } catch (error) {
      console.error('Gagal mengirim email:', error);
      throw new InternalServerErrorException('Gagal mengirim OTP');
    }
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.otpCode !== otp)
      throw new UnauthorizedException('OTP salah');
    if (!user.otpExpire || user.otpExpire < new Date())
      throw new UnauthorizedException('OTP sudah kadaluarsa');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1d',
    });

    // Reset OTP setelah berhasil login
    await this.usersService.clearOtp(email);

    // Kembalikan data user yang lengkap (tanpa password dan OTP)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.namaLengkap,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      message: 'Login berhasil',
      user: userResponse, // Pastikan ini ada
      access_token: token,
    };
  }
}
