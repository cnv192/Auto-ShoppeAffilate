/**
 * Link Form Component - Professional Article Editor
 * 
 * 2-column layout:
 * - Left (40%): Basic info, Slug, Image upload
 * - Right (60%): Rich text editor (Quill)
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
    Spin,
    Row,
    Col,
    DatePicker,
    Select
} from 'antd';
import { 
    LinkOutlined, 
    PictureOutlined, 
    TagOutlined,
    CloudUploadOutlined,
    DeleteOutlined,
    EditOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import dayjs from 'dayjs';

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
    
    for (let char in vietnameseMap) {
        slug = slug.replace(new RegExp(char, 'g'), vietnameseMap[char]);
    }
    
    slug = slug.replace(/[^\w\s-]/g, '');
    slug = slug.trim().replace(/\s+/g, '-');
    slug = slug.replace(/-+/g, '-');
    slug = slug.slice(0, 50);
    
    return slug;
};

const LinkFormArticle = ({ visible, onCancel, onSubmit, editingLink, loading }) => {
    const [form] = Form.useForm();
    const [imageLoading, setImageLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [editorContent, setEditorContent] = useState('');

    useEffect(() => {
        if (visible) {
            if (editingLink) {
                form.setFieldsValue({
                    title: editingLink.title,
                    targetUrl: editingLink.targetUrl,
                    imageUrl: editingLink.imageUrl,
                    description: editingLink.description,
                    customSlug: editingLink.slug,
                    category: editingLink.category || 'Khuyến mãi',
                    author: editingLink.author || 'Shopee Deals VN',
                    publishedAt: editingLink.publishedAt ? dayjs(editingLink.publishedAt) : dayjs()
                });
                setPreviewImage(editingLink.imageUrl);
                setEditorContent(editingLink.content || '');
            } else {
                form.resetFields();
                setPreviewImage(null);
                setEditorContent('');
                form.setFieldsValue({
                    category: 'Khuyến mãi',
                    author: 'Shopee Deals VN',
                    publishedAt: dayjs()
                });
            }
        }
    }, [visible, editingLink, form]);

    const handleTitleChange = (e) => {
        const title = e.target.value;
        const generatedSlug = titleToSlug(title);
        form.setFieldValue('customSlug', generatedSlug);
    };

    const handleImageUpload = async (info) => {
        const file = info.file;

        if (file.status === 'uploading') {
            setImageLoading(true);
            return;
        }

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

    const handleRemoveImage = () => {
        setPreviewImage(null);
        form.setFieldValue('imageUrl', '');
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            // Add content from editor
            values.content = editorContent;
            
            // Convert publishedAt to ISO string
            if (values.publishedAt) {
                values.publishedAt = values.publishedAt.toISOString();
            }
            
            await onSubmit(values);
            form.resetFields();
            setPreviewImage(null);
            setEditorContent('');
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // Quill modules configuration
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
        ]
    };

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'color', 'background',
        'blockquote', 'code-block',
        'link', 'image'
    ];

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined style={{ color: '#EE4D2D' }} />
                    <span>{editingLink ? 'Chỉnh sửa Bài viết' : 'Tạo Bài viết Mới'}</span>
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            footer={null}
            width={1200}
            destroyOnHidden
            styles={{ body: { padding: '24px' } }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                <Row gutter={24}>
                    {/* ============================================================
                        CỘT TRÁI (40%) - THÔNG TIN CƠ BẢN
                        ============================================================ */}
                    <Col xs={24} md={10}>
                        <div style={{ 
                            background: '#fafafa', 
                            padding: '20px', 
                            borderRadius: '8px',
                            height: '100%'
                        }}>
                            <Typography.Title level={5} style={{ color: '#EE4D2D' }}>
                                📋 Thông tin cơ bản
                            </Typography.Title>
                            <Divider style={{ margin: '12px 0' }} />

                            {/* Tiêu đề */}
                            <Form.Item
                                name="title"
                                label="Tiêu đề bài viết"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập tiêu đề' },
                                    { max: 200, message: 'Tiêu đề tối đa 200 ký tự' }
                                ]}
                            >
                                <Input 
                                    placeholder="VD: Khuyến mãi Flash Sale - Giảm 50% Hôm Nay!"
                                    size="large"
                                    onChange={handleTitleChange}
                                    prefix={<TagOutlined />}
                                />
                            </Form.Item>

                            {/* Slug */}
                            <Form.Item
                                name="customSlug"
                                label="Slug (URL)"
                                rules={[
                                    { 
                                        pattern: /^[a-zA-Z0-9_-]*$/, 
                                        message: 'Slug chỉ chứa chữ, số, dấu gạch ngang' 
                                    },
                                    { max: 50, message: 'Slug tối đa 50 ký tự' }
                                ]}
                                extra={<Text type="secondary" style={{ fontSize: 12 }}>Tự động tạo từ tiêu đề</Text>}
                            >
                                <Input 
                                    placeholder="khuyen-mai-flash-sale"
                                    disabled={editingLink}
                                    addonBefore={<span style={{ color: '#999' }}>/</span>}
                                />
                            </Form.Item>

                            {/* Link Shopee */}
                            <Form.Item
                                name="targetUrl"
                                label="Link đích Shopee"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập URL đích' },
                                    { type: 'url', message: 'URL không hợp lệ' }
                                ]}
                            >
                                <TextArea 
                                    placeholder="https://shopee.vn/..."
                                    autoSize={{ minRows: 2, maxRows: 3 }}
                                    prefix={<LinkOutlined />}
                                />
                            </Form.Item>

                            {/* Mô tả ngắn */}
                            <Form.Item
                                name="description"
                                label="Mô tả ngắn (Open Graph)"
                                rules={[
                                    { max: 500, message: 'Mô tả tối đa 500 ký tự' }
                                ]}
                            >
                                <TextArea 
                                    placeholder="Mô tả hiển thị khi share lên mạng xã hội..."
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                />
                            </Form.Item>

                            {/* Category & Author */}
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item
                                        name="category"
                                        label="Danh mục"
                                    >
                                        <Select>
                                            <Select.Option value="Khuyến mãi">Khuyến mãi</Select.Option>
                                            <Select.Option value="Flash Sale">Flash Sale</Select.Option>
                                            <Select.Option value="Thời trang">Thời trang</Select.Option>
                                            <Select.Option value="Điện tử">Điện tử</Select.Option>
                                            <Select.Option value="Làm đẹp">Làm đẹp</Select.Option>
                                            <Select.Option value="Gia dụng">Gia dụng</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="author"
                                        label="Tác giả"
                                    >
                                        <Input placeholder="Shopee Deals VN" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* Published Date */}
                            <Form.Item
                                name="publishedAt"
                                label="Ngày đăng"
                            >
                                <DatePicker 
                                    style={{ width: '100%' }}
                                    format="DD/MM/YYYY HH:mm"
                                    showTime
                                    placeholder="Chọn ngày đăng"
                                />
                            </Form.Item>

                            {/* Ảnh Cover */}
                            <Form.Item
                                name="imageUrl"
                                label={
                                    <Space>
                                        <PictureOutlined />
                                        <span>Ảnh Cover (Drag & Drop)</span>
                                    </Space>
                                }
                                rules={[{ required: true, message: 'Vui lòng tải lên ảnh' }]}
                            >
                                <Upload.Dragger
                                    accept="image/*"
                                    maxCount={1}
                                    beforeUpload={() => false}
                                    onChange={handleImageUpload}
                                    showUploadList={false}
                                    style={{ borderRadius: 8 }}
                                >
                                    <Spin spinning={imageLoading}>
                                        <Space direction="vertical" style={{ textAlign: 'center' }}>
                                            <CloudUploadOutlined style={{ fontSize: 32, color: '#EE4D2D' }} />
                                            <Text>Kéo ảnh vào đây</Text>
                                        </Space>
                                    </Spin>
                                </Upload.Dragger>
                            </Form.Item>

                            {/* Preview ảnh */}
                            {previewImage && (
                                <div style={{
                                    border: '2px solid #EE4D2D',
                                    borderRadius: 8,
                                    padding: 12,
                                    position: 'relative'
                                }}>
                                    <Image
                                        src={previewImage}
                                        alt="Preview"
                                        style={{ 
                                            maxWidth: '100%',
                                            borderRadius: 4
                                        }}
                                        preview={{ mask: 'Xem' }}
                                    />
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={handleRemoveImage}
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            background: 'rgba(255,255,255,0.95)'
                                        }}
                                    >
                                        Xóa
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Col>

                    {/* ============================================================
                        CỘT PHẢI (60%) - NỘI DUNG BÀI VIẾT
                        ============================================================ */}
                    <Col xs={24} md={14}>
                        <div style={{ 
                            background: 'white',
                            padding: '20px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '8px',
                            height: '100%'
                        }}>
                            <Typography.Title level={5} style={{ color: '#EE4D2D' }}>
                                ✍️ Nội dung bài viết
                            </Typography.Title>
                            <Divider style={{ margin: '12px 0 20px' }} />

                            {/* Quill Editor */}
                            <div style={{ minHeight: '500px' }}>
                                <ReactQuill
                                    theme="snow"
                                    value={editorContent}
                                    onChange={setEditorContent}
                                    modules={modules}
                                    formats={formats}
                                    placeholder="Viết nội dung bài viết tại đây..."
                                    style={{ 
                                        height: '450px',
                                        marginBottom: '50px'
                                    }}
                                />
                            </div>

                            <Text type="secondary" style={{ fontSize: 12 }}>
                                💡 <strong>Mẹo:</strong> Sử dụng các công cụ phía trên để format văn bản, 
                                thêm ảnh, link và tạo danh sách. Nội dung này sẽ hiển thị trên trang bài viết.
                            </Text>
                        </div>
                    </Col>
                </Row>

                <Divider />

                {/* Buttons */}
                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button onClick={onCancel} size="large">
                            Hủy
                        </Button>
                        <Button 
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            style={{ 
                                background: '#EE4D2D',
                                borderColor: '#EE4D2D',
                                minWidth: '120px'
                            }}
                        >
                            {editingLink ? '💾 Cập nhật' : '✨ Tạo Bài viết'}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default LinkFormArticle;
