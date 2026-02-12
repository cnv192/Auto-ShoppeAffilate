'use client';

import React, { useState, useCallback } from 'react';
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
    Empty,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    TimePicker,
    Divider
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
    SyncOutlined,
    EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { getApiUrl } from '@/lib/adminApi';
import { getToken, getCurrentUser } from '@/lib/authService';
import { ListPageSkeleton } from '@/components/PageSkeleton';
import { useCampaigns, invalidateCampaigns, useLinks } from '@/hooks/useAdminData';

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
    },
    create: async (data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl('campaigns'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to create campaign');
        }
        return responseData;
    },
    update: async (id: string, data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`campaigns/${id}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await res.json();
        if (!res.ok) {
            throw new Error(responseData.message || 'Failed to update campaign');
        }
        return responseData;
    }
};

const fbApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('facebook-accounts'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch facebook accounts');
        return res.json();
    }
};

const resourceApi = {
    getByType: async (type: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`resource-sets/by-type/${type}`), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Failed to fetch ${type} resources`);
        return res.json();
    }
};

interface ResourceSet {
    _id: string;
    name: string;
    content: string[];
    type: string;
}

interface FacebookAccount {
    _id: string;
    name?: string;
    accountName?: string;
    email?: string;
    tokenStatus: string;
    isActive: boolean;
    [key: string]: any;
}

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
    facebookAccountId?: any;
    delayMin?: number;
    delayMax?: number;
    maxCommentsPerPost?: number;
    linkGroups?: string[];
    fanpages?: string[];
    targetPostIds?: string[];
    description?: string;
    [key: string]: any;
}

export default function CampaignsPage() {
    // SWR hook - data được cache và hiển thị ngay
    const { campaigns, isLoading, isValidating, refresh, isError } = useCampaigns();
    
    // Local state chỉ cho action loading
    const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

    // Links data for slug selection
    const { links } = useLinks();

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [saving, setSaving] = useState(false);
    const [fbAccounts, setFbAccounts] = useState<FacebookAccount[]>([]);
    const [commentSets, setCommentSets] = useState<ResourceSet[]>([]);
    const [groupSets, setGroupSets] = useState<ResourceSet[]>([]);
    const [pageSets, setPageSets] = useState<ResourceSet[]>([]);
    const [form] = Form.useForm();

    // Fetch Facebook accounts và resource sets khi mở modal
    const fetchModalData = useCallback(async () => {
        try {
            const [fbRes, commentRes, groupRes, pageRes] = await Promise.all([
                fbApi.getAll(),
                resourceApi.getByType('comment'),
                resourceApi.getByType('group'),
                resourceApi.getByType('page'),
            ]);
            const accounts = fbRes.data || fbRes.accounts || fbRes;
            setFbAccounts(Array.isArray(accounts) ? accounts : []);
            setCommentSets(Array.isArray(commentRes.data) ? commentRes.data : []);
            setGroupSets(Array.isArray(groupRes.data) ? groupRes.data : []);
            setPageSets(Array.isArray(pageRes.data) ? pageRes.data : []);
        } catch (error) {
            console.error('Failed to fetch modal data:', error);
        }
    }, []);

    const openCreateModal = useCallback(() => {
        setEditingCampaign(null);
        form.resetFields();
        form.setFieldsValue({
            startTime: dayjs('08:00', 'HH:mm'),
            durationHours: 5,
            maxCommentsPerPost: 1,
            delayMin: 30,
            delayMax: 60,
        });
        fetchModalData();
        setModalVisible(true);
    }, [form, fetchModalData]);

    const openEditModal = useCallback((campaign: Campaign) => {
        setEditingCampaign(campaign);
        form.resetFields();
        form.setFieldsValue({
            name: campaign.name,
            description: campaign.description,
            facebookAccountId: campaign.facebookAccountId?._id || campaign.facebookAccountId,
            slugs: campaign.slugs || [],
            commentSetIds: [],
            groupSetIds: [],
            pageSetIds: [],
            startTime: campaign.startTime ? dayjs(campaign.startTime, 'HH:mm') : dayjs('08:00', 'HH:mm'),
            durationHours: campaign.durationHours || 5,
            maxCommentsPerPost: campaign.maxCommentsPerPost || 1,
            delayMin: campaign.delayMin || 30,
            delayMax: campaign.delayMax || 60,
            targetPostIds: campaign.targetPostIds?.join('\n'),
        });
        fetchModalData();
        setModalVisible(true);
    }, [form, fetchModalData]);

    const handleModalSubmit = useCallback(async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);

            // Gộp nội dung từ các bộ mẫu đã chọn
            const selectedComments = (values.commentSetIds || []).flatMap((id: string) => {
                const set = commentSets.find(s => s._id === id);
                return set?.content || [];
            });
            const selectedGroups = (values.groupSetIds || []).flatMap((id: string) => {
                const set = groupSets.find(s => s._id === id);
                return set?.content || [];
            });
            const selectedPages = (values.pageSetIds || []).flatMap((id: string) => {
                const set = pageSets.find(s => s._id === id);
                return set?.content || [];
            });

            const payload = {
                name: values.name,
                description: values.description,
                facebookAccountId: values.facebookAccountId,
                slugs: Array.isArray(values.slugs) ? values.slugs : [],
                commentTemplates: selectedComments,
                startTime: values.startTime ? dayjs(values.startTime).format('HH:mm') : '08:00',
                durationHours: values.durationHours,
                maxCommentsPerPost: values.maxCommentsPerPost,
                delayMin: values.delayMin,
                delayMax: values.delayMax,
                targetPostIds: values.targetPostIds || '',
                linkGroups: selectedGroups,
                fanpages: selectedPages,
            };

            if (editingCampaign) {
                await campaignApi.update(editingCampaign._id, payload);
                message.success('Cập nhật chiến dịch thành công!');
            } else {
                await campaignApi.create(payload);
                message.success('Tạo chiến dịch thành công!');
            }

            setModalVisible(false);
            form.resetFields();
            setEditingCampaign(null);
            invalidateCampaigns();
        } catch (error: any) {
            if (error.errorFields) return; // validation error
            message.error(error.message || 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    }, [form, editingCampaign]);

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
                        <Text strong style={{ color: '#D31016' }}>{text}</Text>
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
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(record)}
                        />
                    )}
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
                        color: '#D31016',
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
                        onClick={openCreateModal}
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
                            prefix={<RocketOutlined style={{ color: '#D31016' }} />}
                            valueStyle={{ color: '#D31016' }}
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
                            onClick={openCreateModal}
                        >
                            Tạo Chiến dịch Đầu Tiên
                        </Button>
                    </Empty>
                )}
            </Card>

            {/* Modal tạo/sửa chiến dịch */}
            <Modal
                title={
                    <Space>
                        {editingCampaign ? <EditOutlined style={{ color: '#D31016' }} /> : <PlusOutlined style={{ color: '#D31016' }} />}
                        <span>{editingCampaign ? 'Chỉnh sửa Chiến dịch' : 'Tạo Chiến dịch Mới'}</span>
                    </Space>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); setEditingCampaign(null); form.resetFields(); }}
                onOk={handleModalSubmit}
                okText={editingCampaign ? 'Cập nhật' : 'Tạo chiến dịch'}
                cancelText="Hủy"
                confirmLoading={saving}
                width={720}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="name"
                        label="Tên chiến dịch"
                        rules={[{ required: true, message: 'Nhập tên chiến dịch' }]}
                    >
                        <Input placeholder="VD: Chiến dịch quảng bá sản phẩm A" maxLength={100} />
                    </Form.Item>

                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea placeholder="Mô tả ngắn về chiến dịch (tùy chọn)" rows={2} maxLength={500} />
                    </Form.Item>

                    <Form.Item
                        name="facebookAccountId"
                        label="Tài khoản Facebook"
                        rules={[{ required: true, message: 'Chọn tài khoản Facebook' }]}
                    >
                        <Select placeholder="Chọn tài khoản Facebook">
                            {fbAccounts.filter(a => a.isActive).map(acc => (
                                <Select.Option key={acc._id} value={acc._id}>
                                    {acc.name || acc.accountName || acc.email || acc._id}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Divider>Nội dung</Divider>

                    {/* Slugs - chọn từ danh sách bài viết đang có */}
                    <Form.Item
                        name="slugs"
                        label="Chọn bài viết (slugs)"
                        rules={[{ required: true, message: 'Chọn ít nhất 1 bài viết' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Tìm và chọn bài viết..."
                            showSearch
                            optionFilterProp="label"
                            style={{ width: '100%' }}
                        >
                            {links.map((link: any) => (
                                <Select.Option key={link.slug} value={link.slug} label={`${link.title} (${link.slug})`}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{link.title}</div>
                                        <div style={{ fontSize: 12, color: '#999' }}>/{link.slug}</div>
                                    </div>
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* Comment Templates - chọn bộ mẫu */}
                    <Form.Item
                        name="commentSetIds"
                        label="Bộ mẫu Comment"
                        rules={[{ required: true, message: 'Chọn ít nhất 1 bộ mẫu comment' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Chọn bộ mẫu comment..."
                            allowClear
                            optionFilterProp="label"
                            showSearch
                        >
                            {commentSets.map(set => (
                                <Select.Option key={set._id} value={set._id} label={set.name}>
                                    {set.name} ({set.content?.length || 0} mẫu)
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* Target Post IDs - nhập tay */}
                    <Form.Item
                        name="targetPostIds"
                        label="Bài viết Facebook cụ thể (tùy chọn, mỗi dòng 1 link/ID)"
                    >
                        <Input.TextArea
                            placeholder={`VD:\nhttps://facebook.com/groups/123/posts/456\n789012345`}
                            rows={3}
                            style={{ fontFamily: 'monospace' }}
                        />
                    </Form.Item>

                    <Divider>Lịch chạy</Divider>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="startTime"
                                label="Giờ bắt đầu"
                                rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]}
                            >
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="durationHours"
                                label="Thời lượng (giờ)"
                                rules={[{ required: true, message: 'Nhập thời lượng' }]}
                            >
                                <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Cài đặt nâng cao</Divider>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="maxCommentsPerPost" label="Max comment/bài">
                                <InputNumber min={1} max={10} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="delayMin" label="Delay tối thiểu (giây)">
                                <InputNumber min={10} max={300} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="delayMax" label="Delay tối đa (giây)">
                                <InputNumber min={10} max={600} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Groups - chọn bộ group */}
                    <Form.Item
                        name="groupSetIds"
                        label="Bộ Group Facebook"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Chọn bộ group..."
                            allowClear
                            optionFilterProp="label"
                            showSearch
                        >
                            {groupSets.map(set => (
                                <Select.Option key={set._id} value={set._id} label={set.name}>
                                    {set.name} ({set.content?.length || 0} groups)
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* Fanpages - chọn bộ fanpage */}
                    <Form.Item
                        name="pageSetIds"
                        label="Bộ Fanpage"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Chọn bộ fanpage..."
                            allowClear
                            optionFilterProp="label"
                            showSearch
                        >
                            {pageSets.map(set => (
                                <Select.Option key={set._id} value={set._id} label={set.name}>
                                    {set.name} ({set.content?.length || 0} pages)
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
