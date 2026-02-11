/**
 * Account Sync Routes
 * 
 * API endpoint cho Browser Extension đồng bộ Facebook accounts
 * POST /api/accounts/sync - Nhận data từ extension (bg.js)
 */

const express = require('express');
const router = express.Router();
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');

/**
 * POST /api/accounts/sync
 * Nhận data từ extension bg.js và lưu/update Facebook account
 * 
 * Body: {
 *   towblock_user_id: "userId từ URL",
 *   facebook_token: "EAAG...",
 *   facebook_dtsg: "token dtsg",
 *   facebook_cookie: "c_user=xxx; xs=yyy; ...",
 *   facebook_uid: "100012345678"
 * }
 */
router.post('/sync', async (req, res) => {
    try {
        const { 
            towblock_user_id, 
            facebook_token, 
            facebook_dtsg, 
            facebook_cookie, 
            facebook_uid,
            browserFingerprint
        } = req.body;

        console.log('========================================');
        console.log('📱 [Accounts/Sync] Received sync request');
        console.log('📱 User ID:', towblock_user_id);
        console.log('📱 Facebook UID:', facebook_uid);
        console.log('📱 Has Token:', facebook_token ? 'YES' : 'NO');
        console.log('📱 Has DTSG:', facebook_dtsg ? 'YES' : 'NO');
        console.log('📱 Cookie length:', facebook_cookie?.length || 0);
        console.log('📱 Dữ liệu Fingerprint nhận được:', browserFingerprint);
        console.log('========================================');

        // Validate required fields
        if (!facebook_uid || !facebook_cookie) {
            console.log('❌ [Accounts/Sync] Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (facebook_uid, facebook_cookie)'
            });
        }

        // Validate UID format (Facebook UID là số)
        if (!/^\d+$/.test(facebook_uid)) {
            console.log('❌ [Accounts/Sync] Invalid UID format');
            return res.status(400).json({
                success: false,
                message: 'UID không hợp lệ'
            });
        }

        // Tìm user
        let userId = towblock_user_id;
        if (!userId) {
            // Nếu không có userId, lấy user đầu tiên trong database
            const firstUser = await User.findOne().sort({ createdAt: 1 });
            if (firstUser) {
                userId = firstUser._id;
                console.log(`📱 [Accounts/Sync] No userId provided, using first user: ${firstUser.username}`);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Không tìm thấy user trong hệ thống'
                });
            }
        }

        // Kiểm tra account đã tồn tại chưa
        let account = await FacebookAccount.findOne({
            facebookId: facebook_uid,
            userId: userId
        });

        const accountName = `Facebook User ${facebook_uid}`;

        // Helper function to detect auth mode based on token
        const detectAuthMode = (token) => {
            if (!token) return 'cookie_only';
            // OAuth tokens start with 'EAA' or are very long (100+ chars)
            const isEAAToken = token.startsWith('EAA');
            const isLongToken = token.length > 100;
            const isDTSGFormat = token.includes(':') || token.length < 50;
            
            if ((isEAAToken || isLongToken) && !isDTSGFormat) {
                return 'oauth';
            }
            return 'cookie_only';
        };
        
        const authMode = detectAuthMode(facebook_token);
        console.log(`🔐 [Accounts/Sync] Auth mode detected: ${authMode}`);
        if (facebook_token) {
            console.log(`🔐 [Accounts/Sync] Token preview: ${facebook_token.substring(0, 30)}...`);
        }

        if (account) {
            // Update existing account
            console.log(`🔄 [Accounts/Sync] Updating existing account: ${account.name} (${facebook_uid})`);
            
            account.cookie = facebook_cookie;
            account.accessToken = facebook_token || account.accessToken;
            account.fb_dtsg = facebook_dtsg || account.fb_dtsg;
            account.browserFingerprint = browserFingerprint || account.browserFingerprint;
            account.authMode = authMode;
            account.tokenStatus = authMode === 'oauth' ? 'valid' : 'cookie_only';
            account.lastSyncAt = new Date();
            account.lastCheckedAt = new Date();
            account.syncSource = 'extension_bg';
            
            // Update health status on sync - assume healthy if can sync
            if (!account.healthStatus) {
                account.healthStatus = {};
            }
            account.healthStatus.isHealthy = true;
            account.healthStatus.lastError = null;
            
            await account.save();
            
            console.log(`✅ [Accounts/Sync] Updated account: ${account.name}`);
            
            return res.json({
                success: true,
                message: 'Cập nhật tài khoản thành công',
                data: {
                    accountId: account._id,
                    facebookId: facebook_uid,
                    name: account.name,
                    isNew: false
                }
            });
            
        } else {
            // Create new account
            console.log(`➕ [Accounts/Sync] Creating new account: ${accountName}`);
            
            account = new FacebookAccount({
                facebookId: facebook_uid,
                name: accountName,
                cookie: facebook_cookie,
                accessToken: facebook_token || null,
                fb_dtsg: facebook_dtsg || null,
                browserFingerprint: browserFingerprint,
                userId: userId,
                authMode: authMode,
                tokenStatus: authMode === 'oauth' ? 'valid' : 'cookie_only',
                lastCheckedAt: new Date(),
                healthStatus: {
                    isHealthy: true,
                    lastError: null,
                    lastErrorAt: null
                },
                syncSource: 'extension_bg',
                lastSyncAt: new Date()
            });
            
            await account.save();
            
            console.log(`✅ [Accounts/Sync] Created new account: ${account.name} (${facebook_uid})`);
            
            return res.json({
                success: true,
                message: 'Thêm tài khoản thành công',
                data: {
                    accountId: account._id,
                    facebookId: facebook_uid,
                    name: account.name,
                    isNew: true
                }
            });
        }

    } catch (error) {
        console.error('❌ [Accounts/Sync] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi đồng bộ tài khoản',
            error: error.message
        });
    }
});

module.exports = router;
