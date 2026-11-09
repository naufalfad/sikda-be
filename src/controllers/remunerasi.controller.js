const remunerasiService = require('../services/remunerasi.service');

const getMasterTarif = async (req, res, next) => {
  try {
    const data = await remunerasiService.getMasterTarif(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateMasterTarif = async (req, res, next) => {
  try {
    const data = await remunerasiService.updateMasterTarif(req.user, req.body);
    res.json({ success: true, message: 'Tarif remunerasi berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const checkInMandiri = async (req, res, next) => {
  try {
    const data = await remunerasiService.checkInMandiri(req.user, req.body);
    res.json({ success: true, message: 'Presensi kehadiran berhasil dicatat', data });
  } catch (error) {
    next(error);
  }
};

const getTodayPresensi = async (req, res, next) => {
  try {
    const data = await remunerasiService.getTodayPresensi(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const adminInputPresensi = async (req, res, next) => {
  try {
    const data = await remunerasiService.adminInputPresensi(req.user, req.body);
    res.json({ success: true, message: 'Presensi nakes berhasil disimpan', data });
  } catch (error) {
    next(error);
  }
};

const deletePresensi = async (req, res, next) => {
  try {
    await remunerasiService.deletePresensi(req.user, req.params.id);
    res.json({ success: true, message: 'Presensi berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const getPresensiList = async (req, res, next) => {
  try {
    const data = await remunerasiService.getPresensiList(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRekapFeeDokter = async (req, res, next) => {
  try {
    const data = await remunerasiService.getRekapFeeDokter(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRekapFeePerawat = async (req, res, next) => {
  try {
    const data = await remunerasiService.getRekapFeePerawat(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getDashboardSummary = async (req, res, next) => {
  try {
    const data = await remunerasiService.getDashboardSummary(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const bayarFeeNakes = async (req, res, next) => {
  try {
    const data = await remunerasiService.bayarFeeNakes(req.user, req.body);
    res.json({ success: true, message: 'Status pembayaran fee berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const syncKunjunganToFeeDokter = async (req, res, next) => {
  try {
    const data = await remunerasiService.syncKunjunganToFeeDokter(req.user, req.body);
    res.json({ success: true, message: 'Sinkronisasi fee dokter dari kunjungan selesai berhasil', data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMasterTarif,
  updateMasterTarif,
  checkInMandiri,
  getTodayPresensi,
  adminInputPresensi,
  deletePresensi,
  getPresensiList,
  getRekapFeeDokter,
  getRekapFeePerawat,
  getDashboardSummary,
  bayarFeeNakes,
  syncKunjunganToFeeDokter,
};

