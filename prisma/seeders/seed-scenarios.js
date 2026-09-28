const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- START SEEDING SCENARIOS ---');

  const scenarioIds = [
    'kunj-scenario-1',
    'kunj-scenario-2',
    'kunj-scenario-3',
    'kunj-scenario-4',
    'kunj-scenario-5'
  ];

  await prisma.pembayaran.deleteMany({
    where: { tagihan: { kunjunganId: { in: scenarioIds } } }
  });
  await prisma.detailTagihan.deleteMany({
    where: { tagihan: { kunjunganId: { in: scenarioIds } } }
  });
  await prisma.tagihan.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.resepDetail.deleteMany({
    where: { resep: { kunjunganId: { in: scenarioIds } } }
  });
  await prisma.resep.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.tindakanPasien.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.diagnosisPasien.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.rekamMedis.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.screening.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.rujukanKeluar.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.orderLaboratoriumDetail.deleteMany({
    where: { order: { kunjunganId: { in: scenarioIds } } }
  });
  await prisma.orderLaboratorium.deleteMany({
    where: { kunjunganId: { in: scenarioIds } }
  });
  await prisma.kunjungan.deleteMany({
    where: { id: { in: scenarioIds } }
  });

  const patientNiks = [
    '3210000000000001',
    '3210000000000002',
    '3210000000000003',
    '3210000000000004'
  ];
  await prisma.alamatPasien.deleteMany({
    where: { pasien: { nik: { in: patientNiks } } }
  });
  await prisma.kontakPasien.deleteMany({
    where: { pasien: { nik: { in: patientNiks } } }
  });
  await prisma.penjaminPasien.deleteMany({
    where: { pasien: { nik: { in: patientNiks } } }
  });
  await prisma.pasien.deleteMany({
    where: { nik: { in: patientNiks } }
  });

  console.log('Cleaned up old scenario data.');

  const poliUmum = await prisma.poliklinik.findFirst({ where: { kodePoli: 'UMUM' } });
  const poliGigi = await prisma.poliklinik.findFirst({ where: { kodePoli: 'GIGI' } });
  
  if (!poliUmum || !poliGigi) {
    throw new Error('Poliklinik master data is missing!');
  }

  const docUmum = await prisma.user.findFirst({ where: { role: 'DOKTER', poliklinikId: poliUmum.id } });
  const docGigi = await prisma.user.findFirst({ where: { role: 'DOKTER', poliklinikId: poliGigi.id } });

  if (!docUmum || !docGigi) {
    throw new Error('Dokter user master data is missing!');
  }

  const icd10Uap = await prisma.masterICD10.upsert({
    where: { kode_icd10: 'I20.0' },
    update: {},
    create: {
      kode_icd10: 'I20.0',
      nama_diagnosis: 'Angina pektoris tidak stabil',
      bab: 'Sistem Sirkulasi',
      kategori: 'Jantung',
      status_aktif: true
    }
  });

  const icd10Dengue = await prisma.masterICD10.upsert({
    where: { kode_icd10: 'A90' },
    update: {},
    create: {
      kode_icd10: 'A90',
      nama_diagnosis: 'Demam Berdarah Dengue',
      bab: 'Penyakit Infeksi',
      kategori: 'Dengue',
      status_aktif: true
    }
  });

  const icd10Pulpitis = await prisma.masterICD10.upsert({
    where: { kode_icd10: 'K04.0' },
    update: {},
    create: {
      kode_icd10: 'K04.0',
      nama_diagnosis: 'Pulpitis Akut',
      bab: 'Sistem Pencernaan',
      kategori: 'Kesehatan Gigi',
      status_aktif: true
    }
  });

  const icd10Adm = await prisma.masterICD10.upsert({
    where: { kode_icd10: 'Z02.1' },
    update: {},
    create: {
      kode_icd10: 'Z02.1',
      nama_diagnosis: 'Pemeriksaan kesehatan untuk keperluan administratif / pekerjaan',
      bab: 'Faktor yang Mempengaruhi Kesehatan',
      kategori: 'Medical Check Up',
      status_aktif: true
    }
  });

  const icd9Ekg = await prisma.masterICD9.upsert({
    where: { kode_icd9: '89.52' },
    update: {},
    create: {
      kode_icd9: '89.52',
      nama_prosedur: 'Elektrokardiogram (EKG)',
      kategori: 'Pemeriksaan Penunjang'
    }
  });

  const icd9Ekstraksi = await prisma.masterICD9.upsert({
    where: { kode_icd9: '23.09' },
    update: {},
    create: {
      kode_icd9: '23.09',
      nama_prosedur: 'Ekstraksi Gigi',
      kategori: 'Kedokteran Gigi'
    }
  });

  let obatPct = await prisma.masterObat.findFirst({ where: { kodeObat: 'OBT-001' } });
  if (!obatPct) {
    obatPct = await prisma.masterObat.create({
      data: {
        kodeObat: 'OBT-001',
        namaObat: 'Paracetamol 500mg',
        kategori: 'Obat Bebas',
        sediaan: 'Tablet',
        harga: 500
      }
    });
  }

  let obatAmox = await prisma.masterObat.findFirst({ where: { kodeObat: 'OBT-002' } });
  if (!obatAmox) {
    obatAmox = await prisma.masterObat.create({
      data: {
        kodeObat: 'OBT-002',
        namaObat: 'Amoxicillin 500mg',
        kategori: 'Obat Keras',
        sediaan: 'Tablet',
        harga: 1000
      }
    });
  }

  let obatMefinal = await prisma.masterObat.findFirst({ where: { kodeObat: 'OBT-003' } });
  if (!obatMefinal) {
    obatMefinal = await prisma.masterObat.create({
      data: {
        kodeObat: 'OBT-003',
        namaObat: 'Asam Mefenamat 500mg',
        kategori: 'Obat Keras',
        sediaan: 'Tablet',
        harga: 800
      }
    });
  }

  const pasAgus = await prisma.pasien.create({
    data: {
      noRM: 'RM-SCENARIO-01',
      noIHS: 'IHS-9999901',
      nik: '3210000000000001',
      namaLengkap: 'Agus Hermawan',
      tempatLahir: 'Bandung',
      tanggalLahir: new Date('1975-06-15'),
      jenisKelamin: 'Laki-laki',
      agama: 'Islam',
      pekerjaan: 'Karyawan Swasta',
      statusPerkawinan: 'Kawin',
      kewarganegaraan: 'WNI',
      alamat: { create: { alamatKtp: 'Jl. Merdeka No. 10', alamatDomisili: 'Jl. Merdeka No. 10', rtRw: '001/005', desaKelurahan: 'Merdeka', kecamatan: 'Sumur Bandung', kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kodePos: '40111' } },
      kontak: { create: { noHp: '081234567890', kontakDarurat: 'Istri', hubunganKontakDarurat: 'Pasangan', noHpDarurat: '081234567891' } },
      penjamin: { create: { jenisPenjamin: 'Umum' } }
    }
  });

  const pasDewi = await prisma.pasien.create({
    data: {
      noRM: 'RM-SCENARIO-02',
      noIHS: 'IHS-9999902',
      nik: '3210000000000002',
      namaLengkap: 'Dewi Lestari',
      tempatLahir: 'Jakarta',
      tanggalLahir: new Date('1992-09-20'),
      jenisKelamin: 'Perempuan',
      agama: 'Kristen',
      pekerjaan: 'Ibu Rumah Tangga',
      statusPerkawinan: 'Kawin',
      kewarganegaraan: 'WNI',
      alamat: { create: { alamatKtp: 'Jl. Mawar No. 4', alamatDomisili: 'Jl. Mawar No. 4', rtRw: '003/002', desaKelurahan: 'Citarum', kecamatan: 'Bandung Wetan', kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kodePos: '40115' } },
      kontak: { create: { noHp: '085678901234', kontakDarurat: 'Suami', hubunganKontakDarurat: 'Pasangan', noHpDarurat: '085678901235' } },
      penjamin: { create: { jenisPenjamin: 'BPJS', noBpjs: '0001234567890', statusKepesertaan: 'AKTIF', kelasRawat: 'Kelas 2' } }
    }
  });

  const pasBudi = await prisma.pasien.create({
    data: {
      noRM: 'RM-SCENARIO-03',
      noIHS: 'IHS-9999903',
      nik: '3210000000000003',
      namaLengkap: 'Budi Santoso',
      tempatLahir: 'Semarang',
      tanggalLahir: new Date('1988-03-12'),
      jenisKelamin: 'Laki-laki',
      agama: 'Islam',
      pekerjaan: 'Buruh',
      statusPerkawinan: 'Kawin',
      kewarganegaraan: 'WNI',
      alamat: { create: { alamatKtp: 'Jl. Gatot Subroto No. 45', alamatDomisili: 'Jl. Gatot Subroto No. 45', rtRw: '005/007', desaKelurahan: 'Gumuruh', kecamatan: 'Batununggal', kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kodePos: '40275' } },
      kontak: { create: { noHp: '087890123456', kontakDarurat: 'Kakak', hubunganKontakDarurat: 'Keluarga', noHpDarurat: '087890123457' } },
      penjamin: { create: { jenisPenjamin: 'Umum' } }
    }
  });

  const pasCitra = await prisma.pasien.create({
    data: {
      noRM: 'RM-SCENARIO-04',
      noIHS: 'IHS-9999904',
      nik: '3210000000000004',
      namaLengkap: 'Citra Kirana',
      tempatLahir: 'Surabaya',
      tanggalLahir: new Date('2000-11-05'),
      jenisKelamin: 'Perempuan',
      agama: 'Islam',
      pekerjaan: 'Mahasiswa',
      statusPerkawinan: 'Belum Kawin',
      kewarganegaraan: 'WNI',
      alamat: { create: { alamatKtp: 'Jl. Dago No. 102', alamatDomisili: 'Jl. Dago No. 102', rtRw: '002/001', desaKelurahan: 'Lebak Siliwangi', kecamatan: 'Coblong', kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kodePos: '40132' } },
      kontak: { create: { noHp: '089012345678', kontakDarurat: 'Ibu', hubunganKontakDarurat: 'Orang Tua', noHpDarurat: '089012345679' } },
      penjamin: { create: { jenisPenjamin: 'Umum' } }
    }
  });

  // Scenario 1: Hospital Referral
  const kun1 = await prisma.kunjungan.create({
    data: {
      id: 'kunj-scenario-1',
      pasienId: pasAgus.id,
      poliklinikId: poliUmum.id,
      dokterTujuanId: docUmum.id,
      tanggalRegistrasi: new Date('2026-07-16T08:00:00Z'),
      jamRegistrasi: '08:00',
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Baru',
      noAntrian: 'A-01',
      prioritas: 'Umum',
      caraDatang: 'Datang sendiri',
      statusKunjungan: 'SELESAI',
      statusPulang: 'DIRUJUK_RS',
      waktuPemeriksaanMulai: new Date('2026-07-16T08:10:00Z'),
      waktuPemeriksaanSelesai: new Date('2026-07-16T08:30:00Z')
    }
  });

  await prisma.screening.create({
    data: {
      kunjunganId: kun1.id,
      pasienId: pasAgus.id,
      tanggalScreening: new Date('2026-07-16T08:05:00Z'),
      petugas: 'Suster Rini',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Kuning',
      tekananDarahSistolik: 150,
      tekananDarahDiastolik: 90,
      suhuTubuh: 38.5,
      nadi: 92,
      frekuensiNapas: 20,
      keluhanUtama: 'Nyeri dada kiri menjalar ke bahu'
    }
  });

  await prisma.rekamMedis.create({
    data: {
      kunjunganId: kun1.id,
      pasienId: pasAgus.id,
      dokterId: docUmum.id,
      keluhanUtama: 'Nyeri dada kiri menjalar ke bahu',
      riwayatPenyakitSekarang: 'Nyeri dada terasa seperti ditindih beban berat, durasi 15 menit, timbul mendadak saat aktivitas.',
      keadaanUmum: 'Sakit Sedang',
      kesadaran: 'Compos Mentis',
      pemeriksaanFisik: 'Cor: S1 S2 tunggal, regular, mur-mur (-). Pulmo: Vesikuler (+/+), ronkhi (-/-), wheezing (-/-).',
      diagnosisKlinis: 'Suspek Angina Pectoris Instabil (UAP) / ACS',
      rencanaTerapi: 'Oksigenasi nasal kanul 3 Lpm, pasang IVFD NaCl 0.9% 10 tpm, rekam EKG, rujuk segera ke RSUD.',
      statusPemeriksaan: 'SELESAI'
    }
  });

  await prisma.diagnosisPasien.create({
    data: {
      pasienId: pasAgus.id,
      kunjunganId: kun1.id,
      icd10Id: icd10Uap.id_icd10,
      dokterId: docUmum.id,
      jenisDiagnosis: 'Utama',
      diagnosisKlinis: 'Suspek Angina Pectoris Instabil',
      statusDiagnosis: 'Suspek'
    }
  });

  await prisma.tindakanPasien.create({
    data: {
      pasienId: pasAgus.id,
      kunjunganId: kun1.id,
      icd9Id: icd9Ekg.id_icd9,
      pelaksanaId: docUmum.id,
      pelaksanaTeks: 'Dokter Umum',
      catatanTindakan: 'Perekaman EKG 12 Lead'
    }
  });

  await prisma.rujukanKeluar.create({
    data: {
      kunjunganId: kun1.id,
      pasienId: pasAgus.id,
      dokterId: docUmum.id,
      faskesTujuan: 'RSUD Kabupaten Karawang',
      poliTujuan: 'Spesialis Jantung & Pembuluh Darah',
      alasanRujukan: 'Perlu evaluasi kardiologi mendalam dan fasilitas cath lab'
    }
  });

  // Scenario 2: Lab Referral (Day 1)
  const kun2 = await prisma.kunjungan.create({
    data: {
      id: 'kunj-scenario-2',
      pasienId: pasDewi.id,
      poliklinikId: poliUmum.id,
      dokterTujuanId: docUmum.id,
      tanggalRegistrasi: new Date('2026-07-15T09:00:00Z'),
      jamRegistrasi: '09:00',
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Lama',
      noAntrian: 'A-02',
      prioritas: 'Umum',
      caraDatang: 'Datang sendiri',
      statusKunjungan: 'SELESAI',
      statusPulang: 'KONTROL_ULANG',
      waktuPemeriksaanMulai: new Date('2026-07-15T09:10:00Z'),
      waktuPemeriksaanSelesai: new Date('2026-07-15T09:25:00Z')
    }
  });

  await prisma.screening.create({
    data: {
      kunjunganId: kun2.id,
      pasienId: pasDewi.id,
      tanggalScreening: new Date('2026-07-15T09:05:00Z'),
      petugas: 'Suster Rini',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Hijau',
      tekananDarahSistolik: 120,
      tekananDarahDiastolik: 80,
      suhuTubuh: 37.8,
      nadi: 88,
      frekuensiNapas: 18,
      keluhanUtama: 'Demam naik turun selama 5 hari, pusing, lemas'
    }
  });

  await prisma.rekamMedis.create({
    data: {
      kunjunganId: kun2.id,
      pasienId: pasDewi.id,
      dokterId: docUmum.id,
      keluhanUtama: 'Demam naik turun selama 5 hari, pusing, lemas',
      riwayatPenyakitSekarang: 'Demam naik terutama malam hari, sakit kepala (+), nyeri sendi (+), mual muntah (-).',
      keadaanUmum: 'Sakit Ringan',
      kesadaran: 'Compos Mentis',
      pemeriksaanFisik: 'Abdomen: nyeri tekan epigastrium (-), hepatomegali (-), uji bendungan (rumple leede) (+).',
      diagnosisKlinis: 'Febris H-5 susp. Demam Dengue / DHF',
      rencanaTerapi: 'Instruksi cek darah lengkap (darah rutin, trombosit) ke laboratorium. Banyak minum cairan.',
      statusPemeriksaan: 'SELESAI'
    }
  });

  await prisma.diagnosisPasien.create({
    data: {
      pasienId: pasDewi.id,
      kunjunganId: kun2.id,
      icd10Id: icd10Dengue.id_icd10,
      dokterId: docUmum.id,
      jenisDiagnosis: 'Utama',
      diagnosisKlinis: 'Febris H-5 susp. Demam Dengue',
      statusDiagnosis: 'Suspek'
    }
  });

  await prisma.orderLaboratorium.create({
    data: {
      kunjunganId: kun2.id,
      pasienId: pasDewi.id,
      dokterId: docUmum.id,
      status: 'SELESAI',
      catatanKlinis: 'Susp. Dengue, mohon cek hitung trombosit & leukosit',
      tanggalOrder: new Date('2026-07-15T09:30:00Z'),
      details: {
        create: [
          { parameter: 'Trombosit', hasil: '85.000', satuan: '/uL', nilaiRujukan: '150.000 - 450.000', kritis: true },
          { parameter: 'Leukosit', hasil: '3.200', satuan: '/uL', nilaiRujukan: '4.000 - 10.000', kritis: false }
        ]
      }
    }
  });

  // Scenario 3: Lab Follow Up (Day 2)
  const kun3 = await prisma.kunjungan.create({
    data: {
      id: 'kunj-scenario-3',
      pasienId: pasDewi.id,
      poliklinikId: poliUmum.id,
      dokterTujuanId: docUmum.id,
      tanggalRegistrasi: new Date('2026-07-16T10:00:00Z'),
      jamRegistrasi: '10:00',
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Lama',
      noAntrian: 'A-03',
      prioritas: 'Umum',
      caraDatang: 'Datang sendiri',
      statusKunjungan: 'SELESAI',
      statusPulang: 'PULANG_SEMBUH',
      waktuPemeriksaanMulai: new Date('2026-07-16T10:10:00Z'),
      waktuPemeriksaanSelesai: new Date('2026-07-16T10:20:00Z')
    }
  });

  await prisma.screening.create({
    data: {
      kunjunganId: kun3.id,
      pasienId: pasDewi.id,
      tanggalScreening: new Date('2026-07-16T10:05:00Z'),
      petugas: 'Suster Rini',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Hijau',
      tekananDarahSistolik: 110,
      tekananDarahDiastolik: 70,
      suhuTubuh: 37.0,
      nadi: 84,
      frekuensiNapas: 16,
      keluhanUtama: 'Evaluasi hasil lab, demam mulai turun, lemas berkurang'
    }
  });

  await prisma.rekamMedis.create({
    data: {
      kunjunganId: kun3.id,
      pasienId: pasDewi.id,
      dokterId: docUmum.id,
      keluhanUtama: 'Evaluasi hasil lab, demam mulai turun, lemas berkurang',
      riwayatPenyakitSekarang: 'Pasien membawa hasil lab trombosit 85.000/uL dan leukosit 3.200/uL. Demam mereda tapi badan terasa lemas.',
      keadaanUmum: 'Sakit Ringan',
      kesadaran: 'Compos Mentis',
      pemeriksaanFisik: 'Tensi 110/70, CRT < 2 detik. Akral hangat. Nyeri tekan epigastrium (-).',
      diagnosisKlinis: 'Demam Dengue Terkonfirmasi (Trombositopenia)',
      rencanaTerapi: 'Bed rest total, edukasi banyak minum cairan (minimal 2 liter/hari). Terapi paracetamol dan vitamin.',
      statusPemeriksaan: 'SELESAI'
    }
  });

  await prisma.diagnosisPasien.create({
    data: {
      pasienId: pasDewi.id,
      kunjunganId: kun3.id,
      icd10Id: icd10Dengue.id_icd10,
      dokterId: docUmum.id,
      jenisDiagnosis: 'Utama',
      diagnosisKlinis: 'Demam Dengue Terkonfirmasi (Trombositopenia)',
      statusDiagnosis: 'Kerja'
    }
  });

  await prisma.resep.create({
    data: {
      kunjunganId: kun3.id,
      pasienId: pasDewi.id,
      dokterId: docUmum.id,
      status: 'SELESAI',
      tanggalResep: new Date('2026-07-16T10:15:00Z'),
      details: {
        create: [
          { obatId: obatPct.id, jumlah: 10, aturanPakai: '3 x 1 Tablet setelah makan', catatan: 'Diminum bila demam' },
          { obatId: obatMefinal.id, jumlah: 10, aturanPakai: '1 x 1 Tablet setelah makan', catatan: 'Vitamin pendukung' }
        ]
      }
    }
  });

  // Scenario 4: Discharge with Prescription
  const kun4 = await prisma.kunjungan.create({
    data: {
      id: 'kunj-scenario-4',
      pasienId: pasBudi.id,
      poliklinikId: poliGigi.id,
      dokterTujuanId: docGigi.id,
      tanggalRegistrasi: new Date('2026-07-16T11:00:00Z'),
      jamRegistrasi: '11:00',
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Baru',
      noAntrian: 'G-01',
      prioritas: 'Umum',
      caraDatang: 'Datang sendiri',
      statusKunjungan: 'SELESAI',
      statusPulang: 'PULANG_SEMBUH',
      waktuPemeriksaanMulai: new Date('2026-07-16T11:10:00Z'),
      waktuPemeriksaanSelesai: new Date('2026-07-16T11:25:00Z')
    }
  });

  await prisma.screening.create({
    data: {
      kunjunganId: kun4.id,
      pasienId: pasBudi.id,
      tanggalScreening: new Date('2026-07-16T11:05:00Z'),
      petugas: 'Perawat Gigi Tati',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Hijau',
      tekananDarahSistolik: 130,
      tekananDarahDiastolik: 80,
      suhuTubuh: 36.8,
      nadi: 80,
      frekuensiNapas: 18,
      keluhanUtama: 'Gigi bawah kanan belakang nyeri dan ngilu saat makan'
    }
  });

  await prisma.rekamMedis.create({
    data: {
      kunjunganId: kun4.id,
      pasienId: pasBudi.id,
      dokterId: docGigi.id,
      keluhanUtama: 'Gigi bawah kanan belakang nyeri dan ngilu saat makan',
      riwayatPenyakitSekarang: 'Nyeri gigi menjalar hingga kepala sejak 2 hari lalu. Susah mengunyah makanan keras.',
      keadaanUmum: 'Sakit Ringan',
      kesadaran: 'Compos Mentis',
      pemeriksaanFisik: 'Status Lokalis Gigi 46: Karies mencapai pulpa (vitalitas +), perkusi (+), palpasi (-).',
      diagnosisKlinis: 'Pulpitis akut gigi 46',
      rencanaTerapi: 'Dilakukan eksirpasi pulpa, pemberian analgetik dan antibiotik oral. Kontrol 5 hari lagi untuk perawatan lanjutan.',
      statusPemeriksaan: 'SELESAI'
    }
  });

  await prisma.diagnosisPasien.create({
    data: {
      pasienId: pasBudi.id,
      kunjunganId: kun4.id,
      icd10Id: icd10Pulpitis.id_icd10,
      dokterId: docGigi.id,
      jenisDiagnosis: 'Utama',
      diagnosisKlinis: 'Pulpitis akut gigi 46',
      statusDiagnosis: 'Kerja'
    }
  });

  await prisma.tindakanPasien.create({
    data: {
      pasienId: pasBudi.id,
      kunjunganId: kun4.id,
      icd9Id: icd9Ekstraksi.id_icd9,
      pelaksanaId: docGigi.id,
      pelaksanaTeks: 'Dokter Gigi',
      catatanTindakan: 'Preparasi kavitas & eksirpasi pulpa gigi 46'
    }
  });

  await prisma.resep.create({
    data: {
      kunjunganId: kun4.id,
      pasienId: pasBudi.id,
      dokterId: docGigi.id,
      status: 'SELESAI',
      tanggalResep: new Date('2026-07-16T11:20:00Z'),
      details: {
        create: [
          { obatId: obatAmox.id, jumlah: 15, aturanPakai: '3 x 1 Tablet (habiskan)', catatan: 'Antibiotik' },
          { obatId: obatMefinal.id, jumlah: 10, aturanPakai: '3 x 1 Tablet (bila nyeri)', catatan: 'Analgetik' }
        ]
      }
    }
  });

  // Scenario 5: Health Certificate Only
  const kun5 = await prisma.kunjungan.create({
    data: {
      id: 'kunj-scenario-5',
      pasienId: pasCitra.id,
      poliklinikId: poliUmum.id,
      dokterTujuanId: docUmum.id,
      tanggalRegistrasi: new Date('2026-07-16T14:00:00Z'),
      jamRegistrasi: '14:00',
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Baru',
      noAntrian: 'A-04',
      prioritas: 'Umum',
      caraDatang: 'Datang sendiri',
      statusKunjungan: 'SELESAI',
      statusPulang: 'PULANG_SEMBUH',
      waktuPemeriksaanMulai: new Date('2026-07-16T14:05:00Z'),
      waktuPemeriksaanSelesai: new Date('2026-07-16T14:15:00Z')
    }
  });

  await prisma.screening.create({
    data: {
      kunjunganId: kun5.id,
      pasienId: pasCitra.id,
      tanggalScreening: new Date('2026-07-16T14:05:00Z'),
      petugas: 'Suster Rini',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Hijau',
      tekananDarahSistolik: 120,
      tekananDarahDiastolik: 80,
      suhuTubuh: 36.5,
      nadi: 80,
      frekuensiNapas: 18,
      tinggiBadan: 160,
      beratBadan: 55,
      imt: 21.5,
      keluhanUtama: 'Pemeriksaan kesehatan untuk syarat melamar pekerjaan'
    }
  });

  await prisma.rekamMedis.create({
    data: {
      kunjunganId: kun5.id,
      pasienId: pasCitra.id,
      dokterId: docUmum.id,
      keluhanUtama: 'Pemeriksaan kesehatan untuk syarat melamar pekerjaan',
      riwayatPenyakitSekarang: 'Pasien meminta Surat Keterangan Sehat Jasmani sebagai persyaratan lamaran kerja.',
      keadaanUmum: 'Sehat Walafiat',
      kesadaran: 'Compos Mentis',
      pemeriksaanFisik: 'Status Fisik: Baik. Cor/Pulmo: Normal. Tensi 120/80. Buta Warna: Tidak.',
      diagnosisKlinis: 'Orang sehat memerlukan pemeriksaan kesehatan administratif',
      rencanaTerapi: 'Menerbitkan Surat Keterangan Sehat Jasmani.',
      statusPemeriksaan: 'SELESAI'
    }
  });

  await prisma.diagnosisPasien.create({
    data: {
      pasienId: pasCitra.id,
      kunjunganId: kun5.id,
      icd10Id: icd10Adm.id_icd10,
      dokterId: docUmum.id,
      jenisDiagnosis: 'Utama',
      diagnosisKlinis: 'Pemeriksaan kesehatan untuk keperluan administratif / pekerjaan',
      statusDiagnosis: 'Kerja'
    }
  });

  console.log('--- SEEDING SCENARIOS COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
