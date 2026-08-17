/**
 * Legacy Cloudinary service facade - re-exports from storage.service.js
 * to maintain 100% backward compatibility with all existing controllers and services.
 */
import {
    uploadImageBuffer as diskUploadImageBuffer,
    uploadImageBufferDetailed as diskUploadImageBufferDetailed,
    uploadBufferDetailed as diskUploadBufferDetailed
} from './storage.service.js';

export const uploadImageBuffer = diskUploadImageBuffer;
export const uploadImageBufferDetailed = diskUploadImageBufferDetailed;
export const uploadBufferDetailed = diskUploadBufferDetailed;
