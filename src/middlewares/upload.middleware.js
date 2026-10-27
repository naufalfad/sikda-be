const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads/pks');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept PDF only
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Hanya file PDF yang diperbolehkan!'), false);
  }
};

const uploadPks = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Image Upload (Memory Storage)
const imageStorage = multer.memoryStorage();
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
  }
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit 5MB
});

// Foto Klinis Pasien (SOAP Objektif) Upload to disk
const rmeFotoDir = path.join(__dirname, '../../uploads/rme-foto');
if (!fs.existsSync(rmeFotoDir)) {
  fs.mkdirSync(rmeFotoDir, { recursive: true });
}

const rmeFotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, rmeFotoDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = 'foto-rme-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueSuffix);
  }
});

const uploadFotoKlinis = multer({
  storage: rmeFotoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Limit 10MB per foto
});

module.exports = {
  uploadPks,
  uploadImage,
  uploadFotoKlinis,
  rmeFotoDir
};
