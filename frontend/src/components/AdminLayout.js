import React, { useMemo, memo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    DashboardOutlined,
    LinkOutlined,
    UserOutlined,
    FacebookOutlined,
    ThunderboltOutlined,
    LogoutOutlined,
    SettingOutlined,
    FolderOutlined,
    FileImageOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Admin Layout - Layout cho admin dashboard
 * Sidebar chỉ render 1 lần, sử dụng React Router để navigation
 */

const AdminLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = authService.getCurrentUser();
    
    // Xác định current page từ URL
    const currentPage = useMemo(() => {
        const path = location.pathname;
        if (path.includes('/admin/dashboard')) return 'dashboard';
        if (path.includes('/admin/links')) return 'links';
        if (path.includes('/admin/campaigns')) return 'campaigns';
        if (path.includes('/admin/facebook')) return 'facebook';
        if (path.includes('/admin/resources')) return 'resources';
        if (path.includes('/admin/users')) return 'users';
        if (path.includes('/admin/profile')) return 'profile';
        if (path.includes('/homepage')) return 'homepage';
        return 'dashboard';
    }, [location.pathname]);
    
    const handleLogout = () => {
        authService.logout();
        navigate('/');
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
            navigate('/admin/profile');
        }
    };
    
    const menuItems = useMemo(() => {
        const items = [
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
                key: 'banners',
                icon: <FileImageOutlined />,
                label: 'Quản lý Banner'
            },
            {
                key: 'resources',
                icon: <FolderOutlined />,
                label: 'Resource Sets'
            },
            {
                key: 'facebook',
                icon: <FacebookOutlined />,
                label: 'Tài khoản Facebook'
            }
        ];
        
        // Admin thấy thêm user management
        if (user && user.role === 'admin') {
            items.push({
                key: 'users',
                icon: <UserOutlined />,
                label: 'Quản lý User'
            });
        }
        
        return items;
    }, [user]);
    
    const handleMenuClick = ({ key }) => {
        navigate(`/admin/${key}`);
    };
    
    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff5f0 0%, #ffe5d9 100%)' }}>
            {/* Fixed Sidebar */}
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                width={240}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: '#2c1810',
                    zIndex: 1000,
                    boxShadow: '2px 0 8px rgba(0,0,0,0.08)'
                }}
            >
                {/* Logo/Brand */}
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 600,
                    background: '#1f0f08',
                    borderBottom: '2px solid rgba(255,255,255,0.08)',
                    padding: '0 20px'
                }}>
                    <span style={{ marginRight: 8 }}>🔥</span>
                    <span>Admin Panel</span>
                </div>
                
                {/* Menu */}
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[currentPage]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ 
                        background: '#2c1810',
                        borderRight: 0,
                        padding: '8px 0'
                    }}
                />
            </Sider>
            
            {/* Main Content Area */}
            <Layout style={{ 
                marginLeft: 240, 
                background: 'linear-gradient(135deg, #fff5f0 0%, #ffe5d9 100%)',
                minHeight: '100vh'
            }}>
                {/* Fixed Header */}
                <Header style={{
                    padding: '0 32px',
                    background: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    borderBottom: '2px solid #e8eaed',
                    position: 'sticky',
                    top: 0,
                    zIndex: 999,
                    height: 64
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
                            padding: '6px 12px',
                            borderRadius: 8,
                            transition: 'background 0.2s',
                            maxWidth: 220,
                            lineHeight: '30px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7fa'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Avatar 
                                src={user?.avatar}
                                icon={<UserOutlined />} 
                                style={{ 
                                    background: '#ff6b35',
                                    flexShrink: 0,
                                    width: 40,
                                    height: 40,
                                    minWidth: 40
                                }} 
                            />
                            <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                <Text strong ellipsis style={{ 
                                    display: 'block', 
                                    maxWidth: 140,
                                    fontSize: 14,
                                    lineHeight: 1.4
                                }}>
                                    {user?.displayName || user?.fullName || user?.username}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
                                    {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                                </Text>
                            </div>
                        </div>
                    </Dropdown>
                </Header>
                
                {/* Scrollable Content */}
                <Content style={{
                    padding: '32px',
                    background: 'linear-gradient(135deg, #fff5f0 0%, #ffe5d9 100%)',
                    minHeight: 'calc(100vh - 64px)',
                    overflow: 'auto'
                }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

// Memoize để tránh re-render không cần thiết
// Sidebar chỉ render 1 lần, chỉ content thay đổi
export default memo(AdminLayout);
