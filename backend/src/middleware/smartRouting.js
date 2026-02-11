/**
 * Smart Routing Middleware - Phân Luồng Thông Minh
 * 
 * Middleware này kiểm tra User-Agent và IP để phân biệt:
 * 1. Bot Preview (Facebook, Twitter, Zalo, Google) → Trả về trang HTML tĩnh với Open Graph meta
 * 2. Bot/Datacenter (từ IP2Location) → Không tăng click
 * 3. Người dùng thực từ VN → Tăng click trong MongoDB
 * 
 * Tích hợp:
 * - IP2Location: Kiểm tra IP từ sample.bin.db11
 * - MongoDB: Lưu trữ và tracking clicks
 * - In-memory Map: Rate limiting
 */

const { analyzeIP, getClientIP: getIPFromFilter } = require('./ipFilter');

// Danh sách các User-Agent của bot preview các nền tảng mạng xã hội
const PREVIEW_BOTS = [
    // Facebook
    'facebookexternalhit',
    'facebookcatalog',
    'facebot',
    
    // Twitter
    'twitterbot',
    
    // Zalo
    'zalo',
    
    // Google
    'googlebot',
    'google-structured-data-testing-tool',
    'mediapartners-google',
    
    // LinkedIn
    'linkedinbot',
    
    // Telegram
    'telegrambot',
    
    // Discord
    'discordbot',
    
    // Slack
    'slackbot',
    
    // WhatsApp
    'whatsapp',
    
    // Pinterest
    'pinterest',
    
    // Skype
    'skypeuripreview',
    
    // Line
    'line-poker'
];

/**
 * Kiểm tra User-Agent có phải là bot preview không
 * @param {string} userAgent - User-Agent header từ request
 * @returns {boolean} - true nếu là bot preview
 */
const isPreviewBot = (userAgent) => {
    if (!userAgent) return false;
    
    const lowerUA = userAgent.toLowerCase();
    return PREVIEW_BOTS.some(bot => lowerUA.includes(bot));
};

/**
 * Lấy IP thực của người dùng (xử lý proxy/cloudflare)
 * Sử dụng hàm từ ipFilter để đảm bảo nhất quán
 * @param {object} req - Express request object
 * @returns {string} - IP address
 */
const getClientIP = (req) => {
    return getIPFromFilter(req);
};

/**
 * Xác định loại thiết bị từ User-Agent
 * @param {string} userAgent - User-Agent string
 * @returns {string} - 'mobile', 'tablet', 'desktop', 'unknown'
 */
const getDeviceType = (userAgent) => {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
        return 'mobile';
    }
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        return 'tablet';
    }
    if (/mozilla|chrome|safari|firefox|edge|opera/i.test(ua)) {
        return 'desktop';
    }
    return 'unknown';
};

/**
 * Rate limiting đơn giản bằng in-memory Map
 * Không cần Redis - phù hợp cho single-instance deployment
 */
const rateLimitMap = new Map();

// Dọn dẹp rateLimitMap mỗi 5 phút
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.startTime > 60000) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Kiểm tra rate limiting (chống spam click) - In-memory
 * @param {string} ip - IP của người dùng
 * @param {string} slug - Slug của link
 * @returns {boolean} - true nếu vượt quá giới hạn
 */
const isRateLimited = async (ip, slug) => {
    try {
        const key = `${ip}:${slug}`;
        const now = Date.now();
        const data = rateLimitMap.get(key);
        
        if (!data || now - data.startTime > 60000) {
            // Tạo mới hoặc reset sau 1 phút
            rateLimitMap.set(key, { count: 1, startTime: now });
            return false;
        }
        
        data.count++;
        // Giới hạn 10 request/phút cho mỗi IP trên mỗi link
        return data.count > 10;
        
    } catch (error) {
        console.error('Error checking rate limit:', error);
        return false;
    }
};

/**
 * Main Middleware: Smart Routing với IP Checking
 * 
 * Flow:
 * 1. Lấy IP thực từ request
 * 2. Kiểm tra User-Agent có phải bot preview không
 * 3. Nếu là người dùng:
 *    - Kiểm tra IP qua IP2Location (sample.bin.db11)
 *    - Xác định click có hợp lệ không (VN + không phải datacenter)
 *    - Gắn thông tin vào request để route xử lý lưu MongoDB
 */
const smartRoutingMiddleware = async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    const slug = req.params.slug;
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    
    // Ghi log để debug
    console.log(`📍 Request: /${slug} | IP: ${clientIP} | UA: ${userAgent.substring(0, 50)}...`);
    
    // === BƯỚC 1: Kiểm tra Bot Preview ===
    if (isPreviewBot(userAgent)) {
        console.log(`🤖 Bot preview detected: ${userAgent.substring(0, 30)}...`);
        
        req.isPreviewBot = true;
        req.botType = PREVIEW_BOTS.find(bot => userAgent.toLowerCase().includes(bot)) || 'unknown';
        req.clientIP = clientIP;
        
        return next();
    }
    
    // === BƯỚC 2: Rate Limiting ===
    const rateLimited = await isRateLimited(clientIP, slug);
    if (rateLimited) {
        console.log(`⚠️ Rate limited: ${clientIP}`);
        return res.status(429).json({ 
            error: 'Too many requests', 
            message: 'Vui lòng thử lại sau 1 phút' 
        });
    }
    
    // === BƯỚC 3: Kiểm tra IP qua IP2Location (sample.bin.db11) ===
    const ipAnalysis = analyzeIP(clientIP);
    
    // Click hợp lệ = Từ VN + Không phải datacenter/bot
    const isValidClick = !ipAnalysis.isBot;
    
    // Log kết quả
    const logIcon = isValidClick ? '✅' : '⚠️';
    console.log(`${logIcon} IP Check: ${clientIP} | Valid: ${isValidClick} | Country: ${ipAnalysis.details.countryShort} | ISP: ${ipAnalysis.details.isp}`);
    
    // === BƯỚC 4: Gắn thông tin vào request ===
    req.isPreviewBot = false;
    req.clientIP = clientIP;
    req.userAgent = userAgent;
    req.referer = referer;
    req.deviceType = getDeviceType(userAgent);
    
    // Thông tin IP analysis cho route lưu MongoDB
    req.ipAnalysis = ipAnalysis;
    req.isValidClick = isValidClick;
    req.ipInfo = {
        countryShort: ipAnalysis.details.countryShort,
        isp: ipAnalysis.details.isp,
        region: ipAnalysis.details.region || '',
        city: ipAnalysis.details.city || ''
    };
    
    next();
};

module.exports = {
    smartRoutingMiddleware,
    isPreviewBot,
    getClientIP,
    getDeviceType,
    isRateLimited,
    PREVIEW_BOTS
};
