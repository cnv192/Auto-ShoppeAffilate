/**
 * IP Filter Debug Routes
 * 
 * API endpoints để test và debug IP Filter middleware
 * CHỈ DÙNG TRONG MÔI TRƯỜNG DEVELOPMENT
 */

const express = require('express');
const router = express.Router();
const { 
    getClientIP, 
    analyzeIP, 
    manualLookup,
    getCacheStats,
    getDatabaseStatus,
    clearIPCache 
} = require('../middleware/ipFilter');

/**
 * GET /api/debug/ip
 * Lấy thông tin IP của client hiện tại
 */
router.get('/ip', (req, res) => {
    const clientIP = getClientIP(req);
    const analysis = analyzeIP(clientIP);
    
    res.json({
        success: true,
        data: {
            clientIP,
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'] || null,
                'x-real-ip': req.headers['x-real-ip'] || null,
                'cf-connecting-ip': req.headers['cf-connecting-ip'] || null
            },
            analysis
        }
    });
});

/**
 * GET /api/debug/ip/:ip
 * Tra cứu thông tin của một IP cụ thể
 */
router.get('/ip/:ip', (req, res) => {
    const { ip } = req.params;
    
    try {
        const analysis = manualLookup(ip);
        
        res.json({
            success: true,
            data: {
                ip,
                analysis
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/debug/ip-filter/status
 * Lấy trạng thái của IP Filter
 */
router.get('/ip-filter/status', (req, res) => {
    res.json({
        success: true,
        data: {
            database: getDatabaseStatus(),
            cache: getCacheStats()
        }
    });
});

/**
 * POST /api/debug/ip-filter/clear-cache
 * Xóa cache IP
 */
router.post('/ip-filter/clear-cache', (req, res) => {
    clearIPCache();
    
    res.json({
        success: true,
        message: 'IP cache cleared successfully'
    });
});

/**
 * POST /api/debug/ip/batch-lookup
 * Tra cứu nhiều IP cùng lúc
 */
router.post('/ip/batch-lookup', (req, res) => {
    const { ips } = req.body;
    
    if (!Array.isArray(ips) || ips.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Please provide an array of IPs'
        });
    }
    
    // Giới hạn 100 IP mỗi lần
    const limitedIPs = ips.slice(0, 100);
    
    const results = limitedIPs.map(ip => ({
        ip,
        analysis: manualLookup(ip)
    }));
    
    res.json({
        success: true,
        data: {
            total: results.length,
            results
        }
    });
});

/**
 * POST /api/debug/facebook/test-crawler
 * Test Facebook crawler với cookie
 */
router.post('/facebook/test-crawler', async (req, res) => {
    const { cookie, targetUrl } = req.body;
    
    if (!cookie) {
        return res.status(400).json({
            success: false,
            error: 'Please provide Facebook cookie'
        });
    }
    
    try {
        // Import automation service
        const { CampaignAutomationService } = require('../services/facebookAutomationService');
        const automationService = new CampaignAutomationService();
        
        // Determine what to crawl
        let result;
        if (targetUrl) {
            if (targetUrl.includes('/groups/')) {
                result = await automationService.crawlGroupPosts(targetUrl, cookie);
            } else if (targetUrl.includes('facebook.com/')) {
                result = await automationService.crawlPagePosts(targetUrl, cookie);
            } else {
                result = [];
            }
        } else {
            // Default: crawl News Feed
            result = await automationService.crawlNewsFeed(cookie, 10);
        }
        
        res.json({
            success: true,
            data: {
                targetUrl: targetUrl || 'News Feed',
                postsFound: result.length,
                postIds: result
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/debug/facebook/resolve-url
 * Test URL resolution for /share/p/ format
 */
router.post('/facebook/resolve-url', async (req, res) => {
    const { url, cookie } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'Please provide Facebook URL'
        });
    }
    
    try {
        // Import functions
        const { extractPostIdSync, resolveShareUrl, extractPostIdAsync } = require('../services/facebookAutomationService');
        
        // Try sync first
        const syncResult = extractPostIdSync(url);
        
        let asyncResult = null;
        if (!syncResult && url.includes('/share/p/')) {
            asyncResult = await resolveShareUrl(url, cookie || '');
        }
        
        res.json({
            success: true,
            data: {
                inputUrl: url,
                syncResult: syncResult,
                asyncResult: asyncResult,
                finalPostId: syncResult || asyncResult
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
