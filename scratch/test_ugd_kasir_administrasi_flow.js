const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ugdService = require('../src/services/ugd.service');
const kasirService = require('../src/services/kasir.service');

async function testFlow() {
  console.log('=== TEST SIMULASI FLOW UGD -> KASIR -> LOKET ADMINISTRASI -> KASIR ===');

  // 1. Ambil faskes & user dokter UGD & user petugas pendaftaran
  const faskes = await prisma.faskes.findFirst();
  const dokter = await prisma.user.findFirst({ where: { role: { in: ['DOKTER', 'DOKTER_UGD'] } } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMINISTRASI' } });
  const icd9 = await prisma.masterICD9.findFirst();
  const icd10 = await prisma.masterICD10.findFirst();
  const obat = await prisma.masterObat.findFirst();
  const bedUgd = await prisma.tempatTidur.findFirst({
    where: { 
      statusBed: 'TERSEDIA',
      ruangan: { kategoriRuangan: { in: ['UGD', 'RAWAT_INAP'] } } 
    },
    include: { ruangan: true }
  });
  const existingPasien = await prisma.pasien.findFirst({
    where: { nik: { not: null } }
  });

  if (!faskes || !dokter || !icd9 || !icd10 || !obat || !existingPasien) {
    throw new Error('Data master tidak lengkap untuk menjalankan test.');
  }

  console.log(`Faskes: ${faskes.namaFaskes}`);
  console.log(`Dokter: ${dokter.namaLengkap || dokter.username}`);
  console.log(`Pasien Terdaftar Target: ${existingPasien.namaLengkap} (NIK: ${existingPasien.nik})`);
  console.log(`Tindakan ICD-9: ${icd9.kode_icd9} - ${icd9.nama_prosedur}`);
  console.log(`BMHP/Obat: ${obat.namaObat}`);

  // 2. Admit Pasien UGD Baru (Anonim)
  const admitPayload = {
    tempatTidurId: bedUgd?.id,
    triase: 'MERAH',
    keluhanUtama: 'Pasien kecelakaan tidak sadarkan diri (Anonim)',
    isAnonim: true,
    namaPasien: 'Mr. X Anonim UGD',
    jenisKelamin: 'LAKI_LAKI',
    dokterId: dokter.id,
    faskesId: faskes.id,
    tandaVital: {
      sistole: 110,
      diastole: 70,
      nadi: 88,
      suhu: 36.5,
      pernapasan: 20,
      spo2: 98
    }
  };

  const admitRes = await ugdService.admitPasienDarurat(admitPayload, { ...dokter, faskesId: faskes.id });
  const kunjungan = admitRes.kunjungan;
  const kunjunganId = kunjungan.id;
  const anonimPasienId = kunjungan.pasienId;
  console.log(`\n1. Kunjungan UGD Dibuat: ${kunjunganId}`);
  console.log(`   Pasien Anonim ID: ${anonimPasienId}`);

  // 3. Simpan SOAP, Diagnosa, Tindakan (ICD-9 + BMHP + Alkes), Resep, dan Pulang
  const soapPayload = {
    keluhanUtama: 'Luka robek di lengan kanan, perdarahan aktif',
    riwayatPenyakit: 'Kecelakaan lalu lintas tunggal',
    pemeriksaanFisik: 'Status lokalis: vulnus laceratum regio antebrachii dextra 5cm',
    rencanaTerapi: 'Hecting luka, ATS, antibiotik profilaksis',
    instruksiMedis: 'Observasi 1 jam, ganti verban 2 hari lagi',
    keputusan: 'PULANG',
    diagnosaList: [
      { icd10Id: icd10.id_icd10, isPrimary: true, catatan: 'Vulnus laceratum' }
    ],
    tindakanList: [
      {
        icd9Id: icd9.id_icd9,
        catatan: 'Penjahitan luka 5 jahitan',
        bmhpDetails: [
          { obatId: obat.id, namaItem: obat.namaObat, jumlah: 2, hargaSatuan: 15000, subTotal: 30000 }
        ],
        alkesDetails: [
          { asetId: 'aset-minor-set', namaAset: 'Set Bedah Minor UGD', tarifPemakaian: 35000 }
        ]
      }
    ],
    resepList: [
      { obatId: obat.id, jumlah: 10, dosis: '500mg', aturanPakai: '3 x 1 sehari' }
    ]
  };

  // Simpan pemeriksaan medis UGD
  await ugdService.simpanPemeriksaanUGD(kunjunganId, soapPayload, dokter);

  // Simpan resep ke kunjungan juga (seperti yang dilakukan rawat jalan / UGD)
  await prisma.resep.create({
    data: {
      kunjunganId,
      pasienId: anonimPasienId,
      dokterId: dokter.id,
      status: 'MENUNGGU_FARMASI',
      details: {
        create: [
          { obatId: obat.id, jumlah: 10, aturanPakai: '3 x 1 sehari' }
        ]
      }
    }
  });

  console.log('2. Pemeriksaan UGD Selesai (SOAP, Diagnosa, Tindakan + BMHP + Alkes, Resep tersimpan)');

  // 4. Cek Tagihan Kasir Pertama (Saat pasien masih Anonim)
  const tagihanAwal = await kasirService.generateTagihan(kunjunganId);
  console.log('\n3. TAGIHAN AWAL (Pasien Masih Anonim):');
  console.log(`   Total Biaya: Rp ${tagihanAwal.totalBiaya.toLocaleString('id-ID')}`);
  tagihanAwal.details.forEach((d, i) => {
    console.log(`   ${i + 1}. [${d.kategori}] ${d.namaItem} x${d.jumlah} = Rp ${d.subTotal.toLocaleString('id-ID')}`);
  });

  const countTindakanAwal = tagihanAwal.details.filter(d => d.kategori === 'Tindakan').length;
  const countAlkesAwal = tagihanAwal.details.filter(d => d.kategori === 'Alat Kesehatan').length;
  const countBmhpAwal = tagihanAwal.details.filter(d => d.kategori === 'BMHP').length;
  const countObatAwal = tagihanAwal.details.filter(d => d.kategori.includes('Obat')).length;

  console.log(`\n   Rincian: Tindakan: ${countTindakanAwal}, Alkes: ${countAlkesAwal}, BMHP: ${countBmhpAwal}, Obat: ${countObatAwal}`);

  // 5. Petugas Loket Melengkapi Administrasi (Menautkan ke Pasien Terdaftar: existingPasien)
  console.log('\n4. Loket melengkapi administrasi ke pasien definitif...');
  const lengkapiPayload = {
    existingPasienId: existingPasien.id,
    nik: existingPasien.nik,
    namaLengkap: existingPasien.namaLengkap,
    jenisPenjamin: 'Umum'
  };

  await ugdService.lengkapiAdministrasi(kunjunganId, lengkapiPayload, admin || dokter);
  console.log('   Administrasi UGD berhasil diselesaikan di Loket!');

  // 6. Cek Data di Database: Apakah tindakan & diagnosa masih hidup?
  const tindakanCheck = await prisma.tindakanPasien.findMany({ where: { kunjunganId } });
  const diagnosaCheck = await prisma.diagnosisPasien.findMany({ where: { kunjunganId } });
  const resepCheck = await prisma.resep.findMany({ where: { kunjunganId } });
  const kunjunganCheck = await prisma.kunjungan.findUnique({ where: { id: kunjunganId } });

  console.log('\n5. VERIFIKASI INTEGRITAS DATA DI DATABASE:');
  console.log(`   Kunjungan Pasien ID sekarang: ${kunjunganCheck.pasienId} (Target: ${existingPasien.id})`);
  console.log(`   TindakanPasien tersisa di DB: ${tindakanCheck.length} record (pasienId: ${tindakanCheck[0]?.pasienId})`);
  console.log(`   DiagnosisPasien tersisa di DB: ${diagnosaCheck.length} record (pasienId: ${diagnosaCheck[0]?.pasienId})`);
  console.log(`   Resep tersisa di DB: ${resepCheck.length} record (pasienId: ${resepCheck[0]?.pasienId})`);

  // 7. Kasir Menampilkan Tagihan Pasien Setelah Administrasi Lengkap
  const tagihanAkhir = await kasirService.generateTagihan(kunjunganId);
  console.log('\n6. TAGIHAN AKHIR DI KASIR SETELAH LENGKAPI ADMINISTRASI:');
  console.log(`   Total Biaya: Rp ${tagihanAkhir.totalBiaya.toLocaleString('id-ID')}`);
  tagihanAkhir.details.forEach((d, i) => {
    console.log(`   ${i + 1}. [${d.kategori}] ${d.namaItem} x${d.jumlah} = Rp ${d.subTotal.toLocaleString('id-ID')}`);
  });

  const countTindakanAkhir = tagihanAkhir.details.filter(d => d.kategori === 'Tindakan').length;
  const countAlkesAkhir = tagihanAkhir.details.filter(d => d.kategori === 'Alat Kesehatan').length;
  const countBmhpAkhir = tagihanAkhir.details.filter(d => d.kategori === 'BMHP').length;
  const countObatAkhir = tagihanAkhir.details.filter(d => d.kategori.includes('Obat')).length;

  console.log('\n=== HASIL VALIDASI AKHIR SKENARIO A ===');
  if (
    countTindakanAkhir === countTindakanAwal &&
    countAlkesAkhir === countAlkesAwal &&
    countBmhpAkhir === countBmhpAwal &&
    countObatAkhir >= countObatAwal &&
    tagihanAkhir.totalBiaya === tagihanAwal.totalBiaya
  ) {
    console.log('✅ SUKSES 100% SKENARIO A! Seluruh tindakan, sewa alkes, BMHP, dan obat TETAP UTUH dan TIDAK HILANG!');
  } else {
    console.error('❌ GAGAL SKENARIO A! Ada item yang hilang setelah lengkapi administrasi!');
  }

  // Cleanup test visit Skenario A
  await prisma.detailTagihan.deleteMany({ where: { tagihanId: tagihanAkhir.id } });
  await prisma.tagihan.delete({ where: { id: tagihanAkhir.id } });
  await prisma.tindakanPasien.deleteMany({ where: { kunjunganId } });
  await prisma.diagnosisPasien.deleteMany({ where: { kunjunganId } });
  for (const r of resepCheck) {
    await prisma.resepDetail.deleteMany({ where: { resepId: r.id } });
    await prisma.resep.delete({ where: { id: r.id } });
  }
  await prisma.screening.deleteMany({ where: { kunjunganId } });
  await prisma.rekamMedis.deleteMany({ where: { kunjunganId } });
  await prisma.kunjungan.delete({ where: { id: kunjunganId } });
  console.log('Test record Skenario A cleaned up successfully.');

  // ==========================================
  // TEST SKENARIO B: Pasien Baru (NIK Belum Terdaftar)
  // ==========================================
  console.log('\n=== TEST SKENARIO B: PASIEN BARU RESMI (NIK BARU) ===');
  const admitResB = await ugdService.admitPasienDarurat(admitPayload, { ...dokter, faskesId: faskes.id });
  const kunjunganB = admitResB.kunjungan;
  const kunjunganIdB = kunjunganB.id;

  await ugdService.simpanPemeriksaanUGD(kunjunganIdB, soapPayload, dokter);

  const tagihanAwalB = await kasirService.generateTagihan(kunjunganIdB);
  console.log(`Tagihan Awal Pasien Anonim: Rp ${tagihanAwalB.totalBiaya.toLocaleString('id-ID')}`);

  const uniqueNik = `3201${Date.now().toString().slice(-12)}`;
  const lengkapiPayloadB = {
    nik: uniqueNik,
    namaLengkap: 'Pasien Baru Resmi UGD',
    tempatLahir: 'Bogor',
    tanggalLahir: '1995-05-15',
    jenisKelamin: 'Laki-laki',
    alamatKtp: 'Jl. Merdeka No. 12',
    noHp: '081234567890',
    jenisPenjamin: 'Umum'
  };

  await ugdService.lengkapiAdministrasi(kunjunganIdB, lengkapiPayloadB, admin || dokter);
  console.log('Administrasi Pasien Baru Berhasil Diselesaikan di Loket!');

  const tagihanAkhirB = await kasirService.generateTagihan(kunjunganIdB);
  console.log(`Tagihan Akhir Pasien Baru: Rp ${tagihanAkhirB.totalBiaya.toLocaleString('id-ID')}`);

  if (tagihanAkhirB.totalBiaya === tagihanAwalB.totalBiaya) {
    console.log('✅ SUKSES 100% SKENARIO B! Pasien Baru resmi mempertahankan seluruh tindakan & tagihan secara utuh!');
  } else {
    console.error('❌ GAGAL SKENARIO B!');
  }

  // Cleanup Skenario B
  await prisma.detailTagihan.deleteMany({ where: { tagihanId: tagihanAkhirB.id } });
  await prisma.tagihan.delete({ where: { id: tagihanAkhirB.id } });
  await prisma.tindakanPasien.deleteMany({ where: { kunjunganId: kunjunganIdB } });
  await prisma.diagnosisPasien.deleteMany({ where: { kunjunganId: kunjunganIdB } });
  await prisma.screening.deleteMany({ where: { kunjunganId: kunjunganIdB } });
  await prisma.rekamMedis.deleteMany({ where: { kunjunganId: kunjunganIdB } });
  await prisma.kunjungan.delete({ where: { id: kunjunganIdB } });
  await prisma.alamatPasien.deleteMany({ where: { pasienId: kunjunganB.pasienId } });
  await prisma.kontakPasien.deleteMany({ where: { pasienId: kunjunganB.pasienId } });
  await prisma.penjaminPasien.deleteMany({ where: { pasienId: kunjunganB.pasienId } });
  await prisma.pasien.delete({ where: { id: kunjunganB.pasienId } });
  console.log('Test record Skenario B cleaned up successfully.');
}

testFlow()
  .catch(err => {
    console.error('Test error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
