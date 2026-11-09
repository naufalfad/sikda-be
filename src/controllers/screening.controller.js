const screeningService = require('../services/screening.service');

const createScreening = async (req, res, next) => {
  try {
    const data = req.body;
    // Inject nama petugas dan faskes dari token JWT
    data.petugasNama = req.user?.namaLengkap || req.user?.username || 'Perawat';
    if (!data.faskesId && req.user?.faskesId) {
      data.faskesId = req.user.faskesId;
    }

    const result = await screeningService.createScreening(data, req.user?.id);

    res.status(201).json({
      success: true,
      message: 'Data screening berhasil disimpan',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getScreeningByKunjungan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const result = await screeningService.getScreeningByKunjungan(kunjunganId);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Data screening tidak ditemukan' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createScreening,
  getScreeningByKunjungan,
};
