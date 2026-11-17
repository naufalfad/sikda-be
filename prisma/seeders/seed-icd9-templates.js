const prisma = require('../../src/config/prisma');

async function seedICD9Templates() {
  console.log('--- SEEDING INITIAL ICD-9 BUNDLE TEMPLATES ---');

  // 1. Ambil beberapa referensi Alkes
  const allAlkes = await prisma.asetRuangan.findMany();
  const minorSet = allAlkes.find(a => a.namaAset.toLowerCase().includes('minor') || a.namaAset.toLowerCase().includes('steril') || a.namaAset.toLowerCase().includes('tns'));
  const ekgAset = allAlkes.find(a => a.namaAset.toLowerCase().includes('ekg'));
  const dentalChair = allAlkes.find(a => a.namaAset.toLowerCase().includes('dental'));

  // 2. Ambil beberapa referensi BMHP
  const allObat = await prisma.masterObat.findMany();
  const findObat = (kw) => allObat.find(o => o.namaObat.toLowerCase().includes(kw.toLowerCase()) || (o.kodeObat && o.kodeObat.toLowerCase().includes(kw.toLowerCase())));

  const spuit3 = findObat('spuit 3cc') || findObat('spuit');
  const lidocaine = findObat('lidocaine') || findObat('pehacain') || findObat('anestesi');
  const kasa = findObat('kasa steril') || findObat('kasa');
  const alkoholSwab = findObat('alcohol') || findObat('alkohol');
  const jarumDental = findObat('jarum dental') || findObat('needle');
  const benang = findObat('benang') || findObat('silk') || findObat('catgut');
  const maskerNebul = findObat('nebulizer') || findObat('masker');
  const infusSet = findObat('infus') || findObat('iv');
  const abocath = findObat('abocath') || findObat('catheter');

  // Mappings
  const updates = [
    {
      kode: '86.59',
      tarif: 35000,
      alkes: minorSet ? [{
        asetId: minorSet.id,
        namaAset: minorSet.namaAset,
        kodeAset: minorSet.kodeAset,
        tarifPemakaian: Number(minorSet.tarifPemakaian) || 15000
      }] : [],
      bmhp: [
        spuit3 && { obatId: spuit3.id, namaItem: spuit3.namaObat, sediaan: spuit3.sediaan || 'Pcs', jumlah: 1, hargaSatuan: Number(spuit3.harga) || 3000 },
        lidocaine && { obatId: lidocaine.id, namaItem: lidocaine.namaObat, sediaan: lidocaine.sediaan || 'Ampul', jumlah: 1, hargaSatuan: Number(lidocaine.harga) || 5000 },
        benang && { obatId: benang.id, namaItem: benang.namaObat, sediaan: benang.sediaan || 'Pcs', jumlah: 1, hargaSatuan: Number(benang.harga) || 12000 },
        kasa && { obatId: kasa.id, namaItem: kasa.namaObat, sediaan: kasa.sediaan || 'Lembar', jumlah: 2, hargaSatuan: Number(kasa.harga) || 2000 }
      ].filter(Boolean)
    },
    {
      kode: '89.52',
      tarif: 30000,
      alkes: ekgAset ? [{
        asetId: ekgAset.id,
        namaAset: ekgAset.namaAset,
        kodeAset: ekgAset.kodeAset,
        tarifPemakaian: Number(ekgAset.tarifPemakaian) || 30000
      }] : [],
      bmhp: [
        kasa && { obatId: kasa.id, namaItem: kasa.namaObat, sediaan: kasa.sediaan || 'Lembar', jumlah: 1, hargaSatuan: Number(kasa.harga) || 2000 },
        alkoholSwab && { obatId: alkoholSwab.id, namaItem: alkoholSwab.namaObat, sediaan: alkoholSwab.sediaan || 'Sachet', jumlah: 2, hargaSatuan: Number(alkoholSwab.harga) || 1000 }
      ].filter(Boolean)
    },
    {
      kode: '93.94',
      tarif: 25000,
      alkes: [],
      bmhp: [
        maskerNebul && { obatId: maskerNebul.id, namaItem: maskerNebul.namaObat, sediaan: maskerNebul.sediaan || 'Set', jumlah: 1, hargaSatuan: Number(maskerNebul.harga) || 15000 }
      ].filter(Boolean)
    },
    {
      kode: '38.93',
      tarif: 25000,
      alkes: [],
      bmhp: [
        infusSet && { obatId: infusSet.id, namaItem: infusSet.namaObat, sediaan: infusSet.sediaan || 'Set', jumlah: 1, hargaSatuan: Number(infusSet.harga) || 10000 },
        abocath && { obatId: abocath.id, namaItem: abocath.namaObat, sediaan: abocath.sediaan || 'Pcs', jumlah: 1, hargaSatuan: Number(abocath.harga) || 8000 },
        alkoholSwab && { obatId: alkoholSwab.id, namaItem: alkoholSwab.namaObat, sediaan: alkoholSwab.sediaan || 'Sachet', jumlah: 2, hargaSatuan: Number(alkoholSwab.harga) || 1000 }
      ].filter(Boolean)
    },
    {
      kode: '23.09',
      tarif: 40000,
      alkes: dentalChair ? [{
        asetId: dentalChair.id,
        namaAset: dentalChair.namaAset,
        kodeAset: dentalChair.kodeAset,
        tarifPemakaian: Number(dentalChair.tarifPemakaian) || 25000
      }] : [],
      bmhp: [
        lidocaine && { obatId: lidocaine.id, namaItem: lidocaine.namaObat, sediaan: lidocaine.sediaan || 'Ampul', jumlah: 1, hargaSatuan: Number(lidocaine.harga) || 7500 },
        jarumDental && { obatId: jarumDental.id, namaItem: jarumDental.namaObat, sediaan: jarumDental.sediaan || 'Pcs', jumlah: 1, hargaSatuan: Number(jarumDental.harga) || 2000 },
        kasa && { obatId: kasa.id, namaItem: kasa.namaObat, sediaan: kasa.sediaan || 'Lembar', jumlah: 2, hargaSatuan: Number(kasa.harga) || 2000 }
      ].filter(Boolean)
    }
  ];

  for (const item of updates) {
    const existing = await prisma.masterICD9.findUnique({ where: { kode_icd9: item.kode } });
    if (existing) {
      await prisma.masterICD9.update({
        where: { kode_icd9: item.kode },
        data: {
          tarifTindakan: item.tarif,
          templateAlkes: item.alkes,
          templateBmhp: item.bmhp
        }
      });
      console.log(`Updated template for ICD-9 ${item.kode} (${existing.nama_prosedur}): ${item.bmhp.length} BMHP, ${item.alkes.length} Alkes`);
    }
  }

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

seedICD9Templates()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

