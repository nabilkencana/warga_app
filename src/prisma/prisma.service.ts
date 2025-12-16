  // src/prisma/prisma.service.ts
  import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
  import { PrismaClient } from '@prisma/client';

  @Injectable()
  export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    
    constructor() {
      super({
        log: ['query', 'info', 'warn', 'error'],
        errorFormat: 'colorless',
        // ✅ Optimasi connection pool
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });
    }

    async onModuleInit() {
      await this.$connect();
      console.log('✅ Prisma connected to database');
    }

    async onModuleDestroy() {
      await this.$disconnect();
      console.log('❌ Prisma disconnected from database');
    }

    // ✅ Handle clean shutdown
    async enableShutdownHooks() {
      process.on('beforeExit', async () => {
        await this.$disconnect();
      });
    }
  }