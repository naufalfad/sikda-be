const prisma = require('../config/prisma');

const parseSafeFloat = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
};

const parseSafeInt = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
};

const createScreening = async (data, petugasId) => {
  const result = await prisma.$transaction(async (tx) => {
    let finalPasienId = data.pasienId;
    if (data.kunjunganId) {
      const kunj = await tx.kunjungan.findUnique({
        where: { id: data.kunjunganId },
        select: { id: true, pasienId: true }
      });
      if (kunj && !finalPasienId) {
        finalPasienId = kunj.pasienId;
      }
    }

    // Kemas semua data tambahan (Step 2-5) ke dalam JSON
    const dataTambahan = {
      // Step 2 - Triage
      triage: {
        jalanNapas: data.jalanNapas || null,
        sirkulasi: data.sirkulasi || null,
        kesadaran: data.kesadaran || null,
      },
      // Step 1 - Riwayat Klinis
      riwayat: {
        lamaKeluhan: data.lamaKeluhan || null,
        riwayatPenyakitSekarang: data.riwayatPenyakitSekarang || null,
        riwayatPenyakitDahulu: data.riwayatPenyakitDahulu || null,
        riwayatAlergi: data.riwayatAlergi || null,
        riwayatOperasi: data.riwayatOperasi || null,
        riwayatRawatInap: data.riwayatRawatInap || null,
        riwayatTransfusi: data.riwayatTransfusi || null,
        riwayatPengobatan: data.riwayatPengobatan || null,
      },
      // Step 3 - Gaya Hidup & PTM
      gayaHidup: {
        lamaMerokok: data.lamaMerokok || null,
        jumlahBatang: data.jumlahBatang || null,
        alkohol: data.alkohol || null,
        narkoba: data.narkoba || null,
        aktivitasFisik: data.aktivitasFisik || null,
        polaMakan: data.polaMakan || null,
        konsumsiBuah: data.konsumsiBuah || null,
        konsumsiSayur: data.konsumsiSayur || null,
        konsumsiGaram: data.konsumsiGaram || null,
        konsumsiGula: data.konsumsiGula || null,
        tidur: data.tidur || null,
      },
      faktorRisiko: {
        faktorRisikoLain: data.faktorRisikoLain || [],
        ptmJantung: data.ptmJantung || [],
        ptmStroke: data.ptmStroke || [],
        ptmKanker: data.ptmKanker || [],
        gulaDarahSewaktu: parseSafeFloat(data.gulaDarahSewaktu),
      },
      // Step 4 - TB & Kesehatan Jiwa
      tb: {
        gejalaTB: data.gejalaTB || [],
        kontakTB: data.kontakTB || null,
        riwayatTB: data.riwayatTB || [],
        faktorRisikoTB: data.faktorRisikoTB || [],
        hasilTB: data.hasilTB || null,
      },
      jiwa: {
        jiwaEmosional: data.jiwaEmosional || [],
        jiwaSosial: data.jiwaSosial || [],
        jiwaPsikologis: data.jiwaPsikologis || [],
        jiwaBunuhDiri: data.jiwaBunuhDiri || [],
        jiwaZat: data.jiwaZat || [],
        statusPsikologis: data.statusPsikologis || 'Tenang / Normal',
      },
      antropometri: {
        luasPermukaanTubuh: parseSafeFloat(data.luasPermukaanTubuh),
      },
      // Skrining Khusus Poli Gigi & Mulut
      gigi: {
        golonganDarah: data.golonganDarah || null,
        rhesus: data.rhesus || null,
        statusKehamilan: data.statusKehamilan || null,
        debrisIndex: parseSafeFloat(data.debrisIndex),
        kalkulusIndex: parseSafeFloat(data.kalkulusIndex),
        skorOhis: parseSafeFloat(data.skorOhis),
        interpretasiOhis: data.interpretasiOhis || null,
        riwayatAlergiAnestesi: data.riwayatAlergiAnestesi || null,
        riwayatPengencerDarah: data.riwayatPengencerDarah || null,
      },
      // Catatan per-step
      catatan: {
        catatanPenyakitKeluarga: data.catatanPenyakitKeluarga || null,
        catatanGayaHidup: data.catatanGayaHidup || null,
        catatanRisikoLain: data.catatanRisikoLain || null,
        catatanPtmKhusus: data.catatanPtmKhusus || null,
        catatanPengukuran: data.catatanPengukuran || null,
        catatanSkriningTB: data.catatanSkriningTB || null,
        catatanKesehatanJiwa: data.catatanKesehatanJiwa || null,
      },
    };

    // Update data Golongan Darah & Rhesus di Master Pasien jika diisi saat Skrining
    if (finalPasienId && (data.golonganDarah || data.rhesus)) {
      await tx.pasien.update({
        where: { id: finalPasienId },
        data: {
          ...(data.golonganDarah && { golonganDarah: data.golonganDarah }),
          ...(data.rhesus && { rhesus: data.rhesus })
        }
      });
    }

    const screeningPayload = {
      pasienId: finalPasienId,
      petugas: data.petugasNama || 'Perawat',
      jenisKedatangan: data.jenisKedatangan || 'Poli',
      kategoriTriage: data.kategoriTriage || 'Hijau',
      // Tanda Vital & Antropometri
      tinggiBadan: parseSafeFloat(data.tinggiBadan),
      beratBadan: parseSafeFloat(data.beratBadan),
      lingkarPerut: parseSafeFloat(data.lingkarPerut),
      imt: parseSafeFloat(data.imt),
      tekananDarahSistolik: parseSafeInt(data.tekananDarahSistolik),
      tekananDarahDiastolik: parseSafeInt(data.tekananDarahDiastolik),
      nadi: parseSafeInt(data.nadi),
      frekuensiNapas: parseSafeInt(data.frekuensiNapas),
      suhuTubuh: parseSafeFloat(data.suhuTubuh),
      saturasiOksigen: parseSafeInt(data.saturasiOksigen),
      skalaNyeri: parseSafeInt(data.skalaNyeri),
      // Keluhan & Gaya Hidup
      keluhanUtama: data.keluhanUtama || null,
      riwayatKeluarga: Array.isArray(data.riwayatKeluarga) ? data.riwayatKeluarga : [],
      merokok: data.merokok || null,
      // Hasil Screening
      statusKesehatan: data.statusKesehatan || null,
      prioritasPelayanan: data.prioritasPelayanan || null,
      catatanPetugas: data.catatanPetugas || null,
      // Semua data tambahan (JSON)
      dataTambahan,
      headToToe: data.headToToe || null,
    };

    // 1. Simpan atau Update data screening ke database (Upsert jika kunjunganId sudah memiliki screening)
    let screening;
    if (data.kunjunganId) {
      screening = await tx.screening.upsert({
        where: { kunjunganId: data.kunjunganId },
        create: {
          ...screeningPayload,
          kunjunganId: data.kunjunganId,
        },
        update: screeningPayload,
      });
    } else {
      screening = await tx.screening.create({
        data: screeningPayload,
      });
    }

    // 2. Update status kunjungan → pasien siap diperiksa dokter
    if (data.kunjunganId) {
      await tx.kunjungan.update({
        where: { id: data.kunjunganId },
        data: { statusKunjungan: 'MENUNGGU_DOKTER' },
      });
    }

    return screening;
  });
  
  // 3. Trigger sinkronisasi SATUSEHAT (berjalan di background tanpa memblokir response UI)
  sendObservationToSatuSehat(result.id).catch(err => console.error(err));

  // 4. Trigger auto check-in untuk perawat jika belum presensi pada shift saat ini
  if (petugasId) {
    const { autoCheckInPerawatIfMissing } = require('../utils/fee.helper');
    autoCheckInPerawatIfMissing(petugasId, data.faskesId, new Date()).catch(err => console.warn(err));
  }

  return result;
};

const sendObservationToSatuSehat = async (screeningId) => {
  const satusehatService = require('./satusehat.service');
  try {
    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      include: {
        kunjungan: {
          include: {
            pasien: true,
            dokterTujuan: {
              include: { tenagaMedis: true }
            }
          }
        }
      }
    });

    if (!screening || !screening.kunjungan || !screening.kunjungan.encounterId) {
      console.log('Tidak dapat sinkron Observation: Encounter ID belum ada');
      return;
    }

    const { kunjungan } = screening;
    const { pasien, dokterTujuan } = kunjungan;

    if (!pasien.noIHS || !dokterTujuan?.tenagaMedis?.noIHS) {
      console.log('Tidak dapat sinkron Observation: IHS Pasien/Dokter belum lengkap');
      return;
    }

    const basePayload = {
      pasienIhs: pasien.noIHS,
      pasienName: pasien.namaLengkap,
      dokterIhs: dokterTujuan.tenagaMedis.noIHS,
      dokterName: dokterTujuan.namaLengkap,
      encounterId: kunjungan.encounterId,
    };

    const observationPayloads = [];

    // 1. Suhu
    if (screening.suhuTubuh) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "8310-5",
        loincDisplay: "Body temperature",
        value: screening.suhuTubuh,
        unit: "C",
        unitCode: "Cel"
      });
    }

    // 2. Nadi
    if (screening.nadi) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "8867-4",
        loincDisplay: "Heart rate",
        value: screening.nadi,
        unit: "beats/minute",
        unitCode: "/min"
      });
    }

    // 3. SpO2
    if (screening.saturasiOksigen) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "2708-6",
        loincDisplay: "Oxygen saturation in Arterial blood",
        value: screening.saturasiOksigen,
        unit: "%",
        unitCode: "%"
      });
    }

    // 4. Tekanan Darah (Sistolik / Diastolik)
    if (screening.tekananDarahSistolik && screening.tekananDarahDiastolik) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "85354-9",
        loincDisplay: "Blood pressure panel with all children optional",
        components: [
          {
            code: {
              coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }]
            },
            valueQuantity: { value: screening.tekananDarahSistolik, unit: "mm[Hg]", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
          },
          {
            code: {
              coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }]
            },
            valueQuantity: { value: screening.tekananDarahDiastolik, unit: "mm[Hg]", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
          }
        ]
      });
    }

    // 5. Frekuensi Napas (Respiratory Rate)
    if (screening.frekuensiNapas) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "9279-1",
        loincDisplay: "Respiratory rate",
        value: screening.frekuensiNapas,
        unit: "breaths/minute",
        unitCode: "/min"
      });
    }

    // 6. Tinggi Badan
    if (screening.tinggiBadan) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "8302-2",
        loincDisplay: "Body height",
        value: screening.tinggiBadan,
        unit: "cm",
        unitCode: "cm"
      });
    }

    // 7. Berat Badan
    if (screening.beratBadan) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "29463-7",
        loincDisplay: "Body weight",
        value: screening.beratBadan,
        unit: "kg",
        unitCode: "kg"
      });
    }

    // 8. Lingkar Perut
    if (screening.lingkarPerut) {
      observationPayloads.push({
        ...basePayload,
        loincCode: "8280-0",
        loincDisplay: "Waist Circumference at umbilicus by Tape measure",
        value: screening.lingkarPerut,
        unit: "cm",
        unitCode: "cm"
      });
    }

    // [DINONAKTIFKAN] Observation sekarang dikirim via Bundle Transaction saat dokter klik "Selesaikan Pemeriksaan"
    // Kode di bawah ini tetap disimpan untuk referensi jika ingin mengirim Observation secara individual di masa depan.
    /*
    // Send all observations in 1 Bundle Transaction
    let observationIds = [];
    if (observationPayloads.length > 0) {
      try {
        const resBundle = await satusehatService.createObservationBundle(observationPayloads);
        if (resBundle && resBundle.success) {
          observationIds = resBundle.observationIds.map((id, index) => ({
            type: `Observation_${index + 1}`,
            id: id
          }));
        }
      } catch (e) {
        console.error("Error creating Observation Bundle:", e.message);
      }
    }

    // Update DB with observation Ids
    if (observationIds.length > 0) {
      await prisma.screening.update({
        where: { id: screeningId },
        data: { observationIds: observationIds }
      });
      
      const syncStatus = (typeof kunjungan.satusehatSync === 'object' && kunjungan.satusehatSync !== null) 
        ? { ...kunjungan.satusehatSync } 
        : {};
      
      syncStatus.Observation = { status: 'SUCCESS', detail: `Sent ${observationIds.length} observations` };
      
      await prisma.kunjungan.update({
        where: { id: kunjungan.id },
        data: { satusehatSync: syncStatus }
      });

      console.log('Berhasil sinkron Observation TTV ke SATUSEHAT:', observationIds);
    }
    */
    console.log(`[Screening] Data vital signs disimpan ke DB lokal. Akan dikirim ke SATUSEHAT via Bundle saat pemeriksaan selesai.`);
  } catch (err) {
    console.error('Gagal sinkron Observation TTV:', err.message);
  }
};

const getScreeningByKunjungan = async (kunjunganId) => {
  return await prisma.screening.findUnique({
    where: { kunjunganId },
  });
};

module.exports = {
  createScreening,
  getScreeningByKunjungan,
};
