const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = [
    { kodeObat: 'OBT-001', namaObat: 'Paracetamol 500mg', kategori: 'Obat Bebas', sediaan: 'Tablet', harga: 5000, kfa_code: '93001234' },
    { kodeObat: 'OBT-002', namaObat: 'Amoxicillin 500mg', kategori: 'Obat Keras', sediaan: 'Kapsul', harga: 12000, kfa_code: '93001235' },
    { kodeObat: 'OBT-003', namaObat: 'Ibuprofen 400mg', kategori: 'Obat Bebas Terbatas', sediaan: 'Tablet', harga: 8000, kfa_code: '93001236' },
    { kodeObat: 'OBT-004', namaObat: 'Cetirizine 10mg', kategori: 'Obat Bebas Terbatas', sediaan: 'Tablet', harga: 6000, kfa_code: '93001237' },
    { kodeObat: 'OBT-005', namaObat: 'Antasida Doen', kategori: 'Obat Bebas', sediaan: 'Tablet Kunyah', harga: 3000, kfa_code: '93001238' }
  ];

  for (const item of data) {
    await prisma.masterObat.upsert({
      where: { kodeObat: item.kodeObat },
      update: { kfa_code: item.kfa_code },
      create: item,
    });
  }

  console.log('Seed obat success');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
