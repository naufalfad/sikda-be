const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { seedPemeriksaanLengkap } = require('./seed-pemeriksaan-lengkap');

async function main() {
  console.log('Memulai seeder Master Alergi & Penunjang...');
  await seedPemeriksaanLengkap();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

