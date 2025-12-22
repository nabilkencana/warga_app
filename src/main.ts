// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { IoAdapter } from '@nestjs/platform-socket.io';

// class SocketIoAdapter extends IoAdapter {
//   createIOServer(port: number, options?: any): any {
//     const server = super.createIOServer(port, {
//       ...options,
//       cors: {
//         origin: '*',
//         methods: ['GET', 'POST'],
//         credentials: true,
//       },
//       transports: ['websocket', 'polling'],
//       allowEIO3: true,
//       pingTimeout: 60000,
//       pingInterval: 25000,
//     });

//     return server;
//   }
// }
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS untuk semua origin (development only)
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'https://wargakita.canadev.my.id'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 1922;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`========================================`);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🔌 REST API available at: http://localhost:${port}/api`);
  logger.log(`📡 WebSocket available at: ws://localhost:${port}/notifications`);
  logger.log(`📊 Health check: http://localhost:${port}/api/health`);
  logger.log(`========================================`);

  // Log environment
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
}
bootstrap();