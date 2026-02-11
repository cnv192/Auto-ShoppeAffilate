// File: backend/check-db.js
require('dotenv').config(); // Đảm bảo load biến môi trường
const mongoose = require('mongoose');
const FacebookOperation = require('./src/models/FacebookOperation');

async function checkOperations() {
    try {
        // Ưu tiên lấy từ .env, nếu không có thì fallback
        const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/shoppe_db';
        
        await mongoose.connect(dbUrl);
        
        console.log('------------------------------------------------');
        console.log('🔍 ĐANG KẾT NỐI ĐẾN DATABASE:', mongoose.connection.name); // <--- QUAN TRỌNG
        console.log('🔌 URL:', dbUrl);
        console.log('------------------------------------------------');

        const count = await FacebookOperation.countDocuments();
        console.log(`📊 Tổng số bản ghi tìm thấy: ${count}`);

        if (count === 0) {
            console.log('❌ DATABASE TRỐNG! Hãy kiểm tra lại Backend Server xem có đang nối vào DB khác không.');
        } else {
            const ops = await FacebookOperation.find({}).sort({ updatedAt: -1 }).limit(5);
            console.log('✅ DANH SÁCH MỚI NHẤT:');
            console.table(ops.map(op => ({
                id: op._id.toString(),
                Name: op.friendlyName,
                DocID: op.docId,
                Time: op.updatedAt ? op.updatedAt.toLocaleString() : 'N/A'
            })));
        }
    } catch (err) {
        console.error('❌ Lỗi kết nối:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkOperations();