/**
 * Content Processor Utility
 * 
 * Processes rich text content (HTML) from WYSIWYG editors
 * Handles Base64 image conversion to Cloudinary URLs
 * 
 * Usage: For articles, links with rich text content containing pasted images
 */

const UploadService = require('../services/uploadService');

/**
 * Simple HTML parser using regex
 * Finds all img tags with specific attributes
 */
class HTMLParser {
    /**
     * Find all img tags in HTML content
     * @param {string} html - HTML content
     * @returns {Array} Array of img tag objects
     */
    static findImages(html) {
        // Regex to match <img> tags with src attribute
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
        const images = [];
        let match;

        while ((match = imgRegex.exec(html)) !== null) {
            images.push({
                fullTag: match[0],
                src: match[1],
                index: match.index
            });
        }

        return images;
    }

    /**
     * Check if image source is Base64
     * @param {string} src - Image source
     * @returns {boolean} True if Base64 encoded
     */
    static isBase64Image(src) {
        return src.startsWith('data:image/');
    }

    /**
     * Extract MIME type from Base64 string
     * @param {string} base64Src - Base64 image src
     * @returns {string} MIME type (e.g., 'png', 'jpeg')
     */
    static extractMimeType(base64Src) {
        const mimeMatch = base64Src.match(/data:image\/([^;]+);/);
        return mimeMatch ? mimeMatch[1] : 'png';
    }
}

/**
 * Content Processor Main Class
 */
class ContentProcessor {
    /**
     * Process HTML content and upload Base64 images to Cloudinary
     * 
     * @param {string} htmlContent - HTML content from rich text editor
     * @param {string} folder - Cloudinary folder (default: 'articles')
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Processed HTML and image data
     */
    static async processContentImages(htmlContent, folder = 'articles', options = {}) {
        try {
            if (!htmlContent || typeof htmlContent !== 'string') {
                return {
                    success: true,
                    content: htmlContent,
                    uploadedImages: [],
                    skipped: 0
                };
            }

            // Find all img tags
            const images = HTMLParser.findImages(htmlContent);
            
            if (images.length === 0) {
                return {
                    success: true,
                    content: htmlContent,
                    uploadedImages: [],
                    skipped: 0
                };
            }

            console.log(`🔍 [Content Processor] Found ${images.length} images in content`);

            let processedContent = htmlContent;
            const uploadedImages = [];
            let skipped = 0;

            // Process each image
            for (const image of images) {
                const { src, fullTag } = image;

                // Skip if not Base64
                if (!HTMLParser.isBase64Image(src)) {
                    console.log(`⏭️  [Content Processor] Skipping non-Base64 image: ${src.substring(0, 50)}...`);
                    skipped++;
                    continue;
                }

                try {
                    // Upload Base64 image to Cloudinary
                    console.log(`📤 [Content Processor] Uploading Base64 image...`);
                    const uploadResult = await UploadService.uploadBase64(src, folder, options);

                    if (!uploadResult.success) {
                        console.error(`❌ [Content Processor] Upload failed for image`);
                        skipped++;
                        continue;
                    }

                    // Create new img tag with Cloudinary URL
                    const newTag = fullTag.replace(src, uploadResult.secureUrl);
                    
                    // Replace in content
                    processedContent = processedContent.replace(fullTag, newTag);

                    // Track uploaded image
                    uploadedImages.push({
                        originalBase64: src.substring(0, 50) + '...', // Log first 50 chars
                        cloudinaryUrl: uploadResult.secureUrl,
                        publicId: uploadResult.publicId,
                        size: uploadResult.size,
                        uploadedAt: uploadResult.uploadedAt
                    });

                    console.log(`✅ [Content Processor] Image uploaded: ${uploadResult.publicId}`);

                } catch (error) {
                    console.error(`❌ [Content Processor] Error processing image:`, error.message);
                    skipped++;
                    // Continue processing other images instead of throwing
                }
            }

            return {
                success: true,
                content: processedContent,
                uploadedImages: uploadedImages,
                skipped: skipped,
                summary: {
                    total: images.length,
                    uploaded: uploadedImages.length,
                    skipped: skipped,
                    message: `Processed ${images.length} images: ${uploadedImages.length} uploaded, ${skipped} skipped`
                }
            };

        } catch (error) {
            console.error('❌ [Content Processor] Fatal error:', error.message);
            return {
                success: false,
                error: error.message,
                content: htmlContent  // Return original content on error
            };
        }
    }

    /**
     * Process multiple content fields (e.g., in batch operations)
     * 
     * @param {Array} items - Array of items with content field
     * @param {string} contentField - Field name containing HTML
     * @param {string} folder - Cloudinary folder
     * @returns {Promise<Array>} Processed items
     */
    static async processContentBatch(items, contentField = 'content', folder = 'articles') {
        try {
            const processedItems = [];

            for (const item of items) {
                if (!item[contentField]) {
                    processedItems.push(item);
                    continue;
                }

                const result = await this.processContentImages(item[contentField], folder);
                
                processedItems.push({
                    ...item,
                    [contentField]: result.content,
                    _imageProcessing: {
                        uploaded: result.uploadedImages.length,
                        skipped: result.skipped,
                        success: result.success
                    }
                });
            }

            return processedItems;
        } catch (error) {
            console.error('❌ [Batch Processing Error]', error.message);
            throw error;
        }
    }

    /**
     * Extract and return all image URLs from content
     * 
     * @param {string} htmlContent - HTML content
     * @returns {Array} Array of image URLs (both Base64 and regular)
     */
    static extractImageUrls(htmlContent) {
        const images = HTMLParser.findImages(htmlContent);
        return images.map(img => ({
            src: img.src,
            isBase64: HTMLParser.isBase64Image(img.src),
            type: HTMLParser.isBase64Image(img.src) ? 'base64' : 'url'
        }));
    }

    /**
     * Remove all images from content
     * 
     * @param {string} htmlContent - HTML content
     * @returns {string} Content without images
     */
    static stripImages(htmlContent) {
        const imgRegex = /<img[^>]+>/gi;
        return htmlContent.replace(imgRegex, '');
    }

    /**
     * Validate content for security
     * Basic XSS prevention check
     * 
     * @param {string} htmlContent - HTML content
     * @returns {Object} Validation result
     */
    static validateContent(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string') {
            return { valid: false, error: 'Content must be a non-empty string' };
        }

        // Check for dangerous scripts
        const dangerousPatterns = [
            /<script[^>]*>[\s\S]*?<\/script>/gi,
            /on\w+\s*=\s*["'][^"']*["']/gi,
            /javascript:/gi
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(htmlContent)) {
                return { 
                    valid: false, 
                    error: 'Content contains potentially dangerous code',
                    pattern: pattern.toString()
                };
            }
        }

        // Check size limit (e.g., 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (htmlContent.length > maxSize) {
            return { 
                valid: false, 
                error: `Content exceeds maximum size of ${maxSize / 1024 / 1024}MB`
            };
        }

        return { valid: true };
    }

    /**
     * Sanitize content (basic cleanup)
     * 
     * @param {string} htmlContent - HTML content
     * @returns {string} Sanitized content
     */
    static sanitizeContent(htmlContent) {
        if (!htmlContent) return htmlContent;

        // Remove script tags
        let sanitized = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

        return sanitized;
    }

    /**
     * Get content statistics
     * 
     * @param {string} htmlContent - HTML content
     * @returns {Object} Statistics
     */
    static getContentStats(htmlContent) {
        if (!htmlContent) {
            return { text: 0, html: 0, images: 0, base64Images: 0 };
        }

        const images = HTMLParser.findImages(htmlContent);
        const base64Images = images.filter(img => HTMLParser.isBase64Image(img.src));
        
        // Simple text extraction (remove HTML tags)
        const textOnly = htmlContent.replace(/<[^>]*>/g, '');

        return {
            text: textOnly.length,
            html: htmlContent.length,
            images: images.length,
            base64Images: base64Images.length,
            base64Percentage: Math.round((base64Images.length / images.length * 100) || 0)
        };
    }
}

module.exports = ContentProcessor;
