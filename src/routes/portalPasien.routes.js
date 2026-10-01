const express = require('express');
const router = express.Router();
const portalPasienController = require('../controllers/portalPasien.controller');
const { protect, protectPasienOnline } = require('../middlewares/auth.middleware');

// Public / Guest Auth Routes
router.post('/request-otp', portalPasienController.requestOtp);
router.post('/verify-otp', portalPasienController.verifyOtpAndSetPin);
router.post('/login-pin', portalPasienController.loginWithPin);
router.post('/forgot-pin', portalPasienController.forgotPinRequestOtp);
router.post('/reset-pin', portalPasienController.resetPinWithOtp);

// Reference & Public Verification Routes
router.get('/master-data', portalPasienController.getMasterDataForBooking);
router.post('/check-pasien', portalPasienController.checkPasienFaskes);
router.get('/whatsapp-status', portalPasienController.getWhatsAppStatus);

// Protected Routes (Pasien Online Session)
router.get('/me', protectPasienOnline, portalPasienController.getProfile);
router.post('/keluarga', protectPasienOnline, portalPasienController.addKeluarga);
router.post('/booking', protectPasienOnline, portalPasienController.createBooking);

// Faskes / Loket / Kiosk Check-In Routes (Staff/Loket Protected)
router.get('/faskes-bookings', protect, portalPasienController.getFaskesBookings);
router.post('/check-in', protect, portalPasienController.checkInOnlineBooking);

module.exports = router;
