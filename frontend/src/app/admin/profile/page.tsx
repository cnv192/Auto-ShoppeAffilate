'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    Upload,
    Avatar,
    Typography,
    Space,
    Divider,
    message,
    Spin,
    Row,
    Col
} from 'antd';
import {
    UserOutlined,
    MailOutlined,
    LockOutlined,
    CameraOutlined,
    SaveOutlined,
    LoadingOutlined,
    PhoneOutlined
} from '@ant-design/icons';
import { getCurrentUser, getToken } from '@/lib/authService';
import { getApiUrl } from '@/lib/adminApi';

const { Title, Text } = Typography;

interface UserData {
    username: string;
    displayName?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    role: string;
}

export default function ProfilePage() {
    const [form] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const fetchUserProfile = useCallback(async () => {
        try {
            setLoading(true);
            const token = getToken();
            
            const res = await fetch(getApiUrl('users/profile'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                setUserData(data.data);
                setAvatarUrl(data.data.avatar);
                form.setFieldsValue({
                    username: data.data.username,
                    displayName: data.data.displayName || '',
                    email: data.data.email || '',
                    phone: data.data.phone || ''
                });
            } else {
                // Fallback to local user data
                const currentUser = getCurrentUser();
                if (currentUser) {
                    setUserData(currentUser as UserData);
                    form.setFieldsValue({
                        username: currentUser.username,
                        displayName: currentUser.fullName || '',
                        email: currentUser.email || '',
                        phone: ''
                    });
                }
            }
        } catch (error) {
            console.error('Profile error:', error);
            // Fallback to local user data
            const currentUser = getCurrentUser();
            if (currentUser) {
                setUserData(currentUser as UserData);
                form.setFieldsValue({
                    username: currentUser.username,
                    displayName: currentUser.fullName || '',
                    email: currentUser.email || '',
                    phone: ''
                });
            }
        } finally {
            setLoading(false);
        }
    }, [form]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    const handleAvatarUpload = async (file: File) => {
        try {
            setUploadingAvatar(true);
            const token = getToken();
            
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await fetch(getApiUrl('upload'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                setAvatarUrl(data.data.url);
                message.success('Upload avatar thành công!');
            } else {
                message.error(data.message || 'Upload thất bại');
            }
        } catch (error) {
            console.error('Upload error:', error);
            message.error('Lỗi upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
        
        return false;
    };

    const handleUpdateProfile = async (values: any) => {
        try {
            setSaving(true);
            const token = getToken();
            
            const res = await fetch(getApiUrl('users/profile'), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: values.displayName,
                    email: values.email,
                    phone: values.phone,
                    avatar: avatarUrl
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                message.success('Cập nhật thông tin thành công!');
                const currentUser = getCurrentUser();
                if (currentUser) {
                    currentUser.fullName = values.displayName;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                }
            } else {
                message.error(data.message || 'Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Update error:', error);
            message.error('Lỗi cập nhật');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (values: any) => {
        try {
            setSaving(true);
            const token = getToken();
            
            const res = await fetch(getApiUrl('users/change-password'), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                message.success('Đổi mật khẩu thành công!');
                passwordForm.resetFields();
            } else {
                message.error(data.message || 'Đổi mật khẩu thất bại');
            }
        } catch (error) {
            console.error('Password error:', error);
            message.error('Lỗi đổi mật khẩu');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <Title level={2} style={{
                        margin: 0,
                        marginBottom: 8,
                        color: '#EE4D2D',
                        fontSize: 24,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        lineHeight: 1.3
                    }}>
                        <UserOutlined />
                        Thông tin cá nhân
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý thông tin tài khoản của bạn
                    </Text>
                </div>
            </div>

            <div style={{ maxWidth: 800 }}>
            <Row gutter={24}>
                {/* Avatar Section */}
                <Col xs={24} md={8}>
                    <Card style={{ textAlign: 'center', borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Space direction="vertical" size={16}>
                            <Upload
                                showUploadList={false}
                                beforeUpload={handleAvatarUpload}
                                accept="image/*"
                            >
                                <div style={{ cursor: 'pointer', position: 'relative' }}>
                                    {uploadingAvatar ? (
                                        <Avatar 
                                            size={120}
                                            icon={<LoadingOutlined spin />}
                                            style={{ backgroundColor: '#f0f0f0' }}
                                        />
                                    ) : (
                                        <Avatar
                                            size={120}
                                            src={avatarUrl || undefined}
                                            icon={<UserOutlined />}
                                            style={{ 
                                                backgroundColor: '#EE4D2D',
                                                border: '3px solid #fff',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            background: '#EE4D2D',
                                            borderRadius: '50%',
                                            padding: 8,
                                            border: '2px solid white'
                                        }}
                                    >
                                        <CameraOutlined style={{ color: 'white', fontSize: 14 }} />
                                    </div>
                                </div>
                            </Upload>
                            <Text type="secondary">Click để thay đổi avatar</Text>
                            <Text strong style={{ fontSize: 16 }}>
                                {userData?.displayName || userData?.username}
                            </Text>
                            <Text type="secondary">
                                Role: {userData?.role === 'admin' ? 'Admin' : 'User'}
                            </Text>
                        </Space>
                    </Card>
                </Col>

                {/* Profile Form */}
                <Col xs={24} md={16}>
                    <Card title="Chỉnh sửa thông tin" style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleUpdateProfile}
                        >
                            <Form.Item
                                name="username"
                                label="Username"
                            >
                                <Input 
                                    prefix={<UserOutlined />}
                                    disabled
                                    style={{ background: '#f5f5f5' }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="displayName"
                                label="Tên hiển thị"
                            >
                                <Input 
                                    prefix={<UserOutlined />}
                                    placeholder="Nhập tên hiển thị"
                                />
                            </Form.Item>

                            <Form.Item
                                name="email"
                                label="Email"
                                rules={[
                                    { type: 'email', message: 'Email không hợp lệ' }
                                ]}
                            >
                                <Input 
                                    prefix={<MailOutlined />}
                                    placeholder="Nhập email"
                                />
                            </Form.Item>

                            <Form.Item
                                name="phone"
                                label="Số điện thoại"
                            >
                                <Input 
                                    prefix={<PhoneOutlined />}
                                    placeholder="Nhập số điện thoại"
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={saving}
                                    icon={<SaveOutlined />}
                                    style={{ 
                                        height: 40,
                                        borderRadius: 8,
                                        fontWeight: 500
                                    }}
                                >
                                    Lưu thay đổi
                                </Button>
                            </Form.Item>
                        </Form>

                        <Divider>Đổi mật khẩu</Divider>

                        <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={handleChangePassword}
                        >
                            <Form.Item
                                name="currentPassword"
                                label="Mật khẩu hiện tại"
                                rules={[
                                    { required: true, message: 'Nhập mật khẩu hiện tại' }
                                ]}
                            >
                                <Input.Password 
                                    prefix={<LockOutlined />}
                                    placeholder="Nhập mật khẩu hiện tại"
                                />
                            </Form.Item>

                            <Form.Item
                                name="newPassword"
                                label="Mật khẩu mới"
                                rules={[
                                    { required: true, message: 'Nhập mật khẩu mới' },
                                    { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }
                                ]}
                            >
                                <Input.Password 
                                    prefix={<LockOutlined />}
                                    placeholder="Nhập mật khẩu mới"
                                />
                            </Form.Item>

                            <Form.Item
                                name="confirmPassword"
                                label="Xác nhận mật khẩu"
                                dependencies={['newPassword']}
                                rules={[
                                    { required: true, message: 'Xác nhận mật khẩu mới' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('newPassword') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('Mật khẩu không khớp'));
                                        }
                                    })
                                ]}
                            >
                                <Input.Password 
                                    prefix={<LockOutlined />}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="default"
                                    htmlType="submit"
                                    loading={saving}
                                    icon={<LockOutlined />}
                                    style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                                >
                                    Đổi mật khẩu
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
            </Row>
            </div>
        </>
    );
}
