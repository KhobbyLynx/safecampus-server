import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const router = Router();

// Cloudinary is configured via environment variables:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — we stream buffer directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WEBP, MP4, WEBM, and MOV are allowed.'));
    }
  },
});

/**
 * Upload a buffer to Cloudinary and return the public_id.
 */
function uploadToCloudinary(
  buffer: Buffer,
  mimetype: string,
  folder = 'safecampus/incidents'
): Promise<string> {
  const resourceType = mimetype.startsWith('video/') ? 'video' : 'image';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));
        resolve(result.public_id);
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

router.post('/', upload.array('files', 3), async (req: any, res: any) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const publicIds = await Promise.all(
      req.files.map(async (file: any) => {
        const id = await uploadToCloudinary(file.buffer, file.mimetype);
        if (file.mimetype.startsWith('video/')) {
          return `${id}.mp4`;
        }
        if (file.mimetype === 'image/png') return `${id}.png`;
        if (file.mimetype === 'image/webp') return `${id}.webp`;
        return `${id}.jpg`;
      })
    );

    // Return the public_ids — the frontend builds the full CDN URL from these
    res.json({ urls: publicIds });
  } catch (error: any) {
    console.error('[Upload] Cloudinary error:', error);
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
});

export default router;
