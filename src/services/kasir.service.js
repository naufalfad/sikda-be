const prisma = require('../config/prisma');
const { applyFaskesScope } = require('../utils/tenantScope');
const { kurangiStokObatFaskes } = require('../utils/stok.helper');

const getAntrianKasir = async (user) => {
  const where = {
    OR: [
      { statusKunjungan: 'MENUNGGU_KASIR' },
      { 
        statusKunjungan: 'MENUNGGU_FARMASI',
        tagihan: {
          statusTagihan: 'BELUM_LUNAS'
        }
      },
      { 
        statusKunjungan: 'MENUNGGU_TINDAK_LANJUT',
        tagihan: {
          statusTagihan: 'BELUM_LUNAS'
        }
      },
      {
        // Pasien rawat inap/jalan yang sudah discharge tapi tagihan belum lunas
        statusPulang: { in: ['PULANG_SEMBUH', 'DIRUJUK_RS', 'PULANG_PAKSA', 'MENINGGAL'] },
        tagihan: {
          statusTagihan: 'BELUM_LUNAS'
        }
      },
      {
        tagihan: {
          statusTagihan: 'BELUM_LUNAS'
        },
        statusKunjungan: {
          // Pasien yang masih aktif di kamar rawat inap ditahan dari loket kasir sampai dinyatakan pulang/discharge
          notIn: ['BATAL', 'SELESAI', 'RAWAT_INAP']
        }
      }
    ]
  };
  applyFaskesScope(where, user);

  return await prisma.kunjungan.findMany({
    where,
    include: {
      pasien: {
        include: { penjamin: true }
      },
      poliklinik: true,
      tagihan: {
        include: {
          details: true,
        },
      },
    },
    orderBy: {
      tanggalRegistrasi: 'asc',
    },
  });
};

/**
 * Generate Tagihan Kasir menggunakan Pricing Snapshot Pattern
 * Menghitung seluruh komponen kumulatif:
 * 1. Karcis registrasi rawat jalan/UGD awal
 * 2. Tindakan & prosedur medis (ICD-9)
/**
 * Hitung kalkulasi item billing kumulatif pasien secara terpusat (Single Source of Truth)
 * 1. Karcis Pendaftaran / Layanan Registrasi Poliklinik / UGD
 * 2. Tindakan Medis (ICD-9)
 * 3. Akomodasi Tempat Tidur rawat inap (durasi menginap x tarif bed puskesmas)
 * 4. Obat & Terapi selama rawat inap (CPPT visit)
 * 5. Resep obat pulang (Take-Home Medication) dari database maupun draft options
 * 6. Imunisasi / Vaksinasi
 * 7. Pemeriksaan Laboratorium
 * 8. Penyesuaian pembayaran awal jika pasien pernah membayar DP/karcis
 */
const calculateTagihanDetails = async (kunjunganId, options = {}) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      poliklinik: {
        include: { layananKliniks: true }
      },
      tindakans: {
        include: { icd9: true },
      },
      resep: {
        include: { details: { include: { obat: true } } },
      },
      riwayatImunisasi: {
        include: {
          batchVaksin: {
            include: { vaksin: true }
          }
        }
      },
      tempatTidurs: {
        include: { ruangan: true }
      },
      catatanPerkembangans: true,
      orderLab: {
        include: { details: true }
      },
      tagihan: {
        include: {
          pembayaran: true,
          details: true,
        }
      },
    },
  });

  if (!kunjungan) {
    throw new Error('Kunjungan tidak ditemukan');
  }

  const details = [];
  let totalBiayaKotor = 0;

  // 1. Karcis / Layanan Registrasi Poliklinik / UGD Awal
  let tarifPoli = 15000; // Default fallback
  if (kunjungan.poliklinik && kunjungan.poliklinik.layananKliniks.length > 0) {
    const matchedLayanan = kunjungan.poliklinik.layananKliniks.find(
      l => l.kodeLayanan === kunjungan.layananTujuan || l.namaLayanan.toLowerCase().includes('konsul')
    ) || kunjungan.poliklinik.layananKliniks[0];
    if (matchedLayanan) {
      tarifPoli = matchedLayanan.tarifDasar;
    }
  }

  details.push({
    namaItem: `Karcis & Konsultasi (${kunjungan.poliklinik?.namaPoli || 'Umum'})`,
    kategori: 'Pendaftaran',
    jumlah: 1,
    hargaSatuan: tarifPoli,
    subTotal: tarifPoli,
  });
  totalBiayaKotor += tarifPoli;

  // 2. Tindakan Medis (ICD-9)
  if (kunjungan.tindakans && kunjungan.tindakans.length > 0) {
    for (const t of kunjungan.tindakans) {
      let tarifTindakan = 50000;
      if (kunjungan.poliklinik && kunjungan.poliklinik.layananKliniks.length > 0) {
        const foundLayanan = kunjungan.poliklinik.layananKliniks.find(
          l => l.kodeLayanan === t.icd9?.kode_icd9
        );
        if (foundLayanan) {
          tarifTindakan = foundLayanan.tarifDasar;
        }
      }

      details.push({
        namaItem: `Tindakan: ${t.icd9?.nama_prosedur || 'Prosedur Medis'}`,
        kategori: 'Tindakan',
        jumlah: 1,
        hargaSatuan: tarifTindakan,
        subTotal: tarifTindakan,
      });
      totalBiayaKotor += tarifTindakan;
    }
  }

  // 3. Akomodasi & Tempat Tidur Rawat Inap
  const isRawatInap = Boolean(
    kunjungan.waktuMasukRawatInap ||
    kunjungan.waktuDischarge ||
    kunjungan.statusPulang === 'RAWAT_INAP' ||
    kunjungan.statusKunjungan === 'RAWAT_INAP' ||
    (kunjungan.jenisPelayanan && kunjungan.jenisPelayanan.toLowerCase().includes('inap')) ||
    (kunjungan.tempatTidurs && kunjungan.tempatTidurs.length > 0) ||
    (options && options.bedInfo) ||
    (kunjungan.catatanPerkembangans && kunjungan.catatanPerkembangans.length > 0)
  );

  if (isRawatInap) {
    const waktuMasuk = kunjungan.waktuMasukRawatInap 
      ? new Date(kunjungan.waktuMasukRawatInap) 
      : new Date(kunjungan.tanggalRegistrasi || kunjungan.createdAt);
    const waktuKeluar = kunjungan.waktuDischarge 
      ? new Date(kunjungan.waktuDischarge) 
      : new Date();

    const start = new Date(waktuMasuk);
    start.setHours(0, 0, 0, 0);
    const end = new Date(waktuKeluar);
    end.setHours(0, 0, 0, 0);
    const diffCalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    // Minimal 1 hari menginap
    const lamaHari = options.lamaHari || Math.max(1, diffCalDays <= 0 ? 1 : diffCalDays);

    // Standar Flat Rate Biaya Tempat Tidur Rawat Inap Puskesmas (FKTP)
    const TARIF_BED_PUSKESMAS = 50000; // Rp 50.000 / hari

    const previousBedDetail = kunjungan.tagihan?.details?.find(d => d.kategori === 'Akomodasi');
    const bedInap = options.bedInfo || (
      kunjungan.tempatTidurs && kunjungan.tempatTidurs.length > 0
        ? (kunjungan.tempatTidurs.find(b => b.ruangan?.kategoriRuangan === 'RAWAT_INAP') || kunjungan.tempatTidurs[0])
        : null
    );

    let namaRuangan = bedInap?.ruangan?.namaRuangan;
    let nomorBed = bedInap?.nomorBed || bedInap?.id;
    if (!namaRuangan && previousBedDetail) {
      const match = previousBedDetail.namaItem.match(/Akomodasi Tempat Tidur \((.*?) - (.*?)\)/);
      if (match) {
        namaRuangan = match[1];
        nomorBed = match[2];
      }
    }
    namaRuangan = namaRuangan || 'Ruang Rawat Inap Puskesmas';
    nomorBed = nomorBed || 'Bed Inap';
    const subTotalBed = lamaHari * TARIF_BED_PUSKESMAS;

    details.push({
      namaItem: `Akomodasi Tempat Tidur (${namaRuangan} - ${nomorBed}) [${lamaHari} Hari]`,
      kategori: 'Akomodasi',
      jumlah: lamaHari,
      hargaSatuan: TARIF_BED_PUSKESMAS,
      subTotal: subTotalBed,
    });
    totalBiayaKotor += subTotalBed;
  }

  // 4. Obat / Terapi Rawat Inap & Resep Obat Pulang yang sudah tersimpan di database
  const recordedObatIds = new Set();
  if (kunjungan.resep && kunjungan.resep.length > 0) {
    const activeReseps = kunjungan.resep.filter(r => r.status !== 'BATAL');
    for (const r of activeReseps) {
      if (r.details && r.details.length > 0) {
        for (const detail of r.details) {
          const tarifObat = detail.obat?.harga !== undefined ? detail.obat.harga : 10000;
          const qty = detail.jumlah || 1;
          const subTotalObat = tarifObat * qty;
          
          const isObatPulang = (detail.catatan && detail.catatan.toLowerCase().includes('pulang')) ||
                               (r.catatan && r.catatan.toLowerCase().includes('pulang'));
          
          const kategoriItem = isObatPulang ? 'Obat Pulang' : 'Obat';
          const prefixItem = isObatPulang ? 'Resep Obat Pulang: ' : 'Obat Terapi Inap: ';

          if (isObatPulang && detail.obatId) {
            recordedObatIds.add(detail.obatId);
          }

          details.push({
            namaItem: `${prefixItem}${detail.obat?.namaObat || 'Obat Generik'} (${qty} ${detail.obat?.sediaan || 'unit'})`,
            kategori: kategoriItem,
            jumlah: qty,
            hargaSatuan: tarifObat,
            subTotal: subTotalObat,
          });
          totalBiayaKotor += subTotalObat;
        }
      }
    }
  }

  // 4b. Resep Obat Pulang Tambahan dari Form Discharge (Preview sebelum disimpan)
  if (Array.isArray(options.resepPulang) && options.resepPulang.length > 0) {
    for (const rp of options.resepPulang) {
      if (!rp || (!rp.obatId && !rp.namaObat)) continue;
      // Jangan duplikasi jika obat ini sudah tercatat di database
      if (rp.obatId && recordedObatIds.has(rp.obatId)) continue;

      let hargaSatuan = rp.harga;
      let namaObat = rp.namaObat;
      let sediaan = rp.sediaan || 'unit';

      if (hargaSatuan === undefined || hargaSatuan === null || isNaN(Number(hargaSatuan))) {
        if (rp.obatId) {
          const found = await prisma.masterObat.findUnique({ where: { id: rp.obatId } });
          if (found) {
            hargaSatuan = found.harga !== undefined ? found.harga : 10000;
            namaObat = found.namaObat;
            sediaan = found.sediaan || sediaan;
          } else {
            hargaSatuan = 10000;
          }
        } else {
          hargaSatuan = 10000;
        }
      }

      const qty = parseInt(rp.qty || rp.jumlah, 10) || 1;
      const subTotal = (Number(hargaSatuan) || 0) * qty;

      details.push({
        namaItem: `Resep Obat Pulang: ${namaObat || 'Obat Pulang'} (${qty} ${sediaan})`,
        kategori: 'Obat Pulang',
        jumlah: qty,
        hargaSatuan: Number(hargaSatuan) || 0,
        subTotal: subTotal,
      });
      totalBiayaKotor += subTotal;
    }
  }

  // 5. Vaksinasi / Imunisasi (jika ada)
  if (kunjungan.riwayatImunisasi && kunjungan.riwayatImunisasi.length > 0) {
    const imunisasiLokal = kunjungan.riwayatImunisasi.filter(i => !i.isRiwayatLuar);
    for (const im of imunisasiLokal) {
      const tarifVaksin = 25000;
      const namaVaksin = im.batchVaksin?.vaksin?.namaVaksin || 'Vaksinasi / Imunisasi';
      details.push({
        namaItem: `Vaksin: ${namaVaksin} (Dosis ${im.dosisKe})`,
        kategori: 'Vaksin',
        jumlah: 1,
        hargaSatuan: tarifVaksin,
        subTotal: tarifVaksin,
      });
      totalBiayaKotor += tarifVaksin;
    }
  }

  // 6. Pemeriksaan Laboratorium (Tarif Retribusi Perda FKTP)
  if (kunjungan.orderLab && kunjungan.orderLab.details && kunjungan.orderLab.details.length > 0) {
    for (const itemLab of kunjungan.orderLab.details) {
      const p = (itemLab.parameter || '').toLowerCase();
      let tarifLab = 20000; // Default retribusi lab FKTP

      if (p.includes('dengue') || p.includes('ns1')) tarifLab = 50000;
      else if (p.includes('hematologi lengkap') || p.includes('darah lengkap')) tarifLab = 35000;
      else if (p.includes('hematologi rutin') || p.includes('cbc')) tarifLab = 30000;
      else if (p.includes('widal')) tarifLab = 25000;
      else if (p.includes('trigliserida')) tarifLab = 25000;
      else if (p.includes('cholesterol') || p.includes('kolesterol')) tarifLab = 20000;
      else if (p.includes('glukosa') || p.includes('gula darah')) tarifLab = 15000;
      else if (p.includes('asam urat')) tarifLab = 15000;
      else if (p.includes('urine rutin') || p.includes('urinalisa')) tarifLab = 15000;
      else if (p.includes('plano') || p.includes('kehamilan') || p.includes('hcg')) tarifLab = 15000;
      else if (p.includes('golongan darah')) tarifLab = 15000;
      else if (p.includes('hemoglobin') || p.includes('hb')) tarifLab = 10000;
      else if (p.includes('hiv')) tarifLab = 35000;
      else if (p.includes('sifilis') || p.includes('vdrl')) tarifLab = 30000;
      else if (p.includes('hbsag')) tarifLab = 30000;
      else if (p.includes('tcm') || p.includes('bta') || p.includes('sputum')) tarifLab = 30000;
      else if (p.includes('sgot') || p.includes('sgpt') || p.includes('ureum') || p.includes('kreatinin')) tarifLab = 25000;
      else if (p.includes('troponin') || p.includes('ck-mb')) tarifLab = 75000;
      else if (p.includes('hba1c')) tarifLab = 60000;
      else if (p.includes('tiroid') || p.includes('tsh') || p.includes('ft4')) tarifLab = 65000;
      else if (p.includes('tumor') || p.includes('afp') || p.includes('cea') || p.includes('psa')) tarifLab = 75000;

      details.push({
        namaItem: `Laboratorium: ${itemLab.parameter}`,
        kategori: 'Laboratorium',
        jumlah: 1,
        hargaSatuan: tarifLab,
        subTotal: tarifLab,
      });
      totalBiayaKotor += tarifLab;
    }
  }

  // 7. Penyesuaian Pembayaran Lama (jika tagihan awal sudah berstatus LUNAS)
  let totalBiayaFinal = totalBiayaKotor;
  let statusTagihanFinal = 'BELUM_LUNAS';

  if (kunjungan.tagihan && kunjungan.tagihan.statusTagihan === 'LUNAS') {
    const sudahDibayar = kunjungan.tagihan.pembayaran?.jumlahBayar || kunjungan.tagihan.totalBiaya || 0;
    
    // Jika ada penambahan biaya baru (misal rawat inap / obat pulang)
    if (totalBiayaKotor > sudahDibayar) {
      details.push({
        namaItem: `Pembayaran Awal / Karcis Sebelumnya (Lunas)`,
        kategori: 'Potongan / DP',
        jumlah: 1,
        hargaSatuan: -sudahDibayar,
        subTotal: -sudahDibayar,
      });
      totalBiayaFinal = Math.max(0, totalBiayaKotor - sudahDibayar);
      statusTagihanFinal = 'BELUM_LUNAS';
    } else {
      statusTagihanFinal = 'LUNAS';
      totalBiayaFinal = 0;
    }
  }

  return {
    kunjungan,
    details,
    totalBiayaKotor,
    totalBiayaFinal,
    statusTagihanFinal,
  };
};

/**
 * Preview tagihan kumulatif tanpa menyimpan/mengubah database (Read-Only)
 * Digunakan oleh dokter/perawat saat merencanakan pemulangan rawat inap
 */
const previewTagihan = async (kunjunganId, options = {}) => {
  const calc = await calculateTagihanDetails(kunjunganId, options);
  return {
    kunjunganId,
    totalBiaya: calc.totalBiayaFinal,
    totalBiayaKotor: calc.totalBiayaKotor,
    statusTagihan: calc.statusTagihanFinal,
    details: calc.details,
  };
};

/**
 * Generate Tagihan Resmi ke Database
 */
const generateTagihan = async (kunjunganId, options = {}) => {
  const calc = await calculateTagihanDetails(kunjunganId, options);
  const { kunjungan, details, totalBiayaFinal, statusTagihanFinal } = calc;

  if (kunjungan.tagihan && kunjungan.tagihan.statusTagihan === 'LUNAS') {
    const sudahDibayar = kunjungan.tagihan.pembayaran?.jumlahBayar || kunjungan.tagihan.totalBiaya || 0;
    
    if (calc.totalBiayaKotor > sudahDibayar) {
      if (kunjungan.tagihan.pembayaran) {
        await prisma.pembayaran.delete({ where: { id: kunjungan.tagihan.pembayaran.id } });
      }
      await prisma.tagihan.delete({ where: { id: kunjungan.tagihan.id } });
    } else {
      return kunjungan.tagihan;
    }
  } else if (kunjungan.tagihan && kunjungan.tagihan.statusTagihan !== 'LUNAS') {
    await prisma.tagihan.delete({ where: { id: kunjungan.tagihan.id } });
  }

  // Buat Tagihan Final dengan Pricing Snapshot
  const tagihan = await prisma.tagihan.create({
    data: {
      kunjunganId: kunjungan.id,
      pasienId: kunjungan.pasienId,
      totalBiaya: totalBiayaFinal,
      statusTagihan: statusTagihanFinal,
      details: {
        create: details,
      },
    },
    include: {
      details: true,
      kunjungan: {
        include: { pasien: true },
      },
    },
  });

  return tagihan;
};

const getTagihan = async (tagihanId) => {
  return await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    include: {
      details: true,
      kunjungan: {
        include: {
          pasien: true,
          poliklinik: true,
        },
      },
      pembayaran: true,
    },
  });
};

const prosesPembayaran = async (tagihanId, userId, data) => {
  const { jumlahBayar, metodePembayaran } = data;

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    include: {
      kunjungan: {
        include: {
          poliklinik: true,
          resep: {
            include: {
              details: {
                include: { obat: true }
              }
            }
          }
        }
      }
    }
  });

  if (!tagihan) {
    throw new Error('Tagihan tidak ditemukan');
  }

  if (tagihan.statusTagihan === 'LUNAS') {
    throw new Error('Tagihan sudah lunas');
  }

  if (metodePembayaran !== 'BPJS' && jumlahBayar < tagihan.totalBiaya) {
    throw new Error('Jumlah uang kurang dari total tagihan');
  }

  const kembalian = metodePembayaran === 'BPJS' ? 0 : jumlahBayar - tagihan.totalBiaya;
  const actualBayar = metodePembayaran === 'BPJS' ? tagihan.totalBiaya : jumlahBayar;

  return await prisma.$transaction(async (tx) => {
    // 1. Buat record Pembayaran Kasir
    const pembayaran = await tx.pembayaran.create({
      data: {
        tagihanId,
        jumlahBayar: actualBayar,
        kembalian,
        metodePembayaran,
        kasirId: userId,
      },
    });

    // 2. Update Tagihan jadi LUNAS
    const updatedTagihan = await tx.tagihan.update({
      where: { id: tagihanId },
      data: { statusTagihan: 'LUNAS' },
    });

    // 3. Integrasi Pemotongan Stok Obat, Vaksin & BMHP Faskes (Auto-FEFO)
    const targetFaskesId = tagihan.kunjungan?.faskesId || tagihan.kunjungan?.poliklinik?.faskesId;
    if (targetFaskesId && tagihan.kunjungan?.resep && tagihan.kunjungan.resep.length > 0) {
      for (const r of tagihan.kunjungan.resep) {
        if (r.status !== 'SELESAI' && r.status !== 'BATAL' && r.details) {
          for (const d of r.details) {
            await kurangiStokObatFaskes(tx, {
              faskesId: targetFaskesId,
              obatId: d.obatId,
              jumlah: d.jumlah,
              noBatch: d.noBatch || null,
            });
          }
          await tx.resep.update({
            where: { id: r.id },
            data: { status: 'SELESAI' },
          });
        }
      }
    }

    // 4. Selesaikan kunjungan di Kasir
    await tx.kunjungan.update({
      where: { id: tagihan.kunjunganId },
      data: { statusKunjungan: 'SELESAI' },
    });

    return updatedTagihan;
  });
};

const getRiwayatKasir = async (user) => {
  const where = {
    statusTagihan: 'LUNAS',
  };
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.kunjungan = { faskesId: user.faskesId };
  }

  return await prisma.tagihan.findMany({
    where,
    include: {
      pasien: true,
      pembayaran: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 50,
  });
};

module.exports = {
  getAntrianKasir,
  generateTagihan,
  previewTagihan,
  getTagihan,
  prosesPembayaran,
  getRiwayatKasir,
};
