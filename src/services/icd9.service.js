const prisma = require('../config/prisma');

const searchICD9 = async (query) => {
  try {
    let whereClause = {};
    if (query && query.trim()) {
      whereClause = {
        OR: [
          { kode_icd9: { contains: query.trim(), mode: 'insensitive' } },
          { nama_prosedur: { contains: query.trim(), mode: 'insensitive' } },
        ],
      };
    }
    const results = await prisma.masterICD9.findMany({
      where: whereClause,
      take: query && query.trim() ? 50 : 250,
      orderBy: { kode_icd9: 'asc' }
    });
    return results;
  } catch (error) {
    throw error;
  }
};

const getAllICD9 = async () => {
  try {
    const results = await prisma.masterICD9.findMany({
      take: 250,
      orderBy: { kode_icd9: 'asc' }
    });
    return results;
  } catch (error) {
    throw error;
  }
};

const createICD9 = async (data) => {
  const {
    kode_icd9,
    nama_prosedur,
    kategori,
    tarifTindakan,
    templateBmhp,
    templateAlkes,
    templatePenunjang
  } = data;

  return await prisma.masterICD9.create({
    data: {
      kode_icd9: kode_icd9 ? kode_icd9.trim() : '',
      nama_prosedur: nama_prosedur ? nama_prosedur.trim() : '',
      kategori: kategori || 'Umum',
      tarifTindakan: tarifTindakan !== undefined && tarifTindakan !== null ? parseFloat(tarifTindakan) || 0 : 0,
      templateBmhp: templateBmhp !== undefined ? templateBmhp : null,
      templateAlkes: templateAlkes !== undefined ? templateAlkes : null,
      templatePenunjang: templatePenunjang !== undefined ? templatePenunjang : null
    }
  });
};

const updateICD9 = async (id, data) => {
  const updateData = {};
  if (data.kode_icd9 !== undefined) updateData.kode_icd9 = data.kode_icd9 ? data.kode_icd9.trim() : '';
  if (data.nama_prosedur !== undefined) updateData.nama_prosedur = data.nama_prosedur ? data.nama_prosedur.trim() : '';
  if (data.kategori !== undefined) updateData.kategori = data.kategori;
  if (data.tarifTindakan !== undefined) updateData.tarifTindakan = data.tarifTindakan !== null ? parseFloat(data.tarifTindakan) || 0 : 0;
  if (data.templateBmhp !== undefined) updateData.templateBmhp = data.templateBmhp;
  if (data.templateAlkes !== undefined) updateData.templateAlkes = data.templateAlkes;
  if (data.templatePenunjang !== undefined) updateData.templatePenunjang = data.templatePenunjang;

  return await prisma.masterICD9.update({
    where: { id_icd9: id },
    data: updateData
  });
};

const deleteICD9 = async (id) => {
  return await prisma.masterICD9.delete({
    where: { id_icd9: id }
  });
};

module.exports = {
  searchICD9,
  getAllICD9,
  createICD9,
  updateICD9,
  deleteICD9
};
