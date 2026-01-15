/**
 * Resource Management Component
 * 
 * UI to manage Resource Sets (Comment Templates, Group Lists, Fanpage Lists)
 * Features:
 * - 3 Tabs: "Mẫu Comment", "Danh sách Group", "Danh sách Page"
 * - Table view with CRUD operations
 * - Modal for creating/editing sets
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Tabs,
    Table,
    Button,
    Modal,
    Form,
    Input,
    Space,
    Tag,
    Popconfirm,
    message,
    Typography,
    Tooltip,
    Empty,
    Badge,
    Statistic,
    Row,
    Col
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MessageOutlined,
    TeamOutlined,
    FileTextOutlined,
    ReloadOutlined,
    CopyOutlined,
    CheckOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Text, Title } = Typography;
const { TextArea } = Input;


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Tab configuration
const TAB_CONFIG = {
    comment: {
        key: 'comment',
        label: 'Mẫu Comment',
        icon: <MessageOutlined />,
        color: '#1890ff',
        placeholder: `Nhập các mẫu comment (mỗi dòng 1 mẫu):

Deal hot đây mọi người! 🔥 {link}
Ai cần mua không ạ? 👉 {link}
Giá tốt lắm nè: {link}
Xin chào {name}, check deal này nhé: {link}`,
        description: 'Các mẫu comment sẽ được random sử dụng trong chiến dịch. Hỗ trợ {link} và {name}.',
        itemName: 'mẫu comment'
    },
    group: {
        key: 'group',
        label: 'Danh sách Group',
        icon: <TeamOutlined />,
        color: '#52c41a',
        placeholder: `Nhập link các Facebook Groups (mỗi dòng 1 link):

https://facebook.com/groups/shopee-deal
https://facebook.com/groups/ma-giam-gia
https://facebook.com/groups/flash-sale`,
        description: 'Danh sách Facebook Groups để crawl bài viết tự động.',
        itemName: 'group'
    },
    page: {
        key: 'page',
        label: 'Danh sách Page',
        icon: <FileTextOutlined />,
        color: '#722ed1',
        placeholder: `Nhập link các Facebook Fanpages (mỗi dòng 1 link):

https://facebook.com/shopee.vn
https://facebook.com/lazada.vn
https://facebook.com/tiki.vn`,
        description: 'Danh sách Fanpages để crawl bài viết tự động.',
        itemName: 'fanpage'
    }
};

const ResourceManagement = () => {
    const [activeTab, setActiveTab] = useState('comment');
    const [resourceSets, setResourceSets] = useState({
        comment: [],
        group: [],
        page: []
    });
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSet, setEditingSet] = useState(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    // Fetch resource sets by type
    const fetchResourceSets = useCallback(async (type) => {
        try {
            setLoading(true);
            const token = authService.getToken();
            const res = await fetch(`${API_URL}/api/resource-sets/by-type/${type}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                setResourceSets(prev => ({
                    ...prev,
                    [type]: data.data || []
                }));
            }
        } catch (error) {
            console.error(`Error fetching ${type} resource sets:`, error);
            message.error(`Không thể tải danh sách ${TAB_CONFIG[type].itemName}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch all types on mount
    useEffect(() => {
        fetchResourceSets('comment');
        fetchResourceSets('group');
        fetchResourceSets('page');
    }, [fetchResourceSets]);

    // Handle tab change - refresh data
    const handleTabChange = (key) => {
        setActiveTab(key);
        fetchResourceSets(key);
    };

    // Open modal for creating new set
    const handleAddNew = () => {
        setEditingSet(null);
        form.resetFields();
        form.setFieldsValue({
            type: activeTab
        });
        setModalVisible(true);
    };

    // Open modal for editing
    const handleEdit = (record) => {
        setEditingSet(record);
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            type: record.type,
            content: record.content?.join('\n') || ''
        });
        setModalVisible(true);
    };

    // Handle delete
    const handleDelete = async (id) => {
        try {
            const token = authService.getToken();
            const res = await fetch(`${API_URL}/api/resource-sets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                message.success('Đã xóa thành công');
                fetchResourceSets(activeTab);
            } else {
                message.error(data.message || 'Không thể xóa');
            }
        } catch (error) {
            console.error('Delete error:', error);
            message.error('Lỗi khi xóa');
        }
    };

    // Handle form submit (create/update)
    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            const values = await form.validateFields();
            const token = authService.getToken();
            
            const url = editingSet 
                ? `${API_URL}/api/resource-sets/${editingSet._id}`
                : `${API_URL}/api/resource-sets`;
            
            const method = editingSet ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: values.name,
                    description: values.description,
                    type: activeTab,
                    content: values.content // Backend will parse newline-separated string
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                message.success(editingSet ? 'Đã cập nhật thành công' : 'Đã tạo thành công');
                setModalVisible(false);
                form.resetFields();
                fetchResourceSets(activeTab);
            } else {
                message.error(data.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            if (error.errorFields) {
                message.error('Vui lòng điền đầy đủ thông tin');
            } else {
                console.error('Submit error:', error);
                message.error('Lỗi khi lưu');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Copy content to clipboard
    const handleCopyContent = (record) => {
        const content = record.content?.join('\n') || '';
        navigator.clipboard.writeText(content).then(() => {
            message.success(`Đã copy ${record.content?.length || 0} items`);
        }).catch(() => {
            message.error('Không thể copy');
        });
    };

    // Table columns
    const getColumns = (type) => [
        {
            title: 'Tên',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (text, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{text}</Text>
                    {record.description && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.description}
                        </Text>
                    )}
                </Space>
            )
        },
        ...(isAdmin ? [{
            title: 'User sở hữu',
            dataIndex: 'userId',
            key: 'userId',
            render: (userId) => userId ? <Tag>{userId.username}</Tag> : <Tag>System</Tag>
        }] : []),
        {
            title: 'Số lượng',
            dataIndex: 'content',
            key: 'itemCount',
            width: 120,
            align: 'center',
            render: (content) => (
                <Badge 
                    count={content?.length || 0} 
                    showZero 
                    style={{ backgroundColor: TAB_CONFIG[type].color }}
                />
            )
        },
        {
            title: 'Sử dụng',
            dataIndex: 'usageCount',
            key: 'usageCount',
            width: 100,
            align: 'center',
            render: (count) => (
                <Tag color={count > 0 ? 'green' : 'default'}>
                    {count || 0} lần
                </Tag>
            )
        },
        {
            title: 'Loại',
            key: 'tags',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Space>
                    {record.isDefault && <Tag color="blue">Mặc định</Tag>}
                </Space>
            )
        },
        {
            title: 'Cập nhật',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 150,
            render: (date) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
            )
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 150,
            align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Copy nội dung">
                        <Button 
                            type="text" 
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyContent(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button 
                            type="text" 
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                            disabled={record.isDefault}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xác nhận xóa?"
                        description={`Bạn có chắc muốn xóa "${record.name}"?`}
                        onConfirm={() => handleDelete(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        disabled={record.isDefault}
                    >
                        <Tooltip title={record.isDefault ? 'Không thể xóa set mặc định' : 'Xóa'}>
                            <Button 
                                type="text" 
                                danger 
                                icon={<DeleteOutlined />}
                                disabled={record.isDefault}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Render tab content
    const renderTabContent = (type) => {
        const config = TAB_CONFIG[type];
        const data = resourceSets[type];
        
        return (
            <div>
                {/* Stats */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic 
                                title={`Tổng số Set`}
                                value={data.length}
                                prefix={config.icon}
                                valueStyle={{ color: config.color }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic 
                                title={`Tổng ${config.itemName}`}
                                value={data.reduce((sum, item) => sum + (item.content?.length || 0), 0)}
                                valueStyle={{ color: config.color }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic 
                                title="Tổng lượt sử dụng"
                                value={data.reduce((sum, item) => sum + (item.usageCount || 0), 0)}
                                prefix={<CheckOutlined />}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Table */}
                <Table
                    columns={getColumns(type)}
                    dataSource={data}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} sets`
                    }}
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={`Chưa có ${config.itemName} nào`}
                            >
                                <Button 
                                    type="primary" 
                                    icon={<PlusOutlined />}
                                    onClick={handleAddNew}
                                >
                                    Tạo {config.label} đầu tiên
                                </Button>
                            </Empty>
                        )
                    }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <div style={{ 
                                padding: 12, 
                                background: '#fafafa', 
                                borderRadius: 8,
                                maxHeight: 200,
                                overflow: 'auto'
                            }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                    Nội dung ({record.content?.length || 0} items):
                                </Text>
                                <pre style={{ 
                                    margin: 0, 
                                    whiteSpace: 'pre-wrap',
                                    fontSize: 12,
                                    color: '#666'
                                }}>
                                    {record.content?.join('\n') || 'Trống'}
                                </pre>
                            </div>
                        )
                    }}
                />
            </div>
        );
    };

    return (
        <div style={{ padding: 24 }}>
            <Card
                title={
                    <Space>
                        <FileTextOutlined style={{ color: '#EE4D2D' }} />
                        <Title level={4} style={{ margin: 0 }}>Quản lý Resource Sets</Title>
                    </Space>
                }
                extra={
                    <Space>
                        <Button 
                            icon={<ReloadOutlined />}
                            onClick={() => fetchResourceSets(activeTab)}
                            loading={loading}
                        >
                            Làm mới
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />}
                            onClick={handleAddNew}
                            style={{ background: '#EE4D2D', borderColor: '#EE4D2D' }}
                        >
                            Thêm mới
                        </Button>
                    </Space>
                }
            >
                <Tabs 
                    activeKey={activeTab} 
                    onChange={handleTabChange}
                    type="card"
                    items={Object.values(TAB_CONFIG).map(config => ({
                        key: config.key,
                        label: (
                            <span>
                                {config.icon}
                                <span style={{ marginLeft: 8 }}>{config.label}</span>
                                <Badge 
                                    count={resourceSets[config.key]?.length || 0}
                                    style={{ marginLeft: 8, backgroundColor: config.color }}
                                    size="small"
                                />
                            </span>
                        ),
                        children: renderTabContent(config.key)
                    }))}
                />
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={
                    <Space>
                        {TAB_CONFIG[activeTab].icon}
                        <span>
                            {editingSet ? 'Chỉnh sửa' : 'Tạo mới'} {TAB_CONFIG[activeTab].label}
                        </span>
                    </Space>
                }
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                }}
                width={700}
                confirmLoading={submitting}
                okText={editingSet ? 'Cập nhật' : 'Tạo mới'}
                cancelText="Hủy"
                okButtonProps={{ 
                    style: { background: TAB_CONFIG[activeTab].color, borderColor: TAB_CONFIG[activeTab].color } 
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                >
                    <Form.Item
                        name="name"
                        label="Tên Set"
                        rules={[
                            { required: true, message: 'Vui lòng nhập tên' },
                            { max: 100, message: 'Tối đa 100 ký tự' }
                        ]}
                    >
                        <Input 
                            placeholder="VD: Comment Flash Sale, Groups Shopee Deal..."
                            prefix={TAB_CONFIG[activeTab].icon}
                        />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Mô tả (tùy chọn)"
                        rules={[{ max: 500, message: 'Tối đa 500 ký tự' }]}
                    >
                        <Input placeholder="Mô tả ngắn về set này..." />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label={
                            <Space>
                                <span>Nội dung</span>
                                <Text type="secondary">(mỗi dòng 1 item)</Text>
                            </Space>
                        }
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                        extra={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {TAB_CONFIG[activeTab].description}
                            </Text>
                        }
                    >
                        <TextArea
                            rows={10}
                            placeholder={TAB_CONFIG[activeTab].placeholder}
                            style={{ fontFamily: 'monospace' }}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ResourceManagement;
