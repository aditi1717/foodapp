import { sendResponse } from '../../../../utils/response.js';
import { getPublicApprovedShopAddons } from '../services/publicAddons.service.js';

export const getPublicShopAddonsController = async (req, res, next) => {
    try {
        const addons = await getPublicApprovedShopAddons(req.params.id);
        if (!addons) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        return sendResponse(res, 200, 'Add-ons fetched successfully', { addons });
    } catch (error) {
        next(error);
    }
};

