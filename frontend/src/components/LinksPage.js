/**
 * Links Page Component
 * 
 * Trang quản lý links với đầy đủ chức năng CRUD
 * Sử dụng React Router, không reload page
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Typography, 
    Button, 
    Space, 
    message,
    Spin,
    Empty
} from 'antd';
import { 
    PlusOutlined, 
    ReloadOutlined
} from '@ant-design/icons';

import LinkTable from './LinkTable';
import LinkFormArticle from './LinkFormArticle';
import StatsCards from './StatsCards';
import { getAllLinks, createLink, updateLink, deleteLink } from '../services/api';

const { Title, Text } = Typography;

function LinksPage() {
    // State management
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    
    // Load cache từ localStorage khi component mount
    const loadCacheFromStorage = () => {
        try {
            const cached = localStorage.getItem('linkDataCache');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.error('Error loading cache from storage:', error);
            return {};
        }
    };
    
    // Save cache to localStorage
    const saveCacheToStorage = (cache) => {
        try {
            localStorage.setItem('linkDataCache', JSON.stringify(cache));
        } catch (error) {
            console.error('Error saving cache to storage:', error);
        }
    };
    
    // Cache để lưu full link data (bao gồm content, description) vì API không trả về
    const [linkDataCache, setLinkDataCache] = useState(() => loadCacheFromStorage());

    // Fetch links from API
    const fetchLinks = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getAllLinks();
            // Ensure data is an array
            setLinks(Array.isArray(data) ? data : []);
        } catch (error) {
            message.error('Không thể tải danh sách links');
            console.error('Fetch links error:', error);
            setLinks([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load & auto-refresh
    useEffect(() => {
        fetchLinks(); // Initial load
        
        const interval = setInterval(() => {
            fetchLinks();
            console.log('🔄 [LinksPage] Auto-refreshing links data...');
        }, 30000); // 30 seconds
        
        return () => clearInterval(interval); // Cleanup on unmount
    }, [fetchLinks]);

    // Handle create new link
    const handleCreate = () => {
        setEditingLink(null);
        setFormVisible(true);
    };

    // Handle edit link - Sử dụng cache hoặc data từ list
    const handleEdit = (link) => {
        // Kiểm tra cache trước (có thể có content/description từ lần submit trước)
        const cachedData = linkDataCache[link.slug];
        
        if (cachedData) {
            // Merge cached data với link data hiện tại
            const completeLink = {
                ...link,
                ...cachedData,
                // Đảm bảo có đầy đủ fields
                content: cachedData.content || '',
                description: cachedData.description || '',
                category: cachedData.category || link.category || 'Khuyến mãi',
                author: cachedData.author || link.author || 'Shopee Deals VN',
                publishedAt: cachedData.publishedAt || link.publishedAt
            };
            
            console.log('🔍 [LinksPage] Using cached data for edit:', completeLink);
            setEditingLink(completeLink);
        } else {
            // Nếu không có cache, dùng data từ list (sẽ thiếu content/description)
            console.warn('⚠️ [LinksPage] No cached data, using list data (may miss content/description)');
            setEditingLink(link);
        }
        
        setFormVisible(true);
    };

    // Handle form submit (create or update)
    const handleFormSubmit = async (values) => {
        try {
            // Map customSlug to slug for backend, ensure all fields are included
            const linkData = {
                ...values,
                customSlug: values.customSlug || values.slug, // Backend expects customSlug
                description: values.description || '',
                content: values.content || '',
                category: values.category || 'Khuyến mãi',
                author: values.author || 'Shopee Deals VN',
                publishedAt: values.publishedAt || new Date().toISOString()
            };
            
            // Remove slug field as backend uses customSlug
            delete linkData.slug;
            
            console.log('📤 [LinksPage] Submitting link data:', {
                ...linkData,
                content: linkData.content ? `${linkData.content.substring(0, 50)}...` : 'empty'
            });
            
            let result;
            if (editingLink) {
                // Update existing link - use slug (not _id) as identifier
                result = await updateLink(editingLink.slug, linkData);
                message.success('Cập nhật link thành công!');
                
                // Lưu vào cache (memory + localStorage) để lần sau edit có data
                const slug = result.data?.slug || editingLink?.slug || linkData.customSlug;
                if (slug) {
                    const newCache = {
                        ...linkDataCache,
                        [slug]: {
                            content: linkData.content || '',
                            description: linkData.description || '',
                            category: linkData.category || '',
                            author: linkData.author || '',
                            publishedAt: linkData.publishedAt
                        }
                    };
                    setLinkDataCache(newCache);
                    saveCacheToStorage(newCache);
                    console.log('💾 [LinksPage] Saved to cache:', slug, newCache[slug]);
                }
            } else {
                // Create new link
                result = await createLink(linkData);
                message.success('Tạo link mới thành công!');
                
                // Lưu vào cache (memory + localStorage)
                const slug = result.data?.slug || linkData.customSlug;
                if (slug) {
                    const newCache = {
                        ...linkDataCache,
                        [slug]: {
                            content: linkData.content || '',
                            description: linkData.description || '',
                            category: linkData.category || '',
                            author: linkData.author || '',
                            publishedAt: linkData.publishedAt
                        }
                    };
                    setLinkDataCache(newCache);
                    saveCacheToStorage(newCache);
                    console.log('💾 [LinksPage] Saved to cache:', slug, newCache[slug]);
                }
            }
            
            setFormVisible(false);
            setEditingLink(null);
            // Refresh data without page reload
            fetchLinks();
            
        } catch (error) {
            console.error('❌ [LinksPage] Submit error:', error);
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    // Handle delete link - receives slug from LinkTable
    const handleDelete = async (slug) => {
        try {
            await deleteLink(slug);
            message.success('Xóa link thành công!');
            // Refresh data without page reload
            fetchLinks();
        } catch (error) {
            message.error('Không thể xóa link');
        }
    };

    // Handle refresh
    const handleRefresh = () => {
        fetchLinks();
        message.success('Đã làm mới dữ liệu');
    };

    return (
        <div style={{ maxWidth: '100%' }}>
            {/* Header Actions */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 32,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <Title level={2} style={{ 
                        margin: 0, 
                        marginBottom: 8,
                        color: '#1a1d29',
                        fontSize: 28,
                        fontWeight: 600
                    }}>
                        Quản lý Links
                    </Title>
                    <Text type="secondary" style={{ fontSize: 15 }}>
                        Tạo và quản lý các link rút gọn của bạn
                    </Text>
                </div>
                
                <Space size="middle" wrap>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={handleRefresh}
                        size="large"
                        style={{
                            border: '2px solid #e8eaed',
                            height: 40
                        }}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                        style={{
                            background: '#EE4D2D',
                            borderColor: '#EE4D2D',
                            height: 40,
                            fontWeight: 500,
                            boxShadow: '0 2px 4px rgba(238, 77, 45, 0.2)'
                        }}
                    >
                        Tạo Link Mới
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <StatsCards links={links} style={{ marginBottom: 24 }} />

            {/* Links Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                </div>
            ) : links.length === 0 ? (
                <Empty 
                    description="Chưa có link nào"
                    style={{ padding: '60px 0' }}
                >
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                    >
                        Tạo Link Đầu Tiên
                    </Button>
                </Empty>
            ) : (
                <LinkTable 
                    links={links}
                    loading={loading}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRefresh={handleRefresh}
                />
            )}

            {/* Create/Edit Form Modal */}
            <LinkFormArticle
                visible={formVisible}
                editingLink={editingLink}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                    setFormVisible(false);
                    setEditingLink(null);
                }}
            />
        </div>
    );
}

export default LinksPage;
