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
  return await prisma.masterICD9.create({ data });
};

const updateICD9 = async (id, data) => {
  return await prisma.masterICD9.update({
    where: { id_icd9: id },
    data
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
