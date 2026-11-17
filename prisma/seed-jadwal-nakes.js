const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedJadwalNakes() {
  console.log('--- Memulai Seeding Jadwal & Izin/Cuti Nakes ---');

  // Cari semua user dokter dan perawat
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['DOKTER', 'DOKTER_UGD', 'PERAWAT'] },
    },
    include: {
      poliklinik: true,
      faskes: true,
    },
  });

  console.log(`Ditemukan ${users.length} tenaga medis di database.`);

  const jadwalConfigs = {
    // Poli Umum Cibinong
    'dr_cibinong': {
      hariList: ['SENIN', 'SELASA', 'RABU', 'KAMIS'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 40,
    },
    'dr.andi': {
      hariList: ['SENIN', 'RABU', 'JUMAT', 'SABTU'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 40,
    },
    'dr.siti': {
      hariList: ['SELASA', 'KAMIS', 'JUMAT'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 35,
    },
    // Poli Gigi Cibinong
    'drg_cibinong': {
      hariList: ['SENIN', 'SELASA', 'KAMIS', 'JUMAT'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 25,
    },
    'drg.budi': {
      hariList: ['RABU', 'SABTU'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 25,
    },
    // Sukamakmur
    'dr_sukamakmur': {
      hariList: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 40,
    },
    'drg_sukamakmur': {
      hariList: ['SENIN', 'RABU', 'KAMIS'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 25,
    },
    // Perawat
    'perawat_cibinong': {
      hariList: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'],
      shift: 'PAGI',
      jamMulai: '07:30',
      jamSelesai: '14:30',
      kuota: 50,
    },
    'perawat_sukamakmur': {
      hariList: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'],
      shift: 'PAGI',
      jamMulai: '07:30',
      jamSelesai: '14:30',
      kuota: 50,
    },
  };

  let totalJadwalCreated = 0;

  for (const user of users) {
    const config = jadwalConfigs[user.username] || {
      hariList: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'],
      shift: 'PAGI',
      jamMulai: '08:00',
      jamSelesai: '14:00',
      kuota: 30,
    };

    for (const hari of config.hariList) {
      const existing = await prisma.jadwalNakes.findFirst({
        where: {
          userId: user.id,
          hari: hari,
          shift: config.shift,
          poliklinikId: user.poliklinikId || null,
        },
      });

      if (existing) {
        await prisma.jadwalNakes.update({
          where: { id: existing.id },
          data: {
            jamMulai: config.jamMulai,
            jamSelesai: config.jamSelesai,
            kuotaPasien: config.kuota,
            statusAktif: true,
            faskesId: user.faskesId,
          },
        });
      } else {
        await prisma.jadwalNakes.create({
          data: {
            userId: user.id,
            poliklinikId: user.poliklinikId || null,
            faskesId: user.faskesId || null,
            hari: hari,
            shift: config.shift,
            jamMulai: config.jamMulai,
            jamSelesai: config.jamSelesai,
            kuotaPasien: config.kuota,
            statusAktif: true,
          },
        });
      }
      totalJadwalCreated++;
    }
  }

  console.log(`Berhasil membuat/memperbarui ${totalJadwalCreated} jadwal dinas mingguan.`);

  // Buat contoh 1 Izin/Cuti untuk dr. Siti Rahmawati (misal cuti pelatihan minggu ini)
  const drSiti = users.find(u => u.username === 'dr.siti');
  const drSarah = users.find(u => u.username === 'dr_cibinong');

  if (drSiti && drSarah) {
    const today = new Date();
    const tglMulai = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const tglSelesai = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 3));

    // Cek apakah sudah ada izin aktif
    const existingCuti = await prisma.izinCutiNakes.findFirst({
      where: {
        userId: drSiti.id,
        tipeIzin: 'PELATIHAN',
      },
    });

    if (!existingCuti) {
      await prisma.izinCutiNakes.create({
        data: {
          userId: drSiti.id,
          faskesId: drSiti.faskesId,
          tanggalMulai: tglMulai,
          tanggalSelesai: tglSelesai,
          tipeIzin: 'PELATIHAN',
          keterangan: 'Pelatihan Klinis Kemenkes RI di Jakarta',
          penggantiId: drSarah.id,
          statusPersetujuan: 'DISETUJUI',
          catatanPersetujuan: 'Disetujui oleh Kepala Puskesmas',
        },
      });
      console.log(`Berhasil membuat sampel Izin/Cuti Pelatihan untuk ${drSiti.namaLengkap} (Pengganti: ${drSarah.namaLengkap}).`);
    }
  }

  console.log('--- Seeding Jadwal Nakes Selesai ---');
}

seedJadwalNakes()
  .catch((e) => {
    console.error('Error saat seeding jadwal nakes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
