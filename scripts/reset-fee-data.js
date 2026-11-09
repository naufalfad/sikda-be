const prisma = require('../src/config/prisma');

async function resetFeeData() {
  console.log('=== MEMULAI PEMBERSIHAN DATA SEEDER FEE DOKTER & PERAWAT ===');

  try {
    // 1. Hapus seluruh data LogFeeDokter
    const deletedLogs = await prisma.logFeeDokter.deleteMany({});
    console.log(`✅ Berhasil menghapus ${deletedLogs.count} data riwayat Fee Penanganan Pasien (LogFeeDokter).`);

    // 2. Hapus seluruh data PresensiNakes
    const deletedPresensi = await prisma.presensiNakes.deleteMany({});
    console.log(`✅ Berhasil menghapus ${deletedPresensi.count} data riwayat Presensi Shift Nakes (PresensiNakes).`);

    // 3. Verifikasi jumlah data terkini
    const countLogs = await prisma.logFeeDokter.count();
    const countPresensi = await prisma.presensiNakes.count();
    const countTarif = await prisma.masterTarifFee.count();

    console.log('\n=== STATUS DATA REMUNERASI TERKINI ===');
    console.log(`- LogFeeDokter : ${countLogs} record (BERSIH)`);
    console.log(`- PresensiNakes: ${countPresensi} record (BERSIH)`);
    console.log(`- MasterTarifFee: ${countTarif} konfigurasi aktif (DIRETENSI UNTUK PERHITUNGAN REAL CASE)`);
    console.log('\nSistem siap digunakan untuk pengisian fee dokter dan perawat kasus nyata (real case) mulai hari ini!');
  } catch (error) {
    console.error('❌ Gagal membersihkan data remunerasi:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetFeeData();

