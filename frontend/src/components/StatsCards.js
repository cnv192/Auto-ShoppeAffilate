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
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    };

    return (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
                <Card style={cardStyle} variant="borderless">
                    <Statistic
                        title="Tổng số Link"
                        value={totalLinks}
                        prefix={<LinkOutlined style={{ color: '#EE4D2D' }} />}
                        valueStyle={{ color: '#EE4D2D' }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card style={cardStyle} variant="borderless">
                    <Statistic
                        title="Tổng Clicks"
                        value={totalClicks}
                        prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
                        valueStyle={{ color: '#52c41a' }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card style={cardStyle} variant="borderless">
                    <Statistic
                        title="Link Hoạt động"
                        value={activeLinks}
                        suffix={`/ ${totalLinks}`}
                        prefix={<RiseOutlined style={{ color: '#1890ff' }} />}
                        valueStyle={{ color: '#1890ff' }}
                    />
                </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
                <Card style={cardStyle} variant="borderless">
                    <Statistic
                        title="Link Hot nhất"
                        value={topLink.clicks || 0}
                        suffix="clicks"
                        prefix={<FireOutlined style={{ color: '#fa8c16' }} />}
                        valueStyle={{ color: '#fa8c16' }}
                    />
                    {topLink.slug && (
                        <div style={{ 
                            marginTop: 8, 
                            fontSize: 12, 
                            color: '#999',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
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
