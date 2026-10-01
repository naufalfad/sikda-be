const laboratoriumService = require('../services/laboratorium.service');

const createOrder = async (req, res) => {
  try {
    const { kunjunganId, pasienId, catatanKlinis, tests } = req.body;
    // Asumsi user tersimpan di req.user dari middleware otentikasi
    const dokterId = req.user ? req.user.id : req.body.dokterId;

    if (!kunjunganId || !pasienId || !dokterId || !tests || tests.length === 0) {
      return res.status(400).json({ error: 'Data order laboratorium tidak lengkap' });
    }

    const orderLab = await laboratoriumService.createOrderLab({
      kunjunganId,
      pasienId,
      dokterId,
      catatanKlinis,
      tests
    });

    res.status(201).json(orderLab);
  } catch (error) {
    console.error('Error creating order lab:', error);
    if (error.message.includes('sudah ada')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Gagal membuat order laboratorium' });
  }
};

const getAntrian = async (req, res, next) => {
  try {
    const data = await laboratoriumService.getAntrianLab(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const simpanHasil = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { details } = req.body;
    
    if (!details || !Array.isArray(details)) {
      return res.status(400).json({ success: false, message: 'Data hasil tidak valid' });
    }

    const data = await laboratoriumService.simpanHasilLab(id, details);
    res.status(200).json({ success: true, message: 'Hasil lab berhasil disimpan', data });
  } catch (error) {
    next(error);
  }
};

const getOrderByKunjungan = async (req, res, next) => {
  try {
    const { kunjunganId } = req.params;
    const data = await laboratoriumService.getOrderByKunjungan(kunjunganId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getAntrian,
  simpanHasil,
  getOrderByKunjungan
};
