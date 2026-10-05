const prisma = require('../config/prisma');

const radiologiService = {
  /**
   * 1. Dokter Poli membuat Order Radiologi
   * (Generate ACSN Unik: ACSN-YYYYMMDD-XXXX)
   */
  createOrder: async (data) => {
    const { kunjunganId, dokterId, prioritas = 'routine', catatan, details = [] } = data;

    // Validasi Kunjungan
    const kunjungan = await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: { pasien: true },
    });

    if (!kunjungan) {
      const error = new Error('Data kunjungan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const acsn = `ACSN-${todayStr}-${randomSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      // Hapus order lama jika ini re-run test pada kunjungan 1-to-1 yang sama
      await tx.orderRadiologi.deleteMany({
        where: { kunjunganId },
      });

      const newOrder = await tx.orderRadiologi.create({
        data: {
          kunjunganId,
          pasienId: kunjungan.pasienId,
          dokterId,
          acsn,
          status: 'REQUESTED',
          prioritas,
          catatanKlinis: catatan,
          details: {
            create: details.map((d) => ({
              kodeLoinc: d.kodeLoinc || '39051-8',
              namaPemeriksaan: d.namaPemeriksaan || 'Diagnostic radiography',
              bodySiteCode: d.bodySiteCode,
              bodySiteDisplay: d.bodySiteDisplay,
            })),
          },
        },
        include: {
          details: true,
          pasien: true,
          dokter: { select: { id: true, namaLengkap: true } },
          kunjungan: true,
        },
      });

      // Jangan ubah status kunjungan menjadi MENUNGGU_RADIOLOGI agar dokter tetap bisa melanjutkan pemeriksaan.
      // Jika status masih MENUNGGU_DOKTER, kita set ke DIPERIKSA.
      const kunjunganCurrent = await tx.kunjungan.findUnique({ where: { id: kunjunganId } });
      if (kunjunganCurrent && kunjunganCurrent.statusKunjungan === 'MENUNGGU_DOKTER') {
        await tx.kunjungan.update({
          where: { id: kunjunganId },
          data: { statusKunjungan: 'DIPERIKSA' },
        });
      }

      return newOrder;
    });

    return result;
  },

  /**
   * 2. Mengambil daftar order radiologi dengan filter
   */
  getAllOrders: async (query = {}, user = null) => {
    const { status, kunjunganId, search } = query;

    const whereClause = {};

    if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
      whereClause.kunjungan = { faskesId: user.faskesId };
    }

    if (status) {
      whereClause.status = status;
    }

    if (kunjunganId) {
      whereClause.kunjunganId = kunjunganId;
    }

    if (search) {
      whereClause.pasien = {
        namaLengkap: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    return await prisma.orderRadiologi.findMany({
      where: whereClause,
      include: {
        pasien: true,
        dokter: { select: { id: true, namaLengkap: true } },
        kunjungan: { select: { id: true, noAntrian: true, encounterId: true } },
        details: true,
        hasil: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * 3. Mengambil detail order radiologi berdasarkan ID
   */
  getOrderById: async (id) => {
    const order = await prisma.orderRadiologi.findUnique({
      where: { id },
      include: {
        pasien: true,
        dokter: { select: { id: true, namaLengkap: true } },
        kunjungan: {
          include: {
            screening: true,
          },
        },
        details: true,
        hasil: {
          include: {
            dokterRadiologi: { select: { id: true, namaLengkap: true } },
          },
        },
      },
    });

    if (!order) {
      const error = new Error('Order Radiologi tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return order;
  },

  /**
   * 4. Dokter Spesialis Radiologi / Petugas Menginput Hasil Bacaan & Ekspertise
   */
  inputHasilEkspertise: async (orderId, data) => {
    const { dokterRadiologiId, bacaanNaratif, kesimpulan, wadoUrl } = data;

    const order = await prisma.orderRadiologi.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      const error = new Error('Order Radiologi tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      const hasil = await tx.hasilRadiologi.upsert({
        where: { orderRadiologiId: orderId },
        update: {
          dokterRadiologiId,
          bacaanNaratif,
          kesimpulan,
          wadoUrl: wadoUrl || `https://nidr.kemkes.go.id/wado/v1/studies/${order.acsn}`,
        },
        create: {
          orderRadiologiId: orderId,
          dokterRadiologiId,
          bacaanNaratif,
          kesimpulan,
          wadoUrl: wadoUrl || `https://nidr.kemkes.go.id/wado/v1/studies/${order.acsn}`,
        },
        include: {
          dokterRadiologi: { select: { id: true, namaLengkap: true } },
        },
      });

      const updatedOrder = await tx.orderRadiologi.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
        include: {
          details: true,
          pasien: true,
          kunjungan: true,
        },
      });

      // Kembalikan status kunjungan pasien ke DIPERIKSA
      await tx.kunjungan.update({
        where: { id: order.kunjunganId },
        data: { statusKunjungan: 'DIPERIKSA' },
      });

      return {
        order: updatedOrder,
        hasil,
      };
    });
  },
};

module.exports = radiologiService;