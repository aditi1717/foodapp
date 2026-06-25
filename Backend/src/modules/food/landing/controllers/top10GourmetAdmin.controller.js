import { FoodGourmetShop } from '../models/gourmetShop.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';
import { getPublicGourmetShops } from '../services/gourmet.service.js';

/** GET /hero-banners/gourmet - list Gourmet (admin, all entries). Returns { success, data: { shops } } */
export const listGourmetAdmin = async (req, res, next) => {
    try {
        const docs = await FoodGourmetShop.find({}).sort({ priority: 1, createdAt: -1 }).lean();
        const shopIds = [...new Set(docs.map((d) => d.shopId))];
        const shops = await FoodShop.find({ _id: { $in: shopIds } })
            .select('shopName area city profileImage rating')
            .lean();
        const shopMap = new Map(shops.map((r) => [r._id.toString(), r]));
        const list = docs.map((d) => {
            const r = shopMap.get(d.shopId?.toString());
            return {
                _id: d._id,
                shopId: d.shopId,
                priority: d.priority,
                order: d.priority,
                isActive: d.isActive,
                shop: r ? {
                    _id: r._id,
                    name: r.shopName,
                    rating: r.rating || 0,
                    profileImage: r.profileImage ? { url: r.profileImage } : null,
                    area: r.area,
                    city: r.city
                } : null
            };
        });
        res.status(200).json({
            success: true,
            message: 'Gourmet shops fetched',
            data: { shops: list }
        });
    } catch (error) {
        next(error);
    }
};

/** POST /hero-banners/gourmet - add shop. Body: { shopId } */
export const createGourmetAdmin = async (req, res, next) => {
    try {
        const { shopId } = req.body || {};
        if (!shopId) {
            return res.status(400).json({ success: false, message: 'shopId is required' });
        }
        const existing = await FoodGourmetShop.findOne({ shopId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Shop already in Gourmet' });
        }
        const count = await FoodGourmetShop.countDocuments();
        const doc = await FoodGourmetShop.create({ shopId, priority: count });
        const list = await getPublicGourmetShops();
        const shops = (list || []).map((d) => ({
            _id: d._id,
            shopId: d.shopId,
            priority: d.priority,
            order: d.priority,
            isActive: d.isActive,
            shop: d.shop ? {
                _id: d.shop._id,
                name: d.shop.name,
                rating: d.shop.rating || 0,
                profileImage: d.shop.profileImage,
                area: d.shop.area,
                city: d.shop.city
            } : null
        })).filter((r) => r && r._id);
        res.status(201).json({
            success: true,
            message: 'Shop added to Gourmet',
            data: { shops, item: doc.toObject() }
        });
    } catch (error) {
        next(error);
    }
};

/** DELETE /hero-banners/gourmet/:id */
export const deleteGourmetAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const doc = await FoodGourmetShop.findByIdAndDelete(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Gourmet entry not found' });
        }
        res.status(200).json({ success: true, message: 'Shop removed from Gourmet', data: { id } });
    } catch (error) {
        next(error);
    }
};

/** PATCH /hero-banners/gourmet/:id/order - body: { order } */
export const updateGourmetOrderAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = parseInt(req.body?.order, 10);
        if (Number.isNaN(order)) {
            return res.status(400).json({ success: false, message: 'order must be a number' });
        }
        const doc = await FoodGourmetShop.findByIdAndUpdate(id, { priority: order }, { new: true });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Gourmet entry not found' });
        }
        res.status(200).json({ success: true, message: 'Order updated', data: doc.toObject() });
    } catch (error) {
        next(error);
    }
};

/** PATCH /hero-banners/gourmet/:id/status - toggle isActive */
export const toggleGourmetStatusAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const doc = await FoodGourmetShop.findById(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Gourmet entry not found' });
        }
        doc.isActive = !doc.isActive;
        await doc.save();
        res.status(200).json({ success: true, message: doc.isActive ? 'Activated' : 'Deactivated', data: doc.toObject() });
    } catch (error) {
        next(error);
    }
};
