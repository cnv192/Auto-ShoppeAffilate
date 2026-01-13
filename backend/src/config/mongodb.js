/**
 * MongoDB Configuration
 * 
 * Cấu hình kết nối MongoDB Atlas
 * Database được host tại Region Hong Kong để tối ưu latency cho Việt Nam
 */

const mongoose = require('mongoose');

// Biến lưu trạng thái kết nối
let isConnected = false;

/**
 * Kết nối đến MongoDB Atlas
 * Sử dụng connection pooling để tối ưu hiệu suất
 */
const connectMongoDB = async () => {
    // Nếu đã kết nối rồi thì không kết nối lại
    if (isConnected) {
        console.log('📦 [MongoDB] Đã kết nối sẵn');
        return;
    }

    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        console.error('❌ [MongoDB] MONGODB_URI không được cấu hình trong .env');
        throw new Error('MONGODB_URI is not defined');
    }

    try {
        console.log('🔄 [MongoDB] Đang kết nối đến MongoDB Atlas...');

        // Cấu hình kết nối
        const options = {
            // Connection Pool - tối ưu cho production
            maxPoolSize: 10,           // Số connection tối đa trong pool
            minPoolSize: 2,            // Số connection tối thiểu giữ sẵn
            
            // Timeouts
            serverSelectionTimeoutMS: 5000,  // Timeout chọn server
            socketTimeoutMS: 45000,          // Timeout socket
            
            // Heartbeat
            heartbeatFrequencyMS: 10000,     // Kiểm tra server health mỗi 10s
            
            // Buffer
            bufferCommands: false,           // Không buffer khi disconnect
        };

        await mongoose.connect(mongoURI, options);
        
        isConnected = true;
        console.log('✅ [MongoDB] Kết nối thành công đến MongoDB Atlas');
        console.log(`📍 [MongoDB] Database: ${mongoose.connection.name}`);
        console.log(`📍 [MongoDB] Host: ${mongoose.connection.host}`);

    } catch (error) {
        isConnected = false;
        console.error('❌ [MongoDB] Lỗi kết nối:', error.message);
        throw error;
    }
};

/**
 * Ngắt kết nối MongoDB
 * Dùng khi shutdown server
 */
const disconnectMongoDB = async () => {
    if (!isConnected) return;

    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('👋 [MongoDB] Đã ngắt kết nối');
    } catch (error) {
        console.error('❌ [MongoDB] Lỗi khi ngắt kết nối:', error.message);
    }
};

/**
 * Kiểm tra trạng thái kết nối
 */
const getConnectionStatus = () => {
    return {
        isConnected,
        readyState: mongoose.connection.readyState,
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        status: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
    };
};

// Xử lý events
mongoose.connection.on('connected', () => {
    console.log('📗 [MongoDB] Connection established');
});

mongoose.connection.on('error', (err) => {
    console.error('📕 [MongoDB] Connection error:', err.message);
    isConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('📙 [MongoDB] Connection disconnected');
    isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await disconnectMongoDB();
    process.exit(0);
});

module.exports = {
    connectMongoDB,
    disconnectMongoDB,
    getConnectionStatus,
    mongoose
};
