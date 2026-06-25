import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        type: { type: String, enum: ['order', 'shop', 'other'], required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', default: null },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodShop', default: null },
        issueType: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open', index: true },
        adminResponse: { type: String, default: '' }
    },
    { collection: 'food_support_tickets', timestamps: true }
);

supportTicketSchema.index({ userId: 1, createdAt: -1 });

export const FoodSupportTicket = mongoose.model('FoodSupportTicket', supportTicketSchema);
