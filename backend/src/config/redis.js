/**
 * Redis Configuration
 * 
 * Redis là một in-memory data store được sử dụng để:
 * 1. Cache dữ liệu link để giảm tải database
 * 2. Theo dõi tần suất truy cập (Rate limiting)
 * 3. Đếm số click realtime
 * 
 * Cấu hình Redis:
 * - Cài đặt Redis: sudo apt install redis-server (Ubuntu) hoặc brew install redis (macOS)
 * - Khởi động: redis-server
 * - Kiểm tra: redis-cli ping (trả về PONG là thành công)
 */

const { createClient } = require('redis');

// Tạo Redis client với cấu hình từ environment variables
const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined
});

// Xử lý lỗi kết nối
redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

// Thông báo khi kết nối thành công
redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

// Kết nối Redis
const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        // Fallback: Tiếp tục chạy mà không có Redis (giảm tính năng)
        console.warn('⚠️  Running without Redis - some features will be limited');
    }
};

// Lấy trạng thái Redis
const getRedisStatus = () => {
    if (!redisClient) return 'not-initialized';
    if (redisClient.isOpen) return 'connected';
    if (redisClient.isReady) return 'ready';
    return 'disconnected';
};

module.exports = { redisClient, connectRedis, getRedisStatus };
