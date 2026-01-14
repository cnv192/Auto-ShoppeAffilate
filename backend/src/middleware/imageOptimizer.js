/**
 * Image Optimization Middleware
 * 
 * Xử lý resize và convert image sang WebP
 * - Main image: 800x800px
 * - Thumbnail: 300x300px
 * - Quality: 75
 * - Output: WebP
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CONFIGURATION
// ============================================================

const SIZES = {
    main: {
        width: 800,
        height: 800,
        name: 'main'
    },
    thumbnail: {
        width: 300,
        height: 300,
        name: 'thumbnail'
    }
};

const IMAGE_QUALITY = 75;
const UPLOADS_BASE_DIR = path.join(__dirname, '../../uploads');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Tạo thư mục nếu chưa tồn tại
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        console.error(`❌ Error creating directory ${dirPath}:`, err);
        throw err;
    }
}

/**
 * Tạo unique filename
 */
function generateFilename(size = 'main') {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `${size}-${timestamp}-${uuid}.webp`;
}

/**
 * Resize và convert image
 */
async function optimizeImage(buffer, width, height) {
    try {
        const optimized = await sharp(buffer)
            .resize(width, height, {
                fit: 'inside',           // Giữ aspect ratio, fit vào size
                withoutEnlargement: true // Không phóng to nếu nhỏ hơn
            })
            .webp({ quality: IMAGE_QUALITY })
            .toBuffer();

        return optimized;
    } catch (err) {
        console.error(`❌ Error optimizing image (${width}x${height}):`, err);
        throw err;
    }
}

// ============================================================
// MAIN MIDDLEWARE
// ============================================================

/**
 * Image optimization middleware
 * 
 * Sử dụng sau uploadMiddleware.single('image')
 * 
 * Tạo:
 * - Main image (800x800)
 * - Thumbnail (300x300)
 * 
 * Lưu vào: /uploads/products/{productId}/{filename}
 * 
 * Thêm vào req.uploadedImages:
 * {
 *   main: { filename, url },
 *   thumbnail: { filename, url }
 * }
 */
const optimizeProductImage = async (req, res, next) => {
    try {
        // Kiểm tra file upload
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Không có file được upload',
                code: 'NO_FILE'
            });
        }

        // Lấy productId từ params
        const productId = req.params.productId || req.body.productId;
        if (!productId) {
            return res.status(400).json({
                success: false,
                error: 'productId không được cung cấp',
                code: 'MISSING_PRODUCT_ID'
            });
        }

        // Tạo đường dẫn upload
        const uploadsDir = path.join(UPLOADS_BASE_DIR, 'products', productId);
        await ensureDirectoryExists(uploadsDir);

        // Xử lý từng size
        const uploadedImages = {};
        const fileBuffer = req.file.buffer;

        for (const [key, sizeConfig] of Object.entries(SIZES)) {
            const optimized = await optimizeImage(
                fileBuffer,
                sizeConfig.width,
                sizeConfig.height
            );

            const filename = generateFilename(sizeConfig.name);
            const filePath = path.join(uploadsDir, filename);

            // Lưu file
            await fs.writeFile(filePath, optimized);

            // Tạo public URL
            const publicUrl = `/uploads/products/${productId}/${filename}`;

            uploadedImages[key] = {
                filename: filename,
                url: publicUrl,
                size: `${sizeConfig.width}x${sizeConfig.height}`,
                bytes: optimized.length
            };

            console.log(`✅ Saved ${key} image: ${filename}`);
        }

        // Lưu vào request object
        req.uploadedImages = uploadedImages;

        next();
    } catch (err) {
        console.error('❌ Image optimization error:', err);
        return res.status(500).json({
            success: false,
            error: 'Lỗi xử lý hình ảnh',
            code: 'IMAGE_PROCESSING_ERROR',
            details: err.message
        });
    }
};

// ============================================================
// CLEANUP MIDDLEWARE
// ============================================================

/**
 * Xóa images nếu có lỗi
 * Được gọi khi có error trong route handler
 */
const cleanupImages = async (productId, uploadedImages) => {
    try {
        if (!uploadedImages) return;

        for (const [key, imageData] of Object.entries(uploadedImages)) {
            const filePath = path.join(
                UPLOADS_BASE_DIR,
                'products',
                productId,
                imageData.filename
            );
            try {
                await fs.unlink(filePath);
                console.log(`🗑️  Cleaned up ${key} image: ${imageData.filename}`);
            } catch (err) {
                console.warn(`⚠️  Failed to cleanup ${key} image:`, err.message);
            }
        }
    } catch (err) {
        console.error('❌ Cleanup error:', err);
    }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    optimizeProductImage,
    cleanupImages,
    SIZES,
    IMAGE_QUALITY,
    UPLOADS_BASE_DIR
};
