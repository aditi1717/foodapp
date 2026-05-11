import { v2 as cloudinary } from 'cloudinary';
import { uploadBufferDetailed } from '../../../../services/cloudinary.service.js';
import { FoodLandingSettings } from '../models/landingSettings.model.js';

export const getLandingSettings = async (zoneId = null) => {
    let doc = await FoodLandingSettings.findOne({ zoneId: zoneId || null }).lean();
    if (!doc) {
        // If not found and it's a zone-specific request, we might want to return global settings or create a new one
        // For now, let's create a new one for that zone if it doesn't exist
        doc = (await FoodLandingSettings.create({ zoneId: zoneId || null })).toObject();
    }
    return doc;
};

export const updateLandingSettings = async (payload, zoneId = null) => {
    const doc = await FoodLandingSettings.findOneAndUpdate(
        { zoneId: zoneId || null },
        { ...payload, zoneId: zoneId || null },
        {
            new: true,
            upsert: true
        }
    ).lean();
    return doc;
};

export const uploadLandingHeaderVideo = async (file) => {
    if (!file?.buffer) {
        throw new Error('Video file is required');
    }

    const existing = await getLandingSettings();
    const uploaded = await uploadBufferDetailed(file.buffer, {
        folder: 'food/landing/header-video',
        resourceType: 'video'
    });

    if (existing?.headerVideoPublicId) {
        await cloudinary.uploader
            .destroy(existing.headerVideoPublicId, { resource_type: 'video' })
            .catch(() => {});
    }

    return updateLandingSettings({
        headerVideoUrl: uploaded?.secure_url || '',
        headerVideoPublicId: uploaded?.public_id || ''
    });
};

export const deleteLandingHeaderVideo = async () => {
    const existing = await getLandingSettings();

    if (existing?.headerVideoPublicId) {
        await cloudinary.uploader
            .destroy(existing.headerVideoPublicId, { resource_type: 'video' })
            .catch(() => {});
    }

    return updateLandingSettings({
        headerVideoUrl: '',
        headerVideoPublicId: ''
    });
};

