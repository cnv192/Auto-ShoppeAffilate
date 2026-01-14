/**
 * Admin Dashboard Component
 * 
 * Shopee Link Management Dashboard with Admin Layout
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

import AdminLayout from './AdminLayout';
import LinkTable from './LinkTable';
import LinkFormArticle from './LinkFormArticle';
import StatsCards from './StatsCards';
import CampaignList from './CampaignList';
import FacebookAccountManager from './FacebookAccountManager';
import UserManagement from './UserManagement';
import Dashboard from './Dashboard';
import UserProfile from './UserProfile';
import { getAllLinks, createLink, updateLink, deleteLink } from '../services/api';
import authService from '../services/authService';

const { Title } = Typography;

function AdminDashboard() {
    // State management
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [currentPage, setCurrentPage] = useState('dashboard');

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

    // Initial load
    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    // Handle create new link
    const handleCreate = () => {
        setEditingLink(null);
        setFormVisible(true);
    };

    // Handle edit link
    const handleEdit = (link) => {
        setEditingLink(link);
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
            
            console.log('📤 [AdminDashboard] Submitting link data:', {
                ...linkData,
                content: linkData.content ? `${linkData.content.substring(0, 50)}...` : 'empty'
            });
            
            if (editingLink) {
                // Update existing link - use slug (not _id) as identifier
                await updateLink(editingLink.slug, linkData);
                message.success('Cập nhật link thành công!');
            } else {
                // Create new link
                await createLink(linkData);
                message.success('Tạo link mới thành công!');
            }
            
            setFormVisible(false);
            setEditingLink(null);
            fetchLinks();
            
        } catch (error) {
            console.error('❌ [AdminDashboard] Submit error:', error);
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    // Handle delete link - receives slug from LinkTable
    const handleDelete = async (slug) => {
        try {
            await deleteLink(slug);
            message.success('Xóa link thành công!');
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

    const handleMenuClick = (key) => {
        setCurrentPage(key);
    };

    // Render content based on current page
    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard />;
            case 'profile':
                return <UserProfile />;
            case 'campaigns':
                return <CampaignList />;
            case 'facebook':
                return <FacebookAccountManager />;
            case 'users':
                // Only admin can access
                if (authService.isAdmin()) {
                    return <UserManagement />;
                }
                return <div style={{ padding: 24 }}>Bạn không có quyền truy cập</div>;
            case 'links':
            default:
                return renderLinksPage();
        }
    };

    const renderLinksPage = () => (
        <>
            {/* Header Actions */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 24
            }}>
                <Title level={2} style={{ margin: 0, color: '#EE4D2D' }}>
                    Quản lý Links
                </Title>
                
                <Space>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={handleRefresh}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
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
                    onEdit={handleEdit}
                    onDelete={handleDelete}
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
        </>
    );

    return (
        <AdminLayout currentPage={currentPage} onMenuClick={handleMenuClick}>
            {renderContent()}
        </AdminLayout>
    );
}

export default AdminDashboard;
