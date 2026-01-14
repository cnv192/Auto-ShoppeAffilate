/**
 * Post ID Extractor Component
 * 
 * Công cụ giúp user extract numeric Post ID từ Facebook URL
 */

import React, { useState } from 'react';
import {
    Card,
    Input,
    Button,
    Space,
    Typography,
    Alert,
    Divider,
    Steps,
    message
} from 'antd';
import {
    LinkOutlined,
    CopyOutlined,
    CheckCircleOutlined,
    WarningOutlined
} from '@ant-design/icons';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

const PostIdExtractor = () => {
    const [url, setUrl] = useState('');
    const [postId, setPostId] = useState('');
    const [error, setError] = useState('');

    const extractPostId = (input) => {
        if (!input) {
            setError('Vui lòng nhập URL');
            return null;
        }

        try {
            const urlObj = new URL(input);
            
            // Check for /share/p/ format
            const shareMatch = urlObj.pathname.match(/\/share\/p\/([^\/]+)/);
            if (shareMatch) {
                setError('⚠️ Đây là permalink mới (/share/p/). Vui lòng làm theo hướng dẫn để lấy URL cũ.');
                return null;
            }
            
            // Format: /posts/123456
            const postsMatch = urlObj.pathname.match(/\/posts\/(\d+)/);
            if (postsMatch) return postsMatch[1];
            
            // Format: /permalink/123456
            const permalinkMatch = urlObj.pathname.match(/\/permalink\/(\d+)/);
            if (permalinkMatch) return permalinkMatch[1];
            
            // Format: story_fbid trong query
            const storyFbid = urlObj.searchParams.get('story_fbid');
            if (storyFbid && /^\d+$/.test(storyFbid)) return storyFbid;
            
            // Format: /photo?fbid=123456
            const fbid = urlObj.searchParams.get('fbid');
            if (fbid && /^\d+$/.test(fbid)) return fbid;
            
            // Check if input is already numeric
            if (/^\d+$/.test(input.trim())) {
                return input.trim();
            }
            
            setError('❌ Không tìm thấy Post ID số trong URL này');
            return null;
            
        } catch (e) {
            // Try if it's just a number
            if (/^\d+$/.test(input.trim())) {
                return input.trim();
            }
            setError('❌ URL không hợp lệ');
            return null;
        }
    };

    const handleExtract = () => {
        setError('');
        setPostId('');
        
        const id = extractPostId(url);
        if (id) {
            setPostId(id);
            message.success('Đã trích xuất Post ID thành công!');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(postId);
        message.success('Đã copy Post ID!');
    };

    return (
        <Card 
            title={<><LinkOutlined /> Công cụ lấy Post ID</>}
            style={{ maxWidth: 800, margin: '20px auto' }}
        >
            <Alert
                message="Tại sao cần Post ID số?"
                description="Facebook có nhiều loại URL. Để comment tự động hoạt động, cần Post ID dạng số (numeric). Tool này giúp bạn lấy ID đúng."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Steps
                direction="vertical"
                size="small"
                current={-1}
                items={[
                    {
                        title: 'Bước 1: Click "..." trên bài viết Facebook',
                        description: 'Chọn "Copy link" hoặc "Sao chép liên kết"'
                    },
                    {
                        title: 'Bước 2: Mở link trong trình duyệt mới',
                        description: 'Paste link vào thanh địa chỉ và Enter. URL sẽ tự động chuyển sang dạng cũ.'
                    },
                    {
                        title: 'Bước 3: Copy URL sau khi chuyển hướng',
                        description: 'Lấy URL từ thanh địa chỉ (dạng .../posts/123456789 hoặc có ?story_fbid=123456789)'
                    },
                    {
                        title: 'Bước 4: Paste vào tool này',
                        description: 'Tool sẽ tự động trích xuất Post ID'
                    }
                ]}
                style={{ marginBottom: 24 }}
            />

            <Divider>Nhập URL Facebook</Divider>

            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Input
                    size="large"
                    placeholder="https://www.facebook.com/groups/xxx/posts/123456789"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    prefix={<LinkOutlined />}
                    onPressEnter={handleExtract}
                />

                <Button 
                    type="primary" 
                    size="large" 
                    block
                    onClick={handleExtract}
                >
                    Trích xuất Post ID
                </Button>

                {error && (
                    <Alert
                        message={error}
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                    />
                )}

                {postId && (
                    <Card 
                        type="inner" 
                        title={<><CheckCircleOutlined /> Post ID hợp lệ</>}
                        style={{ background: '#f6ffed', borderColor: '#52c41a' }}
                        extra={
                            <Button 
                                type="primary" 
                                icon={<CopyOutlined />}
                                onClick={handleCopy}
                            >
                                Copy
                            </Button>
                        }
                    >
                        <Text 
                            strong 
                            style={{ 
                                fontSize: 24, 
                                fontFamily: 'monospace',
                                color: '#52c41a'
                            }}
                        >
                            {postId}
                        </Text>
                        <Divider style={{ margin: '12px 0' }} />
                        <Paragraph type="secondary">
                            ✅ Bạn có thể sử dụng số này trong Campaign
                        </Paragraph>
                    </Card>
                )}
            </Space>

            <Divider />

            <Alert
                message="Ví dụ URL hợp lệ"
                description={
                    <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                        <li>https://www.facebook.com/groups/123/posts/<strong>456789</strong></li>
                        <li>https://www.facebook.com/username/posts/<strong>987654321</strong></li>
                        <li>https://www.facebook.com/permalink.php?story_fbid=<strong>123456789</strong>&id=xxx</li>
                        <li>Hoặc chỉ số: <strong>123456789</strong></li>
                    </ul>
                }
                type="success"
                showIcon
            />
        </Card>
    );
};

export default PostIdExtractor;
