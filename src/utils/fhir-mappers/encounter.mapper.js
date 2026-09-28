/**
 * Helper to ensure standard reference string
 */
const formatReference = (prefix, id) => {
  if (!id) return undefined;
  if (id.startsWith('urn:uuid:') || id.startsWith(`${prefix}/`)) {
    return id;
  }
  return `${prefix}/${id}`;
};

const buildEncounterPayload = (data, orgId) => {
  // Dynamic status mapping
  const statusMap = {
    'MENUNGGU': 'arrived',
    'DIPERIKSA': 'in-progress',
    'SELESAI': 'finished',
    'BATAL': 'cancelled'
  };
  const fhirStatus = data.status || statusMap[data.statusKunjungan] || 'arrived';

  // Ensure chronological, valid ISO timestamps
  const startRaw = data.timestamp && !isNaN(Number(data.timestamp))
    ? new Date(Number(data.timestamp))
    : (data.tanggalRegistrasi ? new Date(data.tanggalRegistrasi) : new Date());
  
  const startTime = startRaw.getTime();
  const inProgressTime = data.waktuPemeriksaanMulai
    ? Math.max(new Date(data.waktuPemeriksaanMulai).getTime(), startTime)
    : startTime;

  const endTimeRaw = data.waktuDischarge || data.waktuPemeriksaanSelesai || (fhirStatus === 'finished' ? new Date() : undefined);
  const endTime = endTimeRaw ? Math.max(new Date(endTimeRaw).getTime(), inProgressTime) : undefined;

  const startIso = new Date(startTime).toISOString();
  const inProgressIso = new Date(inProgressTime).toISOString();
  const endIso = endTime ? new Date(endTime).toISOString() : undefined;

  // Build compliant, non-duplicated statusHistory
  let statusHistory = [];
  if (fhirStatus === 'arrived') {
    statusHistory = [
      {
        status: 'arrived',
        period: { start: startIso }
      }
    ];
  } else if (fhirStatus === 'in-progress') {
    statusHistory = [
      {
        status: 'arrived',
        period: { start: startIso, end: inProgressIso }
      },
      {
        status: 'in-progress',
        period: { start: inProgressIso }
      }
    ];
  } else if (fhirStatus === 'finished') {
    statusHistory = [
      {
        status: 'arrived',
        period: { start: startIso, end: inProgressIso }
      },
      {
        status: 'in-progress',
        period: { start: inProgressIso, end: endIso }
      },
      {
        status: 'finished',
        period: { start: endIso, end: endIso }
      }
    ];
  } else {
    statusHistory = [
      {
        status: fhirStatus,
        period: { start: startIso, ...(endIso && { end: endIso }) }
      }
    ];
  }

  // Map Jenis Pelayanan lokal ke FHIR Class
  let classCode = "AMB"; // Default Ambulatory (Rawat Jalan)
  let classDisplay = "ambulatory";

  if (data.jenisPelayanan) {
    const jp = data.jenisPelayanan.toLowerCase();
    if (jp.includes('inap')) {
      classCode = "IMP";
      classDisplay = "inpatient encounter";
    } else if (jp.includes('igd') || jp.includes('gawat')) {
      classCode = "EMER";
      classDisplay = "emergency";
    }
  }

  const payload = {
    resourceType: "Encounter",
    status: fhirStatus,
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: classCode,
      display: classDisplay
    },
    ...(data.layananTujuan && {
      serviceType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/service-type",
            code: "124",
            display: data.layananTujuan
          }
        ]
      }
    }),
    ...(data.pasienIhs && {
      subject: {
        reference: formatReference("Patient", data.pasienIhs),
        display: data.pasienName
      }
    }),
    ...(data.dokterIhs && {
      participant: [
        {
          type: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                  code: data.peranDokter || "ATND",
                  display: data.peranDokter === 'CON' ? 'consultant' : (data.peranDokter === 'REF' ? 'referrer' : 'attender')
                }
              ]
            }
          ],
          individual: {
            reference: formatReference("Practitioner", data.dokterIhs),
            display: data.dokterName
          }
        }
      ]
    }),
    period: {
      start: startIso,
      ...(endIso && { end: endIso })
    },
    statusHistory: statusHistory,
    ...(data.poliIhs && {
      location: [
        {
          location: {
            reference: formatReference("Location", data.poliIhs),
            display: data.poliName
          }
        }
      ]
    }),
    serviceProvider: {
      reference: formatReference("Organization", orgId)
    },
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/encounter/${orgId}`,
        value: data.noKunjungan || data.id
      }
    ]
  };

  // Diagnosis reference mapping if condition ID exists
  if (data.conditionSatusehatId) {
    payload.diagnosis = [
      {
        condition: {
          reference: formatReference("Condition", data.conditionSatusehatId)
        },
        use: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
              code: "DD",
              display: "Discharge diagnosis"
            }
          ]
        },
        rank: data.rankDiagnosis || 1
      }
    ];
  }

  // Hospitalization / Discharge Disposition
  const statusPulang = data.statusPulang || data.caraKeluar;
  if (statusPulang || data.kondisiDischarge || fhirStatus === 'finished') {
    let dischargeCode = "home";
    let dischargeDisplay = data.kondisiDischarge || "Home";

    if (statusPulang === 'DIRUJUK_RS' || statusPulang === 'RUJUK') {
      dischargeCode = "oth";
      dischargeDisplay = "Referred to external facility / Hospital";
    } else if (statusPulang === 'RAWAT_INAP') {
      dischargeCode = "hosp";
      dischargeDisplay = "Admitted to inpatient ward";
    }

    payload.hospitalization = {
      dischargeDisposition: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
            code: dischargeCode,
            display: dischargeDisplay
          }
        ],
        text: statusPulang
      }
    };
  }

  return payload;
};

module.exports = { buildEncounterPayload };
