const prisma = require('../config/prisma');
const kasirService = require('./kasir.service');

/**
 * Helper untuk men-generate Nomor Rekam Medis (No. RM) resmi faskes
 * Menggantikan nomor darurat sementara RM-EMG- saat administrasi diverifikasi di loket
 */
const generateOfficialNoRM = async (tx, faskesId) => {
  let prefix = 'RM-2026';
  if (faskesId) {
    const faskes = await tx.faskes.findUnique({ where: { id: faskesId } });
    if (faskes?.namaFaskes) {
      if (faskes.namaFaskes.toLowerCase().includes('cibinong')) prefix = 'RM-CBN';
      else if (faskes.namaFaskes.toLowerCase().includes('sukamakmur')) prefix = 'RM-SKM';
      else if (faskes.kodeFaskes) prefix = `RM-${faskes.kodeFaskes.slice(-3).toUpperCase()}`;
    }
  }

  const latestPasien = await tx.pasien.findFirst({
    where: {
      noRM: { startsWith: `${prefix}-` }
    },
    orderBy: {
      noRM: 'desc'
    }
  });

  let nextNum = 1;
  if (latestPasien?.noRM) {
    const parts = latestPasien.noRM.split('-');
    const numPart = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(numPart)) {
      nextNum = numPart + 1;
    }
  }

  let candidate = `${prefix}-${nextNum.toString().padStart(5, '0')}`;
  let attempts = 0;
  while (attempts < 10) {
    const exists = await tx.pasien.findUnique({ where: { noRM: candidate } });
    if (!exists) break;
    nextNum++;
    candidate = `${prefix}-${nextNum.toString().padStart(5, '0')}`;
    attempts++;
  }

  if (attempts >= 10) {
    candidate = `${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  return candidate;
};

const ugdService = {
  /**
   * Mengambil daftar seluruh Tempat Tidur UGD / IGD di Faskes
   */
  getBedsUGD: async (faskesId = null) => {
    const where = {
      ruangan: {
        kategoriRuangan: { in: ['UGD', 'IGD'] },
        ...(faskesId ? { faskesId } : {})
      }
    };

    return await prisma.tempatTidur.findMany({
      where,
      include: {
        ruangan: true,
        kunjunganAktif: {
          include: {
            pasien: true,
            screening: true
          }
        }
      },
      orderBy: [
        { ruangan: { namaRuangan: 'asc' } },
        { nomorBed: 'asc' }
      ]
    });
  },

  /**
   * Mengambil Antrean Pasien Aktif di UGD (Untuk Dashboard Dokter UGD & Perawat)
   */
  getAntreanUGD: async (faskesId = null, user = null, queryParams = {}) => {
    const where = {
      jenisPelayanan: { in: ['UGD', 'IGD', 'Gawat Darurat'] },
      statusKunjungan: { notIn: ['SELESAI', 'BATAL', 'PULANG'] },
      ...(faskesId ? { faskesId } : {})
    };

    if (queryParams.filter === 'my' && user?.id) {
      where.dokterTujuanId = user.id;
    } else if (queryParams.dokterId) {
      where.dokterTujuanId = queryParams.dokterId;
    }

    const list = await prisma.kunjungan.findMany({
      where,
      include: {
        pasien: {
          include: { penjamin: true }
        },
        tempatTidurs: {
          include: { ruangan: true }
        },
        screening: true,
        rekamMedis: true,
        dokterTujuan: true,
        userPendaftar: true,
        diagnosis: {
          include: { icd10: true }
        },
        tindakans: {
          include: { icd9: true }
        }
      },
      orderBy: [
        { tanggalRegistrasi: 'desc' }
      ]
    });

    // Urutkan prioritas Triase: MERAH -> KUNING -> HIJAU -> HITAM -> lainnya
    const triageWeight = {
      'MERAH': 1,
      'KUNING': 2,
      'HIJAU': 3,
      'HITAM': 4
    };

    return list.sort((a, b) => {
      const aWeight = triageWeight[a.triase?.toUpperCase()] || 5;
      const bWeight = triageWeight[b.triase?.toUpperCase()] || 5;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return new Date(b.tanggalRegistrasi).getTime() - new Date(a.tanggalRegistrasi).getTime();
    });
  },

  /**
   * Mengambil Antrean Pending Administrasi UGD (Untuk Loket Pendaftaran)
   */
  getPendingAdministrasi: async (faskesId = null) => {
    const where = {
      jenisPelayanan: { in: ['UGD', 'IGD', 'Gawat Darurat'] },
      statusAdministrasi: 'PENDING',
      statusKunjungan: { notIn: ['BATAL'] },
      ...(faskesId ? { faskesId } : {})
    };

    return await prisma.kunjungan.findMany({
      where,
      include: {
        pasien: {
          include: { penjamin: true }
        },
        tempatTidurs: {
          include: { ruangan: true }
        },
        screening: true,
        rekamMedis: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  },

  /**
   * Penerimaan Pasien Darurat UGD (Emergency Admission / Quick Triage)
   * Dilakukan langsung oleh Perawat UGD begitu pasien tiba di Bed UGD
   */
  admitPasienDarurat: async (payload, user) => {
    const {
      tempatTidurId,
      triase = 'MERAH',
      keluhanUtama = 'Kegawatdaruratan Medis',
      isAnonim = true,
      namaPasien,
      jenisKelamin = 'Laki-laki',
      perkiraanUmur = 35,
      tandaVital = {},
      pasienId: existingPasienId,
      caraDatang = 'Ambulans',
      dokterId
    } = payload;

    const faskesId = user.faskesId || payload.faskesId;

    if (!tempatTidurId) {
      const err = new Error('Tempat Tidur UGD wajib dipilih untuk penempatan pasien.');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Validasi & kunci tempat tidur UGD
      const bed = await tx.tempatTidur.findUnique({
        where: { id: tempatTidurId },
        include: { ruangan: true }
      });

      if (!bed) {
        throw new Error('Tempat tidur UGD tidak ditemukan.');
      }
      if (bed.statusBed === 'TERISI') {
        throw new Error(`Bed ${bed.nomorBed} (${bed.ruangan.namaRuangan}) saat ini sedang terisi oleh pasien lain.`);
      }

      // 2. Siapkan Data Pasien (Bisa Pasien Eksis atau Pasien Baru/Anonim)
      let targetPasien = null;
      if (existingPasienId) {
        targetPasien = await tx.pasien.findUnique({ where: { id: existingPasienId } });
      }

      if (!targetPasien) {
        const dummyRM = `RM-EMG-${Date.now().toString().slice(-6)}`;
        const displayName = isAnonim
          ? (namaPasien || `${jenisKelamin === 'Perempuan' ? 'Mrs. X' : 'Mr. X'} (~${perkiraanUmur} th)`)
          : (namaPasien || 'Pasien UGD');

        // Perkiraan tahun lahir
        const birthYear = new Date().getFullYear() - (parseInt(perkiraanUmur) || 30);
        const approxDob = `${birthYear}-01-01`;

        targetPasien = await tx.pasien.create({
          data: {
            faskesId,
            noRM: dummyRM,
            namaLengkap: displayName,
            jenisKelamin,
            tanggalLahir: new Date(approxDob),
            tempatLahir: 'UGD',
            agama: 'Islam',
            pekerjaan: 'Lainnya',
            statusPerkawinan: 'Belum Kawin',
            kewarganegaraan: 'WNI',
            alamat: {
              create: {
                alamatKtp: 'Alamat Sementara (Pasien Darurat UGD)',
                alamatDomisili: 'Alamat Sementara (Pasien Darurat UGD)',
                rtRw: '00/00',
                desaKelurahan: '-',
                kecamatan: '-',
                kabupatenKota: '-',
                provinsi: '-',
                kodePos: '00000'
              }
            },
            kontak: {
              create: {
                noHp: '080000000000',
                kontakDarurat: 'Petugas UGD',
                hubunganKontakDarurat: 'Petugas',
                noHpDarurat: '080000000000'
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

      // 3. Tentukan Dokter Jaga UGD yang di-assign (DPJP)
      let dokterUgdId = dokterId || (user.role === 'DOKTER_UGD' ? user.id : null);
      if (!dokterUgdId) {
        const defaultDokter = await tx.user.findFirst({
          where: { role: 'DOKTER_UGD', ...(faskesId ? { faskesId } : {}) }
        }) || await tx.user.findFirst({
          where: { role: 'DOKTER', ...(faskesId ? { faskesId } : {}) }
        });
        dokterUgdId = defaultDokter?.id || user.id;
      }

      // 4. Generate No Antrean UGD
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const countUgdToday = await tx.kunjungan.count({
        where: {
          jenisPelayanan: { in: ['UGD', 'IGD', 'Gawat Darurat'] },
          createdAt: { gte: today },
          ...(faskesId ? { faskesId } : {})
        }
      });
      const noAntrian = `EMG-${(countUgdToday + 1).toString().padStart(3, '0')}`;

      const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

      // 5. Buat Record Kunjungan UGD (Status MENUNGGU_DOKTER untuk pemeriksaan DPJP)
      const kunjungan = await tx.kunjungan.create({
        data: {
          faskesId,
          pasienId: targetPasien.id,
          tanggalRegistrasi: new Date(),
          jamRegistrasi: nowTime,
          jenisPelayanan: 'UGD',
          statusPasien: existingPasienId ? 'Lama' : 'Baru',
          noAntrian,
          prioritas: triase === 'MERAH' ? 'Gawat Darurat Kritis' : triase === 'KUNING' ? 'Gawat Darurat Urgent' : 'Umum',
          caraDatang,
          statusKunjungan: 'MENUNGGU_DOKTER',
          statusAdministrasi: 'PENDING', // Loket perlu melengkapi berkas ini
          triase,
          isAnonim: Boolean(isAnonim),
          namaAnonim: targetPasien.namaLengkap,
          kondisiTiba: keluhanUtama,
          dokterTujuanId: dokterUgdId,
          userPendaftarId: user.id
        }
      });

      // 6. Update Status Bed UGD menjadi TERISI & link ke Kunjungan ini
      await tx.tempatTidur.update({
        where: { id: tempatTidurId },
        data: {
          statusBed: 'TERISI',
          operationalStatus: 'O',
          kunjunganAktifId: kunjungan.id
        }
      });

      // 7. Buat Rekam Medis Awal UGD dengan status MENUNGGU (menunggu pemeriksaan SOAP dokter)
      await tx.rekamMedis.create({
        data: {
          kunjungan: { connect: { id: kunjungan.id } },
          pasien: { connect: { id: targetPasien.id } },
          dokter: { connect: { id: dokterUgdId } },
          keluhanUtama,
          statusPemeriksaan: 'MENUNGGU'
        }
      });

      // 8. Buat Screening / Quick Triage Awal UGD oleh Perawat
      await tx.screening.create({
        data: {
          kunjungan: { connect: { id: kunjungan.id } },
          pasien: { connect: { id: targetPasien.id } },
          petugas: user.namaLengkap || 'Perawat UGD',
          jenisKedatangan: caraDatang || 'Ambulans',
          kategoriTriage: triase || 'MERAH',
          keluhanUtama,
          tekananDarahSistolik: (tandaVital && tandaVital.sistole && !isNaN(parseInt(tandaVital.sistole))) ? parseInt(tandaVital.sistole) : null,
          tekananDarahDiastolik: (tandaVital && tandaVital.diastole && !isNaN(parseInt(tandaVital.diastole))) ? parseInt(tandaVital.diastole) : null,
          nadi: (tandaVital && tandaVital.nadi && !isNaN(parseInt(tandaVital.nadi))) ? parseInt(tandaVital.nadi) : null,
          frekuensiNapas: (tandaVital && tandaVital.pernapasan && !isNaN(parseInt(tandaVital.pernapasan))) ? parseInt(tandaVital.pernapasan) : null,
          suhuTubuh: (tandaVital && tandaVital.suhu && !isNaN(parseFloat(tandaVital.suhu))) ? parseFloat(tandaVital.suhu) : null,
          saturasiOksigen: (tandaVital && tandaVital.spo2 && !isNaN(parseInt(tandaVital.spo2))) ? parseInt(tandaVital.spo2) : null,
          dataTambahan: { kesadaran: (tandaVital && tandaVital.kesadaran) || 'Compos Mentis' },
          skalaNyeri: (tandaVital && tandaVital.tingkatNyeri && !isNaN(parseInt(tandaVital.tingkatNyeri))) ? parseInt(tandaVital.tingkatNyeri) : 0
        }
      });

      return {
        kunjungan,
        pasien: targetPasien,
        bed
      };
    });
  },

  /**
   * Update Triase & Observasi Tanda Vital Pasien UGD
   * Dilakukan oleh Perawat UGD untuk memperbarui hasil observasi tanda-tanda vital berkala
   */
  updateTriaseObservasi: async (kunjunganId, payload, user) => {
    const {
      triase,
      keluhanUtama,
      tandaVital = {},
      dokterId
    } = payload;

    const kunjungan = await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: { screening: true, rekamMedis: true }
    });

    if (!kunjungan) {
      const err = new Error('Data kunjungan UGD tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    // 1. Update data kunjungan jika ada perubahan triase atau dokter DPJP
    const kunjunganUpdate = {};
    if (triase) kunjunganUpdate.triase = triase;
    if (keluhanUtama) kunjunganUpdate.kondisiTiba = keluhanUtama;
    if (dokterId) kunjunganUpdate.dokterTujuanId = dokterId;

    if (Object.keys(kunjunganUpdate).length > 0) {
      await prisma.kunjungan.update({
        where: { id: kunjunganId },
        data: kunjunganUpdate
      });
    }

    // 2. Update dokterId di Rekam Medis jika ada perubahan dokter yang di-assign
    if (dokterId) {
      await prisma.rekamMedis.updateMany({
        where: { kunjunganId },
        data: { dokterId }
      });
    }

    // 3. Update / Upsert Screening Triage
    const sistole = (tandaVital.sistole && !isNaN(parseInt(tandaVital.sistole))) ? parseInt(tandaVital.sistole) : null;
    const diastole = (tandaVital.diastole && !isNaN(parseInt(tandaVital.diastole))) ? parseInt(tandaVital.diastole) : null;
    const nadi = (tandaVital.nadi && !isNaN(parseInt(tandaVital.nadi))) ? parseInt(tandaVital.nadi) : null;
    const pernapasan = (tandaVital.pernapasan && !isNaN(parseInt(tandaVital.pernapasan))) ? parseInt(tandaVital.pernapasan) : null;
    const suhu = (tandaVital.suhu && !isNaN(parseFloat(tandaVital.suhu))) ? parseFloat(tandaVital.suhu) : null;
    const spo2 = (tandaVital.spo2 && !isNaN(parseInt(tandaVital.spo2))) ? parseInt(tandaVital.spo2) : null;
    const skalaNyeri = (tandaVital.tingkatNyeri && !isNaN(parseInt(tandaVital.tingkatNyeri))) ? parseInt(tandaVital.tingkatNyeri) : 0;
    const kesadaran = tandaVital.kesadaran || 'Compos Mentis';

    const screeningData = {
      petugas: user.namaLengkap || 'Perawat UGD',
      kategoriTriage: triase || kunjungan.triase || 'MERAH',
      keluhanUtama: keluhanUtama || kunjungan.kondisiTiba || 'Observasi UGD',
      tekananDarahSistolik: sistole,
      tekananDarahDiastolik: diastole,
      nadi,
      frekuensiNapas: pernapasan,
      suhuTubuh: suhu,
      saturasiOksigen: spo2,
      skalaNyeri,
      dataTambahan: {
        kesadaran,
        diupdateOleh: user.namaLengkap || user.username,
        waktuUpdate: new Date().toISOString()
      }
    };

    if (kunjungan.screening) {
      await prisma.screening.update({
        where: { id: kunjungan.screening.id },
        data: screeningData
      });
    } else {
      await prisma.screening.create({
        data: {
          kunjunganId,
          pasienId: kunjungan.pasienId,
          ...screeningData
        }
      });
    }

    return await prisma.kunjungan.findUnique({
      where: { id: kunjunganId },
      include: {
        pasien: true,
        screening: true,
        dokterTujuan: true,
        userPendaftar: true,
        tempatTidurs: { include: { ruangan: true } }
      }
    });
  },

  /**
   * Menyelesaikan / Melengkapi Administrasi Pasien UGD
   * Dijalankan oleh Petugas Loket Pendaftaran ketika berkas/identitas pasien sudah tiba
   */
  lengkapiAdministrasi: async (kunjunganId, payload, user) => {
    const {
      existingPasienId,
      // Data Pasien Baru / Update
      nik,
      namaLengkap,
      tempatLahir,
      tanggalLahir,
      jenisKelamin,
      alamatKtp,
      alamatDomisili,
      noHp,
      jenisPenjamin = 'Umum',
      noBpjs,
      kontakDarurat,
      hubunganKontakDarurat,
      noHpDarurat
    } = payload;

    const updatedKunjungan = await prisma.$transaction(async (tx) => {
      const kunjungan = await tx.kunjungan.findUnique({
        where: { id: kunjunganId },
        include: { pasien: true }
      });

      if (!kunjungan) {
        throw new Error('Data kunjungan UGD tidak ditemukan.');
      }

      let finalPasienId = kunjungan.pasienId;

      // Cek apakah NIK sudah pernah terdaftar pada pasien lain
      let matchedExistingPasien = null;
      if (!existingPasienId && nik) {
        matchedExistingPasien = await tx.pasien.findUnique({ where: { nik } });
      }

      const effectiveExistingId = existingPasienId || (matchedExistingPasien ? matchedExistingPasien.id : null);

      // Skenario A: Tautkan ke data pasien lama yang sudah terdaftar
      if (effectiveExistingId && effectiveExistingId !== kunjungan.pasienId) {
        finalPasienId = effectiveExistingId;

        const oldPasienId = kunjungan.pasienId;
        await tx.kunjungan.update({
          where: { id: kunjunganId },
          data: {
            pasienId: effectiveExistingId,
            statusAdministrasi: 'LENGKAP',
            isAnonim: false,
            namaAnonim: null
          }
        });

        // Update juga screening dan rekam medis yang mungkin sudah dibuat di kunjungan ini agar menunjuk pasien terpilih
        await tx.screening.updateMany({
          where: { kunjunganId },
          data: { pasienId: effectiveExistingId }
        });

        await tx.rekamMedis.updateMany({
          where: { kunjunganId },
          data: { pasienId: effectiveExistingId }
        });

        try {
          const otherVisits = await tx.kunjungan.count({ where: { pasienId: oldPasienId } });
          if (otherVisits === 0) {
            await tx.penjaminPasien.deleteMany({ where: { pasienId: oldPasienId } });
            await tx.alamatPasien.deleteMany({ where: { pasienId: oldPasienId } });
            await tx.kontakPasien.deleteMany({ where: { pasienId: oldPasienId } });
            await tx.pasien.delete({ where: { id: oldPasienId } });
          }
        } catch (_) {}
      } else {
        // Skenario B: Update data pasien anonim saat ini menjadi identitas lengkap (Pasien Baru Resmi)
        const currentPasien = await tx.pasien.findUnique({ where: { id: finalPasienId } });
        const targetFaskesId = kunjungan.faskesId || user.faskesId || currentPasien?.faskesId;

        // Generate nomor RM resmi jika masih menggunakan nomor RM darurat sementara (RM-EMG-)
        let officialNoRM = payload.noRM || payload.noRekamMedis;
        if (!officialNoRM && (!currentPasien?.noRM || currentPasien.noRM.startsWith('RM-EMG-'))) {
          officialNoRM = await generateOfficialNoRM(tx, targetFaskesId);
        }

        await tx.pasien.update({
          where: { id: finalPasienId },
          data: {
            ...(officialNoRM ? { noRM: officialNoRM } : {}),
            ...(targetFaskesId && !currentPasien?.faskesId ? { faskesId: targetFaskesId } : {}),
            ...(nik ? { nik } : {}),
            ...(namaLengkap ? { namaLengkap } : {}),
            ...(tempatLahir ? { tempatLahir } : {}),
            ...(tanggalLahir ? { tanggalLahir: new Date(tanggalLahir) } : {}),
            ...(jenisKelamin ? { jenisKelamin } : {})
          }
        });

        // Update / Upsert Alamat
        if (alamatKtp) {
          await tx.alamatPasien.upsert({
            where: { pasienId: finalPasienId },
            update: {
              alamatKtp,
              alamatDomisili: alamatDomisili || alamatKtp
            },
            create: {
              pasien: { connect: { id: finalPasienId } },
              alamatKtp,
              alamatDomisili: alamatDomisili || alamatKtp,
              rtRw: '00/00',
              desaKelurahan: '-',
              kecamatan: '-',
              kabupatenKota: '-',
              provinsi: '-',
              kodePos: '00000'
            }
          });
        }

        // Update / Upsert Kontak
        if (noHp || kontakDarurat) {
          await tx.kontakPasien.upsert({
            where: { pasienId: finalPasienId },
            update: {
              ...(noHp ? { noHp } : {}),
              ...(kontakDarurat ? { kontakDarurat } : {}),
              ...(hubunganKontakDarurat ? { hubunganKontakDarurat } : {}),
              ...(noHpDarurat ? { noHpDarurat } : {})
            },
            create: {
              pasien: { connect: { id: finalPasienId } },
              noHp: noHp || '080000000000',
              kontakDarurat: kontakDarurat || '-',
              hubunganKontakDarurat: hubunganKontakDarurat || 'Keluarga',
              noHpDarurat: noHpDarurat || '-'
            }
          });
        }

        // Update / Upsert Penjamin
        if (jenisPenjamin) {
          await tx.penjaminPasien.upsert({
            where: { pasienId: finalPasienId },
            update: {
              jenisPenjamin,
              noBpjs: noBpjs || null
            },
            create: {
              pasien: { connect: { id: finalPasienId } },
              jenisPenjamin,
              noBpjs: noBpjs || null
            }
          });
        }
      }

      // Update Kunjungan UGD menjadi LENGKAP
      const updatedKunjungan = await tx.kunjungan.update({
        where: { id: kunjunganId },
        data: {
          pasienId: finalPasienId,
          statusAdministrasi: 'LENGKAP',
          isAnonim: false,
          namaAnonim: null,
          userPendaftarId: user.id
        },
        include: {
          pasien: { include: { penjamin: true, alamat: true, kontak: true } },
          tempatTidurs: { include: { ruangan: true } }
        }
      });

      return updatedKunjungan;
    }, { timeout: 15000, maxWait: 10000 });

    // Generate tagihan kasir awal di luar transaksi
    try {
      await kasirService.generateTagihan(kunjunganId);
    } catch (errTagihan) {
      console.error('[Kasir UGD] Gagal generate tagihan:', errTagihan.message);
    }

    return updatedKunjungan;
  },

  /**
   * Simpan Pemeriksaan Medis Dokter UGD & Keputusan Akhir
   */
  simpanPemeriksaanUGD: async (kunjunganId, data, user) => {
    // Validasi Wewenang Klinis: Perawat UGD tidak berwenang memutuskan rencana tindak lanjut/discharge & SOAP medis
    if (user.role === 'PERAWAT') {
      const err = new Error('Wewenang Ditolak: Perawat UGD hanya melakukan triase dan observasi tanda vital. Pemeriksaan medis SOAP, diagnosa, dan penetapan rencana tindak lanjut/discharge merupakan wewenang Dokter DPJP.');
      err.statusCode = 403;
      throw err;
    }

    const {
      keluhanUtama,
      riwayatPenyakit,
      pemeriksaanFisik,
      rencanaTerapi,
      instruksiMedis,
      diagnosaList = [],
      tindakanList = [],
      keputusan = 'PULANG', // 'PULANG' | 'RAWAT_INAP' | 'DIRUJUK' | 'MENINGGAL'
      alasanKeputusan = '',
      // Jika RAWAT_INAP
      tempatTidurInapId,
      catatanBangsal = '',
      // Jika DIRUJUK
      rujukanData = {}
    } = data;

    const result = await prisma.$transaction(async (tx) => {
      const kunjungan = await tx.kunjungan.findUnique({
        where: { id: kunjunganId },
        include: {
          tempatTidurs: true,
          rekamMedis: true,
          dokterTujuan: true
        }
      });

      if (!kunjungan) {
        throw new Error('Kunjungan UGD tidak ditemukan.');
      }

      // Validasi Wewenang DPJP:
      // Hanya Dokter yang di-assign (DPJP) yang boleh melakukan pemeriksaan medis SOAP & discharge
      if (['DOKTER', 'DOKTER_UGD'].includes(user.role)) {
        if (kunjungan.dokterTujuanId && kunjungan.dokterTujuanId !== user.id) {
          const rawName = kunjungan.dokterTujuan?.namaLengkap || 'Dokter Lain';
          const targetDocName = rawName.toLowerCase().startsWith('dr') ? rawName : `dr. ${rawName}`;
          const err = new Error(`Wewenang Ditolak: Pasien ini di-assign ke ${targetDocName}. Hanya dokter DPJP yang ditugaskan yang berwenang melakukan pemeriksaan SOAP dan penetapan keputusan discharge.`);
          err.statusCode = 403;
          throw err;
        }
      }

      // Tentukan dokter pemeriksa penanggung jawab:
      let dokterId = (user.role === 'DOKTER_UGD' || user.role === 'DOKTER') ? user.id : (kunjungan.dokterTujuanId || user.id);

      // 1. Simpan SOAP / Rekam Medis
      await tx.rekamMedis.upsert({
        where: { kunjunganId },
        update: {
          keluhanUtama: keluhanUtama || undefined,
          riwayatPenyakitSekarang: riwayatPenyakit || undefined,
          pemeriksaanFisik: pemeriksaanFisik || undefined,
          rencanaTerapi: rencanaTerapi || undefined,
          instruksiMedis: instruksiMedis || catatanBangsal || undefined,
          dokter: { connect: { id: dokterId } },
          penginput: { connect: { id: user.id } },
          statusPemeriksaan: 'SELESAI'
        },
        create: {
          kunjungan: { connect: { id: kunjunganId } },
          pasien: { connect: { id: kunjungan.pasienId } },
          dokter: { connect: { id: dokterId } },
          keluhanUtama: keluhanUtama || 'Pemeriksaan UGD',
          riwayatPenyakitSekarang: riwayatPenyakit || '',
          pemeriksaanFisik: pemeriksaanFisik || '',
          rencanaTerapi: rencanaTerapi || '',
          instruksiMedis: instruksiMedis || catatanBangsal || '',
          penginput: { connect: { id: user.id } },
          statusPemeriksaan: 'SELESAI'
        }
      });

      // 2. Simpan Diagnosa ICD-10
      if (diagnosaList.length > 0) {
        await tx.diagnosisPasien.deleteMany({ where: { kunjunganId } });
        for (const diag of diagnosaList) {
          if (!diag.icd10Id) continue;
          await tx.diagnosisPasien.create({
            data: {
              kunjunganId,
              icd10Id: diag.icd10Id,
              jenisDiagnosis: diag.jenisDiagnosis || 'Primer',
              dokterId: dokterId,
              penginputId: user.id
            }
          });
        }
      }

      // 3. Simpan Tindakan ICD-9
      if (tindakanList.length > 0) {
        await tx.tindakanPasien.deleteMany({ where: { kunjunganId } });
        for (const t of tindakanList) {
          if (!t.icd9Id) continue;
          await tx.tindakanPasien.create({
            data: {
              kunjunganId,
              icd9Id: t.icd9Id,
              pelaksanaId: user.id,
              catatan: t.catatan || null
            }
          });
        }
      }

      // 4. Bebaskan Bed UGD saat ini
      if (kunjungan.tempatTidurs && kunjungan.tempatTidurs.length > 0) {
        for (const bed of kunjungan.tempatTidurs) {
          await tx.tempatTidur.update({
            where: { id: bed.id },
            data: {
              statusBed: 'TERSEDIA',
              operationalStatus: 'U',
              kunjunganAktifId: null
            }
          });
        }
      }

      // 5. Eksekusi Keputusan Akhir UGD
      let targetStatusKunjungan = 'SELESAI';
      let statusPulang = 'PULANG_SEMBUH';

      if (keputusan === 'RAWAT_INAP') {
        targetStatusKunjungan = 'RAWAT_INAP';
        statusPulang = 'RAWAT_INAP';

        if (tempatTidurInapId) {
          await tx.tempatTidur.update({
            where: { id: tempatTidurInapId },
            data: {
              statusBed: 'TERISI',
              operationalStatus: 'O',
              kunjunganAktifId: kunjungan.id
            }
          });
        }
      } else if (keputusan === 'DIRUJUK') {
        targetStatusKunjungan = 'DIRUJUK';
        statusPulang = 'DIRUJUK_RS';

        if (rujukanData.faskesTujuan) {
          await tx.rujukanKeluar.upsert({
            where: { kunjunganId },
            update: {
              faskesTujuan: rujukanData.faskesTujuan,
              poliTujuan: rujukanData.poliTujuan || 'IGD / Rawat Inap',
              alasanRujukan: rujukanData.alasanRujukan || alasanKeputusan
            },
            create: {
              kunjunganId,
              faskesTujuan: rujukanData.faskesTujuan,
              poliTujuan: rujukanData.poliTujuan || 'IGD / Rawat Inap',
              alasanRujukan: rujukanData.alasanRujukan || alasanKeputusan
            }
          });
        }
      } else if (keputusan === 'MENINGGAL') {
        targetStatusKunjungan = 'SELESAI';
        statusPulang = 'MENINGGAL';
      } else {
        // PULANG
        targetStatusKunjungan = 'MENUNGGU_KASIR';
        statusPulang = 'PULANG_SEMBUH';
      }

      const updated = await tx.kunjungan.update({
        where: { id: kunjunganId },
        data: {
          statusKunjungan: targetStatusKunjungan,
          statusPulang,
          dokterTujuanId: dokterId,
          waktuPemeriksaanSelesai: new Date(),
          waktuDischarge: new Date()
        }
      });

      return updated;
    });

    // Generate tagihan kasir jika pasien pulang
    try {
      await kasirService.generateTagihan(kunjunganId);
    } catch (errTagihan) {
      console.warn('[Kasir UGD] Info generate tagihan:', errTagihan.message);
    }

    return result;
  }
};

module.exports = ugdService;
