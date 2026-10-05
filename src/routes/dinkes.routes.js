const express = require('express');
const router = express.Router();
const dinkesController = require('../controllers/dinkes.controller');
const dinkesAiController = require('../controllers/dinkesAi.controller');
const { protect } = require('../middlewares/auth.middleware');

// Optional protect middleware (aktifkan jika user wajib auth)
// router.use(protect);

// ==========================================
// 1. DASHBOARD & ANALITIK PENGAMBILAN KEPUTUSAN DINKES
// ==========================================
router.get('/summary', dinkesController.getExecutiveSummary);
router.get('/workload', dinkesController.getWorkloadAnalytics);
router.get('/beds', dinkesController.getBedMonitoring);
router.get('/assets', dinkesController.getCriticalAssetsMonitoring);
router.get('/medicines', dinkesController.getMedicineStockAlerts);
router.get('/vaccines', dinkesController.getVaccineMonitoring);
router.get('/surveillance', dinkesController.getDiseaseSurveillance);

// ==========================================
// 2. MANAJEMEN MASTER FASKES SE-KABUPATEN
// ==========================================
router.get('/faskes', dinkesController.getFaskesList);
router.get('/faskes/:id', dinkesController.getFaskesById);
router.post('/faskes', dinkesController.createFaskes);
router.put('/faskes/:id', dinkesController.updateFaskes);
router.delete('/faskes/:id', dinkesController.deleteFaskes);

// ==========================================
// 3. REDISTRIBUSI & MUTASI TENAGA MEDIS
// ==========================================
router.get('/mutasi-nakes', dinkesController.getMutasiHistory);
router.post('/mutasi-nakes', dinkesController.createMutasiNakes);

// ==========================================
// 4. AI AUTOMATED EXECUTIVE REPORT & BRIEFING
// ==========================================
router.get('/ai/report/faskes/:id', protect, dinkesAiController.getFaskesAiReport);
router.get('/ai/report/wilayah', protect, dinkesAiController.getWilayahAiSitRep);

module.exports = router;

