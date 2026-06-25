import { FoodShop } from '../../shop/models/shop.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import mongoose from 'mongoose';
import { isCategoryVisibleNow } from '../../shared/categoryWorkflow.js';

const zoneToPolygon = (zoneDoc) => {
    const coords = Array.isArray(zoneDoc?.coordinates) ? zoneDoc.coordinates : [];
    if (coords.length < 3) return null;

    const ring = coords
        .map((coord) => [Number(coord.longitude), Number(coord.latitude)])
        .filter((pair) => pair.every((value) => Number.isFinite(value)));

    if (ring.length < 3) return null;

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
    }

    return { type: 'Polygon', coordinates: [ring] };
};

const buildZoneShopConstraint = async (zoneIdRaw) => {
    const trimmedZoneId = String(zoneIdRaw || '').trim();
    if (!trimmedZoneId || !mongoose.Types.ObjectId.isValid(trimmedZoneId)) {
        return null;
    }

    const zoneClauses = [{ zoneId: new mongoose.Types.ObjectId(trimmedZoneId) }];
    const zoneDoc = await FoodZone.findOne({ _id: trimmedZoneId, isActive: true }).lean();
    const polygon = zoneToPolygon(zoneDoc);
    if (polygon) {
        zoneClauses.push({ location: { $geoWithin: { $geometry: polygon } } });
    }

    return { $or: zoneClauses };
};

/**
 * Unified Search Service
 * Searches for shops by name and also searches for food items, 
 * returning matched shops with potential dish highlights.
 */
export const searchUnified = async (query = {}, options = {}) => {
    const { 
        q, 
        lat, 
        lng, 
        radiusKm = 20, 
        categoryId, 
        minRating, 
        maxDeliveryTime, 
        isVeg,
        page = 1,
        limit = 20,
        zoneId
    } = query;

    const skip = (page - 1) * limit;
    const term = String(q || '').trim();
    const regex = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    // 1. Initial Filter (approved status and basic conditions)
    const shopFilter = { status: 'approved' };
    
    console.log(`[Search-Service] Querying with term: "${term}", categoryId: "${categoryId}", zoneId: "${zoneId}"`);

    const zoneConstraint = await buildZoneShopConstraint(zoneId);
    if (zoneConstraint) {
        shopFilter.$and = [...(shopFilter.$and || []), zoneConstraint];
    }

    if (isVeg === 'true') {
        shopFilter.pureVegShop = true;
    }

    if (minRating) {
        shopFilter.rating = { $gte: parseFloat(minRating) };
    }

    if (maxDeliveryTime) {
        shopFilter.estimatedDeliveryTimeMinutes = { $lte: parseInt(maxDeliveryTime) };
    }
    
    console.log(`[Search-Service] Final Shop Filter:`, JSON.stringify(shopFilter));

    let shopIds = new Set();
    let shopDetailsMap = new Map();

    // 2. Handle Category Filtering (Shops don't have categoryId, FoodItems do)
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const selectedCategory = await FoodCategory.findById(categoryId)
            .select('visibilityStartTime visibilityEndTime')
            .lean();
        if (!selectedCategory || !isCategoryVisibleNow(selectedCategory, { timezone: 'Asia/Kolkata' })) {
            return {
                success: true,
                data: { shops: [], total: 0, page: parseInt(page), limit: parseInt(limit) }
            };
        }

        const catFoodItems = await FoodItem.find({ 
            categoryId: new mongoose.Types.ObjectId(categoryId),
            approvalStatus: 'approved' 
        }).select('shopId').lean();
        
        const catShopIds = [...new Set(catFoodItems.map(f => f.shopId.toString()))];
        if (catShopIds.length > 0) {
            shopFilter._id = { $in: catShopIds.map(id => new mongoose.Types.ObjectId(id)) };
        } else {
            // No food items in this category -> No shops
            return {
                success: true,
                data: { shops: [], total: 0, page: parseInt(page), limit: parseInt(limit) }
            };
        }
    }

    // 3. Search Matching
    if (regex) {
        // A. Search by Shop Name / Cuisine
        const matchedShops = await FoodShop.find({
            ...shopFilter,
            $or: [
                { shopName: { $regex: regex } },
                { cuisines: { $regex: regex } }
            ]
        }).limit(limit * 2).lean();

        matchedShops.forEach(r => {
            shopIds.add(r._id.toString());
            shopDetailsMap.set(r._id.toString(), { ...r, matchType: 'shop' });
        });

        // B. Search by Food Item Name
        const foodFilters = { approvalStatus: 'approved' };
        if (isVeg === 'true') foodFilters.foodType = 'Veg';
        
        const matchedFoodsRaw = await FoodItem.find({
            ...foodFilters,
            name: { $regex: regex }
        }).limit(limit * 2).lean();

        const matchedFoodCategoryIds = Array.from(
            new Set(
                matchedFoodsRaw
                    .map((food) => (food?.categoryId ? String(food.categoryId) : ''))
                    .filter((value) => mongoose.Types.ObjectId.isValid(value))
            )
        );

        const categoryVisibilityMap = new Map();
        if (matchedFoodCategoryIds.length > 0) {
            const categoryDocs = await FoodCategory.find({ _id: { $in: matchedFoodCategoryIds } })
                .select('visibilityStartTime visibilityEndTime')
                .lean();
            categoryDocs.forEach((doc) => {
                categoryVisibilityMap.set(
                    String(doc._id),
                    isCategoryVisibleNow(doc, { timezone: 'Asia/Kolkata' })
                );
            });
        }

        const matchedFoods = matchedFoodsRaw.filter((food) => {
            if (!food?.categoryId) return true;
            const key = String(food.categoryId);
            if (!categoryVisibilityMap.has(key)) return true;
            return categoryVisibilityMap.get(key) === true;
        });

        const foodShopIds = matchedFoods.map(f => f.shopId.toString());
        
        if (foodShopIds.length > 0) {
            const unmatchedIds = foodShopIds.filter(id => !shopIds.has(id));
            if (unmatchedIds.length > 0) {
                const rsForFoods = await FoodShop.find({
                    ...shopFilter,
                    _id: { $in: unmatchedIds.map(id => new mongoose.Types.ObjectId(id)) }
                }).lean();

                rsForFoods.forEach(r => {
                    shopIds.add(r._id.toString());
                    shopDetailsMap.set(r._id.toString(), { 
                        ...r, 
                        matchType: 'food',
                        matchedDish: matchedFoods.find(f => f.shopId.toString() === r._id.toString())?.name,
                        matchedDishImage: matchedFoods.find(f => f.shopId.toString() === r._id.toString())?.image,
                        matchedDishId: matchedFoods.find(f => f.shopId.toString() === r._id.toString())?._id
                    });
                });
            }
        }
    } else {
        // No search text -> List all shops matching filters (category/zone)
        const allMatching = await FoodShop.find(shopFilter)
            .sort({ rating: -1, createdAt: -1 })
            .limit(limit * 2)
            .lean();
            
        allMatching.forEach(r => {
            shopIds.add(r._id.toString());
            shopDetailsMap.set(r._id.toString(), r);
        });
    }

    // 4. Final Result Formatting
    let results = Array.from(shopDetailsMap.values());

    // Simple distance sorting if lat/lng are provided
    if (lat && lng && results.length > 0) {
        results.forEach(res => {
            if (res.location && res.location.latitude && res.location.longitude) {
                const dLat = (res.location.latitude - lat) * Math.PI / 180;
                const dLon = (res.location.longitude - lng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat * Math.PI / 180) * Math.cos(res.location.latitude * Math.PI / 180) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                res.distanceScore = 6371 * c; // Km
            } else {
                res.distanceScore = 999;
            }
        });
        results.sort((a, b) => (a.distanceScore || 999) - (b.distanceScore || 999));
    }

    // ... (rest of logic up to result formation)
    const finalResult = {
        success: true,
        data: {
            shops: results.slice(skip, skip + limit),
            total: results.length,
            page: parseInt(page),
            limit: parseInt(limit),
            zoneFiltered: !!(zoneId && mongoose.Types.ObjectId.isValid(zoneId))
        }
    };

    return finalResult;
};

/**
 * Fetch Admin-only categories
 */
export const getAdminCategories = async (query = {}) => {
    const filter = { 
        isActive: true, 
        isApproved: true,
        $or: [
            { shopId: { $exists: false } },
            { shopId: null },
            { shopId: { $eq: undefined } }
        ]
    };

    if (query.zoneId && mongoose.Types.ObjectId.isValid(query.zoneId)) {
        filter.$or = [
            { zoneId: new mongoose.Types.ObjectId(query.zoneId) },
            { zoneId: { $exists: false } },
            { zoneId: null }
        ];
    }

    const categories = await FoodCategory.find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    return categories.filter((category) => isCategoryVisibleNow(category, { timezone: 'Asia/Kolkata' }));
};
