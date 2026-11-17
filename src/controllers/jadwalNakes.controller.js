const jadwalNakesService = require('../services/jadwalNakes.service');

const getDokterBertugasByPoli = async (req, res, next) => {
  try {
    const { poliId } = req.params;
    const { tanggal, faskesId, hanyaBertugas, jam } = req.query;
    const isHanyaBertugas = hanyaBertugas === 'true' || hanyaBertugas === true;

    const data = await jadwalNakesService.getDokterBertugasByPoli(
      poliId,
      tanggal,
      req.user,
      faskesId,
      isHanyaBertugas,
      jam
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getJadwalList = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.getJadwalList(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getJadwalByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const data = await jadwalNakesService.getJadwalByUserId(userId, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const upsertJadwal = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.upsertJadwal(req.user, req.body);
    res.json({ success: true, message: 'Jadwal berhasil disimpan', data });
  } catch (error) {
    next(error);
  }
};

const saveBulkRoster = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.saveBulkRoster(req.user, req.body);
    res.json({ success: true, message: 'Roster mingguan berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const deleteJadwal = async (req, res, next) => {
  try {
    await jadwalNakesService.deleteJadwal(req.user, req.params.id);
    res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const getIzinCutiList = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.getIzinCutiList(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createIzinCuti = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.createIzinCuti(req.user, req.body);
    res.json({ success: true, message: 'Izin/Cuti berhasil dicatat', data });
  } catch (error) {
    next(error);
  }
};

const updateIzinCuti = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.updateIzinCuti(req.user, req.params.id, req.body);
    res.json({ success: true, message: 'Data izin/cuti berhasil diperbarui', data });
  } catch (error) {
    next(error);
  }
};

const deleteIzinCuti = async (req, res, next) => {
  try {
    await jadwalNakesService.deleteIzinCuti(req.user, req.params.id);
    res.json({ success: true, message: 'Data izin/cuti berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

const getNakesOptions = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.getNakesOptions(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getPublicDoctorDirectory = async (req, res, next) => {
  try {
    const data = await jadwalNakesService.getPublicDoctorDirectory(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDokterBertugasByPoli,
  getJadwalList,
  getJadwalByUserId,
  upsertJadwal,
  saveBulkRoster,
  deleteJadwal,
  getIzinCutiList,
  createIzinCuti,
  updateIzinCuti,
  deleteIzinCuti,
  getNakesOptions,
  getPublicDoctorDirectory,
};
