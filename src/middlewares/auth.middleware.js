const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia-super-aman');

      if (decoded.role === 'PASIEN_ONLINE') {
        req.user = decoded;
        return next();
      }

      // Fetch fresh user data from DB to guarantee accurate multi-tenant faskesId
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          namaLengkap: true,
          role: true,
          poliklinikId: true,
          faskesId: true,
        },
      });

      if (!dbUser) {
        const err = new Error('User tidak ditemukan atau sesi telah berakhir');
        err.statusCode = 401;
        return next(err);
      }

      req.user = { ...decoded, ...dbUser };
      return next();
    } catch (error) {
      console.error(error);
      const err = new Error('Not authorized, token failed');
      err.statusCode = 401;
      return next(err);
    }
  }

  if (!token) {
    const err = new Error('Not authorized, no token');
    err.statusCode = 401;
    return next(err);
  }
};

const protectPasienOnline = async (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || req.user.role !== 'PASIEN_ONLINE') {
      const err = new Error('Akses khusus portal pasien online');
      err.statusCode = 403;
      return next(err);
    }
    next();
  });
};

module.exports = { protect, protectPasienOnline };
