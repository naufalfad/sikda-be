'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================
// 1. DATA MASTER ALERGI (STANDAR SNOMED CT & KFA KEMENKES)
// ==============================================================
const dataAlergi = [
  // --- KATEGORI: MAKANAN (FOOD) ---
  { kode_snomed: '91935009', nama_alergi: 'Alergi Kacang Tanah (Peanut)', kategori: 'food' },
  { kode_snomed: '417532002', nama_alergi: 'Alergi Makanan Laut (Seafood)', kategori: 'food' },
  { kode_snomed: '227037002', nama_alergi: 'Alergi Udang (Shrimp)', kategori: 'food' },
  { kode_snomed: '227038007', nama_alergi: 'Alergi Kepiting (Crab)', kategori: 'food' },
  { kode_snomed: '91930004', nama_alergi: 'Alergi Telur Ayam (Egg)', kategori: 'food' },
  { kode_snomed: '425525006', nama_alergi: 'Alergi Susu Sapi (Cow\'s Milk)', kategori: 'food' },
  { kode_snomed: '256330007', nama_alergi: 'Alergi Gandum / Gluten (Wheat)', kategori: 'food' },
  { kode_snomed: '227412005', nama_alergi: 'Alergi Kedelai / Produk Kedelai (Soy)', kategori: 'food' },
  { kode_snomed: '227035005', nama_alergi: 'Alergi Ikan Laut (Fish)', kategori: 'food' },
  { kode_snomed: '226760005', nama_alergi: 'Alergi Cokelat / Kakao', kategori: 'food' },
  { kode_snomed: '91934008', nama_alergi: 'Alergi Kacang Pohon / Almond / Walnut (Tree Nut)', kategori: 'food' },
  { kode_snomed: '227414006', nama_alergi: 'Alergi Wijen (Sesame Seed)', kategori: 'food' },
  { kode_snomed: '227289006', nama_alergi: 'Alergi Stroberi (Strawberry)', kategori: 'food' },
  { kode_snomed: '227290002', nama_alergi: 'Alergi Nanas (Pineapple)', kategori: 'food' },
  { kode_snomed: '294862002', nama_alergi: 'Alergi MSG (Monosodium Glutamate)', kategori: 'food' },
  { kode_snomed: '227027000', nama_alergi: 'Alergi Daging Sapi (Beef)', kategori: 'food' },

  // --- KATEGORI: OBAT / FARMASETIKAL (MEDICATION) ---
  { kode_snomed: '91000343', nama_alergi: 'Amoxicillin (Golongan Penicillin)', kategori: 'medication' },
  { kode_snomed: '91000344', nama_alergi: 'Ampicillin (Golongan Penicillin)', kategori: 'medication' },
  { kode_snomed: '373270004', nama_alergi: 'Penicillin G / V (Beta-Laktam)', kategori: 'medication' },
  { kode_snomed: '91000350', nama_alergi: 'Cefadroxil (Golongan Sefalosporin)', kategori: 'medication' },
  { kode_snomed: '91000355', nama_alergi: 'Ceftriaxone (Sefalosporin Generasi III)', kategori: 'medication' },
  { kode_snomed: '91000352', nama_alergi: 'Cefixime (Sefalosporin Oral)', kategori: 'medication' },
  { kode_snomed: '91000401', nama_alergi: 'Kotrimoksazol / Sulfametoksazol (Golongan Sulfa)', kategori: 'medication' },
  { kode_snomed: '91000101', nama_alergi: 'Paracetamol (Acetaminophen)', kategori: 'medication' },
  { kode_snomed: '91000125', nama_alergi: 'Ibuprofen (NSAID)', kategori: 'medication' },
  { kode_snomed: '91000128', nama_alergi: 'Asam Mefenamat (NSAID)', kategori: 'medication' },
  { kode_snomed: '91000126', nama_alergi: 'Natrium Diklofenak (NSAID)', kategori: 'medication' },
  { kode_snomed: '91000124', nama_alergi: 'Aspirin / Asam Asetilsalisilat', kategori: 'medication' },
  { kode_snomed: '91000130', nama_alergi: 'Ketorolac Tromethamine', kategori: 'medication' },
  { kode_snomed: '91000210', nama_alergi: 'Lidocaine HCl (Anestesi Lokal)', kategori: 'medication' },
  { kode_snomed: '372658000', nama_alergi: 'Bupivacaine / Procaine (Anestesi Lokal)', kategori: 'medication' },
  { kode_snomed: '91000380', nama_alergi: 'Ciprofloxacin (Golongan Fluoroquinolone)', kategori: 'medication' },
  { kode_snomed: '372687004', nama_alergi: 'Eritromisin / Azitromisin (Golongan Makrolida)', kategori: 'medication' },
  { kode_snomed: '91000390', nama_alergi: 'Metronidazole', kategori: 'medication' },
  { kode_snomed: '91000550', nama_alergi: 'Allopurinol (Obat Asam Urat)', kategori: 'medication' },
  { kode_snomed: '91000600', nama_alergi: 'Carbamazepine (Antikonvulsan)', kategori: 'medication' },
  { kode_snomed: '372861005', nama_alergi: 'Serum Anti Tetanus Kuda (ATS Equine)', kategori: 'medication' },
  { kode_snomed: '294833005', nama_alergi: 'Zat Kontras Radiologi Beriodin', kategori: 'medication' },

  // --- KATEGORI: LINGKUNGAN & INHALAN (ENVIRONMENT) ---
  { kode_snomed: '256277009', nama_alergi: 'Tungau Debu Rumah (House Dust Mite)', kategori: 'environment' },
  { kode_snomed: '256278004', nama_alergi: 'Bulu Kucing (Cat Dander)', kategori: 'environment' },
  { kode_snomed: '256279007', nama_alergi: 'Bulu Anjing (Dog Dander)', kategori: 'environment' },
  { kode_snomed: '1157263004', nama_alergi: 'Cuaca Dingin (Cold Induced Urticaria)', kategori: 'environment' },
  { kode_snomed: '23924001', nama_alergi: 'Suhu Panas & Keringat (Cholinergic Urticaria)', kategori: 'environment' },
  { kode_snomed: '418634005', nama_alergi: 'Sinar Matahari / Radiasi UV (Solar Urticaria)', kategori: 'environment' },
  { kode_snomed: '256259004', nama_alergi: 'Serbuk Sari Bunga / Rumput (Pollen)', kategori: 'environment' },
  { kode_snomed: '256268002', nama_alergi: 'Spora Jamur / Kapang Udara (Mold Spores)', kategori: 'environment' },
  { kode_snomed: '256286008', nama_alergi: 'Asap Rokok / Tembakau', kategori: 'environment' },
  { kode_snomed: '256280001', nama_alergi: 'Kecoa / Alergen Serangga Rumah', kategori: 'environment' },

  // --- KATEGORI: BIOLOGIK & BAHAN KONTAK (BIOLOGIC) ---
  { kode_snomed: '300916003', nama_alergi: 'Karet Lateks Alami (Natural Latex)', kategori: 'biologic' },
  { kode_snomed: '256303001', nama_alergi: 'Bisa Sengatan Lebah / Tawon (Bee Venom)', kategori: 'biologic' },
  { kode_snomed: '256308005', nama_alergi: 'Logam Nikel / Aksesoris Kulit (Nickel Metal)', kategori: 'biologic' },
  { kode_snomed: '261173003', nama_alergi: 'Plester Perekat Medis (Adhesive Tape)', kategori: 'biologic' },
  { kode_snomed: '294860005', nama_alergi: 'Klorheksidin Antiseptik (Chlorhexidine)', kategori: 'biologic' },
  { kode_snomed: '294861009', nama_alergi: 'Povidone Iodine Antiseptik', kategori: 'biologic' },
  { kode_snomed: '256322007', nama_alergi: 'Parfum / Fragrance Sintetis Kimia', kategori: 'biologic' }
];

// ==============================================================
// 2. DATA MASTER VAKSIN (KEMENKES RI & BIO FARMA)
// ==============================================================
const dataVaksin = [
  {
    kodeKfa: '9300201',
    namaVaksin: 'Vaksin Hepatitis B Rekombinan (HB-0)',
    targetPenyakit: 'Hepatitis B Neonatal (Pencegahan transmisi vertikal ibu ke bayi)'
  },
  {
    kodeKfa: '9300101',
    namaVaksin: 'Vaksin BCG Kering (Bio Farma)',
    targetPenyakit: 'Tuberkulosis (TBC Paru, Kelenjar, & Meningitis TB pada Bayi)'
  },
  {
    kodeKfa: '9300401',
    namaVaksin: 'Vaksin Polio Oral Bivalen (bOPV - Tetes)',
    targetPenyakit: 'Poliomyelitis Tipe 1 & 3 (Kelumpuhan Layu Akut)'
  },
  {
    kodeKfa: '9300402',
    namaVaksin: 'Vaksin Inactivated Polio Vaccine (IPV - Suntik)',
    targetPenyakit: 'Poliomyelitis Tipe 1, 2, & 3'
  },
  {
    kodeKfa: '9300301',
    namaVaksin: 'Vaksin DPT-HB-Hib (Pentabio - Bio Farma)',
    targetPenyakit: 'Difteri, Pertusis, Tetanus, Hepatitis B, & Haemophilus influenzae tipe B'
  },
  {
    kodeKfa: '9300601',
    namaVaksin: 'Vaksin Pneumokokus Konyugasi (PCV 13)',
    targetPenyakit: 'Pneumonia Bakterial, Bakteremia, & Meningitis Pneumokokus'
  },
  {
    kodeKfa: '9300701',
    namaVaksin: 'Vaksin Rotavirus Oral (RV Monovalen/Pentavalen)',
    targetPenyakit: 'Gastroenteritis Akut Berat Rotavirus pada Bayi'
  },
  {
    kodeKfa: '9300501',
    namaVaksin: 'Vaksin Campak Rubella (MR - Bio Farma)',
    targetPenyakit: 'Campak (Morbili) & Sindrom Rubella Kongenital (CRS)'
  },
  {
    kodeKfa: '9300801',
    namaVaksin: 'Vaksin Japanese Encephalitis (JE)',
    targetPenyakit: 'Radang Otak Japanese Encephalitis Vektor Culex'
  },
  {
    kodeKfa: '9300901',
    namaVaksin: 'Vaksin Human Papillomavirus (HPV Kuadrivalen)',
    targetPenyakit: 'Kanker Leher Rahim (Serviks) & Kutil Kelamin (HPV Tipe 6, 11, 16, 18)'
  },
  {
    kodeKfa: '9301001',
    namaVaksin: 'Vaksin Difteri Tetanus (DT Anak Usia Sekolah)',
    targetPenyakit: 'Booster Imunisasi Difteri & Tetanus Usia Sekolah (BIAS Kelas 1)'
  },
  {
    kodeKfa: '9301101',
    namaVaksin: 'Vaksin Tetanus Difteri (Td BIAS & WUS)',
    targetPenyakit: 'Booster Tetanus Difteri Anak SD (BIAS Kelas 2 & 5) serta Wanita Usia Subur'
  },
  {
    kodeKfa: '9301201',
    namaVaksin: 'Vaksin Tetanus Toksoid (TT / Tdap Ibu Hamil)',
    targetPenyakit: 'Pencegahan Tetanus Neonatorum & Tetanus Maternal'
  },
  {
    kodeKfa: '9301301',
    namaVaksin: 'Vaksin MMR (Measles, Mumps, Rubella)',
    targetPenyakit: 'Campak, Gondongan (Parotitis Epidemika), & Rubella'
  },
  {
    kodeKfa: '9301401',
    namaVaksin: 'Vaksin Varisela (Varicella)',
    targetPenyakit: 'Cacar Air (Varicella Zoster)'
  },
  {
    kodeKfa: '9301501',
    namaVaksin: 'Vaksin Hepatitis A Inaktif',
    targetPenyakit: 'Hepatitis A Akut Fekal-Oral'
  },
  {
    kodeKfa: '9301601',
    namaVaksin: 'Vaksin Tifoid Polisakarida (Bio Farma)',
    targetPenyakit: 'Demam Tifoid / Tipes (Salmonella typhi)'
  },
  {
    kodeKfa: '9301701',
    namaVaksin: 'Vaksin Influenza Kuadrivalen Musiman',
    targetPenyakit: 'Influenza Subtipe A (H1N1, H3N2) & Influenza Tipe B'
  },
  {
    kodeKfa: '9301801',
    namaVaksin: 'Vaksin Anti Rabies (VAR - Verorab / Bio Farma)',
    targetPenyakit: 'Profilaksis Gigitan Hewan Penular Rabies (GHPR)'
  },
  {
    kodeKfa: '9301901',
    namaVaksin: 'Serum Anti Rabies (SAR - Equine Rabies Immunoglobulin)',
    targetPenyakit: 'Netralisasi Cepat Virus Rabies pada Luka Gigitan Kategori III'
  },
  {
    kodeKfa: '9302001',
    namaVaksin: 'Vaksin COVID-19 Rekombinan Protein (IndoVac)',
    targetPenyakit: 'Infeksi Severe Acute Respiratory Syndrome CoronaVirus 2 (SARS-CoV-2)'
  }
];

// ==============================================================
// 3. DATA MASTER LABORATORIUM (FKTP, PENUNJANG, & RUJUKAN)
// ==============================================================
const dataLaboratorium = [
  // --- HEMATOLOGI ---
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Hematologi Rutin/CBC',
    satuan: 'Panel',
    nilaiRujukan: 'Hemoglobin, Hematokrit, Leukosit, Trombosit normal',
    kodePanelLab: 'PANEL-CBC',
    hargaTarif: 40000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Hematologi Lengkap (CBC, LED, Hitung Jenis)',
    satuan: 'Panel',
    nilaiRujukan: 'CBC + Laju Endap Darah + Diff Count normal',
    kodePanelLab: 'PANEL-CBC-DIFF',
    hargaTarif: 60000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Hemoglobin',
    satuan: 'g/dL',
    nilaiRujukan: 'P: 13.0 - 17.0, W: 12.0 - 15.0',
    kodePanelLab: 'HEM-HB',
    hargaTarif: 15000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Hematokrit',
    satuan: '%',
    nilaiRujukan: 'P: 40 - 52, W: 35 - 47',
    kodePanelLab: 'HEM-HT',
    hargaTarif: 15000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Leukosit',
    satuan: '/uL',
    nilaiRujukan: '4.000 - 10.000',
    kodePanelLab: 'HEM-LEUKO',
    hargaTarif: 15000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Trombosit',
    satuan: '/uL',
    nilaiRujukan: '150.000 - 450.000',
    kodePanelLab: 'HEM-TROMBO',
    hargaTarif: 15000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Eritrosit',
    satuan: '10^6/uL',
    nilaiRujukan: 'P: 4.5 - 5.5, W: 4.0 - 5.0',
    kodePanelLab: 'HEM-ERITRO',
    hargaTarif: 15000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'LED',
    satuan: 'mm/jam',
    nilaiRujukan: 'P: < 15, W: < 20',
    kodePanelLab: 'HEM-LED',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Golongan Darah A,B,O & Rh',
    satuan: 'Tipe',
    nilaiRujukan: 'A / B / AB / O (Rhesus Positif / Negatif)',
    kodePanelLab: 'HEM-GOLDA',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Gambaran Darah Tepi',
    satuan: 'Morfologi',
    nilaiRujukan: 'Eritrosit normositik normokromik, trombosit cukup',
    kodePanelLab: 'HEM-MDT',
    hargaTarif: 75000,
    tersediaInternal: false
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Retikulosit',
    satuan: '%',
    nilaiRujukan: '0.5 - 1.5 %',
    kodePanelLab: 'HEM-RETIK',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'HEMATOLOGI',
    parameter: 'Hematologi Rutin + Retikulosit',
    satuan: 'Panel',
    nilaiRujukan: 'CBC + Retikulosit normal',
    kodePanelLab: 'HEM-CBC-RET',
    hargaTarif: 70000,
    tersediaInternal: false
  },

  // --- URINALISA & FAECES ---
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Urine Rutin',
    satuan: 'Panel',
    nilaiRujukan: 'Kuning jernih, Protein (-), Glukosa (-), Sedimen normal',
    kodePanelLab: 'URI-RUTIN',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Protein Total (Urine 24 jam)',
    satuan: 'mg/24 jam',
    nilaiRujukan: '< 150 mg/24 jam',
    kodePanelLab: 'URI-PROT24',
    hargaTarif: 65000,
    tersediaInternal: false
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Faeces Rutin',
    satuan: 'Panel',
    nilaiRujukan: 'Kuning kecokelatan, Lembek, Amoeba (-), Telur cacing (-)',
    kodePanelLab: 'FCS-RUTIN',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Darah Samar (FIT)',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Negatif',
    kodePanelLab: 'FCS-FOBT',
    hargaTarif: 35000,
    tersediaInternal: true
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Tes Kehamilan Plano Test / hCG Urine',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Negatif / Positif',
    kodePanelLab: 'URI-HCG',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Skrining Narkoba 3 Parameter (AMP, THC, MOP)',
    satuan: 'Rapid',
    nilaiRujukan: 'Negatif semua parameter',
    kodePanelLab: 'URI-NARKOBA-3P',
    hargaTarif: 75000,
    tersediaInternal: true
  },
  {
    kategori: 'URINALISA & FAECES',
    parameter: 'Skrining Narkoba 6 Parameter (AMP, THC, MOP, MET, BZO, COC)',
    satuan: 'Rapid',
    nilaiRujukan: 'Negatif semua parameter',
    kodePanelLab: 'URI-NARKOBA-6P',
    hargaTarif: 150000,
    tersediaInternal: true
  },

  // --- KIMIA DARAH DASAR ---
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Glukosa Sewaktu',
    satuan: 'mg/dL',
    nilaiRujukan: '< 140 mg/dL',
    kodePanelLab: 'KIM-GDS',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Glukosa Puasa',
    satuan: 'mg/dL',
    nilaiRujukan: '70 - 100 mg/dL',
    kodePanelLab: 'KIM-GDP',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Glukosa 2 Jam PP',
    satuan: 'mg/dL',
    nilaiRujukan: '< 140 mg/dL',
    kodePanelLab: 'KIM-GD2PP',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Cholesterol Total',
    satuan: 'mg/dL',
    nilaiRujukan: '< 200 mg/dL',
    kodePanelLab: 'KIM-CHOL',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Trigliserida',
    satuan: 'mg/dL',
    nilaiRujukan: '< 150 mg/dL',
    kodePanelLab: 'KIM-TRIG',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Cholesterol HDL',
    satuan: 'mg/dL',
    nilaiRujukan: 'P: > 40, W: > 50 mg/dL',
    kodePanelLab: 'KIM-HDL',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Cholesterol LDL Direk',
    satuan: 'mg/dL',
    nilaiRujukan: '< 100 mg/dL',
    kodePanelLab: 'KIM-LDL',
    hargaTarif: 40000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Asam Urat',
    satuan: 'mg/dL',
    nilaiRujukan: 'P: 3.4 - 7.0, W: 2.4 - 5.7 mg/dL',
    kodePanelLab: 'KIM-URIC',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Ureum',
    satuan: 'mg/dL',
    nilaiRujukan: '15 - 40 mg/dL',
    kodePanelLab: 'KIM-UREUM',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'Kreatinin',
    satuan: 'mg/dL',
    nilaiRujukan: 'P: 0.7 - 1.2, W: 0.5 - 0.9 mg/dL',
    kodePanelLab: 'KIM-KREATININ',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'SGOT',
    satuan: 'U/L',
    nilaiRujukan: 'P: < 35, W: < 31 U/L',
    kodePanelLab: 'KIM-SGOT',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'KIMIA DARAH DASAR',
    parameter: 'SGPT',
    satuan: 'U/L',
    nilaiRujukan: 'P: < 45, W: < 34 U/L',
    kodePanelLab: 'KIM-SGPT',
    hargaTarif: 30000,
    tersediaInternal: true
  },

  // --- INFEKSI & HEPATITIS (TRIPLE ELIMINASI & WABAH) ---
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'HBsAg',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Non Reaktif',
    kodePanelLab: 'INF-HBSAG',
    hargaTarif: 45000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Anti-HBs',
    satuan: 'mIU/mL',
    nilaiRujukan: '> 10 mIU/mL (Protektif)',
    kodePanelLab: 'INF-ANTIHBS',
    hargaTarif: 65000,
    tersediaInternal: false
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Anti-HCV',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Non Reaktif',
    kodePanelLab: 'INF-ANTIHCV',
    hargaTarif: 75000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Anti-HAV IgM',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Non Reaktif',
    kodePanelLab: 'INF-ANTIHAV',
    hargaTarif: 85000,
    tersediaInternal: false
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Anti-HIV',
    satuan: 'Rapid 3 Reagen',
    nilaiRujukan: 'Non Reaktif',
    kodePanelLab: 'INF-HIV',
    hargaTarif: 50000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'VDRL/RPR',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Non Reaktif',
    kodePanelLab: 'INF-VDRL',
    hargaTarif: 35000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Dengue NS1 Antigen',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Negatif',
    kodePanelLab: 'INF-NS1',
    hargaTarif: 95000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Anti-Dengue IgG & IgM',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Negatif / Non Reaktif',
    kodePanelLab: 'INF-DENGUE-AB',
    hargaTarif: 85000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Widal',
    satuan: 'Titer',
    nilaiRujukan: 'Titer O, H < 1/160',
    kodePanelLab: 'INF-WIDAL',
    hargaTarif: 35000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'Malaria (Mikroskopik)',
    satuan: 'Mikroskopis',
    nilaiRujukan: 'Negatif / Tidak ditemukan Plasmodium',
    kodePanelLab: 'INF-MALARIA',
    hargaTarif: 30000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'BTA Sputum TB (Ziehl-Neelsen)',
    satuan: 'Kualitatif',
    nilaiRujukan: 'Negatif (Skala IUATLD)',
    kodePanelLab: 'INF-BTA-TB',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'INFEKSI & HEPATITIS',
    parameter: 'TCM / GeneXpert MTB-RIF',
    satuan: 'Molekuler',
    nilaiRujukan: 'MTB Not Detected',
    kodePanelLab: 'INF-TCM-TB',
    hargaTarif: 120000,
    tersediaInternal: true
  },

  // --- FAAL HATI & DIABETES (LANJUTAN) ---
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Bilirubin Total',
    satuan: 'mg/dL',
    nilaiRujukan: '0.2 - 1.0 mg/dL',
    kodePanelLab: 'HAT-BILTOT',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Bilirubin Direk',
    satuan: 'mg/dL',
    nilaiRujukan: '< 0.2 mg/dL',
    kodePanelLab: 'HAT-BILDIR',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Albumin',
    satuan: 'g/dL',
    nilaiRujukan: '3.5 - 5.0 g/dL',
    kodePanelLab: 'HAT-ALB',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Globulin',
    satuan: 'g/dL',
    nilaiRujukan: '2.3 - 3.4 g/dL',
    kodePanelLab: 'HAT-GLOB',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Protein Total',
    satuan: 'g/dL',
    nilaiRujukan: '6.4 - 8.3 g/dL',
    kodePanelLab: 'HAT-PROTTOT',
    hargaTarif: 35000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Gamma GT',
    satuan: 'U/L',
    nilaiRujukan: '9 - 48 U/L',
    kodePanelLab: 'HAT-GGT',
    hargaTarif: 45000,
    tersediaInternal: false
  },
  {
    kategori: 'FAAL HATI (Lanjutan)',
    parameter: 'Fosfatase Alkali',
    satuan: 'U/L',
    nilaiRujukan: '44 - 147 U/L',
    kodePanelLab: 'HAT-ALP',
    hargaTarif: 45000,
    tersediaInternal: false
  },
  {
    kategori: 'DIABETES (Lanjutan)',
    parameter: 'HbA1c',
    satuan: '%',
    nilaiRujukan: '< 5.7 % (Normal), < 7.0 % (Target Kontrol DM)',
    kodePanelLab: 'DM-HBA1C',
    hargaTarif: 125000,
    tersediaInternal: true
  },
  {
    kategori: 'DIABETES (Lanjutan)',
    parameter: 'TTGO',
    satuan: 'mg/dL',
    nilaiRujukan: '< 140 mg/dL',
    kodePanelLab: 'DM-TTGO',
    hargaTarif: 45000,
    tersediaInternal: true
  },

  // --- ELEKTROLIT - GAS DARAH ---
  {
    kategori: 'ELEKTROLIT - GAS DARAH',
    parameter: 'Na, K, Cl',
    satuan: 'mmol/L',
    nilaiRujukan: 'Na: 135-145, K: 3.5-5.1, Cl: 98-107 mmol/L',
    kodePanelLab: 'ELEK-NAKCL',
    hargaTarif: 95000,
    tersediaInternal: false
  },
  {
    kategori: 'ELEKTROLIT - GAS DARAH',
    parameter: 'Kalsium',
    satuan: 'mg/dL',
    nilaiRujukan: '8.5 - 10.5 mg/dL',
    kodePanelLab: 'ELEK-CA',
    hargaTarif: 45000,
    tersediaInternal: false
  },
  {
    kategori: 'ELEKTROLIT - GAS DARAH',
    parameter: 'Analisis Gas Darah',
    satuan: 'Panel',
    nilaiRujukan: 'pH: 7.35-7.45, pO2: 80-100, pCO2: 35-45 mmHg',
    kodePanelLab: 'ELEK-AGD',
    hargaTarif: 180000,
    tersediaInternal: false
  },

  // --- FAAL HEMOSTASIS & JANTUNG ---
  {
    kategori: 'FAAL HEMOSTASIS',
    parameter: 'Waktu Perdarahan',
    satuan: 'menit',
    nilaiRujukan: '1 - 3 menit (Metode Duke)',
    kodePanelLab: 'HEM-BT',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'FAAL HEMOSTASIS',
    parameter: 'Waktu Pembekuan',
    satuan: 'menit',
    nilaiRujukan: '5 - 11 menit (Metode Lee-White)',
    kodePanelLab: 'HEM-CT',
    hargaTarif: 20000,
    tersediaInternal: true
  },
  {
    kategori: 'FAAL HEMOSTASIS',
    parameter: 'D-Dimer',
    satuan: 'ng/mL',
    nilaiRujukan: '< 500 ng/mL',
    kodePanelLab: 'HEM-DDIMER',
    hargaTarif: 220000,
    tersediaInternal: false
  },
  {
    kategori: 'JANTUNG',
    parameter: 'Troponin I',
    satuan: 'ng/mL',
    nilaiRujukan: '< 0.04 ng/mL',
    kodePanelLab: 'JTG-TROPONIN',
    hargaTarif: 160000,
    tersediaInternal: false
  },
  {
    kategori: 'JANTUNG',
    parameter: 'CK-MB',
    satuan: 'U/L',
    nilaiRujukan: '< 24 U/L',
    kodePanelLab: 'JTG-CKMB',
    hargaTarif: 110000,
    tersediaInternal: false
  },

  // --- IMUNOLOGI & SKRINING KHUSUS ---
  {
    kategori: 'IMUNOLOGI',
    parameter: 'CRP Kualitatif',
    satuan: 'mg/L',
    nilaiRujukan: 'Negatif / < 6 mg/L',
    kodePanelLab: 'IMU-CRP',
    hargaTarif: 55000,
    tersediaInternal: true
  },
  {
    kategori: 'IMUNOLOGI',
    parameter: 'hs-CRP',
    satuan: 'mg/L',
    nilaiRujukan: '< 1.0 mg/L (Risiko rendah kardiovaskular)',
    kodePanelLab: 'IMU-HSCRP',
    hargaTarif: 120000,
    tersediaInternal: false
  },
  {
    kategori: 'TIROID',
    parameter: 'TSHs',
    satuan: 'uIU/mL',
    nilaiRujukan: '0.27 - 4.2 uIU/mL',
    kodePanelLab: 'TIR-TSHS',
    hargaTarif: 135000,
    tersediaInternal: false
  },
  {
    kategori: 'TIROID',
    parameter: 'FT4',
    satuan: 'ng/dL',
    nilaiRujukan: '0.93 - 1.7 ng/dL',
    kodePanelLab: 'TIR-FT4',
    hargaTarif: 135000,
    tersediaInternal: false
  },
  {
    kategori: 'SKRINING KANKER & SITOLOGI',
    parameter: 'IVA Test (Inspeksi Visual Asam Asetat)',
    satuan: 'Kualitatif',
    nilaiRujukan: 'IVA Negatif (Tidak ada lesi bercak putih)',
    kodePanelLab: 'SKR-IVA',
    hargaTarif: 25000,
    tersediaInternal: true
  },
  {
    kategori: 'SKRINING KANKER & SITOLOGI',
    parameter: 'Pap Smear Serviks',
    satuan: 'Sitologi',
    nilaiRujukan: 'Dalam batas normal / Negatif keganasan intraepitel',
    kodePanelLab: 'SKR-PAP',
    hargaTarif: 125000,
    tersediaInternal: false
  }
];

// ==============================================================
// 4. DATA MASTER MODALITY (RADIOLOGI & IMAGING SATUSEHAT)
// ==============================================================
const dataModality = [
  {
    kodeDicom: 'XR',
    namaModality: 'X-Ray / Radiografi Konvensional',
    deskripsi: 'Pemeriksaan rontgen tulang & organ toraks/abdomen',
    tersediaInternal: false
  },
  {
    kodeDicom: 'US',
    namaModality: 'Ultrasonography (USG)',
    deskripsi: 'Pemeriksaan USG Obstetri/Ginekologi, Abdomen & Vaskular',
    tersediaInternal: true
  },
  {
    kodeDicom: 'CT',
    namaModality: 'Computed Tomography (CT-Scan)',
    deskripsi: 'Pemeriksaan tomografi terkomputasi kepala, toraks, & abdomen',
    tersediaInternal: false
  },
  {
    kodeDicom: 'MR',
    namaModality: 'Magnetic Resonance Imaging (MRI)',
    deskripsi: 'Pemeriksaan pencitraan resonansi magnetik resolusi tinggi',
    tersediaInternal: false
  },
  {
    kodeDicom: 'PX',
    namaModality: 'Panoramic / Dental Cephalometric X-Ray',
    deskripsi: 'Pemeriksaan ortopantomografi gigi, maksilofasial & rahang',
    tersediaInternal: false
  },
  {
    kodeDicom: 'MG',
    namaModality: 'Mammography',
    deskripsi: 'Pemeriksaan mamografi skrining tumor jaringan payudara',
    tersediaInternal: false
  },
  {
    kodeDicom: 'ECG',
    namaModality: 'Elektrokardiografi (EKG)',
    deskripsi: 'Rekam aktivitas listrik otot jantung 12 Lead',
    tersediaInternal: true
  }
];

// ==============================================================
// 5. DATA MASTER PROSEDUR (ICD-9-CM) TINDAKAN DOKTER & PERAWAT
// ==============================================================
const dataICD9 = [
  { kode_icd9: '89.52', nama_prosedur: 'Elektrokardiogram (EKG 12 Lead)', kategori: 'Pemeriksaan Penunjang' },
  { kode_icd9: '87.44', nama_prosedur: 'Foto Thoraks AP/PA', kategori: 'Radiologi' },
  { kode_icd9: '88.72', nama_prosedur: 'USG Abdomen & Pelvis', kategori: 'Radiologi' },
  { kode_icd9: '88.78', nama_prosedur: 'USG Kebidanan / Kandungan (Obstetri)', kategori: 'Radiologi Kebidanan' },
  { kode_icd9: '87.11', nama_prosedur: 'Foto Rontgen Gigi Panoramic / Intraoral', kategori: 'Radiologi Gigi' },
  { kode_icd9: '90.59', nama_prosedur: 'Pemeriksaan Darah Lengkap / Hematologi', kategori: 'Laboratorium' },
  { kode_icd9: '91.46', nama_prosedur: 'Pemeriksaan Urinalisis Lengkap', kategori: 'Laboratorium' },
  { kode_icd9: '90.99', nama_prosedur: 'Pemeriksaan Mikrobiologi BTA TB / TCM', kategori: 'Laboratorium' },
  { kode_icd9: '38.93', nama_prosedur: 'Pemasangan Infus Perifer (IV Line)', kategori: 'Tindakan Keperawatan' },
  { kode_icd9: '57.94', nama_prosedur: 'Pemasangan Kateter Urin Foley', kategori: 'Tindakan Keperawatan' },
  { kode_icd9: '96.04', nama_prosedur: 'Terapi Oksigen Kanul Nasal / Masker', kategori: 'Tindakan Respirasi' },
  { kode_icd9: '96.07', nama_prosedur: 'Pemasangan Pipa Lambung (NGT) / Bilas Lambung', kategori: 'Tindakan Keperawatan' },
  { kode_icd9: '96.59', nama_prosedur: 'Suction / Pembersihan Jalan Napas', kategori: 'Tindakan Respirasi' },
  { kode_icd9: '93.94', nama_prosedur: 'Terapi Nebulisasi Obat Inhalasi', kategori: 'Tindakan Respirasi' },
  { kode_icd9: '86.59', nama_prosedur: 'Penjahitan Luka (Hecting) Bedah Minor', kategori: 'Bedah Minor' },
  { kode_icd9: '86.04', nama_prosedur: 'Debridement Luka Infeksi / Luka Bakar', kategori: 'Bedah Minor' },
  { kode_icd9: '97.83', nama_prosedur: 'Pengangkatan Jahitan Luka (Aff Hecting)', kategori: 'Bedah Minor' },
  { kode_icd9: '96.34', nama_prosedur: 'Pencucian & Perawatan Luka Bersih / Ganti Balut', kategori: 'Tindakan Keperawatan' },
  { kode_icd9: '86.01', nama_prosedur: 'Insisi dan Drainase Abses / Phlegmon', kategori: 'Bedah Minor' },
  { kode_icd9: '86.23', nama_prosedur: 'Ekstraksi Kuku (Roserplasty)', kategori: 'Bedah Minor' },
  { kode_icd9: '64.0', nama_prosedur: 'Sirkumsisi / Khitan Medis', kategori: 'Bedah Minor' },
  { kode_icd9: '98.11', nama_prosedur: 'Ekstraksi Benda Asing (Corpus Alienum) Telinga / Hidung', kategori: 'Tindakan THT' },
  { kode_icd9: '93.54', nama_prosedur: 'Pemasangan Bidai / Spalk Fraktur Ekstremitas', kategori: 'Traumatologi' },
  { kode_icd9: '99.15', nama_prosedur: 'Imunisasi / Injeksi Vaksin Subkutan / Intramuskular', kategori: 'Imunisasi' },
  { kode_icd9: '99.21', nama_prosedur: 'Injeksi Obat Antibiotik / Terapetik Intramuskular (IM)', kategori: 'Terapi Injeksi' },
  { kode_icd9: '99.23', nama_prosedur: 'Injeksi Obat Intravena Bolus (IV)', kategori: 'Terapi Injeksi' },
  { kode_icd9: '99.29', nama_prosedur: 'Injeksi Subkutan / Intrakutan (Skin Test Alergi)', kategori: 'Terapi Injeksi' },
  { kode_icd9: '99.04', nama_prosedur: 'Transfusi Darah dan Produk Darah', kategori: 'Terapi Transfusi' },
  { kode_icd9: '70.50', nama_prosedur: 'Pertolongan Persalinan Normal Pervaginam', kategori: 'Kebidanan & KIA' },
  { kode_icd9: '73.59', nama_prosedur: 'Episiotomi dan Penjahitan Ruptur Perineum', kategori: 'Kebidanan & KIA' },
  { kode_icd9: '75.4', nama_prosedur: 'Manual Plasenta pada Retensio Plasenta', kategori: 'Kebidanan & KIA' },
  { kode_icd9: '69.7', nama_prosedur: 'Pemasangan Alat Kontrasepsi Dalam Rahim (AKDR / IUD)', kategori: 'Pelayanan KB' },
  { kode_icd9: '97.71', nama_prosedur: 'Pelepasan Alat Kontrasepsi Dalam Rahim (AKDR / IUD)', kategori: 'Pelayanan KB' },
  { kode_icd9: '99.28', nama_prosedur: 'Injeksi Kontrasepsi Hormonal (KB 1 Bulan / 3 Bulan)', kategori: 'Pelayanan KB' },
  { kode_icd9: '86.12', nama_prosedur: 'Pemasangan / Pelepasan Implan / Susuk KB', kategori: 'Pelayanan KB' },
  { kode_icd9: '23.09', nama_prosedur: 'Pencabutan Gigi Permanen Tanpa Penyulit', kategori: 'Kesehatan Gigi' },
  { kode_icd9: '23.01', nama_prosedur: 'Pencabutan Gigi Sulung (Anak)', kategori: 'Kesehatan Gigi' },
  { kode_icd9: '23.2', nama_prosedur: 'Penambalan Gigi Komposit / Glass Ionomer (GIC)', kategori: 'Kesehatan Gigi' },
  { kode_icd9: '24.0', nama_prosedur: 'Pembersihan Karang Gigi (Scaling)', kategori: 'Kesehatan Gigi' },
  { kode_icd9: '24.31', nama_prosedur: 'Kuretase Gingiva / Jaringan Periodontal', kategori: 'Kesehatan Gigi' },
  { kode_icd9: '89.07', nama_prosedur: 'Konsultasi / Edukasi Kesehatan & Skrining Prolanis', kategori: 'Konsultasi Medis' },
  { kode_icd9: '89.26', nama_prosedur: 'Pemeriksaan Skrining IVA Test Serviks', kategori: 'Kebidanan & KIA' }
];

// ==============================================================
// 6. DATA MASTER DIAGNOSA (ICD-10) LENGKAP PENUNJANG GIS DINKES
// ==============================================================
const dataICD10 = [
  // --- PENYAKIT MENULAR & SURVEILANS WAJIB LAPOR DINKES ---
  {
    kode_icd10: 'A15.0',
    nama_diagnosis: 'Tuberkulosis Paru Terkonfirmasi Bakteriologis (BTA / TCM Positif)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Tuberkulosis',
    penyakit_menular: true,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'TB'
  },
  {
    kode_icd10: 'A16.2',
    nama_diagnosis: 'Tuberkulosis Paru Klinis Tanpa Konfirmasi Bakteriologis',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Tuberkulosis',
    penyakit_menular: true,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'TB'
  },
  {
    kode_icd10: 'A90',
    nama_diagnosis: 'Demam Dengue (Dengue Fever)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Dengue',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'DBD'
  },
  {
    kode_icd10: 'A91',
    nama_diagnosis: 'Demam Berdarah Dengue (Dengue Haemorrhagic Fever)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Dengue',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'DBD'
  },
  {
    kode_icd10: 'A09',
    nama_diagnosis: 'Diare dan Gastroenteritis Akut Infeksius',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Infeksi Saluran Cerna',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'DIARE'
  },
  {
    kode_icd10: 'A01.0',
    nama_diagnosis: 'Demam Tifoid (Typhoid Fever)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Infeksi Bakteri Saluran Cerna',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'DIARE'
  },
  {
    kode_icd10: 'B20',
    nama_diagnosis: 'Human Immunodeficiency Virus (HIV) Disease',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'HIV/AIDS',
    penyakit_menular: true,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'HIV'
  },
  {
    kode_icd10: 'A53.9',
    nama_diagnosis: 'Sifilis Tidak Spesifik (Syphilis, unspecified)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Infeksi Menular Seksual',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'HIV'
  },
  {
    kode_icd10: 'B18.1',
    nama_diagnosis: 'Hepatitis B Kronis Tanpa Agen Delta',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Hepatitis Viral',
    penyakit_menular: true,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'HEPATITIS'
  },
  {
    kode_icd10: 'B15.9',
    nama_diagnosis: 'Hepatitis A Akut Tanpa Koma Hepatik',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Hepatitis Viral',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'HEPATITIS'
  },
  {
    kode_icd10: 'B50.9',
    nama_diagnosis: 'Malaria Falciparum Tanpa Komplikasi',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Malaria',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'MALARIA'
  },
  {
    kode_icd10: 'B51.9',
    nama_diagnosis: 'Malaria Vivax Tanpa Komplikasi',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Malaria',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'MALARIA'
  },
  {
    kode_icd10: 'A30.9',
    nama_diagnosis: 'Kusta / Lepra (Morbus Hansen Tidak Spesifik)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Kusta',
    penyakit_menular: true,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'KUSTA'
  },
  {
    kode_icd10: 'B05.9',
    nama_diagnosis: 'Campak Tanpa Komplikasi (Morbili)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Penyakit yang Dapat Dicegah Dengan Imunisasi (PD3I)',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'CAMPAK'
  },
  {
    kode_icd10: 'B06.9',
    nama_diagnosis: 'Rubella Tanpa Komplikasi (Campak Jerman)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Penyakit yang Dapat Dicegah Dengan Imunisasi (PD3I)',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'CAMPAK'
  },
  {
    kode_icd10: 'A36.9',
    nama_diagnosis: 'Difteri Tidak Spesifik (Diphtheria)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Penyakit yang Dapat Dicegah Dengan Imunisasi (PD3I)',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'PD3I'
  },
  {
    kode_icd10: 'A37.9',
    nama_diagnosis: 'Pertusis / Batuk Rejan (Whooping Cough)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Penyakit yang Dapat Dicegah Dengan Imunisasi (PD3I)',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'PD3I'
  },
  {
    kode_icd10: 'A82.9',
    nama_diagnosis: 'Rabies Tidak Spesifik (Gigitan Hewan Penular Rabies)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Zoonosis',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'RABIES'
  },
  {
    kode_icd10: 'U07.1',
    nama_diagnosis: 'COVID-19 Terkonfirmasi Laboratorium',
    bab: 'Kode Khusus Darurat',
    kategori: 'COVID-19',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'ISPA'
  },

  // --- INFEKSI SALURAN PERNAPASAN (ISPA & PNEUMONIA) ---
  {
    kode_icd10: 'J00',
    nama_diagnosis: 'Nasofaringitis Akut (Common Cold)',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'ISPA Ringan',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J02.9',
    nama_diagnosis: 'Faringitis Akut Tidak Spesifik',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'ISPA',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J03.9',
    nama_diagnosis: 'Tonsilitis Akut',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'ISPA',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J06.9',
    nama_diagnosis: 'Infeksi Saluran Pernapasan Akut Atas Tidak Spesifik (ISPA)',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'ISPA',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J18.0',
    nama_diagnosis: 'Bronkopneumonia Tidak Spesifik (Pneumonia Balita)',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'Pneumonia',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J18.9',
    nama_diagnosis: 'Pneumonia Tidak Spesifik',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'Pneumonia',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J20.9',
    nama_diagnosis: 'Bronkitis Akut',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'ISPA Bawah',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'ISPA'
  },
  {
    kode_icd10: 'J45.9',
    nama_diagnosis: 'Asma Bronkial Tidak Spesifik',
    bab: 'Penyakit Sistem Pernapasan',
    kategori: 'Asma',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'PTM'
  },

  // --- PENYAKIT TIDAK MENULAR (PTM / PROLANIS) ---
  {
    kode_icd10: 'I10',
    nama_diagnosis: 'Hipertensi Esensial (Primer)',
    bab: 'Penyakit Sistem Sirkulasi',
    kategori: 'Hipertensi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'E11',
    nama_diagnosis: 'Diabetes Melitus Tipe 2 Tanpa Komplikasi',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Diabetes',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'E10',
    nama_diagnosis: 'Diabetes Melitus Tipe 1',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Diabetes',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'E78.0',
    nama_diagnosis: 'Hiperkolesterolemia Murni',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Dislipidemia',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'E78.2',
    nama_diagnosis: 'Hiperlipidemia Campuran',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Dislipidemia',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'M10.9',
    nama_diagnosis: 'Gout Arthritis / Asam Urat Tidak Spesifik',
    bab: 'Penyakit Sistem Muskuloskeletal',
    kategori: 'Arthritis',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'I20.9',
    nama_diagnosis: 'Angina Pectoris Tidak Spesifik (Penyakit Jantung Koroner)',
    bab: 'Penyakit Sistem Sirkulasi',
    kategori: 'Penyakit Jantung Iskemik',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'I21.9',
    nama_diagnosis: 'Infark Miokard Akut (Serangan Jantung Akut)',
    bab: 'Penyakit Sistem Sirkulasi',
    kategori: 'Penyakit Jantung Iskemik',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'I50.9',
    nama_diagnosis: 'Gagal Jantung Kongestif (Congestive Heart Failure)',
    bab: 'Penyakit Sistem Sirkulasi',
    kategori: 'Gagal Jantung',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'I64',
    nama_diagnosis: 'Stroke Tidak Spesifik (Perdarahan atau Infark Serebral)',
    bab: 'Penyakit Sistem Sirkulasi',
    kategori: 'Serebrovaskular',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'N18.9',
    nama_diagnosis: 'Penyakit Ginjal Kronis (Chronic Kidney Disease)',
    bab: 'Penyakit Sistem Genitourinaria',
    kategori: 'Gagal Ginjal',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'PTM'
  },
  {
    kode_icd10: 'E66.9',
    nama_diagnosis: 'Obesitas Tidak Spesifik',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Gangguan Nutrisi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'PTM'
  },

  // --- KESEHATAN IBU & ANAK (KIA & STUNTING) ---
  {
    kode_icd10: 'E45',
    nama_diagnosis: 'Hambatan Perkembangan Fisik Akibat Gizi Kurang (Stunting)',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Malnutrisi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'STUNTING'
  },
  {
    kode_icd10: 'E44.0',
    nama_diagnosis: 'Malnutrisi Energi Protein Sedang (Gizi Kurang / Wasting)',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Malnutrisi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'STUNTING'
  },
  {
    kode_icd10: 'E43',
    nama_diagnosis: 'Malnutrisi Energi Protein Berat (Gizi Buruk / Kwashiorkor / Marasmus)',
    bab: 'Penyakit Endokrin, Nutrisi dan Metabolik',
    kategori: 'Malnutrisi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'STUNTING'
  },
  {
    kode_icd10: 'P07.1',
    nama_diagnosis: 'Bayi Berat Lahir Rendah (BBLR 1000 - 2499 gram)',
    bab: 'Kondisi Tertentu yang Berawal pada Masa Perinatal',
    kategori: 'Kelainan Neonatus',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'KIA'
  },
  {
    kode_icd10: 'D50.9',
    nama_diagnosis: 'Anemia Defisiensi Besi',
    bab: 'Penyakit Darah dan Organ Pembentuk Darah',
    kategori: 'Anemia',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'KIA'
  },
  {
    kode_icd10: 'O14.9',
    nama_diagnosis: 'Preeklampsia Ringan / Sedang pada Kehamilan',
    bab: 'Kehamilan, Persalinan dan Masa Nifas',
    kategori: 'Hipertensi pada Kehamilan',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'KIA'
  },
  {
    kode_icd10: 'O80',
    nama_diagnosis: 'Persalinan Tunggal Spontan Pervaginam (Normal)',
    bab: 'Kehamilan, Persalinan dan Masa Nifas',
    kategori: 'Persalinan',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'KIA'
  },
  {
    kode_icd10: 'Z34.9',
    nama_diagnosis: 'Pengawasan Kehamilan Normal (ANC Trimester I / II / III)',
    bab: 'Faktor yang Mempengaruhi Status Kesehatan',
    kategori: 'Kunjungan Antenatal',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'KIA'
  },
  {
    kode_icd10: 'Z30.0',
    nama_diagnosis: 'Konseling dan Pelayanan Kontrasepsi Umum (KB)',
    bab: 'Faktor yang Mempengaruhi Status Kesehatan',
    kategori: 'Keluarga Berencana',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'KB'
  },

  // --- SISTEM PENCERNAAN & KESEHATAN GIGI ---
  {
    kode_icd10: 'K29.7',
    nama_diagnosis: 'Gastritis Tidak Spesifik (Maag)',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Penyakit Lambung',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'K30',
    nama_diagnosis: 'Dispepsia Fungsional',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Penyakit Lambung',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'K02.9',
    nama_diagnosis: 'Karies Gigi Tidak Spesifik (Gigi Berlubang)',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Kesehatan Gigi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'GIGI'
  },
  {
    kode_icd10: 'K04.0',
    nama_diagnosis: 'Pulpitis Akut / Kronis',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Kesehatan Gigi',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'GIGI'
  },
  {
    kode_icd10: 'K05.3',
    nama_diagnosis: 'Periodontitis Kronis',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Kesehatan Gigi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'GIGI'
  },
  {
    kode_icd10: 'K05.1',
    nama_diagnosis: 'Gingivitis Kronis (Radang Gusi)',
    bab: 'Penyakit Sistem Pencernaan',
    kategori: 'Kesehatan Gigi',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'GIGI'
  },

  // --- KULIT, ALERGI & MATA ---
  {
    kode_icd10: 'L20.9',
    nama_diagnosis: 'Dermatitis Atopik Tidak Spesifik (Eksim Alergi)',
    bab: 'Penyakit Kulit dan Jaringan Subkutan',
    kategori: 'Alergi Kulit',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'L23.9',
    nama_diagnosis: 'Dermatitis Kontak Alergi (DKA)',
    bab: 'Penyakit Kulit dan Jaringan Subkutan',
    kategori: 'Alergi Kulit',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'L50.9',
    nama_diagnosis: 'Urtikaria Tidak Spesifik (Biduran / Kaligata)',
    bab: 'Penyakit Kulit dan Jaringan Subkutan',
    kategori: 'Alergi',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'B86',
    nama_diagnosis: 'Skabies (Kudis / Gudik Sarcoptes scabiei)',
    bab: 'Penyakit Infeksi dan Parasit',
    kategori: 'Infestasi Parasit Kulit',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'H10.9',
    nama_diagnosis: 'Konjungtivitis Akut Tidak Spesifik (Mata Merah Belekan)',
    bab: 'Penyakit Mata dan Adneksa',
    kategori: 'Infeksi Mata',
    penyakit_menular: true,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },

  // --- KESEHATAN JIWA & NEUROLOGI ---
  {
    kode_icd10: 'F32.9',
    nama_diagnosis: 'Episode Depresi Mayor Tidak Spesifik',
    bab: 'Gangguan Jiwa dan Perilaku',
    kategori: 'Kesehatan Jiwa',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'JIWA'
  },
  {
    kode_icd10: 'F41.9',
    nama_diagnosis: 'Gangguan Cemas (Anxiety Disorder) Tidak Spesifik',
    bab: 'Gangguan Jiwa dan Perilaku',
    kategori: 'Kesehatan Jiwa',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'JIWA'
  },
  {
    kode_icd10: 'F20.9',
    nama_diagnosis: 'Skizofrenia Tidak Spesifik (ODGJ Berat)',
    bab: 'Gangguan Jiwa dan Perilaku',
    kategori: 'Kesehatan Jiwa',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: true,
    kode_program: 'JIWA'
  },
  {
    kode_icd10: 'G40.9',
    nama_diagnosis: 'Epilepsi Tidak Spesifik',
    bab: 'Penyakit Sistem Saraf',
    kategori: 'Neurologi',
    penyakit_menular: false,
    penyakit_kronis: true,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },

  // --- TRAUMA, KEMATIAN, & TINDAKAN KESEHATAN UMUM ---
  {
    kode_icd10: 'R50.9',
    nama_diagnosis: 'Demam Febris Tidak Diketahui Penyebabnya (FUO)',
    bab: 'Gejala, Tanda dan Hasil Klinis Abnormal',
    kategori: 'Gejala Umum',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'S06.9',
    nama_diagnosis: 'Cedera Kepala Tertutup Ringan / Sedang (Commotio Cerebri)',
    bab: 'Cedera, Keracunan dan Konsekuensi Eksternal',
    kategori: 'Traumatologi Kepala',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'TRAUMA'
  },
  {
    kode_icd10: 'T14.1',
    nama_diagnosis: 'Luka Terbuka pada Daerah Tubuh Tidak Spesifik (Vulnus Laceratum)',
    bab: 'Cedera, Keracunan dan Konsekuensi Eksternal',
    kategori: 'Traumatologi',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'TRAUMA'
  },
  {
    kode_icd10: 'Z00.0',
    nama_diagnosis: 'Pemeriksaan Kesehatan Umum / Skrining (Medical Check-Up)',
    bab: 'Faktor yang Mempengaruhi Status Kesehatan',
    kategori: 'Skrining Kesehatan',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: false,
    kode_program: 'UMUM'
  },
  {
    kode_icd10: 'Z23',
    nama_diagnosis: 'Kunjungan Pelayanan Imunisasi / Vaksinasi Rutin',
    bab: 'Faktor yang Mempengaruhi Status Kesehatan',
    kategori: 'Imunisasi',
    penyakit_menular: false,
    penyakit_kronis: false,
    wajib_lapor: true,
    kode_program: 'IMUNISASI'
  }
];

// ==============================================================
// RUNNER UTAMA SEEDER
// ==============================================================
async function seedPemeriksaanLengkap() {
  console.log('🚀 Memulai Seeding Komprehensif Seluruh Kebutuhan Pemeriksaan Dokter & Perawat...');

  // ------------------------------------------------------------
  // 1. SEED MASTER ALERGI
  // ------------------------------------------------------------
  console.log(`\n🛡️ [1/6] Seeding Master Alergi (${dataAlergi.length} items)...`);
  let alergiSuccess = 0;
  for (const item of dataAlergi) {
    await prisma.masterAlergi.upsert({
      where: { kode_snomed: item.kode_snomed },
      update: {
        nama_alergi: item.nama_alergi,
        kategori: item.kategori,
        status_aktif: true
      },
      create: {
        kode_snomed: item.kode_snomed,
        nama_alergi: item.nama_alergi,
        kategori: item.kategori,
        status_aktif: true
      }
    });
    alergiSuccess++;
  }
  console.log(`✅ Berhasil seed ${alergiSuccess} Master Alergi (Makanan, Obat/KFA, Lingkungan, Biologik/Kontak).`);

  // ------------------------------------------------------------
  // 2. SEED MASTER VAKSIN & BATCH VAKSIN LOGISTIK COLD-CHAIN
  // ------------------------------------------------------------
  console.log(`\n💉 [2/6] Seeding Master Vaksin & Batch Cold-Chain (${dataVaksin.length} jenis vaksin)...`);
  const faskesList = await prisma.faskes.findMany();
  if (faskesList.length === 0) {
    console.warn('⚠️ Peringatan: Tidak ditemukan Faskes di database. Batch vaksin tidak dapat dikaitkan.');
  }

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000); // 40 hari (Mendekati ED - FEFO Alert)
  const nextThreeMonths = new Date(now.getTime() + 80 * 24 * 60 * 60 * 1000); // 80 hari (Waspada)
  const nextYear = new Date(now.getTime() + 380 * 24 * 60 * 60 * 1000); // 1 tahun (Aman)
  const nextTwoYears = new Date(now.getTime() + 720 * 24 * 60 * 60 * 1000); // 2 tahun (Aman)

  let vaksinSuccess = 0;
  let batchSuccess = 0;

  for (let idx = 0; idx < dataVaksin.length; idx++) {
    const v = dataVaksin[idx];
    const createdVaksin = await prisma.masterVaksin.upsert({
      where: { kodeKfa: v.kodeKfa },
      update: {
        namaVaksin: v.namaVaksin,
        targetPenyakit: v.targetPenyakit,
        statusAktif: true
      },
      create: {
        kodeKfa: v.kodeKfa,
        namaVaksin: v.namaVaksin,
        targetPenyakit: v.targetPenyakit,
        statusAktif: true
      }
    });
    vaksinSuccess++;

    // Alokasikan Batch Vaksin ke seluruh Faskes di database
    for (const faskes of faskesList) {
      const isCibinong = faskes.namaFaskes.toLowerCase().includes('cibinong');
      const faskesCode = isCibinong ? 'CBN' : 'SKM';

      // Simulasikan variasi stok & tanggal kedaluwarsa untuk demo Dashboard & GIS Dinkes
      // Contoh: Pentabio & Campak Rubella dibuat kritis di faskes terpencil Sukamakmur untuk memicu alert stok Dinkes
      const isCritical = (!isCibinong && (idx === 2 || idx === 7)) || (isCibinong && idx === 4);
      const isExpiringSoon = idx === 4 || idx === 10;

      const expDate = isExpiringSoon ? nextMonth : (idx % 2 === 0 ? nextThreeMonths : (idx % 3 === 0 ? nextYear : nextTwoYears));
      const stokVaksin = isCritical ? 6 : (25 + (idx * 5) % 40);
      const stokMin = isCritical ? 15 : 10;
      const suhu = v.kodeKfa === '9300401' ? '-20°C s/d -15°C' : '2-8°C';

      const lotNo = `BIO-${v.kodeKfa}-${faskesCode}-2026`;

      await prisma.batchVaksin.upsert({
        where: {
          faskesId_vaksinId_noBatch: {
            faskesId: faskes.id,
            vaksinId: createdVaksin.id,
            noBatch: lotNo
          }
        },
        update: {
          tanggalExpired: expDate,
          stok: stokVaksin,
          stokMinimum: stokMin,
          suhuPenyimpanan: suhu,
          statusAktif: true
        },
        create: {
          faskesId: faskes.id,
          vaksinId: createdVaksin.id,
          noBatch: lotNo,
          tanggalExpired: expDate,
          stok: stokVaksin,
          stokMinimum: stokMin,
          suhuPenyimpanan: suhu,
          statusAktif: true
        }
      });
      batchSuccess++;
    }
  }
  console.log(`✅ Berhasil seed ${vaksinSuccess} Master Vaksin & ${batchSuccess} Batch Cold-Chain ke seluruh Faskes.`);

  // ------------------------------------------------------------
  // 3. SEED MASTER LABORATORIUM
  // ------------------------------------------------------------
  console.log(`\n🧪 [3/6] Seeding Master Laboratorium (${dataLaboratorium.length} parameter)...`);
  let labSuccess = 0;
  for (const lab of dataLaboratorium) {
    const existing = await prisma.masterLaboratorium.findFirst({
      where: {
        kategori: lab.kategori,
        parameter: lab.parameter
      }
    });

    if (existing) {
      await prisma.masterLaboratorium.update({
        where: { id: existing.id },
        data: {
          satuan: lab.satuan,
          nilaiRujukan: lab.nilaiRujukan,
          kodePanelLab: lab.kodePanelLab,
          hargaTarif: lab.hargaTarif,
          tersediaInternal: lab.tersediaInternal,
          statusAktif: true
        }
      });
    } else {
      await prisma.masterLaboratorium.create({
        data: {
          kategori: lab.kategori,
          parameter: lab.parameter,
          satuan: lab.satuan,
          nilaiRujukan: lab.nilaiRujukan,
          kodePanelLab: lab.kodePanelLab,
          hargaTarif: lab.hargaTarif,
          tersediaInternal: lab.tersediaInternal,
          statusAktif: true
        }
      });
    }
    labSuccess++;
  }
  console.log(`✅ Berhasil seed ${labSuccess} Master Pemeriksaan Laboratorium.`);

  // ------------------------------------------------------------
  // 4. SEED MASTER MODALITY RADIOLOGI
  // ------------------------------------------------------------
  console.log(`\n☢️ [4/6] Seeding Master Modality Radiologi (${dataModality.length} modalitas)...`);
  let modSuccess = 0;
  for (const mod of dataModality) {
    await prisma.masterModality.upsert({
      where: { kodeDicom: mod.kodeDicom },
      update: {
        namaModality: mod.namaModality,
        deskripsi: mod.deskripsi,
        tersediaInternal: mod.tersediaInternal,
        statusAktif: true
      },
      create: {
        kodeDicom: mod.kodeDicom,
        namaModality: mod.namaModality,
        deskripsi: mod.deskripsi,
        tersediaInternal: mod.tersediaInternal,
        statusAktif: true
      }
    });
    modSuccess++;
  }
  console.log(`✅ Berhasil seed ${modSuccess} Master Modality Radiologi.`);

  // ------------------------------------------------------------
  // 5. SEED MASTER PROSEDUR (ICD-9-CM)
  // ------------------------------------------------------------
  console.log(`\n📋 [5/6] Seeding Master Prosedur ICD-9-CM (${dataICD9.length} tindakan)...`);
  let icd9Success = 0;
  for (const p of dataICD9) {
    await prisma.masterICD9.upsert({
      where: { kode_icd9: p.kode_icd9 },
      update: {
        nama_prosedur: p.nama_prosedur,
        kategori: p.kategori
      },
      create: {
        kode_icd9: p.kode_icd9,
        nama_prosedur: p.nama_prosedur,
        kategori: p.kategori
      }
    });
    icd9Success++;
  }
  console.log(`✅ Berhasil seed ${icd9Success} Master Prosedur / Tindakan Medis (ICD-9-CM).`);

  // ------------------------------------------------------------
  // 6. SEED MASTER DIAGNOSA (ICD-10) LENGKAP PENUNJANG GIS DINKES
  // ------------------------------------------------------------
  console.log(`\n🗺️ [6/6] Seeding Master Diagnosa ICD-10 (${dataICD10.length} diagnosa terintegrasi Dinkes)...`);
  let icd10Success = 0;
  for (const d of dataICD10) {
    await prisma.masterICD10.upsert({
      where: { kode_icd10: d.kode_icd10 },
      update: {
        nama_diagnosis: d.nama_diagnosis,
        bab: d.bab,
        kategori: d.kategori,
        penyakit_menular: d.penyakit_menular,
        penyakit_kronis: d.penyakit_kronis,
        wajib_lapor: d.wajib_lapor,
        kode_program: d.kode_program,
        status_aktif: true
      },
      create: {
        kode_icd10: d.kode_icd10,
        nama_diagnosis: d.nama_diagnosis,
        bab: d.bab,
        kategori: d.kategori,
        penyakit_menular: d.penyakit_menular,
        penyakit_kronis: d.penyakit_kronis,
        wajib_lapor: d.wajib_lapor,
        kode_program: d.kode_program,
        status_aktif: true
      }
    });
    icd10Success++;
  }
  console.log(`✅ Berhasil seed ${icd10Success} Master Diagnosa ICD-10 lengkap dengan klasifikasi Program Dinkes.`);

  console.log('\n🎉 SELURUH SEEDER KEBUTUHAN PEMERIKSAAN DOKTER & PERAWAT SELESAI 100%!');
}

if (require.main === module) {
  seedPemeriksaanLengkap()
    .catch((err) => {
      console.error('❌ Error fatal saat menjalankan seeder pemeriksaan lengkap:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedPemeriksaanLengkap };
