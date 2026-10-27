const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const satusehatService = require('../services/satusehat.service');
const SatuSehatGateway = require('../services/satusehat/gateway.service');
const { toRawatJalanBundle } = require('../utils/fhir-mappers');
const { catatMutasiStok } = require('../utils/mutasiStok.helper');

// 1. Get Antrian Farmasi (MENUNGGU_FARMASI)
exports.getAntrianFarmasi = async (req, res) => {
  try {
    const where = {
      status: 'MENUNGGU_FARMASI'
    };

    if (req.user && req.user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(req.user.role)) {
      where.kunjungan = { faskesId: req.user.faskesId };
    }

    const resepList = await prisma.resep.findMany({
      where,
      include: {
        pasien: true,
        dokter: {
          include: {
            tenagaMedis: true
          }
        },
        kunjungan: {
          include: {
            poliklinik: true,
            tagihan: {
              select: { statusTagihan: true }
            }
          }
        },
        details: {
          include: {
            obat: true
          }
        }
      },
      orderBy: {
        tanggalResep: 'asc'
      }
    });

    res.json({
      status: 'success',
      data: resepList
    });
  } catch (error) {
    console.error('Error in getAntrianFarmasi:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data antrian farmasi' });
  }
};

// 2. Get Detail Resep by ID
exports.getResepById = async (req, res) => {
  try {
    const { id } = req.params;
    const resep = await prisma.resep.findUnique({
      where: { id },
      include: {
        pasien: true,
        dokter: {
          include: {
            tenagaMedis: true
          }
        },
        kunjungan: {
          include: {
            poliklinik: true,
            tagihan: {
              select: { statusTagihan: true }
            }
          }
        },
        details: {
          include: {
            obat: true
          }
        }
      }
    });

    if (!resep) {
      return res.status(404).json({ status: 'error', message: 'Resep tidak ditemukan' });
    }

    res.json({
      status: 'success',
      data: resep
    });
  } catch (error) {
    console.error('Error in getResepById:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil detail resep' });
  }
};

// 3. Proses Resep (Kurangi Stok & Ubah Status)
exports.prosesResep = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Gunakan transaksi agar jika salah satu gagal, semuanya batal (Atomic)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil resep beserta detailnya
      const resep = await tx.resep.findUnique({
        where: { id },
        include: { 
          details: {
            include: { obat: true }
          }, 
          kunjungan: {
            include: { poliklinik: true }
          },
          pasien: true,
          dokter: { include: { tenagaMedis: true } }
        }
      });

      if (!resep) {
        throw new Error('Resep tidak ditemukan');
      }

      if (resep.status === 'SELESAI') {
        throw new Error('Resep ini sudah diproses sebelumnya');
      }

      // Pengecekan pembayaran di Kasir (Kecuali Pasien BPJS/Gratis)
      const tagihan = await tx.tagihan.findUnique({
        where: { kunjunganId: resep.kunjunganId }
      });

      if (tagihan && tagihan.statusTagihan !== 'LUNAS' && resep.kunjungan.jenisPenjamin !== 'BPJS') {
        throw new Error('Pasien belum melakukan pembayaran di Kasir. Mohon arahkan pasien ke Kasir terlebih dahulu.');
      }

      // 2. Kurangi stok obat fisik di Faskes terkait dengan Multi-Batch & Auto-FEFO
      const targetFaskesId = req.user?.faskesId || resep.kunjungan?.poliklinik?.faskesId;

      for (const detail of resep.details) {
        if (targetFaskesId) {
          // Jika dokter/resep sudah mengunci nomor batch spesifik
          if (detail.noBatch) {
            const specificBatch = await tx.stokObatFaskes.findUnique({
              where: {
                faskesId_obatId_noBatch: {
                  faskesId: targetFaskesId,
                  obatId: detail.obatId,
                  noBatch: detail.noBatch
                }
              },
              include: { obat: true }
            });

            if (specificBatch && specificBatch.stok >= detail.jumlah) {
              const updatedBatch = await tx.stokObatFaskes.update({
                where: { id: specificBatch.id },
                data: {
                  stok: { decrement: detail.jumlah }
                }
              });

              await catatMutasiStok(tx, {
                faskesId: targetFaskesId,
                kategoriItem: specificBatch.obat?.kategori === 'BMHP' ? 'BMHP' : 'OBAT',
                obatId: detail.obatId,
                namaItem: specificBatch.obat?.namaObat || detail.obat?.namaObat || 'Obat Resep',
                sediaan: specificBatch.obat?.sediaan || detail.obat?.sediaan,
                noBatch: specificBatch.noBatch,
                tanggalExpired: specificBatch.tanggalExpired,
                jenisMutasi: 'KELUAR',
                jumlahPerubahan: -detail.jumlah,
                stokAwal: specificBatch.stok,
                stokAkhir: updatedBatch.stok,
                referensi: `RESEP-${resep.kunjungan?.noAntrian || id.slice(-6)}`,
                keterangan: `Resep Pasien ${resep.pasien?.namaLengkap || ''} (${resep.pasien?.noRM || ''})`,
                petugasId: req.user?.id,
                petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Farmasi'
              });
              continue;
            }
          }

          // Auto-FEFO: Cari seluruh batch aktif dengan stok > 0, urutkan dari tanggal kedaluwarsa terdekat
          const batches = await tx.stokObatFaskes.findMany({
            where: {
              faskesId: targetFaskesId,
              obatId: detail.obatId,
              statusAktif: true,
              stok: { gt: 0 }
            },
            include: { obat: true },
            orderBy: { tanggalExpired: 'asc' }
          });

          const totalTersedia = batches.reduce((acc, b) => acc + b.stok, 0);
          const namaObat = batches[0]?.obat?.namaObat || detail.obat?.namaObat || 'obat';

          if (totalTersedia < detail.jumlah) {
            throw new Error(`Stok obat ${namaObat} di faskes ini tidak mencukupi. Total tersedia seluruh batch: ${totalTersedia}, Diminta: ${detail.jumlah}`);
          }

          // Pengurangan stok bertahap sesuai FEFO
          let sisaDibutuhkan = detail.jumlah;
          for (const batch of batches) {
            if (sisaDibutuhkan <= 0) break;
            const potong = Math.min(batch.stok, sisaDibutuhkan);
            const updatedBatch = await tx.stokObatFaskes.update({
              where: { id: batch.id },
              data: {
                stok: { decrement: potong }
              }
            });

            await catatMutasiStok(tx, {
              faskesId: targetFaskesId,
              kategoriItem: batch.obat?.kategori === 'BMHP' ? 'BMHP' : 'OBAT',
              obatId: detail.obatId,
              namaItem: batch.obat?.namaObat || detail.obat?.namaObat || 'Obat Resep',
              sediaan: batch.obat?.sediaan || detail.obat?.sediaan,
              noBatch: batch.noBatch,
              tanggalExpired: batch.tanggalExpired,
              jenisMutasi: 'KELUAR',
              jumlahPerubahan: -potong,
              stokAwal: batch.stok,
              stokAkhir: updatedBatch.stok,
              referensi: `RESEP-${resep.kunjungan?.noAntrian || id.slice(-6)}`,
              keterangan: `Resep Pasien ${resep.pasien?.namaLengkap || ''} (${resep.pasien?.noRM || ''})`,
              petugasId: req.user?.id,
              petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Farmasi'
            });

            sisaDibutuhkan -= potong;
          }
        }
      }

      // 3. Update status Resep menjadi SELESAI
      const updatedResep = await tx.resep.update({
        where: { id },
        data: { status: 'SELESAI' }
      });

      // 4. Update status Kunjungan menjadi SELESAI (karena apotek adalah tahap terakhir)
      await tx.kunjungan.update({
        where: { id: resep.kunjunganId },
        data: { statusKunjungan: 'SELESAI' }
      });

      return { updatedResep, resepLengkap: resep };
    });

    // -------------------------------------
    // Sinkronisasi SATUSEHAT Bundle Transaction (Luar transaksi)
    // -------------------------------------
    const resep = result.resepLengkap;
    
    try {
      // Ambil data kunjungan lengkap beserta seluruh relasi medis
      const dataComplete = await prisma.kunjungan.findUnique({
        where: { id: resep.kunjunganId },
        include: {
          pasien: true,
          poliklinik: true,
          screening: true,
          rekamMedis: true,
          persetujuan: true,
          diagnosis: { include: { icd10: true } },
          tindakans: { include: { icd9: true } },
          resep: {
            include: {
              details: { include: { obat: true } }
            }
          },
          dokterTujuan: { include: { tenagaMedis: true } }
        }
      });

      if (dataComplete && dataComplete.persetujuan?.persetujuanSatusehat !== false) {
        // Ekstrak detail resep
        const resepDetails = [];
        if (Array.isArray(dataComplete.resep)) {
          dataComplete.resep.forEach((r) => {
            if (Array.isArray(r.details)) {
              r.details.forEach((d) => resepDetails.push({ ...d, resepId: r.id }));
            }
          });
        }

        const completePayload = {
          ...dataComplete,
          resepDetails,
          encounterId: dataComplete.encounterId
        };

        // Rakit Bundle Transaction Payload
        const bundlePayload = toRawatJalanBundle(completePayload);
        console.log(`[Farmasi SATUSEHAT] 🚀 Mengirim Bundle Transaction Lengkap untuk Kunjungan ID: ${resep.kunjunganId}...`);
        
        await SatuSehatGateway.sendBundleTransaction(bundlePayload);
        
        await prisma.kunjungan.update({
          where: { id: resep.kunjunganId },
          data: {
            satusehat_sync_status: 'SUCCESS',
            satusehat_last_error: null
          }
        });
      }
    } catch (ssErr) {
      console.error(`[Farmasi SATUSEHAT Error] Gagal mengirim Bundle Transaction:`, ssErr.message || ssErr);
      await prisma.kunjungan.update({
        where: { id: resep.kunjunganId },
        data: {
          satusehat_sync_status: 'FAILED',
          satusehat_last_error: ssErr.message || String(ssErr)
        }
      });
    }

    res.json({
      status: 'success',
      message: 'Resep berhasil diproses, stok obat telah dikurangi, dan data SATUSEHAT terintegrasi.',
      data: result.updatedResep
    });
  } catch (error) {
    console.error('Error in prosesResep:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Gagal memproses resep' });
  }
};

// 4. Get Stok Obat Faskes dengan Analisis FEFO (First Expired First Out)
exports.getStokFaskes = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(req.user?.role)) {
      return res.status(400).json({ status: 'error', message: 'Faskes ID tidak ditemukan pada sesi pengguna.' });
    }

    const { search, hanyaObat, kategori } = req.query;

    const where = {};
    if (faskesId) {
      where.faskesId = faskesId;
    }

    const obatWhere = {};
    if (hanyaObat === 'true') {
      obatWhere.kategori = { not: 'BMHP' };
    } else if (kategori) {
      obatWhere.kategori = kategori;
    }

    if (search) {
      obatWhere.OR = [
        { namaObat: { contains: search, mode: 'insensitive' } },
        { kodeObat: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (Object.keys(obatWhere).length > 0) {
      where.obat = obatWhere;
    }

    const stokList = await prisma.stokObatFaskes.findMany({
      where,
      include: {
        obat: true,
        faskes: { select: { id: true, namaFaskes: true, kodeFaskes: true } }
      },
      orderBy: [
        { tanggalExpired: 'asc' },
        { stok: 'asc' }
      ]
    });

    const now = new Date();
    const formatted = stokList.map((item) => {
      let sisaHariExpired = null;
      let statusExpired = 'AMAN';

      if (item.tanggalExpired) {
        const expDate = new Date(item.tanggalExpired);
        const diffMs = expDate.getTime() - now.getTime();
        sisaHariExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (sisaHariExpired < 0) {
          statusExpired = 'KADALUWARSA';
        } else if (sisaHariExpired <= 60) {
          statusExpired = 'SEGERA_KADALUWARSA'; // < 60 hari (FEFO warning)
        } else if (sisaHariExpired <= 90) {
          statusExpired = 'WASPADA';
        }
      }

      let statusStok = 'AMAN';
      if (item.stok === 0) {
        statusStok = 'HABIS';
      } else if (item.stok <= item.stokMinimum) {
        statusStok = 'KRITIS';
      }

      return {
        id: item.id,
        faskesId: item.faskesId,
        namaFaskes: item.faskes?.namaFaskes,
        obatId: item.obatId,
        kodeObat: item.obat?.kodeObat,
        namaObat: item.obat?.namaObat,
        kategori: item.obat?.kategori,
        sediaan: item.obat?.sediaan,
        harga: item.obat?.harga || 0,
        gambarUrl: item.obat?.gambarUrl,
        stok: item.stok,
        stokMinimum: item.stokMinimum,
        noBatch: item.noBatch || '-',
        tanggalExpired: item.tanggalExpired,
        sisaHariExpired,
        statusExpired,
        statusStok,
        prioritasFEFO: statusExpired === 'KADALUWARSA' ? 1 : (statusExpired === 'SEGERA_KADALUWARSA' ? 2 : (statusExpired === 'WASPADA' ? 3 : 4))
      };
    });

    formatted.sort((a, b) => a.prioritasFEFO - b.prioritasFEFO);

    res.json({
      success: true,
      status: 'success',
      data: formatted,
      ringkasan: {
        totalItem: formatted.length,
        kritisCount: formatted.filter(f => f.statusStok === 'KRITIS' || f.statusStok === 'HABIS').length,
        segeraExpiredCount: formatted.filter(f => f.statusExpired === 'SEGERA_KADALUWARSA' || f.statusExpired === 'KADALUWARSA').length
      }
    });
  } catch (error) {
    console.error('Error in getStokFaskes:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data stok faskes' });
  }
};

// 5. Tambah Penerimaan Stok Obat Faskes (Restock / Droping Dinkes / Pengadaan)
exports.tambahStokMasuk = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId) {
      return res.status(400).json({ status: 'error', message: 'Hanya petugas faskes yang dapat menambah stok faskes.' });
    }

    const { obatId, jumlahMasuk, noBatch, tanggalExpired, stokMinimum } = req.body;

    if (!obatId || !jumlahMasuk || parseInt(jumlahMasuk) <= 0) {
      return res.status(400).json({ status: 'error', message: 'Obat dan jumlah penambahan stok valid wajib diisi.' });
    }

    const qty = parseInt(jumlahMasuk);
    const minStock = stokMinimum !== undefined ? parseInt(stokMinimum) : undefined;
    const expDate = tanggalExpired ? new Date(tanggalExpired) : undefined;

    const batchNo = noBatch && noBatch.trim() ? noBatch.trim() : `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const stokUpdated = await prisma.stokObatFaskes.upsert({
      where: {
        faskesId_obatId_noBatch: {
          faskesId,
          obatId,
          noBatch: batchNo
        }
      },
      update: {
        stok: { increment: qty },
        statusAktif: true,
        ...(expDate && { tanggalExpired: expDate }),
        ...(minStock !== undefined && { stokMinimum: minStock })
      },
      create: {
        faskesId,
        obatId,
        stok: qty,
        stokMinimum: minStock || 10,
        noBatch: batchNo,
        tanggalExpired: expDate || null,
        statusAktif: true
      },
      include: {
        obat: true
      }
    });

    const isBmhp = stokUpdated.obat?.kategori === 'BMHP';
    const stokAkhir = stokUpdated.stok;
    const stokAwal = stokAkhir - qty;

    await catatMutasiStok(prisma, {
      faskesId,
      kategoriItem: isBmhp ? 'BMHP' : 'OBAT',
      obatId: stokUpdated.obatId,
      namaItem: stokUpdated.obat?.namaObat || 'Item Logistik',
      sediaan: stokUpdated.obat?.sediaan,
      noBatch: stokUpdated.noBatch,
      tanggalExpired: stokUpdated.tanggalExpired,
      jenisMutasi: 'MASUK',
      jumlahPerubahan: qty,
      stokAwal,
      stokAkhir,
      referensi: req.body.referensi || `PENERIMAAN-${Date.now().toString().slice(-6)}`,
      keterangan: req.body.keterangan || 'Penerimaan Stok Baru / Pengadaan / Droping Dinkes',
      petugasId: req.user?.id,
      petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Farmasi'
    });

    res.status(200).json({
      status: 'success',
      message: `Berhasil menambahkan ${qty} ${stokUpdated.obat?.sediaan || 'unit'} untuk ${stokUpdated.obat?.namaObat}.`,
      data: stokUpdated
    });
  } catch (error) {
    console.error('Error in tambahStokMasuk:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal menambahkan stok obat.' });
  }
};

// 6. Get Stok Vaksin Faskes dengan Analisis FEFO & Suhu Cold-Chain
exports.getStokVaksinFaskes = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(req.user?.role)) {
      return res.status(400).json({ status: 'error', message: 'Faskes ID tidak ditemukan pada sesi pengguna.' });
    }

    const where = {};
    if (faskesId) {
      where.faskesId = faskesId;
    }

    const batchList = await prisma.batchVaksin.findMany({
      where,
      include: {
        vaksin: true,
        faskes: { select: { id: true, namaFaskes: true, kodeFaskes: true } }
      },
      orderBy: [
        { tanggalExpired: 'asc' },
        { stok: 'asc' }
      ]
    });

    const now = new Date();
    const formatted = batchList.map((item) => {
      let sisaHariExpired = null;
      let statusExpired = 'AMAN';

      if (item.tanggalExpired) {
        const expDate = new Date(item.tanggalExpired);
        const diffMs = expDate.getTime() - now.getTime();
        sisaHariExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (sisaHariExpired < 0) {
          statusExpired = 'KADALUWARSA';
        } else if (sisaHariExpired <= 60) {
          statusExpired = 'SEGERA_KADALUWARSA';
        } else if (sisaHariExpired <= 90) {
          statusExpired = 'WASPADA';
        }
      }

      let statusStok = 'AMAN';
      if (item.stok === 0) {
        statusStok = 'HABIS';
      } else if (item.stok <= item.stokMinimum) {
        statusStok = 'KRITIS';
      }

      return {
        id: item.id,
        faskesId: item.faskesId,
        namaFaskes: item.faskes?.namaFaskes,
        vaksinId: item.vaksinId,
        kodeKfa: item.vaksin?.kodeKfa,
        namaVaksin: item.vaksin?.namaVaksin,
        targetPenyakit: item.vaksin?.targetPenyakit,
        noBatch: item.noBatch,
        tanggalExpired: item.tanggalExpired,
        sisaHariExpired,
        statusExpired,
        stok: item.stok,
        stokMinimum: item.stokMinimum,
        suhuPenyimpanan: item.suhuPenyimpanan || '2-8°C',
        statusStok,
        prioritasFEFO: statusExpired === 'KADALUWARSA' ? 1 : (statusExpired === 'SEGERA_KADALUWARSA' ? 2 : (statusExpired === 'WASPADA' ? 3 : 4))
      };
    });

    formatted.sort((a, b) => a.prioritasFEFO - b.prioritasFEFO);

    res.json({
      status: 'success',
      data: formatted,
      ringkasan: {
        totalBatch: formatted.length,
        totalDosis: formatted.reduce((sum, item) => sum + item.stok, 0),
        kritisCount: formatted.filter(f => f.statusStok === 'KRITIS' || f.statusStok === 'HABIS').length,
        segeraExpiredCount: formatted.filter(f => f.statusExpired === 'SEGERA_KADALUWARSA' || f.statusExpired === 'KADALUWARSA').length
      }
    });
  } catch (error) {
    console.error('Error in getStokVaksinFaskes:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data stok vaksin faskes' });
  }
};

// 7. Tambah Penerimaan Batch Vaksin Baru (Droping Bio Farma / Dinkes)
exports.tambahStokVaksinMasuk = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId) {
      return res.status(400).json({ status: 'error', message: 'Hanya petugas faskes yang dapat menambah stok vaksin faskes.' });
    }

    const { vaksinId, jumlahMasuk, noBatch, tanggalExpired, stokMinimum, suhuPenyimpanan } = req.body;

    if (!vaksinId || !jumlahMasuk || parseInt(jumlahMasuk) <= 0 || !noBatch || !tanggalExpired) {
      return res.status(400).json({ status: 'error', message: 'Vaksin, No Batch, Tanggal Expired, dan Jumlah Dosis valid wajib diisi.' });
    }

    const qty = parseInt(jumlahMasuk);
    const minStock = stokMinimum !== undefined ? parseInt(stokMinimum) : 10;
    const expDate = new Date(tanggalExpired);

    const batchUpdated = await prisma.batchVaksin.upsert({
      where: {
        faskesId_vaksinId_noBatch: {
          faskesId,
          vaksinId,
          noBatch
        }
      },
      update: {
        stok: { increment: qty },
        tanggalExpired: expDate,
        stokMinimum: minStock,
        suhuPenyimpanan: suhuPenyimpanan || '2-8°C'
      },
      create: {
        faskesId,
        vaksinId,
        noBatch,
        tanggalExpired: expDate,
        stok: qty,
        stokMinimum: minStock,
        suhuPenyimpanan: suhuPenyimpanan || '2-8°C'
      },
      include: {
        vaksin: true
      }
    });

    const stokAkhir = batchUpdated.stok;
    const stokAwal = stokAkhir - qty;

    await catatMutasiStok(prisma, {
      faskesId,
      kategoriItem: 'VAKSIN',
      vaksinId: batchUpdated.vaksinId,
      namaItem: batchUpdated.vaksin?.namaVaksin || 'Vaksin',
      sediaan: 'Dosis / Vial',
      noBatch: batchUpdated.noBatch,
      tanggalExpired: batchUpdated.tanggalExpired,
      jenisMutasi: 'MASUK',
      jumlahPerubahan: qty,
      stokAwal,
      stokAkhir,
      referensi: req.body.referensi || `VAKSIN-IN-${Date.now().toString().slice(-6)}`,
      keterangan: req.body.keterangan || 'Penerimaan Vaksin Baru / Droping Cold-Chain Dinkes',
      petugasId: req.user?.id,
      petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Imunisasi'
    });

    res.status(200).json({
      status: 'success',
      message: `Berhasil mencatat penerimaan ${qty} dosis untuk ${batchUpdated.vaksin?.namaVaksin} (Batch: ${noBatch}).`,
      data: batchUpdated
    });
  } catch (error) {
    console.error('Error in tambahStokVaksinMasuk:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal mencatat penerimaan vaksin.' });
  }
};

// 8. Pengurangan / Pengeluaran Stok Obat & BMHP Manual
// (Pemakaian Ruangan / Amprahan, Rusak, Kadaluwarsa, Penyesuaian Stok Opname, Retur)
exports.kurangiStokKeluar = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId) {
      return res.status(400).json({ status: 'error', message: 'Hanya petugas faskes yang dapat mencatat pengeluaran stok.' });
    }

    const { obatId, jumlahKeluar, alasanKeluar, catatan, noBatch } = req.body;

    if (!obatId || !jumlahKeluar || parseInt(jumlahKeluar) <= 0) {
      return res.status(400).json({ status: 'error', message: 'Obat dan jumlah pengeluaran valid wajib diisi.' });
    }

    const qty = parseInt(jumlahKeluar);

    let existing;
    if (noBatch && noBatch.trim()) {
      existing = await prisma.stokObatFaskes.findUnique({
        where: {
          faskesId_obatId_noBatch: {
            faskesId,
            obatId,
            noBatch: noBatch.trim()
          }
        },
        include: { obat: true }
      });
    } else {
      // Auto-FEFO: pilih batch aktif yang paling mendekati tanggal expired
      existing = await prisma.stokObatFaskes.findFirst({
        where: {
          faskesId,
          obatId,
          statusAktif: true,
          stok: { gt: 0 }
        },
        include: { obat: true },
        orderBy: { tanggalExpired: 'asc' }
      });
    }

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Item obat/BMHP batch ini belum terdaftar atau tidak memiliki stok.' });
    }

    if (existing.stok < qty) {
      return res.status(400).json({
        status: 'error',
        message: `Stok ${existing.obat?.namaObat} (Batch: ${existing.noBatch}) tidak mencukupi untuk dikeluarkan. Sisa stok tersedia: ${existing.stok}, diminta: ${qty}.`
      });
    }

    const updated = await prisma.stokObatFaskes.update({
      where: {
        id: existing.id
      },
      data: {
        stok: { decrement: qty }
      },
      include: { obat: true }
    });

    const isBmhp = updated.obat?.kategori === 'BMHP';
    const stokAkhir = updated.stok;
    const stokAwal = stokAkhir + qty;

    await catatMutasiStok(prisma, {
      faskesId,
      kategoriItem: isBmhp ? 'BMHP' : 'OBAT',
      obatId: updated.obatId,
      namaItem: updated.obat?.namaObat || 'Item Logistik',
      sediaan: updated.obat?.sediaan,
      noBatch: updated.noBatch,
      tanggalExpired: updated.tanggalExpired,
      jenisMutasi: 'KELUAR',
      jumlahPerubahan: -qty,
      stokAwal,
      stokAkhir,
      referensi: req.body.referensi || `OUT-${Date.now().toString().slice(-6)}`,
      keterangan: alasanKeluar ? `${alasanKeluar}${catatan ? ` - ${catatan}` : ''}` : (catatan || 'Pengeluaran Manual Stok'),
      petugasId: req.user?.id,
      petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Farmasi'
    });

    res.status(200).json({
      status: 'success',
      message: `Berhasil mengeluarkan ${qty} ${updated.obat?.sediaan || 'unit'} untuk ${updated.obat?.namaObat} (Batch: ${updated.noBatch}). Alasan: ${alasanKeluar || 'Pengeluaran Stok'}. Sisa stok: ${updated.stok}.`,
      data: updated
    });
  } catch (error) {
    console.error('Error in kurangiStokKeluar:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses pengurangan stok.' });
  }
};

// 9. Pengurangan / Pengeluaran Batch Vaksin Manual
// (Distribusi Posyandu, Kerusakan Cold-Chain, Kadaluwarsa, Penyesuaian Stok Opname, Retur)
exports.kurangiStokVaksinKeluar = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    if (!faskesId) {
      return res.status(400).json({ status: 'error', message: 'Hanya petugas faskes yang dapat mencatat pengeluaran vaksin.' });
    }

    const { vaksinId, noBatch, jumlahKeluar, alasanKeluar, catatan } = req.body;

    if (!vaksinId || !noBatch || !jumlahKeluar || parseInt(jumlahKeluar) <= 0) {
      return res.status(400).json({ status: 'error', message: 'Vaksin, No Batch, dan jumlah dosis pengeluaran valid wajib diisi.' });
    }

    const qty = parseInt(jumlahKeluar);

    const existing = await prisma.batchVaksin.findUnique({
      where: {
        faskesId_vaksinId_noBatch: {
          faskesId,
          vaksinId,
          noBatch
        }
      },
      include: { vaksin: true }
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: `Batch ${noBatch} untuk vaksin ini tidak ditemukan.` });
    }

    if (existing.stok < qty) {
      return res.status(400).json({
        status: 'error',
        message: `Stok vaksin batch ${noBatch} tidak mencukupi. Sisa dosis: ${existing.stok}, diminta: ${qty}.`
      });
    }

    const updated = await prisma.batchVaksin.update({
      where: {
        faskesId_vaksinId_noBatch: {
          faskesId,
          vaksinId,
          noBatch
        }
      },
      data: {
        stok: { decrement: qty }
      },
      include: { vaksin: true }
    });

    const stokAkhir = updated.stok;
    const stokAwal = stokAkhir + qty;

    await catatMutasiStok(prisma, {
      faskesId,
      kategoriItem: 'VAKSIN',
      vaksinId: updated.vaksinId,
      namaItem: updated.vaksin?.namaVaksin || 'Vaksin',
      sediaan: 'Dosis / Vial',
      noBatch: updated.noBatch,
      tanggalExpired: updated.tanggalExpired,
      jenisMutasi: 'KELUAR',
      jumlahPerubahan: -qty,
      stokAwal,
      stokAkhir,
      referensi: req.body.referensi || `VAKSIN-OUT-${Date.now().toString().slice(-6)}`,
      keterangan: alasanKeluar ? `${alasanKeluar}${catatan ? ` - ${catatan}` : ''}` : (catatan || 'Pengeluaran Manual Vaksin / Posyandu'),
      petugasId: req.user?.id,
      petugasNama: req.user?.namaLengkap || req.user?.username || 'Petugas Imunisasi'
    });

    res.status(200).json({
      status: 'success',
      message: `Berhasil mengeluarkan ${qty} dosis ${updated.vaksin?.namaVaksin} (Batch: ${noBatch}). Alasan: ${alasanKeluar || 'Pengeluaran Vaksin'}. Sisa dosis: ${updated.stok}.`,
      data: updated
    });
  } catch (error) {
    console.error('Error in kurangiStokVaksinKeluar:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses pengurangan stok vaksin.' });
  }
};

// 10. Ambil Log Riwayat Mutasi Keluar-Masuk (Obat, Vaksin, BMHP)
exports.getRiwayatMutasiStok = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId || req.query.faskesId;
    if (!faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(req.user?.role)) {
      return res.status(400).json({ status: 'error', message: 'Faskes ID diperlukan.' });
    }

    const {
      kategori,
      jenisMutasi,
      search,
      startDate,
      endDate,
      limit = 50,
      page = 1
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (faskesId) {
      conditions.push(`m."faskesId" = $${paramIndex++}`);
      params.push(faskesId);
    }

    if (kategori && kategori !== 'semua') {
      conditions.push(`m."kategoriItem" = $${paramIndex++}`);
      params.push(kategori.toUpperCase());
    }

    if (jenisMutasi && jenisMutasi !== 'semua') {
      conditions.push(`m."jenisMutasi" = $${paramIndex++}`);
      params.push(jenisMutasi.toUpperCase());
    }

    if (startDate) {
      conditions.push(`m."createdAt" >= $${paramIndex++}`);
      params.push(new Date(startDate));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(`m."createdAt" <= $${paramIndex++}`);
      params.push(end);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(`(
        m."namaItem" ILIKE $${paramIndex} OR 
        m."noBatch" ILIKE $${paramIndex} OR 
        m."referensi" ILIKE $${paramIndex} OR 
        m."keterangan" ILIKE $${paramIndex} OR 
        m."petugasNama" ILIKE $${paramIndex}
      )`);
      params.push(q);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const take = parseInt(limit, 10) || 50;
    const skip = (parseInt(page, 10) - 1) * take;

    const countQuery = `SELECT COUNT(*)::int as total FROM "MutasiStokLogistik" m ${whereClause}`;
    const countResult = await prisma.$queryRawUnsafe(countQuery, ...params);
    const total = countResult[0]?.total || 0;

    const itemsQuery = `
      SELECT m.*, f."namaFaskes", f."kodeFaskes"
      FROM "MutasiStokLogistik" m
      LEFT JOIN "Faskes" f ON m."faskesId" = f."id"
      ${whereClause}
      ORDER BY m."createdAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `;
    const items = await prisma.$queryRawUnsafe(itemsQuery, ...params);

    // Summary transaksi hari ini
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const summaryQuery = `
      SELECT "jenisMutasi", "kategoriItem", COUNT(*)::int as count, SUM("jumlahPerubahan")::int as sum_qty
      FROM "MutasiStokLogistik"
      WHERE ${faskesId ? ` "faskesId" = $1 AND ` : ''} "createdAt" >= ${faskesId ? '$2' : '$1'}
      GROUP BY "jenisMutasi", "kategoriItem"
    `;
    const summaryParams = faskesId ? [faskesId, todayStart] : [todayStart];
    const rawSummary = await prisma.$queryRawUnsafe(summaryQuery, ...summaryParams);

    const summaryToday = rawSummary.map(r => ({
      jenisMutasi: r.jenisMutasi,
      kategoriItem: r.kategoriItem,
      _count: { id: r.count },
      _sum: { jumlahPerubahan: r.sum_qty }
    }));

    res.status(200).json({
      status: 'success',
      data: items,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take)
      },
      summaryToday
    });
  } catch (error) {
    console.error('Error in getRiwayatMutasiStok:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal memuat log mutasi stok.' });
  }
};

// 11. Ambil Kartu Stok Spesifik per Item
exports.getKartuStokItem = async (req, res) => {
  try {
    const faskesId = req.user?.faskesId;
    const { itemId } = req.params;
    const { jenis = 'OBAT' } = req.query;

    if (!faskesId || !itemId) {
      return res.status(400).json({ status: 'error', message: 'Faskes ID dan Item ID wajib diisi.' });
    }

    const isVaksin = jenis.toUpperCase() === 'VAKSIN';
    const query = `
      SELECT * FROM "MutasiStokLogistik"
      WHERE "faskesId" = $1 AND ${isVaksin ? '"vaksinId"' : '"obatId"'} = $2
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

    const logs = await prisma.$queryRawUnsafe(query, faskesId, itemId);

    res.status(200).json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    console.error('Error in getKartuStokItem:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal memuat kartu stok item.' });
  }
};

