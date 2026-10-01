const express = require('express');
const router = express.Router();
const laboratoriumController = require('../controllers/laboratorium.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/order', laboratoriumController.createOrder);
router.get('/antrian', laboratoriumController.getAntrian);
router.get('/order/kunjungan/:kunjunganId', laboratoriumController.getOrderByKunjungan);
router.put('/order/:id/hasil', laboratoriumController.simpanHasil);

module.exports = router;
