/**
 * Link Form Component
 * 
 * Form để tạo/chỉnh sửa link
 * Sử dụng Ant Design Form với validation
 * - Slug tự động tạo từ tiêu đề (VD: "Đánh ghen ở TP Vinh" → "danh-ghen-o-thanh-pho-vinh")
 * - Drag & drop ảnh
 */

import React, { useEffect, useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Button, 
    Space,
    Typography,
    Divider,
    Image,
    Upload,
    message,
    Spin
} from 'antd';
import { 
    LinkOutlined, 
    PictureOutlined, 
    TagOutlined,
    ShopOutlined,
    CloudUploadOutlined,
    DeleteOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * Hàm chuyển đổi tiêu đề thành slug
 * VD: "Đánh ghen ở thành phố Vinh" → "danh-ghen-o-thanh-pho-vinh"
 */
const titleToSlug = (title) => {
    if (!title) return '';
    
    const vietnameseMap = {
        'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'đ': 'd'
    };

    let slug = title.toLowerCase();
    
    // Thay thế ký tự tiếng Việt
    for (let char in vietnameseMap) {
        slug = slug.replace(new RegExp(char, 'g'), vietnameseMap[char]);
    }
    
    // Loại bỏ emoji và ký tự đặc biệt
    slug = slug.replace(/[^\w\s-]/g, '');
    
    // Thay thế khoảng trắng bằng dấu gạch ngang
    slug = slug.trim().replace(/\s+/g, '-');
    
    // Loại bỏ dấu gạch ngang liên tiếp
    slug = slug.replace(/-+/g, '-');
    
    // Giới hạn độ dài
    slug = slug.slice(0, 50);
    
    return slug;
};

const LinkForm = ({ visible, onCancel, onSubmit, editingLink, loading }) => {
    const [form] = Form.useForm();
    const [imageLoading, setImageLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

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
                setPreviewImage(editingLink.imageUrl);
            } else {
                // Chế độ tạo mới - reset form
                form.resetFields();
                setPreviewImage(null);
            }
        }
    }, [visible, editingLink, form]);

    /**
     * Xử lý thay đổi tiêu đề - auto-generate slug
     */
    const handleTitleChange = (e) => {
        const title = e.target.value;
        const generatedSlug = titleToSlug(title);
        form.setFieldValue('customSlug', generatedSlug);
    };

    /**
     * Xử lý upload/drop ảnh
     */
    const handleImageUpload = async (info) => {
        const file = info.file;

        if (file.status === 'uploading') {
            setImageLoading(true);
            return;
        }

        // Đọc file và convert sang base64 hoặc upload lên server
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageDataUrl = e.target.result;
            setPreviewImage(imageDataUrl);
            form.setFieldValue('imageUrl', imageDataUrl);
            setImageLoading(false);
            message.success('Ảnh đã được tải lên!');
        };
        reader.readAsDataURL(file);
    };

    /**
     * Xóa ảnh đã chọn
     */
    const handleRemoveImage = () => {
        setPreviewImage(null);
        form.setFieldValue('imageUrl', '');
    };

    /**
     * Xử lý submit form
     */
    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            await onSubmit(values);
            form.resetFields();
            setPreviewImage(null);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

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
            destroyOnHidden
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
                    extra={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            ℹ️ Slug sẽ tự động tạo từ tiêu đề (VD: "Đánh ghen ở TP Vinh" → "danh-ghen-o-thanh-pho-vinh")
                        </Text>
                    }
                >
                    <Input 
                        placeholder="VD: 🔥 Flash Sale - Giảm 50% Hôm Nay!"
                        size="large"
                        onChange={handleTitleChange}
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
                            <span>Ảnh Preview (Drag & Drop hoặc Upload)</span>
                        </Space>
                    }
                    rules={[
                        { required: true, message: 'Vui lòng tải lên ảnh' }
                    ]}
                    extra={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            📸 Ảnh sẽ hiển thị khi share link lên Facebook, Zalo... Kích thước đề xuất: 1200x630px
                        </Text>
                    }
                >
                    <Upload.Dragger
                        name="image"
                        accept="image/*"
                        maxCount={1}
                        beforeUpload={() => false}
                        onChange={handleImageUpload}
                        showUploadList={false}
                        style={{
                            borderRadius: 8,
                            padding: '20px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Spin spinning={imageLoading}>
                            <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                                <CloudUploadOutlined style={{ fontSize: 32, color: '#EE4D2D' }} />
                                <Text strong>Kéo ảnh vào đây hoặc click để chọn</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Hỗ trợ: JPG, PNG, GIF (Tối đa 10MB)
                                </Text>
                            </Space>
                        </Spin>
                    </Upload.Dragger>
                </Form.Item>

                {/* Preview ảnh */}
                {previewImage && (
                    <Form.Item label="Xem trước ảnh">
                        <div style={{
                            border: '2px solid #EE4D2D',
                            borderRadius: 8,
                            padding: 16,
                            background: '#fafafa',
                            position: 'relative'
                        }}>
                            <Image
                                src={previewImage}
                                alt="Preview"
                                style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: 250,
                                    borderRadius: 4
                                }}
                                preview={{
                                    mask: 'Xem'
                                }}
                            />
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={handleRemoveImage}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    background: 'rgba(255,255,255,0.9)'
                                }}
                            >
                                Xóa
                            </Button>
                        </div>
                    </Form.Item>
                )}

                {/* Custom Slug - Auto-generated từ tiêu đề */}
                <Form.Item
                    name="customSlug"
                    label="Slug (tự động tạo từ tiêu đề)"
                    rules={[
                        { 
                            pattern: /^[a-zA-Z0-9_-]*$/, 
                            message: 'Slug chỉ chứa chữ, số, dấu gạch ngang và gạch dưới' 
                        },
                        { max: 50, message: 'Slug tối đa 50 ký tự' }
                    ]}
                    extra={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            🔗 Tự động tạo từ tiêu đề. Bạn có thể chỉnh sửa nếu cần.
                        </Text>
                    }
                >
                    <Input 
                        placeholder="danh-ghen-o-thanh-pho-vinh"
                        size="large"
                        disabled={editingLink}
                        addonBefore={<span style={{ color: '#999' }}>/</span>}
                    />
                </Form.Item>

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
