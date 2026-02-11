'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Switch,
    Space,
    message,
    Popconfirm,
    Card,
    Tag,
    Typography,
    ColorPicker,
    Badge
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    ReloadOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import { getToken } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

const { Title, Text } = Typography;

interface Category {
    _id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// API functions
const categoryApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('categories'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
    },
    create: async (data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl('categories'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create category');
        }
        return res.json();
    },
    update: async (id: string, data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`categories/${id}`), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update category');
        }
        return res.json();
    },
    delete: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`categories/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete category');
        }
        return res.json();
    }
};

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            const response = await categoryApi.getAll();
            setCategories(response.data || []);
        } catch (error: any) {
            message.error('Lỗi khi tải danh mục: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        form.setFieldsValue({
            color: '#D31016',
            icon: '📰',
            sortOrder: categories.length + 1,
            isActive: true
        });
        setModalVisible(true);
    };

    const handleEdit = (record: Category) => {
        setEditingId(record._id);
        form.setFieldsValue({
            name: record.name,
            slug: record.slug,
            description: record.description,
            color: record.color,
            icon: record.icon,
            sortOrder: record.sortOrder,
            isActive: record.isActive
        });
        setModalVisible(true);
    };

    const handleCancel = () => {
        setModalVisible(false);
        form.resetFields();
        setEditingId(null);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            // Convert ColorPicker value to hex string
            if (values.color && typeof values.color === 'object' && values.color.toHexString) {
                values.color = values.color.toHexString();
            }

            if (editingId) {
                await categoryApi.update(editingId, values);
                message.success('Cập nhật danh mục thành công');
            } else {
                await categoryApi.create(values);
                message.success('Tạo danh mục thành công');
            }

            setModalVisible(false);
            form.resetFields();
            setEditingId(null);
            fetchCategories();
        } catch (error: any) {
            message.error('Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setLoading(true);
            await categoryApi.delete(id);
            message.success('Xóa danh mục thành công');
            fetchCategories();
        } catch (error: any) {
            message.error('Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Icon',
            dataIndex: 'icon',
            width: 60,
            align: 'center' as const,
            render: (icon: string) => (
                <span style={{ fontSize: 20 }}>{icon || '📁'}</span>
            )
        },
        {
            title: 'Tên danh mục',
            dataIndex: 'name',
            width: 180,
            render: (name: string, record: Category) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>/{record.slug}</Text>
                </Space>
            )
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            ellipsis: true,
            width: 250
        },
        {
            title: 'Màu sắc',
            dataIndex: 'color',
            width: 100,
            render: (color: string) => (
                <Tag color={color} style={{ color: '#fff', fontWeight: 500 }}>
                    {color}
                </Tag>
            )
        },
        {
            title: 'Thứ tự',
            dataIndex: 'sortOrder',
            width: 80,
            align: 'center' as const,
            sorter: (a: Category, b: Category) => a.sortOrder - b.sortOrder
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            width: 100,
            render: (isActive: boolean) => (
                <Badge
                    status={isActive ? 'success' : 'default'}
                    text={isActive ? 'Hoạt động' : 'Ẩn'}
                />
            )
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            render: (_: any, record: Category) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title="Bạn có chắc muốn xóa danh mục này?"
                        description="Các bài viết sử dụng danh mục này sẽ không bị xóa"
                        onConfirm={() => handleDelete(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
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
                        <AppstoreOutlined />
                        Quản lý Danh mục
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý danh mục bài viết trên hệ thống
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchCategories}
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
                        Thêm Danh mục
                    </Button>
                </Space>
            </div>

            {/* Table */}
            <Card>
                {categories.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={categories}
                        rowKey="_id"
                        loading={loading}
                        pagination={false}
                    />
                ) : loading ? (
                    <Table loading={true} columns={columns} dataSource={[]} pagination={false} />
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                            Chưa có danh mục nào
                        </Typography.Text>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                            style={{ background: '#D31016', borderColor: '#D31016' }}
                        >
                            Thêm Danh mục Đầu Tiên
                        </Button>
                    </div>
                )}
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={editingId ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Mới'}
                open={modalVisible}
                onCancel={handleCancel}
                footer={null}
                width={500}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        color: '#D31016',
                        icon: '📰',
                        sortOrder: 1,
                        isActive: true
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Tên danh mục"
                        rules={[{ required: true, message: 'Vui lòng nhập tên danh mục' }]}
                    >
                        <Input placeholder="VD: Thời sự, Thế giới, Kinh tế..." />
                    </Form.Item>

                    <Form.Item
                        name="slug"
                        label="Slug (tùy chọn)"
                        extra="Tự động tạo từ tên nếu để trống"
                        rules={[
                            { pattern: /^[a-z0-9-]*$/, message: 'Slug chỉ chứa chữ thường, số và dấu gạch ngang' }
                        ]}
                    >
                        <Input placeholder="thoi-su" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Mô tả"
                    >
                        <Input.TextArea placeholder="Mô tả ngắn về danh mục..." rows={2} />
                    </Form.Item>

                    <Space size={16} style={{ width: '100%' }}>
                        <Form.Item name="icon" label="Icon (Emoji)">
                            <Input style={{ width: 80, textAlign: 'center', fontSize: 20 }} maxLength={4} />
                        </Form.Item>

                        <Form.Item name="color" label="Màu sắc">
                            <ColorPicker showText />
                        </Form.Item>

                        <Form.Item name="sortOrder" label="Thứ tự">
                            <InputNumber min={0} max={100} style={{ width: 80 }} />
                        </Form.Item>

                        <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
                            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>
                    </Space>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
                        <Space>
                            <Button onClick={handleCancel}>Hủy</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                style={{ background: '#D31016', borderColor: '#D31016' }}
                            >
                                {editingId ? 'Cập nhật' : 'Tạo mới'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
