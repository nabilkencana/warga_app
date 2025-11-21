// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS untuk frontend
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();