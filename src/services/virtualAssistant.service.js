const OpenAI = require('openai');
const prisma = require('../config/prisma');

/**
 * Service untuk Virtual Assistant Publik (Siti - AI Health Assistant SIKDA)
 * Dirancang untuk melayani masyarakat umum dan pasien:
 * - Informasi jadwal puskesmas dan poli
 * - Cara pendaftaran online dari rumah via WhatsApp & PIN
 * - Alur rujukan dan persyaratan BPJS / Umum
 * - Lokasi IGD 24 jam dan nomor darurat
 * - Rekomendasi poli berdasarkan keluhan awal
 */

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    timeout: 30000
  });
};

// Fallback respons cerdas berbasis intent jika OpenAI tidak tersedia
const getFallbackResponse = (message) => {
  const query = (message || '').toLowerCase();

  if (query.includes('daftar') || query.includes('booking') || query.includes('antrean') || query.includes('antrian') || query.includes('wa') || query.includes('whatsapp')) {
    return {
      reply: 'Untuk mendaftar antrean online dari rumah:\n\n1. Kunjungi menu **Daftar Online** atau klik tombol **Daftar Antrean dari Rumah** di portal ini.\n2. Masukkan nomor WhatsApp aktif Anda dan buat/masukkan PIN 6-digit.\n3. Daftarkan NIK Anda atau anggota keluarga Anda (satu nomor WhatsApp bisa memuat banyak anggota keluarga).\n4. Pilih faskes (Puskesmas tujuan), poli tujuan, dan tanggal kunjungan.\n5. Tiket antrean digital beserta nomor antrean akan langsung dikirimkan ke WhatsApp Anda tanpa perlu antre lama di loket pendaftaran faskes.',
      suggestedActions: [
        { label: 'Buka Halaman Pendaftaran', url: '/booking' },
        { label: 'Syarat Berobat BPJS', query: 'Apa saja syarat berobat dengan BPJS?' }
      ]
    };
  }

  if (query.includes('jadwal') || query.includes('dokter') || query.includes('buka') || query.includes('jam')) {
    return {
      reply: 'Pelayanan Poliklinik di Puskesmas Kabupaten Bogor umumnya beroperasi:\n\n- **Senin s/d Kamis**: Pukul 08.00 - 14.00 WIB\n- **Jumat**: Pukul 08.00 - 11.30 WIB\n- **Sabtu**: Pukul 08.00 - 12.00 WIB\n\nUntuk layanan **Instalasi Gawat Darurat (UGD) 24 Jam** dan **Persalinan (PONED)** tetap siaga melayani setiap hari 24 jam termasuk hari libur.',
      suggestedActions: [
        { label: 'Lihat Jadwal Dokter di Beranda', url: '/#doctor-schedule' },
        { label: 'Daftar Sekarang', url: '/booking' }
      ]
    };
  }

  if (query.includes('bpjs') || query.includes('bayar') || query.includes('gratis') || query.includes('kartu indonesia sehat') || query.includes('kis')) {
    return {
      reply: 'Syarat dan ketentuan pelayanan pasien BPJS / KIS di Puskesmas:\n\n1. Membawa e-KTP / Kartu Keluarga atau Kartu BPJS Kesehatan (fisik maupun digital via aplikasi Mobile JKN).\n2. Memastikan status kepesertaan BPJS dalam kondisi **Aktif** dan Puskesmas terdaftar sebagai Faskes Tingkat Pertama (FKTP).\n3. Pelayanan rawat jalan primer, pemeriksaan dokter, pemeriksaan laboratorium dasar, dan obat-obatan sesuai formularium nasional **100% Bebas Biaya (Gratis)**.',
      suggestedActions: [
        { label: 'Daftar Antrean BPJS', url: '/booking' },
        { label: 'Cek Layanan Poli', url: '/#services' }
      ]
    };
  }

  if (query.includes('darurat') || query.includes('igd') || query.includes('ugd') || query.includes('ambulan') || query.includes('kecelakaan') || query.includes('119')) {
    return {
      reply: '🚨 **PANDUAN GAWAT DARURAT MEDIS:**\n\nJika pasien mengalami henti napas, nyeri dada mendadak, penurunan kesadaran, luka berat, atau kejang:\n\n1. Segera hubungi **Call Center Darurat Medis 119** (Bebas Pulsa) atau ambulans siaga terdekat.\n2. Langsung bawa pasien ke **Instalasi Gawat Darurat (IGD 24 Jam)** Puskesmas Rawat Inap atau Rumah Sakit terdekat tanpa perlu mendaftar antrean online terlebih dahulu.',
      suggestedActions: [
        { label: 'Telepon Darurat 119', url: 'tel:119' },
        { label: 'Lokasi Faskes IGD', url: '/#locations' }
      ]
    };
  }

  if (query.includes('gigi') || query.includes('kia') || query.includes('imunisasi') || query.includes('anak') || query.includes('lab') || query.includes('darah')) {
    return {
      reply: 'Puskesmas di Kabupaten Bogor menyediakan poliklinik terintegrasi:\n\n- **Poli Umum**: Penyakit dewasa & infeksi umum.\n- **Poli Gigi & Mulut**: Penambalan, pencabutan, pembersihan karang gigi.\n- **Poli KIA & KB**: Pemeriksaan kehamilan, USG dasar, imunisasi balita, KB.\n- **Laboratorium**: Pemeriksaan darah lengkap, gula darah, kolesterol, tes dahak TB, tes urin.\n\nSilakan pilih layanan tersebut saat melakukan pendaftaran antrean online.',
      suggestedActions: [
        { label: 'Daftar ke Poliklinik', url: '/booking' },
        { label: 'Lihat Seluruh Layanan', url: '/#services' }
      ]
    };
  }

  // Respon umum
  return {
    reply: 'Halo! Saya **Siti**, Asisten Virtual Cerdas SIKDA Kabupaten Bogor. Saya dapat membantu Anda dengan informasi:\n\n- Pendaftaran antrean online puskesmas dari rumah via WhatsApp\n- Jadwal dokter dan jam pelayanan poliklinik\n- Informasi layanan BPJS dan syarat berobat\n- Rekomendasi poliklinik sesuai keluhan Anda\n- Layanan gawat darurat IGD 24 Jam & ambulans 119\n\nAda yang bisa saya bantu hari ini?',
    suggestedActions: [
      { label: 'Cara Daftar Online', query: 'Bagaimana cara daftar online dari rumah?' },
      { label: 'Jadwal Dokter & Poli', query: 'Kapan jadwal buka poliklinik?' },
      { label: 'Syarat Pasien BPJS', query: 'Apa saja syarat berobat dengan BPJS?' },
      { label: 'Bantuan Darurat IGD 119', query: 'Di mana lokasi IGD dan kontak darurat?' }
    ]
  };
};

const handleChat = async ({ message, history = [] }) => {
  if (!message || typeof message !== 'string') {
    const err = new Error('Pesan pertanyaan tidak boleh kosong.');
    err.statusCode = 400;
    throw err;
  }

  const openai = getOpenAIClient();

  if (!openai) {
    // Gunakan fallback cerdas
    return getFallbackResponse(message);
  }

  try {
    const systemPrompt = `Anda adalah "Siti", Asisten Virtual Kesehatan Resmi dari SIKDA (Sistem Informasi Kesehatan Daerah) Kabupaten Bogor.
Gaya komunikasi Anda: Ramah, empatik, jelas, berwibawa, profesional, dan nyaman dibaca (mirip standar layanan digital Cleveland Clinic).
Bahasa: Bahasa Indonesia yang baku namun bersahabat.

Pengetahuan Anda tentang sistem SIKDA:
1. Pendaftaran Online: Masyarakat dapat mendaftar antrean faskes (Puskesmas) dari rumah lewat website SIKDA menggunakan nomor WhatsApp + PIN 6-digit. 1 nomor WA dapat mengelola banyak NIK keluarga. Tiket antrean dikirim langsung ke WhatsApp.
2. Pelayanan Faskes: Puskesmas melayani Poli Umum, Poli Gigi, Poli KIA/KB, Imunisasi, Poli Lansia, Farmasi, Laboratorium, dan UGD 24 Jam.
3. Pasien BPJS & Umum: Pasien BPJS aktif berobat 100% gratis di FKTP terdaftar. Pasien umum dilayani sesuai perda tarif retribusi daerah.
4. Rujukan: Rujukan berjenjang ke RSUD Cibinong, Ciawi, Leuwiliang, Cileungsi bila memerlukan spesialis tingkat lanjut.
5. Gawat Darurat: Untuk kondisi darurat mengancam nyawa, instruksikan segera ke IGD 24 Jam atau hubungi Call Center Darurat 119.
6. Rekam Medis Elektronik (RME): Seluruh riwayat kunjungan tersimpan rapi dan aman secara elektronik.

Aturan Respon:
- Berikan jawaban ringkas, terstruktur (gunakan bullet points jika perlu), dan to the point.
- Cantumkan penafian medis sopan bila pengguna menanyakan gejala medis berat bahwa asisten virtual tidak menggantikan pemeriksaan langsung oleh dokter di puskesmas.
- Maksimal 3-4 paragraf singkat agar mudah dibaca di ponsel.`;

    const formattedHistory = (history || []).slice(-6).map(h => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: h.text
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: message }
      ]
    });

    const reply = completion.choices[0]?.message?.content || 'Maaf, saya sedang mengalami kendala jaringan. Silakan ulangi pertanyaan Anda.';

    // Berikan saran aksi cepat berdasarkan isi jawaban
    const lowerReply = reply.toLowerCase();
    const suggestedActions = [];
    if (lowerReply.includes('daftar') || lowerReply.includes('booking') || lowerReply.includes('antre')) {
      suggestedActions.push({ label: 'Daftar Antrean Online', url: '/booking' });
    }
    if (lowerReply.includes('jadwal') || lowerReply.includes('dokter')) {
      suggestedActions.push({ label: 'Lihat Jadwal Dokter', url: '/#doctor-schedule' });
    }
    if (lowerReply.includes('119') || lowerReply.includes('igd') || lowerReply.includes('darurat')) {
      suggestedActions.push({ label: 'Hubungi 119', url: 'tel:119' });
    }
    if (suggestedActions.length === 0) {
      suggestedActions.push({ label: 'Pusat Layanan Poli', url: '/#services' });
      suggestedActions.push({ label: 'Daftar Online', url: '/booking' });
    }

    return {
      reply,
      suggestedActions
    };
  } catch (err) {
    console.error('[Virtual Assistant] OpenAI error, falling back to rule engine:', err.message);
    return getFallbackResponse(message);
  }
};

module.exports = {
  handleChat
};
