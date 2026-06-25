import mongoose from 'mongoose';

const foodOfferSchema = new mongoose.Schema(
    {
        couponCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
        discountType: { type: String, enum: ['percentage', 'flat-price'], default: 'percentage', index: true },
        discountValue: { type: Number, required: true, min: 0 },
        
        // NEW: Who funds this coupon - shop or platform
        fundedBy: { 
            type: String, 
            enum: ['shop', 'platform'], 
            default: 'platform',
            index: true 
        },
        
        customerScope: { type: String, enum: ['all', 'first-time'], default: 'all', index: true },
        shopScope: { type: String, enum: ['all', 'selected'], default: 'all', index: true },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop' },
        minOrderValue: { type: Number, default: 0, min: 0 },
        maxDiscount: { type: Number, default: null, min: 0 },
        usageLimit: { type: Number, default: null, min: 0 },
        perUserLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        startDate: { type: Date },
        isFirstOrderOnly: { type: Boolean, default: false },
        endDate: { type: Date },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved',
            index: true
        },
        createdByShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop', default: null },
        rejectionReason: { type: String, default: '' },
        status: { type: String, enum: ['active', 'paused', 'inactive'], default: 'active', index: true },
        showInCart: { type: Boolean, default: true }
    },
    { collection: 'food_offers', timestamps: true }
);

foodOfferSchema.index({ shopId: 1, createdAt: -1 });
foodOfferSchema.index({ approvalStatus: 1, createdAt: -1 });

export const FoodOffer = mongoose.model('FoodOffer', foodOfferSchema);
