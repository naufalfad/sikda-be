const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING MASTER BMHP & VAKSIN ---');

  // 1. Dapatkan Faskes
  const faskesList = await prisma.faskes.findMany();
  if (faskesList.length === 0) {
    console.error('Tidak ada faskes ditemukan!');
    return;
  }
  const faskesCibinong = faskesList.find(f => f.namaFaskes.includes('Cibinong')) || faskesList[0];
  const faskesSuka = faskesList.find(f => f.namaFaskes.includes('Sukamakmur')) || (faskesList[1] || faskesList[0]);

  // 2. Seed Master BMHP (Bahan Medis Habis Pakai)
  const masterBmhpData = [
    {
      kodeObat: 'BMHP-001',
      kfa_code: '9400101',
      namaObat: 'Spuit 1cc Tuberculin / BCG with Needle',
      kategori: 'BMHP',
      sediaan: 'Pcs',
      harga: 1500,
      gambarUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-002',
      kfa_code: '9400201',
      namaObat: 'Spuit 3cc Terumo with Needle 23G',
      kategori: 'BMHP',
      sediaan: 'Pcs',
      harga: 2000,
      gambarUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-003',
      kfa_code: '9400301',
      namaObat: 'Spuit 5cc Terumo with Needle 22G',
      kategori: 'BMHP',
      sediaan: 'Pcs',
      harga: 2500,
      gambarUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-004',
      kfa_code: '9400401',
      namaObat: 'Kasa Steril Hidrofil 16x16 cm',
      kategori: 'BMHP',
      sediaan: 'Kotak',
      harga: 12500,
      gambarUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-005',
      kfa_code: '9400501',
      namaObat: 'Infus Set Dewasa (Makro Dropper 20 drops/ml)',
      kategori: 'BMHP',
      sediaan: 'Set',
      harga: 9000,
      gambarUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-006',
      kfa_code: '9400601',
      namaObat: 'Abocath / IV Catheter No. 20G',
      kategori: 'BMHP',
      sediaan: 'Pcs',
      harga: 15000,
      gambarUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-007',
      kfa_code: '9400701',
      namaObat: 'Alcohol Swab 70% Isopropyl Alcohol',
      kategori: 'BMHP',
      sediaan: 'Box',
      harga: 17500,
      gambarUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80'
    },
    {
      kodeObat: 'BMHP-008',
      kfa_code: '9400801',
      namaObat: 'Handscoon Steril Latex Medical Gloves Size M',
      kategori: 'BMHP',
      sediaan: 'Pasang',
      harga: 6500,
      gambarUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=300&q=80'
    }
  ];

  for (const b of masterBmhpData) {
    const item = await prisma.masterObat.upsert({
      where: { kodeObat: b.kodeObat },
      update: {
        namaObat: b.namaObat,
        kategori: b.kategori,
        sediaan: b.sediaan,
        harga: b.harga,
        kfa_code: b.kfa_code,
        gambarUrl: b.gambarUrl
      },
      create: b
    });

    // Seed Stok di Cibinong Raya
    const isCriticalCibinong = b.kodeObat === 'BMHP-002' || b.kodeObat === 'BMHP-005'; // Spuit 3cc & Infus Set dibuat kritis
    const stokCibinong = isCriticalCibinong ? 8 : (b.kodeObat === 'BMHP-007' ? 45 : 120);
    const minCibinong = isCriticalCibinong ? 30 : 20;

    const batchBMHP = `BCH-BMHP-2026-${b.kodeObat.split('-')[1]}`;

    await prisma.stokObatFaskes.upsert({
      where: {
        faskesId_obatId_noBatch: {
          faskesId: faskesCibinong.id,
          obatId: item.id,
          noBatch: batchBMHP
        }
      },
      update: {
        stok: stokCibinong,
        stokMinimum: minCibinong,
        tanggalExpired: new Date('2028-06-30')
      },
      create: {
        faskesId: faskesCibinong.id,
        obatId: item.id,
        stok: stokCibinong,
        stokMinimum: minCibinong,
        noBatch: batchBMHP,
        tanggalExpired: new Date('2028-06-30')
      }
    });

    // Seed Stok di Sukamakmur
    const isCriticalSuka = b.kodeObat === 'BMHP-004'; // Kasa Steril dibuat kritis
    const stokSuka = isCriticalSuka ? 10 : 80;
    const minSuka = isCriticalSuka ? 25 : 15;

    await prisma.stokObatFaskes.upsert({
      where: {
        faskesId_obatId_noBatch: {
          faskesId: faskesSuka.id,
          obatId: item.id,
          noBatch: batchBMHP
        }
      },
      update: {
        stok: stokSuka,
        stokMinimum: minSuka,
        tanggalExpired: new Date('2028-06-30')
      },
      create: {
        faskesId: faskesSuka.id,
        obatId: item.id,
        stok: stokSuka,
        stokMinimum: minSuka,
        noBatch: batchBMHP,
        tanggalExpired: new Date('2028-06-30')
      }
    });
  }
  console.log(`✅ Berhasil seed ${masterBmhpData.length} Master BMHP dan stok faskes.`);

  // 3. Seed Master Vaksin (Program Imunisasi Kemenkes RI)
  const masterVaksinData = [
    {
      kodeKfa: '9300101',
      namaVaksin: 'Vaksin BCG Kering (Bio Farma)',
      targetPenyakit: 'Tuberkulosis (TBC)',
      statusAktif: true
    },
    {
      kodeKfa: '9300201',
      namaVaksin: 'Vaksin Hepatitis B Rekombinan (HB-0)',
      targetPenyakit: 'Hepatitis B Neonatal',
      statusAktif: true
    },
    {
      kodeKfa: '9300301',
      namaVaksin: 'Vaksin DPT-HB-Hib (Pentabio)',
      targetPenyakit: 'Difteri, Pertusis, Tetanus, Hepatitis B, Hib',
      statusAktif: true
    },
    {
      kodeKfa: '9300401',
      namaVaksin: 'Vaksin Polio Oral Bivalen (bOPV)',
      targetPenyakit: 'Poliomyelitis (Tipe 1 & 3)',
      statusAktif: true
    },
    {
      kodeKfa: '9300501',
      namaVaksin: 'Vaksin Campak Rubella (MR)',
      targetPenyakit: 'Campak (Morbili) & Rubella',
      statusAktif: true
    },
    {
      kodeKfa: '9300601',
      namaVaksin: 'Vaksin Pneumokokus Konyugasi (PCV 13)',
      targetPenyakit: 'Pneumonia & Meningitis Pneumokokus',
      statusAktif: true
    },
    {
      kodeKfa: '9300701',
      namaVaksin: 'Vaksin Rotavirus Oral (RV)',
      targetPenyakit: 'Diare Akut Berat Rotavirus',
      statusAktif: true
    }
  ];

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 hari (FEFO warning)
  const nextTwoMonths = new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000); // 75 hari (Waspada)
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 tahun (Aman)

  for (let i = 0; i < masterVaksinData.length; i++) {
    const v = masterVaksinData[i];
    const createdVaksin = await prisma.masterVaksin.upsert({
      where: { kodeKfa: v.kodeKfa },
      update: {
        namaVaksin: v.namaVaksin,
        targetPenyakit: v.targetPenyakit,
        statusAktif: v.statusAktif
      },
      create: v
    });

    // Seed Batch di Cibinong Raya
    // Vaksin Pentabio dan MR dibuat status FEFO mendekati ED & menipis untuk demo alert
    const isCritical = i === 2 || i === 4;
    const expDate = i === 4 ? nextMonth : (i === 2 ? nextTwoMonths : nextYear);
    const stokVaksin = isCritical ? 6 : (30 + i * 5);
    const minStok = isCritical ? 15 : 10;

    await prisma.batchVaksin.upsert({
      where: {
        faskesId_vaksinId_noBatch: {
          faskesId: faskesCibinong.id,
          vaksinId: createdVaksin.id,
          noBatch: `BIO-${createdVaksin.kodeKfa}-2026A`
        }
      },
      update: {
        tanggalExpired: expDate,
        stok: stokVaksin,
        stokMinimum: minStok,
        suhuPenyimpanan: '2-8°C',
        statusAktif: true
      },
      create: {
        faskesId: faskesCibinong.id,
        vaksinId: createdVaksin.id,
        noBatch: `BIO-${createdVaksin.kodeKfa}-2026A`,
        tanggalExpired: expDate,
        stok: stokVaksin,
        stokMinimum: minStok,
        suhuPenyimpanan: '2-8°C',
        statusAktif: true
      }
    });

    // Seed Batch di Sukamakmur
    await prisma.batchVaksin.upsert({
      where: {
        faskesId_vaksinId_noBatch: {
          faskesId: faskesSuka.id,
          vaksinId: createdVaksin.id,
          noBatch: `BIO-${createdVaksin.kodeKfa}-2026B`
        }
      },
      update: {
        tanggalExpired: nextYear,
        stok: 25 + i * 4,
        stokMinimum: 10,
        suhuPenyimpanan: '2-8°C',
        statusAktif: true
      },
      create: {
        faskesId: faskesSuka.id,
        vaksinId: createdVaksin.id,
        noBatch: `BIO-${createdVaksin.kodeKfa}-2026B`,
        tanggalExpired: nextYear,
        stok: 25 + i * 4,
        stokMinimum: 10,
        suhuPenyimpanan: '2-8°C',
        statusAktif: true
      }
    });
  }

  console.log(`✅ Berhasil seed ${masterVaksinData.length} Master Vaksin dan batch logistik cold-chain per faskes.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
