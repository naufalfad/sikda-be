const kunjunganService = require('../services/kunjungan.service');

const getKunjunganScreening = async (req, res, next) => {
  try {
    const data = await kunjunganService.getKunjunganScreening(req.user);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

const panggilKunjungan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const petugasId = req.user.id;
    const result = await kunjunganService.panggilKunjungan(id, petugasId);

    res.status(200).json({
      success: true,
      message: 'Berhasil memanggil pasien',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getKunjunganById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await kunjunganService.getKunjunganById(id);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// [BARU] State Transition Controller
// Digunakan untuk mengubah arah/status kunjungan (e.g., MENUNGGU_RADIOLOGI)
// =========================================================================
const updateStatusKunjungan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validasi Lapisan Interface (Mencegah payload kosong)
    if (!status) {
      const error = new Error('Property "status" wajib dikirimkan dalam body request.');
      error.statusCode = 400;
      throw error;
    }

    const result = await kunjunganService.updateStatusKunjungan(id, status);

    res.status(200).json({
      success: true,
      message: `Status antrian berhasil diperbarui menjadi: ${status}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const data = await kunjunganService.getDashboardStats(req.user);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

const getPerawatDashboardStats = async (req, res, next) => {
  try {
    const data = await kunjunganService.getPerawatDashboardStats(req.user);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

const getDokterDashboardStats = async (req, res, next) => {
  try {
    const data = await kunjunganService.getDokterDashboardStats(req.user);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

const getKunjunganFhirPreview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await kunjunganService.getKunjunganFhirPreview(id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKunjunganScreening,
  panggilKunjungan,
  getKunjunganById,
  updateStatusKunjungan,
  getDashboardStats,
  getPerawatDashboardStats,
  getDokterDashboardStats,
  getKunjunganFhirPreview,
};
