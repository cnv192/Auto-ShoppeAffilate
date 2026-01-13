/**
 * IP Filter Middleware
 * 
 * Module lọc traffic dựa trên địa chỉ IP sử dụng IP2Location database.
 * Phân biệt người dùng thực và bot/datacenter traffic để bảo vệ hệ thống.
 * 
 * Yêu cầu:
 * - File database: sample.bin.db11 (IPv4) và sample6.bin.db11 (IPv6)
 * - Đặt tại thư mục gốc backend (cùng cấp với src)
 * 
 * @author Senior Backend Engineer
 * @version 1.0.0
 */

const IP2Location = require('ip2location-nodejs');
const path = require('path');
const fs = require('fs');

// =================================================================
// CONFIGURATION
// =================================================================

/**
 * Đường dẫn đến các file database IP2Location
 * Database được đặt ở thư mục gốc backend (cùng cấp với src)
 */
const DB_PATH_IPV4 = path.join(__dirname, '../../sample.bin.db11');
const DB_PATH_IPV6 = path.join(__dirname, '../../sample6.bin.db11');

/**
 * Danh sách các từ khóa ISP nghi vấn (thường là datacenter/bot)
 * Các ISP này thường được sử dụng bởi bot, scraper, hoặc automated tools
 */
const SUSPICIOUS_ISP_KEYWORDS = [
    'google',
    'amazon',
    'facebook',
    'microsoft',
    'datacenter',
    'hosting',
    'cloud',
    'digitalocean',
    'linode',
    'vultr',
    'ovh',
    'hetzner',
    'alibaba',
    'tencent',
    'oracle',
    'ibm',
    'rackspace',
    'cloudflare',
    'akamai',
    'fastly',
    'leaseweb',
    'server',
    'vps',
    'dedicated',
    'colocation'
];

/**
 * Danh sách quốc gia được phép (whitelist)
 * Chỉ cho phép traffic từ các quốc gia này
 */
const ALLOWED_COUNTRIES = ['VN']; // Chỉ cho phép Việt Nam

/**
 * Cache kết quả tra cứu để tăng tốc độ
 * Key: IP address, Value: { isBot, timestamp }
 */
const ipCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

// =================================================================
// DATABASE INITIALIZATION
// =================================================================

/**
 * IP2Location instances cho IPv4 và IPv6
 * Được khởi tạo một lần khi module load để đảm bảo tốc độ < 1ms
 */
let ip2locationIPv4 = null;
let ip2locationIPv6 = null;
let dbInitialized = false;
let dbError = null;

/**
 * Khởi tạo và load database vào bộ nhớ
 * Được gọi tự động khi module được require
 */
const initializeDatabase = () => {
    console.log('🔄 [IP Filter] Đang khởi tạo IP2Location database...');
    
    try {
        // === KIỂM TRA FILE IPv4 DATABASE ===
        if (!fs.existsSync(DB_PATH_IPV4)) {
            throw new Error(`Không tìm thấy file IPv4 database: ${DB_PATH_IPV4}`);
        }
        
        // === KIỂM TRA FILE IPv6 DATABASE ===
        if (!fs.existsSync(DB_PATH_IPV6)) {
            console.warn(`⚠️  [IP Filter] Không tìm thấy file IPv6 database: ${DB_PATH_IPV6}`);
            console.warn('⚠️  [IP Filter] IPv6 lookup sẽ bị disable');
        }
        
        // === LOAD IPv4 DATABASE ===
        ip2locationIPv4 = new IP2Location.IP2Location();
        ip2locationIPv4.open(DB_PATH_IPV4);
        console.log('✅ [IP Filter] Đã load IPv4 database thành công');
        
        // === LOAD IPv6 DATABASE (nếu có) ===
        if (fs.existsSync(DB_PATH_IPV6)) {
            ip2locationIPv6 = new IP2Location.IP2Location();
            ip2locationIPv6.open(DB_PATH_IPV6);
            console.log('✅ [IP Filter] Đã load IPv6 database thành công');
        }
        
        dbInitialized = true;
        console.log('✅ [IP Filter] Khởi tạo hoàn tất - Sẵn sàng lọc traffic');
        
    } catch (error) {
        dbError = error;
        dbInitialized = false;
        console.error('❌ [IP Filter] Lỗi khởi tạo database:', error.message);
        console.error('❌ [IP Filter] Middleware sẽ cho phép tất cả traffic đi qua (fail-open)');
    }
};

// Tự động khởi tạo khi module được load
initializeDatabase();

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Lấy IP thực của client từ request
 * Xử lý các trường hợp IP đằng sau Proxy, Load Balancer, Cloudflare
 * 
 * Thứ tự ưu tiên:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. X-Real-IP (Nginx)
 * 3. X-Forwarded-For (Proxy chung)
 * 4. req.ip hoặc connection.remoteAddress
 * 
 * @param {Object} req - Express request object
 * @returns {string} - IP address của client
 */
const getClientIP = (req) => {
    // Cloudflare header - ưu tiên cao nhất
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    if (cfConnectingIP) {
        return cfConnectingIP.trim();
    }
    
    // X-Real-IP header (thường dùng với Nginx)
    const xRealIP = req.headers['x-real-ip'];
    if (xRealIP) {
        return xRealIP.trim();
    }
    
    // X-Forwarded-For header (có thể chứa nhiều IP)
    // Format: "client, proxy1, proxy2"
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // Lấy IP đầu tiên (client gốc)
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        // Loại bỏ các IP private/internal
        const publicIP = ips.find(ip => !isPrivateIP(ip));
        return publicIP || ips[0];
    }
    
    // Fallback: IP từ socket connection
    const remoteAddress = req.connection?.remoteAddress 
        || req.socket?.remoteAddress 
        || req.ip 
        || 'unknown';
    
    // Xử lý IPv6 loopback/mapped IPv4
    // ::ffff:192.168.1.1 -> 192.168.1.1
    if (remoteAddress.startsWith('::ffff:')) {
        return remoteAddress.substring(7);
    }
    
    return remoteAddress;
};

/**
 * Kiểm tra IP có phải là private/internal không
 * 
 * @param {string} ip - IP address cần kiểm tra
 * @returns {boolean} - true nếu là private IP
 */
const isPrivateIP = (ip) => {
    // IPv4 private ranges
    const privateRanges = [
        /^10\./,                          // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./,                    // 192.168.0.0/16
        /^127\./,                         // 127.0.0.0/8 (loopback)
        /^169\.254\./,                    // 169.254.0.0/16 (link-local)
        /^0\./                            // 0.0.0.0/8
    ];
    
    // IPv6 private/special addresses
    const ipv6Private = [
        /^::1$/,              // Loopback
        /^fe80:/i,            // Link-local
        /^fc00:/i,            // Unique local
        /^fd00:/i             // Unique local
    ];
    
    // Kiểm tra IPv4
    for (const range of privateRanges) {
        if (range.test(ip)) return true;
    }
    
    // Kiểm tra IPv6
    for (const range of ipv6Private) {
        if (range.test(ip)) return true;
    }
    
    return false;
};

/**
 * Kiểm tra IP là IPv4 hay IPv6
 * 
 * @param {string} ip - IP address
 * @returns {string} - 'ipv4', 'ipv6', hoặc 'unknown'
 */
const getIPVersion = (ip) => {
    // IPv4: x.x.x.x
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        return 'ipv4';
    }
    
    // IPv6: contains colons
    if (ip.includes(':')) {
        return 'ipv6';
    }
    
    return 'unknown';
};

/**
 * Tra cứu thông tin IP từ IP2Location database
 * 
 * @param {string} ip - IP address cần tra cứu
 * @returns {Object} - Thông tin về IP { countryShort, isp, isValid }
 */
const lookupIP = (ip) => {
    const result = {
        countryShort: 'UNKNOWN',
        isp: 'UNKNOWN',
        isValid: false,
        ipVersion: getIPVersion(ip)
    };
    
    try {
        // Chọn database phù hợp với version IP
        let db = null;
        
        if (result.ipVersion === 'ipv4' && ip2locationIPv4) {
            db = ip2locationIPv4;
        } else if (result.ipVersion === 'ipv6' && ip2locationIPv6) {
            db = ip2locationIPv6;
        }
        
        if (!db) {
            console.warn(`⚠️  [IP Filter] Không có database cho ${result.ipVersion}: ${ip}`);
            return result;
        }
        
        // Thực hiện tra cứu
        const data = db.getAll(ip);
        
        if (data && data.countryShort && data.countryShort !== '-') {
            result.countryShort = data.countryShort;
            result.isp = data.isp || 'UNKNOWN';
            result.isValid = true;
            
            // Thêm thông tin bổ sung nếu có
            result.region = data.region || '';
            result.city = data.city || '';
        }
        
    } catch (error) {
        console.error(`❌ [IP Filter] Lỗi tra cứu IP ${ip}:`, error.message);
    }
    
    return result;
};

/**
 * Kiểm tra ISP có thuộc danh sách nghi vấn không
 * 
 * @param {string} isp - Tên ISP
 * @returns {boolean} - true nếu nghi vấn
 */
const isSuspiciousISP = (isp) => {
    if (!isp || isp === 'UNKNOWN') return false;
    
    const lowerISP = isp.toLowerCase();
    
    return SUSPICIOUS_ISP_KEYWORDS.some(keyword => 
        lowerISP.includes(keyword.toLowerCase())
    );
};

/**
 * Kiểm tra quốc gia có được phép không
 * 
 * @param {string} countryShort - Mã quốc gia (2 ký tự)
 * @returns {boolean} - true nếu được phép
 */
const isAllowedCountry = (countryShort) => {
    if (!countryShort || countryShort === 'UNKNOWN') return false;
    
    return ALLOWED_COUNTRIES.includes(countryShort.toUpperCase());
};

/**
 * Phân tích và đánh giá IP có phải bot không
 * 
 * @param {string} ip - IP address
 * @returns {Object} - Kết quả phân tích { isBot, reason, details }
 */
const analyzeIP = (ip) => {
    // Kiểm tra cache trước
    const cached = ipCache.get(ip);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.result;
    }
    
    // Mặc định: cho phép (fail-open cho private IP)
    const result = {
        isBot: false,
        reason: null,
        details: {
            ip,
            countryShort: 'UNKNOWN',
            isp: 'UNKNOWN',
            ipVersion: getIPVersion(ip)
        }
    };
    
    // Private IP -> Cho phép (development/internal)
    if (isPrivateIP(ip)) {
        result.reason = 'private_ip';
        result.details.note = 'Private/Internal IP - Allowed';
        return result;
    }
    
    // Database chưa sẵn sàng -> Cho phép (fail-open)
    if (!dbInitialized) {
        result.reason = 'db_not_ready';
        result.details.note = 'Database not initialized - Fail-open policy';
        return result;
    }
    
    // Tra cứu IP từ database
    const ipInfo = lookupIP(ip);
    result.details.countryShort = ipInfo.countryShort;
    result.details.isp = ipInfo.isp;
    result.details.region = ipInfo.region;
    result.details.city = ipInfo.city;
    
    // === LOGIC PHÂN LOẠI BOT ===
    
    // Kiểm tra 1: Quốc gia không được phép
    if (!isAllowedCountry(ipInfo.countryShort)) {
        result.isBot = true;
        result.reason = 'country_not_allowed';
        result.details.note = `Country ${ipInfo.countryShort} not in whitelist`;
    }
    
    // Kiểm tra 2: ISP nghi vấn (datacenter/cloud)
    if (isSuspiciousISP(ipInfo.isp)) {
        result.isBot = true;
        result.reason = 'suspicious_isp';
        result.details.note = `ISP "${ipInfo.isp}" matches suspicious patterns`;
    }
    
    // Lưu vào cache
    ipCache.set(ip, {
        result,
        timestamp: Date.now()
    });
    
    return result;
};

// =================================================================
// HTML TEMPLATES
// =================================================================

/**
 * Template HTML cho trang tin tức giả (hiển thị cho bot)
 * Được thiết kế để trông như một trang tin tức bình thường
 */
const getFakeNewsPage = () => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Tin tức mới nhất - Cập nhật 24/7</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { font-size: 14px; opacity: 0.8; }
        .container {
            max-width: 800px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .article {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }
        .article h2 {
            color: #1a1a2e;
            margin-bottom: 15px;
            font-size: 22px;
        }
        .article .meta {
            color: #666;
            font-size: 13px;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        .article p {
            color: #444;
            margin-bottom: 15px;
            text-align: justify;
        }
        .sidebar {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }
        .sidebar h3 {
            color: #1a1a2e;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .sidebar ul { list-style: none; }
        .sidebar li {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        .sidebar li:last-child { border-bottom: none; }
        .footer {
            text-align: center;
            padding: 30px;
            color: #999;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>📰 Tin Tức Online</h1>
        <p>Cập nhật tin tức mới nhất 24/7</p>
    </header>
    
    <div class="container">
        <article class="article">
            <h2>Xu hướng công nghệ năm 2026: AI và Blockchain tiếp tục dẫn đầu</h2>
            <div class="meta">
                <span>📅 ${new Date().toLocaleDateString('vi-VN')}</span> | 
                <span>👤 Ban biên tập</span> | 
                <span>🏷️ Công nghệ</span>
            </div>
            <p>Trong năm 2026, các chuyên gia dự đoán rằng trí tuệ nhân tạo (AI) và công nghệ blockchain sẽ tiếp tục là những xu hướng chủ đạo trong ngành công nghệ. Các doanh nghiệp đang đẩy mạnh việc ứng dụng AI vào các hoạt động kinh doanh...</p>
            <p>Theo báo cáo mới nhất từ các tổ chức nghiên cứu hàng đầu, thị trường AI toàn cầu được dự báo sẽ đạt giá trị hàng nghìn tỷ USD trong những năm tới. Việt Nam cũng không nằm ngoài xu hướng này khi nhiều startup công nghệ trong nước đang tích cực phát triển các giải pháp AI...</p>
        </article>
        
        <div class="sidebar">
            <h3>📌 Tin nổi bật</h3>
            <ul>
                <li>🔹 Thị trường chứng khoán tăng điểm nhẹ</li>
                <li>🔹 Thời tiết cuối tuần: Nắng đẹp</li>
                <li>🔹 Giải bóng đá quốc gia vào vòng chung kết</li>
                <li>🔹 Du lịch nội địa phục hồi mạnh mẽ</li>
                <li>🔹 Giá vàng biến động theo thị trường thế giới</li>
            </ul>
        </div>
    </div>
    
    <footer class="footer">
        <p>© 2026 Tin Tức Online. Mọi quyền được bảo lưu.</p>
    </footer>
</body>
</html>
`;

/**
 * Template HTML cho trang bảo trì
 */
const getMaintenancePage = () => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Bảo trì hệ thống</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px 20px;
            max-width: 500px;
        }
        .icon {
            font-size: 80px;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 28px;
            margin-bottom: 15px;
        }
        p {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 30px;
        }
        .progress {
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            height: 8px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        .progress-bar {
            background: white;
            height: 100%;
            width: 60%;
            border-radius: 20px;
            animation: progress 2s ease-in-out infinite;
        }
        @keyframes progress {
            0%, 100% { width: 30%; }
            50% { width: 70%; }
        }
        .info {
            font-size: 13px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔧</div>
        <h1>Đang bảo trì hệ thống</h1>
        <p>Chúng tôi đang nâng cấp hệ thống để mang đến trải nghiệm tốt hơn. Vui lòng quay lại sau.</p>
        <div class="progress">
            <div class="progress-bar"></div>
        </div>
        <p class="info">Dự kiến hoàn thành: ${new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString('vi-VN')}</p>
    </div>
</body>
</html>
`;

// =================================================================
// MIDDLEWARE
// =================================================================

/**
 * IP Filter Middleware
 * 
 * Kiểm tra và lọc traffic dựa trên địa chỉ IP.
 * - Bot/Datacenter traffic -> Hiển thị trang giả
 * - Người dùng thực -> Cho phép truy cập
 * 
 * @param {Object} options - Cấu hình middleware
 * @param {boolean} options.enabled - Bật/tắt filter (mặc định: true)
 * @param {boolean} options.logAll - Log tất cả requests (mặc định: false)
 * @param {string} options.pageType - Loại trang hiển thị cho bot: 'news' | 'maintenance'
 */
const ipFilterMiddleware = (options = {}) => {
    const {
        enabled = true,
        logAll = false,
        pageType = 'news' // 'news' hoặc 'maintenance'
    } = options;
    
    return (req, res, next) => {
        // Nếu middleware bị disable -> cho qua
        if (!enabled) {
            return next();
        }
        
        // Lấy IP thực của client
        const clientIP = getClientIP(req);
        
        // Bỏ qua các static assets để tăng performance
        const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2'];
        if (staticExtensions.some(ext => req.path.endsWith(ext))) {
            return next();
        }
        
        // Bỏ qua health check endpoint
        if (req.path === '/health' || req.path === '/api/health') {
            return next();
        }
        
        // Phân tích IP
        const analysis = analyzeIP(clientIP);
        
        // Log nếu được bật hoặc là bot
        if (logAll || analysis.isBot) {
            console.log(`🔍 [IP Filter] ${clientIP} | Bot: ${analysis.isBot} | Reason: ${analysis.reason || 'allowed'} | Country: ${analysis.details.countryShort} | ISP: ${analysis.details.isp}`);
        }
        
        // Gắn thông tin IP vào request để sử dụng sau
        req.ipAnalysis = analysis;
        req.clientIP = clientIP;
        
        // === XỬ LÝ KẾT QUẢ ===
        
        if (analysis.isBot) {
            // Bot detected -> Trả về trang giả
            console.log(`🚫 [IP Filter] Blocked: ${clientIP} (${analysis.reason})`);
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('X-Robots-Tag', 'noindex, nofollow');
            
            // Chọn loại trang để hiển thị
            const htmlContent = pageType === 'maintenance' 
                ? getMaintenancePage() 
                : getFakeNewsPage();
            
            return res.status(200).send(htmlContent);
        }
        
        // Người dùng thực -> Cho phép tiếp tục
        next();
    };
};

// =================================================================
// UTILITY EXPORTS
// =================================================================

/**
 * Xóa cache IP (dùng khi cần refresh)
 */
const clearIPCache = () => {
    ipCache.clear();
    console.log('🗑️  [IP Filter] Cache cleared');
};

/**
 * Lấy thống kê cache
 */
const getCacheStats = () => {
    return {
        size: ipCache.size,
        ttl: CACHE_TTL
    };
};

/**
 * Kiểm tra trạng thái database
 */
const getDatabaseStatus = () => {
    return {
        initialized: dbInitialized,
        error: dbError ? dbError.message : null,
        ipv4Available: !!ip2locationIPv4,
        ipv6Available: !!ip2locationIPv6
    };
};

/**
 * Tra cứu IP thủ công (dùng cho testing/debugging)
 */
const manualLookup = (ip) => {
    return analyzeIP(ip);
};

// =================================================================
// MODULE EXPORTS
// =================================================================

module.exports = {
    // Main middleware
    ipFilterMiddleware,
    
    // Helper functions
    getClientIP,
    analyzeIP,
    lookupIP,
    
    // Utilities
    clearIPCache,
    getCacheStats,
    getDatabaseStatus,
    manualLookup,
    
    // Constants
    SUSPICIOUS_ISP_KEYWORDS,
    ALLOWED_COUNTRIES
};
