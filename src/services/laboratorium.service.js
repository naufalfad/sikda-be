const prisma = require('../config/prisma');

const createOrderLab = async (data) => {
  const { kunjunganId, pasienId, dokterId, catatanKlinis, tests } = data;

  // Cek apakah sudah ada order lab untuk kunjungan ini
  const existingOrder = await prisma.orderLaboratorium.findUnique({
    where: { kunjunganId }
  });

  let order;
  if (existingOrder) {
    // Hapus detail sebelumnya untuk diperbarui dengan pemeriksaan terbaru
    await prisma.orderLaboratoriumDetail.deleteMany({
      where: { orderId: existingOrder.id }
    });

    order = await prisma.orderLaboratorium.update({
      where: { id: existingOrder.id },
      data: {
        catatanKlinis,
        details: {
          create: (tests || []).map((test) => ({
            parameter: test
          }))
        }
      },
      include: {
        details: true
      }
    });
  } else {
    // Buat OrderLab baru
    order = await prisma.orderLaboratorium.create({
      data: {
        kunjunganId,
        pasienId,
        dokterId,
        catatanKlinis,
        status: 'MENUNGGU_SAMPEL',
        details: {
          create: (tests || []).map((test) => ({
            parameter: test
          }))
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

    await tx.kunjungan.update({
      where: { id: order.kunjunganId },
      data: { statusKunjungan: 'DIPERIKSA' }
    });

    return updatedOrder;
  });
};

const getOrderByKunjungan = async (kunjunganId) => {
  return await prisma.orderLaboratorium.findFirst({
    where: { kunjunganId },
    include: {
      details: true,
      pasien: true,
      dokter: true
    },
    orderBy: { tanggalOrder: 'desc' }
  });
};

module.exports = {
  createOrderLab,
  getAntrianLab,
  simpanHasilLab,
  getOrderByKunjungan
};
