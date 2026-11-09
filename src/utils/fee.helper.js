const prisma = require('../config/prisma');

/**
 * Dapatkan atau buat tarif default untuk faskes jika belum ada
 * Menggunakan upsert atomik untuk mencegah race condition (unique constraint collision)
 */
const getOrCreateMasterTarif = async (faskesId) => {
  if (!faskesId) {
    return {
      feeKehadiranDokter: 150000,
      feeKehadiranPerawat: 75000,
      feePerPasienDokter: 15000,
      feePerTindakanDokter: 20000,
    };
  }

  try {
    return await prisma.masterTarifFee.upsert({
      where: { faskesId },
      update: {},
      create: {
        faskesId,
        feeKehadiranDokter: 150000,
        feeKehadiranPerawat: 75000,
        feePerPasienDokter: 15000,
        feePerTindakanDokter: 20000,
        statusAktif: true,
      },
    });
  } catch (err) {
    // Fallback jika terjadi race condition konkuren saat create bersamaan
    const existing = await prisma.masterTarifFee.findUnique({
      where: { faskesId },
    });
    if (existing) return existing;
    throw err;
  }
};

/**
 * Catat Fee Penanganan Pasien untuk Dokter yang memeriksa
 * Dijalankan otomatis saat kunjungan / pemeriksaan dokter diselesaikan
 */
const catatFeePenangananDokter = async (kunjunganId, dokterId = null) => {
  try {
    const kunjungan = await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: {
        pasien: true,
        rekamMedis: true,
      },
    });

    if (!kunjungan) return null;

    // Tentukan dokter yang menangani
    const targetDokterId = dokterId || kunjungan.rekamMedis?.dokterId || kunjungan.dokterTujuanId;
    if (!targetDokterId) return null;

    // Pastikan user adalah dokter
    const dokterUser = await prisma.user.findUnique({
      where: { id: targetDokterId },
      select: { id: true, role: true, faskesId: true },
    });

    if (!dokterUser || !['DOKTER', 'DOKTER_UGD'].includes(dokterUser.role)) {
      return null;
    }

    const targetFaskesId = kunjungan.faskesId || dokterUser.faskesId;
    const tarif = await getOrCreateMasterTarif(targetFaskesId);

    const nominalFee = tarif.feePerPasienDokter || 15000;
    const namaPasien = kunjungan.pasien?.namaLengkap || 'Pasien';
    const noRM = kunjungan.pasien?.noRM || null;
    const jenisLayanan = kunjungan.jenisPelayanan === 'UGD' ? 'UGD' : (kunjungan.jenisPelayanan === 'Rawat Inap' ? 'RAWAT_INAP' : 'RAWAT_JALAN');

    // Upsert LogFeeDokter
    const feeRecord = await prisma.logFeeDokter.upsert({
      where: {
        dokterId_kunjunganId: {
          dokterId: targetDokterId,
          kunjunganId: kunjungan.id,
        },
      },
      update: {
        nominalFee,
        namaPasien,
        noRM,
        jenisLayanan,
      },
      create: {
        faskesId: targetFaskesId,
        dokterId: targetDokterId,
        kunjunganId: kunjungan.id,
        tanggalPelayanan: kunjungan.waktuPemeriksaanSelesai || new Date(),
        jenisLayanan,
        namaPasien,
        noRM,
        nominalFee,
        statusPembayaran: 'PENDING',
      },
    });

    // Otomatis verifikasi kehadiran dokter pada hari ini jika belum ada presensi
    await autoCheckInDokterIfMissing(targetDokterId, targetFaskesId, kunjungan.tanggalRegistrasi || new Date());

    return feeRecord;
  } catch (error) {
    console.error('[Fee Helper Error] Gagal mencatat fee dokter:', error);
    return null;
  }
};

const getShiftByTime = (d = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const hour = parseInt(formatter.format(d), 10);
  if (hour >= 7 && hour < 14) return 'PAGI';
  if (hour >= 14 && hour < 21) return 'SIANG';
  return 'MALAM';
};

const getDateOnlyWib = (d = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
  const dateStr = formatter.format(d);
  return new Date(`${dateStr}T00:00:00.000Z`);
};

/**
 * Otomatis check-in kehadiran Nakes (Dokter atau Perawat) jika belum presensi pada shift saat ini
 */
const autoCheckInNakesIfMissing = async (userId, faskesId, profesi = 'PERAWAT', customDate = new Date(), actionNote = '') => {
  try {
    if (!userId) return null;

    const d = new Date(customDate);
    const dateOnly = getDateOnlyWib(d);
    const shift = getShiftByTime(d);

    let targetFaskesId = faskesId;
    let targetProfesi = profesi;

    if (!targetFaskesId || !targetProfesi) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, faskesId: true },
      });
      if (!user) return null;
      if (!targetFaskesId) targetFaskesId = user.faskesId;
      if (!targetProfesi) {
        targetProfesi = ['DOKTER', 'DOKTER_UGD'].includes(user.role) ? 'DOKTER' : 'PERAWAT';
      }
    }

    const existing = await prisma.presensiNakes.findUnique({
      where: {
        userId_tanggal_shift: {
          userId,
          tanggal: dateOnly,
          shift,
        },
      },
    });

    if (!existing) {
      const tarif = await getOrCreateMasterTarif(targetFaskesId);
      const isDokter = targetProfesi === 'DOKTER';
      const nominalFee = isDokter ? (tarif.feeKehadiranDokter || 150000) : (tarif.feeKehadiranPerawat || 75000);

      const defaultNote = isDokter
        ? `Presensi otomatis terdeteksi saat melayani pemeriksaan pasien (Shift ${shift})`
        : `Presensi otomatis terdeteksi saat melakukan skrining / asuhan pasien (Shift ${shift})`;

      const presensi = await prisma.presensiNakes.create({
        data: {
          faskesId: targetFaskesId,
          userId,
          profesi: targetProfesi,
          tanggal: dateOnly,
          shift,
          jamMasuk: d,
          statusKehadiran: 'HADIR',
          statusVerifikasi: 'VERIFIED',
          catatan: actionNote || defaultNote,
          nominalFee,
          statusPembayaran: 'PENDING',
        },
      });

      console.log(`[Auto Check-In] Berhasil check-in otomatis untuk ${targetProfesi} (User: ${userId}, Shift: ${shift}, Tanggal: ${dateOnly.toISOString().split('T')[0]})`);
      return presensi;
    }

    return existing;
  } catch (err) {
    console.warn(`[Auto Presensi ${profesi}]`, err.message);
    return null;
  }
};

/**
 * Otomatis check-in kehadiran dokter jika dokter menangani pasien hari ini tapi belum presensi
 */
const autoCheckInDokterIfMissing = async (dokterId, faskesId, tanggalDate = new Date(), note = '') => {
  return await autoCheckInNakesIfMissing(dokterId, faskesId, 'DOKTER', tanggalDate, note);
};

/**
 * Otomatis check-in kehadiran perawat jika perawat melakukan skrining / triase tapi belum presensi
 */
const autoCheckInPerawatIfMissing = async (perawatId, faskesId, tanggalDate = new Date(), note = '') => {
  return await autoCheckInNakesIfMissing(perawatId, faskesId, 'PERAWAT', tanggalDate, note);
};

module.exports = {
  getOrCreateMasterTarif,
  catatFeePenangananDokter,
  autoCheckInNakesIfMissing,
  autoCheckInDokterIfMissing,
  autoCheckInPerawatIfMissing,
  getShiftByTime,
  getDateOnlyWib,
};

