import { sendResponse, sendError } from '../../../../utils/response.js';
import { getShopFinance } from '../services/shopFinance.service.js';

export const getShopFinanceController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        if (!shopId) return sendError(res, 401, 'Shop authentication required');

        const data = await getShopFinance(shopId, req.query || {});
        // `sendResponse` already uses `data` as the top-level payload key.
        return sendResponse(res, 200, 'Finance fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

