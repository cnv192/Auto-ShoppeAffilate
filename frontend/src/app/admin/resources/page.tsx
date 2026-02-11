'use client';

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
    FolderOutlined
} from '@ant-design/icons';
import { getToken, getCurrentUser } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

const { Text, Title } = Typography;
const { TextArea } = Input;

// Tab configuration
const TAB_CONFIG: Record<string, any> = {
    comment: {
        key: 'comment',
        label: 'Mẫu Comment',
        icon: <MessageOutlined />,
        color: '#1890ff',
        placeholder: `Nhập các mẫu comment (mỗi dòng 1 mẫu):

Deal hot đây mọi người! 🔥 {link}
Ai cần mua không ạ? 👉 {link}
Giá tốt lắm nè: {link}`,
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
https://facebook.com/groups/ma-giam-gia`,
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
https://facebook.com/lazada.vn`,
        description: 'Danh sách Fanpages để crawl bài viết tự động.',
        itemName: 'fanpage'
    }
};

interface ResourceSet {
    _id: string;
    name: string;
    description?: string;
    type: string;
    content?: string[];
    usageCount?: number;
    userId?: { username: string };
    [key: string]: any;
}

export default function ResourcesPage() {
    const [activeTab, setActiveTab] = useState('comment');
    const [resourceSets, setResourceSets] = useState<Record<string, ResourceSet[]>>({
        comment: [],
        group: [],
        page: []
    });
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSet, setEditingSet] = useState<ResourceSet | null>(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const fetchResourceSets = useCallback(async (type: string) => {
        try {
            setLoading(true);
            const token = getToken();
            const res = await fetch(getApiUrl(`resource-sets/by-type/${type}`), {
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

    useEffect(() => {
        fetchResourceSets('comment');
        fetchResourceSets('group');
        fetchResourceSets('page');
    }, [fetchResourceSets]);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        fetchResourceSets(key);
    };

    const handleAddNew = () => {
        setEditingSet(null);
        form.resetFields();
        form.setFieldsValue({ type: activeTab });
        setModalVisible(true);
    };

    const handleEdit = (record: ResourceSet) => {
        setEditingSet(record);
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            type: record.type,
            content: record.content?.join('\n') || ''
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const token = getToken();
            const res = await fetch(getApiUrl(`resource-sets/${id}`), {
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

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            const values = await form.validateFields();
            const token = getToken();
            
            const url = editingSet 
                ? getApiUrl(`resource-sets/${editingSet._id}`)
                : getApiUrl('resource-sets');
            
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
                    content: values.content
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
        } catch (error: any) {
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

    const handleCopyContent = (record: ResourceSet) => {
        const content = record.content?.join('\n') || '';
        navigator.clipboard.writeText(content).then(() => {
            message.success(`Đã copy ${record.content?.length || 0} items`);
        }).catch(() => {
            message.error('Không thể copy');
        });
    };

    const getColumns = (type: string) => [
        {
            title: 'Tên',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (text: string, record: ResourceSet) => (
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
            render: (userId: any) => userId ? <Tag>{userId.username}</Tag> : <Tag>System</Tag>
        }] : []),
        {
            title: 'Số lượng',
            dataIndex: 'content',
            key: 'itemCount',
            width: 120,
            align: 'center' as const,
            render: (content?: string[]) => (
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
            align: 'center' as const,
            render: (count?: number) => (
                <Tag color={(count || 0) > 0 ? 'green' : 'default'}>
                    {count || 0} lần
                </Tag>
            )
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 150,
            render: (_: any, record: ResourceSet) => (
                <Space>
                    <Tooltip title="Copy nội dung">
                        <Button 
                            size="small" 
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyContent(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button 
                            size="small" 
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa resource set này?"
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

    const tabItems = Object.keys(TAB_CONFIG).map(key => ({
        key,
        label: (
            <span>
                {TAB_CONFIG[key].icon}
                <span style={{ marginLeft: 8 }}>{TAB_CONFIG[key].label}</span>
                <Badge 
                    count={resourceSets[key]?.length || 0} 
                    style={{ marginLeft: 8, backgroundColor: TAB_CONFIG[key].color }}
                />
            </span>
        ),
        children: (
            <Table
                columns={getColumns(key)}
                dataSource={resourceSets[key]}
                rowKey="_id"
                loading={loading && activeTab === key}
                pagination={{ pageSize: 10 }}
            />
        )
    }));

    // Stats
    const totalSets = Object.values(resourceSets).flat().length;
    const totalItems = Object.values(resourceSets).flat().reduce((sum, s) => sum + (s.content?.length || 0), 0);

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
                        <FolderOutlined />
                        Quản lý Resource Sets
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý mẫu comment, danh sách group và fanpage
                    </Text>
                </div>
                
                <Space wrap>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={() => fetchResourceSets(activeTab)}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddNew}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Thêm {TAB_CONFIG[activeTab].itemName}
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Tổng resource sets" 
                            value={totalSets} 
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Tổng items" 
                            value={totalItems} 
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Mẫu comment" 
                            value={resourceSets.comment?.length || 0} 
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Statistic 
                            title="Groups + Pages" 
                            value={(resourceSets.group?.length || 0) + (resourceSets.page?.length || 0)} 
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Tabs */}
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={tabItems}
                />
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={editingSet ? 'Chỉnh sửa Resource Set' : `Thêm ${TAB_CONFIG[activeTab].label} mới`}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingSet(null);
                    form.resetFields();
                }}
                width={600}
                okText={editingSet ? 'Cập nhật' : 'Tạo mới'}
                cancelText="Hủy"
                confirmLoading={submitting}
                okButtonProps={{ 
                    style: { background: '#D31016', borderColor: '#D31016' } 
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="name"
                        label="Tên"
                        rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                    >
                        <Input placeholder="VD: Comment Flash Sale" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Mô tả"
                    >
                        <Input placeholder="Mô tả ngắn gọn..." />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label="Nội dung"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                        extra={TAB_CONFIG[activeTab].description}
                    >
                        <TextArea 
                            rows={8} 
                            placeholder={TAB_CONFIG[activeTab].placeholder}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
