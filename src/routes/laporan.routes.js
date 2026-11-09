const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporan.controller');
const { protect } = require('../middlewares/auth.middleware');

// Seluruh endpoint laporan diproteksi autentikasi JWT
router.use(protect);

// 1. Laporan Kunjungan Pasien (Harian, Bulanan, Tahunan)
router.get('/kunjungan', laporanController.getLaporanKunjungan);

// 2. Laporan Rekapitulasi Morbiditas / 10 Besar Diagnosis (LB1)
router.get('/morbiditas', laporanController.getLaporanMorbiditas);

// 3. Laporan Penggunaan & Mutasi BMHP
router.get('/bmhp', laporanController.getLaporanBMHP);

// 4. Laporan Penggunaan & Kondisi Alkes
router.get('/alkes', laporanController.getLaporanAlkes);

// 5. Laporan Kinerja Tenaga Medis (Dokter & Perawat)
router.get('/kinerja-nakes', laporanController.getLaporanKinerjaNakes);

module.exports = router;

