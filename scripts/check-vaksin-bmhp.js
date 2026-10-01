const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== VAKSIN DATA ===');
  const vaksinCount = await prisma.masterVaksin.count();
  const batchCount = await prisma.batchVaksin.count();
  console.log('MasterVaksin count:', vaksinCount);
  console.log('BatchVaksin count:', batchCount);
  const vaksins = await prisma.masterVaksin.findMany({ include: { batchVaksin: true } });
  console.log('Vaksins:', JSON.stringify(vaksins, null, 2));

  console.log('=== MASTER OBAT / BMHP DATA ===');
  const obatList = await prisma.masterObat.findMany();
  console.log('Total Master Obat:', obatList.length);
  const categories = [...new Set(obatList.map(o => o.kategori))];
  console.log('Kategori yang ada:', categories);

  console.log('=== FASKES LIST ===');
  const faskesList = await prisma.faskes.findMany({ select: { id: true, namaFaskes: true, kodeFaskes: true } });
  console.log('Faskes:', faskesList);
}

main().catch(console.error).finally(() => prisma.$disconnect());
