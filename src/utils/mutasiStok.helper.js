const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mencatat log mutasi pergerakan stok keluar/masuk obat, vaksin, atau BMHP
 * @param {object} tx - Prisma client atau transaction client
 * @param {object} params
 * @returns {Promise<object>}
 */
const catatMutasiStok = async (tx, params) => {
  const client = tx || prisma;
  try {
    const {
      faskesId,
      kategoriItem = 'OBAT',
      obatId = null,
      vaksinId = null,
      namaItem,
      sediaan = null,
      noBatch = 'DEFAULT',
      tanggalExpired = null,
      jenisMutasi, // 'MASUK', 'KELUAR', 'PENYESUAIAN', 'OPNAME'
      jumlahPerubahan, // angka (+ atau -)
      stokAwal = 0,
      stokAkhir = 0,
      referensi = null,
      keterangan = null,
      petugasId = null,
      petugasNama = null
    } = params;

    if (!faskesId || !namaItem || !jenisMutasi || jumlahPerubahan === undefined) {
      console.warn('Parameter wajib mutasi stok tidak lengkap:', params);
      return null;
    }

    const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const parsedExp = tanggalExpired ? new Date(tanggalExpired) : null;
    const parsedJumlah = parseInt(jumlahPerubahan, 10);
    const parsedAwal = parseInt(stokAwal, 10) || 0;
    const parsedAkhir = parseInt(stokAkhir, 10) || 0;

    if (client.mutasiStokLogistik && typeof client.mutasiStokLogistik.create === 'function') {
      return await client.mutasiStokLogistik.create({
        data: {
          id,
          faskesId,
          kategoriItem,
          obatId,
          vaksinId,
          namaItem,
          sediaan,
          noBatch: noBatch || 'DEFAULT',
          tanggalExpired: parsedExp,
          jenisMutasi,
          jumlahPerubahan: parsedJumlah,
          stokAwal: parsedAwal,
          stokAkhir: parsedAkhir,
          referensi,
          keterangan,
          petugasId,
          petugasNama
        }
      });
    }

    // Native PostgreSQL parameterized query
    await client.$executeRaw`
      INSERT INTO "MutasiStokLogistik" (
        "id", "faskesId", "kategoriItem", "obatId", "vaksinId",
        "namaItem", "sediaan", "noBatch", "tanggalExpired", "jenisMutasi",
        "jumlahPerubahan", "stokAwal", "stokAkhir", "referensi", "keterangan",
        "petugasId", "petugasNama", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${faskesId}, ${kategoriItem}, ${obatId}, ${vaksinId},
        ${namaItem}, ${sediaan}, ${noBatch || 'DEFAULT'}, ${parsedExp}, ${jenisMutasi},
        ${parsedJumlah}, ${parsedAwal}, ${parsedAkhir}, ${referensi}, ${keterangan},
        ${petugasId}, ${petugasNama}, NOW(), NOW()
      )
    `;

    return { id, faskesId, namaItem, jenisMutasi, jumlahPerubahan: parsedJumlah };
  } catch (error) {
    console.error('Gagal mencatat mutasi stok logistik:', error);
    // Kita tidak throw error agar transaksi utama tetap jalan bila log gagal
    return null;
  }
};

module.exports = {
  catatMutasiStok
};
