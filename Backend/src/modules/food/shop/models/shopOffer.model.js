import mongoose from 'mongoose';

const shopOfferSchema = new mongoose.Schema(
    {
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop', required: true, index: true },
        createdByShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop', required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
        productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' }],
        title: { type: String, required: true, trim: true, maxlength: 120 },
        discountType: { type: String, enum: ['percentage', 'flat-price'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        maxDiscount: { type: Number, default: null, min: 0 },
        maxOfferQuantityPerOrder: { type: Number, default: null, min: 0 },
        usageLimit: { type: Number, default: null, min: 0 },
        perUserLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        showInCart: { type: Boolean, default: true },
        status: { type: String, enum: ['active', 'paused', 'inactive'], default: 'inactive', index: true },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
        rejectionReason: { type: String, default: '' }
    },
    { collection: 'shop_offers', timestamps: true }
);

shopOfferSchema.index({ shopId: 1, createdAt: -1 });
shopOfferSchema.index({ productId: 1 });
shopOfferSchema.index({ productIds: 1 });

export const ShopOffer = mongoose.model('ShopOffer', shopOfferSchema);
