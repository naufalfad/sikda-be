const buildConditionPayload = (data) => {
  // Category resolution (chief-complaint, problem-list-item, previous-condition, or encounter-diagnosis)
  let categorySystem = "http://terminology.hl7.org/CodeSystem/condition-category";
  let categoryCode = "encounter-diagnosis";
  let categoryDisplay = "Encounter Diagnosis";

  if (data.category === "chief-complaint") {
    categorySystem = "http://terminology.kemkes.go.id";
    categoryCode = "chief-complaint";
    categoryDisplay = "Chief Complaint";
  } else if (data.category === "problem-list-item") {
    categorySystem = "http://terminology.hl7.org/CodeSystem/condition-category";
    categoryCode = "problem-list-item";
    categoryDisplay = "Problem List Item";
  } else if (data.category === "previous-condition") {
    categorySystem = "http://terminology.kemkes.go.id";
    categoryCode = "previous-condition";
    categoryDisplay = "Previous Condition";
  }

  // Map status lokal (verificationStatus) ke FHIR
  let verCode = "provisional"; // Default
  let verDisplay = "Provisional";
  const ver = data.statusDiagnosis ? data.statusDiagnosis.toLowerCase() : "";

  if (ver === "definitif" || ver === "confirmed") {
    verCode = "confirmed";
    verDisplay = "Confirmed";
  } else if (ver === "menyingkirkan" || ver === "rule out") {
    verCode = "refuted";
    verDisplay = "Refuted";
  } else if (ver === "kerja" || ver === "differential") {
    verCode = "differential";
    verDisplay = "Differential";
  }

  // Map status klinis (clinicalStatus) ke FHIR
  let clinCode = data.clinicalStatus || "active"; // Default
  let clinDisplay = clinCode === "inactive" ? "Inactive" : (clinCode === "resolved" ? "Resolved" : "Active");
  const clin = data.statusKlinis ? data.statusKlinis.toLowerCase() : "";

  if (clin === "sembuh" || clin === "resolved") {
    clinCode = "resolved";
    clinDisplay = "Resolved";
  } else if (clin === "kambuh" || clin === "relapse") {
    clinCode = "relapse";
    clinDisplay = "Relapse";
  } else if (clin === "remisi" || clin === "remission") {
    clinCode = "remission";
    clinDisplay = "Remission";
  }

  // Code System: SNOMED-CT atau ICD-10
  const codeSystem = data.snomedCode ? "http://snomed.info/sct" : (data.codeSystem || "http://hl7.org/fhir/sid/icd-10");
  const codeVal = data.snomedCode || data.kodeIcd10 || data.code;
  const displayVal = data.snomedDisplay || data.namaDiagnosis || data.display;

  return {
    resourceType: "Condition",
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: clinCode,
          display: clinDisplay
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: verCode,
          display: verDisplay
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: categorySystem,
            code: categoryCode,
            display: categoryDisplay
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: codeSystem,
          code: codeVal,
          display: displayVal
        }
      ]
    },
    subject: {
      reference: `Patient/${data.pasienIhs}`,
      display: data.pasienName
    },
    encounter: {
      reference: `Encounter/${data.encounterId}`
    },
    ...(data.dokterIhs && data.dokterIhs !== 'undefined' && {
      recorder: {
        reference: `Practitioner/${data.dokterIhs}`,
        ...(data.dokterName && { display: data.dokterName })
      }
    })
  };
};

module.exports = { buildConditionPayload };
