// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Supaya bisa diakses dari mana saja tanpa import manual
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule { }
