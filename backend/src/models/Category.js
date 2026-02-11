/**
 * Category Model
 * 
 * Schema MongoDB cho việc quản lý danh mục bài viết
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CategorySchema = new Schema({
    // Tên danh mục
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        maxlength: 100
    },
    
    // Slug (URL-friendly)
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 100
    },
    
    // Mô tả
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    
    // Màu sắc (cho badge)
    color: {
        type: String,
        trim: true,
        default: '#D31016'
    },
    
    // Icon (emoji hoặc icon name)
    icon: {
        type: String,
        trim: true,
        default: ''
    },
    
    // Thứ tự hiển thị
    sortOrder: {
        type: Number,
        default: 0
    },
    
    // Trạng thái
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Số bài viết (cache)
    articleCount: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true,
    collection: 'categories'
});

// Indexes
CategorySchema.index({ isActive: 1, sortOrder: 1 });
CategorySchema.index({ slug: 1 });

// Pre-save: ensure slug lowercase
CategorySchema.pre('save', function(next) {
    if (this.slug) {
        this.slug = this.slug.toLowerCase();
    }
    next();
});

/**
 * Seed default categories
 */
CategorySchema.statics.seedDefaults = async function() {
    const defaults = [
        { name: 'Thời sự', slug: 'thoi-su', color: '#D31016', sortOrder: 1 },
        { name: 'Thế giới', slug: 'the-gioi', color: '#0066CC', sortOrder: 2 },
        { name: 'Kinh tế', slug: 'kinh-te', color: '#FF6600', sortOrder: 3 },
        { name: 'Đời sống', slug: 'doi-song', color: '#52c41a', sortOrder: 4 },
        { name: 'Giải trí', slug: 'giai-tri', color: '#eb2f96', sortOrder: 5 },
        { name: 'Thể thao', slug: 'the-thao', color: '#1890ff', sortOrder: 6 },
        { name: 'Công nghệ', slug: 'cong-nghe', color: '#722ed1', sortOrder: 7 },
        { name: 'Sức khỏe', slug: 'suc-khoe', color: '#13c2c2', sortOrder: 8 },
    ];

    for (const cat of defaults) {
        await this.findOneAndUpdate(
            { slug: cat.slug },
            { $setOnInsert: cat },
            { upsert: true, new: true }
        );
    }
    
    console.log('✅ Default categories seeded');
};

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;
