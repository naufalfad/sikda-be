const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Memulai proses Seeding Data SIKDA Multi-Faskes & HL7 FHIR SATUSEHAT...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // ==============================================================
  // 1. SEED MASTER FASKES KABUPATEN
  // ==============================================================
  console.log('🏥 Seeding Master Fasilitas Kesehatan (Faskes se-Kabupaten)...');

  const faskesCibinong = await prisma.faskes.upsert({
    where: { kodeFaskes: 'P3201010101' },
    update: {
      namaFaskes: 'Puskesmas Cibinong Raya',
      jenisFaskes: 'PUSKESMAS_RAWAT_INAP',
      kategoriWilayah: 'PERKOTAAN',
      kecamatan: 'Cibinong',
      desaKelurahan: 'Cirimekar',
      alamat: 'Jl. Raya Jakarta-Bogor Km. 43 No. 12',
      titikGps: '-6.4812,106.8524',
      targetKunjunganHarian: 150,
      jumlahPendudukWilayah: 68000,
      statusAktif: true
    },
    create: {
      kodeFaskes: 'P3201010101',
      namaFaskes: 'Puskesmas Cibinong Raya',
      jenisFaskes: 'PUSKESMAS_RAWAT_INAP',
      kategoriWilayah: 'PERKOTAAN',
      kecamatan: 'Cibinong',
      desaKelurahan: 'Cirimekar',
      alamat: 'Jl. Raya Jakarta-Bogor Km. 43 No. 12',
      titikGps: '-6.4812,106.8524',
      targetKunjunganHarian: 150,
      jumlahPendudukWilayah: 68000,
      statusAktif: true,
      ihsOrganizationId: 'Org-Cibinong-01'
    }
  });

  const faskesSukamakmur = await prisma.faskes.upsert({
    where: { kodeFaskes: 'P3201010202' },
    update: {
      namaFaskes: 'Puskesmas Sukamakmur',
      jenisFaskes: 'PUSKESMAS_NON_RAWAT_INAP',
      kategoriWilayah: 'TERPENCIL',
      kecamatan: 'Sukamakmur',
      desaKelurahan: 'Sukaharja',
      alamat: 'Jl. Puncak Dua Km. 12',
      titikGps: '-6.5891,106.9934',
      targetKunjunganHarian: 40,
      jumlahPendudukWilayah: 24000,
      statusAktif: true
    },
    create: {
      kodeFaskes: 'P3201010202',
      namaFaskes: 'Puskesmas Sukamakmur',
      jenisFaskes: 'PUSKESMAS_NON_RAWAT_INAP',
      kategoriWilayah: 'TERPENCIL',
      kecamatan: 'Sukamakmur',
      desaKelurahan: 'Sukaharja',
      alamat: 'Jl. Puncak Dua Km. 12',
      titikGps: '-6.5891,106.9934',
      targetKunjunganHarian: 40,
      jumlahPendudukWilayah: 24000,
      statusAktif: true,
      ihsOrganizationId: 'Org-Sukamakmur-02'
    }
  });

  console.log(`✅ Faskes berhasil di-seed: ${faskesCibinong.namaFaskes} & ${faskesSukamakmur.namaFaskes}`);

  // ==============================================================
  // 2. SEED REFERENSI ENUM (DROPDOWN SISTEM)
  // ==============================================================
  const refJenisPenjamins = [
    { kode: 'UMUM', label: 'Umum / Mandiri', isBpjs: false, urutan: 1 },
    { kode: 'BPJS', label: 'BPJS Kesehatan', isBpjs: true, urutan: 2 },
    { kode: 'ASURANSI', label: 'Asuransi Swasta', isBpjs: false, urutan: 3 },
    { kode: 'PERUSAHAAN', label: 'Perusahaan', isBpjs: false, urutan: 4 },
    { kode: 'JAMINAN_DAERAH', label: 'Jaminan Kesehatan Daerah (Jamkesda)', isBpjs: false, urutan: 5 },
  ];
  for (const item of refJenisPenjamins) {
    await prisma.refJenisPenjamin.upsert({
      where: { kode: item.kode },
      update: { label: item.label, isBpjs: item.isBpjs, urutan: item.urutan },
      create: item,
    });
  }

  const refJenisPelayanans = [
    { kode: 'RAWAT_JALAN', label: 'Rawat Jalan' },
    { kode: 'RAWAT_INAP', label: 'Rawat Inap' },
    { kode: 'IGD', label: 'Instalasi Gawat Darurat (IGD)' },
    { kode: 'UKM', label: 'Usaha Kesehatan Masyarakat (UKM)' },
  ];
  for (const item of refJenisPelayanans) {
    await prisma.refJenisPelayanan.upsert({
      where: { kode: item.kode },
      update: { label: item.label },
      create: item,
    });
  }

  const refCaraDatangs = [
    { kode: 'MANDIRI', label: 'Datang Sendiri', butuhDataRujukan: false },
    { kode: 'AMBULANS', label: 'Ambulans', butuhDataRujukan: false },
    { kode: 'RUJUKAN', label: 'Rujukan', butuhDataRujukan: true },
  ];
  for (const item of refCaraDatangs) {
    await prisma.refCaraDatang.upsert({
      where: { kode: item.kode },
      update: { label: item.label, butuhDataRujukan: item.butuhDataRujukan },
      create: item,
    });
  }

  const refPrioritass = [
    { kode: 'UMUM', label: 'Umum', warnaBadge: 'gray', urutan: 1 },
    { kode: 'LANSIA', label: 'Lansia (>60 Tahun)', warnaBadge: 'yellow', urutan: 2 },
    { kode: 'DISABILITAS', label: 'Disabilitas', warnaBadge: 'blue', urutan: 3 },
    { kode: 'HAMIL', label: 'Ibu Hamil / Menyusui', warnaBadge: 'pink', urutan: 4 },
    { kode: 'ANAK', label: 'Bayi & Anak-anak', warnaBadge: 'green', urutan: 5 },
  ];
  for (const item of refPrioritass) {
    await prisma.refPrioritas.upsert({
      where: { kode: item.kode },
      update: { label: item.label, warnaBadge: item.warnaBadge, urutan: item.urutan },
      create: item,
    });
  }

  const refKategoriTriages = [
    { kode: 'MERAH', label: 'Resusitasi / Merah (Gawat Darurat)', warna: '#EF4444', urutan: 1 },
    { kode: 'KUNING', label: 'Urgent / Kuning (Darurat Tidak Gawat)', warna: '#F59E0B', urutan: 2 },
    { kode: 'HIJAU', label: 'Non-Urgent / Hijau (Tidak Gawat Tidak Darurat)', warna: '#10B981', urutan: 3 },
    { kode: 'HITAM', label: 'Meninggal Dunia / Hitam', warna: '#1F2937', urutan: 4 },
  ];
  for (const item of refKategoriTriages) {
    await prisma.refKategoriTriage.upsert({
      where: { kode: item.kode },
      update: { label: item.label, warna: item.warna, urutan: item.urutan },
      create: item,
    });
  }

  const refMetodePembayarans = [
    { kode: 'TUNAI', label: 'Tunai', isBpjs: false },
    { kode: 'TRANSFER', label: 'Transfer Bank', isBpjs: false },
    { kode: 'QRIS', label: 'QRIS', isBpjs: false },
    { kode: 'BPJS', label: 'Klaim BPJS', isBpjs: true },
  ];
  for (const item of refMetodePembayarans) {
    await prisma.refMetodePembayaran.upsert({
      where: { kode: item.kode },
      update: { label: item.label, isBpjs: item.isBpjs },
      create: item,
    });
  }

  const refSediaanObats = [
    { kode: 'TABLET', label: 'Tablet' },
    { kode: 'KAPSUL', label: 'Kapsul' },
    { kode: 'SIRUP', label: 'Sirup / Larutan' },
    { kode: 'INJEKSI', label: 'Injeksi / Ampul / Vial' },
    { kode: 'SALEP', label: 'Salep / Krim / Gel' },
  ];
  for (const item of refSediaanObats) {
    await prisma.refSediaanObat.upsert({
      where: { kode: item.kode },
      update: { label: item.label },
      create: item,
    });
  }

  const refKategoriObats = [
    { kode: 'OBAT_BEBAS', label: 'Obat Bebas', warnaBadge: 'green' },
    { kode: 'OBAT_BEBAS_TERBATAS', label: 'Obat Bebas Terbatas', warnaBadge: 'blue' },
    { kode: 'OBAT_KERAS', label: 'Obat Keras', warnaBadge: 'red' },
    { kode: 'NARKOTIKA', label: 'Narkotika', warnaBadge: 'purple' },
    { kode: 'PSIKOTROPIKA', label: 'Psikotropika', warnaBadge: 'yellow' },
  ];
  for (const item of refKategoriObats) {
    await prisma.refKategoriObat.upsert({
      where: { kode: item.kode },
      update: { label: item.label, warnaBadge: item.warnaBadge },
      create: item,
    });
  }

  // ==============================================================
  // 3. SEED POLIKLINIK & LAYANAN KLINIK
  // ==============================================================
  const masterPolis = [
    {
      kodePoli: 'UMUM', namaPoli: 'Poli Umum',
      layanans: [
        { kode: 'KONSUL-UMUM', nama: 'Konsultasi Dokter Umum', tarif: 15000 },
        { kode: '38.93', nama: 'Pemasangan Infus', tarif: 50000 },
        { kode: '86.59', nama: 'Penjahitan Luka (Bedah Minor)', tarif: 120000 },
      ]
    },
    {
      kodePoli: 'GIGI', namaPoli: 'Poli Gigi & Mulut',
      layanans: [
        { kode: 'KONSUL-GIGI', nama: 'Pemeriksaan Kesehatan Gigi', tarif: 20000 },
        { kode: '23.09', nama: 'Pencabutan Gigi Tetap', tarif: 75000 },
        { kode: '23.2', nama: 'Penambalan Gigi Komposit', tarif: 100000 },
      ]
    },
    {
      kodePoli: 'KIA', namaPoli: 'Poli KIA & KB',
      layanans: [
        { kode: 'KONSUL-KIA', nama: 'Konsultasi Ibu Hamil (ANC)', tarif: 20000 },
        { kode: 'IMUN-DASAR', nama: 'Imunisasi Dasar Bayi', tarif: 10000 },
        { kode: 'KB-SUNTIK', nama: 'Pelayanan KB Suntik 3 Bulan', tarif: 25000 },
      ]
    },
    {
      kodePoli: 'RAD', namaPoli: 'Radiologi',
      layanans: [
        { kode: '87.44', nama: 'Foto Thoraks PA', tarif: 150000 },
        { kode: '88.72', nama: 'USG Abdomen', tarif: 250000 },
      ]
    }
  ];

  const poliMap = {};
  for (const poliData of masterPolis) {
    let poli = await prisma.poliklinik.findFirst({
      where: { faskesId: null, kodePoli: poliData.kodePoli }
    });
    if (!poli) {
      poli = await prisma.poliklinik.create({
        data: {
          faskesId: null,
          kodePoli: poliData.kodePoli,
          namaPoli: poliData.namaPoli,
          deskripsi: `Layanan untuk ${poliData.namaPoli}`,
          statusAktif: true
        }
      });
    } else {
      poli = await prisma.poliklinik.update({
        where: { id: poli.id },
        data: {
          namaPoli: poliData.namaPoli,
          deskripsi: `Layanan untuk ${poliData.namaPoli}`
        }
      });
    }
    poliMap[poliData.kodePoli] = poli;

    for (const lay of poliData.layanans) {
      await prisma.layananKlinik.upsert({
        where: { kodeLayanan: lay.kode },
        update: { namaLayanan: lay.nama, tarifDasar: lay.tarif },
        create: {
          kodeLayanan: lay.kode,
          namaLayanan: lay.nama,
          deskripsi: lay.nama,
          tarifDasar: lay.tarif,
          poliklinikId: poli.id,
          statusAktif: true
        }
      });
    }
  }

  // ==============================================================
  // 4. SEED USERS DENGAN ISOLASI FASKES & TENAGA MEDIS
  // ==============================================================
  console.log('👤 Seeding Users & Tenaga Medis per Faskes (Multi-Tenant)...');

  // A. User Dinas Kesehatan Kabupaten (Akses Seluruh Kabupaten)
  await prisma.user.upsert({
    where: { username: 'admin_dinkes' },
    update: { role: 'DINKES_ADMIN', namaLengkap: 'Administrator Dinas Kesehatan' },
    create: {
      username: 'admin_dinkes',
      password: passwordHash,
      namaLengkap: 'Administrator Dinas Kesehatan Kabupaten',
      role: 'DINKES_ADMIN',
      faskesId: null // Global
    }
  });

  await prisma.user.upsert({
    where: { username: 'kadinkes' },
    update: { role: 'DINKES_MONITORING', namaLengkap: 'dr. H. Hendra, M.Kes (Kepala Dinas)' },
    create: {
      username: 'kadinkes',
      password: passwordHash,
      namaLengkap: 'dr. H. Hendra, M.Kes (Kepala Dinas)',
      role: 'DINKES_MONITORING',
      faskesId: null // Global
    }
  });

  // B. Tenaga Medis & Staf Puskesmas Cibinong
  const userDrCibinong = await prisma.user.upsert({
    where: { username: 'dr_cibinong' },
    update: { faskesId: faskesCibinong.id, poliklinikId: poliMap['UMUM'].id },
    create: {
      username: 'dr_cibinong',
      password: passwordHash,
      namaLengkap: 'dr. Sarah Andini (Poli Umum Cibinong)',
      role: 'DOKTER',
      faskesId: faskesCibinong.id,
      poliklinikId: poliMap['UMUM'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010101850001' },
    update: { faskesId: faskesCibinong.id, profesi: 'DOKTER_UMUM', spesialis: 'Dokter Umum' },
    create: {
      userId: userDrCibinong.id,
      nik: '3201010101850001',
      noIHS: 'IHS-DOKTER-001',
      profesi: 'DOKTER_UMUM',
      spesialis: 'Dokter Umum',
      statusKepegawaian: 'PNS',
      nomorStr: 'STR-3201-998811',
      nomorSip: 'SIP-503/001/DOKTER/2026',
      kuotaPasienHarian: 50,
      faskesId: faskesCibinong.id
    }
  });

  const userPerawatCibinong = await prisma.user.upsert({
    where: { username: 'perawat_cibinong' },
    update: { faskesId: faskesCibinong.id, poliklinikId: poliMap['UMUM'].id },
    create: {
      username: 'perawat_cibinong',
      password: passwordHash,
      namaLengkap: 'Ns. Ratna Sari, S.Kep (Perawat Cibinong)',
      role: 'PERAWAT',
      faskesId: faskesCibinong.id,
      poliklinikId: poliMap['UMUM'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010101880002' },
    update: { faskesId: faskesCibinong.id, profesi: 'PERAWAT' },
    create: {
      userId: userPerawatCibinong.id,
      nik: '3201010101880002',
      noIHS: 'IHS-PERAWAT-001',
      profesi: 'PERAWAT',
      statusKepegawaian: 'PPPK',
      nomorStr: 'STR-3201-776655',
      faskesId: faskesCibinong.id
    }
  });

  await prisma.user.upsert({
    where: { username: 'loket_cibinong' },
    update: { faskesId: faskesCibinong.id },
    create: {
      username: 'loket_cibinong',
      password: passwordHash,
      namaLengkap: 'Petugas Pendaftaran Cibinong',
      role: 'ADMINISTRASI',
      faskesId: faskesCibinong.id
    }
  });

  await prisma.user.upsert({
    where: { username: 'apoteker_cibinong' },
    update: { faskesId: faskesCibinong.id },
    create: {
      username: 'apoteker_cibinong',
      password: passwordHash,
      namaLengkap: 'Apt. Rudi, S.Farm (Apoteker Cibinong)',
      role: 'APOTEKER',
      faskesId: faskesCibinong.id
    }
  });

  // C. Tenaga Medis & Staf Puskesmas Sukamakmur (Terpencil)
  const userDrSukamakmur = await prisma.user.upsert({
    where: { username: 'dr_sukamakmur' },
    update: { faskesId: faskesSukamakmur.id, poliklinikId: poliMap['UMUM'].id },
    create: {
      username: 'dr_sukamakmur',
      password: passwordHash,
      namaLengkap: 'dr. Dimas Prasetyo (Dokter Sukamakmur)',
      role: 'DOKTER',
      faskesId: faskesSukamakmur.id,
      poliklinikId: poliMap['UMUM'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010202870001' },
    update: { faskesId: faskesSukamakmur.id, profesi: 'DOKTER_UMUM' },
    create: {
      userId: userDrSukamakmur.id,
      nik: '3201010202870001',
      noIHS: 'IHS-DOKTER-002',
      profesi: 'DOKTER_UMUM',
      spesialis: 'Dokter Umum',
      statusKepegawaian: 'PENUGASAN_KHUSUS',
      nomorStr: 'STR-3201-112233',
      nomorSip: 'SIP-503/002/DOKTER/2026',
      kuotaPasienHarian: 40,
      faskesId: faskesSukamakmur.id
    }
  });

  const userPerawatSukamakmur = await prisma.user.upsert({
    where: { username: 'perawat_sukamakmur' },
    update: { faskesId: faskesSukamakmur.id, poliklinikId: poliMap['UMUM'].id },
    create: {
      username: 'perawat_sukamakmur',
      password: passwordHash,
      namaLengkap: 'Bdn. Dewi Lestari, A.Md.Keb (Bidan Sukamakmur)',
      role: 'PERAWAT',
      faskesId: faskesSukamakmur.id,
      poliklinikId: poliMap['UMUM'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010202900002' },
    update: { faskesId: faskesSukamakmur.id, profesi: 'BIDAN' },
    create: {
      userId: userPerawatSukamakmur.id,
      nik: '3201010202900002',
      noIHS: 'IHS-BIDAN-001',
      profesi: 'BIDAN',
      statusKepegawaian: 'NON_ASN',
      nomorStr: 'STR-3201-445566',
      faskesId: faskesSukamakmur.id
    }
  });

  await prisma.user.upsert({
    where: { username: 'loket_sukamakmur' },
    update: { faskesId: faskesSukamakmur.id },
    create: {
      username: 'loket_sukamakmur',
      password: passwordHash,
      namaLengkap: 'Petugas Pendaftaran Sukamakmur',
      role: 'ADMINISTRASI',
      faskesId: faskesSukamakmur.id
    }
  });

  const userDrgSukamakmur = await prisma.user.upsert({
    where: { username: 'drg_sukamakmur' },
    update: { faskesId: faskesSukamakmur.id, poliklinikId: poliMap['GIGI'].id },
    create: {
      username: 'drg_sukamakmur',
      password: passwordHash,
      namaLengkap: 'drg. Maya Anggraini (Dokter Gigi Sukamakmur)',
      role: 'DOKTER',
      faskesId: faskesSukamakmur.id,
      poliklinikId: poliMap['GIGI'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010202870003' },
    update: { faskesId: faskesSukamakmur.id, profesi: 'DOKTER_GIGI' },
    create: {
      userId: userDrgSukamakmur.id,
      nik: '3201010202870003',
      noIHS: 'IHS-DOKTER-003',
      profesi: 'DOKTER_GIGI',
      spesialis: 'Dokter Gigi',
      statusKepegawaian: 'NON_ASN',
      nomorStr: 'STR-3201-334455',
      nomorSip: 'SIP-503/003/DOKTER/2026',
      kuotaPasienHarian: 30,
      faskesId: faskesSukamakmur.id
    }
  });

  const sukamakmurStaff = [
    { username: 'admin_sukamakmur', role: 'ADMIN', namaLengkap: 'Admin Puskesmas Sukamakmur' },
    { username: 'apoteker_sukamakmur', role: 'APOTEKER', namaLengkap: 'Apt. Linda, S.Farm (Apoteker Sukamakmur)' },
    { username: 'kasir_sukamakmur', role: 'KASIR', namaLengkap: 'Petugas Kasir Sukamakmur' },
    { username: 'laboratorium_sukamakmur', role: 'LABORATORIUM', namaLengkap: 'Analis Lab Sukamakmur' },
  ];
  for (const u of sukamakmurStaff) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { faskesId: faskesSukamakmur.id, role: u.role, namaLengkap: u.namaLengkap },
      create: {
        username: u.username,
        password: passwordHash,
        namaLengkap: u.namaLengkap,
        role: u.role,
        faskesId: faskesSukamakmur.id
      }
    });
  }

  // Dokter Gigi Cibinong
  const userDrgCibinong = await prisma.user.upsert({
    where: { username: 'drg_cibinong' },
    update: { faskesId: faskesCibinong.id, poliklinikId: poliMap['GIGI'].id },
    create: {
      username: 'drg_cibinong',
      password: passwordHash,
      namaLengkap: 'drg. Tri Wahyuni (Dokter Gigi Cibinong)',
      role: 'DOKTER',
      faskesId: faskesCibinong.id,
      poliklinikId: poliMap['GIGI'].id
    }
  });

  await prisma.tenagaMedis.upsert({
    where: { nik: '3201010101850004' },
    update: { faskesId: faskesCibinong.id, profesi: 'DOKTER_GIGI' },
    create: {
      userId: userDrgCibinong.id,
      nik: '3201010101850004',
      noIHS: 'IHS-DOKTER-004',
      profesi: 'DOKTER_GIGI',
      spesialis: 'Dokter Gigi',
      statusKepegawaian: 'PNS',
      nomorStr: 'STR-3201-556677',
      nomorSip: 'SIP-503/004/DOKTER/2026',
      kuotaPasienHarian: 40,
      faskesId: faskesCibinong.id
    }
  });

  // Default & legacy accounts (Puskesmas Cibinong Raya)
  const legacyUsers = [
    { username: 'admin', role: 'ADMIN', namaLengkap: 'Administrator Sistem Cibinong', faskesId: faskesCibinong.id },
    { username: 'admin_cibinong', role: 'ADMIN', namaLengkap: 'Administrator Puskesmas Cibinong', faskesId: faskesCibinong.id },
    { username: 'administrasi', role: 'ADMINISTRASI', namaLengkap: 'Petugas Loket Pendaftaran Cibinong', faskesId: faskesCibinong.id },
    { username: 'apoteker', role: 'APOTEKER', namaLengkap: 'Budi Farmasi, S.Farm. (Cibinong)', faskesId: faskesCibinong.id },
    { username: 'laboratorium', role: 'LABORATORIUM', namaLengkap: 'Siti Analis, Amd.AK (Cibinong)', faskesId: faskesCibinong.id },
    { username: 'laboratorium_cibinong', role: 'LABORATORIUM', namaLengkap: 'Siti Analis Lab Cibinong', faskesId: faskesCibinong.id },
    { username: 'kasir', role: 'KASIR', namaLengkap: 'Petugas Kasir Utama Cibinong', faskesId: faskesCibinong.id },
    { username: 'kasir_cibinong', role: 'KASIR', namaLengkap: 'Petugas Kasir Cibinong Raya', faskesId: faskesCibinong.id },
    { username: 'petugas_ukm', role: 'PETUGAS_UKM', namaLengkap: 'Perawat Program UKM Cibinong', faskesId: faskesCibinong.id },
    { username: 'radiologi', role: 'RADIOLOGI', namaLengkap: 'dr. Endang Sp.Rad (Cibinong)', faskesId: faskesCibinong.id },
    { username: 'dr.andi', role: 'DOKTER', namaLengkap: 'dr. Andi Wibowo', faskesId: faskesCibinong.id, poliklinikId: poliMap['UMUM'].id },
    { username: 'dr.siti', role: 'DOKTER', namaLengkap: 'dr. Siti Rahmawati', faskesId: faskesCibinong.id, poliklinikId: poliMap['UMUM'].id },
    { username: 'drg.budi', role: 'DOKTER', namaLengkap: 'drg. Budi Santoso', faskesId: faskesCibinong.id, poliklinikId: poliMap['GIGI'].id },
  ];
  for (const u of legacyUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { faskesId: u.faskesId, poliklinikId: u.poliklinikId || null, namaLengkap: u.namaLengkap, role: u.role },
      create: {
        username: u.username,
        password: passwordHash,
        namaLengkap: u.namaLengkap,
        role: u.role,
        faskesId: u.faskesId,
        poliklinikId: u.poliklinikId || null
      }
    });
  }

  // ==============================================================
  // 5. SEED MASTER OBAT & STOK OBAT PER FASKES
  // ==============================================================
  console.log('💊 Seeding Obat & Stok per Faskes...');
  const masterObatData = [
    { kodeObat: 'OBT-001', namaObat: 'Paracetamol 500mg', kategori: 'Obat Bebas', sediaan: 'Tablet', harga: 5000 },
    { kodeObat: 'OBT-002', namaObat: 'Amoxicillin 500mg', kategori: 'Obat Keras', sediaan: 'Kapsul', harga: 15000 },
    { kodeObat: 'OBT-003', namaObat: 'Amlodipine 5mg', kategori: 'Obat Keras', sediaan: 'Tablet', harga: 12000 },
    { kodeObat: 'OBT-004', namaObat: 'Metformin 500mg', kategori: 'Obat Keras', sediaan: 'Tablet', harga: 10000 },
    { kodeObat: 'OBT-OAT', namaObat: 'OAT FDC (Anti TB)', kategori: 'Antibiotik', sediaan: 'Tablet', harga: 0 },
    { kodeObat: 'OBT-ORALIT', namaObat: 'Oralit Sachet', kategori: 'Obat Bebas', sediaan: 'Serbuk', harga: 3000 },
  ];

  const obatMap = {};
  for (const obat of masterObatData) {
    const o = await prisma.masterObat.upsert({
      where: { kodeObat: obat.kodeObat },
      update: { harga: obat.harga },
      create: { ...obat }
    });
    obatMap[obat.kodeObat] = o;
  }

  // Alokasi Stok Obat per Faskes
  const defaultExp = new Date('2027-12-31');

  // Puskesmas Cibinong
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-001'].id } },
    update: { stok: 800, noBatch: 'BCH-CBN-OBT-001', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-001'].id, stok: 800, stokMinimum: 50, noBatch: 'BCH-CBN-OBT-001', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-002'].id } },
    update: { stok: 450, noBatch: 'BCH-CBN-OBT-002', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-002'].id, stok: 450, stokMinimum: 30, noBatch: 'BCH-CBN-OBT-002', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-003'].id } },
    update: { stok: 200, noBatch: 'BCH-CBN-OBT-003', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-003'].id, stok: 200, stokMinimum: 25, noBatch: 'BCH-CBN-OBT-003', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-004'].id } },
    update: { stok: 200, noBatch: 'BCH-CBN-OBT-004', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-004'].id, stok: 200, stokMinimum: 25, noBatch: 'BCH-CBN-OBT-004', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-OAT'].id } },
    update: { stok: 200, noBatch: 'BCH-CBN-OBT-OAT', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-OAT'].id, stok: 200, stokMinimum: 20, noBatch: 'BCH-CBN-OBT-OAT', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-ORALIT'].id } },
    update: { stok: 200, noBatch: 'BCH-CBN-OBT-ORALIT', tanggalExpired: defaultExp },
    create: { faskesId: faskesCibinong.id, obatId: obatMap['OBT-ORALIT'].id, stok: 200, stokMinimum: 25, noBatch: 'BCH-CBN-OBT-ORALIT', tanggalExpired: defaultExp }
  });

  // Puskesmas Sukamakmur (Kritis: Paracetamol menipis!)
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-001'].id } },
    update: { stok: 8, noBatch: 'BCH-SKM-OBT-001', tanggalExpired: defaultExp }, // DIBAWAH MINIMUM (Pemicu Alert Dinkes!)
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-001'].id, stok: 8, stokMinimum: 25, noBatch: 'BCH-SKM-OBT-001', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-002'].id } },
    update: { stok: 120, noBatch: 'BCH-SKM-OBT-002', tanggalExpired: defaultExp },
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-002'].id, stok: 120, stokMinimum: 20, noBatch: 'BCH-SKM-OBT-002', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-003'].id } },
    update: { stok: 120, noBatch: 'BCH-SKM-OBT-003', tanggalExpired: defaultExp },
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-003'].id, stok: 120, stokMinimum: 20, noBatch: 'BCH-SKM-OBT-003', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-004'].id } },
    update: { stok: 120, noBatch: 'BCH-SKM-OBT-004', tanggalExpired: defaultExp },
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-004'].id, stok: 120, stokMinimum: 20, noBatch: 'BCH-SKM-OBT-004', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-OAT'].id } },
    update: { stok: 80, noBatch: 'BCH-SKM-OBT-OAT', tanggalExpired: defaultExp },
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-OAT'].id, stok: 80, stokMinimum: 15, noBatch: 'BCH-SKM-OBT-OAT', tanggalExpired: defaultExp }
  });
  await prisma.stokObatFaskes.upsert({
    where: { faskesId_obatId: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-ORALIT'].id } },
    update: { stok: 15, noBatch: 'BCH-SKM-OBT-ORALIT', tanggalExpired: defaultExp },
    create: { faskesId: faskesSukamakmur.id, obatId: obatMap['OBT-ORALIT'].id, stok: 15, stokMinimum: 20, noBatch: 'BCH-SKM-OBT-ORALIT', tanggalExpired: defaultExp }
  });

  // ==============================================================
  // 6. SEED RUANGAN, TEMPAT TIDUR, & ASET PER FASKES
  // ==============================================================
  console.log('🛏️ Seeding Ruangan, Bed Management, & Aset per Faskes...');

  // Cibinong: Ruangan Faskes Lengkap
  const cbnRoomDefs = [
    { kodeRuangan: 'R-POLI-UMUM-CBN', namaRuangan: 'Ruang Pemeriksaan Umum (Poli 1)', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN' },
    { kodeRuangan: 'R-POLI-GIGI-CBN', namaRuangan: 'Ruang Pelayanan Gigi & Mulut', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN' },
    { kodeRuangan: 'R-POLI-KIA-CBN', namaRuangan: 'Ruang KIA, KB & Imunisasi', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'RAWAT_JALAN' },
    { kodeRuangan: 'R-IGD-CBN', namaRuangan: 'Ruang Tindakan & Gawat Darurat (IGD)', lantai: 'Lantai 1', gedung: 'Gedung IGD', kategoriRuangan: 'IGD' },
    { kodeRuangan: 'R-LAB-CBN', namaRuangan: 'Ruang Laboratorium Sederhana', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'PENUNJANG_MEDIS' },
    { kodeRuangan: 'R-FARMASI-CBN', namaRuangan: 'Ruang Depo Farmasi & Vaksin', lantai: 'Lantai 1', gedung: 'Gedung Utama', kategoriRuangan: 'GUDANG' },
    { kodeRuangan: 'R-INAP-CBN-01', namaRuangan: 'Ruang Rawat Inap Mawar', lantai: 'Lantai 2', gedung: 'Gedung B', kategoriRuangan: 'RAWAT_INAP' }
  ];

  const cbnRooms = {};
  for (const r of cbnRoomDefs) {
    const created = await prisma.masterRuangan.upsert({
      where: { kodeRuangan: r.kodeRuangan },
      update: { faskesId: faskesCibinong.id, namaRuangan: r.namaRuangan, lantai: r.lantai, gedung: r.gedung, kategoriRuangan: r.kategoriRuangan },
      create: { ...r, faskesId: faskesCibinong.id }
    });
    cbnRooms[r.kodeRuangan] = created;
  }

  for (let i = 1; i <= 6; i++) {
    const bedNo = `BED-MWR-0${i}`;
    await prisma.tempatTidur.upsert({
      where: { ruanganId_nomorBed: { ruanganId: cbnRooms['R-INAP-CBN-01'].id, nomorBed: bedNo } },
      update: { statusBed: i <= 4 ? 'TERISI' : 'TERSEDIA' },
      create: {
        ruanganId: cbnRooms['R-INAP-CBN-01'].id,
        nomorBed: bedNo,
        kelasKamar: 'KELAS_3',
        statusBed: i <= 4 ? 'TERISI' : 'TERSEDIA' // 4 terisi dari 6 = 66.7% BOR
      }
    });
  }

  // Sukamakmur: Ruang Tindakan IGD (2 Bed)
  const rIgdSukamakmur = await prisma.masterRuangan.upsert({
    where: { kodeRuangan: 'R-IGD-SKM-01' },
    update: { faskesId: faskesSukamakmur.id },
    create: {
      kodeRuangan: 'R-IGD-SKM-01',
      namaRuangan: 'Ruang Tindakan Gawat Darurat',
      lantai: 'Lantai 1',
      gedung: 'Gedung Utama',
      kategoriRuangan: 'IGD',
      faskesId: faskesSukamakmur.id
    }
  });

  for (let i = 1; i <= 2; i++) {
    const bedNo = `BED-IGD-0${i}`;
    await prisma.tempatTidur.upsert({
      where: { ruanganId_nomorBed: { ruanganId: rIgdSukamakmur.id, nomorBed: bedNo } },
      update: {},
      create: {
        ruanganId: rIgdSukamakmur.id,
        nomorBed: bedNo,
        kelasKamar: 'NON_KELAS_IGD',
        statusBed: 'TERSEDIA'
      }
    });
  }

  // Aset Alat Kesehatan Cibinong
  const cbnAsetList = [
    { kodeAset: 'AST-CBN-TNS-01', namaAset: 'Tensimeter Digital Klinis Omron', ruanganId: cbnRooms['R-POLI-UMUM-CBN'].id, kategoriAset: 'MEDIS_DIAGNOSTIK', merk: 'Omron', tipeModel: 'HBP-1320', nomorSeri: 'OMR-CBN-9981', tahunPerolehan: 2023, sumberAnggaran: 'APBD', hargaPerolehan: 2500000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-TNS-01' },
    { kodeAset: 'AST-CBN-DNT-01', namaAset: 'Dental Chair Unit Terintegrasi', ruanganId: cbnRooms['R-POLI-GIGI-CBN'].id, kategoriAset: 'MEDIS_TERAPETIK', merk: 'Gnatus', tipeModel: 'G2 Sync', nomorSeri: 'GNT-2023-011', tahunPerolehan: 2022, sumberAnggaran: 'APBD', hargaPerolehan: 85000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-DNT-01' },
    { kodeAset: 'AST-CBN-STRL-01', namaAset: 'Autoclave Sterilisator Medis 23L', ruanganId: cbnRooms['R-POLI-GIGI-CBN'].id, kategoriAset: 'MEDIS_TERAPETIK', merk: 'Tuttnauer', tipeModel: '2340M', nomorSeri: 'TTN-5512', tahunPerolehan: 2022, sumberAnggaran: 'BOK', hargaPerolehan: 32000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-STRL-01' },
    { kodeAset: 'AST-CBN-DOP-01', namaAset: 'Doppler Fetal Heart Rate Kebidanan', ruanganId: cbnRooms['R-POLI-KIA-CBN'].id, kategoriAset: 'MEDIS_DIAGNOSTIK', merk: 'Bistos', tipeModel: 'BT-200', nomorSeri: 'BST-2024-88', tahunPerolehan: 2024, sumberAnggaran: 'BOK', hargaPerolehan: 4500000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-DOP-01' },
    { kodeAset: 'AST-CBN-EKG-01', namaAset: 'Elektrokardiograf (EKG) 12 Saluran', ruanganId: cbnRooms['R-IGD-CBN'].id, kategoriAset: 'MEDIS_DIAGNOSTIK', merk: 'Bionet', tipeModel: 'CardioCare 2000', nomorSeri: 'BION-4411', tahunPerolehan: 2023, sumberAnggaran: 'APBD', hargaPerolehan: 24000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-EKG-01' },
    { kodeAset: 'AST-CBN-AED-01', namaAset: 'Defibrillator Emergency AED', ruanganId: cbnRooms['R-IGD-CBN'].id, kategoriAset: 'MEDIS_TERAPETIK', merk: 'Philips', tipeModel: 'HeartStart FRx', nomorSeri: 'PHL-AED-092', tahunPerolehan: 2023, sumberAnggaran: 'APBD', hargaPerolehan: 45000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-AED-01' },
    { kodeAset: 'AST-CBN-SUCT-01', namaAset: 'Suction Pump Portable Resusitasi', ruanganId: cbnRooms['R-IGD-CBN'].id, kategoriAset: 'MEDIS_TERAPETIK', merk: 'Thomas', tipeModel: 'Medi-Pump 1632', nomorSeri: 'THM-SUC-891', tahunPerolehan: 2022, sumberAnggaran: 'BLUD', hargaPerolehan: 8500000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-SUC-01' },
    { kodeAset: 'AST-CBN-USG-01', namaAset: 'USG Mindray DC-30', ruanganId: cbnRooms['R-INAP-CBN-01'].id, kategoriAset: 'MEDIS_DIAGNOSTIK', merk: 'Mindray', tipeModel: 'DC-30 Exp', nomorSeri: 'MND-USG-772', tahunPerolehan: 2023, sumberAnggaran: 'APBD', hargaPerolehan: 180000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ASPAK-USG-001' },
    { kodeAset: 'AST-CBN-CENT-01', namaAset: 'Centrifuge Laboratorium Klinik', ruanganId: cbnRooms['R-LAB-CBN'].id, kategoriAset: 'MEDIS_LABORATORIUM', merk: 'Gemmy', tipeModel: 'PLC-03', nomorSeri: 'GMY-CENT-102', tahunPerolehan: 2022, sumberAnggaran: 'BLUD', hargaPerolehan: 7500000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-CENT-01' },
    { kodeAset: 'AST-CBN-KULK-01', namaAset: 'Kulkas Vaksin TCW 3000 (Cold-Chain)', ruanganId: cbnRooms['R-FARMASI-CBN'].id, kategoriAset: 'MEDIS_DIAGNOSTIK', merk: 'Dometic', tipeModel: 'TCW 3000 AC', nomorSeri: 'DOM-TCW-2022', tahunPerolehan: 2022, sumberAnggaran: 'APBD', hargaPerolehan: 65000000, kondisiAset: 'BAIK', statusOperasional: 'AKTIF_DIGUNAKAN', kodeAspak: 'ALKES-KULK-01' }
  ];

  const cbnAsetMap = {};
  for (const a of cbnAsetList) {
    const created = await prisma.asetRuangan.upsert({
      where: { kodeAset: a.kodeAset },
      update: { faskesId: faskesCibinong.id, ...a },
      create: { ...a, faskesId: faskesCibinong.id }
    });
    cbnAsetMap[a.kodeAset] = created;
  }

  // Aset Sukamakmur
  const astSkm = await prisma.asetRuangan.upsert({
    where: { kodeAset: 'AST-SKM-TNS-01' },
    update: { faskesId: faskesSukamakmur.id },
    create: {
      kodeAset: 'AST-SKM-TNS-01',
      namaAset: 'Tensimeter Digital Omron',
      ruanganId: rIgdSukamakmur.id,
      faskesId: faskesSukamakmur.id,
      kategoriAset: 'MEDIS_DIAGNOSTIK',
      kondisiAset: 'RUSAK_RINGAN',
      statusOperasional: 'AKTIF_DIGUNAKAN',
      kodeAspak: 'ASPAK-TNS-002',
      hargaPerolehan: 2500000
    }
  });

  // Pemeliharaan & Kalibrasi Terhubung
  const next14Days = new Date();
  next14Days.setDate(next14Days.getDate() + 14);

  const pemeliharaanData = [
    { asetId: cbnAsetMap['AST-CBN-EKG-01'].id, jenisKegiatan: 'KALIBRASI_BFPK_EKSTERNAL', tanggalJadwal: new Date('2026-03-10'), tanggalPelaksanaan: new Date('2026-03-12'), tanggalKalibrasiExpired: new Date('2027-03-12'), pelaksanaVendor: 'BPFK Surabaya', biayaPemeliharaan: 1500000, nomorSertifikatKalibrasi: 'SERT-BPFK-2026-1184', hasilKegiatan: 'LAIK_PAKAI', catatan: 'Akurasi sinyal EKG ±2% laik pakai.', status: 'SELESAI' },
    { asetId: cbnAsetMap['AST-CBN-TNS-01'].id, jenisKegiatan: 'KALIBRASI_INTERNAL', tanggalJadwal: next14Days, pelaksanaVendor: 'Teknisi Elektromedis Internal Faskes', biayaPemeliharaan: 0, hasilKegiatan: 'TERJADWAL', catatan: 'Kalibrasi rutin sensor manset.', status: 'TERJADWAL' },
    { asetId: cbnAsetMap['AST-CBN-USG-01'].id, jenisKegiatan: 'KALIBRASI_BFPK_EKSTERNAL', tanggalJadwal: new Date('2026-02-15'), tanggalPelaksanaan: new Date('2026-02-18'), tanggalKalibrasiExpired: new Date('2027-02-18'), pelaksanaVendor: 'BPFK Jakarta', biayaPemeliharaan: 2800000, nomorSertifikatKalibrasi: 'BPFK-JKT-USG-2026-009', hasilKegiatan: 'LAIK_PAKAI', catatan: 'Uji probe & keselamatan listrik laik pakai.', status: 'SELESAI' },
    { asetId: cbnAsetMap['AST-CBN-STRL-01'].id, jenisKegiatan: 'KALIBRASI_BFPK_EKSTERNAL', tanggalJadwal: new Date('2026-01-20'), tanggalPelaksanaan: new Date('2026-01-22'), tanggalKalibrasiExpired: new Date('2027-01-22'), pelaksanaVendor: 'BPFK Surabaya', biayaPemeliharaan: 1800000, nomorSertifikatKalibrasi: 'SERT-BPFK-STR-2026-041', hasilKegiatan: 'LAIK_PAKAI', catatan: 'Uji suhu 134°C dan tekanan chamber normal.', status: 'SELESAI' },
    { asetId: cbnAsetMap['AST-CBN-KULK-01'].id, jenisKegiatan: 'PEMELIHARAAN_RUTIN', tanggalJadwal: new Date('2026-09-01'), tanggalPelaksanaan: new Date('2026-09-02'), pelaksanaVendor: 'Teknisi Cold-Chain Bio Farma / Dinkes', biayaPemeliharaan: 750000, hasilKegiatan: 'SELESAI_SERVIS', catatan: 'Kalibrasi sensor suhu kulkas vaksin 2-8°C.', status: 'SELESAI' },
    { asetId: astSkm.id, jenisKegiatan: 'KALIBRASI_BFPK_EKSTERNAL', tanggalJadwal: new Date('2026-02-10'), tanggalPelaksanaan: new Date('2026-02-12'), tanggalKalibrasiExpired: new Date('2027-02-12'), pelaksanaVendor: 'BPFK Jakarta', biayaPemeliharaan: 1200000, nomorSertifikatKalibrasi: 'SERT-BPFK-SKM-001', hasilKegiatan: 'LAIK_PAKAI', catatan: 'Kalibrasi tensimeter Sukamakmur.', status: 'SELESAI' }
  ];

  for (const p of pemeliharaanData) {
    const exists = await prisma.riwayatPemeliharaanAset.findFirst({
      where: { asetId: p.asetId, jenisKegiatan: p.jenisKegiatan }
    });
    if (exists) {
      await prisma.riwayatPemeliharaanAset.update({ where: { id: exists.id }, data: p });
    } else {
      await prisma.riwayatPemeliharaanAset.create({ data: p });
    }
  }

  // ==============================================================
  // ==============================================================
  // 7. SEED ICD-10 & ICD-9
  // ==============================================================
  console.log('📚 Seeding Master ICD-10 & ICD-9 Lengkap...');
  const icd10Data = [
    { kode_icd10: 'A09', nama_diagnosis: 'Diare dan Gastroenteritis', bab: 'Penyakit Infeksi', kategori: 'Infeksi Saluran Cerna' },
    { kode_icd10: 'A15.0', nama_diagnosis: 'Tuberkulosis Paru Terkonfirmasi', bab: 'Penyakit Infeksi', kategori: 'Tuberkulosis', wajib_lapor: true, penyakit_menular: true },
    { kode_icd10: 'A90', nama_diagnosis: 'Demam Berdarah Dengue', bab: 'Penyakit Infeksi', kategori: 'Dengue', wajib_lapor: true, penyakit_menular: true },
    { kode_icd10: 'B20', nama_diagnosis: 'HIV Disease', bab: 'Penyakit Infeksi', kategori: 'HIV/AIDS', wajib_lapor: true, penyakit_menular: true },
    { kode_icd10: 'E10', nama_diagnosis: 'Diabetes Melitus Tipe 1', bab: 'Endokrin', kategori: 'Diabetes' },
    { kode_icd10: 'E11', nama_diagnosis: 'Diabetes Melitus Tipe 2', bab: 'Endokrin', kategori: 'Diabetes' },
    { kode_icd10: 'E11.9', nama_diagnosis: 'Diabetes Melitus Tipe 2 Tanpa Komplikasi', bab: 'Endokrin', kategori: 'Diabetes' },
    { kode_icd10: 'E66', nama_diagnosis: 'Obesitas', bab: 'Endokrin', kategori: 'Gangguan Nutrisi' },
    { kode_icd10: 'F32', nama_diagnosis: 'Episode Depresi', bab: 'Gangguan Mental', kategori: 'Kesehatan Jiwa' },
    { kode_icd10: 'G40', nama_diagnosis: 'Epilepsi', bab: 'Sistem Saraf', kategori: 'Neurologi' },
    { kode_icd10: 'H10', nama_diagnosis: 'Konjungtivitis', bab: 'Mata', kategori: 'Oftalmologi' },
    { kode_icd10: 'I10', nama_diagnosis: 'Hipertensi Esensial (Primer)', bab: 'Sistem Sirkulasi', kategori: 'Hipertensi' },
    { kode_icd10: 'I21', nama_diagnosis: 'Infark Miokard Akut', bab: 'Sistem Sirkulasi', kategori: 'Jantung' },
    { kode_icd10: 'J00', nama_diagnosis: 'Common Cold', bab: 'Sistem Pernapasan', kategori: 'ISPA' },
    { kode_icd10: 'J02', nama_diagnosis: 'Faringitis Akut', bab: 'Sistem Pernapasan', kategori: 'ISPA' },
    { kode_icd10: 'J06.9', nama_diagnosis: 'Infeksi Saluran Pernapasan Akut (ISPA)', bab: 'Sistem Pernapasan', kategori: 'ISPA', penyakit_menular: true },
    { kode_icd10: 'J18', nama_diagnosis: 'Pneumonia', bab: 'Sistem Pernapasan', kategori: 'Pneumonia' },
    { kode_icd10: 'J45', nama_diagnosis: 'Asma', bab: 'Sistem Pernapasan', kategori: 'Asma' },
    { kode_icd10: 'K02', nama_diagnosis: 'Karies Gigi', bab: 'Sistem Pencernaan', kategori: 'Kesehatan Gigi' },
    { kode_icd10: 'K30', nama_diagnosis: 'Dispepsia', bab: 'Sistem Pencernaan', kategori: 'Lambung' },
    { kode_icd10: 'K35', nama_diagnosis: 'Apendisitis Akut', bab: 'Sistem Pencernaan', kategori: 'Bedah' },
    { kode_icd10: 'M54.5', nama_diagnosis: 'Low Back Pain', bab: 'Muskuloskeletal', kategori: 'Nyeri Punggung' },
    { kode_icd10: 'N39.0', nama_diagnosis: 'Infeksi Saluran Kemih', bab: 'Genitourinaria', kategori: 'ISK' },
    { kode_icd10: 'O80', nama_diagnosis: 'Persalinan Normal', bab: 'Kehamilan & Persalinan', kategori: 'Kebidanan' },
    { kode_icd10: 'P07', nama_diagnosis: 'Bayi Berat Lahir Rendah', bab: 'Perinatal', kategori: 'Neonatal' },
    { kode_icd10: 'R50', nama_diagnosis: 'Demam Tidak Diketahui Penyebabnya', bab: 'Gejala', kategori: 'Demam' },
    { kode_icd10: 'S06', nama_diagnosis: 'Cedera Intrakranial', bab: 'Cedera', kategori: 'Trauma Kepala' },
    { kode_icd10: 'T14', nama_diagnosis: 'Cedera Tidak Spesifik', bab: 'Cedera', kategori: 'Trauma' },
    { kode_icd10: 'U07.1', nama_diagnosis: 'COVID-19 Terkonfirmasi', bab: 'Kode Khusus', kategori: 'COVID-19' },
    { kode_icd10: 'Z00', nama_diagnosis: 'Pemeriksaan Kesehatan Umum', bab: 'Faktor yang Mempengaruhi Kesehatan', kategori: 'Medical Check Up' },
    { kode_icd10: 'Z23', nama_diagnosis: 'Imunisasi', bab: 'Faktor yang Mempengaruhi Kesehatan', kategori: 'Vaksinasi' }
  ];

  for (const data of icd10Data) {
    await prisma.masterICD10.upsert({
      where: { kode_icd10: data.kode_icd10 },
      update: { nama_diagnosis: data.nama_diagnosis, bab: data.bab, kategori: data.kategori },
      create: { ...data, status_aktif: true }
    });
  }

  const icd9Data = [
    { kode_icd9: '01.24', nama_prosedur: 'CT Scan Kepala', kategori: 'Radiologi' },
    { kode_icd9: '03.31', nama_prosedur: 'Pungsi Lumbal', kategori: 'Neurologi' },
    { kode_icd9: '06.02', nama_prosedur: 'Biopsi Tiroid', kategori: 'Bedah' },
    { kode_icd9: '21.01', nama_prosedur: 'Pemeriksaan Rongga Hidung', kategori: 'THT' },
    { kode_icd9: '23.09', nama_prosedur: 'Ekstraksi Gigi', kategori: 'Kedokteran Gigi' },
    { kode_icd9: '38.93', nama_prosedur: 'Pemasangan Infus', kategori: 'Tindakan Umum' },
    { kode_icd9: '57.94', nama_prosedur: 'Pemasangan Kateter Urin', kategori: 'Urologi' },
    { kode_icd9: '70.50', nama_prosedur: 'Persalinan Normal', kategori: 'Kebidanan' },
    { kode_icd9: '73.59', nama_prosedur: 'Episiotomi', kategori: 'Kebidanan' },
    { kode_icd9: '86.04', nama_prosedur: 'Debridement Luka', kategori: 'Bedah' },
    { kode_icd9: '86.59', nama_prosedur: 'Penjahitan Luka Bedah Minor', kategori: 'Bedah' },
    { kode_icd9: '87.44', nama_prosedur: 'Foto Thoraks', kategori: 'Radiologi' },
    { kode_icd9: '88.72', nama_prosedur: 'USG Abdomen', kategori: 'Radiologi' },
    { kode_icd9: '89.52', nama_prosedur: 'Elektrokardiogram (EKG)', kategori: 'Pemeriksaan Penunjang' },
    { kode_icd9: '90.59', nama_prosedur: 'Pemeriksaan Darah Lengkap', kategori: 'Laboratorium' },
    { kode_icd9: '91.46', nama_prosedur: 'Pemeriksaan Urinalisis', kategori: 'Laboratorium' },
    { kode_icd9: '93.11', nama_prosedur: 'Latihan Fisioterapi', kategori: 'Rehabilitasi' },
    { kode_icd9: '96.04', nama_prosedur: 'Pemberian Oksigen', kategori: 'Tindakan Respirasi' },
    { kode_icd9: '99.04', nama_prosedur: 'Transfusi Darah', kategori: 'Terapi' },
    { kode_icd9: '99.15', nama_prosedur: 'Imunisasi/Injeksi Vaksin', kategori: 'Imunisasi' }
  ];

  for (const icd of icd9Data) {
    await prisma.masterICD9.upsert({
      where: { kode_icd9: icd.kode_icd9 },
      update: icd,
      create: icd,
    });
  }

  // ==============================================================
  // 8. SEED PASIEN & KUNJUNGAN TERISOLASI PER FASKES
  // ==============================================================
  console.log('📋 Seeding Pasien & Transaksi Kunjungan Terisolasi...');

  const pasienCibinong = await prisma.pasien.upsert({
    where: { nik: '3201010101900001' },
    update: {},
    create: {
      noRM: 'RM-CBN-00001',
      nik: '3201010101900001',
      namaLengkap: 'Bapak Rahmat Susanto (Warga Cibinong)',
      tempatLahir: 'Bogor',
      tanggalLahir: new Date('1982-04-10'),
      jenisKelamin: 'Laki-laki',
      agama: 'Islam',
      pekerjaan: 'Wiraswasta',
      statusPerkawinan: 'Menikah',
      kewarganegaraan: 'WNI'
    }
  });

  const pasienSukamakmur = await prisma.pasien.upsert({
    where: { nik: '3201010202950002' },
    update: {},
    create: {
      noRM: 'RM-SKM-00001',
      nik: '3201010202950002',
      namaLengkap: 'Ibu Siti Aminah (Warga Sukamakmur)',
      tempatLahir: 'Sukamakmur',
      tanggalLahir: new Date('1995-08-22'),
      jenisKelamin: 'Perempuan',
      agama: 'Islam',
      pekerjaan: 'Petani',
      statusPerkawinan: 'Menikah',
      kewarganegaraan: 'WNI'
    }
  });

  // Kunjungan 1: Berobat di Puskesmas Cibinong
  await prisma.kunjungan.deleteMany({ where: { encounterId: 'Enc-CBN-001' } });
  const kunjunganCibinong = await prisma.kunjungan.create({
    data: {
      faskesId: faskesCibinong.id,
      pasienId: pasienCibinong.id,
      encounterId: 'Enc-CBN-001',
      tanggalRegistrasi: new Date(),
      jamRegistrasi: '08:30',
      poliklinikId: poliMap['UMUM'].id,
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Lama',
      noAntrian: 'UM-001',
      prioritas: 'Umum',
      caraDatang: 'Datang Sendiri',
      dokterTujuanId: userDrCibinong.id,
      statusKunjungan: 'MENUNGGU_DOKTER'
    }
  });

  // Skrining Pasien Cibinong
  await prisma.screening.create({
    data: {
      pasienId: pasienCibinong.id,
      kunjunganId: kunjunganCibinong.id,
      petugas: 'Ns. Ratna Sari',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Hijau',
      tekananDarahSistolik: 125,
      tekananDarahDiastolik: 80,
      suhuTubuh: 36.8,
      keluhanUtama: 'Pemeriksaan rutin tekanan darah dan batuk ringan.'
    }
  });

  // Kunjungan 2: Berobat di Puskesmas Sukamakmur
  await prisma.kunjungan.deleteMany({ where: { encounterId: 'Enc-SKM-001' } });
  const kunjunganSukamakmur = await prisma.kunjungan.create({
    data: {
      faskesId: faskesSukamakmur.id,
      pasienId: pasienSukamakmur.id,
      encounterId: 'Enc-SKM-001',
      tanggalRegistrasi: new Date(),
      jamRegistrasi: '09:15',
      poliklinikId: poliMap['UMUM'].id,
      jenisPelayanan: 'Rawat Jalan',
      statusPasien: 'Baru',
      noAntrian: 'UM-001',
      prioritas: 'Umum',
      caraDatang: 'Datang Sendiri',
      dokterTujuanId: userDrSukamakmur.id,
      statusKunjungan: 'MENUNGGU_DOKTER'
    }
  });

  await prisma.screening.create({
    data: {
      pasienId: pasienSukamakmur.id,
      kunjunganId: kunjunganSukamakmur.id,
      petugas: 'Bdn. Dewi Lestari',
      jenisKedatangan: 'Rawat Jalan',
      kategoriTriage: 'Kuning',
      tekananDarahSistolik: 140,
      tekananDarahDiastolik: 90,
      suhuTubuh: 38.2,
      keluhanUtama: 'Demam tinggi 3 hari dan pusing berat.'
    }
  });

  console.log('✅ Kunjungan berhasil diisolasi ke masing-masing faskes!');
  console.log('🎉 SEEDING MULTI-FASKES SELESAI DENGAN SUKSES!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error saat seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });