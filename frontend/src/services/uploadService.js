/**
 * Upload API Service
 * 
 * Client-side API calls cho upload functionality
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Upload product image
 * 
 * @param {File} file - Image file từ input
 * @param {String} productId - Product ID
 * @param {Function} onProgress - Progress callback: (progressEvent) => void
 * @returns {Promise<Object>} Upload response
 * 
 * @example
 * const file = e.target.files[0];
 * const response = await uploadProductImage(file, 'product-123', (e) => {
 *   console.log(`${e.loaded}/${e.total} bytes`);
 * });
 * // response.data.imageUrl = "/uploads/products/product-123/main-..."
 * // response.data.thumbnailUrl = "/uploads/products/product-123/thumbnail-..."
 */
export const uploadProductImage = async (file, productId, onProgress) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/upload/product/${productId}`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: onProgress
            }
        );

        return response.data;
    } catch (error) {
        console.error('❌ Image upload error:', error);

        // Format error message
        const errorMessage = error.response?.data?.error || error.message;
        const errorCode = error.response?.data?.code || 'UPLOAD_ERROR';

        throw new Error(`${errorCode}: ${errorMessage}`);
    }
};

/**
 * Batch upload multiple images
 * 
 * @param {File[]} files - Array of image files
 * @param {String} productId - Product ID
 * @param {Function} onProgress - Progress callback per file
 * @returns {Promise<Object[]>} Array of upload responses
 */
export const batchUploadImages = async (files, productId, onProgress) => {
    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await uploadProductImage(
                file,
                productId,
                (e) => onProgress?.(i, e)
            );
            results.push(result);
        } catch (err) {
            console.error(`❌ Failed to upload file ${i}:`, err);
            results.push({
                success: false,
                error: err.message
            });
        }
    }

    return results;
};

/**
 * Validate image file trước khi upload
 * 
 * @param {File} file - Image file
 * @param {Number} maxSizeMB - Max file size in MB (default: 5)
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateImageFile = (file, maxSizeMB = 5) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxBytes = maxSizeMB * 1024 * 1024;

    // Check type
    if (!allowedMimes.includes(file.type)) {
        return {
            valid: false,
            error: `❌ Loại file không được phép. Chỉ chấp nhận: JPG, PNG, WebP, GIF`
        };
    }

    // Check size
    if (file.size > maxBytes) {
        return {
            valid: false,
            error: `❌ File quá lớn. Tối đa ${maxSizeMB}MB (File của bạn: ${(file.size / 1024 / 1024).toFixed(2)}MB)`
        };
    }

    return { valid: true };
};

export default {
    uploadProductImage,
    batchUploadImages,
    validateImageFile
};
