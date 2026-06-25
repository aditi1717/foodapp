import { getPublicGourmetShops } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';
import { sendResponse } from '../../../../utils/response.js';
import { listUnder250Banners } from '../services/under250Banner.service.js';

/** Public hero banners for user home: active only, sorted, with linkedShops populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'linkedShopIds',
                select: '_id shopName slug area city rating cuisines profileImage pureVegShop',
                model: 'FoodShop'
            })
            .lean();
        const banners = (docs || []).map((b) => {
            const { linkedShopIds, ...rest } = b;
            return {
                ...rest,
                linkedShops: Array.isArray(linkedShopIds) ? linkedShopIds : [],
                imageUrl: b.imageUrl
            };
        });
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const docs = await listUnder250Banners({ isActive: true });
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};


export const getPublicGourmetController = async (req, res, next) => {
    try {
        const docs = await getPublicGourmetShops();
        const shops = (docs || []).map((d) => ({
            ...(d.shop || {}),
            _id: d.shop?._id || d.shopId,
            priority: d.priority
        })).filter((r) => r && r._id);
        return sendResponse(res, 200, 'Gourmet shops fetched', { shops });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const settings = await getLandingSettings();
        const ids = settings?.recommendedShopIds || [];
        let recommendedShops = [];
        if (Array.isArray(ids) && ids.length > 0) {
            recommendedShops = await FoodShop.find({ _id: { $in: ids }, status: 'approved' })
                .select('shopName area city profileImage coverImages menuImages slug rating cuisines pureVegShop')
                .lean();
        }
        const payload = {
            ...settings,
            headerVideoPublicId: undefined,
            recommendedShopIds: undefined,
            recommendedShops
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};

