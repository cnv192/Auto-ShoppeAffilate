/**
 * Dashboard Component with Role-Based Stats
 * 
 * Admin: Xem tất cả thống kê + biểu đồ traffic
 * User: Chỉ xem thống kê của mình
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
    App,
    Card, 
    Typography, 
    Spin,
    Button
} from 'antd';
import {
    RiseOutlined
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
import authService from '../services/authService';
import { getAllLinks } from '../services/api';
import { getApiUrl } from '../config/api';
import StatsCards from './StatsCards';

const { Title, Text } = Typography;

const Dashboard = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [links, setLinks] = useState([]);
    const [hourlyTraffic, setHourlyTraffic] = useState([]);
    const user = authService.getCurrentUser();
    const isAdmin = user?.role === 'admin';

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const linksData = await getAllLinks();
            setLinks(Array.isArray(linksData) ? linksData : []);
            
            // Fetch hourly traffic (can remain as is)
            const token = authService.getToken();
            const trafficRes = await fetch(getApiUrl('dashboard/hourly-traffic'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!trafficRes.ok) {
                console.warn('Failed to fetch hourly traffic');
            } else {
                const trafficData = await trafficRes.json();
                if (trafficData.success && trafficData.data) {
                    setHourlyTraffic(Array.isArray(trafficData.data) ? trafficData.data : []);
                }
            }

        } catch (error) {
            console.error('Dashboard error:', error);
            const errorMessage = 'Không thể tải dữ liệu dashboard';
            setError(errorMessage);
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#999' }}>Đang tải dữ liệu...</div>
            </div>
        );
    }

    if (error && links.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ color: '#ff4d4f', marginBottom: 16 }}>❌ {error}</div>
                <Button onClick={fetchDashboardData}>Thử lại</Button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ 
                    margin: 0, 
                    marginBottom: 8,
                    color: '#1a1d29',
                    fontSize: 28,
                    fontWeight: 600
                }}>
                    <RiseOutlined style={{ marginRight: 12, color: '#EE4D2D' }} />
                    Dashboard
                </Title>
                <Text type="secondary" style={{ fontSize: 15 }}>
                    {isAdmin ? 'Tổng quan hệ thống' : 'Thống kê của bạn'}
                </Text>
            </div>

            {/* Stats Cards */}
            <StatsCards links={links} />

            {/* Traffic Chart */}
            <Card 
                title={<span style={{ fontSize: 16, fontWeight: 600, color: '#1a1d29' }}>Lượt truy cập theo giờ hôm nay</span>}
                style={{ 
                    borderRadius: 12,
                    border: '2px solid #e8eaed',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    marginTop: 32
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
                                stroke="#EE4D2D" 
                                fill="#EE4D2D"
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
        </div>
    );
};

export default Dashboard;
