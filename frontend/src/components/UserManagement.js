/**
 * User Management Component
 * 
 * Quản lý người dùng (Admin only)
 */

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
import authService from '../services/authService';
import { getApiUrl } from '../config/api';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;
const { Option } = Select;

const userApi = {
    getAll: async () => {
        const token = authService.getToken();
        const res = await fetch(getApiUrl('auth/users'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    create: async (data) => {
        const token = authService.getToken();
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
    update: async (id, data) => {
        const token = authService.getToken();
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
    delete: async (id) => {
        const token = authService.getToken();
        const res = await fetch(getApiUrl(`auth/users/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    }
};

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form] = Form.useForm();
    const currentUser = authService.getCurrentUser();

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await userApi.getAll();
            // API returns { success: true, data: { users: [...], total, page, pages } }
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

    const handleEdit = (user) => {
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

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            // Remove empty password when editing
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
        } catch (error) {
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id) => {
        try {
            await userApi.delete(id);
            message.success('Xóa người dùng thành công!');
            fetchUsers();
        } catch (error) {
            message.error('Không thể xóa người dùng');
        }
    };

    // Stats
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
            render: (_, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar 
                        size={40}
                        style={{ 
                            background: record.role === 'admin' ? '#EE4D2D' : '#1890ff'
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
            render: (_, record) => (
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
            render: (isActive) => (
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
            width: 150,
            render: (_, record) => {
                const stats = record.stats || {};
                return (
                    <div>
                        <Text style={{ fontSize: 12 }}>
                            📊 {stats.linksCreated || 0} links
                        </Text>
                        <br />
                        <Text style={{ fontSize: 12 }}>
                            🚀 {stats.campaignsCreated || 0} chiến dịch
                        </Text>
                    </div>
                );
            }
        },
        {
            title: 'Đăng nhập cuối',
            dataIndex: 'lastLogin',
            key: 'lastLogin',
            width: 150,
            render: (date) => date ? (
                <Tooltip title={dayjs(date).format('DD/MM/YYYY HH:mm')}>
                    <Text type="secondary">{dayjs(date).fromNow()}</Text>
                </Tooltip>
            ) : (
                <Text type="secondary">Chưa đăng nhập</Text>
            )
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 120,
            render: (_, record) => {
                // Can't edit/delete yourself or other admin if you're not the main admin
                const isCurrentUser = record._id === currentUser?._id;
                const canEdit = !isCurrentUser || currentUser?.role === 'admin';
                const canDelete = !isCurrentUser && record.role !== 'admin';
                
                return (
                    <Space>
                        <Tooltip title="Sửa">
                            <Button 
                                size="small" 
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                                disabled={!canEdit}
                            />
                        </Tooltip>
                        {canDelete && (
                            <Popconfirm
                                title="Xóa người dùng này?"
                                description="Dữ liệu của người dùng sẽ bị xóa"
                                onConfirm={() => handleDelete(record._id)}
                            >
                                <Tooltip title="Xóa">
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Tooltip>
                            </Popconfirm>
                        )}
                    </Space>
                );
            }
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
                    <TeamOutlined /> Quản lý Người dùng
                </Title>
                
                <Space>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={fetchUsers}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        size="large"
                        style={{ background: '#EE4D2D', borderColor: '#EE4D2D' }}
                    >
                        Thêm người dùng
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Tổng người dùng" 
                            value={stats.total} 
                            prefix={<TeamOutlined style={{ color: '#EE4D2D' }} />}
                            valueStyle={{ color: '#EE4D2D' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Admin" 
                            value={stats.admins} 
                            prefix={<CrownOutlined style={{ color: '#fa8c16' }} />}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Đang hoạt động" 
                            value={stats.active} 
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 8, background: '#fff' }}>
                        <Statistic 
                            title="Vô hiệu hóa" 
                            value={stats.inactive} 
                            prefix={<StopOutlined style={{ color: '#bfbfbf' }} />}
                            valueStyle={{ color: '#bfbfbf' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 8 }}>
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
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={
                    <Space>
                        <UserOutlined style={{ color: '#EE4D2D' }} />
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
                okText={editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
                cancelText="Hủy"
                okButtonProps={{ style: { background: '#EE4D2D', borderColor: '#EE4D2D' } }}
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
                                rules={[
                                    { required: true, message: 'Nhập tên đăng nhập' },
                                    { min: 3, message: 'Tối thiểu 3 ký tự' },
                                    { pattern: /^[a-zA-Z0-9_]+$/, message: 'Chỉ chứa chữ, số và _' }
                                ]}
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
                                rules={[
                                    { type: 'email', message: 'Email không hợp lệ' }
                                ]}
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
                                    placeholder="0912345678" 
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
                                rules={[
                                    { required: !editingUser, message: 'Nhập mật khẩu' },
                                    { min: 6, message: 'Tối thiểu 6 ký tự' }
                                ]}
                                extra={editingUser ? "Để trống nếu không đổi" : ""}
                            >
                                <Input.Password 
                                    prefix={<LockOutlined />} 
                                    placeholder="••••••" 
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
                                    <Option value="user">
                                        <Space>
                                            <UserOutlined />
                                            User - Người dùng thường
                                        </Space>
                                    </Option>
                                    <Option value="admin">
                                        <Space>
                                            <CrownOutlined style={{ color: '#fa8c16' }} />
                                            Admin - Quản trị viên
                                        </Space>
                                    </Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="isActive"
                        label="Trạng thái"
                        valuePropName="checked"
                    >
                        <Switch 
                            checkedChildren="Hoạt động" 
                            unCheckedChildren="Vô hiệu"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagement;
