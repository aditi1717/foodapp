import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    createShopProductOffer,
    listShopProductOffers,
    deleteShopProductOffer,
    updateShopProductOffer,
    listPublicShopProductOffers
} from '../services/shopProductOffer.service.js';

export const createShopProductOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offer = await createShopProductOffer(shopId, req.body || {});
        return sendResponse(res, 201, 'Offer submitted for approval', { offer });
    } catch (error) {
        next(error);
    }
};

export const listShopProductOffersController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offers = await listShopProductOffers(shopId);
        return sendResponse(res, 200, 'Offers fetched successfully', { offers });
    } catch (error) {
        next(error);
    }
};

export const deleteShopProductOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await deleteShopProductOffer(shopId, req.params.id);
        if (!result) return sendError(res, 404, 'Offer not found');
        return sendResponse(res, 200, 'Offer deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateShopProductOfferController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const offer = await updateShopProductOffer(shopId, req.params.id, req.body || {});
        if (!offer) return sendError(res, 404, 'Offer not found');
        return sendResponse(res, 200, 'Offer updated successfully', { offer });
    } catch (error) {
        next(error);
    }
};

export const listPublicShopProductOffersController = async (req, res, next) => {
    try {
        const offers = await listPublicShopProductOffers(req.params.id, req.user);
        return sendResponse(res, 200, 'Offers fetched successfully', { offers });
    } catch (error) {
        next(error);
    }
};
