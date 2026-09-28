const dinkesService = require('../services/dinkes.service');

// 1. Ringkasan Eksekutif Dinkes
const getExecutiveSummary = async (req, res, next) => {
  try {
    const data = await dinkesService.getExecutiveSummary(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat ringkasan eksekutif Dinas Kesehatan',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 2. Analisis Beban Kerja Nakes vs Pasien per Faskes
const getWorkloadAnalytics = async (req, res, next) => {
  try {
    const data = await dinkesService.getWorkloadAnalytics(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat analisis beban kerja tenaga medis per faskes',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 3. Monitoring Ketersediaan Tempat Tidur & BOR se-Kabupaten
const getBedMonitoring = async (req, res, next) => {
  try {
    const data = await dinkesService.getBedMonitoring(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat monitoring tempat tidur faskes rawat inap',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 4. Monitoring Aset & Alkes Kritis Faskes
const getCriticalAssetsMonitoring = async (req, res, next) => {
  try {
    const data = await dinkesService.getCriticalAssetsMonitoring(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat kondisi alat kesehatan dan sarpras faskes',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 5. Monitoring Logistik & Stok Obat Kritis
const getMedicineStockAlerts = async (req, res, next) => {
  try {
    const data = await dinkesService.getMedicineStockAlerts(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat peringatan ketersediaan obat faskes',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 6. Surveilans Epidemiologi (10 Besar Penyakit se-Kabupaten)
const getDiseaseSurveillance = async (req, res, next) => {
  try {
    const data = await dinkesService.getDiseaseSurveillance(req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat data surveilans penyakit daerah',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 7. Manajemen Master Faskes
const getFaskesList = async (req, res, next) => {
  try {
    const data = await dinkesService.getFaskesList(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const getFaskesById = async (req, res, next) => {
  try {
    const data = await dinkesService.getFaskesById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Faskes tidak ditemukan' });
    }
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const createFaskes = async (req, res, next) => {
  try {
    const data = await dinkesService.createFaskes(req.body);
    res.status(201).json({
      success: true,
      message: 'Faskes baru berhasil didaftarkan',
      data
    });
  } catch (error) {
    next(error);
  }
};

const updateFaskes = async (req, res, next) => {
  try {
    const data = await dinkesService.updateFaskes(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Data faskes berhasil diperbarui',
      data
    });
  } catch (error) {
    next(error);
  }
};

const deleteFaskes = async (req, res, next) => {
  try {
    await dinkesService.deleteFaskes(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Faskes berhasil dinonaktifkan'
    });
  } catch (error) {
    next(error);
  }
};

// 8. Redistribusi / Mutasi Tenaga Medis
const createMutasiNakes = async (req, res, next) => {
  try {
    const data = await dinkesService.createMutasiNakes(req.body);
    res.status(201).json({
      success: true,
      message: 'Surat penugasan / mutasi tenaga medis berhasil diterbitkan',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getMutasiHistory = async (req, res, next) => {
  try {
    const data = await dinkesService.getMutasiHistory(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExecutiveSummary,
  getWorkloadAnalytics,
  getBedMonitoring,
  getCriticalAssetsMonitoring,
  getMedicineStockAlerts,
  getDiseaseSurveillance,
  getFaskesList,
  getFaskesById,
  createFaskes,
  updateFaskes,
  deleteFaskes,
  createMutasiNakes,
  getMutasiHistory
};
