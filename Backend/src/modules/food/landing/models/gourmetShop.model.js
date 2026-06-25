import mongoose from 'mongoose';

const foodGourmetShopSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodShop',
            required: true
        },
        tags: {
            type: [String],
            default: []
        },
        priority: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        collection: 'food_gourmet_shops',
        timestamps: true
    }
);

foodGourmetShopSchema.index({ shopId: 1 });
foodGourmetShopSchema.index({ isActive: 1, priority: 1 });

export const FoodGourmetShop = mongoose.model('FoodGourmetShop', foodGourmetShopSchema);

