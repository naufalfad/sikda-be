const laporanService = require('../services/laporan.service');

// 1. Controller Laporan Kunjungan Pasien
const getLaporanKunjungan = async (req, res, next) => {
  try {
    const data = await laporanService.getLaporanKunjungan(req.user, req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat laporan kunjungan pasien',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 2. Controller Laporan Morbiditas & 10 Besar Diagnosis (LB1)
const getLaporanMorbiditas = async (req, res, next) => {
  try {
    const data = await laporanService.getLaporanMorbiditas(req.user, req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat laporan rekapitulasi diagnosis / morbiditas',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 3. Controller Laporan Penggunaan & Stok BMHP
const getLaporanBMHP = async (req, res, next) => {
  try {
    const data = await laporanService.getLaporanBMHP(req.user, req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat laporan penggunaan dan stok BMHP',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 4. Controller Laporan Penggunaan & Kondisi Alkes
const getLaporanAlkes = async (req, res, next) => {
  try {
    const data = await laporanService.getLaporanAlkes(req.user, req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat laporan pemakaian dan inventaris alat medis',
      data
    });
  } catch (error) {
    next(error);
  }
};

// 5. Controller Laporan Kinerja Tenaga Medis (Dokter & Perawat)
const getLaporanKinerjaNakes = async (req, res, next) => {
  try {
    const data = await laporanService.getLaporanKinerjaNakes(req.user, req.query);
    res.status(200).json({
      success: true,
      message: 'Berhasil memuat laporan kinerja tenaga medis (dokter dan perawat)',
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLaporanKunjungan,
  getLaporanMorbiditas,
  getLaporanBMHP,
  getLaporanAlkes,
  getLaporanKinerjaNakes
};

