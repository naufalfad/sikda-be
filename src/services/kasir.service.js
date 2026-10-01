const prisma = require('../config/prisma');
const { applyFaskesScope } = require('../utils/tenantScope');

const getAntrianKasir = async (user) => {
  const where = {
    OR: [
      { statusKunjungan: 'MENUNGGU_KASIR' },
      { 
        statusKunjungan: 'MENUNGGU_FARMASI',
        tagihan: {
          statusTagihan: 'BELUM_LUNAS'
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
 * Generate Tagihan Kasir menggunakan Pricing Snapshot Pattern (Q3 Architecture)
 * Harga diambil dinamis dari Master Data (LayananKlinik, MasterObat, MasterLaboratorium),
 * lalu di-snapshot (copy fisik) ke DetailTagihan agar historis akuntansi tidak berubah jika tarif master naik.
 */
const generateTagihan = async (kunjunganId) => {
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
      orderLab: {
        include: { details: true },
      },
      tagihan: true,
    },
  });

  if (!kunjungan) {
    throw new Error('Kunjungan tidak ditemukan');
  }

  // Jika tagihan sudah ada (tapi belum dibayar), kita hapus lalu generate ulang (refresh snapshot)
  if (kunjungan.tagihan && kunjungan.tagihan.statusTagihan !== 'LUNAS') {
    await prisma.tagihan.delete({
      where: { id: kunjungan.tagihan.id },
    });
  } else if (kunjungan.tagihan && kunjungan.tagihan.statusTagihan === 'LUNAS') {
    return kunjungan.tagihan; // Sudah lunas, tidak perlu generate ulang
  }

  const details = [];
  let totalBiaya = 0;

  // 1. Karcis / Layanan Registrasi Poliklinik (Dynamic Lookup dari LayananKlinik)
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
  totalBiaya += tarifPoli;

  // 2. Tindakan Medis (Dinamis dari LayananKlinik jika ada, atau default 50.000)
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
      totalBiaya += tarifTindakan;
    }
  }

  // 3. Obat / Resep (Dinamis dari MasterObat.harga — Dynamic Snapshot)
  if (kunjungan.resep && kunjungan.resep.length > 0) {
    for (const r of kunjungan.resep) {
      if (r.details) {
        for (const detail of r.details) {
          // Ambil harga asli dari MasterObat
          const tarifObat = detail.obat?.harga !== undefined ? detail.obat.harga : 10000;
          const qty = detail.jumlah || 1;
          const subTotalObat = tarifObat * qty;
          details.push({
            namaItem: `Obat: ${detail.obat?.namaObat || 'Obat Generik'}`,
            kategori: 'Obat',
            jumlah: qty,
            hargaSatuan: tarifObat,
            subTotal: subTotalObat,
          });
          totalBiaya += subTotalObat;
        }
      }
    }
  }

  // 4. Laboratorium (Dinamis dari MasterLaboratorium.hargaTarif — Dynamic Snapshot)
  if (kunjungan.orderLab && kunjungan.orderLab.details) {
    // Ambil master lab untuk lookup tarif
    const masterLabs = await prisma.masterLaboratorium.findMany();
    const labTarifMap = new Map(masterLabs.map(m => [m.parameter.toLowerCase(), m.hargaTarif]));

    for (const detail of kunjungan.orderLab.details) {
      const tarifLab = labTarifMap.get(detail.parameter.toLowerCase()) || 30000;
      details.push({
        namaItem: `Lab: ${detail.parameter}`,
        kategori: 'Laboratorium',
        jumlah: 1,
        hargaSatuan: tarifLab,
        subTotal: tarifLab,
      });
      totalBiaya += tarifLab;
    }
  }

  // Buat Tagihan dengan Pricing Snapshot
  const tagihan = await prisma.tagihan.create({
    data: {
      kunjunganId: kunjungan.id,
      pasienId: kunjungan.pasienId,
      totalBiaya,
      statusTagihan: 'BELUM_LUNAS',
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
  const actualBayar = metodePembayaran === 'BPJS' ? tagihan.totalBiaya : jumlahBayar; // Jika BPJS, anggap dibayar pas (meski uang 0)

  return await prisma.$transaction(async (tx) => {
    // 1. Buat record Pembayaran
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

    // 3. Selesaikan kunjungan
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
  getTagihan,
  prosesPembayaran,
  getRiwayatKasir,
};
