const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const satusehatService = require('./satusehat.service');

const dokterService = {
  // Get all dokters
  getAllDokter: async (user = null, requestedFaskesId = null) => {
    let where = {
      role: 'DOKTER',
    };

    // Multi-tenant faskes filtering:
    // If the logged-in user is not DINKES_ADMIN / DINKES_MONITORING / SUPERADMIN, restrict to their own faskes
    const effectiveFaskesId = requestedFaskesId || (user && !['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role) ? user.faskesId : null);

    if (effectiveFaskesId) {
      where.faskesId = effectiveFaskesId;
    }

    return await prisma.user.findMany({
      where,
      include: {
        faskes: {
          select: {
            id: true,
            kodeFaskes: true,
            namaFaskes: true,
          }
        },
        poliklinik: true,
        tenagaMedis: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  // Create new dokter
  createDokter: async (data, user = null) => {
    // 1. Validasi NIK jika ada
    if (!data.nik) {
      throw new Error('NIK wajib diisi untuk mendaftarkan dokter.');
    }
    if (data.nik.length !== 16) {
      throw new Error('NIK harus terdiri dari 16 digit angka.');
    }

    // 2. Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new Error('Username sudah digunakan. Silakan pilih username lain.');
    }
    
    // 3. Validasi ke SATUSEHAT (graceful fallback in offline/sandbox)
    let satusehatData = null;
    try {
      satusehatData = await satusehatService.getPractitionerByNIK(data.nik);
    } catch (error) {
      console.warn(`SATUSEHAT check note: ${error.message}`);
    }

    // Default password 'dokter123' if not provided
    const plainPassword = data.password || 'dokter123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const effectiveFaskesId = data.faskesId || (user && !['DINKES_ADMIN', 'SUPERADMIN'].includes(user.role) ? user.faskesId : null);

    // 4. Create User and TenagaMedis in one transaction
    return await prisma.user.create({
      data: {
        namaLengkap: satusehatData?.data?.name?.[0]?.text || data.namaLengkap,
        username: data.username,
        password: hashedPassword,
        role: 'DOKTER',
        faskesId: effectiveFaskesId || null,
        poliklinikId: data.poliklinikId || null,
        tenagaMedis: {
          create: {
            nik: data.nik,
            noIHS: satusehatData?.ihsNumber || data.noIHS || null,
            profesi: 'DOKTER_UMUM',
            spesialis: 'Dokter Umum',
            nomorSip: data.nomorSip || null,
            nomorStr: data.nomorStr || null,
            faskesId: effectiveFaskesId || null,
          }
        }
      },
      include: {
        faskes: true,
        poliklinik: true,
        tenagaMedis: true,
      }
    });
  },

  // Update dokter
  updateDokter: async (id, data, user = null) => {
    // Check permission / tenant boundary
    if (user && !['DINKES_ADMIN', 'SUPERADMIN'].includes(user.role) && user.faskesId) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (existing && existing.faskesId && existing.faskesId !== user.faskesId) {
        throw new Error('Anda tidak memiliki izin mengelola dokter fasilitas kesehatan lain.');
      }
    }

    const updateData = {
      namaLengkap: data.namaLengkap,
      username: data.username,
      poliklinikId: data.poliklinikId || null,
    };

    if (data.password && data.password.trim() !== '') {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    // Jika update melibatkan NIK baru
    let tenagaMedisUpdate = undefined;
    if (data.nik) {
      if (data.nik.length !== 16) throw new Error('NIK harus 16 digit.');
      
      let satusehatData = null;
      try {
        satusehatData = await satusehatService.getPractitionerByNIK(data.nik);
      } catch (error) {
        console.warn(`SATUSEHAT check note: ${error.message}`);
      }

      if (satusehatData?.data?.name?.[0]?.text) {
        updateData.namaLengkap = satusehatData.data.name[0].text;
      }
      
      tenagaMedisUpdate = {
        upsert: {
          create: { 
            nik: data.nik, 
            noIHS: satusehatData?.ihsNumber || data.noIHS || null,
            profesi: 'DOKTER_UMUM',
            spesialis: 'Dokter Umum',
            faskesId: user?.faskesId || null
          },
          update: { 
            nik: data.nik, 
            noIHS: satusehatData?.ihsNumber || data.noIHS || undefined 
          }
        }
      };
    }

    if (tenagaMedisUpdate) {
      updateData.tenagaMedis = tenagaMedisUpdate;
    }

    return await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        faskes: true,
        poliklinik: true,
        tenagaMedis: true,
      }
    });
  },

  // Delete dokter
  deleteDokter: async (id, user = null) => {
    if (user && !['DINKES_ADMIN', 'SUPERADMIN'].includes(user.role) && user.faskesId) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (existing && existing.faskesId && existing.faskesId !== user.faskesId) {
        throw new Error('Anda tidak memiliki izin menghapus dokter fasilitas kesehatan lain.');
      }
    }

    return await prisma.user.delete({
      where: { id },
    });
  },
};

module.exports = dokterService;
