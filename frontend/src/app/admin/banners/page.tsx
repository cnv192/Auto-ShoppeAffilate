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
    Statistic,
    Slider,
    Spin
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ReloadOutlined,
    PictureOutlined,
    LinkOutlined
} from '@ant-design/icons';
import { getToken, getCurrentUser } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

const { Title, Text } = Typography;

// ===================== Banner Types (không có popup) =====================
const bannerTypes = [
    { value: 'sticky_bottom', label: 'Dính dưới màn hình' },
    { value: 'center_popup', label: 'Popup giữa màn hình' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'inline', label: 'Trong bài viết' },
    { value: 'header', label: 'Header' }
];

// ===================== API =====================
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
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create banner');
        return json;
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
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update banner');
        return json;
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

const linksApi = {
    getAll: async () => {
        const token = getToken();
        const res = await fetch(getApiUrl('links'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch links');
        return res.json();
    }
};

// ===================== Types =====================
interface Banner {
    _id: string;
    name: string;
    imageUrl: string;
    mobileImageUrl?: string;
    targetSlug: string;
    targetUrl?: string;
    type: string;
    isActive: boolean;
    weight: number;
    priority: number;
    displayWidth: number;
    showDelay: number;
    stats?: {
        impressions: number;
        clicks: number;
        ctr: number;
    };
    createdBy?: any;
    [key: string]: any;
}

interface LinkItem {
    slug: string;
    title: string;
    imageUrl?: string;
}

// ===================== Component =====================
export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [linksLoading, setLinksLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [displayWidth, setDisplayWidth] = useState(50);
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

    const fetchLinks = useCallback(async () => {
        try {
            setLinksLoading(true);
            const response = await linksApi.getAll();
            const data = response.data || response.links || [];
            setLinks(data.map((l: any) => ({
                slug: l.slug,
                title: l.title,
                imageUrl: l.imageUrl
            })));
        } catch (error: any) {
            console.error('Failed to fetch links:', error);
        } finally {
            setLinksLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBanners();
        fetchLinks();
    }, [fetchBanners, fetchLinks]);

    // ===================== Handlers =====================
    const handleAddBanner = () => {
        setEditingId(null);
        form.resetFields();
        setImagePreview(null);
        setDisplayWidth(50);
        setModalVisible(true);
    };

    const handleEditBanner = (record: Banner) => {
        setEditingId(record._id);
        const w = record.displayWidth || 50;
        form.setFieldsValue({
            name: record.name,
            imageUrl: record.imageUrl,
            targetSlug: record.targetSlug,
            targetUrl: record.targetUrl || '',
            type: record.type,
            weight: record.weight || 50,
            priority: record.priority || 10,
            displayWidth: w,
            showDelay: record.showDelay || 0,
            isActive: record.isActive
        });
        setImagePreview(record.imageUrl);
        setDisplayWidth(w);
        setModalVisible(true);
    };

    const handleCancel = () => {
        setModalVisible(false);
        form.resetFields();
        setImagePreview(null);
        setDisplayWidth(50);
        setEditingId(null);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const payload = {
                name: values.name,
                imageUrl: imagePreview || values.imageUrl,
                targetSlug: values.targetSlug,
                targetUrl: values.targetUrl || '',
                type: values.type,
                weight: values.weight,
                priority: values.priority,
                displayWidth: values.displayWidth,
                showDelay: values.showDelay || 0,
                isActive: values.isActive
            };

            if (!payload.targetSlug) {
                message.error('Vui lòng chọn bài viết liên kết');
                setLoading(false);
                return;
            }

            if (!payload.imageUrl) {
                message.error('Vui lòng nhập URL ảnh banner');
                setLoading(false);
                return;
            }

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
            setDisplayWidth(50);
            setEditingId(null);
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
        } catch {
            message.error('URL không hợp lệ');
        }
    };

    // ===================== Stats =====================
    const totalBanners = banners.length;
    const activeBanners = banners.filter(b => b.isActive).length;
    const totalImpressions = banners.reduce((sum, b) => sum + (b.stats?.impressions || 0), 0);
    const totalClicks = banners.reduce((sum, b) => sum + (b.stats?.clicks || 0), 0);

    // ===================== Columns =====================
    const columns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'imageUrl',
            width: 120,
            render: (url: string, record: Banner) => (
                url ? (
                    <div style={{ width: 100, position: 'relative' }}>
                        <Image
                            src={url}
                            alt="banner"
                            width={100}
                            style={{ borderRadius: 4, width: '100%', height: 'auto' }}
                            preview={{ mask: <EyeOutlined /> }}
                        />
                        <Tag color="blue" style={{ position: 'absolute', bottom: 2, right: 2, margin: 0, fontSize: 10 }}>
                            {record.displayWidth || 50}%
                        </Tag>
                    </div>
                ) : (
                    <span style={{ color: '#999' }}>Không có hình</span>
                )
            )
        },
        {
            title: 'Tên banner',
            dataIndex: 'name',
            width: 160,
            ellipsis: true,
            render: (name: string, record: Banner) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        <LinkOutlined /> /{record.targetSlug}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            width: 140,
            render: (type: string) => {
                const typeObj = bannerTypes.find(t => t.value === type);
                return <Tag color="blue">{typeObj?.label || type}</Tag>;
            }
        },
        {
            title: 'Bài viết liên kết',
            dataIndex: 'targetSlug',
            width: 180,
            ellipsis: true,
            render: (slug: string) => {
                const link = links.find(l => l.slug === slug);
                return link ? (
                    <Text style={{ fontSize: 13 }}>{link.title}</Text>
                ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>/{slug}</Text>
                );
            }
        },
        {
            title: 'Tỉ lệ hiển thị',
            dataIndex: 'displayWidth',
            width: 100,
            align: 'center' as const,
            render: (w: number) => <Tag color="geekblue">{w || 50}%</Tag>
        },
        {
            title: 'Delay',
            dataIndex: 'showDelay',
            width: 80,
            align: 'center' as const,
            render: (v: number) => <Tag>{v || 0}s</Tag>
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
            title: 'Stats',
            key: 'stats',
            width: 130,
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
            width: 140,
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
                            <Button type="text" danger icon={<DeleteOutlined />} />
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
                        <PictureOutlined />
                        Quản lý Banner
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý banner hiển thị trên trang bài viết
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => { fetchBanners(); fetchLinks(); }}
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
                            prefix={<PictureOutlined style={{ color: '#D31016' }} />}
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
                        <Statistic title="Lượt xem" value={totalImpressions} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic title="Lượt click" value={totalClicks} />
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
                    <Table loading={true} columns={columns} dataSource={[]} pagination={false} />
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                            Chưa có banner nào
                        </Text>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddBanner}
                            style={{ background: '#D31016', borderColor: '#D31016' }}
                        >
                            Thêm Banner Đầu Tiên
                        </Button>
                    </div>
                )}
            </Card>

            {/* ===================== Add/Edit Modal ===================== */}
            <Modal
                title={editingId ? 'Chỉnh sửa Banner' : 'Thêm Banner Mới'}
                open={modalVisible}
                onCancel={handleCancel}
                footer={null}
                width={640}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        type: 'sticky_bottom',
                        weight: 50,
                        priority: 10,
                        displayWidth: 50,
                        showDelay: 0,
                        isActive: true
                    }}
                >
                    {/* Tên banner */}
                    <Form.Item
                        name="name"
                        label="Tên banner"
                        rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                    >
                        <Input placeholder="Nhập tên banner (nội bộ)" />
                    </Form.Item>

                    {/* Loại banner + bài viết liên kết */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="type"
                                label="Loại banner"
                                rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
                            >
                                <Select options={bannerTypes} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="targetSlug"
                                label={
                                    <Space>
                                        <LinkOutlined />
                                        <span>Bài viết liên kết</span>
                                    </Space>
                                }
                                rules={[{ required: true, message: 'Vui lòng chọn bài viết' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="Tìm và chọn bài viết..."
                                    loading={linksLoading}
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                        (option?.label as string || '').toLowerCase().includes(input.toLowerCase()) ||
                                        (option?.value as string || '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={links.map(l => ({
                                        value: l.slug,
                                        label: l.title || l.slug,
                                    }))}
                                    optionRender={(option) => (
                                        <Space>
                                            <Text ellipsis style={{ maxWidth: 200 }}>{option.label}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>/{option.value}</Text>
                                        </Space>
                                    )}
                                    notFoundContent={linksLoading ? <Spin size="small" /> : 'Không tìm thấy bài viết'}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Link đích */}
                    <Form.Item
                        name="targetUrl"
                        label="Link đích"
                        extra="URL đích khi nhấp vào banner (VD: link Shopee, link affiliate...)"
                        rules={[
                            { type: 'url', message: 'URL không hợp lệ' }
                        ]}
                    >
                        <Input placeholder="https://..." />
                    </Form.Item>

                    {/* Ảnh Banner */}
                    <Form.Item
                        label="Ảnh Banner"
                        required
                        extra="Nhập URL ảnh banner. Chiều cao sẽ tự co theo tỉ lệ gốc của ảnh"
                    >
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                placeholder="Nhập URL ảnh banner"
                                value={imagePreview || ''}
                                onChange={(e) => setImagePreview(e.target.value)}
                                onBlur={() => {
                                    if (imagePreview) handleUrlInput(imagePreview);
                                }}
                            />
                            <Button onClick={() => handleUrlInput(imagePreview || '')}>
                                Xem trước
                            </Button>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item name="imageUrl" hidden>
                        <Input />
                    </Form.Item>

                    {/* Preview ảnh với tỉ lệ displayWidth */}
                    {imagePreview && (
                        <div style={{
                            marginBottom: 24,
                            padding: 16,
                            background: 'rgba(0,0,0,0.04)',
                            borderRadius: 8,
                            textAlign: 'center'
                        }}>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                                Xem trước banner (tỉ lệ {displayWidth}% màn hình)
                            </Text>
                            <div style={{
                                display: 'inline-block',
                                width: `${displayWidth}%`,
                                maxWidth: '100%',
                                borderRadius: 8,
                                overflow: 'hidden',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                border: '2px solid #D31016'
                            }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    style={{ width: '100%', height: 'auto', display: 'block' }}
                                    onError={() => message.error('Không thể tải ảnh từ URL')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tỉ lệ hiển thị */}
                    <Form.Item
                        name="displayWidth"
                        label={`Tỉ lệ hiển thị: ${displayWidth}% chiều rộng màn hình`}
                        extra="Chiều rộng tính theo % viewport. Chiều cao tự động co theo tỉ lệ ảnh gốc"
                    >
                        <Slider
                            min={10}
                            max={100}
                            step={5}
                            value={displayWidth}
                            onChange={(v) => {
                                setDisplayWidth(v);
                                form.setFieldsValue({ displayWidth: v });
                            }}
                            marks={{
                                10: '10%',
                                25: '25%',
                                50: '50%',
                                75: '75%',
                                100: '100%'
                            }}
                            tooltip={{ formatter: (v) => `${v}%` }}
                        />
                    </Form.Item>

                    {/* Thời gian hiển thị + Priority + Active */}
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="showDelay"
                                label="Hiển thị sau"
                                extra="Số giây chờ trước khi hiện banner"
                            >
                                <InputNumber min={0} max={300} style={{ width: '100%' }} addonAfter="giây" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="priority"
                                label="Priority"
                                extra="Số nhỏ = ưu tiên cao"
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
                                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Submit */}
                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
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
