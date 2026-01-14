/**
 * Stats Card Component
 * 
 * Hiển thị thống kê tổng quan
 */

import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { 
    LinkOutlined, 
    EyeOutlined, 
    RiseOutlined,
    FireOutlined
} from '@ant-design/icons';

const StatsCards = ({ links = [] }) => {
    // Ensure links is an array
    const linksArray = Array.isArray(links) ? links : [];
    
    // Tính toán thống kê
    const totalLinks = linksArray.length;
    const totalClicks = linksArray.reduce((sum, link) => sum + (link.clicks || 0), 0);
    const activeLinks = linksArray.filter(link => link.isActive).length;
    const topLink = linksArray.reduce((max, link) => 
        (link.clicks || 0) > (max.clicks || 0) ? link : max, 
        { clicks: 0 }
    );

    const cardStyle = {
        borderRadius: 12,
        border: '2px solid #e8eaed',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease',
        height: '100%'
    };

    return (
        <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} lg={6}>
                <Card 
                    style={cardStyle}
                    hoverable
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#EE4D2D';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(238, 77, 45, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8eaed';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                >
                    <Statistic
                        title={<span style={{ fontSize: 14, color: '#6b7280' }}>Tổng số Link</span>}
                        value={totalLinks}
                        prefix={<LinkOutlined style={{ color: '#EE4D2D', fontSize: 20 }} />}
                        valueStyle={{ color: '#1a1d29', fontSize: 24, fontWeight: 600 }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card 
                    style={cardStyle}
                    hoverable
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#52c41a';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8eaed';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                >
                    <Statistic
                        title={<span style={{ fontSize: 14, color: '#6b7280' }}>Tổng Clicks</span>}
                        value={totalClicks}
                        prefix={<EyeOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                        valueStyle={{ color: '#1a1d29', fontSize: 24, fontWeight: 600 }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card 
                    style={cardStyle}
                    hoverable
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#1890ff';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8eaed';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                >
                    <Statistic
                        title={<span style={{ fontSize: 14, color: '#6b7280' }}>Link Hoạt động</span>}
                        value={activeLinks}
                        suffix={`/ ${totalLinks}`}
                        prefix={<RiseOutlined style={{ color: '#1890ff', fontSize: 20 }} />}
                        valueStyle={{ color: '#1a1d29', fontSize: 24, fontWeight: 600 }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card 
                    style={cardStyle}
                    hoverable
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#fa8c16';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 140, 22, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8eaed';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                >
                    <Statistic
                        title={<span style={{ fontSize: 14, color: '#6b7280' }}>Link Hot nhất</span>}
                        value={topLink.clicks || 0}
                        suffix="clicks"
                        prefix={<FireOutlined style={{ color: '#fa8c16', fontSize: 20 }} />}
                        valueStyle={{ color: '#1a1d29', fontSize: 24, fontWeight: 600 }}
                    />
                    {topLink.slug && (
                        <div style={{ 
                            marginTop: 12, 
                            fontSize: 13, 
                            color: '#6b7280',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            /{topLink.slug}
                        </div>
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default StatsCards;
