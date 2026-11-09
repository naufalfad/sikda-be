const prisma = require('../config/prisma');
const { applyFaskesScope, getEffectiveFaskesId } = require('../utils/tenantScope');
const { getOrCreateMasterTarif, catatFeePenangananDokter } = require('../utils/fee.helper');

/**
 * Format string tanggal (YYYY-MM-DD) menjadi Date object UTC murni
 */
const parseDateOnly = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  }
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

/**
 * 1. Ambil Pengaturan Master Tarif Fee Faskes
 */
const getMasterTarif = async (user) => {
  const faskesId = getEffectiveFaskesId(user);
  return await getOrCreateMasterTarif(faskesId);
};

/**
 * 2. Perbarui Pengaturan Master Tarif Fee Faskes
 */
const updateMasterTarif = async (user, data) => {
  const faskesId = getEffectiveFaskesId(user);
  if (!faskesId) {
    throw new Error('Fasilitas kesehatan (faskesId) tidak valid');
  }

  const {
    feeKehadiranDokter,
    feeKehadiranPerawat,
    feePerPasienDokter,
    feePerTindakanDokter,
    statusAktif,
    keterangan,
  } = data;

  return await prisma.masterTarifFee.upsert({
    where: { faskesId },
    update: {
      feeKehadiranDokter: feeKehadiranDokter !== undefined ? Number(feeKehadiranDokter) : undefined,
      feeKehadiranPerawat: feeKehadiranPerawat !== undefined ? Number(feeKehadiranPerawat) : undefined,
      feePerPasienDokter: feePerPasienDokter !== undefined ? Number(feePerPasienDokter) : undefined,
      feePerTindakanDokter: feePerTindakanDokter !== undefined ? Number(feePerTindakanDokter) : undefined,
      statusAktif: statusAktif !== undefined ? Boolean(statusAktif) : undefined,
      keterangan: keterangan !== undefined ? keterangan : undefined,
    },
    create: {
      faskesId,
      feeKehadiranDokter: Number(feeKehadiranDokter) || 150000,
      feeKehadiranPerawat: Number(feeKehadiranPerawat) || 75000,
      feePerPasienDokter: Number(feePerPasienDokter) || 15000,
      feePerTindakanDokter: Number(feePerTindakanDokter) || 20000,
      statusAktif: statusAktif !== undefined ? Boolean(statusAktif) : true,
      keterangan,
    },
  });
};

/**
 * 3. Presensi Mandiri (Clock-In) untuk Dokter & Perawat
 */
const checkInMandiri = async (user, { shift = 'PAGI', catatan = '' } = {}) => {
  const isDokter = ['DOKTER', 'DOKTER_UGD'].includes(user.role);
  const isPerawat = user.role === 'PERAWAT';

  if (!isDokter && !isPerawat) {
    throw new Error('Hanya Dokter dan Perawat yang berhak melakukan presensi fee nakes');
  }

  const faskesId = user.faskesId;
  if (!faskesId) {
    throw new Error('User belum terasosiasi dengan faskes manapun');
  }

  const profesi = isDokter ? 'DOKTER' : 'PERAWAT';
  const now = new Date();
  const dateOnly = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const tarif = await getOrCreateMasterTarif(faskesId);
  const nominalFee = isDokter ? tarif.feeKehadiranDokter : tarif.feeKehadiranPerawat;

  return await prisma.presensiNakes.upsert({
    where: {
      userId_tanggal_shift: {
        userId: user.id,
        tanggal: dateOnly,
        shift: shift.toUpperCase(),
      },
    },
    update: {
      statusKehadiran: 'HADIR',
      statusVerifikasi: 'VERIFIED',
      nominalFee,
      catatan: catatan || undefined,
    },
    create: {
      faskesId,
      userId: user.id,
      profesi,
      tanggal: dateOnly,
      shift: shift.toUpperCase(),
      jamMasuk: now,
      statusKehadiran: 'HADIR',
      statusVerifikasi: 'VERIFIED',
      catatan: catatan || 'Presensi Mandiri',
      nominalFee,
      statusPembayaran: 'PENDING',
    },
    include: {
      user: {
        select: { id: true, namaLengkap: true, username: true, role: true },
      },
    },
  });
};

/**
 * 4. Ambil Status Presensi Hari Ini untuk User Login
 */
const getTodayPresensi = async (user) => {
  const now = new Date();
  const dateOnly = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const records = await prisma.presensiNakes.findMany({
    where: {
      userId: user.id,
      tanggal: dateOnly,
    },
    orderBy: { jamMasuk: 'desc' },
  });

  return {
    tanggal: dateOnly.toISOString().split('T')[0],
    presensi: records,
    hasCheckedIn: records.some(r => r.statusKehadiran === 'HADIR'),
  };
};

/**
 * 5. Input Presensi Manual oleh Admin (Admin / Loket)
 */
const adminInputPresensi = async (currentUser, data) => {
  const {
    userId,
    tanggal,
    shift = 'PAGI',
    statusKehadiran = 'HADIR',
    statusVerifikasi = 'VERIFIED',
    catatan,
    nominalFee,
  } = data;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, faskesId: true, namaLengkap: true },
  });

  if (!targetUser) {
    throw new Error('User tenaga medis tidak ditemukan');
  }

  const isDokter = ['DOKTER', 'DOKTER_UGD'].includes(targetUser.role);
  const isPerawat = targetUser.role === 'PERAWAT';

  if (!isDokter && !isPerawat) {
    throw new Error('User yang dipilih bukan dokter atau perawat');
  }

  const profesi = isDokter ? 'DOKTER' : 'PERAWAT';
  const faskesId = targetUser.faskesId || currentUser.faskesId;
  const dateOnly = parseDateOnly(tanggal) || parseDateOnly(new Date().toISOString().split('T')[0]);

  let feeAmount = 0;
  if (statusKehadiran === 'HADIR') {
    if (nominalFee !== undefined && nominalFee !== null && nominalFee !== '') {
      feeAmount = Number(nominalFee);
    } else {
      const tarif = await getOrCreateMasterTarif(faskesId);
      feeAmount = isDokter ? tarif.feeKehadiranDokter : tarif.feeKehadiranPerawat;
    }
  }

  return await prisma.presensiNakes.upsert({
    where: {
      userId_tanggal_shift: {
        userId: targetUser.id,
        tanggal: dateOnly,
        shift: shift.toUpperCase(),
      },
    },
    update: {
      statusKehadiran,
      statusVerifikasi,
      nominalFee: feeAmount,
      catatan,
    },
    create: {
      faskesId,
      userId: targetUser.id,
      profesi,
      tanggal: dateOnly,
      shift: shift.toUpperCase(),
      jamMasuk: new Date(),
      statusKehadiran,
      statusVerifikasi,
      catatan,
      nominalFee: feeAmount,
      statusPembayaran: 'PENDING',
    },
    include: {
      user: {
        select: { id: true, namaLengkap: true, username: true, role: true },
      },
    },
  });
};

/**
 * 6. Hapus Presensi
 */
const deletePresensi = async (currentUser, id) => {
  const where = { id };
  applyFaskesScope(where, currentUser);
  return await prisma.presensiNakes.delete({ where });
};

/**
 * 7. Daftar Riwayat Presensi
 */
const getPresensiList = async (user, { tanggalAwal, tanggalAkhir, profesi, userId, statusKehadiran, statusPembayaran } = {}) => {
  const where = {};
  applyFaskesScope(where, user);

  if (profesi) where.profesi = profesi.toUpperCase();
  if (userId) where.userId = userId;
  if (statusKehadiran) where.statusKehadiran = statusKehadiran.toUpperCase();
  if (statusPembayaran) where.statusPembayaran = statusPembayaran.toUpperCase();

  if (tanggalAwal || tanggalAkhir) {
    where.tanggal = {};
    if (tanggalAwal) where.tanggal.gte = parseDateOnly(tanggalAwal);
    if (tanggalAkhir) where.tanggal.lte = parseDateOnly(tanggalAkhir);
  }

  return await prisma.presensiNakes.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          namaLengkap: true,
          username: true,
          role: true,
          poliklinik: { select: { id: true, namaPoli: true } },
        },
      },
      faskes: { select: { id: true, namaFaskes: true } },
    },
    orderBy: [
      { tanggal: 'desc' },
      { jamMasuk: 'desc' },
    ],
  });
};

/**
 * 8. Rekapitulasi Doctor Fee (Fee Kehadiran + Fee Penanganan Pasien)
 */
const getRekapFeeDokter = async (user, { tanggalAwal, tanggalAkhir, dokterId } = {}) => {
  const faskesId = getEffectiveFaskesId(user);

  // 1. Ambil daftar dokter
  const doctorWhere = {
    role: { in: ['DOKTER', 'DOKTER_UGD'] },
  };
  if (faskesId) doctorWhere.faskesId = faskesId;
  if (dokterId) doctorWhere.id = dokterId;

  const doctors = await prisma.user.findMany({
    where: doctorWhere,
    select: {
      id: true,
      namaLengkap: true,
      username: true,
      role: true,
      poliklinik: { select: { id: true, namaPoli: true } },
    },
    orderBy: { namaLengkap: 'asc' },
  });

  const parsedAwal = tanggalAwal ? parseDateOnly(tanggalAwal) : null;
  const parsedAkhir = tanggalAkhir ? parseDateOnly(tanggalAkhir) : null;

  // 2. Query presensi dokter
  const presensiWhere = {
    profesi: 'DOKTER',
  };
  if (faskesId) presensiWhere.faskesId = faskesId;
  if (dokterId) presensiWhere.userId = dokterId;
  if (parsedAwal || parsedAkhir) {
    presensiWhere.tanggal = {};
    if (parsedAwal) presensiWhere.tanggal.gte = parsedAwal;
    if (parsedAkhir) presensiWhere.tanggal.lte = parsedAkhir;
  }

  const allPresensi = await prisma.presensiNakes.findMany({
    where: presensiWhere,
    orderBy: { tanggal: 'desc' },
  });

  // 3. Query fee penanganan pasien dokter
  const logFeeWhere = {};
  if (faskesId) logFeeWhere.faskesId = faskesId;
  if (dokterId) logFeeWhere.dokterId = dokterId;
  if (parsedAwal || parsedAkhir) {
    logFeeWhere.tanggalPelayanan = {};
    if (parsedAwal) logFeeWhere.tanggalPelayanan.gte = new Date(parsedAwal.setHours(0, 0, 0, 0));
    if (parsedAkhir) logFeeWhere.tanggalPelayanan.lte = new Date(parsedAkhir.setHours(23, 59, 59, 999));
  }

  const allLogFee = await prisma.logFeeDokter.findMany({
    where: logFeeWhere,
    include: {
      kunjungan: {
        select: {
          id: true,
          noAntrian: true,
          jenisPelayanan: true,
          statusKunjungan: true,
          poliklinik: { select: { namaPoli: true } },
        },
      },
    },
    orderBy: { tanggalPelayanan: 'desc' },
  });

  // 4. Agregasi per dokter
  let grandTotalKehadiran = 0;
  let grandTotalPenanganan = 0;
  let grandTotalPasien = 0;

  const result = doctors.map((doc) => {
    const docPresensi = allPresensi.filter(p => p.userId === doc.id);
    const docLogs = allLogFee.filter(l => l.dokterId === doc.id);

    const hadirPresensi = docPresensi.filter(p => p.statusKehadiran === 'HADIR');
    const totalFeeKehadiran = hadirPresensi.reduce((sum, p) => sum + p.nominalFee, 0);

    const totalFeePenanganan = docLogs.reduce((sum, l) => sum + l.nominalFee, 0);
    const totalFeeKumulatif = totalFeeKehadiran + totalFeePenanganan;

    const unpaidKehadiran = hadirPresensi.filter(p => p.statusPembayaran === 'PENDING').reduce((s, p) => s + p.nominalFee, 0);
    const unpaidPenanganan = docLogs.filter(l => l.statusPembayaran === 'PENDING').reduce((s, l) => s + l.nominalFee, 0);
    const totalBelumDibayar = unpaidKehadiran + unpaidPenanganan;
    const totalSudahDibayar = totalFeeKumulatif - totalBelumDibayar;

    grandTotalKehadiran += totalFeeKehadiran;
    grandTotalPenanganan += totalFeePenanganan;
    grandTotalPasien += docLogs.length;

    return {
      dokter: doc,
      kehadiran: {
        totalHadir: hadirPresensi.length,
        totalFee: totalFeeKehadiran,
        daftarPresensi: docPresensi,
      },
      penangananPasien: {
        totalPasien: docLogs.length,
        totalFee: totalFeePenanganan,
        daftarPasien: docLogs,
      },
      rekap: {
        totalFeeKehadiran,
        totalFeePenanganan,
        totalFeeKumulatif,
        totalBelumDibayar,
        totalSudahDibayar,
      },
    };
  });

  return {
    periode: {
      tanggalAwal: tanggalAwal || 'Semua',
      tanggalAkhir: tanggalAkhir || 'Semua',
    },
    ringkasan: {
      totalDokter: doctors.length,
      totalPasienDitangani: grandTotalPasien,
      totalFeeKehadiran: grandTotalKehadiran,
      totalFeePenanganan: grandTotalPenanganan,
      grandTotalFeeDokter: grandTotalKehadiran + grandTotalPenanganan,
    },
    dokterList: result,
  };
};

/**
 * 9. Rekapitulasi Fee Perawat (Fee Kehadiran Saja!)
 */
const getRekapFeePerawat = async (user, { tanggalAwal, tanggalAkhir, perawatId } = {}) => {
  const faskesId = getEffectiveFaskesId(user);

  // 1. Ambil daftar perawat
  const nurseWhere = {
    role: 'PERAWAT',
  };
  if (faskesId) nurseWhere.faskesId = faskesId;
  if (perawatId) nurseWhere.id = perawatId;

  const nurses = await prisma.user.findMany({
    where: nurseWhere,
    select: {
      id: true,
      namaLengkap: true,
      username: true,
      role: true,
      poliklinik: { select: { id: true, namaPoli: true } },
    },
    orderBy: { namaLengkap: 'asc' },
  });

  const parsedAwal = tanggalAwal ? parseDateOnly(tanggalAwal) : null;
  const parsedAkhir = tanggalAkhir ? parseDateOnly(tanggalAkhir) : null;

  // 2. Query presensi perawat
  const presensiWhere = {
    profesi: 'PERAWAT',
  };
  if (faskesId) presensiWhere.faskesId = faskesId;
  if (perawatId) presensiWhere.userId = perawatId;
  if (parsedAwal || parsedAkhir) {
    presensiWhere.tanggal = {};
    if (parsedAwal) presensiWhere.tanggal.gte = parsedAwal;
    if (parsedAkhir) presensiWhere.tanggal.lte = parsedAkhir;
  }

  const allPresensi = await prisma.presensiNakes.findMany({
    where: presensiWhere,
    orderBy: { tanggal: 'desc' },
  });

  let grandTotalKehadiran = 0;
  let grandTotalShift = 0;

  const result = nurses.map((nurse) => {
    const nursePresensi = allPresensi.filter(p => p.userId === nurse.id);
    const hadirPresensi = nursePresensi.filter(p => p.statusKehadiran === 'HADIR');
    const totalFeeKehadiran = hadirPresensi.reduce((sum, p) => sum + p.nominalFee, 0);

    const unpaidKehadiran = hadirPresensi.filter(p => p.statusPembayaran === 'PENDING').reduce((s, p) => s + p.nominalFee, 0);
    const totalSudahDibayar = totalFeeKehadiran - unpaidKehadiran;

    grandTotalKehadiran += totalFeeKehadiran;
    grandTotalShift += hadirPresensi.length;

    return {
      perawat: nurse,
      kehadiran: {
        totalHadir: hadirPresensi.length,
        totalFee: totalFeeKehadiran,
        daftarPresensi: nursePresensi,
      },
      // Perawat hanya fee kehadiran
      rekap: {
        totalFeeKehadiran,
        totalFeeKumulatif: totalFeeKehadiran,
        totalBelumDibayar: unpaidKehadiran,
        totalSudahDibayar,
      },
    };
  });

  return {
    periode: {
      tanggalAwal: tanggalAwal || 'Semua',
      tanggalAkhir: tanggalAkhir || 'Semua',
    },
    ringkasan: {
      totalPerawat: nurses.length,
      totalShiftHadir: grandTotalShift,
      grandTotalFeePerawat: grandTotalKehadiran,
    },
    perawatList: result,
  };
};

/**
 * 10. Dashboard Summary & Metrik Eksekutif Remunerasi Nakes
 */
const getDashboardSummary = async (user, { bulan, tahun } = {}) => {
  const faskesId = getEffectiveFaskesId(user);
  const now = new Date();
  const selectedYear = tahun ? parseInt(tahun, 10) : now.getFullYear();
  const selectedMonth = bulan ? parseInt(bulan, 10) - 1 : now.getMonth();

  const startOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 1));
  const endOfMonth = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));

  // Presensi bulan ini
  const presensiWhere = {
    tanggal: { gte: startOfMonth, lte: endOfMonth },
    statusKehadiran: 'HADIR',
  };
  if (faskesId) presensiWhere.faskesId = faskesId;

  const presensis = await prisma.presensiNakes.findMany({ where: presensiWhere });

  const totalFeeDokterKehadiran = presensis
    .filter(p => p.profesi === 'DOKTER')
    .reduce((s, p) => s + p.nominalFee, 0);

  const totalFeePerawatKehadiran = presensis
    .filter(p => p.profesi === 'PERAWAT')
    .reduce((s, p) => s + p.nominalFee, 0);

  // Fee penanganan pasien bulan ini
  const feePasienWhere = {
    tanggalPelayanan: { gte: startOfMonth, lte: endOfMonth },
  };
  if (faskesId) feePasienWhere.faskesId = faskesId;

  const feesPasien = await prisma.logFeeDokter.findMany({ where: feePasienWhere });
  const totalFeeDokterPenanganan = feesPasien.reduce((s, f) => s + f.nominalFee, 0);

  const totalFeeDokter = totalFeeDokterKehadiran + totalFeeDokterPenanganan;
  const totalFeePerawat = totalFeePerawatKehadiran;
  const grandTotal = totalFeeDokter + totalFeePerawat;

  const tarif = await getOrCreateMasterTarif(faskesId);

  return {
    periode: {
      bulan: selectedMonth + 1,
      tahun: selectedYear,
    },
    tarifAktif: tarif,
    metrik: {
      totalFeeDokter,
      totalFeeDokterKehadiran,
      totalFeeDokterPenanganan,
      totalPasienDitangani: feesPasien.length,
      totalFeePerawat,
      totalShiftPerawatHadir: presensis.filter(p => p.profesi === 'PERAWAT').length,
      grandTotalRemunerasi: grandTotal,
    },
  };
};

/**
 * 11. Pelunasan / Tandai Dibayar Fee Tenaga Medis
 */
const bayarFeeNakes = async (user, { presensiIds = [], feeDokterIds = [] } = {}) => {
  const now = new Date();
  let updatedPresensi = 0;
  let updatedFeeDokter = 0;

  if (presensiIds.length > 0) {
    const res = await prisma.presensiNakes.updateMany({
      where: { id: { in: presensiIds } },
      data: {
        statusPembayaran: 'DIBAYAR',
        tanggalBayar: now,
      },
    });
    updatedPresensi = res.count;
  }

  if (feeDokterIds.length > 0) {
    const res = await prisma.logFeeDokter.updateMany({
      where: { id: { in: feeDokterIds } },
      data: {
        statusPembayaran: 'DIBAYAR',
        tanggalBayar: now,
      },
    });
    updatedFeeDokter = res.count;
  }

  return {
    success: true,
    updatedPresensi,
    updatedFeeDokter,
    tanggalBayar: now,
  };
};

/**
 * 12. Sinkronisasi Kunjungan Selesai ke Log Fee Dokter (Backfill / Sync On Demand)
 */
const syncKunjunganToFeeDokter = async (user, { tanggalAwal, tanggalAkhir } = {}) => {
  const faskesId = getEffectiveFaskesId(user);
  const where = {
    OR: [
      { statusKunjungan: { in: ['SELESAI', 'MENUNGGU_KASIR', 'MENUNGGU_FARMASI', 'PULANG'] } },
      { rekamMedis: { statusPemeriksaan: 'SELESAI' } },
    ],
  };
  if (faskesId) where.faskesId = faskesId;

  if (tanggalAwal || tanggalAkhir) {
    where.tanggalRegistrasi = {};
    if (tanggalAwal) where.tanggalRegistrasi.gte = new Date(`${tanggalAwal}T00:00:00.000Z`);
    if (tanggalAkhir) where.tanggalRegistrasi.lte = new Date(`${tanggalAkhir}T23:59:59.999Z`);
  }

  const visits = await prisma.kunjungan.findMany({
    where,
    select: { id: true, dokterTujuanId: true, rekamMedis: { select: { dokterId: true } } },
  });

  let syncedCount = 0;
  for (const v of visits) {
    const docId = v.rekamMedis?.dokterId || v.dokterTujuanId;
    if (docId) {
      const res = await catatFeePenangananDokter(v.id, docId);
      if (res) syncedCount++;
    }
  }

  return {
    totalKunjunganDitemukan: visits.length,
    totalDisinkronkan: syncedCount,
  };
};

module.exports = {
  getMasterTarif,
  updateMasterTarif,
  checkInMandiri,
  getTodayPresensi,
  adminInputPresensi,
  deletePresensi,
  getPresensiList,
  getRekapFeeDokter,
  getRekapFeePerawat,
  getDashboardSummary,
  bayarFeeNakes,
  syncKunjunganToFeeDokter,
};

