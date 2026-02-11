'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Button,
    Space,
    Table,
    Tag,
    Modal,
    Form,
    Input,
    message,
    Popconfirm,
    Typography,
    Row,
    Col,
    Statistic,
    Badge,
    Alert,
    Tooltip,
    Divider,
    Dropdown
} from 'antd';
import {
    FacebookOutlined,
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    SyncOutlined,
    SafetyOutlined,
    KeyOutlined,
    DownOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { getToken, getCurrentUser } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const fbApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('facebook-accounts'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch accounts');
        return res.json();
    },
    create: async (data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl('facebook-accounts'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create account');
        return res.json();
    },
    update: async (id: string, data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`facebook-accounts/${id}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update account');
        return res.json();
    },
    delete: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`facebook-accounts/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete account');
        return res.json();
    },
    refresh: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`facebook-accounts/${id}/refresh`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to refresh token');
        return res.json();
    }
};

interface FacebookAccount {
    _id: string;
    name: string;
    email?: string;
    facebookId: string;
    tokenStatus: string;
    authMode?: string;
    healthStatusString?: string;
    tokenExpiresAt?: string;
    userId?: { username: string };
    [key: string]: any;
}

export default function FacebookPage() {
    const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingAccount, setEditingAccount] = useState<FacebookAccount | null>(null);
    const [form] = Form.useForm();

    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fbApi.getAll();
            const accounts = response.data || response.accounts || response;
            setAccounts(Array.isArray(accounts) ? accounts : []);
        } catch (error) {
            message.error('Không thể tải danh sách tài khoản');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const handleAdd = () => {
        setEditingAccount(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleAutoAddAccount = () => {
        const user = getCurrentUser();
        if (!user || !user._id) {
            message.error('Vui lòng đăng nhập lại');
            return;
        }
        
        const fbUrl = `https://www.facebook.com/?towblock_connect=1&userId=${user._id}`;
        message.info('🔄 Đang mở Facebook... Extension sẽ tự động đồng bộ và đóng tab.', 5);
        window.open(fbUrl, '_blank');
        
        let checkCount = 0;
        const maxChecks = 10;
        const currentAccountCount = accounts.length;
        
        const pollInterval = setInterval(async () => {
            checkCount++;
            try {
                const response = await fbApi.getAll();
                const newAccounts = response.data || response.accounts || response;
                const accountsList = Array.isArray(newAccounts) ? newAccounts : [];
                
                if (accountsList.length > currentAccountCount) {
                    clearInterval(pollInterval);
                    setAccounts(accountsList);
                    message.success('✅ Đã thêm tài khoản Facebook thành công!');
                    return;
                }
                
                if (checkCount >= maxChecks) {
                    clearInterval(pollInterval);
                    message.warning('Hết thời gian chờ. Nếu extension đã hoạt động, vui lòng refresh trang.');
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000);
    };

    const handleEdit = (account: FacebookAccount) => {
        setEditingAccount(account);
        form.setFieldsValue({
            name: account.name,
            email: account.email,
            facebookId: account.facebookId,
            accessToken: '',
            cookie: ''
        });
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            if (editingAccount) {
                await fbApi.update(editingAccount._id, values);
                message.success('Cập nhật tài khoản thành công!');
            } else {
                await fbApi.create(values);
                message.success('Thêm tài khoản thành công!');
            }
            
            setModalVisible(false);
            form.resetFields();
            setEditingAccount(null);
            fetchAccounts();
        } catch (error: any) {
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fbApi.delete(id);
            message.success('Xóa tài khoản thành công!');
            fetchAccounts();
        } catch (error) {
            message.error('Không thể xóa tài khoản');
        }
    };

    const handleRefresh = async (id: string) => {
        try {
            await fbApi.refresh(id);
            message.success('Đã làm mới token!');
            fetchAccounts();
        } catch (error) {
            message.error('Không thể làm mới token');
        }
    };

    const getTokenStatusTag = (status: string, authMode?: string) => {
        const config: Record<string, any> = {
            valid: { color: 'success', icon: <CheckCircleOutlined />, text: 'Hoạt động' },
            active: { color: 'success', icon: <CheckCircleOutlined />, text: 'Hoạt động' },
            cookie_only: { color: 'processing', icon: <SafetyOutlined />, text: 'Cookie Only' },
            expired: { color: 'error', icon: <CloseCircleOutlined />, text: 'Hết hạn' },
            revoked: { color: 'default', icon: <ExclamationCircleOutlined />, text: 'Bị thu hồi' },
            unknown: { color: 'warning', icon: <ExclamationCircleOutlined />, text: 'Chưa xác định' }
        };
        const c = config[status] || config.unknown;
        
        const authModeText = authMode === 'oauth' ? 'OAuth Token' : 
                            authMode === 'cookie_only' ? 'Cookie Auth' : 'Unknown';
        
        return (
            <Tooltip title={`Auth: ${authModeText}`}>
                <Tag color={c.color} icon={c.icon}>{c.text}</Tag>
            </Tooltip>
        );
    };

    const getHealthStatusBadge = (status?: string) => {
        const config: Record<string, any> = {
            healthy: { status: 'success', text: 'Khỏe mạnh' },
            warning: { status: 'warning', text: 'Cảnh báo' },
            blocked: { status: 'error', text: 'Bị chặn' },
            unknown: { status: 'default', text: 'Chưa kiểm tra' }
        };
        const c = config[status || 'unknown'] || config.unknown;
        return <Badge status={c.status as any} text={c.text} />;
    };

    const stats = {
        total: accounts.length,
        active: accounts.filter(a => ['valid', 'active', 'cookie_only'].includes(a.tokenStatus)).length,
        healthy: accounts.filter(a => a.healthStatusString === 'healthy').length,
        blocked: accounts.filter(a => a.healthStatusString === 'blocked').length
    };

    const columns = [
        {
            title: 'Tài khoản',
            key: 'account',
            render: (_: any, record: FacebookAccount) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#1877F2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <FacebookOutlined style={{ color: '#fff', fontSize: 20 }} />
                    </div>
                    <div>
                        <Text strong>{record.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.email || record.facebookId}
                        </Text>
                    </div>
                </div>
            )
        },
        ...(isAdmin ? [{
            title: 'User sở hữu',
            dataIndex: 'userId',
            key: 'userId',
            render: (userId: any) => userId ? <Tag>{userId.username}</Tag> : <Tag>System</Tag>
        }] : []),
        {
            title: 'Token Status',
            dataIndex: 'tokenStatus',
            key: 'tokenStatus',
            width: 130,
            render: (status: string, record: FacebookAccount) => getTokenStatusTag(status, record.authMode)
        },
        {
            title: 'Sức khỏe',
            dataIndex: 'healthStatusString',
            key: 'healthStatusString',
            width: 130,
            render: (status?: string) => getHealthStatusBadge(status)
        },
        {
            title: 'Token hết hạn',
            dataIndex: 'tokenExpiresAt',
            key: 'tokenExpiresAt',
            width: 150,
            render: (date?: string) => date ? (
                <Tooltip title={dayjs(date).format('DD/MM/YYYY HH:mm')}>
                    <Text type={dayjs(date).isBefore(dayjs()) ? 'danger' : 'secondary'}>
                        {dayjs(date).fromNow()}
                    </Text>
                </Tooltip>
            ) : (
                <Text type="secondary">Không xác định</Text>
            )
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 180,
            render: (_: any, record: FacebookAccount) => (
                <Space>
                    <Tooltip title="Làm mới token">
                        <Button 
                            size="small" 
                            icon={<SyncOutlined />}
                            onClick={() => handleRefresh(record._id)}
                        />
                    </Tooltip>
                    <Tooltip title="Cập nhật">
                        <Button 
                            size="small" 
                            icon={<KeyOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa tài khoản này?"
                        description="Các chiến dịch liên kết sẽ bị dừng"
                        onConfirm={() => handleDelete(record._id)}
                    >
                        <Tooltip title="Xóa">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const menuItems = [
        {
            key: 'auto',
            label: 'Thêm tự động (Extension)',
            icon: <SyncOutlined spin />,
            onClick: handleAutoAddAccount
        },
        {
            type: 'divider' as const
        },
        {
            key: 'manual',
            label: 'Thêm thủ công',
            icon: <KeyOutlined />,
            onClick: handleAdd
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
                        <FacebookOutlined />
                        Quản lý Tài khoản Facebook
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý các tài khoản Facebook để đăng bài tự động
                    </Text>
                </div>
                
                <Space wrap>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={fetchAccounts}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Dropdown menu={{ items: menuItems }}>
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />}
                            style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                        >
                            Thêm tài khoản <DownOutlined />
                        </Button>
                    </Dropdown>
                </Space>
            </div>

            {/* Alert */}
            <Alert
                message="Cách thêm tài khoản Facebook"
                description={
                    <div>
                        <Paragraph style={{ margin: 0 }}>
                            <strong>Cách 1 (Khuyến nghị):</strong> Cài đặt Browser Extension để tự động đồng bộ cookie và token an toàn.<br/>
                            <strong>Cách 2:</strong> Thêm thủ công bằng cách copy cookie từ Developer Tools (F12 → Application → Cookies).
                        </Paragraph>
                    </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Tổng tài khoản" 
                            value={stats.total} 
                            prefix={<FacebookOutlined style={{ color: '#EE4D2D' }} />}
                            valueStyle={{ color: '#EE4D2D' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Token hoạt động" 
                            value={stats.active} 
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Sức khỏe tốt" 
                            value={stats.healthy} 
                            prefix={<SafetyOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Bị chặn" 
                            value={stats.blocked} 
                            prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                <Table
                    columns={columns}
                    dataSource={accounts}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) => `Tổng ${total} tài khoản`
                    }}
                />
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={
                    <Space>
                        <FacebookOutlined style={{ color: '#1877F2' }} />
                        <span>{editingAccount ? 'Cập nhật tài khoản' : 'Thêm tài khoản Facebook'}</span>
                    </Space>
                }
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingAccount(null);
                    form.resetFields();
                }}
                width={600}
                okText={editingAccount ? 'Cập nhật' : 'Thêm tài khoản'}
                cancelText="Hủy"
                okButtonProps={{ style: { background: '#1877F2', borderColor: '#1877F2' } }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="name"
                                label="Tên hiển thị"
                                rules={[{ required: true, message: 'Nhập tên tài khoản' }]}
                            >
                                <Input placeholder="VD: Acc Marketing 1" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="email"
                                label="Email Facebook"
                            >
                                <Input placeholder="email@example.com" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="facebookId"
                        label="Facebook User ID"
                        rules={[{ required: true, message: 'Nhập Facebook ID' }]}
                        extra="Có thể tìm ID tại findmyfbid.com"
                    >
                        <Input placeholder="100000123456789" />
                    </Form.Item>

                    <Divider />

                    <Form.Item
                        name="accessToken"
                        label="Access Token"
                        rules={[{ required: !editingAccount, message: 'Nhập Access Token' }]}
                        extra={editingAccount ? "Để trống nếu không thay đổi" : "Lấy từ Graph API Explorer"}
                    >
                        <TextArea 
                            rows={3} 
                            placeholder="EAABsbCS..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="cookie"
                        label="Cookie (tùy chọn)"
                        extra="Cookie giúp tăng độ tin cậy khi gọi API"
                    >
                        <TextArea 
                            rows={3} 
                            placeholder="c_user=...; xs=...; ..."
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
