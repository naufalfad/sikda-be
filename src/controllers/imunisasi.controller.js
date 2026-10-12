const imunisasiService = require('../services/imunisasi.service');
const SatuSehatMapper = require('../services/satusehat/imunisasi.mapper');
const SatuSehatGateway = require('../services/satusehat/gateway.service');
const prisma = require('../config/prisma');

const imunisasiController = {

    // ==========================================
    // ALUR INTERNAL (LOKAL)
    // ==========================================

    /**
     * Mengambil daftar master vaksin KFA
     */
    getMasterVaksin: async (req, res, next) => {
        try {
            const faskesId = req.query.faskesId || req.user?.faskesId;
            const data = await imunisasiService.getAllMasterVaksin(faskesId);
            res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mengambil daftar stok batch vaksin yang tersedia berdasarkan ID Vaksin
     */
    getBatchVaksin: async (req, res, next) => {
        try {
            const { vaksinId } = req.params;
            const faskesId = req.query.faskesId || req.user?.faskesId;
            const data = await imunisasiService.getBatchByVaksin(vaksinId, faskesId);
            res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mencatat riwayat imunisasi pasien (Sekaligus potong stok jika di Puskesmas)
     */
    catatRiwayat: async (req, res, next) => {
        try {
            // Ambil ID petugas yang sedang login (dari middleware auth)
            const petugasId = req.user?.id;

            const riwayat = await imunisasiService.catatRiwayat(req.body, petugasId);

            res.status(201).json({
                success: true,
                message: 'Data riwayat imunisasi berhasil dicatat.',
                data: riwayat,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mengambil riwayat lengkap berdasarkan ID Pasien (Untuk keperluan Buku KIA Digital)
     */
    getRiwayatPasien: async (req, res, next) => {
        try {
            const { pasienId } = req.params;
            const data = await imunisasiService.getRiwayatByPasien(pasienId);
            res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // ALUR INTEGRASI PIHAK KETIGA (SATUSEHAT)
    // ==========================================

    /**
     * Orkestrasi Pengiriman Data Imunisasi ke SATUSEHAT
     */
    syncKeSatuSehat: async (req, res, next) => {
        try {
            const { id } = req.params; // ID dari RiwayatImunisasi

            // Langkah 1: Minta data komplit ke Service (Information Expert)
            const dataLokal = await imunisasiService.getRiwayatLengkapById(id);

            if (!dataLokal) {
                return res.status(404).json({ success: false, message: 'Data riwayat imunisasi tidak ditemukan.' });
            }

            // Langkah 2: Pengecekan Privacy Guard (Persetujuan Pasien)
            if (!dataLokal.pasien.persetujuan?.persetujuanSatusehat) {
                return res.status(403).json({
                    success: false,
                    message: 'DITOLAK: Pasien (atau wali) belum memberikan persetujuan pengiriman data ke SATUSEHAT.',
                });
            }

            // Langkah 3: Transformasi data lokal menjadi JSON FHIR (Pure Fabrication)
            const fhirPayload = SatuSehatMapper.toImmunization(dataLokal);

            // Langkah 4: Tembak ke Kemenkes via Gateway (Indirection)
            const satusehatResponse = await SatuSehatGateway.postResource('Immunization', fhirPayload);

            // Langkah 5: Simpan "Tanda Terima" (ID SATUSEHAT) ke database internal kita
            // (Bisa juga dipindah ke service, tapi dilakukan disini agar controller mengontrol flow integrasi)
            const updatedRiwayat = await prisma.riwayatImunisasi.update({
                where: { id: id },
                data: {
                    satusehatId: satusehatResponse.id // Field "id" dari respons FHIR
                }
            });

            res.status(200).json({
                success: true,
                message: 'Berhasil sinkronisasi data Imunisasi ke SATUSEHAT.',
                data: {
                    idLokal: updatedRiwayat.id,
                    satusehatId: updatedRiwayat.satusehatId,
                }
            });

        } catch (error) {
            // Tangkap error spesifik dari Gateway (seperti salah KFA, salah format tanggal)
            if (error.details) {
                return res.status(error.statusCode || 400).json({
                    success: false,
                    message: error.message,
                    satusehat_error: error.details // Penting untuk debugging Frontend
                });
            }
            next(error); // Lempar ke Error Handler Middleware bawaan teman Anda
        }
    }

};

module.exports = imunisasiController;