import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
    {
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true,
            index: true
        },
        ticketId: {
            type: String,
            unique: true,
            sparse: true
        },
        subject: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        category: {
            type: String,
            enum: ['payment', 'account', 'technical', 'order', 'other'],
            default: 'other'
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            default: 'open'
        },
        adminResponse: { type: String },
        respondedAt: { type: Date },
        lastMessage: { type: String, default: '', trim: true },
        lastMessageAt: { type: Date, default: null },
        lastMessageSenderType: { type: String, enum: ['admin', 'user', 'shop', 'delivery'], default: 'delivery' },
        closedAt: { type: Date, default: null },
        closedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        closedByType: { type: String, enum: ['admin', 'user', 'shop', 'delivery', 'system'], default: null }
    },
    { collection: 'food_delivery_support_tickets', timestamps: true }
);

supportTicketSchema.index({ deliveryPartnerId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export const DeliverySupportTicket = mongoose.model('DeliverySupportTicket', supportTicketSchema);
