import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { logger } from '../../../../utils/logger.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { notifyOwnersSafely } from './order.helpers.js';

/**
 * Send socket and push alerts to shop to start preparing the order
 */
async function sendPreparationReminder(order, customBody) {
    // 1. Socket notification to shop room to trigger alarm buzz and toast
    try {
        const io = getIO();
        if (io) {
            const payload = {
                ...order.toObject(),
                orderMongoId: order._id.toString(),
                isPreparationReminder: true,
                title: "Time to start preparing order",
                message: customBody,
            };
            io.to(rooms.shop(order.shopId)).emit("new_order", payload);
            io.to(rooms.shop(order.shopId)).emit("play_notification_sound", {
                orderId: order.orderId,
                orderMongoId: order._id.toString(),
                isPreparationReminder: true,
            });
        }
    } catch (socketErr) {
        logger.warn(`ScheduledWatchdog: Socket notification failed for order ${order.orderId}: ${socketErr.message}`);
    }

    // 2. Push Notification to shop owners via Firebase
    try {
        await notifyOwnersSafely([{ ownerType: "SHOP", ownerId: order.shopId }], {
            title: "Time to start preparing! 🧑‍🍳",
            body: `${customBody} Order #${order.orderId} is scheduled.`,
            image: "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png",
            data: {
                type: "scheduled_order_start",
                orderId: order.orderId,
                orderMongoId: order._id.toString(),
                link: `/shop/orders/${order._id.toString()}`,
                isPreparationReminder: "true",
            },
        });
    } catch (pushErr) {
        logger.warn(`ScheduledWatchdog: Push notification failed for order ${order.orderId}: ${pushErr.message}`);
    }
}

/**
 * Daemon watchdog to check and notify scheduled orders
 * whose preparation start time has arrived.
 */
export async function activateScheduledOrders() {
    try {
        const now = new Date();

        // Find all orders that are scheduled and not yet activated (i.e. not yet started by shop)
        const ordersToNotify = await FoodOrder.find({
            isScheduled: true,
            isActivated: false,
            orderStatus: 'scheduled'
        });

        if (ordersToNotify.length === 0) {
            return;
        }

        for (const order of ordersToNotify) {
            try {
                // Lead time is accepted prep minutes + base travel minutes (default to 35 mins if missing)
                const leadMinutes = order.eta?.totalBeforeReadyMinutes || 35;
                const startTime = new Date(order.scheduledAt.getTime() - leadMinutes * 60 * 1000);
                const startTime2Min = new Date(startTime.getTime() + 2 * 60 * 1000);
                const startTime10Min = new Date(startTime.getTime() + 10 * 60 * 1000);

                // Case 1: Exactly at preparation start time (or past it)
                if (now >= startTime && !order.isPreparationNotified) {
                    logger.info(`ScheduledWatchdog: Sending 1st preparation alert for Order #${order.orderId}`);
                    
                    order.isPreparationNotified = true;
                    await order.save();

                    // Send notifications (push + socket)
                    await sendPreparationReminder(order, "Time to start preparing!");
                }

                // Case 2: 2 minutes after preparation start time (and still in scheduled state)
                if (now >= startTime2Min && !order.isPreparationNotified2Min) {
                    logger.info(`ScheduledWatchdog: Sending 2-minute follow-up alert for Order #${order.orderId}`);
                    
                    order.isPreparationNotified2Min = true;
                    await order.save();

                    // Send notifications (push + socket)
                    await sendPreparationReminder(order, "Reminder: Please start preparing scheduled order!");
                }

                // Case 3: 10 minutes after preparation start time (and still in scheduled state)
                if (now >= startTime10Min && !order.isPreparationNotified10Min) {
                    logger.info(`ScheduledWatchdog: Sending 10-minute follow-up alert for Order #${order.orderId}`);
                    
                    order.isPreparationNotified10Min = true;
                    await order.save();

                    // Send notifications (push + socket)
                    await sendPreparationReminder(order, "Final Reminder: Please start preparing scheduled order immediately!");
                }
            } catch (orderErr) {
                logger.error(`ScheduledWatchdog: Failed to process notification for order ${order._id}: ${orderErr.message}`);
            }
        }
    } catch (err) {
        logger.error(`ScheduledWatchdog: Error in activateScheduledOrders daemon: ${err.message}`);
    }
}
