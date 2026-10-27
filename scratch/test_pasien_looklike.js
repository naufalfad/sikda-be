const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pasienService = require('../src/services/pasien.service');

async function testLookLike() {
  console.log('=== TEST LOOK-LIKE PENCARIAN PASIEN ===\n');

  // 1. Ambil salah satu pasien yang ada di database untuk referensi nama
  const sample = await prisma.pasien.findFirst({
    include: { alamat: true }
  });

  if (!sample) {
    console.log('Tidak ada pasien di database untuk ditest.');
    return;
  }

  console.log(`Pasien referensi: "${sample.namaLengkap}" (NIK: ${sample.nik}, NoRM: ${sample.noRM})`);

  // Buat substring nama tengah atau belakang
  const words = sample.namaLengkap.trim().split(/\s+/);
  const searchTerm = words.length > 1 ? words[words.length - 1] : words[0].substring(1, 4);

  console.log(`Melakukan pencarian substring/look-like: "${searchTerm}"...`);
  const suggestions = await pasienService.getPasienSuggestions(searchTerm, null, null, 5);

  console.log(`Hasil suggestions (${suggestions.length} ditemukan):`);
  suggestions.forEach((p, idx) => {
    console.log(`[${idx + 1}] Nama: ${p.namaLengkap} | Usia: ${p.umurText} | NIK: ${p.nik} | NoRM: ${p.noRM}`);
    console.log(`    Alamat: ${p.alamat?.alamatKtp || p.alamat?.alamatDomisili || '-'}`);
  });

  const matched = suggestions.some(p => p.id === sample.id);
  console.log(`\nStatus match: ${matched ? '✓ BERHASIL DITEMUKAN' : '✗ GAGAL'}`);
}

testLookLike()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
