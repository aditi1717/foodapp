import mongoose from 'mongoose';
import { getPublicGourmetRestaurants } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { sendResponse } from '../../../../utils/response.js';
import { listUnder250Banners } from '../services/under250Banner.service.js';

/** Public hero banners for user home: active only, sorted, with linkedRestaurants populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'linkedRestaurantIds',
                select: '_id restaurantName slug area city rating cuisines profileImage pureVegRestaurant',
                model: 'FoodRestaurant'
            })
            .lean();
        const banners = (docs || []).map((b) => {
            const { linkedRestaurantIds, ...rest } = b;
            return {
                ...rest,
                linkedRestaurants: Array.isArray(linkedRestaurantIds) ? linkedRestaurantIds : [],
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
        const docs = await getPublicGourmetRestaurants();
        const restaurants = (docs || []).map((d) => ({
            ...(d.restaurant || {}),
            _id: d.restaurant?._id || d.restaurantId,
            priority: d.priority
        })).filter((r) => r && r._id);
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants });
    } catch (error) {
        next(error);
    }
};

import { FoodOrder } from '../../orders/models/order.model.js';

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        let settings = await getLandingSettings(zoneId);

        // Fallback to global settings if zone-specific settings don't exist or are empty (optional, depending on requirement)
        // But the user said they want it zone-wise, so we stay with what we found.

        let recommendedRestaurantIds = settings?.recommendedRestaurantIds || [];
        const mode = settings?.recommendationMode || 'manual';

        if (mode === 'automatic' && zoneId) {
            // Calculate top 12 restaurants by order count in this zone
            const topRestaurants = await FoodOrder.aggregate([
                { $match: { zoneId: new mongoose.Types.ObjectId(zoneId), orderStatus: 'delivered' } },
                { $group: { _id: '$restaurantId', orderCount: { $sum: 1 } } },
                { $sort: { orderCount: -1 } },
                { $limit: 12 }
            ]);
            recommendedRestaurantIds = topRestaurants.map((r) => r._id);
        }

        let recommendedRestaurants = [];
        if (Array.isArray(recommendedRestaurantIds) && recommendedRestaurantIds.length > 0) {
            recommendedRestaurants = await FoodRestaurant.find({
                _id: { $in: recommendedRestaurantIds },
                status: 'approved',
                // Ensure the restaurant belongs to the zone if it's a zone-specific request
                ...(zoneId ? { zoneId: new mongoose.Types.ObjectId(zoneId) } : {})
            })
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant zoneId')
                .lean();

            // Maintain the order if it was manual or sort by orderCount if automatic
            if (mode === 'manual') {
                recommendedRestaurants.sort((a, b) => {
                    return recommendedRestaurantIds.indexOf(a._id.toString()) - recommendedRestaurantIds.indexOf(b._id.toString());
                });
            }
        }

        const payload = {
            ...settings,
            headerVideoPublicId: undefined,
            recommendedRestaurantIds: undefined,
            recommendedRestaurants
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};

