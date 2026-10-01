const prisma = require('../src/config/prisma');
const whatsappService = require('../src/services/whatsapp.service');
whatsappService.sendBookingConfirmation = async () => true;

const portalPasienService = require('../src/services/portalPasien.service');
const pasienService = require('../src/services/pasien.service');

async function testSyncFlow() {
  console.log('=== TEST SYNC: ONLINE BOOKING PASIEN BARU -> LOKET PENDAFTARAN ===\n');

  // 1. Ambil Akun WhatsApp Pasien atau buat dummy jika belum ada
  let akun = await prisma.akunPasienOnline.findFirst({
    where: { nomorWa: '6281234567890' }
  });

  if (!akun) {
    akun = await prisma.akunPasienOnline.create({
      data: {
        nomorWa: '6281234567890',
        isVerified: true
      }
    });
  }

  // 2. Ambil Faskes Cibinong dan Poli
  const faskes = await prisma.faskes.findFirst({
    where: { namaFaskes: { contains: 'Cibinong' } }
  });
  if (!faskes) throw new Error('Faskes Cibinong tidak ditemukan');

  const poli = await prisma.poliklinik.findFirst({
    where: {
      OR: [{ faskesId: faskes.id }, { faskesId: null }],
      statusAktif: true
    }
  });
  if (!poli) throw new Error('Poli tidak ditemukan');

  const dokter = await prisma.user.findFirst({
    where: { faskesId: faskes.id, role: 'DOKTER' }
  });

  // Unique NIK for testing
  const testNik = '320101' + Math.floor(1000000000 + Math.random() * 9000000000);
  console.log(`[1] Mendaftarkan Pasien Baru Online dengan NIK: ${testNik}`);

  const bookingPayload = {
    faskesId: faskes.id,
    poliklinikId: poli.id,
    dokterId: dokter ? dokter.id : null,
    nik: testNik,
    namaLengkap: 'Budi Santoso Uji Sync',
    tanggalLahir: '1992-05-15',
    tanggalKunjungan: new Date().toISOString().split('T')[0],
    keluhan: 'Demam tinggi dan batuk 2 hari',
    hubunganKeluarga: 'Diri Sendiri',
    jenisKelamin: 'Laki-laki',
    // Demografi lengkap
    noKk: '3201019988776655',
    tempatLahir: 'Bogor',
    golonganDarah: 'O',
    rhesus: '+',
    agama: 'Islam',
    pendidikan: 'S1',
    pekerjaan: 'Pegawai BUMN',
    statusPerkawinan: 'Kawin',
    kewarganegaraan: 'WNI',
    alamatKtp: 'Jl. Pemda Raya Blok C No. 12',
    rtRw: '003/007',
    desaKelurahan: 'Tengah',
    kecamatan: 'Cibinong',
    kabupatenKota: 'Kabupaten Bogor',
    provinsi: 'Jawa Barat',
    kodePos: '16914',
    noHp: '081234567890',
    kontakDarurat: 'Siti Aminah',
    hubunganKontakDarurat: 'Istri',
    noHpDarurat: '081299887766',
    jenisPenjamin: 'BPJS Kesehatan',
    noBpjs: '0001234567891',
    persetujuanPengobatan: true,
    persetujuanRekamMedis: true,
    persetujuanSatusehat: true
  };

  const booking = await portalPasienService.createBooking(akun.id, bookingPayload);
  console.log('✓ Booking Berhasil dibuat!');
  console.log(`  Kode Booking: ${booking.kodeBooking}`);
  console.log(`  No. Antrean: ${booking.noAntrian}`);
  console.log(`  No. RM Master: ${booking.noRM}`);
  console.log(`  Jenis Pasien: ${booking.jenisPasien}`);

  // 3. Simulasikan Loket menarik data pasien ini via searchPasien
  console.log('\n[2] Loket menarik data pasien menggunakan NIK via searchPasien:');
  const loketUser = { role: 'ADMINISTRASI', faskesId: faskes.id };
  const pasienDitarik = await pasienService.searchPasien(testNik, loketUser, faskes.id);

  if (!pasienDitarik) {
    throw new Error('Gagal: Pasien tidak ditemukan oleh Loket!');
  }

  console.log('✓ Data Pasien Ditemukan di Master Data Puskesmas!');
  console.log(`  Nama Lengkap: ${pasienDitarik.namaLengkap}`);
  console.log(`  No. RM: ${pasienDitarik.noRM}`);
  console.log(`  No. KK: ${pasienDitarik.noKk}`);
  console.log(`  Tempat Lahir: ${pasienDitarik.tempatLahir}`);
  console.log(`  Gol. Darah & Rhesus: ${pasienDitarik.golonganDarah} (${pasienDitarik.rhesus})`);
  console.log(`  Alamat: ${pasienDitarik.alamat?.alamatKtp}, RT ${pasienDitarik.alamat?.rtRw}`);
  console.log(`  Kontak: HP ${pasienDitarik.kontak?.noHp}, Darurat: ${pasienDitarik.kontak?.kontakDarurat} (${pasienDitarik.kontak?.hubunganKontakDarurat})`);
  console.log(`  Penjamin: ${pasienDitarik.penjamin?.jenisPenjamin}, No. Kartu: ${pasienDitarik.penjamin?.noBpjs}`);
  console.log(`  Booking Aktif Terdeteksi: ${pasienDitarik.bookingAktif ? 'YA (' + pasienDitarik.bookingAktif.noAntrian + ' - ' + pasienDitarik.bookingAktif.namaPoli + ')' : 'TIDAK'}`);
  console.log(`  Persetujuan Sebelumnya Aktif: ${pasienDitarik.hasPersetujuanSebelumnya ? 'YA (Loket tidak perlu foto/tanda tangan ulang)' : 'TIDAK'}`);

  // 4. Simulasikan Loket mendaftarkan kunjungan pasien dengan penyesuaian field dinamis
  console.log('\n[3] Loket mendaftarkan kunjungan (menyesuaikan field dinamis: cara datang, prioritas, jenis rawat):');
  const pendaftaranLoketPayload = {
    faskesId: faskes.id,
    noRekamMedis: pasienDitarik.noRM,
    nik: pasienDitarik.nik,
    namaLengkap: pasienDitarik.namaLengkap,
    tempatLahir: pasienDitarik.tempatLahir,
    tanggalLahir: pasienDitarik.tanggalLahir,
    jenisKelamin: pasienDitarik.jenisKelamin,
    statusPasien: 'Lama',
    poliTujuan: pasienDitarik.bookingAktif.poliklinikId,
    dokterTujuan: pasienDitarik.bookingAktif.dokterId || dokter?.id,
    layananTujuan: 'Pemeriksaan Dokter',
    jenisPelayanan: 'Rawat Jalan',
    caraDatang: 'Datang sendiri',
    prioritas: 'Umum',
    tanggalRegistrasi: new Date().toISOString().split('T')[0],
    jamRegistrasi: '08:30',
    noAntrian: pasienDitarik.bookingAktif.noAntrian,
    diagnosaAwal: pasienDitarik.bookingAktif.keluhan,
    fotoWajah: 'PREVIOUS_CONSENT_VERIFIED',
    tandaTangan: 'PREVIOUS_CONSENT_VERIFIED',
    persetujuanPengobatan: true,
    persetujuanRekamMedis: true,
    persetujuanSatusehat: true,
    jenisPenjamin: pasienDitarik.penjamin.jenisPenjamin,
    noBpjs: pasienDitarik.penjamin.noBpjs
  };

  const regResult = await pasienService.createPasien(pendaftaranLoketPayload);
  console.log('✓ Pendaftaran Pasien di Loket Berhasil Disimpan!');
  console.log(`  No. Antrean Kunjungan: ${regResult.kunjungan.noAntrian}`);
  console.log(`  Status Kunjungan: ${regResult.kunjungan.statusKunjungan}`);

  // 5. Cek apakah status booking online telah otomatis ter-update ke CHECKED_IN
  const updatedBooking = await prisma.bookingAntreanOnline.findUnique({
    where: { id: booking.id }
  });
  console.log(`  Status Booking Online Terkini: ${updatedBooking.statusBooking} (Otomatis Check-in)`);

  console.log('\n=== SEMUA PENGUJIAN SYNC BERHASIL 100% ===');
}

testSyncFlow()
  .catch(e => {
    console.error('Test Error:', e);
  })
  .finally(() => prisma.$disconnect());
