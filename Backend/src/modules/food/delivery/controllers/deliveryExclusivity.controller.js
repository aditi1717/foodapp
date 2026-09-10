import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { FoodDeliveryExclusivity } from '../models/deliveryExclusivity.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodBusinessSettings } from '../../admin/models/businessSettings.model.js';
import { sendResponse } from '../../../../utils/response.js';
import { notifyOwnersSafely } from '../../orders/services/order.helpers.js';
import { getDeliveryPartnerWalletEnhanced } from '../services/deliveryFinance.service.js';

// Helper to parse phone number into possible database match formats
const getPhoneVariants = (phone) => {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const searchNumber = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    return [searchNumber, `+91${searchNumber}`, `91${searchNumber}`];
};

// ==================== SHOP SIDE CONTROLLERS ====================

/**
 * Search delivery partner by 10-digit phone number.
 * Path: GET /api/food/shop/delivery-partners/search?phone=9876543210
 */
export const searchDeliveryPartnerController = async (req, res, next) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const phoneVariants = getPhoneVariants(phone);
        const partner = await FoodDeliveryPartner.findOne({ phone: { $in: phoneVariants }, status: 'approved' }).lean();
        if (!partner) {
            return res.status(404).json({ success: false, message: 'No approved delivery partner found with this phone number.' });
        }

        const shopId = req.user?.userId;

        // Check relationship status
        const association = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId: partner._id,
            status: 'associated'
        }).lean();

        const pendingInvite = await FoodDeliveryExclusivity.findOne({
            shopId,
            deliveryPartnerId: partner._id,
            status: 'pending'
        }).lean();

        const isAssociated = !!(association && association.shopId.toString() === shopId.toString());
        const isPending = !!pendingInvite;
        const associatedWithOther = !!(association && association.shopId.toString() !== shopId.toString());

        return sendResponse(res, 200, 'Delivery partner found', {
            id: partner._id,
            name: partner.name,
            phone: partner.phone,
            vehicleType: partner.vehicleType || 'Motorcycle',
            rating: partner.rating || 5.0,
            isAlreadyAssociated: isAssociated,
            isAlreadyPending: isPending,
            associatedWithOther
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send exclusivity invitation to delivery partner.
 * Path: POST /api/food/shop/delivery-partners/invite
 */
export const sendExclusivityInviteController = async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const phoneVariants = getPhoneVariants(phone);
        const partner = await FoodDeliveryPartner.findOne({ phone: { $in: phoneVariants }, status: 'approved' });
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Approved delivery partner not found' });
        }

        const shopId = req.user?.userId;
        const shop = await FoodShop.findById(shopId)
            .select('shopName')
            .lean();

        // Check if already associated with any shop
        const existingAssociation = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId: partner._id,
            status: 'associated'
        });

        if (existingAssociation) {
            if (existingAssociation.shopId.toString() === shopId.toString()) {
                return res.status(400).json({ success: false, message: 'Delivery partner is already in your active fleet' });
            } else {
                return res.status(400).json({ success: false, message: 'Delivery partner is already exclusive to another shop' });
            }
        }

        // Upsert pending request
        const invitation = await FoodDeliveryExclusivity.findOneAndUpdate(
            { shopId, deliveryPartnerId: partner._id },
            { status: 'pending', invitedAt: new Date() },
            { upsert: true, new: true }
        );

        const notificationTitle = 'New Exclusivity Invite';
        const notificationBody = `${shop?.shopName || 'A shop'} invited you to join as an exclusive delivery partner.`;
        const notificationData = {
            type: 'delivery_exclusivity_invite',
            requestId: invitation?._id?.toString?.() || '',
            shopId: String(shopId || ''),
            shopName: String(shop?.shopName || 'A shop'),
        };

        // 1. Push notify delivery partner for new exclusivity invite (FCM Push)
        await notifyOwnersSafely(
            [{ ownerType: 'DELIVERY_PARTNER', ownerId: partner._id }],
            {
                title: notificationTitle,
                body: notificationBody,
                data: notificationData,
            },
        );

        // 2. Real-time Socket.IO emission to the delivery partner's active room
        try {
            const { getIO, rooms } = await import('../../../../config/socket.js');
            const io = getIO();
            if (io) {
                const targetRoom = rooms.delivery(partner._id);
                io.to(targetRoom).emit('exclusivity_invite', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                    invitedAt: new Date(),
                });
                io.to(targetRoom).emit('notification', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
            }
        } catch (socketErr) {
            // Log & catch socket broadcast failure defensively
        }

        // 3. Save to In-App Notification Inbox so it persists in partner notifications
        try {
            const { createInboxNotifications } = await import('../../../../core/notifications/notification.service.js');
            await createInboxNotifications({
                notifications: [{
                    ownerType: 'DELIVERY_PARTNER',
                    ownerId: partner._id,
                    title: notificationTitle,
                    message: notificationBody,
                    link: '/food/delivery/profile/exclusivity-requests',
                    category: 'invite',
                    source: 'SHOP_INVITE',
                    metadata: notificationData,
                }]
            });
        } catch (inboxErr) {
            // Log & catch inbox notification creation failure defensively
        }

        return sendResponse(res, 200, `Invitation sent to ${partner.name}`);
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel pending invitation to delivery partner.
 * Path: POST /api/food/shop/delivery-partners/cancel
 */
export const cancelExclusivityInviteController = async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const phoneVariants = getPhoneVariants(phone);
        const partner = await FoodDeliveryPartner.findOne({ phone: { $in: phoneVariants } });
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Delivery partner not found' });
        }

        const shopId = req.user?.userId;

        const result = await FoodDeliveryExclusivity.deleteOne({
            shopId,
            deliveryPartnerId: partner._id,
            status: 'pending'
        });

        if (result.deletedCount === 0) {
            return res.status(400).json({ success: false, message: 'No pending invitation found for this driver' });
        }

        return sendResponse(res, 200, `Invitation to ${partner.name} cancelled`);
    } catch (error) {
        next(error);
    }
};

/**
 * Remove delivery partner from shop active fleet.
 * Path: POST /api/food/shop/delivery-partners/remove
 */
export const removeExclusivityRiderController = async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const phoneVariants = getPhoneVariants(phone);
        const partner = await FoodDeliveryPartner.findOne({ phone: { $in: phoneVariants } });
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Delivery partner not found' });
        }

        const shopId = req.user?.userId;

        const result = await FoodDeliveryExclusivity.deleteOne({
            shopId,
            deliveryPartnerId: partner._id,
            status: 'associated'
        });

        if (result.deletedCount === 0) {
            return res.status(400).json({ success: false, message: 'Rider is not associated with your shop' });
        }

        return sendResponse(res, 200, `${partner.name} has been removed from your delivery fleet`);
    } catch (error) {
        next(error);
    }
};

/**
 * List all invitations and active fleet riders for the shop.
 * Path: GET /api/food/shop/delivery-partners
 */
export const listExclusivityPartnersController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const { orderId } = req.query;

        let targetZoneId = null;
        let orderObj = null;
        if (orderId) {
            orderObj = await FoodOrder.findById(orderId).lean();
            if (orderObj) {
                targetZoneId = orderObj.zoneId;
            }
        }

        const records = await FoodDeliveryExclusivity.find({ shopId })
            .populate({
                path: 'deliveryPartnerId',
                select: 'name phone vehicleType rating status availabilityStatus zoneId'
            })
            .lean();



        // 2. Collect partner IDs of associated records
        const associatedPartnerIds = [];
        records.forEach(rec => {
            if (rec.status === 'associated' && rec.deliveryPartnerId) {
                associatedPartnerIds.push(rec.deliveryPartnerId._id);
            }
        });

        // 3. Count active orders for those partners
        const activeCountMap = new Map();
        if (associatedPartnerIds.length > 0) {
            const activeOrders = await FoodOrder.aggregate([
                {
                    $match: {
                        "dispatch.deliveryPartnerId": { $in: associatedPartnerIds },
                        "dispatch.status": { $in: ["assigned", "accepted"] },
                        orderStatus: { $in: ["placed", "created", "confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "reached_pickup", "reached_drop", "user_unavailable_review"] }
                    }
                },
                {
                    $group: {
                        _id: "$dispatch.deliveryPartnerId",
                        count: { $sum: 1 }
                    }
                }
            ]);
            activeOrders.forEach(item => {
                activeCountMap.set(String(item._id), item.count);
            });
        }

        const associatedRiders = [];
        const pendingInvites = [];
        const rejectedInvites = [];

        for (const rec of records) {
            const partner = rec.deliveryPartnerId;
            if (!partner) continue;

            const formatted = {
                id: rec._id, // request ID
                partnerId: partner._id,
                name: partner.name,
                phone: partner.phone,
                vehicleType: partner.vehicleType || 'Motorcycle',
                rating: partner.rating || 5.0,
                status: rec.status,
                invitedAt: rec.invitedAt,
                associatedAt: rec.associatedAt,
                rejectedAt: rec.rejectedAt
            };

            if (rec.status === 'associated') {
                if (orderId) {
                    if (partner.status !== 'approved' || partner.availabilityStatus !== 'online') {
                        continue;
                    }

                    // Security balance check for COD orders
                    if (orderObj && orderObj.payment?.method === 'cash') {
                        const wallet = await getDeliveryPartnerWalletEnhanced(partner._id);
                        const pocketBalance = wallet.pocketBalance || 0;
                        const cashInHand = wallet.cashInHand || 0;
                        const orderAmount = orderObj.pricing?.total || 0;
                        if (pocketBalance < (cashInHand + orderAmount)) {
                            continue; // Skip/hide rider from the manual assignment selection list
                        }
                    }
                }

                associatedRiders.push(formatted);
            } else if (rec.status === 'pending') {
                pendingInvites.push(formatted);
            } else if (rec.status === 'rejected') {
                rejectedInvites.push(formatted);
            }
        }

        return sendResponse(res, 200, 'Exclusivity list fetched successfully', {
            associatedRiders,
            pendingInvites,
            rejectedInvites
        });
    } catch (error) {
        next(error);
    }
};

// ==================== DELIVERY PARTNER SIDE CONTROLLERS ====================

/**
 * Fetch incoming and active exclusivity requests for the delivery boy.
 * Path: GET /api/food/delivery/exclusivity-requests
 */
export const listIncomingRequestsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;

        const records = await FoodDeliveryExclusivity.find({ deliveryPartnerId })
            .populate('shopId', 'shopName ownerPhone location address')
            .lean();

        let currentAssociation = null;
        const requests = [];
        const rejectedRequests = [];

        records.forEach(rec => {
            const rest = rec.shopId;
            if (!rest) return;

            const formatted = {
                id: rec._id,
                shopName: rest.shopName,
                phone: rest.ownerPhone,
                location: rest.location?.formattedAddress || rest.address || 'Address not set',
                status: rec.status,
                requestedAt: rec.invitedAt,
                associatedAt: rec.associatedAt,
                rejectedAt: rec.rejectedAt
            };

            if (rec.status === 'associated') {
                currentAssociation = formatted;
            } else if (rec.status === 'pending') {
                requests.push(formatted);
            } else if (rec.status === 'rejected') {
                rejectedRequests.push(formatted);
            }
        });

        return sendResponse(res, 200, 'Exclusivity requests fetched successfully', {
            currentAssociation,
            requests,
            rejectedRequests
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current shop-association state (alias endpoint for app integrations).
 * Path: GET /api/food/delivery/shop-association
 */
export const getShopAssociationController = async (req, res, next) => {
    return listIncomingRequestsController(req, res, next);
};

/**
 * Accept exclusivity request.
 * Path: POST /api/food/delivery/exclusivity-requests/:requestId/accept
 */
export const acceptExclusivityRequestController = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const deliveryPartnerId = req.user?.userId;

        // Check if already associated
        const existingAssociation = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId,
            status: 'associated'
        });

        if (existingAssociation) {
            return res.status(400).json({
                success: false,
                message: 'You are already exclusive to another shop. Please leave that partnership first.'
            });
        }

        const request = await FoodDeliveryExclusivity.findOne({
            _id: requestId,
            deliveryPartnerId,
            status: 'pending'
        }).populate('shopId', 'shopName');

        if (!request) {
            return res.status(404).json({ success: false, message: 'Pending invitation not found' });
        }

        request.status = 'associated';
        request.associatedAt = new Date();
        await request.save();

        // Reject other pending requests
        await FoodDeliveryExclusivity.updateMany(
            {
                deliveryPartnerId,
                _id: { $ne: requestId },
                status: 'pending'
            },
            {
                status: 'rejected',
                rejectedAt: new Date()
            }
        );

        // Fetch rider name & details for notification
        const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).select('name phone').lean();
        const partnerName = partner?.name || 'A delivery partner';
        const partnerPhone = partner?.phone ? ` (+91 ${partner.phone})` : '';

        const shopOwnerId = request.shopId?._id || request.shopId;
        const notificationTitle = 'Exclusivity Invite Accepted';
        const notificationBody = `${partnerName}${partnerPhone} accepted your exclusivity invitation and joined your active fleet!`;
        const notificationData = {
            type: 'delivery_exclusivity_accepted',
            requestId: request._id?.toString?.() || '',
            deliveryPartnerId: String(deliveryPartnerId || ''),
            partnerName,
        };

        // 1. FCM Push notify shop
        await notifyOwnersSafely(
            [{ ownerType: 'SHOP', ownerId: shopOwnerId }],
            {
                title: notificationTitle,
                body: notificationBody,
                data: notificationData,
            },
        );

        // 2. Real-time Socket.IO emission to shop room
        try {
            const { getIO, rooms } = await import('../../../../config/socket.js');
            const io = getIO();
            if (io) {
                const targetRoom = rooms.shop(shopOwnerId);
                io.to(targetRoom).emit('exclusivity_accepted', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
                io.to(targetRoom).emit('notification', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
            }
        } catch (socketErr) {
            // Log & catch socket broadcast failure defensively
        }

        // 3. Save to In-App Inbox Notification for shop
        try {
            const { createInboxNotifications } = await import('../../../../core/notifications/notification.service.js');
            await createInboxNotifications({
                notifications: [{
                    ownerType: 'SHOP',
                    ownerId: shopOwnerId,
                    title: notificationTitle,
                    message: notificationBody,
                    link: '/food/shop/delivery-partners',
                    category: 'invite',
                    source: 'RIDER_ACCEPT_INVITE',
                    metadata: notificationData,
                }]
            });
        } catch (inboxErr) {
            // Log & catch inbox creation failure defensively
        }

        return sendResponse(res, 200, `Exclusivity request from ${request.shopId.shopName} accepted!`);
    } catch (error) {
        next(error);
    }
};

/**
 * Decline exclusivity request.
 * Path: POST /api/food/delivery/exclusivity-requests/:requestId/reject
 */
export const rejectExclusivityRequestController = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const deliveryPartnerId = req.user?.userId;

        const request = await FoodDeliveryExclusivity.findOne({
            _id: requestId,
            deliveryPartnerId,
            status: 'pending'
        }).populate('shopId', 'shopName');

        if (!request) {
            return res.status(404).json({ success: false, message: 'Pending invitation not found' });
        }

        request.status = 'rejected';
        request.rejectedAt = new Date();
        await request.save();

        // Fetch rider name & details for notification
        const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).select('name phone').lean();
        const partnerName = partner?.name || 'A delivery partner';
        const partnerPhone = partner?.phone ? ` (+91 ${partner.phone})` : '';

        const shopOwnerId = request.shopId?._id || request.shopId;
        const notificationTitle = 'Exclusivity Invite Declined';
        const notificationBody = `${partnerName}${partnerPhone} declined your exclusivity invitation.`;
        const notificationData = {
            type: 'delivery_exclusivity_rejected',
            requestId: request._id?.toString?.() || '',
            deliveryPartnerId: String(deliveryPartnerId || ''),
            partnerName,
        };

        // 1. FCM Push notify shop
        await notifyOwnersSafely(
            [{ ownerType: 'SHOP', ownerId: shopOwnerId }],
            {
                title: notificationTitle,
                body: notificationBody,
                data: notificationData,
            },
        );

        // 2. Real-time Socket.IO emission to shop room
        try {
            const { getIO, rooms } = await import('../../../../config/socket.js');
            const io = getIO();
            if (io) {
                const targetRoom = rooms.shop(shopOwnerId);
                io.to(targetRoom).emit('exclusivity_rejected', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
                io.to(targetRoom).emit('notification', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
            }
        } catch (socketErr) {
            // Log & catch socket broadcast failure defensively
        }

        // 3. Save to In-App Inbox Notification for shop
        try {
            const { createInboxNotifications } = await import('../../../../core/notifications/notification.service.js');
            await createInboxNotifications({
                notifications: [{
                    ownerType: 'SHOP',
                    ownerId: shopOwnerId,
                    title: notificationTitle,
                    message: notificationBody,
                    link: '/food/shop/delivery-partners',
                    category: 'invite',
                    source: 'RIDER_REJECT_INVITE',
                    metadata: notificationData,
                }]
            });
        } catch (inboxErr) {
            // Log & catch inbox creation failure defensively
        }

        return sendResponse(res, 200, `Exclusivity request from ${request.shopId.shopName} declined`);
    } catch (error) {
        next(error);
    }
};

/**
 * Leave current partnership.
 * Path: POST /api/food/delivery/exclusivity-requests/leave
 */
export const leaveExclusivityPartnershipController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;

        const record = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId,
            status: 'associated'
        }).populate('shopId', 'shopName');

        if (!record) {
            return res.status(400).json({ success: false, message: 'You do not have any active partnership to leave' });
        }

        const shopOwnerId = record.shopId?._id || record.shopId;
        const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).select('name phone').lean();
        const partnerName = partner?.name || 'A delivery partner';
        const partnerPhone = partner?.phone ? ` (+91 ${partner.phone})` : '';

        await FoodDeliveryExclusivity.deleteOne({ _id: record._id });

        const notificationTitle = 'Delivery Partner Left Fleet';
        const notificationBody = `${partnerName}${partnerPhone} has left your exclusivity partnership and is now a global rider.`;
        const notificationData = {
            type: 'delivery_exclusivity_left',
            deliveryPartnerId: String(deliveryPartnerId || ''),
            partnerName,
        };

        // 1. FCM Push notify shop
        await notifyOwnersSafely(
            [{ ownerType: 'SHOP', ownerId: shopOwnerId }],
            {
                title: notificationTitle,
                body: notificationBody,
                data: notificationData,
            },
        );

        // 2. Real-time Socket.IO emission to shop room
        try {
            const { getIO, rooms } = await import('../../../../config/socket.js');
            const io = getIO();
            if (io) {
                const targetRoom = rooms.shop(shopOwnerId);
                io.to(targetRoom).emit('exclusivity_left', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
                io.to(targetRoom).emit('notification', {
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });
            }
        } catch (socketErr) {
            // Log & catch socket broadcast failure defensively
        }

        // 3. Save to In-App Inbox Notification for shop
        try {
            const { createInboxNotifications } = await import('../../../../core/notifications/notification.service.js');
            await createInboxNotifications({
                notifications: [{
                    ownerType: 'SHOP',
                    ownerId: shopOwnerId,
                    title: notificationTitle,
                    message: notificationBody,
                    link: '/food/shop/delivery-partners',
                    category: 'invite',
                    source: 'RIDER_LEAVE_FLEET',
                    metadata: notificationData,
                }]
            });
        } catch (inboxErr) {
            // Log & catch inbox creation failure defensively
        }

        return sendResponse(res, 200, 'You have successfully left the partnership and are now a global rider');
    } catch (error) {
        next(error);
    }
};

/**
 * Respond to current pending shop association.
 * Path: POST /api/food/delivery/shop-association/respond
 * Body: { action: 'accept' | 'reject', requestId?: string }
 */
export const respondShopAssociationController = async (req, res, next) => {
    try {
        const action = String(req.body?.action || '').trim().toLowerCase();
        const requestId = req.body?.requestId ? String(req.body.requestId).trim() : '';

        if (action !== 'accept' && action !== 'reject') {
            return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
        }

        if (!requestId) {
            return res.status(400).json({ success: false, message: 'requestId is required' });
        }

        req.params = { ...(req.params || {}), requestId };
        if (action === 'accept') {
            return acceptExclusivityRequestController(req, res, next);
        }
        return rejectExclusivityRequestController(req, res, next);
    } catch (error) {
        next(error);
    }
};
