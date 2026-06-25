import {
    deleteLandingHeaderVideo,
    getLandingSettings,
    updateLandingSettings,
    uploadLandingHeaderVideo
} from '../services/landingSettings.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export const getAdminLandingSettingsController = async (req, res, next) => {
    try {
        const settings = await getLandingSettings();
        return sendResponse(res, 200, 'Landing settings fetched successfully', { settings });
    } catch (error) {
        next(error);
    }
};

export const updateAdminLandingSettingsController = async (req, res, next) => {
    try {
        const payload = req.body || {};
        if (typeof payload !== 'object') {
            throw new ValidationError('Invalid settings payload');
        }
        if (payload.defaultUnderPriceLimit !== undefined) {
            const parsed = Number(payload.defaultUnderPriceLimit);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                throw new ValidationError('defaultUnderPriceLimit must be a positive number');
            }
            payload.defaultUnderPriceLimit = Math.round(parsed);
        }
        if (payload.zoneShopVisibility !== undefined) {
            if (!Array.isArray(payload.zoneShopVisibility)) {
                throw new ValidationError('zoneShopVisibility must be an array');
            }
            payload.zoneShopVisibility = payload.zoneShopVisibility
                .map((entry) => ({
                    zoneId: String(entry?.zoneId || '').trim(),
                    mode: String(entry?.mode || 'automatic').trim().toLowerCase(),
                    manualShopIds: Array.isArray(entry?.manualShopIds)
                        ? entry.manualShopIds.map((id) => String(id || '').trim()).filter(Boolean)
                        : []
                }))
                .filter((entry) => entry.zoneId)
                .map((entry) => ({
                    zoneId: entry.zoneId,
                    mode: entry.mode === 'manual' ? 'manual' : 'automatic',
                    manualShopIds: entry.mode === 'manual' ? entry.manualShopIds : []
                }));
        }
        const updated = await updateLandingSettings(payload);
        return sendResponse(res, 200, 'Landing settings updated successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};

export const uploadAdminLandingHeaderVideoController = async (req, res, next) => {
    try {
        const updated = await uploadLandingHeaderVideo(req.file);
        return sendResponse(res, 200, 'Landing header video uploaded successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};

export const deleteAdminLandingHeaderVideoController = async (req, res, next) => {
    try {
        const updated = await deleteLandingHeaderVideo();
        return sendResponse(res, 200, 'Landing header video removed successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};

