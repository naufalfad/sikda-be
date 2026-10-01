const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const whatsappService = require('./whatsapp.service');

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia-super-aman';

/**
 * Normalisasi nomor WhatsApp lokal/internasional
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
};

/**
 * 1. Request OTP saat calon pasien memasukkan nomor WhatsApp
 */
const requestOtp = async (rawPhone) => {
  const nomorWa = normalizePhone(rawPhone);
  if (!nomorWa || nomorWa.length < 10) {
    const error = new Error('Nomor WhatsApp tidak valid (minimal 10 digit)');
    error.statusCode = 400;
    throw error;
  }

  // Cek apakah nomor sudah pernah terdaftar dan sudah memiliki PIN
  const existingAccount = await prisma.akunPasienOnline.findUnique({
    where: { nomorWa }
  });

  if (existingAccount && existingAccount.isVerified && existingAccount.pinHash) {
    return {
      exists: true,
      nomorWa,
      message: 'Nomor WhatsApp sudah terdaftar di sistem. Silakan masukkan PIN 6-digit Anda untuk masuk.'
    };
  }

  // Generate 6-Digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 Menit

  await prisma.akunPasienOnline.upsert({
    where: { nomorWa },
    create: {
      nomorWa,
      otpCode,
      otpExpiresAt,
      otpAttempts: 0,
      isVerified: false
    },
    update: {
      otpCode,
      otpExpiresAt,
      otpAttempts: 0
    }
  });

  // Kirim OTP via WhatsApp Baileys Gateway
  await whatsappService.sendOtp(nomorWa, otpCode);

  return {
    exists: false,
    nomorWa,
    message: 'Kode OTP 6-digit telah dikirimkan ke nomor WhatsApp Anda. Berlaku 5 menit.',
    debugOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
  };
};

/**
 * 2. Verifikasi OTP dan Buat PIN 6-digit untuk nomor WhatsApp baru
 */
const verifyOtpAndSetPin = async (rawPhone, otpCode, pin) => {
  const nomorWa = normalizePhone(rawPhone);
  
  if (!pin || !/^\d{6}$/.test(pin.toString())) {
    const error = new Error('PIN harus berupa 6 digit angka');
    error.statusCode = 400;
    throw error;
  }

  const akun = await prisma.akunPasienOnline.findUnique({
    where: { nomorWa }
  });

  if (!akun) {
    const error = new Error('Nomor WhatsApp belum terdaftar. Silakan minta OTP terlebih dahulu.');
    error.statusCode = 404;
    throw error;
  }

  if (!akun.otpCode || akun.otpCode !== otpCode.toString().trim()) {
    const error = new Error('Kode OTP salah atau tidak cocok');
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(akun.otpExpiresAt)) {
    const error = new Error('Kode OTP telah kadaluarsa. Silakan minta kode baru.');
    error.statusCode = 400;
    throw error;
  }

  // Hash PIN 6-digit
  const salt = await bcrypt.genSalt(10);
  const pinHash = await bcrypt.hash(pin.toString(), salt);

  const updatedAkun = await prisma.akunPasienOnline.update({
    where: { nomorWa },
    data: {
      pinHash,
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      lastLoginAt: new Date()
    },
    include: {
      keluarga: true
    }
  });

  // Terbitkan JWT khusus portal pasien
  const token = jwt.sign(
    { id: updatedAkun.id, nomorWa: updatedAkun.nomorWa, role: 'PASIEN_ONLINE' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: updatedAkun.id,
      nomorWa: updatedAkun.nomorWa,
      role: 'PASIEN_ONLINE',
      keluargaCount: updatedAkun.keluarga?.length || 0,
      keluarga: updatedAkun.keluarga || []
    },
    message: 'Nomor WhatsApp dan PIN Anda berhasil didaftarkan!'
  };
};

/**
 * 3. Login cepat cukup dengan Nomor WhatsApp + PIN (Hemat OTP)
 */
const loginWithPin = async (rawPhone, pin) => {
  const nomorWa = normalizePhone(rawPhone);

  const akun = await prisma.akunPasienOnline.findUnique({
    where: { nomorWa },
    include: {
      keluarga: true
    }
  });

  if (!akun || !akun.pinHash || !akun.isVerified) {
    const error = new Error('Nomor WhatsApp belum terdaftar atau belum membuat PIN. Silakan verifikasi via OTP.');
    error.statusCode = 404;
    throw error;
  }

  const isPinValid = await bcrypt.compare(pin.toString(), akun.pinHash);
  if (!isPinValid) {
    const error = new Error('PIN yang Anda masukkan salah. Silakan coba lagi.');
    error.statusCode = 401;
    throw error;
  }

  await prisma.akunPasienOnline.update({
    where: { id: akun.id },
    data: { lastLoginAt: new Date() }
  });

  const token = jwt.sign(
    { id: akun.id, nomorWa: akun.nomorWa, role: 'PASIEN_ONLINE' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: akun.id,
      nomorWa: akun.nomorWa,
      role: 'PASIEN_ONLINE',
      keluargaCount: akun.keluarga ? akun.keluarga.length : 0,
      keluarga: akun.keluarga || []
    },
    message: 'Login berhasil! Selamat datang di Portal Pasien Online SIAP-KES.'
  };
};

/**
 * 4. Lupa PIN - Request OTP
 */
const forgotPinRequestOtp = async (rawPhone) => {
  const nomorWa = normalizePhone(rawPhone);
  const akun = await prisma.akunPasienOnline.findUnique({
    where: { nomorWa }
  });

  if (!akun) {
    const error = new Error('Nomor WhatsApp belum pernah terdaftar di sistem.');
    error.statusCode = 404;
    throw error;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.akunPasienOnline.update({
    where: { nomorWa },
    data: { otpCode, otpExpiresAt }
  });

  await whatsappService.sendOtp(nomorWa, otpCode);

  return {
    nomorWa,
    message: 'Kode OTP untuk reset PIN telah dikirimkan ke WhatsApp Anda.',
    debugOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
  };
};

/**
 * 5. Reset PIN dengan OTP
 */
const resetPinWithOtp = async (rawPhone, otpCode, newPin) => {
  return await verifyOtpAndSetPin(rawPhone, otpCode, newPin);
};

/**
 * 6. Get Profil Akun Pasien & Daftar NIK Keluarga
 */
const getAccountProfile = async (akunId) => {
  const akun = await prisma.akunPasienOnline.findUnique({
    where: { id: akunId },
    include: {
      keluarga: {
        orderBy: { createdAt: 'asc' }
      },
      bookings: {
        include: {
          faskes: { select: { id: true, namaFaskes: true, kodeFaskes: true, alamat: true } },
          poliklinik: { select: { id: true, namaPoli: true, kodePoli: true } },
          dokter: { select: { id: true, namaLengkap: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!akun) {
    const error = new Error('Akun pasien tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  const { pinHash, otpCode, ...safeAkun } = akun;
  return safeAkun;
};

/**
 * 7. Tambah NIK Anggota Keluarga ke Nomor WhatsApp
 */
const addKeluarga = async (akunId, data) => {
  const { nik, namaLengkap, tanggalLahir, hubunganKeluarga, jenisKelamin } = data;

  if (!nik || nik.length < 16) {
    const error = new Error('NIK harus terdiri dari 16 digit');
    error.statusCode = 400;
    throw error;
  }

  if (!namaLengkap || !tanggalLahir) {
    const error = new Error('Nama lengkap dan tanggal lahir wajib diisi');
    error.statusCode = 400;
    throw error;
  }

  const keluarga = await prisma.pasienOnlineKeluarga.upsert({
    where: {
      akunPasienId_nik: {
        akunPasienId: akunId,
        nik: nik.trim()
      }
    },
    create: {
      akunPasienId: akunId,
      nik: nik.trim(),
      namaLengkap: namaLengkap.trim(),
      tanggalLahir: new Date(tanggalLahir),
      hubunganKeluarga: hubunganKeluarga || 'Diri Sendiri',
      jenisKelamin: jenisKelamin || null
    },
    update: {
      namaLengkap: namaLengkap.trim(),
      tanggalLahir: new Date(tanggalLahir),
      hubunganKeluarga: hubunganKeluarga || 'Diri Sendiri',
      jenisKelamin: jenisKelamin || null
    }
  });

  return keluarga;
};

/**
 * 8. Mencocokkan apakah NIK sudah pernah berobat di Faskes tujuan
 */
const checkPasienFaskes = async (nik, faskesId) => {
  if (!nik) {
    return { isLama: false, noRM: null };
  }

  const cleanNik = nik.trim();

  // Cari pasien di master data pasien beserta seluruh relasi demografinya
  const pasien = await prisma.pasien.findUnique({
    where: { nik: cleanNik },
    include: {
      kunjungans: {
        where: faskesId ? { faskesId } : undefined,
        include: { persetujuan: true },
        take: 1
      },
      faskes: true,
      alamat: true,
      kontak: true,
      penjamin: true
    }
  });

  if (!pasien) {
    return {
      isLama: false,
      noRM: null,
      namaLengkap: null,
      status: 'PASIEN_BARU',
      message: 'Pasien belum pernah terdaftar. Pendaftaran akan dicatat sebagai Pasien Baru.'
    };
  }

  // Cek apakah terdaftar di faskes ini atau pernah ada kunjungan di faskes ini
  const isRegisteredAtThisFaskes = pasien.faskesId === faskesId;
  const hasVisitedThisFaskes = pasien.kunjungans && pasien.kunjungans.length > 0;

  const dataPasien = {
    namaLengkap: pasien.namaLengkap,
    tempatLahir: pasien.tempatLahir,
    tanggalLahir: pasien.tanggalLahir,
    jenisKelamin: pasien.jenisKelamin,
    golonganDarah: pasien.golonganDarah,
    rhesus: pasien.rhesus,
    agama: pasien.agama,
    pendidikan: pasien.pendidikan,
    pekerjaan: pasien.pekerjaan,
    statusPerkawinan: pasien.statusPerkawinan,
    kewarganegaraan: pasien.kewarganegaraan,
    noKk: pasien.noKk,
    alamat: pasien.alamat,
    kontak: pasien.kontak,
    penjamin: pasien.penjamin
  };

  if (isRegisteredAtThisFaskes || hasVisitedThisFaskes) {
    return {
      isLama: true,
      noRM: pasien.noRM,
      namaLengkap: pasien.namaLengkap,
      status: 'PASIEN_LAMA',
      faskesNama: pasien.faskes?.namaFaskes || null,
      message: `Pasien lama teridentifikasi dengan No. Rekam Medis ${pasien.noRM}`,
      dataPasien
    };
  }

  // Jika pasien ada di database tapi belum pernah ke faskes tujuan ini
  return {
    isLama: false,
    noRM: pasien.noRM, // Rekam medis master
    namaLengkap: pasien.namaLengkap,
    status: 'PASIEN_BARU_DI_FASKES_INI',
    message: 'Data kependudukan ditemukan di database SIAP-KES. Menjadi kunjungan perdana di faskes ini.',
    dataPasien
  };
};

/**
 * 9. Buat Booking Antrean Online
 */
const createBooking = async (akunId, data) => {
  const {
    faskesId,
    poliklinikId,
    dokterId,
    nik,
    namaLengkap,
    tanggalLahir,
    tanggalKunjungan,
    keluhan,
    hubunganKeluarga,
    jenisKelamin,
    // Field Tambahan Pasien Baru (Demografi Lengkap Sesuai Loket)
    noKk,
    tempatLahir,
    golonganDarah,
    rhesus,
    agama,
    pendidikan,
    pekerjaan,
    statusPerkawinan,
    kewarganegaraan,
    alamatKtp,
    alamatDomisili,
    rtRw,
    desaKelurahan,
    kecamatan,
    kabupatenKota,
    provinsi,
    kodePos,
    noHp,
    kontakDarurat,
    hubunganKontakDarurat,
    noHpDarurat,
    jenisPenjamin,
    noBpjs
  } = data;

  if (!faskesId || !poliklinikId || !dokterId || dokterId === 'Bebas' || !nik || !namaLengkap || !tanggalLahir || !tanggalKunjungan) {
    const error = new Error('Faskes, Poliklinik, Dokter Tujuan, NIK, Nama Lengkap, dan Tanggal Kunjungan wajib diisi dan tidak boleh kosong');
    error.statusCode = 400;
    throw error;
  }

  // Validasi dokter terdaftar di faskes
  const dokterData = await prisma.user.findFirst({
    where: {
      id: dokterId,
      faskesId,
      role: 'DOKTER'
    }
  });

  if (!dokterData) {
    const error = new Error('Dokter yang dipilih tidak valid atau tidak bertugas di fasilitas kesehatan ini');
    error.statusCode = 400;
    throw error;
  }

  const akun = await prisma.akunPasienOnline.findUnique({
    where: { id: akunId }
  });

  if (!akun) {
    const error = new Error('Akun WhatsApp pasien tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  const cleanNik = nik.trim();

  // 1. Simpan/Update NIK ke daftar keluarga akun WhatsApp ini
  await prisma.pasienOnlineKeluarga.upsert({
    where: {
      akunPasienId_nik: {
        akunPasienId: akunId,
        nik: cleanNik
      }
    },
    create: {
      akunPasienId: akunId,
      nik: cleanNik,
      namaLengkap: namaLengkap.trim(),
      tanggalLahir: new Date(tanggalLahir),
      hubunganKeluarga: hubunganKeluarga || 'Diri Sendiri',
      jenisKelamin: jenisKelamin || null
    },
    update: {
      namaLengkap: namaLengkap.trim(),
      tanggalLahir: new Date(tanggalLahir),
      hubunganKeluarga: hubunganKeluarga || 'Diri Sendiri',
      jenisKelamin: jenisKelamin || null
    }
  });

  // 2. Cek apakah Pasien sudah terdaftar di Master Data Pasien
  let masterPasien = await prisma.pasien.findUnique({
    where: { nik: cleanNik },
    include: {
      alamat: true,
      kontak: true,
      penjamin: true
    }
  });

  if (!masterPasien) {
    // PASIEN BARU: Daftarkan langsung ke Master Pasien beserta Alamat, Kontak, dan Penjamin
    const generatedNoRM = `RM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    masterPasien = await prisma.pasien.create({
      data: {
        faskesId,
        noRM: generatedNoRM,
        nik: cleanNik,
        noKk: noKk || null,
        namaLengkap: namaLengkap.trim(),
        tempatLahir: tempatLahir || 'Bogor',
        tanggalLahir: new Date(tanggalLahir),
        jenisKelamin: jenisKelamin || 'Laki-laki',
        golonganDarah: golonganDarah || null,
        rhesus: rhesus || null,
        agama: agama || 'Islam',
        pendidikan: pendidikan || null,
        pekerjaan: pekerjaan || 'Wiraswasta',
        statusPerkawinan: statusPerkawinan || 'Belum Kawin',
        kewarganegaraan: kewarganegaraan || 'WNI',
        alamat: {
          create: {
            alamatKtp: alamatKtp || 'Sesuai KTP',
            alamatDomisili: alamatDomisili || alamatKtp || 'Sesuai KTP',
            rtRw: rtRw || '001/001',
            desaKelurahan: desaKelurahan || '-',
            kecamatan: kecamatan || '-',
            kabupatenKota: kabupatenKota || 'Kabupaten Bogor',
            provinsi: provinsi || 'Jawa Barat',
            kodePos: kodePos || '16911'
          }
        },
        kontak: {
          create: {
            noHp: noHp || akun.nomorWa || '-',
            kontakDarurat: kontakDarurat || namaLengkap.trim(),
            hubunganKontakDarurat: hubunganKontakDarurat || 'Keluarga',
            noHpDarurat: noHpDarurat || akun.nomorWa || '-'
          }
        },
        penjamin: {
          create: {
            jenisPenjamin: jenisPenjamin || 'Umum',
            noBpjs: noBpjs || null
          }
        }
      },
      include: {
        alamat: true,
        kontak: true,
        penjamin: true
      }
    });
  } else {
    // PASIEN SUDAH ADA: Lengkapi atau perbarui master data jika diisi formulir
    await prisma.pasien.update({
      where: { id: masterPasien.id },
      data: {
        namaLengkap: namaLengkap.trim(),
        ...(faskesId && !masterPasien.faskesId ? { faskesId } : {}),
        ...(noKk ? { noKk } : {}),
        ...(tempatLahir ? { tempatLahir } : {}),
        ...(golonganDarah !== undefined ? { golonganDarah: golonganDarah || null } : {}),
        ...(rhesus !== undefined ? { rhesus: rhesus || null } : {}),
        ...(agama ? { agama } : {}),
        ...(pendidikan !== undefined ? { pendidikan: pendidikan || null } : {}),
        ...(pekerjaan ? { pekerjaan } : {}),
        ...(statusPerkawinan ? { statusPerkawinan } : {})
      }
    });

    if (alamatKtp) {
      await prisma.alamatPasien.upsert({
        where: { pasienId: masterPasien.id },
        create: {
          pasienId: masterPasien.id,
          alamatKtp,
          alamatDomisili: alamatDomisili || alamatKtp,
          rtRw: rtRw || '001/001',
          desaKelurahan: desaKelurahan || '-',
          kecamatan: kecamatan || '-',
          kabupatenKota: kabupatenKota || 'Kabupaten Bogor',
          provinsi: provinsi || 'Jawa Barat',
          kodePos: kodePos || '16911'
        },
        update: {
          alamatKtp,
          alamatDomisili: alamatDomisili || alamatKtp,
          ...(rtRw ? { rtRw } : {}),
          ...(desaKelurahan ? { desaKelurahan } : {}),
          ...(kecamatan ? { kecamatan } : {}),
          ...(kabupatenKota ? { kabupatenKota } : {}),
          ...(provinsi ? { provinsi } : {}),
          ...(kodePos ? { kodePos } : {})
        }
      });
    }

    if (noHp || akun.nomorWa) {
      await prisma.kontakPasien.upsert({
        where: { pasienId: masterPasien.id },
        create: {
          pasienId: masterPasien.id,
          noHp: noHp || akun.nomorWa,
          kontakDarurat: kontakDarurat || namaLengkap.trim(),
          hubunganKontakDarurat: hubunganKontakDarurat || 'Keluarga',
          noHpDarurat: noHpDarurat || akun.nomorWa
        },
        update: {
          ...(noHp ? { noHp } : {}),
          ...(kontakDarurat ? { kontakDarurat } : {}),
          ...(hubunganKontakDarurat ? { hubunganKontakDarurat } : {}),
          ...(noHpDarurat ? { noHpDarurat } : {})
        }
      });
    }

    if (jenisPenjamin) {
      await prisma.penjaminPasien.upsert({
        where: { pasienId: masterPasien.id },
        create: {
          pasienId: masterPasien.id,
          jenisPenjamin,
          noBpjs: noBpjs || null
        },
        update: {
          jenisPenjamin,
          ...(noBpjs !== undefined ? { noBpjs: noBpjs || null } : {})
        }
      });
    }
  }

  // 3. Tentukan status pasien (Lama vs Baru) untuk kunjungan faskes ini
  const statusCheck = await checkPasienFaskes(nik, faskesId);
  const jenisPasien = statusCheck.isLama ? 'LAMA' : 'BARU';
  const noRM = masterPasien.noRM;

  // 4. Generate Nomor Antrean Poliklinik
  const poliklinik = await prisma.poliklinik.findUnique({
    where: { id: poliklinikId }
  });
  const prefix = poliklinik?.noAntrianPrefix || (poliklinik ? poliklinik.kodePoli.charAt(0).toUpperCase() : 'U');

  const visitDate = new Date(tanggalKunjungan);
  const startOfDay = new Date(visitDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(visitDate.setHours(23, 59, 59, 999));

  const totalBookingToday = await prisma.bookingAntreanOnline.count({
    where: {
      poliklinikId,
      tanggalKunjungan: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const nextNumber = totalBookingToday + 1;
  const noAntrian = `${prefix}-${String(nextNumber).padStart(3, '0')}`;

  // 5. Generate Kode Booking Unik
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const kodeBooking = `BK-${dateStr}-${randomSuffix}`;

  // 6. Simpan Booking ke database
  const booking = await prisma.bookingAntreanOnline.create({
    data: {
      akunPasienId: akunId,
      kodeBooking,
      faskesId,
      poliklinikId,
      dokterId,
      nik: cleanNik,
      namaLengkap: namaLengkap.trim(),
      tanggalLahir: new Date(tanggalLahir),
      tanggalKunjungan: new Date(tanggalKunjungan),
      keluhan: keluhan || null,
      jenisPasien,
      noRM,
      noAntrian,
      statusBooking: 'TERKONFIRMASI'
    },
    include: {
      faskes: true,
      poliklinik: true,
      dokter: true
    }
  });

  // 6. Kirim Tiket Konfirmasi ke WhatsApp Pasien
  try {
    await whatsappService.sendBookingConfirmation(akun.nomorWa, {
      namaLengkap: booking.namaLengkap,
      kodeBooking: booking.kodeBooking,
      noAntrian: booking.noAntrian,
      namaFaskes: booking.faskes.namaFaskes,
      namaPoli: booking.poliklinik.namaPoli,
      namaDokter: booking.dokter?.namaLengkap || 'Dokter Jaga Poliklinik',
      tanggalKunjungan: booking.tanggalKunjungan,
      jenisPasien: booking.jenisPasien,
      noRM: booking.noRM
    });
  } catch (waErr) {
    console.warn('[Booking] Gagal kirim notifikasi WhatsApp:', waErr.message);
  }

  return booking;
};

/**
 * 10. Ambil daftar Faskes, Poli, dan Dokter untuk pilihan pendaftaran online
 */
const getMasterDataForBooking = async (faskesId = null, poliklinikId = null) => {
  const faskesList = await prisma.faskes.findMany({
    where: { statusAktif: true },
    select: {
      id: true,
      kodeFaskes: true,
      namaFaskes: true,
      jenisFaskes: true,
      alamat: true,
      kecamatan: true
    },
    orderBy: { namaFaskes: 'asc' }
  });

  let poliList = [];
  if (faskesId) {
    poliList = await prisma.poliklinik.findMany({
      where: {
        OR: [
          { faskesId },
          { faskesId: null }
        ],
        statusAktif: true
      },
      select: {
        id: true,
        kodePoli: true,
        namaPoli: true,
        deskripsi: true,
        noAntrianPrefix: true
      },
      orderBy: { namaPoli: 'asc' }
    });
  }

  let dokterList = [];
  if (faskesId) {
    const dokterWhere = {
      faskesId,
      role: 'DOKTER'
    };
    if (poliklinikId) {
      dokterWhere.OR = [
        { poliklinikId },
        { poliklinikId: null }
      ];
    }
    dokterList = await prisma.user.findMany({
      where: dokterWhere,
      select: {
        id: true,
        namaLengkap: true,
        username: true,
        poliklinikId: true,
        poliklinik: {
          select: { id: true, namaPoli: true }
        }
      },
      orderBy: { namaLengkap: 'asc' }
    });
  }

  return {
    faskesList,
    poliList,
    dokterList
  };
};

/**
 * 11. Ambil Daftar Booking Online untuk Petugas Loket Faskes
 */
const getFaskesOnlineBookings = async (faskesId = null, options = {}) => {
  const { tanggal, search, status } = options;

  const whereClause = {};

  if (faskesId) {
    whereClause.faskesId = faskesId;
  }

  if (status && status !== 'SEMUA') {
    whereClause.statusBooking = status;
  }

  if (tanggal) {
    const targetDate = new Date(tanggal);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    whereClause.tanggalKunjungan = {
      gte: startOfDay,
      lte: endOfDay
    };
  }

  if (search) {
    whereClause.OR = [
      { kodeBooking: { contains: search, mode: 'insensitive' } },
      { namaLengkap: { contains: search, mode: 'insensitive' } },
      { nik: { contains: search } },
      { noAntrian: { contains: search, mode: 'insensitive' } }
    ];
  }

  const bookings = await prisma.bookingAntreanOnline.findMany({
    where: whereClause,
    include: {
      faskes: { select: { id: true, namaFaskes: true, kodeFaskes: true } },
      poliklinik: { select: { id: true, namaPoli: true, kodePoli: true } },
      dokter: { select: { id: true, namaLengkap: true } },
      akunPasien: { select: { id: true, nomorWa: true } }
    },
    orderBy: [
      { statusBooking: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  return bookings;
};

/**
 * 12. Check-in / Konfirmasi Kedatangan Booking Online di Loket Pendaftaran
 * - Mendaftarkan pasien ke Master Pasien faskes (jika belum ada)
 * - Menerbitkan No. RM resmi
 * - Membuat Kunjungan aktif untuk Poliklinik & Dokter
 * - Mengirim konfirmasi WhatsApp ke pasien
 */
const checkInOnlineBooking = async (bookingIdentifier, petugasId = null) => {
  if (!bookingIdentifier) {
    const error = new Error('ID atau Kode Booking wajib diisi');
    error.statusCode = 400;
    throw error;
  }

  // 1. Cari data booking online
  const booking = await prisma.bookingAntreanOnline.findFirst({
    where: {
      OR: [
        { id: bookingIdentifier },
        { kodeBooking: bookingIdentifier.trim() }
      ]
    },
    include: {
      faskes: true,
      poliklinik: true,
      dokter: true,
      akunPasien: true
    }
  });

  if (!booking) {
    const error = new Error(`Kode booking "${bookingIdentifier}" tidak ditemukan`);
    error.statusCode = 404;
    throw error;
  }

  if (booking.statusBooking === 'CHECKED_IN') {
    // Cari kunjungan yang sudah ada
    const existingKunjungan = await prisma.kunjungan.findFirst({
      where: {
        faskesId: booking.faskesId,
        poliklinikId: booking.poliklinikId,
        noAntrian: booking.noAntrian || undefined
      },
      include: {
        pasien: true,
        poliklinik: true,
        dokterTujuan: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      alreadyCheckedIn: true,
      message: 'Pasien dengan kode booking ini sudah pernah melakukan check-in hari ini.',
      booking,
      kunjungan: existingKunjungan,
      pasien: existingKunjungan?.pasien
    };
  }

  // 2. Transaksi atomic untuk pembuatan Pasien & Kunjungan
  const result = await prisma.$transaction(async (tx) => {
    // A. Cari apakah NIK sudah tersimpan di Master Pasien faskes ini
    let pasien = await tx.pasien.findFirst({
      where: {
        faskesId: booking.faskesId,
        nik: booking.nik
      }
    });

    // B. Jika pasien belum ada di Master Data Pasien faskes ini, daftarkan otomatis!
    if (!pasien) {
      const prefixFaskes = booking.faskes?.kodeFaskes ? booking.faskes.kodeFaskes.substring(0, 3).toUpperCase() : 'CBN';
      const randDigits = Math.floor(10000 + Math.random() * 90000);
      const generatedNoRM = booking.noRM || `RM-${prefixFaskes}-${randDigits}`;

      const cleanGender = (booking.jenisKelamin && booking.jenisKelamin.toLowerCase().startsWith('p')) ? 'Perempuan' : 'Laki-laki';

      pasien = await tx.pasien.create({
        data: {
          faskesId: booking.faskesId,
          nik: booking.nik,
          noRM: generatedNoRM,
          namaLengkap: booking.namaLengkap,
          tempatLahir: booking.faskes?.kecamatan || 'Kabupaten Bogor',
          tanggalLahir: new Date(booking.tanggalLahir),
          jenisKelamin: cleanGender,
          agama: 'Islam',
          pekerjaan: 'Warga / Pasien Mandiri',
          statusPerkawinan: 'Belum Kawin',
          kewarganegaraan: 'WNI',
          alamat: {
            create: {
              alamatKtp: booking.faskes?.alamat || 'Wilayah Domisili Puskesmas',
              alamatDomisili: booking.faskes?.alamat || 'Wilayah Domisili Puskesmas',
              rtRw: '001/001',
              desaKelurahan: booking.faskes?.kecamatan || 'Cibinong',
              kecamatan: booking.faskes?.kecamatan || 'Cibinong',
              kabupatenKota: 'Kabupaten Bogor',
              provinsi: 'Jawa Barat',
              kodePos: '16911'
            }
          },
          kontak: {
            create: {
              noHp: booking.akunPasien?.nomorWa || '-',
              kontakDarurat: 'Keluarga Pasien',
              hubunganKontakDarurat: 'Keluarga',
              noHpDarurat: booking.akunPasien?.nomorWa || '-'
            }
          },
          penjamin: {
            create: {
              jenisPenjamin: 'Umum'
            }
          }
        }
      });
    }

    // C. Buat Kunjungan aktif untuk Poliklinik & Dokter
    const now = new Date();
    const jamRegistrasi = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const kunjungan = await tx.kunjungan.create({
      data: {
        faskesId: booking.faskesId,
        pasienId: pasien.id,
        poliklinikId: booking.poliklinikId,
        dokterTujuanId: booking.dokterId || null,
        tanggalRegistrasi: now,
        jamRegistrasi,
        jenisPelayanan: 'Rawat Jalan',
        statusPasien: booking.jenisPasien === 'LAMA' ? 'Lama' : 'Baru',
        noAntrian: booking.noAntrian || 'U-001',
        prioritas: 'Umum',
        caraDatang: 'Pendaftaran Online Mandiri',
        statusKunjungan: 'MENUNGGU',
        userPendaftarId: petugasId || null,
      },
      include: {
        pasien: true,
        poliklinik: true,
        dokterTujuan: {
          select: { id: true, namaLengkap: true, username: true }
        }
      }
    });

    // D. Update status booking menjadi CHECKED_IN
    const updatedBooking = await tx.bookingAntreanOnline.update({
      where: { id: booking.id },
      data: {
        statusBooking: 'CHECKED_IN',
        noRM: pasien.noRM
      }
    });

    return { pasien, kunjungan, updatedBooking };
  });

  // 3. Kirim notifikasi konfirmasi check-in ke WhatsApp Pasien
  try {
    if (booking.akunPasien?.nomorWa) {
      await whatsappService.sendMessage(
        booking.akunPasien.nomorWa,
        `✅ *CHECK-IN BERHASIL DI LOKET FASKES*\n\n` +
        `Halo *${booking.namaLengkap}*,\n` +
        `Kedatangan Anda di *${booking.faskes.namaFaskes}* telah diverifikasi di Loket Pendaftaran.\n\n` +
        `🎫 *No. Antrean:* *${booking.noAntrian}*\n` +
        `🏥 *Poli Tujuan:* ${booking.poliklinik.namaPoli}\n` +
        `👨‍⚕️ *Dokter:* ${booking.dokter?.namaLengkap || 'Dokter Jaga Poliklinik'}\n` +
        `📋 *No. Rekam Medis:* *${result.pasien.noRM}*\n\n` +
        `Data Anda telah tercatat di Master Pasien dan Kunjungan Faskes. Silakan menuju ke ruang tunggu poliklinik untuk pemeriksaan oleh dokter. Terima kasih!`
      );
    }
  } catch (waErr) {
    console.warn('[CheckIn] Gagal kirim notifikasi WhatsApp:', waErr.message);
  }

  return {
    success: true,
    message: `Check-in berhasil! Pasien ${result.pasien.namaLengkap} telah masuk ke antrean ${booking.poliklinik.namaPoli}.`,
    pasien: result.pasien,
    kunjungan: result.kunjungan,
    booking: result.updatedBooking
  };
};

module.exports = {
  requestOtp,
  verifyOtpAndSetPin,
  loginWithPin,
  forgotPinRequestOtp,
  resetPinWithOtp,
  getAccountProfile,
  addKeluarga,
  checkPasienFaskes,
  createBooking,
  getMasterDataForBooking,
  getFaskesOnlineBookings,
  checkInOnlineBooking
};
