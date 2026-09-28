/**
 * FHIR R4 QuestionnaireResponse Mapper for SATUSEHAT (POST /QuestionnaireResponse)
 * Generates payload according to Kemenkes SATUSEHAT interoperability specifications.
 * 
 * @param {Object} data - Input data containing questionnaire responses
 * @param {string} orgId - SATUSEHAT Organization ID
 * @returns {Object} QuestionnaireResponse FHIR R4 JSON Payload
 */
const buildQuestionnaireResponsePayload = (data = {}, orgId) => {
  const patientIhs = data.patientIhs || data.pasienIhs;
  const encounterIhs = data.encounterIhs || data.encounterId;
  const practitionerIhs = data.practitionerIhs || data.dokterIhs;

  if (!patientIhs) throw new Error("IHS Pasien (patientIhs) wajib disertakan");
  if (!encounterIhs) throw new Error("IHS Kunjungan (encounterIhs) wajib disertakan");

  // Tanggal & Waktu disesuaikan dengan UTC +00 jika ada waktu lokal
  const authoredDate = data.authored ? new Date(data.authored).toISOString() : new Date().toISOString();

  const payload = {
    resourceType: "QuestionnaireResponse",
    questionnaire: data.questionnaireUrl || "https://fhir.kemkes.go.id/Questionnaire/Q0002",
    status: data.status || "completed",
    subject: {
      reference: `Patient/${patientIhs}`,
      display: data.patientName || "Patient"
    },
    encounter: {
      reference: `Encounter/${encounterIhs}`
    },
    authored: authoredDate,
    item: data.items || []
  };

  // Opsional link to ServiceRequest / CarePlan
  if (data.basedOn) {
    payload.basedOn = Array.isArray(data.basedOn)
      ? data.basedOn.map(ref => ({ reference: ref }))
      : [{ reference: data.basedOn }];
  }

  // Opsional link to Observation / Procedure
  if (data.partOf) {
    payload.partOf = Array.isArray(data.partOf)
      ? data.partOf.map(ref => ({ reference: ref }))
      : [{ reference: data.partOf }];
  }

  // Author / Pencatat (Dokter / Tenaga Medis) - Wajib ada
  payload.author = {
    reference: `Practitioner/${practitionerIhs}`,
    display: data.practitionerName || "Apoteker SIMPUS"
  };

  // Source / Sumber jawaban - Wajib ada (Pasien)
  payload.source = {
    reference: `Patient/${patientIhs}`,
    display: data.patientName || "Patient"
  };

  return payload;
};

module.exports = {
  buildQuestionnaireResponsePayload
};
