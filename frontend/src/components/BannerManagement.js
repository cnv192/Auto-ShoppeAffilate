import React, { useState, useEffect } from 'react';
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
    Spin,
    message,
    Image,
    Popconfirm,
    Card,
    Row,
    Col,
    Upload,
    Badge
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    EyeOutlined,
    EyeInvisibleOutlined
} from '@ant-design/icons';
import api from '../config/api';

const BannerManagement = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form] = Form.useForm();
    const [imagePreview, setImagePreview] = useState(null);
    const [mobileImagePreview, setMobileImagePreview] = useState(null);

    // Load banners on component mount
    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            setLoading(true);
            const response = await api.get('/banners');
            setBanners(response.data.data || []);
        } catch (error) {
            message.error('Lỗi khi tải danh sách banner: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAddBanner = () => {
        setEditingId(null);
        form.resetFields();
        setImagePreview(null);
        setMobileImagePreview(null);
        setModalVisible(true);
    };

    const handleEditBanner = (record) => {
        setEditingId(record._id);
        form.setFieldsValue({
            name: record.name,
            imageUrl: record.imageUrl,
            mobileImageUrl: record.mobileImageUrl,
            targetSlug: record.targetSlug,
            type: record.type,
            device: record.device || 'all',
            weight: record.weight || 50,
            priority: record.priority || 0,
            isActive: record.isActive
        });
        setImagePreview(record.imageUrl);
        setMobileImagePreview(record.mobileImageUrl);
        setModalVisible(true);
    };

    const handleCancel = () => {
        setModalVisible(false);
        form.resetFields();
        setImagePreview(null);
        setMobileImagePreview(null);
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            const payload = {
                ...values,
                imageUrl: imagePreview || values.imageUrl,
                mobileImageUrl: mobileImagePreview || values.mobileImageUrl
            };

            if (editingId) {
                await api.put(`/banners/${editingId}`, payload);
                message.success('Cập nhật banner thành công');
            } else {
                await api.post('/banners', payload);
                message.success('Tạo banner thành công');
            }

            setModalVisible(false);
            form.resetFields();
            setImagePreview(null);
            setMobileImagePreview(null);
            fetchBanners();
        } catch (error) {
            message.error('Lỗi: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (record) => {
        try {
            await api.post(`/banners/${record._id}/toggle`);
            message.success(`Banner ${record.isActive ? 'vô hiệu hóa' : 'kích hoạt'} thành công`);
            fetchBanners();
        } catch (error) {
            message.error('Lỗi: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeleteBanner = async (id) => {
        try {
            setLoading(true);
            await api.delete(`/banners/${id}`);
            message.success('Xóa banner thành công');
            fetchBanners();
        } catch (error) {
            message.error('Lỗi: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleImageUrlChange = (e) => {
        setImagePreview(e.target.value);
    };

    const handleMobileImageUrlChange = (e) => {
        setMobileImagePreview(e.target.value);
    };

    const columns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'imageUrl',
            width: 100,
            render: (url) => (
                url ? (
                    <Image 
                        src={url}
                        alt="banner"
                        width={80}
                        height={60}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        preview={{
                            mask: <EyeOutlined />
                        }}
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
            render: (type) => {
                const typeMap = {
                    sticky_bottom: 'Dán dưới',
                    popup: 'Popup',
                    inline: 'Nội tuyến',
                    sidebar: 'Thanh bên',
                    header: 'Header'
                };
                const colors = {
                    sticky_bottom: 'blue',
                    popup: 'purple',
                    inline: 'green',
                    sidebar: 'orange',
                    header: 'red'
                };
                return <Badge color={colors[type] || 'default'} text={typeMap[type] || type} />;
            }
        },
        {
            title: 'Thiết bị',
            dataIndex: 'device',
            width: 100,
            render: (device) => {
                const deviceMap = {
                    all: 'Tất cả',
                    mobile: 'Di động',
                    desktop: 'Máy tính'
                };
                return deviceMap[device] || device;
            }
        },
        {
            title: 'Ưu tiên',
            dataIndex: 'priority',
            width: 80,
            sorter: (a, b) => a.priority - b.priority,
            render: (priority) => <strong>{priority}</strong>
        },
        {
            title: 'Trọng số',
            dataIndex: 'weight',
            width: 80,
            render: (weight) => `${weight}%`
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            width: 100,
            render: (isActive, record) => (
                <Button
                    type={isActive ? 'primary' : 'default'}
                    icon={isActive ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    onClick={() => handleToggleActive(record)}
                    size="small"
                >
                    {isActive ? 'Bật' : 'Tắt'}
                </Button>
            )
        },
        {
            title: 'Hành động',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        ghost
                        icon={<EditOutlined />}
                        onClick={() => handleEditBanner(record)}
                        size="small"
                    />
                    <Popconfirm
                        title="Xóa banner"
                        description="Bạn có chắc chắn muốn xóa banner này không?"
                        onConfirm={() => handleDeleteBanner(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Spin spinning={loading}>
            <Card
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Quản lý Banner</span>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddBanner}
                        >
                            Thêm Banner
                        </Button>
                    </div>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
                <Table
                    columns={columns}
                    dataSource={banners}
                    rowKey="_id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} banner`,
                        pageSizeOptions: ['10', '20', '50']
                    }}
                    scroll={{ x: 1200 }}
                />
            </Card>

            {/* Modal Create/Edit */}
            <Modal
                title={editingId ? 'Chỉnh sửa Banner' : 'Tạo Banner Mới'}
                open={modalVisible}
                onCancel={handleCancel}
                footer={null}
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    {/* Tên banner */}
                    <Form.Item
                        name="name"
                        label="Tên Banner"
                        rules={[{ required: true, message: 'Vui lòng nhập tên banner' }]}
                    >
                        <Input placeholder="Nhập tên banner" />
                    </Form.Item>

                    {/* Desktop Image */}
                    <Form.Item
                        name="imageUrl"
                        label="URL Hình ảnh (Desktop)"
                        rules={[{ required: true, message: 'Vui lòng nhập URL hình ảnh' }]}
                    >
                        <Input
                            placeholder="https://example.com/banner.jpg"
                            onChange={handleImageUrlChange}
                        />
                    </Form.Item>

                    {/* Desktop Image Preview */}
                    {imagePreview && (
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>Xem trước (Desktop):</div>
                                <Image
                                    src={imagePreview}
                                    alt="preview"
                                    width="100%"
                                    height={150}
                                    style={{ objectFit: 'cover', borderRadius: 4 }}
                                />
                            </Col>
                        </Row>
                    )}

                    {/* Mobile Image */}
                    <Form.Item
                        name="mobileImageUrl"
                        label="URL Hình ảnh (Mobile) - Tùy chọn"
                    >
                        <Input
                            placeholder="https://example.com/banner-mobile.jpg"
                            onChange={handleMobileImageUrlChange}
                        />
                    </Form.Item>

                    {/* Mobile Image Preview */}
                    {mobileImagePreview && (
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>Xem trước (Mobile):</div>
                                <Image
                                    src={mobileImagePreview}
                                    alt="preview-mobile"
                                    width="100%"
                                    height={150}
                                    style={{ objectFit: 'cover', borderRadius: 4 }}
                                />
                            </Col>
                        </Row>
                    )}

                    {/* Target Slug */}
                    <Form.Item
                        name="targetSlug"
                        label="Slug bài viết (URL đích)"
                        rules={[{ required: true, message: 'Vui lòng nhập slug bài viết' }]}
                    >
                        <Input
                            placeholder="article-slug"
                            prefix="/"
                        />
                    </Form.Item>

                    {/* Type */}
                    <Form.Item
                        name="type"
                        label="Loại Banner"
                        rules={[{ required: true, message: 'Vui lòng chọn loại banner' }]}
                    >
                        <Select placeholder="Chọn loại banner">
                            <Select.Option value="sticky_bottom">Dán dưới (Sticky Bottom)</Select.Option>
                            <Select.Option value="popup">Popup</Select.Option>
                            <Select.Option value="inline">Nội tuyến (Inline)</Select.Option>
                            <Select.Option value="sidebar">Thanh bên (Sidebar)</Select.Option>
                            <Select.Option value="header">Header</Select.Option>
                        </Select>
                    </Form.Item>

                    {/* Device */}
                    <Form.Item
                        name="device"
                        label="Loại Thiết bị"
                        initialValue="all"
                    >
                        <Select>
                            <Select.Option value="all">Tất cả thiết bị</Select.Option>
                            <Select.Option value="mobile">Di động</Select.Option>
                            <Select.Option value="desktop">Máy tính</Select.Option>
                        </Select>
                    </Form.Item>

                    {/* Weight */}
                    <Form.Item
                        name="weight"
                        label="Trọng số A/B Testing (0-100)"
                        initialValue={50}
                        rules={[
                            { required: true, message: 'Vui lòng nhập trọng số' },
                            { type: 'number', min: 0, max: 100, message: 'Giá trị phải từ 0-100' }
                        ]}
                    >
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>

                    {/* Priority */}
                    <Form.Item
                        name="priority"
                        label="Ưu tiên hiển thị"
                        initialValue={0}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    {/* Active Status */}
                    <Form.Item
                        name="isActive"
                        label="Kích hoạt banner"
                        valuePropName="checked"
                        initialValue={true}
                    >
                        <Switch />
                    </Form.Item>

                    {/* Buttons */}
                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={handleCancel}>Hủy</Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                {editingId ? 'Cập nhật' : 'Tạo'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </Spin>
    );
};

export default BannerManagement;
