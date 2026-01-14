/**
 * Upload Service
 * 
 * Business logic cho upload images
 * Có thể extend thêm database operations
 */

const { cleanupImages } = require('../middleware/imageOptimizer');

/**
 * Xử lý kết quả upload
 * Format response và xử lý error
 */
class UploadService {
    /**
     * Handle successful upload
     * @param {Object} uploadedImages - Kết quả từ imageOptimizer middleware
     * @returns {Object} Formatted response data
     */
    static formatUploadResponse(uploadedImages) {
        return {
            success: true,
            data: {
                imageUrl: uploadedImages.main.url,
                thumbnailUrl: uploadedImages.thumbnail.url,
                images: {
                    main: {
                        url: uploadedImages.main.url,
                        filename: uploadedImages.main.filename,
                        size: uploadedImages.main.size,
                        bytes: uploadedImages.main.bytes
                    },
                    thumbnail: {
                        url: uploadedImages.thumbnail.url,
                        filename: uploadedImages.thumbnail.filename,
                        size: uploadedImages.thumbnail.size,
                        bytes: uploadedImages.thumbnail.bytes
                    }
                },
                uploadedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Handle upload error
     * @param {Error} err - Error object
     * @param {String} productId - Product ID (để cleanup nếu cần)
     * @param {Object} uploadedImages - Uploaded images để cleanup
     * @returns {Object} Error response
     */
    static async handleUploadError(err, productId, uploadedImages) {
        // Cleanup images nếu có error
        if (uploadedImages && productId) {
            await cleanupImages(productId, uploadedImages);
        }

        console.error('❌ Upload service error:', err);

        return {
            success: false,
            error: err.message || 'Lỗi upload file',
            code: err.code || 'UPLOAD_ERROR'
        };
    }

    /**
     * Validate product image metadata (future use)
     * @param {Object} metadata - Image metadata
     * @returns {Boolean} True nếu hợp lệ
     */
    static validateMetadata(metadata) {
        if (!metadata) return false;
        if (!metadata.productId) return false;
        return true;
    }

    /**
     * Generate image CDN URL (nếu có CDN service)
     * @param {String} localUrl - Local file URL
     * @returns {String} CDN URL hoặc local URL
     */
    static getCdnUrl(localUrl) {
        // TODO: Integrate với CDN service (Cloudinary, S3, etc.)
        // Hiện tại chỉ return local URL
        return localUrl;
    }
}

module.exports = UploadService;
