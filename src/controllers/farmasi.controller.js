const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const satusehatService = require('../services/satusehat.service');
const SatuSehatGateway = require('../services/satusehat/gateway.service');
const { toRawatJalanBundle } = require('../utils/fhir-mappers');

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

      // 2. Kurangi stok obat fisik di Faskes terkait
      const targetFaskesId = req.user?.faskesId || resep.kunjungan?.poliklinik?.faskesId;

      for (const detail of resep.details) {
        if (targetFaskesId) {
          const stokFaskes = await tx.stokObatFaskes.findUnique({
            where: {
              faskesId_obatId: {
                faskesId: targetFaskesId,
                obatId: detail.obatId
              }
            },
            include: { obat: true }
          });

          if (stokFaskes) {
            if (stokFaskes.stok < detail.jumlah) {
              throw new Error(`Stok obat ${stokFaskes.obat?.namaObat || 'obat'} di faskes ini tidak mencukupi. Tersedia: ${stokFaskes.stok}, Diminta: ${detail.jumlah}`);
            }

            await tx.stokObatFaskes.update({
              where: {
                faskesId_obatId: {
                  faskesId: targetFaskesId,
                  obatId: detail.obatId
                }
              },
              data: {
                stok: {
                  decrement: detail.jumlah
                }
              }
            });
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

    const where = {};
    if (faskesId) {
      where.faskesId = faskesId;
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

    const stokUpdated = await prisma.stokObatFaskes.upsert({
      where: {
        faskesId_obatId: {
          faskesId,
          obatId
        }
      },
      update: {
        stok: { increment: qty },
        ...(noBatch && { noBatch }),
        ...(expDate && { tanggalExpired: expDate }),
        ...(minStock !== undefined && { stokMinimum: minStock })
      },
      create: {
        faskesId,
        obatId,
        stok: qty,
        stokMinimum: minStock || 10,
        noBatch: noBatch || `BATCH-${new Date().getFullYear()}`,
        tanggalExpired: expDate || null
      },
      include: {
        obat: true
      }
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
