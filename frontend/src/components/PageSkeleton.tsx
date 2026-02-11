/**
 * PageSkeleton - Loading skeleton cho các trang admin
 * Hiển thị skeleton thay vì spinner để người dùng biết layout sẽ như thế nào
 */

'use client';

import React from 'react';
import { Skeleton, Card, Row, Col, Space } from 'antd';

interface PageSkeletonProps {
    type?: 'dashboard' | 'table' | 'form' | 'cards';
    rows?: number;
}

// Skeleton cho Stats Cards
export function StatsCardsSkeleton() {
    return (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
                <Col xs={24} sm={12} lg={6} key={i}>
                    <Card style={{ borderRadius: 12 }}>
                        <Skeleton.Input active style={{ width: 80, marginBottom: 8 }} size="small" />
                        <Skeleton.Input active style={{ width: 120 }} size="large" />
                    </Card>
                </Col>
            ))}
        </Row>
    );
}

// Skeleton cho Table
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <Card style={{ borderRadius: 12 }}>
            {/* Table header */}
            <div style={{ 
                display: 'flex', 
                gap: 16, 
                paddingBottom: 16, 
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 16
            }}>
                <Skeleton.Input active style={{ width: 150 }} size="small" />
                <Skeleton.Input active style={{ width: 200 }} size="small" />
                <Skeleton.Input active style={{ width: 100 }} size="small" />
                <Skeleton.Input active style={{ width: 80 }} size="small" />
                <Skeleton.Input active style={{ width: 120 }} size="small" />
            </div>
            
            {/* Table rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div 
                    key={i}
                    style={{ 
                        display: 'flex', 
                        gap: 16, 
                        padding: '12px 0',
                        borderBottom: i < rows - 1 ? '1px solid #f5f5f5' : 'none'
                    }}
                >
                    <Skeleton.Avatar active size="small" />
                    <Skeleton.Input active style={{ width: 150 }} size="small" />
                    <Skeleton.Input active style={{ width: 200 }} size="small" />
                    <Skeleton.Input active style={{ width: 80 }} size="small" />
                    <Skeleton.Button active size="small" style={{ width: 60 }} />
                    <Skeleton.Button active size="small" style={{ width: 80 }} />
                </div>
            ))}
        </Card>
    );
}

// Skeleton cho Chart
export function ChartSkeleton() {
    return (
        <Card style={{ borderRadius: 12, marginTop: 32 }}>
            <Skeleton.Input active style={{ width: 200, marginBottom: 24 }} />
            <div style={{ 
                height: 300, 
                background: 'linear-gradient(90deg, #f5f5f5 25%, #e8e8e8 50%, #f5f5f5 75%)',
                borderRadius: 8,
                animation: 'shimmer 1.5s infinite'
            }} />
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </Card>
    );
}

// Skeleton cho Dashboard
export function DashboardSkeleton() {
    return (
        <div>
            {/* Header skeleton */}
            <div style={{ marginBottom: 32 }}>
                <Skeleton.Input active style={{ width: 200, marginBottom: 8 }} size="large" />
                <Skeleton.Input active style={{ width: 150 }} size="small" />
            </div>
            
            <StatsCardsSkeleton />
            <ChartSkeleton />
        </div>
    );
}

// Skeleton cho Links/Campaign page
export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div>
            {/* Header with actions */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 24 
            }}>
                <Skeleton.Input active style={{ width: 180 }} size="large" />
                <Space>
                    <Skeleton.Button active style={{ width: 100 }} />
                    <Skeleton.Button active style={{ width: 120 }} />
                </Space>
            </div>
            
            <StatsCardsSkeleton />
            <TableSkeleton rows={rows} />
        </div>
    );
}

// Main PageSkeleton component
export default function PageSkeleton({ type = 'table', rows = 5 }: PageSkeletonProps) {
    switch (type) {
        case 'dashboard':
            return <DashboardSkeleton />;
        case 'table':
            return <ListPageSkeleton rows={rows} />;
        case 'cards':
            return <StatsCardsSkeleton />;
        case 'form':
            return (
                <Card style={{ borderRadius: 12 }}>
                    <Skeleton active paragraph={{ rows: 6 }} />
                </Card>
            );
        default:
            return <ListPageSkeleton rows={rows} />;
    }
}
