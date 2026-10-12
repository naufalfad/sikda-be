const ugdService = require('../services/ugd.service');

const ugdController = {
  /**
   * GET /api/ugd/beds
   */
  getBedsUGD: async (req, res, next) => {
    try {
      const faskesId = req.query.faskesId || req.user?.faskesId;
      const data = await ugdService.getBedsUGD(faskesId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/ugd/antrean
   */
  getAntreanUGD: async (req, res, next) => {
    try {
      const faskesId = req.query.faskesId || req.user?.faskesId;
      const data = await ugdService.getAntreanUGD(faskesId, req.user, req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/ugd/pending-administrasi
   */
  getPendingAdministrasi: async (req, res, next) => {
    try {
      const faskesId = req.query.faskesId || req.user?.faskesId;
      const data = await ugdService.getPendingAdministrasi(faskesId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/ugd/admit
   * Dilakukan oleh Perawat UGD untuk penerimaan darurat
   */
  admitPasienDarurat: async (req, res, next) => {
    try {
      const result = await ugdService.admitPasienDarurat(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Pasien darurat berhasil ditempatkan di Bed UGD',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/ugd/:id/lengkapi-administrasi
   * Dilakukan oleh Petugas Loket untuk update administrasi
   */
  lengkapiAdministrasi: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await ugdService.lengkapiAdministrasi(id, req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Administrasi pasien UGD berhasil diselesaikan',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/ugd/:id/pemeriksaan
   * Dilakukan oleh Dokter UGD
   */
  simpanPemeriksaanUGD: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await ugdService.simpanPemeriksaanUGD(id, req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Hasil pemeriksaan dan tindakan UGD berhasil disimpan',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT/POST /api/ugd/:id/triase
   * Dilakukan oleh Perawat UGD untuk update triase dan observasi tanda vital
   */
  updateTriaseObservasi: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await ugdService.updateTriaseObservasi(id, req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Hasil triase dan observasi tanda vital berhasil diperbarui',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ugdController;
