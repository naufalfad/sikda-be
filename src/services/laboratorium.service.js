const prisma = require('../config/prisma');
const kasirService = require('./kasir.service');

const createOrderLab = async (data) => {
  const { kunjunganId, pasienId, dokterId, catatanKlinis, tests, faskesTujuan, metodeRujukan } = data;

  // Ambil daftar master lab untuk auto-resolusi tersediaInternal jika tidak disediakan
  const masterLabList = await prisma.masterLaboratorium.findMany({
    select: { parameter: true, tersediaInternal: true }
  });
  const masterMap = new Map();
  masterLabList.forEach(m => masterMap.set(m.parameter.toLowerCase().trim(), m.tersediaInternal));

  // Parameter yang secara medis baku dirujuk keluar di FKTP Puskesmas
  const rujukanKeywords = ['kultur', 'hba1c', 'tsh', 'ft4', 'tiroid', 'kimia klinik', 'troponin', 'ck-mb', 'tumor', 'afp', 'cea', 'psa', 'elektrolit'];

  // Normalisasi item details
  const formattedDetails = (tests || []).map((test) => {
    let paramName = typeof test === 'string' ? test : (test.parameter || '');
    let isRujuk = false;

    if (typeof test === 'object' && test.isRujukanLuar !== undefined) {
      isRujuk = Boolean(test.isRujukanLuar);
    } else {
      const lower = paramName.toLowerCase().trim();
      if (masterMap.has(lower)) {
        isRujuk = !masterMap.get(lower);
      } else if (rujukanKeywords.some(k => lower.includes(k))) {
        isRujuk = true;
      }
    }

    const itemFaskes = isRujuk
      ? ((typeof test === 'object' && test.faskesTujuan) || faskesTujuan || 'UPT Labkesda Kabupaten / RSUD Terdekat')
      : null;

    const itemMetode = isRujuk
      ? ((typeof test === 'object' && test.metodeRujukan) || metodeRujukan || 'KIRIM_PASIEN')
      : null;

    return {
      parameter: paramName,
      isRujukanLuar: isRujuk,
      faskesTujuan: itemFaskes,
      metodeRujukan: itemMetode
    };
  });

  // Tentukan status awal order:
  // Jika seluruh pemeriksaan merupakan rujukan luar, status = MENUNGGU_HASIL_RUJUKAN
  // Jika ada pemeriksaan internal, status = MENUNGGU_SAMPEL (agar analis lab faskes memproses)
  const allExternal = formattedDetails.length > 0 && formattedDetails.every(d => d.isRujukanLuar);
  const initialStatus = allExternal ? 'MENUNGGU_HASIL_RUJUKAN' : 'MENUNGGU_SAMPEL';

  // Cek apakah sudah ada order lab untuk kunjungan ini
  const existingOrder = await prisma.orderLaboratorium.findUnique({
    where: { kunjunganId }
  });

  let order;
  if (existingOrder) {
    await prisma.orderLaboratoriumDetail.deleteMany({
      where: { orderId: existingOrder.id }
    });

    order = await prisma.orderLaboratorium.update({
      where: { id: existingOrder.id },
      data: {
        catatanKlinis,
        status: initialStatus,
        details: {
          create: formattedDetails
        }
      },
      include: {
        details: true
      }
    });
  } else {
    order = await prisma.orderLaboratorium.create({
      data: {
        kunjunganId,
        pasienId,
        dokterId,
        catatanKlinis,
        status: initialStatus,
        details: {
          create: formattedDetails
        }
      },
      include: {
        details: true
      }
    });
  }

  // NOTE: Jangan ubah status kunjungan menjadi MENUNGGU_LAB agar dokter tetap bisa melanjutkan
  // pemeriksaan (SOAP, resep obat, tindakan) tanpa terblokir.
  // Jika status masih MENUNGGU_DOKTER, kita set ke DIPERIKSA.
  const kunjungan = await prisma.kunjungan.findUnique({ where: { id: kunjunganId } });
  if (kunjungan && kunjungan.statusKunjungan === 'MENUNGGU_DOKTER') {
    await prisma.kunjungan.update({
      where: { id: kunjunganId },
      data: { statusKunjungan: 'DIPERIKSA' }
    });
  }

  // Sinkronisasi otomatis ke modul Kasir (Retribusi Perda Pemeriksaan Lab)
  try {
    await kasirService.generateTagihan(kunjunganId);
  } catch (errTagihan) {
    console.warn('[Kasir Lab] Info sinkronisasi tagihan lab:', errTagihan.message);
  }

  return order;
};

const getAntrianLab = async (user) => {
  const where = {
    status: { in: ['MENUNGGU_SAMPEL', 'DIPROSES'] }
  };
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.kunjungan = { faskesId: user.faskesId };
  }

  return await prisma.orderLaboratorium.findMany({
    where,
    include: {
      pasien: true,
      dokter: { select: { id: true, namaLengkap: true } },
      kunjungan: { select: { id: true, noAntrian: true, jamRegistrasi: true } },
      details: true
    },
    orderBy: {
      tanggalOrder: 'asc'
    }
  });
};

const simpanHasilLab = async (orderId, details) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.orderLaboratorium.findUnique({
      where: { id: orderId }
    });

    if (!order) throw new Error('Order laboratorium tidak ditemukan');

    for (const detail of details) {
      if (detail.id) {
        await tx.orderLaboratoriumDetail.update({
          where: { id: detail.id },
          data: {
            hasil: detail.hasil,
            satuan: detail.satuan,
            nilaiRujukan: detail.nilaiRujukan,
            kritis: detail.kritis || false
          }
        });
      }
    }

    const updatedOrder = await tx.orderLaboratorium.update({
      where: { id: orderId },
      data: { status: 'SELESAI' },
      include: { details: true }
    });

    const kunjungan = await tx.kunjungan.findUnique({
      where: { id: order.kunjunganId }
    });
    if (kunjungan && kunjungan.statusKunjungan === 'MENUNGGU_LAB') {
      await tx.kunjungan.update({
        where: { id: order.kunjunganId },
        data: { statusKunjungan: 'DIPERIKSA' }
      });
    }

    return updatedOrder;
  });
};

const getOrderByKunjungan = async (kunjunganId) => {
  return await prisma.orderLaboratorium.findFirst({
    where: { kunjunganId },
    include: {
      details: true,
      pasien: {
        include: { alamat: true, kontak: true, penjamin: true }
      },
      dokter: { select: { id: true, namaLengkap: true } },
      kunjungan: {
        select: {
          id: true,
          noAntrian: true,
          tanggalRegistrasi: true,
          poliklinik: { select: { namaPoli: true } }
        }
      }
    },
    orderBy: { tanggalOrder: 'desc' }
  });
};

const getDashboardStats = async (user) => {
  const whereFaskes = {};
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    whereFaskes.kunjungan = { faskesId: user.faskesId };
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 1. Order Hari Ini
  const totalHariIni = await prisma.orderLaboratorium.count({
    where: {
      ...whereFaskes,
      tanggalOrder: { gte: startOfDay, lte: endOfDay }
    }
  });

  const menunggu = await prisma.orderLaboratorium.count({
    where: {
      ...whereFaskes,
      status: 'MENUNGGU_SAMPEL'
    }
  });

  const sedangDilayani = await prisma.orderLaboratorium.count({
    where: {
      ...whereFaskes,
      status: 'DIPROSES'
    }
  });

  const selesaiHariIni = await prisma.orderLaboratorium.count({
    where: {
      ...whereFaskes,
      status: 'SELESAI',
      tanggalOrder: { gte: startOfDay, lte: endOfDay }
    }
  });

  // 2. Data 7 Hari Terakhir
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const count = await prisma.orderLaboratorium.count({
      where: {
        ...whereFaskes,
        tanggalOrder: { gte: dayStart, lte: dayEnd }
      }
    });

    chartData.push({
      day: days[d.getDay()],
      date: d.toISOString().split('T')[0],
      count
    });
  }

  // 3. Pemeriksaan Selesai Terakhir (5 teratas)
  const selesaiTerakhir = await prisma.orderLaboratorium.findMany({
    where: {
      ...whereFaskes,
      status: 'SELESAI'
    },
    include: {
      pasien: { select: { id: true, namaLengkap: true, noRM: true } },
      dokter: { select: { id: true, namaLengkap: true } },
      details: true
    },
    orderBy: { tanggalOrder: 'desc' },
    take: 5
  });

  return {
    stats: {
      totalHariIni,
      menunggu,
      sedangDilayani,
      selesai: selesaiHariIni
    },
    chartData,
    selesaiTerakhir
  };
};

const getRiwayatLabByPasien = async (pasienId) => {
  if (!pasienId) return [];
  return await prisma.orderLaboratorium.findMany({
    where: {
      pasienId,
      status: 'SELESAI'
    },
    include: {
      details: true,
      pasien: {
        include: { alamat: true, kontak: true, penjamin: true }
      },
      dokter: { select: { id: true, namaLengkap: true } },
      kunjungan: { 
        select: { 
          id: true, 
          noAntrian: true, 
          tanggalRegistrasi: true, 
          poliklinik: { select: { namaPoli: true } } 
        } 
      }
    },
    orderBy: {
      tanggalOrder: 'desc'
    }
  });
};

module.exports = {
  createOrderLab,
  getAntrianLab,
  simpanHasilLab,
  getOrderByKunjungan,
  getDashboardStats,
  getRiwayatLabByPasien
};
