/**
 * Extension Sync Routes
 * 
 * API endpoints cho Browser Extension đồng bộ Facebook accounts
 * - POST /api/extension/sync - Nhận data từ extension
 * - GET /api/extension/auth-token - Generate temp token cho extension
 * - GET /api/extension/status - Check extension connection status
 * - POST /api/extension/generate-auth-code - Generate one-time auth code (NEW)
 * - POST /api/extension/validate-auth-code - Validate auth code từ extension (NEW)
 * - GET /api/extension/auth-status/:code - Check auth completion status (NEW)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');

// Lưu trữ temp tokens (trong production nên dùng Redis)
const tempTokens = new Map();

// Lưu trữ auth codes cho auto-auth flow
const authCodes = new Map();

// Token expiry time (1 hour)
const TOKEN_EXPIRY = 60 * 60 * 1000;

// Auth code expiry (5 minutes)
const AUTH_CODE_EXPIRY = 5 * 60 * 1000;

/**
 * Tạo temp token cho extension authenticate
 */
const generateTempToken = (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + TOKEN_EXPIRY;
    
    tempTokens.set(token, {
        userId,
        expiresAt
    });
    
    // Cleanup expired tokens
    for (const [key, value] of tempTokens.entries()) {
        if (value.expiresAt < Date.now()) {
            tempTokens.delete(key);
        }
    }
    
    return { token, expiresAt };
};

/**
 * Validate temp token từ extension
 */
const validateTempToken = (token) => {
    const data = tempTokens.get(token);
    if (!data) return null;
    
    if (data.expiresAt < Date.now()) {
        tempTokens.delete(token);
        return null;
    }
    
    return data;
};

/**
 * GET /api/extension/auth-token
 * Generate temporary token để extension authenticate với backend
 * Yêu cầu user đã đăng nhập web app
 */
router.get('/auth-token', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const { token, expiresAt } = generateTempToken(userId);
        
        console.log(`🔑 [Extension] Generated auth token for user: ${req.user.username}`);
        
        return res.json({
            success: true,
            data: {
                tempToken: token,
                expiresIn: Math.floor((expiresAt - Date.now()) / 1000),
                expiresAt: new Date(expiresAt).toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Generate extension token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo token cho extension'
        });
    }
});

/**
 * POST /api/extension/sync
 * Nhận data từ extension và lưu/update Facebook account
 * 
 * Headers:
 *   X-Extension-Token: temp token từ /auth-token
 * 
 * Body: {
 *   uid: "100012345678",
 *   name: "Nguyen Van A",
 *   cookies: "c_user=100012345678; xs=abc123...",
 *   accessToken: "EAABwz..." (optional),
 *   extensionVersion: "1.0.0"
 * }
 */
router.post('/sync', async (req, res) => {
    try {
        // Lấy userId từ body (hoặc lấy user đầu tiên trong DB)
        let { uid, name, cookies, accessToken, extensionVersion, userId, fb_dtsg, jazoest, lsd, userAgent, browserFingerprint } = req.body;
        
        // Nếu không có userId, lấy user đầu tiên trong database
        if (!userId) {
            const firstUser = await User.findOne().sort({ createdAt: 1 });
            if (firstUser) {
                userId = firstUser._id;
                console.log(`[Extension] No userId provided, using first user: ${firstUser.username}`);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Không tìm thấy user trong hệ thống. Vui lòng đăng ký tài khoản trước.'
                });
            }
        }
        
        // Validate required fields
        if (!uid || !cookies) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (uid, cookies)'
            });
        }
        
        // Validate UID format (Facebook UID là số)
        if (!/^\d+$/.test(uid)) {
            return res.status(400).json({
                success: false,
                message: 'UID không hợp lệ'
            });
        }

        // Fallback browserFingerprint nếu không có từ extension
        if (!browserFingerprint) {
            // Random modern Windows User-Agent
            const modernUserAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            ];
            const randomUA = modernUserAgents[Math.floor(Math.random() * modernUserAgents.length)];
            
            browserFingerprint = {
                userAgent: userAgent || randomUA,
                platform: 'Windows',
                secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                secChUaPlatform: '"Windows"',
                mobile: false
            };
            console.log(`[Extension] Using fallback fingerprint for old extension version`);
        }
        
        console.log(`📱 [Extension] Sync request - UID: ${uid}, Name: ${name}, Version: ${extensionVersion}`);
        console.log(`📱 [Extension] Tokens - accessToken: ${accessToken ? '✓' : '✗'}, fb_dtsg: ${fb_dtsg ? '✓' : '✗'}, jazoest: ${jazoest ? '✓' : '✗'}, lsd: ${lsd ? '✓' : '✗'}`);
        console.log(`📱 [Extension] Fingerprint - UA: ${browserFingerprint.userAgent.substring(0, 50)}..., Platform: ${browserFingerprint.platform}`);
        
        // Check if account exists
        let account = await FacebookAccount.findOne({
            $or: [
                { facebookId: uid },
                { facebookId: uid, userId: userId }
            ]
        });
        
        const now = new Date();
        
        if (account) {
            // Update existing account
            account.name = name || account.name;
            account.cookie = cookies;
            account.facebookId = uid;
            account.tokenStatus = accessToken ? 'active' : 'cookie_only';
            account.lastChecked = now;
            account.updatedAt = now;
            
            if (accessToken) {
                account.accessToken = accessToken;
            }
            
            // Lưu fb_dtsg và các token khác
            if (fb_dtsg) account.fb_dtsg = fb_dtsg;
            if (jazoest) account.jazoest = jazoest;
            if (lsd) account.lsd = lsd;
            
            // Lưu browserFingerprint
            if (browserFingerprint) {
                account.browserFingerprint = {
                    userAgent: browserFingerprint.userAgent || userAgent,
                    platform: browserFingerprint.platform || 'Windows',
                    secChUa: browserFingerprint.secChUa,
                    secChUaPlatform: browserFingerprint.secChUaPlatform,
                    mobile: browserFingerprint.mobile || false
                };
            }
            
            // Optionally update userId if not set
            if (!account.userId) {
                account.userId = userId;
            }
            
            await account.save();
            
            console.log(`✅ [Extension] Updated account: ${name} (${uid})`);
            
            return res.json({
                success: true,
                message: 'Đã cập nhật tài khoản Facebook',
                data: {
                    uid: account.facebookId,
                    name: account.name,
                    tokenStatus: account.tokenStatus,
                    hasAccessToken: !!account.accessToken,
                    hasFbDtsg: !!account.fb_dtsg,
                    hasFingerprinit: !!account.browserFingerprint?.userAgent,
                    isNew: false
                }
            });
        } else {
            // Create new account
            account = new FacebookAccount({
                facebookId: uid,
                name: name || `Facebook User ${uid}`,
                cookie: cookies,
                accessToken: accessToken || null,
                fb_dtsg: fb_dtsg || null,
                jazoest: jazoest || null,
                lsd: lsd || null,
                browserFingerprint: browserFingerprint || {
                    userAgent: userAgent,
                    platform: 'Windows',
                    secChUa: '"Not_A Brand";v="8"',
                    secChUaPlatform: '"Windows"',
                    mobile: false
                },
                tokenStatus: accessToken ? 'active' : 'cookie_only',
                userId: userId,
                lastChecked: now,
                lastCheckedAt: now,
                healthStatus: {
                    isHealthy: true,
                    lastError: null,
                    lastErrorAt: null
                },
                createdAt: now,
                updatedAt: now
            });
            
            await account.save();
            
            console.log(`✅ [Extension] Created new account: ${name} (${uid})`);
            
            return res.json({
                success: true,
                message: 'Đã thêm tài khoản Facebook mới',
                data: {
                    uid: account.facebookId,
                    name: account.name,
                    tokenStatus: account.tokenStatus,
                    hasAccessToken: !!accessToken,
                    hasFbDtsg: !!fb_dtsg,
                    hasFingerprint: !!browserFingerprint?.userAgent,
                    isNew: true
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Extension sync error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi đồng bộ tài khoản',
            error: error.message
        });
    }
});

/**
 * GET /api/extension/status
 * Check connection status và danh sách accounts đã sync
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get user's synced accounts
        const accounts = await FacebookAccount.find({ userId })
            .select('facebookId name tokenStatus lastChecked updatedAt')
            .sort('-updatedAt');
        
        return res.json({
            success: true,
            data: {
                connected: true,
                accountCount: accounts.length,
                accounts: accounts.map(acc => ({
                    uid: acc.facebookId,
                    name: acc.name,
                    tokenStatus: acc.tokenStatus,
                    lastSynced: acc.updatedAt || acc.lastChecked
                }))
            }
        });
        
    } catch (error) {
        console.error('❌ Extension status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi lấy trạng thái'
        });
    }
});

/**
 * POST /api/extension/validate-cookies
 * Validate cookies còn hoạt động không
 */
router.post('/validate-cookies', async (req, res) => {
    try {
        const extToken = req.headers['x-extension-token'];
        
        if (!extToken) {
            return res.status(401).json({
                success: false,
                message: 'Thiếu extension token'
            });
        }
        
        const tokenData = validateTempToken(extToken);
        if (!tokenData) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn'
            });
        }
        
        const { uid, cookies } = req.body;
        
        if (!uid || !cookies) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu uid hoặc cookies'
            });
        }
        
        // Check if c_user cookie exists and matches uid
        const hasValidCUser = cookies.includes(`c_user=${uid}`);
        
        // Check for xs cookie (session token)
        const hasXsCookie = cookies.includes('xs=');
        
        const isValid = hasValidCUser && hasXsCookie;
        
        return res.json({
            success: true,
            data: {
                isValid,
                hasValidCUser,
                hasXsCookie,
                message: isValid 
                    ? 'Cookies hợp lệ' 
                    : 'Cookies không hợp lệ hoặc đã hết hạn'
            }
        });
        
    } catch (error) {
        console.error('❌ Validate cookies error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi validate cookies'
        });
    }
});

// =============================================
// AUTO-AUTH FLOW ENDPOINTS (NEW)
// =============================================

/**
 * POST /api/extension/generate-auth-code
 * Generate one-time auth code để extension tự động authenticate
 * Flow: Web App generate code → User mở auth page → Extension nhận code → Validate
 */
router.post('/generate-auth-code', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = req.user;
        
        // Generate random code
        const code = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + AUTH_CODE_EXPIRY;
        
        // Store code với metadata
        authCodes.set(code, {
            userId: userId.toString(),
            userName: user.username || user.name,
            userEmail: user.email,
            created: Date.now(),
            completed: false,
            completedAt: null,
            expiresAt
        });
        
        // Auto-delete sau 5 phút
        setTimeout(() => {
            authCodes.delete(code);
            console.log(`🗑️ [Auth] Code expired and deleted: ${code.substring(0, 8)}...`);
        }, AUTH_CODE_EXPIRY);
        
        // Frontend URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const authUrl = `${frontendUrl}/ext-auth?code=${code}`;
        
        console.log(`🔐 [Auth] Generated auth code for user: ${user.username} (${code.substring(0, 8)}...)`);
        
        return res.json({
            success: true,
            code,
            authUrl,
            expiresIn: Math.floor(AUTH_CODE_EXPIRY / 1000) // seconds
        });
        
    } catch (error) {
        console.error('❌ Generate auth code error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate auth code'
        });
    }
});

/**
 * POST /api/extension/validate-auth-code
 * Extension gọi endpoint này để validate code và nhận user info
 * One-time use - code sẽ bị đánh dấu completed sau khi validate thành công
 */
router.post('/validate-auth-code', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Code is required'
            });
        }
        
        // Lookup code
        const authData = authCodes.get(code);
        
        if (!authData) {
            console.log(`❌ [Auth] Invalid code attempt: ${code.substring(0, 8)}...`);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired code'
            });
        }
        
        // Check expiry
        if (Date.now() > authData.expiresAt) {
            authCodes.delete(code);
            return res.status(401).json({
                success: false,
                error: 'Code has expired'
            });
        }
        
        // Check if already used
        if (authData.completed) {
            return res.status(401).json({
                success: false,
                error: 'Code already used'
            });
        }
        
        // Mark as completed (one-time use)
        authData.completed = true;
        authData.completedAt = Date.now();
        
        // Also generate a temp token for the extension to use for future sync requests
        const { token: tempToken, expiresAt: tokenExpiresAt } = generateTempToken(authData.userId);
        
        console.log(`✅ [Auth] Code validated for user: ${authData.userName} (${authData.userId})`);
        
        return res.json({
            success: true,
            userId: authData.userId,
            userName: authData.userName,
            userEmail: authData.userEmail,
            tempToken, // Token để extension dùng cho sync requests
            tokenExpiresAt: new Date(tokenExpiresAt).toISOString()
        });
        
    } catch (error) {
        console.error('❌ Validate auth code error:', error);
        return res.status(500).json({
            success: false,
            error: 'Validation failed'
        });
    }
});

/**
 * GET /api/extension/auth-status/:code
 * Web App polling endpoint để check khi extension hoàn tất authentication
 */
router.get('/auth-status/:code', (req, res) => {
    const { code } = req.params;
    const authData = authCodes.get(code);
    
    if (!authData) {
        return res.json({
            completed: false,
            expired: true,
            error: 'Code not found or expired'
        });
    }
    
    return res.json({
        completed: authData.completed,
        expired: Date.now() > authData.expiresAt,
        completedAt: authData.completedAt ? new Date(authData.completedAt).toISOString() : null
    });
});

module.exports = router;
