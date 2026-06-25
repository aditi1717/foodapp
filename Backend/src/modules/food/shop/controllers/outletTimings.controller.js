import { sendResponse } from '../../../../utils/response.js';
import { getOutletTimingsForShop, upsertOutletTimingsForShop } from '../services/outletTimings.service.js';

export const getOutletTimingsByShopIdController = async (req, res, next) => {
    try {
        const data = await getOutletTimingsForShop(req.params.id);
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getCurrentShopOutletTimingsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const data = await getOutletTimingsForShop(shopId);
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const upsertCurrentShopOutletTimingsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const data = await upsertOutletTimingsForShop(shopId, req.body?.outletTimings);
        return sendResponse(res, 200, 'Outlet timings saved successfully', data);
    } catch (error) {
        next(error);
    }
};

