const prisma = require('../config/prisma');
const satusehatConfig = require('../config/satusehat');
const { createFhirClient } = require('./satusehat/gateway.service');
const { buildRoomLocationPayload, buildBedLocationPayload } = require('../utils/fhir-mappers/location-room.mapper');
const { buildDevicePayload } = require('../utils/fhir-mappers/device.mapper');
const { applyFaskesScope, getEffectiveFaskesId } = require('../utils/tenantScope');

// ==========================================
// 1. SERVICES MASTER RUANGAN
// ==========================================

const getRuangans = async (query = {}, user) => {
  const { search, gedung, kategoriRuangan, statusAktif } = query;

  const where = {};
  applyFaskesScope(where, user);

  if (search) {
    where.OR = [
      { kodeRuangan: { contains: search, mode: 'insensitive' } },
      { namaRuangan: { contains: search, mode: 'insensitive' } },
      { gedung: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (gedung) {
    where.gedung = gedung;
  }

  if (kategoriRuangan) {
    where.kategoriRuangan = kategoriRuangan;
  }

  if (statusAktif !== undefined) {
    where.statusAktif = statusAktif === 'true' || statusAktif === true;
  }

  return await prisma.masterRuangan.findMany({
    where,
    include: {
      poliklinik: {
        select: { id: true, kodePoli: true, namaPoli: true }
      },
      penanggungJawab: {
        select: { id: true, username: true, namaLengkap: true, role: true }
      },
      _count: {
        select: {
          tempatTidurs: true,
          asets: true
        }
      }
    },
    orderBy: [
      { gedung: 'asc' },
      { lantai: 'asc' },
      { namaRuangan: 'asc' }
    ]
  });
};

const getRuanganById = async (id) => {
  return await prisma.masterRuangan.findUnique({
    where: { id },
    include: {
      poliklinik: true,
      penanggungJawab: {
        select: { id: true, username: true, namaLengkap: true, role: true }
      },
      tempatTidurs: {
        orderBy: { nomorBed: 'asc' },
        include: {
          kunjunganAktif: {
            include: {
              pasien: {
                select: { id: true, noRM: true, namaLengkap: true, jenisKelamin: true }
              }
            }
          }
        }
      },
      asets: {
        orderBy: { namaAset: 'asc' }
      }
    }
  });
};

const createRuangan = async (data, user) => {
  return await prisma.masterRuangan.create({
    data: {
      faskesId: getEffectiveFaskesId(user, data.faskesId),
      kodeRuangan: data.kodeRuangan,
      namaRuangan: data.namaRuangan,
      lantai: data.lantai || null,
      gedung: data.gedung || null,
      kategoriRuangan: data.kategoriRuangan,
      deskripsi: data.deskripsi || null,
      statusAktif: data.statusAktif !== undefined ? data.statusAktif : true,
      poliklinikId: data.poliklinikId || null,
      penanggungJawabId: data.penanggungJawabId || null,
      physicalType: data.physicalType || 'ro',
      partOfLocationId: data.partOfLocationId || null
    }
  });
};

const updateRuangan = async (id, data) => {
  return await prisma.masterRuangan.update({
    where: { id },
    data
  });
};

const deleteRuangan = async (id) => {
  return await prisma.masterRuangan.delete({
    where: { id }
  });
};

const syncRuanganToSatuSehat = async (id) => {
  const ruangan = await prisma.masterRuangan.findUnique({ where: { id } });
  if (!ruangan) throw new Error('Ruangan tidak ditemukan');

  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;
  if (!orgId) throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');

  const payload = buildRoomLocationPayload(ruangan, orgId);
  const fhirClient = await createFhirClient();

  let response;
  if (ruangan.ihsLocationId && !ruangan.ihsLocationId.startsWith('Loc-')) {
    // Update existing Location
    response = await fhirClient.put(`/Location/${ruangan.ihsLocationId}`, payload);
  } else {
    // Create new Location
    response = await fhirClient.post('/Location', payload);
  }

  const locationIhsId = response.data?.id || ruangan.ihsLocationId;

  return await prisma.masterRuangan.update({
    where: { id },
    data: { ihsLocationId: locationIhsId }
  });
};

// ==========================================
// 2. SERVICES BED MANAGEMENT
// ==========================================

const getBeds = async (query = {}, user) => {
  const { ruanganId, statusBed, kelasKamar } = query;
  const where = {};

  if (ruanganId) where.ruanganId = ruanganId;
  if (statusBed) where.statusBed = statusBed;
  if (kelasKamar) where.kelasKamar = kelasKamar;

  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.ruangan = { faskesId: user.faskesId };
  }

  return await prisma.tempatTidur.findMany({
    where,
    include: {
      ruangan: {
        select: { id: true, kodeRuangan: true, namaRuangan: true, gedung: true, kategoriRuangan: true }
      },
      kunjunganAktif: {
        include: {
          pasien: {
            select: { id: true, noRM: true, namaLengkap: true, jenisKelamin: true }
          }
        }
      }
    },
    orderBy: [
      { ruangan: { namaRuangan: 'asc' } },
      { nomorBed: 'asc' }
    ]
  });
};

const getBedStats = async (user) => {
  const where = {};
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.ruangan = { faskesId: user.faskesId };
  }

  const allBeds = await prisma.tempatTidur.findMany({ where });
  const total = allBeds.length;
  const tersedia = allBeds.filter(b => b.statusBed === 'TERSEDIA').length;
  const terisi = allBeds.filter(b => b.statusBed === 'TERISI').length;
  const perbaikan = allBeds.filter(b => b.statusBed === 'PERBAIKAN').length;
  const dibersihkan = allBeds.filter(b => b.statusBed === 'DIBERSIHKAN').length;
  const occupancyRate = total > 0 ? ((terisi / (total - perbaikan || 1)) * 100).toFixed(1) : '0';

  return {
    total,
    tersedia,
    terisi,
    perbaikan,
    dibersihkan,
    occupancyRate: Number(occupancyRate)
  };
};

const createBed = async (data) => {
  return await prisma.tempatTidur.create({
    data: {
      ruanganId: data.ruanganId,
      nomorBed: data.nomorBed,
      kelasKamar: data.kelasKamar || 'NON_KELAS_IGD',
      statusBed: data.statusBed || 'TERSEDIA',
      operationalStatus: data.statusBed === 'TERISI' ? 'O' : (data.statusBed === 'PERBAIKAN' ? 'C' : 'U'),
      kunjunganAktifId: data.kunjunganAktifId || null
    }
  });
};

const updateBed = async (id, data) => {
  const updateData = { ...data };
  if (data.statusBed) {
    if (data.statusBed === 'TERISI') updateData.operationalStatus = 'O';
    else if (data.statusBed === 'PERBAIKAN') updateData.operationalStatus = 'C';
    else if (data.statusBed === 'DIBERSIHKAN') updateData.operationalStatus = 'H';
    else updateData.operationalStatus = 'U';
  }

  return await prisma.tempatTidur.update({
    where: { id },
    data: updateData
  });
};

const deleteBed = async (id) => {
  return await prisma.tempatTidur.delete({ where: { id } });
};

const syncBedToSatuSehat = async (id) => {
  const bed = await prisma.tempatTidur.findUnique({
    where: { id },
    include: { ruangan: true }
  });
  if (!bed) throw new Error('Tempat tidur tidak ditemukan');

  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;
  if (!orgId) throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');

  const payload = buildBedLocationPayload(bed, bed.ruangan?.ihsLocationId, orgId);
  const fhirClient = await createFhirClient();

  let response;
  if (bed.ihsLocationId && !bed.ihsLocationId.startsWith('Loc-')) {
    response = await fhirClient.put(`/Location/${bed.ihsLocationId}`, payload);
  } else {
    response = await fhirClient.post('/Location', payload);
  }

  const bedLocationId = response.data?.id || bed.ihsLocationId;

  return await prisma.tempatTidur.update({
    where: { id },
    data: { ihsLocationId: bedLocationId }
  });
};

// ==========================================
// 3. SERVICES ASET RUANGAN (ALKES & SARPRAS)
// ==========================================

const getAsets = async (query = {}, user) => {
  const { search, ruanganId, kategoriAset, kondisiAset, statusOperasional } = query;
  const where = {};
  applyFaskesScope(where, user);

  if (search) {
    where.OR = [
      { kodeAset: { contains: search, mode: 'insensitive' } },
      { namaAset: { contains: search, mode: 'insensitive' } },
      { merk: { contains: search, mode: 'insensitive' } },
      { nomorSeri: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (ruanganId) where.ruanganId = ruanganId;
  if (kategoriAset) where.kategoriAset = kategoriAset;
  if (kondisiAset) where.kondisiAset = kondisiAset;
  if (statusOperasional) where.statusOperasional = statusOperasional;

  return await prisma.asetRuangan.findMany({
    where,
    include: {
      ruangan: {
        select: { id: true, kodeRuangan: true, namaRuangan: true, gedung: true }
      },
      _count: {
        select: {
          riwayatPemeliharaan: true,
          riwayatMutasi: true
        }
      }
    },
    orderBy: [
      { ruangan: { namaRuangan: 'asc' } },
      { namaAset: 'asc' }
    ]
  });
};

const getAsetById = async (id) => {
  return await prisma.asetRuangan.findUnique({
    where: { id },
    include: {
      ruangan: true,
      riwayatPemeliharaan: {
        orderBy: { tanggalJadwal: 'desc' }
      },
      riwayatMutasi: {
        orderBy: { tanggalMutasi: 'desc' },
        include: {
          ruanganAsal: true,
          ruanganTujuan: true,
          petugasAdmin: { select: { id: true, namaLengkap: true, username: true } }
        }
      }
    }
  });
};

const getAsetStats = async (user) => {
  const where = {};
  applyFaskesScope(where, user);

  const asets = await prisma.asetRuangan.findMany({ where });
  const total = asets.length;
  const alkesCount = asets.filter(a => a.kategoriAset.startsWith('MEDIS_')).length;
  const nonMedisCount = total - alkesCount;

  const kondisiBaik = asets.filter(a => a.kondisiAset === 'BAIK').length;
  const kondisiRusakRingan = asets.filter(a => a.kondisiAset === 'RUSAK_RINGAN').length;
  const kondisiRusakBerat = asets.filter(a => a.kondisiAset === 'RUSAK_BERAT').length;
  const kondisiAfkir = asets.filter(a => a.kondisiAset === 'AFKIR').length;

  const totalNilaiPerolehan = asets.reduce((acc, a) => acc + (a.hargaPerolehan || 0), 0);

  return {
    total,
    alkesCount,
    nonMedisCount,
    kondisiBaik,
    kondisiRusakRingan,
    kondisiRusakBerat,
    kondisiAfkir,
    totalNilaiPerolehan
  };
};

const createAset = async (data, user) => {
  return await prisma.asetRuangan.create({
    data: {
      faskesId: getEffectiveFaskesId(user, data.faskesId),
      kodeAset: data.kodeAset,
      namaAset: data.namaAset,
      ruanganId: data.ruanganId,
      kategoriAset: data.kategoriAset,
      merk: data.merk || null,
      tipeModel: data.tipeModel || null,
      nomorSeri: data.nomorSeri || null,
      tahunPerolehan: data.tahunPerolehan ? parseInt(data.tahunPerolehan, 10) : null,
      sumberAnggaran: data.sumberAnggaran || null,
      hargaPerolehan: data.hargaPerolehan ? parseFloat(data.hargaPerolehan) : 0,
      kondisiAset: data.kondisiAset || 'BAIK',
      statusOperasional: data.statusOperasional || 'AKTIF_DIGUNAKAN',
      kodeAspak: data.kodeAspak || null,
      kodeSnomed: data.kodeSnomed || null,
      catatan: data.catatan || null
    }
  });
};

const updateAset = async (id, data) => {
  const payload = { ...data };
  if (data.tahunPerolehan) payload.tahunPerolehan = parseInt(data.tahunPerolehan, 10);
  if (data.hargaPerolehan !== undefined) payload.hargaPerolehan = parseFloat(data.hargaPerolehan);

  return await prisma.asetRuangan.update({
    where: { id },
    data: payload
  });
};

const deleteAset = async (id) => {
  return await prisma.asetRuangan.delete({ where: { id } });
};

const syncDeviceToSatuSehat = async (id) => {
  const aset = await prisma.asetRuangan.findUnique({
    where: { id },
    include: { ruangan: true }
  });
  if (!aset) throw new Error('Aset tidak ditemukan');

  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;
  if (!orgId) throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');

  const payload = buildDevicePayload(aset, orgId, aset.ruangan?.ihsLocationId);
  const fhirClient = await createFhirClient();

  let response;
  if (aset.ihsDeviceId && !aset.ihsDeviceId.startsWith('Dev-')) {
    response = await fhirClient.put(`/Device/${aset.ihsDeviceId}`, payload);
  } else {
    response = await fhirClient.post('/Device', payload);
  }

  const deviceIhsId = response.data?.id || aset.ihsDeviceId;

  return await prisma.asetRuangan.update({
    where: { id },
    data: { ihsDeviceId: deviceIhsId }
  });
};

// ==========================================
// 4. SERVICES PEMELIHARAAN & KALIBRASI
// ==========================================

const getPemeliharaans = async (query = {}) => {
  const { asetId, status, jenisKegiatan } = query;
  const where = {};

  if (asetId) where.asetId = asetId;
  if (status) where.status = status;
  if (jenisKegiatan) where.jenisKegiatan = jenisKegiatan;

  return await prisma.riwayatPemeliharaanAset.findMany({
    where,
    include: {
      aset: {
        include: {
          ruangan: { select: { id: true, namaRuangan: true, kodeRuangan: true } }
        }
      }
    },
    orderBy: { tanggalJadwal: 'desc' }
  });
};

const getKalibrasiAlerts = async () => {
  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);

  // Ambil pemeliharaan yang terjadwal dalam 30 hari ke depan atau sudah kedaluwarsa kalibrasinya
  const alerts = await prisma.riwayatPemeliharaanAset.findMany({
    where: {
      OR: [
        {
          status: 'TERJADWAL',
          tanggalJadwal: { lte: next30Days }
        },
        {
          status: 'SELESAI',
          tanggalKalibrasiExpired: { lte: next30Days }
        }
      ]
    },
    include: {
      aset: {
        include: {
          ruangan: { select: { id: true, namaRuangan: true } }
        }
      }
    },
    orderBy: { tanggalJadwal: 'asc' }
  });

  return alerts.map(a => {
    const isExpired = a.tanggalKalibrasiExpired && new Date(a.tanggalKalibrasiExpired) < now;
    const isUpcoming = a.status === 'TERJADWAL' && new Date(a.tanggalJadwal) <= next30Days;
    
    return {
      ...a,
      isExpired,
      isUpcoming,
      urgency: isExpired ? 'KRITIS' : (isUpcoming ? 'PERINGATAN' : 'NORMAL')
    };
  });
};

const createPemeliharaan = async (data) => {
  return await prisma.riwayatPemeliharaanAset.create({
    data: {
      asetId: data.asetId,
      jenisKegiatan: data.jenisKegiatan,
      tanggalJadwal: new Date(data.tanggalJadwal),
      tanggalPelaksanaan: data.tanggalPelaksanaan ? new Date(data.tanggalPelaksanaan) : null,
      tanggalKalibrasiExpired: data.tanggalKalibrasiExpired ? new Date(data.tanggalKalibrasiExpired) : null,
      pelaksanaVendor: data.pelaksanaVendor || null,
      biayaPemeliharaan: data.biayaPemeliharaan ? parseFloat(data.biayaPemeliharaan) : 0,
      nomorSertifikatKalibrasi: data.nomorSertifikatKalibrasi || null,
      hasilKegiatan: data.hasilKegiatan || null,
      catatan: data.catatan || null,
      status: data.status || 'TERJADWAL'
    }
  });
};

const updatePemeliharaan = async (id, data) => {
  const payload = { ...data };
  if (data.tanggalJadwal) payload.tanggalJadwal = new Date(data.tanggalJadwal);
  if (data.tanggalPelaksanaan) payload.tanggalPelaksanaan = new Date(data.tanggalPelaksanaan);
  if (data.tanggalKalibrasiExpired) payload.tanggalKalibrasiExpired = new Date(data.tanggalKalibrasiExpired);
  if (data.biayaPemeliharaan !== undefined) payload.biayaPemeliharaan = parseFloat(data.biayaPemeliharaan);

  return await prisma.riwayatPemeliharaanAset.update({
    where: { id },
    data: payload
  });
};

// ==========================================
// 5. SERVICES MUTASI ASET
// ==========================================

const getMutasiHistory = async (asetId) => {
  const where = asetId ? { asetId } : {};

  return await prisma.riwayatMutasiAset.findMany({
    where,
    include: {
      aset: { select: { id: true, kodeAset: true, namaAset: true } },
      ruanganAsal: { select: { id: true, kodeRuangan: true, namaRuangan: true } },
      ruanganTujuan: { select: { id: true, kodeRuangan: true, namaRuangan: true } },
      petugasAdmin: { select: { id: true, namaLengkap: true, username: true } }
    },
    orderBy: { tanggalMutasi: 'desc' }
  });
};

const mutasiAset = async (asetId, ruanganTujuanId, alasanMutasi, petugasAdminId) => {
  return await prisma.$transaction(async (tx) => {
    const aset = await tx.asetRuangan.findUnique({ where: { id: asetId } });
    if (!aset) throw new Error('Aset tidak ditemukan');

    if (aset.ruanganId === ruanganTujuanId) {
      throw new Error('Ruangan tujuan tidak boleh sama dengan ruangan saat ini');
    }

    const ruanganAsalId = aset.ruanganId;

    // 1. Buat record riwayat mutasi
    const logMutasi = await tx.riwayatMutasiAset.create({
      data: {
        asetId,
        ruanganAsalId,
        ruanganTujuanId,
        tanggalMutasi: new Date(),
        alasanMutasi: alasanMutasi || 'Pemindahan lokasi operasional',
        petugasAdminId: petugasAdminId || null
      }
    });

    // 2. Update ruangan aset
    const updatedAset = await tx.asetRuangan.update({
      where: { id: asetId },
      data: { ruanganId: ruanganTujuanId }
    });

    return {
      logMutasi,
      updatedAset
    };
  });
};

module.exports = {
  // Ruangan
  getRuangans,
  getRuanganById,
  createRuangan,
  updateRuangan,
  deleteRuangan,
  syncRuanganToSatuSehat,
  // Bed
  getBeds,
  getBedStats,
  createBed,
  updateBed,
  deleteBed,
  syncBedToSatuSehat,
  // Aset
  getAsets,
  getAsetById,
  getAsetStats,
  createAset,
  updateAset,
  deleteAset,
  syncDeviceToSatuSehat,
  // Pemeliharaan
  getPemeliharaans,
  getKalibrasiAlerts,
  createPemeliharaan,
  updatePemeliharaan,
  // Mutasi
  getMutasiHistory,
  mutasiAset
};
