const klinikService = require('../services/klinik.service');

const getPoliklinik = async (req, res, next) => {
  try {
    const poli = await klinikService.getAllPoliklinik(req.user, req.query.faskesId);
    res.json(poli);
  } catch (error) {
    next(error);
  }
};

const createPoliklinik = async (req, res, next) => {
  try {
    const faskesId = req.body.faskesId || req.user?.faskesId || null;
    const newPoli = await klinikService.createPoliklinik({ ...req.body, faskesId });
    res.status(201).json(newPoli);
  } catch (error) {
    next(error);
  }
};

const updatePoliklinik = async (req, res, next) => {
  try {
    const updatedPoli = await klinikService.updatePoliklinik(req.params.id, req.body);
    res.json(updatedPoli);
  } catch (error) {
    next(error);
  }
};

const getLayananByPoli = async (req, res, next) => {
  try {
    const layanan = await klinikService.getLayananByPoli(req.params.poliId);
    res.json(layanan);
  } catch (error) {
    next(error);
  }
};

const getDokterByPoli = async (req, res, next) => {
  try {
    const dokter = await klinikService.getDokterByPoli(req.params.poliId, req.user, req.query.faskesId);
    res.json(dokter);
  } catch (error) {
    next(error);
  }
};

const createLayanan = async (req, res, next) => {
  try {
    const newLayanan = await klinikService.createLayanan(req.body);
    res.status(201).json(newLayanan);
  } catch (error) {
    next(error);
  }
};

const updateLayanan = async (req, res, next) => {
  try {
    const updatedLayanan = await klinikService.updateLayanan(req.params.id, req.body);
    res.json(updatedLayanan);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPoliklinik,
  createPoliklinik,
  updatePoliklinik,
  getLayananByPoli,
  getDokterByPoli,
  createLayanan,
  updateLayanan
};
