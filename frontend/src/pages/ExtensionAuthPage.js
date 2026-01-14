/**
 * Extension Auth Page
 * 
 * Landing page cho automatic extension authentication
 * Route: /ext-auth?code=xxx
 * 
 * Flow:
 * 1. User click "Kết nối Extension" trên web app
 * 2. Web app mở tab mới đến trang này với code
 * 3. Content script của extension detect URL và extract code
 * 4. Extension validate code với backend
 * 5. Trang hiển thị kết quả và tự đóng
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Result, Spin, Button, Typography, Card } from 'antd';
import { 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    LoadingOutlined,
    ChromeOutlined 
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const ExtensionAuthPage = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading'); // loading | success | error | no-extension
    const [message, setMessage] = useState('Đang kết nối với Extension...');
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const code = searchParams.get('code');

        if (!code) {
            setStatus('error');
            setMessage('Không tìm thấy mã xác thực trong URL');
            return;
        }

        console.log('[Auth Page] Received code:', code.substring(0, 8) + '...');

        // Gửi code cho extension thông qua window.postMessage
        window.postMessage({
            type: 'SHOPPE_EXTENSION_AUTH_CODE',
            code: code
        }, '*');

        // Set timeout để check nếu extension không response
        const extensionTimeout = setTimeout(() => {
            setStatus('no-extension');
            setMessage('Không phát hiện Extension. Vui lòng cài đặt extension trước.');
        }, 5000);

        // Lắng nghe response từ extension
        const handleMessage = (event) => {
            // Chỉ xử lý message từ localhost hoặc extension
            if (event.data.type === 'SHOPPE_EXTENSION_AUTH_RESULT') {
                clearTimeout(extensionTimeout);
                console.log('[Auth Page] Received result from extension:', event.data);

                if (event.data.success) {
                    setStatus('success');
                    setMessage('Kết nối thành công! Cửa sổ này sẽ tự động đóng...');
                    
                    // Start countdown for auto-close
                    let count = 5;
                    const countdownInterval = setInterval(() => {
                        count--;
                        setCountdown(count);
                        if (count <= 0) {
                            clearInterval(countdownInterval);
                            window.close();
                        }
                    }, 1000);

                } else {
                    setStatus('error');
                    setMessage(event.data.error || 'Có lỗi xảy ra khi kết nối');
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup
        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(extensionTimeout);
        };

    }, [searchParams]);

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <Card style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
                        <Spin 
                            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} 
                            size="large" 
                        />
                        <Title level={3} style={{ marginTop: 24 }}>Đang kết nối...</Title>
                        <Paragraph type="secondary">{message}</Paragraph>
                        <Paragraph type="secondary" style={{ fontSize: 12 }}>
                            Vui lòng không đóng cửa sổ này
                        </Paragraph>
                    </Card>
                );

            case 'success':
                return (
                    <Result
                        status="success"
                        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        title="Kết nối thành công!"
                        subTitle={
                            <>
                                <Paragraph>{message}</Paragraph>
                                <Text type="secondary">
                                    Tự động đóng sau {countdown} giây...
                                </Text>
                            </>
                        }
                        extra={[
                            <Button 
                                key="close" 
                                type="primary" 
                                onClick={() => window.close()}
                            >
                                Đóng ngay
                            </Button>
                        ]}
                    />
                );

            case 'error':
                return (
                    <Result
                        status="error"
                        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                        title="Lỗi kết nối"
                        subTitle={message}
                        extra={[
                            <Button 
                                key="close" 
                                onClick={() => window.close()}
                            >
                                Đóng
                            </Button>,
                            <Button 
                                key="retry" 
                                type="primary"
                                onClick={() => window.location.reload()}
                            >
                                Thử lại
                            </Button>
                        ]}
                    />
                );

            case 'no-extension':
                return (
                    <Result
                        status="warning"
                        icon={<ChromeOutlined style={{ color: '#faad14' }} />}
                        title="Chưa cài đặt Extension"
                        subTitle={message}
                        extra={[
                            <Button 
                                key="close" 
                                onClick={() => window.close()}
                            >
                                Đóng
                            </Button>,
                            <Button 
                                key="install" 
                                type="primary"
                                onClick={() => {
                                    // TODO: Link to extension download
                                    alert('Vui lòng cài đặt extension theo hướng dẫn');
                                }}
                            >
                                Hướng dẫn cài đặt
                            </Button>
                        ]}
                    >
                        <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
                            <Title level={5}>Hướng dẫn:</Title>
                            <ol style={{ paddingLeft: 20 }}>
                                <li>Tải extension từ trang quản trị</li>
                                <li>Mở <code>about:debugging</code> (Firefox) hoặc <code>chrome://extensions</code> (Chrome)</li>
                                <li>Chọn "Load Temporary Add-on" / "Load unpacked"</li>
                                <li>Chọn file <code>manifest.json</code></li>
                                <li>Quay lại và thử kết nối lại</li>
                            </ol>
                        </div>
                    </Result>
                );

            default:
                return null;
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: 24
        }}>
            <Card 
                style={{ 
                    maxWidth: 600, 
                    width: '100%',
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}
                bodyStyle={{ padding: 40 }}
            >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={2} style={{ marginBottom: 8 }}>
                        🔗 Shoppe Extension Auth
                    </Title>
                    <Paragraph type="secondary">
                        Xác thực kết nối giữa Web App và Browser Extension
                    </Paragraph>
                </div>
                
                {renderContent()}
            </Card>
        </div>
    );
};

export default ExtensionAuthPage;
