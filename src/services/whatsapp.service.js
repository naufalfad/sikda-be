const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');

let makeWASocket, useMultiFileAuthState, DisconnectReason;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
} catch (err) {
  console.warn('[WhatsApp Service] Baileys could not be loaded directly:', err.message);
}

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
    this.qrCode = null;
    this.isInitializing = false;
    this.authFolder = path.join(__dirname, '../../whatsapp_auth');

    // Pastikan folder auth ada
    if (!fs.existsSync(this.authFolder)) {
      fs.mkdirSync(this.authFolder, { recursive: true });
    }
  }

  normalizePhoneNumber(phone) {
    if (!phone) return '';
    let clean = phone.toString().replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  async init() {
    if (this.isInitializing || this.status === 'CONNECTED') {
      return;
    }

    if (!makeWASocket || !useMultiFileAuthState) {
      console.log('[WhatsApp Gateway] Baileys tidak tersedia, mode fallback simulasi aktif.');
      return;
    }

    this.isInitializing = true;
    this.status = 'CONNECTING';

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['SIAP-KES Portal', 'Chrome', '1.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          this.status = 'QR_READY';
          console.log('\n=========================================');
          console.log('📲 [WHATSAPP GATEWAY] SCAN QR UNTUK TAUTKAN NOMOR:');
          try {
            qrcodeTerminal.generate(qr, { small: true });
          } catch (e) {
            console.log('QR Code String:', qr);
          }
          console.log('=========================================\n');
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
          this.status = 'DISCONNECTED';
          this.isInitializing = false;
          console.log(`[WhatsApp Gateway] Koneksi terputus. Kode: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.init(), 5000);
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCode = null;
          this.isInitializing = false;
          console.log('✅ [WhatsApp Gateway] Terhubung dengan WhatsApp Web! Siap mengirim OTP & Tiket.');
        }
      });
    } catch (error) {
      console.error('[WhatsApp Gateway] Gagal inisialisasi Baileys:', error.message);
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
    }
  }

  async sendMessage(toPhone, message) {
    const normalized = this.normalizePhoneNumber(toPhone);
    const jid = `${normalized}@s.whatsapp.net`;

    console.log(`\n-----------------------------------------`);
    console.log(`📨 [WHATSAPP OUTGOING] Ke: ${normalized} (${toPhone})`);
    console.log(`📄 Pesan:\n${message}`);
    console.log(`-----------------------------------------\n`);

    if (this.sock && this.status === 'CONNECTED') {
      try {
        const result = await this.sock.sendMessage(jid, { text: message });
        return {
          success: true,
          simulated: false,
          phone: normalized,
          messageId: result?.key?.id || null
        };
      } catch (err) {
        console.error('[WhatsApp Gateway] Gagal kirim pesan via Baileys:', err.message);
        // Fallback tetap mengembalikan success dengan catatan simulated
        return {
          success: true,
          simulated: true,
          phone: normalized,
          note: 'Gagal kirim via Baileys socket, dialihkan ke console log'
        };
      }
    }

    // Jika belum scan QR atau masih dev mode:
    return {
      success: true,
      simulated: true,
      phone: normalized,
      note: 'WhatsApp Gateway belum terhubung (Scan QR di terminal). Pesan tercatat di console log.'
    };
  }

  async sendOtp(toPhone, otpCode) {
    const text = `*SIAP-KES KABUPATEN* 🏥\n\nKode Verifikasi (OTP) Pendaftaran Antrean Online Anda adalah:\n\n*${otpCode}*\n\nKode ini berlaku selama *5 menit*.\n⚠️ *JANGAN* bagikan kode ini kepada siapa pun termasuk petugas Puskesmas.`;
    return await this.sendMessage(toPhone, text);
  }

  async sendBookingConfirmation(toPhone, booking) {
    const tgl = new Date(booking.tanggalKunjungan).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const text = `🏥 *SIAP-KES - KONFIRMASI PENDAFTARAN ANTREAN ONLINE*

Halo *${booking.namaLengkap}*, pendaftaran antrean Anda berhasil dibuat!

🔖 *Kode Booking*: *${booking.kodeBooking}*
🎫 *No. Antrean*: *${booking.noAntrian || 'U-001'}*
🏢 *Faskes*: ${booking.namaFaskes}
🩺 *Poliklinik*: ${booking.namaPoli}
👨‍⚕️ *Dokter*: ${booking.namaDokter || 'Dokter Umum Jaga'}
📅 *Tanggal Kunjungan*: ${tgl}
🏷️ *Status Pasien*: *${booking.jenisPasien === 'LAMA' ? 'Pasien Lama (No. RM: ' + (booking.noRM || '-') + ')' : 'Pasien Baru'}*

📌 *PETUNJUK KEDATANGAN:*
1. Harap hadir di Puskesmas *15 menit* sebelum jadwal layanan.
2. Tunjukkan Kode Booking (*${booking.kodeBooking}*) ini ke Loket Pendaftaran / Anjungan Mandiri Faskes.
3. Setelah konfirmasi loket, silakan menuju ke *Ruang Pemeriksaan Awal (Perawat)* untuk pemeriksaan TTV & Skrining sebelum masuk ke ruang dokter.
4. Bawa KTP Asli / Kartu BPJS / KK untuk validasi berkas.

Terima kasih telah menggunakan layanan SIAP-KES Daerah.`;

    return await this.sendMessage(toPhone, text);
  }

  getStatus() {
    return {
      status: this.status,
      hasQr: Boolean(this.qrCode),
      qr: this.qrCode
    };
  }
}

const whatsappService = new WhatsAppService();

// Inisialisasi otomatis di background
setTimeout(() => {
  whatsappService.init().catch(err => {
    console.error('[WhatsApp Service] Init error:', err.message);
  });
}, 2000);

module.exports = whatsappService;
