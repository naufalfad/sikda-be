const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const faskes = await prisma.faskes.findMany({
    include: {
      ruangans: {
        include: {
          tempatTidurs: true
        }
      }
    }
  });

  for (const f of faskes) {
    const totalBeds = f.ruangans.reduce((sum, r) => sum + r.tempatTidurs.length, 0);
    console.log(`- ${f.namaFaskes} (${f.kodeFaskes})`);
    console.log(`  Target Kunjungan Harian di tabel Faskes: ${f.targetKunjunganHarian}`);
    console.log(`  Total Ruangan: ${f.ruangans.length}`);
    console.log(`  Total Bed Fisik Real di tabel TempatTidur: ${totalBeds}`);
    f.ruangans.forEach(r => {
      if (r.tempatTidurs.length > 0) {
        console.log(`    * Ruangan ${r.namaRuangan}: ${r.tempatTidurs.length} bed`);
      }
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
