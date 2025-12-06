import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { User } from '@prisma/client';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: User;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/users/:id (GET)', () => {
    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          namaLengkap: 'Test User',
          nik: '1234567890123456',
          tanggalLahir: new Date(),
          tempatLahir: 'Test City',
          email: 'test.user@example.com',
          nomorTelepon: '081234567890',
          alamat: 'Test Address',
          kota: 'Test City',
          negara: 'Test Country',
          kodePos: '12345',
          rtRw: '001/001',
        },
      });
    });

    afterEach(async () => {
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should return a user when a valid ID is provided', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
    });

    it('should return a 404 error when an invalid ID is provided', async () => {
      await request(app.getHttpServer())
        .get('/users/999999')
        .expect(404);
    });
  });
});