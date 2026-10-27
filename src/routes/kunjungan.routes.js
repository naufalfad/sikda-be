const express = require('express');
const kunjunganController = require('../controllers/kunjungan.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Semua API Kunjungan harus login
router.use(protect);

router.get('/screening', kunjunganController.getKunjunganScreening);
router.get('/dashboard-stats', kunjunganController.getDashboardStats);
router.get('/perawat/dashboard-stats', kunjunganController.getPerawatDashboardStats);
router.get('/dokter/dashboard-stats', kunjunganController.getDokterDashboardStats);
router.get('/dokter/kinerja-harian', kunjunganController.getDokterKinerjaHarian);
router.get('/admin/monitoring-dokter', kunjunganController.getAdminMonitoringDokter);
router.get('/:id/fhir-preview', kunjunganController.getKunjunganFhirPreview);
router.get('/:id', kunjunganController.getKunjunganById);
router.post('/:id/panggil', kunjunganController.panggilKunjungan);
router.put('/:id/status', kunjunganController.updateStatusKunjungan);

module.exports = router;
