const prisma = require('../config/prisma');
const { applyFaskesScope } = require('../utils/tenantScope');

/**
 * Get all Kunjungan with status MENUNGGU for Screening
 */
const getKunjunganScreening = async (user) => {
  const whereClause = {
    statusKunjungan: { in: ['MENUNGGU', 'DIPROSES_SCREENING'] },
  };

  // Filter isolasi data multi-tenant Faskes:
  applyFaskesScope(whereClause, user);

  // Puskesmas: Pemeriksaan awal / screening perawat melayani semua poli di faskes ini

  const kunjungans = await prisma.kunjungan.findMany({
    where: whereClause,
    include: {
      pasien: true,
      poliklinik: true,
      dokterTujuan: {
        select: {
          id: true,
          username: true,
          namaLengkap: true,
          role: true,
        }
      }
    },
    orderBy: [
      { tanggalRegistrasi: 'asc' },
      { jamRegistrasi: 'asc' },
    ],
  });

  return kunjungans;
};

/**
 * Panggil Kunjungan (Status Locking)
 */
const panggilKunjungan = async (kunjunganId, petugasId) => {
  // Gunakan transaction untuk locking
  return await prisma.$transaction(async (tx) => {
    const kunjungan = await tx.kunjungan.findUnique({
      where: { id: kunjunganId },
    });

    if (!kunjungan) {
      const err = new Error('Data Kunjungan tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (kunjungan.statusKunjungan !== 'MENUNGGU') {
      const err = new Error('Maaf, pasien ini sudah dipanggil oleh perawat lain atau sudah diproses.');
      err.statusCode = 400;
      throw err;
    }

    // Lock status menjadi DIPROSES_SCREENING
    const updated = await tx.kunjungan.update({
      where: { id: kunjunganId },
      data: {
        statusKunjungan: 'DIPROSES_SCREENING',
        // Idealnya kita bisa menyimpan petugasScreeningId ke Kunjungan, tapi karena belum ada di schema,
        // kita cukup ganti status saja untuk me-lock antrean.
      },
    });

    return updated;
  });
};

const getKunjunganById = async (id) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id },
    include: {
      pasien: true,
      poliklinik: true,
      dokterTujuan: {
        select: { id: true, namaLengkap: true, username: true }
      }
    },
  });
  if (!kunjungan) {
    const err = new Error('Data Kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }
  return kunjungan;
};

// Tambahkan fungsi ini di src/services/kunjungan.service.js
const updateStatusKunjungan = async (kunjunganId, statusBaru) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id: kunjunganId }
  });

  if (!kunjungan) {
    const err = new Error('Data Kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  // Update status menggunakan Prisma
  return await prisma.kunjungan.update({
    where: { id: kunjunganId },
    data: { statusKunjungan: statusBaru }
  });
};

/**
 * Dapatkan Statistik Dashboard Loket Pendaftaran
 */
const getDashboardStats = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseWhere = applyFaskesScope({}, user);

  // 1. Stats Hari Ini
  const totalHariIni = await prisma.kunjungan.count({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow }
    }
  });

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const totalBulanIni = await prisma.kunjungan.count({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: firstDayOfMonth, lt: tomorrow }
    }
  });

  const menunggu = await prisma.kunjungan.count({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow },
      statusKunjungan: { in: ['MENUNGGU', 'MENUNGGU_DOKTER'] }
    }
  });

  const sedangDilayani = await prisma.kunjungan.count({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow },
      statusKunjungan: { in: ['DIPROSES_SCREENING', 'DIPERIKSA'] }
    }
  });

  const selesai = await prisma.kunjungan.count({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow },
      statusKunjungan: { in: ['SELESAI', 'MENUNGGU_KASIR', 'MENUNGGU_FARMASI', 'PULANG', 'BATAL'] }
    }
  });

  // 2. Stats Asuransi (Join Pasien -> PenjaminPasien)
  const allKunjunganToday = await prisma.kunjungan.findMany({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow }
    },
    include: {
      pasien: {
        include: { penjamin: true }
      }
    }
  });

  const pembayaranMap = {
    'Umum / Mandiri': 0,
    'BPJS Kesehatan': 0,
    'Asuransi Swasta': 0,
    'Perusahaan': 0,
    'KIS': 0
  };

  allKunjunganToday.forEach(k => {
    let jp = k.pasien?.penjamin?.jenisPenjamin || 'Umum / Mandiri';
    if (jp === 'Umum') jp = 'Umum / Mandiri';
    else if (jp.toLowerCase() === 'bpjs') jp = 'BPJS Kesehatan';

    if (pembayaranMap[jp] === undefined) pembayaranMap[jp] = 0;
    pembayaranMap[jp]++;
  });

  const pembayaranList = Object.keys(pembayaranMap).map(label => ({
    label,
    value: pembayaranMap[label]
  })).sort((a, b) => b.value - a.value);

  const prioritas = {
    lansia: allKunjunganToday.filter(k => k.prioritas?.toLowerCase() === 'lansia').length,
    disabilitas: allKunjunganToday.filter(k => k.prioritas?.toLowerCase() === 'disabilitas').length,
    hamilMenyusui: allKunjunganToday.filter(k => k.prioritas?.toLowerCase().includes('hamil')).length,
  };

  // 3. Antrian Hari Ini
  const antreanHariIni = await prisma.kunjungan.findMany({
    where: {
      ...baseWhere,
      tanggalRegistrasi: { gte: today, lt: tomorrow }
    },
    include: {
      pasien: {
        include: { penjamin: true }
      },
      poliklinik: true
    },
    orderBy: [
      { tanggalRegistrasi: 'desc' },
      { jamRegistrasi: 'desc' }
    ],
    take: 50 // Batasi 50 terbaru untuk dashboard
  });

  // 4. Poli List with counts
  const polis = await prisma.poliklinik.findMany({
    where: baseWhere.faskesId ? {
      OR: [
        { faskesId: baseWhere.faskesId },
        { faskesId: null }
      ]
    } : {}
  });
  const statusPoli = polis.map(p => {
    const count = allKunjunganToday.filter(k => k.poliklinikId === p.id).length;
    return {
      nama: p.namaPoli,
      jumlah: count,
      status: p.statusAktif ? 'Buka' : 'Tutup'
    };
  });

  // 5. Grafik 7 Hari (Group By Date)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const last7DaysData = await prisma.kunjungan.findMany({
    where: {
      ...baseWhere,
      tanggalRegistrasi: {
        gte: sevenDaysAgo,
        lt: tomorrow
      }
    },
    include: {
      pasien: {
        include: { penjamin: true }
      }
    }
  });

  const grafik = [];
  const days = ['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dayStr = days[d.getDay()];

    // Check if this date is today
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    const label = isToday ? 'Ini' : dayStr;

    const kForDay = last7DaysData.filter(k => {
      const kDate = new Date(k.tanggalRegistrasi);
      return kDate.getDate() === d.getDate() && kDate.getMonth() === d.getMonth() && kDate.getFullYear() === d.getFullYear();
    });

    const bpjsCount = kForDay.filter(k => k.pasien?.penjamin?.jenisPenjamin?.toLowerCase() === 'bpjs').length;

    grafik.push({
      hari: label,
      jumlah: kForDay.length,
      bpjs: bpjsCount
    });
  }

  return {
    stats: {
      totalHariIni,
      totalBulanIni,
      menunggu,
      sedangDilayani,
      selesai,
      pembayaranList,
      prioritas
    },
    antrean: antreanHariIni,
    grafik,
    poli: statusPoli
  };
};

/**
 * Dapatkan Statistik Dashboard Perawat
 */
const getPerawatDashboardStats = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filter isolasi data: Perawat di Puskesmas memonitor antrean seluruh poli di faskesnya
  const poliFilter = {};
  applyFaskesScope(poliFilter, user);

  // 1. Stats Hari Ini (Khusus Poli ybs)
  const allKunjunganPoli = await prisma.kunjungan.findMany({
    where: {
      tanggalRegistrasi: { gte: today, lt: tomorrow },
      ...poliFilter
    },
    include: {
      pasien: true,
      poliklinik: true,
      screening: true,
    },
    orderBy: [
      { tanggalRegistrasi: 'asc' },
      { jamRegistrasi: 'asc' }
    ]
  });

  const totalAntrean = allKunjunganPoli.length;

  const antreanAktif = allKunjunganPoli.filter(k => k.statusKunjungan === 'MENUNGGU' || k.statusKunjungan === 'DIPROSES_SCREENING');

  const belumSkrining = allKunjunganPoli.filter(k => k.statusKunjungan === 'MENUNGGU').length;
  const sedangSkrining = allKunjunganPoli.filter(k => k.statusKunjungan === 'DIPROSES_SCREENING').length;
  const sudahSkrining = allKunjunganPoli.filter(k =>
    Boolean(k.screening) ||
    [
      'MENUNGGU_DOKTER',
      'DIPERIKSA',
      'MENUNGGU_LAB',
      'MENUNGGU_RADIOLOGI',
      'MENUNGGU_KASIR',
      'MENUNGGU_FARMASI',
      'SELESAI',
      'PULANG'
    ].includes(k.statusKunjungan)
  ).length;

  // 2. Data Triage (Khusus Poli ybs, yang sudah discrining)
  const triage = {
    merah: 0,
    kuning: 0,
    hijau: 0,
    hitam: 0
  };

  allKunjunganPoli.forEach(k => {
    if (k.screening && k.screening.kategoriTriage) {
      const kat = k.screening.kategoriTriage.toLowerCase();
      if (kat.includes('merah')) triage.merah++;
      else if (kat.includes('kuning')) triage.kuning++;
      else if (kat.includes('hijau')) triage.hijau++;
      else if (kat.includes('hitam')) triage.hitam++;
    }
  });

  return {
    stats: {
      totalAntrean,
      belumSkrining,
      sedangSkrining,
      sudahSkrining
    },
    triage,
    antrean: antreanAktif
  };
};

/**
 * Dapatkan Statistik Dashboard Dokter
 */
const getDokterDashboardStats = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filter isolasi data: Dokter/Perawat hanya melihat antrian jika pasien masuk ke Poli-nya.
  const poliFilter = {};
  if (user && (user.role === 'DOKTER' || user.role === 'PERAWAT') && user.poliklinikId) {
    poliFilter.OR = [
      { poliklinikId: user.poliklinikId },
      { dokterTujuanId: user.id }
    ];
  }

  const whereClause = {
    tanggalRegistrasi: { gte: today, lt: tomorrow },
    ...(poliFilter.OR ? { OR: poliFilter.OR } : poliFilter)
  };
  applyFaskesScope(whereClause, user);

  const allKunjunganPoliHariIni = await prisma.kunjungan.findMany({
    where: whereClause
  });

  const totalHariIni = allKunjunganPoliHariIni.length;

  const menunggu = allKunjunganPoliHariIni.filter(k => k.statusKunjungan === 'MENUNGGU_DOKTER').length;
  const sedangDilayani = allKunjunganPoliHariIni.filter(k => k.statusKunjungan === 'DIPERIKSA' || k.statusKunjungan === 'MENUNGGU_LAB').length;
  const selesai = allKunjunganPoliHariIni.filter(k =>
    k.statusKunjungan === 'SELESAI' ||
    k.statusKunjungan === 'MENUNGGU_KASIR' ||
    k.statusKunjungan === 'MENUNGGU_FARMASI' ||
    k.statusKunjungan === 'PULANG'
  ).length;

  return {
    totalHariIni,
    menunggu,
    sedangDilayani,
    selesai
  };
};

const getKunjunganFhirPreview = async (id) => {
  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id },
    include: {
      pasien: {
        include: {
          alamat: true,
        }
      },
      poliklinik: true,
      dokterTujuan: {
        select: { id: true, namaLengkap: true, username: true }
      },
      screening: true,
      rekamMedis: true,
      rujukanKeluar: true,
      orderLab: {
        include: {
          details: true
        }
      },
      diagnosis: {
        include: {
          icd10: true
        }
      },
      tindakans: {
        include: {
          icd9: true
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

  if (!kunjungan) {
    const err = new Error('Data Kunjungan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const { pasien, screening, rekamMedis, rujukanKeluar, orderLab, diagnosis, tindakans, resep, poliklinik, dokterTujuan } = kunjungan;

  // Construct FHIR Bundle Collection
  const bundle = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: []
  };

  // 1. Patient Resource
  const patientResource = {
    resourceType: "Patient",
    id: pasien.noIHS || pasien.id,
    identifier: [
      {
        use: "official",
        system: "https://fhir.kemkes.go.id/id/nik",
        value: pasien.nik
      }
    ],
    name: [
      {
        use: "official",
        text: pasien.namaLengkap
      }
    ],
    gender: pasien.jenisKelamin === 'Laki-laki' ? 'male' : 'female',
    birthDate: pasien.tanggalLahir ? new Date(pasien.tanggalLahir).toISOString().split('T')[0] : null
  };

  if (pasien.alamat) {
    patientResource.address = [
      {
        use: "home",
        line: [pasien.alamat.alamatDomisili || pasien.alamat.alamatKtp],
        city: pasien.alamat.kabupatenKota,
        district: pasien.alamat.kecamatan,
        state: pasien.alamat.provinsi,
        postalCode: pasien.alamat.kodePos,
        country: "ID"
      }
    ];
  }
  bundle.entry.push({ resource: patientResource });

  // 2. Encounter Resource
  let encounterStatus = "arrived";
  if (['DIPERIKSA', 'DIPROSES_SCREENING'].includes(kunjungan.statusKunjungan)) encounterStatus = "in-progress";
  else if (['SELESAI', 'MENUNGGU_KASIR', 'MENUNGGU_FARMASI', 'PULANG'].includes(kunjungan.statusKunjungan)) encounterStatus = "finished";
  else if (kunjungan.statusKunjungan === 'BATAL') encounterStatus = "cancelled";

  const periodStart = kunjungan.waktuPemeriksaanMulai
    ? new Date(kunjungan.waktuPemeriksaanMulai).toISOString()
    : new Date(kunjungan.tanggalRegistrasi).toISOString();

  const periodEnd = kunjungan.waktuPemeriksaanSelesai
    ? new Date(kunjungan.waktuPemeriksaanSelesai).toISOString()
    : new Date(kunjungan.updatedAt).toISOString();

  const statusPulang = kunjungan.statusPulang || kunjungan.caraKeluar;
  let dischargeDisp = undefined;
  if (statusPulang === 'DIRUJUK_RS') {
    dischargeDisp = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
          code: "oth",
          display: "Referred to external facility / Hospital"
        }
      ],
      text: "Dirujuk ke Rumah Sakit"
    };
  } else if (statusPulang === 'RAWAT_INAP') {
    dischargeDisp = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
          code: "hosp",
          display: "Admitted to inpatient ward"
        }
      ],
      text: "Rawat Inap"
    };
  } else if (statusPulang === 'KONTROL_ULANG') {
    dischargeDisp = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
          code: "home",
          display: "Discharged to home with follow-up appointment"
        }
      ],
      text: "Pulang dengan Kontrol Ulang"
    };
  } else if (kunjungan.statusPulang === 'PULANG_SEMBUH') {
    dischargeDisp = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
          code: "home",
          display: "Home"
        }
      ],
      text: "Pulang Sembuh"
    };
  }

  const encounterResource = {
    resourceType: "Encounter",
    id: kunjungan.satusehatId || kunjungan.id,
    status: encounterStatus,
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: kunjungan.jenisPelayanan === 'Rawat Inap' ? 'IMP' : (kunjungan.jenisPelayanan === 'IGD' ? 'EMER' : 'AMB'),
      display: kunjungan.jenisPelayanan === 'Rawat Inap' ? 'inpatient encounter' : (kunjungan.jenisPelayanan === 'IGD' ? 'emergency encounter' : 'ambulatory')
    },
    subject: {
      reference: `Patient/${pasien.noIHS || pasien.id}`,
      display: pasien.namaLengkap
    },
    period: {
      start: periodStart,
      end: encounterStatus === "finished" ? periodEnd : undefined
    },
    location: [
      {
        location: {
          reference: `Location/${poliklinik?.ihsLocationId || poliklinik?.id || 'poli-umum'}`,
          display: poliklinik?.namaPoli || "Poli Umum"
        }
      }
    ],
    statusHistory: [
      {
        status: "arrived",
        period: {
          start: new Date(kunjungan.tanggalRegistrasi).toISOString(),
          end: kunjungan.waktuPemeriksaanMulai ? new Date(kunjungan.waktuPemeriksaanMulai).toISOString() : undefined
        }
      },
      ...(kunjungan.waktuPemeriksaanMulai ? [{
        status: "in-progress",
        period: {
          start: new Date(kunjungan.waktuPemeriksaanMulai).toISOString(),
          end: kunjungan.waktuPemeriksaanSelesai ? new Date(kunjungan.waktuPemeriksaanSelesai).toISOString() : undefined
        }
      }] : []),
      ...(encounterStatus === "finished" ? [{
        status: "finished",
        period: {
          start: periodEnd,
          end: periodEnd
        }
      }] : [])
    ],
    hospitalization: dischargeDisp ? { dischargeDisposition: dischargeDisp } : undefined
  };

  if (dokterTujuan) {
    encounterResource.participant = [
      {
        type: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                code: "PPRF",
                display: "primary performer"
              }
            ]
          }
        ],
        individual: {
          reference: `Practitioner/${dokterTujuan.username}`,
          display: dokterTujuan.namaLengkap || dokterTujuan.username
        }
      }
    ];
  }
  bundle.entry.push({ resource: encounterResource });

  // 3. Observation Resource (Vital Signs dari Screening)
  if (screening) {
    const observationComponents = [];

    if (screening.tekananDarahSistolik !== null && screening.tekananDarahDiastolik !== null) {
      observationComponents.push(
        {
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8480-6",
                display: "Systolic blood pressure"
              }
            ]
          },
          valueQuantity: {
            value: screening.tekananDarahSistolik,
            unit: "mmHg",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]"
          }
        },
        {
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8462-4",
                display: "Diastolic blood pressure"
              }
            ]
          },
          valueQuantity: {
            value: screening.tekananDarahDiastolik,
            unit: "mmHg",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]"
          }
        }
      );
    }

    if (screening.suhuTubuh !== null) {
      observationComponents.push({
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8310-5",
              display: "Body temperature"
            }
          ]
        },
        valueQuantity: {
          value: screening.suhuTubuh,
          unit: "C",
          system: "http://unitsofmeasure.org",
          code: "Cel"
        }
      });
    }

    if (screening.nadi !== null) {
      observationComponents.push({
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8867-4",
              display: "Heart rate"
            }
          ]
        },
        valueQuantity: {
          value: screening.nadi,
          unit: "beats/minute",
          system: "http://unitsofmeasure.org",
          code: "/min"
        }
      });
    }

    if (screening.frekuensiNapas !== null) {
      observationComponents.push({
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "9279-1",
              display: "Respiratory rate"
            }
          ]
        },
        valueQuantity: {
          value: screening.frekuensiNapas,
          unit: "breaths/minute",
          system: "http://unitsofmeasure.org",
          code: "/min"
        }
      });
    }

    if (observationComponents.length > 0) {
      const observationResource = {
        resourceType: "Observation",
        id: `obs-${screening.id}`,
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "vital-signs",
                display: "Vital Signs"
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "85354-9",
              display: "Blood pressure panel with all children optional"
            }
          ]
        },
        subject: {
          reference: `Patient/${pasien.noIHS || pasien.id}`,
          display: pasien.namaLengkap
        },
        encounter: {
          reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
        },
        effectiveDateTime: new Date(screening.tanggalScreening).toISOString(),
        component: observationComponents
      };
      bundle.entry.push({ resource: observationResource });
    }
  }

  // 4. Observation Resource (Exam Physical Head to Toe dari RekamMedis)
  if (rekamMedis && rekamMedis.pemeriksaanFisik) {
    const examObservationResource = {
      resourceType: "Observation",
      id: `obs-exam-${rekamMedis.id}`,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "exam",
              display: "Exam"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "29545-1",
            display: "Physical findings"
          }
        ]
      },
      subject: {
        reference: `Patient/${pasien.noIHS || pasien.id}`,
        display: pasien.namaLengkap
      },
      encounter: {
        reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
      },
      effectiveDateTime: new Date(rekamMedis.createdAt).toISOString(),
      valueString: rekamMedis.pemeriksaanFisik
    };
    bundle.entry.push({ resource: examObservationResource });
  }

  // 5. Condition Resource (Diagnosa ICD-10)
  if (diagnosis && diagnosis.length > 0) {
    for (const d of diagnosis) {
      if (d.icd10) {
        const conditionResource = {
          resourceType: "Condition",
          id: d.satusehatId || `cond-${d.id}`,
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                code: d.statusKlinis?.toLowerCase() === 'sembuh' ? 'resolved' : 'active'
              }
            ]
          },
          verificationStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                code: d.statusDiagnosis?.toLowerCase() === 'suspek' ? 'provisional' : 'confirmed'
              }
            ]
          },
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/condition-category",
                  code: "encounter-diagnosis",
                  display: "Encounter Diagnosis"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://hl7.org/fhir/sid/icd-10",
                code: d.icd10.kode_icd10,
                display: d.icd10.nama_diagnosis
              }
            ]
          },
          subject: {
            reference: `Patient/${pasien.noIHS || pasien.id}`,
            display: pasien.namaLengkap
          },
          encounter: {
            reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
          }
        };
        bundle.entry.push({ resource: conditionResource });
      }
    }
  }

  // 6. Procedure Resource (Tindakan ICD-9-CM)
  if (tindakans && tindakans.length > 0) {
    for (const t of tindakans) {
      if (t.icd9) {
        const procedureResource = {
          resourceType: "Procedure",
          id: t.satusehatId || `proc-${t.id}`,
          status: "completed",
          code: {
            coding: [
              {
                system: "http://hl7.org/fhir/sid/icd-9",
                code: t.icd9.kode_icd9,
                display: t.icd9.nama_prosedur
              }
            ]
          },
          subject: {
            reference: `Patient/${pasien.noIHS || pasien.id}`,
            display: pasien.namaLengkap
          },
          encounter: {
            reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
          },
          performedDateTime: new Date(t.waktuTindakan).toISOString()
        };
        bundle.entry.push({ resource: procedureResource });
      }
    }
  }

  // 7. MedicationRequest Resource (Resep Obat KFA)
  if (resep && resep.length > 0) {
    for (const r of resep) {
      if (r.details) {
        for (const detail of r.details) {
          if (detail.obat) {
            const medicationRequestResource = {
              resourceType: "MedicationRequest",
              id: `medreq-${detail.id}`,
              status: r.status === 'SELESAI' ? 'completed' : 'active',
              intent: "order",
              medicationCodeableConcept: {
                coding: [
                  {
                    system: "https://fhir.kemkes.go.id/id/kfa",
                    code: detail.obat.kodeObat,
                    display: detail.obat.namaObat
                  }
                ]
              },
              subject: {
                reference: `Patient/${pasien.noIHS || pasien.id}`,
                display: pasien.namaLengkap
              },
              encounter: {
                reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
              },
              authoredOn: new Date(r.tanggalResep).toISOString(),
              dosageInstruction: [
                {
                  text: detail.aturanPakai,
                  additionalInstruction: detail.catatan ? [
                    {
                      text: detail.catatan
                    }
                  ] : undefined
                }
              ],
              dispenseRequest: {
                quantity: {
                  value: detail.jumlah,
                  unit: detail.obat.sediaan || "Pcs"
                }
              }
            };
            bundle.entry.push({ resource: medicationRequestResource });
          }
        }
      }

      // 8. QuestionnaireResponse Resource (Pengkajian Resep Apoteker Section 15p Kemenkes v6.2)
      const questionnaireResponseResource = {
        resourceType: "QuestionnaireResponse",
        id: `qr-resep-${r.id}`,
        status: "completed",
        questionnaire: "https://fhir.kemkes.go.id/Questionnaire/Q0001",
        subject: {
          reference: `Patient/${pasien.noIHS || pasien.id}`,
          display: pasien.namaLengkap
        },
        encounter: {
          reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
        },
        authored: new Date(r.tanggalResep).toISOString(),
        item: [
          {
            linkId: "1",
            text: "Persyaratan Administrasi",
            item: [
              { linkId: "1.1", text: "Nama, umur, jenis kelamin, BB/TB Pasien", answer: [{ valueBoolean: true }] },
              { linkId: "1.2", text: "Nama, SIP, Alamat Dokter", answer: [{ valueBoolean: true }] }
            ]
          },
          {
            linkId: "2",
            text: "Persyaratan Farmasetik",
            item: [
              { linkId: "2.1", text: "Nama obat, bentuk dan kekuatan sediaan", answer: [{ valueBoolean: true }] },
              { linkId: "2.2", text: "Aturan dan cara penggunaan", answer: [{ valueBoolean: true }] }
            ]
          },
          {
            linkId: "3",
            text: "Persyaratan Klinis",
            item: [
              { linkId: "3.1", text: "Ketepatan indikasi, dosis, dan waktu penggunaan", answer: [{ valueBoolean: true }] },
              { linkId: "3.2", text: "Duplikasi pengobatan", answer: [{ valueBoolean: false }] },
              { linkId: "3.3", text: "Alergi dan ROTD", answer: [{ valueBoolean: false }] }
            ]
          }
        ]
      };
      bundle.entry.push({ resource: questionnaireResponseResource });
    }
  }

  // 9. CarePlan Resource (Plan Rencana Terapi Dokter)
  if (rekamMedis && (rekamMedis.rencanaTerapi || rekamMedis.instruksiMedis)) {
    const carePlanResource = {
      resourceType: "CarePlan",
      id: `cp-${rekamMedis.id}`,
      status: "active",
      intent: "plan",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/care-plan-category",
              code: "assess-plan",
              display: "Assessment and Plan of Care"
            }
          ]
        }
      ],
      subject: {
        reference: `Patient/${pasien.noIHS || pasien.id}`,
        display: pasien.namaLengkap
      },
      encounter: {
        reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
      },
      description: [rekamMedis.rencanaTerapi, rekamMedis.instruksiMedis].filter(Boolean).join('\n')
    };
    bundle.entry.push({ resource: carePlanResource });
  }

  // 10. ServiceRequest Resource (Rujukan Keluar RS)
  if (rujukanKeluar) {
    const serviceRequestResource = {
      resourceType: "ServiceRequest",
      id: `sr-rujuk-${rujukanKeluar.id}`,
      status: "active",
      intent: "order",
      category: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "3457005",
              display: "Patient referral"
            }
          ]
        }
      ],
      subject: {
        reference: `Patient/${pasien.noIHS || pasien.id}`,
        display: pasien.namaLengkap
      },
      encounter: {
        reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
      },
      authoredOn: new Date(rujukanKeluar.tanggalRujukan).toISOString(),
      reasonCode: [
        {
          text: rujukanKeluar.alasanRujukan
        }
      ],
      performer: [
        {
          display: `${rujukanKeluar.faskesTujuan} - Poli ${rujukanKeluar.poliTujuan}`
        }
      ]
    };
    bundle.entry.push({ resource: serviceRequestResource });
  }

  // 11. DiagnosticReport & Observation Resource (Hasil Laboratorium)
  if (orderLab && orderLab.details && orderLab.details.length > 0) {
    const labObsResult = [];
    for (const d of orderLab.details) {
      const obsLab = {
        resourceType: "Observation",
        id: `obs-lab-${d.id}`,
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
                display: "Laboratory"
              }
            ]
          }
        ],
        code: {
          text: d.parameter
        },
        subject: {
          reference: `Patient/${pasien.noIHS || pasien.id}`,
          display: pasien.namaLengkap
        },
        encounter: {
          reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
        },
        valueString: d.hasil || undefined,
        referenceRange: d.nilaiRujukan ? [{ text: d.nilaiRujukan }] : undefined
      };
      bundle.entry.push({ resource: obsLab });
      labObsResult.push({ reference: `Observation/obs-lab-${d.id}` });
    }

    const diagnosticReportResource = {
      resourceType: "DiagnosticReport",
      id: `diag-lab-${orderLab.id}`,
      status: orderLab.status === 'SELESAI' ? 'final' : 'registered',
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0074",
              code: "LAB",
              display: "Laboratory"
            }
          ]
        }
      ],
      code: {
        text: "Pemeriksaan Laboratorium Routine"
      },
      subject: {
        reference: `Patient/${pasien.noIHS || pasien.id}`,
        display: pasien.namaLengkap
      },
      encounter: {
        reference: `Encounter/${kunjungan.satusehatId || kunjungan.id}`
      },
      effectiveDateTime: new Date(orderLab.tanggalOrder).toISOString(),
      result: labObsResult,
      conclusion: orderLab.catatanKlinis || undefined
    };
    bundle.entry.push({ resource: diagnosticReportResource });
  }

  return bundle;
};

module.exports = {
  getKunjunganScreening,
  panggilKunjungan,
  getKunjunganById,
  updateStatusKunjungan,
  getDashboardStats,
  getPerawatDashboardStats,
  getDokterDashboardStats,
  getKunjunganFhirPreview,
};
