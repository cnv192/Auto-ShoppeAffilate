import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
    DashboardOutlined,
    LinkOutlined,
    UserOutlined,
    FacebookOutlined,
    ThunderboltOutlined,
    LogoutOutlined,
    SettingOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Admin Layout - Layout cho admin dashboard
 * Có sidebar navigation
 */

const AdminLayout = ({ children, currentPage = 'dashboard', onMenuClick }) => {
    const user = authService.getCurrentUser();
    
    const handleLogout = () => {
        authService.logout();
        window.location.href = '/';
    };
    
    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Thông tin cá nhân'
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Cài đặt'
        },
        {
            type: 'divider'
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất'
        }
    ];

    const handleUserMenuClick = ({ key }) => {
        if (key === 'logout') {
            handleLogout();
        } else if (key === 'profile') {
            onMenuClick && onMenuClick('profile');
        }
    };
    
    const menuItems = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard'
        },
        {
            key: 'links',
            icon: <LinkOutlined />,
            label: 'Quản lý Links'
        },
        {
            key: 'campaigns',
            icon: <ThunderboltOutlined />,
            label: 'Chiến dịch'
        },
        {
            key: 'facebook',
            icon: <FacebookOutlined />,
            label: 'Tài khoản Facebook'
        }
    ];
    
    // Admin thấy thêm user management
    if (user && user.role === 'admin') {
        menuItems.push({
            key: 'users',
            icon: <UserOutlined />,
            label: 'Quản lý User'
        });
    }
    
    return (
        <Layout style={{ minHeight: '100vh', background: '#fff' }}>
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: '#EE4D2D'
                }}
            >
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 'bold',
                    background: 'rgba(0,0,0,0.1)'
                }}>
                    🔥 Link Manager
                </div>
                
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[currentPage]}
                    items={menuItems}
                    onClick={({ key }) => onMenuClick && onMenuClick(key)}
                    style={{ background: '#EE4D2D', borderRight: 0 }}
                />
            </Sider>
            
            <Layout style={{ marginLeft: 200, background: '#fff' }}>
                <Header style={{
                    padding: '0 24px',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    borderBottom: '3px solid #EE4D2D'
                }}>
                    <div />
                    
                    <Dropdown 
                        placement="bottomRight"
                        menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                    >
                        <div style={{ 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12,
                            maxWidth: 200,
                            overflow: 'hidden'
                        }}>
                            <Avatar 
                                src={user?.avatar}
                                icon={<UserOutlined />} 
                                style={{ 
                                    background: '#EE4D2D',
                                    flexShrink: 0,
                                    width: 36,
                                    height: 36,
                                    minWidth: 36
                                }} 
                            />
                            <div style={{ overflow: 'hidden' }}>
                                <Text strong ellipsis style={{ display: 'block', maxWidth: 120 }}>
                                    {user?.displayName || user?.fullName || user?.username}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {user?.role === 'admin' ? 'Admin' : 'User'}
                                </Text>
                            </div>
                        </div>
                    </Dropdown>
                </Header>
                
                <Content style={{
                    margin: '24px 16px',
                    padding: 24,
                    background: '#fff',
                    minHeight: 280,
                    borderRadius: 8
                }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default AdminLayout;
