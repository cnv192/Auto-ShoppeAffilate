'use client';

import React, { useState } from 'react';
import {
    Table,
    Button,
    Space,
    Tag,
    Card,
    message,
    Popconfirm,
    Typography,
    Row,
    Col,
    Statistic,
    Badge,
    Alert,
    Empty
} from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    StopOutlined,
    DeleteOutlined,
    PlusOutlined,
    ReloadOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { getApiUrl } from '@/lib/adminApi';
import { getToken, getCurrentUser } from '@/lib/authService';
import { ListPageSkeleton } from '@/components/PageSkeleton';
import { useCampaigns, invalidateCampaigns } from '@/hooks/useAdminData';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

// API functions
const campaignApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('campaigns'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch campaigns');
        return res.json();
    },
    start: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}/start`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to start campaign');
        }
        return responseData;
    },
    pause: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}/pause`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to pause campaign');
        }
        return responseData;
    },
    stop: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}/stop`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to stop campaign');
        }
        return responseData;
    },
    delete: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete campaign');
        return res.json();
    },
    executeNow: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}/execute-now`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to execute campaign');
        }
        return responseData;
    }
};

interface Campaign {
    _id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'completed' | 'stopped';
    slugs?: any[];
    commentTemplates?: string[];
    userId?: any;
    startTime?: string;
    durationHours?: number;
    filters?: any;
    stats?: any;
    [key: string]: any;
}

export default function CampaignsPage() {
    // SWR hook - data được cache và hiển thị ngay
    const { campaigns, isLoading, isValidating, refresh, isError } = useCampaigns();
    
    // Local state chỉ cho action loading
    const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

    // Hiển thị skeleton khi loading lần đầu (không có cached data)
    if (isLoading && campaigns.length === 0) {
        return <ListPageSkeleton rows={5} />;
    }



    const handleStart = async (id: string) => {
        const loadingKey = `start-${id}`;
        try {
            setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
            await campaignApi.start(id);
            message.success('Đã khởi động chiến dịch!');
            invalidateCampaigns();
        } catch (error: any) {
            invalidateCampaigns();
            message.error('Không thể khởi động chiến dịch');
        } finally {
            setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
        }
    };

    const handlePause = async (id: string) => {
        const loadingKey = `pause-${id}`;
        try {
            setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
            await campaignApi.pause(id);
            message.success('Đã tạm dừng chiến dịch!');
            invalidateCampaigns();
        } catch (error) {
            invalidateCampaigns();
            message.error('Không thể tạm dừng chiến dịch');
        } finally {
            setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
        }
    };

    const handleStop = async (id: string) => {
        const loadingKey = `stop-${id}`;
        try {
            setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
            await campaignApi.stop(id);
            message.success('Đã dừng chiến dịch!');
            invalidateCampaigns();
        } catch (error) {
            invalidateCampaigns();
            message.error('Không thể dừng chiến dịch');
        } finally {
            setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await campaignApi.delete(id);
            message.success('Xóa chiến dịch thành công!');
            invalidateCampaigns();
        } catch (error) {
            message.error('Không thể xóa chiến dịch');
        }
    };

    const handleExecuteNow = async (id: string) => {
        const loadingKey = `execute-${id}`;
        try {
            setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
            await campaignApi.executeNow(id);
            message.success('Chiến dịch đang được thực hiện ngay lập tức!');
            invalidateCampaigns();
        } catch (error: any) {
            invalidateCampaigns();
            message.error(error.message || 'Không thể thực hiện chiến dịch');
        } finally {
            setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
        }
    };

    const getStatusTag = (status: string) => {
        const statusConfig: { [key: string]: any } = {
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

    const detectCommentModes = (templates: any) => {
        if (!templates || !Array.isArray(templates)) return ['A'];
        const hasNamePlaceholder = templates.some((t: string) => t.includes('{name}'));
        return hasNamePlaceholder ? ['A', 'B'] : ['A'];
    };

    // Stats
    const stats = {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        paused: campaigns.filter(c => c.status === 'paused').length,
        completed: campaigns.filter(c => c.status === 'completed').length
    };

    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const columns = [
        {
            title: 'Tên chiến dịch',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Campaign) => {
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
                                <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>💬 Mode A</Tag>
                            )}
                            {modes.includes('B') && (
                                <Tag color="green" style={{ fontSize: 11, margin: 0 }}>↩️ Mode B</Tag>
                            )}
                        </Space>
                    </div>
                );
            }
        },
        ...(isAdmin ? [{
            title: 'User sở hữu',
            dataIndex: 'userId',
            key: 'userId',
            render: (userId: any) => userId ? (
                <Tag>{userId.username}</Tag>
            ) : <Tag>System</Tag>
        }] : []),
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status: string) => getStatusTag(status)
        },
        {
            title: 'Lịch chạy',
            key: 'schedule',
            width: 150,
            render: (_: any, record: Campaign) => (
                <div>
                    <Text>🕐 {record.startTime || '08:00'}</Text>
                    <br />
                    <Text type="secondary">{record.durationHours || 5}h mỗi ngày</Text>
                </div>
            )
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 250,
            render: (_: any, record: Campaign) => (
                <Space size="small" wrap>
                    {record.status !== 'active' && record.status !== 'completed' && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<RocketOutlined />}
                            onClick={() => handleExecuteNow(record._id)}
                            loading={actionLoading[`execute-${record._id}`]}
                            style={{ background: '#52c41a', borderColor: '#52c41a' }}
                        >
                            Chạy ngay
                        </Button>
                    )}

                    {record.status === 'draft' && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={() => handleStart(record._id)}
                            loading={actionLoading[`start-${record._id}`]}
                        />
                    )}
                    {record.status === 'active' && (
                        <Button
                            size="small"
                            icon={<PauseCircleOutlined />}
                            onClick={() => handlePause(record._id)}
                            loading={actionLoading[`pause-${record._id}`]}
                        />
                    )}
                    {record.status === 'paused' && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={() => handleStart(record._id)}
                            loading={actionLoading[`start-${record._id}`]}
                        />
                    )}
                    {(record.status === 'active' || record.status === 'paused') && (
                        <Popconfirm
                            title="Dừng chiến dịch?"
                            description="Sau khi dừng, bạn cần tạo chiến dịch mới để chạy lại"
                            onConfirm={() => handleStop(record._id)}
                        >
                            <Button
                                size="small"
                                danger
                                icon={<StopOutlined />}
                                loading={actionLoading[`stop-${record._id}`]}
                            />
                        </Popconfirm>
                    )}
                    {record.status !== 'active' && (
                        <Popconfirm
                            title="Xóa chiến dịch?"
                            description="Hành động này không thể hoàn tác"
                            onConfirm={() => handleDelete(record._id)}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

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
                        color: '#EE4D2D',
                        fontSize: 24,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        lineHeight: 1.3
                    }}>
                        <RocketOutlined />
                        Quản lý Chiến dịch
                        {isValidating && campaigns.length > 0 && (
                            <SyncOutlined spin style={{ fontSize: 16, color: '#999' }} />
                        )}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý các chiến dịch comment tự động
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={isValidating ? <SyncOutlined spin /> : <ReloadOutlined />}
                        onClick={refresh}
                        loading={isValidating}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Tạo Chiến dịch
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Tổng chiến dịch"
                            value={stats.total}
                            prefix={<RocketOutlined style={{ color: '#EE4D2D' }} />}
                            valueStyle={{ color: '#EE4D2D' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Đang chạy"
                            value={stats.active}
                            prefix={<Badge status="success" />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Tạm dừng"
                            value={stats.paused}
                            prefix={<Badge status="warning" />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Hoàn thành"
                            value={stats.completed}
                            prefix={<Badge status="processing" />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Error Alert */}
            {isError && (
                <Alert
                    message="Lỗi tải dữ liệu"
                    description="Không thể tải danh sách chiến dịch"
                    type="error"
                    showIcon
                    closable
                    action={
                        <Button size="small" onClick={refresh}>
                            Thử lại
                        </Button>
                    }
                    style={{ marginBottom: 24 }}
                />
            )}

            {/* Table - hiển thị ngay với data cached */}
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                {campaigns.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={campaigns}
                        rowKey="_id"
                        loading={false}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} chiến dịch`
                        }}
                    />
                ) : (
                    <Empty
                        description="Chưa có chiến dịch nào"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                        >
                            Tạo Chiến dịch Đầu Tiên
                        </Button>
                    </Empty>
                )}
            </Card>
        </>
    );
}
