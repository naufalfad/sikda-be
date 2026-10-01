const portalPasienService = require('../services/portalPasien.service');
const whatsappService = require('../services/whatsapp.service');
const { getEffectiveFaskesId } = require('../utils/tenantScope');

const requestOtp = async (req, res, next) => {
  try {
    const { nomorWa } = req.body;
    const result = await portalPasienService.requestOtp(nomorWa);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const verifyOtpAndSetPin = async (req, res, next) => {
  try {
    const { nomorWa, otpCode, pin } = req.body;
    const result = await portalPasienService.verifyOtpAndSetPin(nomorWa, otpCode, pin);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const loginWithPin = async (req, res, next) => {
  try {
    const { nomorWa, pin } = req.body;
    const result = await portalPasienService.loginWithPin(nomorWa, pin);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const forgotPinRequestOtp = async (req, res, next) => {
  try {
    const { nomorWa } = req.body;
    const result = await portalPasienService.forgotPinRequestOtp(nomorWa);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const resetPinWithOtp = async (req, res, next) => {
  try {
    const { nomorWa, otpCode, newPin } = req.body;
    const result = await portalPasienService.resetPinWithOtp(nomorWa, otpCode, newPin);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const data = await portalPasienService.getAccountProfile(req.user.id);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const addKeluarga = async (req, res, next) => {
  try {
    const result = await portalPasienService.addKeluarga(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Anggota keluarga berhasil ditambahkan',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const checkPasienFaskes = async (req, res, next) => {
  try {
    const { nik, faskesId } = req.body;
    const result = await portalPasienService.checkPasienFaskes(nik, faskesId);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const createBooking = async (req, res, next) => {
  try {
    const result = await portalPasienService.createBooking(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Pendaftaran antrean online berhasil dibuat!',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMasterDataForBooking = async (req, res, next) => {
  try {
    const { faskesId, poliklinikId } = req.query;
    const result = await portalPasienService.getMasterDataForBooking(faskesId, poliklinikId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getWhatsAppStatus = (req, res) => {
  res.status(200).json({
    success: true,
    data: whatsappService.getStatus()
  });
};

const getFaskesBookings = async (req, res, next) => {
  try {
    const faskesId = getEffectiveFaskesId(req.user, req.query.faskesId);
    const { tanggal, search, status } = req.query;

    const data = await portalPasienService.getFaskesOnlineBookings(faskesId, {
      tanggal,
      search,
      status
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const checkInOnlineBooking = async (req, res, next) => {
  try {
    const { bookingId, kodeBooking } = req.body;
    const identifier = bookingId || kodeBooking;
    const petugasId = req.user?.id || null;

    const result = await portalPasienService.checkInOnlineBooking(identifier, petugasId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtpAndSetPin,
  loginWithPin,
  forgotPinRequestOtp,
  resetPinWithOtp,
  getProfile,
  addKeluarga,
  checkPasienFaskes,
  createBooking,
  getMasterDataForBooking,
  getWhatsAppStatus,
  getFaskesBookings,
  checkInOnlineBooking
};
