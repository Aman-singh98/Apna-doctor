// src/services/cloudinaryService.js  (or wherever your other config lives)
const cloudinary = require('cloudinary').v2;

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads a Buffer (from multer memoryStorage) to Cloudinary.
// Returns { url, publicId }.
function uploadBuffer(buffer, options = {}) {
   return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
         { folder: 'apna-doctor/doctor-photos', resource_type: 'image', ...options },
         (err, result) => {
            if (err) return reject(err);
            resolve({ url: result.secure_url, publicId: result.public_id });
         }
      );
      stream.end(buffer);
   });
}

function deleteByPublicId(publicId) {
   if (!publicId) return Promise.resolve();
   return cloudinary.uploader.destroy(publicId).catch(() => {});
}

module.exports = { uploadBuffer, deleteByPublicId };
