const express = require('express');
const router = express.Router();
const klinikController = require('../controllers/klinik.controller');
const { protect } = require('../middlewares/auth.middleware'); // Optional: jika ingin dibatasi

// Karena Master Klinik digunakan oleh modul pendaftaran dan admin,
// Kita asumsikan perlu token JWT.
router.use(protect);

// Poliklinik routes
router.get('/poli', klinikController.getPoliklinik);
router.post('/poli', klinikController.createPoliklinik);
router.put('/poli/:id', klinikController.updatePoliklinik);

// Layanan routes
router.get('/layanan/:poliId', klinikController.getLayananByPoli);
router.post('/layanan', klinikController.createLayanan);
router.put('/layanan/:id', klinikController.updateLayanan);

// Dokter routes
router.get('/dokter/:poliId', klinikController.getDokterByPoli);

// Kapabilitas Penunjang (Laboratorium & Radiologi) terisolasi per-Faskes
router.get('/kapabilitas', klinikController.getFaskesKapabilitas);
router.put('/kapabilitas', klinikController.updateFaskesKapabilitas);

module.exports = router;
