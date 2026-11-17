const prisma = require('../config/prisma');
const kasirService = require('./kasir.service');

const radiologiService = {
  /**
   * 1. Dokter Poli membuat Order Radiologi
   * (Generate ACSN Unik: ACSN-YYYYMMDD-XXXX)
   */
  createOrder: async (data) => {
    const {
      kunjunganId,
      dokterId,
      prioritas = 'routine',
      catatan,
      details = [],
      isRujukanLuar,
      faskesTujuan
    } = data;

    // Validasi Kunjungan beserta faskes
    const kunjungan = await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: { pasien: true, faskes: true },
    });

    if (!kunjungan) {
      const error = new Error('Data kunjungan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const faskes = kunjungan.faskes;
    const faskesRadLoinc = (faskes && Array.isArray(faskes.radiologiInternalLoinc))
      ? faskes.radiologiInternalLoinc
      : [];

    // Tentukan apakah internal atau rujukan luar:
    let finalIsRujukanLuar = true;
    if (typeof isRujukanLuar === 'boolean') {
      finalIsRujukanLuar = isRujukanLuar;
    } else if (details.length > 0 && faskesRadLoinc.length > 0) {
      // Jika seluruh pemeriksaan yang diminta tersedia internal di faskes ini
      const allInternal = details.every(d => faskesRadLoinc.includes(d.kodeLoinc));
      finalIsRujukanLuar = !allInternal;
    }

    const finalFaskesTujuan = finalIsRujukanLuar
      ? (faskesTujuan || faskes?.defaultRadRujukan || 'Instalasi Radiologi RSUD Terdekat')
      : null;

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const acsn = `ACSN-${todayStr}-${randomSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      await tx.orderRadiologi.deleteMany({
        where: { kunjunganId },
      });

      const newOrder = await tx.orderRadiologi.create({
        data: {
          kunjunganId,
          pasienId: kunjungan.pasienId,
          dokterId,
          acsn,
          status: finalIsRujukanLuar ? 'MENUNGGU_HASIL_RUJUKAN' : 'REQUESTED',
          prioritas,
          catatanKlinis: catatan,
          isRujukanLuar: Boolean(finalIsRujukanLuar),
          faskesTujuan: finalFaskesTujuan,
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

    // Sinkronisasi tagihan Kasir jika pemeriksaan internal
    if (!finalIsRujukanLuar) {
      try {
        await kasirService.generateTagihan(kunjunganId);
      } catch (errTagihan) {
        console.warn('[Kasir Radiologi] Sinkronisasi tagihan gagal:', errTagihan.message);
      }
    }

    return result;
  },

  /**
   * 2. Mengambil daftar order radiologi dengan filter (Internal vs Rujukan Eksternal)
   */
  getAllOrders: async (query = {}, user = null) => {
    const { status, kunjunganId, search, tipe, isRujukanLuar } = query;

    const whereClause = {};

    if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
      whereClause.kunjungan = { faskesId: user.faskesId };
    }

    // Filter tipe pemeriksaan: INTERNAL vs EKSTERNAL (Rujukan Luar)
    if (tipe === 'INTERNAL' || isRujukanLuar === false || isRujukanLuar === 'false') {
      whereClause.isRujukanLuar = false;
    } else if (tipe === 'EKSTERNAL' || isRujukanLuar === true || isRujukanLuar === 'true') {
      whereClause.isRujukanLuar = true;
    }

    if (status) {
      whereClause.status = status;
    }

    if (kunjunganId) {
      whereClause.kunjunganId = kunjunganId;
    }

    if (search) {
      whereClause.OR = [
        {
          pasien: {
            namaLengkap: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          pasien: {
            noRM: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          acsn: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return await prisma.orderRadiologi.findMany({
      where: whereClause,
      include: {
        pasien: true,
        dokter: { select: { id: true, namaLengkap: true } },
        kunjungan: { 
          select: { 
            id: true, 
            noAntrian: true, 
            encounterId: true,
            poliklinik: { select: { namaPoli: true } }
          } 
        },
        details: true,
        hasil: {
          include: {
            dokterRadiologi: { select: { id: true, namaLengkap: true } },
          },
        },
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
  /**
   * 5. Dokter / Perawat menginput hasil rujukan balik radiologi dari RSUD / Lab Luar
   * (Kertas hasil fisik yang dibawa kembali oleh pasien)
   */
  simpanHasilRujukanLuar: async (orderId, data) => {
    const { catatanHasil, dokumenHasilUrl, kesimpulan, bacaanNaratif, dokterRadiologiNama } = data;

    const order = await prisma.orderRadiologi.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      const error = new Error('Order Radiologi tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      // Upsert HasilRadiologi agar resource DiagnosticReport / Observation SATUSEHAT tetap terpenuhi
      await tx.hasilRadiologi.upsert({
        where: { orderRadiologiId: orderId },
        update: {
          kesimpulan: kesimpulan || catatanHasil || 'Pemeriksaan radiologi luar selesai.',
          bacaanNaratif: bacaanNaratif || catatanHasil || 'Pemeriksaan dilakukan di faskes rujukan eksternal.',
          wadoUrl: dokumenHasilUrl || null
        },
        create: {
          orderRadiologiId: orderId,
          kesimpulan: kesimpulan || catatanHasil || 'Pemeriksaan radiologi luar selesai.',
          bacaanNaratif: bacaanNaratif || catatanHasil || 'Pemeriksaan dilakukan di faskes rujukan eksternal.',
          wadoUrl: dokumenHasilUrl || null
        }
      });

      const updatedOrder = await tx.orderRadiologi.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          catatanHasil: catatanHasil || kesimpulan || bacaanNaratif || '',
          dokumenHasilUrl: dokumenHasilUrl || null
        },
        include: {
          details: true,
          hasil: true,
          pasien: true,
          kunjungan: true
        }
      });

      // Kembalikan status kunjungan pasien ke DIPERIKSA
      await tx.kunjungan.update({
        where: { id: order.kunjunganId },
        data: { statusKunjungan: 'DIPERIKSA' }
      });

      return updatedOrder;
    });
  },

  deleteOrder: async (idOrKunjunganId) => {
    const existingOrder = await prisma.orderRadiologi.findFirst({
      where: {
        OR: [
          { id: idOrKunjunganId },
          { kunjunganId: idOrKunjunganId }
        ]
      },
      include: { details: true }
    });

    if (!existingOrder) {
      const err = new Error('Order radiologi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (['IN_PROGRESS', 'COMPLETED'].includes(existingOrder.status)) {
      const err = new Error('Order radiologi tidak dapat dibatalkan karena pemeriksaan sedang atau sudah selesai diproses.');
      err.statusCode = 400;
      throw err;
    }

    await prisma.detailOrderRadiologi.deleteMany({
      where: { orderRadiologiId: existingOrder.id }
    });

    await prisma.orderRadiologi.delete({
      where: { id: existingOrder.id }
    });

    return { message: 'Order radiologi berhasil dibatalkan dan dihapus.' };
  },
};

module.exports = radiologiService;