const kasirService = require('../services/kasir.service');

const getAntrianKasir = async (req, res, next) => {
  try {
    const antrian = await kasirService.getAntrianKasir(req.user);
    res.json({ success: true, data: antrian });
  } catch (error) {
    next(error);
  }
};

const getRiwayatKasir = async (req, res, next) => {
  try {
    const riwayat = await kasirService.getRiwayatKasir(req.user);
    res.json({ success: true, data: riwayat });
  } catch (error) {
    next(error);
  }
};

const getTagihan = async (req, res, next) => {
  try {
    const tagihan = await kasirService.getTagihan(req.params.tagihanId);
    if (!tagihan) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
    }
    res.json({ success: true, data: tagihan });
  } catch (error) {
    next(error);
  }
};

const generateTagihan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.body;
    if (!kunjunganId) {
      return res.status(400).json({ success: false, message: 'kunjunganId wajib diisi' });
    }
    const tagihan = await kasirService.generateTagihan(kunjunganId);
    res.json({ success: true, data: tagihan });
  } catch (error) {
    next(error);
  }
};

const prosesPembayaran = async (req, res, next) => {
  try {
    const tagihanId = req.params.tagihanId;
    const userId = req.user.id; // From verifyToken middleware
    const result = await kasirService.prosesPembayaran(tagihanId, userId, req.body);
    res.json({ success: true, message: 'Pembayaran berhasil diproses', data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAntrianKasir,
  getRiwayatKasir,
  getTagihan,
  generateTagihan,
  prosesPembayaran,
};
