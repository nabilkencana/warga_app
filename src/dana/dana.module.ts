import { Module } from '@nestjs/common';
import { DanaService } from './dana.service';
import { DanaController } from './dana.controller';

@Module({
  controllers: [DanaController],
  providers: [DanaService],
})
export class DanaModule {}
