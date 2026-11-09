const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAlkesAndBmhp() {
  console.log('===============================================================');
  console.log('🚀 MEMULAI SEEDING LENGKAP ALAT KESEHATAN (ALKES) & BMHP PUSKESMAS');
  console.log('===============================================================');

  // 1. Dapatkan Data Faskes
  const faskesCibinong = await prisma.faskes.findUnique({ where: { kodeFaskes: 'P3201010101' } });
  const faskesSukamakmur = await prisma.faskes.findUnique({ where: { kodeFaskes: 'P3201010202' } });

  if (!faskesCibinong) {
    throw new Error('Faskes Cibinong (P3201010101) tidak ditemukan di database! Jalankan seed utama dulu.');
  }

  console.log(`🏥 Faskes Target:`);
  console.log(`   - [1] ${faskesCibinong.namaFaskes} (${faskesCibinong.id})`);
  if (faskesSukamakmur) {
    console.log(`   - [2] ${faskesSukamakmur.namaFaskes} (${faskesSukamakmur.id})`);
  }

  // 2. Pastikan Master Ruangan Lengkap untuk Faskes Cibinong & Sukamakmur
  const roomDefs = [
    // Cibinong Raya
    { kodeRuangan: 'R-POLI-UMUM-CBN', namaRuangan: 'Ruang Pemeriksaan Umum (Poli 1)', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-POLI-GIGI-CBN', namaRuangan: 'Ruang Pelayanan Gigi & Mulut', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-POLI-KIA-CBN', namaRuangan: 'Ruang KIA, KB & Imunisasi', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-UGD-CBN', namaRuangan: 'Ruang Tindakan & Gawat Darurat (UGD)', lantai: 'Lantai 1', gedung: 'Gedung UGD', kategoriRuangan: 'UGD', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-LAB-CBN', namaRuangan: 'Ruang Laboratorium Sederhana', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'PENUNJANG_MEDIS', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-FARMASI-CBN', namaRuangan: 'Ruang Depo Farmasi & Vaksin', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'GUDANG', faskesId: faskesCibinong.id },
    { kodeRuangan: 'R-INAP-CBN-01', namaRuangan: 'Ruang Rawat Inap Mawar', lantai: 'Lantai 2', gedung: 'Gedung B', kategoriRuangan: 'RAWAT_INAP', faskesId: faskesCibinong.id },
  ];

  if (faskesSukamakmur) {
    roomDefs.push(
      { kodeRuangan: 'R-UGD-SKM-01', namaRuangan: 'Ruang Tindakan Unit Gawat Darurat (UGD)', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'UGD', faskesId: faskesSukamakmur.id },
      { kodeRuangan: 'R-POLI-UMUM-SKM', namaRuangan: 'Ruang Pemeriksaan Umum Sukamakmur', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesSukamakmur.id },
      { kodeRuangan: 'R-POLI-GIGI-SKM', namaRuangan: 'Ruang Pelayanan Gigi Sukamakmur', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesSukamakmur.id },
      { kodeRuangan: 'R-POLI-KIA-SKM', namaRuangan: 'Ruang KIA & KB Sukamakmur', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN', faskesId: faskesSukamakmur.id },
      { kodeRuangan: 'R-LAB-SKM', namaRuangan: 'Ruang Laboratorium Sukamakmur', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'PENUNJANG_MEDIS', faskesId: faskesSukamakmur.id },
      { kodeRuangan: 'R-FARMASI-SKM', namaRuangan: 'Ruang Depo Farmasi Sukamakmur', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'GUDANG', faskesId: faskesSukamakmur.id }
    );
  }

  const roomMap = {};
  for (const r of roomDefs) {
    const created = await prisma.masterRuangan.upsert({
      where: { kodeRuangan: r.kodeRuangan },
      update: {
        faskesId: r.faskesId,
        namaRuangan: r.namaRuangan,
        lantai: r.lantai,
        gedung: r.gedung,
        kategoriRuangan: r.kategoriRuangan
      },
      create: r
    });
    roomMap[r.kodeRuangan] = created;
  }
  console.log(`✅ ${Object.keys(roomMap).length} Master Ruangan siap.`);

  // ==============================================================
  // 3. SEED ALAT KESEHATAN (ALKES) STANDAR PUSKESMAS & TARIF RETRIBUSI
  // ==============================================================
  console.log('\n🔬 Seeding Katalog Alat Kesehatan (Alkes) Puskesmas...');

  const alkesMasterList = [
    // --- RUANG TINDAKAN & UGD ---
    {
      kodeAset: 'AST-CBN-MSRG-01',
      namaAset: 'Minor Surgery Instrument Set (Set Bedah Minor)',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'SMI Surgical / Renfert',
      tipeModel: 'Minor Set 14 Instruments',
      nomorSeri: 'MSRG-2024-001',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 3500000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-MSRG-01',
      catatan: 'Berisi needle holder, klem hemostatik pean/kocher, gunting jaringan, pinset anatomis & sirurgis, scalpel handle.'
    },
    {
      kodeAset: 'AST-CBN-NEB-01',
      namaAset: 'Nebulizer Compressor Medis',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Omron',
      tipeModel: 'NE-C28 CompAIR Pro',
      nomorSeri: 'OMR-NEB-2023-88',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 1800000,
      tarifPemakaian: 20000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-NEB-01',
      catatan: 'Laju nebulisasi 0.4 ml/menit, ukuran partikel MMAD 3μm untuk penanganan asma dan PPOK eksaserbasi.'
    },
    {
      kodeAset: 'AST-CBN-EKG-01',
      namaAset: 'Elektrokardiograf (EKG) 12 Saluran Digital',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Bionet',
      tipeModel: 'CardioCare 2000',
      nomorSeri: 'BION-4411',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 24000000,
      tarifPemakaian: 30000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-EKG-01',
      catatan: 'EKG 12-lead dengan interpretasi otomatis dan port thermal print 80mm.'
    },
    {
      kodeAset: 'AST-CBN-SUCT-01',
      namaAset: 'Suction Pump Portable Resusitasi',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Thomas / Yuwell',
      tipeModel: 'Medi-Pump 1632',
      nomorSeri: 'THM-SUC-891',
      tahunPerolehan: 2022,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 8500000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-SUC-01',
      catatan: 'Vakum maksimal -600 mmHg, tabung cairan 1000ml dengan overflow safety valve.'
    },
    {
      kodeAset: 'AST-CBN-AED-01',
      namaAset: 'Defibrillator Emergency AED (Automated External Defibrillator)',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Philips',
      tipeModel: 'HeartStart FRx',
      nomorSeri: 'PHL-AED-092',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 45000000,
      tarifPemakaian: 50000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-AED-01',
      catatan: 'Bifasik SMART defibrilasi energi 150J dengan panduan suara interaktif CPR.'
    },
    {
      kodeAset: 'AST-CBN-O2-01',
      namaAset: 'Tabung Oksigen Medis 6m3 & Flowmeter Regulator',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Samator',
      tipeModel: 'Cylinder 6m3 High Pressure',
      nomorSeri: 'SMT-O2-2024-11',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 3200000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-O2-01',
      catatan: 'Tekanan kerja 150 bar, dilengkapi humidifier bubbler dan flowmeter 0-15 Lpm.'
    },
    {
      kodeAset: 'AST-CBN-LMP-01',
      namaAset: 'Lampu Tindakan Medis LED Mobile (Examination Lamp)',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Riester',
      tipeModel: 'ri-magic LED Mobile',
      nomorSeri: 'RST-LMP-8821',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 6500000,
      tarifPemakaian: 10000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-LMP-01',
      catatan: 'Intensitas cahaya 50.000 lux pada jarak 50cm, lengan gooseneck fleksibel.'
    },
    {
      kodeAset: 'AST-CBN-OXM-01',
      namaAset: 'Pulse Oximeter Fingerprint Digital',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'ChoiceMMed',
      tipeModel: 'OxyWatch MD300C29',
      nomorSeri: 'OXY-2024-05',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 450000,
      tarifPemakaian: 5000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-OXM-01',
      catatan: 'Pengukuran SpO2 akurasi 70-100% ±2%, nadi (PR) dan plethysmogram waveform.'
    },
    {
      kodeAset: 'AST-CBN-SYR-01',
      namaAset: 'Syringe Pump Otomatis Terumo',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Terumo',
      tipeModel: 'TE-SS700 Smart',
      nomorSeri: 'TRM-SYR-772',
      tahunPerolehan: 2023,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 28000000,
      tarifPemakaian: 25000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-SYR-01',
      catatan: 'Dukungan syringe 5, 10, 20, 30, 50ml dengan flow rate presisi 0.1 - 1200 ml/jam.'
    },
    {
      kodeAset: 'AST-CBN-INFP-01',
      namaAset: 'Infusion Pump Terumo Digital',
      roomKey: 'R-UGD-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Terumo',
      tipeModel: 'TE-LM700 Infusion',
      nomorSeri: 'TRM-INF-991',
      tahunPerolehan: 2023,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 29000000,
      tarifPemakaian: 25000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-INFP-01',
      catatan: 'Detektor udara ultrasonik dan sensor tekanan oklusi multi-level.'
    },

    // --- RUANG PEMERIKSAAN UMUM (POLI UMUM) ---
    {
      kodeAset: 'AST-CBN-TNS-01',
      namaAset: 'Tensimeter Digital Klinis Omron',
      roomKey: 'R-POLI-UMUM-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Omron',
      tipeModel: 'HBP-1320 Professional',
      nomorSeri: 'OMR-CBN-9981',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 2500000,
      tarifPemakaian: 5000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-TNS-01',
      catatan: 'Tensimeter oscillometric terkalibrasi BPFK dengan manset dual-size (M/L).'
    },
    {
      kodeAset: 'AST-CBN-OTO-01',
      namaAset: 'Otoscope & Diagnostic Set THT',
      roomKey: 'R-POLI-UMUM-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Heine',
      tipeModel: 'mini 3000 Fiber Optic (F.O.)',
      nomorSeri: 'HN-OTO-2023-41',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 3800000,
      tarifPemakaian: 10000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-OTO-01',
      catatan: 'Pemeriksaan kanal telinga dan membran timpani dengan pencahayaan halogen Xenon bebas pantulan.'
    },
    {
      kodeAset: 'AST-CBN-TMB-01',
      namaAset: 'Timbangan Dewasa Digital + Height Rod (Stadiometer)',
      roomKey: 'R-POLI-UMUM-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Seca',
      tipeModel: 'Seca 704 Medical Column Scale',
      nomorSeri: 'SCA-704-2023',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 12000000,
      tarifPemakaian: 0,
      isAlkesTindakan: false,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-TMB-01',
      catatan: 'Kapasitas timbang 300 kg, akurasi 50g, kalkulasi BMI otomatis terintegrasi.'
    },

    // --- RUANG PELAYANAN GIGI & MULUT (POLI GIGI) ---
    {
      kodeAset: 'AST-CBN-DNT-01',
      namaAset: 'Dental Chair Unit Terintegrasi',
      roomKey: 'R-POLI-GIGI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Gnatus',
      tipeModel: 'G2 Sync Full Set',
      nomorSeri: 'GNT-2023-011',
      tahunPerolehan: 2022,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 85000000,
      tarifPemakaian: 25000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-DNT-01',
      catatan: 'Unit dental lengkap dengan spittoon bowl, lampu halogen fokus, saliva ejector dan foot control.'
    },
    {
      kodeAset: 'AST-CBN-SCL-01',
      namaAset: 'Ultrasonic Piezo Scaler Gigi',
      roomKey: 'R-POLI-GIGI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Woodpecker',
      tipeModel: 'UDS-K LED Ultrasonic',
      nomorSeri: 'WDP-SCL-771',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 4500000,
      tarifPemakaian: 20000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-SCL-01',
      catatan: 'Pembersihan karang gigi supra & sub-gingiva frekuensi 28kHz ± 3kHz dengan handpiece autoclavable.'
    },
    {
      kodeAset: 'AST-CBN-LTC-01',
      namaAset: 'Light Curing Dental Unit (Polimerisasi Komposit)',
      roomKey: 'R-POLI-GIGI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Woodpecker / Ivoclar',
      tipeModel: 'LED.B Wireless',
      nomorSeri: 'WDP-LC-2024-12',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 2200000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-LTC-01',
      catatan: 'Intensitas cahaya 1200 mW/cm2, panjang gelombang 420-480nm untuk tumpatan estetik.'
    },
    {
      kodeAset: 'AST-CBN-STRL-01',
      namaAset: 'Autoclave Sterilisator Medis 23L Class-B',
      roomKey: 'R-POLI-GIGI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Tuttnauer',
      tipeModel: '2340M Chamber Benchtop',
      nomorSeri: 'TTN-5512',
      tahunPerolehan: 2022,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 32000000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-STRL-01',
      catatan: 'Sterilisasi instrumen dental dan bedah suhu 134°C tekanan 2.1 bar.'
    },
    {
      kodeAset: 'AST-CBN-TNG-01',
      namaAset: 'Tang Ekstraksi Gigi Set Dewasa & Anak (10 Instruments)',
      roomKey: 'R-POLI-GIGI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'SMI Dental Instruments',
      tipeModel: 'Extraction Forceps Set German Stainless',
      nomorSeri: 'EXT-GGI-2023',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 3500000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-TNG-01',
      catatan: 'Tang pencabutan gigi incisor, premolar, molar atas bawah dan sisa akar (bein lurus & bengkok).'
    },

    // --- RUANG KIA, KB & IMUNISASI (POLI KIA/KB) ---
    {
      kodeAset: 'AST-CBN-DOP-01',
      namaAset: 'Doppler Fetal Heart Rate Kebidanan',
      roomKey: 'R-POLI-KIA-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Bistos',
      tipeModel: 'BT-200 Fetal Doppler LCD',
      nomorSeri: 'BST-2024-88',
      tahunPerolehan: 2024,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 4500000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-DOP-01',
      catatan: 'Probe ultrasonik frekuensi 2MHz dengan peredam derau audio dan display detak jantung janin.'
    },
    {
      kodeAset: 'AST-CBN-USG-KIA',
      namaAset: 'USG Kebidanan Portable 2D/3D Mindray',
      roomKey: 'R-POLI-KIA-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Mindray',
      tipeModel: 'DP-50 Expert OB/GYN',
      nomorSeri: 'MND-USG-KIA-2023',
      tahunPerolehan: 2023,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 95000000,
      tarifPemakaian: 50000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-USG-01',
      catatan: 'Pemeriksaan biometri janin trimester 1, 2, 3, estimasi usia kehamilan (BPD/FL/AC), plasenta, dan ketuban.'
    },
    {
      kodeAset: 'AST-CBN-IUD-01',
      namaAset: 'IUD Kit Pemasangan & Pelepasan AKDR',
      roomKey: 'R-POLI-KIA-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'SMI / Marwa Surgical',
      tipeModel: 'IUD Insertion & Removal Set',
      nomorSeri: 'IUD-2023-01',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 1800000,
      tarifPemakaian: 20000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-IUD-01',
      catatan: 'Berisi spekulum cocor bebek graves, tenakulum pozzi, sonde uterus simpson, klem kuretase, gunting benang IUD.'
    },
    {
      kodeAset: 'AST-CBN-IMP-01',
      namaAset: 'Implant Kit Pemasangan & Pencabutan Susuk KB',
      roomKey: 'R-POLI-KIA-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'SMI / BKKBN Standar',
      tipeModel: 'Norplant / Implanon Kit',
      nomorSeri: 'IMP-2023-09',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 1500000,
      tarifPemakaian: 20000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-IMP-01',
      catatan: 'Berisi trokar implan No 10 dengan mandrin penusuk, klem fiksasi u-clamp, bisturi handle.'
    },
    {
      kodeAset: 'AST-CBN-RES-NEO',
      namaAset: 'Resusitator Bayi / Neonatal Resuscitation Kit',
      roomKey: 'R-POLI-KIA-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_TERAPETIK',
      merk: 'Laerdal',
      tipeModel: 'Silicone Neonatal Resuscitator (Ambu Baby)',
      nomorSeri: 'LRD-NEO-552',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BOK',
      hargaPerolehan: 2500000,
      tarifPemakaian: 25000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-RES-01',
      catatan: 'Kantong silikon volume 240ml dengan katup pelepas tekanan 35 cmH2O untuk resusitasi asfiksia neonatus.'
    },

    // --- RUANG LABORATORIUM SEDERHANA ---
    {
      kodeAset: 'AST-CBN-HEM-01',
      namaAset: 'Hematology Analyzer 3-Diff Otomatis',
      roomKey: 'R-LAB-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_LABORATORIUM',
      merk: 'Mindray',
      tipeModel: 'BC-20s Auto Hematology',
      nomorSeri: 'MND-BC20-2023-11',
      tahunPerolehan: 2023,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 75000000,
      tarifPemakaian: 30000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-HEM-01',
      catatan: 'Pemeriksaan Darah Lengkap 19 parameter + 3 histogram, throughput 40 sampel/jam.'
    },
    {
      kodeAset: 'AST-CBN-CENT-01',
      namaAset: 'Centrifuge Laboratorium Klinik 8 Tabung',
      roomKey: 'R-LAB-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_LABORATORIUM',
      merk: 'Gemmy',
      tipeModel: 'PLC-03 Rotor Fixed Angle',
      nomorSeri: 'GMY-CENT-102',
      tahunPerolehan: 2022,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 7500000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-CENT-01',
      catatan: 'Kecepatan pemusingan 4000 rpm untuk pemisahan serum, plasma darah, dan endapan sedimen urin.'
    },
    {
      kodeAset: 'AST-CBN-MIC-01',
      namaAset: 'Mikroskop Binokuler Olympus CX23',
      roomKey: 'R-LAB-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_LABORATORIUM',
      merk: 'Olympus',
      tipeModel: 'CX23 LED Binocular',
      nomorSeri: 'OLY-CX23-994',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 21000000,
      tarifPemakaian: 15000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-MIC-01',
      catatan: 'Objektif plan akromatik 4x, 10x, 40x, 100x oil immersion untuk BTA TB sputum dan sedimen urin.'
    },
    {
      kodeAset: 'AST-CBN-FOT-01',
      namaAset: 'Fotometer Kimia Klinik Semi-Otomatis',
      roomKey: 'R-LAB-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_LABORATORIUM',
      merk: 'BioSystems',
      tipeModel: 'BTS-350 Semi-Automated',
      nomorSeri: 'BS-FOT-4421',
      tahunPerolehan: 2022,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 45000000,
      tarifPemakaian: 25000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-FOT-01',
      catatan: 'Pemeriksaan fungsi ginjal (ureum, kreatinin), fungsi hati (SGOT, SGPT), dan profil lipid.'
    },

    // --- RUANG DEPO FARMASI & VAKSIN ---
    {
      kodeAset: 'AST-CBN-KULK-01',
      namaAset: 'Kulkas Vaksin TCW 3000 (Cold-Chain Terstandar WHO)',
      roomKey: 'R-FARMASI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Dometic',
      tipeModel: 'TCW 3000 AC Vaccine Refrigerator',
      nomorSeri: 'DOM-TCW-2022',
      tahunPerolehan: 2022,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 65000000,
      tarifPemakaian: 0,
      isAlkesTindakan: false,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-KULK-01',
      catatan: 'Holdover time 48 jam saat listrik padam, suhu stabil 2-8°C dengan logger digital.'
    },
    {
      kodeAset: 'AST-CBN-BLD-01',
      namaAset: 'Mesin Blender Puyer & Sealer Puyer Otomatis',
      roomKey: 'R-FARMASI-CBN',
      faskesId: faskesCibinong.id,
      kategoriAset: 'NON_MEDIS_ELEKTRONIK',
      merk: 'Matahari Medika',
      tipeModel: 'Pulverizer Fast-Grind 100g',
      nomorSeri: 'MM-BLD-2023-01',
      tahunPerolehan: 2023,
      sumberAnggaran: 'BLUD',
      hargaPerolehan: 4500000,
      tarifPemakaian: 5000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-BLD-01',
      catatan: 'Penggerus racikan tablet/kapsul puyer steril cepat dan higienis.'
    },

    // --- RUANG RAWAT INAP ---
    {
      kodeAset: 'AST-CBN-USG-01',
      namaAset: 'USG Mindray DC-30 Bangsal Rawat Inap',
      roomKey: 'R-INAP-CBN-01',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Mindray',
      tipeModel: 'DC-30 Exp Stationary',
      nomorSeri: 'MND-USG-772',
      tahunPerolehan: 2023,
      sumberAnggaran: 'APBD',
      hargaPerolehan: 180000000,
      tarifPemakaian: 50000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-USG-001',
      catatan: 'Pemeriksaan USG bedside abdomen, toraks, dan vaskular bangsal rawat inap.'
    },
    {
      kodeAset: 'AST-CBN-MON-01',
      namaAset: 'Bedside Patient Monitor Multi-Parameter (NIBP, SpO2, HR, Respiration)',
      roomKey: 'R-INAP-CBN-01',
      faskesId: faskesCibinong.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      merk: 'Contec',
      tipeModel: 'CMS-8000 Multi-Parameter',
      nomorSeri: 'CTC-MON-2024-03',
      tahunPerolehan: 2024,
      sumberAnggaran: 'DAK',
      hargaPerolehan: 22000000,
      tarifPemakaian: 30000,
      isAlkesTindakan: true,
      kondisiAset: 'BAIK',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-MON-01',
      catatan: 'Monitor vital signs kontinyu pasien rawat inap dan observasi ketat UGD.'
    }
  ];

  // Tambahkan alkes untuk Sukamakmur jika faskes tersedia
  if (faskesSukamakmur) {
    alkesMasterList.push(
      {
        kodeAset: 'AST-SKM-TNS-01',
        namaAset: 'Tensimeter Digital Omron Sukamakmur',
        roomKey: 'R-UGD-SKM-01',
        faskesId: faskesSukamakmur.id,
        kategoriAset: 'MEDIS_DIAGNOSTIK',
        merk: 'Omron',
        tipeModel: 'HBP-1320',
        nomorSeri: 'OMR-SKM-001',
        tahunPerolehan: 2023,
        sumberAnggaran: 'APBD',
        hargaPerolehan: 2500000,
        tarifPemakaian: 5000,
        isAlkesTindakan: true,
        kondisiAset: 'BAIK',
        statusOperasional: 'AKTIF_DIGUNAKAN',
        kodeAspak: 'ASPAK-TNS-002',
        catatan: 'Tensimeter UGD Sukamakmur.'
      },
      {
        kodeAset: 'AST-SKM-MSRG-01',
        namaAset: 'Minor Surgery Instrument Set Sukamakmur',
        roomKey: 'R-UGD-SKM-01',
        faskesId: faskesSukamakmur.id,
        kategoriAset: 'MEDIS_TERAPETIK',
        merk: 'SMI Surgical',
        tipeModel: 'Minor Set 14 Instruments',
        nomorSeri: 'MSRG-SKM-2024',
        tahunPerolehan: 2024,
        sumberAnggaran: 'BOK',
        hargaPerolehan: 3500000,
        tarifPemakaian: 15000,
        isAlkesTindakan: true,
        kondisiAset: 'BAIK',
        statusOperasional: 'AKTIF_DIGUNAKAN',
        kodeAspak: 'ASPAK-MSRG-02',
        catatan: 'Set bedah minor penanganan hecting luka darurat.'
      },
      {
        kodeAset: 'AST-SKM-NEB-01',
        namaAset: 'Nebulizer Compressor Medis Sukamakmur',
        roomKey: 'R-UGD-SKM-01',
        faskesId: faskesSukamakmur.id,
        kategoriAset: 'MEDIS_TERAPETIK',
        merk: 'Omron',
        tipeModel: 'NE-C28',
        nomorSeri: 'OMR-SKM-NEB-02',
        tahunPerolehan: 2023,
        sumberAnggaran: 'BLUD',
        hargaPerolehan: 1800000,
        tarifPemakaian: 20000,
        isAlkesTindakan: true,
        kondisiAset: 'BAIK',
        statusOperasional: 'AKTIF_DIGUNAKAN',
        kodeAspak: 'ASPAK-NEB-02',
        catatan: 'Nebulizer penanganan sesak napas darurat di daerah Sukamakmur.'
      },
      {
        kodeAset: 'AST-SKM-EKG-01',
        namaAset: 'Elektrokardiograf (EKG) 12 Saluran Sukamakmur',
        roomKey: 'R-UGD-SKM-01',
        faskesId: faskesSukamakmur.id,
        kategoriAset: 'MEDIS_DIAGNOSTIK',
        merk: 'Bionet',
        tipeModel: 'CardioCare 2000',
        nomorSeri: 'BION-SKM-091',
        tahunPerolehan: 2023,
        sumberAnggaran: 'APBD',
        hargaPerolehan: 24000000,
        tarifPemakaian: 30000,
        isAlkesTindakan: true,
        kondisiAset: 'BAIK',
        statusOperasional: 'AKTIF_DIGUNAKAN',
        kodeAspak: 'ASPAK-EKG-02',
        catatan: 'Skrining aritmia dan sindroma koroner akut.'
      }
    );
  }

  let alkesCount = 0;
  for (const item of alkesMasterList) {
    const room = roomMap[item.roomKey];
    if (!room) {
      console.warn(`⚠️ Ruangan dengan kode ${item.roomKey} tidak ditemukan! Lewati ${item.kodeAset}`);
      continue;
    }

    const { roomKey, ...dataAset } = item;
    dataAset.ruanganId = room.id;

    await prisma.asetRuangan.upsert({
      where: { kodeAset: dataAset.kodeAset },
      update: dataAset,
      create: dataAset
    });
    alkesCount++;
  }
  console.log(`✅ ${alkesCount} Alat Kesehatan (Alkes) berhasil di-seed & disinkronkan ke database.`);

  // ==============================================================
  // 4. SEED BAHAN MEDIS HABIS PAKAI (BMHP) STANDAR PUSKESMAS
  // ==============================================================
  console.log('\n🩹 Seeding Katalog Bahan Medis Habis Pakai (BMHP) Puskesmas & Stok Logistik...');

  const bmhpCatalog = [
    // --- SPUIT & JARUM SUNTIK ---
    {
      kodeObat: 'BMHP-SPU-1CC',
      namaObat: 'Spuit 1cc Disposable Terumo (Tuberculin / BCG)',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 2500,
      kfa_code: '93005001'
    },
    {
      kodeObat: 'BMHP-SPU-3CC',
      namaObat: 'Spuit 3cc Disposable Terumo with Needle',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 3000,
      kfa_code: '93005002'
    },
    {
      kodeObat: 'BMHP-SPU-5CC',
      namaObat: 'Spuit 5cc Disposable Terumo with Needle',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 4000,
      kfa_code: '93005003'
    },
    {
      kodeObat: 'BMHP-SPU-10CC',
      namaObat: 'Spuit 10cc Disposable Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 5000,
      kfa_code: '93005004'
    },
    {
      kodeObat: 'BMHP-SPU-20CC',
      namaObat: 'Spuit 20cc Disposable Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 7500,
      kfa_code: '93005005'
    },
    {
      kodeObat: 'BMHP-SPU-50CC',
      namaObat: 'Spuit 50cc Catheter Tip (Lubang Tengah Sonde)',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 15000,
      kfa_code: '93005006'
    },
    {
      kodeObat: 'BMHP-NDL-23G',
      namaObat: 'Jarum Suntik Disposable Needle 23G x 1.25" Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 1500,
      kfa_code: '93005007'
    },
    {
      kodeObat: 'BMHP-NDL-25G',
      namaObat: 'Jarum Suntik Disposable Needle 25G x 1" Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 1500,
      kfa_code: '93005008'
    },
    {
      kodeObat: 'BMHP-NDL-27G',
      namaObat: 'Jarum Dental Disposable Citoject Needle 27G Long',
      kategori: 'BMHP Gigi',
      sediaan: 'Pcs',
      harga: 2000,
      kfa_code: '93005009'
    },

    // --- PERAWATAN LUKA, JAHIT & ANTISEPTIK ---
    {
      kodeObat: 'BMHP-KSA-STR',
      namaObat: 'Kasa Steril 16x16 cm Kotak (Isi 10 Pcs)',
      kategori: 'BMHP Steril',
      sediaan: 'Lembar',
      harga: 2000,
      kfa_code: '93005010'
    },
    {
      kodeObat: 'BMHP-KSA-GLG',
      namaObat: 'Kasa Gulung Hydrofil Perban 2 Yard x 80 cm',
      kategori: 'BMHP',
      sediaan: 'Roll',
      harga: 6000,
      kfa_code: '93005011'
    },
    {
      kodeObat: 'BMHP-PVI-60ML',
      namaObat: 'Povidone Iodine 10% Antiseptik Luka 60ml',
      kategori: 'BMHP Antiseptik',
      sediaan: 'Botol',
      harga: 8000,
      kfa_code: '93005012'
    },
    {
      kodeObat: 'BMHP-PVI-300ML',
      namaObat: 'Povidone Iodine 10% Larutan Antiseptik 300ml',
      kategori: 'BMHP Antiseptik',
      sediaan: 'Botol',
      harga: 25000,
      kfa_code: '93005013'
    },
    {
      kodeObat: 'BMHP-ALK-70',
      namaObat: 'Alkohol 70% Cairan Medis 100ml',
      kategori: 'BMHP Antiseptik',
      sediaan: 'Botol',
      harga: 6000,
      kfa_code: '93005014'
    },
    {
      kodeObat: 'BMHP-ALK-SWB',
      namaObat: 'Alcohol Swab Antiseptik 70% Isopropyl Sachet',
      kategori: 'BMHP Steril',
      sediaan: 'Sachet',
      harga: 1000,
      kfa_code: '93005015'
    },
    {
      kodeObat: 'BMHP-BNG-SLK',
      namaObat: 'Benang Jahit Silk 3-0 with Reverse Cutting Needle (Hecting)',
      kategori: 'BMHP Bedah',
      sediaan: 'Pcs',
      harga: 12000,
      kfa_code: '93005016'
    },
    {
      kodeObat: 'BMHP-BNG-SLK-20',
      namaObat: 'Benang Jahit Silk 2-0 with Curved Needle 75cm',
      kategori: 'BMHP Bedah',
      sediaan: 'Pcs',
      harga: 12000,
      kfa_code: '93005017'
    },
    {
      kodeObat: 'BMHP-BNG-CAT',
      namaObat: 'Benang Jahit Chromic Catgut 3-0 Absorbable with Needle',
      kategori: 'BMHP Bedah',
      sediaan: 'Pcs',
      harga: 15000,
      kfa_code: '93005018'
    },
    {
      kodeObat: 'BMHP-BNG-PLG',
      namaObat: 'Benang Jahit Plain Catgut 3-0 with Needle',
      kategori: 'BMHP Bedah',
      sediaan: 'Pcs',
      harga: 15000,
      kfa_code: '93005019'
    },
    {
      kodeObat: 'BMHP-PLS-ROL',
      namaObat: 'Plester Perekat Medis Micropore 1/2 Inch 3M',
      kategori: 'BMHP',
      sediaan: 'Roll',
      harga: 8000,
      kfa_code: '93005020'
    },
    {
      kodeObat: 'BMHP-PLS-MED',
      namaObat: 'Plester Luka Hipafix Fiksasi Medis 5cm x 1m',
      kategori: 'BMHP',
      sediaan: 'Roll',
      harga: 12000,
      kfa_code: '93005021'
    },
    {
      kodeObat: 'BMHP-H2O2',
      namaObat: 'Hydrogen Peroxide (H2O2) 3% Pembersih Luka 100ml',
      kategori: 'BMHP Antiseptik',
      sediaan: 'Botol',
      harga: 9000,
      kfa_code: '93005022'
    },
    {
      kodeObat: 'BMHP-RIV-100',
      namaObat: 'Rivanol 0.1% Larutan Kompres Luka 100ml',
      kategori: 'BMHP Antiseptik',
      sediaan: 'Botol',
      harga: 6000,
      kfa_code: '93005023'
    },
    {
      kodeObat: 'BMHP-SAL-LUK',
      namaObat: 'Silver Sulfadiazine 1% Burn Cream Salep Luka Bakar 35g',
      kategori: 'BMHP Farmasi',
      sediaan: 'Tube',
      harga: 18000,
      kfa_code: '93005024'
    },

    // --- ANESTESI LOKAL & PELARUT INJEKSI ---
    {
      kodeObat: 'BMHP-LID-2',
      namaObat: 'Lidocaine HCl 2% Injeksi Anestesi Lokal 2ml Ampul',
      kategori: 'BMHP Anestesi',
      sediaan: 'Ampul',
      harga: 5000,
      kfa_code: '93005025'
    },
    {
      kodeObat: 'BMHP-LID-ADR',
      namaObat: 'Pehacain Injeksi Dental (Lidocaine 2% + Adrenalin 1:80.000) 2ml',
      kategori: 'BMHP Gigi',
      sediaan: 'Ampul',
      harga: 7500,
      kfa_code: '93005026'
    },
    {
      kodeObat: 'BMHP-AQU-25',
      namaObat: 'Aqua Pro Injeksi Pelarut Steril 25ml',
      kategori: 'BMHP Pelarut',
      sediaan: 'Vial',
      harga: 5000,
      kfa_code: '93005027'
    },

    // --- INFUS, JALUR INTRAVENA & CAIRAN KRISTALOID ---
    {
      kodeObat: 'BMHP-INF-SET',
      namaObat: 'Infus Set Dewasa Makro Drip 20 Drops/ml Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Set',
      harga: 10000,
      kfa_code: '93005028'
    },
    {
      kodeObat: 'BMHP-INF-PED',
      namaObat: 'Infus Set Pediatrik Mikro Drip 60 Drops/ml',
      kategori: 'BMHP Steril',
      sediaan: 'Set',
      harga: 12000,
      kfa_code: '93005029'
    },
    {
      kodeObat: 'BMHP-INF-TRN',
      namaObat: 'Blood Transfusion Set with Filter 200 Mesh',
      kategori: 'BMHP Steril',
      sediaan: 'Set',
      harga: 15000,
      kfa_code: '93005030'
    },
    {
      kodeObat: 'BMHP-ABO-18G',
      namaObat: 'Abocath / IV Catheter 18G Hijau Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 8000,
      kfa_code: '93005031'
    },
    {
      kodeObat: 'BMHP-ABO-20G',
      namaObat: 'Abocath / IV Catheter 20G Merah Muda Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 8000,
      kfa_code: '93005032'
    },
    {
      kodeObat: 'BMHP-ABO-22G',
      namaObat: 'Abocath / IV Catheter 22G Biru Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 8000,
      kfa_code: '93005033'
    },
    {
      kodeObat: 'BMHP-ABO-24G',
      namaObat: 'Abocath / IV Catheter 24G Kuning Pediatrik Terumo',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 8500,
      kfa_code: '93005034'
    },
    {
      kodeObat: 'BMHP-WAY-3',
      namaObat: '3-Way Stopcock Extention Tube Infus',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 9000,
      kfa_code: '93005035'
    },
    {
      kodeObat: 'BMHP-CRL-500',
      namaObat: 'Cairan Ringer Lactate (RL) Infus 500ml Otsuka',
      kategori: 'BMHP Infus',
      sediaan: 'Kolf',
      harga: 12000,
      kfa_code: '93005036'
    },
    {
      kodeObat: 'BMHP-NCL-500',
      namaObat: 'Cairan NaCl 0.9% Normal Saline Infus 500ml Otsuka',
      kategori: 'BMHP Infus',
      sediaan: 'Kolf',
      harga: 11000,
      kfa_code: '93005037'
    },
    {
      kodeObat: 'BMHP-DEX-5',
      namaObat: 'Cairan Dextrose 5% (D5) Infus 500ml Otsuka',
      kategori: 'BMHP Infus',
      sediaan: 'Kolf',
      harga: 12000,
      kfa_code: '93005038'
    },
    {
      kodeObat: 'BMHP-DEX-10',
      namaObat: 'Cairan Dextrose 10% (D10) Infus 500ml Otsuka',
      kategori: 'BMHP Infus',
      sediaan: 'Kolf',
      harga: 13000,
      kfa_code: '93005039'
    },

    // --- PROTEKSI DIRI & ALAS MEDIS ---
    {
      kodeObat: 'BMHP-GLV-ST-70',
      namaObat: 'Handscoon Bedah Steril No. 7.0 Surgical Gloves',
      kategori: 'BMHP Proteksi',
      sediaan: 'Pasang',
      harga: 7000,
      kfa_code: '93005040'
    },
    {
      kodeObat: 'BMHP-GLV-ST-75',
      namaObat: 'Handscoon Bedah Steril No. 7.5 Surgical Gloves',
      kategori: 'BMHP Proteksi',
      sediaan: 'Pasang',
      harga: 7000,
      kfa_code: '93005041'
    },
    {
      kodeObat: 'BMHP-GLV-EX-M',
      namaObat: 'Sarung Tangan Pemeriksaan Non-Steril Nitrile M (Sensi)',
      kategori: 'BMHP Proteksi',
      sediaan: 'Pasang',
      harga: 2500,
      kfa_code: '93005042'
    },
    {
      kodeObat: 'BMHP-MSK-3P',
      namaObat: 'Masker Bedah 3-Ply Earloop Kemenkes Terstandar',
      kategori: 'BMHP Proteksi',
      sediaan: 'Pcs',
      harga: 1500,
      kfa_code: '93005043'
    },
    {
      kodeObat: 'BMHP-MSK-N95',
      namaObat: 'Masker N95 Respirator Medis 3M 1860',
      kategori: 'BMHP Proteksi',
      sediaan: 'Pcs',
      harga: 15000,
      kfa_code: '93005044'
    },
    {
      kodeObat: 'BMHP-UND-PAD',
      namaObat: 'Underpad Higienis Alas Medis Sekali Pakai 60x90cm',
      kategori: 'BMHP',
      sediaan: 'Lembar',
      harga: 5000,
      kfa_code: '93005045'
    },

    // --- TERAPI OKSIGEN, NEBULISASI & SUCTION ---
    {
      kodeObat: 'BMHP-MSK-NEB',
      namaObat: 'Masker Nebulizer Dewasa Kit with Tubing & Cup',
      kategori: 'BMHP Terapi',
      sediaan: 'Set',
      harga: 15000,
      kfa_code: '93005046'
    },
    {
      kodeObat: 'BMHP-MSK-NEB-P',
      namaObat: 'Masker Nebulizer Anak / Pediatrik Kit with Tubing',
      kategori: 'BMHP Terapi',
      sediaan: 'Set',
      harga: 15000,
      kfa_code: '93005047'
    },
    {
      kodeObat: 'BMHP-CAN-O2-D',
      namaObat: 'Nasal Cannula Oksigen Dewasa 2 Meter',
      kategori: 'BMHP Terapi',
      sediaan: 'Pcs',
      harga: 6000,
      kfa_code: '93005048'
    },
    {
      kodeObat: 'BMHP-CAN-O2-A',
      namaObat: 'Nasal Cannula Oksigen Pediatrik / Anak',
      kategori: 'BMHP Terapi',
      sediaan: 'Pcs',
      harga: 6000,
      kfa_code: '93005049'
    },
    {
      kodeObat: 'BMHP-MSK-NRM',
      namaObat: 'Non-Rebreathing Mask (NRM) Oksigen Dewasa with Reservoir',
      kategori: 'BMHP Terapi',
      sediaan: 'Set',
      harga: 18000,
      kfa_code: '93005050'
    },
    {
      kodeObat: 'BMHP-SUC-CAT',
      namaObat: 'Suction Catheter No. 10 / 12 Fr Disposable with Finger Control',
      kategori: 'BMHP Terapi',
      sediaan: 'Pcs',
      harga: 5000,
      kfa_code: '93005051'
    },

    // --- KATETERISASI & URIN ---
    {
      kodeObat: 'BMHP-CAT-16',
      namaObat: 'Foley Catheter Balon 2-Way No. 16 Fr Silikon Rusch',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 18000,
      kfa_code: '93005052'
    },
    {
      kodeObat: 'BMHP-CAT-18',
      namaObat: 'Foley Catheter Balon 2-Way No. 18 Fr Silikon Rusch',
      kategori: 'BMHP Steril',
      sediaan: 'Pcs',
      harga: 18000,
      kfa_code: '93005053'
    },
    {
      kodeObat: 'BMHP-URN-BAG',
      namaObat: 'Urine Bag Penampung Urin 2000ml with T-Valve Drain',
      kategori: 'BMHP',
      sediaan: 'Pcs',
      harga: 8000,
      kfa_code: '93005054'
    },
    {
      kodeObat: 'BMHP-GEL-LUB',
      namaObat: 'KY Lubricating Jelly Gel Pelumas Steril Medis 50g',
      kategori: 'BMHP Farmasi',
      sediaan: 'Tube',
      harga: 15000,
      kfa_code: '93005055'
    },

    // --- STRIP UJI DIAGNOSTIK CEPAT (RAPID TEST) & EKG ---
    {
      kodeObat: 'BMHP-KTS-EKG',
      namaObat: 'Kertas Thermal EKG 50mm x 20m & Gel EKG Konduktif',
      kategori: 'BMHP Diagnostik',
      sediaan: 'Set',
      harga: 10000,
      kfa_code: '93005056'
    },
    {
      kodeObat: 'BMHP-STP-GDA',
      namaObat: 'Strip Tes Gula Darah Acak (GDA/GDS) Glukosa Kapiler',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Strip',
      harga: 4000,
      kfa_code: '93005057'
    },
    {
      kodeObat: 'BMHP-STP-CHL',
      namaObat: 'Strip Tes Kolesterol Total Kapiler',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Strip',
      harga: 15000,
      kfa_code: '93005058'
    },
    {
      kodeObat: 'BMHP-STP-AU',
      namaObat: 'Strip Tes Asam Urat (Uric Acid) Kapiler',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Strip',
      harga: 7000,
      kfa_code: '93005059'
    },
    {
      kodeObat: 'BMHP-STP-URN',
      namaObat: 'Strip Tes Urin 10 Parameter (Protein, Reduksi, Leukosit, dll)',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Strip',
      harga: 5000,
      kfa_code: '93005060'
    },
    {
      kodeObat: 'BMHP-RPD-HIV',
      namaObat: 'Rapid Test HIV 1/2 Antibody Combo Strip Kemenkes',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Kit',
      harga: 25000,
      kfa_code: '93005061'
    },
    {
      kodeObat: 'BMHP-RPD-SYP',
      namaObat: 'Rapid Test Sifilis TP (Treponema Pallidum)',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Kit',
      harga: 20000,
      kfa_code: '93005062'
    },
    {
      kodeObat: 'BMHP-RPD-HBS',
      namaObat: 'Rapid Test HBsAg Kualitatif Hepatitis B',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Kit',
      harga: 20000,
      kfa_code: '93005063'
    },
    {
      kodeObat: 'BMHP-TST-PP',
      namaObat: 'Test Pack Kehamilan Akurat hCG Strip',
      kategori: 'BMHP Diagnostik',
      sediaan: 'Strip',
      harga: 5000,
      kfa_code: '93005064'
    },
    {
      kodeObat: 'BMHP-LNC-MED',
      namaObat: 'Blood Lancet Jarum Penusuk Kapiler 28G Steril',
      kategori: 'BMHP Laboratorium',
      sediaan: 'Pcs',
      harga: 1000,
      kfa_code: '93005065'
    },

    // --- BMHP POLI GIGI ---
    {
      kodeObat: 'BMHP-DNT-EUG',
      namaObat: 'Bahan Tumpatan Gigi Sementara Cavit / Zinc Oxide Eugenol',
      kategori: 'BMHP Gigi',
      sediaan: 'Tube',
      harga: 25000,
      kfa_code: '93005066'
    },
    {
      kodeObat: 'BMHP-DNT-GIC',
      namaObat: 'Glass Ionomer Cement (GIC) Fuji IX Tumpatan Gigi Komplit',
      kategori: 'BMHP Gigi',
      sediaan: 'Set',
      harga: 50000,
      kfa_code: '93005067'
    },
    {
      kodeObat: 'BMHP-DNT-ART',
      namaObat: 'Articulating Paper Kertas Oklusi Gigitan Biru-Merah',
      kategori: 'BMHP Gigi',
      sediaan: 'Buku',
      harga: 15000,
      kfa_code: '93005068'
    },
    {
      kodeObat: 'BMHP-DNT-SAL',
      namaObat: 'Saliva Ejector Suction Disposable Tip Dental',
      kategori: 'BMHP Gigi',
      sediaan: 'Pcs',
      harga: 2000,
      kfa_code: '93005069'
    },
    {
      kodeObat: 'BMHP-DNT-COT',
      namaObat: 'Cotton Roll Gigi Steril Pengering Saliva Dental',
      kategori: 'BMHP Gigi',
      sediaan: 'Pcs',
      harga: 1000,
      kfa_code: '93005070'
    },

    // --- BMHP POLI KIA / KB ---
    {
      kodeObat: 'BMHP-IUD-CU',
      namaObat: 'IUD TCu 380A Copper T Spirals BKKBN Kemenkes',
      kategori: 'BMHP KIA',
      sediaan: 'Set',
      harga: 35000,
      kfa_code: '93005071'
    },
    {
      kodeObat: 'BMHP-IMP-LEV',
      namaObat: 'Susuk KB Implan 2 Batang Levonorgestrel Subdermal',
      kategori: 'BMHP KIA',
      sediaan: 'Set',
      harga: 45000,
      kfa_code: '93005072'
    },
    {
      kodeObat: 'BMHP-UMB-CLP',
      namaObat: 'Umbilical Cord Clamp Penjepit Tali Pusat Bayi Steril',
      kategori: 'BMHP KIA',
      sediaan: 'Pcs',
      harga: 3000,
      kfa_code: '93005073'
    }
  ];

  let bmhpCreatedCount = 0;
  const expiredDate = new Date('2028-12-31T00:00:00.000Z');

  for (const item of bmhpCatalog) {
    const createdObat = await prisma.masterObat.upsert({
      where: { kodeObat: item.kodeObat },
      update: {
        namaObat: item.namaObat,
        kategori: item.kategori,
        sediaan: item.sediaan,
        harga: item.harga,
        kfa_code: item.kfa_code
      },
      create: item
    });
    bmhpCreatedCount++;

    // Stok di Puskesmas Cibinong Raya (Berlimpah: 200 - 500 pcs)
    await prisma.stokObatFaskes.upsert({
      where: {
        faskesId_obatId_noBatch: {
          faskesId: faskesCibinong.id,
          obatId: createdObat.id,
          noBatch: `BCH-CBN-${item.kodeObat}`
        }
      },
      update: {
        stok: 350,
        stokMinimum: 30,
        tanggalExpired: expiredDate,
        statusAktif: true
      },
      create: {
        faskesId: faskesCibinong.id,
        obatId: createdObat.id,
        stok: 350,
        stokMinimum: 30,
        noBatch: `BCH-CBN-${item.kodeObat}`,
        tanggalExpired: expiredDate,
        statusAktif: true
      }
    });

    // Stok di Puskesmas Sukamakmur jika ada
    if (faskesSukamakmur) {
      await prisma.stokObatFaskes.upsert({
        where: {
          faskesId_obatId_noBatch: {
            faskesId: faskesSukamakmur.id,
            obatId: createdObat.id,
            noBatch: `BCH-SKM-${item.kodeObat}`
          }
        },
        update: {
          stok: 120,
          stokMinimum: 20,
          tanggalExpired: expiredDate,
          statusAktif: true
        },
        create: {
          faskesId: faskesSukamakmur.id,
          obatId: createdObat.id,
          stok: 120,
          stokMinimum: 20,
          noBatch: `BCH-SKM-${item.kodeObat}`,
          tanggalExpired: expiredDate,
          statusAktif: true
        }
      });
    }
  }

  console.log(`✅ ${bmhpCreatedCount} Bahan Medis Habis Pakai (BMHP) berhasil di-seed ke MasterObat.`);
  console.log(`✅ Stok awal logistik farmasi & depo berhasil disuntikkan ke Puskesmas Cibinong & Sukamakmur.`);

  // 5. Verifikasi Final
  const totalAset = await prisma.asetRuangan.count();
  const totalAlkesTindakan = await prisma.asetRuangan.count({ where: { isAlkesTindakan: true } });
  const totalObat = await prisma.masterObat.count();
  const totalStok = await prisma.stokObatFaskes.count();

  console.log('\n===============================================================');
  console.log('🎉 SEEDING SELESAI DENGAN SUKSES!');
  console.log('===============================================================');
  console.log(`📊 Total Aset Ruangan di Database       : ${totalAset}`);
  console.log(`🩺 Total Alkes Tindakan Ber-Tarif        : ${totalAlkesTindakan}`);
  console.log(`💊 Total Master Obat + BMHP di Database : ${totalObat}`);
  console.log(`📦 Total Entri Stok Faskes              : ${totalStok}`);
  console.log('===============================================================');
}

if (require.main === module) {
  seedAlkesAndBmhp()
    .catch((err) => {
      console.error('❌ Gagal menjalankan seed alkes & bmhp:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedAlkesAndBmhp };
