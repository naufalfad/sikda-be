/**
 * FHIR R4 Device Mapper for Medical Equipment (SATUSEHAT POST /Device)
 */
const buildDevicePayload = (aset, orgId, locationIhsId) => {
  const snomedCode = aset.kodeSnomed || '466093004'; // Default medical device finding
  const snomedDisplay = aset.namaAset || 'Medical device';

  return {
    resourceType: 'Device',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/device/${orgId}`,
        value: aset.kodeAset
      },
      ...(aset.nomorSeri ? [{
        system: 'http://hl7.org/fhir/sid/sn',
        value: aset.nomorSeri
      }] : [])
    ],
    status: aset.statusOperasional === 'AKTIF_DIGUNAKAN' ? 'active' : 'inactive',
    manufacturer: aset.merk || undefined,
    modelNumber: aset.tipeModel || undefined,
    serialNumber: aset.nomorSeri || undefined,
    type: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: snomedCode,
          display: snomedDisplay
        },
        ...(aset.kodeAspak ? [{
          system: 'http://terminology.kemkes.go.id/CodeSystem/aspak',
          code: aset.kodeAspak,
          display: aset.namaAset
        }] : [])
      ],
      text: aset.namaAset
    },
    ...(locationIhsId && {
      location: {
        reference: locationIhsId.startsWith('Location/') ? locationIhsId : `Location/${locationIhsId}`,
        display: aset.ruangan?.namaRuangan || 'Ruangan Faskes'
      }
    }),
    owner: {
      reference: `Organization/${orgId}`
    },
    note: aset.catatan ? [
      {
        text: aset.catatan
      }
    ] : undefined
  };
};

module.exports = { buildDevicePayload };
