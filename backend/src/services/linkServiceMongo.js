/**
 * Link Service với MongoDB
 * 
 * Service quản lý các link với MongoDB Atlas
 * Tích hợp IP checking từ IP2Location
 */

const Link = require('../models/Link');
const { analyzeIP } = require('../middleware/ipFilter');

/**
 * Tạo link mới
 * @param {Object} linkData - Dữ liệu link
 * @returns {Object} - Link đã tạo
 */
const createLink = async (linkData) => {
    const { title, targetUrl, imageUrl, customSlug, description } = linkData;
    
    try {
        const link = await Link.createWithAutoSlug({
            slug: customSlug,
            title: title || 'Shopee Deal',
            targetUrl,
            imageUrl: imageUrl || 'https://cf.shopee.vn/file/default_image',
            description
        });
        
        console.log(`✅ [LinkService] Tạo link: /${link.slug} → ${targetUrl}`);
        return link;
    } catch (error) {
        console.error('❌ [LinkService] Lỗi tạo link:', error.message);
        throw error;
    }
};

/**
 * Lấy link theo slug
 * @param {string} slug - Slug của link
 * @returns {Object|null} - Link hoặc null
 */
const getLinkBySlug = async (slug) => {
    try {
        const link = await Link.findBySlug(slug);
        return link;
    } catch (error) {
        console.error('❌ [LinkService] Lỗi lấy link:', error.message);
        throw error;
    }
};

/**
 * Lấy tất cả links
 * @param {Object} options - Tùy chọn query
 * @returns {Array} - Danh sách links
 */
const getAllLinks = async (options = {}) => {
    const { page = 1, limit = 50, sort = '-createdAt' } = options;
    
    try {
        const links = await Link.find({ isActive: true })
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .select('-clickLogs -clickedIPs'); // Không trả về data nặng
        
        return links;
    } catch (error) {
        console.error('❌ [LinkService] Lỗi lấy danh sách:', error.message);
        throw error;
    }
};

/**
 * Cập nhật link
 * @param {string} slug - Slug của link
 * @param {Object} updateData - Dữ liệu cập nhật
 * @returns {Object|null} - Link đã cập nhật
 */
const updateLink = async (slug, updateData) => {
    try {
        const link = await Link.findOneAndUpdate(
            { slug: slug.toLowerCase() },
            { $set: updateData },
            { new: true, runValidators: true }
        );
        
        if (link) {
            console.log(`✅ [LinkService] Cập nhật link: /${slug}`);
        }
        return link;
    } catch (error) {
        console.error('❌ [LinkService] Lỗi cập nhật:', error.message);
        throw error;
    }
};

/**
 * Xóa link (soft delete)
 * @param {string} slug - Slug của link
 * @returns {boolean} - Kết quả xóa
 */
const deleteLink = async (slug) => {
    try {
        const result = await Link.findOneAndUpdate(
            { slug: slug.toLowerCase() },
            { $set: { isActive: false } }
        );
        
        if (result) {
            console.log(`✅ [LinkService] Xóa link: /${slug}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ [LinkService] Lỗi xóa:', error.message);
        throw error;
    }
};

/**
 * Ghi nhận click với IP checking
 * 
 * Flow:
 * 1. Kiểm tra IP qua IP2Location (sample.bin.db11)
 * 2. Xác định click có hợp lệ không (VN + không phải datacenter)
 * 3. Lưu vào MongoDB với thông tin chi tiết
 * 
 * @param {string} slug - Slug của link
 * @param {Object} clickInfo - Thông tin click
 * @returns {Object} - Kết quả ghi nhận
 */
const recordClick = async (slug, clickInfo) => {
    const { ip, userAgent, referer, device } = clickInfo;
    
    try {
        // Bước 1: Tìm link
        const link = await Link.findOne({ slug: slug.toLowerCase(), isActive: true });
        if (!link) {
            return { success: false, error: 'Link không tồn tại' };
        }
        
        // Bước 2: Kiểm tra IP qua IP2Location
        const ipAnalysis = analyzeIP(ip);
        
        // Bước 3: Xác định click có hợp lệ không
        // Click hợp lệ = Từ VN + Không phải datacenter/bot
        const isValidClick = !ipAnalysis.isBot;
        
        // Bước 4: Ghi nhận click vào MongoDB
        const result = await link.recordClick({
            ip,
            ipInfo: {
                countryShort: ipAnalysis.details.countryShort,
                isp: ipAnalysis.details.isp,
                region: ipAnalysis.details.region || '',
                city: ipAnalysis.details.city || ''
            },
            userAgent,
            referer,
            device,
            isValid: isValidClick,
            invalidReason: isValidClick ? null : ipAnalysis.reason
        });
        
        // Log kết quả
        const logIcon = isValidClick ? '✅' : '⚠️';
        console.log(`${logIcon} [Click] /${slug} | IP: ${ip} | Valid: ${isValidClick} | Country: ${ipAnalysis.details.countryShort} | ISP: ${ipAnalysis.details.isp}`);
        
        return {
            success: true,
            isValidClick,
            totalClicks: result.totalClicks,
            validClicks: result.validClicks,
            isNewIP: result.isNewIP,
            ipInfo: ipAnalysis.details
        };
        
    } catch (error) {
        console.error('❌ [LinkService] Lỗi ghi click:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Lấy thống kê link
 * @param {string} slug - Slug của link
 * @returns {Object} - Thống kê
 */
const getLinkStats = async (slug) => {
    try {
        const link = await Link.findOne({ slug: slug.toLowerCase() })
            .select('slug title totalClicks validClicks invalidClicks uniqueIPs createdAt');
        
        if (!link) return null;
        
        // Lấy thêm click logs gần nhất
        const linkWithLogs = await Link.findOne({ slug: slug.toLowerCase() })
            .select('clickLogs')
            .slice('clickLogs', -20); // 20 clicks gần nhất
        
        return {
            link,
            recentClicks: linkWithLogs?.clickLogs || []
        };
    } catch (error) {
        console.error('❌ [LinkService] Lỗi lấy stats:', error.message);
        throw error;
    }
};

/**
 * Lấy thống kê tổng quan
 * @returns {Object} - Thống kê tổng
 */
const getOverallStats = async () => {
    try {
        return await Link.getOverallStats();
    } catch (error) {
        console.error('❌ [LinkService] Lỗi lấy overall stats:', error.message);
        throw error;
    }
};

/**
 * Tạo dữ liệu mẫu
 */
const createSampleData = async () => {
    try {
        // Kiểm tra đã có data chưa
        const count = await Link.countDocuments();
        if (count > 0) {
            console.log('📦 [LinkService] Đã có dữ liệu, bỏ qua tạo sample');
            return;
        }
        
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
        
        console.log('📦 [LinkService] Đã tạo dữ liệu mẫu');
    } catch (error) {
        console.error('❌ [LinkService] Lỗi tạo sample:', error.message);
    }
};

module.exports = {
    createLink,
    getLinkBySlug,
    getAllLinks,
    updateLink,
    deleteLink,
    recordClick,
    getLinkStats,
    getOverallStats,
    createSampleData
};
