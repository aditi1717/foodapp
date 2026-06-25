import { sendResponse } from '../../../../utils/response.js';
import {
    getShopMenu,
    updateShopMenu,
    getPublicApprovedShopMenu
} from '../services/shopMenu.service.js';

export const getMenuController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const menu = await getShopMenu(shopId);
        return sendResponse(res, 200, 'Menu fetched successfully', { menu });
    } catch (error) {
        next(error);
    }
};

export const updateMenuController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const menu = await updateShopMenu(shopId, req.body || {});
        return sendResponse(res, 200, 'Menu updated successfully', { menu });
    } catch (error) {
        next(error);
    }
};

export const getPublicShopMenuController = async (req, res, next) => {
    try {
        const menu = await getPublicApprovedShopMenu(req.params.id);
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        return sendResponse(res, 200, 'Menu fetched successfully', { menu });
    } catch (error) {
        next(error);
    }
};

