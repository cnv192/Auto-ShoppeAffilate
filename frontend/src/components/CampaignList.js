/**
 * Campaign List Component
 * 
 * Hiển thị danh sách chiến dịch Facebook Marketing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Space,
    Tag,
    Card,
    message,
    Popconfirm,
    Progress,
    Tooltip,
    Badge,
    Typography,
    Row,
    Col,
    Statistic
} from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    StopOutlined,
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    ReloadOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import CampaignForm from './CampaignForm';
import authService from '../services/authService';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

// API functions
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const campaignApi = {
    getAll: async () => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch campaigns');
        return res.json();
    },
    create: async (data) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to create campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    update: async (id, data) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to update campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    delete: async (id) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to delete campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    start: async (id) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to start campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    pause: async (id) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}/pause`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to pause campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    stop: async (id) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}/stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to stop campaign');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    },
    executeNow: async (id) => {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/api/campaigns/${id}/execute-now`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            const error = new Error(responseData.message || 'Failed to execute campaign immediately');
            error.response = { data: responseData };
            throw error;
        }
        return responseData;
    }
};

const CampaignList = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);

    const fetchCampaigns = useCallback(async () => {
        try {
            setLoading(true);
            const response = await campaignApi.getAll();
            // Backend returns { success: true, data: { campaigns: [...], total, page, pages } }
            const data = response.data || response;
            setCampaigns(data.campaigns || data || []);
        } catch (error) {
            message.error('Không thể tải danh sách chiến dịch');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const handleCreate = () => {
        setEditingCampaign(null);
        setFormVisible(true);
    };

    const handleEdit = (campaign) => {
        setEditingCampaign(campaign);
        setFormVisible(true);
    };

    const handleFormSubmit = async (values) => {
        try {
            if (editingCampaign) {
                await campaignApi.update(editingCampaign._id, values);
                message.success('Cập nhật chiến dịch thành công!');
            } else {
                console.log('📤 [Campaign] Submitting data:', values);
                const response = await campaignApi.create(values);
                console.log('✅ [Campaign] Created:', response);
                message.success('Tạo chiến dịch mới thành công!');
            }
            setFormVisible(false);
            setEditingCampaign(null);
            fetchCampaigns();
        } catch (error) {
            console.error('❌ [Campaign] Submit error:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Có lỗi xảy ra';
            const errorDetails = error.response?.data?.errors;
            
            if (errorDetails && Array.isArray(errorDetails)) {
                message.error(`${errorMsg}: ${errorDetails.join(', ')}`);
            } else {
                message.error(errorMsg);
            }
        }
    };

    const handleDelete = async (id) => {
        try {
            await campaignApi.delete(id);
            message.success('Xóa chiến dịch thành công!');
            fetchCampaigns();
        } catch (error) {
            message.error('Không thể xóa chiến dịch');
        }
    };

    const handleStart = async (id) => {
        try {
            await campaignApi.start(id);
            message.success('Đã khởi động chiến dịch!');
            fetchCampaigns();
        } catch (error) {
            message.error('Không thể khởi động chiến dịch');
        }
    };

    const handlePause = async (id) => {
        try {
            await campaignApi.pause(id);
            message.success('Đã tạm dừng chiến dịch!');
            fetchCampaigns();
        } catch (error) {
            message.error('Không thể tạm dừng chiến dịch');
        }
    };

    const handleStop = async (id) => {
        try {
            await campaignApi.stop(id);
            message.success('Đã dừng chiến dịch!');
            fetchCampaigns();
        } catch (error) {
            message.error('Không thể dừng chiến dịch');
        }
    };

    const handleExecuteNow = async (id) => {
        try {
            const hide = message.loading('Đang thực hiện chiến dịch...', 0);
            await campaignApi.executeNow(id);
            hide();
            message.success('Chiến dịch đang được thực hiện ngay lập tức!');
            fetchCampaigns();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Không thể thực hiện chiến dịch ngay';
            message.error(errorMsg);
        }
    };

    const getStatusTag = (status) => {
        const statusConfig = {
            draft: { color: 'default', icon: <ClockCircleOutlined />, text: 'Nháp' },
            active: { color: 'success', icon: <PlayCircleOutlined />, text: 'Đang chạy' },
            paused: { color: 'warning', icon: <PauseCircleOutlined />, text: 'Tạm dừng' },
            completed: { color: 'blue', icon: <CheckCircleOutlined />, text: 'Hoàn thành' },
            stopped: { color: 'error', icon: <StopOutlined />, text: 'Đã dừng' }
        };
        const config = statusConfig[status] || statusConfig.draft;
        return (
            <Tag color={config.color} icon={config.icon}>
                {config.text}
            </Tag>
        );
    };

    /**
     * Detect comment mode từ templates
     * Nếu có {name} trong bất kỳ template nào = hỗ trợ Mode B (Reply)
     */
    const detectCommentModes = (templates) => {
        if (!templates || !Array.isArray(templates)) return ['A'];
        
        const hasNamePlaceholder = templates.some(t => t.includes('{name}'));
        
        if (hasNamePlaceholder) {
            return ['A', 'B']; // Hỗ trợ cả 2 mode
        }
        return ['A']; // Chỉ Mode A
    };

    // Stats
    const stats = {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        paused: campaigns.filter(c => c.status === 'paused').length,
        completed: campaigns.filter(c => c.status === 'completed').length
    };

    const columns = [
        {
            title: 'Tên chiến dịch',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => {
                const modes = detectCommentModes(record.commentTemplates);
                return (
                    <div>
                        <Text strong style={{ color: '#EE4D2D' }}>{text}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.slugs?.length || 0} links • {record.commentTemplates?.length || 0} mẫu comment
                        </Text>
                        <br />
                        <Space size={4} style={{ marginTop: 4 }}>
                            {modes.includes('A') && (
                                <Tooltip title="Direct Comment - Comment trực tiếp lên bài viết">
                                    <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>💬 Mode A</Tag>
                                </Tooltip>
                            )}
                            {modes.includes('B') && (
                                <Tooltip title="Reply to Comment - Tự động reply comments với {name}">
                                    <Tag color="green" style={{ fontSize: 11, margin: 0 }}>↩️ Mode B</Tag>
                                </Tooltip>
                            )}
                        </Space>
                    </div>
                );
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status) => getStatusTag(status)
        },
        {
            title: 'Lịch chạy',
            key: 'schedule',
            width: 150,
            render: (_, record) => (
                <div>
                    <Text>🕐 {record.startTime || '08:00'}</Text>
                    <br />
                    <Text type="secondary">{record.durationHours || 5}h mỗi ngày</Text>
                </div>
            )
        },
        {
            title: 'Bộ lọc',
            key: 'filters',
            width: 180,
            render: (_, record) => {
                const filters = record.filters || {};
                return (
                    <Space direction="vertical" size={0}>
                        <Text style={{ fontSize: 12 }}>👍 ≥ {filters.minLikes || 0} likes</Text>
                        <Text style={{ fontSize: 12 }}>💬 ≥ {filters.minComments || 0} comments</Text>
                        <Text style={{ fontSize: 12 }}>↗️ ≥ {filters.minShares || 0} shares</Text>
                    </Space>
                );
            }
        },
        {
            title: 'Thống kê',
            key: 'stats',
            width: 150,
            render: (_, record) => {
                const stats = record.stats || {};
                const successRate = stats.totalComments > 0 
                    ? Math.round((stats.successfulComments / stats.totalComments) * 100) 
                    : 0;
                return (
                    <div>
                        <Progress 
                            percent={successRate} 
                            size="small" 
                            status={successRate > 80 ? 'success' : successRate > 50 ? 'normal' : 'exception'}
                        />
                        <Text style={{ fontSize: 12 }}>
                            {stats.successfulComments || 0}/{stats.totalComments || 0} comments
                        </Text>
                    </div>
                );
            }
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 250,
            render: (_, record) => (
                <Space size="small" wrap>
                    {/* Nút Thực hiện ngay - cho mọi trạng thái trừ đang chạy */}
                    {record.status !== 'active' && record.status !== 'completed' && (
                        <Tooltip title="Thực hiện ngay lập tức (bỏ qua lịch trình)">
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<RocketOutlined />}
                                onClick={() => handleExecuteNow(record._id)}
                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            >
                                Chạy ngay
                            </Button>
                        </Tooltip>
                    )}
                    
                    {record.status === 'draft' && (
                        <Tooltip title="Bắt đầu theo lịch">
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<PlayCircleOutlined />}
                                onClick={() => handleStart(record._id)}
                            />
                        </Tooltip>
                    )}
                    {record.status === 'active' && (
                        <Tooltip title="Tạm dừng">
                            <Button 
                                size="small" 
                                icon={<PauseCircleOutlined />}
                                onClick={() => handlePause(record._id)}
                            />
                        </Tooltip>
                    )}
                    {record.status === 'paused' && (
                        <Tooltip title="Tiếp tục">
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<PlayCircleOutlined />}
                                onClick={() => handleStart(record._id)}
                            />
                        </Tooltip>
                    )}
                    {(record.status === 'active' || record.status === 'paused') && (
                        <Popconfirm
                            title="Dừng chiến dịch?"
                            description="Sau khi dừng, bạn cần tạo chiến dịch mới để chạy lại"
                            onConfirm={() => handleStop(record._id)}
                        >
                            <Tooltip title="Dừng hoàn toàn">
                                <Button size="small" danger icon={<StopOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                    {(record.status === 'draft' || record.status === 'paused') && (
                        <Tooltip title="Sửa">
                            <Button 
                                size="small" 
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                            />
                        </Tooltip>
                    )}
                    {record.status !== 'active' && (
                        <Popconfirm
                            title="Xóa chiến dịch?"
                            description="Hành động này không thể hoàn tác"
                            onConfirm={() => handleDelete(record._id)}
                        >
                            <Tooltip title="Xóa">
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 24
            }}>
                <Title level={2} style={{ margin: 0, color: '#EE4D2D' }}>
                    <RocketOutlined /> Quản lý Chiến dịch
                </Title>
                
                <Space>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={fetchCampaigns}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                        style={{ background: '#EE4D2D', borderColor: '#EE4D2D' }}
                    >
                        Tạo Chiến dịch
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Tổng chiến dịch" 
                            value={stats.total} 
                            prefix={<RocketOutlined style={{ color: '#EE4D2D' }} />}
                            valueStyle={{ color: '#EE4D2D' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Đang chạy" 
                            value={stats.active} 
                            prefix={<Badge status="success" />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Tạm dừng" 
                            value={stats.paused} 
                            prefix={<Badge status="warning" />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Hoàn thành" 
                            value={stats.completed} 
                            prefix={<Badge status="processing" />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 8 }}>
                <Table
                    columns={columns}
                    dataSource={campaigns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) => `Tổng ${total} chiến dịch`
                    }}
                />
            </Card>

            {/* Form Modal */}
            <CampaignForm
                visible={formVisible}
                editingCampaign={editingCampaign}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                    setFormVisible(false);
                    setEditingCampaign(null);
                }}
            />
        </div>
    );
};

export default CampaignList;
