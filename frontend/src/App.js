/**
 * Main App Component
 * 
 * Shopee Link Management Dashboard
 * Màu sắc chủ đạo: Trắng và Cam (#EE4D2D)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ConfigProvider, 
    Layout, 
    Typography, 
    Button, 
    Space, 
    message,
    Spin,
    Empty,
    theme
} from 'antd';
import { 
    PlusOutlined, 
    ReloadOutlined,
    ShopOutlined
} from '@ant-design/icons';

import LinkTable from './components/LinkTable';
import LinkForm from './components/LinkForm';
import StatsCards from './components/StatsCards';
import { getAllLinks, createLink, updateLink, deleteLink } from './services/api';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

// Theme configuration - Trắng và Cam
const themeConfig = {
    token: {
        colorPrimary: '#EE4D2D',
        colorLink: '#EE4D2D',
        colorLinkHover: '#d94429',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    algorithm: theme.defaultAlgorithm
};

function App() {
    // State management
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [editingLink, setEditingLink] = useState(null);

    /**
     * Fetch tất cả links từ API
     */
    const fetchLinks = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getAllLinks();
            if (response.success) {
                setLinks(response.data);
            }
        } catch (error) {
            message.error('Không thể tải danh sách links');
            console.error('Error fetching links:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load links khi component mount
    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    /**
     * Mở form tạo link mới
     */
    const handleCreate = () => {
        setEditingLink(null);
        setFormVisible(true);
    };

    /**
     * Mở form chỉnh sửa link
     */
    const handleEdit = (link) => {
        setEditingLink(link);
        setFormVisible(true);
    };

    /**
     * Đóng form
     */
    const handleCancel = () => {
        setFormVisible(false);
        setEditingLink(null);
    };

    /**
     * Submit form (tạo mới hoặc cập nhật)
     */
    const handleSubmit = async (values) => {
        setFormLoading(true);
        try {
            if (editingLink) {
                // Cập nhật link
                const response = await updateLink(editingLink.slug, values);
                if (response.success) {
                    message.success('Cập nhật link thành công!');
                    setFormVisible(false);
                    fetchLinks();
                }
            } else {
                // Tạo link mới
                const response = await createLink(values);
                if (response.success) {
                    message.success('Tạo link thành công!');
                    setFormVisible(false);
                    fetchLinks();
                }
            }
        } catch (error) {
            message.error(error.response?.data?.error || 'Có lỗi xảy ra');
        } finally {
            setFormLoading(false);
        }
    };

    /**
     * Xóa link
     */
    const handleDelete = async (slug) => {
        try {
            const response = await deleteLink(slug);
            if (response.success) {
                message.success('Xóa link thành công!');
                fetchLinks();
            }
        } catch (error) {
            message.error('Không thể xóa link');
        }
    };

    return (
        <ConfigProvider theme={themeConfig}>
            <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
                {/* Header */}
                <Header style={{
                    background: '#fff',
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100
                }}>
                    <Space>
                        <ShopOutlined style={{ 
                            fontSize: 28, 
                            color: '#EE4D2D'
                        }} />
                        <Title level={4} style={{ 
                            margin: 0, 
                            color: '#EE4D2D',
                            fontWeight: 600
                        }}>
                            Link Manager
                        </Title>
                    </Space>
                    
                    <Space>
                        <Button 
                            icon={<ReloadOutlined />}
                            onClick={fetchLinks}
                            loading={loading}
                        >
                            Làm mới
                        </Button>
                        <Button 
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreate}
                            style={{
                                background: '#EE4D2D',
                                borderColor: '#EE4D2D'
                            }}
                        >
                            Tạo Link Mới
                        </Button>
                    </Space>
                </Header>

                {/* Main Content */}
                <Content style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
                    {/* Stats Overview */}
                    <StatsCards links={links} />

                    {/* Links Table */}
                    <div style={{
                        background: '#fff',
                        padding: 24,
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16
                        }}>
                            <Title level={5} style={{ margin: 0 }}>
                                Danh sách Links
                            </Title>
                            <Text type="secondary">
                                Tổng: {links.length} links
                            </Text>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 60 }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 16, color: '#999' }}>
                                    Đang tải dữ liệu...
                                </div>
                            </div>
                        ) : links.length === 0 ? (
                            <Empty
                                description="Chưa có link nào"
                                style={{ padding: 60 }}
                            >
                                <Button 
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleCreate}
                                    style={{
                                        background: '#EE4D2D',
                                        borderColor: '#EE4D2D'
                                    }}
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
                                onRefresh={fetchLinks}
                            />
                        )}
                    </div>
                </Content>

                {/* Footer */}
                <Footer style={{ 
                    textAlign: 'center', 
                    background: '#fff',
                    borderTop: '1px solid #f0f0f0'
                }}>
                    <Text type="secondary">
                        Shopee Link Manager © {new Date().getFullYear()} | 
                        Powered by React & Ant Design
                    </Text>
                </Footer>

                {/* Link Form Modal */}
                <LinkForm
                    visible={formVisible}
                    onCancel={handleCancel}
                    onSubmit={handleSubmit}
                    editingLink={editingLink}
                    loading={formLoading}
                />
            </Layout>
        </ConfigProvider>
    );
}

export default App;
