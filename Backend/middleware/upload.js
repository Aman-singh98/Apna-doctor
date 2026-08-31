// middleware/upload.js
//
// memoryStorage keeps files as Buffer objects on req.files / req.file,
// which is exactly what cloudinaryService.uploadBuffer() expects.
// Never use diskStorage here — the file buffer wouldn't be available.

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = function (req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

module.exports = upload;
