import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodDeliveryExclusivity } from '../../delivery/models/deliveryExclusivity.model.js';
import { FoodBusinessSettings } from '../../admin/models/businessSettings.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { config } from '../../../../config/env.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { getDeliveryPartnerWalletEnhanced } from '../../delivery/services/deliveryFinance.service.js';
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnerSafely,
  notifyOwnersSafely,
} from './order.helpers.js';

async function filterEligibleDeliveryPartners(partnerIds, order = null) {
  if (!partnerIds || !partnerIds.length) return [];

  // 1. Exclude exclusive/associated riders (from ANY shop)
  const exclusiveRows = await FoodDeliveryExclusivity.find({
    status: "associated",
  })
    .select("deliveryPartnerId")
    .lean();
  const exclusiveSet = new Set(exclusiveRows.map(row => String(row.deliveryPartnerId)));

  // 2. Auto-assignment only allows a single active order per rider
  const maxActiveOrders = 1;

  // 3. Count active orders for each candidate
  const activeOrders = await FoodOrder.aggregate([
    {
      $match: {
        "dispatch.deliveryPartnerId": { $in: partnerIds.map(id => new mongoose.Types.ObjectId(id)) },
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
  const activeCountMap = new Map(activeOrders.map(item => [String(item._id), item.count]));

  const eligibleIds = [];
  for (const id of partnerIds) {
    const idStr = String(id);
    if (exclusiveSet.has(idStr)) continue;
    const activeCount = activeCountMap.get(idStr) || 0;
    if (activeCount >= maxActiveOrders) continue;

    // Security balance check for COD orders
    if (order && order.payment?.method === "cash") {
      const wallet = await getDeliveryPartnerWalletEnhanced(id);
      const pocketBalance = wallet.pocketBalance || 0;
      const cashInHand = wallet.cashInHand || 0;
      const orderAmount = order.pricing?.total || 0;

      if (pocketBalance < (cashInHand + orderAmount)) {
        continue; // Exclude rider
      }
    }

    eligibleIds.push(id);
  }
  return eligibleIds;
}

async function listNearbyOnlineDeliveryPartners(
  shopId,
  { maxKm = 15, limit = 25, order = null } = {},
) {
  const rId = (shopId?._id || shopId).toString();
  const shop = await FoodShop.findById(rId)
    .select("location")
    .lean();

  const allowedStatuses = process.env.NODE_ENV === 'production' ? ['approved'] : ['approved', 'pending'];

  if (!shop?.location?.coordinates?.length) {
    const partners = await FoodDeliveryPartner.find({
      status: { $in: allowedStatuses },
      availabilityStatus: "online",
    })
      .select("_id status name")
      .lean();

    const eligibleIds = await filterEligibleDeliveryPartners(partners.map(p => p._id), order);
    const eligibleSet = new Set(eligibleIds.map(id => String(id)));
    const filteredPartners = partners.filter(p => eligibleSet.has(String(p._id)));

    return {
      shop: null,
      partners: filteredPartners.slice(0, Math.max(1, limit)).map((p) => ({ partnerId: p._id, distanceKm: null })),
    };
  }

  const [rLng, rLat] = shop.location.coordinates;
  const allOnline = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
  })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const onlineIds = allOnline.map((p) => p?._id).filter(Boolean);
  const eligibleIds = await filterEligibleDeliveryPartners(onlineIds, order);
  const eligibleSet = new Set(eligibleIds.map(id => String(id)));

  const scored = [];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;
    if (!eligibleSet.has(String(p._id))) continue;

    const isStale = !p.lastLocationAt || (Date.now() - new Date(p.lastLocationAt).getTime()) > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      scored.push({ partnerId: p._id, distanceKm: 999, status: p.status });
      continue;
    }

    const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));

  if (picked.length === 0) {
    const anyOnline = await FoodDeliveryPartner.find({
      status: { $in: allowedStatuses },
      availabilityStatus: "online",
    })
      .select("_id status name")
      .lean();

    const eligibleAnyIds = await filterEligibleDeliveryPartners(anyOnline.map(p => p._id), order);
    const eligibleAnySet = new Set(eligibleAnyIds.map(id => String(id)));
    const filteredAnyOnline = anyOnline.filter(p => eligibleAnySet.has(String(p._id)));

    return {
      partners: filteredAnyOnline.slice(0, Math.max(1, limit)).map((p) => ({
        partnerId: p._id,
        distanceKm: null,
        status: p.status,
      })),
    };
  }

  const final = (config.env === 'production')
    ? picked.filter(p => p.status === 'approved')
    : picked;

  return { partners: final };
}

export async function getDispatchSettings() {
  let doc = await FoodSettings.findOne({ key: "dispatch" }).lean();
  if (!doc) {
    await FoodSettings.create({ key: "dispatch", dispatchMode: "manual" });
    doc = await FoodSettings.findOne({ key: "dispatch" }).lean();
  }
  return { dispatchMode: doc?.dispatchMode || "manual" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  const normalizedMode = dispatchMode === "auto" ? "auto" : "manual";
  await FoodSettings.findOneAndUpdate(
    { key: "dispatch" },
    {
      $set: {
        dispatchMode: normalizedMode,
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  );
  return getDispatchSettings();
}

export async function tryAutoAssign(orderId, options = {}) {
  const settings = await getDispatchSettings();
  if (settings.dispatchMode !== "auto") {
    logger.info(
      `tryAutoAssign: skipped for ${orderId} because dispatch mode is manual.`,
    );
    return null;
  }

  const attempt = options.attempt || 1;
  const lockTimeout = 55000; // 55 seconds lock interval

  const order = await FoodOrder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(orderId),
      $or: [
        { 'dispatch.status': 'unassigned' },
        {
          'dispatch.status': 'assigned',
          'dispatch.acceptedAt': { $exists: false },
          'dispatch.assignedAt': { $lt: new Date(Date.now() - lockTimeout) }
        }
      ],
      'dispatch.dispatchingAt': { $exists: false }
    },
    {
      $set: { 'dispatch.dispatchingAt': new Date() }
    },
    { new: true }
  ).populate(['shopId', 'userId']);

  if (!order) {
    logger.info(`tryAutoAssign: Skip for ${orderId} (already dispatching, accepted, or multi-attempt lock active).`);
    return null;
  }

  try {
    const offeredIds = (order.dispatch?.offeredTo || []).map(o => o.partnerId.toString());
    
    // RADIUS EXPANSION LOGIC
    // Attempt 1: 15km, Attempt 2: 25km, Attempt 3: 40km, Attempt 4+: 60km
    let maxKm = 15;
    if (attempt === 2) maxKm = 25;
    if (attempt === 3) maxKm = 40;
    if (attempt >= 4) maxKm = 60;

    const searchOptions = { maxKm, limit: 15 };
    const { partners } = await listNearbyOnlineDeliveryPartners(order.shopId, { ...searchOptions, order });
    
    // TIERED ALERT LOGIC
    // Phase 2: Broadcast to all (Attempt 3+)
    // Phase 3: Admin Alert (Attempt 5+ or roughly 5 mins)
    const isPhase2 = attempt >= 3;
    const isPhase3 = attempt >= 6; // ~6 minutes (60s * 6)

    if (isPhase3) {
      logger.error(`[CRITICAL] Order ${order._id} unassigned for ${attempt} mins. Triggering Admin Alert (Phase 3).`);
      // Notify Admin via Push (Web/Mobile)
      try {
        await notifyOwnersSafely(
          [{ ownerType: 'ADMIN', ownerId: 'GLOBAL' }], // Use GLOBAL or specific admin group if defined
          {
            title: 'Unassigned Order Crisis!',
            body: `Order #${order.order_id || order._id} has not been picked up for 5+ minutes. Manual intervention required!`,
            data: { type: 'admin_alert_unassigned', orderId: order._id.toString() }
          }
        );
      } catch (err) {
        logger.warn(`Admin notification failed: ${err.message}`);
      }
    }

    const eligible = partners.filter(p => !offeredIds.includes(p.partnerId.toString()));

    if (eligible.length === 0) {
      logger.info(`tryAutoAssign: No NEW eligible partners in ${maxKm}km for order ${order._id}. Restarting hunt...`);
      
      // If we ran out of new eligible partners, we might want to re-offer to everyone (Phase 2 style)
      const io = getIO();
      if (io && partners.length > 0) {
        const payload = buildDeliverySocketPayload(order, order.shopId);
        for (const p of partners) {
          const roomName = rooms.delivery(p.partnerId);
          io.to(roomName).emit('new_order_available', { ...payload, pickupDistanceKm: p.distanceKm });
        }
      }

      // Re-queue itself to keep trying
      await addOrderJob({
        action: 'DISPATCH_TIMEOUT_CHECK',
        orderMongoId: order._id.toString(),
        orderId: order._id.toString(),
        attempt: attempt + 1
      }, { delay: 30000 }); // Retry faster (30s) if no one found

      return order;
    }

    const io = getIO();
    const payload = buildDeliverySocketPayload(order, order.shopId);

    if (isPhase2) {
      // PHASE 2 BROADCAST: Notify everyone remaining
      logger.info(`[Phase 2] Broadcasting order ${order._id} to ${eligible.length} riders.`);
      for (const p of eligible) {
        const roomName = rooms.delivery(p.partnerId);
        if (io) io.to(roomName).emit('new_order', { ...payload, pickupDistanceKm: p.distanceKm });
      }
    } else {
      // PHASE 1: Target best rider only
      const p = eligible[0];
      const roomName = rooms.delivery(p.partnerId);
      logger.info(`[Phase 1] Offering order ${order._id} to best rider ${p.partnerId} (${p.distanceKm}km)`);
      if (io) io.to(roomName).emit('new_order', { ...payload, pickupDistanceKm: p.distanceKm });
      
      try {
        await notifyOwnerSafely(
          { ownerType: 'DELIVERY_PARTNER', ownerId: p.partnerId },
          {
            title: 'New order assigned!',
            body: `You have 60 seconds to accept Order #${order.order_id || order._id}.`,
            data: { type: 'new_order', orderId: order._id.toString() },
          },
        );
      } catch (err) {
        logger.warn(`Push notification failed for partner ${p.partnerId}: ${err.message}`);
      }
    }

    const offeredToEntries = eligible.map(p => ({
      partnerId: p.partnerId,
      at: new Date(),
      action: 'offered'
    }));

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    order.dispatch.offeredTo.push(...offeredToEntries);
    await order.save();

    // Re-check in 60s
    await addOrderJob({
      action: 'DISPATCH_TIMEOUT_CHECK',
      orderMongoId: order._id.toString(),
      orderId: order._id.toString(),
      attempt: attempt + 1
    }, { delay: 60000 });

    return order;
  } finally {
    await FoodOrder.findByIdAndUpdate(orderId, {
      $unset: { 'dispatch.dispatchingAt': '' },
    });
  }
}


export async function processDispatchTimeout(orderId, partnerId) {
  const order = await FoodOrder.findById(orderId);
  if (!order) return;

  const stillAssigned = order.dispatch?.status === 'assigned' &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(`Dispatch timeout for partner ${partnerId} on order ${orderId}. Re-trying hunt...`);
    const offer = order.dispatch.offeredTo.find(
      o => String(o.partnerId) === String(partnerId) && o.action === 'offered'
    );
    if (offer) offer.action = 'timeout';

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    await order.save();
    
    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(orderId, { attempt });
  } else if (order.dispatch?.status === 'unassigned') {
    // If it's already unassigned (e.g. from a previous timeout), just keep hunting
    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(orderId, { attempt });
  }
}


export async function resendDeliveryNotificationShop(orderId, shopId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    shopId: new mongoose.Types.ObjectId(shopId),
  });

  if (!order) throw new NotFoundError('Order not found');

  const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
  }

  if (order.dispatch?.status === 'accepted') {
    throw new ValidationError('A delivery partner has already accepted this order.');
  }

  order.dispatch.status = 'unassigned';
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.offeredTo = [];
  await order.save();

  await tryAutoAssign(order._id);
  return { success: true };
}
