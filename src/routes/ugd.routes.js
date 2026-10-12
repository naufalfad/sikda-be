const express = require('express');
const ugdController = require('../controllers/ugd.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/beds', ugdController.getBedsUGD);
router.get('/antrean', ugdController.getAntreanUGD);
router.get('/pending-administrasi', ugdController.getPendingAdministrasi);
router.post('/admit', ugdController.admitPasienDarurat);

// Route Lengkapi Administrasi (mendukung format /:id/lengkapi-administrasi dan /administrasi/:id)
router.post('/:id/lengkapi-administrasi', ugdController.lengkapiAdministrasi);
router.put('/:id/lengkapi-administrasi', ugdController.lengkapiAdministrasi);
router.post('/administrasi/:id', ugdController.lengkapiAdministrasi);
router.put('/administrasi/:id', ugdController.lengkapiAdministrasi);

// Route Update Triase & Observasi Tanda Vital Perawat (mendukung format /:id/triase dan /triase/:id)
router.post('/:id/triase', ugdController.updateTriaseObservasi);
router.put('/:id/triase', ugdController.updateTriaseObservasi);
router.post('/triase/:id', ugdController.updateTriaseObservasi);
router.put('/triase/:id', ugdController.updateTriaseObservasi);

// Route Simpan Pemeriksaan & Discharge (mendukung format /:id/pemeriksaan dan /pemeriksaan/:id)
router.post('/:id/pemeriksaan', ugdController.simpanPemeriksaanUGD);
router.post('/pemeriksaan/:id', ugdController.simpanPemeriksaanUGD);

module.exports = router;
