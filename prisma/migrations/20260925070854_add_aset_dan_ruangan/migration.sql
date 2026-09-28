-- AlterTable
ALTER TABLE "Kunjungan" ADD COLUMN     "statusPulang" TEXT,
ADD COLUMN     "waktuPemeriksaanMulai" TIMESTAMP(3),
ADD COLUMN     "waktuPemeriksaanSelesai" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MasterRuangan" (
    "id" TEXT NOT NULL,
    "kodeRuangan" TEXT NOT NULL,
    "namaRuangan" TEXT NOT NULL,
    "lantai" TEXT,
    "gedung" TEXT,
    "kategoriRuangan" TEXT NOT NULL,
    "deskripsi" TEXT,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "poliklinikId" TEXT,
    "penanggungJawabId" TEXT,
    "ihsLocationId" TEXT,
    "physicalType" TEXT NOT NULL DEFAULT 'ro',
    "partOfLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRuangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempatTidur" (
    "id" TEXT NOT NULL,
    "ruanganId" TEXT NOT NULL,
    "nomorBed" TEXT NOT NULL,
    "kelasKamar" TEXT NOT NULL DEFAULT 'NON_KELAS_IGD',
    "statusBed" TEXT NOT NULL DEFAULT 'TERSEDIA',
    "kunjunganAktifId" TEXT,
    "ihsLocationId" TEXT,
    "operationalStatus" TEXT DEFAULT 'U',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempatTidur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsetRuangan" (
    "id" TEXT NOT NULL,
    "kodeAset" TEXT NOT NULL,
    "namaAset" TEXT NOT NULL,
    "ruanganId" TEXT NOT NULL,
    "kategoriAset" TEXT NOT NULL,
    "merk" TEXT,
    "tipeModel" TEXT,
    "nomorSeri" TEXT,
    "tahunPerolehan" INTEGER,
    "sumberAnggaran" TEXT,
    "hargaPerolehan" DOUBLE PRECISION DEFAULT 0,
    "kondisiAset" TEXT NOT NULL DEFAULT 'BAIK',
    "statusOperasional" TEXT NOT NULL DEFAULT 'AKTIF_DIGUNAKAN',
    "ihsDeviceId" TEXT,
    "kodeAspak" TEXT,
    "kodeSnomed" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsetRuangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatPemeliharaanAset" (
    "id" TEXT NOT NULL,
    "asetId" TEXT NOT NULL,
    "jenisKegiatan" TEXT NOT NULL,
    "tanggalJadwal" TIMESTAMP(3) NOT NULL,
    "tanggalPelaksanaan" TIMESTAMP(3),
    "tanggalKalibrasiExpired" TIMESTAMP(3),
    "pelaksanaVendor" TEXT,
    "biayaPemeliharaan" DOUBLE PRECISION DEFAULT 0,
    "nomorSertifikatKalibrasi" TEXT,
    "hasilKegiatan" TEXT,
    "catatan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TERJADWAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiwayatPemeliharaanAset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatMutasiAset" (
    "id" TEXT NOT NULL,
    "asetId" TEXT NOT NULL,
    "ruanganAsalId" TEXT NOT NULL,
    "ruanganTujuanId" TEXT NOT NULL,
    "tanggalMutasi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alasanMutasi" TEXT,
    "petugasAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiwayatMutasiAset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterRuangan_kodeRuangan_key" ON "MasterRuangan"("kodeRuangan");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRuangan_ihsLocationId_key" ON "MasterRuangan"("ihsLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "TempatTidur_ihsLocationId_key" ON "TempatTidur"("ihsLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "TempatTidur_ruanganId_nomorBed_key" ON "TempatTidur"("ruanganId", "nomorBed");

-- CreateIndex
CREATE UNIQUE INDEX "AsetRuangan_kodeAset_key" ON "AsetRuangan"("kodeAset");

-- CreateIndex
CREATE UNIQUE INDEX "AsetRuangan_ihsDeviceId_key" ON "AsetRuangan"("ihsDeviceId");

-- AddForeignKey
ALTER TABLE "MasterRuangan" ADD CONSTRAINT "MasterRuangan_poliklinikId_fkey" FOREIGN KEY ("poliklinikId") REFERENCES "Poliklinik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRuangan" ADD CONSTRAINT "MasterRuangan_penanggungJawabId_fkey" FOREIGN KEY ("penanggungJawabId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempatTidur" ADD CONSTRAINT "TempatTidur_ruanganId_fkey" FOREIGN KEY ("ruanganId") REFERENCES "MasterRuangan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempatTidur" ADD CONSTRAINT "TempatTidur_kunjunganAktifId_fkey" FOREIGN KEY ("kunjunganAktifId") REFERENCES "Kunjungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsetRuangan" ADD CONSTRAINT "AsetRuangan_ruanganId_fkey" FOREIGN KEY ("ruanganId") REFERENCES "MasterRuangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatPemeliharaanAset" ADD CONSTRAINT "RiwayatPemeliharaanAset_asetId_fkey" FOREIGN KEY ("asetId") REFERENCES "AsetRuangan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatMutasiAset" ADD CONSTRAINT "RiwayatMutasiAset_asetId_fkey" FOREIGN KEY ("asetId") REFERENCES "AsetRuangan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatMutasiAset" ADD CONSTRAINT "RiwayatMutasiAset_ruanganAsalId_fkey" FOREIGN KEY ("ruanganAsalId") REFERENCES "MasterRuangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatMutasiAset" ADD CONSTRAINT "RiwayatMutasiAset_ruanganTujuanId_fkey" FOREIGN KEY ("ruanganTujuanId") REFERENCES "MasterRuangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatMutasiAset" ADD CONSTRAINT "RiwayatMutasiAset_petugasAdminId_fkey" FOREIGN KEY ("petugasAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
