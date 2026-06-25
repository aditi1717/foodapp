import mongoose from 'mongoose';

const foodLandingSettingsSchema = new mongoose.Schema(
    {
        exploreMoreHeading: {
            type: String,
            default: 'Explore more'
        },
        headerVideoUrl: {
            type: String,
            default: ''
        },
        headerVideoPublicId: {
            type: String,
            default: ''
        },
        recommendedShopIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'FoodShop',
            default: []
        },
        showHeroBanners: {
            type: Boolean,
            default: true
        },
        showUnder250: {
            type: Boolean,
            default: true
        },
        showExploreIcons: {
            type: Boolean,
            default: true
        },
        showTop10: {
            type: Boolean,
            default: true
        },
        showGourmet: {
            type: Boolean,
            default: true
        },
        defaultUnderPriceLimit: {
            type: Number,
            default: 250,
            min: 1
        },
        zoneShopVisibility: {
            type: [
                new mongoose.Schema(
                    {
                        zoneId: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: 'FoodZone',
                            required: true
                        },
                        mode: {
                            type: String,
                            enum: ['automatic', 'manual'],
                            default: 'automatic'
                        },
                        manualShopIds: {
                            type: [mongoose.Schema.Types.ObjectId],
                            ref: 'FoodShop',
                            default: []
                        }
                    },
                    { _id: false }
                )
            ],
            default: []
        }
    },
    {
        collection: 'food_landing_settings',
        timestamps: true
    }
);

export const FoodLandingSettings = mongoose.model('FoodLandingSettings', foodLandingSettingsSchema);

