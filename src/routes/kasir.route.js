const express = require('express');
const router = express.Router();
const kasirController = require('../controllers/kasir.controller');
const { protect } = require('../middlewares/auth.middleware');

// Middleware untuk proteksi (hanya admin/kasir yang boleh akses jika dibutuhkan, atau sesuaikan)
// router.use(protect);

router.get('/antrian', protect, kasirController.getAntrianKasir);
router.get('/riwayat', protect, kasirController.getRiwayatKasir);
router.post('/generate', protect, kasirController.generateTagihan);
router.post('/preview', protect, kasirController.previewTagihan);
router.get('/:tagihanId', protect, kasirController.getTagihan);
router.post('/:tagihanId/bayar', protect, kasirController.prosesPembayaran);

module.exports = router;
