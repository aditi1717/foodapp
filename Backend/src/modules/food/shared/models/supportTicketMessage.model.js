import mongoose from 'mongoose';

const supportTicketMessageSchema = new mongoose.Schema(
    {
        ticketId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        sourceType: {
            type: String,
            enum: ['user', 'shop', 'delivery'],
            required: true,
            index: true
        },
        senderType: {
            type: String,
            enum: ['admin', 'user', 'shop', 'delivery'],
            required: true
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        },
        isSystemMessage: {
            type: Boolean,
            default: false
        }
    },
    { collection: 'food_support_ticket_messages', timestamps: true }
);

supportTicketMessageSchema.index({ ticketId: 1, sourceType: 1, createdAt: 1 });

export const SupportTicketMessage = mongoose.model('SupportTicketMessage', supportTicketMessageSchema);
