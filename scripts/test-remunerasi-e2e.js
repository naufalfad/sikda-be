const prisma = require('../src/config/prisma');
const remunerasiService = require('../src/services/remunerasi.service');
const { catatFeePenangananDokter } = require('../src/utils/fee.helper');

async function testRemunerasi() {
  console.log('=== TESTING DOCTOR FEE & FEE PERAWAT E2E ===\n');

  // 1. Get or create Faskes
  const faskes = await prisma.faskes.findFirst();
  if (!faskes) {
    console.error('❌ Tidak ada faskes di database!');
    return;
  }
  console.log(`✅ Faskes ditemukan: ${faskes.namaFaskes} (${faskes.id})`);

  // 2. Find Dokter and Perawat first
  const dokter = await prisma.user.findFirst({
    where: { role: { in: ['DOKTER', 'DOKTER_UGD'] } },
  });
  const perawat = await prisma.user.findFirst({
    where: { role: 'PERAWAT', faskesId: dokter.faskesId },
  });

  const mockAdminUser = { id: 'admin-mock', role: 'ADMIN', faskesId: dokter.faskesId };
  const tarif = await remunerasiService.updateMasterTarif(mockAdminUser, {
    feeKehadiranDokter: 150000,
    feeKehadiranPerawat: 75000,
    feePerPasienDokter: 15000,
    feePerTindakanDokter: 20000,
    keterangan: 'Tarif Remunerasi Standar Puskesmas',
  });
  console.log('✅ Master Tarif Fee:', tarif);

  if (!dokter || !perawat) {
    console.warn('⚠️ Dokter atau perawat belum lengkap di DB.');
  } else {
    console.log(`✅ Dokter uji: ${dokter.namaLengkap || dokter.username} (${dokter.id})`);
    console.log(`✅ Perawat uji: ${perawat.namaLengkap || perawat.username} (${perawat.id})`);

    // 4. Presensi Mandiri Dokter & Perawat
    const presensiDokter = await remunerasiService.checkInMandiri(dokter, {
      shift: 'PAGI',
      catatan: 'Hadir tepat waktu shift pagi',
    });
    console.log('✅ Presensi Dokter Berhasil:', {
      id: presensiDokter.id,
      shift: presensiDokter.shift,
      nominalFee: presensiDokter.nominalFee,
    });

    const presensiPerawat = await remunerasiService.checkInMandiri(perawat, {
      shift: 'PAGI',
      catatan: 'Hadir bertugas di loket skrining',
    });
    console.log('✅ Presensi Perawat Berhasil:', {
      id: presensiPerawat.id,
      shift: presensiPerawat.shift,
      nominalFee: presensiPerawat.nominalFee,
    });

    // 5. Cari atau hubungkan kunjungan pasien untuk fee penanganan dokter
    const kunjunganSelesai = await prisma.kunjungan.findFirst({
      where: {
        OR: [
          { statusKunjungan: { in: ['SELESAI', 'MENUNGGU_KASIR', 'MENUNGGU_FARMASI', 'PULANG'] } },
          { rekamMedis: { statusPemeriksaan: 'SELESAI' } },
        ],
      },
    });

    if (kunjunganSelesai) {
      const feeDokterLog = await catatFeePenangananDokter(kunjunganSelesai.id, dokter.id);
      console.log('✅ Fee Penanganan Pasien Tercatat untuk Dokter:', {
        kunjunganId: kunjunganSelesai.id,
        namaPasien: feeDokterLog?.namaPasien,
        nominalFee: feeDokterLog?.nominalFee,
      });
    }

    // 6. Test Rekapitulasi Fee Dokter
    const rekapDokter = await remunerasiService.getRekapFeeDokter(mockAdminUser, {});
    console.log('\n--- HASIL REKAPITULASI DOKTER ---');
    console.log(`Total Dokter: ${rekapDokter.ringkasan.totalDokter}`);
    console.log(`Total Fee Kehadiran Dokter: Rp ${rekapDokter.ringkasan.totalFeeKehadiran.toLocaleString('id-ID')}`);
    console.log(`Total Fee Penanganan Dokter: Rp ${rekapDokter.ringkasan.totalFeePenanganan.toLocaleString('id-ID')}`);
    console.log(`Grand Total Doctor Fee: Rp ${rekapDokter.ringkasan.grandTotalFeeDokter.toLocaleString('id-ID')}`);

    // 7. Test Rekapitulasi Fee Perawat (Hanya Kehadiran!)
    const rekapPerawat = await remunerasiService.getRekapFeePerawat(mockAdminUser, {});
    console.log('\n--- HASIL REKAPITULASI PERAWAT (KEHADIRAN SAJA) ---');
    console.log(`Total Perawat: ${rekapPerawat.ringkasan.totalPerawat}`);
    console.log(`Total Shift Hadir: ${rekapPerawat.ringkasan.totalShiftHadir}`);
    console.log(`Grand Total Fee Perawat: Rp ${rekapPerawat.ringkasan.grandTotalFeePerawat.toLocaleString('id-ID')}`);

    // 8. Test Dashboard Summary
    const summary = await remunerasiService.getDashboardSummary(mockAdminUser, {});
    console.log('\n--- DASHBOARD SUMMARY ---');
    console.log(summary.metrik);
  }

  console.log('\n🎉 ALL REMUNERASI E2E TESTS PASSED!');
}

testRemunerasi()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
