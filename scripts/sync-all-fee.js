const prisma = require('../src/config/prisma');
const remunerasiService = require('../src/services/remunerasi.service');

async function syncAll() {
  const faskesList = await prisma.faskes.findMany();
  for (const f of faskesList) {
    const res = await remunerasiService.syncKunjunganToFeeDokter({ faskesId: f.id, role: 'ADMIN' });
    console.log(`Faskes ${f.namaFaskes}: disinkronkan ${res.totalDisinkronkan} dari ${res.totalKunjunganDitemukan} kunjungan.`);
  }
}

syncAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

