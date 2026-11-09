const express = require('express');
const router = express.Router();
const rujukanController = require('../controllers/rujukan.controller');
const { protect } = require('../middlewares/auth.middleware');

// Semua endpoint rujukan dilindungi auth middleware
router.use(protect);

// Get antrean rujukan keluar untuk Administrasi (Transfer Pasien ke RS)
router.get('/antrian', rujukanController.getAntrianRujukan);

// Get antrean rujukan penunjang untuk Administrasi (Order Lab Luar & Radiologi)
router.get('/antrian-penunjang', rujukanController.getAntrianPenunjang);

// Get detail rujukan (data kunjungan + rekam medis + rujukanKeluar) untuk preview surat
router.get('/kunjungan/:kunjunganId', rujukanController.getRujukanDetailByKunjungan);

// Kirim ServiceRequest rujukan ke SATUSEHAT (data lokal sudah tersimpan oleh rawatJalan)
router.post('/kunjungan/:kunjunganId/kirim-satusehat', rujukanController.kirimServiceRequestSatuSehat);

module.exports = router;
