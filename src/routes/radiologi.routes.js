const express = require('express');
const router = express.Router();
const radiologiController = require('../controllers/radiologi.controller');
const { protect } = require('../middlewares/auth.middleware');

// Menerapkan middleware autentikasi untuk semua endpoint radiologi
router.use(protect);

// 1. POST /api/radiologi/order (Membuat Order Radiologi)
router.post('/order', radiologiController.createOrder);

// 2. GET /api/radiologi/order (Mendapatkan Daftar Order Radiologi)
router.get('/order', radiologiController.getOrders);

// 3. GET /api/radiologi/order/:id (Detail Order Radiologi)
router.get('/order/:id', radiologiController.getOrderById);

// 4. POST /api/radiologi/order/:id/hasil (Input Hasil & Ekspertise Radiologi)
router.post('/order/:id/hasil', radiologiController.submitHasil);
router.post('/order/:id/hasil-rujukan', radiologiController.submitHasilRujukanLuar);

module.exports = router;