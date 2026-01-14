/**
 * Campaign Form Component
 * 
 * Form tạo/chỉnh sửa chiến dịch Facebook Marketing
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    Form,
    Input,
    Select,
    TimePicker,
    InputNumber,
    Row,
    Col,
    Card,
    Divider,
    Typography,
    Tag,
    Space,
    message,
    Alert
} from 'antd';
import {
    RocketOutlined,
    ClockCircleOutlined,
    FilterOutlined,
    MessageOutlined,
    LinkOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import authService from '../services/authService';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const CampaignForm = ({ visible, editingCampaign, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const [links, setLinks] = useState([]);
    const [facebookAccounts, setFacebookAccounts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch links and FB accounts
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = authService.getToken();
                
                // Fetch links - Backend returns { success: true, data: [...] }
                const linksRes = await fetch(`${API_URL}/api/links`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const linksData = await linksRes.json();
                setLinks(linksData.data || linksData || []);

                // Fetch FB accounts - Backend returns { success: true, data: [...] }
                const fbRes = await fetch(`${API_URL}/api/facebook-accounts`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const fbData = await fbRes.json();
                setFacebookAccounts(fbData.data || fbData.accounts || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        if (visible) {
            fetchData();
        }
    }, [visible]);

    // Set form values when editing
    useEffect(() => {
        if (visible && editingCampaign) {
            form.setFieldsValue({
                name: editingCampaign.name,
                slugs: editingCampaign.slugs || [],
                commentTemplates: editingCampaign.commentTemplates?.join('\n') || '',
                startTime: editingCampaign.startTime ? dayjs(editingCampaign.startTime, 'HH:mm') : dayjs('08:00', 'HH:mm'),
                durationHours: editingCampaign.durationHours || 5,
                minLikes: editingCampaign.filters?.minLikes || 100,
                minComments: editingCampaign.filters?.minComments || 10,
                minShares: editingCampaign.filters?.minShares || 5,
                maxCommentsPerPost: editingCampaign.maxCommentsPerPost || 3,
                delayMin: editingCampaign.delayMin || 30,
                delayMax: editingCampaign.delayMax || 90,
                linkGroups: editingCampaign.linkGroups?.join('\n') || '',
                fanpages: editingCampaign.fanpages?.join('\n') || '',
                targetPostIds: editingCampaign.targetPostIds?.join('\n') || '',
                facebookAccountId: editingCampaign.facebookAccountId
            });
        } else if (visible) {
            form.resetFields();
            form.setFieldsValue({
                startTime: dayjs('08:00', 'HH:mm'),
                durationHours: 5,
                minLikes: 1,
                minComments: 1,
                minShares: 0,
                maxCommentsPerPost: 3,
                delayMin: 30,
                delayMax: 90
            });
        }
    }, [visible, editingCampaign, form]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();
            
            // Format data
            const campaignData = {
                name: values.name,
                slugs: values.slugs,
                commentTemplates: values.commentTemplates.split('\n').filter(t => t.trim()),
                startTime: values.startTime.format('HH:mm'),
                durationHours: values.durationHours,
                filters: {
                    minLikes: values.minLikes,
                    minComments: values.minComments,
                    minShares: values.minShares
                },
                maxCommentsPerPost: values.maxCommentsPerPost,
                delayMin: values.delayMin,
                delayMax: values.delayMax,
                linkGroups: values.linkGroups ? values.linkGroups.split('\n').filter(l => l.trim()) : [],
                fanpages: values.fanpages ? values.fanpages.split('\n').filter(f => f.trim()) : [],
                targetPostIds: values.targetPostIds ? values.targetPostIds.split('\n').filter(p => p.trim()) : [],
                facebookAccountId: values.facebookAccountId
            };

            await onSubmit(campaignData);
            form.resetFields();
        } catch (error) {
            if (error.errorFields) {
                message.error('Vui lòng điền đầy đủ thông tin');
            } else {
                message.error(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <RocketOutlined style={{ color: '#EE4D2D' }} />
                    <span>{editingCampaign ? 'Chỉnh sửa Chiến dịch' : 'Tạo Chiến dịch mới'}</span>
                </Space>
            }
            open={visible}
            onOk={handleSubmit}
            onCancel={onCancel}
            width={900}
            confirmLoading={loading}
            okText={editingCampaign ? 'Cập nhật' : 'Tạo chiến dịch'}
            cancelText="Hủy"
            okButtonProps={{ style: { background: '#EE4D2D', borderColor: '#EE4D2D' } }}
        >
            <Form
                form={form}
                layout="vertical"
                requiredMark="optional"
            >
                {/* Basic Info */}
                <Card 
                    size="small" 
                    title={<><RocketOutlined /> Thông tin cơ bản</>}
                    style={{ marginBottom: 16, background: '#fff5f0', border: '1px solid #ffccc7' }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="name"
                                label="Tên chiến dịch"
                                rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                            >
                                <Input placeholder="VD: Flash Sale 12.12" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="facebookAccountId"
                                label="Tài khoản Facebook"
                                rules={[{ required: true, message: 'Vui lòng chọn tài khoản' }]}
                            >
                                <Select placeholder="Chọn tài khoản FB">
                                    {facebookAccounts.map(acc => (
                                        <Option key={acc._id} value={acc._id}>
                                            {acc.name} ({acc.email})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {/* Content */}
                <Card 
                    size="small" 
                    title={<><LinkOutlined /> Nội dung chiến dịch</>}
                    style={{ marginBottom: 16 }}
                >
                    {/* Comment Mode Selection */}
                    <Alert
                        type="info"
                        showIcon
                        message="🎯 Chế độ Comment - Dual Mode Support"
                        description={
                            <div>
                                <Row gutter={16} style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <div style={{ padding: 8, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
                                            <Text strong>💬 MODE A - Direct Comment (Mặc định)</Text>
                                            <ul style={{ paddingLeft: 20, margin: '4px 0', fontSize: 12 }}>
                                                <li>Comment trực tiếp lên bài viết</li>
                                                <li>Sử dụng: <code>{'{link}'}</code> trong template</li>
                                                <li>Tự động crawl posts từ News Feed/Groups/Pages</li>
                                            </ul>
                                        </div>
                                    </Col>
                                    <Col span={12}>
                                        <div style={{ padding: 8, background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
                                            <Text strong>↩️ MODE B - Reply to Comments (Tự động)</Text>
                                            <ul style={{ paddingLeft: 20, margin: '4px 0', fontSize: 12 }}>
                                                <li>Tự động reply comments của người khác</li>
                                                <li>Hỗ trợ: <code>{'{name}'}</code> + <code>{'{link}'}</code></li>
                                                <li>Backend tự động phát hiện và xử lý</li>
                                            </ul>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        }
                        style={{ marginBottom: 16 }}
                    />

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="slugs"
                                label="Chọn Links Shopee"
                                rules={[{ required: true, message: 'Chọn ít nhất 1 link' }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Chọn các link để comment"
                                    optionLabelProp="label"
                                >
                                    {links.map(link => (
                                        <Option 
                                            key={link.slug} 
                                            value={link.slug}
                                            label={link.title}
                                        >
                                            <div>
                                                <Text strong>{link.title}</Text>
                                                <br />
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    /{link.slug} • {link.clickCount || 0} clicks
                                                </Text>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="commentTemplates"
                                label={
                                    <Space>
                                        <MessageOutlined />
                                        <span>Mẫu comment (mỗi dòng 1 mẫu)</span>
                                    </Space>
                                }
                                rules={[{ required: true, message: 'Nhập ít nhất 1 mẫu comment' }]}
                                extra={
                                    <div style={{ marginTop: 8 }}>
                                        <Text type="secondary">Hệ thống sẽ random chọn 1 mẫu khi comment</Text>
                                        <br />
                                        <Text type="success" strong>✨ Hỗ trợ biến động:</Text>
                                        <ul style={{ paddingLeft: 20, marginTop: 4, fontSize: 12 }}>
                                            <li><code>{'{link}'}</code> - Thay bằng link Shopee của bạn</li>
                                            <li><code>{'{name}'}</code> - Tên người dùng (chỉ dùng khi Reply to Comment)</li>
                                        </ul>
                                    </div>
                                }
                            >
                                <TextArea 
                                    rows={6} 
                                    placeholder={`💬 MODE A - Direct Comment:
Deal hot đây mọi người ơi! 🔥 {link}
Ai đang tìm sản phẩm này không? 👉 {link}
Mình vừa mua được giá tốt: {link}

↩️ MODE B - Reply to Comment:
Xin chào {name}! Check deal này nha: {link}
Cảm ơn {name} đã quan tâm! Link đây: {link}`}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {/* Schedule */}
                <Card 
                    size="small" 
                    title={<><ClockCircleOutlined /> Lịch chạy</>}
                    style={{ marginBottom: 16 }}
                >
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="startTime"
                                label="Giờ bắt đầu mỗi ngày"
                                rules={[{ required: true }]}
                            >
                                <TimePicker 
                                    format="HH:mm" 
                                    style={{ width: '100%' }}
                                    placeholder="08:00"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="durationHours"
                                label="Thời gian chạy (giờ)"
                                rules={[{ required: true }]}
                            >
                                <InputNumber 
                                    min={1} 
                                    max={24} 
                                    style={{ width: '100%' }}
                                    placeholder="5"
                                    suffix="giờ"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="delayMin"
                                label="Delay tối thiểu (giây)"
                                rules={[{ required: true }]}
                                extra="Thời gian chờ tối thiểu giữa các comment"
                            >
                                <InputNumber 
                                    min={10} 
                                    max={300} 
                                    style={{ width: '100%' }}
                                    placeholder="30"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="delayMax"
                                label="Delay tối đa (giây)"
                                rules={[{ required: true }]}
                                extra="Thời gian chờ tối đa giữa các comment"
                            >
                                <InputNumber 
                                    min={10} 
                                    max={600} 
                                    style={{ width: '100%' }}
                                    placeholder="90"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {/* Link Groups & Fanpages */}
                <Card 
                    size="small" 
                    title={<><LinkOutlined /> Nguồn bài viết mục tiêu</>}
                    style={{ marginBottom: 16, background: '#e6f4ff', border: '1px solid #91d5ff' }}
                >
                    {/* Target Post IDs - TÙY CHỌN */}
                    <Form.Item
                        name="targetPostIds"
                        label={<><strong>🎯 Link/ID bài viết Facebook</strong> <Tag color="blue">TÙY CHỌN</Tag></>}
                        extra={
                            <div style={{ marginTop: 8 }}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Chế độ tự động"
                                    description={
                                        <div>
                                            <strong>Để trống</strong> = Tự động crawl bài viết từ News Feed của bạn<br/>
                                            Hệ thống sẽ tìm và comment các bài đủ điều kiện filter.
                                        </div>
                                    }
                                    style={{ marginBottom: 12 }}
                                />
                                <div style={{ color: '#666' }}>
                                    <strong>Hoặc nhập trực tiếp Post ID/URL:</strong>
                                    <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                                        <li><strong>VÍ DỤ HỢP LỆ:</strong> 
                                            <code>https://facebook.com/groups/xxx/posts/123456789</code>
                                        </li>
                                        <li><strong>Hoặc chỉ số:</strong> <code>123456789</code></li>
                                        <li style={{ color: '#ff4d4f' }}><strong>KHÔNG DÙNG:</strong> Link /share/p/xxx</li>
                                    </ul>
                                </div>
                            </div>
                        }
                    >
                        <Input.TextArea 
                            rows={4} 
                            placeholder={`Để trống để tự động crawl từ News Feed

Hoặc nhập Post ID/URL (mỗi dòng 1 bài):
123456789
https://www.facebook.com/groups/xxx/posts/987654321`}
                        />
                    </Form.Item>
                    
                    <Divider style={{ margin: '12px 0' }}>Hoặc crawl từ nguồn cụ thể</Divider>
                    
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="linkGroups"
                                label={<><strong>📁 Facebook Groups</strong> <Tag color="green">ĐÃ HỖ TRỢ</Tag></>}
                                extra="Tự động crawl bài viết từ Groups. Mỗi dòng 1 link group."
                            >
                                <Input.TextArea 
                                    rows={3} 
                                    placeholder={`https://facebook.com/groups/shopee-deal
https://facebook.com/groups/ma-giam-gia`}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="fanpages"
                                label={<><strong>📄 Fanpages</strong> <Tag color="green">ĐÃ HỖ TRỢ</Tag></>}
                                extra="Tự động crawl bài viết từ Fanpages. Mỗi dòng 1 link page."
                            >
                                <Input.TextArea 
                                    rows={3} 
                                    placeholder={`https://facebook.com/shopee.vn
https://facebook.com/deal-hot`}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {/* Filters */}
                <Card 
                    size="small" 
                    title={<><FilterOutlined /> Bộ lọc bài viết</>}
                    extra={<Tag color="orange">Chỉ comment bài đạt điều kiện</Tag>}
                >
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item
                                name="minLikes"
                                label="Tối thiểu Likes"
                            >
                                <InputNumber 
                                    min={0} 
                                    style={{ width: '100%' }}
                                    prefix="👍"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="minComments"
                                label="Tối thiểu Comments"
                            >
                                <InputNumber 
                                    min={0} 
                                    style={{ width: '100%' }}
                                    prefix="💬"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="minShares"
                                label="Tối thiểu Shares"
                            >
                                <InputNumber 
                                    min={0} 
                                    style={{ width: '100%' }}
                                    prefix="↗️"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="maxCommentsPerPost"
                                label="Max comment/bài"
                                extra="Giới hạn spam mỗi bài"
                            >
                                <InputNumber 
                                    min={1} 
                                    max={10} 
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Divider />
                
                <div style={{ 
                    background: '#fffbe6', 
                    padding: 12, 
                    borderRadius: 8,
                    border: '1px solid #ffe58f'
                }}>
                    <Text type="warning">
                        ⚠️ <strong>Lưu ý:</strong> Hệ thống sẽ tự động kiểm tra và dừng chiến dịch nếu phát hiện comment bị xóa hoặc tài khoản bị block để bảo vệ tài khoản Facebook của bạn.
                    </Text>
                </div>
            </Form>
        </Modal>
    );
};

export default CampaignForm;
