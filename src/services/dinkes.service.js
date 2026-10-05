const prisma = require('../config/prisma');

/**
 * Service Analitik & Manajemen Eksekutif Dinas Kesehatan Kabupaten
 */

// ==========================================
// 1. RINGKASAN EKSEKUTIF DINKES (EXECUTIVE OVERVIEW)
// ==========================================
const getExecutiveSummary = async (query = {}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 1. Data Faskes
  const totalFaskes = await prisma.faskes.count({ where: { statusAktif: true } });
  const faskesByType = await prisma.faskes.groupBy({
    by: ['jenisFaskes'],
    _count: { id: true },
    where: { statusAktif: true }
  });

  // 2. Kunjungan Hari Ini & Bulan Ini
  const kunjunganHariIni = await prisma.kunjungan.count({
    where: { tanggalRegistrasi: { gte: today, lt: tomorrow } }
  });
  const kunjunganBulanIni = await prisma.kunjungan.count({
    where: { tanggalRegistrasi: { gte: startOfMonth } }
  });

  const kunjunganByPelayanan = await prisma.kunjungan.groupBy({
    by: ['jenisPelayanan'],
    _count: { id: true },
    where: { tanggalRegistrasi: { gte: today, lt: tomorrow } }
  });

  // 3. Tenaga Medis
  const totalNakes = await prisma.tenagaMedis.count({ where: { statusAktif: true } });
  const nakesByProfesi = await prisma.tenagaMedis.groupBy({
    by: ['profesi'],
    _count: { id: true },
    where: { statusAktif: true }
  });

  // Hitung jumlah dokter
  const totalDokter = await prisma.tenagaMedis.count({
    where: {
      statusAktif: true,
      OR: [
        { profesi: { contains: 'DOKTER', mode: 'insensitive' } },
        { spesialis: { not: null } }
      ]
    }
  });

  // Rasio Beban Kerja Kabupaten Hari Ini (Kunjungan per Dokter)
  const avgRasioBebanKabupaten = totalDokter > 0 ? Number((kunjunganHariIni / totalDokter).toFixed(1)) : 0;

  // 4. Ketersediaan Tempat Tidur (BOR)
  const allBeds = await prisma.tempatTidur.findMany();
  const totalBed = allBeds.length;
  const bedTerisi = allBeds.filter(b => b.statusBed === 'TERISI').length;
  const bedTersedia = allBeds.filter(b => b.statusBed === 'TERSEDIA').length;
  const bedPerbaikan = allBeds.filter(b => b.statusBed === 'PERBAIKAN').length;
  const borKabupaten = totalBed > 0 ? Number(((bedTerisi / totalBed) * 100).toFixed(1)) : 0;

  // 5. Kondisi Alat Kesehatan
  const allAsetMedis = await prisma.asetRuangan.findMany({
    where: { kategoriAset: { startsWith: 'MEDIS_' } }
  });
  const alkesRusakBerat = allAsetMedis.filter(a => a.kondisiAset === 'RUSAK_BERAT' || a.kondisiAset === 'AFKIR').length;

  // 6. Obat Kritis (Stok Minimum)
  const obatKritisCount = await prisma.stokObatFaskes.count({
    where: {
      stok: { lte: prisma.stokObatFaskes.fields?.stokMinimum || 10 }
    }
  }).catch(() => 0);

  return {
    ringkasanFaskes: {
      total: totalFaskes,
      detailJenis: faskesByType.map(f => ({ jenis: f.jenisFaskes, jumlah: f._count.id }))
    },
    trafikKunjungan: {
      hariIni: kunjunganHariIni,
      bulanIni: kunjunganBulanIni,
      pelayananHariIni: kunjunganByPelayanan.map(p => ({ jenisPelayanan: p.jenisPelayanan, jumlah: p._count.id }))
    },
    tenagaMedis: {
      totalNakes,
      totalDokter,
      rasioBebanKabupaten: avgRasioBebanKabupaten,
      distribusiProfesi: nakesByProfesi.map(n => ({ profesi: n.profesi || 'BELUM_DITENTUKAN', jumlah: n._count.id }))
    },
    tempatTidur: {
      totalBed,
      bedTerisi,
      bedTersedia,
      bedPerbaikan,
      borKabupaten: `${borKabupaten}%`
    },
    peringatanDini: {
      alkesKritisRusak: alkesRusakBerat,
      obatMenipis: obatKritisCount
    }
  };
};

// ==========================================
// 2. ANALISIS BEBAN KERJA & RASIO DOKTER VS PASIEN PER FASKES
// (Pondasi Pengambilan Keputusan Alokasi / Mutasi Nakes)
// ==========================================
const getWorkloadAnalytics = async (query = {}) => {
  const { startDate, endDate, kecamatan, kategoriWilayah } = query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.tanggalRegistrasi = {};
    if (startDate) dateFilter.tanggalRegistrasi.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.tanggalRegistrasi.lte = end;
    }
  } else {
    // Default hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateFilter.tanggalRegistrasi = { gte: today };
  }

  const faskesWhere = { statusAktif: true };
  if (kecamatan) faskesWhere.kecamatan = { contains: kecamatan, mode: 'insensitive' };
  if (kategoriWilayah) faskesWhere.kategoriWilayah = kategoriWilayah;

  // Ambil faskes lengkap dengan nakes & kunjungan
  const faskesList = await prisma.faskes.findMany({
    where: faskesWhere,
    include: {
      tenagaMedis: {
        where: { statusAktif: true }
      },
      kunjungans: {
        where: dateFilter,
        select: { id: true, jenisPelayanan: true }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  const analysis = faskesList.map(faskes => {
    const totalPasien = faskes.kunjungans.length;
    const rawatJalan = faskes.kunjungans.filter(k => k.jenisPelayanan === 'Rawat Jalan' || k.jenisPelayanan === 'RAWAT_JALAN').length;
    const igd = faskes.kunjungans.filter(k => k.jenisPelayanan === 'IGD').length;
    const rawatInap = faskes.kunjungans.filter(k => k.jenisPelayanan === 'Rawat Inap' || k.jenisPelayanan === 'RAWAT_INAP').length;

    // Filter dokter
    const dokters = faskes.tenagaMedis.filter(n =>
      (n.profesi && n.profesi.toUpperCase().includes('DOKTER')) ||
      (n.spesialis && n.spesialis.length > 0)
    );
    const perawats = faskes.tenagaMedis.filter(n => n.profesi && n.profesi.toUpperCase().includes('PERAWAT'));
    const bidans = faskes.tenagaMedis.filter(n => n.profesi && n.profesi.toUpperCase().includes('BIDAN'));

    const totalDokter = dokters.length;
    const totalNakes = faskes.tenagaMedis.length;

    // Hitung Rasio Pasien per Dokter
    const rasioPasienPerDokter = totalDokter > 0 ? Number((totalPasien / totalDokter).toFixed(1)) : (totalPasien > 0 ? 999 : 0);

    // Tentukan Status Beban Kerja
    let statusBeban = 'NORMAL';
    let levelUrgensi = 'LOW';
    let rekomendasiDinkes = 'Pelayanan optimal dan kapasitas memadai.';

    if (totalDokter === 0 && totalPasien > 0) {
      statusBeban = 'KRISIS_TANPA_DOKTER';
      levelUrgensi = 'CRITICAL';
      rekomendasiDinkes = `URGENT: ${faskes.namaFaskes} melayani ${totalPasien} pasien tanpa kehadiran dokter. Butuh penugasan dokter darurat segera!`;
    } else if (rasioPasienPerDokter >= 50 || (faskes.targetKunjunganHarian && totalPasien > faskes.targetKunjunganHarian * 1.5)) {
      statusBeban = 'OVERLOAD_PARAH';
      levelUrgensi = 'HIGH';
      const kekuranganDokter = Math.max(1, Math.ceil(totalPasien / 35 - totalDokter));
      rekomendasiDinkes = `Beban kerja berlebih (${rasioPasienPerDokter} pasien/dokter). Disarankan rotasi/bantuan minimal ${kekuranganDokter} dokter dari faskes terdekat.`;
    } else if (rasioPasienPerDokter >= 35) {
      statusBeban = 'PADAT';
      levelUrgensi = 'MEDIUM';
      rekomendasiDinkes = `Trafik pelayanan padat (${rasioPasienPerDokter} pasien/dokter). Perlu pemantauan kapasitas harian.`;
    } else if (rasioPasienPerDokter <= 10 && totalDokter > 1) {
      statusBeban = 'SURPLUS_TENAGA';
      levelUrgensi = 'INFO';
      rekomendasiDinkes = `Rasio pasien relatif rendah (${rasioPasienPerDokter} pasien/dokter). Potensial untuk diperbantukan sementara ke faskes lain jika dibutuhkan.`;
    }

    return {
      faskesId: faskes.id,
      kodeFaskes: faskes.kodeFaskes,
      namaFaskes: faskes.namaFaskes,
      jenisFaskes: faskes.jenisFaskes,
      kategoriWilayah: faskes.kategoriWilayah || 'PERKOTAAN',
      kecamatan: faskes.kecamatan,
      titikGps: faskes.titikGps,
      targetKunjunganHarian: faskes.targetKunjunganHarian,
      statistikKunjungan: {
        totalPasien,
        rawatJalan,
        igd,
        rawatInap
      },
      sdmk: {
        totalNakes,
        totalDokter,
        totalPerawat: perawats.length,
        totalBidan: bidans.length,
        daftarDokter: dokters.map(d => ({ id: d.id, nik: d.nik, spesialis: d.spesialis, profesi: d.profesi }))
      },
      indikatorBebanKerja: {
        rasioPasienPerDokter,
        statusBeban,
        levelUrgensi,
        rekomendasiDinkes
      }
    };
  });

  // Urutkan dari faskes yang paling overload ke yang paling lengang
  analysis.sort((a, b) => b.indikatorBebanKerja.rasioPasienPerDokter - a.indikatorBebanKerja.rasioPasienPerDokter);

  const faskesOverload = analysis.filter(f => f.indikatorBebanKerja.levelUrgensi === 'HIGH' || f.indikatorBebanKerja.levelUrgensi === 'CRITICAL');
  const faskesSurplus = analysis.filter(f => f.indikatorBebanKerja.statusBeban === 'SURPLUS_TENAGA');

  return {
    totalFaskesDianalisis: analysis.length,
    faskesOverloadCount: faskesOverload.length,
    faskesSurplusCount: faskesSurplus.length,
    data: analysis
  };
};

// ==========================================
// 3. MONITORING KETERSEDIAAN TEMPAT TIDUR / BOR SE-KABUPATEN
// ==========================================
const getBedMonitoring = async (query = {}) => {
  const { kecamatan, faskesId } = query;

  const faskesWhere = { statusAktif: true };
  if (kecamatan) faskesWhere.kecamatan = { contains: kecamatan, mode: 'insensitive' };
  if (faskesId) faskesWhere.id = faskesId;

  const faskesList = await prisma.faskes.findMany({
    where: faskesWhere,
    include: {
      ruangans: {
        include: {
          tempatTidurs: {
            include: {
              kunjunganAktif: {
                include: { pasien: { select: { namaLengkap: true, noRM: true } } }
              }
            }
          }
        }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  const results = faskesList.map(faskes => {
    const allBeds = [];
    faskes.ruangans.forEach(r => {
      r.tempatTidurs.forEach(b => {
        allBeds.push({
          ...b,
          namaRuangan: r.namaRuangan,
          kategoriRuangan: r.kategoriRuangan
        });
      });
    });

    const totalBed = allBeds.length;
    const bedTerisi = allBeds.filter(b => b.statusBed === 'TERISI').length;
    const bedTersedia = allBeds.filter(b => b.statusBed === 'TERSEDIA').length;
    const bedPerbaikan = allBeds.filter(b => b.statusBed === 'PERBAIKAN').length;
    const bedDibersihkan = allBeds.filter(b => b.statusBed === 'DIBERSIHKAN').length;

    const bor = totalBed > 0 ? Number(((bedTerisi / totalBed) * 100).toFixed(1)) : 0;

    let statusKapasitas = 'KOSONG';
    if (bor >= 85) statusKapasitas = 'KRITIS_PENUH';
    else if (bor >= 60) statusKapasitas = 'OPTIMAL';
    else if (totalBed > 0) statusKapasitas = 'TERSEDIA_LELUASA';

    // Rincian per kelas
    const kelasMap = {};
    allBeds.forEach(b => {
      if (!kelasMap[b.kelasKamar]) {
        kelasMap[b.kelasKamar] = { total: 0, terisi: 0, tersedia: 0 };
      }
      kelasMap[b.kelasKamar].total += 1;
      if (b.statusBed === 'TERISI') kelasMap[b.kelasKamar].terisi += 1;
      if (b.statusBed === 'TERSEDIA') kelasMap[b.kelasKamar].tersedia += 1;
    });

    return {
      faskesId: faskes.id,
      kodeFaskes: faskes.kodeFaskes,
      namaFaskes: faskes.namaFaskes,
      kecamatan: faskes.kecamatan,
      titikGps: faskes.titikGps,
      totalBed,
      bedTerisi,
      bedTersedia,
      bedPerbaikan,
      bedDibersihkan,
      bor: `${bor}%`,
      borAngka: bor,
      statusKapasitas,
      rincianKelas: kelasMap
    };
  });

  return {
    totalFaskesRawatInap: results.filter(r => r.totalBed > 0).length,
    faskesKritisPenuh: results.filter(r => r.statusKapasitas === 'KRITIS_PENUH'),
    data: results
  };
};

// ==========================================
// 4. MONITORING ASET & ALAT KESEHATAN KRITIS SE-KABUPATEN
// ==========================================
const getCriticalAssetsMonitoring = async (query = {}) => {
  const { kecamatan, faskesId, kondisi } = query;

  const faskesWhere = { statusAktif: true };
  if (kecamatan) faskesWhere.kecamatan = { contains: kecamatan, mode: 'insensitive' };
  if (faskesId) faskesWhere.id = faskesId;

  const faskesList = await prisma.faskes.findMany({
    where: faskesWhere,
    include: {
      asets: {
        include: {
          ruangan: { select: { namaRuangan: true, gedung: true } },
          riwayatPemeliharaan: {
            orderBy: { tanggalJadwal: 'desc' },
            take: 1
          }
        }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  const faskesSummary = faskesList.map(faskes => {
    const asets = faskes.asets;
    const alkes = asets.filter(a => a.kategoriAset.startsWith('MEDIS_'));
    const nonMedis = asets.filter(a => !a.kategoriAset.startsWith('MEDIS_'));

    const baik = asets.filter(a => a.kondisiAset === 'BAIK').length;
    const rusakRingan = asets.filter(a => a.kondisiAset === 'RUSAK_RINGAN').length;
    const rusakBerat = asets.filter(a => a.kondisiAset === 'RUSAK_BERAT').length;
    const afkir = asets.filter(a => a.kondisiAset === 'AFKIR').length;

    // Daftar alat medis kritis yang sedang rusak
    const alkesRusakKritis = alkes.filter(a => a.kondisiAset === 'RUSAK_BERAT' || a.statusOperasional === 'DALAM_PERBAIKAN');

    // Cek kalibrasi expired
    const kalibrasiAlerts = [];
    asets.forEach(a => {
      const pemeliharaan = a.riwayatPemeliharaan[0];
      if (pemeliharaan?.tanggalKalibrasiExpired) {
        const expDate = new Date(pemeliharaan.tanggalKalibrasiExpired);
        if (expDate < now) {
          kalibrasiAlerts.push({
            asetId: a.id,
            namaAset: a.namaAset,
            kodeAset: a.kodeAset,
            status: 'KADALUWARSA',
            expiredDate: expDate
          });
        } else if (expDate <= thirtyDaysLater) {
          kalibrasiAlerts.push({
            asetId: a.id,
            namaAset: a.namaAset,
            kodeAset: a.kodeAset,
            status: 'MENDEKATI_KADALUWARSA',
            expiredDate: expDate
          });
        }
      }
    });

    return {
      faskesId: faskes.id,
      kodeFaskes: faskes.kodeFaskes,
      namaFaskes: faskes.namaFaskes,
      kecamatan: faskes.kecamatan,
      totalAset: asets.length,
      totalAlkes: alkes.length,
      totalNonMedis: nonMedis.length,
      kondisi: { baik, rusakRingan, rusakBerat, afkir },
      daftarAlkesRusakKritis: alkesRusakKritis.map(a => ({
        id: a.id,
        kodeAset: a.kodeAset,
        namaAset: a.namaAset,
        ruangan: a.ruangan?.namaRuangan,
        kondisi: a.kondisiAset,
        statusOperasional: a.statusOperasional,
        kodeAspak: a.kodeAspak
      })),
      kalibrasiAlerts
    };
  });

  return {
    totalFaskes: faskesSummary.length,
    faskesAlkesRusakBeratCount: faskesSummary.filter(f => f.kondisi.rusakBerat > 0).length,
    data: faskesSummary
  };
};

// ==========================================
// 5. MONITORING LOGISTIK & STOK OBAT KRITIS SE-KABUPATEN
// ==========================================
const getMedicineStockAlerts = async (query = {}) => {
  const { faskesId, kecamatan } = query;

  const faskesWhere = { statusAktif: true };
  if (faskesId) faskesWhere.id = faskesId;
  if (kecamatan) faskesWhere.kecamatan = { contains: kecamatan, mode: 'insensitive' };

  const faskesList = await prisma.faskes.findMany({
    where: faskesWhere,
    include: {
      stokObat: {
        include: {
          obat: true
        }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  const now = new Date();
  const sixtyDaysLater = new Date();
  sixtyDaysLater.setDate(now.getDate() + 60);

  const stockAlerts = [];

  faskesList.forEach(faskes => {
    const obatMenipis = [];
    const obatExpired = [];

    faskes.stokObat.forEach(s => {
      // Cek stok di bawah minimum
      if (s.stok <= s.stokMinimum) {
        obatMenipis.push({
          obatId: s.obatId,
          namaObat: s.obat?.namaObat,
          kodeObat: s.obat?.kodeObat,
          sisaStok: s.stok,
          stokMinimum: s.stokMinimum,
          kategori: s.obat?.kategori || 'Obat',
          satuan: s.obat?.sediaan || 'Pcs'
        });
      }

      // Cek masa kadaluwarsa
      if (s.tanggalExpired) {
        const exp = new Date(s.tanggalExpired);
        if (exp < now) {
          obatExpired.push({
            obatId: s.obatId,
            namaObat: s.obat?.namaObat,
            noBatch: s.noBatch,
            kategori: s.obat?.kategori || 'Obat',
            satuan: s.obat?.sediaan || 'Pcs',
            status: 'KADALUWARSA',
            expiredDate: exp
          });
        } else if (exp <= sixtyDaysLater) {
          obatExpired.push({
            obatId: s.obatId,
            namaObat: s.obat?.namaObat,
            noBatch: s.noBatch,
            kategori: s.obat?.kategori || 'Obat',
            satuan: s.obat?.sediaan || 'Pcs',
            status: 'SEGERA_KADALUWARSA',
            expiredDate: exp
          });
        }
      }
    });

    if (obatMenipis.length > 0 || obatExpired.length > 0) {
      stockAlerts.push({
        faskesId: faskes.id,
        namaFaskes: faskes.namaFaskes,
        kecamatan: faskes.kecamatan,
        jumlahObatMenipis: obatMenipis.length,
        jumlahObatExpired: obatExpired.length,
        obatMenipis,
        obatExpired
      });
    }
  });

  return {
    totalFaskesBermasalahStok: stockAlerts.length,
    data: stockAlerts
  };
};

// ==========================================
// 5B. MONITORING LOGISTIK & STOK VAKSIN (COLD-CHAIN) SE-KABUPATEN
// ==========================================
const getVaccineMonitoring = async (query = {}) => {
  const { faskesId, kecamatan } = query;

  const faskesWhere = { statusAktif: true };
  if (faskesId) faskesWhere.id = faskesId;
  if (kecamatan) faskesWhere.kecamatan = { contains: kecamatan, mode: 'insensitive' };

  const faskesList = await prisma.faskes.findMany({
    where: faskesWhere,
    include: {
      batchVaksin: {
        include: {
          vaksin: true
        },
        orderBy: { tanggalExpired: 'asc' }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  const now = new Date();
  const sixtyDaysLater = new Date();
  sixtyDaysLater.setDate(now.getDate() + 60);

  let totalDosisKabupaten = 0;
  let vaksinKritisCount = 0;
  let vaksinSegeraExpiredCount = 0;

  const summary = faskesList.map(faskes => {
    let totalDosisFaskes = 0;

    // Akumulasi total stok aktif per jenis vaksin di faskes ini
    const stokPerVaksinMap = {};
    (faskes.batchVaksin || []).forEach(b => {
      stokPerVaksinMap[b.vaksinId] = (stokPerVaksinMap[b.vaksinId] || 0) + b.stok;
    });

    const batchDetails = (faskes.batchVaksin || []).map(b => {
      totalDosisFaskes += b.stok;
      totalDosisKabupaten += b.stok;

      let sisaHari = null;
      let statusExpired = 'AMAN';
      if (b.tanggalExpired) {
        const diffMs = new Date(b.tanggalExpired).getTime() - now.getTime();
        sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (sisaHari < 0) {
          statusExpired = 'KADALUWARSA';
          if (b.stok > 0) vaksinSegeraExpiredCount++;
        } else if (sisaHari <= 60) {
          statusExpired = 'SEGERA_KADALUWARSA';
          if (b.stok > 0) vaksinSegeraExpiredCount++;
        } else if (sisaHari <= 90) {
          statusExpired = 'WASPADA';
        }
      }

      const totalStokVaksinFaskes = stokPerVaksinMap[b.vaksinId] || 0;
      const adaBatchPengganti = totalStokVaksinFaskes > 0;

      let statusStok = 'AMAN';
      if (b.stok === 0) {
        if (adaBatchPengganti) {
          statusStok = 'HABIS_TERGANTIKAN'; // Ada batch pengganti yang siap pakai di faskes
        } else {
          statusStok = 'HABIS'; // Benar-benar kosong di faskes
          vaksinKritisCount++;
        }
      } else if (totalStokVaksinFaskes <= b.stokMinimum) {
        statusStok = 'KRITIS';
        vaksinKritisCount++;
      }

      return {
        id: b.id,
        vaksinId: b.vaksinId,
        namaVaksin: b.vaksin?.namaVaksin,
        kodeKfa: b.vaksin?.kodeKfa,
        targetPenyakit: b.vaksin?.targetPenyakit,
        noBatch: b.noBatch,
        tanggalExpired: b.tanggalExpired,
        sisaHari,
        statusExpired,
        stok: b.stok,
        stokMinimum: b.stokMinimum,
        totalStokVaksinFaskes,
        adaBatchPengganti,
        statusStok,
        suhuPenyimpanan: b.suhuPenyimpanan || '2-8°C'
      };
    });

    return {
      faskesId: faskes.id,
      namaFaskes: faskes.namaFaskes,
      kodeFaskes: faskes.kodeFaskes,
      kecamatan: faskes.kecamatan,
      totalDosis: totalDosisFaskes,
      jumlahBatch: batchDetails.length,
      kritisBatchCount: batchDetails.filter(b => b.statusStok === 'KRITIS' || b.statusStok === 'HABIS').length,
      segeraExpiredCount: batchDetails.filter(b => (b.statusExpired === 'SEGERA_KADALUWARSA' || b.statusExpired === 'KADALUWARSA') && b.stok > 0).length,
      vaksinList: batchDetails
    };
  });

  return {
    ringkasan: {
      totalDosisKabupaten,
      totalPuskesmas: faskesList.length,
      vaksinKritisCount,
      vaksinSegeraExpiredCount
    },
    data: summary
  };
};

// ==========================================
// 6. SURVEILANS EPIDEMIOLOGI & 10 BESAR PENYAKIT (ICD-10)
// ==========================================
const getDiseaseSurveillance = async (query = {}) => {
  const { startDate, endDate, faskesId, kecamatan, limit = 10 } = query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.tanggalDiagnosis = {};
    if (startDate) dateFilter.tanggalDiagnosis.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.tanggalDiagnosis.lte = end;
    }
  }

  const diagnosisWhere = { ...dateFilter };

  if (faskesId) {
    diagnosisWhere.kunjungan = { faskesId };
  } else if (kecamatan) {
    diagnosisWhere.kunjungan = {
      faskes: { kecamatan: { contains: kecamatan, mode: 'insensitive' } }
    };
  }

  // Agregasi Top Penyakit
  const diagnoses = await prisma.diagnosisPasien.groupBy({
    by: ['icd10Id'],
    _count: { id: true },
    where: diagnosisWhere,
    orderBy: {
      _count: { id: 'desc' }
    },
    take: parseInt(limit, 10) || 10
  });

  const totalKasus = await prisma.diagnosisPasien.count({ where: diagnosisWhere });

  // Ambil detail nama ICD-10
  const topList = await Promise.all(
    diagnoses.map(async (item, index) => {
      const icd = await prisma.masterICD10.findUnique({
        where: { id_icd10: item.icd10Id }
      });
      const persen = totalKasus > 0 ? Number(((item._count.id / totalKasus) * 100).toFixed(1)) : 0;

      return {
        peringkat: index + 1,
        icd10Id: item.icd10Id,
        kodeIcd10: icd?.kode_icd10 || 'UNKNOWN',
        namaDiagnosis: icd?.nama_diagnosis || 'Tidak Teridentifikasi',
        bab: icd?.bab || '-',
        isPenyakitMenular: icd?.penyakit_menular || false,
        isWajibLapor: icd?.wajib_lapor || false,
        jumlahKasus: item._count.id,
        persentase: `${persen}%`
      };
    })
  );

  return {
    totalKasusPeriode: totalKasus,
    topPenyakit: topList
  };
};

// ==========================================
// 7. MASTER FASKES CRUD (MANAJEMEN PUSKESMAS SE-KABUPATEN)
// ==========================================
const getFaskesList = async (query = {}) => {
  const { search, jenisFaskes, kecamatan, statusAktif } = query;
  const where = {};

  if (search) {
    where.OR = [
      { namaFaskes: { contains: search, mode: 'insensitive' } },
      { kodeFaskes: { contains: search, mode: 'insensitive' } },
      { kecamatan: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (jenisFaskes) where.jenisFaskes = jenisFaskes;
  if (kecamatan) where.kecamatan = { contains: kecamatan, mode: 'insensitive' };
  if (statusAktif !== undefined) where.statusAktif = statusAktif === 'true' || statusAktif === true;

  const faskesList = await prisma.faskes.findMany({
    where,
    include: {
      _count: {
        select: {
          users: true,
          tenagaMedis: true,
          kunjungans: true,
          ruangans: true,
          asets: true
        }
      },
      ruangans: {
        include: {
          tempatTidurs: true
        }
      }
    },
    orderBy: { namaFaskes: 'asc' }
  });

  return faskesList.map(f => {
    const totalBedFisik = (f.ruangans || []).reduce((sum, r) => sum + (r.tempatTidurs?.length || 0), 0);
    const { ruangans, ...rest } = f;
    return {
      ...rest,
      totalBedFisik,
      kapasitasRawatInap: totalBedFisik
    };
  });
};

const getFaskesById = async (id) => {
  const faskes = await prisma.faskes.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, username: true, namaLengkap: true, role: true } },
      tenagaMedis: {
        include: {
          user: { select: { id: true, username: true, role: true, namaLengkap: true } }
        }
      },
      polikliniks: {
        include: {
          _count: {
            select: { kunjungans: true }
          }
        }
      },
      ruangans: {
        include: {
          tempatTidurs: {
            include: {
              kunjunganAktif: {
                include: {
                  pasien: { select: { id: true, namaLengkap: true, noRM: true, jenisKelamin: true } }
                }
              }
            },
            orderBy: { nomorBed: 'asc' }
          }
        },
        orderBy: { namaRuangan: 'asc' }
      },
      asets: {
        include: {
          ruangan: { select: { namaRuangan: true, gedung: true, kategoriRuangan: true } },
          riwayatPemeliharaan: {
            orderBy: { tanggalJadwal: 'desc' },
            take: 1
          }
        },
        orderBy: { namaAset: 'asc' }
      },
      stokObat: {
        include: {
          obat: true
        },
        orderBy: [
          { tanggalExpired: 'asc' },
          { stok: 'asc' }
        ]
      },
      batchVaksin: {
        include: {
          vaksin: true
        },
        orderBy: [
          { tanggalExpired: 'asc' },
          { stok: 'asc' }
        ]
      }
    }
  });

  if (!faskes) return null;

  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);
  const sixtyDaysLater = new Date();
  sixtyDaysLater.setDate(now.getDate() + 60);

  // 1. Profil & Analisis Aset & Kelaikan Alkes
  const allAsets = faskes.asets || [];
  const alkesMedis = allAsets.filter(a => a.kategoriAset.startsWith('MEDIS_'));
  const nonMedis = allAsets.filter(a => !a.kategoriAset.startsWith('MEDIS_'));

  const kondisiAset = {
    baik: allAsets.filter(a => a.kondisiAset === 'BAIK').length,
    rusakRingan: allAsets.filter(a => a.kondisiAset === 'RUSAK_RINGAN').length,
    rusakBerat: allAsets.filter(a => a.kondisiAset === 'RUSAK_BERAT').length,
    afkir: allAsets.filter(a => a.kondisiAset === 'AFKIR').length
  };

  const statusOperasionalAset = {
    aktif: allAsets.filter(a => a.statusOperasional === 'AKTIF_DIGUNAKAN').length,
    dalamPerbaikan: allAsets.filter(a => a.statusOperasional === 'DALAM_PERBAIKAN').length,
    dalamKalibrasi: allAsets.filter(a => a.statusOperasional === 'DALAM_KALIBRASI').length,
    nonAktif: allAsets.filter(a => a.statusOperasional === 'NON_AKTIF').length
  };

  const alkesKritisRusak = alkesMedis.filter(a => a.kondisiAset === 'RUSAK_BERAT' || a.statusOperasional === 'DALAM_PERBAIKAN');

  const kalibrasiAlerts = [];
  allAsets.forEach(a => {
    const pemeliharaan = a.riwayatPemeliharaan?.[0];
    if (pemeliharaan?.tanggalKalibrasiExpired) {
      const expDate = new Date(pemeliharaan.tanggalKalibrasiExpired);
      if (expDate < now) {
        kalibrasiAlerts.push({
          asetId: a.id,
          namaAset: a.namaAset,
          kodeAset: a.kodeAset,
          ruangan: a.ruangan?.namaRuangan,
          status: 'KADALUWARSA',
          expiredDate: expDate
        });
      } else if (expDate <= thirtyDaysLater) {
        kalibrasiAlerts.push({
          asetId: a.id,
          namaAset: a.namaAset,
          kodeAset: a.kodeAset,
          ruangan: a.ruangan?.namaRuangan,
          status: 'MENDEKATI_KADALUWARSA',
          expiredDate: expDate
        });
      }
    }
  });

  // 2. Analisis SDMK (Sumber Daya Manusia Kesehatan)
  const nakesList = faskes.tenagaMedis || [];
  const dokters = nakesList.filter(n => n.profesi === 'DOKTER' || n.profesi === 'DOKTER_GIGI' || n.spesialis);
  const perawats = nakesList.filter(n => n.profesi === 'PERAWAT');
  const bidans = nakesList.filter(n => n.profesi === 'BIDAN');
  const apotekers = nakesList.filter(n => n.profesi === 'APOTEKER' || n.profesi === 'ASISTEN_APOTEKER');

  // Kunjungan untuk Rasio
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const totalPasienBulanIni = await prisma.kunjungan.count({
    where: { faskesId: id, tanggalRegistrasi: { gte: startOfMonth } }
  });

  const totalPasienHariIni = await prisma.kunjungan.count({
    where: { faskesId: id, tanggalRegistrasi: { gte: startOfDay } }
  });

  const totalKunjunganAllTime = await prisma.kunjungan.count({
    where: { faskesId: id }
  });

  const rasioPasienPerDokter = dokters.length > 0 ? Math.round(totalPasienBulanIni / dokters.length) : totalPasienBulanIni;
  let statusBebanKerja = 'NORMAL';
  if (rasioPasienPerDokter > 50) statusBebanKerja = 'KRITIS_TINGGI';
  else if (rasioPasienPerDokter > 30) statusBebanKerja = 'TINGGI';
  else if (rasioPasienPerDokter < 10) statusBebanKerja = 'SURPLUS';

  // 3. Analisis Ruangan & Tempat Tidur (BOR)
  const allBeds = [];
  (faskes.ruangans || []).forEach(r => {
    (r.tempatTidurs || []).forEach(b => {
      allBeds.push({
        ...b,
        ruanganNama: r.namaRuangan,
        ruanganKategori: r.kategoriRuangan
      });
    });
  });

  const totalBed = allBeds.length;
  const bedTerisi = allBeds.filter(b => b.statusBed === 'TERISI').length;
  const bedTersedia = allBeds.filter(b => b.statusBed === 'TERSEDIA').length;
  const bedPerbaikan = allBeds.filter(b => b.statusBed === 'PERBAIKAN').length;
  const bor = totalBed > 0 ? Number(((bedTerisi / totalBed) * 100).toFixed(1)) : 0;

  // 4. Analisis Farmasi, BMHP & Vaksin
  const allStok = faskes.stokObat || [];
  const obatList = allStok.filter(s => s.obat?.kategori !== 'BMHP');
  const bmhpList = allStok.filter(s => s.obat?.kategori === 'BMHP');

  const obatKritis = obatList.filter(s => s.stok <= s.stokMinimum);
  const bmhpKritis = bmhpList.filter(s => s.stok <= s.stokMinimum);

  const stokPerVaksinMap = {};
  (faskes.batchVaksin || []).forEach(b => {
    stokPerVaksinMap[b.vaksinId] = (stokPerVaksinMap[b.vaksinId] || 0) + b.stok;
  });

  const batchVaksinList = (faskes.batchVaksin || []).map(b => {
    let sisaHari = null;
    let statusExpired = 'AMAN';
    if (b.tanggalExpired) {
      const diffMs = new Date(b.tanggalExpired).getTime() - now.getTime();
      sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (sisaHari < 0) statusExpired = 'KADALUWARSA';
      else if (sisaHari <= 60) statusExpired = 'SEGERA_KADALUWARSA';
      else if (sisaHari <= 90) statusExpired = 'WASPADA';
    }

    const totalStokVaksinFaskes = stokPerVaksinMap[b.vaksinId] || 0;
    const adaBatchPengganti = totalStokVaksinFaskes > 0;

    let statusStok = 'AMAN';
    if (b.stok === 0) {
      statusStok = adaBatchPengganti ? 'HABIS_TERGANTIKAN' : 'HABIS';
    } else if (totalStokVaksinFaskes <= b.stokMinimum) {
      statusStok = 'KRITIS';
    }

    return {
      id: b.id,
      namaVaksin: b.vaksin?.namaVaksin,
      kodeKfa: b.vaksin?.kodeKfa,
      targetPenyakit: b.vaksin?.targetPenyakit,
      noBatch: b.noBatch,
      stok: b.stok,
      stokMinimum: b.stokMinimum,
      totalStokVaksinFaskes,
      adaBatchPengganti,
      statusStok,
      suhuPenyimpanan: b.suhuPenyimpanan || '2-8°C',
      tanggalExpired: b.tanggalExpired,
      sisaHari,
      statusExpired,
      gambarUrl: b.vaksin?.gambarUrl || '/images/logistik/vaksin.jpg'
    };
  });

  const totalDosisVaksin = batchVaksinList.reduce((sum, b) => sum + b.stok, 0);

  // 5. Surveilans Epidemiologi Faskes Ini
  const topDiagnoses = await prisma.diagnosisPasien.groupBy({
    by: ['icd10Id'],
    _count: { id: true },
    where: { kunjungan: { faskesId: id } },
    orderBy: { _count: { id: 'desc' } },
    take: 10
  });

  const totalKasusFaskes = await prisma.diagnosisPasien.count({
    where: { kunjungan: { faskesId: id } }
  });

  const surveilansList = await Promise.all(
    topDiagnoses.map(async (item, idx) => {
      const icd = await prisma.masterICD10.findUnique({ where: { id_icd10: item.icd10Id } });
      const persen = totalKasusFaskes > 0 ? Number(((item._count.id / totalKasusFaskes) * 100).toFixed(1)) : 0;
      return {
        peringkat: idx + 1,
        kodeIcd10: icd?.kode_icd10 || 'UNKNOWN',
        namaDiagnosis: icd?.nama_diagnosis || 'Tidak Teridentifikasi',
        isPenyakitMenular: icd?.penyakit_menular || false,
        isWajibLapor: icd?.wajib_lapor || false,
        jumlahKasus: item._count.id,
        persentase: `${persen}%`
      };
    })
  );

  // 6. Analisis Poliklinik & Pelayanan Klinis
  const poliGroup = await prisma.kunjungan.groupBy({
    by: ['poliklinikId'],
    _count: { id: true },
    where: { faskesId: id }
  });

  const allMasterPoli = await prisma.poliklinik.findMany({
    where: {
      OR: [
        { faskesId: id },
        { faskesId: null }
      ],
      statusAktif: true
    }
  });

  const poliklinikStatsMap = new Map();
  poliGroup.forEach(g => {
    if (g.poliklinikId) poliklinikStatsMap.set(g.poliklinikId, g._count.id);
  });

  const polikliniksList = [];
  const processedPoliIds = new Set();

  allMasterPoli.forEach(p => {
    const totalKunjungan = poliklinikStatsMap.get(p.id) || 0;
    if (p.faskesId === id || totalKunjungan > 0) {
      polikliniksList.push({
        id: p.id,
        namaPoli: p.namaPoli,
        kodePoli: p.kodePoli,
        deskripsi: p.deskripsi,
        totalKunjungan
      });
      processedPoliIds.add(p.id);
    }
  });

  for (const g of poliGroup) {
    if (g.poliklinikId && !processedPoliIds.has(g.poliklinikId)) {
      const p = await prisma.poliklinik.findUnique({ where: { id: g.poliklinikId } });
      if (p) {
        polikliniksList.push({
          id: p.id,
          namaPoli: p.namaPoli,
          kodePoli: p.kodePoli,
          deskripsi: p.deskripsi,
          totalKunjungan: g._count.id
        });
        processedPoliIds.add(p.id);
      }
    }
  }

  polikliniksList.sort((a, b) => b.totalKunjungan - a.totalKunjungan);

  const recentKunjungans = await prisma.kunjungan.findMany({
    where: { faskesId: id },
    include: {
      pasien: {
        select: {
          id: true,
          noRM: true,
          namaLengkap: true,
          jenisKelamin: true,
          tanggalLahir: true,
          nik: true
        }
      },
      poliklinik: {
        select: { id: true, namaPoli: true, kodePoli: true }
      },
      dokterTujuan: {
        select: { id: true, namaLengkap: true }
      },
      diagnosis: {
        include: {
          icd10: {
            select: {
              kode_icd10: true,
              nama_diagnosis: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const daftarKunjungan = recentKunjungans.map(k => {
    let usia = null;
    if (k.pasien?.tanggalLahir) {
      const birthDate = new Date(k.pasien.tanggalLahir);
      const diff = now.getFullYear() - birthDate.getFullYear();
      usia = diff >= 0 ? diff : null;
    }
    return {
      id: k.id,
      noAntrian: k.noAntrian,
      tanggalRegistrasi: k.tanggalRegistrasi || k.createdAt,
      statusKunjungan: k.statusKunjungan,
      jenisPembayaran: k.jenisPembayaran || 'UMUM',
      prioritasPasien: k.prioritasPasien || 'NORMAL',
      pasienId: k.pasien?.id,
      noRM: k.pasien?.noRM,
      namaPasien: k.pasien?.namaLengkap,
      jenisKelamin: k.pasien?.jenisKelamin,
      usia,
      poliId: k.poliklinik?.id,
      namaPoli: k.poliklinik?.namaPoli || 'Poli Umum',
      kodePoli: k.poliklinik?.kodePoli || 'UMUM',
      namaDokter: k.dokterTujuan?.namaLengkap || 'Belum Ditentukan',
      diagnosis: (() => {
        const uniqueMap = new Map();
        (k.diagnosis || []).forEach(d => {
          const kode = d.icd10?.kode_icd10;
          if (kode && !uniqueMap.has(kode)) {
            uniqueMap.set(kode, {
              kode: kode,
              nama: d.icd10?.nama_diagnosis,
              jenis: d.jenisDiagnosis
            });
          }
        });
        return Array.from(uniqueMap.values());
      })()
    };
  });

  return {
    profil: {
      id: faskes.id,
      kodeFaskes: faskes.kodeFaskes,
      namaFaskes: faskes.namaFaskes,
      jenisFaskes: faskes.jenisFaskes,
      kategoriWilayah: faskes.kategoriWilayah || 'PERKOTAAN',
      statusAktif: faskes.statusAktif,
      alamat: faskes.alamat,
      kecamatan: faskes.kecamatan,
      desaKelurahan: faskes.desaKelurahan,
      kabupatenKota: faskes.kabupatenKota,
      provinsi: faskes.provinsi,
      kodePos: faskes.kodePos,
      titikGps: faskes.titikGps,
      noTelepon: faskes.noTelepon,
      email: faskes.email,
      kepalaPuskesmas: faskes.kepalaPuskesmas,
      nipKepala: faskes.nipKepala,
      targetKunjunganHarian: faskes.targetKunjunganHarian,
      jumlahPendudukWilayah: faskes.jumlahPendudukWilayah,
      ihsOrganizationId: faskes.ihsOrganizationId,
      createdAt: faskes.createdAt
    },
    ringkasanEksekutif: {
      totalNakes: nakesList.length,
      totalDokter: dokters.length,
      totalPasienBulanIni,
      totalPasienHariIni,
      totalKunjunganAllTime,
      rasioPasienPerDokter,
      statusBebanKerja,
      totalBed,
      bedTerisi,
      bedTersedia,
      bor: `${bor}%`,
      borAngka: bor,
      totalAset: allAsets.length,
      alkesKritisRusakCount: alkesKritisRusak.length,
      kalibrasiExpiredCount: kalibrasiAlerts.filter(k => k.status === 'KADALUWARSA').length,
      totalItemObat: obatList.length,
      obatKritisCount: obatKritis.length,
      totalItemBmhp: bmhpList.length,
      bmhpKritisCount: bmhpKritis.length,
      totalDosisVaksin,
      vaksinBatchCount: batchVaksinList.length
    },
    asetAlkes: {
      totalAset: allAsets.length,
      totalAlkesMedis: alkesMedis.length,
      totalNonMedis: nonMedis.length,
      kondisi: kondisiAset,
      statusOperasional: statusOperasionalAset,
      alkesKritisRusak,
      kalibrasiAlerts,
      daftarAset: allAsets.map(a => ({
        id: a.id,
        kodeAset: a.kodeAset,
        namaAset: a.namaAset,
        kategoriAset: a.kategoriAset,
        merk: a.merk,
        tipeModel: a.tipeModel,
        nomorSeri: a.nomorSeri,
        kondisiAset: a.kondisiAset,
        statusOperasional: a.statusOperasional,
        ruangan: a.ruangan?.namaRuangan,
        ihsDeviceId: a.ihsDeviceId,
        kodeAspak: a.kodeAspak,
        gambarUrl: a.gambarUrl || null,
        kalibrasiExpired: a.riwayatPemeliharaan?.[0]?.tanggalKalibrasiExpired || null
      }))
    },
    sdmk: {
      totalNakes: nakesList.length,
      totalDokter: dokters.length,
      totalPerawat: perawats.length,
      totalBidan: bidans.length,
      totalApoteker: apotekers.length,
      rasioPasienPerDokter,
      statusBebanKerja,
      daftarNakes: nakesList.map(n => ({
        id: n.id,
        namaLengkap: n.user?.namaLengkap || `Tenaga Medis (${n.nik})`,
        nik: n.nik,
        profesi: n.profesi,
        spesialis: n.spesialis,
        noSip: n.nomorSip || null,
        nomorStr: n.nomorStr || null,
        noIhs: n.noIHS || null,
        statusAktif: n.statusAktif,
        username: n.user?.username
      }))
    },
    tempatTidurRuangan: {
      totalRuangan: (faskes.ruangans || []).length,
      totalBed,
      bedTerisi,
      bedTersedia,
      bedPerbaikan,
      bor: `${bor}%`,
      borAngka: bor,
      daftarRuangan: (faskes.ruangans || []).map(r => ({
        id: r.id,
        namaRuangan: r.namaRuangan,
        kategoriRuangan: r.kategoriRuangan,
        gedung: r.gedung,
        lantai: r.lantai,
        totalBed: (r.tempatTidurs || []).length,
        tempatTidurs: (r.tempatTidurs || []).map(b => ({
          id: b.id,
          nomorBed: b.nomorBed,
          kelasKamar: b.kelasKamar,
          statusBed: b.statusBed,
          gambarUrl: b.gambarUrl || '/images/aset/bed.jpg',
          pasienNama: b.kunjunganAktif?.pasien?.namaLengkap || null,
          pasienNoRM: b.kunjunganAktif?.pasien?.noRM || null
        }))
      }))
    },
    pelayananKlinis: {
      totalKunjunganAllTime,
      totalPasienBulanIni,
      totalPasienHariIni,
      polikliniks: polikliniksList,
      daftarKunjungan: daftarKunjungan
    },
    logistik: {
      totalItemObat: obatList.length,
      obatKritis,
      totalItemBmhp: bmhpList.length,
      bmhpKritis,
      totalDosisVaksin,
      daftarVaksin: batchVaksinList,
      daftarObat: obatList.map(s => {
        let sisaHari = null;
        let statusExpired = 'AMAN';
        if (s.tanggalExpired) {
          const diffMs = new Date(s.tanggalExpired).getTime() - now.getTime();
          sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (sisaHari < 0) statusExpired = 'KADALUWARSA';
          else if (sisaHari <= 60) statusExpired = 'SEGERA_KADALUWARSA';
          else if (sisaHari <= 90) statusExpired = 'WASPADA';
        }
        return {
          id: s.id,
          obatId: s.obatId,
          kodeObat: s.obat?.kodeObat,
          namaObat: s.obat?.namaObat,
          kategori: s.obat?.kategori,
          sediaan: s.obat?.sediaan,
          harga: s.obat?.harga || 0,
          gambarUrl: s.obat?.gambarUrl || '/images/logistik/obat.jpg',
          stok: s.stok,
          stokMinimum: s.stokMinimum,
          noBatch: s.noBatch || '-',
          tanggalExpired: s.tanggalExpired,
          sisaHari,
          statusExpired,
          statusStok: s.stok === 0 ? 'HABIS' : (s.stok <= s.stokMinimum ? 'KRITIS' : 'AMAN')
        };
      }),
      daftarBmhp: bmhpList.map(s => {
        let sisaHari = null;
        let statusExpired = 'AMAN';
        if (s.tanggalExpired) {
          const diffMs = new Date(s.tanggalExpired).getTime() - now.getTime();
          sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (sisaHari < 0) statusExpired = 'KADALUWARSA';
          else if (sisaHari <= 60) statusExpired = 'SEGERA_KADALUWARSA';
          else if (sisaHari <= 90) statusExpired = 'WASPADA';
        }
        return {
          id: s.id,
          obatId: s.obatId,
          kodeObat: s.obat?.kodeObat,
          namaObat: s.obat?.namaObat,
          namaBmhp: s.obat?.namaObat,
          kategori: s.obat?.kategori,
          sediaan: s.obat?.sediaan,
          harga: s.obat?.harga || 0,
          gambarUrl: s.obat?.gambarUrl || '/images/logistik/bmhp.jpg',
          stok: s.stok,
          stokMinimum: s.stokMinimum,
          noBatch: s.noBatch || '-',
          tanggalExpired: s.tanggalExpired,
          sisaHari,
          statusExpired,
          statusStok: s.stok === 0 ? 'HABIS' : (s.stok <= s.stokMinimum ? 'KRITIS' : 'AMAN')
        };
      })
    },
    surveilans: {
      totalKasusFaskes,
      topPenyakit: surveilansList
    }
  };
};

const createFaskes = async (data) => {
  return await prisma.faskes.create({
    data: {
      kodeFaskes: data.kodeFaskes,
      namaFaskes: data.namaFaskes,
      jenisFaskes: data.jenisFaskes,
      kategoriWilayah: data.kategoriWilayah || 'PERKOTAAN',
      kecamatan: data.kecamatan,
      desaKelurahan: data.desaKelurahan || null,
      kabupatenKota: data.kabupatenKota || 'KABUPATEN',
      provinsi: data.provinsi || 'JAWA BARAT',
      alamat: data.alamat || null,
      kodePos: data.kodePos || null,
      titikGps: data.titikGps || null,
      noTelepon: data.noTelepon || null,
      email: data.email || null,
      kepalaPuskesmas: data.kepalaPuskesmas || null,
      nipKepala: data.nipKepala || null,
      targetKunjunganHarian: data.targetKunjunganHarian ? parseInt(data.targetKunjunganHarian, 10) : 100,
      jumlahPendudukWilayah: data.jumlahPendudukWilayah ? parseInt(data.jumlahPendudukWilayah, 10) : null,
      ihsOrganizationId: data.ihsOrganizationId || null
    }
  });
};

const updateFaskes = async (id, data) => {
  const { kapasitasRawatInap, totalBedFisik, tersediaIGD, ...validData } = data;
  return await prisma.faskes.update({
    where: { id },
    data: validData
  });
};

const deleteFaskes = async (id) => {
  return await prisma.faskes.update({
    where: { id },
    data: { statusAktif: false }
  });
};

// ==========================================
// 8. PENCATATAN MUTASI & REDISTRIBUSI NAKES DINKES
// ==========================================
const createMutasiNakes = async (data) => {
  const { tenagaMedisId, faskesAsalId, faskesTujuanId, nomorSk, jenisPenugasan, alasan } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Buat catatan mutasi
    const mutasi = await tx.mutasiTenagaMedis.create({
      data: {
        tenagaMedisId,
        faskesAsalId: faskesAsalId || null,
        faskesTujuanId,
        nomorSk: nomorSk || null,
        jenisPenugasan: jenisPenugasan || 'PERMANEN',
        alasan: alasan || null,
        status: 'AKTIF'
      }
    });

    // 2. Update penempatan faskes di profil TenagaMedis
    await tx.tenagaMedis.update({
      where: { id: tenagaMedisId },
      data: { faskesId: faskesTujuanId }
    });

    return mutasi;
  });
};

const getMutasiHistory = async (query = {}) => {
  const { tenagaMedisId, faskesTujuanId } = query;
  const where = {};
  if (tenagaMedisId) where.tenagaMedisId = tenagaMedisId;
  if (faskesTujuanId) where.faskesTujuanId = faskesTujuanId;

  return await prisma.mutasiTenagaMedis.findMany({
    where,
    include: {
      tenagaMedis: {
        include: {
          user: { select: { namaLengkap: true, username: true } }
        }
      },
      faskesAsal: { select: { id: true, namaFaskes: true } },
      faskesTujuan: { select: { id: true, namaFaskes: true } }
    },
    orderBy: { tanggalEfektif: 'desc' }
  });
};

module.exports = {
  // Analitik & Monitoring Dinkes
  getExecutiveSummary,
  getWorkloadAnalytics,
  getBedMonitoring,
  getCriticalAssetsMonitoring,
  getMedicineStockAlerts,
  getVaccineMonitoring,
  getDiseaseSurveillance,
  // Manajemen Master Faskes
  getFaskesList,
  getFaskesById,
  createFaskes,
  updateFaskes,
  deleteFaskes,
  // Redistribusi Nakes
  createMutasiNakes,
  getMutasiHistory
};
