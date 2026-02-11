'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    Switch,
    Space,
    message,
    Image,
    Popconfirm,
    Card,
    Badge,
    Tag,
    Typography,
    Row,
    Col,
    Statistic
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ReloadOutlined,
    PictureOutlined
} from '@ant-design/icons';
import { getToken, getCurrentUser } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

const { Title, Text } = Typography;

// API functions
const bannerApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('banners'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch banners');
        return res.json();
    },
    create: async (data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl('banners'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create banner');
        return res.json();
    },
    update: async (id: string, data: any) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`banners/${id}`), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update banner');
        return res.json();
    },
    delete: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`banners/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete banner');
        return res.json();
    },
    toggle: async (id: string) => {
        const token = getToken();
        const res = await fetch(getApiUrl(`banners/${id}/toggle`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to toggle banner');
        return res.json();
    }
};

interface Banner {
    _id: string;
    name: string;
    imageUrl: string;
    mobileImageUrl?: string;
    targetSlug?: string;
    targetUrl?: string;
    type: 'sticky_bottom' | 'popup' | 'center_popup' | 'sidebar' | 'inline' | 'header';
    isActive: boolean;
    weight: number;
    priority: number;
    stats?: {
        impressions: number;
        clicks: number;
        ctr: number;
    };
    createdBy?: any;
    [key: string]: any;
}

const bannerTypes = [
    { value: 'sticky_bottom', label: 'Dính dưới màn hình' },
    { value: 'popup', label: 'Popup' },
    { value: 'center_popup', label: 'Popup giữa màn hình' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'inline', label: 'Trong bài viết' },
    { value: 'header', label: 'Header' }
];

export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [form] = Form.useForm();

    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const fetchBanners = useCallback(async () => {
        try {
            setLoading(true);
            const response = await bannerApi.getAll();
            setBanners(response.data || []);
        } catch (error: any) {
            message.error('Lỗi khi tải danh sách banner: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    const handleAddBanner = () => {
        setEditingId(null);
        form.resetFields();
        setImagePreview(null);
        setModalVisible(true);
    };

    const handleEditBanner = (record: Banner) => {
        setEditingId(record._id);
        form.setFieldsValue({
            name: record.name,
            imageUrl: record.imageUrl,
            mobileImageUrl: record.mobileImageUrl,
            targetSlug: record.targetSlug,
            targetUrl: record.targetUrl,
            type: record.type,
            weight: record.weight || 50,
            priority: record.priority || 0,
            isActive: record.isActive
        });
        setImagePreview(record.imageUrl);
        setModalVisible(true);
    };

    const handleCancel = () => {
        setModalVisible(false);
        form.resetFields();
        setImagePreview(null);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const payload = {
                ...values,
                imageUrl: imagePreview || values.imageUrl
            };

            if (editingId) {
                await bannerApi.update(editingId, payload);
                message.success('Cập nhật banner thành công');
            } else {
                await bannerApi.create(payload);
                message.success('Tạo banner thành công');
            }

            setModalVisible(false);
            form.resetFields();
            setImagePreview(null);
            fetchBanners();
        } catch (error: any) {
            message.error('Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (record: Banner) => {
        try {
            await bannerApi.toggle(record._id);
            message.success(`Banner ${record.isActive ? 'vô hiệu hóa' : 'kích hoạt'} thành công`);
            fetchBanners();
        } catch (error: any) {
            message.error('Lỗi: ' + error.message);
        }
    };

    const handleDeleteBanner = async (id: string) => {
        try {
            setLoading(true);
            await bannerApi.delete(id);
            message.success('Xóa banner thành công');
            fetchBanners();
        } catch (error: any) {
            message.error('Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUrlInput = (url: string) => {
        if (!url.trim()) {
            message.error('Vui lòng nhập URL ảnh');
            return;
        }

        try {
            new URL(url);
            setImagePreview(url);
            form.setFieldsValue({ imageUrl: url });
            message.success('URL ảnh được thêm thành công!');
        } catch {
            message.error('URL không hợp lệ');
        }
    };

    // Stats
    const totalBanners = banners.length;
    const activeBanners = banners.filter(b => b.isActive).length;
    const totalImpressions = banners.reduce((sum, b) => sum + (b.stats?.impressions || 0), 0);
    const totalClicks = banners.reduce((sum, b) => sum + (b.stats?.clicks || 0), 0);

    const columns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'imageUrl',
            width: 100,
            render: (url: string) => (
                url ? (
                    <Image
                        src={url}
                        alt="banner"
                        width={80}
                        height={60}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        preview={{ mask: <EyeOutlined /> }}
                    />
                ) : (
                    <span style={{ color: '#999' }}>Không có hình</span>
                )
            )
        },
        {
            title: 'Tên banner',
            dataIndex: 'name',
            width: 150,
            ellipsis: true
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            width: 120,
            render: (type: string) => {
                const typeObj = bannerTypes.find(t => t.value === type);
                return <Tag color="blue">{typeObj?.label || type}</Tag>;
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            width: 100,
            render: (isActive: boolean) => (
                <Badge
                    status={isActive ? 'success' : 'default'}
                    text={isActive ? 'Active' : 'Inactive'}
                />
            )
        },
        {
            title: 'Weight',
            dataIndex: 'weight',
            width: 80,
            render: (weight: number) => <span>{weight}%</span>
        },
        {
            title: 'Stats',
            key: 'stats',
            width: 150,
            render: (_: any, record: Banner) => (
                <Space direction="vertical" size={0}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        👁 {record.stats?.impressions || 0} views
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        👆 {record.stats?.clicks || 0} clicks
                    </Text>
                </Space>
            )
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            render: (_: any, record: Banner) => (
                <Space>
                    <Button
                        type="text"
                        icon={record.isActive ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => handleToggleActive(record)}
                        title={record.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    />
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEditBanner(record)}
                    />
                    {isAdmin && (
                        <Popconfirm
                            title="Bạn có chắc muốn xóa banner này?"
                            onConfirm={() => handleDeleteBanner(record._id)}
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
                        <PictureOutlined />
                        Quản lý Banner
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý banner quảng cáo A/B testing
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchBanners}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddBanner}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Thêm Banner
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Tổng banner"
                            value={totalBanners}
                            prefix={<PictureOutlined style={{ color: '#EE4D2D' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Đang hoạt động"
                            value={activeBanners}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Lượt xem"
                            value={totalImpressions}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Lượt click"
                            value={totalClicks}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card>
                {banners.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={banners}
                        rowKey="_id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                ) : loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                        <Table loading={true} columns={columns} dataSource={[]} pagination={false} />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                            Chưa có banner nào
                        </Typography.Text>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddBanner}
                            style={{
                                background: '#EE4D2D',
                                borderColor: '#EE4D2D'
                            }}
                        >
                            Thêm Banner Đầu Tiên
                        </Button>
                    </div>
                )}
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                title={editingId ? 'Chỉnh sửa Banner' : 'Thêm Banner Mới'}
                open={modalVisible}
                onCancel={handleCancel}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        type: 'sticky_bottom',
                        weight: 50,
                        priority: 0,
                        isActive: true
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Tên banner"
                        rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                    >
                        <Input placeholder="Nhập tên banner" />
                    </Form.Item>

                    <Form.Item label="Ảnh Banner">
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                placeholder="Nhập URL ảnh hoặc upload"
                                value={imagePreview || ''}
                                onChange={(e) => setImagePreview(e.target.value)}
                            />
                            <Button onClick={() => handleUrlInput(imagePreview || '')}>
                                Xác nhận
                            </Button>
                        </Space.Compact>
                        {imagePreview && (
                            <div style={{ marginTop: 8 }}>
                                <Image
                                    src={imagePreview}
                                    alt="Preview"
                                    width={200}
                                    style={{ borderRadius: 4 }}
                                />
                            </div>
                        )}
                    </Form.Item>

                    <Form.Item name="imageUrl" hidden>
                        <Input />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="type"
                                label="Loại banner"
                                rules={[{ required: true }]}
                            >
                                <Select options={bannerTypes} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="targetSlug"
                                label="Target Slug (Link)"
                            >
                                <Input placeholder="Ví dụ: flash-sale-50" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="weight"
                                label="Weight (A/B)"
                            >
                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="priority"
                                label="Priority"
                            >
                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="isActive"
                                label="Trạng thái"
                                valuePropName="checked"
                            >
                                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={handleCancel}>
                                Hủy
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                style={{
                                    background: '#EE4D2D',
                                    borderColor: '#EE4D2D'
                                }}
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
