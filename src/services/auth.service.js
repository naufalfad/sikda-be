const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia-super-aman';

const loginUser = async (username, password) => {
  // Cari user di database
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      poliklinik: true,
      faskes: true
    }
  });

  if (!user) {
    const error = new Error('Username tidak ditemukan');
    error.statusCode = 401;
    throw error;
  }

  // Cocokkan password (Bcrypt)
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    const error = new Error('Password salah');
    error.statusCode = 401;
    throw error;
  }

  // Buat JWT Token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, poliklinikId: user.poliklinikId, faskesId: user.faskesId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      namaLengkap: user.namaLengkap,
      role: user.role,
      poliklinikId: user.poliklinikId,
      poliklinik: user.poliklinik,
      faskesId: user.faskesId,
      faskes: user.faskes
    }
  };
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { 
      id: true, 
      username: true, 
      namaLengkap: true,
      role: true,
      poliklinikId: true,
      poliklinik: true,
      faskesId: true,
      faskes: true
    } // Jangan ambil password
  });

  if (!user) {
    const error = new Error('User tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

module.exports = {
  loginUser,
  getUserById,
};
