const express = require('express');
const router = express.Router();
const asetRuanganController = require('../controllers/asetRuangan.controller');
const { protect } = require('../middlewares/auth.middleware');

// Seluruh rute aset & ruangan memerlukan autentikasi login
router.use(protect);

// 1. Ruangan Routes
router.get('/ruangan', asetRuanganController.getRuangans);
router.get('/ruangan/:id', asetRuanganController.getRuanganById);
router.post('/ruangan', asetRuanganController.createRuangan);
router.put('/ruangan/:id', asetRuanganController.updateRuangan);
router.delete('/ruangan/:id', asetRuanganController.deleteRuangan);
router.post('/ruangan/:id/sync-satusehat', asetRuanganController.syncRuanganSatuSehat);

// 2. Bed Management Routes
router.get('/bed', asetRuanganController.getBeds);
router.get('/bed/stats', asetRuanganController.getBedStats);
router.post('/bed', asetRuanganController.createBed);
router.put('/bed/:id', asetRuanganController.updateBed);
router.delete('/bed/:id', asetRuanganController.deleteBed);
router.post('/bed/:id/sync-satusehat', asetRuanganController.syncBedSatuSehat);

// 3. Aset Ruangan Routes
router.get('/aset', asetRuanganController.getAsets);
router.get('/aset/stats', asetRuanganController.getAsetStats);
router.get('/aset/:id', asetRuanganController.getAsetById);
router.post('/aset', asetRuanganController.createAset);
router.put('/aset/:id', asetRuanganController.updateAset);
router.delete('/aset/:id', asetRuanganController.deleteAset);
router.post('/aset/:id/sync-satusehat', asetRuanganController.syncDeviceSatuSehat);

// 4. Pemeliharaan & Kalibrasi Routes
router.get('/pemeliharaan', asetRuanganController.getPemeliharaans);
router.get('/pemeliharaan/alerts', asetRuanganController.getKalibrasiAlerts);
router.post('/pemeliharaan', asetRuanganController.createPemeliharaan);
router.put('/pemeliharaan/:id', asetRuanganController.updatePemeliharaan);

// 5. Mutasi Aset Routes
router.get('/mutasi', asetRuanganController.getMutasiHistory);
router.post('/mutasi', asetRuanganController.mutasiAset);

module.exports = router;
