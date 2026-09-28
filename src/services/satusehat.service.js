const axios = require('axios');
const crypto = require('crypto');
const satusehatConfig = require('../config/satusehat');
const { createFhirClient, generateAccessToken } = require('../utils/satusehat-client');
const { buildRelatedPersonPayload, buildQuestionnaireResponsePayload } = require('../utils/fhir-mappers');

/**
 * Search Patient by NIK (Nomor Induk Kependudukan)
 * @param {string} nik - NIK Pasien
 * @returns {Promise<Object>} Patient Data (including IHS Number)
 */
const getPatientByNIK = async (nik) => {
  try {
    const fhirClient = await createFhirClient();

    // Format pencarian pasien berdasarkan NIK sesuai standar SATUSEHAT
    const response = await fhirClient.get(`/Patient?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`);

    // Periksa apakah ada pasien yang ditemukan
    if (response.data && response.data.entry && response.data.entry.length > 0) {
      const patient = response.data.entry[0].resource;

      // Ambil ihsNumber (id) dari resource pasien
      const ihsNumber = patient.id;

      return {
        success: true,
        data: patient,
        ihsNumber: ihsNumber
      };
    } else {
      return {
        success: false,
        message: 'Pasien tidak ditemukan di SATUSEHAT'
      };
    }
  } catch (error) {
    console.error(`[SATUSEHAT] Error searching patient by NIK ${nik}:`, error.response?.data || error.message);
    throw new Error('Terjadi kesalahan saat mencari pasien di SATUSEHAT');
  }
};
/**
 * Search Patient (Ibu) by NIK Ibu
 * @param {string} nikIbu - NIK Ibu Pasien
 * @returns {Promise<Object>} Patient Data Ibu (termasuk IHS Number)
 */
const getPatientByNIKIbu = async (nikIbu) => {
  try {
    const fhirClient = await createFhirClient();
    const response = await fhirClient.get(`/Patient?identifier=https://fhir.kemkes.go.id/id/nik-ibu|${nikIbu}`);

    if (response.data && response.data.entry && response.data.entry.length > 0) {
      return {
        success: true,
        data: response.data.entry.map(e => e.resource),
        total: response.data.total || response.data.entry.length
      };
    } else {
      return {
        success: false,
        message: 'Pasien bayi baru lahir dengan NIK Ibu tersebut tidak ditemukan'
      };
    }
  } catch (error) {
    console.error(`[SATUSEHAT] Error searching patient by NIK Ibu ${nikIbu}:`, error.response?.data || error.message);
    throw new Error('Terjadi kesalahan saat mencari pasien bayi di SATUSEHAT');
  }
};

/**
 * Pendaftaran Pasien Baru ke SATUSEHAT
 * @param {Object} data - data lengkap pasien dari frontend (NIK, Nama, TanggalLahir, dll)
 * @returns {Promise<Object>} Respons dengan Nomor IHS baru
 */
const createPatient = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const payload = buildPatientPayload(data);

    console.log("[SATUSEHAT] Mengirim POST /Patient dengan payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/Patient', payload);

    return {
      success: true,
      data: response.data,
      ihsNumber: response.data.id // Nomor IHS selalu berada di atribut .id
    };
  } catch (error) {
    if (error.response?.data?.resourceType === 'Patient') {
      console.log(`[SATUSEHAT] NIK ${data.nik} sudah terdaftar sebelumnya, mengambil ID lama: ${error.response.data.id}`);
      return {
        success: true,
        data: error.response.data,
        ihsNumber: error.response.data.id
      };
    }

    const issue = error.response?.data?.issue?.[0];
    const errorMessage = issue?.diagnostics || issue?.details?.text || error.message;
    console.error(`[SATUSEHAT] Error creating patient for NIK ${data.nik}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(errorMessage || 'Terjadi kesalahan saat mendaftarkan pasien ke SATUSEHAT');
  }
};

/**
 * Step 2.b: POST RelatedPerson ke SATUSEHAT dan menautkannya dengan Ibu
 * @param {Object} data - data bayi & ibu pasien
 * @param {string} bayiIhs - Nomor IHS Bayi
 * @param {string} ibuIhs - Nomor IHS Ibu
 * @returns {Promise<Object>} Response dengan RelatedPerson ID
 */
const createRelatedPerson = async (data, bayiIhs, ibuIhs) => {
  try {
    const fhirClient = await createFhirClient();

    const payload = buildRelatedPersonPayload(data, bayiIhs, ibuIhs);

    console.log("[SATUSEHAT] Mengirim POST /RelatedPerson:", JSON.stringify(payload, null, 2));
    const response = await fhirClient.post('/RelatedPerson', payload);

    return {
      success: true,
      data: response.data,
      relatedPersonId: response.data.id
    };
  } catch (error) {
    console.error("[SATUSEHAT] Error creating RelatedPerson:", error.response?.data || error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Search Practitioner (Tenaga Medis) by NIK
 * @param {string} nik - NIK Praktisioner
 * @returns {Promise<Object>} Practitioner Data (including IHS Number)
 */
const getPractitionerByNIK = async (nik) => {
  try {
    const fhirClient = await createFhirClient();

    // Format pencarian praktisioner berdasarkan NIK sesuai standar SATUSEHAT
    const response = await fhirClient.get(`/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`);

    // Periksa apakah ada praktisioner yang ditemukan
    if (response.data && response.data.entry && response.data.entry.length > 0) {
      const practitioner = response.data.entry[0].resource;

      // Ambil ihsNumber (id) dari resource
      const ihsNumber = practitioner.id;

      return {
        success: true,
        data: practitioner,
        ihsNumber: ihsNumber
      };
    } else {
      return {
        success: false,
        message: 'Tenaga Medis tidak ditemukan di SATUSEHAT'
      };
    }
  } catch (error) {
    console.error(`[SATUSEHAT] Error searching practitioner by NIK ${nik}:`, error.response?.data || error.message);
    throw new Error('Terjadi kesalahan saat mencari tenaga medis di SATUSEHAT');
  }
};

const {
  buildLocationPayload,
  buildEncounterPayload,
  buildObservationPayload,
  buildConditionPayload,
  buildMedicationPayload,
  buildMedicationRequestPayload,
  buildProcedurePayload,
  buildAllergyPayload,
  buildMedicationDispensePayload,
  buildPatientPayload,
  buildCompositionPayload,
  buildClinicalImpressionPayload,
  buildServiceRequestPayload,
  buildSpecimenPayload
} = require('../utils/fhir-mappers');

/**
 * Create Location in SATUSEHAT for a Poliklinik
 * @param {Object} poliklinik - Poliklinik Data from DB
 * @returns {Promise<Object>} Location Data (including IHS Location ID)
 */
const createLocation = async (poliklinik) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    if (!orgId) {
      throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
    }

    const payload = buildLocationPayload(poliklinik, orgId);

    const response = await fhirClient.post('/Location', payload);

    return {
      success: true,
      data: response.data,
      ihsLocationId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating location for poli ${poliklinik.namaPoli}:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mendaftarkan lokasi ke SATUSEHAT');
  }
};

/**
 * Create Encounter in SATUSEHAT
 * @param {Object} data - Data Kunjungan, Pasien, Dokter, dan Poliklinik
 * @returns {Promise<Object>} Encounter Data
 */
const createEncounter = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    if (!orgId) {
      throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
    }

    const payload = buildEncounterPayload(data, orgId);

    // Cetak payload ke terminal agar bisa dilihat oleh developer
    console.log("[SATUSEHAT] Mengirim Encounter Payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/Encounter', payload);

    return {
      success: true,
      data: response.data,
      encounterId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating encounter:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat membuat Encounter ke SATUSEHAT');
  }
};

/**
 * Update Encounter in SATUSEHAT (PUT /Encounter/{encounterId})
 * @param {string} encounterId - SATUSEHAT Encounter ID
 * @param {Object} data - Data Kunjungan, Pasien, Dokter, Poliklinik, Status (arrived/in-progress/finished)
 */
const updateEncounter = async (encounterId, data) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    if (!orgId) {
      throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
    }

    const payload = buildEncounterPayload(data, orgId);
    payload.id = encounterId;

    console.log(`[SATUSEHAT] Updating Encounter ${encounterId} Payload:`, JSON.stringify(payload, null, 2));

    const response = await fhirClient.put(`/Encounter/${encounterId}`, payload);

    return {
      success: true,
      data: response.data,
      encounterId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error updating encounter ${encounterId}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat memperbarui Encounter di SATUSEHAT');
  }
};

/**
 * Mengirim Diagnosa (Condition) ke SATUSEHAT
 * @param {Object} data - payload (pasienIhs, pasienName, dokterIhs, dokterName, encounterId, kodeIcd10, namaDiagnosis, statusDiagnosis)
 */
const createCondition = async (data) => {
  try {
    const fhirClient = await createFhirClient();

    const payload = buildConditionPayload(data);

    // Cetak payload ke terminal agar bisa dilihat oleh developer
    console.log("[SATUSEHAT] Mengirim Condition Payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/Condition', payload);

    return {
      success: true,
      data: response.data,
      conditionId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating condition for ICD-10 ${data.kodeIcd10}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim Condition ke SATUSEHAT');
  }
};

/**
 * Mengirim Tanda-Tanda Vital (Observation) ke SATUSEHAT
 * @param {Object} data - payload (pasienIhs, pasienName, dokterIhs, dokterName, encounterId, loincCode, loincDisplay, value, unit, unitCode)
 */
const createObservation = async (data) => {
  const fhirClient = await createFhirClient();
  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

  if (!orgId) {
    throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
  }

  const payload = buildObservationPayload(data);

  // Cetak payload ke terminal agar bisa dilihat oleh developer
  console.log("[SATUSEHAT] Mengirim Observation Payload:", JSON.stringify(payload, null, 2));

  const response = await fhirClient.post('/Observation', payload);

  return {
    success: true,
    data: response.data,
    observationId: response.data.id
  };
};

/**
 * Mengirim sekumpulan Tanda-Tanda Vital (Observation) dalam 1 Bundle Transaction
 * @param {Array<Object>} observationsData - array payload (pasienIhs, pasienName, dokterIhs, dokterName, encounterId, loincCode, dll)
 * @returns {Promise<Object>} Response Bundle
 */
const createObservationBundle = async (observationsData) => {
  if (!observationsData || observationsData.length === 0) return { success: true, observationIds: [] };

  const fhirClient = await createFhirClient();
  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

  if (!orgId) {
    throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
  }

  // Rakit resource Bundle
  const bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: []
  };

  // Masukkan tiap observation ke dalam Bundle Entry
  for (const data of observationsData) {
    const observationPayload = buildObservationPayload(data);
    bundle.entry.push({
      fullUrl: `urn:uuid:${crypto.randomUUID()}`,
      resource: observationPayload,
      request: {
        method: "POST",
        url: "Observation"
      }
    });
  }

  console.log(`[SATUSEHAT] Mengirim Observation Bundle (${observationsData.length} data):`, JSON.stringify(bundle, null, 2));

  // Post ke root URL ('/') karena tipe Bundle transaction
  const response = await fhirClient.post('/', bundle);

  // Ekstrak ID yang berhasil di-generate dari response
  const observationIds = [];
  if (response.data && response.data.entry) {
    response.data.entry.forEach(entry => {
      // Biasanya kembalian dari POST Bundle ada di entry[i].response.location
      // Contoh: "Observation/12345/_history/1"
      if (entry.response && entry.response.location) {
        const parts = entry.response.location.split('/');
        if (parts.length >= 2) {
          observationIds.push(parts[1]); // ID berada setelah "Observation/"
        }
      }
    });
  }

  return {
    success: true,
    data: response.data,
    observationIds: observationIds
  };
};

/**
 * Mengirim Obat (Medication) dan Resep (MedicationRequest) ke SATUSEHAT
 * @param {Object} data - payload (pasienIhs, pasienName, dokterIhs, dokterName, encounterId, kodeObat, namaObat, sediaan, resepId, resepDetailId, jumlah, aturanPakai)
 */
const createPrescription = async (data) => {
  const fhirClient = await createFhirClient();
  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

  if (!orgId) {
    throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
  }

  // 1. Kirim Medication (Definisi Obat)
  const uniqueMedReqId = data.resepDetailId ? `${data.resepDetailId}-req` : null;
  const medicationPayload = buildMedicationPayload(data, orgId, uniqueMedReqId);
  console.log("[SATUSEHAT] Mengirim Medication Payload:", JSON.stringify(medicationPayload, null, 2));
  let medicationId;
  try {
    const medResponse = await fhirClient.post('/Medication', medicationPayload);
    medicationId = medResponse.data.id;
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating Medication untuk ${data.kodeObat}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim Medication ke SATUSEHAT');
  }

  // 2. Kirim MedicationRequest (Instruksi Resep)
  const medReqPayload = buildMedicationRequestPayload(data, medicationId, orgId);
  console.log("[SATUSEHAT] Mengirim MedicationRequest Payload:", JSON.stringify(medReqPayload, null, 2));

  try {
    const reqResponse = await fhirClient.post('/MedicationRequest', medReqPayload);
    return {
      success: true,
      medicationId: medicationId,
      medicationRequestId: reqResponse.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating MedicationRequest untuk ${data.kodeObat}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim MedicationRequest ke SATUSEHAT');
  }
};

/**
 * Mengirim Tindakan (Procedure) ke SATUSEHAT
 * @param {Object} data - payload (pasienIhs, pasienName, dokterIhs, dokterName, encounterId, kodeIcd9, namaProsedur, tindakanId, waktuTindakan)
 */
const createProcedure = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    if (!orgId) {
      throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
    }

    const payload = buildProcedurePayload(data, orgId);

    // Cetak payload ke terminal agar bisa dilihat oleh developer
    console.log("[SATUSEHAT] Mengirim Procedure Payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/Procedure', payload);

    return {
      success: true,
      data: response.data,
      procedureId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating procedure for ICD-9 ${data.kodeIcd9}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim Procedure ke SATUSEHAT');
  }
};

/**
 * Mengirim AllergyIntolerance (Alergi Pasien) ke SATUSEHAT
 * @param {Object} pasien - Data Pasien lengkap
 * @param {Object} dokter - Data Dokter lengkap
 * @param {Object} kunjungan - Data Kunjungan
 * @param {Object} alergiPasien - Data transaksional Alergi (termasuk relasi alergiMaster)
 */
const createAllergyIntolerance = async (pasien, dokter, kunjungan, alergiPasien) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    if (!orgId) {
      throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
    }

    const payload = buildAllergyPayload(orgId, pasien, dokter, kunjungan, alergiPasien);

    // Cetak payload ke terminal
    console.log("[SATUSEHAT] Mengirim AllergyIntolerance Payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/AllergyIntolerance', payload);

    return {
      success: true,
      data: response.data,
      allergyId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating AllergyIntolerance for ${alergiPasien.alergiMaster?.nama_alergi}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim AllergyIntolerance ke SATUSEHAT');
  }
};

/**
 * Search KFA (Kamus Farmasi dan Alat Kesehatan)
 * @param {string} keyword - Kata kunci pencarian
 * @returns {Promise<Object>} Data produk dari KFA
 */
const searchKFA = async (keyword) => {
  try {
    const token = await generateAccessToken();
    const url = `${satusehatConfig.SATUSEHAT_URL.KFA_URL}/products/all`;

    const response = await axios.get(url, {
      params: {
        product_type: 'farmasi',
        keyword,
        page: 1,
        size: 50
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[SATUSEHAT] Error searching KFA:', error.response?.data || error.message);
    throw new Error('Terjadi kesalahan saat mencari data di KFA SATUSEHAT');
  }
};

/**
 * Mengirim Penyerahan Obat (MedicationDispense) ke SATUSEHAT
 * Sesuai panduan Kemenkes, ini mengirim Medication kemudian MedicationDispense
 * @param {Object} data - payload lengkap
 */
const postMedicationDispense = async (data) => {
  const fhirClient = await createFhirClient();
  const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

  if (!orgId) {
    throw new Error('SATUSEHAT_ORG_ID belum dikonfigurasi di file .env');
  }

  // Cari ID Lokasi Poliklinik (ihsLocationId) dari database SIMPUS secara dinamis
  let locationId = data.locationId || '';
  let locationName = data.locationName || 'Depo Farmasi SIMPUS';

  if (!locationId && data.encounterId) {
    try {
      const prisma = require('../config/prisma');
      const kunjungan = await prisma.kunjungan.findFirst({
        where: {
          OR: [
            { encounterId: data.encounterId },
            { id: data.resepId } // fallback ke resep.kunjunganId
          ]
        },
        include: {
          poliklinik: true
        }
      });
      if (kunjungan && kunjungan.poliklinik) {
        locationId = kunjungan.poliklinik.ihsLocationId || '';
        locationName = kunjungan.poliklinik.namaPoli || 'Depo Farmasi SIMPUS';
        console.log(`[SATUSEHAT] Ditemukan lokasi poliklinik dinamis: ${locationName} (${locationId})`);
      }
    } catch (dbError) {
      console.warn(`[SATUSEHAT] Gagal mencari lokasi poliklinik dari DB:`, dbError.message);
    }
  }

  // Fallback cadangan dari config .env jika SIMPUS belum sinkron Location ID
  if (!locationId) {
    locationId = satusehatConfig.SATUSEHAT_FARMASI_LOCATION_ID || 'd8226063-4712-4217-a021-9988ff885544';
    locationName = 'Depo Farmasi Klinik';
  }

  // 1. Kirim Medication (Definisi Obat yang diserahkan)
  const uniqueMedDispId = data.resepDetailId ? `${data.resepDetailId}-disp` : null;
  const medicationPayload = buildMedicationPayload(data, orgId, uniqueMedDispId);
  console.log("[SATUSEHAT] Mengirim Medication (Dispense) Payload:", JSON.stringify(medicationPayload, null, 2));
  let medicationId;
  try {
    const medResponse = await fhirClient.post('/Medication', medicationPayload);
    medicationId = medResponse.data.id;
  } catch (error) {
    const issue = error.response?.data?.issue?.[0];
    const diag = issue?.diagnostics || issue?.details?.text || issue?.details?.coding?.[0]?.display || error.message;
    console.error(`[SATUSEHAT] Error creating Medication (Dispense) untuk ${data.kodeObat}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(`SATUSEHAT Error: ${diag}`);
  }

  // 2. Cari MedicationRequest yang berpasangan dengan encounterId & kodeObat di SATUSEHAT
  let medicationRequestId = data.medicationRequestId || '';
  if (!medicationRequestId && data.encounterId) {
    try {
      console.log(`[SATUSEHAT] Mencari MedicationRequest untuk Encounter: ${data.encounterId}`);
      const searchResponse = await fhirClient.get(`/MedicationRequest?encounter=${data.encounterId}`);
      if (searchResponse.data && searchResponse.data.entry && searchResponse.data.entry.length > 0) {
        // Cari entry yang memiliki kode obat (KFA code) sesuai
        const matchEntry = searchResponse.data.entry.find(e => {
          const resource = e.resource;
          const codeableConcept = resource.medicationCodeableConcept;
          if (codeableConcept && codeableConcept.coding) {
            return codeableConcept.coding.some(c => c.code === data.kodeObat);
          }
          // Jika menggunakan medicationReference, periksa display atau referensinya
          const medRef = resource.medicationReference;
          if (medRef && medRef.display) {
            return medRef.display.toLowerCase().includes(data.namaObat?.toLowerCase());
          }
          return false;
        });

        if (matchEntry) {
          medicationRequestId = matchEntry.resource.id;
          console.log(`[SATUSEHAT] Ditemukan MedicationRequest ID matching: ${medicationRequestId}`);
        } else {
          // Fallback ambil entry pertama jika tidak ada yang exact match
          medicationRequestId = searchResponse.data.entry[0].resource.id;
          console.log(`[SATUSEHAT] Ditemukan MedicationRequest ID fallback (first entry): ${medicationRequestId}`);
        }
      }
    } catch (searchError) {
      console.warn(`[SATUSEHAT] Gagal mencari MedicationRequest secara otomatis:`, searchError.message);
    }
  }

  // Jika tetap tidak ditemukan, kita buat MedicationRequest bayangan (dummy) terlebih dahulu agar alur rujukan SATUSEHAT tetap valid
  if (!medicationRequestId) {
    try {
      console.log(`[SATUSEHAT] MedicationRequest tidak ditemukan. Membuat MedicationRequest baru secara dinamis...`);
      const buildRequestData = {
        ...data,
        medicationId: medicationId
      };
      const medReqPayload = buildMedicationRequestPayload(buildRequestData, medicationId, orgId);
      const reqResponse = await fhirClient.post('/MedicationRequest', medReqPayload);
      medicationRequestId = reqResponse.data.id;
      console.log(`[SATUSEHAT] Berhasil membuat MedicationRequest dinamis: ${medicationRequestId}`);
    } catch (createReqError) {
      console.error(`[SATUSEHAT] Gagal membuat MedicationRequest dinamis:`, createReqError.response?.data || createReqError.message);
    }
  }

  // 3. Kirim MedicationDispense (Penyerahan)
  const dispensePayload = buildMedicationDispensePayload({
    ...data,
    medicationRequestId,
    locationId,
    locationName
  }, medicationId, orgId);
  console.log("[SATUSEHAT] Mengirim MedicationDispense Payload:", JSON.stringify(dispensePayload, null, 2));

  try {
    const response = await fhirClient.post('/MedicationDispense', dispensePayload);
    return {
      success: true,
      medicationId: medicationId,
      medicationDispenseId: response.data.id
    };
  } catch (error) {
    const issue = error.response?.data?.issue?.[0];
    const diag = issue?.diagnostics || issue?.details?.text || issue?.details?.coding?.[0]?.display || error.message;
    console.error(`[SATUSEHAT] Error creating MedicationDispense untuk ${data.kodeObat}:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(`SATUSEHAT Error: ${diag}`);
  }
};

/**
 * Mengirim Pengkajian Resep Apoteker (QuestionnaireResponse) ke SATUSEHAT
 * @param {Object} data - payload pengkajian resep
 */
const createQuestionnaireResponse = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const payload = buildQuestionnaireResponsePayload(data);

    console.log("[SATUSEHAT] Mengirim QuestionnaireResponse Payload:", JSON.stringify(payload, null, 2));

    const response = await fhirClient.post('/QuestionnaireResponse', payload);
    return {
      success: true,
      data: response.data,
      questionnaireResponseId: response.data.id
    };
  } catch (error) {
    console.error(`[SATUSEHAT] Error creating QuestionnaireResponse:`, error.response?.data ? JSON.stringify(error.response?.data, null, 2) : error.message);
    throw new Error(error.response?.data?.issue?.[0]?.diagnostics || 'Terjadi kesalahan saat mengirim QuestionnaireResponse ke SATUSEHAT');
  }
};

/**
 * Mengirim QuestionnaireResponse ke SATUSEHAT
 * @param {Object} data - Input data pengkajian kuesioner
 * @returns {Promise<Object>} Response dengan QuestionnaireResponse ID
 */
const postQuestionnaireResponse = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;
    const payload = buildQuestionnaireResponsePayload(data, orgId);

    console.log("[SATUSEHAT] Mengirim POST /QuestionnaireResponse:", JSON.stringify(payload, null, 2));
    const response = await fhirClient.post('/QuestionnaireResponse', payload);

    return {
      success: true,
      data: response.data,
      questionnaireResponseId: response.data.id
    };
  } catch (error) {
    console.error("[SATUSEHAT] Error creating QuestionnaireResponse:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.issue?.[0]?.diagnostics || error.message
    };
  }
};

/**
 * Mengirim Instruksi Rencana Tindak Lanjut (ServiceRequest) ke SATUSEHAT
 * @param {Object} data - Input data ServiceRequest (tipe rujukan / lab / radiologi)
 * @returns {Promise<Object>} Response dengan ServiceRequest ID
 */
const postServiceRequest = async (data) => {
  try {
    const fhirClient = await createFhirClient();
    const orgId = satusehatConfig.SATUSEHAT_ORG_ID;

    // Menerima parameter tambahan tipe request (default LAB, bisa ditimpa Rujukan/Radiologi)
    const type = data.requestType || "LAB";
    const payload = buildServiceRequestPayload(data, orgId, type);

    console.log("[SATUSEHAT] Mengirim POST /ServiceRequest:", JSON.stringify(payload, null, 2));
    const response = await fhirClient.post('/ServiceRequest', payload);

    return {
      success: true,
      data: response.data,
      serviceRequestId: response.data.id
    };
  } catch (error) {
    console.error("[SATUSEHAT] Error creating ServiceRequest:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.issue?.[0]?.diagnostics || error.message
    };
  }
};

module.exports = {
  generateAccessToken,
  createFhirClient,
  getPatientByNIK,
  getPatientByNIKIbu,
  getPractitionerByNIK,
  createLocation,
  createPatient,
  createRelatedPerson,
  createEncounter,
  updateEncounter,
  createObservation,
  createObservationBundle,
  createCondition,
  createPrescription,
  createProcedure,
  createAllergyIntolerance,
  searchKFA,
  postMedicationDispense,
  postQuestionnaireResponse,
  postServiceRequest
};
