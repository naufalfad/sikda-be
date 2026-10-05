const OpenAI = require('openai');
const dinkesService = require('./dinkes.service');
const prisma = require('../config/prisma');

/**
 * Service AI Automated Executive Report & Briefing untuk Modul Dinas Kesehatan (Dinkes)
 * 
 * STRICT CONSTRAINTS:
 * 1. Zero PII: Hanya mengirim data agregat, statistik, rasio, dan data teknis fasilitas.
 * 2. Tanpa referensi/keterlibatan SATUSEHAT (FHIR R4) atau BPJS (PCare).
 * 3. Fokus operasional internal: Kunjungan, SDMK, BOR, Logistik FEFO, Kondisi Alkes, Tren ICD-10.
 */

// Inisialisasi client OpenAI secara aman
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY belum dikonfigurasi pada server environment.');
    err.statusCode = 500;
    throw err;
  }
  return new OpenAI({
    apiKey,
    timeout: 60000 // 60 detik timeout
  });
};

/**
 * Normalisasi format tabel Markdown agar selalu memiliki baris terpisah
 * dan diawali dengan double newline, sehingga diparsing menjadi HTML table dengan benar.
 */
const normalizeMarkdownTables = (content) => {
  if (!content || typeof content !== 'string') return '';

  let text = content;

  // 1. Transform any "Sajikan / Berikut Tabel X:" or "- Sajikan Tabel X:" into a clean markdown heading "### Tabel X\n\n|"
  text = text.replace(
    /(?:^|\n)\s*[-*]?\s*(?:(?:Sajikan|Berikut(?: adalah)?)\s+)?(?:\*\*)?(Tabel[^*\n:|]+)(?:\*\*)?:?\s*\|/gi,
    (match, title) => `\n\n### ${title.trim()}\n\n|`
  );

  // If a heading like "### Tabel ..." is directly followed by "|" without newlines
  text = text.replace(/(###\s*[^\n|]+?)\s*\|/g, '$1\n\n|');

  // 2. Process line by line
  const lines = text.split('\n');
  const processedLines = [];
  let inCodeBlock = false;

  for (let rawLine of lines) {
    let line = rawLine;

    // Track code blocks (e.g. ```mermaid) so we don't alter code block lines
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      processedLines.push(line);
      continue;
    }

    // Check if line contains a table delimiter: |---|---|
    const delimMatch = line.match(/\|(?:\s*:?-{2,}:?\s*\|)+/);

    if (delimMatch) {
      // Extract prefix text before the table if any (e.g. "Catatan: | col1 | col2 |")
      const firstPipeIdx = line.indexOf('|');
      if (firstPipeIdx > 0) {
        const prefix = line.substring(0, firstPipeIdx).trim();
        if (prefix.length > 0) {
          processedLines.push(prefix);
          processedLines.push('');
        }
        line = line.substring(firstPipeIdx);
      }

      // Separate delimiter from previous text/header and subsequent text/data
      line = line.replace(/(\|\s*)(\|(?:\s*:?-+:?\s*\|)+)/g, '$1\n$2\n');
      line = line.replace(/((\|(?:(?:\s*:?-+:?\s*)\|)+)\s*)(\|)/g, '$1\n$3');

      // Separate rows by | | or ||
      line = line.replace(/\|\s*\|/g, '|\n|');

      const splitSubLines = line.split('\n');
      for (const sub of splitSubLines) {
        const trimmedSub = sub.trim();
        if (trimmedSub) {
          processedLines.push(trimmedSub);
        }
      }
    } else {
      // If line doesn't contain delimiter, but contains "| ... | | ... |"
      if (line.includes('|') && line.match(/\|\s*\|/)) {
        line = line.replace(/\|\s*\|/g, '|\n|');
        const splitSubLines = line.split('\n');
        for (const sub of splitSubLines) {
          const trimmedSub = sub.trim();
          if (trimmedSub) {
            processedLines.push(trimmedSub);
          }
        }
      } else {
        processedLines.push(line);
      }
    }
  }

  // 3. Ensure proper spacing around tables for GFM / remark-gfm:
  // - A blank line before the table header
  // - A blank line after the table
  const finalLines = [];
  inCodeBlock = false;
  for (let i = 0; i < processedLines.length; i++) {
    const cur = processedLines[i];
    const trimmed = cur.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      finalLines.push(cur);
      continue;
    }

    if (inCodeBlock) {
      finalLines.push(cur);
      continue;
    }

    const isTableLine = trimmed.startsWith('|') && trimmed.endsWith('|');

    if (isTableLine) {
      // Check if previous line is non-table and non-empty
      if (finalLines.length > 0) {
        const prev = finalLines[finalLines.length - 1].trim();
        if (prev.length > 0 && !(prev.startsWith('|') && prev.endsWith('|'))) {
          finalLines.push('');
        }
      }
      finalLines.push(trimmed);

      // Check if next line is non-table and non-empty
      if (i < processedLines.length - 1) {
        const next = processedLines[i + 1].trim();
        if (next.length > 0 && !(next.startsWith('|') && next.endsWith('|'))) {
          finalLines.push('');
        }
      }
    } else {
      finalLines.push(cur);
    }
  }

  // 4. Clean stray "Sajikan" commands at start of lines
  let result = finalLines.join('\n');
  result = result.replace(/^[ \t]*[-*]?\s*Sajikan\s+/gim, '');

  return result.trim();
};

/**
 * Cakupan A: Laporan Eksekutif Kinerja & Audit Fasilitas Tunggal (Single Faskes)
 * @param {string} faskesId 
 * @param {object} options { startDate, endDate }
 */
const generateFaskesReport = async (faskesId, options = {}) => {
  // 1. Ambil data analitik faskes melalui dinkesService
  const faskesRaw = await dinkesService.getFaskesById(faskesId);
  if (!faskesRaw) {
    const err = new Error('Data Fasilitas Kesehatan tidak ditemukan.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Ambil tren penyakit ICD-10 untuk faskes ini
  const surveillance = await dinkesService.getDiseaseSurveillance({
    faskesId,
    startDate: options.startDate,
    endDate: options.endDate,
    limit: 10
  });

  // 3. Sanitasi & De-identifikasi Data Agregat (STRICT: ZERO PII)
  const profil = faskesRaw.profil || faskesRaw;
  const ringkasan = faskesRaw.ringkasanEksekutif || {};
  const sdmk = faskesRaw.sdmk || {};
  const asetAlkes = faskesRaw.asetAlkes || {};
  const bedRuangan = faskesRaw.tempatTidurRuangan || {};
  const logistikData = faskesRaw.logistik || {};

  // Nakes list aktual (ambil dari sdmk.daftarNakes atau tenagaMedis)
  const nakesList = faskesRaw.sdmk?.daftarNakes || faskesRaw.tenagaMedis || [];
  const dokters = nakesList.filter(n => (n.profesi && n.profesi.toUpperCase().includes('DOKTER')) || n.spesialis);
  const perawats = nakesList.filter(n => n.profesi && n.profesi.toUpperCase().includes('PERAWAT'));
  const bidans = nakesList.filter(n => n.profesi && n.profesi.toUpperCase().includes('BIDAN'));
  const apotekers = nakesList.filter(n => n.profesi && (n.profesi.toUpperCase().includes('APOTEKER') || n.profesi.toUpperCase().includes('FARMASI')));

  const rincianNakesList = nakesList.map(n => ({
    nama: n.namaLengkap || n.user?.namaLengkap || n.nama || 'Tenaga Medis',
    profesi: n.profesi,
    spesialis: n.spesialis || '-',
    statusAktif: n.statusAktif ? 'Aktif Bertugas' : 'Non-Aktif'
  }));

  // Farmasi & BMHP Lengkap
  const allStok = [
    ...(logistikData.daftarObat || []),
    ...(logistikData.daftarBmhp || []),
    ...(faskesRaw.stokObat || [])
  ];

  const obatKritis = allStok
    .filter(s => s.statusStok === 'KRITIS' || s.stok <= (s.stokMinimum || 10))
    .map(s => {
      const stokAktual = s.stok ?? s.stokSaatIni ?? 0;
      const min = s.stokMinimum ?? 10;
      return {
        namaItem: s.namaObat || s.namaBmhp || s.obat?.namaObat || 'Item Logistik',
        kategori: s.kategori || s.obat?.kategori || 'FARMASI',
        stokSaatIni: stokAktual,
        stokMinimum: min,
        defisit: Math.max(0, min - stokAktual),
        satuan: s.sediaan || s.satuan || s.obat?.satuan || 'Unit'
      };
    });

  const now = new Date();
  const ninetyDaysLater = new Date();
  ninetyDaysLater.setDate(now.getDate() + 90);

  const obatMendekatiExpired = allStok
    .filter(s => s.tanggalExpired && new Date(s.tanggalExpired) <= ninetyDaysLater && (s.stok > 0 || s.stokSaatIni > 0))
    .slice(0, 15)
    .map(s => {
      const expDate = new Date(s.tanggalExpired);
      const sisaHari = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        namaItem: s.namaObat || s.namaBmhp || s.obat?.namaObat || 'Item Logistik',
        noBatch: s.noBatch || '-',
        stok: s.stok ?? s.stokSaatIni ?? 0,
        sisaHari: sisaHari > 0 ? `${sisaHari} hari` : 'Sudah Kadaluwarsa',
        tanggalExpired: expDate.toISOString().split('T')[0]
      };
    });

  // Vaksin
  const batchVaksin = faskesRaw.batchVaksin || [];
  const vaksinKritis = batchVaksin
    .filter(b => b.stok <= (b.stokMinimum || 10) || (b.tanggalExpired && new Date(b.tanggalExpired) <= ninetyDaysLater))
    .slice(0, 10)
    .map(b => ({
      namaVaksin: b.namaVaksin || b.vaksin?.namaVaksin || 'Vaksin',
      targetPenyakit: b.targetPenyakit || b.vaksin?.targetPenyakit || '-',
      stok: b.stok,
      stokMinimum: b.stokMinimum,
      tanggalExpired: b.tanggalExpired ? new Date(b.tanggalExpired).toISOString().split('T')[0] : '-'
    }));

  // Alkes & Aset Lengkap
  const rawAsetList = asetAlkes.daftarAset || faskesRaw.asets || [];
  const semuaAlkes = rawAsetList.map(a => ({
    namaAset: a.namaAset,
    kodeAset: a.kodeAset,
    ruangan: a.ruangan?.namaRuangan || a.ruangan || 'Umum',
    kondisi: a.kondisiAset || a.kondisi || 'BAIK',
    statusOperasional: a.statusOperasional || 'AKTIF_DIGUNAKAN',
    kalibrasiExpired: a.kalibrasiExpired ? new Date(a.kalibrasiExpired).toISOString().split('T')[0] : null
  }));

  const alkesKritisRusak = rawAsetList
    .filter(a => {
      const k = a.kondisiAset || a.kondisi;
      return k === 'RUSAK_BERAT' || k === 'RUSAK_RINGAN' || a.statusOperasional !== 'AKTIF_DIGUNAKAN';
    })
    .map(a => ({
      namaAset: a.namaAset,
      kodeAset: a.kodeAset,
      ruangan: a.ruangan?.namaRuangan || a.ruangan || 'Umum',
      kondisi: a.kondisiAset || a.kondisi,
      statusOperasional: a.statusOperasional
    }));

  const kalibrasiAlerts = (asetAlkes.kalibrasiAlerts || faskesRaw.kalibrasiAlerts || []).map(k => ({
    namaAset: k.namaAset,
    ruangan: k.ruangan || '-',
    status: k.status,
    expiredDate: k.expiredDate ? new Date(k.expiredDate).toISOString().split('T')[0] : '-'
  }));

  // Rincian Tempat Tidur Fisik Aktual
  const rincianBedList = [];
  const ruanganList = bedRuangan.daftarRuangan || faskesRaw.ruangans || [];
  ruanganList.forEach(r => {
    (r.tempatTidurs || []).forEach(b => {
      rincianBedList.push({
        nomorBed: b.nomorBed,
        ruangan: r.namaRuangan,
        kelas: b.kelasKamar,
        status: b.statusBed
      });
    });
  });

  // Ringkasan Tempat Tidur
  const tempatTidurSummary = {
    totalBed: bedRuangan.totalBed || ringkasan.totalBed || faskesRaw.totalBed || rincianBedList.length || 0,
    bedTerisi: bedRuangan.bedTerisi || ringkasan.bedTerisi || faskesRaw.bedTerisi || rincianBedList.filter(b => b.status === 'TERISI').length || 0,
    bedTersedia: bedRuangan.bedTersedia || ringkasan.bedTersedia || faskesRaw.bedTersedia || rincianBedList.filter(b => b.status === 'TERSEDIA').length || 0,
    bedPerbaikan: bedRuangan.bedPerbaikan || ringkasan.bedPerbaikan || faskesRaw.bedPerbaikan || 0,
    bor: bedRuangan.bor || ringkasan.bor || `${faskesRaw.bor || 0}%`,
    rincianBedList
  };

  // Metrik terstruktur untuk prompt dan respon
  const rawMetrics = {
    profilFaskes: {
      id: profil.id,
      namaFaskes: profil.namaFaskes,
      kodeFaskes: profil.kodeFaskes,
      jenisFaskes: profil.jenisFaskes,
      kecamatan: profil.kecamatan || profil.wilayahKecamatan,
      kategoriWilayah: profil.kategoriWilayah || 'Perkotaan',
      targetKunjunganHarian: profil.targetKunjunganHarian || 0
    },
    bebanKerjaSDMK: {
      totalNakes: sdmk.totalNakes || nakesList.length,
      jumlahDokter: sdmk.totalDokter || dokters.length,
      jumlahPerawat: sdmk.totalPerawat || perawats.length,
      jumlahBidan: sdmk.totalBidan || bidans.length,
      jumlahApoteker: sdmk.totalApoteker || apotekers.length,
      kunjunganHariIni: ringkasan.totalPasienHariIni || faskesRaw.totalPasienHariIni || 0,
      kunjunganBulanIni: ringkasan.totalPasienBulanIni || faskesRaw.totalPasienBulanIni || 0,
      rasioPasienPerDokter: sdmk.rasioPasienPerDokter || ringkasan.rasioPasienPerDokter || faskesRaw.rasioPasienPerDokter || 0,
      statusBebanKerja: sdmk.statusBebanKerja || ringkasan.statusBebanKerja || 'NORMAL',
      daftarTenagaMedis: rincianNakesList
    },
    tempatTidurBOR: tempatTidurSummary,
    asetSarprasAlkes: {
      totalAset: rawAsetList.length,
      totalAlkesMedis: semuaAlkes.length,
      semuaAlkes,
      alkesKritisRusak,
      kalibrasiAlerts
    },
    farmasiVaksin: {
      totalJenisItem: allStok.length,
      obatKritisCount: obatKritis.length,
      daftarObatKritis: obatKritis,
      obatMendekatiExpiredCount: obatMendekatiExpired.length,
      daftarObatMendekatiExpired: obatMendekatiExpired,
      totalBatchVaksin: batchVaksin.length,
      daftarVaksinKritis: vaksinKritis
    },
    surveilansPenyakit: {
      totalKasusPeriode: surveillance.totalKasusPeriode || 0,
      top10ICD10: (surveillance.topPenyakit || []).map(p => ({
        peringkat: p.peringkat,
        kode: p.kodeIcd10,
        diagnosis: p.namaDiagnosis,
        jumlahKasus: p.jumlahKasus,
        persentase: p.persentase,
        isPenyakitMenular: p.isPenyakitMenular,
        isWajibLapor: p.isWajibLapor
      }))
    }
  };

  // 4. Siapkan Prompt untuk AI (Granular, Highly Informative, Zero Clutter)
  const prompt = `Anda adalah Lead Healthcare Operations Auditor Dinas Kesehatan Kabupaten Bogor.
Tugas Anda adalah menyusun "Laporan Audit Operasional & Kelaikan Fasilitas Kesehatan" yang SANGAT INFORMATIF, MENDALAM, TERPERINCI, ANALITIS, dan BERBOBOT MANAJERIAL untuk Kepala Dinas Kesehatan dan Kepala Puskesmas.

[DATA AKTUAL LENGKAP FASILITAS DARI DATABASE SIKDA]:
${JSON.stringify(rawMetrics, null, 2)}

[ATURAN MUTLAK PENULISAN & FORMAT TABEL]:
1. PRINSIP ZERO-HALLUCINATION & STRICT FACTUAL GROUNDING:
   - Anda WAJIB menggunakan data aktual di atas. Sebutkan nama-nama dokter dan tenaga medis nyata, nama dan kode alat kesehatan nyata beserta ruangannya, nomor bed fisik nyata beserta statusnya, nama obat defisit beserta angka stok & selisihnya, serta diagnosis ICD-10 beserta angka kasus nyata.
   - JANGAN mengarang data, alat, atau angka yang tidak ada pada JSON.
2. HILANGKAN SEMUA TEKS BASA-BASI / CLUTTER / AKADEMIS:
   - DILARANG KERAS mencantumkan teks: "ACM reference format", "CCS Concepts", "Keywords", "DOI", sitasi prosiding, volume jurnal, atau kata-kata akademis lainnya.
   - DILARANG membuat flowchart alur umum pelayanan ("Pasien Datang -> Pendaftaran -> Triase -> Poli...").
   - Dokumen ini adalah DOKUMEN PEMERINTAH / DINAS KESEHATAN RESMI, bukan karya ilmiah.
3. KAYA INFORMASI & SANGAT TERPERINCI:
   - Berikan uraian analitis mendalam pada setiap bab: jelaskan penyebab capaian angka, risiko klinis pada pasien, serta rekomendasi taktis.
4. ATURAN STRUKTUR TABEL MARKDOWN:
   - Setiap tabel WAJIB diawali dengan BARIS KOSONG BARU (double newline \\n\\n).
   - Tulis judul tabel menggunakan heading level 3 (contoh: ### Tabel Rapor Indikator Operasional Kunci).
   - Setiap baris tabel (Header Kolom, Pembatas |---|---|, dan seluruh Baris Data) WAJIB DITULIS PADA BARISNYA MASING-MASING SECARA TERPISAH (menggunakan karakter newline \\n).
   - DILARANG KERAS menggabungkan baris tabel ke dalam satu baris panjang!
   - DILARANG menulis kata pengantar perintah seperti "Sajikan Tabel..." atau "Berikut adalah tabel:". Cukup tulis heading tabel (### ...) lalu baris tabelnya.

Susun naskah laporan dengan urutan judul dan struktur berikut:

# LAPORAN AUDIT OPERASIONAL & KELAIKAN FASILITAS: ${rawMetrics.profilFaskes.namaFaskes.toUpperCase()}
**Fasilitas**: ${rawMetrics.profilFaskes.namaFaskes} (${rawMetrics.profilFaskes.jenisFaskes}) • **Kecamatan**: ${rawMetrics.profilFaskes.kecamatan} • **Kode Faskes**: ${rawMetrics.profilFaskes.kodeFaskes}

---

> **RINGKASAN EKSEKUTIF**  
> (Tulis 2 paragraf komprehensif, padat data, dan berbobot yang merangkum kondisi fasilitas: perbandingan utilisasi kunjungan terhadap kapasitas, kondisi kelaikan sarpras alkes, beban dokter vs pasien, ketersediaan tempat tidur, kesiapan logistik farmasi, serta isu prioritas yang wajib ditindaklanjuti pimpinan).

---

## 1. PROFIL OPERASIONAL & UTILISASI PELAYANAN FASKES
- Analisis capaian trafik pelayanan: ${rawMetrics.bebanKerjaSDMK.kunjunganHariIni} pasien hari ini dan ${rawMetrics.bebanKerjaSDMK.kunjunganBulanIni} pasien bulan ini terhadap target operasional harian (${rawMetrics.profilFaskes.targetKunjunganHarian} pasien/hari). Ulas utilisasi kapasitas klinik dan faktor penyebabnya.

### Tabel Rapor Indikator Operasional Kunci
| Indikator Kunci | Realisasi Aktual | Target / Standar Operasional | Evaluasi Capaian & Analisis Kritis |
| :--- | :--- | :--- | :--- |

## 2. AUDIT KELAIKAN ALAT KESEHATAN & SARANA PRASARANA
- Analisis kelaikan seluruh alat medis yang terdata (${rawMetrics.asetSarprasAlkes.totalAlkesMedis} unit alkes).
- Rinci alat yang mengalami kerusakan, kondisi aus, atau memerlukan pemeliharaan (${JSON.stringify(rawMetrics.asetSarprasAlkes.alkesKritisRusak)}). Ulas ruangan penempatan dan dampak gangguan alat terhadap pelayanan poli terkait.
- Ulas peringatan kalibrasi jika ada: ${JSON.stringify(rawMetrics.asetSarprasAlkes.kalibrasiAlerts)}.

### Tabel Inventaris Kelaikan Alat Kesehatan Vital
| Kode Aset | Nama Alat Kesehatan | Ruangan Penempatan | Kondisi Fisik | Status Operasional | Dampak Mutu & Layanan Klinis |
| :--- | :--- | :--- | :--- | :--- | :--- |

## 3. ANALISIS BEBAN KERJA TENAGA MEDIS (SDMK) & KETERSEDIAAN TEMPAT TIDUR
- Ulas formasi tenaga medis: sebutkan seluruh nama dokter (${rawMetrics.bebanKerjaSDMK.jumlahDokter} dokter), perawat, bidan, dan staf yang bertugas dari data aktual: ${JSON.stringify(rawMetrics.bebanKerjaSDMK.daftarTenagaMedis)}.
- Analisis rasio beban kerja: ${rawMetrics.bebanKerjaSDMK.rasioPasienPerDokter} pasien per dokter. Evaluasi waktu rata-rata pemeriksaan per pasien dan potensi keletihan (burnout) atau kapasitas berlebih.
- Ulas ketersediaan tempat tidur rawat: total ${rawMetrics.tempatTidurBOR.totalBed} bed, ${rawMetrics.tempatTidurBOR.bedTerisi} terisi, ${rawMetrics.tempatTidurBOR.bedTersedia} tersedia (BOR: ${rawMetrics.tempatTidurBOR.bor}).

### Tabel Status Rincian Tempat Tidur Fisik
| Nomor Bed | Ruangan | Kelas Kamar | Status Keterisian | Keterangan Klinis |
| :--- | :--- | :--- | :--- | :--- |

## 4. TATA KELOLA LOGISTIK FARMASI & PENGAWASAN KEDALUWARSA (FEFO)
- Evaluasi ketersediaan obat dan BMHP. Identifikasi item yang berada di bawah buffer stock minimum (${rawMetrics.farmasiVaksin.obatKritisCount} item kritis).
- Rinci nama obat/BMHP kritis, stok saat ini, stok minimum, dan angka defisit riil (${JSON.stringify(rawMetrics.farmasiVaksin.daftarObatKritis)}).
- Analisis obat yang mendekati kedaluwarsa (${rawMetrics.farmasiVaksin.obatMendekatiExpiredCount} item) untuk penerapan First-Expired First-Out (FEFO) atau rencana retur/redistribusi.

### Tabel Matriks Logistik Obat Kritis & Pengawasan FEFO
| Nama Obat / BMHP | Kategori | Stok Aktual | Stok Minimum | Defisit Kebutuhan | Status Logistik | Tindakan Pengamanan Stok |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |

## 5. SURVEILANS MORBIDITAS (ICD-10) & KESIAPAN TERAPI KLINIS
- Analisis pola 10 besar diagnosis penyakit berdasarkan catatan rekam medis (${rawMetrics.surveilansPenyakit.totalKasusPeriode} total kasus terverifikasi).
- Ulas keterkaitan antara penyakit terbanyak dengan kecukupan stok obat di instalasi farmasi (misalnya ketersediaan antibiotik untuk ISPA, antihipertensi untuk I10, rehidrasi untuk diare).
- Berikan penekanan khusus pada penyakit menular dan kasus wajib lapor (surveilans KLB).

### Tabel 10 Besar Morbiditas ICD-10
| Peringkat | Kode ICD-10 | Nama Diagnosis Klinis | Kasus Terverifikasi | Proporsi Kasus (%) | Karakteristik Epidemiologi |
| :--- | :--- | :--- | :--- | :--- | :--- |

## 6. DIREKTIF MANAJERIAL & RENCANA AKSI OPERASIONAL
- **Rencana Tindakan Cito 1x24 Jam**: Langkah darurat spesifik yang harus dieksekusi hari ini oleh Kepala Puskesmas beserta penanggung jawab (PIC) untuk mengatasi defisit stok dan perbaikan alkes rusak.
- **Rencana Strategis 7 - 30 Hari**: Agenda manajerial terencana mencakup kalibrasi berkala, redistribusi beban kerja nakes, dan pengusulan alokasi buffer stock ke Dinas Kesehatan.`;

  // 5. Panggil OpenAI
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: 'Anda adalah Lead Healthcare Operations Auditor Dinas Kesehatan Kabupaten Bogor yang sangat teliti, analitis, mendalam, dan berbasis fakta database. Anda menyajikan laporan intelijen manajerial yang kaya data, jelas, tanpa teks klise akademis, dan langsung berorientasi pada keputusan operasional pimpinan. Anda selalu menyusun tabel Markdown secara bersih dengan baris terpisah.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const rawMarkdown = completion.choices[0]?.message?.content || 'Gagal menghasilkan narasi laporan eksekutif.';
  const reportMarkdown = normalizeMarkdownTables(rawMarkdown);

  return {
    scope: 'FASKES',
    generatedAt: new Date().toISOString(),
    faskesId,
    reportMarkdown,
    rawMetrics
  };
};

/**
 * Cakupan B: Laporan Situasi Makro Se-Kabupaten (Regency-Wide Macro Situation Report / SitRep)
 * @param {object} queryOptions { startDate, endDate, kecamatan }
 */
const generateWilayahSitRep = async (queryOptions = {}) => {
  // 1. Ambil data agregat se-kabupaten secara paralel
  const [
    executiveSummary,
    workload,
    beds,
    assets,
    medicines,
    vaccines,
    surveillance
  ] = await Promise.all([
    dinkesService.getExecutiveSummary(queryOptions),
    dinkesService.getWorkloadAnalytics(queryOptions),
    dinkesService.getBedMonitoring(queryOptions),
    dinkesService.getCriticalAssetsMonitoring(queryOptions),
    dinkesService.getMedicineStockAlerts(queryOptions),
    dinkesService.getVaccineMonitoring(queryOptions),
    dinkesService.getDiseaseSurveillance({ ...queryOptions, limit: 10 })
  ]);

  // 2. Ekstrak data untuk Analisis Komparatif Antar-Faskes
  // A. Faskes Overload vs Surplus Tenaga
  const faskesWorkloadData = workload.data || [];
  const faskesKritisOverload = faskesWorkloadData
    .filter(f => f.indikatorBebanKerja?.levelUrgensi === 'CRITICAL' || f.indikatorBebanKerja?.levelUrgensi === 'HIGH')
    .map(f => ({
      faskesId: f.faskesId,
      namaFaskes: f.namaFaskes,
      kecamatan: f.kecamatan,
      totalPasien: f.statistikPelayanan?.totalPasien || 0,
      totalDokter: f.statistikSDMK?.totalDokter || 0,
      rasioPasienPerDokter: f.indikatorBebanKerja?.rasioPasienPerDokter || 0,
      statusBeban: f.indikatorBebanKerja?.statusBeban,
      rekomendasi: f.indikatorBebanKerja?.rekomendasiDinkes
    }));

  const faskesSurplusTenaga = faskesWorkloadData
    .filter(f => f.indikatorBebanKerja?.statusBeban === 'SURPLUS_TENAGA')
    .map(f => ({
      faskesId: f.faskesId,
      namaFaskes: f.namaFaskes,
      kecamatan: f.kecamatan,
      totalPasien: f.statistikPelayanan?.totalPasien || 0,
      totalDokter: f.statistikSDMK?.totalDokter || 0,
      rasioPasienPerDokter: f.indikatorBebanKerja?.rasioPasienPerDokter || 0
    }));

  // B. Tempat Tidur & BOR Kritis
  const faskesBedData = beds.data || [];
  const faskesBorKritis = faskesBedData
    .filter(f => f.borAngka >= 80)
    .map(f => ({
      namaFaskes: f.namaFaskes,
      kecamatan: f.kecamatan,
      bor: f.bor,
      totalBed: f.totalBed,
      bedTerisi: f.bedTerisi,
      bedTersedia: f.bedTersedia
    }));

  // C. Alkes Rusak Berat & Kalibrasi Expired
  const faskesAssetData = assets.data || [];
  const faskesAlkesKritis = faskesAssetData
    .filter(f => f.kondisi?.rusakBerat > 0 || (f.kalibrasiAlerts && f.kalibrasiAlerts.length > 0))
    .slice(0, 10)
    .map(f => ({
      namaFaskes: f.namaFaskes,
      kecamatan: f.kecamatan,
      rusakBeratCount: f.kondisi?.rusakBerat || 0,
      daftarAlkesRusak: (f.daftarAlkesRusakKritis || []).map(a => a.namaAset),
      kalibrasiExpiredCount: (f.kalibrasiAlerts || []).filter(k => k.status === 'KADALUWARSA').length
    }));

  // D. Logistik Obat: Pemetaan Faskes Defisit vs Surplus untuk Redistribusi FEFO
  const faskesMedicineData = medicines.data || [];
  const obatKritisKabupaten = [];
  const obatSegeraExpiredKabupaten = [];

  faskesMedicineData.forEach(f => {
    (f.stokKritisList || []).slice(0, 5).forEach(m => {
      obatKritisKabupaten.push({
        faskesDefisit: f.namaFaskes,
        namaObat: m.namaObat,
        stok: m.stok,
        stokMinimum: m.stokMinimum
      });
    });
    (f.segeraExpiredList || []).slice(0, 5).forEach(m => {
      obatSegeraExpiredKabupaten.push({
        faskesPemilik: f.namaFaskes,
        namaObat: m.namaObat,
        noBatch: m.noBatch,
        stok: m.stok,
        sisaHari: m.sisaHari
      });
    });
  });

  // E. Vaksin Cold Chain
  const vaksinSummary = vaccines.ringkasan || {};

  // F. Surveilans 10 Besar Penyakit
  const top10PenyakitKabupaten = (surveillance.topPenyakit || []).map(p => ({
    peringkat: p.peringkat,
    kodeIcd10: p.kodeIcd10,
    namaDiagnosis: p.namaDiagnosis,
    jumlahKasus: p.jumlahKasus,
    persentase: p.persentase,
    isPenyakitMenular: p.isPenyakitMenular,
    isWajibLapor: p.isWajibLapor
  }));

  const rawMetrics = {
    ringkasanMakro: {
      totalPuskesmas: executiveSummary.ringkasanFaskes?.total || 0,
      kunjunganHariIni: executiveSummary.trafikKunjungan?.hariIni || 0,
      kunjunganBulanIni: executiveSummary.trafikKunjungan?.bulanIni || 0,
      totalDokterKabupaten: executiveSummary.tenagaMedis?.totalDokter || 0,
      rasioBebanKabupaten: executiveSummary.tenagaMedis?.rasioBebanKabupaten || 0,
      borRataRataKabupaten: executiveSummary.tempatTidur?.borKabupaten || '0%',
      totalBedKabupaten: executiveSummary.tempatTidur?.totalBed || 0
    },
    bebanNakesDanRotasi: {
      faskesKritisOverload,
      faskesSurplusTenaga
    },
    rawatInapBOR: {
      faskesBorKritis
    },
    asetMedisDanKelaikan: {
      faskesAlkesKritis
    },
    logistikFarmasiFEFO: {
      sampelObatKritisDefisit: obatKritisKabupaten.slice(0, 12),
      sampelObatSegeraExpired: obatSegeraExpiredKabupaten.slice(0, 12)
    },
    vaksinColdChain: {
      totalDosisKabupaten: vaksinSummary.totalDosisKabupaten || 0,
      vaksinKritisCount: vaksinSummary.vaksinKritisCount || 0,
      vaksinSegeraExpiredCount: vaksinSummary.vaksinSegeraExpiredCount || 0
    },
    surveilansEpidemiologi: {
      totalKasusPeriode: surveillance.totalKasusPeriode || 0,
      top10PenyakitKabupaten
    }
  };

  // 3. Prompt untuk Executive SitRep (Granular, Highly Informative, Zero Clutter)
  const prompt = `Anda adalah Penasihat Utama Kebijakan & Epidemiologi Operasional Dinas Kesehatan Kabupaten Bogor.
Tugas Anda adalah menyusun "Laporan Situasi Eksekutif Kesehatan Wilayah (Regional Macro Health SitRep)" yang SANGAT INFORMATIF, MENDALAM, TERPERINCI, dan BERBOBOT untuk Kepala Dinas Kesehatan dan Bupati/Pimpinan Daerah.

[DATA STATISTIK MAKRO KABUPATEN DARI DATABASE]:
${JSON.stringify(rawMetrics, null, 2)}

[ATURAN MUTLAK PENULISAN & FORMAT TABEL]:
1. PRINSIP ZERO-HALLUCINATION & STRICT FACTUAL GROUNDING:
   - Anda WAJIB menganalisis data riil seluruh ${rawMetrics.ringkasanMakro.totalPuskesmas} fasilitas kesehatan yang terdaftar di JSON.
   - DILARANG mengarang nama puskesmas atau angka fiktif.
2. BEBAS DARI TEKS BASA-BASI / CLUTTER:
   - DILARANG mencantumkan "ACM reference format", "CCS Concepts", "Keywords", "DOI", atau teks akademis yang tidak relevan dengan faskes.
   - DILARANG membuat flowchart alur umum pelayanan klinik.
3. ATURAN STRUKTUR TABEL MARKDOWN:
   - Setiap tabel WAJIB diawali dengan BARIS KOSONG BARU (double newline \n\n).
   - Tulis judul tabel menggunakan heading level 3 (contoh: ### Tabel Komparasi Utilisasi & Kapasitas Daerah).
   - Setiap baris tabel (Header Kolom, Pembatas |---|---|, dan seluruh Baris Data) WAJIB DITULIS PADA BARISNYA MASING-MASING SECARA TERPISAH (menggunakan karakter newline \n).
   - DILARANG KERAS menggabungkan baris tabel ke dalam satu baris panjang!
   - DILARANG menulis kata pengantar perintah seperti "Sajikan Tabel..." atau "Berikut tabel:". Langsung sajikan heading tabel (### ...) lalu baris tabelnya.
4. ATURAN DIAGRAM MERMAID:
   - JIKA terdapat pasangan faskes dengan stok obat surplus/mendekati kedaluwarsa dan faskes yang mengalami defisit obat yang sama (misalnya Puskesmas Cibinong Raya memiliki Paracetamol mendekati expired dan Puskesmas Sukamakmur mengalami defisit Paracetamol), buat diagram Mermaid jejaring pemindahan (\`\`\`mermaid ... \`\`\` dengan flowchart LR).
   - Label panah WAJIB menyebut nama obat dan faskes aktual dari data JSON.
   - JIKA tidak ada pemindahan yang relevan, JANGAN memaksakan membuat diagram.

Susun laporan dengan struktur berikut:

# LAPORAN SITUASI EKSEKUTIF KESEHATAN WILAYAH (REGIONAL HEALTH SITREP)
**Otoritas Penerbit**: Dinas Kesehatan Kabupaten Bogor • Pusat Komando Data & Analitika Kesehatan  
**Cakupan Wilayah**: ${rawMetrics.ringkasanMakro.totalPuskesmas} Fasilitas Kesehatan Tingkat Pertama se-Kabupaten Bogor

---

> **RINGKASAN EKSEKUTIF WILAYAH**  
> (Tulis 2 paragraf padat dan tajam merangkum lanskap operasional se-kabupaten: total trafik kunjungan riil, BOR agregat riil, ketimpangan beban kerja nakes, titik kritis logistik obat/vaksin, dan rekomendasi intervensi strategis pimpinan daerah).

---

## 1. SITUASI OPERASIONAL & UTILISASI KESEHATAN MAKRO SE-KABUPATEN
- Analisis sintesis kapasitas pelayanan kesehatan di seluruh ${rawMetrics.ringkasanMakro.totalPuskesmas} Puskesmas berdasarkan data riil: ${rawMetrics.ringkasanMakro.kunjunganHariIni} kunjungan hari ini, ${rawMetrics.ringkasanMakro.kunjunganBulanIni} kunjungan bulan ini, total ${rawMetrics.ringkasanMakro.totalDokterKabupaten} dokter, rasio beban kabupaten: ${rawMetrics.ringkasanMakro.rasioBebanKabupaten}:1, BOR rata-rata wilayah: ${rawMetrics.ringkasanMakro.borRataRataKabupaten} (kapasitas ${rawMetrics.ringkasanMakro.totalBedKabupaten} tempat tidur).

### Tabel Komparasi Utilisasi & Kapasitas Daerah
| Indikator Wilayah Makro | Nilai Agregat Aktual | Rata-Rata per Faskes | Standar Kebijakan Daerah | Evaluasi Kinerja |
| :--- | :--- | :--- | :--- | :--- |

## 2. SURVEILANS EPIDEMIOLOGI & DETEKSI KLUSTER PENYAKIT (ICD-10)
- Analisis pola diagnosis ICD-10 yang mendominasi kunjungan di wilayah kabupaten (${rawMetrics.surveilansEpidemiologi.totalKasusPeriode} total kasus terverifikasi).
- Rinci temuan penyakit menular dan kasus wajib lapor (KLB) seperti ISPA, DBD, Diare, TB Paru dan wilayah yang terdampak.

### Tabel 10 Besar Morbiditas Se-Kabupaten
| Peringkat | Kode ICD-10 | Nama Diagnosis Klinis | Jumlah Kasus | Persentase | Status Penyakit |
| :--- | :--- | :--- | :--- | :--- | :--- |

## 3. MATRIKS INTERVENSI REDISTRIBUSI LOGISTIK FEFO & ROTASI TENAGA MEDIS
- Analisis faskes dengan kelebihan/kekurangan nakes dan faskes dengan defisit obat vs surplus obat mendekati kedaluwarsa.
- Jika terdapat pasangan transfer logistik obat nyata, sertakan **Diagram Jejaring Redistribusi Logistik FEFO** dengan Mermaid (\`\`\`mermaid ... \`\`\` flowchart LR).

### Tabel Rekomendasi Transfer Obat/Vaksin FEFO
| Faskes Pengirim (Surplus) | Faskes Penerima (Defisit) | Nama Obat / Vaksin | Jumlah Dosis/Tab | Alasan FEFO & Urgensi |
| :--- | :--- | :--- | :--- | :--- |

### Tabel Rekomendasi Rotasi Tenaga Medis BKO
| Faskes Pengirim (Surplus Nakes) | Faskes Penerima (Overload) | Formasi Nakes | Rasio Beban Asal vs Tujuan |
| :--- | :--- | :--- | :--- |

## 4. AUDIT KELAIKAN ALAT KESEHATAN VITAL SE-KABUPATEN
- Evaluasi rekapitulasi alkes kritis yang rusak dan perlu kalibrasi di faskes: ${JSON.stringify(rawMetrics.asetMedisDanKelaikan.faskesAlkesKritis)}.

### Tabel Rekapitulasi Alkes Kritis Antar-Puskesmas
| Nama Fasilitas Kesehatan | Kecamatan | Jumlah Alkes Rusak | Jenis Alat Terganggu | Dampak Pelayanan |
| :--- | :--- | :--- | :--- | :--- |

## 5. INSTRUKSI KEBIJAKAN & DIREKTIF KEPALA DINAS KESEHATAN
- Rumuskan 3 hingga 5 keputusan kebijakan operasional segera (Instruksi Kadis / Surat Edaran) dengan target eksekusi 1x24 jam hingga 7 hari kerja berdasarkan temuan faktual di atas.`;

  // 4. Panggil OpenAI
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: 'Anda adalah Penasihat Strategis Operasional dan Epidemiologi Dinas Kesehatan Kabupaten Bogor yang sangat teliti, analitis, mendalam, dan berbasis fakta database. Anda menyajikan laporan intelijen manajerial yang kaya data, jelas, tanpa teks klise akademis, dan langsung berorientasi pada keputusan operasional pimpinan. Anda selalu menyusun tabel Markdown secara bersih dengan baris terpisah.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const rawMarkdown = completion.choices[0]?.message?.content || 'Gagal menghasilkan Laporan Situasi Wilayah.';
  const reportMarkdown = normalizeMarkdownTables(rawMarkdown);

  return {
    scope: 'WILAYAH',
    generatedAt: new Date().toISOString(),
    filter: queryOptions,
    reportMarkdown,
    rawMetrics
  };
};

module.exports = {
  generateFaskesReport,
  generateWilayahSitRep
};
