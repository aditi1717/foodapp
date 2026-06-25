import { sendResponse, sendError } from '../../../../utils/response.js';
import { validateAddonCreateDto, validateAddonListQuery, validateAddonUpdateDto } from '../validators/addon.validator.js';
import {
    listShopAddons,
    createShopAddon,
    updateShopAddon,
    deleteShopAddon
} from '../services/shopAddon.service.js';

export const listAddonsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const query = validateAddonListQuery(req.query || {});
        const data = await listShopAddons(shopId, query);
        return sendResponse(res, 200, 'Add-ons fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const createAddonController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const body = validateAddonCreateDto(req.body || {});
        const addon = await createShopAddon(shopId, body);
        return sendResponse(res, 201, 'Add-on created successfully', { addon });
    } catch (error) {
        next(error);
    }
};

export const updateAddonController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const body = validateAddonUpdateDto(req.body || {});
        const addon = await updateShopAddon(shopId, req.params.id, body);
        if (!addon) return sendError(res, 404, 'Add-on not found');
        return sendResponse(res, 200, 'Add-on updated successfully', { addon });
    } catch (error) {
        next(error);
    }
};

export const deleteAddonController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await deleteShopAddon(shopId, req.params.id);
        if (!result) return sendError(res, 404, 'Add-on not found');
        return sendResponse(res, 200, 'Add-on deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

