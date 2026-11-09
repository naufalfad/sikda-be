const express = require('express');
const rawatJalanController = require('../controllers/rawatJalan.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const DOCTOR_OR_ADMIN = ['DOKTER', 'DOKTER_UGD', 'ADMIN', 'SUPERADMIN'];
const CLINICAL_STAFF = ['DOKTER', 'DOKTER_UGD', 'PERAWAT', 'ADMIN', 'SUPERADMIN'];
const { uploadFotoKlinis } = require('../middlewares/upload.middleware');

const router = express.Router();

// Semua API rawat jalan harus login
router.use(protect);

// Upload Foto Klinis (SOAP Objektif)
router.post('/upload-foto-klinis', uploadFotoKlinis.any(), rawatJalanController.uploadFotoKlinis);

// Antrian pasien
router.get('/antrian', rawatJalanController.getAntrianDokter);

// Riwayat pasien selesai (semua pasien)
router.get('/riwayat', rawatJalanController.getRiwayatDokter);

// Riwayat detail satu pasien berdasarkan noRM
router.get('/riwayat/pasien/:noRM', rawatJalanController.getRiwayatPasienByRM);

// Mulai pemeriksaan (buat RekamMedis DRAFT + lock status)
router.post('/:kunjunganId/mulai', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.mulaiPemeriksaan);

// Simpan SOAP
router.put('/:rekamMedisId/soap', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.simpanSOAP);

// Simpan Diagnosa ICD-10 (bulk)
router.post('/:kunjunganId/diagnosa', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.simpanDiagnosa);

// Simpan Tindakan ICD-9 (bulk)
router.post('/:kunjunganId/tindakan', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.simpanTindakan);

// Simpan Alergi (bulk)
router.post('/:kunjunganId/alergi', restrictTo(...CLINICAL_STAFF), rawatJalanController.simpanAlergi);

// Get rekam medis by kunjungan
router.get('/:kunjunganId/rekam-medis', rawatJalanController.getRekamMedis);

// Get diagnosa by kunjungan
router.get('/:kunjunganId/diagnosa', rawatJalanController.getDiagnosa);

// Get tindakan by kunjungan
router.get('/:kunjunganId/tindakan', rawatJalanController.getTindakan);

// Get alergi by kunjungan
router.get('/:kunjunganId/alergi', rawatJalanController.getAlergi);

// Selesaikan pemeriksaan (Fase 1 Klinis Selesai)
router.post('/:kunjunganId/selesai', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.selesaikanPemeriksaan);

// Tunda pemeriksaan (Kedaruratan / Ganti Pasien)
router.post('/:kunjunganId/tunda', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.tundaPemeriksaan);

// Tindak Lanjut: Simpan Resep Obat & Ambil Resep Kunjungan
router.post('/:kunjunganId/resep', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.simpanResep);
router.get('/:kunjunganId/resep', rawatJalanController.getResep);

// Tindak Lanjut: Simpan Rujukan
router.post('/:kunjunganId/rujukan', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.simpanRujukan);

// Tindak Lanjut: Assign ke Ruang Rawat Inap (Opname)
router.post('/:kunjunganId/rawat-inap', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.assignRawatInap);

// Tindak Lanjut: Pasien Pulang (Tanpa resep/rujukan)
router.post('/:kunjunganId/pulang', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.pulang);

// Tindak Lanjut: Pasien Meninggal Dunia (UGD / Kedaruratan)
router.post('/:kunjunganId/meninggal', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.catatMeninggal);

// Tindak Lanjut: Pulangkan Pasien Rawat Inap (Discharge Inap & Finalisasi Kasir)
router.post('/:kunjunganId/discharge-rawat-inap', restrictTo(...DOCTOR_OR_ADMIN), rawatJalanController.dischargeRawatInap);

// CPPT Rawat Inap & RME Integrasi
router.post('/:kunjunganId/cppt', rawatJalanController.simpanCPPT);
router.get('/:kunjunganId/cppt', rawatJalanController.getRiwayatCPPT);
router.get('/:kunjunganId/rekam-medis-sebelumnya', rawatJalanController.getRekamMedisSebelumnya);

module.exports = router;

