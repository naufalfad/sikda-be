const buildMedicationPayload = (data, orgId, uniqueId = null) => {
  // Mapping sediaan (form) secara sederhana
  let formCode = "BS023"; // Default Kaplet Salut Selaput
  let formDisplay = "Kaplet Salut Selaput";

  if (data.sediaan && data.sediaan.toLowerCase().includes('tablet')) {
    formCode = "BS065";
    formDisplay = "Tablet";
  } else if (data.sediaan && data.sediaan.toLowerCase().includes('kapsul')) {
    formCode = "BS036";
    formDisplay = "Kapsul";
  } else if (data.sediaan && data.sediaan.toLowerCase().includes('sirup')) {
    formCode = "BS060";
    formDisplay = "Sirup";
  }

  return {
    resourceType: "Medication",
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/medication/${orgId}`,
        use: "official",
        value: uniqueId || data.resepDetailId || data.kodeObat
      }
    ],
    code: {
      coding: [
        {
          system: "http://sys-ids.kemkes.go.id/kfa",
          code: data.kodeObat, // Kode KFA (Kamus Farmasi dan Alat Kesehatan)
          display: data.namaObat
        }
      ]
    },
    status: "active",
    form: {
      coding: [
        {
          system: "http://terminology.kemkes.go.id/CodeSystem/medication-form",
          code: formCode,
          display: formDisplay
        }
      ]
    },
    extension: [
      {
        url: "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
        valueCodeableConcept: {
          coding: [
            {
              system: "http://terminology.kemkes.go.id/CodeSystem/medication-type",
              code: "NC", // Default Non-compound (Non-racikan)
              display: "Non-compound"
            }
          ]
        }
      }
    ]
  };
};

const buildMedicationRequestPayload = (data, medicationId, orgId) => {
  const authoredDate = data.tanggalResep 
    ? new Date(data.tanggalResep).toISOString() 
    : new Date().toISOString();

  return {
    resourceType: "MedicationRequest",
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/prescription/${orgId}`,
        use: "official",
        value: data.resepId // ID Resep lokal
      },
      {
        system: `http://sys-ids.kemkes.go.id/prescription-item/${orgId}`,
        use: "official",
        value: data.resepDetailId // ID Resep per-item
      }
    ],
    status: data.status === 'SELESAI' ? 'completed' : 'active', 
    intent: "order",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
            code: "outpatient", 
            display: "Outpatient"
          }
        ]
      }
    ],
    priority: "routine",
    medicationReference: {
      reference: `Medication/${medicationId}`,
      display: data.namaObat
    },
    subject: {
      reference: `Patient/${data.pasienIhs}`,
      display: data.pasienName
    },
    encounter: {
      reference: `Encounter/${data.encounterId}`
    },
    authoredOn: authoredDate,
    requester: {
      reference: `Practitioner/${data.dokterIhs}`,
      display: data.dokterName
    },
    ...(data.catatan && {
      note: [{ text: data.catatan }]
    }),
    dosageInstruction: [
      {
        sequence: 1,
        text: data.aturanPakai,
        timing: {
          repeat: {
            frequency: data.frekuensi || 3,
            period: 1,
            periodUnit: "d"
          }
        },
        route: {
          coding: [
            {
              system: "http://www.whocc.no/atc",
              code: data.rutePemberian || "O",
              display: "Oral"
            }
          ]
        },
        doseAndRate: [
          {
            type: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                  code: "ordered",
                  display: "Ordered"
                }
              ]
            },
            doseQuantity: {
              value: data.dosisAngka || 1,
              unit: data.dosisSatuan || "TAB",
              system: "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm",
              code: data.dosisSatuan || "TAB"
            }
          }
        ]
      }
    ],
    dispenseRequest: {
      dispenseInterval: {
        value: 1,
        unit: "days",
        system: "http://unitsofmeasure.org",
        code: "d"
      },
      validityPeriod: {
        start: authoredDate,
        end: new Date(new Date(authoredDate).getTime() + 30*24*60*60*1000).toISOString()
      },
      numberOfRepeatsAllowed: 0,
      quantity: {
        value: data.jumlah,
        unit: data.sediaan || "TAB",
        system: "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm",
        code: "TAB"
      },
      expectedSupplyDuration: {
        value: 30,
        unit: "days",
        system: "http://unitsofmeasure.org",
        code: "d"
      }
    }
  };
};

module.exports = { buildMedicationPayload, buildMedicationRequestPayload };

