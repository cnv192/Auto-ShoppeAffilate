'use client';

/**
 * Link Form Component - Professional Article Editor
 * 
 * 2-column layout:
 * - Left (40%): Basic info, Slug, Image upload
 * - Right (60%): Rich text editor (Quill)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';

// Import Quill CSS
import 'react-quill/dist/quill.snow.css';

// Dynamic import for ReactQuill (client-side only)
const ReactQuill = dynamic(() => import('react-quill'), { 
    ssr: false,
    loading: () => <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
}) as any;
// CSS import handled in layout or globals

const { Text } = Typography;
const { TextArea } = Input;

// Vietnamese to slug converter
const titleToSlug = (title: string): string => {
    if (!title) return '';
    
    const vietnameseMap: Record<string, string> = {
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
    
    for (const char in vietnameseMap) {
        slug = slug.replace(new RegExp(char, 'g'), vietnameseMap[char]);
    }
    
    slug = slug.replace(/[^\w\s-]/g, '');
    slug = slug.trim().replace(/\s+/g, '-');
    slug = slug.replace(/-+/g, '-');
    slug = slug.slice(0, 50);
    
    return slug;
};

interface LinkFormArticleProps {
    visible: boolean;
    onCancel: () => void;
    onSubmit: (values: any) => Promise<void>;
    editingLink: any | null;
    loading?: boolean;
}

const LinkFormArticle: React.FC<LinkFormArticleProps> = ({ 
    visible, 
    onCancel, 
    onSubmit, 
    editingLink, 
    loading = false 
}) => {
    const [form] = Form.useForm();
    const [imageLoading, setImageLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [isEditorMounted, setIsEditorMounted] = useState(false);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (visible) {
            setPreviewImage(null);
            setEditorContent('');
            setIsEditorMounted(false);
            
            setTimeout(() => {
                setIsEditorMounted(true);
            }, 100);
            
            if (editingLink) {
                const imageUrl = editingLink.imageUrl || '';
                const imageLinkUrl = editingLink.imageLinkUrl || '';
                
                form.setFieldsValue({
                    title: editingLink.title,
                    targetUrl: editingLink.targetUrl,
                    imageUrl: imageUrl,
                    imageLinkUrl: imageLinkUrl,
                    description: editingLink.description,
                    customSlug: editingLink.slug,
                    category: editingLink.category || 'Khuyến mãi',
                    author: editingLink.author || 'Shopee Deals VN',
                    publishedAt: editingLink.publishedAt ? dayjs(editingLink.publishedAt) : dayjs()
                });
                
                if (imageUrl) {
                    setPreviewImage(imageUrl);
                } else if (imageLinkUrl) {
                    setPreviewImage(imageLinkUrl);
                }
                
                setEditorContent(editingLink.content || '');
            } else {
                form.resetFields();
                form.setFieldsValue({
                    category: 'Khuyến mãi',
                    author: 'Shopee Deals VN',
                    publishedAt: dayjs()
                });
            }
        } else {
            setIsEditorMounted(false);
        }
    }, [visible, editingLink, form]);

    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        const generatedSlug = titleToSlug(title);
        form.setFieldValue('customSlug', generatedSlug);
    }, [form]);

    const handleImageUpload = useCallback(async (info: any) => {
        const file = info.file;

        if (file instanceof File || file.originFileObj) {
            const fileToUpload = file instanceof File ? file : file.originFileObj;
            
            try {
                setImageLoading(true);
                
                // Simple base64 encoding for preview (in production, upload to Cloudinary)
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataUrl = e.target?.result as string;
                    setPreviewImage(imageDataUrl);
                    form.setFieldValue('imageUrl', imageDataUrl);
                    setImageLoading(false);
                    message.success('Ảnh đã được chọn!');
                };
                reader.readAsDataURL(fileToUpload);
            } catch (error: any) {
                message.error('Lỗi khi tải ảnh lên: ' + error.message);
                setImageLoading(false);
            }
        }
    }, [form]);

    const handleRemoveImage = useCallback(() => {
        setPreviewImage(null);
        form.setFieldValue('imageUrl', '');
        form.setFieldValue('imageLinkUrl', '');
    }, [form]);

    const handleSubmit = useCallback(async () => {
        try {
            const values = await form.validateFields();
            values.content = editorContent;
            
            if (values.imageLinkUrl && !values.imageUrl) {
                values.imageUrl = values.imageLinkUrl;
            }
            
            delete values.imageLinkUrl;
            
            if (!values.imageUrl) {
                message.error('Vui lòng tải ảnh hoặc nhập link ảnh');
                return;
            }
            
            if (values.publishedAt) {
                values.publishedAt = values.publishedAt.toISOString();
            }
            
            await onSubmit(values);
        } catch (error: any) {
            if (error.errorFields) {
                console.log('Validation errors:', error.errorFields);
            } else {
                console.error('Unexpected error:', error);
            }
        }
    }, [form, editorContent, onSubmit]);

    const handleEditorChange = useCallback((content: string) => {
        setEditorContent(content);
    }, []);

    // Quill modules configuration
    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['blockquote', 'code-block'],
                ['link', 'image', 'video'],
                ['clean']
            ]
        },
        clipboard: {
            matchVisual: false
        }
    }), []);

    const formats = useMemo(() => [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'color', 'background',
        'blockquote', 'code-block',
        'link', 'image', 'video'
    ], []);

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
            destroyOnClose
            styles={{ 
                body: { 
                    padding: '24px',
                    maxHeight: 'calc(90vh - 120px)',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }
            }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                <Row gutter={24}>
                    {/* LEFT COLUMN (40%) - BASIC INFO */}
                    <Col xs={24} md={10}>
                        <div style={{ 
                            background: '#fafafa', 
                            padding: '20px', 
                            borderRadius: '8px'
                        }}>
                            <Typography.Title level={5} style={{ color: '#EE4D2D' }}>
                                📋 Thông tin cơ bản
                            </Typography.Title>
                            <Divider style={{ margin: '12px 0' }} />

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
                                    disabled={true}
                                    prefix="/"
                                    style={{ background: '#f5f5f5' }}
                                />
                            </Form.Item>

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
                                />
                            </Form.Item>

                            <Form.Item
                                name="description"
                                label="Mô tả ngắn (Open Graph)"
                                rules={[{ max: 500, message: 'Mô tả tối đa 500 ký tự' }]}
                            >
                                <TextArea 
                                    placeholder="Mô tả hiển thị khi share lên mạng xã hội..."
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                />
                            </Form.Item>

                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="category" label="Danh mục">
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
                                    <Form.Item name="author" label="Tác giả">
                                        <Input placeholder="Shopee Deals VN" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="publishedAt" label="Ngày đăng">
                                <DatePicker 
                                    style={{ width: '100%' }}
                                    format="DD/MM/YYYY HH:mm"
                                    showTime
                                    placeholder="Chọn ngày đăng"
                                />
                            </Form.Item>

                            <Form.Item
                                name="imageUrl"
                                label={
                                    <Space>
                                        <PictureOutlined />
                                        <span>Ảnh Cover</span>
                                    </Space>
                                }
                            >
                                <Upload.Dragger
                                    accept="image/*"
                                    maxCount={1}
                                    beforeUpload={() => false}
                                    onChange={handleImageUpload}
                                    showUploadList={false}
                                    style={{ borderRadius: 8 }}
                                    fileList={[]}
                                >
                                    {imageLoading ? (
                                        <Spin size="small" />
                                    ) : (
                                        <Space direction="vertical" style={{ textAlign: 'center' }}>
                                            <CloudUploadOutlined style={{ fontSize: 32, color: '#EE4D2D' }} />
                                            <Text>Kéo ảnh vào đây</Text>
                                        </Space>
                                    )}
                                </Upload.Dragger>
                            </Form.Item>

                            <Form.Item
                                name="imageLinkUrl"
                                label={
                                    <Space>
                                        <LinkOutlined />
                                        <span>Hoặc nhập link ảnh</span>
                                    </Space>
                                }
                                rules={[{ type: 'url', message: 'URL ảnh không hợp lệ' }]}
                            >
                                <Input 
                                    placeholder="https://example.com/image.jpg"
                                    allowClear
                                    onChange={(e) => {
                                        const linkUrl = e.target.value.trim();
                                        if (linkUrl) {
                                            try {
                                                new URL(linkUrl);
                                                setPreviewImage(linkUrl);
                                            } catch {
                                                setPreviewImage(null);
                                            }
                                        } else {
                                            const uploadedImageUrl = form.getFieldValue('imageUrl');
                                            setPreviewImage(uploadedImageUrl || null);
                                        }
                                    }}
                                />
                            </Form.Item>

                            {previewImage && (
                                <div style={{
                                    border: '2px solid #EE4D2D',
                                    borderRadius: 8,
                                    padding: 12,
                                    position: 'relative',
                                    marginTop: 16,
                                    background: '#fafafa'
                                }}>
                                    <Image
                                        src={previewImage}
                                        alt="Preview"
                                        style={{ 
                                            maxWidth: '100%',
                                            maxHeight: '300px',
                                            borderRadius: 4
                                        }}
                                        preview={{ mask: 'Xem' }}
                                        onError={() => {
                                            message.error('Không thể tải ảnh từ URL này');
                                            setPreviewImage(null);
                                        }}
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

                    {/* RIGHT COLUMN (60%) - CONTENT */}
                    <Col xs={24} md={14}>
                        <div style={{ 
                            background: 'white',
                            padding: '20px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '8px',
                            minHeight: '600px'
                        }}>
                            <Typography.Title level={5} style={{ color: '#EE4D2D', marginBottom: '12px' }}>
                                ✍️ Nội dung bài viết
                            </Typography.Title>
                            <Divider style={{ margin: '0px 0 20px 0' }} />

                            <div style={{
                                background: '#f9f9f9',
                                padding: '8px',
                                borderBottom: '1px solid #ddd',
                                marginBottom: '20px',
                                borderRadius: '4px 4px 0 0'
                            }}>
                                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                                    💡 <strong>Mẹo:</strong> Sử dụng nút hình ảnh để tải ảnh, nút video để nhúng video từ YouTube.
                                </p>
                            </div>

                            <div className="quill-editor-wrapper" style={{ 
                                minHeight: '450px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                overflow: 'visible'
                            }}>
                                {isEditorMounted ? (
                                    <ReactQuill
                                        theme="snow"
                                        value={editorContent}
                                        onChange={handleEditorChange}
                                        modules={modules}
                                        formats={formats}
                                        placeholder="Viết nội dung bài viết tại đây..."
                                        style={{ minHeight: '400px' }}
                                    />
                                ) : (
                                    <div style={{ 
                                        height: '450px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        background: '#fafafa'
                                    }}>
                                        <Spin tip="Đang tải editor..." />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Col>
                </Row>

                <Divider />

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button 
                            onClick={onCancel} 
                            size="large"
                            disabled={loading}
                        >
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
