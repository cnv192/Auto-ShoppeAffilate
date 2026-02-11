'use client';

import React from 'react';
import {
    Card,
    Typography
} from 'antd';
import {
    RiseOutlined,
    SyncOutlined
} from '@ant-design/icons';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { getCurrentUser } from '@/lib/authService';
import { StatsCards } from '@/components/StatsCards';
import { DashboardSkeleton, ChartSkeleton, StatsCardsSkeleton } from '@/components/PageSkeleton';
import { useDashboard } from '@/hooks/useAdminData';

const { Title, Text } = Typography;

export default function DashboardPage() {
    // SWR hooks - data được cache và hiển thị ngay lập tức
    const { links, hourlyTraffic, isLoading, isLinksLoading, isTrafficLoading } = useDashboard();
    
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';

    // Hiển thị skeleton khi loading lần đầu (không có cached data)
    if (isLoading && links.length === 0) {
        return <DashboardSkeleton />;
    }

    return (
        <>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <Title level={2} style={{
                        margin: 0,
                        marginBottom: 8,
                        color: '#D31016',
                        fontSize: 24,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        lineHeight: 1.3
                    }}>
                        <RiseOutlined />
                        Dashboard
                        {(isLinksLoading || isTrafficLoading) && links.length > 0 && (
                            <SyncOutlined spin style={{ marginLeft: 8, fontSize: 16, color: '#999' }} />
                        )}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        {isAdmin ? 'Tổng quan hệ thống' : 'Thống kê của bạn'}
                    </Text>
                </div>
            </div>

            {/* Stats Cards - hiển thị ngay với data cached */}
            {isLinksLoading && links.length === 0 ? (
                <StatsCardsSkeleton />
            ) : (
                <StatsCards links={links} />
            )}

            {/* Traffic Chart */}
            {isTrafficLoading && hourlyTraffic.length === 0 ? (
                <ChartSkeleton />
            ) : (
                <Card
                    title={<span style={{ fontSize: 16, fontWeight: 600, color: '#1a1d29' }}>Lượt truy cập theo giờ hôm nay</span>}
                    style={{
                        borderRadius: 12,
                        border: '1px solid #f0f0f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        marginTop: 24
                    }}
                >
                    {hourlyTraffic.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={hourlyTraffic}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 12 }}
                                    interval={2}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value) => [value, 'Lượt truy cập']}
                                    labelFormatter={(label) => `Giờ: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="clicks"
                                    stroke="#D31016"
                                    fill="#D31016"
                                    fillOpacity={0.3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 60 }}>
                            <Text type="secondary">Chưa có dữ liệu traffic hôm nay</Text>
                        </div>
                    )}
                </Card>
            )}
        </>
    );
}
