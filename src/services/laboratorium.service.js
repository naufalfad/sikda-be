const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createOrderLab = async (data) => {
  const { kunjunganId, pasienId, dokterId, catatanKlinis, tests } = data;

  // Cek apakah sudah ada order lab untuk kunjungan ini
  const existingOrder = await prisma.orderLaboratorium.findUnique({
    where: { kunjunganId }
  });

  if (existingOrder) {
    throw new Error('Order laboratorium untuk kunjungan ini sudah ada');
  }

  // Buat OrderLab
  const newOrder = await prisma.orderLaboratorium.create({
    data: {
      kunjunganId,
      pasienId,
      dokterId,
      catatanKlinis,
      status: 'MENUNGGU_SAMPEL',
      details: {
        create: tests.map((test) => ({
          parameter: test
        }))
      }
    },
    include: {
      details: true
    }
  });

  // Update status Kunjungan menjadi MENUNGGU_LAB
  await prisma.kunjungan.update({
    where: { id: kunjunganId },
    data: { statusKunjungan: 'MENUNGGU_LAB' }
  });

  return newOrder;
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
