import mongoose from 'mongoose';
import { FoodSupportTicket } from '../models/supportTicket.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    appendSupportTicketMessage,
    listSupportTicketMessages,
    addTicketStatusSystemMessage
} from '../../shared/services/supportTicketThread.service.js';

async function findUserTicketOrNull(ticketId, userId) {
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) return null;
    return FoodSupportTicket.findOne({
        _id: new mongoose.Types.ObjectId(ticketId),
        userId: new mongoose.Types.ObjectId(userId)
    })
        .populate({
            path: 'orderId',
            select: 'orderId displayOrderId pricing totalAmount shopId',
            populate: {
                path: 'shopId',
                select: 'shopName name area city'
            }
        })
        .populate('shopId', 'shopName name area city')
        .lean();
}

function buildLegacyMessages(ticket, messages = []) {
    if (Array.isArray(messages) && messages.length > 0) return messages;
    const fallback = [];
    if (String(ticket?.description || '').trim()) {
        fallback.push({
            _id: `legacy-user-${ticket?._id || ''}`,
            ticketId: ticket?._id,
            sourceType: 'user',
            senderType: 'user',
            senderId: ticket?.userId?._id || ticket?.userId || null,
            message: String(ticket.description).trim(),
            isSystemMessage: false,
            createdAt: ticket?.createdAt,
            updatedAt: ticket?.createdAt
        });
    }
    if (String(ticket?.adminResponse || '').trim()) {
        fallback.push({
            _id: `legacy-admin-${ticket?._id || ''}`,
            ticketId: ticket?._id,
            sourceType: 'user',
            senderType: 'admin',
            senderId: null,
            message: String(ticket.adminResponse).trim(),
            isSystemMessage: false,
            createdAt: ticket?.updatedAt || ticket?.createdAt,
            updatedAt: ticket?.updatedAt || ticket?.createdAt
        });
    }
    return fallback;
}

export async function createSupportTicketController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const body = req.body || {};
        const type = String(body.type || '').trim();
        const issueType = String(body.issueType || '').trim() || (type === 'order' ? 'Order issue' : type === 'shop' ? 'Shop issue' : 'Other issue');
        const description = String(body.description || '').trim();
        if (!['order', 'shop', 'other'].includes(type)) {
            return sendError(res, 400, 'Invalid ticket type');
        }
        if (!description) {
            return sendError(res, 400, 'description required');
        }
        const doc = {
            userId: new mongoose.Types.ObjectId(userId),
            type,
            issueType,
            description
        };
        if (type === 'order') {
            const rawOrderId = String(body.orderId || body.orderMongoId || body.displayOrderId || '').trim();
            if (!rawOrderId) {
                return sendError(res, 400, 'orderId required');
            }
            const { FoodOrder } = await import('../../orders/models/order.model.js');
            const order = mongoose.Types.ObjectId.isValid(rawOrderId)
                ? await FoodOrder.findOne({
                    _id: new mongoose.Types.ObjectId(rawOrderId),
                    userId: new mongoose.Types.ObjectId(userId)
                })
                    .select('_id shopId')
                    .lean()
                : await FoodOrder.findOne({
                    orderId: rawOrderId,
                    userId: new mongoose.Types.ObjectId(userId)
                })
                    .select('_id shopId')
                    .lean();

            if (!order?._id) {
                return sendError(res, 400, 'orderId required');
            }
            const orderMongoId = order._id;
            doc.orderId = orderMongoId;
            if (order?.shopId) {
                doc.shopId = order.shopId;
            }
        }
        if (type === 'shop') {
            if (!body.shopId || !mongoose.Types.ObjectId.isValid(body.shopId)) {
                return sendError(res, 400, 'shopId required');
            }
            doc.shopId = new mongoose.Types.ObjectId(body.shopId);
        }
        const created = await FoodSupportTicket.create(doc);
        await appendSupportTicketMessage({
            ticket: created,
            sourceType: 'user',
            senderType: 'user',
            senderId: userId,
            message: description
        });
        return sendResponse(res, 201, 'Ticket created', { ticket: created.toObject() });
    } catch (e) {
        next(e);
    }
}

export async function listMySupportTicketsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const skip = (page - 1) * limit;
        const [tickets, total] = await Promise.all([
            FoodSupportTicket.find({ userId: new mongoose.Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: 'orderId',
                    select: 'orderId displayOrderId pricing totalAmount shopId',
                    populate: {
                        path: 'shopId',
                        select: 'shopName name area city'
                    }
                })
                .populate('shopId', 'shopName name area city')
                .lean(),
            FoodSupportTicket.countDocuments({ userId: new mongoose.Types.ObjectId(userId) })
        ]);
        return sendResponse(res, 200, 'Tickets fetched', { tickets, total, page, limit });
    } catch (e) {
        next(e);
    }
}

export async function getMySupportTicketByIdController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const ticket = await findUserTicketOrNull(req.params.id, userId);
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        const messages = buildLegacyMessages(
            ticket,
            await listSupportTicketMessages({ ticketId: ticket._id, sourceType: 'user' })
        );
        return sendResponse(res, 200, 'Ticket fetched', { ticket, messages });
    } catch (e) {
        next(e);
    }
}

export async function addMySupportTicketMessageController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const ticketId = req.params.id;
        if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
            return sendError(res, 400, 'Invalid ticket id');
        }
        const ticket = await FoodSupportTicket.findOne({
            _id: new mongoose.Types.ObjectId(ticketId),
            userId: new mongoose.Types.ObjectId(userId)
        });
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        const createdMessage = await appendSupportTicketMessage({
            ticket,
            sourceType: 'user',
            senderType: 'user',
            senderId: userId,
            message: req.body?.message
        });
        const updatedTicket = await findUserTicketOrNull(ticketId, userId);
        return sendResponse(res, 201, 'Message added', { ticket: updatedTicket, message: createdMessage });
    } catch (e) {
        next(e);
    }
}

export async function updateMySupportTicketStatusController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const ticketId = req.params.id;
        const nextStatus = String(req.body?.status || '').trim().toLowerCase();
        if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
            return sendError(res, 400, 'Invalid ticket id');
        }
        if (!['open', 'closed'].includes(nextStatus)) {
            return sendError(res, 400, 'Invalid status');
        }
        const ticket = await FoodSupportTicket.findOne({
            _id: new mongoose.Types.ObjectId(ticketId),
            userId: new mongoose.Types.ObjectId(userId)
        });
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        ticket.status = nextStatus;
        ticket.closedAt = nextStatus === 'closed' ? new Date() : null;
        ticket.closedBy = nextStatus === 'closed' ? new mongoose.Types.ObjectId(userId) : null;
        ticket.closedByType = nextStatus === 'closed' ? 'user' : null;
        await ticket.save();
        await addTicketStatusSystemMessage({
            ticket,
            sourceType: 'user',
            actorType: 'user',
            actorId: userId,
            nextStatus
        });
        const updatedTicket = await findUserTicketOrNull(ticketId, userId);
        const messages = buildLegacyMessages(
            updatedTicket,
            await listSupportTicketMessages({ ticketId, sourceType: 'user' })
        );
        return sendResponse(res, 200, 'Ticket status updated', { ticket: updatedTicket, messages });
    } catch (e) {
        next(e);
    }
}
