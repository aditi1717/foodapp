import express from 'express';
import authRoutes from '../core/auth/auth.routes.js';
import deliveryRoutes from '../modules/food/delivery/routes/delivery.routes.js';
import shopRoutes from '../modules/food/shop/routes/shop.routes.js';
import landingRoutes from '../modules/food/landing/routes/landing.routes.js';
import uploadRoutes from '../modules/uploads/routes/upload.routes.js';
import shopAdminRoutes from '../modules/food/admin/routes/admin.routes.js';
import userRoutes from '../modules/food/user/routes/user.routes.js';
import orderUserRoutes from '../modules/food/orders/routes/order.routes.user.js';
import paymentRoutes from '../core/payments/payment.routes.js';
import fcmRoutes from '../core/notifications/fcm.routes.js';
import notificationRoutes from '../core/notifications/notification.routes.js';
import { authMiddleware } from '../core/auth/auth.middleware.js';
import { privateRateLimiter } from '../middleware/rateLimit.js';
import * as businessSettingsController from '../modules/food/admin/controllers/businessSettings.controller.js';
import { requireRoles } from '../core/roles/role.middleware.js';
import { getQueuesController } from '../controllers/admin.controller.js';
import webhookRoutes from '../core/payments/routes/webhook.routes.js';
import searchRoutes from '../modules/food/search/routes/search.routes.js';

const router = express.Router();

router.get('/v1/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Server is healthy' });
});

// Category A — Authentication APIs (Auth Rate Limiter handles inside authRoutes)
router.use('/v1/food/auth', authRoutes);
router.use('/v1/auth', authRoutes);

// Category B — Public APIs (Unrestricted, No Rate Limiter)
router.use('/v1/food/delivery', deliveryRoutes);
router.use('/v1/food/shop', shopRoutes);
router.use('/v1/food', landingRoutes);
router.use('/v1/food/search', searchRoutes);
router.use('/v1/uploads', uploadRoutes);

// Public business settings
router.get('/v1/food/admin/business-settings/public', businessSettingsController.getBusinessSettings);

// Webhook routes (Public)
router.use('/v1/payments/webhook', webhookRoutes);

// Category C — Private APIs (Auth Middleware -> Private Rate Limiter -> Routes)
router.use('/v1/food/admin', authMiddleware, privateRateLimiter, requireRoles('ADMIN'), shopAdminRoutes);
router.use('/v1/food/user', authMiddleware, privateRateLimiter, requireRoles('USER'), userRoutes);
router.use('/v1/food/notifications', authMiddleware, privateRateLimiter, requireRoles('USER', 'SHOP', 'DELIVERY_PARTNER'), notificationRoutes);
router.use('/v1/food/orders', authMiddleware, privateRateLimiter, requireRoles('USER'), orderUserRoutes);
router.use('/v1/food/payments', authMiddleware, privateRateLimiter, paymentRoutes);
router.use('/v1/fcm-tokens', fcmRoutes);
router.use('/fcm-tokens', fcmRoutes);

router.get('/v1/admin/queues', authMiddleware, privateRateLimiter, requireRoles('ADMIN'), getQueuesController);

export default router;
