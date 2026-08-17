import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * SOP Section 2: Helper to generate rate limit key (User ID + Real Client IP)
 */
export const generateRateLimitKey = (req) => {
    const userId = req.user?._id?.toString() || req.user?.id?.toString() || 'anonymous';
    const clientIp = req.ip || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
    return `${userId}:${clientIp}`;
};

/**
 * Standard HTTP 429 response & Logging per SOP section 9 & 10
 */
const rateLimitHandler = (req, res) => {
    const userId = req.user?._id?.toString() || req.user?.id?.toString() || null;
    const clientIp = req.ip || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';

    // SOP Section 10: Logging blocked request
    console.warn(`[RATE_LIMIT_BLOCKED] ${JSON.stringify({
        timestamp: new Date().toISOString(),
        ip: clientIp,
        route: req.originalUrl || req.url,
        method: req.method,
        userId: userId,
        userAgent: req.get('User-Agent') || ''
    })}`);

    // SOP Section 9: Standard HTTP 429 Response
    return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
    });
};

/**
 * Category A — Authentication APIs Rate Limiter
 * SOP Section 2: Uses AUTH_RATE_LIMIT_WINDOW & AUTH_RATE_LIMIT_MAX
 */
export const authRateLimiter = rateLimit({
    windowMs: config.authRateLimitWindowMinutes * 60 * 1000,
    max: config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !config.rateLimitEnabled,
    handler: rateLimitHandler
});

/**
 * Category C — Private APIs Rate Limiter
 * SOP Section 2: Uses RATE_LIMIT_WINDOW, RATE_LIMIT_DEV_MAX (in dev) / RATE_LIMIT_MAX (in prod)
 * Key Generator: Authenticated User ID + Real Client IP (<User_ID>:<Real_Client_IP>)
 */
export const privateRateLimiter = rateLimit({
    windowMs: config.rateLimitWindowMinutes * 60 * 1000,
    max: config.nodeEnv === 'development' ? config.rateLimitDevMax : config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateRateLimitKey,
    skip: () => !config.rateLimitEnabled,
    handler: rateLimitHandler
});

// Backward-compatible alias
export const apiRateLimiter = privateRateLimiter;
