/**
 * Smart Routing Middleware - Phân Luồng Thông Minh
 * 
 * Middleware này kiểm tra User-Agent để phân biệt:
 * 1. Bot Preview (Facebook, Twitter, Zalo, Google) → Trả về trang HTML tĩnh với Open Graph meta
 * 2. Người dùng thực → Lưu IP tracking và chuyển tiếp request
 * 
 * Mục đích:
 * - Tối ưu băng thông: Bot chỉ nhận HTML nhẹ với meta tags
 * - Theo dõi analytics: Đếm click từ người dùng thực
 */

const { redisClient } = require('../config/redis');

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
 * Lấy IP thực của người dùng (xử lý trường hợp có proxy/load balancer)
 * @param {object} req - Express request object
 * @returns {string} - IP address
 */
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() 
        || req.headers['x-real-ip'] 
        || req.connection?.remoteAddress 
        || req.ip 
        || 'unknown';
};

/**
 * Lưu thông tin truy cập vào Redis
 * @param {string} ip - IP của người dùng
 * @param {string} slug - Slug của link được truy cập
 */
const trackVisit = async (ip, slug) => {
    try {
        if (!redisClient.isReady) return;
        
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Lưu IP với timestamp vào sorted set (để tracking tần suất)
        // Key: visits:{slug}:{date}
        // Score: timestamp
        // Value: ip
        await redisClient.zAdd(`visits:${slug}:${today}`, {
            score: now,
            value: `${ip}:${now}`
        });
        
        // Tăng counter cho slug
        await redisClient.incr(`clicks:${slug}`);
        
        // Tăng counter tổng theo ngày
        await redisClient.incr(`clicks:${slug}:${today}`);
        
        // Set TTL 30 ngày cho dữ liệu tracking
        await redisClient.expire(`visits:${slug}:${today}`, 30 * 24 * 60 * 60);
        await redisClient.expire(`clicks:${slug}:${today}`, 30 * 24 * 60 * 60);
        
    } catch (error) {
        console.error('Error tracking visit:', error);
    }
};

/**
 * Lấy số click của một link
 * @param {string} slug - Slug của link
 * @returns {number} - Số click
 */
const getClickCount = async (slug) => {
    try {
        if (!redisClient.isReady) return 0;
        const count = await redisClient.get(`clicks:${slug}`);
        return parseInt(count) || 0;
    } catch (error) {
        console.error('Error getting click count:', error);
        return 0;
    }
};

/**
 * Kiểm tra rate limiting (chống spam click)
 * @param {string} ip - IP của người dùng
 * @param {string} slug - Slug của link
 * @returns {boolean} - true nếu vượt quá giới hạn
 */
const isRateLimited = async (ip, slug) => {
    try {
        if (!redisClient.isReady) return false;
        
        const key = `ratelimit:${ip}:${slug}`;
        const count = await redisClient.incr(key);
        
        if (count === 1) {
            // Set TTL 1 phút cho lần đầu
            await redisClient.expire(key, 60);
        }
        
        // Giới hạn 10 request/phút cho mỗi IP trên mỗi link
        return count > 10;
        
    } catch (error) {
        console.error('Error checking rate limit:', error);
        return false;
    }
};

/**
 * Main Middleware: Smart Routing
 * Phân biệt bot preview và người dùng thực để xử lý phù hợp
 */
const smartRoutingMiddleware = async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    const slug = req.params.slug;
    
    // Ghi log để debug
    console.log(`📍 Request: /${slug} | IP: ${clientIP} | UA: ${userAgent.substring(0, 50)}...`);
    
    // Kiểm tra nếu là bot preview
    if (isPreviewBot(userAgent)) {
        console.log(`🤖 Bot detected: ${userAgent.substring(0, 30)}...`);
        
        // Đánh dấu là bot để xử lý ở route
        req.isPreviewBot = true;
        req.botType = PREVIEW_BOTS.find(bot => userAgent.toLowerCase().includes(bot)) || 'unknown';
        
        return next();
    }
    
    // Người dùng thực - kiểm tra rate limiting
    const rateLimited = await isRateLimited(clientIP, slug);
    if (rateLimited) {
        console.log(`⚠️ Rate limited: ${clientIP}`);
        return res.status(429).json({ 
            error: 'Too many requests', 
            message: 'Vui lòng thử lại sau 1 phút' 
        });
    }
    
    // Lưu tracking visit
    await trackVisit(clientIP, slug);
    
    // Đánh dấu là người dùng thực
    req.isPreviewBot = false;
    req.clientIP = clientIP;
    
    next();
};

module.exports = {
    smartRoutingMiddleware,
    isPreviewBot,
    getClientIP,
    trackVisit,
    getClickCount,
    isRateLimited
};
