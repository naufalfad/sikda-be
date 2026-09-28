const asetRuanganService = require('../services/asetRuangan.service');

// Ruangan
const getRuangans = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getRuangans(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRuanganById = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getRuanganById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan' });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createRuangan = async (req, res, next) => {
  try {
    const data = await asetRuanganService.createRuangan(req.body, req.user);
    res.status(201).json({ success: true, message: 'Ruangan berhasil ditambahkan', data });
  } catch (error) {
    next(error);
  }
};

const updateRuangan = async (req, res, next) => {
  try {
    const data = await asetRuanganService.updateRuangan(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Ruangan berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const deleteRuangan = async (req, res, next) => {
  try {
    await asetRuanganService.deleteRuangan(req.params.id);
    res.status(200).json({ success: true, message: 'Ruangan berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const syncRuanganSatuSehat = async (req, res, next) => {
  try {
    const data = await asetRuanganService.syncRuanganToSatuSehat(req.params.id);
    res.status(200).json({ success: true, message: 'Ruangan berhasil disinkronisasi ke SATUSEHAT', data });
  } catch (error) {
    next(error);
  }
};

// Bed
const getBeds = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getBeds(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getBedStats = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getBedStats(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createBed = async (req, res, next) => {
  try {
    const data = await asetRuanganService.createBed(req.body);
    res.status(201).json({ success: true, message: 'Tempat tidur berhasil ditambahkan', data });
  } catch (error) {
    next(error);
  }
};

const updateBed = async (req, res, next) => {
  try {
    const data = await asetRuanganService.updateBed(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Tempat tidur berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const deleteBed = async (req, res, next) => {
  try {
    await asetRuanganService.deleteBed(req.params.id);
    res.status(200).json({ success: true, message: 'Tempat tidur berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const syncBedSatuSehat = async (req, res, next) => {
  try {
    const data = await asetRuanganService.syncBedToSatuSehat(req.params.id);
    res.status(200).json({ success: true, message: 'Tempat tidur berhasil disinkronisasi ke SATUSEHAT', data });
  } catch (error) {
    next(error);
  }
};

// Aset
const getAsets = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getAsets(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getAsetById = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getAsetById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getAsetStats = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getAsetStats(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createAset = async (req, res, next) => {
  try {
    const data = await asetRuanganService.createAset(req.body, req.user);
    res.status(201).json({ success: true, message: 'Aset berhasil didaftarkan', data });
  } catch (error) {
    next(error);
  }
};

const updateAset = async (req, res, next) => {
  try {
    const data = await asetRuanganService.updateAset(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Data aset berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const deleteAset = async (req, res, next) => {
  try {
    await asetRuanganService.deleteAset(req.params.id);
    res.status(200).json({ success: true, message: 'Aset berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const syncDeviceSatuSehat = async (req, res, next) => {
  try {
    const data = await asetRuanganService.syncDeviceToSatuSehat(req.params.id);
    res.status(200).json({ success: true, message: 'Alat kesehatan berhasil disinkronisasi ke SATUSEHAT (Device)', data });
  } catch (error) {
    next(error);
  }
};

// Pemeliharaan & Kalibrasi
const getPemeliharaans = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getPemeliharaans(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getKalibrasiAlerts = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getKalibrasiAlerts();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createPemeliharaan = async (req, res, next) => {
  try {
    const data = await asetRuanganService.createPemeliharaan(req.body);
    res.status(201).json({ success: true, message: 'Kegiatan pemeliharaan/kalibrasi berhasil dicatat', data });
  } catch (error) {
    next(error);
  }
};

const updatePemeliharaan = async (req, res, next) => {
  try {
    const data = await asetRuanganService.updatePemeliharaan(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Catatan pemeliharaan berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

// Mutasi Aset
const getMutasiHistory = async (req, res, next) => {
  try {
    const data = await asetRuanganService.getMutasiHistory(req.query.asetId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const mutasiAset = async (req, res, next) => {
  try {
    const { asetId, ruanganTujuanId, alasanMutasi } = req.body;
    const petugasAdminId = req.user?.id;
    const result = await asetRuanganService.mutasiAset(asetId, ruanganTujuanId, alasanMutasi, petugasAdminId);
    res.status(200).json({ success: true, message: 'Aset berhasil dimutasikan ke ruangan baru', data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Ruangan
  getRuangans,
  getRuanganById,
  createRuangan,
  updateRuangan,
  deleteRuangan,
  syncRuanganSatuSehat,
  // Bed
  getBeds,
  getBedStats,
  createBed,
  updateBed,
  deleteBed,
  syncBedSatuSehat,
  // Aset
  getAsets,
  getAsetById,
  getAsetStats,
  createAset,
  updateAset,
  deleteAset,
  syncDeviceSatuSehat,
  // Pemeliharaan
  getPemeliharaans,
  getKalibrasiAlerts,
  createPemeliharaan,
  updatePemeliharaan,
  // Mutasi
  getMutasiHistory,
  mutasiAset
};
