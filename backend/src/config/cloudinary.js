/**
 * Cloudinary Configuration
 * 
 * Initialize Cloudinary SDK with environment variables
 * Handles image and video uploads to Cloudinary CDN
 */

const cloudinary = require('cloudinary').v2;

/**
 * Validate required environment variables
 */
const requiredEnvVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.warn(`⚠️  Missing Cloudinary environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('📋 Add these to your .env file:');
    missingEnvVars.forEach(varName => {
        console.warn(`   ${varName}=your_value_here`);
    });
}

/**
 * Configure Cloudinary with environment variables
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true  // Always use HTTPS
});

/**
 * Log successful configuration
 */
if (process.env.CLOUDINARY_CLOUD_NAME) {
    console.log(`✅ Cloudinary configured: ${process.env.CLOUDINARY_CLOUD_NAME}`);
}

module.exports = cloudinary;
