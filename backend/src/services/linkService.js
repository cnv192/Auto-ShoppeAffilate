/**
 * Link Service
 * 
 * Service quản lý các link rút gọn:
 * - Tạo link mới
 * - Lấy thông tin link
 * - Cập nhật/Xóa link
 * - Thống kê click
 */

const { redisClient } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

// Trong production, bạn nên dùng database như MongoDB hoặc PostgreSQL
// Đây là in-memory storage cho demo
let linksStorage = new Map();

/**
 * Tạo slug ngẫu nhiên
 * @param {number} length - Độ dài slug
 * @returns {string} - Slug ngẫu nhiên
 */
const generateSlug = (length = 6) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let slug = '';
    for (let i = 0; i < length; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
};

/**
 * Tạo link mới
 * @param {object} linkData - Dữ liệu link
 * @returns {object} - Link đã tạo
 */
const createLink = async (linkData) => {
    const { title, targetUrl, imageUrl, customSlug } = linkData;
    
    // Sử dụng custom slug hoặc tạo mới
    let slug = customSlug || generateSlug();
    
    // Kiểm tra slug đã tồn tại chưa
    while (linksStorage.has(slug)) {
        slug = generateSlug();
    }
    
    const link = {
        id: uuidv4(),
        slug,
        title: title || 'Shopee Deal',
        targetUrl,
        imageUrl: imageUrl || 'https://cf.shopee.vn/file/default_image',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clicks: 0,
        isActive: true
    };
    
    // Lưu vào storage
    linksStorage.set(slug, link);
    
    // Lưu vào Redis để truy xuất nhanh
    if (redisClient.isReady) {
        await redisClient.set(`link:${slug}`, JSON.stringify(link));
    }
    
    console.log(`✅ Created link: /${slug} → ${targetUrl}`);
    return link;
};

/**
 * Lấy thông tin link theo slug
 * @param {string} slug - Slug của link
 * @returns {object|null} - Thông tin link hoặc null nếu không tìm thấy
 */
const getLinkBySlug = async (slug) => {
    // Thử lấy từ Redis trước
    if (redisClient.isReady) {
        const cached = await redisClient.get(`link:${slug}`);
        if (cached) {
            const link = JSON.parse(cached);
            // Cập nhật click count từ Redis
            const clicks = await redisClient.get(`clicks:${slug}`);
            link.clicks = parseInt(clicks) || link.clicks;
            return link;
        }
    }
    
    // Fallback to in-memory storage
    const link = linksStorage.get(slug);
    if (link) {
        // Cập nhật click từ Redis nếu có
        if (redisClient.isReady) {
            const clicks = await redisClient.get(`clicks:${slug}`);
            link.clicks = parseInt(clicks) || link.clicks;
        }
    }
    return link || null;
};

/**
 * Lấy tất cả links
 * @returns {array} - Danh sách tất cả links
 */
const getAllLinks = async () => {
    const links = Array.from(linksStorage.values());
    
    // Cập nhật click count từ Redis cho mỗi link
    if (redisClient.isReady) {
        for (const link of links) {
            const clicks = await redisClient.get(`clicks:${link.slug}`);
            link.clicks = parseInt(clicks) || link.clicks;
        }
    }
    
    // Sắp xếp theo ngày tạo mới nhất
    return links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Cập nhật link
 * @param {string} slug - Slug của link
 * @param {object} updateData - Dữ liệu cập nhật
 * @returns {object|null} - Link đã cập nhật hoặc null
 */
const updateLink = async (slug, updateData) => {
    const link = linksStorage.get(slug);
    if (!link) return null;
    
    const updatedLink = {
        ...link,
        ...updateData,
        slug: link.slug, // Không cho phép đổi slug
        id: link.id,     // Không cho phép đổi id
        updatedAt: new Date().toISOString()
    };
    
    linksStorage.set(slug, updatedLink);
    
    // Cập nhật Redis
    if (redisClient.isReady) {
        await redisClient.set(`link:${slug}`, JSON.stringify(updatedLink));
    }
    
    return updatedLink;
};

/**
 * Xóa link
 * @param {string} slug - Slug của link
 * @returns {boolean} - true nếu xóa thành công
 */
const deleteLink = async (slug) => {
    const existed = linksStorage.has(slug);
    if (!existed) return false;
    
    linksStorage.delete(slug);
    
    // Xóa khỏi Redis
    if (redisClient.isReady) {
        await redisClient.del(`link:${slug}`);
    }
    
    return true;
};

/**
 * Lấy thống kê link
 * @param {string} slug - Slug của link
 * @returns {object} - Thống kê
 */
const getLinkStats = async (slug) => {
    const link = await getLinkBySlug(slug);
    if (!link) return null;
    
    const stats = {
        link,
        totalClicks: link.clicks,
        dailyStats: {}
    };
    
    // Lấy thống kê 7 ngày gần nhất từ Redis
    if (redisClient.isReady) {
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dailyClicks = await redisClient.get(`clicks:${slug}:${dateStr}`);
            stats.dailyStats[dateStr] = parseInt(dailyClicks) || 0;
        }
    }
    
    return stats;
};

/**
 * Tạo dữ liệu mẫu
 */
const createSampleData = async () => {
    const sampleLinks = [
        {
            title: '🔥 Flash Sale Shopee - Giảm 50%',
            targetUrl: 'https://shopee.vn/flash_sale',
            imageUrl: 'https://cf.shopee.vn/file/sg-11134201-22100-iyh1lt8u7divda',
            customSlug: 'flash50'
        },
        {
            title: '📱 iPhone 15 Pro Max - Giá Sốc',
            targetUrl: 'https://shopee.vn/product/iphone-15-pro-max',
            imageUrl: 'https://cf.shopee.vn/file/sg-11134201-22110-ukv7h7rybvjv1e',
            customSlug: 'iphone15'
        },
        {
            title: '👕 Thời Trang Nam Giảm 70%',
            targetUrl: 'https://shopee.vn/fashion-men',
            imageUrl: 'https://cf.shopee.vn/file/sg-11134201-22100-h5xv0kbz7div88',
            customSlug: 'fashion70'
        }
    ];
    
    for (const linkData of sampleLinks) {
        await createLink(linkData);
    }
    
    console.log('📦 Sample data created');
};

module.exports = {
    createLink,
    getLinkBySlug,
    getAllLinks,
    updateLink,
    deleteLink,
    getLinkStats,
    generateSlug,
    createSampleData
};
