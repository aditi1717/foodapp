import mongoose from 'mongoose';

const productSkeletonSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        image: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', required: true, index: true },
        categoryName: { type: String, trim: true, default: '' },
        subcategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodSubcategory', default: null, index: true },
        subcategoryName: { type: String, trim: true, default: '' },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' },
        isActive: { type: Boolean, default: true, index: true }
    },
    {
        collection: 'food_product_skeletons',
        timestamps: true
    }
);

productSkeletonSchema.index({ categoryId: 1, subcategoryId: 1, isActive: 1 });

export const FoodProductSkeleton = mongoose.model('FoodProductSkeleton', productSkeletonSchema);
