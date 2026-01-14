import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import authService from '../services/authService';

const { Title } = Typography;

/**
 * Login Component
 * 
 * - Form đăng nhập username/password
 * - Lưu token vào localStorage
 * - Redirect sau khi login thành công
 */

const Login = ({ onLoginSuccess }) => {
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            
            const { username, password } = values;
            const { user } = await authService.login(username, password);
            
            message.success(`Chào mừng ${user.fullName || user.username}!`);
            
            // Callback to parent component
            if (onLoginSuccess) {
                onLoginSuccess(user);
            }
            
        } catch (error) {
            message.error(error.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#ffffff'
        }}>
            <Card
                style={{
                    width: 400,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <Title level={2} style={{ color: '#EE4D2D', marginBottom: 8 }}>
                        Shopee Affiliate
                    </Title>
                    <p style={{ color: '#666', fontSize: 14 }}>
                        Hệ thống quản lý chiến dịch Facebook Marketing
                    </p>
                </div>
                
                <Form
                    name="login"
                    onFinish={handleSubmit}
                    autoComplete="off"
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[
                            { required: true, message: 'Vui lòng nhập username!' }
                        ]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Username"
                            autoFocus
                        />
                    </Form.Item>
                    
                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: 'Vui lòng nhập password!' }
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                        />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{
                                height: 45,
                                fontSize: 16,
                                fontWeight: 600
                            }}
                        >
                            Đăng nhập
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
