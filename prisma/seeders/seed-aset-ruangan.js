const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAsetRuangan() {
  console.log('🚀 Memulai Seeding Master Ruangan, Tempat Tidur, Aset, & Pemeliharaan...');

  // 1. Ambil relasi poli dan user admin
  const poliUmum = await prisma.poliklinik.findUnique({ where: { kodePoli: 'UMUM' } });
  const poliGigi = await prisma.poliklinik.findUnique({ where: { kodePoli: 'GIGI' } });
  const poliKia = await prisma.poliklinik.findUnique({ where: { kodePoli: 'KIA' } });
  const poliRad = await prisma.poliklinik.findUnique({ where: { kodePoli: 'RAD' } });
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });

  // 2. Seed Master Ruangan
  const ruanganData = [
    {
      kodeRuangan: 'R-POLI-UMUM',
      namaRuangan: 'Ruang Pemeriksaan Umum (Poli 1)',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'RAWAT_JALAN',
      deskripsi: 'Ruangan pelayanan pemeriksaan dokter umum',
      poliklinikId: poliUmum?.id,
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-Umum-01'
    },
    {
      kodeRuangan: 'R-POLI-GIGI',
      namaRuangan: 'Ruang Pelayanan Gigi & Mulut',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'RAWAT_JALAN',
      deskripsi: 'Ruang tindakan dental care',
      poliklinikId: poliGigi?.id,
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-Gigi-01'
    },
    {
      kodeRuangan: 'R-POLI-KIA',
      namaRuangan: 'Ruang KIA, KB & Imunisasi',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'RAWAT_JALAN',
      deskripsi: 'Pemeriksaan antenatal care (ANC) dan tumbuh kembang anak',
      poliklinikId: poliKia?.id,
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-KIA-01'
    },
    {
      kodeRuangan: 'R-IGD',
      namaRuangan: 'Ruang Tindakan & Gawat Darurat (IGD)',
      lantai: 'Lantai 1',
      gedung: 'Gedung Gawat Darurat',
      kategoriRuangan: 'IGD',
      deskripsi: 'Instalasi gawat darurat dan resusitasi 24 jam',
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-IGD-01'
    },
    {
      kodeRuangan: 'R-INAP-MELATI',
      namaRuangan: 'Ruang Rawat Inap Melati (Dewasa)',
      lantai: 'Lantai 2',
      gedung: 'Gedung Rawat Inap',
      kategoriRuangan: 'RAWAT_INAP',
      deskripsi: 'Bangsal perawatan umum dewasa pria & wanita',
      penanggungJawabId: adminUser?.id,
      physicalType: 'wa',
      ihsLocationId: 'Loc-Ward-Melati-01'
    },
    {
      kodeRuangan: 'R-INAP-MAWAR',
      namaRuangan: 'Ruang Rawat Inap Mawar (Isolasi)',
      lantai: 'Lantai 2',
      gedung: 'Gedung Rawat Inap',
      kategoriRuangan: 'RAWAT_INAP',
      deskripsi: 'Ruang perawatan isolasi infeksi menular (TB/Airborne)',
      penanggungJawabId: adminUser?.id,
      physicalType: 'wa',
      ihsLocationId: 'Loc-Ward-Mawar-01'
    },
    {
      kodeRuangan: 'R-FARMASI',
      namaRuangan: 'Ruang Farmasi & Depo Obat',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'PENUNJANG_MEDIS',
      deskripsi: 'Pelayanan resep obat dan peracikan farmasi',
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-Farmasi-01'
    },
    {
      kodeRuangan: 'R-LAB',
      namaRuangan: 'Ruang Laboratorium Sederhana',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'PENUNJANG_MEDIS',
      deskripsi: 'Pemeriksaan hematologi, kimia darah, dan BTA sputum',
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-Lab-01'
    },
    {
      kodeRuangan: 'R-RAD',
      namaRuangan: 'Ruang Radiografi & USG',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'PENUNJANG_MEDIS',
      deskripsi: 'Pemeriksaan foto rontgen dan sonografi',
      poliklinikId: poliRad?.id,
      penanggungJawabId: adminUser?.id,
      physicalType: 'ro',
      ihsLocationId: 'Loc-Room-Rad-01'
    }
  ];

  const ruanganMap = {};
  for (const r of ruanganData) {
    const created = await prisma.masterRuangan.upsert({
      where: { kodeRuangan: r.kodeRuangan },
      update: {
        namaRuangan: r.namaRuangan,
        lantai: r.lantai,
        gedung: r.gedung,
        kategoriRuangan: r.kategoriRuangan,
        deskripsi: r.deskripsi,
        poliklinikId: r.poliklinikId,
        penanggungJawabId: r.penanggungJawabId,
        physicalType: r.physicalType,
        ihsLocationId: r.ihsLocationId
      },
      create: r
    });
    ruanganMap[r.kodeRuangan] = created;
  }
  console.log(`✅ ${ruanganData.length} Master Ruangan berhasil di-seed.`);

  // 3. Seed Tempat Tidur (Bed Management)
  const bedData = [
    // IGD
    { ruanganId: ruanganMap['R-IGD'].id, nomorBed: 'BED-IGD-01', kelasKamar: 'NON_KELAS_IGD', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-IGD-01' },
    { ruanganId: ruanganMap['R-IGD'].id, nomorBed: 'BED-IGD-02', kelasKamar: 'NON_KELAS_IGD', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-IGD-02' },
    { ruanganId: ruanganMap['R-IGD'].id, nomorBed: 'BED-IGD-03', kelasKamar: 'NON_KELAS_IGD', statusBed: 'PERBAIKAN', operationalStatus: 'C', ihsLocationId: 'Loc-Bed-IGD-03' },
    // Rawat Inap Melati
    { ruanganId: ruanganMap['R-INAP-MELATI'].id, nomorBed: 'BED-MELATI-01', kelasKamar: 'KELAS_1', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-Melati-01' },
    { ruanganId: ruanganMap['R-INAP-MELATI'].id, nomorBed: 'BED-MELATI-02', kelasKamar: 'KELAS_1', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-Melati-02' },
    { ruanganId: ruanganMap['R-INAP-MELATI'].id, nomorBed: 'BED-MELATI-03', kelasKamar: 'KELAS_2', statusBed: 'DIBERSIHKAN', operationalStatus: 'H', ihsLocationId: 'Loc-Bed-Melati-03' },
    { ruanganId: ruanganMap['R-INAP-MELATI'].id, nomorBed: 'BED-MELATI-04', kelasKamar: 'KELAS_2', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-Melati-04' },
    // Rawat Inap Mawar (Isolasi)
    { ruanganId: ruanganMap['R-INAP-MAWAR'].id, nomorBed: 'BED-MAWAR-01', kelasKamar: 'ISOLASI', statusBed: 'TERSEDIA', operationalStatus: 'U', ihsLocationId: 'Loc-Bed-Mawar-01' }
  ];

  for (const b of bedData) {
    await prisma.tempatTidur.upsert({
      where: {
        ruanganId_nomorBed: {
          ruanganId: b.ruanganId,
          nomorBed: b.nomorBed
        }
      },
      update: b,
      create: b
    });
  }
  console.log(`✅ ${bedData.length} Tempat Tidur berhasil di-seed.`);

  // 4. Seed Aset Ruangan (Alkes & Sarpras)
  const asetData = [
    {
      kodeAset: 'AST-ALKES-001',
      namaAset: 'Tensimeter Digital Klinis',
      ruanganId: ruanganMap['R-POLI-UMUM'].id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Omron',
      tipeModel: 'HBP-1320',
      nomorSeri: 'OMR2024-9981',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 2500000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-TNS-01',
      kodeSnomed: '466093004',
      ihsDeviceId: 'Dev-Tensi-001'
    },
    {
      kodeAset: 'AST-NONMED-001',
      namaAset: 'Komputer Workstation Petugas Poli',
      ruanganId: ruanganMap['R-POLI-UMUM'].id,
      kategoriAset: 'NON_MEDIS_ELEKTRONIK',
      merk: 'Lenovo',
      tipeModel: 'ThinkCentre V50a',
      nomorSeri: 'LNV-882190',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 10500000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN'
    },
    {
      kodeAset: 'AST-ALKES-002',
      namaAset: 'Dental Chair Unit Terintegrasi',
      ruanganId: ruanganMap['R-POLI-GIGI'].id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Gnatus',
      tipeModel: 'G2 Sync',
      nomorSeri: 'GNT-2022-011',
      tahunPerolehan: 2022,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 85000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-DNT-01',
      kodeSnomed: '466276008',
      ihsDeviceId: 'Dev-Dental-001'
    },
    {
      kodeAset: 'AST-ALKES-003',
      namaAset: 'Autoclave Sterilisator Medis 23L',
      ruanganId: ruanganMap['R-POLI-GIGI'].id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Tuttnauer',
      tipeModel: '2340M',
      nomorSeri: 'TTN-5512',
      tahunPerolehan: 2021,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 32000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-STRL-01'
    },
    {
      kodeAset: 'AST-ALKES-004',
      namaAset: 'Elektrokardiograf (EKG) 12 Saluran',
      ruanganId: ruanganMap['R-IGD'].id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Bionet',
      tipeModel: 'CardioCare 2000',
      nomorSeri: 'BION-4411',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 24000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-EKG-01',
      kodeSnomed: '465691009',
      ihsDeviceId: 'Dev-EKG-001'
    },
    {
      kodeAset: 'AST-ALKES-005',
      namaAset: 'Defibrillator Emergency AED',
      ruanganId: ruanganMap['R-IGD'].id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Philips',
      tipeModel: 'HeartStart FRx',
      nomorSeri: 'PHL-AED-092',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 45000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-DFB-01'
    },
    {
      kodeAset: 'AST-ALKES-006',
      namaAset: 'Tabung Oksigen Medis 6m3 & Regulator',
      ruanganId: ruanganMap['R-IGD'].id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Samator',
      tipeModel: 'High Pressure O2 Cylinder',
      nomorSeri: 'SMT-O2-009',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 3200000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN'
    },
    {
      kodeAset: 'AST-ALKES-007',
      namaAset: 'Mobile X-Ray Digital System',
      ruanganId: ruanganMap['R-RAD'].id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Shimadzu',
      tipeModel: 'MobileArt Evolution',
      nomorSeri: 'SHM-RAD-771',
      tahunPerolehan: 2021,
      sumberAnggaran: 'APBN',
      hargaPerolehan: 450000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-RAD-01',
      kodeSnomed: '466236006',
      ihsDeviceId: 'Dev-XRay-001'
    },
    {
      kodeAset: 'AST-ALKES-008',
      namaAset: 'USG Portable Kebidanan 2D/4D Color Doppler',
      ruanganId: ruanganMap['R-POLI-KIA'].id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Mindray',
      tipeModel: 'DP-50 Expert',
      nomorSeri: 'MND-USG-3312',
      tahunPerolehan: 2022,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 95000000,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ALKES-USG-01',
      kodeSnomed: '466238007',
      ihsDeviceId: 'Dev-USG-001'
    }
  ];

  const asetMap = {};
  for (const a of asetData) {
    const createdAset = await prisma.asetRuangan.upsert({
      where: { kodeAset: a.kodeAset },
      update: a,
      create: a
    });
    asetMap[a.kodeAset] = createdAset;
  }
  console.log(`✅ ${asetData.length} Aset Ruangan berhasil di-seed.`);

  // 5. Seed Riwayat Pemeliharaan & Kalibrasi
  const ekgAset = asetMap['AST-ALKES-004'];
  const tensiAset = asetMap['AST-ALKES-001'];
  const xrayAset = asetMap['AST-ALKES-007'];

  if (ekgAset) {
    await prisma.riwayatPemeliharaanAset.create({
      data: {
        asetId: ekgAset.id,
        jenisKegiatan: 'KALIBRASI_BFPK_EKSTERNAL',
        tanggalJadwal: new Date('2026-03-10'),
        tanggalPelaksanaan: new Date('2026-03-12'),
        tanggalKalibrasiExpired: new Date('2027-03-12'),
        pelaksanaVendor: 'Balai Pengamanan Fasilitas Kesehatan (BPFK) Surabaya',
        biayaPemeliharaan: 1500000,
        nomorSertifikatKalibrasi: 'SERT-BPFK-2026-1184',
        hasilKegiatan: 'LAIK_PAKAI',
        catatan: 'Output kalibrasi akurasi amplitudo & waktu sinyal EKG dalam batas toleransi ±2%.',
        status: 'SELESAI'
      }
    });
  }

  if (tensiAset) {
    // Jadwal kalibrasi terencana dalam 15 hari ke depan untuk trigger alert/notifikasi
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 14);

    await prisma.riwayatPemeliharaanAset.create({
      data: {
        asetId: tensiAset.id,
        jenisKegiatan: 'KALIBRASI_INTERNAL',
        tanggalJadwal: nextDate,
        pelaksanaVendor: 'Teknisi Elektromedis Internal Faskes',
        biayaPemeliharaan: 0,
        hasilKegiatan: 'TERJADWAL',
        catatan: 'Kalibrasi rutin berkala 6 bulanan sensor tekanan darah.',
        status: 'TERJADWAL'
      }
    });
  }

  if (xrayAset) {
    await prisma.riwayatPemeliharaanAset.create({
      data: {
        asetId: xrayAset.id,
        jenisKegiatan: 'PEMELIHARAAN_RUTIN',
        tanggalJadwal: new Date('2026-09-01'),
        tanggalPelaksanaan: new Date('2026-09-05'),
        pelaksanaVendor: 'PT Shimadzu Healthcare Indonesia Service',
        biayaPemeliharaan: 4500000,
        hasilKegiatan: 'SELESAI_SERVIS',
        catatan: 'Pengecekan paparan radiasi, kabel fleksibel gantry, dan pembersihan filter pendingin.',
        status: 'SELESAI'
      }
    });
  }

  // 6. Seed Riwayat Mutasi Aset Contoh
  const tabungOksigen = asetMap['AST-ALKES-006'];
  if (tabungOksigen && ruanganMap['R-FARMASI'] && ruanganMap['R-IGD']) {
    await prisma.riwayatMutasiAset.create({
      data: {
        asetId: tabungOksigen.id,
        ruanganAsalId: ruanganMap['R-FARMASI'].id,
        ruanganTujuanId: ruanganMap['R-IGD'].id,
        tanggalMutasi: new Date('2026-08-01'),
        alasanMutasi: 'Kebutuhan darurat penanganan pasien gawat darurat di IGD.',
        petugasAdminId: adminUser?.id
      }
    });
  }

  console.log('✅ Pemeliharaan, Kalibrasi & Mutasi Aset berhasil di-seed.');
  console.log('🎉 SEEDING PENGELOLAAN RUANGAN & ASET SELESAI!');
}

seedAsetRuangan()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
