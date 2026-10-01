const prisma = require('../config/prisma');
const cloudinary = require('cloudinary').v2;
const satusehatService = require('./satusehat.service');
const PCareService = require('./bpjs/pcare.service');
const bpjsConfig = require('../config/bpjs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const createPasien = async (data) => {
  let tandaTanganUrl = '';
  
  // Upload tanda tangan ke Cloudinary jika ada base64 string
  if (data.tandaTangan && data.tandaTangan.startsWith('data:image')) {
    try {
      const uploadResponse = await cloudinary.uploader.upload(data.tandaTangan, {
        folder: 'tanda_tangan_pasien',
      });
      tandaTanganUrl = uploadResponse.secure_url;
    } catch (error) {
      console.error('Gagal mengunggah tanda tangan ke Cloudinary:', error);
      // Fallback atau throw error, untuk sekarang biarkan kosong jika gagal
    }
  }

  let fotoWajahUrl = '';
  // Upload foto wajah ke Cloudinary jika ada base64 string
  if (data.fotoWajah && data.fotoWajah.startsWith('data:image')) {
    try {
      const uploadResponse = await cloudinary.uploader.upload(data.fotoWajah, {
        folder: 'foto_wajah_pasien',
      });
      fotoWajahUrl = uploadResponse.secure_url;
    } catch (error) {
      console.error('Gagal mengunggah foto wajah ke Cloudinary:', error);
      // Fallback atau throw error, untuk sekarang biarkan kosong jika gagal
    }
  }

  let newIhs = data.noIHS;
  let ibuIhs = null;

  const isBayiReg = Boolean(data.isBayi || data.nikIbu);
  data.isBayi = isBayiReg;

  if (isBayiReg && data.nikIbu) {
    try {
      // LANGKAH 1: GET informasi Ibu pasien dari SATUSEHAT by NIK Ibu
      const checkIbuRes = await satusehatService.getPatientByNIK(data.nikIbu);
      if (checkIbuRes.success && checkIbuRes.ihsNumber) {
        ibuIhs = checkIbuRes.ihsNumber;
        console.log(`[SATUSEHAT Bayi] Data Ibu ditemukan dengan Nomor IHS: ${ibuIhs}`);
      } else {
        console.log(`[SATUSEHAT Bayi] Data Ibu belum ada di SATUSEHAT, mendaftarkan Ibu via NIK ${data.nikIbu}...`);
        // LANGKAH 1.a: POST Create Patient record untuk Ibu jika belum ada
        const createIbuRes = await satusehatService.createPatient({
          nik: data.nikIbu,
          namaLengkap: data.namaIbu || `Ibu dari ${data.namaLengkap}`,
          jenisKelamin: 'Perempuan',
          tanggalLahir: '1995-01-01', // Fallback default jika tidak ada tgl lahir ibu
          kewarganegaraan: 'WNI',
          statusPerkawinan: 'Kawin',
          alamatKtp: data.alamatKtp,
          provinsi: data.provinsi,
          kabupatenKota: data.kabupatenKota,
          kecamatan: data.kecamatan,
          desaKelurahan: data.desaKelurahan,
          noHp: data.noHp
        });
        if (createIbuRes.success && createIbuRes.ihsNumber) {
          ibuIhs = createIbuRes.ihsNumber;
        }
      }

      // LANGKAH 2.a: POST Informasi Pasien Bayi Baru Lahir ke SATUSEHAT (System: nik-ibu, maritalStatus: S)
      const postBayiRes = await satusehatService.createPatient(data);
      if (postBayiRes.success && postBayiRes.ihsNumber) {
        newIhs = postBayiRes.ihsNumber;
        console.log(`[SATUSEHAT Bayi] Berhasil mendaftarkan Bayi Baru Lahir dengan Nomor IHS: ${newIhs}`);

        // LANGKAH 2.b: POST Create record RelatedPerson (Hubungkan Bayi dengan Ibu - MTH)
        if (data.namaIbu) {
          await satusehatService.createRelatedPerson(data, newIhs, ibuIhs);
        }
      }
    } catch (e) {
      console.error("[SATUSEHAT Bayi] Error Alur Pendaftaran Bayi Baru Lahir:", e.message);
    }
  } else if (!newIhs && data.nik) {
    try {
      // Cek apakah NIK sudah ada di SATUSEHAT
      const checkRes = await satusehatService.getPatientByNIK(data.nik);
      if (checkRes.success && checkRes.ihsNumber) {
        newIhs = checkRes.ihsNumber;
      } else {
        // Jika tidak ada, daftarkan pasien baru ke SATUSEHAT
        const postRes = await satusehatService.createPatient(data);
        if (postRes.success && postRes.ihsNumber) {
          newIhs = postRes.ihsNumber;
        }
      }
    } catch (e) {
      console.error("Gagal sinkronisasi pendaftaran ke SATUSEHAT:", e.message);
    }
  }

  // Gunakan transaksi untuk memastikan semua data tersimpan atau tidak sama sekali (atomic)
  const newPasien = await prisma.$transaction(async (tx) => {
    
    // Jika Pendaftaran Bayi Baru Lahir, simpan/pastikan data IBU tersimpan di Master Data Pasien
    if (data.isBayi && data.nikIbu) {
      const ibuExisting = await tx.pasien.findUnique({
        where: { nik: data.nikIbu }
      });

      if (!ibuExisting) {
        await tx.pasien.create({
          data: {
            faskesId: data.faskesId || null,
            noRM: `RM-IBU-${Math.floor(Math.random() * 1000000)}`,
            noIHS: ibuIhs || null,
            nik: data.nikIbu,
            noKk: data.noKk,
            namaLengkap: data.namaIbu || `Ny. Ibu dari ${data.namaLengkap}`,
            tempatLahir: data.tempatLahir || "Sesuai Ibu",
            tanggalLahir: new Date("1995-01-01"),
            jenisKelamin: "Perempuan",
            agama: data.agama || "Islam",
            pekerjaan: "Ibu Rumah Tangga",
            statusPerkawinan: "Kawin",
            kewarganegaraan: "WNI",
            alamat: {
              create: {
                alamatKtp: data.alamatKtp,
                alamatDomisili: data.alamatDomisili,
                rtRw: data.rtRw,
                desaKelurahan: data.desaKelurahan,
                kecamatan: data.kecamatan,
                kabupatenKota: data.kabupatenKota,
                provinsi: data.provinsi,
                kodePos: data.kodePos
              }
            },
            kontak: {
              create: {
                noHp: data.noHp || "-",
                kontakDarurat: data.namaAyah || "-",
                hubunganKontakDarurat: "Suami",
                noHpDarurat: data.noHpDarurat || "-"
              }
            }
          }
        });
        console.log(`[Master Data Pasien] Berhasil mendaftarkan Ibu (${data.namaIbu}) ke tabel Master Pasien`);
      }
    }

    // 1. Cari Pasien Lama (jika NIK diisi untuk non-bayi) atau Buat Pasien Baru untuk BAYI
    let pasien = null;
    if (data.nik && !data.isBayi) {
      pasien = await tx.pasien.findUnique({
        where: { nik: data.nik }
      });
    }

    if (!pasien) {
      pasien = await tx.pasien.create({
        data: {
          faskesId: data.faskesId || null,
          noRM: data.noRekamMedis,
          noIHS: newIhs || null,
          nik: data.nik || null,
          noKk: data.noKk,
          namaLengkap: data.namaLengkap,
          tempatLahir: data.tempatLahir,
          tanggalLahir: new Date(data.tanggalLahir),
          jenisKelamin: data.jenisKelamin,
          golonganDarah: data.golonganDarah,
          rhesus: data.rhesus,
          fotoWajah: fotoWajahUrl,
          agama: data.agama,
          pendidikan: data.pendidikan,
          pekerjaan: data.pekerjaan,
          statusPerkawinan: data.statusPerkawinan,
          kewarganegaraan: data.kewarganegaraan,

          // Relasi Nested Writes
          alamat: {
            create: {
              alamatKtp: data.alamatKtp,
              alamatDomisili: data.alamatDomisili,
              rtRw: data.rtRw,
              desaKelurahan: data.desaKelurahan,
              kecamatan: data.kecamatan,
              kabupatenKota: data.kabupatenKota,
              provinsi: data.provinsi,
              kodePos: data.kodePos,
              titikGps: data.titikGps
            }
          },
          kontak: {
            create: {
              noHp: data.noHp,
              email: data.email,
              kontakDarurat: data.kontakDarurat,
              hubunganKontakDarurat: data.hubunganKontakDarurat,
              noHpDarurat: data.noHpDarurat
            }
          },
          sosial: {
            create: {
              statusDisabilitas: data.statusDisabilitas,
              programSosial: data.programSosial
            }
          },
          // Data Bayi (Opsional)
          ...((data.isBayi || Boolean(data.nikIbu)) ? {
            dataBayi: {
              create: {
                namaIbu: data.namaIbu,
                nikIbu: data.nikIbu,
                namaAyah: data.namaAyah,
                beratLahir: data.beratLahir,
                panjangLahir: data.panjangLahir,
                jamLahir: data.jamLahir,
                jenisPersalinan: data.jenisPersalinan,
                urutanKelahiran: data.urutanKelahiran !== undefined ? Number(data.urutanKelahiran) : 0,
                isKelahiranGanda: (data.urutanKelahiran && Number(data.urutanKelahiran) > 0) ? true : false
              }
            }
          } : {}),
          penjamin: {
            create: {
              jenisPenjamin: data.jenisPenjamin,
              noBpjs: data.noBpjs,
              statusKepesertaan: data.statusKepesertaan,
              faskesTingkat1: data.faskesTingkat1,
              kelasRawat: data.kelasRawat,
              namaAsuransi: data.namaAsuransi,
              nomorPolis: data.nomorPolis,
              masaBerlakuAsuransi: data.masaBerlakuAsuransi
            }
          }
        }
      });
    } else {
      // Perbarui data Master Pasien jika diperbaiki atau dilengkapi oleh loket
      await tx.pasien.update({
        where: { id: pasien.id },
        data: {
          ...(data.namaLengkap ? { namaLengkap: data.namaLengkap } : {}),
          ...(data.noKk ? { noKk: data.noKk } : {}),
          ...(data.tempatLahir ? { tempatLahir: data.tempatLahir } : {}),
          ...(data.tanggalLahir ? { tanggalLahir: new Date(data.tanggalLahir) } : {}),
          ...(data.jenisKelamin ? { jenisKelamin: data.jenisKelamin } : {}),
          ...(data.golonganDarah !== undefined ? { golonganDarah: data.golonganDarah || null } : {}),
          ...(data.rhesus !== undefined ? { rhesus: data.rhesus || null } : {}),
          ...(data.agama ? { agama: data.agama } : {}),
          ...(data.pendidikan !== undefined ? { pendidikan: data.pendidikan || null } : {}),
          ...(data.pekerjaan ? { pekerjaan: data.pekerjaan } : {}),
          ...(data.statusPerkawinan ? { statusPerkawinan: data.statusPerkawinan } : {}),
          ...(data.kewarganegaraan ? { kewarganegaraan: data.kewarganegaraan } : {}),
          ...(newIhs ? { noIHS: newIhs } : (data.noIHS ? { noIHS: data.noIHS } : {}))
        }
      });

      if (data.alamatKtp) {
        await tx.alamatPasien.upsert({
          where: { pasienId: pasien.id },
          create: {
            pasienId: pasien.id,
            alamatKtp: data.alamatKtp,
            alamatDomisili: data.alamatDomisili || data.alamatKtp,
            rtRw: data.rtRw || '001/001',
            desaKelurahan: data.desaKelurahan || '-',
            kecamatan: data.kecamatan || '-',
            kabupatenKota: data.kabupatenKota || '-',
            provinsi: data.provinsi || '-',
            kodePos: data.kodePos || '-'
          },
          update: {
            alamatKtp: data.alamatKtp,
            alamatDomisili: data.alamatDomisili || data.alamatKtp,
            ...(data.rtRw ? { rtRw: data.rtRw } : {}),
            ...(data.desaKelurahan ? { desaKelurahan: data.desaKelurahan } : {}),
            ...(data.kecamatan ? { kecamatan: data.kecamatan } : {}),
            ...(data.kabupatenKota ? { kabupatenKota: data.kabupatenKota } : {}),
            ...(data.provinsi ? { provinsi: data.provinsi } : {}),
            ...(data.kodePos ? { kodePos: data.kodePos } : {})
          }
        });
      }

      if (data.noHp) {
        await tx.kontakPasien.upsert({
          where: { pasienId: pasien.id },
          create: {
            pasienId: pasien.id,
            noHp: data.noHp,
            email: data.email || null,
            kontakDarurat: data.kontakDarurat || '-',
            hubunganKontakDarurat: data.hubunganKontakDarurat || '-',
            noHpDarurat: data.noHpDarurat || '-'
          },
          update: {
            noHp: data.noHp,
            ...(data.email !== undefined ? { email: data.email || null } : {}),
            ...(data.kontakDarurat ? { kontakDarurat: data.kontakDarurat } : {}),
            ...(data.hubunganKontakDarurat ? { hubunganKontakDarurat: data.hubunganKontakDarurat } : {}),
            ...(data.noHpDarurat ? { noHpDarurat: data.noHpDarurat } : {})
          }
        });
      }

      // Jika pasien sudah ada, namun mendaftar sebagai bayi, buat/update DataBayi-nya
      if (data.isBayi || Boolean(data.nikIbu)) {
        await tx.dataBayi.upsert({
          where: { pasienId: pasien.id },
          create: {
            pasienId: pasien.id,
            namaIbu: data.namaIbu,
            nikIbu: data.nikIbu,
            namaAyah: data.namaAyah,
            beratLahir: data.beratLahir,
            panjangLahir: data.panjangLahir,
            jamLahir: data.jamLahir,
            jenisPersalinan: data.jenisPersalinan,
            urutanKelahiran: data.urutanKelahiran !== undefined ? Number(data.urutanKelahiran) : 0,
            isKelahiranGanda: (data.urutanKelahiran && Number(data.urutanKelahiran) > 0) ? true : false
          },
          update: {
            namaIbu: data.namaIbu,
            nikIbu: data.nikIbu,
            namaAyah: data.namaAyah,
            beratLahir: data.beratLahir,
            panjangLahir: data.panjangLahir,
            jamLahir: data.jamLahir,
            jenisPersalinan: data.jenisPersalinan,
            urutanKelahiran: data.urutanKelahiran !== undefined ? Number(data.urutanKelahiran) : 0,
            isKelahiranGanda: (data.urutanKelahiran && Number(data.urutanKelahiran) > 0) ? true : false
          }
        });
        console.log(`[Master Data Bayi] Upsert DataBayi untuk Pasien ID: ${pasien.id}`);
      }
    }

    // 0. Generate Nomor Antrean (Opsional jika poliTujuan ada)
    let kunjungan = null;
    if (data.poliTujuan) {
      if (!data.dokterTujuan || data.dokterTujuan === 'Bebas') {
        const error = new Error('Dokter tujuan wajib dipilih dan tidak boleh kosong.');
        error.statusCode = 400;
        throw error;
      }

      const poliklinik = await tx.poliklinik.findUnique({
        where: { id: data.poliTujuan }
      });
      const prefix = poliklinik ? poliklinik.kodePoli.charAt(0).toUpperCase() : 'U';
    
    const regDate = new Date(data.tanggalRegistrasi);
    const startOfDay = new Date(regDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(regDate.setHours(23, 59, 59, 999));

    const countHariIni = await tx.kunjungan.count({
      where: {
        poliklinikId: data.poliTujuan,
        tanggalRegistrasi: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const urutan = countHariIni + 1;
    const generatedNoAntrian = data.noAntrian || `${prefix}-${urutan.toString().padStart(3, '0')}`;

    // 2. Buat Kunjungan
    kunjungan = await tx.kunjungan.create({
      data: {
        faskesId: data.faskesId || null,
        pasienId: pasien.id,
        tanggalRegistrasi: new Date(data.tanggalRegistrasi),
        jamRegistrasi: data.jamRegistrasi,
        poliklinikId: data.poliTujuan,
        layananTujuan: data.layananTujuan,
        jenisPelayanan: data.jenisPelayanan,
        statusPasien: data.statusPasien,
        noAntrian: generatedNoAntrian,
        prioritas: data.prioritas,
        caraDatang: data.caraDatang,
        
        dokterTujuanId: data.dokterTujuan,
        userPendaftarId: data.userPendaftarId || null,
        noSep: data.noSep,
        statusKunjungan: "MENUNGGU",
        timestamp: data.timestamp || Date.now().toString(),
        
        // Relasi Rujukan (Opsional)
        ...(data.caraDatang === 'Rujukan' ? {
          rujukan: {
            create: {
              asalRujukan: data.asalRujukan,
              noRujukan: data.noRujukan,
              tanggalRujukan: data.tanggalRujukan,
              fasilitasPerujuk: data.fasilitasPerujuk,
              diagnosaAwal: data.diagnosaAwal,
              jenisRujukan: data.jenisRujukan
            }
          }
        } : {}),

        // Persetujuan Medis
        persetujuan: {
          create: {
            persetujuanPengobatan: data.persetujuanPengobatan !== undefined ? Boolean(data.persetujuanPengobatan) : true,
            persetujuanRekamMedis: data.persetujuanRekamMedis !== undefined ? Boolean(data.persetujuanRekamMedis) : true,
            persetujuanSatusehat: Boolean(data.persetujuanSatusehat),
            persetujuanReminder: data.persetujuanReminder || false,
            // Simpan URL dari Cloudinary atau persetujuan aktif
            tandaTangan: tandaTanganUrl || 'PERSETUJUAN_RME_AKTIF'
          }
        }
      },
      include: {
        rujukan: true,
        persetujuan: true
      }
    });

    // 3. Create Encounter di SATUSEHAT
    const effectiveIhs = newIhs || pasien.noIHS;
    if (data.persetujuanSatusehat && effectiveIhs && data.dokterTujuan) {
      try {
        const dokter = await tx.user.findUnique({
          where: { id: data.dokterTujuan },
          include: { tenagaMedis: true }
        });

        const effectiveDokterIhs = dokter?.tenagaMedis?.noIHS || process.env.SATUSEHAT_PRACTITIONER_IHS;

        if (dokter && effectiveDokterIhs && poliklinik && poliklinik.ihsLocationId) {
          const encounterResult = await satusehatService.createEncounter({
            pasienIhs: effectiveIhs,
            pasienName: pasien.namaLengkap,
            dokterIhs: effectiveDokterIhs,
            dokterName: dokter.namaLengkap || 'Dokter Pemeriksa',
            poliIhs: poliklinik.ihsLocationId,
            poliName: poliklinik.namaPoli,
            noKunjungan: kunjungan.id,
            jenisPelayanan: data.jenisPelayanan, // Rawat Jalan / Rawat Inap / IGD
            peranDokter: 'ATND' // Default ke Attending Physician
          });

          if (encounterResult.success && encounterResult.encounterId) {
            await tx.kunjungan.update({
              where: { id: kunjungan.id },
              data: { 
                encounterId: encounterResult.encounterId,
                satusehat_sync_status: 'SUCCESS',
                satusehat_last_error: null
              }
            });
            kunjungan.encounterId = encounterResult.encounterId;
            kunjungan.satusehat_sync_status = 'SUCCESS';
          }
        }
      } catch (error) {
        console.error('Failed to create Encounter in SATUSEHAT:', error.message || error);
        await tx.kunjungan.update({
          where: { id: kunjungan.id },
          data: { 
            satusehat_sync_status: 'FAILED',
            satusehat_last_error: error.message || String(error)
          }
        });
      }
    } // End if (data.persetujuanSatusehat)
    }

    // ================================================================
    // [BPJS PCARE BRIDGING] Anti-Corruption Layer — Soft-fail Pattern
    // Identik dengan pola SATUSEHAT di atas: pendaftaran lokal SELALU sukses.
    // Jika BPJS down → statusKlaimBpjs = 'PENDING_SYNC' (bisa di-sync ulang nanti).
    // ================================================================
    const isBpjs = data.jenisPenjamin === 'BPJS' || data.jenisPenjamin === 'BPJS Kesehatan';
    const hasBpjsCredentials = bpjsConfig.BPJS_CONS_ID && bpjsConfig.BPJS_SECRET_KEY;

    if (isBpjs && data.noBpjs && hasBpjsCredentials) {
      try {
        // Format tanggal ke YYYY-MM-DD (requirement PCare)
        const tglDaftar = new Date(data.tanggalRegistrasi).toISOString().split('T')[0];

        const pcareResult = await PCareService.daftarkanKunjungan({
          noBpjs: data.noBpjs,
          tanggalRegistrasi: tglDaftar,
          kdPoliTujuan: poliklinik?.kodePoli || data.poliTujuan,
          noRM: pasien.noRM,
        });

        // Sukses → simpan nomor kunjungan PCare ke database
        await tx.kunjungan.update({
          where: { id: kunjungan.id },
          data: {
            noKunjunganPcare: pcareResult.noKunjungan,
            noUrutPcare: pcareResult.noUrut?.toString(),
            statusKlaimBpjs: 'TERKIRIM',
          },
        });

        kunjungan.noKunjunganPcare = pcareResult.noKunjungan;
        kunjungan.statusKlaimBpjs = 'TERKIRIM';

        console.log(`[BPJS PCare] Kunjungan berhasil didaftarkan. NoKunjungan: ${pcareResult.noKunjungan}`);
      } catch (bpjsError) {
        // SOFT-FAIL: BPJS down/error → catat sebagai PENDING_SYNC
        // Petugas bisa sync ulang nanti via tombol di frontend.
        console.error('[BPJS PCare] Gagal mendaftarkan kunjungan (soft-fail):', bpjsError.message);

        await tx.kunjungan.update({
          where: { id: kunjungan.id },
          data: { statusKlaimBpjs: 'PENDING_SYNC' },
        });

        kunjungan.statusKlaimBpjs = 'PENDING_SYNC';
        // TIDAK throw error — pendaftaran lokal tetap sukses!
      }
    }

    // Update status booking online jika pendaftaran berhasil diproses loket
    if (data.nik) {
      await tx.bookingAntreanOnline.updateMany({
        where: {
          nik: data.nik,
          statusBooking: 'TERKONFIRMASI'
        },
        data: {
          statusBooking: 'CHECKED_IN'
        }
      });
    }

    return { ...pasien, kunjungan };
  });

  return newPasien;
};

const getAllPasien = async (user, requestedFaskesId) => {
  const isDinkes = user && ['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role);
  const effectiveFaskesId = isDinkes ? (requestedFaskesId || null) : (user?.faskesId || requestedFaskesId || null);

  const where = {};
  if (effectiveFaskesId) {
    where.OR = [
      { faskesId: effectiveFaskesId },
      { kunjungans: { some: { faskesId: effectiveFaskesId } } }
    ];
  }

  return await prisma.pasien.findMany({
    where,
    include: {
      faskes: {
        select: {
          id: true,
          namaFaskes: true,
          kodeFaskes: true
        }
      },
      alamat: true,
      kontak: true,
      sosial: true,
      penjamin: true,
      dataBayi: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

const searchPasien = async (query, user, requestedFaskesId) => {
  const isDinkes = user && ['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role);
  const effectiveFaskesId = isDinkes ? (requestedFaskesId || null) : (user?.faskesId || requestedFaskesId || null);

  const where = {
    AND: [
      {
        OR: [
          { nik: query },
          { noRM: query }
        ]
      }
    ]
  };

  if (effectiveFaskesId) {
    where.AND.push({
      OR: [
        { faskesId: effectiveFaskesId },
        { kunjungans: { some: { faskesId: effectiveFaskesId } } }
      ]
    });
  }

  const pasien = await prisma.pasien.findFirst({
    where,
    include: {
      faskes: {
        select: {
          id: true,
          namaFaskes: true,
          kodeFaskes: true
        }
      },
      alamat: true,
      kontak: true,
      sosial: true,
      penjamin: true,
      dataBayi: true,
      kunjungans: {
        include: {
          persetujuan: true
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });

  if (pasien) {
    // Cek apakah pasien sudah pernah memberikan persetujuan (consent) sebelumnya
    const prevConsent = pasien.kunjungans?.find(k => k.persetujuan);
    pasien.hasPersetujuanSebelumnya = Boolean(prevConsent || pasien.fotoWajah || (pasien.kunjungans && pasien.kunjungans.length > 0));
    if (prevConsent?.persetujuan) {
      pasien.persetujuanSebelumnya = prevConsent.persetujuan;
    }

    if (pasien.nik) {
    const booking = await prisma.bookingAntreanOnline.findFirst({
      where: {
        nik: pasien.nik,
        ...(effectiveFaskesId ? { faskesId: effectiveFaskesId } : {}),
        statusBooking: 'TERKONFIRMASI'
      },
      include: {
        poliklinik: true,
        dokter: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (booking) {
      pasien.bookingAktif = {
        id: booking.id,
        kodeBooking: booking.kodeBooking,
        poliklinikId: booking.poliklinikId,
        namaPoli: booking.poliklinik?.namaPoli,
        dokterId: booking.dokterId,
        namaDokter: booking.dokter?.namaLengkap,
        keluhan: booking.keluhan,
        noAntrian: booking.noAntrian,
        tanggalKunjungan: booking.tanggalKunjungan
      };
    }
  }
  }

  return pasien;
};

const updatePasien = async (id, data, user) => {
  const isDinkes = user && ['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role);
  const effectiveFaskesId = isDinkes ? null : user?.faskesId;

  if (effectiveFaskesId) {
    const existing = await prisma.pasien.findFirst({
      where: {
        id: String(id),
        OR: [
          { faskesId: effectiveFaskesId },
          { kunjungans: { some: { faskesId: effectiveFaskesId } } }
        ]
      }
    });
    if (!existing) {
      const error = new Error('Pasien tidak ditemukan atau bukan milik fasilitas kesehatan Anda');
      error.statusCode = 403;
      throw error;
    }
  }

  return await prisma.pasien.update({
    where: { id: String(id) },
    data: data,
    include: {
      alamat: true,
      kontak: true,
      sosial: true,
      penjamin: true,
    }
  });
};

const deletePasien = async (id, user) => {
  const isDinkes = user && ['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role);
  const effectiveFaskesId = isDinkes ? null : user?.faskesId;

  if (effectiveFaskesId) {
    const existing = await prisma.pasien.findFirst({
      where: {
        id: String(id),
        OR: [
          { faskesId: effectiveFaskesId },
          { kunjungans: { some: { faskesId: effectiveFaskesId } } }
        ]
      }
    });
    if (!existing) {
      const error = new Error('Pasien tidak ditemukan atau bukan milik fasilitas kesehatan Anda');
      error.statusCode = 403;
      throw error;
    }
  }

  return await prisma.pasien.delete({
    where: { id: String(id) }
  });
};

module.exports = {
  createPasien,
  getAllPasien,
  searchPasien,
  updatePasien,
  deletePasien
};
