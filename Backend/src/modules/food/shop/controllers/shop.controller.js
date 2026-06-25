import {
    registerShop,
    listApprovedShops,
    getApprovedShopByIdOrSlug,
    getCurrentShopProfile,
    updateShopProfile,
    updateShopAcceptingOrders,
    uploadShopProfileImage,
    uploadShopMenuImage,
    uploadShopCoverImages,
    uploadShopMenuImages,
    listPublicOffers,
    getShopComplaints
} from '../services/shop.service.js';
import { validateShopRegisterDto } from '../validators/shop.validator.js';
import { sendResponse } from '../../../../utils/response.js';

export const registerShopController = async (req, res, next) => {
    try {
        const validated = validateShopRegisterDto(req.body);
        const shop = await registerShop(validated, req.files);
        return sendResponse(res, 201, 'Shop registered successfully', shop);
    } catch (error) {
        next(error);
    }
};

export const listApprovedShopsController = async (req, res, next) => {
    try {
        const data = await listApprovedShops(req.query);
        return sendResponse(res, 200, 'Shops fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getApprovedShopController = async (req, res, next) => {
    try {
        const shop = await getApprovedShopByIdOrSlug(req.params.id);
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        return sendResponse(res, 200, 'Shop fetched successfully', { shop });
    } catch (error) {
        next(error);
    }
};

export const getCurrentShopController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const shop = await getCurrentShopProfile(shopId);
        return sendResponse(res, 200, 'Shop fetched successfully', { shop });
    } catch (error) {
        next(error);
    }
};

export const updateShopProfileController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const shop = await updateShopProfile(shopId, req.body || {}, req.files || {});
        return sendResponse(res, 200, 'Shop updated successfully', { shop });
    } catch (error) {
        next(error);
    }
};

export const updateShopAcceptingOrdersController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const shop = await updateShopAcceptingOrders(shopId, req.body?.isAcceptingOrders);
        return sendResponse(res, 200, 'Shop availability updated successfully', { shop });
    } catch (error) {
        next(error);
    }
};

export const uploadShopProfileImageController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await uploadShopProfileImage(shopId, req.file);
        return sendResponse(res, 200, 'Profile image uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadShopMenuImageController = async (req, res, next) => {
    try {
        const result = await uploadShopMenuImage(req.file);
        return sendResponse(res, 200, 'Menu image uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadShopCoverImagesController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await uploadShopCoverImages(shopId, req.files || []);
        return sendResponse(res, 200, 'Shop photos uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadShopMenuImagesController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await uploadShopMenuImages(shopId, req.files || []);
        return sendResponse(res, 200, 'Menu photos uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};


export const listPublicOffersController = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?._id;

        const data = await listPublicOffers(req.query || {}, userId);
        return sendResponse(res, 200, 'Offers fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getShopComplaintsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const data = await getShopComplaints(shopId, req.query || {});
        return sendResponse(res, 200, 'Complaints fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

