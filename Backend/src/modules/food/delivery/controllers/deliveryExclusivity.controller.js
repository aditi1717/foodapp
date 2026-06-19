import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { FoodDeliveryExclusivity } from '../models/deliveryExclusivity.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
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

// ==================== RESTAURANT SIDE CONTROLLERS ====================

/**
 * Search delivery partner by 10-digit phone number.
 * Path: GET /api/food/restaurant/delivery-partners/search?phone=9876543210
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

        const restaurantId = req.user?.userId;

        // Check relationship status
        const association = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId: partner._id,
            status: 'associated'
        }).lean();

        const pendingInvite = await FoodDeliveryExclusivity.findOne({
            restaurantId,
            deliveryPartnerId: partner._id,
            status: 'pending'
        }).lean();

        const isAssociated = !!(association && association.restaurantId.toString() === restaurantId.toString());
        const isPending = !!pendingInvite;
        const associatedWithOther = !!(association && association.restaurantId.toString() !== restaurantId.toString());

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
 * Path: POST /api/food/restaurant/delivery-partners/invite
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

        const restaurantId = req.user?.userId;
        const restaurant = await FoodRestaurant.findById(restaurantId)
            .select('restaurantName')
            .lean();

        // Check if already associated with any restaurant
        const existingAssociation = await FoodDeliveryExclusivity.findOne({
            deliveryPartnerId: partner._id,
            status: 'associated'
        });

        if (existingAssociation) {
            if (existingAssociation.restaurantId.toString() === restaurantId.toString()) {
                return res.status(400).json({ success: false, message: 'Delivery partner is already in your active fleet' });
            } else {
                return res.status(400).json({ success: false, message: 'Delivery partner is already exclusive to another restaurant' });
            }
        }

        // Upsert pending request
        const invitation = await FoodDeliveryExclusivity.findOneAndUpdate(
            { restaurantId, deliveryPartnerId: partner._id },
            { status: 'pending', invitedAt: new Date() },
            { upsert: true, new: true }
        );

        // Push notify delivery partner for new exclusivity invite
        await notifyOwnersSafely(
            [{ ownerType: 'DELIVERY_PARTNER', ownerId: partner._id }],
            {
                title: 'New exclusivity invite',
                body: `${restaurant?.restaurantName || 'A restaurant'} invited you to join as an exclusive delivery partner.`,
                data: {
                    type: 'delivery_exclusivity_invite',
                    requestId: invitation?._id?.toString?.() || '',
                    restaurantId: String(restaurantId || ''),
                },
            },
        );

        return sendResponse(res, 200, `Invitation sent to ${partner.name}`);
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel pending invitation to delivery partner.
 * Path: POST /api/food/restaurant/delivery-partners/cancel
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

        const restaurantId = req.user?.userId;

        const result = await FoodDeliveryExclusivity.deleteOne({
            restaurantId,
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
 * Remove delivery partner from restaurant active fleet.
 * Path: POST /api/food/restaurant/delivery-partners/remove
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

        const restaurantId = req.user?.userId;

        const result = await FoodDeliveryExclusivity.deleteOne({
            restaurantId,
            deliveryPartnerId: partner._id,
            status: 'associated'
        });

        if (result.deletedCount === 0) {
            return res.status(400).json({ success: false, message: 'Rider is not associated with your restaurant' });
        }

        return sendResponse(res, 200, `${partner.name} has been removed from your delivery fleet`);
    } catch (error) {
        next(error);
    }
};

/**
 * List all invitations and active fleet riders for the restaurant.
 * Path: GET /api/food/restaurant/delivery-partners
 */
export const listExclusivityPartnersController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const { orderId } = req.query;

        let targetZoneId = null;
        let orderObj = null;
        if (orderId) {
            orderObj = await FoodOrder.findById(orderId).lean();
            if (orderObj) {
                targetZoneId = orderObj.zoneId;
            }
        }

        const records = await FoodDeliveryExclusivity.find({ restaurantId })
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
                    if (targetZoneId && String(partner.zoneId) !== String(targetZoneId)) {
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
            .populate('restaurantId', 'restaurantName ownerPhone location address')
            .lean();

        let currentAssociation = null;
        const requests = [];
        const rejectedRequests = [];

        records.forEach(rec => {
            const rest = rec.restaurantId;
            if (!rest) return;

            const formatted = {
                id: rec._id,
                restaurantName: rest.restaurantName,
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
 * Get current restaurant-association state (alias endpoint for app integrations).
 * Path: GET /api/food/delivery/restaurant-association
 */
export const getRestaurantAssociationController = async (req, res, next) => {
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
                message: 'You are already exclusive to another restaurant. Please leave that partnership first.'
            });
        }

        const request = await FoodDeliveryExclusivity.findOne({
            _id: requestId,
            deliveryPartnerId,
            status: 'pending'
        }).populate('restaurantId', 'restaurantName');

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

        // Push notify restaurant after rider accepts
        await notifyOwnersSafely(
            [{ ownerType: 'RESTAURANT', ownerId: request.restaurantId._id }],
            {
                title: 'Delivery partner accepted',
                body: `Your exclusivity invite was accepted by a delivery partner.`,
                data: {
                    type: 'delivery_exclusivity_accepted',
                    requestId: request._id?.toString?.() || '',
                    deliveryPartnerId: String(deliveryPartnerId || ''),
                },
            },
        );

        return sendResponse(res, 200, `Exclusivity request from ${request.restaurantId.restaurantName} accepted!`);
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
        }).populate('restaurantId', 'restaurantName');

        if (!request) {
            return res.status(404).json({ success: false, message: 'Pending invitation not found' });
        }

        request.status = 'rejected';
        request.rejectedAt = new Date();
        await request.save();

        // Push notify restaurant after rider rejects
        await notifyOwnersSafely(
            [{ ownerType: 'RESTAURANT', ownerId: request.restaurantId._id }],
            {
                title: 'Delivery partner declined',
                body: `Your exclusivity invite was declined by a delivery partner.`,
                data: {
                    type: 'delivery_exclusivity_rejected',
                    requestId: request._id?.toString?.() || '',
                    deliveryPartnerId: String(deliveryPartnerId || ''),
                },
            },
        );

        return sendResponse(res, 200, `Exclusivity request from ${request.restaurantId.restaurantName} declined`);
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

        const result = await FoodDeliveryExclusivity.deleteOne({
            deliveryPartnerId,
            status: 'associated'
        });

        if (result.deletedCount === 0) {
            return res.status(400).json({ success: false, message: 'You do not have any active partnership to leave' });
        }

        return sendResponse(res, 200, 'You have successfully left the partnership and are now a global rider');
    } catch (error) {
        next(error);
    }
};

/**
 * Respond to current pending restaurant association.
 * Path: POST /api/food/delivery/restaurant-association/respond
 * Body: { action: 'accept' | 'reject', requestId?: string }
 */
export const respondRestaurantAssociationController = async (req, res, next) => {
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
