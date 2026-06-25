import { FoodGourmetShop } from '../models/gourmetShop.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';

export const getPublicGourmetShops = async () => {
    const docs = await FoodGourmetShop.find({ isActive: true })
        .sort({ priority: 1, createdAt: -1 })
        .lean();

    const shopIds = docs.map((d) => d.shopId);
    const shops = await FoodShop.find({ _id: { $in: shopIds } })
        .select('shopName area city profileImage rating cuisines slug pureVegShop location estimatedDeliveryTime')
        .lean();

    const shopMap = new Map(shops.map((r) => [r._id.toString(), r]));

    return docs.map((item) => {
        const r = shopMap.get(item.shopId.toString());
        return {
            ...item,
            shop: r ? {
                _id: r._id,
                name: r.shopName,
                shopName: r.shopName,
                rating: r.rating || 0,
                profileImage: r.profileImage ? { url: r.profileImage } : null,
                area: r.area,
                city: r.city,
                cuisines: r.cuisines || [],
                slug: r.slug,
                pureVegShop: r.pureVegShop,
                location: r.location,
                estimatedDeliveryTime: r.estimatedDeliveryTime
            } : null
        };
    });
};

