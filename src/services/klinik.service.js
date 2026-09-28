const prisma = require('../config/prisma');

const klinikService = {
  // === Poliklinik ===
  getAllPoliklinik: async (user = null, requestedFaskesId = null) => {
    let where = { statusAktif: true };

    const effectiveFaskesId = requestedFaskesId || (user && !['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role) ? user.faskesId : null);

    if (effectiveFaskesId) {
      where = {
        OR: [
          { faskesId: effectiveFaskesId },
          { faskesId: null }
        ],
        statusAktif: true
      };
    }

    return await prisma.poliklinik.findMany({
      where,
      include: {
        faskes: {
          select: {
            id: true,
            kodeFaskes: true,
            namaFaskes: true,
            jenisFaskes: true,
          }
        }
      },
      orderBy: { namaPoli: 'asc' },
    });
  },

  createPoliklinik: async (data) => {
    return await prisma.poliklinik.create({
      data: {
        faskesId: data.faskesId || null,
        kodePoli: data.kodePoli,
        namaPoli: data.namaPoli,
        deskripsi: data.deskripsi,
        statusAktif: data.statusAktif !== undefined ? data.statusAktif : true,
        kdPoliPcare: data.kdPoliPcare || null,
        noAntrianPrefix: data.noAntrianPrefix || null,
      },
      include: {
        faskes: true,
      }
    });
  },

  updatePoliklinik: async (id, data) => {
    return await prisma.poliklinik.update({
      where: { id },
      data,
    });
  },

  // === Dokter Klinik ===
  getDokterByPoli: async (poliklinikId) => {
    return await prisma.user.findMany({
      where: {
        poliklinikId: poliklinikId,
        role: 'DOKTER',
      },
      select: {
        id: true,
        username: true,
        namaLengkap: true,
        role: true,
      },
      orderBy: [
        { namaLengkap: 'asc' },
        { username: 'asc' }
      ],
    });
  },

  // === Layanan Klinik ===
  getLayananByPoli: async (poliklinikId) => {
    return await prisma.layananKlinik.findMany({
      where: { poliklinikId },
      orderBy: { namaLayanan: 'asc' },
    });
  },

  createLayanan: async (data) => {
    return await prisma.layananKlinik.create({
      data: {
        poliklinikId: data.poliklinikId,
        kodeLayanan: data.kodeLayanan,
        namaLayanan: data.namaLayanan,
        deskripsi: data.deskripsi,
        tarifDasar: data.tarifDasar ? parseFloat(data.tarifDasar) : 0,
        statusAktif: data.statusAktif !== undefined ? data.statusAktif : true,
      },
    });
  },

  updateLayanan: async (id, data) => {
    if (data.tarifDasar !== undefined) {
      data.tarifDasar = parseFloat(data.tarifDasar);
    }
    return await prisma.layananKlinik.update({
      where: { id },
      data,
    });
  }
};

module.exports = klinikService;
