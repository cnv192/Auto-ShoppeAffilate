import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, Card, Tag, Spin, message } from 'antd';
import { FireOutlined, ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
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
    const [hotLinks, setHotLinks] = useState([]);
    
    useEffect(() => {
        fetchLinks();
    }, []);
    
    const fetchLinks = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/links');
            const allLinks = response.data.data || [];
            
            // Sort by publishedAt or createdAt
            const sorted = allLinks.sort((a, b) => {
                const dateA = new Date(a.publishedAt || a.createdAt);
                const dateB = new Date(b.publishedAt || b.createdAt);
                return dateB - dateA;
            });
            
            setLinks(sorted);
            
            // Hot links = top 5 by clicks
            const hot = [...allLinks]
                .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
                .slice(0, 5);
            setHotLinks(hot);
            
        } catch (error) {
            message.error('Không thể tải bài viết');
        } finally {
            setLoading(false);
        }
    };
    
    const getCategoryColor = (category) => {
        const colors = {
            'Khuyến mãi': 'red',
            'Flash Sale': 'orange',
            'Thời trang': 'pink',
            'Điện tử': 'blue',
            'Làm đẹp': 'purple',
            'Gia dụng': 'green'
        };
        return colors[category] || 'default';
    };
    
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
            </div>
        );
    }
    
    const featuredPost = links[0];
    const latestPosts = links.slice(1, 7);
    
    return (
        <div style={{ background: '#fff', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{
                background: '#EE4D2D',
                padding: '20px 0'
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
                    <Title level={1} style={{ 
                        margin: 0, 
                        color: '#fff',
                        fontSize: 48,
                        fontWeight: 900,
                        textAlign: 'center'
                    }}>
                        <FireOutlined /> HOT NEWS
                    </Title>
                    <Text style={{ 
                        display: 'block', 
                        textAlign: 'center',
                        fontSize: 16,
                        marginTop: 8,
                        color: 'rgba(255,255,255,0.9)'
                    }}>
                        Cập nhật tin tức khuyến mãi mới nhất mỗi ngày
                    </Text>
                </div>
            </div>
            
            {/* Content */}
            <div style={{ maxWidth: 1200, margin: '30px auto', padding: '0 20px' }}>
                <Row gutter={24}>
                    {/* Main Content */}
                    <Col xs={24} lg={16}>
                        {/* Featured Post */}
                        {featuredPost && (
                            <Card
                                hoverable
                                style={{ marginBottom: 24 }}
                                cover={
                                    <div style={{ 
                                        height: 400, 
                                        background: `url(${featuredPost.imageUrl}) center/cover`,
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: 24,
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            color: '#fff'
                                        }}>
                                            {featuredPost.category && (
                                                <Tag color={getCategoryColor(featuredPost.category)} style={{ marginBottom: 8 }}>
                                                    {featuredPost.category}
                                                </Tag>
                                            )}
                                            <Title level={2} style={{ color: '#fff', margin: 0 }}>
                                                {featuredPost.title}
                                            </Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                                                <ClockCircleOutlined /> {dayjs(featuredPost.publishedAt || featuredPost.createdAt).fromNow()}
                                            </Text>
                                        </div>
                                    </div>
                                }
                                onClick={() => window.location.href = `/${featuredPost.slug}`}
                            >
                                <Paragraph ellipsis={{ rows: 2 }}>
                                    {featuredPost.description}
                                </Paragraph>
                            </Card>
                        )}
                        
                        {/* Latest Posts Grid */}
                        <Row gutter={[16, 16]}>
                            {latestPosts.map(link => (
                                <Col xs={24} md={12} key={link._id}>
                                    <Card
                                        hoverable
                                        cover={
                                            <div style={{ 
                                                height: 200, 
                                                background: `url(${link.imageUrl}) center/cover` 
                                            }} />
                                        }
                                        onClick={() => window.location.href = `/${link.slug}`}
                                    >
                                        {link.category && (
                                            <Tag color={getCategoryColor(link.category)} style={{ marginBottom: 8 }}>
                                                {link.category}
                                            </Tag>
                                        )}
                                        <Title level={4} ellipsis={{ rows: 2 }} style={{ margin: '8px 0' }}>
                                            {link.title}
                                        </Title>
                                        <Paragraph ellipsis={{ rows: 2 }} type="secondary">
                                            {link.description}
                                        </Paragraph>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            <ClockCircleOutlined /> {dayjs(link.publishedAt || link.createdAt).fromNow()}
                                        </Text>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </Col>
                    
                    {/* Sidebar - Hot Links */}
                    <Col xs={24} lg={8}>
                        <Card 
                            title={<><FireOutlined /> Bài viết HOT nhất</>}
                            style={{ position: 'sticky', top: 20 }}
                        >
                            {hotLinks.map((link, index) => (
                                <div 
                                    key={link._id}
                                    style={{
                                        padding: '12px 0',
                                        borderBottom: index < hotLinks.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => window.location.href = `/${link.slug}`}
                                >
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <div style={{
                                            fontSize: 24,
                                            fontWeight: 'bold',
                                            color: index === 0 ? '#EE4D2D' : index === 1 ? '#FF6B35' : '#999',
                                            minWidth: 30
                                        }}>
                                            {index + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Text strong ellipsis style={{ 
                                                display: 'block',
                                                fontSize: 14,
                                                marginBottom: 4
                                            }}>
                                                {link.title}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                <EyeOutlined /> {link.clickCount || 0} lượt xem
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Card>
                    </Col>
                </Row>
            </div>
            
            {/* Footer */}
            <div style={{
                background: '#EE4D2D',
                color: '#fff',
                padding: '40px 20px',
                marginTop: 60,
                textAlign: 'center'
            }}>
                <Text style={{ color: '#fff' }}>
                    © 2026 Hot News. All rights reserved.
                </Text>
            </div>
        </div>
    );
};

export default Homepage;
