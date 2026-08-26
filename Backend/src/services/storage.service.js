import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config/env.js';

const isAbsoluteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

const joinUrlSegments = (base, segment) => {
    const normalizedBase = String(base || '').replace(/\/+$/, '');
    const normalizedSegment = String(segment || '').replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedSegment}`;
};

const buildUploadPublicUrl = (filename) => {
    const safeFilename = String(filename || '').replace(/^\/+/, '');
    const configuredBase = String(config.uploadBaseUrl || '').trim().replace(/\/+$/, '');

    if (configuredBase) {
        if (/\/uploads$/i.test(configuredBase)) {
            return joinUrlSegments(configuredBase, safeFilename);
        }
        return joinUrlSegments(joinUrlSegments(configuredBase, 'uploads'), safeFilename);
    }

    // In local development, prefer the local backend origin for disk uploads.
    if (config.nodeEnv !== 'production') {
        return joinUrlSegments(`http://localhost:${config.port || 5000}/uploads`, safeFilename);
    }

    if (config.appUrl) {
        return joinUrlSegments(joinUrlSegments(config.appUrl, 'uploads'), safeFilename);
    }

    return `/uploads/${safeFilename}`;
};

export const normalizeStoredUploadUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const configuredBase = String(config.uploadBaseUrl || '').trim().replace(/\/+$/, '');
    const uploadsMatch = raw.replace(/\\/g, '/').match(/\/uploads\/[^?#]+/i);
    if (uploadsMatch) {
        if (configuredBase) {
            if (/\/uploads$/i.test(configuredBase)) {
                return joinUrlSegments(configuredBase, uploadsMatch[0].replace(/^\/uploads\/+/i, ''));
            }
            return joinUrlSegments(configuredBase, uploadsMatch[0].replace(/^\/+/, ''));
        }

        if (config.nodeEnv !== 'production') {
            return joinUrlSegments(`http://localhost:${config.port || 5000}`, uploadsMatch[0].replace(/^\/+/, ''));
        }

        if (config.appUrl) {
            return joinUrlSegments(config.appUrl, uploadsMatch[0].replace(/^\/+/, ''));
        }

        return uploadsMatch[0];
    }

    if (isAbsoluteHttpUrl(raw)) {
        return raw;
    }

    return raw;
};

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
    const fileUrl = buildUploadPublicUrl(filename);

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
