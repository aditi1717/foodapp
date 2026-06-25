import { sendResponse, sendError } from '../../../../utils/response.js';
import { createShopFood, updateShopFood } from '../services/shopFood.service.js';

export const createShopFoodController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const food = await createShopFood(shopId, req.body || {});
        return sendResponse(res, 201, 'Food created successfully', { food });
    } catch (error) {
        next(error);
    }
};

export const updateShopFoodController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const food = await updateShopFood(shopId, req.params.id, req.body || {});
        if (!food) return sendError(res, 404, 'Food not found');
        return sendResponse(res, 200, 'Food updated successfully', { food });
    } catch (error) {
        next(error);
    }
};

