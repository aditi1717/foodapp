import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { SupportTicketMessage } from '../models/supportTicketMessage.model.js';

const CLOSED_STATUS = 'closed';

function normalizeMessage(value) {
    return String(value || '').trim();
}

export function mapSupportTicketMessage(messageDoc) {
    const doc = messageDoc?.toObject ? messageDoc.toObject() : messageDoc || {};
    return {
        _id: doc._id,
        ticketId: doc.ticketId,
        sourceType: doc.sourceType,
        senderType: doc.senderType,
        senderId: doc.senderId || null,
        message: doc.message || '',
        isSystemMessage: doc.isSystemMessage === true,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

export async function listSupportTicketMessages({ ticketId, sourceType }) {
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
        throw new ValidationError('Invalid support ticket id');
    }
    const messages = await SupportTicketMessage.find({
        ticketId: new mongoose.Types.ObjectId(ticketId),
        sourceType: String(sourceType || '').trim()
    })
        .sort({ createdAt: 1 })
        .lean();

    return messages.map(mapSupportTicketMessage);
}

export async function appendSupportTicketMessage({
    ticket,
    sourceType,
    senderType,
    senderId = null,
    message,
    isSystemMessage = false
}) {
    const normalizedMessage = normalizeMessage(message);
    if (!normalizedMessage) {
        throw new ValidationError('Message is required');
    }
    if (normalizedMessage.length > 4000) {
        throw new ValidationError('Message is too long');
    }
    if (String(ticket?.status || '').toLowerCase() === CLOSED_STATUS && !isSystemMessage) {
        throw new ValidationError('Closed tickets cannot receive new messages');
    }

    const created = await SupportTicketMessage.create({
        ticketId: ticket._id,
        sourceType: String(sourceType || '').trim(),
        senderType: String(senderType || '').trim(),
        senderId: senderId && mongoose.Types.ObjectId.isValid(senderId)
            ? new mongoose.Types.ObjectId(senderId)
            : null,
        message: normalizedMessage,
        isSystemMessage: isSystemMessage === true
    });

    const ticketUpdate = {
        lastMessage: normalizedMessage,
        lastMessageAt: created.createdAt,
        lastMessageSenderType: String(senderType || '').trim()
    };

    if (!ticket.description) {
        ticketUpdate.description = normalizedMessage;
    }
    if (senderType === 'admin') {
        ticketUpdate.adminResponse = normalizedMessage;
        ticketUpdate.respondedAt = created.createdAt;
    }

    await ticket.constructor.updateOne({ _id: ticket._id }, { $set: ticketUpdate });

    return mapSupportTicketMessage(created);
}

export async function addTicketStatusSystemMessage({
    ticket,
    sourceType,
    actorType,
    actorId = null,
    nextStatus
}) {
    const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
    if (!normalizedStatus) return null;
    const message =
        normalizedStatus === 'closed'
            ? `Ticket closed by ${actorType}.`
            : normalizedStatus === 'open'
                ? `Ticket reopened by ${actorType}.`
                : `Ticket marked as ${normalizedStatus} by ${actorType}.`;

    return appendSupportTicketMessage({
        ticket,
        sourceType,
        senderType: actorType,
        senderId: actorId,
        message,
        isSystemMessage: true
    });
}
