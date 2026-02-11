/**
 * Upload Service
 * 
 * Handles file uploads to Cloudinary
 * Supports images and videos with auto-detection
 */

const cloudinary = require('../config/cloudinary');
const path = require('path');

class UploadService {
    /**
     * Determine resource type based on file extension or MIME type
     * @param {string} filePath - Path to file or URL
     * @returns {string} Resource type: 'image', 'video', or 'auto'
     */
    static getResourceType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        // Image extensions
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
        if (imageExts.includes(ext)) return 'image';
        
        // Video extensions
        const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v'];
        if (videoExts.includes(ext)) return 'video';
        
        // Auto-detect if extension not recognized
        return 'auto';
    }

    /**
     * Upload file to Cloudinary
     * 
     * @param {string|Buffer} filePathOrBuffer - File path or Buffer
     * @param {string} folder - Cloudinary folder (e.g., 'articles', 'banners')
     * @param {Object} options - Additional upload options
     * @returns {Promise<Object>} Upload result with secure_url and public_id
     */
    static async uploadFile(filePathOrBuffer, folder = 'general', options = {}) {
        try {
            // Default upload options
            const uploadOptions = {
                folder: `shoppe/${folder}`,  // Organize uploads in folder structure
                resource_type: this.getResourceType(
                    typeof filePathOrBuffer === 'string' ? filePathOrBuffer : 'buffer'
                ),
                overwrite: false,           // Don't overwrite existing files
                unique_filename: true,      // Generate unique filename
                tags: ['shoppe', folder],   // Tag for organization
                ...options                  // Override with custom options
            };

            // Upload to Cloudinary
            let result;

            if (typeof filePathOrBuffer === 'string') {
                // Upload from file path
                result = await cloudinary.uploader.upload(filePathOrBuffer, uploadOptions);
            } else if (Buffer.isBuffer(filePathOrBuffer)) {
                // Upload from Buffer (Base64 images, etc.)
                result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        uploadOptions,
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(filePathOrBuffer);
                });
            } else {
                throw new Error('Invalid file input: must be string path or Buffer');
            }

            // Log successful upload
            console.log(`✅ [Cloudinary] Uploaded to ${uploadOptions.folder}: ${result.public_id}`);

            // Return standardized response
            return {
                success: true,
                publicId: result.public_id,
                secureUrl: result.secure_url,
                url: result.secure_url,    // Alias for backwards compatibility
                type: result.resource_type,
                size: result.bytes,
                width: result.width,
                height: result.height,
                format: result.format,
                uploadedAt: new Date(result.created_at)
            };
        } catch (error) {
            console.error('❌ [Cloudinary Upload Error]', error.message);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Upload from Base64 string
     * Used for pasted images in rich text editors
     * 
     * @param {string} base64String - Base64 encoded image data (e.g., "data:image/png;base64,...")
     * @param {string} folder - Cloudinary folder
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Upload result
     */
    static async uploadBase64(base64String, folder = 'articles', options = {}) {
        try {
            // Remove data URI prefix if present
            let dataURI = base64String;
            if (base64String.startsWith('data:')) {
                // Extract mime type
                const mimeMatch = base64String.match(/data:([^;]+);base64,/);
                dataURI = base64String.replace(/^data:[^;]+;base64,/, '');
            }

            // Convert to Buffer
            const buffer = Buffer.from(dataURI, 'base64');

            // Upload as buffer
            return await this.uploadFile(buffer, folder, {
                ...options,
                format: 'auto'  // Let Cloudinary detect format from buffer
            });
        } catch (error) {
            console.error('❌ [Base64 Upload Error]', error.message);
            throw new Error(`Base64 upload failed: ${error.message}`);
        }
    }

    /**
     * Delete file from Cloudinary by public ID
     * 
     * @param {string} publicId - Cloudinary public ID
     * @param {string} resourceType - Type: 'image' or 'video'
     * @returns {Promise<Object>} Deletion result
     */
    static async deleteFile(publicId, resourceType = 'image') {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType
            });

            if (result.result === 'ok') {
                console.log(`✅ [Cloudinary] Deleted: ${publicId}`);
                return { success: true, publicId };
            } else {
                console.warn(`⚠️  [Cloudinary] Delete result unclear: ${JSON.stringify(result)}`);
                return { success: false, result };
            }
        } catch (error) {
            console.error('❌ [Delete Error]', error.message);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    /**
     * Get upload statistics or metadata
     * 
     * @param {string} publicId - Cloudinary public ID
     * @returns {Promise<Object>} File metadata
     */
    static async getFileInfo(publicId) {
        try {
            const result = await cloudinary.api.resource(publicId);
            return {
                publicId: result.public_id,
                url: result.secure_url,
                type: result.type,
                resourceType: result.resource_type,
                size: result.bytes,
                width: result.width,
                height: result.height,
                format: result.format,
                uploadedAt: result.created_at,
                tags: result.tags || []
            };
        } catch (error) {
            console.error('❌ [Get Info Error]', error.message);
            throw new Error(`Get info failed: ${error.message}`);
        }
    }

    /**
     * Generate optimized URL for different use cases
     * 
     * @param {string} publicId - Cloudinary public ID
     * @param {Object} transformations - Cloudinary transformation options
     * @returns {string} Optimized URL
     */
    static getOptimizedUrl(publicId, transformations = {}) {
        // Default transformations for web
        const defaults = {
            quality: 'auto',
            fetch_format: 'auto'
        };

        const url = cloudinary.url(publicId, {
            ...defaults,
            ...transformations,
            secure: true
        });

        return url;
    }

    /**
     * Generate thumbnail URL
     * 
     * @param {string} publicId - Cloudinary public ID
     * @param {number} width - Thumbnail width
     * @param {number} height - Thumbnail height
     * @returns {string} Thumbnail URL
     */
    static getThumbnailUrl(publicId, width = 200, height = 200) {
        return this.getOptimizedUrl(publicId, {
            crop: 'fill',
            gravity: 'face',
            width: width,
            height: height,
            quality: 'auto',
            fetch_format: 'auto'
        });
    }

    /**
     * Generate responsive image URLs (srcset)
     * For use in HTML img srcset attribute
     * 
     * @param {string} publicId - Cloudinary public ID
     * @returns {string} Srcset string
     */
    static getSrcset(publicId) {
        const sizes = [320, 640, 960, 1280, 1920];
        return sizes
            .map(size => `${this.getOptimizedUrl(publicId, { width: size, crop: 'scale' })} ${size}w`)
            .join(', ');
    }

    /**
     * Format upload response for API response
     * 
     * @param {Object} uploadResult - Result from uploadFile
     * @returns {Object} Formatted response
     */
    static formatResponse(uploadResult) {
        return {
            success: true,
            data: {
                url: uploadResult.secureUrl,
                publicId: uploadResult.publicId,
                type: uploadResult.type,
                size: uploadResult.size,
                dimensions: {
                    width: uploadResult.width,
                    height: uploadResult.height
                },
                uploadedAt: uploadResult.uploadedAt
            }
        };
    }

    /**
     * Handle upload error response
     * 
     * @param {Error} error - Error object
     * @returns {Object} Error response
     */
    static formatErrorResponse(error) {
        return {
            success: false,
            error: error.message || 'Upload failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
}

module.exports = UploadService;
