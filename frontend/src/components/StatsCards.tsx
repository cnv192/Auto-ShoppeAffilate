'use client';

import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import {
    LinkOutlined,
    EyeOutlined,
    RiseOutlined,
    StopOutlined
} from '@ant-design/icons';

interface Link {
    clicks?: number;
    isActive?: boolean;
    [key: string]: any;
}

interface StatsCardsProps {
    links?: Link[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ links = [] }) => {
    // Ensure links is an array
    const linksArray = Array.isArray(links) ? links : [];

    // Tính toán thống kê
    const totalLinks = linksArray.length;
    const totalClicks = linksArray.reduce((sum, link) => sum + (link.clicks || 0), 0);
    const activeLinks = linksArray.filter(link => link.isActive).length;
    const inactiveLinks = totalLinks - activeLinks;

    const cardStyle = {
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease',
        height: '100%'
    };

    return (
        <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} lg={6}>
                <Card
                    style={cardStyle as React.CSSProperties}
                    hoverable
                    onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#EE4D2D';
                        target.style.boxShadow = '0 4px 12px rgba(238, 77, 45, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#f0f0f0';
                        target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
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
                    style={cardStyle as React.CSSProperties}
                    hoverable
                    onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#52c41a';
                        target.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#f0f0f0';
                        target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
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
                    style={cardStyle as React.CSSProperties}
                    hoverable
                    onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#1890ff';
                        target.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#f0f0f0';
                        target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
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
                    style={cardStyle as React.CSSProperties}
                    hoverable
                    onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#8c8c8c';
                        target.style.boxShadow = '0 4px 12px rgba(140, 140, 140, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.borderColor = '#f0f0f0';
                        target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                >
                    <Statistic
                        title={<span style={{ fontSize: 14, color: '#6b7280' }}>Link không hoạt động</span>}
                        value={inactiveLinks}
                        prefix={<StopOutlined style={{ color: '#8c8c8c', fontSize: 20 }} />}
                        valueStyle={{ color: '#1a1d29', fontSize: 24, fontWeight: 600 }}
                    />
                </Card>
            </Col>
        </Row>
    );
};

export default StatsCards;
