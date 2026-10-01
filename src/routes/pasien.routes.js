const express = require('express');
const pasienController = require('../controllers/pasien.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Semua API Master Pasien wajib login
router.use(protect);

router.post('/', pasienController.createPasien);
router.get('/search', pasienController.searchPasien);
router.get('/', pasienController.getAllPasien);
router.put('/:id', pasienController.updatePasien);
router.delete('/:id', pasienController.deletePasien);

module.exports = router;
