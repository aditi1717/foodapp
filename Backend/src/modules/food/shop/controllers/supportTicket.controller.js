import mongoose from 'mongoose';
import { FoodShopSupportTicket } from '../models/supportTicket.model.js';
import { sendError, sendResponse } from '../../../../utils/response.js';

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
const ALLOWED_STATUSES = ['open', 'in-progress', 'resolved'];

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
