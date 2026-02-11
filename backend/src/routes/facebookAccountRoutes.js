const express = require('express');
const router = express.Router();
const FacebookAccount = require('../models/FacebookAccount');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * FacebookAccount Routes
 * 
 * POST   /api/facebook-accounts - Kết nối tài khoản Facebook mới
 * GET    /api/facebook-accounts - Lấy danh sách tài khoản Facebook
 * GET    /api/facebook-accounts/:id - Lấy chi tiết tài khoản
 * PUT    /api/facebook-accounts/:id - Cập nhật token/cookie
 * DELETE /api/facebook-accounts/:id - Xóa tài khoản Facebook
 * POST   /api/facebook-accounts/:id/refresh - Refresh token
 */

/**
 * POST /api/facebook-accounts
 * Kết nối tài khoản Facebook mới
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            name,
            facebookId,
            email,
            profileUrl,
            avatarUrl,
            accessToken,
            cookie,
            expiresIn,
            permissions,
            scopes
        } = req.body;
        
        // Validate required fields
        if (!name || !facebookId || !accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (name, facebookId, accessToken)'
            });
        }
        
        // Check if facebookId already exists
        const existingAccount = await FacebookAccount.findOne({ facebookId });
        
        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook này đã được kết nối'
            });
        }
        
        // Calculate token expiration (default 60 days)
        const tokenExpiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000);
        
        // Create Facebook account
        const fbAccount = await FacebookAccount.create({
            name,
            userId: req.userId,
            facebookId,
            email,
            profileUrl,
            avatarUrl,
            accessToken,
            cookie: cookie ? (typeof cookie === 'string' ? cookie : JSON.stringify(cookie)) : null,
            tokenExpiresAt,
            permissions: permissions || [],
            scopes: scopes || [],
            connectedFromIP: req.clientIP || req.ip,
            userAgent: req.headers['user-agent']
        });
        
        return res.status(201).json({
            success: true,
            message: 'Kết nối tài khoản Facebook thành công',
            data: fbAccount.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Connect Facebook account error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook đã tồn tại'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/facebook-accounts
 * Lấy danh sách tài khoản Facebook
 * Admin: Xem tất cả
 * User: Chỉ xem của mình
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { isActive, userId: queryUserId } = req.query;
        
        let query = {};
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (req.user.role === 'admin') {
            if (queryUserId) {
                query.userId = queryUserId;
            }
        } else {
            query.userId = req.user._id;
        }

        const accounts = await FacebookAccount.find(query)
            .sort({ createdAt: -1 })
            .populate('userId', 'username fullName')
            .select('-accessToken -cookie -fb_dtsg -jazoest -lsd -userAgent');

        return res.json({
            success: true,
            data: accounts
        });
        
    } catch (error) {
        console.error('❌ Get Facebook accounts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/facebook-accounts/:id
 * Lấy chi tiết tài khoản Facebook
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id)
            .select('-accessToken -cookie')
            .populate('userId', 'username fullName');
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId._id.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem tài khoản này'
            });
        }
        
        return res.json({
            success: true,
            data: account
        });
        
    } catch (error) {
        console.error('❌ Get Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * PUT /api/facebook-accounts/:id
 * Cập nhật token/cookie
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền cập nhật tài khoản này'
            });
        }
        
        const { name, accessToken, cookie, expiresIn, isActive } = req.body;
        
        // Update basic info
        if (name !== undefined) account.name = name;
        if (isActive !== undefined) account.isActive = isActive;
        
        // Update token/cookie
        if (accessToken) {
            await account.updateToken({
                accessToken,
                cookie,
                expiresIn: expiresIn || 5184000
            });
        }
        
        return res.json({
            success: true,
            message: 'Cập nhật tài khoản thành công',
            data: account.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Update Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * DELETE /api/facebook-accounts/:id
 * Xóa tài khoản Facebook
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xóa tài khoản này'
            });
        }
        
        // Check if account is being used in any active campaigns
        const Campaign = require('../models/Campaign');
        const activeCampaigns = await Campaign.countDocuments({
            facebookAccountId: account._id,
            status: { $in: ['active', 'paused'] }
        });
        
        if (activeCampaigns > 0) {
            return res.status(400).json({
                success: false,
                message: `Không thể xóa tài khoản đang được sử dụng trong ${activeCampaigns} campaign`
            });
        }
        
        await account.deleteOne();
        
        return res.json({
            success: true,
            message: 'Xóa tài khoản Facebook thành công'
        });
        
    } catch (error) {
        console.error('❌ Delete Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/facebook-accounts/:id/refresh
 * Refresh token manually
 */
router.post('/:id/refresh', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền refresh token'
            });
        }
        
        const { accessToken, cookie, expiresIn } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu accessToken mới'
            });
        }
        
        await account.updateToken({
            accessToken,
            cookie,
            expiresIn: expiresIn || 5184000
        });
        
        return res.json({
            success: true,
            message: 'Refresh token thành công',
            data: account.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Refresh token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/facebook-accounts/:id/sync
 * Sync managed pages from Facebook
 * 
 * Priority 1: Use Graph API if accessToken present
 * Priority 2: Fallback to scraping via cookie
 * 
 * Response: { success, data: { pages: [...] }, message }
 */
router.post('/:id/sync', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch account
        const account = await FacebookAccount.findById(id)
            .select('+accessToken +cookie +userAgent');
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.user.role !== 'admin' && account.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền sync tài khoản này'
            });
        }
        
        console.log(`🔄 [SyncAccount] Starting page sync for account: ${account.name}`);
        
        let pages = [];
        let syncMethod = 'unknown';
        
        // PRIORITY 1: Try Graph API if accessToken present
        if (account.accessToken && account.accessToken.startsWith('EAAG')) {
            try {
                console.log('   📡 Attempting to fetch pages via Graph API...');
                
                const graphUrl = 'https://graph.facebook.com/me/accounts';
                const params = new URLSearchParams({
                    access_token: account.accessToken,
                    fields: 'id,name,picture,category,access_token',
                    limit: 100
                });
                
                const response = await fetch(`${graphUrl}?${params}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': account.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Graph API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.data && Array.isArray(data.data)) {
                    pages = data.data.map(page => ({
                        pageId: page.id,
                        name: page.name,
                        accessToken: page.access_token || undefined,
                        picture: page.picture?.data?.url || null,
                        category: page.category || null
                    }));
                    
                    syncMethod = 'graph_api';
                    console.log(`   ✅ Graph API: Found ${pages.length} pages`);
                } else if (data.error) {
                    throw new Error(`Graph API error: ${data.error.message}`);
                }
            } catch (error) {
                console.warn(`   ⚠️  Graph API failed: ${error.message}`);
                console.log('   ↻ Falling back to cookie scraping...');
            }
        } else {
            console.log('   ℹ️  No Graph API token, using cookie scraping...');
        }
        
        // PRIORITY 2: Fallback to scraping via cookie
        if (pages.length === 0 && account.cookie) {
            try {
                console.log('   🍪 Scraping pages via cookie from mbasic.facebook.com...');
                
                const { fetchPagesViaCookie } = require('../services/facebookCrawler');
                
                pages = await fetchPagesViaCookie(account.cookie);
                syncMethod = 'cookie_scrape';
                console.log(`   ✅ Cookie scrape: Found ${pages.length} pages`);
                
            } catch (error) {
                console.error(`   ❌ Cookie scraping failed: ${error.message}`);
            }
        }
        
        // Update account with synced pages
        account.pages = pages;
        account.lastPagesSyncAt = new Date();
        
        await account.save();
        console.log(`💾 [SyncAccount] Saved ${pages.length} pages for ${account.name}`);
        
        return res.json({
            success: true,
            message: `Đồng bộ thành công (phương pháp: ${syncMethod})`,
            data: {
                method: syncMethod,
                pages: pages,
                syncedAt: account.lastPagesSyncAt,
                count: pages.length
            }
        });
        
    } catch (error) {
        console.error('❌ Sync account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/facebook/post
 * Create a new post on user profile or managed page
 * 
 * Body:
 * {
 *   accountId: String (Facebook account ID),
 *   targetId: String (Profile ID or Page ID to post as),
 *   message: String (Post message/caption),
 *   attachments: Array (Optional image URLs or media objects),
 *   privacy: String (Optional: 'EVERYONE', 'FRIENDS', 'SELF')
 * }
 * 
 * Response: { success, postId, url, message, error }
 */
router.post('/post', authenticate, async (req, res) => {
    try {
        const { accountId, targetId, message, attachments = [], privacy = 'EVERYONE' } = req.body;
        
        // ==========================================
        // VALIDATION
        // ==========================================
        if (!accountId || !targetId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (accountId, targetId, message)'
            });
        }
        
        if (message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung bài viết không được để trống'
            });
        }
        
        console.log(`📝 [Post] Creating post for account: ${accountId}, target: ${targetId}`);
        
        // ==========================================
        // FETCH ACCOUNT
        // ==========================================
        const account = await FacebookAccount.findById(accountId)
            .select('+cookie +fb_dtsg +userAgent');
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.user.role !== 'admin' && account.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền đăng từ tài khoản này'
            });
        }
        
        // Verify targetId exists (either profile or managed page)
        const isProfilePost = (targetId === account.facebookId);
        let isPagePost = false;
        
        if (!isProfilePost) {
            isPagePost = account.pages.some(p => p.pageId === targetId);
            if (!isPagePost) {
                return res.status(400).json({
                    success: false,
                    message: 'ID đích không hợp lệ (không phải profile hoặc page được quản lý)'
                });
            }
        }
        
        console.log(`   📌 Target: ${isProfilePost ? 'Profile' : 'Page'} (${targetId})`);
        
        // ==========================================
        // PREPARE POST
        // ==========================================
        if (!account.cookie || !account.fb_dtsg) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản không có cookie hoặc DTSG token. Vui lòng đồng bộ lại.'
            });
        }
        
        // ==========================================
        // CALL FACEBOOK API SERVICE
        // ==========================================
        const { FacebookAPI } = require('../services/facebookAutomationService');
        const fbAPI = new FacebookAPI(account.accessToken, account.cookie);
        
        const postResult = await fbAPI.postToFeed(
            targetId,
            message,
            account.fb_dtsg,
            {
                attachments,
                privacy
            }
        );
        
        if (!postResult.success) {
            console.error(`❌ [Post] Failed to create post:`, postResult.error);
            return res.status(500).json({
                success: false,
                message: 'Không thể đăng bài viết',
                error: postResult.error
            });
        }
        
        console.log(`✅ [Post] Post created successfully: ${postResult.postId}`);
        
        // ==========================================
        // UPDATE STATS
        // ==========================================
        try {
            account.stats.totalCampaigns = (account.stats.totalCampaigns || 0) + 1;
            account.stats.lastUsedAt = new Date();
            await account.save();
        } catch (error) {
            console.warn('⚠️  Could not update stats:', error.message);
        }
        
        // ==========================================
        // RETURN RESPONSE
        // ==========================================
        return res.status(201).json({
            success: true,
            message: 'Đăng bài viết thành công',
            data: {
                postId: postResult.postId,
                url: postResult.url,
                message: postResult.message,
                target: isProfilePost ? 'profile' : 'page',
                targetId,
                timestamp: postResult.timestamp
            }
        });
        
    } catch (error) {
        console.error('❌ Post error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

module.exports = router;
