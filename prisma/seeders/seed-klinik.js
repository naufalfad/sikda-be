const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Menjalankan seeder untuk Poliklinik dan Dokter...');

  // 1. Buat Poliklinik
  let poliUmum = await prisma.poliklinik.findFirst({ where: { kodePoli: 'POLI-UMUM' } });
  if (!poliUmum) {
    poliUmum = await prisma.poliklinik.create({
      data: {
        kodePoli: 'POLI-UMUM',
        namaPoli: 'Poli Umum',
        deskripsi: 'Pelayanan pemeriksaan umum',
      }
    });
  }

  let poliGigi = await prisma.poliklinik.findFirst({ where: { kodePoli: 'POLI-GIGI' } });
  if (!poliGigi) {
    poliGigi = await prisma.poliklinik.create({
      data: {
        kodePoli: 'POLI-GIGI',
        namaPoli: 'Poli Gigi',
        deskripsi: 'Pelayanan kesehatan gigi dan mulut',
      }
    });
  }

  let poliKia = await prisma.poliklinik.findFirst({ where: { kodePoli: 'POLI-KIA' } });
  if (!poliKia) {
    poliKia = await prisma.poliklinik.create({
      data: {
        kodePoli: 'POLI-KIA',
        namaPoli: 'Poli KIA (Ibu & Anak)',
        deskripsi: 'Kesehatan Ibu dan Anak',
      }
    });
  }

  // 2. Buat Data Dokter (Admin yang menginput, bukan daftar sendiri)
  const passwordHash = await bcrypt.hash('dokter123', 10);

  // Dokter di Poli Umum
  await prisma.user.upsert({
    where: { username: 'dr.andi' },
    update: { poliklinikId: poliUmum.id },
    create: {
      username: 'dr.andi', // Nama lengkapnya bisa disesuaikan nanti
      password: passwordHash,
      role: 'DOKTER',
      poliklinikId: poliUmum.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'dr.siti' },
    update: { poliklinikId: poliUmum.id },
    create: {
      username: 'dr.siti',
      password: passwordHash,
      role: 'DOKTER',
      poliklinikId: poliUmum.id,
    },
  });

  // Dokter di Poli Gigi
  await prisma.user.upsert({
    where: { username: 'drg.budi' },
    update: { poliklinikId: poliGigi.id },
    create: {
      username: 'drg.budi',
      password: passwordHash,
      role: 'DOKTER',
      poliklinikId: poliGigi.id,
    },
  });

  console.log('Seeder selesai! Data Poli dan Dokter sudah masuk ke database.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
