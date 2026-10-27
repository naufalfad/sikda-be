const prisma = require('../config/prisma');
const kasirService = require('./kasir.service');
const { catatMutasiStok } = require('../utils/mutasiStok.helper');

const imunisasiService = {
    /**
     * Mengambil daftar master vaksin yang aktif (Untuk Dropdown & Katalog)
     */
    getAllMasterVaksin: async (faskesId = null) => {
        return await prisma.masterVaksin.findMany({
            where: { statusAktif: true },
            include: {
                batchVaksin: {
                    where: {
                        statusAktif: true,
                        stok: { gt: 0 },
                        tanggalExpired: { gt: new Date() },
                        ...(faskesId ? { faskesId } : {})
                    },
                    orderBy: { tanggalExpired: 'asc' }
                }
            },
            orderBy: { namaVaksin: 'asc' },
        });
    },

    /**
     * Mengambil daftar batch (stok) berdasarkan ID Vaksin (Untuk Dropdown dinamis)
     */
    getBatchByVaksin: async (vaksinId, faskesId = null) => {
        const where = {
            vaksinId: vaksinId,
            statusAktif: true,
            stok: { gt: 0 },
            tanggalExpired: { gt: new Date() }
        };
        if (faskesId) {
            where.faskesId = faskesId;
        }
        return await prisma.batchVaksin.findMany({
            where,
            orderBy: { tanggalExpired: 'asc' },
        });
    },

    /**
     * LOGIKA INTI: Mencatat Riwayat Imunisasi & Memotong Stok Batch
     */
    catatRiwayat: async (data, petugasId) => {
        const {
            pasienId, kunjunganId, batchVaksinId, isRiwayatLuar,
            dosisKe, dosisJumlah, lokasiSuntik, ruteSuntik, catatan, tanggalSuntik
        } = data;

        // VALIDASI ARSITEKTUR: Jika bukan riwayat dari luar, Kunjungan (Encounter) wajib ada!
        if (!isRiwayatLuar && !kunjunganId) {
            const error = new Error('Penyuntikan di Puskesmas WAJIB menyertakan ID Kunjungan.');
            error.statusCode = 400;
            throw error;
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Cek ketersediaan Batch Vaksin
            const batch = await tx.batchVaksin.findUnique({
                where: { id: batchVaksinId },
                include: { vaksin: true }
            });

            if (!batch) throw new Error('Data Batch Vaksin tidak ditemukan.');
            if (!isRiwayatLuar && batch.stok < 1) throw new Error(`Stok vaksin ${batch.vaksin?.namaVaksin || ''} untuk batch ini sudah habis.`);

            // 2. Buat Riwayat Imunisasi
            const riwayat = await tx.riwayatImunisasi.create({
                data: {
                    pasienId,
                    kunjunganId: isRiwayatLuar ? null : kunjunganId,
                    batchVaksinId,
                    isRiwayatLuar: isRiwayatLuar || false,
                    tanggalSuntik: tanggalSuntik ? new Date(tanggalSuntik) : new Date(),
                    dosisKe: parseInt(dosisKe) || 1,
                    dosisJumlah: dosisJumlah ? parseFloat(dosisJumlah) : null,
                    lokasiSuntik,
                    ruteSuntik,
                    petugasId: isRiwayatLuar ? null : petugasId, // Petugas hanya relevan jika disuntik di RS kita
                    catatan,
                },
                include: {
                    batchVaksin: {
                        include: { vaksin: true }
                    }
                }
            });

            // 3. Kurangi stok vaksin HANYA JIKA disuntik di Puskesmas kita
            if (!isRiwayatLuar) {
                const updatedBatch = await tx.batchVaksin.update({
                    where: { id: batchVaksinId },
                    data: { stok: batch.stok - 1 },
                    include: { vaksin: true }
                });

                await catatMutasiStok(tx, {
                    faskesId: batch.faskesId,
                    kategoriItem: 'VAKSIN',
                    vaksinId: batch.vaksinId,
                    namaItem: batch.vaksin?.namaVaksin || updatedBatch.vaksin?.namaVaksin || 'Vaksin Imunisasi',
                    sediaan: 'Dosis / Vial',
                    noBatch: batch.noBatch,
                    tanggalExpired: batch.tanggalExpired,
                    jenisMutasi: 'KELUAR',
                    jumlahPerubahan: -1,
                    stokAwal: batch.stok,
                    stokAkhir: updatedBatch.stok,
                    referensi: `IMUNISASI-${kunjunganId ? kunjunganId.slice(-6) : riwayat.id.slice(-6)}`,
                    keterangan: `Pelayanan Imunisasi Pasien (Dosis ke-${dosisKe || 1})`,
                    petugasId: petugasId || null,
                    petugasNama: petugas?.namaLengkap || 'Petugas Imunisasi'
                });
            }

            return riwayat;
        });

        // 4. Update tagihan kasir secara otomatis (memasukkan biaya vaksin ke kasir)
        if (kunjunganId) {
            try {
                await kasirService.generateTagihan(kunjunganId);
            } catch (errTagihan) {
                console.error('[Kasir Error] Gagal generate tagihan setelah imunisasi:', errTagihan.message);
            }
        }

        return result;
    },

    /**
     * Mengambil riwayat lengkap pasien (Untuk Buku KIA Digital)
     */
    getRiwayatByPasien: async (pasienId) => {
        return await prisma.riwayatImunisasi.findMany({
            where: { pasienId },
            include: {
                batchVaksin: {
                    include: { vaksin: true }
                },
                petugas: { select: { namaLengkap: true } }
            },
            orderBy: { tanggalSuntik: 'desc' },
        });
    },

    /**
     * Mengambil detail komprehensif untuk dikirim ke SATUSEHAT
     */
    getRiwayatLengkapById: async (id) => {
        return await prisma.riwayatImunisasi.findUnique({
            where: { id },
            include: {
                pasien: { include: { persetujuan: true } }, // Ambil data consent
                kunjungan: true,
                batchVaksin: {
                    include: { vaksin: true }
                },
                petugas: true, // Butuh NIK/ID Praktisi untuk SATUSEHAT
            }
        });
    }
};

module.exports = imunisasiService;