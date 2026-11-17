const prisma = require('../config/prisma');
const kasirService = require('./kasir.service');

const createOrderLab = async (data) => {
  const { kunjunganId, pasienId, dokterId, catatanKlinis, tests, faskesTujuan, metodeRujukan } = data;

  // Ambil data kunjungan beserta faskes untuk auto-resolusi kapabilitas internal spesifik faskes
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: { faskes: true }
  });

  const faskes = kunjungan?.faskes;
  const finalPasienId = pasienId || kunjungan?.pasienId;
  const faskesLabInternalParams = (faskes && Array.isArray(faskes.labInternalParams) && faskes.labInternalParams.length > 0)
    ? faskes.labInternalParams.map(p => p.toLowerCase().trim())
    : null;

  // Ambil daftar master lab untuk auto-resolusi tersediaInternal jika tidak disediakan
  const masterLabList = await prisma.masterLaboratorium.findMany({
    select: { parameter: true, tersediaInternal: true }
  });
  const masterMap = new Map();
  masterLabList.forEach(m => masterMap.set(m.parameter.toLowerCase().trim(), m.tersediaInternal));

  // Parameter yang secara medis baku dirujuk keluar di FKTP Puskesmas jika tidak ada aturan faskes
  const rujukanKeywords = ['kultur', 'hba1c', 'tsh', 'ft4', 'tiroid', 'kimia klinik', 'troponin', 'ck-mb', 'tumor', 'afp', 'cea', 'psa', 'elektrolit'];

  // Normalisasi item details
  const formattedDetails = (tests || []).map((test) => {
    let paramName = typeof test === 'string' ? test : (test.parameter || '');
    let isRujuk = false;

    if (typeof test === 'object' && test.isRujukanLuar !== undefined) {
      isRujuk = Boolean(test.isRujukanLuar);
    } else {
      const lower = paramName.toLowerCase().trim();
      // Prioritaskan kapabilitas mandiri faskes dokter saat ini
      if (faskesLabInternalParams !== null) {
        const isInternalAtThisFaskes = faskesLabInternalParams.some(p => lower.includes(p) || p.includes(lower));
        isRujuk = !isInternalAtThisFaskes;
      } else if (masterMap.has(lower)) {
        isRujuk = !masterMap.get(lower);
      } else if (rujukanKeywords.some(k => lower.includes(k))) {
        isRujuk = true;
      }
    }

    const defaultLabTarget = faskes?.defaultLabRujukan || 'UPT Labkesda Kabupaten / RSUD Terdekat';
    const itemFaskes = isRujuk
      ? ((typeof test === 'object' && test.faskesTujuan) || faskesTujuan || defaultLabTarget)
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
        pasienId: finalPasienId,
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
  const kunjunganCurrent = await prisma.kunjungan.findUnique({ where: { id: kunjunganId } });
  if (kunjunganCurrent && kunjunganCurrent.statusKunjungan === 'MENUNGGU_DOKTER') {
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

const getAntrianLab = async (user, query = {}) => {
  const { tipe = 'INTERNAL', search, status } = query;
  const where = {};

  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.kunjungan = { faskesId: user.faskesId };
  }

  if (tipe === 'INTERNAL') {
    // Hanya order yang memiliki minimal 1 pemeriksaan internal faskes
    where.details = {
      some: {
        isRujukanLuar: false
      }
    };
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['MENUNGGU_SAMPEL', 'DIPROSES'] };
    }
  } else if (tipe === 'EKSTERNAL') {
    // Order yang memiliki parameter rujukan luar ke Labkesda/RSUD
    where.details = {
      some: {
        isRujukanLuar: true
      }
    };
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['MENUNGGU_HASIL_RUJUKAN', 'MENUNGGU_SAMPEL', 'DIPROSES', 'SELESAI'] };
    }
  } else if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { pasien: { namaLengkap: { contains: search, mode: 'insensitive' } } },
      { pasien: { noRM: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Jika antrean INTERNAL: HANYA ambil parameter yang dikerjakan di faskes internal (isRujukanLuar: false)
  // Parameter rujukan luar sama sekali tidak ditampilkan di antrean internal agar analis tidak bingung.
  // Jika antrean EKSTERNAL: HANYA ambil parameter yang dirujuk ke faskes luar (isRujukanLuar: true).
  const includeDetails = tipe === 'INTERNAL'
    ? { where: { isRujukanLuar: false } }
    : (tipe === 'EKSTERNAL' ? { where: { isRujukanLuar: true } } : true);

  return await prisma.orderLaboratorium.findMany({
    where,
    include: {
      pasien: true,
      dokter: { select: { id: true, namaLengkap: true } },
      kunjungan: { 
        select: { 
          id: true, 
          noAntrian: true, 
          jamRegistrasi: true,
          poliklinik: { select: { namaPoli: true } }
        } 
      },
      details: includeDetails
    },
    orderBy: {
      tanggalOrder: 'asc'
    }
  });
};

const simpanHasilLab = async (orderId, details) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.orderLaboratorium.findUnique({
      where: { id: orderId },
      include: { details: true }
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

    // Periksa status kelengkapan setelah update
    const allDetails = await tx.orderLaboratoriumDetail.findMany({
      where: { orderId }
    });

    const pendingInternal = allDetails.filter(d => !d.isRujukanLuar && (!d.hasil || d.hasil.trim() === ''));
    const pendingExternal = allDetails.filter(d => d.isRujukanLuar && (!d.hasil || d.hasil.trim() === ''));

    let nextStatus = 'SELESAI';
    if (pendingInternal.length > 0) {
      nextStatus = 'DIPROSES';
    } else if (pendingExternal.length > 0) {
      // Uji internal sudah selesai, namun hasil rujukan luar masih ditunggu dari Labkesda/RS
      nextStatus = 'MENUNGGU_HASIL_RUJUKAN';
    }

    const updatedOrder = await tx.orderLaboratorium.update({
      where: { id: orderId },
      data: { status: nextStatus },
      include: { details: true }
    });

    const kunjungan = await tx.kunjungan.findUnique({
      where: { id: order.kunjunganId }
    });
    if (kunjungan && (kunjungan.statusKunjungan === 'MENUNGGU_LAB' || kunjungan.statusKunjungan === 'MENUNGGU_DOKTER')) {
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

  const rujukanEksternal = await prisma.orderLaboratorium.count({
    where: {
      ...whereFaskes,
      details: {
        some: { isRujukanLuar: true }
      }
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
      selesai: selesaiHariIni,
      rujukanEksternal
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

const deleteOrderLab = async (idOrKunjunganId) => {
  const existingOrder = await prisma.orderLaboratorium.findFirst({
    where: {
      OR: [
        { id: idOrKunjunganId },
        { kunjunganId: idOrKunjunganId }
      ]
    },
    include: { details: true }
  });

  if (!existingOrder) {
    throw new Error('Order laboratorium tidak ditemukan');
  }

  // Jika status sudah diproses atau selesai, tolak pembatalan
  if (['DIPROSES', 'SELESAI'].includes(existingOrder.status)) {
    throw new Error('Order laboratorium tidak dapat dibatalkan karena sampel sedang atau sudah diproses oleh analis.');
  }

  // Hapus detail dan order laboratorium
  await prisma.orderLaboratoriumDetail.deleteMany({
    where: { orderId: existingOrder.id }
  });

  await prisma.orderLaboratorium.delete({
    where: { id: existingOrder.id }
  });

  return { message: 'Order laboratorium berhasil dibatalkan dan dihapus.' };
};

module.exports = {
  createOrderLab,
  getAntrianLab,
  simpanHasilLab,
  getOrderByKunjungan,
  getDashboardStats,
  getRiwayatLabByPasien,
  deleteOrderLab
};
