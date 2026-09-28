/**
 * FHIR R4 MedicationStatement Mapper for Riwayat Pengobatan Pasien
 */
const buildMedicationStatementPayload = (data) => {
  return {
    resourceType: "MedicationStatement",
    status: data.status || "active",
    category: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/medication-statement-category",
          code: "community",
          display: "Community"
        }
      ]
    },
    medicationCodeableConcept: {
      coding: [
        {
          system: "http://sys-ids.kemkes.go.id/kfa",
          code: data.kodeKfa || "93001017",
          display: data.namaObat || "Obat Riwayat Pasien"
        }
      ],
      text: data.namaObat || "Obat Riwayat Pasien"
    },
    subject: {
      reference: `Patient/${data.pasienIhs}`,
      display: data.pasienName
    },
    context: {
      reference: data.encounterRef || `Encounter/${data.encounterId}`
    },
    informationSource: {
      reference: `Patient/${data.pasienIhs}`,
      display: data.pasienName
    },
    dateAsserted: new Date().toISOString(),
    ...(data.catatan && {
      note: [
        {
          text: data.catatan
        }
      ]
    })
  };
};

module.exports = { buildMedicationStatementPayload };
