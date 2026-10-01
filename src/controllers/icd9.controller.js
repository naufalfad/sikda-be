const icd9Service = require('../services/icd9.service');

const searchICD9 = async (req, res) => {
  try {
    const { q } = req.query;
    const results = await icd9Service.searchICD9(q || '');
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getAllICD9 = async (req, res) => {
  try {
    const results = await icd9Service.getAllICD9();
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const createICD9 = async (req, res) => {
  try {
    const data = await icd9Service.createICD9(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateICD9 = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await icd9Service.updateICD9(id, req.body);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteICD9 = async (req, res) => {
  try {
    const { id } = req.params;
    await icd9Service.deleteICD9(id);
    res.status(200).json({ status: 'success', message: 'Berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  searchICD9,
  getAllICD9,
  createICD9,
  updateICD9,
  deleteICD9
};
