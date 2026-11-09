const prisma = require('../config/prisma');

// =========================================================================
// 1. LAPORAN KUNJUNGAN PASIEN (HARIAN, BULANAN, TAHUNAN, KUSTOM)
// =========================================================================
const getLaporanKunjungan = async (user, query = {}) => {
  const { periode = 'bulanan', startDate, endDate, poliklinikId, jenisPenjamin } = query;

  // Resolusi faskesId dari user yang login (kecuali dinkes)
  const faskesId = (user && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role))
    ? user.faskesId
    : (query.faskesId || user?.faskesId);

  // Penentuan rentang tanggal dinamis
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (periode === 'harian') {
    start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (periode === 'bulanan') {
    if (startDate) {
      const parsed = new Date(startDate);
      start = new Date(parsed.getFullYear(), parsed.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } else if (periode === 'tahunan') {
    const year = startDate ? new Date(startDate).getFullYear() : now.getFullYear();
    start = new Date(year, 0, 1, 0, 0, 0, 0);
    end = new Date(year, 11, 31, 23, 59, 59, 999);
  } else if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  // Filter query Kunjungan
  const whereKunjungan = {
    tanggalRegistrasi: {
      gte: start,
      lte: end,
    }
  };
  if (faskesId) whereKunjungan.faskesId = faskesId;
  if (poliklinikId) whereKunjungan.poliklinikId = poliklinikId;

  const kunjungans = await prisma.kunjungan.findMany({
    where: whereKunjungan,
    include: {
      poliklinik: { select: { id: true, kodePoli: true, namaPoli: true } },
      pasien: {
        select: {
          id: true,
          noRM: true,
          namaLengkap: true,
          jenisKelamin: true,
          tanggalLahir: true,
          penjamin: { select: { jenisPenjamin: true, noBpjs: true } }
        }
      }
    },
    orderBy: { tanggalRegistrasi: 'asc' }
  });

  // Agregasi Statistik
  let totalKunjungan = kunjungans.length;
  let pasienBaru = 0;
  let pasienLama = 0;
  let lakiLaki = 0;
  let perempuan = 0;

  const penjaminCounts = { BPJS: 0, Umum: 0, Asuransi: 0, Lainnya: 0 };
  const poliCounts = {};
  const rekapHarianMap = {};
  const usiaDemografi = {
    balita: 0,   // 0-5 tahun
    anak: 0,     // 6-11 tahun
    remaja: 0,   // 12-25 tahun
    dewasa: 0,   // 26-45 tahun
    lansia: 0    // 46+ tahun
  };

  kunjungans.forEach(k => {
    // Status Baru / Lama
    const status = (k.statusPasien || '').toLowerCase();
    if (status.includes('baru')) pasienBaru++;
    else pasienLama++;

    // Jenis Kelamin
    const gender = (k.pasien?.jenisKelamin || '').toLowerCase();
    if (gender.startsWith('l')) lakiLaki++;
    else if (gender.startsWith('p')) perempuan++;

    // Jenis Penjamin
    const jenisPenj = k.pasien?.penjamin?.jenisPenjamin || 'Umum';
    if (jenisPenj.toUpperCase().includes('BPJS')) penjaminCounts.BPJS++;
    else if (jenisPenj.toUpperCase().includes('UMUM') || jenisPenj.toUpperCase().includes('TUNAI')) penjaminCounts.Umum++;
    else if (jenisPenj.toUpperCase().includes('ASURANSI')) penjaminCounts.Asuransi++;
    else penjaminCounts.Lainnya++;

    // Sebaran Poli
    const namaPoli = k.poliklinik?.namaPoli || k.layananTujuan || 'Poli Umum';
    poliCounts[namaPoli] = (poliCounts[namaPoli] || 0) + 1;

    // Kelompok Usia
    if (k.pasien?.tanggalLahir) {
      const birth = new Date(k.pasien.tanggalLahir);
      const age = now.getFullYear() - birth.getFullYear();
      if (age <= 5) usiaDemografi.balita++;
      else if (age <= 11) usiaDemografi.anak++;
      else if (age <= 25) usiaDemografi.remaja++;
      else if (age <= 45) usiaDemografi.dewasa++;
      else usiaDemografi.lansia++;
    }

    // Rekap Per Hari (Tabel Agregat Harian)
    const tglStr = new Date(k.tanggalRegistrasi).toISOString().split('T')[0];
    if (!rekapHarianMap[tglStr]) {
      rekapHarianMap[tglStr] = {
        tanggal: tglStr,
        total: 0,
        baru: 0,
        lama: 0,
        lakiLaki: 0,
        perempuan: 0,
        bpjs: 0,
        umum: 0
      };
    }
    const dayItem = rekapHarianMap[tglStr];
    dayItem.total++;
    if (status.includes('baru')) dayItem.baru++; else dayItem.lama++;
    if (gender.startsWith('l')) dayItem.lakiLaki++; else if (gender.startsWith('p')) dayItem.perempuan++;
    if (jenisPenj.toUpperCase().includes('BPJS')) dayItem.bpjs++; else dayItem.umum++;
  });

  const rekapHarianList = Object.values(rekapHarianMap).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const sebaranPoliList = Object.entries(poliCounts).map(([namaPoli, jumlah]) => ({
    namaPoli,
    jumlah,
    persentase: totalKunjungan > 0 ? Number(((jumlah / totalKunjungan) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.jumlah - a.jumlah);

  return {
    periode,
    rentangTanggal: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    ringkasan: {
      totalKunjungan,
      pasienBaru,
      pasienLama,
      lakiLaki,
      perempuan,
      rataRataPerHari: rekapHarianList.length > 0 ? Number((totalKunjungan / rekapHarianList.length).toFixed(1)) : totalKunjungan,
      penjamin: penjaminCounts,
      usia: usiaDemografi
    },
    sebaranPoli: sebaranPoliList,
    rekapTabelHarian: rekapHarianList,
    daftarKunjungan: kunjungans.slice(0, 300).map(k => ({
      id: k.id,
      tanggal: k.tanggalRegistrasi,
      noAntrian: k.noAntrian,
      noRM: k.pasien?.noRM || '-',
      namaPasien: k.pasien?.namaLengkap || '-',
      jenisKelamin: k.pasien?.jenisKelamin || '-',
      poli: k.poliklinik?.namaPoli || 'Poli Umum',
      penjamin: k.pasien?.penjamin?.jenisPenjamin || 'Umum',
      statusPasien: k.statusPasien || 'Lama'
    }))
  };
};

// =========================================================================
// 2. LAPORAN REKAPITULASI DIAGNOSIS (LB1 / MORBIDITAS / 10 BESAR PENYAKIT)
// =========================================================================
const getLaporanMorbiditas = async (user, query = {}) => {
  const { startDate, endDate, poliklinikId, limit = 10 } = query;
  const faskesId = (user && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role))
    ? user.faskesId
    : (query.faskesId || user?.faskesId);

  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  const whereDiagnosis = {
    tanggalDiagnosis: { gte: start, lte: end }
  };
  if (faskesId) {
    whereDiagnosis.kunjungan = { faskesId };
  }
  if (poliklinikId) {
    whereDiagnosis.kunjungan = {
      ...(whereDiagnosis.kunjungan || {}),
      poliklinikId
    };
  }

  // Agregasi Top ICD-10
  const grouped = await prisma.diagnosisPasien.groupBy({
    by: ['icd10Id'],
    _count: { id: true },
    where: whereDiagnosis,
    orderBy: { _count: { id: 'desc' } },
    take: parseInt(limit, 10) || 10
  });

  const totalKasus = await prisma.diagnosisPasien.count({ where: whereDiagnosis });

  // Ambil detail Master ICD-10
  const icd10Ids = grouped.map(g => g.icd10Id);
  const masterIcd10List = await prisma.masterICD10.findMany({
    where: { id_icd10: { in: icd10Ids } }
  });
  const icd10Map = new Map();
  masterIcd10List.forEach(item => icd10Map.set(item.id_icd10, item));

  // Ambil rincian kasus primer vs sekunder
  const topList = await Promise.all(grouped.map(async (g, idx) => {
    const master = icd10Map.get(g.icd10Id) || {};
    const count = g._count.id;
    const persentase = totalKasus > 0 ? Number(((count / totalKasus) * 100).toFixed(1)) : 0;

    const primerCount = await prisma.diagnosisPasien.count({
      where: {
        ...whereDiagnosis,
        icd10Id: g.icd10Id,
        jenisDiagnosis: { in: ['Utama', 'PRIMER', 'Primer'] }
      }
    });

    return {
      peringkat: idx + 1,
      icd10Id: g.icd10Id,
      kodeIcd10: master.kode_icd10 || '-',
      namaDiagnosis: master.nama_diagnosis || master.deskripsi || 'Diagnosis Tanpa Nama',
      totalKasus: count,
      kasusPrimer: primerCount,
      kasusSekunder: count - primerCount,
      persentase
    };
  }));

  return {
    rentangTanggal: { start: start.toISOString(), end: end.toISOString() },
    ringkasan: {
      totalKasus,
      topDiagnosisCount: topList.length,
      penyakitNomorSatu: topList[0]?.namaDiagnosis || '-'
    },
    topPenyakit: topList
  };
};

// =========================================================================
// 3. LAPORAN PENGGUNAAN & MUTASI BMHP (BAHAN MEDIS HABIS PAKAI)
// =========================================================================
const getLaporanBMHP = async (user, query = {}) => {
  const { startDate, endDate, search, statusStok, filterMode, hanyaBermutasi } = query;
  const faskesId = (user && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role))
    ? user.faskesId
    : (query.faskesId || user?.faskesId);

  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  // 1. Ambil mutasi logistik BMHP (Kategori 'BMHP' atau obat dengan subkategori BMHP)
  const whereMutasi = {
    createdAt: { gte: start, lte: end },
    OR: [
      { kategoriItem: 'BMHP' },
      {
        obat: {
          OR: [
            { kategori: { startsWith: 'BMHP' } },
            { kategori: { contains: 'BMHP', mode: 'insensitive' } },
            { kategori: { in: ['Alat Kesehatan', 'Bahan Medis Habis Pakai', 'bmhp'] } }
          ]
        }
      }
    ]
  };
  if (faskesId) whereMutasi.faskesId = faskesId;
  if (search) {
    whereMutasi.namaItem = { contains: search, mode: 'insensitive' };
  }

  const mutasis = await prisma.mutasiStokLogistik.findMany({
    where: whereMutasi,
    include: {
      obat: {
        select: { id: true, kodeObat: true, namaObat: true, kategori: true, sediaan: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 2. Ambil master stok obat/BMHP aktif di faskes (semua subkategori BMHP)
  const whereStok = {
    obat: {
      OR: [
        { kategori: { startsWith: 'BMHP' } },
        { kategori: { contains: 'BMHP', mode: 'insensitive' } },
        { kategori: { in: ['Alat Kesehatan', 'Bahan Medis Habis Pakai', 'bmhp'] } }
      ]
    }
  };
  if (faskesId) whereStok.faskesId = faskesId;
  if (search) {
    whereStok.obat = {
      ...whereStok.obat,
      namaObat: { contains: search, mode: 'insensitive' }
    };
  }

  const stokItems = await prisma.stokObatFaskes.findMany({
    where: whereStok,
    include: {
      obat: true
    }
  });

  // 3. Agregasi mutasi per item obat & batch
  const mutasiByObat = {};
  const mutasiByName = {};

  mutasis.forEach(m => {
    const qty = Math.abs(m.jumlahPerubahan || 0);
    const isMasuk = m.jenisMutasi === 'MASUK';
    const isKeluar = m.jenisMutasi === 'KELUAR';

    const updateAgg = (agg) => {
      agg.transaksiCount += 1;
      if (isMasuk) agg.totalMasuk += qty;
      if (isKeluar) agg.totalKeluar += qty;
    };

    if (m.obatId) {
      if (!mutasiByObat[m.obatId]) {
        mutasiByObat[m.obatId] = { totalMasuk: 0, totalKeluar: 0, transaksiCount: 0 };
      }
      updateAgg(mutasiByObat[m.obatId]);
    }

    if (m.namaItem) {
      const normName = m.namaItem.toLowerCase().trim();
      if (!mutasiByName[normName]) {
        mutasiByName[normName] = { totalMasuk: 0, totalKeluar: 0, transaksiCount: 0 };
      }
      updateAgg(mutasiByName[normName]);
    }
  });

  // 4. Rekapitulasi BMHP lengkap (stok awal, mutasi masuk, mutasi keluar, sisa stok akhir)
  const rekapBMHPList = stokItems.map(stok => {
    const normName = (stok.obat.namaObat || '').toLowerCase().trim();
    const mutasi = mutasiByObat[stok.obatId] || mutasiByName[normName] || { totalMasuk: 0, totalKeluar: 0, transaksiCount: 0 };
    const sisaStok = stok.stok;
    const stokMin = stok.stokMinimum || 10;

    let status = 'AMAN';
    if (sisaStok === 0) status = 'HABIS';
    else if (sisaStok <= stokMin) status = 'KRITIS';

    const stokAwal = sisaStok - mutasi.totalMasuk + mutasi.totalKeluar;
    const adaTransaksi = (mutasi.totalMasuk > 0 || mutasi.totalKeluar > 0 || mutasi.transaksiCount > 0);

    return {
      id: stok.id,
      obatId: stok.obatId,
      kodeItem: stok.obat.kodeObat,
      namaItem: stok.obat.namaObat,
      kategori: stok.obat.kategori,
      sediaan: stok.obat.sediaan || 'Pcs',
      noBatch: stok.noBatch || 'DEFAULT',
      tanggalExpired: stok.tanggalExpired,
      stokAwal: stokAwal < 0 ? 0 : stokAwal,
      jumlahMasuk: mutasi.totalMasuk,
      jumlahKeluar: mutasi.totalKeluar,
      sisaStokAkhir: sisaStok,
      stokMinimum: stokMin,
      transaksiCount: mutasi.transaksiCount,
      adaTransaksi,
      status
    };
  });

  // Urutkan: Barang dengan mutasi aktif diletakkan paling atas, lalu berdasarkan total mutasi & nama
  rekapBMHPList.sort((a, b) => {
    if (a.adaTransaksi !== b.adaTransaksi) {
      return a.adaTransaksi ? -1 : 1;
    }
    if (b.transaksiCount !== a.transaksiCount) {
      return b.transaksiCount - a.transaksiCount;
    }
    if (b.jumlahKeluar !== a.jumlahKeluar) {
      return b.jumlahKeluar - a.jumlahKeluar;
    }
    return a.namaItem.localeCompare(b.namaItem);
  });

  // Filter list: DEFAULT adalah HANYA barang yang BENAR-BENAR TERJADI TRANSAKSI (Masuk > 0 atau Keluar > 0)
  // Barang yang tidak memiliki transaksi di periode ini TIDAK dimasukkan ke dalam tabel logs.
  let filteredList = rekapBMHPList.filter(item => item.adaTransaksi);

  if (filterMode === 'semua') {
    filteredList = rekapBMHPList;
  } else if (filterMode === 'kritis') {
    filteredList = rekapBMHPList.filter(item => item.status === 'KRITIS' || item.status === 'HABIS');
  }

  if (statusStok && statusStok !== 'SEMUA') {
    filteredList = filteredList.filter(item => item.status === statusStok);
  }

  const totalItemBMHP = rekapBMHPList.length;
  const itemBermutasi = rekapBMHPList.filter(i => i.adaTransaksi).length;
  const itemTanpaMutasi = totalItemBMHP - itemBermutasi;
  const itemKritis = rekapBMHPList.filter(i => i.status === 'KRITIS' || i.status === 'HABIS').length;
  const totalPemakaian = mutasis
    .filter(m => m.jenisMutasi === 'KELUAR')
    .reduce((acc, curr) => acc + Math.abs(curr.jumlahPerubahan || 0), 0);
  const totalMasuk = mutasis
    .filter(m => m.jenisMutasi === 'MASUK')
    .reduce((acc, curr) => acc + Math.abs(curr.jumlahPerubahan || 0), 0);

  return {
    rentangTanggal: { start: start.toISOString(), end: end.toISOString() },
    ringkasan: {
      totalItemBMHP,
      itemBermutasi,
      itemTanpaMutasi,
      totalMasukUnit: totalMasuk,
      totalPemakaianUnit: totalPemakaian,
      totalMutasiTransaksi: mutasis.length,
      itemKritis
    },
    daftarBMHP: filteredList,
    logMutasiTerbaru: mutasis.slice(0, 100).map(m => ({
      id: m.id,
      tanggal: m.createdAt,
      namaItem: m.namaItem,
      kategori: m.obat?.kategori || m.kategoriItem,
      jenisMutasi: m.jenisMutasi,
      jumlah: Math.abs(m.jumlahPerubahan),
      stokAwal: m.stokAwal,
      stokAkhir: m.stokAkhir,
      referensi: m.referensi || '-',
      keterangan: m.keterangan || '-',
      petugas: m.petugasNama || 'Petugas Farmasi / Medis'
    }))
  };
};

// =========================================================================
// 4. LAPORAN PENGGUNAAN & KONDISI ALAT MEDIS / ALAT BANTU (ALKES)
// =========================================================================
const getLaporanAlkes = async (user, query = {}) => {
  const { startDate, endDate, ruanganId, kategoriAset, kondisiAset, filterMode } = query;
  const faskesId = (user && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role))
    ? user.faskesId
    : (query.faskesId || user?.faskesId);

  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  // 1. Ambil seluruh aset medis terdaftar di faskes
  const whereAset = {};
  if (faskesId) whereAset.faskesId = faskesId;
  if (ruanganId) whereAset.ruanganId = ruanganId;
  if (kategoriAset) whereAset.kategoriAset = kategoriAset;
  if (kondisiAset) whereAset.kondisiAset = kondisiAset;

  whereAset.OR = [
    { kategoriAset: { startsWith: 'MEDIS_' } },
    { isAlkesTindakan: true }
  ];

  const asets = await prisma.asetRuangan.findMany({
    where: whereAset,
    include: {
      ruangan: { select: { id: true, namaRuangan: true, gedung: true } },
      riwayatPemeliharaan: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { namaAset: 'asc' }
  });

  const asetById = new Map();
  const asetByKode = new Map();
  const asetByName = new Map();

  asets.forEach(a => {
    asetById.set(a.id, a);
    asetByKode.set(a.kodeAset, a);
    asetByName.set(a.namaAset.toLowerCase().trim(), a);
  });

  // 2. Ambil catatan pemakaian alat medis dari TindakanPasien (UGD, Poli, KIA, dll)
  const tindakans = await prisma.tindakanPasien.findMany({
    where: {
      waktuTindakan: { gte: start, lte: end },
      ...(faskesId ? { kunjungan: { faskesId } } : {})
    },
    include: {
      kunjungan: {
        include: {
          pasien: { select: { noRM: true, namaLengkap: true } },
          poliklinik: { select: { namaPoli: true } }
        }
      },
      icd9: { select: { kode_icd9: true, nama_prosedur: true } }
    },
    orderBy: { waktuTindakan: 'desc' }
  });

  const usageByAsetId = {};
  const usageLogs = [];

  tindakans.forEach(t => {
    if (Array.isArray(t.alkesDetails)) {
      t.alkesDetails.forEach(item => {
        const matchedAset = (item.asetId && asetById.get(item.asetId)) ||
                            (item.kodeAset && asetByKode.get(item.kodeAset)) ||
                            (item.namaAset && asetByName.get(item.namaAset.toLowerCase().trim()));

        const key = matchedAset ? matchedAset.id : (item.asetId || item.kodeAset || item.namaAset);
        if (!usageByAsetId[key]) {
          usageByAsetId[key] = {
            frekuensi: 0,
            totalTarif: 0,
            matchedAset: matchedAset || null,
            kodeAset: matchedAset?.kodeAset || item.kodeAset || '-',
            namaAset: matchedAset?.namaAset || item.namaAset || 'Alat Medis',
            ruangan: matchedAset?.ruangan?.namaRuangan || 'Ruang Tindakan / UGD',
            kondisi: matchedAset?.kondisiAset || 'BAIK',
            tarifSatuan: item.tarifPemakaian || matchedAset?.tarifPemakaian || 0
          };
        }

        const tarif = item.tarifPemakaian || matchedAset?.tarifPemakaian || 0;
        usageByAsetId[key].frekuensi += 1;
        usageByAsetId[key].totalTarif += tarif;

        usageLogs.push({
          id: `${t.id}_${item.asetId || item.kodeAset || Math.random().toString(36).substring(2, 6)}`,
          kunjunganId: t.kunjunganId,
          waktu: t.waktuTindakan,
          kodeAset: matchedAset?.kodeAset || item.kodeAset || '-',
          namaAset: matchedAset?.namaAset || item.namaAset,
          prosedur: t.icd9?.nama_prosedur || 'Tindakan Medis',
          poli: t.kunjungan?.poliklinik?.namaPoli || 'Poli / Tindakan',
          pasien: t.kunjungan?.pasien?.namaLengkap || '-',
          noRM: t.kunjungan?.pasien?.noRM || '-',
          pelaksana: t.pelaksanaTeks || 'Dokter / Tenaga Medis',
          tarif
        });
      });
    }
  });

  // 3. Ambil juga dari DetailTagihan (kategori 'Alat Kesehatan' yang dicatat di kasir)
  const detailTagihans = await prisma.detailTagihan.findMany({
    where: {
      kategori: 'Alat Kesehatan',
      tagihan: {
        createdAt: { gte: start, lte: end },
        ...(faskesId ? { kunjungan: { faskesId } } : {})
      }
    },
    include: {
      tagihan: {
        include: {
          kunjungan: {
            include: {
              pasien: { select: { noRM: true, namaLengkap: true } },
              poliklinik: { select: { namaPoli: true } }
            }
          }
        }
      }
    }
  });

  detailTagihans.forEach(dt => {
    const cleanedName = dt.namaItem.replace(/^Pemakaian Alkes:\s*/i, '').trim();
    const matchedAset = asetByName.get(cleanedName.toLowerCase());

    const kunjunganId = dt.tagihan?.kunjunganId;
    const key = matchedAset ? matchedAset.id : cleanedName;
    const alreadyLogged = usageLogs.some(l =>
      l.kunjunganId === kunjunganId &&
      (l.namaAset.toLowerCase() === cleanedName.toLowerCase() || l.kodeAset === matchedAset?.kodeAset)
    );

    if (!alreadyLogged) {
      if (!usageByAsetId[key]) {
        usageByAsetId[key] = {
          frekuensi: 0,
          totalTarif: 0,
          matchedAset: matchedAset || null,
          kodeAset: matchedAset?.kodeAset || '-',
          namaAset: matchedAset?.namaAset || cleanedName,
          ruangan: matchedAset?.ruangan?.namaRuangan || 'Ruang Tindakan / Kasir',
          kondisi: matchedAset?.kondisiAset || 'BAIK',
          tarifSatuan: dt.hargaSatuan || matchedAset?.tarifPemakaian || 0
        };
      }
      usageByAsetId[key].frekuensi += (dt.jumlah || 1);
      usageByAsetId[key].totalTarif += (dt.subTotal || 0);

      usageLogs.push({
        id: dt.id,
        kunjunganId,
        waktu: dt.tagihan?.createdAt,
        kodeAset: matchedAset?.kodeAset || '-',
        namaAset: matchedAset?.namaAset || cleanedName,
        prosedur: 'Pemakaian Alkes (Tagihan Kasir)',
        poli: dt.tagihan?.kunjungan?.poliklinik?.namaPoli || 'Kasir / Tindakan',
        pasien: dt.tagihan?.kunjungan?.pasien?.namaLengkap || '-',
        noRM: dt.tagihan?.kunjungan?.pasien?.noRM || '-',
        pelaksana: 'Kasir / Petugas',
        tarif: dt.hargaSatuan || 0
      });
    }
  });

  // 4. Rekapitulasi per alat
  const rekapAlkesList = asets.map(a => {
    const usage = usageByAsetId[a.id] || { frekuensi: 0, totalTarif: 0 };
    const lastMaint = a.riwayatPemeliharaan?.[0];
    const adaTransaksi = usage.frekuensi > 0;

    return {
      id: a.id,
      kodeAset: a.kodeAset,
      namaAset: a.namaAset,
      ruangan: a.ruangan?.namaRuangan || 'Ruangan Belum Diatur',
      kategori: a.kategoriAset,
      merk: a.merk || '-',
      nomorSeri: a.nomorSeri || '-',
      kodeAspak: a.kodeAspak || '-',
      kondisi: a.kondisiAset,
      statusOperasional: a.statusOperasional,
      tarifPemakaian: a.tarifPemakaian || 0,
      frekuensiPakai: usage.frekuensi,
      totalNilaiUtilisasi: usage.totalTarif,
      adaTransaksi,
      kalibrasiTerakhir: lastMaint?.tanggalPelaksanaan || null,
      jadwalKalibrasiBerikutnya: lastMaint?.tanggalKalibrasiExpired || lastMaint?.tanggalJadwal || null
    };
  });

  // Urutkan: Alat yang pernah digunakan (adaTransaksi === true) di paling atas, disusul frekuensi terbanyak
  rekapAlkesList.sort((a, b) => {
    if (a.adaTransaksi !== b.adaTransaksi) {
      return a.adaTransaksi ? -1 : 1;
    }
    if (b.frekuensiPakai !== a.frekuensiPakai) {
      return b.frekuensiPakai - a.frekuensiPakai;
    }
    return a.namaAset.localeCompare(b.namaAset);
  });

  // Filter list: DEFAULT adalah HANYA ALAT YANG DIGUNAKAN (frekuensiPakai > 0)
  // Alat yang belum pernah digunakan pada periode terpilih TIDAK DIMASUKKAN ke tabel laporan transaksi!
  let filteredList = rekapAlkesList.filter(item => item.adaTransaksi);

  if (filterMode === 'semua') {
    filteredList = rekapAlkesList;
  }

  const totalAlatTerdaftar = asets.length;
  const alatDigunakanCount = rekapAlkesList.filter(a => a.adaTransaksi).length;
  const totalFrekuensiPakai = rekapAlkesList.reduce((acc, curr) => acc + curr.frekuensiPakai, 0);
  const totalNilaiUtilisasi = rekapAlkesList.reduce((acc, curr) => acc + curr.totalNilaiUtilisasi, 0);

  const kondisiBaik = filteredList.filter(a => a.kondisi === 'BAIK').length;
  const kondisiRusakRingan = filteredList.filter(a => a.kondisi === 'RUSAK_RINGAN').length;
  const kondisiRusakBerat = filteredList.filter(a => a.kondisi === 'RUSAK_BERAT' || a.kondisi === 'AFKIR').length;

  return {
    rentangTanggal: { start: start.toISOString(), end: end.toISOString() },
    ringkasan: {
      totalAlatTerdaftar,
      alatDigunakanCount,
      totalFrekuensiPakai,
      totalNilaiUtilisasi,
      totalLogPenggunaan: usageLogs.length,
      kondisiBaik,
      kondisiRusakRingan,
      kondisiRusakBerat
    },
    daftarAlkes: filteredList,
    logPenggunaanAlkes: usageLogs
  };
};

// =========================================================================
// 5. LAPORAN KINERJA TENAGA MEDIS (DOKTER & PERAWAT)
// =========================================================================
const getLaporanKinerjaNakes = async (user, query = {}) => {
  const { startDate, endDate, poliklinikId, profesi, search, filterMode } = query;
  const faskesId = (user && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role))
    ? user.faskesId
    : (query.faskesId || user?.faskesId);

  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  // 1. Ambil daftar User Tenaga Medis (Dokter, Dokter UGD, Perawat, Bidan)
  const whereUser = {
    role: { in: ['DOKTER', 'DOKTER_UGD', 'PERAWAT'] }
  };
  if (faskesId) whereUser.faskesId = faskesId;
  if (poliklinikId) whereUser.poliklinikId = poliklinikId;
  if (profesi && profesi !== 'SEMUA') {
    if (profesi === 'DOKTER') {
      whereUser.role = { in: ['DOKTER', 'DOKTER_UGD'] };
    } else if (profesi === 'PERAWAT') {
      whereUser.role = 'PERAWAT';
    }
  }
  if (search) {
    whereUser.namaLengkap = { contains: search, mode: 'insensitive' };
  }

  const nakesList = await prisma.user.findMany({
    where: whereUser,
    include: {
      poliklinik: true,
      tenagaMedis: true
    },
    orderBy: { namaLengkap: 'asc' }
  });

  // 2. Ambil Rekam Medis (pemeriksaan dokter)
  const whereRme = {
    createdAt: { gte: start, lte: end }
  };
  if (faskesId) whereRme.kunjungan = { faskesId };
  if (poliklinikId) {
    whereRme.kunjungan = {
      ...(whereRme.kunjungan || {}),
      poliklinikId
    };
  }

  const rmeList = await prisma.rekamMedis.findMany({
    where: whereRme,
    include: {
      kunjungan: {
        include: {
          poliklinik: true,
          pasien: { select: { noRM: true, namaLengkap: true } }
        }
      },
      dokter: { select: { id: true, namaLengkap: true, role: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 3. Ambil Tindakan Pasien (prosedur klinis)
  const whereTindakan = {
    waktuTindakan: { gte: start, lte: end }
  };
  if (faskesId) whereTindakan.kunjungan = { faskesId };
  if (poliklinikId) {
    whereTindakan.kunjungan = {
      ...(whereTindakan.kunjungan || {}),
      poliklinikId
    };
  }

  const tindakanList = await prisma.tindakanPasien.findMany({
    where: whereTindakan,
    include: {
      kunjungan: {
        include: {
          poliklinik: true,
          pasien: { select: { noRM: true, namaLengkap: true } }
        }
      },
      pelaksanaUser: { select: { id: true, namaLengkap: true, role: true } },
      icd9: { select: { kode_icd9: true, nama_prosedur: true } }
    },
    orderBy: { waktuTindakan: 'desc' }
  });

  // 4. Ambil Resep Obat
  const whereResep = {
    tanggalResep: { gte: start, lte: end }
  };
  if (faskesId) whereResep.kunjungan = { faskesId };
  if (poliklinikId) {
    whereResep.kunjungan = {
      ...(whereResep.kunjungan || {}),
      poliklinikId
    };
  }

  const resepList = await prisma.resep.findMany({
    where: whereResep,
    include: {
      kunjungan: {
        include: {
          poliklinik: true,
          pasien: { select: { noRM: true, namaLengkap: true } }
        }
      },
      dokter: { select: { id: true, namaLengkap: true, role: true } },
      details: { select: { id: true } }
    },
    orderBy: { tanggalResep: 'desc' }
  });

  // 5. Ambil Screening & Triase (aktivitas perawat/bidan)
  const whereScreening = {
    tanggalScreening: { gte: start, lte: end }
  };
  if (faskesId) whereScreening.kunjungan = { faskesId };
  if (poliklinikId) {
    whereScreening.kunjungan = {
      ...(whereScreening.kunjungan || {}),
      poliklinikId
    };
  }

  const screeningList = await prisma.screening.findMany({
    where: whereScreening,
    include: {
      kunjungan: {
        include: {
          poliklinik: true,
          pasien: { select: { noRM: true, namaLengkap: true } }
        }
      }
    },
    orderBy: { tanggalScreening: 'desc' }
  });

  // 6. Inisialisasi peta kinerja per Tenaga Medis
  const kinerjaMap = {};
  nakesList.forEach(u => {
    kinerjaMap[u.id] = {
      id: u.id,
      nama: u.namaLengkap,
      role: u.role,
      profesi: u.tenagaMedis?.profesi || u.role,
      spesialis: u.tenagaMedis?.spesialis || '-',
      poli: u.poliklinik?.namaPoli || 'Poli Umum / UGD',
      nomorSip: u.tenagaMedis?.nomorSip || '-',
      nomorStr: u.tenagaMedis?.nomorStr || '-',
      statusKepegawaian: u.tenagaMedis?.statusKepegawaian || 'PNS',
      jumlahRme: 0,
      jumlahTindakan: 0,
      jumlahResep: 0,
      jumlahScreening: 0,
      totalAktivitas: 0,
      adaTransaksi: false
    };
  });

  // Helper matching nama petugas dari string screening ke User ID
  const nakesByName = new Map();
  nakesList.forEach(u => {
    if (u.namaLengkap) {
      nakesByName.set(u.namaLengkap.toLowerCase().trim(), u.id);
      const short = u.namaLengkap.replace(/^(dr\.|drg\.|Ns\.|Bdn\.)\s*/i, '').split(',')[0].trim().toLowerCase();
      nakesByName.set(short, u.id);
    }
  });

  const activityLogs = [];

  // Hitung Pemeriksaan RME
  rmeList.forEach(r => {
    if (kinerjaMap[r.dokterId]) {
      kinerjaMap[r.dokterId].jumlahRme += 1;
      kinerjaMap[r.dokterId].totalAktivitas += 1;
      kinerjaMap[r.dokterId].adaTransaksi = true;
    }
    activityLogs.push({
      id: `rme_${r.id}`,
      waktu: r.createdAt,
      nakesNama: r.dokter?.namaLengkap || 'Dokter Pemeriksa',
      role: r.dokter?.role || 'DOKTER',
      jenis: 'PEMERIKSAAN_DOKTER',
      labelJenis: 'Pemeriksaan RME',
      keterangan: `Konsultasi & Pemeriksaan Pasien: ${r.diagnosisKlinis || 'Pemeriksaan Rawat Jalan'}`,
      pasien: r.kunjungan?.pasien?.namaLengkap || '-',
      noRM: r.kunjungan?.pasien?.noRM || '-',
      poli: r.kunjungan?.poliklinik?.namaPoli || 'Poli Umum'
    });
  });

  // Hitung Tindakan Medis
  tindakanList.forEach(t => {
    if (t.pelaksanaId && kinerjaMap[t.pelaksanaId]) {
      kinerjaMap[t.pelaksanaId].jumlahTindakan += 1;
      kinerjaMap[t.pelaksanaId].totalAktivitas += 1;
      kinerjaMap[t.pelaksanaId].adaTransaksi = true;
    }
    activityLogs.push({
      id: `tdk_${t.id}`,
      waktu: t.waktuTindakan,
      nakesNama: t.pelaksanaUser?.namaLengkap || t.pelaksanaTeks || 'Dokter / Tenaga Medis',
      role: t.pelaksanaUser?.role || 'DOKTER',
      jenis: 'TINDAKAN_MEDIS',
      labelJenis: 'Tindakan Klinis',
      keterangan: `Prosedur: ${t.icd9?.nama_prosedur || 'Tindakan Medis'}`,
      pasien: t.kunjungan?.pasien?.namaLengkap || '-',
      noRM: t.kunjungan?.pasien?.noRM || '-',
      poli: t.kunjungan?.poliklinik?.namaPoli || 'Ruang Tindakan'
    });
  });

  // Hitung Resep Dokter
  resepList.forEach(rs => {
    if (kinerjaMap[rs.dokterId]) {
      kinerjaMap[rs.dokterId].jumlahResep += 1;
      kinerjaMap[rs.dokterId].totalAktivitas += 1;
      kinerjaMap[rs.dokterId].adaTransaksi = true;
    }
    activityLogs.push({
      id: `rsp_${rs.id}`,
      waktu: rs.tanggalResep,
      nakesNama: rs.dokter?.namaLengkap || 'Dokter Penulis Resep',
      role: rs.dokter?.role || 'DOKTER',
      jenis: 'PENULISAN_RESEP',
      labelJenis: 'Penerbitan Resep',
      keterangan: `E-Resep Farmasi: ${rs.details?.length || 1} Item Obat (Status: ${rs.status})`,
      pasien: rs.kunjungan?.pasien?.namaLengkap || '-',
      noRM: rs.kunjungan?.pasien?.noRM || '-',
      poli: rs.kunjungan?.poliklinik?.namaPoli || 'Poli / Farmasi'
    });
  });

  // Hitung Screening & Triase (Perawat / Bidan)
  screeningList.forEach(s => {
    let matchedId = null;
    const cleanPetugas = (s.petugas || '').toLowerCase().trim();
    for (const [key, id] of nakesByName.entries()) {
      if (cleanPetugas.includes(key) || key.includes(cleanPetugas)) {
        matchedId = id;
        break;
      }
    }
    if (matchedId && kinerjaMap[matchedId]) {
      kinerjaMap[matchedId].jumlahScreening += 1;
      kinerjaMap[matchedId].totalAktivitas += 1;
      kinerjaMap[matchedId].adaTransaksi = true;
    }

    activityLogs.push({
      id: `scr_${s.id}`,
      waktu: s.tanggalScreening,
      nakesNama: s.petugas || 'Perawat / Petugas Skrining',
      role: 'PERAWAT',
      jenis: 'SKRINING_TRIASE',
      labelJenis: 'Skrining & TTV',
      keterangan: `Skrining & TTV: Tekanan Darah ${s.tekananDarahSistolik || '-'}/${s.tekananDarahDiastolik || '-'}, Suhu ${s.suhuTubuh || '-'}°C, Triase ${s.kategoriTriage || '-'}`,
      pasien: s.kunjungan?.pasien?.namaLengkap || '-',
      noRM: s.kunjungan?.pasien?.noRM || '-',
      poli: s.kunjungan?.poliklinik?.namaPoli || 'Ruang Skrining'
    });
  });

  // Urutkan aktivitas log terbaru di atas
  activityLogs.sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  // Rekap daftar kinerja tenaga medis
  const rekapKinerjaList = Object.values(kinerjaMap);

  // Smart sort: nakes yang paling banyak melayani di paling atas
  rekapKinerjaList.sort((a, b) => {
    if (a.adaTransaksi !== b.adaTransaksi) {
      return a.adaTransaksi ? -1 : 1;
    }
    if (b.totalAktivitas !== a.totalAktivitas) {
      return b.totalAktivitas - a.totalAktivitas;
    }
    return a.nama.localeCompare(b.nama);
  });

  // DEFAULT: HANYA TAMPILKAN TENAGA MEDIS YANG BENAR-BENAR MELAYANI / ADA KINERJA DI PERIODE INI
  let filteredList = rekapKinerjaList.filter(k => k.adaTransaksi);

  if (filterMode === 'semua') {
    filteredList = rekapKinerjaList;
  }

  const totalNakesTerdaftar = nakesList.length;
  const nakesAktifCount = rekapKinerjaList.filter(k => k.adaTransaksi).length;
  const totalLayananKlinis = activityLogs.length;
  const totalPemeriksaanRme = rmeList.length;
  const totalTindakanMedis = tindakanList.length;
  const totalResepDiterbitkan = resepList.length;
  const totalSkriningPerawat = screeningList.length;

  return {
    rentangTanggal: { start: start.toISOString(), end: end.toISOString() },
    ringkasan: {
      totalNakesTerdaftar,
      nakesAktifCount,
      totalLayananKlinis,
      totalPemeriksaanRme,
      totalTindakanMedis,
      totalResepDiterbitkan,
      totalSkriningPerawat
    },
    daftarKinerjaNakes: filteredList,
    logAktivitasNakes: activityLogs
  };
};

module.exports = {
  getLaporanKunjungan,
  getLaporanMorbiditas,
  getLaporanBMHP,
  getLaporanAlkes,
  getLaporanKinerjaNakes
};
