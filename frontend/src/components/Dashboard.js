/**
 * Dashboard Component with Role-Based Stats
 * 
 * Admin: Xem tất cả thống kê + biểu đồ traffic
 * User: Chỉ xem thống kê của mình
 */

import React, { useState, useEffect } from 'react';
import { 
    Row, 
    Col, 
    Card, 
    Statistic, 
    Typography, 
    Spin,
    message
} from 'antd';
import {
    LinkOutlined,
    UserOutlined,
    EyeOutlined,
    RocketOutlined,
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

const { Title, Text } = Typography;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [hourlyTraffic, setHourlyTraffic] = useState([]);
    const user = authService.getCurrentUser();
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const token = authService.getToken();
            
            // Fetch stats
            const statsRes = await fetch(`${API_URL}/api/dashboard/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statsData = await statsRes.json();
            
            if (statsData.success) {
                setStats(statsData.data);
            }

            // Fetch hourly traffic
            const trafficRes = await fetch(`${API_URL}/api/dashboard/hourly-traffic`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const trafficData = await trafficRes.json();
            
            if (trafficData.success) {
                setHourlyTraffic(trafficData.data);
            }

        } catch (error) {
            console.error('Dashboard error:', error);
            message.error('Không thể tải dữ liệu dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
            </div>
        );
    }

    const cardStyle = {
        borderRadius: 12,
        height: '100%'
    };

    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, color: '#EE4D2D' }}>
                    <RiseOutlined /> Dashboard
                </Title>
                <Text type="secondary">
                    {isAdmin ? 'Tổng quan hệ thống' : 'Thống kê của bạn'}
                </Text>
            </div>

            {/* Stats Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={cardStyle}>
                        <Statistic
                            title="Tổng số Link"
                            value={stats?.totalLinks || 0}
                            prefix={<LinkOutlined style={{ color: '#EE4D2D' }} />}
                            valueStyle={{ color: '#EE4D2D' }}
                        />
                    </Card>
                </Col>
                
                {isAdmin && (
                    <Col xs={12} sm={6}>
                        <Card style={cardStyle}>
                            <Statistic
                                title="Tổng số User"
                                value={stats?.totalUsers || 0}
                                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                )}
                
                <Col xs={12} sm={6}>
                    <Card style={cardStyle}>
                        <Statistic
                            title="Tổng lượt truy cập"
                            value={stats?.totalClicks || 0}
                            prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                
                <Col xs={12} sm={6}>
                    <Card style={cardStyle}>
                        <Statistic
                            title="Tổng số Chiến dịch"
                            value={stats?.totalCampaigns || 0}
                            prefix={<RocketOutlined style={{ color: '#722ed1' }} />}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Traffic Chart */}
            <Card 
                title="Lượt truy cập theo giờ hôm nay" 
                style={{ borderRadius: 12 }}
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
