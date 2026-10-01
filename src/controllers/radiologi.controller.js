const radiologiService = require('../services/radiologi.service');

const radiologiController = {
  // 1. POST /api/radiologi/order (Dokter Poli membuat order)
  createOrder: async (req, res, next) => {
    try {
      const dokterId = req.user?.id || req.body.dokterId;
      const data = { ...req.body, dokterId };

      const result = await radiologiService.createOrder(data);

      res.status(201).json({
        success: true,
        message: 'Order radiologi berhasil dibuat',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // 2. GET /api/radiologi/order (Daftar antrian & riwayat order)
  getOrders: async (req, res, next) => {
    try {
      const result = await radiologiService.getAllOrders(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // 3. GET /api/radiologi/order/:id (Detail order radiologi)
  getOrderById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await radiologiService.getOrderById(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // 4. POST /api/radiologi/order/:id/hasil (Dokter/Petugas input ekspertise radiologi)
  submitHasil: async (req, res, next) => {
    try {
      const { id } = req.params;
      const dokterRadiologiId = req.user?.id || req.body.dokterRadiologiId;
      const data = { ...req.body, dokterRadiologiId };

      const result = await radiologiService.inputHasilEkspertise(id, data);

      res.status(200).json({
        success: true,
        message: 'Hasil ekspertise radiologi berhasil disimpan',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = radiologiController;