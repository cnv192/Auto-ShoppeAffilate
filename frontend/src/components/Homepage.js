import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, Tag, Spin, message, Empty, Button, Input, Menu } from 'antd';
import { FireOutlined, ReloadOutlined, SearchOutlined, ThunderboltOutlined, VideoCameraOutlined, AppstoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text, Paragraph } = Typography;

/**
 * Homepage - Trang chủ như trang báo
 * Hiển thị danh sách bài viết (links) mới nhất
 */

const Homepage = () => {
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hotLinks, setHotLinks] = useState([]);
    
    useEffect(() => {
        fetchLinks();
    }, []);
    
    const fetchLinks = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Gọi API backend để lấy tất cả bài viết (public)
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/links/public`);
            
            if (!response.ok) {
                throw new Error('Không thể tải bài viết');
            }
            
            const data = await response.json();
            const allLinks = data.data || [];
            
            if (!Array.isArray(allLinks)) {
                throw new Error('Invalid data format');
            }
            
            // Sort by publishedAt or createdAt (from database)
            const sorted = allLinks.sort((a, b) => {
                const dateA = new Date(a.publishedAt || a.createdAt);
                const dateB = new Date(b.publishedAt || b.createdAt);
                return dateB - dateA;
            });
            
            setLinks(sorted);
            
            // Hot links = top 5 by clicks (from database)
            const hot = [...allLinks]
                .sort((a, b) => (b.clicks || b.clickCount || 0) - (a.clicks || a.clickCount || 0))
                .slice(0, 5);
            setHotLinks(hot);
            
        } catch (error) {
            console.error('Homepage fetch error:', error);
            setError(error.message || 'Không thể tải bài viết');
            message.error(error.message || 'Không thể tải bài viết');
            setLinks([]);
            setHotLinks([]);
        } finally {
            setLoading(false);
        }
    };
    
    const getCategoryColor = (category) => {
        const colors = {
            'Khuyến mãi': '#ee4d2d',
            'Flash Sale': '#ff6b35',
            'Thời trang': '#eb2f96',
            'Điện tử': '#1890ff',
            'Làm đẹp': '#9c27b0',
            'Gia dụng': '#52c41a'
        };
        return colors[category] || '#595959';
    };
    
    const getCategoryTag = (category) => {
        if (!category) return null;
        
        const tagStyle = {
            padding: '0 6px',
            fontSize: 11,
            fontWeight: 600,
            border: 'none',
            borderRadius: 2,
            marginRight: 6
        };
        
        return (
            <Tag style={{ ...tagStyle, background: getCategoryColor(category), color: 'white' }}>
                {category}
            </Tag>
        );
    };
    
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#999' }}>Đang tải bài viết...</div>
            </div>
        );
    }

    if (error && links.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <div style={{ color: '#ff4d4f', marginBottom: 16, fontSize: 16 }}>❌ {error}</div>
                <Button icon={<ReloadOutlined />} onClick={fetchLinks}>Thử lại</Button>
            </div>
        );
    }

    if (links.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Empty description="Chưa có bài viết nào" />
            </div>
        );
    }
    
    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
            {/* Header - Báo Mới Style */}
            <div style={{
                background: 'white',
                borderBottom: '3px solid #26a9e0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}>
                {/* Top Bar */}
                <div style={{ 
                    maxWidth: 1200, 
                    margin: '0 auto', 
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #26a9e0 0%, #1e88c7 100%)',
                            padding: '8px 16px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <FireOutlined style={{ color: 'white', fontSize: 24 }} />
                            <span style={{ 
                                color: 'white', 
                                fontSize: 24, 
                                fontWeight: 900,
                                letterSpacing: 1
                            }}>
                                HOT NEWS
                            </span>
                        </div>
                        <Text style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                            Tin tức hot nhiều người quan tâm
                        </Text>
                    </div>
                    
                    {/* Search Bar */}
                    <Input
                        placeholder="Nhập nội dung tìm kiếm"
                        prefix={<SearchOutlined style={{ color: '#999' }} />}
                        style={{
                            width: 400,
                            borderRadius: 4,
                            border: '1px solid #e0e0e0'
                        }}
                    />
                </div>
                
                {/* Navigation Menu */}
                <div style={{ 
                    maxWidth: 1200, 
                    margin: '0 auto',
                    borderTop: '1px solid #f0f0f0'
                }}>
                    <Menu
                        mode="horizontal"
                        defaultSelectedKeys={['home']}
                        style={{
                            border: 'none',
                            background: 'white',
                            fontSize: 14,
                            fontWeight: 600,
                            marginBottom: 5
                        }}
                        items={[
                            {
                                key: 'home',
                                icon: <FireOutlined />,
                                label: 'NÓNG',
                            },
                            {
                                key: 'new',
                                icon: <ThunderboltOutlined />,
                                label: 'MỚI',
                            },
                            {
                                key: 'video',
                                icon: <VideoCameraOutlined />,
                                label: 'VIDEO',
                            },
                            {
                                key: 'topics',
                                icon: <AppstoreOutlined />,
                                label: 'CHỦ ĐỀ',
                            }
                        ]}
                    />
                </div>
            </div>
            
            {/* Main Content */}
            <div style={{ maxWidth: 1200, margin: '20px auto', padding: '0 20px' , height: '70vh'}}>
                <Row gutter={24}>
                    {/* Main Content - Left Column */}
                    <Col xs={24} lg={16}>
                        {/* Section Header */}
                        <div style={{
                            background: 'white',
                            padding: '12px 16px',
                            marginBottom: 16,
                            borderLeft: '3px solid #26a9e0',
                            borderRadius: 2
                        }}>
                            <Title level={4} style={{ margin: 0, color: '#333', fontSize: 16, fontWeight: 700 }}>
                                TIN MỚI
                            </Title>
                        </div>

                        {/* News List */}
                        <div style={{ background: 'white', borderRadius: 4, overflow: 'hidden' }}>
                            {links.map((link, index) => (
                                <div 
                                    key={link._id}
                                    onClick={() => window.location.href = `/${link.slug}`}
                                    style={{
                                        display: 'flex',
                                        gap: 16,
                                        padding: 16,
                                        borderBottom: index < links.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                    {/* Thumbnail */}
                                    <div style={{
                                        width: 180,
                                        height: 120,
                                        flexShrink: 0,
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        background: '#f0f0f0'
                                    }}>
                                        <img 
                                            src={link.imageUrl} 
                                            alt={link.title}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Title */}
                                        <Title 
                                            level={5} 
                                            style={{
                                                margin: '0 0 8px 0',
                                                fontSize: 16,
                                                fontWeight: 600,
                                                lineHeight: 1.4,
                                                color: '#333',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {link.title}
                                        </Title>
                                        
                                        {/* Description */}
                                        <Paragraph 
                                            style={{
                                                margin: '0 0 8px 0',
                                                fontSize: 14,
                                                color: '#666',
                                                lineHeight: 1.5,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {link.description}
                                        </Paragraph>
                                        
                                        {/* Meta */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                            {getCategoryTag(link.category)}
                                            <Text style={{ fontSize: 12, color: '#999' }}>
                                                {dayjs(link.publishedAt || link.createdAt).fromNow()}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#999' }}>
                                                {(link.clicks || link.clickCount || 0)} lượt xem
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Col>
                    
                    {/* Sidebar - Right Column */}
                    <Col xs={24} lg={8}>
                        {/* Hot News Section */}
                        <div style={{
                            background: 'white',
                            padding: '12px 16px',
                            marginBottom: 16,
                            borderLeft: '3px solid #ee4d2d',
                            borderRadius: 2
                        }}>
                            <Title level={4} style={{ 
                                margin: 0, 
                                color: '#ee4d2d', 
                                fontSize: 16, 
                                fontWeight: 700 
                            }}>
                                <FireOutlined /> NÓNG 24H
                            </Title>
                        </div>
                        
                        <div style={{ background: 'white', borderRadius: 4, overflow: 'hidden' }}>
                            {hotLinks.map((link, index) => (
                                <div 
                                    key={link._id}
                                    onClick={() => window.location.href = `/${link.slug}`}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        padding: 12,
                                        borderBottom: index < hotLinks.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                    {/* Thumbnail */}
                                    <div style={{
                                        width: 100,
                                        height: 70,
                                        flexShrink: 0,
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        background: '#f0f0f0',
                                        position: 'relative'
                                    }}>
                                        <img 
                                            src={link.imageUrl} 
                                            alt={link.title}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                        {/* Video icon if applicable */}
                                        {link.category === 'VIDEO' && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 4,
                                                right: 4,
                                                background: 'rgba(0,0,0,0.7)',
                                                borderRadius: 2,
                                                padding: '2px 4px'
                                            }}>
                                                <VideoCameraOutlined style={{ color: 'white', fontSize: 10 }} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {getCategoryTag(link.category)}
                                        <Title 
                                            level={5} 
                                            style={{
                                                margin: '4px 0',
                                                fontSize: 14,
                                                fontWeight: 600,
                                                lineHeight: 1.4,
                                                color: '#333',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {link.title}
                                        </Title>
                                        <Text style={{ fontSize: 11, color: '#999' }}>
                                            {(link.clicks || link.clickCount || 0)} lượt xem
                                        </Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Col>
                </Row>
            </div>
            
            {/* Footer */}
            <div style={{
                background: '#26a9e0',
                color: '#fff',
                padding: '24px 20px',
                marginTop: 40,
                textAlign: 'center',
                borderTop: '3px solid #1e88c7'
            }}>
                <Text style={{ color: '#fff', fontSize: 13 }}>
                    © 2026 Hot News - Tin tức khuyến mãi điện tử
                </Text>
            </div>
        </div>
    );
};

export default Homepage;
