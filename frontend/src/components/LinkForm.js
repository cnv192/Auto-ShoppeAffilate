/**
 * Link Form Component
 * 
 * Form để tạo/chỉnh sửa link
 * Sử dụng Ant Design Form với validation
 */

import React, { useEffect } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Button, 
    Space,
    Typography,
    Divider,
    Image
} from 'antd';
import { 
    LinkOutlined, 
    PictureOutlined, 
    TagOutlined,
    ShopOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

const LinkForm = ({ visible, onCancel, onSubmit, editingLink, loading }) => {
    const [form] = Form.useForm();

    // Reset form khi mở/đóng modal hoặc thay đổi editingLink
    useEffect(() => {
        if (visible) {
            if (editingLink) {
                // Chế độ edit - điền dữ liệu cũ
                form.setFieldsValue({
                    title: editingLink.title,
                    targetUrl: editingLink.targetUrl,
                    imageUrl: editingLink.imageUrl,
                    customSlug: editingLink.slug
                });
            } else {
                // Chế độ tạo mới - reset form
                form.resetFields();
            }
        }
    }, [visible, editingLink, form]);

    /**
     * Xử lý submit form
     */
    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            await onSubmit(values);
            form.resetFields();
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    /**
     * Preview ảnh trong form
     */
    const imageUrl = Form.useWatch('imageUrl', form);

    return (
        <Modal
            title={
                <Space>
                    <ShopOutlined style={{ color: '#EE4D2D' }} />
                    <span>{editingLink ? 'Chỉnh sửa Link' : 'Tạo Link Mới'}</span>
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            footer={null}
            width={600}
            destroyOnClose
        >
            <Divider />
            
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                {/* Tiêu đề */}
                <Form.Item
                    name="title"
                    label={
                        <Space>
                            <TagOutlined />
                            <span>Tiêu đề (hiển thị trên preview)</span>
                        </Space>
                    }
                    rules={[
                        { required: true, message: 'Vui lòng nhập tiêu đề' },
                        { max: 100, message: 'Tiêu đề tối đa 100 ký tự' }
                    ]}
                >
                    <Input 
                        placeholder="VD: 🔥 Flash Sale - Giảm 50% Hôm Nay!"
                        size="large"
                    />
                </Form.Item>

                {/* Link đích Shopee */}
                <Form.Item
                    name="targetUrl"
                    label={
                        <Space>
                            <LinkOutlined />
                            <span>Link đích Shopee</span>
                        </Space>
                    }
                    rules={[
                        { required: true, message: 'Vui lòng nhập URL đích' },
                        { type: 'url', message: 'URL không hợp lệ' }
                    ]}
                    extra={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Nhập link sản phẩm/deal từ Shopee. VD: https://shopee.vn/product/...
                        </Text>
                    }
                >
                    <TextArea 
                        placeholder="https://shopee.vn/..."
                        autoSize={{ minRows: 2, maxRows: 4 }}
                        size="large"
                    />
                </Form.Item>

                {/* Link ảnh Preview */}
                <Form.Item
                    name="imageUrl"
                    label={
                        <Space>
                            <PictureOutlined />
                            <span>Link ảnh Preview</span>
                        </Space>
                    }
                    rules={[
                        { required: true, message: 'Vui lòng nhập URL ảnh' },
                        { type: 'url', message: 'URL ảnh không hợp lệ' }
                    ]}
                    extra={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Ảnh sẽ hiển thị khi share link lên Facebook, Zalo... Kích thước đề xuất: 1200x630px
                        </Text>
                    }
                >
                    <Input 
                        placeholder="https://cf.shopee.vn/file/..."
                        size="large"
                    />
                </Form.Item>

                {/* Preview ảnh */}
                {imageUrl && (
                    <Form.Item label="Xem trước ảnh">
                        <div style={{
                            border: '1px solid #f0f0f0',
                            borderRadius: 8,
                            padding: 8,
                            background: '#fafafa'
                        }}>
                            <Image
                                src={imageUrl}
                                alt="Preview"
                                style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: 200,
                                    borderRadius: 4
                                }}
                                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAH/0AAAA6ZVhJZk1NACoAAAAIAAAAAAAAA/9AAAAASUVORK5CYII="
                            />
                        </div>
                    </Form.Item>
                )}

                {/* Custom Slug (chỉ khi tạo mới) */}
                {!editingLink && (
                    <Form.Item
                        name="customSlug"
                        label="Slug tùy chỉnh (không bắt buộc)"
                        rules={[
                            { 
                                pattern: /^[a-zA-Z0-9_-]*$/, 
                                message: 'Slug chỉ chứa chữ, số, dấu gạch ngang và gạch dưới' 
                            },
                            { max: 20, message: 'Slug tối đa 20 ký tự' }
                        ]}
                        extra={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Để trống sẽ tự động tạo slug ngẫu nhiên. VD: flash50, deal-hot
                            </Text>
                        }
                    >
                        <Input 
                            placeholder="VD: flash50"
                            size="large"
                            addonBefore="/"
                        />
                    </Form.Item>
                )}

                <Divider />

                {/* Buttons */}
                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button onClick={onCancel}>
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
                            {editingLink ? 'Cập nhật' : 'Tạo Link'}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default LinkForm;
