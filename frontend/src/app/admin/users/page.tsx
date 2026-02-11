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
    Select,
    Switch,
    message,
    Popconfirm,
    Typography,
    Row,
    Col,
    Statistic,
    Avatar,
    Tooltip,
    Divider
} from 'antd';
import {
    UserOutlined,
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    EditOutlined,
    CrownOutlined,
    LockOutlined,
    MailOutlined,
    PhoneOutlined,
    TeamOutlined,
    CheckCircleOutlined,
    StopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { getToken, getCurrentUser } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

const userApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('auth/users'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    create: async (data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl('auth/users'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create user');
        }
        return res.json();
    },
    update: async (id: string, data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`auth/users/${id}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update user');
        }
        return res.json();
    },
    delete: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`auth/users/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    }
};

interface User {
    _id: string;
    username: string;
    fullName?: string;
    email?: string;
    phone?: string;
    role: string;
    isActive: boolean;
    stats?: {
        linksCreated?: number;
        campaignsCreated?: number;
        totalClicks?: number;
    };
    createdAt?: string;
    [key: string]: any;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [form] = Form.useForm();
    const currentUser = getCurrentUser();

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await userApi.getAll();
            const data = response.data || response;
            setUsers(data.users || []);
        } catch (error) {
            message.error('Không thể tải danh sách người dùng');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        form.setFieldsValue({
            role: 'user',
            isActive: true
        });
        setModalVisible(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        form.setFieldsValue({
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive
        });
        setModalVisible(true);
    };

    const handleShowDetails = (user: User) => {
        setSelectedUser(user);
        setDetailsModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingUser && !values.password) {
                delete values.password;
            }

            if (editingUser) {
                await userApi.update(editingUser._id, values);
                message.success('Cập nhật người dùng thành công!');
            } else {
                await userApi.create(values);
                message.success('Tạo người dùng mới thành công!');
            }

            setModalVisible(false);
            form.resetFields();
            setEditingUser(null);
            fetchUsers();
        } catch (error: any) {
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await userApi.delete(id);
            message.success('Xóa người dùng thành công!');
            fetchUsers();
        } catch (error) {
            message.error('Không thể xóa người dùng');
        }
    };

    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length
    };

    const columns = [
        {
            title: 'Người dùng',
            key: 'user',
            render: (_: any, record: User) => (
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => handleShowDetails(record)}
                >
                    <Avatar
                        size={40}
                        style={{
                            background: record.role === 'admin' ? '#D31016' : '#1890ff'
                        }}
                        icon={record.role === 'admin' ? <CrownOutlined /> : <UserOutlined />}
                    />
                    <div>
                        <Space>
                            <Text strong>{record.fullName || record.username}</Text>
                            {record.role === 'admin' && (
                                <Tag color="orange" icon={<CrownOutlined />}>Admin</Tag>
                            )}
                        </Space>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            @{record.username}
                        </Text>
                    </div>
                </div>
            )
        },
        {
            title: 'Liên hệ',
            key: 'contact',
            render: (_: any, record: User) => (
                <div>
                    {record.email && (
                        <div>
                            <MailOutlined style={{ color: '#999', marginRight: 8 }} />
                            <Text style={{ fontSize: 13 }}>{record.email}</Text>
                        </div>
                    )}
                    {record.phone && (
                        <div>
                            <PhoneOutlined style={{ color: '#999', marginRight: 8 }} />
                            <Text style={{ fontSize: 13 }}>{record.phone}</Text>
                        </div>
                    )}
                    {!record.email && !record.phone && (
                        <Text type="secondary">Chưa cập nhật</Text>
                    )}
                </div>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 120,
            render: (isActive: boolean) => (
                <Tag
                    color={isActive ? 'success' : 'default'}
                    icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}
                >
                    {isActive ? 'Hoạt động' : 'Vô hiệu'}
                </Tag>
            )
        },
        {
            title: 'Thống kê',
            key: 'stats',
            width: 180,
            render: (_: any, record: User) => {
                const userStats = record.stats || {};
                return (
                    <div style={{ fontSize: 13 }}>
                        <div style={{ marginBottom: 4 }}>
                            <Text strong style={{ color: '#1890ff' }}>
                                📊 {userStats.linksCreated || 0}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                                links
                            </Text>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                            <Text strong style={{ color: '#52c41a' }}>
                                🚀 {userStats.campaignsCreated || 0}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                                chiến dịch
                            </Text>
                        </div>
                        <div>
                            <Text strong style={{ color: '#fa8c16' }}>
                                👁️ {userStats.totalClicks || 0}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                                clicks
                            </Text>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 120,
            render: (_: any, record: User) => (
                <Space>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    {record._id !== currentUser?._id && (
                        <Popconfirm
                            title="Xóa người dùng này?"
                            description="Dữ liệu liên quan sẽ bị ảnh hưởng"
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
                        <TeamOutlined />
                        Quản lý Người dùng
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý tài khoản và phân quyền người dùng
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchUsers}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Thêm người dùng
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Tổng người dùng"
                            value={stats.total}
                            prefix={<TeamOutlined style={{ color: '#D31016' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Admin"
                            value={stats.admins}
                            prefix={<CrownOutlined style={{ color: '#fa8c16' }} />}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Đang hoạt động"
                            value={stats.active}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic
                            title="Đã vô hiệu"
                            value={stats.inactive}
                            valueStyle={{ color: '#999' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                {users.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={users}
                        rowKey="_id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} người dùng`
                        }}
                    />
                ) : loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                        <Table loading={true} columns={columns} dataSource={[]} pagination={false} />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                            Chưa có user nào
                        </Typography.Text>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                            style={{
                                background: '#D31016',
                                borderColor: '#D31016'
                            }}
                        >
                            Thêm User Đầu Tiên
                        </Button>
                    </div>
                )}
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={
                    <Space>
                        <UserOutlined style={{ color: '#D31016' }} />
                        <span>{editingUser ? 'Cập nhật người dùng' : 'Thêm người dùng mới'}</span>
                    </Space>
                }
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingUser(null);
                    form.resetFields();
                }}
                width={600}
                okText={editingUser ? 'Cập nhật' : 'Tạo mới'}
                cancelText="Hủy"
                okButtonProps={{ style: { background: '#D31016', borderColor: '#D31016' } }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="username"
                                label="Tên đăng nhập"
                                rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}
                            >
                                <Input
                                    prefix={<UserOutlined />}
                                    placeholder="username"
                                    disabled={!!editingUser}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="fullName"
                                label="Họ và tên"
                            >
                                <Input placeholder="Nguyễn Văn A" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="email"
                                label="Email"
                                rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
                            >
                                <Input
                                    prefix={<MailOutlined />}
                                    placeholder="email@example.com"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="phone"
                                label="Số điện thoại"
                            >
                                <Input
                                    prefix={<PhoneOutlined />}
                                    placeholder="0901234567"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider />

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="password"
                                label="Mật khẩu"
                                rules={[{ required: !editingUser, message: 'Nhập mật khẩu' }]}
                                extra={editingUser ? "Để trống nếu không thay đổi" : undefined}
                            >
                                <Input.Password
                                    prefix={<LockOutlined />}
                                    placeholder="******"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="role"
                                label="Vai trò"
                                rules={[{ required: true }]}
                            >
                                <Select>
                                    <Select.Option value="user">Người dùng</Select.Option>
                                    <Select.Option value="admin">Admin</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="isActive"
                        label="Trạng thái"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Hoạt động" unCheckedChildren="Vô hiệu" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* User Details Modal */}
            <Modal
                title={
                    <Space>
                        <Avatar
                            style={{
                                background: selectedUser?.role === 'admin' ? '#D31016' : '#1890ff'
                            }}
                            icon={selectedUser?.role === 'admin' ? <CrownOutlined /> : <UserOutlined />}
                        />
                        <span>{selectedUser?.fullName || selectedUser?.username}</span>
                    </Space>
                }
                open={detailsModalVisible}
                onCancel={() => setDetailsModalVisible(false)}
                footer={null}
                width={500}
            >
                {selectedUser && (
                    <div>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Text type="secondary">Username</Text>
                                <div><Text strong>@{selectedUser.username}</Text></div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Vai trò</Text>
                                <div>
                                    <Tag color={selectedUser.role === 'admin' ? 'orange' : 'blue'}>
                                        {selectedUser.role === 'admin' ? 'Admin' : 'User'}
                                    </Tag>
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Email</Text>
                                <div><Text>{selectedUser.email || 'Chưa cập nhật'}</Text></div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Điện thoại</Text>
                                <div><Text>{selectedUser.phone || 'Chưa cập nhật'}</Text></div>
                            </Col>
                        </Row>
                        <Divider />
                        <Row gutter={16}>
                            <Col span={8}>
                                <Statistic
                                    title="Links"
                                    value={selectedUser.stats?.linksCreated || 0}
                                    valueStyle={{ fontSize: 20 }}
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="Chiến dịch"
                                    value={selectedUser.stats?.campaignsCreated || 0}
                                    valueStyle={{ fontSize: 20 }}
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="Clicks"
                                    value={selectedUser.stats?.totalClicks || 0}
                                    valueStyle={{ fontSize: 20 }}
                                />
                            </Col>
                        </Row>
                    </div>
                )}
            </Modal>
        </>
    );
}
