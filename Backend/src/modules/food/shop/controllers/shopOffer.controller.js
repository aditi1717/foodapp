import { sendResponse, sendError } from '../../../../utils/response.js';
import { createShopOffer, deleteShopOffer, listShopOffers, updateShopOffer } from '../services/shopOffer.service.js';

export const createShopOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offer = await createShopOffer(shopId, req.body || {});
        return sendResponse(res, 201, 'Coupon submitted for approval', { offer });
    } catch (error) {
        next(error);
    }
};

export const listShopOffersController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offers = await listShopOffers(shopId);
        return sendResponse(res, 200, 'Coupons fetched successfully', { offers });
    } catch (error) {
        next(error);
    }
};

export const deleteShopOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await deleteShopOffer(shopId, req.params.id);
        if (!result) return sendError(res, 404, 'Coupon not found');
        return sendResponse(res, 200, 'Coupon deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateShopOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offer = await updateShopOffer(shopId, req.params.id, req.body || {});
        if (!offer) return sendError(res, 404, 'Coupon not found');
        return sendResponse(res, 200, 'Coupon updated successfully', { offer });
    } catch (error) {
        next(error);
    }
};
