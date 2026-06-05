import mongoose from 'mongoose';

const foodSubcategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        image: { type: String, trim: true, default: '' },
        type: { type: String, trim: true, default: '' },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', required: true, index: true },
        foodTypeScope: { type: String, enum: ['Veg', 'Non-Veg', 'Both'], default: 'Both', index: true },
        /**
         * Subcategory scope:
         * - When restaurantId is missing: subcategory is admin/global
         * - When restaurantId is set: subcategory is private to that restaurant
         */
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, default: undefined },
        createdByRestaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, default: undefined },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
        isApproved: { type: Boolean, default: true, index: true },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        rejectedAt: { type: Date },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0, index: true },
        /**
         * Daily visibility window in local business time (HH:mm, 24h)
         */
        visibilityStartTime: { type: String, trim: true, default: '' },
        visibilityEndTime: { type: String, trim: true, default: '' }
    },
    {
        collection: 'food_subcategories',
        timestamps: true
    }
);

foodSubcategorySchema.index({ categoryId: 1, isApproved: 1, createdAt: -1 });
foodSubcategorySchema.index({ restaurantId: 1, isApproved: 1, createdAt: -1 });
foodSubcategorySchema.index({ approvalStatus: 1, createdAt: -1 });
foodSubcategorySchema.index({ createdByRestaurantId: 1, categoryId: 1, createdAt: -1 });

export const FoodSubcategory = mongoose.model('FoodSubcategory', foodSubcategorySchema);
