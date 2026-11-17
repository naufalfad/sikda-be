const prisma = require('../config/prisma');
const { applyFaskesScope, getEffectiveFaskesId } = require('../utils/tenantScope');

const HARI_MAP = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

/**
 * Format string tanggal (YYYY-MM-DD) menjadi Date object UTC murni
 */
const parseDateOnly = (dateStr) => {
  if (!dateStr) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  }
  const d = new Date(cleanStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

/**
 * Dapatkan nama hari dalam Bahasa Indonesia (SENIN - MINGGU) berdasarkan Date object atau string YYYY-MM-DD
 */
const getHariFromDate = (dateInput) => {
  const d = parseDateOnly(dateInput);
  return HARI_MAP[d.getUTCDay()];
};

/**
 * Evaluasi status keaktifan shift dokter berdasarkan jam saat ini / jam registrasi
 * @param {string} currentTimeStr - Format HH:mm (misal '09:30')
 * @param {string} jamMulaiStr - Format HH:mm (misal '08:00')
 * @param {string} jamSelesaiStr - Format HH:mm (misal '14:00')
 * @param {number} bufferBeforeMinutes - Toleransi buka antrean sebelum shift dimulai (default 60 menit)
 */
const evaluateShiftStatus = (currentTimeStr, jamMulaiStr, jamSelesaiStr, bufferBeforeMinutes = 60) => {
  if (!currentTimeStr || !jamMulaiStr || !jamSelesaiStr) {
    return { isAktif: true, status: 'AKTIF', keterangan: 'Jadwal Reguler' };
  }

  const toMinutes = (timeStr) => {
    const parts = String(timeStr).split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  };

  const current = toMinutes(currentTimeStr);
  const start = toMinutes(jamMulaiStr);
  const startWithBuffer = start - bufferBeforeMinutes;
  const end = toMinutes(jamSelesaiStr);

  const isOvernight = end < start;

  if (isOvernight) {
    // Shift malam melewati tengah malam (misal 20:00 - 07:00)
    const isAktif = current >= startWithBuffer || current <= end;
    if (isAktif) {
      return { isAktif: true, status: 'AKTIF', keterangan: 'Sedang Bertugas' };
    }
    return { isAktif: false, status: 'BELUM_DIMULAI', keterangan: `Mulai Pukul ${jamMulaiStr}` };
  } else {
    // Shift normal 1 hari (misal 08:00 - 14:00)
    if (current < startWithBuffer) {
      return { isAktif: false, status: 'BELUM_DIMULAI', keterangan: `Belum Dimulai (Mulai ${jamMulaiStr})` };
    } else if (current > end) {
      return { isAktif: false, status: 'SELESAI', keterangan: `Shift Selesai (${jamSelesaiStr})` };
    } else {
      return { isAktif: true, status: 'AKTIF', keterangan: 'Sedang Bertugas' };
    }
  }
};

const jadwalNakesService = {
  getHariFromDate,
  parseDateOnly,
  evaluateShiftStatus,

  /**
   * 1. Query Dokter Bertugas berdasarkan Poliklinik & Tanggal Tertentu
   * Digunakan oleh Loket Pendaftaran / Antrean Pasien
   */
  getDokterBertugasByPoli: async (poliklinikId, tanggalStr, user = null, requestedFaskesId = null, hanyaBertugas = false, jamStr = null) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, requestedFaskesId);
    const targetDate = parseDateOnly(tanggalStr);
    const hari = getHariFromDate(tanggalStr);

    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cleanTargetDate = String(tanggalStr || todayYmd).split('T')[0];
    const isTargetToday = cleanTargetDate === todayYmd;

    // Evaluasi waktu: jika tanggalStr adalah hari ini, gunakan jamStr atau waktu server saat ini (HH:mm)
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const evalTime = isTargetToday ? (jamStr || nowTimeStr) : null;

    // Ambil semua dokter di poli tersebut (atau yang memiliki relasi / penugasan faskes)
    const dokterWhere = {
      role: { in: ['DOKTER', 'DOKTER_UGD'] },
      poliklinikId: poliklinikId,
    };
    if (effectiveFaskesId) {
      dokterWhere.faskesId = effectiveFaskesId;
    }

    const doktersInPoli = await prisma.user.findMany({
      where: dokterWhere,
      select: {
        id: true,
        username: true,
        namaLengkap: true,
        role: true,
        poliklinikId: true,
        faskesId: true,
        tenagaMedis: {
          select: {
            nik: true,
            noIHS: true,
            nomorSip: true,
            spesialis: true,
          },
        },
        jadwalNakes: {
          where: {
            hari: hari,
            statusAktif: true,
            poliklinikId: poliklinikId,
          },
        },
        izinCutiNakes: {
          where: {
            statusPersetujuan: 'DISETUJUI',
            tanggalMulai: { lte: targetDate },
            tanggalSelesai: { gte: targetDate },
          },
          include: {
            pengganti: {
              select: {
                id: true,
                username: true,
                namaLengkap: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: [
        { namaLengkap: 'asc' },
        { username: 'asc' },
      ],
    });

    // Cari juga apakah ada dokter pengganti yang ditugaskan ke poli ini karena dokter aslinya cuti
    const penggantiCuti = await prisma.izinCutiNakes.findMany({
      where: {
        statusPersetujuan: 'DISETUJUI',
        tanggalMulai: { lte: targetDate },
        tanggalSelesai: { gte: targetDate },
        penggantiId: { not: null },
        user: {
          poliklinikId: poliklinikId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
          },
        },
        pengganti: {
          select: {
            id: true,
            username: true,
            namaLengkap: true,
            role: true,
            poliklinikId: true,
            faskesId: true,
            tenagaMedis: {
              select: {
                nik: true,
                noIHS: true,
                nomorSip: true,
                spesialis: true,
              },
            },
          },
        },
      },
    });

    // Proses status bertugas setiap dokter
    const resultList = [];
    const processedUserIds = new Set();

    for (const doc of doktersInPoli) {
      processedUserIds.add(doc.id);
      const activeCuti = doc.izinCutiNakes && doc.izinCutiNakes.length > 0 ? doc.izinCutiNakes[0] : null;
      const activeJadwal = doc.jadwalNakes && doc.jadwalNakes.length > 0 ? doc.jadwalNakes[0] : null;

      let isBertugasHariIni = false;
      let isShiftAktifSaatIni = true;
      let shiftStatus = 'LIBUR';
      let statusKehadiran = 'LIBUR';
      let statusKeterangan = 'Tidak Ada Jadwal Hari Ini';
      let dokterPengganti = null;

      if (activeCuti) {
        isBertugasHariIni = false;
        isShiftAktifSaatIni = false;
        shiftStatus = 'CUTI';
        statusKehadiran = activeCuti.tipeIzin; // 'CUTI', 'IZIN', 'SAKIT', 'TUGAS_LUAR'
        statusKeterangan = `${activeCuti.tipeIzin}: ${activeCuti.keterangan || 'Sedang berhalangan hadir'}`;
        if (activeCuti.pengganti) {
          dokterPengganti = {
            id: activeCuti.pengganti.id,
            namaLengkap: activeCuti.pengganti.namaLengkap,
          };
          statusKeterangan += ` (Digantikan oleh ${activeCuti.pengganti.namaLengkap})`;
        }
      } else if (activeJadwal) {
        isBertugasHariIni = true;
        statusKehadiran = 'BERTUGAS';

        if (evalTime) {
          const evalRes = evaluateShiftStatus(evalTime, activeJadwal.jamMulai, activeJadwal.jamSelesai, 60);
          isShiftAktifSaatIni = evalRes.isAktif;
          shiftStatus = evalRes.status;

          if (shiftStatus === 'BELUM_DIMULAI') {
            statusKeterangan = `Shift ${activeJadwal.shift} (${activeJadwal.jamMulai} - ${activeJadwal.jamSelesai}) - Belum Dimulai`;
          } else if (shiftStatus === 'SELESAI') {
            statusKeterangan = `Shift ${activeJadwal.shift} (${activeJadwal.jamMulai} - ${activeJadwal.jamSelesai}) - Sudah Berakhir`;
          } else {
            statusKeterangan = `Sedang Bertugas (${activeJadwal.shift} ${activeJadwal.jamMulai} - ${activeJadwal.jamSelesai})`;
          }
        } else {
          isShiftAktifSaatIni = true;
          shiftStatus = 'AKTIF';
          statusKeterangan = `Bertugas (${activeJadwal.shift} ${activeJadwal.jamMulai} - ${activeJadwal.jamSelesai})`;
        }
      }

      resultList.push({
        id: doc.id,
        username: doc.username,
        namaLengkap: doc.namaLengkap,
        role: doc.role,
        poliklinikId: doc.poliklinikId,
        faskesId: doc.faskesId,
        tenagaMedis: doc.tenagaMedis,
        isBertugasHariIni,
        isShiftAktifSaatIni,
        shiftStatus,
        isPengganti: false,
        statusKehadiran,
        statusKeterangan,
        jadwalDetail: activeJadwal ? {
          id: activeJadwal.id,
          hari: activeJadwal.hari,
          shift: activeJadwal.shift,
          jamMulai: activeJadwal.jamMulai,
          jamSelesai: activeJadwal.jamSelesai,
          kuotaPasien: activeJadwal.kuotaPasien,
        } : null,
        cutiDetail: activeCuti ? {
          tipeIzin: activeCuti.tipeIzin,
          keterangan: activeCuti.keterangan,
          tanggalMulai: activeCuti.tanggalMulai,
          tanggalSelesai: activeCuti.tanggalSelesai,
          pengganti: dokterPengganti,
        } : null,
      });
    }

    // Masukkan dokter pengganti yang mungkin bukan staf default dari poli tersebut
    for (const c of penggantiCuti) {
      if (c.pengganti && !processedUserIds.has(c.pengganti.id)) {
        processedUserIds.add(c.pengganti.id);
        const evalRes = evalTime ? evaluateShiftStatus(evalTime, '08:00', '14:00', 60) : { isAktif: true, status: 'AKTIF' };
        resultList.push({
          id: c.pengganti.id,
          username: c.pengganti.username,
          namaLengkap: c.pengganti.namaLengkap,
          role: c.pengganti.role,
          poliklinikId: poliklinikId,
          faskesId: c.pengganti.faskesId,
          tenagaMedis: c.pengganti.tenagaMedis,
          isBertugasHariIni: true,
          isShiftAktifSaatIni: evalRes.isAktif,
          shiftStatus: evalRes.status,
          isPengganti: true,
          statusKehadiran: 'PENGGANTI',
          statusKeterangan: `Dokter Pengganti untuk ${c.user?.namaLengkap || 'Dokter Poliklinik'} (08:00 - 14:00)`,
          jadwalDetail: {
            shift: 'PAGI',
            jamMulai: '08:00',
            jamSelesai: '14:00',
            kuotaPasien: 40,
          },
          cutiDetail: null,
        });
      }
    }

    // Urutkan: yang sedang bertugas aktif diletakkan paling atas
    resultList.sort((a, b) => {
      if (a.isShiftAktifSaatIni !== b.isShiftAktifSaatIni) {
        return a.isShiftAktifSaatIni ? -1 : 1;
      }
      if (a.isBertugasHariIni !== b.isBertugasHariIni) {
        return a.isBertugasHariIni ? -1 : 1;
      }
      return (a.namaLengkap || '').localeCompare(b.namaLengkap || '');
    });

    const finalData = hanyaBertugas ? resultList.filter(d => d.isBertugasHariIni && (evalTime ? d.isShiftAktifSaatIni : true)) : resultList;

    return {
      hari,
      tanggal: cleanTargetDate,
      jamEvaluasi: evalTime,
      totalDokter: resultList.length,
      totalBertugas: resultList.filter(d => d.isBertugasHariIni).length,
      totalShiftAktif: resultList.filter(d => d.isBertugasHariIni && d.isShiftAktifSaatIni).length,
      dokters: finalData,
    };
  },

  /**
   * 2. Ambil Semua Jadwal / Roster Nakes (Admin / Modul Jadwal)
   */
  getJadwalList: async (user, filters = {}) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, filters.faskesId);
    const where = {};

    if (effectiveFaskesId) {
      where.faskesId = effectiveFaskesId;
    }
    if (filters.poliklinikId) {
      where.poliklinikId = filters.poliklinikId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.hari) {
      where.hari = filters.hari.toUpperCase();
    }
    if (filters.shift) {
      where.shift = filters.shift.toUpperCase();
    }
    if (filters.statusAktif !== undefined && filters.statusAktif !== '') {
      where.statusAktif = filters.statusAktif === 'true' || filters.statusAktif === true;
    }

    // Filter role user jika ada
    if (filters.role) {
      where.user = { role: filters.role };
    }

    return await prisma.jadwalNakes.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            namaLengkap: true,
            role: true,
          },
        },
        poliklinik: {
          select: {
            id: true,
            kodePoli: true,
            namaPoli: true,
          },
        },
        faskes: {
          select: {
            id: true,
            kodeFaskes: true,
            namaFaskes: true,
          },
        },
      },
      orderBy: [
        { hari: 'asc' },
        { jamMulai: 'asc' },
      ],
    });
  },

  /**
   * 3. Ambil Roster Mingguan Nakes Spesifik
   */
  getJadwalByUserId: async (userId, user = null) => {
    return await prisma.jadwalNakes.findMany({
      where: { userId },
      include: {
        poliklinik: {
          select: {
            id: true,
            kodePoli: true,
            namaPoli: true,
          },
        },
      },
      orderBy: [
        { hari: 'asc' },
        { shift: 'asc' },
      ],
    });
  },

  /**
   * 4. Buat atau Update Satuan Jadwal Roster
   */
  upsertJadwal: async (user, data) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, data.faskesId);

    // Validasi nakes
    const nakes = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, poliklinikId: true, faskesId: true },
    });
    if (!nakes) {
      throw new Error('Tenaga medis tidak ditemukan.');
    }

    const poliklinikId = data.poliklinikId || nakes.poliklinikId;
    const faskesId = effectiveFaskesId || nakes.faskesId;
    const hari = String(data.hari).toUpperCase();
    const shift = String(data.shift || 'PAGI').toUpperCase();

    // Cek apakah jadwal sudah ada untuk kombinasi userId, hari, shift, poliklinikId
    const existing = await prisma.jadwalNakes.findFirst({
      where: {
        userId: data.userId,
        hari,
        shift,
        poliklinikId,
      },
    });

    if (existing) {
      return await prisma.jadwalNakes.update({
        where: { id: existing.id },
        data: {
          jamMulai: data.jamMulai || existing.jamMulai,
          jamSelesai: data.jamSelesai || existing.jamSelesai,
          kuotaPasien: data.kuotaPasien !== undefined ? parseInt(data.kuotaPasien, 10) : existing.kuotaPasien,
          statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : existing.statusAktif,
          catatan: data.catatan !== undefined ? data.catatan : existing.catatan,
          faskesId,
        },
      });
    }

    return await prisma.jadwalNakes.create({
      data: {
        userId: data.userId,
        poliklinikId,
        faskesId,
        hari,
        shift,
        jamMulai: data.jamMulai || '08:00',
        jamSelesai: data.jamSelesai || '14:00',
        kuotaPasien: data.kuotaPasien !== undefined ? parseInt(data.kuotaPasien, 10) : 40,
        statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
        catatan: data.catatan || null,
      },
    });
  },

  /**
   * 5. Simpan Roster Mingguan Sekaligus (Bulk Matrix Roster)
   * data: { userId, poliklinikId, faskesId, roster: [{ hari, shift, jamMulai, jamSelesai, kuotaPasien, statusAktif }] }
   */
  saveBulkRoster: async (user, payload) => {
    const { userId, poliklinikId, roster } = payload;
    const effectiveFaskesId = getEffectiveFaskesId(user, payload.faskesId);

    const nakes = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, poliklinikId: true, faskesId: true },
    });
    if (!nakes) {
      throw new Error('Tenaga medis tidak ditemukan.');
    }

    const targetPoli = poliklinikId || nakes.poliklinikId;
    const targetFaskes = effectiveFaskesId || nakes.faskesId;

    if (!Array.isArray(roster)) {
      throw new Error('Data roster harus berupa array.');
    }

    const results = [];
    for (const item of roster) {
      const hari = String(item.hari).toUpperCase();
      const shift = String(item.shift || 'PAGI').toUpperCase();

      const existing = await prisma.jadwalNakes.findFirst({
        where: {
          userId,
          hari,
          shift,
          poliklinikId: targetPoli,
        },
      });

      if (existing) {
        const updated = await prisma.jadwalNakes.update({
          where: { id: existing.id },
          data: {
            jamMulai: item.jamMulai || existing.jamMulai,
            jamSelesai: item.jamSelesai || existing.jamSelesai,
            kuotaPasien: item.kuotaPasien !== undefined ? parseInt(item.kuotaPasien, 10) : existing.kuotaPasien,
            statusAktif: item.statusAktif !== undefined ? Boolean(item.statusAktif) : existing.statusAktif,
            catatan: item.catatan !== undefined ? item.catatan : existing.catatan,
            faskesId: targetFaskes,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.jadwalNakes.create({
          data: {
            userId,
            poliklinikId: targetPoli,
            faskesId: targetFaskes,
            hari,
            shift,
            jamMulai: item.jamMulai || '08:00',
            jamSelesai: item.jamSelesai || '14:00',
            kuotaPasien: item.kuotaPasien !== undefined ? parseInt(item.kuotaPasien, 10) : 40,
            statusAktif: item.statusAktif !== undefined ? Boolean(item.statusAktif) : true,
            catatan: item.catatan || null,
          },
        });
        results.push(created);
      }
    }

    return results;
  },

  /**
   * 6. Hapus Jadwal
   */
  deleteJadwal: async (user, id) => {
    return await prisma.jadwalNakes.delete({
      where: { id },
    });
  },

  /**
   * 7. Ambil Daftar Izin / Cuti Dinas Nakes
   */
  getIzinCutiList: async (user, filters = {}) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, filters.faskesId);
    const where = {};

    if (effectiveFaskesId) {
      where.faskesId = effectiveFaskesId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.statusPersetujuan) {
      where.statusPersetujuan = filters.statusPersetujuan.toUpperCase();
    }
    if (filters.tipeIzin) {
      where.tipeIzin = filters.tipeIzin.toUpperCase();
    }

    // Filter tanggal aktif
    if (filters.tanggal) {
      const d = parseDateOnly(filters.tanggal);
      where.tanggalMulai = { lte: d };
      where.tanggalSelesai = { gte: d };
    }

    return await prisma.izinCutiNakes.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            namaLengkap: true,
            role: true,
            poliklinik: {
              select: {
                id: true,
                namaPoli: true,
              },
            },
          },
        },
        pengganti: {
          select: {
            id: true,
            username: true,
            namaLengkap: true,
            role: true,
          },
        },
        faskes: {
          select: {
            id: true,
            namaFaskes: true,
          },
        },
      },
      orderBy: [
        { tanggalMulai: 'desc' },
      ],
    });
  },

  /**
   * 8. Ajukan / Buat Izin atau Cuti Nakes
   */
  createIzinCuti: async (user, data) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, data.faskesId);

    if (!data.userId) {
      throw new Error('Tenaga medis (userId) wajib ditentukan.');
    }
    if (!data.tanggalMulai || !data.tanggalSelesai) {
      throw new Error('Tanggal mulai dan tanggal selesai cuti/izin wajib diisi.');
    }

    const tMulai = parseDateOnly(data.tanggalMulai);
    const tSelesai = parseDateOnly(data.tanggalSelesai);

    if (tMulai > tSelesai) {
      throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.');
    }

    const nakes = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, faskesId: true },
    });
    if (!nakes) {
      throw new Error('Tenaga medis tidak ditemukan.');
    }

    return await prisma.izinCutiNakes.create({
      data: {
        userId: data.userId,
        faskesId: effectiveFaskesId || nakes.faskesId,
        tanggalMulai: tMulai,
        tanggalSelesai: tSelesai,
        tipeIzin: (data.tipeIzin || 'CUTI').toUpperCase(),
        keterangan: data.keterangan || null,
        penggantiId: data.penggantiId || null,
        statusPersetujuan: data.statusPersetujuan ? data.statusPersetujuan.toUpperCase() : 'DISETUJUI',
        catatanPersetujuan: data.catatanPersetujuan || null,
      },
      include: {
        user: {
          select: { id: true, namaLengkap: true },
        },
        pengganti: {
          select: { id: true, namaLengkap: true },
        },
      },
    });
  },

  /**
   * 9. Update Izin / Cuti
   */
  updateIzinCuti: async (user, id, data) => {
    const updateData = {};

    if (data.tanggalMulai) {
      updateData.tanggalMulai = parseDateOnly(data.tanggalMulai);
    }
    if (data.tanggalSelesai) {
      updateData.tanggalSelesai = parseDateOnly(data.tanggalSelesai);
    }
    if (data.tipeIzin) {
      updateData.tipeIzin = data.tipeIzin.toUpperCase();
    }
    if (data.keterangan !== undefined) {
      updateData.keterangan = data.keterangan;
    }
    if (data.penggantiId !== undefined) {
      updateData.penggantiId = data.penggantiId || null;
    }
    if (data.statusPersetujuan) {
      updateData.statusPersetujuan = data.statusPersetujuan.toUpperCase();
    }
    if (data.catatanPersetujuan !== undefined) {
      updateData.catatanPersetujuan = data.catatanPersetujuan;
    }

    return await prisma.izinCutiNakes.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, namaLengkap: true },
        },
        pengganti: {
          select: { id: true, namaLengkap: true },
        },
      },
    });
  },

  /**
   * 10. Hapus Izin / Cuti
   */
  deleteIzinCuti: async (user, id) => {
    return await prisma.izinCutiNakes.delete({
      where: { id },
    });
  },

  /**
   * 11. Helper: Ambil Nakes untuk Dropdown Roster & Pengganti
   */
  getNakesOptions: async (user, filters = {}) => {
    const effectiveFaskesId = getEffectiveFaskesId(user, filters.faskesId);
    const where = {
      role: { in: ['DOKTER', 'DOKTER_UGD', 'PERAWAT'] },
    };

    if (effectiveFaskesId) {
      where.faskesId = effectiveFaskesId;
    }
    if (filters.role) {
      where.role = filters.role;
    }
    if (filters.poliklinikId) {
      where.poliklinikId = filters.poliklinikId;
    }

    return await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        namaLengkap: true,
        role: true,
        poliklinikId: true,
        poliklinik: {
          select: {
            id: true,
            kodePoli: true,
            namaPoli: true,
          },
        },
        faskesId: true,
      },
      orderBy: [
        { role: 'asc' },
        { namaLengkap: 'asc' },
      ],
    });
  },

  /**
   * 12. Direktori Publik Dokter & Jadwal Praktik
   * Digunakan oleh Halaman Landing Page (Portal Publik) & Portal Pasien Online
   */
  getPublicDoctorDirectory: async (filters = {}) => {
    const { faskesId, poliklinikId, hari } = filters;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayDate = parseDateOnly(todayStr);
    const todayHari = getHariFromDate(todayStr);

    const where = {
      role: { in: ['DOKTER', 'DOKTER_UGD'] },
    };

    if (faskesId) {
      where.faskesId = faskesId;
    }
    if (poliklinikId) {
      where.poliklinikId = poliklinikId;
    }

    const dokters = await prisma.user.findMany({
      where,
      select: {
        id: true,
        namaLengkap: true,
        username: true,
        role: true,
        poliklinikId: true,
        poliklinik: {
          select: {
            id: true,
            kodePoli: true,
            namaPoli: true,
          },
        },
        faskesId: true,
        faskes: {
          select: {
            id: true,
            kodeFaskes: true,
            namaFaskes: true,
          },
        },
        tenagaMedis: {
          select: {
            nik: true,
            nomorSip: true,
            spesialis: true,
          },
        },
        jadwalNakes: {
          where: {
            statusAktif: true,
          },
          orderBy: [
            { hari: 'asc' },
            { jamMulai: 'asc' },
          ],
        },
        izinCutiNakes: {
          where: {
            statusPersetujuan: 'DISETUJUI',
            tanggalMulai: { lte: todayDate },
            tanggalSelesai: { gte: todayDate },
          },
          select: {
            tipeIzin: true,
            keterangan: true,
            tanggalMulai: true,
            tanggalSelesai: true,
          },
        },
      },
      orderBy: [
        { namaLengkap: 'asc' },
        { username: 'asc' },
      ],
    });

    const HARI_ORDER = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
    const HARI_TITLE_MAP = {
      SENIN: 'Senin',
      SELASA: 'Selasa',
      RABU: 'Rabu',
      KAMIS: 'Kamis',
      JUMAT: 'Jumat',
      SABTU: 'Sabtu',
      MINGGU: 'Minggu',
    };

    const result = dokters.map((doc) => {
      // Ambil hari aktif dokter dari jadwalNakes
      const uniqueHariSet = new Set(doc.jadwalNakes.map((j) => j.hari.toUpperCase()));
      const days = HARI_ORDER.filter((h) => uniqueHariSet.has(h)).map((h) => HARI_TITLE_MAP[h] || h);

      // Buat ringkasan hari praktik (daysText)
      let daysText = 'Jadwal Menyesuaikan';
      if (days.length === 7) {
        daysText = 'Setiap Hari';
      } else if (days.length > 0) {
        if (days.length === 5 && days[0] === 'Senin' && days[4] === 'Jumat') {
          daysText = 'Senin - Jumat';
        } else if (days.length === 6 && days[0] === 'Senin' && days[5] === 'Sabtu') {
          daysText = 'Senin - Sabtu';
        } else if (days.length <= 3) {
          daysText = days.join(', ');
        } else {
          daysText = `${days[0]} - ${days[days.length - 1]}`;
        }
      }

      // Jam Layanan (ambil jadwal hari ini jika ada, atau jadwal pertama)
      const jadwalHariIni = doc.jadwalNakes.find((j) => j.hari.toUpperCase() === todayHari);
      let hours = '08:00 - 14:00';
      if (jadwalHariIni) {
        hours = `${jadwalHariIni.jamMulai} - ${jadwalHariIni.jamSelesai}`;
      } else if (doc.jadwalNakes.length > 0) {
        hours = `${doc.jadwalNakes[0].jamMulai} - ${doc.jadwalNakes[0].jamSelesai}`;
      }

      // Status kehadiran hari ini
      const isCutiHariIni = doc.izinCutiNakes.length > 0;
      let status = 'Aktif Praktik';
      let statusBadge = 'success'; // 'success' | 'warning' | 'neutral'
      let isBertugasHariIni = false;

      if (isCutiHariIni) {
        const cuti = doc.izinCutiNakes[0];
        status = `Sedang Cuti (${cuti.tipeIzin || 'Izin'})`;
        statusBadge = 'warning';
        isBertugasHariIni = false;
      } else if (jadwalHariIni) {
        status = 'Bertugas Hari Ini';
        statusBadge = 'success';
        isBertugasHariIni = true;
      } else if (days.length > 0) {
        status = 'Libur Hari Ini';
        statusBadge = 'neutral';
        isBertugasHariIni = false;
      } else {
        status = 'Jadwal Menyesuaikan';
        statusBadge = 'neutral';
        isBertugasHariIni = false;
      }

      // Avatar Inisial
      const nameClean = (doc.namaLengkap || doc.username || 'Dokter')
        .replace(/^(dr\.|drg\.|dr\s|drg\s)/i, '')
        .trim();
      const parts = nameClean.split(' ').filter(Boolean);
      let avatar = 'DR';
      if (parts.length >= 2) {
        avatar = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length >= 2) {
        avatar = parts[0].slice(0, 2).toUpperCase();
      }

      return {
        id: doc.id,
        name: doc.namaLengkap || doc.username,
        spesialis: doc.tenagaMedis?.spesialis || (doc.role === 'DOKTER_UGD' ? 'Dokter UGD' : 'Dokter Umum'),
        poli: doc.poliklinik?.namaPoli || (doc.role === 'DOKTER_UGD' ? 'UGD 24 Jam' : 'Poli Umum'),
        poliklinikId: doc.poliklinikId,
        faskes: doc.faskes?.namaFaskes || 'Puskesmas Faskes Utama',
        faskesId: doc.faskesId,
        days,
        daysText,
        hours,
        status,
        statusBadge,
        isBertugasHariIni,
        avatar,
        schedules: doc.jadwalNakes.map((j) => ({
          id: j.id,
          hari: HARI_TITLE_MAP[j.hari.toUpperCase()] || j.hari,
          hariRaw: j.hari.toUpperCase(),
          shift: j.shift,
          jamMulai: j.jamMulai,
          jamSelesai: j.jamSelesai,
          kuotaPasien: j.kuotaPasien,
        })),
      };
    });

    if (hari && hari !== 'ALL') {
      const targetHariTitle = HARI_TITLE_MAP[hari.toUpperCase()] || hari;
      return result.filter((d) => d.days.includes(targetHariTitle));
    }

    return result;
  },
};

module.exports = jadwalNakesService;
