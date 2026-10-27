/*
  Warnings:

  - You are about to drop the column `stok` on the `MasterObat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[faskesId,vaksinId,noBatch]` on the table `BatchVaksin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[faskesId,kodePoli]` on the table `Poliklinik` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Kunjungan" DROP CONSTRAINT "Kunjungan_poliklinikId_fkey";

-- DropIndex
DROP INDEX "BatchVaksin_vaksinId_noBatch_key";

-- DropIndex
DROP INDEX "Poliklinik_kodePoli_key";

-- AlterTable
ALTER TABLE "AsetRuangan" ADD COLUMN     "faskesId" TEXT,
ADD COLUMN     "gambarUrl" TEXT;

-- AlterTable
ALTER TABLE "BatchVaksin" ADD COLUMN     "faskesId" TEXT,
ADD COLUMN     "stokMinimum" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "suhuPenyimpanan" TEXT DEFAULT '2-8°C';

-- AlterTable
ALTER TABLE "Kunjungan" ADD COLUMN     "faskesId" TEXT,
ADD COLUMN     "isAnonim" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kondisiTiba" TEXT,
ADD COLUMN     "namaAnonim" TEXT,
ADD COLUMN     "statusAdministrasi" TEXT DEFAULT 'LENGKAP',
ADD COLUMN     "triase" TEXT,
ADD COLUMN     "waktuMasukRawatInap" TIMESTAMP(3),
ALTER COLUMN "poliklinikId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MasterObat" DROP COLUMN "stok";

-- AlterTable
ALTER TABLE "MasterRuangan" ADD COLUMN     "faskesId" TEXT;

-- AlterTable
ALTER TABLE "Pasien" ADD COLUMN     "faskesId" TEXT;

-- AlterTable
ALTER TABLE "Poliklinik" ADD COLUMN     "faskesId" TEXT;

-- AlterTable
ALTER TABLE "ResepDetail" ADD COLUMN     "noBatch" TEXT;

-- AlterTable
ALTER TABLE "TempatTidur" ADD COLUMN     "gambarUrl" TEXT;

-- AlterTable
ALTER TABLE "TenagaMedis" ADD COLUMN     "faskesId" TEXT,
ADD COLUMN     "kuotaPasienHarian" INTEGER DEFAULT 40,
ADD COLUMN     "masaBerlakuSip" TIMESTAMP(3),
ADD COLUMN     "nomorSip" TEXT,
ADD COLUMN     "nomorStr" TEXT,
ADD COLUMN     "profesi" TEXT,
ADD COLUMN     "statusAktif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "statusKepegawaian" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "faskesId" TEXT;

-- CreateTable
CREATE TABLE "CatatanPerkembangan" (
    "id" TEXT NOT NULL,
    "kunjunganId" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "petugasId" TEXT NOT NULL,
    "profesi" TEXT NOT NULL DEFAULT 'DOKTER',
    "tanggalCatatan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjektif" TEXT,
    "objektif" TEXT,
    "tandaVital" JSONB,
    "asesmen" TEXT,
    "plan" TEXT,
    "instruksiMedis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatatanPerkembangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faskes" (
    "id" TEXT NOT NULL,
    "kodeFaskes" TEXT NOT NULL,
    "namaFaskes" TEXT NOT NULL,
    "jenisFaskes" TEXT NOT NULL,
    "kategoriWilayah" TEXT,
    "kecamatan" TEXT NOT NULL,
    "desaKelurahan" TEXT,
    "kabupatenKota" TEXT NOT NULL DEFAULT 'KABUPATEN',
    "provinsi" TEXT NOT NULL DEFAULT 'JAWA BARAT',
    "alamat" TEXT,
    "kodePos" TEXT,
    "titikGps" TEXT,
    "noTelepon" TEXT,
    "email" TEXT,
    "kepalaPuskesmas" TEXT,
    "nipKepala" TEXT,
    "targetKunjunganHarian" INTEGER DEFAULT 100,
    "jumlahPendudukWilayah" INTEGER,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "ihsOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faskes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokObatFaskes" (
    "id" TEXT NOT NULL,
    "faskesId" TEXT NOT NULL,
    "obatId" TEXT NOT NULL,
    "stok" INTEGER NOT NULL DEFAULT 0,
    "stokMinimum" INTEGER NOT NULL DEFAULT 10,
    "noBatch" TEXT NOT NULL DEFAULT 'DEFAULT',
    "tanggalExpired" TIMESTAMP(3),
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StokObatFaskes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutasiTenagaMedis" (
    "id" TEXT NOT NULL,
    "tenagaMedisId" TEXT NOT NULL,
    "faskesAsalId" TEXT,
    "faskesTujuanId" TEXT NOT NULL,
    "tanggalEfektif" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomorSk" TEXT,
    "jenisPenugasan" TEXT NOT NULL DEFAULT 'PERMANEN',
    "alasan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MutasiTenagaMedis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAgregatHarianDinkes" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "faskesId" TEXT NOT NULL,
    "totalKunjungan" INTEGER NOT NULL DEFAULT 0,
    "totalRawatJalan" INTEGER NOT NULL DEFAULT 0,
    "totalRawatInap" INTEGER NOT NULL DEFAULT 0,
    "totalIgd" INTEGER NOT NULL DEFAULT 0,
    "jumlahDokterHadir" INTEGER NOT NULL DEFAULT 0,
    "jumlahPerawatHadir" INTEGER NOT NULL DEFAULT 0,
    "rasioBebanPasienPerDokter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bedOccupancyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topDiagnosisKode" TEXT,
    "catatanKondisi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAgregatHarianDinkes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AkunPasienOnline" (
    "id" TEXT NOT NULL,
    "nomorWa" TEXT NOT NULL,
    "pinHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AkunPasienOnline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasienOnlineKeluarga" (
    "id" TEXT NOT NULL,
    "akunPasienId" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "tanggalLahir" TIMESTAMP(3) NOT NULL,
    "hubunganKeluarga" TEXT NOT NULL DEFAULT 'Diri Sendiri',
    "jenisKelamin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasienOnlineKeluarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAntreanOnline" (
    "id" TEXT NOT NULL,
    "akunPasienId" TEXT NOT NULL,
    "kodeBooking" TEXT NOT NULL,
    "faskesId" TEXT NOT NULL,
    "poliklinikId" TEXT NOT NULL,
    "dokterId" TEXT,
    "nik" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "tanggalLahir" TIMESTAMP(3) NOT NULL,
    "tanggalKunjungan" TIMESTAMP(3) NOT NULL,
    "keluhan" TEXT,
    "jenisPasien" TEXT NOT NULL DEFAULT 'BARU',
    "noRM" TEXT,
    "noAntrian" TEXT,
    "statusBooking" TEXT NOT NULL DEFAULT 'TERKONFIRMASI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAntreanOnline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faskes_kodeFaskes_key" ON "Faskes"("kodeFaskes");

-- CreateIndex
CREATE UNIQUE INDEX "Faskes_ihsOrganizationId_key" ON "Faskes"("ihsOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StokObatFaskes_faskesId_obatId_noBatch_key" ON "StokObatFaskes"("faskesId", "obatId", "noBatch");

-- CreateIndex
CREATE UNIQUE INDEX "LogAgregatHarianDinkes_tanggal_faskesId_key" ON "LogAgregatHarianDinkes"("tanggal", "faskesId");

-- CreateIndex
CREATE UNIQUE INDEX "AkunPasienOnline_nomorWa_key" ON "AkunPasienOnline"("nomorWa");

-- CreateIndex
CREATE UNIQUE INDEX "PasienOnlineKeluarga_akunPasienId_nik_key" ON "PasienOnlineKeluarga"("akunPasienId", "nik");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAntreanOnline_kodeBooking_key" ON "BookingAntreanOnline"("kodeBooking");

-- CreateIndex
CREATE UNIQUE INDEX "BatchVaksin_faskesId_vaksinId_noBatch_key" ON "BatchVaksin"("faskesId", "vaksinId", "noBatch");

-- CreateIndex
CREATE UNIQUE INDEX "Poliklinik_faskesId_kodePoli_key" ON "Poliklinik"("faskesId", "kodePoli");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasien" ADD CONSTRAINT "Pasien_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunjungan" ADD CONSTRAINT "Kunjungan_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunjungan" ADD CONSTRAINT "Kunjungan_poliklinikId_fkey" FOREIGN KEY ("poliklinikId") REFERENCES "Poliklinik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poliklinik" ADD CONSTRAINT "Poliklinik_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchVaksin" ADD CONSTRAINT "BatchVaksin_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenagaMedis" ADD CONSTRAINT "TenagaMedis_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanPerkembangan" ADD CONSTRAINT "CatatanPerkembangan_kunjunganId_fkey" FOREIGN KEY ("kunjunganId") REFERENCES "Kunjungan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanPerkembangan" ADD CONSTRAINT "CatatanPerkembangan_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanPerkembangan" ADD CONSTRAINT "CatatanPerkembangan_petugasId_fkey" FOREIGN KEY ("petugasId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRuangan" ADD CONSTRAINT "MasterRuangan_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsetRuangan" ADD CONSTRAINT "AsetRuangan_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokObatFaskes" ADD CONSTRAINT "StokObatFaskes_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokObatFaskes" ADD CONSTRAINT "StokObatFaskes_obatId_fkey" FOREIGN KEY ("obatId") REFERENCES "MasterObat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiTenagaMedis" ADD CONSTRAINT "MutasiTenagaMedis_tenagaMedisId_fkey" FOREIGN KEY ("tenagaMedisId") REFERENCES "TenagaMedis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiTenagaMedis" ADD CONSTRAINT "MutasiTenagaMedis_faskesAsalId_fkey" FOREIGN KEY ("faskesAsalId") REFERENCES "Faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiTenagaMedis" ADD CONSTRAINT "MutasiTenagaMedis_faskesTujuanId_fkey" FOREIGN KEY ("faskesTujuanId") REFERENCES "Faskes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAgregatHarianDinkes" ADD CONSTRAINT "LogAgregatHarianDinkes_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasienOnlineKeluarga" ADD CONSTRAINT "PasienOnlineKeluarga_akunPasienId_fkey" FOREIGN KEY ("akunPasienId") REFERENCES "AkunPasienOnline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAntreanOnline" ADD CONSTRAINT "BookingAntreanOnline_akunPasienId_fkey" FOREIGN KEY ("akunPasienId") REFERENCES "AkunPasienOnline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAntreanOnline" ADD CONSTRAINT "BookingAntreanOnline_faskesId_fkey" FOREIGN KEY ("faskesId") REFERENCES "Faskes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAntreanOnline" ADD CONSTRAINT "BookingAntreanOnline_poliklinikId_fkey" FOREIGN KEY ("poliklinikId") REFERENCES "Poliklinik"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAntreanOnline" ADD CONSTRAINT "BookingAntreanOnline_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
