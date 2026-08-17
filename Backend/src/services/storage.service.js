import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config/env.js';

/**
 * Gets the upload root directory based on environment:
 * - Development: Backend/uploads (or config.uploadPath)
 * - Production: /var/www/uploads (SOP standard)
 */
export const getUploadDir = () => {
    if (config.nodeEnv === 'production') {
        return '/var/www/uploads';
    }
    const relativePath = config.uploadPath || 'uploads/';
    return path.resolve(process.cwd(), relativePath);
};

/**
 * Ensures the target upload directory exists on disk.
 */
export const ensureUploadDirExists = async () => {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
        await fs.promises.mkdir(uploadDir, { recursive: true });
    }
    return uploadDir;
};

/**
 * Uploads an image buffer to local/VPS disk storage.
 * - Converts image to .webp format with 80% quality compression using Sharp.
 * - Stores all images directly in the single top-level uploads directory (no subfolders).
 * - Returns the accessible URL.
 */
export const uploadImageBuffer = async (buffer, _folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const uploadDir = await ensureUploadDirExists();

    // Convert & compress image buffer to WebP (quality: 80)
    const webpBuffer = await sharp(buffer)
        .webp({ quality: 80 })
        .toBuffer();

    // Single flat directory filename (no subfolders inside uploads)
    const randomHash = crypto.randomBytes(8).toString('hex');
    const filename = `${Date.now()}-${randomHash}.webp`;
    const filePath = path.join(uploadDir, filename);

    // Write WebP image to disk
    await fs.promises.writeFile(filePath, webpBuffer);

    // Build accessible URL
    const baseUrl = config.appUrl || `http://localhost:${config.port || 5000}`;
    const fileUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;

    return fileUrl;
};

/**
 * Detailed buffer upload response (matching Cloudinary detailed response format for backward compatibility)
 */
export const uploadImageBufferDetailed = async (buffer, folder = 'uploads') => {
    const url = await uploadImageBuffer(buffer, folder);
    const filename = path.basename(url);
    return {
        secure_url: url,
        url: url,
        public_id: filename,
        format: 'webp',
        resource_type: 'image'
    };
};

/**
 * Alias for uploadImageBufferDetailed for backward compatibility
 */
export const uploadBufferDetailed = async (buffer, options = {}) => {
    return uploadImageBufferDetailed(buffer, options.folder || 'uploads');
};
