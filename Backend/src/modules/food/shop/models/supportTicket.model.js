import mongoose from 'mongoose';

const shopSupportTicketSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodShop',
            required: true,
            index: true
        },
        category: {
            type: String,
            enum: ['orders', 'payments', 'menu', 'shop', 'technical', 'other'],
            required: true
        },
        issueType: { type: String, required: true, trim: true },
        subject: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        orderRef: { type: String, default: '', trim: true },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
        status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open', index: true },
        adminResponse: { type: String, default: '' },
        lastMessage: { type: String, default: '', trim: true },
        lastMessageAt: { type: Date, default: null },
        lastMessageSenderType: { type: String, enum: ['admin', 'user', 'shop', 'delivery'], default: 'shop' },
        closedAt: { type: Date, default: null },
        closedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        closedByType: { type: String, enum: ['admin', 'user', 'shop', 'delivery', 'system'], default: null }
    },
    { collection: 'food_shop_support_tickets', timestamps: true }
);

shopSupportTicketSchema.index({ shopId: 1, createdAt: -1 });
shopSupportTicketSchema.index({ status: 1, createdAt: -1 });

export const FoodShopSupportTicket = mongoose.model(
    'FoodShopSupportTicket',
    shopSupportTicketSchema
);
