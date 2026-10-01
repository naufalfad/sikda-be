const dokterService = require('../services/dokter.service');

exports.getAllDokter = async (req, res) => {
  try {
    const dokters = await dokterService.getAllDokter(req.user, req.query.faskesId);
    // Exclude passwords
    const safeDokters = dokters.map((d) => {
      const { password, ...rest } = d;
      return rest;
    });
    res.json(safeDokters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data dokter', error: error.message });
  }
};

exports.createDokter = async (req, res) => {
  try {
    const newDokter = await dokterService.createDokter(req.body, req.user);
    const { password, ...safeDokter } = newDokter;
    res.status(201).json(safeDokter);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Gagal menambahkan dokter', error: error.message });
  }
};

exports.updateDokter = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDokter = await dokterService.updateDokter(id, req.body, req.user);
    const { password, ...safeDokter } = updatedDokter;
    res.json(safeDokter);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Gagal mengubah data dokter', error: error.message });
  }
};

exports.deleteDokter = async (req, res) => {
  try {
    const { id } = req.params;
    await dokterService.deleteDokter(id, req.user);
    res.json({ message: 'Dokter berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghapus dokter', error: error.message });
  }
};
