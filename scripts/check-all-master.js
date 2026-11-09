const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const alergiCount = await prisma.masterAlergi.count();
  const vaksinCount = await prisma.masterVaksin.count();
  const batchVaksinCount = await prisma.batchVaksin.count();
  const labCount = await prisma.masterLaboratorium.count();
  const modalityCount = await prisma.masterModality.count();
  const icd10Count = await prisma.masterICD10.count();
  const icd9Count = await prisma.masterICD9.count();
  const obatCount = await prisma.masterObat.count();
  const ruanganCount = await prisma.masterRuangan.count();
  const asetRuanganCount = await prisma.asetRuangan.count();
  const bedCount = await prisma.tempatTidur.count();

  console.log('=== MASTER DATA STATUS ===');
  console.log({
    MasterAlergi: alergiCount,
    MasterVaksin: vaksinCount,
    BatchVaksin: batchVaksinCount,
    MasterLaboratorium: labCount,
    MasterModality: modalityCount,
    MasterICD10: icd10Count,
    MasterICD9: icd9Count,
    MasterObat: obatCount,
    MasterRuangan: ruanganCount,
    AsetRuangan: asetRuanganCount,
    TempatTidur: bedCount
  });

  const alergiItems = await prisma.masterAlergi.findMany({ select: { kode_snomed: true, nama_alergi: true, kategori: true } });
  console.log(`Current Alergi (${alergiItems.length}):`, alergiItems.map(a => `${a.nama_alergi} [${a.kategori}]`));

  const labItems = await prisma.masterLaboratorium.findMany({ select: { kategori: true, parameter: true, satuan: true, nilaiRujukan: true, hargaTarif: true } });
  console.log(`Current Lab (${labItems.length}):`, labItems.slice(0, 10));

  const modalityItems = await prisma.masterModality.findMany();
  console.log(`Current Modality (${modalityItems.length}):`, modalityItems);
}

main().catch(console.error).finally(() => prisma.$disconnect());
