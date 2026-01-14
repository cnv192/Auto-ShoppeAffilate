/**
 * Extension Setup Guide Component
 * 
 * Hướng dẫn user cài đặt và sử dụng Browser Extension
 * để đồng bộ tài khoản Facebook
 * 
 * Features:
 * - Auto-connect: One-click kết nối extension (không cần copy token thủ công)
 * - Manual fallback: Vẫn hỗ trợ copy token nếu auto-connect không hoạt động
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Steps,
    Button,
    Typography,
    Space,
    Alert,
    Input,
    message,
    Spin,
    Tag,
    Divider,
    Result,
    Collapse
} from 'antd';
import {
    ChromeOutlined,
    FacebookOutlined,
    SyncOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    ReloadOutlined,
    DownloadOutlined,
    LinkOutlined,
    ThunderboltOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ExtensionSetupGuide = ({ onComplete, onCancel }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [extensionToken, setExtensionToken] = useState(null);
    const [tokenExpiry, setTokenExpiry] = useState(null);
    const [syncedAccounts, setSyncedAccounts] = useState([]);
    const [checkingAccounts, setCheckingAccounts] = useState(false);
    const [autoConnecting, setAutoConnecting] = useState(false);
    const [autoConnectError, setAutoConnectError] = useState(null);

    /**
     * Lấy token cho extension (fallback manual method)
     */
    const fetchExtensionToken = useCallback(async () => {
        try {
            setLoading(true);
            const token = authService.getToken();
            
            const response = await fetch(`${API_URL}/api/extension/auth-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                setExtensionToken(data.data.tempToken);
                setTokenExpiry(new Date(data.data.expiresAt));
            } else {
                message.error(data.message || 'Không thể tạo token');
            }
        } catch (error) {
            console.error('Fetch token error:', error);
            message.error('Lỗi kết nối server');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * AUTO-CONNECT: One-click kết nối extension
     * Flow: Generate auth code → Open auth page → Extension validates → Poll for completion
     */
    const handleAutoConnect = async () => {
        try {
            setAutoConnecting(true);
            setAutoConnectError(null);
            
            const token = authService.getToken();
            
            // 1. Generate auth code
            const response = await fetch(`${API_URL}/api/extension/generate-auth-code`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Không thể tạo mã xác thực');
            }
            
            const { code, authUrl } = await response.json();
            console.log('[Web] Auth code generated:', code.substring(0, 8) + '...');
            
            // 2. Mở tab mới với URL chứa code
            const authWindow = window.open(
                authUrl,
                'extension-auth',
                'width=600,height=500,top=100,left=100'
            );
            
            if (!authWindow) {
                throw new Error('Popup bị chặn. Vui lòng cho phép popup và thử lại.');
            }
            
            // 3. Poll để check khi extension hoàn tất
            let attempts = 0;
            const maxAttempts = 30; // 60 seconds timeout
            
            const pollInterval = setInterval(async () => {
                attempts++;
                
                try {
                    const statusRes = await fetch(`${API_URL}/api/extension/auth-status/${code}`);
                    const status = await statusRes.json();
                    
                    if (status.completed) {
                        clearInterval(pollInterval);
                        setAutoConnecting(false);
                        
                        // Close auth window nếu vẫn mở
                        if (authWindow && !authWindow.closed) {
                            authWindow.close();
                        }
                        
                        message.success('🎉 Extension đã kết nối thành công!');
                        setCurrentStep(2); // Move to sync step
                        
                        // Check synced accounts
                        checkSyncedAccounts();
                    }
                    
                    // Timeout
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        setAutoConnecting(false);
                        setAutoConnectError('Hết thời gian chờ. Vui lòng thử lại hoặc sử dụng phương pháp thủ công.');
                    }
                    
                } catch (err) {
                    console.error('[Web] Polling error:', err);
                }
                
            }, 2000); // Poll every 2 seconds
            
        } catch (error) {
            console.error('[Web] Auto-connect error:', error);
            setAutoConnectError(error.message);
            setAutoConnecting(false);
        }
    };

    /**
     * Copy token vào clipboard
     */
    const copyToken = () => {
        if (extensionToken) {
            navigator.clipboard.writeText(extensionToken);
            message.success('Đã copy token!');
        }
    };

    /**
     * Kiểm tra accounts đã sync
     */
    const checkSyncedAccounts = useCallback(async () => {
        try {
            setCheckingAccounts(true);
            const token = authService.getToken();
            
            const response = await fetch(`${API_URL}/api/extension/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSyncedAccounts(data.data.accounts || []);
                
                if (data.data.accounts?.length > 0) {
                    setCurrentStep(3); // Move to complete step
                }
            }
        } catch (error) {
            console.error('Check accounts error:', error);
        } finally {
            setCheckingAccounts(false);
        }
    }, []);

    /**
     * Load token khi component mount
     */
    useEffect(() => {
        fetchExtensionToken();
    }, [fetchExtensionToken]);

    /**
     * Poll để check accounts mới (khi ở step 2)
     */
    useEffect(() => {
        let interval;
        
        if (currentStep === 2) {
            // Check every 3 seconds
            interval = setInterval(checkSyncedAccounts, 3000);
            // Initial check
            checkSyncedAccounts();
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentStep, checkSyncedAccounts]);

    /**
     * Render step content
     */
    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="step-content">
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <ChromeOutlined style={{ fontSize: 64, color: '#4285F4', marginBottom: 16 }} />
                            <Title level={4}>Cài đặt Extension</Title>
                            <Paragraph type="secondary">
                                Extension giúp đồng bộ tài khoản Facebook một cách an toàn và nhanh chóng.
                                Không cần nhập mật khẩu Facebook.
                            </Paragraph>
                        </div>
                        
                        <Alert
                            type="info"
                            message="Hỗ trợ Chrome và Edge"
                            description="Extension hoạt động trên Chrome, Edge và các trình duyệt dựa trên Chromium."
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<DownloadOutlined />}
                                block
                                onClick={() => {
                                    // In production, link to Chrome Web Store
                                    message.info('Extension đang được phát triển. Hãy load unpacked từ folder facebook-sync-extension');
                                }}
                            >
                                Cài từ Chrome Web Store
                            </Button>
                            
                            <Divider>hoặc</Divider>
                            
                            <Card size="small" title="Load Extension thủ công (Developer)">
                                <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
                                    <li>Mở Chrome → <code>chrome://extensions</code></li>
                                    <li>Bật "Developer mode"</li>
                                    <li>Click "Load unpacked"</li>
                                    <li>Chọn folder <code>facebook-sync-extension</code></li>
                                </ol>
                            </Card>
                        </Space>
                        
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <Button type="primary" onClick={() => setCurrentStep(1)}>
                                Đã cài Extension → Tiếp tục
                            </Button>
                        </div>
                    </div>
                );
                
            case 1:
                return (
                    <div className="step-content">
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ 
                                width: 80, 
                                height: 80, 
                                borderRadius: 16,
                                background: 'linear-gradient(135deg, #EE4D2D 0%, #FF6633 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px',
                                fontSize: 32,
                                color: 'white',
                                fontWeight: 'bold'
                            }}>
                                �
                            </div>
                            <Title level={4}>Kết nối Extension</Title>
                            <Paragraph type="secondary">
                                Click nút bên dưới để tự động kết nối Extension với hệ thống.
                            </Paragraph>
                        </div>
                        
                        {/* AUTO-CONNECT: Recommended method */}
                        <Card 
                            style={{ marginBottom: 16 }}
                            bodyStyle={{ textAlign: 'center', padding: 24 }}
                        >
                            <ThunderboltOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 16 }} />
                            <Title level={5}>Kết nối tự động (Khuyến nghị)</Title>
                            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                                Chỉ cần click một nút, Extension sẽ tự động được kết nối.
                            </Paragraph>
                            
                            {autoConnectError && (
                                <Alert
                                    type="error"
                                    message={autoConnectError}
                                    showIcon
                                    style={{ marginBottom: 16, textAlign: 'left' }}
                                />
                            )}
                            
                            <Button 
                                type="primary" 
                                size="large"
                                icon={<LinkOutlined />}
                                loading={autoConnecting}
                                onClick={handleAutoConnect}
                                style={{ minWidth: 200 }}
                            >
                                {autoConnecting ? 'Đang kết nối...' : '🚀 Kết nối Extension'}
                            </Button>
                            
                            {autoConnecting && (
                                <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                                    Một cửa sổ mới sẽ mở ra. Đợi cho đến khi thấy "Thành công".
                                </Paragraph>
                            )}
                        </Card>
                        
                        {/* MANUAL FALLBACK: For troubleshooting */}
                        <Collapse ghost>
                            <Panel header="🔧 Phương pháp thủ công (nếu tự động không hoạt động)" key="manual">
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: 40 }}>
                                        <Spin size="large" />
                                        <p style={{ marginTop: 16 }}>Đang tạo token...</p>
                                    </div>
                                ) : extensionToken ? (
                                    <>
                                        <Alert
                                            type="warning"
                                            message={`Token hết hạn sau ${tokenExpiry ? Math.round((tokenExpiry - new Date()) / 60000) : '?'} phút`}
                                            showIcon
                                            style={{ marginBottom: 16 }}
                                        />
                                        
                                        <Input.Group compact style={{ marginBottom: 16 }}>
                                            <Input 
                                                value={extensionToken} 
                                                readOnly 
                                                style={{ width: 'calc(100% - 100px)' }}
                                            />
                                            <Button 
                                                type="primary" 
                                                icon={<CopyOutlined />}
                                                onClick={copyToken}
                                                style={{ width: 100 }}
                                            >
                                                Copy
                                            </Button>
                                        </Input.Group>
                                        
                                        <Card size="small" title="Hướng dẫn">
                                            <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
                                                <li>Click vào icon Extension trên toolbar trình duyệt</li>
                                                <li>Dán token vào ô "Token xác thực"</li>
                                                <li>Click "Lưu Token"</li>
                                            </ol>
                                        </Card>
                                        
                                        <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }}>
                                            <Button onClick={fetchExtensionToken} icon={<ReloadOutlined />}>
                                                Tạo token mới
                                            </Button>
                                            <Button type="primary" onClick={() => setCurrentStep(2)}>
                                                Đã dán token → Tiếp tục
                                            </Button>
                                        </Space>
                                    </>
                                ) : (
                                    <Result
                                        status="error"
                                        title="Không thể tạo token"
                                        extra={
                                            <Button type="primary" onClick={fetchExtensionToken}>
                                                Thử lại
                                            </Button>
                                        }
                                    />
                                )}
                            </Panel>
                        </Collapse>
                    </div>
                );
                
            case 2:
                return (
                    <div className="step-content">
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <FacebookOutlined style={{ fontSize: 64, color: '#1877F2', marginBottom: 16 }} />
                            <Title level={4}>Đồng bộ tài khoản</Title>
                            <Paragraph type="secondary">
                                Đăng nhập Facebook (nếu chưa) và click nút "Đồng bộ" trong Extension.
                            </Paragraph>
                        </div>
                        
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Button 
                                type="default" 
                                size="large" 
                                icon={<FacebookOutlined />}
                                block
                                onClick={() => window.open('https://www.facebook.com', '_blank')}
                            >
                                Mở Facebook
                            </Button>
                            
                            <Alert
                                type="info"
                                message="Hướng dẫn"
                                description={
                                    <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
                                        <li>Đăng nhập Facebook trên trình duyệt</li>
                                        <li>Click icon Extension → Click "Đồng bộ tài khoản"</li>
                                        <li>Chờ thông báo thành công</li>
                                    </ol>
                                }
                                showIcon
                            />
                            
                            <Card 
                                size="small" 
                                title={
                                    <Space>
                                        <span>Đang chờ đồng bộ...</span>
                                        {checkingAccounts && <Spin size="small" />}
                                    </Space>
                                }
                            >
                                {syncedAccounts.length > 0 ? (
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        {syncedAccounts.map(acc => (
                                            <div 
                                                key={acc.uid} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: 8,
                                                    padding: 8,
                                                    background: '#f5f5f5',
                                                    borderRadius: 8
                                                }}
                                            >
                                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                                <span>{acc.name}</span>
                                                <Tag color={acc.tokenStatus === 'active' ? 'green' : 'orange'}>
                                                    {acc.tokenStatus}
                                                </Tag>
                                            </div>
                                        ))}
                                    </Space>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                        <SyncOutlined spin style={{ fontSize: 24, marginBottom: 8 }} />
                                        <p>Chưa có tài khoản nào được đồng bộ</p>
                                    </div>
                                )}
                            </Card>
                            
                            <Button 
                                icon={<ReloadOutlined />} 
                                onClick={checkSyncedAccounts}
                                loading={checkingAccounts}
                            >
                                Kiểm tra lại
                            </Button>
                        </Space>
                    </div>
                );
                
            case 3:
                return (
                    <Result
                        status="success"
                        title="Đồng bộ thành công!"
                        subTitle={`Đã đồng bộ ${syncedAccounts.length} tài khoản Facebook`}
                        extra={[
                            <Button 
                                type="primary" 
                                key="done"
                                onClick={() => onComplete && onComplete(syncedAccounts)}
                            >
                                Hoàn tất
                            </Button>,
                            <Button 
                                key="add-more"
                                onClick={() => setCurrentStep(2)}
                            >
                                Thêm tài khoản khác
                            </Button>
                        ]}
                    >
                        <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
                            <Title level={5}>Tài khoản đã đồng bộ:</Title>
                            {syncedAccounts.map(acc => (
                                <div 
                                    key={acc.uid}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 12,
                                        marginBottom: 8,
                                        background: '#f6ffed',
                                        border: '1px solid #b7eb8f',
                                        borderRadius: 8
                                    }}
                                >
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: '#1877F2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold'
                                    }}>
                                        {acc.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{acc.name}</div>
                                        <div style={{ fontSize: 12, color: '#666' }}>UID: {acc.uid}</div>
                                    </div>
                                    <Tag color="green">{acc.tokenStatus}</Tag>
                                </div>
                            ))}
                        </div>
                    </Result>
                );
                
            default:
                return null;
        }
    };

    return (
        <Card 
            style={{ maxWidth: 600, margin: '0 auto' }}
            title={
                <Space>
                    <LinkOutlined style={{ color: '#EE4D2D' }} />
                    <span>Kết nối tài khoản Facebook</span>
                </Space>
            }
            extra={
                onCancel && (
                    <Button type="text" onClick={onCancel}>
                        Đóng
                    </Button>
                )
            }
        >
            <Steps
                current={currentStep}
                size="small"
                style={{ marginBottom: 24 }}
                items={[
                    { title: 'Cài Extension' },
                    { title: 'Kết nối' },
                    { title: 'Đồng bộ' },
                    { title: 'Hoàn tất' }
                ]}
            />
            
            {renderStepContent()}
        </Card>
    );
};

export default ExtensionSetupGuide;
