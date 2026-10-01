const prisma = require('../config/prisma');

const icd10Controller = {
  // GET /api/icd10/search?q=query
  async searchICD10(req, res) {
    try {
      const { q } = req.query;
      
      let whereClause = {};
      
      if (q && q.trim()) {
        whereClause = {
          OR: [
            { kode_icd10: { contains: q.trim(), mode: 'insensitive' } },
            { nama_diagnosis: { contains: q.trim(), mode: 'insensitive' } }
          ]
        };
      }

      const results = await prisma.masterICD10.findMany({
        where: whereClause,
        take: q && q.trim() ? 50 : 250, // Jika kosong tampilkan seluruh master ICD-10
        orderBy: { kode_icd10: 'asc' }
      });

      res.status(200).json({
        status: 'success',
        data: results
      });
    } catch (error) {
      console.error('Error searching ICD-10:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal mencari data ICD-10'
      });
    }
  },

  // POST /api/diagnosis
  async saveDiagnosis(req, res) {
    try {
      const { pasienId, kunjunganId, icd10Id, jenisDiagnosis, diagnosisKlinis, statusDiagnosis, tingkatKepastian, kondisiMasuk, dokterId } = req.body;

      // Validasi sederhana
      if (!pasienId || !kunjunganId || !icd10Id || !jenisDiagnosis) {
        return res.status(400).json({
          status: 'error',
          message: 'Data wajib tidak lengkap'
        });
      }

      const diagnosis = await prisma.diagnosisPasien.create({
        data: {
          pasienId,
          kunjunganId,
          icd10Id,
          jenisDiagnosis,
          diagnosisKlinis,
          statusDiagnosis: statusDiagnosis || 'Suspek',
          tingkatKepastian,
          kondisiMasuk,
          dokterId
        },
        include: {
          icd10: true
        }
      });

      res.status(201).json({
        status: 'success',
        data: diagnosis
      });
    } catch (error) {
      console.error('Error saving diagnosis:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal menyimpan diagnosis'
      });
    }
  },

  // GET /api/diagnosis/pasien/:pasienId
  async getDiagnosisByPasien(req, res) {
    try {
      const { pasienId } = req.params;

      const riwayat = await prisma.diagnosisPasien.findMany({
        where: { pasienId },
        include: {
          icd10: true,
          dokter: {
            select: {
              username: true,
              role: true
            }
          }
        },
        orderBy: { tanggalDiagnosis: 'desc' }
      });

      res.status(200).json({
        status: 'success',
        data: riwayat
      });
    } catch (error) {
      console.error('Error fetching diagnosis:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal mengambil riwayat diagnosis'
      });
    }
  },
  
  // DELETE /api/diagnosis/:id
  async deleteDiagnosis(req, res) {
    try {
      const { id } = req.params;
      await prisma.diagnosisPasien.delete({
        where: { id }
      });
      res.status(200).json({
        status: 'success',
        message: 'Diagnosis berhasil dihapus'
      });
    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal menghapus diagnosis'
      });
    }
  },

  // POST /api/icd10/master
  async createICD10(req, res) {
    try {
      const data = await prisma.masterICD10.create({
        data: req.body
      });
      res.status(201).json({ status: 'success', data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Gagal membuat ICD-10' });
    }
  },

  // PUT /api/icd10/master/:id
  async updateICD10(req, res) {
    try {
      const { id } = req.params;
      const data = await prisma.masterICD10.update({
        where: { id_icd10: id },
        data: req.body
      });
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Gagal mengupdate ICD-10' });
    }
  },

  // DELETE /api/icd10/master/:id
  async deleteICD10(req, res) {
    try {
      const { id } = req.params;
      await prisma.masterICD10.delete({
        where: { id_icd10: id }
      });
      res.status(200).json({ status: 'success', message: 'Berhasil dihapus' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Gagal menghapus ICD-10' });
    }
  }
};
module.exports = icd10Controller;
