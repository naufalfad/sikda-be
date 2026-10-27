const prisma = require('../config/prisma');
const ukmService = require('./ukm.service');
const satusehatService = require('./satusehat.service');
const SatuSehatGateway = require('./satusehat/gateway.service');
const { toRawatJalanBundle } = require('../utils/fhir-mappers');
const kasirService = require('./kasir.service');
const { addSatusehatSyncJob } = require('../queues/satusehat.queue');
const { applyFaskesScope } = require('../utils/tenantScope');

/**
 * Helper to extract Observation vital signs from screening record
 */
const extractObservationsFromScreening = (screening) => {
  if (!screening) return [];
  const obs = [];

  if (screening.tekananDarahSistolik || screening.tekananDarahDiastolik) {
    obs.push({
      loincCode: "85354-9",
      loincDisplay: "Blood pressure panel with all children optional",
      components: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
          valueQuantity: { value: screening.tekananDarahSistolik || 120, unit: "mm[Hg]", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }] },
          valueQuantity: { value: screening.tekananDarahDiastolik || 80, unit: "mm[Hg]", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
        }
      ]
    });
  }

  if (screening.nadi) {
    obs.push({
      loincCode: "8867-4",
      loincDisplay: "Heart rate",
      value: screening.nadi,
      unit: "/min",
      unitCode: "/min"
    });
  }

  if (screening.frekuensiNapas) {
    obs.push({
      loincCode: "9279-1",
      loincDisplay: "Respiratory rate",
      value: screening.frekuensiNapas,
      unit: "/min",
      unitCode: "/min"
    });
  }

  if (screening.suhuTubuh) {
    obs.push({
      loincCode: "8310-5",
      loincDisplay: "Body temperature",
      value: screening.suhuTubuh,
      unit: "C",
      unitCode: "Cel"
    });
  }

  if (screening.tinggiBadan) {
    obs.push({
      loincCode: "8302-2",
      loincDisplay: "Body height",
      value: screening.tinggiBadan,
      unit: "cm",
      unitCode: "cm"
    });
  }

  if (screening.beratBadan) {
    obs.push({
      loincCode: "29463-7",
      loincDisplay: "Body weight",
      value: screening.beratBadan,
      unit: "kg",
      unitCode: "kg"
    });
  }

  if (screening.saturasiOksigen) {
    obs.push({
      loincCode: "59408-5",
      loincDisplay: "Oxygen saturation in Arterial blood by Pulse oximetry",
      value: screening.saturasiOksigen,
      unit: "%",
      unitCode: "%"
    });
  }

  if (screening.lingkarPerut) {
    obs.push({
      loincCode: "8280-0",
      loincDisplay: "Waist Circumference",
      value: screening.lingkarPerut,
      unit: "cm",
      unitCode: "cm"
    });
  }

  if (screening.skalaNyeri !== undefined && screening.skalaNyeri !== null) {
    obs.push({
      loincCode: "72514-3",
      loincDisplay: "Pain severity - 0-10 verbal numeric rating",
      value: screening.skalaNyeri,
      unit: "{score}",
      unitCode: "{score}"
    });
  }

  return obs;
};

/**
 * Get antrian pasien untuk dokter (status MENUNGGU_DOKTER)
 * Include pasien + screening perawat
 */
const getAntrianDokter = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const whereClause = {
    tanggalRegistrasi: { gte: today, lt: tomorrow },
    statusKunjungan: {
      in: ['MENUNGGU_DOKTER', 'DIPERIKSA', 'MENUNGGU_LAB', 'MENUNGGU_RADIOLOGI'],
    },
  };

  // Filter isolasi data multi-tenant Faskes:
  // Dokter/Perawat hanya melihat antrian dari faskes tempat bertugas
  applyFaskesScope(whereClause, user);

  // Filter isolasi data Poliklinik & Antrean: 
  // - Dokter / Dokter UGD: Antrean khusus dirinya ATAU antrean poli yang belum diarahkan ke dokter spesifik (pool umum poli).
  // - Perawat: Semua antrean dalam poliklinik tempat bertugas untuk screening & TTV.
  if (user && (user.role === 'DOKTER' || user.role === 'DOKTER_UGD')) {
    whereClause.OR = [
      { dokterTujuanId: user.id },
      {
        poliklinikId: user.poliklinikId,
        dokterTujuanId: null
      }
    ];
  } else if (user && user.role === 'PERAWAT' && user.poliklinikId) {
    whereClause.poliklinikId = user.poliklinikId;
  }

  let kunjungans = await prisma.kunjungan.findMany({
    where: whereClause,
    include: {
      pasien: true,
      poliklinik: true,
      screening: true,
      rekamMedis: true,
      tempatTidurs: {
        include: {
          ruangan: true
        }
      },
      dokterTujuan: {
        select: { id: true, namaLengkap: true, username: true },
      },
      orderLab: {
        include: {
          details: true
        }
      },
      resep: {
        include: {
          details: {
            include: {
              obat: true
            }
          }
        }
      }
    }
  });

  // Kalkulasi Skor Prioritas
  kunjungans = kunjungans.map(kunjungan => {
    let score = 1; // Default: Umum (Hijau)

    const triage = (kunjungan.triase || kunjungan.screening?.kategoriTriage || '').toLowerCase();
    if (triage === 'merah') {
      score = 5; // Prioritas Gawat Darurat Tertinggi
    } else if (triage === 'kuning') {
      score = 4; // Prioritas Darurat
    } else if (triage === 'hijau') {
      score = 2; // Tidak Gawat Tidak Darurat
    } else if (triage === 'hitam') {
      score = 0; // Death on Arrival
    } else {
      // Jika Hijau / Belum Triage, cek prioritas demografi
      const prioritas = kunjungan.prioritas?.toLowerCase() || '';
      if (['lansia', 'disabilitas', 'ibu hamil', 'bayi', 'anak'].some(p => prioritas.includes(p))) {
        score = 2;
      }
    }

    return { ...kunjungan, _priorityScore: score };
  });

  // Urutkan prioritas tertinggi di atas, lalu urutkan berdasarkan waktu registrasi
  kunjungans.sort((a, b) => b._priorityScore - a._priorityScore);

  // Sort: Skor tertinggi di atas. Jika skor sama, urutkan berdasarkan waktu kedatangan.
  kunjungans.sort((a, b) => {
    if (b._priorityScore !== a._priorityScore) {
      return b._priorityScore - a._priorityScore;
    }

    // Konversi jam ke object Date untuk perbandingan akurat
    const dateStrA = a.tanggalRegistrasi.toISOString().split('T')[0];
    const dateStrB = b.tanggalRegistrasi.toISOString().split('T')[0];
    const dateTimeA = new Date(`${dateStrA}T${a.jamRegistrasi || '00:00'}:00`);
    const dateTimeB = new Date(`${dateStrB}T${b.jamRegistrasi || '00:00'}:00`);

    return dateTimeA - dateTimeB;
  });

  return kunjungans;
};

/**
 * Get riwayat rekam medis (pasien selesai) untuk dokter di faskes
 * Proteksi Keamanan: Dokter hanya melihat riwayat pasien yang pernah ia tangani secara langsung.
 */
const getRiwayatDokter = async (user, query = {}) => {
  const whereClause = {
    statusKunjungan: {
      in: ['SELESAI', 'MENUNGGU_FARMASI', 'PULANG', 'MENUNGGU_KASIR'],
    },
  };

  // Filter isolasi multi-tenant Faskes:
  applyFaskesScope(whereClause, user);

  // Jika user adalah DOKTER: Batasi hanya pada pasien yang pernah ia tangani
  if (user && user.role === 'DOKTER') {
    whereClause.OR = [
      { dokterTujuanId: user.id },
      { rekamMedis: { dokterId: user.id } }
    ];
  }

  // Jika ada filter spesifik poliklinik (misal 'Poli Gigi' atau 'Poli Umum')
  if (query.poli && query.poli !== 'ALL') {
    whereClause.poliklinikId = query.poli;
  }

  const kunjungans = await prisma.kunjungan.findMany({
    where: whereClause,
    include: {
      pasien: true,
      poliklinik: true,
      rekamMedis: true,
      diagnosis: {
        include: {
          icd10: true
        }
      },
      dokterTujuan: {
        select: { id: true, namaLengkap: true },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 100, // Limit to 100 recent histories
  });

  return kunjungans;
};

/**
 * Get seluruh riwayat kunjungan detail satu pasien berdasarkan noRM
 * Proteksi Keamanan (Active Therapeutic Relationship):
 * Dokter HANYA diizinkan membuka berkas rekam medis jika:
 * 1. Dokter pernah menangani pasien ini di masa lalu (Historical Care)
 * 2. ATAU pasien saat ini sedang aktif ditugaskan/diantrekan ke dokter ini / poli dokter ini (Active Assignment)
 */
const getRiwayatPasienByRM = async (noRM, user) => {
  const pasien = await prisma.pasien.findUnique({
    where: { noRM },
  });

  if (!pasien) {
    const err = new Error('Data pasien tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  // VALIDASI HAK AKSES KHUSUS DOKTER (Active Therapeutic Relationship):
  if (user && ['DOKTER', 'DOKTER_UGD'].includes(user.role)) {
    const faskesFilter = user.faskesId ? { faskesId: user.faskesId } : {};

    // 1. Cek riwayat penanganan masa lalu oleh dokter ini (Poli, Rawat Inap, UGD, atau CPPT)
    const pernahMenangani = await prisma.kunjungan.findFirst({
      where: {
        pasienId: pasien.id,
        ...faskesFilter,
        OR: [
          { dokterTujuanId: user.id },
          { rekamMedis: { dokterId: user.id } },
          { catatanPerkembangans: { some: { petugasId: user.id } } }
        ]
      }
    });

    // 2. Cek penugasan pelayanan aktif (antrean aktif di dokter ini, poli dokter ini, atau pasien aktif rawat inap/UGD)
    const antrianAktif = await prisma.kunjungan.findFirst({
      where: {
        pasienId: pasien.id,
        ...faskesFilter,
        statusKunjungan: {
          in: ['MENUNGGU_DOKTER', 'DIPERIKSA', 'MENUNGGU_LAB', 'MENUNGGU_RADIOLOGI', 'ANTRI_POLI', 'RAWAT_INAP']
        },
        OR: [
          { dokterTujuanId: user.id },
          ...(user.poliklinikId ? [{ poliklinikId: user.poliklinikId, dokterTujuanId: null }] : []),
          // Pasien rawat inap aktif di faskes yang sama dapat divisit oleh dokter faskes
          { statusKunjungan: 'RAWAT_INAP' },
          // Pasien gawat darurat UGD di faskes yang sama
          { jenisPelayanan: 'UGD' }
        ]
      }
    });

    if (!pernahMenangani && !antrianAktif) {
      const err = new Error('Akses Ditolak: Anda tidak memiliki wewenang klinis aktif untuk mengakses berkas rekam medis pasien ini. Rekam medis hanya dapat dibuka jika Anda pernah merawat pasien ini, pasien sedang aktif ditugaskan ke antrean Anda, atau pasien sedang dalam perawatan rawat inap / UGD faskes ini.');
      err.statusCode = 403;
      throw err;
    }
  }

  // Interoperabilitas Rekam Medis Lintas Faskes (Continuity of Care):
  // Dokter dan tenaga medis yang sah (memiliki Active Therapeutic Relationship)
  // berhak mengakses riwayat klinis lengkap pasien, baik dari faskes saat ini maupun faskes lain
  // dalam jaringan SIKDA daerah (misal kunjungan sebelumnya di Puskesmas Cibinong dapat dibaca oleh dokter di Sukamakmur).
  const kunjungansWhere = {
    OR: [
      // Kunjungan di Faskes saat ini:
      ...(user?.faskesId ? [{
        faskesId: user.faskesId,
        statusKunjungan: {
          in: ['SELESAI', 'MENUNGGU_FARMASI', 'PULANG', 'MENUNGGU_KASIR', 'RAWAT_INAP', 'DIPERIKSA', 'MENUNGGU_DOKTER'],
        }
      }] : [{
        statusKunjungan: {
          in: ['SELESAI', 'MENUNGGU_FARMASI', 'PULANG', 'MENUNGGU_KASIR', 'RAWAT_INAP', 'DIPERIKSA', 'MENUNGGU_DOKTER'],
        }
      }]),
      // Riwayat Kunjungan dari Faskes Lain (yang telah selesai / memiliki riwayat klinis historis):
      ...(user?.faskesId ? [{
        faskesId: { not: user.faskesId },
        statusKunjungan: {
          in: ['SELESAI', 'PULANG', 'MENUNGGU_FARMASI', 'MENUNGGU_KASIR', 'RAWAT_INAP'],
        }
      }] : [])
    ]
  };

  const detailPasien = await prisma.pasien.findUnique({
    where: { noRM },
    include: {
      faskes: {
        select: { id: true, namaFaskes: true, kodeFaskes: true }
      },
      alamat: true,
      kontak: true,
      penjamin: true,
      orderLabs: {
        include: {
          details: true,
          dokter: { select: { id: true, namaLengkap: true } },
          pasien: {
            include: { alamat: true, kontak: true, penjamin: true }
          },
          kunjungan: {
            select: {
              id: true,
              tanggalRegistrasi: true,
              poliklinik: { select: { namaPoli: true } },
              faskes: { select: { id: true, namaFaskes: true, kodeFaskes: true } }
            }
          }
        },
        orderBy: { tanggalOrder: 'desc' }
      },
      kunjungans: {
        where: kunjungansWhere,
        orderBy: [
          { tanggalRegistrasi: 'desc' },
          { jamRegistrasi: 'desc' },
        ],
        include: {
          faskes: {
            select: { id: true, namaFaskes: true, kodeFaskes: true }
          },
          poliklinik: true,
          dokterTujuan: {
            select: { id: true, namaLengkap: true },
          },
          screening: true,
          rekamMedis: true,
          diagnosis: {
            include: { icd10: true }
          },
          tindakans: {
            include: { icd9: true }
          },
          resep: {
            include: {
              details: {
                include: { obat: true }
              }
            }
          },
          orderLab: {
            include: {
              details: true,
              dokter: { select: { id: true, namaLengkap: true } },
              pasien: {
                include: { alamat: true, kontak: true, penjamin: true }
              }
            }
          },
          orderRadiologi: {
            include: { details: true }
          },
          catatanPerkembangans: {
            include: {
              petugas: { select: { id: true, namaLengkap: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
      },
    },
  });

  return detailPasien;
};

/**
 * Mulai pemeriksaan: lock status → DIPERIKSA, buat RekamMedis DRAFT
 */
const mulaiPemeriksaan = async (kunjunganId, dokterId) => {
  return await prisma.$transaction(async (tx) => {
    const kunjungan = await tx.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: { rekamMedis: true, dokterTujuan: true },
    });

    if (!kunjungan) {
      const err = new Error('Data kunjungan tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (kunjungan.statusKunjungan === 'MENUNGGU' || kunjungan.statusKunjungan === 'DIPROSES_SCREENING') {
      const err = new Error('Pasien ini belum selesai dilakukan pemeriksaan awal (Screening & TTV) oleh Perawat. Pasien harus melalui pemeriksaan perawat terlebih dahulu.');
      err.statusCode = 400;
      throw err;
    }

    // Jika pasien sudah secara khusus ditugaskan ke dokter lain, tolak jika bukan dokter bersangkutan
    if (kunjungan.dokterTujuanId && dokterId && kunjungan.dokterTujuanId !== dokterId) {
      const namaDokter = kunjungan.dokterTujuan?.namaLengkap || 'dokter lain';
      const err = new Error(`Pasien ini terdaftar khusus untuk antrean pemeriksaan ${namaDokter}. Anda tidak dapat memulai pemeriksaan tanpa pengalihan antrean.`);
      err.statusCode = 403;
      throw err;
    }

    const effectiveDokterId = dokterId || kunjungan.dokterTujuanId || null;

    // Jika sudah ada rekam medis (sudah pernah dimulai), kembalikan saja
    if (kunjungan.rekamMedis) {
      // Update status hanya jika masih MENUNGGU_DOKTER
      if (kunjungan.statusKunjungan === 'MENUNGGU_DOKTER') {
        await tx.kunjungan.update({
          where: { id: kunjunganId },
          data: { 
            statusKunjungan: 'DIPERIKSA',
            dokterTujuanId: effectiveDokterId
          },
        });
      }

      if (!kunjungan.rekamMedis.dokterId && effectiveDokterId) {
        const updatedRM = await tx.rekamMedis.update({
          where: { id: kunjungan.rekamMedis.id },
          data: { dokterId: effectiveDokterId }
        });
        return updatedRM;
      }
      return kunjungan.rekamMedis;
    }

    // Lock status kunjungan jika masih baru
    if (kunjungan.statusKunjungan === 'MENUNGGU_DOKTER') {
      await tx.kunjungan.update({
        where: { id: kunjunganId },
        data: {
          statusKunjungan: 'DIPERIKSA',
          dokterTujuanId: effectiveDokterId,
          waktuPemeriksaanMulai: new Date(),
        },
      });
    }

    // Buat RekamMedis baru (DRAFT)
    const rekamMedis = await tx.rekamMedis.create({
      data: {
        kunjunganId,
        pasienId: kunjungan.pasienId,
        dokterId: effectiveDokterId,
        statusPemeriksaan: 'DRAFT',
      },
    });

    return rekamMedis;
  });
};

/**
 * Simpan / Update data SOAP
 */
const simpanSOAP = async (rekamMedisId, data) => {
  const updated = await prisma.rekamMedis.update({
    where: { id: rekamMedisId },
    data: {
      // S - Subjektif
      keluhanUtama: data.keluhanUtama ?? undefined,
      riwayatPenyakitSekarang: data.riwayatPenyakitSekarang ?? undefined,
      riwayatPenyakitDahulu: data.riwayatPenyakitDahulu ?? undefined,
      riwayatAlergi: data.riwayatAlergi ?? undefined,

      // O - Objektif
      keadaanUmum: data.keadaanUmum ?? undefined,
      kesadaran: data.kesadaran ?? undefined,
      pemeriksaanFisik: data.pemeriksaanFisik ?? undefined,
      hasilPenunjang: data.hasilPenunjang ?? undefined,
      odontogram: data.odontogram ?? undefined,
      dmft: data.dmft ?? undefined,
      oralFindings: data.oralFindings ?? undefined,
      fotoObjektif: data.fotoObjektif ?? undefined,

      // A - Asesmen
      diagnosisKlinis: data.diagnosisKlinis ?? undefined,

      // P - Plan
      rencanaTerapi: data.rencanaTerapi ?? undefined,
      instruksiMedis: data.instruksiMedis ?? undefined,
    },
  });

  return updated;
};

/**
 * Simpan diagnosa ICD-10 (bulk create)
 */
const simpanDiagnosa = async (kunjunganId, user, diagnosaArr) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: { include: { tenagaMedis: true } }
    }
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const dokterId = kunjungan.dokterTujuanId || user.id;
  const penginputId = user.role === 'PERAWAT' ? user.id : null;

  // Hapus diagnosa lama untuk kunjungan ini (replace strategy)
  await prisma.diagnosisPasien.deleteMany({
    where: { kunjunganId },
  });

  // Bulk create diagnosa baru
  const created = await prisma.diagnosisPasien.createMany({
    data: diagnosaArr.map((d) => ({
      pasienId: kunjungan.pasienId,
      kunjunganId,
      icd10Id: d.icd10Id,
      dokterId,
      penginputId,
      jenisDiagnosis: d.jenisDiagnosis || 'Utama',
      diagnosisKlinis: d.diagnosisKlinis || null,
      statusKlinis: d.statusKlinis || 'Aktif',
      statusDiagnosis: d.statusVerifikasi || 'Suspek',
    })),
  });

  // Auto-register ke modul UKM jika ada ICD-10
  for (const d of diagnosaArr) {
    if (d.icd10Id) {
      const icd10 = await prisma.masterICD10.findUnique({ where: { id_icd10: d.icd10Id } });
      if (icd10 && icd10.kode_icd10) {
        await ukmService.autoRegisterUKM(kunjungan.pasienId, icd10.kode_icd10);
      }
    }
  }

  return created;
};

/**
 * Simpan tindakan ICD-9 (bulk create)
 */
const simpanTindakan = async (kunjunganId, user, tindakanArr) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: { include: { tenagaMedis: true } }
    }
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  // Hapus tindakan lama untuk kunjungan ini (replace strategy)
  await prisma.tindakanPasien.deleteMany({
    where: { kunjunganId },
  });

  // Bulk create tindakan baru
  const created = await prisma.tindakanPasien.createMany({
    data: tindakanArr.map((t) => ({
      pasienId: kunjungan.pasienId,
      kunjunganId,
      icd9Id: t.icd9Id,
      pelaksanaId: user.id,
      pelaksanaTeks: t.pelaksana || (user.role === 'PERAWAT' ? 'Perawat' : 'Dokter'),
      catatanTindakan: t.catatan || null,
    })),
  });

  return created;
};

/**
 * Simpan data alergi pasien (bulk create) dan sinkronisasi ke SATUSEHAT
 */
const simpanAlergi = async (kunjunganId, alergiArr, user) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: { include: { tenagaMedis: true } }
    }
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  // Hapus alergi lama
  await prisma.alergiPasien.deleteMany({
    where: { kunjunganId }
  });

  if (!alergiArr || alergiArr.length === 0) return [];

  // Create new alergi
  await prisma.alergiPasien.createMany({
    data: alergiArr.map((a) => ({
      pasienId: kunjungan.pasienId,
      kunjunganId,
      alergiId: a.alergiId,
      manifestasiKode: a.manifestasiKode,
      manifestasiNama: a.manifestasiNama,
      tingkatKeparahan: a.tingkatKeparahan || 'low'
    }))
  });

  // Fetch inserted data to get the relations
  const insertedAlergis = await prisma.alergiPasien.findMany({
    where: { kunjunganId },
    include: { alergiMaster: true }
  });

  return insertedAlergis;
};

/**
 * Selesaikan pemeriksaan: update status RekamMedis saja.
 * Bundle SATUSEHAT TIDAK dikirim di sini.
 * Bundle akan dikirim saat tindak lanjut pasien (Resep → Farmasi, Rujukan, atau Pulang).
 */
const selesaikanPemeriksaan = async (kunjunganId, user) => {
  const rm = await prisma.$transaction(async (tx) => {
    const updateData = { statusPemeriksaan: 'SELESAI' };
    if (user && user.role === 'PERAWAT') {
      updateData.penginputId = user.id;
    }

    const updatedRm = await tx.rekamMedis.update({
      where: { kunjunganId },
      data: updateData,
    });

    // Periksa apakah kunjungan saat ini memiliki resep obat aktif
    const existingResep = await tx.resep.findFirst({
      where: { kunjunganId, status: { not: 'BATAL' } },
    });

    // Jika ada resep obat, arahkan ke MENUNGGU_FARMASI (pasien antre bayar di Kasir & ambil obat di Farmasi)
    // Jika tidak ada resep obat, langsung arahkan ke MENUNGGU_KASIR
    const targetStatus = existingResep ? 'MENUNGGU_FARMASI' : 'MENUNGGU_KASIR';

    await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: targetStatus,
        waktuPemeriksaanSelesai: new Date(),
        satusehat_sync_status: 'PENDING',
      },
    });

    return updatedRm;
  });

  // Sinkronisasi tagihan kasir secara otomatis
  try {
    await kasirService.generateTagihan(kunjunganId);
    console.log(`[Kasir] Tagihan berhasil disinkronkan untuk kunjungan ${kunjunganId}`);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  console.log(`[Rawat Jalan] Pemeriksaan selesai untuk kunjungan ${kunjunganId}.`);
  return rm;
};

/**
 * Tunda pemeriksaan: kembalikan status Kunjungan ke MENUNGGU_DOKTER
 */
const tundaPemeriksaan = async (kunjunganId) => {
  return await prisma.kunjungan.update({
    where: { id: kunjunganId },
    data: { statusKunjungan: 'MENUNGGU_DOKTER' },
  });
};

/**
 * Get rekam medis by kunjungan ID
 */
const getRekamMedisByKunjungan = async (kunjunganId) => {
  const rm = await prisma.rekamMedis.findUnique({
    where: { kunjunganId },
    include: {
      pasien: true,
      dokter: { select: { id: true, namaLengkap: true } },
    },
  });
  return rm;
};

/**
 * Get alergi by kunjungan ID
 */
const getAlergiByKunjungan = async (kunjunganId) => {
  return await prisma.alergiPasien.findMany({
    where: { kunjunganId },
    include: { alergiMaster: true },
    orderBy: { createdAt: 'asc' }
  });
};

/**
 * Get diagnosa by kunjungan ID
 */
const getDiagnosaByKunjungan = async (kunjunganId) => {
  const diagnosa = await prisma.diagnosisPasien.findMany({
    where: { kunjunganId },
    include: {
      icd10: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return diagnosa;
};

/**
 * Get tindakan by kunjungan ID
 */
const getTindakanByKunjungan = async (kunjunganId) => {
  const tindakan = await prisma.tindakanPasien.findMany({
    where: { kunjunganId },
    include: {
      icd9: true,
    },
    orderBy: { waktuTindakan: 'asc' },
  });
  return tindakan;
};

/**
 * Helper internal untuk mengirim Bundle Transaction ke SATUSEHAT
 */
const sendBundleForKunjungan = async (kunjunganId) => {
  try {
    const dataComplete = await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
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
        dokterTujuan: { include: { tenagaMedis: true } },
        rujukanKeluar: true,
        orderRadiologi: {
          include: {
            details: true,
            hasil: true,
            dokter: { include: { tenagaMedis: true } }
          }
        }
      }
    });

    if (!dataComplete || dataComplete.persetujuan?.persetujuanSatusehat === false) {
      console.log(`[SATUSEHAT Sync] Kunjungan ${kunjunganId} di-skip.`);
      return;
    }

    const resepDetails = [];
    if (Array.isArray(dataComplete.resep)) {
      dataComplete.resep.forEach((r) => {
        if (Array.isArray(r.details)) {
          r.details.forEach((d) => resepDetails.push({ ...d, resepId: r.id }));
        }
      });
    }

    const observations = extractObservationsFromScreening(dataComplete.screening);

    const completePayload = {
      ...dataComplete,
      observations,
      resepDetails,
      encounterId: dataComplete.encounterId
    };

    const bundlePayload = toRawatJalanBundle(completePayload);
    console.log(`[SATUSEHAT Bundle] 🚀 Mengirim Bundle untuk Kunjungan ID: ${kunjunganId}...`);

    const response = await SatuSehatGateway.sendBundleTransaction(bundlePayload);

    // Ekstrak ServiceRequest ID dari Respon Bundle SATUSEHAT
    if (response?.entry && Array.isArray(response.entry)) {
      const srEntry = response.entry.find(e =>
        e.response?.resourceType === 'ServiceRequest' ||
        e.response?.location?.includes('ServiceRequest/')
      );
      if (srEntry) {
        const srLocation = srEntry.response.location;
        const srId = srEntry.response.resourceID || (srLocation ? srLocation.split('ServiceRequest/')[1]?.split('/')[0] : null);
        if (srId) {
          const rujukanRecord = await prisma.rujukanKeluar.findUnique({ where: { kunjunganId } });
          if (rujukanRecord) {
            await prisma.rujukanKeluar.update({
              where: { id: rujukanRecord.id },
              data: { satusehatId: srId }
            });
            console.log(`[SATUSEHAT Sync] ✅ ServiceRequest ID (${srId}) berhasil disimpan ke DB RujukanKeluar!`);
          }
        }
      }
    }

    await prisma.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        satusehat_sync_status: 'SUCCESS',
        satusehat_last_error: null
      }
    });

    console.log(`[SATUSEHAT Sync] ✅ Berhasil sync bundle untuk kunjungan ${kunjunganId}`);
  } catch (syncError) {
    console.error(`[SATUSEHAT Bundle Error] Gagal mengirim Bundle:`, syncError.message || syncError);
    try {
      await prisma.kunjungan.update({
        where: { id: kunjunganId },
        data: {
          satusehat_sync_status: 'FAILED',
          satusehat_last_error: syncError.message || String(syncError)
        }
      });
    } catch (_) {}
  }
};

/**
 * Simpan Resep
 */
const simpanResep = async (kunjunganId, user, resepArr) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: { include: { tenagaMedis: true } }
    }
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const dokterId = kunjungan.dokterTujuanId || user.id;
  const penginputId = user.role === 'PERAWAT' ? user.id : null;

  const result = await prisma.$transaction(async (tx) => {
    // Hapus resep yang masih MENUNGGU_FARMASI sebelumnya jika ada, agar resep tidak ganda/stale
    const oldReseps = await tx.resep.findMany({
      where: { kunjunganId, status: 'MENUNGGU_FARMASI' }
    });
    for (const old of oldReseps) {
      await tx.resepDetail.deleteMany({ where: { resepId: old.id } });
      await tx.resep.delete({ where: { id: old.id } });
    }

    // Buat record Resep
    const resep = await tx.resep.create({
      data: {
        kunjunganId,
        pasienId: kunjungan.pasienId,
        dokterId,
        penginputId,
        status: 'MENUNGGU_FARMASI',
      },
    });

    // Buat detail resep dengan validasi referensi foreign key MasterObat
    const details = [];
    for (const r of (resepArr || [])) {
      if (!r || !r.obatId) continue;

      let validObatId = r.obatId;
      let obat = await tx.masterObat.findUnique({ where: { id: validObatId } });

      if (!obat) {
        // Fallback: periksa berdasarkan kodeObat atau kfa_code atau nama obat
        const fallbackObat = await tx.masterObat.findFirst({
          where: {
            OR: [
              { kodeObat: validObatId },
              { kfa_code: validObatId },
              r.namaObat ? { namaObat: { equals: r.namaObat, mode: 'insensitive' } } : undefined
            ].filter(Boolean)
          }
        });

        if (fallbackObat) {
          validObatId = fallbackObat.id;
        } else {
          // Cek apakah item merupakan vaksin agar diberikan pesan edukatif
          const isVaksin = await tx.masterVaksin.findUnique({ where: { id: validObatId } });
          if (isVaksin) {
            const err = new Error(`Item "${isVaksin.namaVaksin}" adalah sediaan Vaksin Cold-Chain. Vaksin tidak dilayani melalui e-Resep Farmasi, melainkan dicatat langsung melalui modul Imunisasi faskes.`);
            err.statusCode = 400;
            throw err;
          }

          console.warn(`[simpanResep] Peringatan: Obat dengan ID "${validObatId}" tidak ditemukan di Master Obat. Item dilewati.`);
          continue;
        }
      }

      details.push({
        resepId: resep.id,
        obatId: validObatId,
        jumlah: parseInt(r.qty || r.jumlah) || 1,
        aturanPakai: r.signa || r.aturanPakai || 'Sesuai petunjuk dokter',
        catatan: r.catatan || null,
        noBatch: r.noBatch || null,
      });
    }

    if (details.length > 0) {
      await tx.resepDetail.createMany({ data: details });
    } else if (Array.isArray(resepArr) && resepArr.length > 0) {
      const err = new Error('Semua item obat yang dipilih tidak ditemukan dalam katalog master data.');
      err.statusCode = 400;
      throw err;
    }

    // Status kunjungan ke MENUNGGU_FARMASI (Bundle dikirim saat penyerahan obat di Farmasi)
    // KECUALI jika pasien sedang RAWAT_INAP, pertahankan statusKunjungan tetap RAWAT_INAP
    if (kunjungan.statusKunjungan !== 'RAWAT_INAP') {
      await tx.kunjungan.update({
        where: { id: kunjunganId },
        data: { statusKunjungan: 'MENUNGGU_FARMASI' },
      });
    }

    return { resep, details };
  });

  // Generate tagihan kasir secara otomatis (termasuk item obat & tindakan)
  try {
    await kasirService.generateTagihan(kunjunganId);
    console.log(`[Kasir] Tagihan berhasil dibuat untuk kunjungan ${kunjunganId}`);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  return result.resep;
};

/**
 * Simpan Rujukan
 */
const simpanRujukan = async (kunjunganId, dokterId, rujukanData) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      dokterTujuan: {
        include: { tenagaMedis: true }
      }
    }
  });
  if (!kunjungan) throw new Error('Kunjungan tidak ditemukan');

  const rujukan = await prisma.$transaction(async (tx) => {
    const res = await tx.rujukanKeluar.upsert({
      where: { kunjunganId },
      update: {
        faskesTujuan: rujukanData.faskesTujuan,
        poliTujuan: rujukanData.poliTujuan,
        dokterTujuan: rujukanData.dokterTujuan || null,
        alasanRujukan: rujukanData.alasanRujukan,
      },
      create: {
        kunjunganId,
        pasienId: kunjungan.pasienId,
        dokterId,
        faskesTujuan: rujukanData.faskesTujuan,
        poliTujuan: rujukanData.poliTujuan,
        dokterTujuan: rujukanData.dokterTujuan || null,
        alasanRujukan: rujukanData.alasanRujukan,
      },
    });

    await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'MENUNGGU_KASIR',
        statusPulang: 'DIRUJUK_RS',
        caraKeluar: 'RUJUK',
        waktuDischarge: new Date(),
      },
    });

    // Otomatis bebaskan Bed UGD / Rawat Inap jika ada
    await tx.tempatTidur.updateMany({
      where: { kunjunganAktifId: kunjunganId },
      data: {
        statusBed: 'TERSEDIA',
        operationalStatus: 'U',
        kunjunganAktifId: null,
      },
    });

    if (kunjungan.rekamMedis && kunjungan.rekamMedis.statusPemeriksaan === 'DRAFT') {
      await tx.rekamMedis.update({
        where: { id: kunjungan.rekamMedis.id },
        data: { statusPemeriksaan: 'SELESAI' },
      });
    }

    return res;
  });

  // Generate tagihan kasir secara otomatis
  try {
    await kasirService.generateTagihan(kunjunganId);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  // Kirim Bundle Transaction SATUSEHAT (Termasuk Encounter, Observation, Condition, & ServiceRequest Rujukan)
  await sendBundleForKunjungan(kunjunganId);

  return rujukan;
};

/**
 * Assign Pasien ke Ruang Rawat Inap (Bed Assignment dari Rawat Jalan / UGD)
 */
const assignRawatInap = async (kunjunganId, dokterId, dataRawatInap) => {
  const { tempatTidurId, alasanRawatInap, instruksiMedis } = dataRawatInap;

  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      rekamMedis: true,
    },
  });
  if (!kunjungan) throw new Error('Kunjungan tidak ditemukan');

  const bed = await prisma.tempatTidur.findUnique({
    where: { id: tempatTidurId },
    include: { ruangan: true },
  });
  if (!bed) throw new Error('Tempat tidur tidak ditemukan');

  if (bed.statusBed === 'TERISI' && bed.kunjunganAktifId && bed.kunjunganAktifId !== kunjunganId) {
    throw new Error(`Tempat tidur ${bed.nomorBed} di ${bed.ruangan.namaRuangan} sudah terisi.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 0. Bebaskan Bed UGD lama jika pasien berasal dari UGD
    await tx.tempatTidur.updateMany({
      where: {
        kunjunganAktifId: kunjunganId,
        id: { not: tempatTidurId },
      },
      data: {
        statusBed: 'TERSEDIA',
        operationalStatus: 'U',
        kunjunganAktifId: null,
      },
    });

    // 1. Assign Bed Rawat Inap Baru
    const updatedBed = await tx.tempatTidur.update({
      where: { id: tempatTidurId },
      data: {
        statusBed: 'TERISI',
        operationalStatus: 'O',
        kunjunganAktifId: kunjunganId,
      },
      include: { ruangan: true },
    });

    // 2. Update status Kunjungan ke RAWAT_INAP
    const updatedKunjungan = await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'RAWAT_INAP',
        statusPulang: 'RAWAT_INAP',
        caraKeluar: 'RAWAT_INAP',
        kondisiDischarge: 'BELUM_SEMBUH',
        waktuMasukRawatInap: new Date(),
        waktuDischarge: null,
      },
    });

    // 3. Selesaikan rekam medis rawat jalan & catat instruksi inap
    if (kunjungan.rekamMedis) {
      const existingInstruksi = kunjungan.rekamMedis.instruksiMedis || '';
      const notes = [
        existingInstruksi,
        alasanRawatInap ? `[Indikasi Rawat Inap] ${alasanRawatInap}` : '',
        instruksiMedis ? `[Instruksi Bangsal] ${instruksiMedis}` : '',
        `[Bed Assignment] ${bed.ruangan.namaRuangan} - Bed ${bed.nomorBed}`,
      ].filter(Boolean).join('\n');

      await tx.rekamMedis.update({
        where: { id: kunjungan.rekamMedis.id },
        data: {
          statusPemeriksaan: 'SELESAI',
          instruksiMedis: notes,
        },
      });
    }

    return { bed: updatedBed, kunjungan: updatedKunjungan };
  });

  // Generate tagihan kasir
  try {
    await kasirService.generateTagihan(kunjunganId);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  // Kirim Bundle Transaction SATUSEHAT
  try {
    await sendBundleForKunjungan(kunjunganId);
  } catch (errSS) {
    console.error(`[SATUSEHAT Error] Gagal sync bundle:`, errSS.message);
  }

  return result;
};

/**
 * Pulang tanpa resep/rujukan
 */
const pulang = async (kunjunganId) => {
  const existingResep = await prisma.resep.findFirst({
    where: { kunjunganId, status: 'MENUNGGU_FARMASI' },
  });
  const targetStatus = existingResep ? 'MENUNGGU_FARMASI' : 'MENUNGGU_KASIR';

  const result = await prisma.$transaction(async (tx) => {
    // Bebaskan Bed UGD / Bed Aktif jika ada
    await tx.tempatTidur.updateMany({
      where: { kunjunganAktifId: kunjunganId },
      data: {
        statusBed: 'TERSEDIA',
        operationalStatus: 'U',
        kunjunganAktifId: null,
      },
    });

    const updated = await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: targetStatus,
        statusPulang: 'PULANG_SEMBUH',
        caraKeluar: 'PERSETUJUAN_DOKTER',
        kondisiDischarge: 'SEMBUH',
        waktuDischarge: new Date(),
      },
    });

    await tx.rekamMedis.updateMany({
      where: { kunjunganId },
      data: { statusPemeriksaan: 'SELESAI' },
    });

    return updated;
  });

  // Generate tagihan kasir secara otomatis
  try {
    await kasirService.generateTagihan(kunjunganId);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  // Kirim Bundle SATUSEHAT langsung untuk pasien Pulang
  sendBundleForKunjungan(kunjunganId);

  return result;
};

/**
 * Pasien Meninggal Dunia (Discharge UGD / Rawat Jalan)
 */
const catatMeninggal = async (kunjunganId, dokterId, catatan) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: { rekamMedis: true }
  });
  if (!kunjungan) throw new Error('Kunjungan tidak ditemukan');

  const result = await prisma.$transaction(async (tx) => {
    // Bebaskan Bed UGD jika ada
    await tx.tempatTidur.updateMany({
      where: { kunjunganAktifId: kunjunganId },
      data: {
        statusBed: 'TERSEDIA',
        operationalStatus: 'U',
        kunjunganAktifId: null,
      },
    });

    const updatedKunjungan = await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'SELESAI',
        statusPulang: 'MENINGGAL',
        caraKeluar: 'MENINGGAL',
        kondisiDischarge: 'MENINGGAL',
        waktuDischarge: new Date()
      }
    });

    if (kunjungan.rekamMedis) {
      await tx.rekamMedis.update({
        where: { id: kunjungan.rekamMedis.id },
        data: {
          statusPemeriksaan: 'SELESAI',
          instruksiMedis: catatan ? `[Pasien Meninggal] ${catatan}` : '[Pasien Meninggal Dunia di UGD]'
        }
      });
    }

    return updatedKunjungan;
  });

  return result;
};

/**
 * Pulangkan Pasien Rawat Inap (Discharge Rawat Inap)
 * Menghitung hari rawat inap, membebaskan tempat tidur, membuat e-resep obat pulang, dan menghasilkan tagihan kumulatif kasir
 */
const dischargeRawatInap = async (kunjunganId, dataDischarge = {}, user = null) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      rekamMedis: true,
      dokterTujuan: true,
      tempatTidurs: {
        include: { ruangan: true },
      },
    },
  });
  if (!kunjungan) throw new Error('Kunjungan tidak ditemukan');

  // Tangkap informasi bed yang sedang ditempati sebelum dibebaskan
  const bedAktif = (kunjungan.tempatTidurs && kunjungan.tempatTidurs.length > 0)
    ? kunjungan.tempatTidurs[0]
    : await prisma.tempatTidur.findFirst({
        where: { kunjunganAktifId: kunjunganId },
        include: { ruangan: true },
      });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Simpan Resep Obat Pulang (Take-Home Medication) jika dokter meresepkan
    if (Array.isArray(dataDischarge.resepPulang) && dataDischarge.resepPulang.length > 0) {
      const dokterId = user?.id || kunjungan.dokterTujuanId || user?.id;
      const penginputId = user?.role === 'PERAWAT' ? user?.id : null;

      const resepPulang = await tx.resep.create({
        data: {
          kunjunganId,
          pasienId: kunjungan.pasienId,
          dokterId: dokterId || kunjungan.pasienId,
          penginputId,
          status: 'MENUNGGU_FARMASI',
        },
      });

      const details = [];
      for (const r of dataDischarge.resepPulang) {
        if (!r || !r.obatId) continue;
        details.push({
          resepId: resepPulang.id,
          obatId: r.obatId,
          jumlah: parseInt(r.qty || r.jumlah, 10) || 1,
          aturanPakai: r.signa || r.aturanPakai || '3 x 1 Sehari',
          catatan: `[Obat Pulang] ${r.catatan || ''}`.trim(),
          noBatch: r.noBatch || null,
        });
      }

      if (details.length > 0) {
        await tx.resepDetail.createMany({ data: details });
      }
    }

    // 2. Bebaskan seluruh Bed Rawat Inap yang ditempati pasien
    await tx.tempatTidur.updateMany({
      where: { kunjunganAktifId: kunjunganId },
      data: {
        statusBed: 'TERSEDIA',
        operationalStatus: 'U',
        kunjunganAktifId: null,
      },
    });

    // 3. Update status Kunjungan ke MENUNGGU_KASIR agar pasien langsung muncul di loket pembayaran Kasir
    const statusPulangFinal = dataDischarge.caraKeluar === 'RUJUK'
      ? 'DIRUJUK_RS'
      : (dataDischarge.caraKeluar === 'MENINGGAL' ? 'MENINGGAL' : 'PULANG_SEMBUH');

    const updatedKunjungan = await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'MENUNGGU_KASIR',
        statusPulang: statusPulangFinal,
        caraKeluar: dataDischarge.caraKeluar || 'PERSATUAN_DOKTER',
        kondisiDischarge: dataDischarge.kondisiDischarge || (dataDischarge.caraKeluar === 'RUJUK' ? 'BELUM_SEMBUH' : 'SEMBUH'),
        waktuDischarge: new Date(),
        waktuMasukRawatInap: kunjungan.waktuMasukRawatInap || kunjungan.tanggalRegistrasi || new Date(),
      },
    });

    // 4. Catat Rujukan Keluar jika pasien dirujuk ke RS / Faskes lain
    if (dataDischarge.caraKeluar === 'RUJUK' && dataDischarge.faskesTujuan) {
      await tx.rujukanKeluar.create({
        data: {
          kunjunganId,
          pasienId: kunjungan.pasienId,
          dokterId: kunjungan.dokterTujuanId || user?.id,
          faskesTujuan: dataDischarge.faskesTujuan,
          poliTujuan: dataDischarge.poliTujuan || 'Spesialis Rujukan',
          dokterTujuan: dataDischarge.dokterTujuan || null,
          alasanRujukan: dataDischarge.alasanRujukan || dataDischarge.edukasiPulang || 'Rujukan lanjutan dari rawat inap',
        },
      });
    }

    // 5. Catat edukasi pulang & rencana kontrol di rekam medis jika ada
    if (kunjungan.rekamMedis && (dataDischarge.edukasiPulang || dataDischarge.rencanaKontrol)) {
      const existingInstruksi = kunjungan.rekamMedis.instruksiMedis || '';
      const notes = [
        existingInstruksi,
        dataDischarge.edukasiPulang ? `[Edukasi Pulang Inap] ${dataDischarge.edukasiPulang}` : '',
        dataDischarge.rencanaKontrol ? `[Rencana Kontrol] ${dataDischarge.rencanaKontrol}` : '',
      ].filter(Boolean).join('\n');

      await tx.rekamMedis.update({
        where: { id: kunjungan.rekamMedis.id },
        data: { instruksiMedis: notes },
      });
    }

    return updatedKunjungan;
  });

  // 6. Generate Tagihan Kasir Final Kumulatif (Karcis Rawat Jalan + Tindakan + Tempat Tidur + Terapi Inap + Resep Pulang)
  let tagihanFinal = null;
  try {
    tagihanFinal = await kasirService.generateTagihan(kunjunganId, { bedInfo: bedAktif });
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan rawat inap:`, errTagihan.message);
  }

  // 7. SATUSEHAT Sync
  try {
    sendBundleForKunjungan(kunjunganId);
  } catch (errSS) {
    console.error(`[SATUSEHAT Error]`, errSS.message);
  }

  return { kunjungan: result, tagihan: tagihanFinal };
};

/**
 * Simpan Catatan Perkembangan Pasien Terintegrasi (CPPT Rawat Inap)
 * dan otomatis sinkronkan ke Rekam Medis (RME) Kunjungan.
 */
const simpanCPPT = async (kunjunganId, user, data) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      rekamMedis: true,
      pasien: true,
      screening: true,
      dokterTujuan: true,
    },
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan rawat inap tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const dokterId = user.role?.includes('DOKTER') ? user.id : (kunjungan.dokterTujuanId || user.id);

  // 1. Simpan entitas Catatan Perkembangan (CPPT)
  const profesi = data.profesi || (user.role === 'PERAWAT' ? 'PERAWAT' : 'DOKTER');
  const tanggalCatatan = data.tanggalCatatan ? new Date(data.tanggalCatatan) : new Date();

  const cppt = await prisma.catatanPerkembangan.create({
    data: {
      kunjunganId: kunjungan.id,
      pasienId: kunjungan.pasienId,
      petugasId: user.id,
      profesi: profesi,
      tanggalCatatan: tanggalCatatan,
      subjektif: data.subjektif || null,
      objektif: data.objektif || null,
      tandaVital: data.tandaVital || null,
      asesmen: data.asesmen || null,
      plan: data.plan || null,
      instruksiMedis: data.instruksiMedis || null,
    },
    include: {
      petugas: {
        select: { id: true, namaLengkap: true, username: true, role: true },
      },
    },
  });

  // 2. Jika dokter mengikutsertakan resep terapi obat, simpan resep secara resmi
  let savedResep = null;
  if (data.resep && Array.isArray(data.resep) && data.resep.length > 0) {
    try {
      savedResep = await simpanResep(kunjunganId, user, data.resep);
    } catch (resepErr) {
      console.warn('[simpanCPPT] Gagal menyimpan resep bersama CPPT:', resepErr.message);
    }
  }

  // 3. Sinkronkan ke tabel RekamMedis pasien (RME Kunjungan)
  let rekamMedis;
  if (kunjungan.rekamMedis) {
    rekamMedis = await prisma.rekamMedis.update({
      where: { id: kunjungan.rekamMedis.id },
      data: {
        keluhanUtama: data.subjektif !== undefined && data.subjektif !== '' ? data.subjektif : kunjungan.rekamMedis.keluhanUtama,
        pemeriksaanFisik: data.objektif !== undefined && data.objektif !== '' ? data.objektif : kunjungan.rekamMedis.pemeriksaanFisik,
        diagnosisKlinis: data.asesmen !== undefined && data.asesmen !== '' ? data.asesmen : kunjungan.rekamMedis.diagnosisKlinis,
        rencanaTerapi: data.plan !== undefined && data.plan !== '' ? data.plan : kunjungan.rekamMedis.rencanaTerapi,
        instruksiMedis: data.instruksiMedis !== undefined && data.instruksiMedis !== '' ? data.instruksiMedis : kunjungan.rekamMedis.instruksiMedis,
        dokterId: dokterId,
        statusPemeriksaan: 'DIPERIKSA',
      },
    });
  } else {
    rekamMedis = await prisma.rekamMedis.create({
      data: {
        kunjunganId: kunjungan.id,
        pasienId: kunjungan.pasienId,
        dokterId: dokterId,
        keluhanUtama: data.subjektif || 'Catatan CPPT Rawat Inap',
        pemeriksaanFisik: data.objektif || null,
        diagnosisKlinis: data.asesmen || null,
        rencanaTerapi: data.plan || null,
        instruksiMedis: data.instruksiMedis || null,
        statusPemeriksaan: 'DIPERIKSA',
      },
    });
  }

  return { cppt, rekamMedis, resep: savedResep };
};

/**
 * Get Riwayat CPPT untuk kunjungan rawat inap
 */
const getRiwayatCPPT = async (kunjunganId) => {
  return await prisma.catatanPerkembangan.findMany({
    where: { kunjunganId },
    include: {
      petugas: {
        select: { id: true, namaLengkap: true, username: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Ambil seluruh resep obat dari kunjungan (rawat jalan / rawat inap / UGD)
 */
const getResepByKunjungan = async (kunjunganId) => {
  return await prisma.resep.findMany({
    where: { kunjunganId },
    include: {
      details: {
        include: { obat: true },
      },
      dokter: {
        select: { id: true, namaLengkap: true, username: true },
      },
      penginput: {
        select: { id: true, namaLengkap: true, username: true },
      },
    },
    orderBy: { tanggalResep: 'desc' },
  });
};

/**
 * Ambil Rekam Medis Sebelumnya untuk referensi input CPPT dokter.
 * Urutan prioritas penarikan data sebelumnya:
 * 1. Catatan CPPT paling terakhir pada kunjungan rawat inap ini
 * 2. Asesmen Medis Awal Masuk (IGD / Poliklinik) dari kunjungan saat ini
 * 3. Rekam Medis kunjungan terakhir sebelumnya yang telah selesai
 */
const getRekamMedisSebelumnya = async (kunjunganId) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId },
    include: {
      pasien: true,
      rekamMedis: {
        include: {
          dokter: { select: { id: true, namaLengkap: true, role: true } },
        },
      },
      screening: true,
      diagnosis: { include: { icd10: true } },
      catatanPerkembangans: {
        include: {
          petugas: { select: { id: true, namaLengkap: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!kunjungan) {
    const err = new Error('Data kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  // Skenario 1: Sudah ada CPPT sebelumnya pada rawat inap ini
  if (kunjungan.catatanPerkembangans && kunjungan.catatanPerkembangans.length > 0) {
    const prev = kunjungan.catatanPerkembangans[0];
    return {
      tipeSumber: 'CPPT_TERAKHIR',
      labelSumber: `Catatan CPPT Terakhir (${prev.profesi})`,
      tanggal: prev.createdAt,
      petugas: prev.petugas?.namaLengkap || 'Tenaga Medis',
      subjektif: prev.subjektif || '',
      objektif: prev.objektif || '',
      tandaVital: prev.tandaVital || null,
      asesmen: prev.asesmen || '',
      plan: prev.plan || '',
      instruksiMedis: prev.instruksiMedis || '',
    };
  }

  // Skenario 2: Belum ada CPPT di rawat inap, tapi ada Rekam Medis / Screening saat masuk (UGD/Poli)
  if (kunjungan.rekamMedis || kunjungan.screening) {
    const rm = kunjungan.rekamMedis;
    const sc = kunjungan.screening;
    const dxList = kunjungan.diagnosis?.map(d => d.icd10?.namaPenyakit || d.diagnosisKlinis).filter(Boolean).join(', ');

    return {
      tipeSumber: 'ASESMEN_AWAL_MASUK',
      labelSumber: 'Asesmen Medis Awal Masuk (IGD / Poliklinik)',
      tanggal: rm?.createdAt || sc?.tanggalScreening || kunjungan.tanggalRegistrasi,
      petugas: rm?.dokter?.namaLengkap || 'Dokter Pemeriksa Awal',
      subjektif: rm?.keluhanUtama || sc?.keluhanUtama || '',
      objektif: rm?.pemeriksaanFisik || (sc ? `TD: ${sc.tekananDarahSistolik || '-'}/${sc.tekananDarahDiastolik || '-'}, Nadi: ${sc.nadi || '-'}, Suhu: ${sc.suhuTubuh || '-'}°C, RR: ${sc.frekuensiNapas || '-'}` : ''),
      tandaVital: sc ? {
        tdSistolik: sc.tekananDarahSistolik,
        tdDiastolik: sc.tekananDarahDiastolik,
        nadi: sc.nadi,
        suhu: sc.suhuTubuh,
        rr: sc.frekuensiNapas,
        spo2: sc.saturasiOksigen,
      } : null,
      asesmen: rm?.diagnosisKlinis || dxList || '',
      plan: rm?.rencanaTerapi || '',
      instruksiMedis: rm?.instruksiMedis || '',
    };
  }

  // Skenario 3: Cari riwayat kunjungan paling baru sebelumnya dari pasien ini
  const prevKunjungan = await prisma.kunjungan.findFirst({
    where: {
      pasienId: kunjungan.pasienId,
      id: { not: kunjunganId },
      statusKunjungan: { in: ['SELESAI', 'PULANG', 'MENUNGGU_KASIR'] },
    },
    orderBy: { tanggalRegistrasi: 'desc' },
    include: {
      rekamMedis: {
        include: { dokter: { select: { id: true, namaLengkap: true } } },
      },
      screening: true,
      diagnosis: { include: { icd10: true } },
    },
  });

  if (prevKunjungan && (prevKunjungan.rekamMedis || prevKunjungan.screening)) {
    const prm = prevKunjungan.rekamMedis;
    const psc = prevKunjungan.screening;
    const pdx = prevKunjungan.diagnosis?.map(d => d.icd10?.namaPenyakit || d.diagnosisKlinis).filter(Boolean).join(', ');

    return {
      tipeSumber: 'KUNJUNGAN_SEBELUMNYA',
      labelSumber: 'Rekam Medis Kunjungan Terakhir Pasien',
      tanggal: prevKunjungan.tanggalRegistrasi,
      petugas: prm?.dokter?.namaLengkap || 'Dokter Kunjungan Lalu',
      subjektif: prm?.keluhanUtama || psc?.keluhanUtama || '',
      objektif: prm?.pemeriksaanFisik || '',
      tandaVital: psc ? {
        tdSistolik: psc.tekananDarahSistolik,
        tdDiastolik: psc.tekananDarahDiastolik,
        nadi: psc.nadi,
        suhu: psc.suhuTubuh,
        rr: psc.frekuensiNapas,
        spo2: psc.saturasiOksigen,
      } : null,
      asesmen: prm?.diagnosisKlinis || pdx || '',
      plan: prm?.rencanaTerapi || '',
      instruksiMedis: prm?.instruksiMedis || '',
    };
  }

  return null;
};

module.exports = {
  getAntrianDokter,
  mulaiPemeriksaan,
  simpanSOAP,
  simpanDiagnosa,
  simpanTindakan,
  selesaikanPemeriksaan,
  selesaikanKunjungan: selesaikanPemeriksaan,
  tundaPemeriksaan,
  getRekamMedisByKunjungan,
  getDiagnosaByKunjungan,
  getTindakanByKunjungan,
  simpanAlergi,
  getAlergiByKunjungan,
  simpanResep,
  simpanRujukan,
  assignRawatInap,
  dischargeRawatInap,
  pulang,
  catatMeninggal,
  getRiwayatDokter,
  getRiwayatPasienByRM,
  sendBundleForKunjungan,
  simpanCPPT,
  getRiwayatCPPT,
  getRekamMedisSebelumnya,
  getResepByKunjungan,
};

