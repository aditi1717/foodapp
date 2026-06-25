import mongoose from 'mongoose';

const bulkOrderPricingSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: false },
        minQuantity: { type: Number, default: null, min: 1 },
        bulkPrice: { type: Number, default: null, min: 0 }
    },
    { _id: false }
);

const foodVariantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        bulkOrderPricing: { type: bulkOrderPricingSchema, default: () => ({ enabled: false, minQuantity: null, bulkPrice: null }) }
    },
    { _id: true }
);

const foodSchema = new mongoose.Schema(
    {
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop', required: true, index: true },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', index: true },
        categoryName: { type: String, trim: true, default: '' },
        subcategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodSubcategory', index: true },
        subcategoryName: { type: String, trim: true, default: '' },
        name: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        variants: { type: [foodVariantSchema], default: [] },
        bulkOrderPricing: { type: bulkOrderPricingSchema, default: () => ({ enabled: false, minQuantity: null, bulkPrice: null }) },
        image: { type: String, trim: true, default: '' },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' },
        isAvailable: { type: Boolean, default: true, index: true },
        preparationTime: { type: String, trim: true, default: '' },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        rejectedAt: { type: Date }
    },
    {
        collection: 'food_items',
        timestamps: true
    }
);

foodSchema.index({ shopId: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, requestedAt: -1 });
foodSchema.index({ shopId: 1, approvalStatus: 1, createdAt: -1 });

export const FoodItem = mongoose.model('FoodItem', foodSchema);
