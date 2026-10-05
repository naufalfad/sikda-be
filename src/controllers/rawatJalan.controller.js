const rawatJalanService = require('../services/rawatJalan.service');

const getAntrianDokter = async (req, res, next) => {
  try {
    const data = await rawatJalanService.getAntrianDokter(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRiwayatDokter = async (req, res, next) => {
  try {
    const data = await rawatJalanService.getRiwayatDokter(req.user, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRiwayatPasienByRM = async (req, res, next) => {
  try {
    const { noRM } = req.params;
    const data = await rawatJalanService.getRiwayatPasienByRM(noRM, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const mulaiPemeriksaan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const dokterId = req.user.id;
    const rekamMedis = await rawatJalanService.mulaiPemeriksaan(kunjunganId, dokterId);
    res.status(200).json({
      success: true,
      message: 'Pemeriksaan dimulai',
      data: rekamMedis,
    });
  } catch (error) {
    next(error);
  }
};

const simpanSOAP = async (req, res, next) => {
  try {
    const { rekamMedisId } = req.params;
    const data = await rawatJalanService.simpanSOAP(rekamMedisId, req.body);
    res.status(200).json({
      success: true,
      message: 'Data SOAP berhasil disimpan',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const simpanDiagnosa = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const { diagnosa } = req.body; // Array of { icd10Id, jenisDiagnosis, diagnosisKlinis }
    const data = await rawatJalanService.simpanDiagnosa(kunjunganId, req.user, diagnosa);
    res.status(200).json({
      success: true,
      message: 'Diagnosa berhasil disimpan',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const simpanTindakan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const { tindakan } = req.body; // Array of { icd9Id, pelaksana, catatan }
    const data = await rawatJalanService.simpanTindakan(kunjunganId, req.user, tindakan);
    res.status(200).json({
      success: true,
      message: 'Tindakan berhasil disimpan',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const selesaikanPemeriksaan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const result = await rawatJalanService.selesaikanPemeriksaan(kunjunganId, req.user);
    res.status(200).json({
      success: true,
      message: 'Pemeriksaan selesai',
      data: result.rekamMedis || result,
      satusehat: {
        syncStatus: result.satusehat_sync_status || 'PENDING',
        lastError: result.satusehat_last_error || null
      }
    });
  } catch (error) {
    next(error);
  }
};

const tundaPemeriksaan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.tundaPemeriksaan(kunjunganId);
    res.status(200).json({
      success: true,
      message: 'Pemeriksaan ditunda dan dikembalikan ke antrean',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getRekamMedis = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.getRekamMedisByKunjungan(kunjunganId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getDiagnosa = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.getDiagnosaByKunjungan(kunjunganId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getTindakan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.getTindakanByKunjungan(kunjunganId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const simpanResep = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const { resep } = req.body;
    const data = await rawatJalanService.simpanResep(kunjunganId, req.user, resep);
    res.status(200).json({ success: true, message: 'Resep berhasil dikirim ke Farmasi', data });
  } catch (error) {
    next(error);
  }
};

const simpanRujukan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const dokterId = req.user.id;
    const rujukan = req.body;
    const data = await rawatJalanService.simpanRujukan(kunjunganId, dokterId, rujukan);
    res.status(200).json({ success: true, message: 'Rujukan berhasil dibuat', data });
  } catch (error) {
    next(error);
  }
};

const simpanAlergi = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const { alergiArr } = req.body;
    const data = await rawatJalanService.simpanAlergi(kunjunganId, alergiArr, req.user);
    res.status(200).json({ success: true, message: 'Data alergi berhasil disimpan', data });
  } catch (error) {
    next(error);
  }
};

const getAlergi = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.getAlergiByKunjungan(kunjunganId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const pulang = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await rawatJalanService.pulang(kunjunganId);
    res.status(200).json({ success: true, message: 'Pasien diizinkan pulang', data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAntrianDokter,
  mulaiPemeriksaan,
  simpanSOAP,
  simpanDiagnosa,
  simpanTindakan,
  selesaikanPemeriksaan,
  tundaPemeriksaan,
  getRekamMedis,
  getDiagnosa,
  getTindakan,
  simpanResep,
  simpanRujukan,
  pulang,
  getRiwayatDokter,
  getRiwayatPasienByRM,
  simpanAlergi,
  getAlergi,
};
