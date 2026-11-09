const express = require('express');
const router = express.Router();
const remunerasiController = require('../controllers/remunerasi.controller');
const { protect } = require('../middlewares/auth.middleware');

// Seluruh endpoint remunerasi mewajibkan login (Bearer Token)
router.use(protect);

// Master Tarif Fee
router.get('/tarif', remunerasiController.getMasterTarif);
router.put('/tarif', remunerasiController.updateMasterTarif);

// Presensi Mandiri Tenaga Medis
router.post('/presensi/check-in', remunerasiController.checkInMandiri);
router.get('/presensi/today', remunerasiController.getTodayPresensi);

// Manajemen Presensi (Admin / Loket)
router.get('/presensi', remunerasiController.getPresensiList);
router.post('/presensi/admin', remunerasiController.adminInputPresensi);
router.delete('/presensi/:id', remunerasiController.deletePresensi);

// Rekapitulasi Fee Nakes
router.get('/rekap-dokter', remunerasiController.getRekapFeeDokter);
router.get('/rekap-perawat', remunerasiController.getRekapFeePerawat);

// Dashboard & Eksekutif KPI
router.get('/dashboard', remunerasiController.getDashboardSummary);

// Pembayaran & Settlement Fee
router.post('/bayar', remunerasiController.bayarFeeNakes);

// Sinkronisasi Kunjungan Lampau ke Fee Dokter
router.post('/sync-fee-dokter', remunerasiController.syncKunjunganToFeeDokter);

module.exports = router;

