import { PrismaClient, UserRole } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const accounts = [
        {
            email: 'admin@wargaapp.id',
            role: UserRole.ADMIN,
            name: 'Admin Juri',
        },
        {
            email: 'satpam@wargaapp.id',
            role: UserRole.SATPAM,
            name: 'Satpam Juri',
        },
    ];

    for (const acc of accounts) {
        const exists = await prisma.user.findUnique({
            where: { email: acc.email },
        });

        if (!exists) {
            const user = await prisma.user.create({
                data: {
                    email: acc.email,
                    namaLengkap: acc.name,
                    role: acc.role,
                    isVerified: true,
                    isActive: true,
                    nik: `${acc.role}_DEMO`,
                    tanggalLahir: new Date('1990-01-01'),
                    tempatLahir: 'Indonesia',
                    nomorTelepon: '0800000000',
                    alamat: 'Demo Account',
                    kota: 'Jakarta',
                    negara: 'Indonesia',
                    kodePos: '00000',
                    rtRw: '00/00',
                },
            });

            if (acc.role === UserRole.SATPAM) {
                await prisma.security.create({
                    data: {
                        nama: acc.name,
                        nik: user.nik,
                        email: user.email,
                        nomorTelepon: '0800000000',
                        userId: user.id,
                        shift: 'FLEXIBLE',
                    },
                });
            }
        }
    }
}

main();
