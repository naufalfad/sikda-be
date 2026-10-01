const express = require('express');
const router = express.Router();
const farmasiController = require('../controllers/farmasi.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// Rute untuk Antrian Farmasi
router.get('/antrian', farmasiController.getAntrianFarmasi);
router.get('/resep/:id', farmasiController.getResepById);
router.post('/resep/:id/proses', farmasiController.prosesResep);

// Rute untuk Stok Obat Faskes & Analisis FEFO (First Expired First Out)
router.get('/stok', farmasiController.getStokFaskes);
router.post('/stok/masuk', farmasiController.tambahStokMasuk);
router.post('/stok/keluar', farmasiController.kurangiStokKeluar);

// Rute untuk Stok & Cold-Chain Vaksin Faskes
router.get('/vaksin/stok', farmasiController.getStokVaksinFaskes);
router.post('/vaksin/masuk', farmasiController.tambahStokVaksinMasuk);
router.post('/vaksin/keluar', farmasiController.kurangiStokVaksinKeluar);

module.exports = router;
