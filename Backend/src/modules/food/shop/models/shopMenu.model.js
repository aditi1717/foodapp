import mongoose from 'mongoose';

const shopMenuSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodShop',
            required: true,
            unique: true,
            index: true
        },
        // Stored as-is for UI; validated at service layer.
        sections: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        }
    },
    {
        collection: 'food_shop_menus',
        timestamps: true
    }
);

export const FoodShopMenu = mongoose.model('FoodShopMenu', shopMenuSchema);

