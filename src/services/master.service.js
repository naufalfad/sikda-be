'use strict';

const prisma = require('../config/prisma');

// ==========================================
// 1. MASTER OBAT
// ==========================================

const getMasterObat = async (search, faskesId = null) => {
  const whereClause = search
    ? {
        OR: [
          { namaObat: { contains: search, mode: 'insensitive' } },
          { kodeObat: { contains: search, mode: 'insensitive' } },
          { kategori: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const obats = await prisma.masterObat.findMany({
    where: whereClause,
    include: {
      stokFaskes: faskesId
        ? {
            where: { faskesId, statusAktif: true },
            orderBy: { tanggalExpired: 'asc' }
          }
        : {
            where: { statusAktif: true },
            orderBy: { tanggalExpired: 'asc' }
          }
    },
    take: 100,
    orderBy: { namaObat: 'asc' },
  });

  const now = new Date();
  return obats.map((obat) => {
    let fefoAssigned = false;
    const enrichedBatches = (obat.stokFaskes || []).map((b) => {
      let sisaHariExpired = null;
      let statusExpired = 'AMAN';
      if (b.tanggalExpired) {
        const diffMs = new Date(b.tanggalExpired).getTime() - now.getTime();
        sisaHariExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (sisaHariExpired < 0) {
          statusExpired = 'KADALUWARSA';
        } else if (sisaHariExpired <= 60) {
          statusExpired = 'SEGERA_KADALUWARSA'; // < 60 hari (Prioritas FEFO tinggi)
        } else if (sisaHariExpired <= 90) {
          statusExpired = 'WASPADA';
        }
      }

      // Prioritas FEFO: batch pertama yang stoknya masih ada (>0) dan belum kedaluwarsa
      let isPrioritasFefo = false;
      if (!fefoAssigned && b.stok > 0 && statusExpired !== 'KADALUWARSA') {
        isPrioritasFefo = true;
        fefoAssigned = true;
      }

      return {
        ...b,
        sisaHariExpired,
        statusExpired,
        isPrioritasFefo
      };
    });

    const totalStok = enrichedBatches.reduce((acc, b) => acc + b.stok, 0);
    const prioritasFefoBatch = enrichedBatches.find(b => b.isPrioritasFefo) || enrichedBatches.find(b => b.stok > 0) || null;

    return {
      ...obat,
      stokFaskes: enrichedBatches,
      totalStok,
      prioritasFefoBatch
    };
  });
};

const createMasterObat = async (data) => {
  return await prisma.masterObat.create({
    data: {
      kodeObat: data.kodeObat,
      namaObat: data.namaObat,
      kategori: data.kategori,
      sediaan: data.sediaan,
      harga: parseFloat(data.harga) || 0,
      gambarUrl: data.gambarUrl || null,
    },
  });
};

const updateMasterObat = async (id, data) => {
  const updateData = {
    kodeObat: data.kodeObat,
    namaObat: data.namaObat,
    kategori: data.kategori,
    sediaan: data.sediaan,
    harga: parseFloat(data.harga) || 0,
  };

  if (data.gambarUrl !== undefined) {
    updateData.gambarUrl = data.gambarUrl;
  }

  return await prisma.masterObat.update({
    where: { id },
    data: updateData,
  });
};

const deleteMasterObat = async (id) => {
  return await prisma.masterObat.delete({
    where: { id },
  });
};

// ==========================================
// 2. MASTER LABORATORIUM
// ==========================================

const getMasterLaboratorium = async (search) => {
  const whereClause = search
    ? {
        OR: [
          { parameter: { contains: search, mode: 'insensitive' } },
          { kategori: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  return await prisma.masterLaboratorium.findMany({
    where: whereClause,
    orderBy: [{ kategori: 'asc' }, { parameter: 'asc' }],
  });
};

const createMasterLaboratorium = async (data) => {
  return await prisma.masterLaboratorium.create({
    data: {
      kategori: data.kategori,
      parameter: data.parameter,
      satuan: data.satuan || null,
      nilaiRujukan: data.nilaiRujukan || null,
      kodePanelLab: data.kodePanelLab || null,
      hargaTarif: parseFloat(data.hargaTarif) || 0,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const updateMasterLaboratorium = async (id, data) => {
  return await prisma.masterLaboratorium.update({
    where: { id },
    data: {
      kategori: data.kategori,
      parameter: data.parameter,
      satuan: data.satuan || null,
      nilaiRujukan: data.nilaiRujukan || null,
      kodePanelLab: data.kodePanelLab || null,
      hargaTarif: parseFloat(data.hargaTarif) || 0,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const deleteMasterLaboratorium = async (id) => {
  return await prisma.masterLaboratorium.delete({
    where: { id },
  });
};

// ==========================================
// 3. MASTER MODALITY RADIOLOGI
// ==========================================

const getMasterModality = async () => {
  return await prisma.masterModality.findMany({
    orderBy: { kodeDicom: 'asc' },
  });
};

const createMasterModality = async (data) => {
  return await prisma.masterModality.create({
    data: {
      kodeDicom: data.kodeDicom,
      namaModality: data.namaModality,
      deskripsi: data.deskripsi || null,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const updateMasterModality = async (id, data) => {
  return await prisma.masterModality.update({
    where: { id },
    data: {
      kodeDicom: data.kodeDicom,
      namaModality: data.namaModality,
      deskripsi: data.deskripsi || null,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const deleteMasterModality = async (id) => {
  return await prisma.masterModality.delete({
    where: { id },
  });
};

// ==========================================
// 4. MASTER VAKSIN (IMUNISASI)
// ==========================================

const getMasterVaksin = async (faskesId = null) => {
  const vaksins = await prisma.masterVaksin.findMany({
    include: {
      batchVaksin: faskesId
        ? {
            where: { faskesId, statusAktif: true },
            orderBy: { tanggalExpired: 'asc' }
          }
        : {
            where: { statusAktif: true },
            orderBy: { tanggalExpired: 'asc' }
          }
    },
    orderBy: { namaVaksin: 'asc' },
  });

  const now = new Date();
  return vaksins.map((v) => {
    let fefoAssigned = false;
    const enrichedBatches = (v.batchVaksin || []).map((b) => {
      let sisaHariExpired = null;
      let statusExpired = 'AMAN';
      if (b.tanggalExpired) {
        const diffMs = new Date(b.tanggalExpired).getTime() - now.getTime();
        sisaHariExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (sisaHariExpired < 0) {
          statusExpired = 'KADALUWARSA';
        } else if (sisaHariExpired <= 60) {
          statusExpired = 'SEGERA_KADALUWARSA';
        } else if (sisaHariExpired <= 90) {
          statusExpired = 'WASPADA';
        }
      }

      let isPrioritasFefo = false;
      if (!fefoAssigned && b.stok > 0 && statusExpired !== 'KADALUWARSA') {
        isPrioritasFefo = true;
        fefoAssigned = true;
      }

      return {
        ...b,
        sisaHariExpired,
        statusExpired,
        isPrioritasFefo
      };
    });

    const totalStok = enrichedBatches.reduce((acc, b) => acc + b.stok, 0);
    const prioritasFefoBatch = enrichedBatches.find(b => b.isPrioritasFefo) || enrichedBatches.find(b => b.stok > 0) || null;

    return {
      ...v,
      batchVaksin: enrichedBatches,
      totalStok,
      prioritasFefoBatch
    };
  });
};

const createMasterVaksin = async (data) => {
  return await prisma.masterVaksin.create({
    data: {
      kodeKfa: data.kodeKfa,
      namaVaksin: data.namaVaksin,
      targetPenyakit: data.targetPenyakit || null,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const updateMasterVaksin = async (id, data) => {
  return await prisma.masterVaksin.update({
    where: { id },
    data: {
      kodeKfa: data.kodeKfa,
      namaVaksin: data.namaVaksin,
      targetPenyakit: data.targetPenyakit || null,
      statusAktif: data.statusAktif !== undefined ? Boolean(data.statusAktif) : true,
    },
  });
};

const deleteMasterVaksin = async (id) => {
  return await prisma.masterVaksin.delete({
    where: { id },
  });
};

module.exports = {
  // Obat
  getMasterObat,
  createMasterObat,
  updateMasterObat,
  deleteMasterObat,

  // Lab
  getMasterLaboratorium,
  createMasterLaboratorium,
  updateMasterLaboratorium,
  deleteMasterLaboratorium,

  // Radiologi Modality
  getMasterModality,
  createMasterModality,
  updateMasterModality,
  deleteMasterModality,

  // Vaksin
  getMasterVaksin,
  createMasterVaksin,
  updateMasterVaksin,
  deleteMasterVaksin,
};

