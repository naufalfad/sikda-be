const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const beds = await prisma.tempatTidur.findMany({
    include: {
      ruangan: true,
      kunjunganAktif: {
        include: { pasien: true }
      }
    }
  });

  console.log('=== TEMPAT TIDUR (Model TempatTidur) ===');
  console.log('Total Tempat Tidur:', beds.length);
  beds.forEach((b) => {
    console.log(
      `- ID: ${b.id} | Ruangan: ${b.ruangan.namaRuangan} (${b.ruangan.kategoriRuangan}) | Bed: ${b.nomorBed} | Status: ${b.statusBed} | Pasien: ${b.kunjunganAktif?.pasien?.namaLengkap || 'N/A'}`
    );
  });

  const asets = await prisma.asetRuangan.findMany({
    where: {
      OR: [
        { namaAset: { contains: 'Tidur', mode: 'insensitive' } },
        { namaAset: { contains: 'Bed', mode: 'insensitive' } },
        { kategoriAset: 'MEBELAIR' }
      ]
    },
    include: { ruangan: true }
  });

  console.log('\n=== ASET RUANGAN (Model AsetRuangan - Bed / Mebelair) ===');
  console.log('Total Aset Bed:', asets.length);
  asets.forEach((a) => {
    console.log(
      `- ID: ${a.id} | Kode: ${a.kodeAset} | Nama: ${a.namaAset} | Ruangan: ${a.ruangan?.namaRuangan} | Kondisi: ${a.kondisiAset} | Status Operasional: ${a.statusOperasional}`
    );
  });

  const activeRawatInap = await prisma.kunjungan.findMany({
    where: {
      jenisPelayanan: { in: ['RAWAT_INAP', 'UGD'] },
      statusPelayanan: { notIn: ['SELESAI', 'BATAL'] }
    },
    include: { pasien: true, poliklinik: true }
  });
  console.log('\n=== KUNJUNGAN AKTIF RAWAT INAP / UGD ===');
  console.log('Total Kunjungan Aktif:', activeRawatInap.length);
  activeRawatInap.forEach((k) => {
    console.log(
      `- ID: ${k.id} | No Antrean: ${k.nomorAntrean} | Pasien: ${k.pasien?.namaLengkap} | Jenis: ${k.jenisPelayanan} | Status: ${k.statusPelayanan}`
    );
  });
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
