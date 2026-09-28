const { randomUUID } = require('crypto');
const { buildEncounterPayload } = require('./encounter.mapper');
const { buildConditionPayload } = require('./condition.mapper');
const { buildObservationPayload } = require('./observation.mapper');
const { buildProcedurePayload } = require('./procedure.mapper');
const { buildMedicationPayload, buildMedicationRequestPayload } = require('./medication.mapper');
const { buildCompositionPayload } = require('./composition.mapper');
const { buildAllergyPayload } = require('./allergy.mapper');
const { buildFamilyMemberHistoryPayload } = require('./family-member-history.mapper');
const { buildMedicationStatementPayload } = require('./medication-statement.mapper');
const { buildClinicalImpressionPayload } = require('./clinical-impression.mapper');
const { buildGoalPayload } = require('./goal.mapper');
const { buildServiceRequestPayload } = require('./service-request.mapper');
const { toFHIRImagingStudy } = require('./imaging-study.mapper');
const { toFHIRRadiologyObservation } = require('./observation.mapper');

/**
 * Helper to ensure standard reference string
 */
const formatRef = (resourceType, id) => {
  if (!id) return undefined;
  if (id.startsWith('urn:uuid:') || id.startsWith(`${resourceType}/`)) {
    return id;
  }
  return `${resourceType}/${id}`;
};

/**
 * Orchestrator mapper to generate a FHIR R4 Transaction Bundle for Rawat Jalan.
 * @param {Object} dataComplete - Complete visit data including pasien, dokter, poli, diagnoses, observations, procedures, medications.
 * @param {string} [orgId] - Organization IHS ID.
 * @returns {Object} FHIR R4 Bundle Payload (type: transaction)
 */
const toRawatJalanBundle = (dataComplete = {}, orgId) => {
  const organizationId = orgId || dataComplete.orgId || process.env.SATUSEHAT_ORG_ID;
  const satusehatEncounterId = dataComplete.encounterId;
  
  // Internal UUID for Encounter linking within transaction bundle
  const encounterUuid = `urn:uuid:${randomUUID()}`;
  const encounterRef = satusehatEncounterId ? `Encounter/${satusehatEncounterId}` : encounterUuid;

  const entries = [];
  const obsUuids = [];
  const condUuids = [];
  const procUuids = [];
  const medReqUuids = [];

  // Ekstrak referensi IHS dari nested objects terlebih dahulu
  const pasienIhs = dataComplete.pasienIhs || dataComplete.pasien?.noIHS;
  const pasienName = dataComplete.pasienName || dataComplete.pasien?.namaLengkap;
  const rawDokterIhs = dataComplete.dokterIhs || dataComplete.dokter?.noIHS || dataComplete.dokter?.tenagaMedis?.noIHS || dataComplete.dokterTujuan?.tenagaMedis?.noIHS;
  const dokterIhs = (rawDokterIhs && !rawDokterIhs.startsWith('cms')) ? rawDokterIhs : (process.env.SATUSEHAT_PRACTITIONER_IHS || 'N1000001');
  const dokterName = dataComplete.dokterName || dataComplete.dokter?.namaLengkap || dataComplete.dokterTujuan?.namaLengkap;
  const poliIhs = dataComplete.poliIhs || dataComplete.poliklinik?.ihsLocationId || dataComplete.poliklinik?.satusehatId;
  const poliName = dataComplete.poliName || dataComplete.poliklinik?.namaPoli;

  // 1. ENCOUNTER
  // Ambil diagnosis pertama dari daftar (jika ada) untuk di-embed di Encounter
  const diagnosisList = dataComplete.diagnosisList || dataComplete.diagnoses || dataComplete.diagnosis || [];
  const firstDiag = diagnosisList[0];
  const conditionSatusehatId = firstDiag?.satusehatId || undefined;

  const encounterData = {
    ...dataComplete,
    pasienIhs,
    pasienName,
    dokterIhs,
    dokterName,
    poliIhs,
    poliName,
    conditionSatusehatId,
    statusKunjungan: dataComplete.statusKunjungan || 'SELESAI',
    status: dataComplete.status || 'finished',
    waktuDischarge: dataComplete.waktuDischarge || new Date().toISOString()
  };

  const encounterResource = buildEncounterPayload(encounterData, organizationId);

  if (satusehatEncounterId) {
    encounterResource.id = satusehatEncounterId;
    entries.push({
      fullUrl: `https://fhir.kemkes.go.id/r4/Encounter/${satusehatEncounterId}`,
      resource: encounterResource,
      request: {
        method: "PUT",
        url: `Encounter/${satusehatEncounterId}`
      }
    });
  } else {
    entries.push({
      fullUrl: encounterUuid,
      resource: encounterResource,
      request: {
        method: "POST",
        url: "Encounter"
      }
    });
  }

  // 2. OBSERVATIONS (Vital Signs)
  const observations = dataComplete.observations || dataComplete.vitalSigns || [];
  observations.forEach((obs) => {
    const obsUuid = `urn:uuid:${randomUUID()}`;
    const obsPayload = buildObservationPayload({
      ...obs,
      pasienIhs,
      pasienName,
      dokterIhs,
      dokterName,
      encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', '')
    });
    
    obsPayload.encounter = { reference: encounterRef };
    if (pasienIhs) obsPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
    if (dokterIhs) obsPayload.performer = [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }];

    entries.push({
      fullUrl: obsUuid,
      resource: obsPayload,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
    obsUuids.push(obsUuid);
  });

  // Map 28 Organ Physical Exam Head to Toe (Observation category: exam) jika ada
  const headToToeData = dataComplete.screening?.headToToe || dataComplete.headToToe;
  if (headToToeData && typeof headToToeData === 'object') {
    const organLoincMap = {
      kepala: { name: "Kepala", loinc: "10199-8" },
      mata: { name: "Mata", loinc: "10197-2" },
      telinga: { name: "Telinga", loinc: "10195-6" },
      hidung: { name: "Hidung", loinc: "10196-4" },
      rambut: { name: "Rambut", loinc: "10198-0" },
      bibir: { name: "Bibir", loinc: "10194-9" },
      gigiGeligi: { name: "Gigi Geligi", loinc: "10193-1" },
      lidah: { name: "Lidah", loinc: "10192-3" },
      langitLangit: { name: "Langit-langit", loinc: "10191-5" },
      leher: { name: "Leher", loinc: "10190-7" },
      tenggorokan: { name: "Tenggorokan", loinc: "10189-9" },
      tonsil: { name: "Tonsil", loinc: "10188-1" },
      dada: { name: "Dada", loinc: "10187-3" },
      payudara: { name: "Payudara", loinc: "10186-5" },
      punggung: { name: "Punggung", loinc: "10185-7" },
      perut: { name: "Perut", loinc: "10184-0" },
      genital: { name: "Genital", loinc: "10183-2" },
      anusDubur: { name: "Anus/Dubur", loinc: "10182-4" },
      lenganAtas: { name: "Lengan Atas", loinc: "10181-6" },
      lenganBawah: { name: "Lengan Bawah", loinc: "10180-8" },
      jariTangan: { name: "Jari Tangan", loinc: "10179-0" },
      kukuTangan: { name: "Kuku Tangan", loinc: "10178-2" },
      persendianTangan: { name: "Persendian Tangan", loinc: "10177-4" },
      tungkaiAtas: { name: "Tungkai Atas", loinc: "10176-6" },
      tungkaiBawah: { name: "Tungkai Bawah", loinc: "10175-8" },
      jariKaki: { name: "Jari Kaki", loinc: "10174-1" },
      kukuKaki: { name: "Kuku Kaki", loinc: "10173-3" },
      persendianKaki: { name: "Persendian Kaki", loinc: "10172-5" },
    };

    Object.keys(headToToeData).forEach((key) => {
      const item = headToToeData[key];
      const meta = organLoincMap[key];
      if (item && meta && (item.status || item.catatan)) {
        const httUuid = `urn:uuid:${randomUUID()}`;
        const noteText = item.catatan ? `${item.status || 'Pemeriksaan'}: ${item.catatan}` : (item.status || 'Normal');
        
        const httResource = {
          resourceType: "Observation",
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
                code: meta.loinc,
                display: `Physical examination of ${meta.name}`
              }
            ]
          },
          ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
          encounter: { reference: encounterRef },
          effectiveDateTime: new Date().toISOString(),
          issued: new Date().toISOString(),
          valueString: noteText,
          ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
        };

        entries.push({
          fullUrl: httUuid,
          resource: httResource,
          request: {
            method: "POST",
            url: "Observation"
          }
        });
        obsUuids.push(httUuid);
      }
    });
  }

  // Map Pemeriksaan Odontogram (Kemenkes OC000061) & Indeks DMF-T jika Poli Gigi
  const odontogramData = dataComplete.rekamMedis?.odontogram || dataComplete.odontogram;
  const dmftData = dataComplete.rekamMedis?.dmft || dataComplete.dmft;

  if (odontogramData && typeof odontogramData === 'object' && Object.keys(odontogramData).length > 0) {
    const odontUuid = `urn:uuid:${randomUUID()}`;
    const odontResource = {
      resourceType: "Observation",
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
            system: "http://terminology.kemkes.go.id/CodeSystem/clinical-term",
            code: "OC000061",
            display: "Pemeriksaan Odontogram"
          }
        ]
      },
      ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
      encounter: { reference: encounterRef },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      valueBoolean: true,
      ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
    };

    entries.push({
      fullUrl: odontUuid,
      resource: odontResource,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
    obsUuids.push(odontUuid);
  }

  if (dmftData && typeof dmftData === 'object') {
    const dmftMetrics = [
      { key: 'd', code: "251319000", display: "Decayed tooth count", val: dmftData.d },
      { key: 'm', code: "251317003", display: "Missing tooth count", val: dmftData.m },
      { key: 'f', code: "251318008", display: "Filled tooth count", val: dmftData.f },
    ];

    dmftMetrics.forEach((m) => {
      if (m.val !== undefined && m.val !== null) {
        const metricUuid = `urn:uuid:${randomUUID()}`;
        const metricResource = {
          resourceType: "Observation",
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
                system: "http://snomed.info/sct",
                code: m.code,
                display: m.display
              }
            ]
          },
          ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
          encounter: { reference: encounterRef },
          effectiveDateTime: new Date().toISOString(),
          issued: new Date().toISOString(),
          valueString: String(m.val),
          ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
        };

        entries.push({
          fullUrl: metricUuid,
          resource: metricResource,
          request: {
            method: "POST",
            url: "Observation"
          }
        });
        obsUuids.push(metricUuid);
      }
    });
  }

  // Map Luas Permukaan Tubuh (BSA - LOINC 8277-6) jika ada
  const bsaVal = dataComplete.screening?.dataTambahan?.antropometri?.luasPermukaanTubuh || dataComplete.luasPermukaanTubuh;
  if (bsaVal && !isNaN(bsaVal)) {
    const bsaUuid = `urn:uuid:${randomUUID()}`;
    const bsaResource = {
      resourceType: "Observation",
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
            code: "8277-6",
            display: "Body surface area"
          }
        ]
      },
      ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
      encounter: { reference: encounterRef },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      valueQuantity: {
        value: parseFloat(bsaVal),
        unit: "m2",
        system: "http://unitsofmeasure.org",
        code: "m2"
      },
      ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
    };

    entries.push({
      fullUrl: bsaUuid,
      resource: bsaResource,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
    obsUuids.push(bsaUuid);
  }

  // Map Status Psikologis (LOINC 8693-4 / Mental status) jika ada
  const statusPsikologiVal = dataComplete.screening?.dataTambahan?.jiwa?.statusPsikologis || dataComplete.statusPsikologis;
  if (statusPsikologiVal) {
    const psiUuid = `urn:uuid:${randomUUID()}`;
    const psiResource = {
      resourceType: "Observation",
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
            code: "8693-4",
            display: "Mental status"
          }
        ]
      },
      ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
      encounter: { reference: encounterRef },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      valueCodeableConcept: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: statusPsikologiVal.includes('Cemas') ? "197480006" : (statusPsikologiVal.includes('Sedih') ? "373738008" : "17621005"),
            display: statusPsikologiVal
          }
        ],
        text: statusPsikologiVal
      },
      ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
    };

    entries.push({
      fullUrl: psiUuid,
      resource: psiResource,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
    obsUuids.push(psiUuid);
  }

  // Map Tingkat Kesadaran (LOINC 11328-2 / AVPU) jika ada
  const kesadaranVal = dataComplete.screening?.dataTambahan?.triage?.kesadaran || dataComplete.kesadaran;
  if (kesadaranVal) {
    const kesUuid = `urn:uuid:${randomUUID()}`;
    const kesResource = {
      resourceType: "Observation",
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
            code: "11328-2",
            display: "Physical findings of Mind Narrative"
          }
        ]
      },
      ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
      encounter: { reference: encounterRef },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      valueCodeableConcept: (() => {
        // Mapping AVPU Tingkat Kesadaran ke SNOMED CT yang valid
        const avpuMap = {
          'Alert': { code: '248234008', display: 'Compos mentis (Alert)' },
          'Sadar': { code: '248234008', display: 'Compos mentis (Alert)' },
          'Composmentis': { code: '248234008', display: 'Compos mentis (Alert)' },
          'Voice': { code: '300202002', display: 'Response to voice (Voice)' },
          'Suara': { code: '300202002', display: 'Response to voice (Voice)' },
          'Pain': { code: '450847001', display: 'Response to pain (Pain)' },
          'Nyeri': { code: '450847001', display: 'Response to pain (Pain)' },
          'Unresponsive': { code: '422768004', display: 'Unresponsive' },
          'Tidak Sadar': { code: '422768004', display: 'Unresponsive' },
        };
        const matched = Object.keys(avpuMap).find(k => kesadaranVal.includes(k));
        const snomed = matched ? avpuMap[matched] : { code: '248234008', display: 'Compos mentis (Alert)' };
        return {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: snomed.code,
              display: snomed.display
            }
          ],
          text: kesadaranVal
        };
      })(),
      ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] })
    };

    entries.push({
      fullUrl: kesUuid,
      resource: kesResource,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
    obsUuids.push(kesUuid);
  }

  // 3. CONDITIONS (Diagnosis ICD-10)
  diagnosisList.forEach((diag) => {
    const condUuid = `urn:uuid:${randomUUID()}`;
    const condPayload = buildConditionPayload({
      ...diag,
      kodeIcd10: diag.kodeIcd10 || diag.icd10?.kode_icd10 || diag.kode_icd10,
      namaDiagnosis: diag.namaDiagnosis || diag.icd10?.nama_diagnosis || diag.nama_diagnosis,
      pasienIhs,
      pasienName,
      dokterIhs,
      dokterName,
      encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', '')
    });

    condPayload.encounter = { reference: encounterRef };
    if (pasienIhs) condPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
    if (dokterIhs) condPayload.recorder = { reference: formatRef('Practitioner', dokterIhs), display: dokterName };

    entries.push({
      fullUrl: condUuid,
      resource: condPayload,
      request: {
        method: "POST",
        url: "Condition"
      }
    });
    condUuids.push(condUuid);
  });

  // Tautkan Condition ke Encounter.diagnosis (Wajib untuk FHIR SATUSEHAT Encounter)
  if (encounterResource && (condUuids.length > 0 || conditionSatusehatId)) {
    encounterResource.diagnosis = condUuids.length > 0 
      ? condUuids.map((uuid, idx) => ({
          condition: { reference: uuid },
          use: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
                code: "DD",
                display: "Discharge diagnosis"
              }
            ]
          },
          rank: idx + 1
        }))
      : [
          {
            condition: { reference: formatRef('Condition', conditionSatusehatId) },
            use: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
                  code: "DD",
                  display: "Discharge diagnosis"
                }
              ]
            },
            rank: 1
          }
        ];
  }

  // 3.b ANAMNESIS: ALLERGYINTOLERANCE (Riwayat Alergi Pasien)
  const allergyList = dataComplete.alergis || dataComplete.pasien?.alergis || [];
  const allergyUuids = [];
  allergyList.forEach((al) => {
    if (al.alergiMaster) {
      const allUuid = `urn:uuid:${randomUUID()}`;
      const allPayload = {
        resourceType: "AllergyIntolerance",
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: al.statusKlinis || "active",
              display: al.statusKlinis === "active" ? "Active" : "Inactive"
            }
          ]
        },
        verificationStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
              code: "unconfirmed",
              display: "Unconfirmed"
            }
          ]
        },
        type: "allergy",
        category: [al.alergiMaster.kategori || "medication"],
        criticality: al.tingkatKeparahan || "low",
        code: {
          coding: [
            {
              system: al.alergiMaster.kategori === 'medication' ? "http://sys-ids.kemkes.go.id/kfa" : "http://snomed.info/sct",
              code: al.alergiMaster.kode_snomed,
              display: al.alergiMaster.nama_alergi
            }
          ],
          text: al.alergiMaster.nama_alergi
        },
        ...(pasienIhs && { patient: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
        encounter: { reference: encounterRef },
        recordedDate: new Date().toISOString(),
        ...(dokterIhs && { recorder: { reference: formatRef('Practitioner', dokterIhs), display: dokterName } })
      };

      entries.push({
        fullUrl: allUuid,
        resource: allPayload,
        request: {
          method: "POST",
          url: "AllergyIntolerance"
        }
      });
      allergyUuids.push(allUuid);
    }
  });

  // 3.c ANAMNESIS: FAMILYMEMBERHISTORY (Riwayat Penyakit Keluarga)
  const familyHistoryList = dataComplete.screening?.riwayatKeluarga || dataComplete.riwayatKeluarga || [];
  const familyUuids = [];
  if (Array.isArray(familyHistoryList) && familyHistoryList.length > 0) {
    familyHistoryList.forEach((famItem) => {
      const famUuid = `urn:uuid:${randomUUID()}`;
      const famPayload = buildFamilyMemberHistoryPayload({
        pasienIhs,
        pasienName,
        hubungan: "Orang Tua",
        namaPenyakit: typeof famItem === 'string' ? famItem : (famItem.namaPenyakit || "Riwayat Penyakit Keluarga")
      });

      entries.push({
        fullUrl: famUuid,
        resource: famPayload,
        request: {
          method: "POST",
          url: "FamilyMemberHistory"
        }
      });
      familyUuids.push(famUuid);
    });
  }

  // 3.d ANAMNESIS: MEDICATIONSTATEMENT (Riwayat Pengobatan Sebelumnya)
  const medicationHistoryText = dataComplete.screening?.dataTambahan?.riwayat?.riwayatPengobatan || dataComplete.riwayatPengobatan;
  const medStatementUuids = [];
  if (medicationHistoryText) {
    const medStmtUuid = `urn:uuid:${randomUUID()}`;
    const medStmtPayload = buildMedicationStatementPayload({
      pasienIhs,
      pasienName,
      encounterRef,
      encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', ''),
      namaObat: typeof medicationHistoryText === 'string' ? medicationHistoryText : "Obat Riwayat Pasien",
      catatan: typeof medicationHistoryText === 'string' ? medicationHistoryText : undefined
    });

    entries.push({
      fullUrl: medStmtUuid,
      resource: medStmtPayload,
      request: {
        method: "POST",
        url: "MedicationStatement"
      }
    });
    medStatementUuids.push(medStmtUuid);
  }

  // 3.e CLINICALIMPRESSION (Riwayat Perjalanan Penyakit & Prognosis)
  const impressionUuid = `urn:uuid:${randomUUID()}`;
  const impressionPayload = buildClinicalImpressionPayload({
    id: dataComplete.rekamMedis?.id || dataComplete.id || randomUUID(),
    status: "completed",
    pasienIhs,
    pasienName,
    dokterIhs,
    dokterName,
    encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', ''),
    summary: dataComplete.rekamMedis?.keluhanUtama || dataComplete.rekamMedis?.riwayatPenyakitSekarang || "Evaluasi klinis perjalanan penyakit rawat jalan",
    prognosisKode: dataComplete.prognosisKode || dataComplete.rekamMedis?.prognosisKode || "170968001",
    prognosisDisplay: dataComplete.prognosisDisplay || dataComplete.rekamMedis?.prognosisDisplay || "Sanam / Baik (Bonam)"
  }, organizationId);

  impressionPayload.encounter = { reference: encounterRef };
  if (pasienIhs) impressionPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
  if (dokterIhs) impressionPayload.assessor = { reference: formatRef('Practitioner', dokterIhs), display: dokterName };

  entries.push({
    fullUrl: impressionUuid,
    resource: impressionPayload,
    request: {
      method: "POST",
      url: "ClinicalImpression"
    }
  });

  // 3.f GOAL (Tujuan Perawatan Pasien)
  const goalUuid = `urn:uuid:${randomUUID()}`;
  const goalPayload = buildGoalPayload({
    pasienIhs,
    pasienName,
    dokterIhs,
    dokterName,
    tanggalRegistrasi: dataComplete.tanggalRegistrasi,
    tujuanPerawatan: dataComplete.tujuanPerawatan || dataComplete.rekamMedis?.tujuanPerawatan || "Pemulihan kondisi kesehatan dan eliminasi keluhan utama pasien"
  }, organizationId);

  if (pasienIhs) goalPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };

  entries.push({
    fullUrl: goalUuid,
    resource: goalPayload,
    request: {
      method: "POST",
      url: "Goal"
    }
  });

  // 4. PROCEDURES (Tindakan ICD-9)
  const procedureList = dataComplete.procedureList || dataComplete.procedures || dataComplete.tindakans || [];
  procedureList.forEach((proc) => {
    const procUuid = `urn:uuid:${randomUUID()}`;
    const procPayload = buildProcedurePayload({
      ...proc,
      tindakanId: proc.tindakanId || proc.id,
      kodeIcd9: proc.kodeIcd9 || proc.icd9?.kode_icd9 || proc.kode_icd9,
      namaProsedur: proc.namaProsedur || proc.icd9?.nama_prosedur || proc.nama_prosedur,
      pasienIhs,
      pasienName,
      dokterIhs,
      dokterName,
      encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', '')
    }, organizationId);

    procPayload.encounter = { reference: encounterRef };
    if (pasienIhs) procPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };

    entries.push({
      fullUrl: procUuid,
      resource: procPayload,
      request: {
        method: "POST",
        url: "Procedure"
      }
    });
    procUuids.push(procUuid);
  });

  // 5. MEDICATIONS & MEDICATION REQUESTS (Resep Obat)
  const resepDetails = dataComplete.resepDetails || dataComplete.resep || dataComplete.medications || [];
  resepDetails.forEach((med) => {
    const kfaCode = med.kfa_code || med.kodeObat || med.obat?.kfa_code || med.obat?.kodeObat;
    const namaObat = med.namaObat || med.obat?.namaObat;

    if (!kfaCode) {
      console.warn(`[FHIR Mapper] Skipping medication entry for "${namaObat || med.id}": missing valid KFA/obat code.`);
      return;
    }

    const medUuid = `urn:uuid:${randomUUID()}`;
    const medReqUuid = `urn:uuid:${randomUUID()}`;

    // Medication Resource
    const medPayload = buildMedicationPayload({
      ...med,
      resepDetailId: med.resepDetailId || med.id,
      kodeObat: kfaCode,
      namaObat: namaObat,
      sediaan: med.sediaan || med.obat?.sediaan
    }, organizationId, medUuid);

    entries.push({
      fullUrl: medUuid,
      resource: medPayload,
      request: {
        method: "POST",
        url: "Medication"
      }
    });

    // MedicationRequest Resource
    const medReqPayload = buildMedicationRequestPayload({
      ...med,
      resepId: med.resepId,
      resepDetailId: med.resepDetailId || med.id,
      namaObat: namaObat,
      pasienIhs,
      pasienName,
      dokterIhs,
      dokterName,
      encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', '')
    }, medUuid, organizationId);

    medReqPayload.medicationReference = { reference: medUuid, display: namaObat };
    medReqPayload.encounter = { reference: encounterRef };
    if (pasienIhs) medReqPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
    if (dokterIhs) medReqPayload.requester = { reference: formatRef('Practitioner', dokterIhs), display: dokterName };

    entries.push({
      fullUrl: medReqUuid,
      resource: medReqPayload,
      request: {
        method: "POST",
        url: "MedicationRequest"
      }
    });
    medReqUuids.push(medReqUuid);
  });

  // 5.b RADIOLOGI FHIR RESOURCES (ServiceRequest, ImagingStudy, Observation, DiagnosticReport)
  const orderRadiologi = dataComplete.orderRadiologi || dataComplete.rekamMedis?.orderRadiologi;
  let radDiagnosticReportUuid = null;

  if (orderRadiologi && (orderRadiologi.status === 'COMPLETED' || orderRadiologi.hasil)) {
    const radServiceReqUuid = `urn:uuid:${randomUUID()}`;
    const radImagingStudyUuid = `urn:uuid:${randomUUID()}`;
    const radObsUuid = `urn:uuid:${randomUUID()}`;
    radDiagnosticReportUuid = `urn:uuid:${randomUUID()}`;

    const radDetail = orderRadiologi.details?.[0] || {};
    const radHasil = orderRadiologi.hasil || {};

    // 1. ServiceRequest (Radiologi ACSN)
    const radSrPayload = buildServiceRequestPayload({
      id: orderRadiologi.id,
      orderId: orderRadiologi.id,
      acsn: orderRadiologi.acsn,
      requestCode: radDetail.kodeLoinc || "39051-8",
      requestDisplay: radDetail.namaPemeriksaan || "Diagnostic radiography",
      catatanKlinis: orderRadiologi.catatanKlinis,
      pasienIhs,
      pasienName,
      dokterIhs,
      dokterName,
      encounterId: encounterRef.startsWith('urn:uuid:') ? encounterRef : (satusehatEncounterId || encounterUuid),
      tanggalOrder: orderRadiologi.createdAt
    }, organizationId, "RAD");

    radSrPayload.encounter = { reference: encounterRef };
    if (pasienIhs) radSrPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
    if (dokterIhs) radSrPayload.requester = { reference: formatRef('Practitioner', dokterIhs), display: dokterName };

    entries.push({
      fullUrl: radServiceReqUuid,
      resource: radSrPayload,
      request: { method: "POST", url: "ServiceRequest" }
    });

    // 2. ImagingStudy (WADO NIDR)
    const radImagingPayload = toFHIRImagingStudy({
      hasil: radHasil,
      order: orderRadiologi,
      patientIhs: pasienIhs,
      encounterSatusehatId: encounterRef.startsWith('urn:uuid:') ? encounterRef : (satusehatEncounterId || encounterUuid),
      organizationId
    });

    radImagingPayload.encounter = { reference: encounterRef };
    if (pasienIhs) radImagingPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };

    entries.push({
      fullUrl: radImagingStudyUuid,
      resource: radImagingPayload,
      request: { method: "POST", url: "ImagingStudy" }
    });

    // 3. Observation (Imaging Category)
    const radDokterIhsRaw = radHasil.dokterRadiologiId || dokterIhs;
    const radDokterIhsSanitized = (radDokterIhsRaw && !radDokterIhsRaw.startsWith('cms')) ? radDokterIhsRaw : (process.env.SATUSEHAT_PRACTITIONER_IHS || 'N1000001');

    const radObsPayload = toFHIRRadiologyObservation({
      kodeLoinc: radDetail.kodeLoinc || "39051-8",
      namaPemeriksaan: radDetail.namaPemeriksaan || "Diagnostic radiography",
      bacaanNaratif: radHasil.bacaanNaratif || radHasil.interpretasi || "Hasil foto rontgen terlampir",
      pasienIhs,
      pasienName,
      dokterIhs: radDokterIhsSanitized,
      dokterName,
      encounterId: encounterRef.startsWith('urn:uuid:') ? encounterRef : (satusehatEncounterId || encounterUuid),
      imagingStudyId: radImagingStudyUuid,
      createdAt: radHasil.createdAt
    });

    radObsPayload.encounter = { reference: encounterRef };
    if (pasienIhs) radObsPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };

    entries.push({
      fullUrl: radObsUuid,
      resource: radObsPayload,
      request: { method: "POST", url: "Observation" }
    });

    // 4. DiagnosticReport (Radiology Expertise Envelope)
    const validDokterIhs = (dokterIhs && !dokterIhs.startsWith('cms')) ? dokterIhs : (process.env.SATUSEHAT_PRACTITIONER_IHS || 'N1000001');
    const performerRef = `Practitioner/${validDokterIhs}`;
    
    const radDiagReportPayload = {
      resourceType: "DiagnosticReport",
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0074",
              code: "RAD",
              display: "Radiology"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: radDetail.kodeLoinc || "39051-8",
            display: radDetail.namaPemeriksaan || "Diagnostic radiography"
          }
        ]
      },
      subject: { reference: formatRef('Patient', pasienIhs), display: pasienName },
      encounter: { reference: encounterRef },
      effectiveDateTime: radHasil.createdAt ? new Date(radHasil.createdAt).toISOString() : new Date().toISOString(),
      issued: new Date().toISOString(),
      performer: [{ reference: performerRef, display: dokterName || "Dokter Spesialis Radiologi" }],
      basedOn: [{ reference: radServiceReqUuid }],
      result: [{ reference: radObsUuid }],
      imagingStudy: [{ reference: radImagingStudyUuid }],
      conclusion: radHasil.kesimpulan || "Ekspertise Radiologi Selesai"
    };

    entries.push({
      fullUrl: radDiagnosticReportUuid,
      resource: radDiagReportPayload,
      request: { method: "POST", url: "DiagnosticReport" }
    });
  }

  // 6. COMPOSITION (Resume Medis)
  const compositionUuid = `urn:uuid:${randomUUID()}`;
  const compositionPayload = buildCompositionPayload({
    resumeMedisId: dataComplete.rekamMedis?.id || dataComplete.id,
    id: dataComplete.id,
    status: "final",
    pasienIhs,
    pasienName,
    encounterId: satusehatEncounterId || encounterUuid.replace('urn:uuid:', ''),
    dokterIhs,
    dokterName,
    title: "Resume Medis Rawat Jalan",
    ringkasanKlinis: dataComplete.rekamMedis?.keluhanUtama || dataComplete.rekamMedis?.diagnosisKlinis || "Pemeriksaan Rawat Jalan",
    instruksiTindakLanjut: dataComplete.rekamMedis?.instruksiMedis || dataComplete.rekamMedis?.rencanaTerapi || "Kontrol bila keluhan berlanjut",
    diagnosticReportId: radDiagnosticReportUuid
  }, organizationId);

  compositionPayload.encounter = { reference: encounterRef };
  if (pasienIhs) compositionPayload.subject = { reference: formatRef('Patient', pasienIhs), display: pasienName };
  if (dokterIhs) compositionPayload.author = [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }];

  const compositionSections = [
    {
      title: "Riwayat Keluhan & Ringkasan Klinis",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "11329-0",
            display: "History of General health Narrative"
          }
        ]
      },
      text: {
        status: "generated",
        div: `<div xmlns="http://www.w3.org/1999/xhtml">${dataComplete.rekamMedis?.keluhanUtama || "Tidak ada ringkasan"}</div>`
      }
    }
  ];

  if (condUuids.length > 0) {
    compositionSections.push({
      title: "Diagnosis",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "29548-5",
            display: "Diagnosis"
          }
        ]
      },
      entry: condUuids.map(uuid => ({ reference: uuid }))
    });
  }

  if (obsUuids.length > 0) {
    compositionSections.push({
      title: "Pemeriksaan Fisik & Tanda Vital",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "8716-3",
            display: "Vital signs"
          }
        ]
      },
      entry: obsUuids.map(uuid => ({ reference: uuid }))
    });
  }

  if (allergyUuids.length > 0) {
    compositionSections.push({
      title: "Riwayat Alergi Pasien",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "48765-2",
            display: "Allergies and adverse reactions Document"
          }
        ]
      },
      entry: allergyUuids.map(uuid => ({ reference: uuid }))
    });
  }

  if (familyUuids.length > 0) {
    compositionSections.push({
      title: "Riwayat Penyakit Keluarga",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "10157-6",
            display: "History of family member diseases Document"
          }
        ]
      },
      entry: familyUuids.map(uuid => ({ reference: uuid }))
    });
  }

  if (medStatementUuids.length > 0) {
    compositionSections.push({
      title: "Riwayat Pengobatan Sebelumnya",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "10160-0",
            display: "History of Medication use Narrative"
          }
        ]
      },
      entry: medStatementUuids.map(uuid => ({ reference: uuid }))
    });
  }

  if (impressionUuid) {
    compositionSections.push({
      title: "Rasional Klinis & Prognosis",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "11450-4",
            display: "Problem list - Reported"
          }
        ]
      },
      entry: [{ reference: impressionUuid }]
    });
  }

  if (goalUuid) {
    compositionSections.push({
      title: "Tujuan Perawatan",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "61145-9",
            display: "Goals Narrative"
          }
        ]
      },
      entry: [{ reference: goalUuid }]
    });
  }

  if (procUuids.length > 0) {
    compositionSections.push({
      title: "Tindakan Medis",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "18776-5",
            display: "Plan of care note"
          }
        ]
      },
      entry: procUuids.map(uuid => ({ reference: uuid }))
    });
  }

  // 13. SERVICE REQUEST (RUJUKAN KELUAR)
  let serviceRequestUuid = null;
  if (dataComplete.rujukanKeluar) {
    serviceRequestUuid = `urn:uuid:${randomUUID()}`;
    const rujukanData = dataComplete.rujukanKeluar;
    const srResource = {
      resourceType: "ServiceRequest",
      identifier: [
        {
          system: `http://sys-ids.kemkes.go.id/servicerequest/${organizationId}`,
          value: rujukanData.id || `SR-${Date.now()}`
        }
      ],
      status: "active",
      intent: "original-order",
      priority: "routine",
      category: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "3457005",
              display: "Referral"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "3457005",
            display: `Referral to ${rujukanData.poliTujuan} at ${rujukanData.faskesTujuan}`
          }
        ]
      },
      ...(pasienIhs && { subject: { reference: formatRef('Patient', pasienIhs), display: pasienName } }),
      encounter: { reference: encounterRef },
      authoredOn: new Date().toISOString(),
      ...(dokterIhs && { requester: { reference: formatRef('Practitioner', dokterIhs), display: dokterName } }),
      ...(dokterIhs && { performer: [{ reference: formatRef('Practitioner', dokterIhs), display: dokterName }] }),
      ...(rujukanData.alasanRujukan && { note: [{ text: rujukanData.alasanRujukan }] })
    };

    entries.push({
      fullUrl: serviceRequestUuid,
      resource: srResource,
      request: {
        method: "POST",
        url: "ServiceRequest"
      }
    });
  }

  if (medReqUuids.length > 0) {
    compositionSections.push({
      title: "Resep Obat",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "29551-9",
            display: "Medication prescribed"
          }
        ]
      },
      entry: medReqUuids.map(uuid => ({ reference: uuid }))
    });
  }

  const instructionEntries = [];
  if (serviceRequestUuid) {
    instructionEntries.push({ reference: serviceRequestUuid });
  }

  compositionSections.push({
    title: "Instruksi Tindak Lanjut",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "28574-2",
          display: "Discharge instructions instructions"
        }
      ]
    },
    ...(instructionEntries.length > 0 && { entry: instructionEntries }),
    text: {
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml">${dataComplete.rekamMedis?.instruksiMedis || dataComplete.rekamMedis?.rencanaTerapi || "Rujukan ke " + (dataComplete.rujukanKeluar?.faskesTujuan || "Faskes Tujuan")}</div>`
    }
  });

  compositionPayload.section = compositionSections;

  entries.push({
    fullUrl: compositionUuid,
    resource: compositionPayload,
    request: {
      method: "POST",
      url: "Composition"
    }
  });

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries
  };
};

module.exports = { toRawatJalanBundle };
