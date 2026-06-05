import mongoose from 'mongoose';

const deliveryExclusivitySchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'associated', 'rejected'],
            default: 'pending',
            index: true
        },
        invitedAt: {
            type: Date,
            default: Date.now
        },
        associatedAt: {
            type: Date
        },
        rejectedAt: {
            type: Date
        }
    },
    { collection: 'food_delivery_exclusivities', timestamps: true }
);

// General lookup index for delivery partner requests by status
deliveryExclusivitySchema.index({ deliveryPartnerId: 1, status: 1 });

// A delivery boy can only have one active associated exclusivity request
deliveryExclusivitySchema.index(
    { deliveryPartnerId: 1 },
    { 
        unique: true, 
        partialFilterExpression: { status: 'associated' } 
    }
);

export const FoodDeliveryExclusivity = mongoose.model('FoodDeliveryExclusivity', deliveryExclusivitySchema);
