const express = require('express');
const rawatJalanController = require('../controllers/rawatJalan.controller');
const { protect } = require('../middlewares/auth.middleware');
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
router.post('/:kunjunganId/mulai', rawatJalanController.mulaiPemeriksaan);

// Simpan SOAP
router.put('/:rekamMedisId/soap', rawatJalanController.simpanSOAP);

// Simpan Diagnosa ICD-10 (bulk)
router.post('/:kunjunganId/diagnosa', rawatJalanController.simpanDiagnosa);

// Simpan Tindakan ICD-9 (bulk)
router.post('/:kunjunganId/tindakan', rawatJalanController.simpanTindakan);

// Simpan Alergi (bulk)
router.post('/:kunjunganId/alergi', rawatJalanController.simpanAlergi);

// Get rekam medis by kunjungan
router.get('/:kunjunganId/rekam-medis', rawatJalanController.getRekamMedis);

// Get diagnosa by kunjungan
router.get('/:kunjunganId/diagnosa', rawatJalanController.getDiagnosa);

// Get tindakan by kunjungan
router.get('/:kunjunganId/tindakan', rawatJalanController.getTindakan);

// Get alergi by kunjungan
router.get('/:kunjunganId/alergi', rawatJalanController.getAlergi);

// Selesaikan pemeriksaan (Fase 1 Klinis Selesai)
router.post('/:kunjunganId/selesai', rawatJalanController.selesaikanPemeriksaan);

// Tunda pemeriksaan (Kedaruratan / Ganti Pasien)
router.post('/:kunjunganId/tunda', rawatJalanController.tundaPemeriksaan);

// Tindak Lanjut: Simpan Resep Obat & Ambil Resep Kunjungan
router.post('/:kunjunganId/resep', rawatJalanController.simpanResep);
router.get('/:kunjunganId/resep', rawatJalanController.getResep);

// Tindak Lanjut: Simpan Rujukan
router.post('/:kunjunganId/rujukan', rawatJalanController.simpanRujukan);

// Tindak Lanjut: Assign ke Ruang Rawat Inap (Opname)
router.post('/:kunjunganId/rawat-inap', rawatJalanController.assignRawatInap);

// Tindak Lanjut: Pasien Pulang (Tanpa resep/rujukan)
router.post('/:kunjunganId/pulang', rawatJalanController.pulang);

// Tindak Lanjut: Pasien Meninggal Dunia (UGD / Kedaruratan)
router.post('/:kunjunganId/meninggal', rawatJalanController.catatMeninggal);

// Tindak Lanjut: Pulangkan Pasien Rawat Inap (Discharge Inap & Finalisasi Kasir)
router.post('/:kunjunganId/discharge-rawat-inap', rawatJalanController.dischargeRawatInap);

// CPPT Rawat Inap & RME Integrasi
router.post('/:kunjunganId/cppt', rawatJalanController.simpanCPPT);
router.get('/:kunjunganId/cppt', rawatJalanController.getRiwayatCPPT);
router.get('/:kunjunganId/rekam-medis-sebelumnya', rawatJalanController.getRekamMedisSebelumnya);

module.exports = router;

