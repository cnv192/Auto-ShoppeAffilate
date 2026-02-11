/**
 * Affiliate Redirect Routes
 * 
 * Merged from bridge-server/index.js
 * 
 * Features:
 * - Safe deep linking with referrer washing
 * - Affiliate link redirection
 * - Async click tracking (fire-and-forget)
 * - Security headers to hide source domain
 */

const express = require('express');
const router = express.Router();
const Link = require('../models/Link');

// Request counter for statistics
let affiliateRequestCount = 0;

/**
 * Tracking Logging Middleware
 * Comprehensive tracking logging for affiliate cookie injection
 */
router.use('/go/:slug', (req, res, next) => {
    const { slug } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || 'direct';
    const cookies = req.headers['cookie'];
    const cookieStatus = cookies ? '🍪 Yes (Cookies present)' : '❌ No (Cookies missing or blocked)';
    const timestamp = new Date().toISOString();
    
    affiliateRequestCount++;
    
    // Log detailed tracking information
    console.log(`
🔔 ════════════════════════════════════════════════════════════
🔔 [AFFILIATE TRACKING] Link Request #${affiliateRequestCount}
🔔 ════════════════════════════════════════════════════════════
⏰ Timestamp:     ${timestamp}
📍 IP Address:    ${clientIp}
🌐 Referer:       ${referer}
📱 User-Agent:    ${userAgent.substring(0, 80)}...
🔗 Slug:          ${slug}
🍪 Cookie Status: ${cookieStatus}
🔔 ════════════════════════════════════════════════════════════
    `.trim());

    // Add tracking data to request for use in route handler
    req.trackingData = {
        timestamp,
        clientIp,
        userAgent,
        referer,
        cookieStatus,
        isCookiePresent: !!cookies
    };

    next();
});

/**
 * GET /go/:slug
 * 
 * Main Redirect Route for affiliate links
 * 
 * - Finds link by slug (case-insensitive)
 * - Validates link is active and not expired
 * - Sets referrer policy for privacy
 * - Performs 302 redirect
 * - Records click asynchronously (fire-and-forget)
 * 
 * Example: /go/summer-sale-50
 * → Redirects to: https://shopee.vn/search?keyword=...
 */
router.get('/go/:slug', async (req, res) => {
    const { slug } = req.params;
    const trackingData = req.trackingData;

    if (!slug || slug.trim().length === 0) {
        console.error(`❌ [AFFILIATE REDIRECT] Empty slug provided`);
        return res.status(400).json({
            error: 'Invalid slug',
            message: 'Slug parameter is required'
        });
    }

    try {
        // Find link by slug (case-insensitive)
        const link = await Link.findOne({ 
            slug: slug.toLowerCase() 
        });

        // Validate link exists and is available
        if (!link) {
            console.log(`⚠️  [AFFILIATE REDIRECT] Link not found: ${slug}`);
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Link Not Found</title>
                        <style>
                            body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                            h1 { color: #EE4D2D; }
                            a { color: #EE4D2D; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <h1>404 - Link Not Found</h1>
                        <p>The link you're looking for doesn't exist or has been removed.</p>
                        <a href="/">← Back to Home</a>
                    </body>
                </html>
            `);
        }

        if (!link.isAvailable()) {
            console.log(`⚠️  [AFFILIATE REDIRECT] Link unavailable: ${slug}`);
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Link Expired</title>
                        <style>
                            body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                            h1 { color: #EE4D2D; }
                            a { color: #EE4D2D; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <h1>404 - Link Expired</h1>
                        <p>This link is no longer available.</p>
                        <a href="/">← Back to Home</a>
                    </body>
                </html>
            `);
        }

        // Security headers for referrer washing
        // no-referrer: Target site (Shopee/Facebook) only sees this domain, not the source
        res.set('Referrer-Policy', 'no-referrer');
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        
        // Disable caching for this redirect
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        console.log(`
✅ ════════════════════════════════════════════════════════════
✅ [AFFILIATE REDIRECT] Redirect Executed
✅ ════════════════════════════════════════════════════════════
📍 Slug:          ${slug}
🔗 Target URL:    ${link.targetUrl ? link.targetUrl.substring(0, 60) + '...' : '/article/' + slug}
📊 Total Clicks:  ${link.totalClicks}
🍪 Cookie Status: ${trackingData.cookieStatus}
⏰ Timestamp:     ${trackingData.timestamp}
✅ ════════════════════════════════════════════════════════════
        `.trim());

        // Record click asynchronously (fire-and-forget, non-blocking)
        if (link.recordClickAsync) {
            link.recordClickAsync().catch(err => {
                console.error('Non-critical error recording click:', err.message);
            });
        } else {
            // Fallback: update click count directly
            Link.findByIdAndUpdate(link._id, { $inc: { totalClicks: 1 } }).catch(err => {
                console.error('Non-critical error recording click:', err.message);
            });
        }

        // Perform 302 redirect
        if (link.targetUrl) {
            return res.redirect(302, link.targetUrl);
        } else {
            // No targetUrl set, redirect to article page
            return res.redirect(302, `/${slug}`);
        }

    } catch (err) {
        console.error(`❌ [AFFILIATE REDIRECT] Error for slug "${slug}": ${err.message}`);
        return res.status(500).send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Server Error</title>
                    <style>
                        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        h1 { color: #EE4D2D; }
                        a { color: #EE4D2D; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <h1>500 - Server Error</h1>
                    <p>An error occurred while processing your request.</p>
                    <a href="/">← Back to Home</a>
                </body>
            </html>
        `);
    }
});

/**
 * GET /stats
 * 
 * Statistics Endpoint for monitoring
 */
router.get('/stats', (req, res) => {
    const mongoose = require('mongoose');
    
    res.json({
        server: 'Shoppe Backend (Unified)',
        version: '2.0.0',
        uptime: process.uptime(),
        affiliateRequests: affiliateRequestCount,
        environment: process.env.NODE_ENV || 'development',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Export request count getter for health check
router.getAffiliateRequestCount = () => affiliateRequestCount;

module.exports = router;
