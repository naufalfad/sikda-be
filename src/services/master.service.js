'use strict';

const prisma = require('../config/prisma');

// ==========================================
// 1. MASTER OBAT
// ==========================================

const getMasterObat = async (search) => {
  const whereClause = search
    ? {
        OR: [
          { namaObat: { contains: search, mode: 'insensitive' } },
          { kodeObat: { contains: search, mode: 'insensitive' } },
          { kategori: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  return await prisma.masterObat.findMany({
    where: whereClause,
    take: 100,
    orderBy: { namaObat: 'asc' },
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
  return await prisma.masterObat.update({
    where: { id },
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

const getMasterVaksin = async () => {
  return await prisma.masterVaksin.findMany({
    include: {
      batchVaksin: true,
    },
    orderBy: { namaVaksin: 'asc' },
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

