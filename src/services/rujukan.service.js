const prisma = require('../config/prisma');
const satusehatService = require('./satusehat.service');

/**
 * Service untuk mengambil seluruh antrean rujukan keluar (untuk role Administrasi)
 */
const getAntrianRujukan = async (user) => {
  const where = {};
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.kunjungan = { faskesId: user.faskesId };
  }

  const rujukanList = await prisma.rujukanKeluar.findMany({
    where,
    include: {
      pasien: true,
      dokter: true,
      kunjungan: {
        include: {
          poliklinik: true,
          tagihan: true
        }
      }
    },
    orderBy: {
      tanggalRujukan: 'desc'
    }
  });

  return rujukanList.map((item) => {
    const tagihan = item.kunjungan?.tagihan;
    const isLunas = tagihan?.statusPembayaran === 'LUNAS' || tagihan?.isLunas === true || item.kunjungan?.statusKunjungan === 'SELESAI';
    const statusPembayaran = isLunas ? 'LUNAS' : (tagihan?.statusPembayaran || 'BELUM_BAYAR');

    return {
      ...item,
      isLunas,
      statusPembayaran
    };
  });
};

/**
 * Service untuk mengambil antrean rujukan penunjang (Order Lab & Order Radiologi) untuk Loket Administrasi
 */
const getAntrianRujukanPenunjang = async (user) => {
  const where = {};
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    where.kunjungan = { faskesId: user.faskesId };
  }

  // 1. Ambil Order Laboratorium
  const labOrders = await prisma.orderLaboratorium.findMany({
    where,
    include: {
      pasien: {
        include: { alamat: true }
      },
      dokter: { select: { id: true, namaLengkap: true } },
      details: true,
      kunjungan: {
        include: {
          poliklinik: true,
          tagihan: true
        }
      }
    },
    orderBy: {
      tanggalOrder: 'desc'
    }
  });

  // 2. Ambil Order Radiologi
  const radOrders = await prisma.orderRadiologi.findMany({
    where,
    include: {
      pasien: {
        include: { alamat: true }
      },
      dokter: { select: { id: true, namaLengkap: true } },
      details: true,
      hasil: true,
      kunjungan: {
        include: {
          poliklinik: true,
          tagihan: true
        }
      }
    },
    orderBy: {
      tanggalOrder: 'desc'
    }
  });

  // 3. Format dan satukan data
  const formattedLab = labOrders.map((item) => {
    const tagihan = item.kunjungan?.tagihan;
    const isLunas = tagihan?.statusPembayaran === 'LUNAS' || tagihan?.isLunas === true || item.kunjungan?.statusKunjungan === 'SELESAI';
    const statusPembayaran = isLunas ? 'LUNAS' : (tagihan?.statusPembayaran || 'BELUM_BAYAR');

    return {
      id: item.id,
      jenisPenunjang: 'LABORATORIUM',
      nomorRegistrasi: `LAB-${item.id.slice(0, 8).toUpperCase()}`,
      tanggalOrder: item.tanggalOrder,
      pasienId: item.pasienId,
      pasien: item.pasien,
      dokter: item.dokter,
      catatanKlinis: item.catatanKlinis,
      details: item.details,
      summaryTindakan: item.details.map(d => d.parameter).join(', ') || 'Pemeriksaan Lab',
      kunjunganId: item.kunjunganId,
      kunjungan: item.kunjungan,
      poliAsal: item.kunjungan?.poliklinik?.namaPoli || 'Poli Umum',
      isLunas,
      statusPembayaran,
      rawOrder: item
    };
  });

  const formattedRad = radOrders.map((item) => {
    const tagihan = item.kunjungan?.tagihan;
    const isLunas = tagihan?.statusPembayaran === 'LUNAS' || tagihan?.isLunas === true || item.kunjungan?.statusKunjungan === 'SELESAI';
    const statusPembayaran = isLunas ? 'LUNAS' : (tagihan?.statusPembayaran || 'BELUM_BAYAR');

    return {
      id: item.id,
      jenisPenunjang: 'RADIOLOGI',
      nomorRegistrasi: item.acsn || `RAD-${item.id.slice(0, 8).toUpperCase()}`,
      tanggalOrder: item.tanggalOrder,
      pasienId: item.pasienId,
      pasien: item.pasien,
      dokter: item.dokter,
      catatanKlinis: item.catatanKlinis,
      details: item.details,
      summaryTindakan: item.details.map(d => d.namaPemeriksaan).join(', ') || 'Pemeriksaan Radiologi',
      kunjunganId: item.kunjunganId,
      kunjungan: item.kunjungan,
      poliAsal: item.kunjungan?.poliklinik?.namaPoli || 'Poli Umum',
      isLunas,
      statusPembayaran,
      rawOrder: item
    };
  });

  // Gabungkan dan urutkan descending berdasarkan tanggalOrder
  return [...formattedLab, ...formattedRad].sort((a, b) => {
    return new Date(b.tanggalOrder).getTime() - new Date(a.tanggalOrder).getTime();
  });
};

/**
 * Service untuk mengambil detail rujukan berdasarkan kunjunganId
 */
const getRujukanDetailByKunjungan = async (kunjunganId) => {
  return await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: {
        include: {
          alamat: true
        }
      },
      dokterTujuan: {
        include: {
          tenagaMedis: true
        }
      },
      rekamMedis: true,
      rujukanKeluar: true,
      tagihan: true,
      diagnosis: {
        include: {
          icd10: true
        }
      }
    }
  });
};

/**
 * Service untuk mengirim ulang / manual sync ServiceRequest ke SATUSEHAT
 */
const kirimServiceRequestSatuSehat = async (kunjunganId) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: {
        include: { tenagaMedis: true }
      },
      rujukanKeluar: true
    }
  });

  if (!kunjungan) {
    throw new Error('Kunjungan tidak ditemukan');
  }

  if (!kunjungan.rujukanKeluar) {
    throw new Error('Data rujukan belum tersimpan. Dokter harus mengisi form rujukan terlebih dahulu.');
  }

  if (kunjungan.rujukanKeluar.satusehatId) {
    return {
      success: true,
      message: 'ServiceRequest sudah pernah dikirim sebelumnya',
      satusehatId: kunjungan.rujukanKeluar.satusehatId
    };
  }

  const ssPayload = {
    pasienIhs: kunjungan.pasien?.noIHS || '',
    pasienName: kunjungan.pasien?.namaLengkap,
    encounterId: kunjungan.encounterId || '',
    dokterIhs: kunjungan.dokterTujuan?.tenagaMedis?.noIHS || '',
    dokterName: kunjungan.dokterTujuan?.namaLengkap,
    requestType: "RUJUKAN",
    requestCode: "3457005",
    requestDisplay: `Referral to ${kunjungan.rujukanKeluar.poliTujuan} at ${kunjungan.rujukanKeluar.faskesTujuan}`,
    catatanKlinis: kunjungan.rujukanKeluar.alasanRujukan || 'Rujukan Medis Rawat Jalan',
    orderId: kunjungan.rujukanKeluar.id
  };

  if (!ssPayload.pasienIhs || !ssPayload.encounterId || !ssPayload.dokterIhs) {
    throw new Error('Data IHS belum lengkap (pasienIhs, encounterId, atau dokterIhs kosong). Pastikan data pasien dan dokter sudah tersinkronisasi dengan SATUSEHAT.');
  }

  const satusehatResult = await satusehatService.postServiceRequest(ssPayload);

  if (satusehatResult && satusehatResult.success && satusehatResult.serviceRequestId) {
    await prisma.rujukanKeluar.update({
      where: { id: kunjungan.rujukanKeluar.id },
      data: { satusehatId: satusehatResult.serviceRequestId }
    });
  }

  return satusehatResult;
};

module.exports = {
  getAntrianRujukan,
  getAntrianRujukanPenunjang,
  getRujukanDetailByKunjungan,
  kirimServiceRequestSatuSehat
};
