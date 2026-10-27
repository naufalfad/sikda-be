/**
 * Helper Logistik Stok Obat, Vaksin & BMHP Faskes
 * Mengimplementasikan pemotongan stok fisik multi-batch dengan prinsip Auto-FEFO
 * (First Expired, First Out) dalam transaksi atomic Prisma.
 */

const { catatMutasiStok } = require('./mutasiStok.helper');

/**
 * Mengurangi stok obat di faskes tertentu dengan metode FEFO
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {string} params.faskesId - ID Faskes pemilik stok
 * @param {string} params.obatId - ID MasterObat (Obat / BMHP)
 * @param {number} params.jumlah - Jumlah fisik yang digunakan/diresepkan
 * @param {string} [params.noBatch] - Nomor batch spesifik jika ditentukan
 * @param {string} [params.referensi] - Nomor Resep / No Registrasi / Kasir
 * @param {string} [params.keterangan] - Keterangan penggunaan
 * @param {string} [params.petugasId] - ID Petugas
 * @param {string} [params.petugasNama] - Nama Petugas
 * @returns {Promise<object>} Status hasil pemotongan stok
 */
const kurangiStokObatFaskes = async (tx, { 
  faskesId, 
  obatId, 
  jumlah, 
  noBatch = null, 
  referensi = null, 
  keterangan = null, 
  petugasId = null, 
  petugasNama = null 
}) => {
  if (!faskesId || !obatId || !jumlah || jumlah <= 0) {
    return { sukses: false, alasan: 'Parameter faskesId, obatId, dan jumlah wajib diisi' };
  }

  const qtyToDeduct = parseInt(jumlah, 10);
  if (isNaN(qtyToDeduct) || qtyToDeduct <= 0) {
    return { sukses: false, alasan: 'Jumlah tidak valid' };
  }

  // 1. Jika dokter / petugas menentukan nomor batch spesifik
  if (noBatch) {
    const specificBatch = await tx.stokObatFaskes.findUnique({
      where: {
        faskesId_obatId_noBatch: {
          faskesId,
          obatId,
          noBatch,
        },
      },
    });

    if (specificBatch && specificBatch.stok >= qtyToDeduct) {
      const updated = await tx.stokObatFaskes.update({
        where: { id: specificBatch.id },
        data: {
          stok: { decrement: qtyToDeduct },
        },
        include: { obat: true }
      });

      await catatMutasiStok(tx, {
        faskesId,
        kategoriItem: updated.obat?.kategori === 'BMHP' ? 'BMHP' : 'OBAT',
        obatId,
        namaItem: updated.obat?.namaObat || 'Item Logistik',
        sediaan: updated.obat?.sediaan,
        noBatch: updated.noBatch,
        tanggalExpired: updated.tanggalExpired,
        jenisMutasi: 'KELUAR',
        jumlahPerubahan: -qtyToDeduct,
        stokAwal: specificBatch.stok,
        stokAkhir: updated.stok,
        referensi: referensi || 'KASIR-RESEP',
        keterangan: keterangan || 'Pelayanan Kasir & Pengeluaran Obat/BMHP',
        petugasId,
        petugasNama
      });

      return { sukses: true, totalDipotong: qtyToDeduct, batchUsed: [updated] };
    }
  }

  // 2. Auto-FEFO: Ambil semua batch aktif untuk faskes dan obat ini, diurutkan tanggal expired terdekat
  const batches = await tx.stokObatFaskes.findMany({
    where: {
      faskesId,
      obatId,
      statusAktif: true,
      stok: { gt: 0 },
    },
    orderBy: {
      tanggalExpired: 'asc',
    },
  });

  if (!batches || batches.length === 0) {
    // Jika belum ada record batch dengan stok > 0, periksa apakah ada record default
    const anyBatch = await tx.stokObatFaskes.findFirst({
      where: { faskesId, obatId },
    });

    if (anyBatch) {
      const updated = await tx.stokObatFaskes.update({
        where: { id: anyBatch.id },
        data: {
          stok: { decrement: qtyToDeduct },
        },
      });
      return { sukses: true, totalDipotong: qtyToDeduct, batchUsed: [updated] };
    }

    // Buat entitas stok default jika belum pernah ada (agar pencatatan monitoring tetap terlacak)
    const newBatch = await tx.stokObatFaskes.create({
      data: {
        faskesId,
        obatId,
        stok: -qtyToDeduct,
        noBatch: noBatch || 'BATCH-AUTO',
        stokMinimum: 10,
        statusAktif: true,
      },
    });
    return { sukses: true, totalDipotong: qtyToDeduct, batchUsed: [newBatch] };
  }

  // Pengurangan bertahap per batch sesuai urutan FEFO
  let sisaDibutuhkan = qtyToDeduct;
  const updatedBatches = [];

  for (const batch of batches) {
    if (sisaDibutuhkan <= 0) break;
    const potong = Math.min(batch.stok, sisaDibutuhkan);
    const updated = await tx.stokObatFaskes.update({
      where: { id: batch.id },
      data: {
        stok: { decrement: potong },
      },
      include: { obat: true }
    });

    await catatMutasiStok(tx, {
      faskesId,
      kategoriItem: (batch.obat?.kategori || updated.obat?.kategori) === 'BMHP' ? 'BMHP' : 'OBAT',
      obatId,
      namaItem: batch.obat?.namaObat || updated.obat?.namaObat || 'Item Logistik',
      sediaan: batch.obat?.sediaan || updated.obat?.sediaan,
      noBatch: batch.noBatch,
      tanggalExpired: batch.tanggalExpired,
      jenisMutasi: 'KELUAR',
      jumlahPerubahan: -potong,
      stokAwal: batch.stok,
      stokAkhir: updated.stok,
      referensi: referensi || 'KASIR-RESEP',
      keterangan: keterangan || 'Pelayanan Kasir & Pengeluaran Obat/BMHP (FEFO)',
      petugasId,
      petugasNama
    });

    updatedBatches.push(updated);
    sisaDibutuhkan -= potong;
  }

  // Jika masih ada sisa yang belum terpotong dari batch yang ada (stok menipis), potong dari batch terakhir
  if (sisaDibutuhkan > 0 && batches.length > 0) {
    const lastBatch = batches[batches.length - 1];
    const updated = await tx.stokObatFaskes.update({
      where: { id: lastBatch.id },
      data: {
        stok: { decrement: sisaDibutuhkan },
      },
    });
    updatedBatches.push(updated);
  }

  return { sukses: true, totalDipotong: qtyToDeduct, batchUsed: updatedBatches };
};

module.exports = {
  kurangiStokObatFaskes,
};
