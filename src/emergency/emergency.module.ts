// src/emergency/emergency.module.ts
import { Module } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [EmergencyController],
    providers: [EmergencyService, PrismaService],
    exports: [EmergencyService],
})
export class EmergencyModule { }