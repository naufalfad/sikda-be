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
  getDokterByPoli: async (poliklinikId, user = null, requestedFaskesId = null) => {
    const isDinkes = user && ['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role);
    const effectiveFaskesId = isDinkes ? (requestedFaskesId || null) : (user?.faskesId || requestedFaskesId || null);

    const where = {
      poliklinikId: poliklinikId,
      role: 'DOKTER',
    };

    if (effectiveFaskesId) {
      where.faskesId = effectiveFaskesId;
    }

    return await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        namaLengkap: true,
        role: true,
        faskesId: true,
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
  },

  // === Kapabilitas Diagnostik Faskes (Laboratorium & Radiologi) ===
  // Terisolasi 100% per-Faskes: Hanya mengembalikan data faskes tempat user bertugas
  getFaskesKapabilitas: async (user = null) => {
    if (!user || !user.faskesId) {
      const error = new Error('Akses ditolak: Akun Anda tidak terikat pada Faskes manapun.');
      error.statusCode = 403;
      throw error;
    }

    const faskes = await prisma.faskes.findUnique({
      where: { id: user.faskesId },
      select: {
        id: true,
        kodeFaskes: true,
        namaFaskes: true,
        jenisFaskes: true,
        labInternalParams: true,
        radiologiInternalLoinc: true,
        defaultLabRujukan: true,
        defaultRadRujukan: true
      }
    });

    if (!faskes) {
      const error = new Error('Data faskes tidak ditemukan di database.');
      error.statusCode = 404;
      throw error;
    }

    // Ambil seluruh master data lab untuk acuan katalog medis
    const masterLab = await prisma.masterLaboratorium.findMany({
      where: { statusAktif: true },
      orderBy: [{ kategori: 'asc' }, { parameter: 'asc' }]
    });

    // Ambil seluruh master modality radiologi
    const masterModality = await prisma.masterModality.findMany({
      where: { statusAktif: true },
      orderBy: { kodeDicom: 'asc' }
    });

    // Acuan standar LOINC radiologi Kemenkes SATUSEHAT (Single Source of Truth)
    const standardRadiologiLoinc = [
      {
        kodeLoinc: '39051-8',
        namaPemeriksaan: 'Rontgen Thorax AP/PA (XR Thorax AP/PA)',
        modalitas: 'XR',
        bodySiteCode: '51185008',
        bodySiteDisplay: 'Thoracic structure',
        kategori: 'Radiologi Konvensional',
      },
      {
        kodeLoinc: '26122-2',
        namaPemeriksaan: 'Rontgen Femur (XR Femur - Right/Left)',
        modalitas: 'XR',
        bodySiteCode: '29836001',
        bodySiteDisplay: 'Hip structure',
        kategori: 'Radiologi Konvensional',
      },
      {
        kodeLoinc: '36563-5',
        namaPemeriksaan: 'Rontgen Ekstremitas Atas / Antebrachii / Wrist',
        modalitas: 'XR',
        bodySiteCode: '53120007',
        bodySiteDisplay: 'Upper limb structure',
        kategori: 'Radiologi Konvensional',
      },
      {
        kodeLoinc: '36571-8',
        namaPemeriksaan: 'Rontgen Pelvis / Panggul AP',
        modalitas: 'XR',
        bodySiteCode: '12921003',
        bodySiteDisplay: 'Pelvis structure',
        kategori: 'Radiologi Konvensional',
      },
      {
        kodeLoinc: '36572-6',
        namaPemeriksaan: 'Rontgen Sinus Paranasal (XR Waters View)',
        modalitas: 'XR',
        bodySiteCode: '2095001',
        bodySiteDisplay: 'Nasal sinus structure',
        kategori: 'Radiologi Konvensional',
      },
      {
        kodeLoinc: '95611-0',
        namaPemeriksaan: 'Rontgen Panoramic / Dental Occlusal (XR Teeth Occlusal)',
        modalitas: 'XR',
        bodySiteCode: '39481002',
        bodySiteDisplay: 'Upper dental arch structure',
        kategori: 'Dental Radiography',
      },
      {
        kodeLoinc: '24558-9',
        namaPemeriksaan: 'USG Abdomen (Ultrasonography Abdomen)',
        modalitas: 'US',
        bodySiteCode: '80581009',
        bodySiteDisplay: 'Upper abdomen structure',
        kategori: 'Ultrasonografi',
      },
      {
        kodeLoinc: '24627-2',
        namaPemeriksaan: 'USG Kebidanan / Kandungan (Obstetric Ultrasound)',
        modalitas: 'US',
        bodySiteCode: '280397003',
        bodySiteDisplay: 'Fetal structure',
        kategori: 'Ultrasonografi',
      },
      {
        kodeLoinc: '36424-0',
        namaPemeriksaan: 'CT Scan Abdomen (CT Abdomen WO/W Contrast)',
        modalitas: 'CT',
        bodySiteCode: '818983003',
        bodySiteDisplay: 'Abdomen structure',
        kategori: 'Computed Tomography',
      },
      {
        kodeLoinc: '36442-2',
        namaPemeriksaan: 'MRI Dada/Thorax (MR Chest WO/W Contrast)',
        modalitas: 'MR',
        bodySiteCode: '51185008',
        bodySiteDisplay: 'Thoracic structure',
        kategori: 'Magnetic Resonance',
      },
    ];

    return {
      faskes,
      masterLab,
      masterModality,
      standardRadiologiLoinc
    };
  },

  // Terisolasi 100%: Admin faskes HANYA bisa mengedit faskesnya sendiri (user.faskesId)
  updateFaskesKapabilitas: async (user = null, data = {}) => {
    if (!user || !user.faskesId) {
      const error = new Error('Akses ditolak: Akun Anda tidak memiliki hak akses mengubah kapabilitas faskes ini.');
      error.statusCode = 403;
      throw error;
    }

    const targetFaskesId = user.faskesId; // Kunci mutlak ke faskes akun

    const updatePayload = {};
    if (data.labInternalParams !== undefined) {
      updatePayload.labInternalParams = Array.isArray(data.labInternalParams) ? data.labInternalParams : [];
    }
    if (data.radiologiInternalLoinc !== undefined) {
      updatePayload.radiologiInternalLoinc = Array.isArray(data.radiologiInternalLoinc) ? data.radiologiInternalLoinc : [];
    }
    if (data.defaultLabRujukan !== undefined) {
      updatePayload.defaultLabRujukan = data.defaultLabRujukan;
    }
    if (data.defaultRadRujukan !== undefined) {
      updatePayload.defaultRadRujukan = data.defaultRadRujukan;
    }

    const updated = await prisma.faskes.update({
      where: { id: targetFaskesId },
      data: updatePayload,
      select: {
        id: true,
        kodeFaskes: true,
        namaFaskes: true,
        jenisFaskes: true,
        labInternalParams: true,
        radiologiInternalLoinc: true,
        defaultLabRujukan: true,
        defaultRadRujukan: true
      }
    });

    return updated;
  }
};

module.exports = klinikService;
