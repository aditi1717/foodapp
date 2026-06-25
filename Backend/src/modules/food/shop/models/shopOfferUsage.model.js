import mongoose from 'mongoose';

const shopOfferUsageSchema = new mongoose.Schema(
    {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopOffer', index: true, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', index: true, required: true },
        count: { type: Number, default: 0, min: 0 },
        lastUsedAt: { type: Date, default: null }
    },
    { collection: 'shop_offer_usages', timestamps: true }
);

shopOfferUsageSchema.index({ offerId: 1, userId: 1 }, { unique: true });

export const ShopOfferUsage = mongoose.model('ShopOfferUsage', shopOfferUsageSchema);
