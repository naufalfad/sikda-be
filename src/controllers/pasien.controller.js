const pasienService = require('../services/pasien.service');

const createPasien = async (req, res, next) => {
  try {
    const data = req.body;
    if (req.user) {
      data.userPendaftarId = req.user.id;
      if (!data.faskesId && req.user.faskesId) {
        data.faskesId = req.user.faskesId;
      }
    }
    const newPasien = await pasienService.createPasien(data, req.user);
    res.status(201).json({
      success: true,
      message: 'Pasien berhasil didaftarkan',
      data: newPasien
    });
  } catch (error) {
    next(error);
  }
};

const getAllPasien = async (req, res, next) => {
  try {
    const data = await pasienService.getAllPasien(req.user, req.query.faskesId);
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

const searchPasien = async (req, res, next) => {
  try {
    const { query } = req.query;
    const data = await pasienService.searchPasien(query, req.user, req.query.faskesId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

const updatePasien = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await pasienService.updatePasien(id, data, req.user);
    res.status(200).json({
      success: true,
      message: 'Data pasien berhasil diperbarui',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

const deletePasien = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pasienService.deletePasien(id, req.user);
    res.status(200).json({
      success: true,
      message: 'Data pasien berhasil dihapus'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPasien,
  getAllPasien,
  searchPasien,
  updatePasien,
  deletePasien
};
