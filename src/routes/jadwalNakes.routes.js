const express = require('express');
const router = express.Router();
const jadwalNakesController = require('../controllers/jadwalNakes.controller');
const { protect } = require('../middlewares/auth.middleware');

// 0. Public Route: Direktori Dokter & Jadwal Praktik Publik (Landing Page & Reservasi Online Pasien)
router.get('/public-directory', jadwalNakesController.getPublicDoctorDirectory);

// Seluruh endpoint jadwal administrasi & dinas mewajibkan login token JWT
router.use(protect);

// 1. Endpoint Loket & Pendaftaran Pasien (Dokter bertugas hari ini / per tanggal)
router.get('/dokter-bertugas/:poliId', jadwalNakesController.getDokterBertugasByPoli);

// 2. Options Nakes (Dropdown pilihan dokter/perawat/pengganti)
router.get('/options/nakes', jadwalNakesController.getNakesOptions);

// 3. Izin & Cuti Nakes (diletakkan sebelum /:id agar tidak tertabrak route params)
router.get('/izin-cuti', jadwalNakesController.getIzinCutiList);
router.post('/izin-cuti', jadwalNakesController.createIzinCuti);
router.put('/izin-cuti/:id', jadwalNakesController.updateIzinCuti);
router.delete('/izin-cuti/:id', jadwalNakesController.deleteIzinCuti);

// 4. Manajemen Jadwal & Roster
router.get('/user/:userId', jadwalNakesController.getJadwalByUserId);
router.post('/bulk', jadwalNakesController.saveBulkRoster);
router.get('/', jadwalNakesController.getJadwalList);
router.post('/', jadwalNakesController.upsertJadwal);
router.delete('/:id', jadwalNakesController.deleteJadwal);

module.exports = router;
