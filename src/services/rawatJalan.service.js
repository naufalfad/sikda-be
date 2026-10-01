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

  // Filter isolasi data Poliklinik: 
  // Dokter/Perawat hanya melihat antrian jika pasien masuk ke Poli-nya.
  if (user && (user.role === 'DOKTER' || user.role === 'PERAWAT') && user.poliklinikId) {
    whereClause.OR = [
      { poliklinikId: user.poliklinikId },
      { dokterTujuanId: user.id }
    ];
  }

  let kunjungans = await prisma.kunjungan.findMany({
    where: whereClause,
    include: {
      pasien: true,
      poliklinik: true,
      screening: true,
      rekamMedis: true,
      dokterTujuan: {
        select: { id: true, namaLengkap: true, username: true },
      },
      orderLab: {
        include: {
          details: true
        }
      }
    }
  });

  // Kalkulasi Skor Prioritas
  kunjungans = kunjungans.map(kunjungan => {
    let score = 1; // Default: Umum (Hijau)

    const triage = kunjungan.screening?.kategoriTriage?.toLowerCase() || '';
    if (triage === 'merah') {
      score = 4;
    } else if (triage === 'kuning') {
      score = 3;
    } else if (triage === 'hitam') {
      score = 0; // Ditangani khusus, biasanya tidak di poli
    } else {
      // Jika Hijau / Belum Triage, cek prioritas demografi
      const prioritas = kunjungan.prioritas?.toLowerCase() || '';
      if (['lansia', 'disabilitas', 'ibu hamil', 'bayi', 'anak'].some(p => prioritas.includes(p))) {
        score = 2;
      }
    }

    return { ...kunjungan, _priorityScore: score };
  });

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
 * Get riwayat rekam medis (pasien selesai) untuk dokter
 */
const getRiwayatDokter = async (user) => {
  const whereClause = {
    statusKunjungan: {
      in: ['SELESAI', 'MENUNGGU_FARMASI', 'PULANG'],
    },
  };

  // Filter isolasi multi-tenant Faskes:
  applyFaskesScope(whereClause, user);

  if (user && user.role === 'DOKTER') {
    whereClause.OR = [
      { poliklinikId: user.poliklinikId },
      { dokterTujuanId: user.id }
    ];
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
 */
const getRiwayatPasienByRM = async (noRM) => {
  const pasien = await prisma.pasien.findUnique({
    where: { noRM },
    include: {
      kunjungans: {
        where: {
          statusKunjungan: {
            in: ['SELESAI', 'MENUNGGU_FARMASI', 'PULANG'],
          },
        },
        orderBy: [
          { tanggalRegistrasi: 'desc' },
          { jamRegistrasi: 'desc' },
        ],
        include: {
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
            include: { details: true }
          }
        },
      },
    },
  });

  if (!pasien) {
    const err = new Error('Data pasien tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  return pasien;
};

/**
 * Mulai pemeriksaan: lock status → DIPERIKSA, buat RekamMedis DRAFT
 */
const mulaiPemeriksaan = async (kunjunganId, dokterId) => {
  return await prisma.$transaction(async (tx) => {
    const kunjungan = await tx.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: { rekamMedis: true },
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

    const effectiveDokterId = dokterId || kunjungan.dokterTujuanId || null;

    // Jika sudah ada rekam medis (sudah pernah dimulai), kembalikan saja
    if (kunjungan.rekamMedis) {
      // Update status hanya jika masih MENUNGGU_DOKTER
      if (kunjungan.statusKunjungan === 'MENUNGGU_DOKTER') {
        await tx.kunjungan.update({
          where: { id: kunjunganId },
          data: { statusKunjungan: 'DIPERIKSA' },
        });
      }
      return kunjungan.rekamMedis;
    }

    // Lock status kunjungan jika masih baru
    if (kunjungan.statusKunjungan === 'MENUNGGU_DOKTER') {
      await tx.kunjungan.update({
        where: { id: kunjunganId },
        data: {
          statusKunjungan: 'DIPERIKSA',
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

    // Status kunjungan belum SELESAI, menunggu tindak lanjut (Resep/Rujukan/Pulang)
    await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'MENUNGGU_TINDAK_LANJUT',
        satusehat_sync_status: 'PENDING'
      },
    });

    return updatedRm;
  });

  console.log(`[Rawat Jalan] Pemeriksaan selesai untuk kunjungan ${kunjunganId}. Menunggu tindak lanjut (Resep/Rujukan/Pulang).`);
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
    await prisma.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        satusehat_sync_status: 'FAILED',
        satusehat_last_error: syncError.message || String(syncError)
      }
    });
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

    // Buat detail resep
    const details = resepArr.map((r) => ({
      resepId: resep.id,
      obatId: r.obatId,
      jumlah: r.qty,
      aturanPakai: r.signa,
      catatan: r.catatan || null,
    }));

    await tx.resepDetail.createMany({ data: details });

    // Status kunjungan ke MENUNGGU_FARMASI (Bundle dikirim saat penyerahan obat di Farmasi)
    await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: { statusKunjungan: 'MENUNGGU_FARMASI' },
    });

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
      data: { statusKunjungan: 'MENUNGGU_KASIR', waktuDischarge: new Date() },
    });

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
 * Pulang tanpa resep/rujukan
 */
const pulang = async (kunjunganId) => {
  const updated = await prisma.kunjungan.update({
    where: { id: kunjunganId },
    data: { statusKunjungan: 'MENUNGGU_KASIR', waktuDischarge: new Date() },
  });

  // Generate tagihan kasir secara otomatis
  try {
    await kasirService.generateTagihan(kunjunganId);
  } catch (errTagihan) {
    console.error(`[Kasir Error] Gagal generate tagihan:`, errTagihan.message);
  }

  // Kirim Bundle SATUSEHAT langsung untuk pasien Pulang
  sendBundleForKunjungan(kunjunganId);

  return updated;
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
  pulang,
  getRiwayatDokter,
  getRiwayatPasienByRM,
  sendBundleForKunjungan,
};
