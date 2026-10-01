'use strict';

const masterService = require('../services/master.service');
const cloudinary = require('../utils/cloudinary');

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'puskesmas/obat' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

// ==========================================
// 1. MASTER OBAT
// ==========================================

const getMasterObat = async (req, res, next) => {
  try {
    const { search } = req.query;
    const data = await masterService.getMasterObat(search);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createMasterObat = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (req.file) {
      payload.gambarUrl = await uploadToCloudinary(req.file.buffer);
    }
    const data = await masterService.createMasterObat(payload);
    res.status(201).json({ success: true, data, message: 'Obat berhasil ditambahkan' });
  } catch (error) {
    next(error);
  }
};

const updateMasterObat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    if (req.file) {
      payload.gambarUrl = await uploadToCloudinary(req.file.buffer);
    }
    const data = await masterService.updateMasterObat(id, payload);
    res.status(200).json({ success: true, data, message: 'Obat berhasil diubah' });
  } catch (error) {
    next(error);
  }
};

const deleteMasterObat = async (req, res, next) => {
  try {
    const { id } = req.params;
    await masterService.deleteMasterObat(id);
    res.status(200).json({ success: true, message: 'Obat berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. MASTER LABORATORIUM
// ==========================================

const getMasterLaboratorium = async (req, res, next) => {
  try {
    const { search } = req.query;
    const data = await masterService.getMasterLaboratorium(search);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createMasterLaboratorium = async (req, res, next) => {
  try {
    const data = await masterService.createMasterLaboratorium(req.body);
    res.status(201).json({ success: true, data, message: 'Master Lab berhasil ditambahkan' });
  } catch (error) {
    next(error);
  }
};

const updateMasterLaboratorium = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await masterService.updateMasterLaboratorium(id, req.body);
    res.status(200).json({ success: true, data, message: 'Master Lab berhasil diubah' });
  } catch (error) {
    next(error);
  }
};

const deleteMasterLaboratorium = async (req, res, next) => {
  try {
    const { id } = req.params;
    await masterService.deleteMasterLaboratorium(id);
    res.status(200).json({ success: true, message: 'Master Lab berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. MASTER MODALITY RADIOLOGI
// ==========================================

const getMasterModality = async (req, res, next) => {
  try {
    const data = await masterService.getMasterModality();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createMasterModality = async (req, res, next) => {
  try {
    const data = await masterService.createMasterModality(req.body);
    res.status(201).json({ success: true, data, message: 'Master Modality berhasil ditambahkan' });
  } catch (error) {
    next(error);
  }
};

const updateMasterModality = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await masterService.updateMasterModality(id, req.body);
    res.status(200).json({ success: true, data, message: 'Master Modality berhasil diubah' });
  } catch (error) {
    next(error);
  }
};

const deleteMasterModality = async (req, res, next) => {
  try {
    const { id } = req.params;
    await masterService.deleteMasterModality(id);
    res.status(200).json({ success: true, message: 'Master Modality berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. MASTER VAKSIN
// ==========================================

const getMasterVaksin = async (req, res, next) => {
  try {
    const data = await masterService.getMasterVaksin();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createMasterVaksin = async (req, res, next) => {
  try {
    const data = await masterService.createMasterVaksin(req.body);
    res.status(201).json({ success: true, data, message: 'Master Vaksin berhasil ditambahkan' });
  } catch (error) {
    next(error);
  }
};

const updateMasterVaksin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await masterService.updateMasterVaksin(id, req.body);
    res.status(200).json({ success: true, data, message: 'Master Vaksin berhasil diubah' });
  } catch (error) {
    next(error);
  }
};

const deleteMasterVaksin = async (req, res, next) => {
  try {
    const { id } = req.params;
    await masterService.deleteMasterVaksin(id);
    res.status(200).json({ success: true, message: 'Master Vaksin berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Obat
  getMasterObat,
  createMasterObat,
  updateMasterObat,
  deleteMasterObat,

  // Lab
  getMasterLaboratorium,
  createMasterLaboratorium,
  updateMasterLaboratorium,
  deleteMasterLaboratorium,

  // Modality
  getMasterModality,
  createMasterModality,
  updateMasterModality,
  deleteMasterModality,

  // Vaksin
  getMasterVaksin,
  createMasterVaksin,
  updateMasterVaksin,
  deleteMasterVaksin,
};

