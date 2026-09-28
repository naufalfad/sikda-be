/**
 * FHIR R4 FamilyMemberHistory Mapper
 */
const buildFamilyMemberHistoryPayload = (data) => {
  const relMap = {
    'Orang Tua': { code: 'FTH', display: 'father' },
    'Ayah': { code: 'FTH', display: 'father' },
    'Ibu': { code: 'MTH', display: 'mother' },
    'Saudara': { code: 'SIB', display: 'sibling' },
    'Kakek/Nenek': { code: 'GRPRN', display: 'grandparent' },
    'Keluarga': { code: 'FAMMEMB', display: 'family member' }
  };

  const rel = relMap[data.hubungan] || { code: 'FAMMEMB', display: 'family member' };

  return {
    resourceType: "FamilyMemberHistory",
    status: "completed",
    patient: {
      reference: `Patient/${data.pasienIhs}`,
      display: data.pasienName
    },
    date: new Date().toISOString(),
    relationship: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: rel.code,
          display: rel.display
        }
      ]
    },
    condition: [
      {
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: data.kodeSnomed || "160303001",
              display: data.namaPenyakit || "Family history of medical condition"
            }
          ],
          text: data.namaPenyakit || "Family history of medical condition"
        }
      }
    ]
  };
};

module.exports = { buildFamilyMemberHistoryPayload };
