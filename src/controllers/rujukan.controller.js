const rujukanService = require('../services/rujukan.service');

/**
 * GET /api/rujukan/antrian
 * Ambil seluruh daftar kunjungan yang memiliki rujukan keluar untuk Administrasi
 */
const getAntrianRujukan = async (req, res, next) => {
  try {
    const rujukanList = await rujukanService.getAntrianRujukan(req.user);
    res.json({
      status: 'success',
      data: rujukanList
    });
  } catch (error) {
    console.error('Error in getAntrianRujukan:', error);
    next(error);
  }
};

/**
 * GET /api/rujukan/kunjungan/:kunjunganId
 * Ambil detail kunjungan + rujukanKeluar yang sudah tersimpan oleh dokter
 */
const getRujukanDetailByKunjungan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const kunjungan = await rujukanService.getRujukanDetailByKunjungan(kunjunganId);

    if (!kunjungan) {
      return res.status(404).json({
        status: 'error',
        message: 'Kunjungan tidak ditemukan'
      });
    }

    res.json({
      status: 'success',
      data: kunjungan
    });
  } catch (error) {
    console.error('Error in getRujukanDetailByKunjungan:', error);
    next(error);
  }
};

/**
 * POST /api/rujukan/kunjungan/:kunjunganId/kirim-satusehat
 * Kirim ServiceRequest (Rujukan) ke SATUSEHAT
 */
const kirimServiceRequestSatuSehat = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const result = await rujukanService.kirimServiceRequestSatuSehat(kunjunganId);

    res.json({
      status: 'success',
      message: 'ServiceRequest rujukan berhasil diproses ke SATUSEHAT',
      data: result
    });
  } catch (error) {
    console.error('Error in kirimServiceRequestSatuSehat:', error);
    next(error);
  }
};

module.exports = {
  getAntrianRujukan,
  getRujukanDetailByKunjungan,
  kirimServiceRequestSatuSehat
};
