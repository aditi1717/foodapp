import mongoose from 'mongoose';
import { FoodShopSupportTicket } from '../models/supportTicket.model.js';
import { sendError, sendResponse } from '../../../../utils/response.js';
import {
    appendSupportTicketMessage,
    listSupportTicketMessages,
    addTicketStatusSystemMessage
} from '../../shared/services/supportTicketThread.service.js';

const ALLOWED_CATEGORIES = ['orders', 'payments', 'menu', 'shop', 'technical', 'other'];
const ALLOWED_ISSUE_TYPES = [
    'order_status_issue',
    'new_order_issue',
    'payment_settlement_issue',
    'menu_item_issue',
    'shop_profile_issue',
    'app_technical_issue',
    'other'
];
const ALLOWED_STATUSES = ['open', 'in-progress', 'resolved', 'closed'];

async function findShopTicketOrNull(ticketId, shopId) {
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) return null;
    return FoodShopSupportTicket.findOne({
        _id: new mongoose.Types.ObjectId(ticketId),
        shopId: new mongoose.Types.ObjectId(shopId)
    }).lean();
}

function buildLegacyMessages(ticket, messages = []) {
    if (Array.isArray(messages) && messages.length > 0) return messages;
    const fallback = [];
    if (String(ticket?.description || '').trim()) {
        fallback.push({
            _id: `legacy-shop-${ticket?._id || ''}`,
            ticketId: ticket?._id,
            sourceType: 'shop',
            senderType: 'shop',
            senderId: ticket?.shopId || null,
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
            sourceType: 'shop',
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

export const createShopSupportTicketController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return sendError(res, 401, 'Unauthorized');
        }

        const body = req.body || {};
        const category = String(body.category || '').trim().toLowerCase();
        const issueType = String(body.issueType || '').trim();
        const description = String(body.description || body.subject || '').trim();
        const subject = String(body.subject || description.slice(0, 180)).trim();
        const orderRef = String(body.orderRef || body.orderId || '').trim();

        const isOrderRelated = ['order_status_issue', 'new_order_issue'].includes(issueType);

        if (!ALLOWED_CATEGORIES.includes(category)) {
            return sendError(res, 400, 'Invalid category');
        }
        if (!ALLOWED_ISSUE_TYPES.includes(issueType)) {
            return sendError(res, 400, 'Invalid issueType');
        }
        if (!description) {
            return sendError(res, 400, 'description required');
        }
        if (isOrderRelated && !orderRef) {
            return sendError(res, 400, 'orderRef is required for order-related issues');
        }

        const created = await FoodShopSupportTicket.create({
            shopId: new mongoose.Types.ObjectId(shopId),
            category,
            issueType,
            subject,
            description,
            orderRef
        });
        await appendSupportTicketMessage({
            ticket: created,
            sourceType: 'shop',
            senderType: 'shop',
            senderId: shopId,
            message: description
        });

        return sendResponse(res, 201, 'Support ticket created successfully', {
            ticket: created.toObject()
        });
    } catch (error) {
        next(error);
    }
};

export const listShopSupportTicketsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return sendError(res, 401, 'Unauthorized');
        }

        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const skip = (page - 1) * limit;

        const filter = { shopId: new mongoose.Types.ObjectId(shopId) };
        const status = String(req.query?.status || '').trim().toLowerCase();
        if (ALLOWED_STATUSES.includes(status)) {
            filter.status = status;
        }

        const searchText = String(req.query?.search || '').trim();
        if (searchText) {
            const rx = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { subject: rx },
                { issueType: rx },
                { description: rx },
                { orderRef: rx }
            ];
        }

        const [tickets, total] = await Promise.all([
            FoodShopSupportTicket.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodShopSupportTicket.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Support tickets fetched successfully', {
            tickets,
            total,
            page,
            limit
        });
    } catch (error) {
        next(error);
    }
};

export const getShopSupportTicketByIdController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return sendError(res, 401, 'Unauthorized');
        }
        const ticket = await findShopTicketOrNull(req.params.id, shopId);
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        const messages = buildLegacyMessages(
            ticket,
            await listSupportTicketMessages({ ticketId: ticket._id, sourceType: 'shop' })
        );
        return sendResponse(res, 200, 'Support ticket fetched successfully', { ticket, messages });
    } catch (error) {
        next(error);
    }
};

export const addShopSupportTicketMessageController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const ticketId = req.params.id;
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return sendError(res, 401, 'Unauthorized');
        }
        if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
            return sendError(res, 400, 'Invalid ticket id');
        }
        const ticket = await FoodShopSupportTicket.findOne({
            _id: new mongoose.Types.ObjectId(ticketId),
            shopId: new mongoose.Types.ObjectId(shopId)
        });
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        const message = await appendSupportTicketMessage({
            ticket,
            sourceType: 'shop',
            senderType: 'shop',
            senderId: shopId,
            message: req.body?.message
        });
        const updatedTicket = await findShopTicketOrNull(ticketId, shopId);
        return sendResponse(res, 201, 'Message added successfully', { ticket: updatedTicket, message });
    } catch (error) {
        next(error);
    }
};

export const updateShopSupportTicketStatusController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const ticketId = req.params.id;
        const nextStatus = String(req.body?.status || '').trim().toLowerCase();
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return sendError(res, 401, 'Unauthorized');
        }
        if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
            return sendError(res, 400, 'Invalid ticket id');
        }
        if (!['open', 'closed'].includes(nextStatus)) {
            return sendError(res, 400, 'Invalid status');
        }
        const ticket = await FoodShopSupportTicket.findOne({
            _id: new mongoose.Types.ObjectId(ticketId),
            shopId: new mongoose.Types.ObjectId(shopId)
        });
        if (!ticket) {
            return sendError(res, 404, 'Ticket not found');
        }
        ticket.status = nextStatus;
        ticket.closedAt = nextStatus === 'closed' ? new Date() : null;
        ticket.closedBy = nextStatus === 'closed' ? new mongoose.Types.ObjectId(shopId) : null;
        ticket.closedByType = nextStatus === 'closed' ? 'shop' : null;
        await ticket.save();
        await addTicketStatusSystemMessage({
            ticket,
            sourceType: 'shop',
            actorType: 'shop',
            actorId: shopId,
            nextStatus
        });
        const updatedTicket = await findShopTicketOrNull(ticketId, shopId);
        const messages = buildLegacyMessages(
            updatedTicket,
            await listSupportTicketMessages({ ticketId, sourceType: 'shop' })
        );
        return sendResponse(res, 200, 'Support ticket status updated successfully', { ticket: updatedTicket, messages });
    } catch (error) {
        next(error);
    }
};
