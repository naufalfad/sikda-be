/**
 * FHIR R4 Location Mapper for Rooms and Beds (SATUSEHAT POST /Location)
 */

const buildRoomLocationPayload = (ruangan, orgId) => {
  return {
    resourceType: 'Location',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/location/${orgId}`,
        value: ruangan.kodeRuangan
      }
    ],
    status: ruangan.statusAktif ? 'active' : 'suspended',
    name: ruangan.namaRuangan,
    description: ruangan.deskripsi || `${ruangan.namaRuangan} - ${ruangan.gedung || ''} ${ruangan.lantai || ''}`,
    mode: 'instance',
    physicalType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: ruangan.physicalType || 'ro',
          display: ruangan.physicalType === 'wa' ? 'Ward' : 'Room'
        }
      ]
    },
    ...(ruangan.partOfLocationId && {
      partOf: {
        reference: ruangan.partOfLocationId.startsWith('Location/')
          ? ruangan.partOfLocationId
          : `Location/${ruangan.partOfLocationId}`
      }
    }),
    managingOrganization: {
      reference: `Organization/${orgId}`
    }
  };
};

const buildBedLocationPayload = (bed, ruanganLocationIhsId, orgId) => {
  const statusOpMap = {
    'U': 'Unoccupied',
    'O': 'Occupied',
    'C': 'Closed',
    'H': 'Housekeeping'
  };

  const opCode = bed.operationalStatus || 'U';

  return {
    resourceType: 'Location',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/location/${orgId}`,
        value: `${bed.ruangan?.kodeRuangan || 'ROOM'}-${bed.nomorBed}`
      }
    ],
    status: bed.statusBed === 'PERBAIKAN' ? 'suspended' : 'active',
    operationalStatus: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0116',
      code: opCode,
      display: statusOpMap[opCode] || 'Unoccupied'
    },
    name: `Tempat Tidur ${bed.nomorBed}`,
    description: `${bed.nomorBed} di ${bed.ruangan?.namaRuangan || 'Ruang Rawat'} (${bed.kelasKamar})`,
    mode: 'instance',
    physicalType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'bd',
          display: 'Bed'
        }
      ]
    },
    ...(ruanganLocationIhsId && {
      partOf: {
        reference: ruanganLocationIhsId.startsWith('Location/')
          ? ruanganLocationIhsId
          : `Location/${ruanganLocationIhsId}`
      }
    }),
    managingOrganization: {
      reference: `Organization/${orgId}`
    }
  };
};

module.exports = {
  buildRoomLocationPayload,
  buildBedLocationPayload
};
