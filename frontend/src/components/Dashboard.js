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
    message,
    Button
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
import { getApiUrl } from '../config/api';

const { Title, Text } = Typography;

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
            setError(null);
            const token = authService.getToken();
            
            // Fetch stats
            const statsRes = await fetch(getApiUrl('dashboard/stats'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!statsRes.ok) {
                throw new Error(`Failed to fetch stats: ${statsRes.status}`);
            }
            
            const statsData = await statsRes.json();
            
            // DEBUG: Log raw response để kiểm tra
            console.log('🔍 [Dashboard] Raw API Response:', statsData);
            console.log('🔍 [Dashboard] Response structure:', {
                success: statsData.success,
                hasData: !!statsData.data,
                dataKeys: statsData.data ? Object.keys(statsData.data) : [],
                dataValues: statsData.data
            });
            
            if (statsData.success && statsData.data) {
                // Validate data structure
                const data = statsData.data;
                console.log('🔍 [Dashboard] Setting stats:', data);
                setStats(data);
            } else {
                console.error('❌ [Dashboard] Invalid response:', statsData);
                throw new Error(statsData.message || 'Invalid stats data');
            }

            // Fetch hourly traffic
            const trafficRes = await fetch(getApiUrl('dashboard/hourly-traffic'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!trafficRes.ok) {
                // Traffic error không block stats, chỉ log
                console.warn('Failed to fetch hourly traffic');
            } else {
                const trafficData = await trafficRes.json();
                
                if (trafficData.success && trafficData.data) {
                    setHourlyTraffic(Array.isArray(trafficData.data) ? trafficData.data : []);
                }
            }

        } catch (error) {
            console.error('Dashboard error:', error);
            setError(error.message || 'Không thể tải dữ liệu dashboard');
            message.error(error.message || 'Không thể tải dữ liệu dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#999' }}>Đang tải dữ liệu...</div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ color: '#ff4d4f', marginBottom: 16 }}>❌ {error}</div>
                <Button onClick={fetchDashboardData}>Thử lại</Button>
            </div>
        );
    }

    const cardStyle = {
        borderRadius: 12,
        height: '100%',
        border: '2px solid #e8eaed',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease'
    };

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
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
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
                            value={stats?.totalLinks ?? '-'}
                            prefix={<LinkOutlined style={{ color: '#EE4D2D', fontSize: 20 }} />}
                            valueStyle={{ color: '#1a1d29', fontSize: 28, fontWeight: 600 }}
                        />
                    </Card>
                </Col>
                
                {isAdmin && (
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
                                title={<span style={{ fontSize: 14, color: '#6b7280' }}>Tổng số User</span>}
                                value={stats?.totalUsers ?? '-'}
                                prefix={<UserOutlined style={{ color: '#1890ff', fontSize: 20 }} />}
                                valueStyle={{ color: '#1a1d29', fontSize: 28, fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                )}
                
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
                            title={<span style={{ fontSize: 14, color: '#6b7280' }}>Tổng lượt truy cập</span>}
                            value={stats?.totalClicks ?? '-'}
                            prefix={<EyeOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                            valueStyle={{ color: '#1a1d29', fontSize: 28, fontWeight: 600 }}
                        />
                    </Card>
                </Col>
                
                <Col xs={24} sm={12} lg={6}>
                    <Card 
                        style={cardStyle}
                        hoverable
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#722ed1';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(114, 46, 209, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e8eaed';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                        }}
                    >
                        <Statistic
                            title={<span style={{ fontSize: 14, color: '#6b7280' }}>Tổng số Chiến dịch</span>}
                            value={stats?.totalCampaigns ?? '-'}
                            prefix={<RocketOutlined style={{ color: '#722ed1', fontSize: 20 }} />}
                            valueStyle={{ color: '#1a1d29', fontSize: 28, fontWeight: 600 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Traffic Chart */}
            <Card 
                title={<span style={{ fontSize: 16, fontWeight: 600, color: '#1a1d29' }}>Lượt truy cập theo giờ hôm nay</span>}
                style={{ 
                    borderRadius: 12,
                    border: '2px solid #e8eaed',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
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
