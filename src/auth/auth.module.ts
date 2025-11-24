// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Convert string expiresIn to number of seconds
        const expiresInString = config.get<string>('JWT_EXPIRES_IN') || '1d';
        let expiresIn: number;

        // Convert time string to seconds
        if (expiresInString.endsWith('d')) {
          expiresIn = parseInt(expiresInString) * 24 * 60 * 60; // days to seconds
        } else if (expiresInString.endsWith('h')) {
          expiresIn = parseInt(expiresInString) * 60 * 60; // hours to seconds
        } else if (expiresInString.endsWith('m')) {
          expiresIn = parseInt(expiresInString) * 60; // minutes to seconds
        } else {
          expiresIn = parseInt(expiresInString) || 24 * 60 * 60; // default 1 day in seconds
        }

        return {
          secret: config.get<string>('JWT_SECRET') || 'mysecretkey',
          signOptions: {
            expiresIn: expiresIn, // ✅ Now it's a number
          },
        };
      },
    }),
    ConfigModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule { }