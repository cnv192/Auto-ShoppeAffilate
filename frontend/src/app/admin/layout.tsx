'use client';

import React, { useMemo, ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Typography, Spin } from 'antd';
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
import { getCurrentUser, logout } from '@/lib/authService';
import { prefetchLinks, prefetchCampaigns, prefetchDashboard } from '@/hooks/useAdminData';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AdminLayoutProps {
    children: ReactNode;
}

/**
 * Admin Layout - Layout cho admin dashboard
 * Sidebar chỉ render 1 lần, sử dụng Next.js App Router để navigation
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Xác định current page từ URL - PHẢI gọi trước conditional return
    const currentPage = useMemo(() => {
        if (pathname.includes('/admin/facebook-posting')) return 'facebook-posting';
        if (pathname.includes('/admin/facebook')) return 'facebook';
        if (pathname.includes('/admin/links')) return 'links';
        if (pathname.includes('/admin/campaigns')) return 'campaigns';
        if (pathname.includes('/admin/banners')) return 'banners';
        if (pathname.includes('/admin/resources')) return 'resources';
        if (pathname.includes('/admin/users')) return 'users';
        if (pathname.includes('/admin/profile')) return 'profile';
        return 'dashboard';
    }, [pathname]);

    // Menu items - PHẢI gọi trước conditional return
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
            },
            {
                key: 'facebook-posting',
                icon: <FacebookOutlined />,
                label: 'Đăng bài Facebook'
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

    // Check authentication on mount
    useEffect(() => {
        setMounted(true);
        const currentUser = getCurrentUser();
        
        // Nếu đang ở trang login
        if (pathname === '/admin/login') {
            if (currentUser) {
                // Nếu đã login thì redirect về dashboard
                router.push('/admin/dashboard');
            } else {
                // Chưa login thì cho phép render login page
                setIsLoading(false);
            }
            return;
        }

        // Các trang admin khác
        if (!currentUser) {
            router.push('/admin/login');
        } else {
            setUser(currentUser);
            setIsLoading(false);
            
            // Prefetch data ngay khi login để sẵn sàng cho navigation
            // Chạy sau 100ms để không block render
            setTimeout(() => {
                prefetchDashboard();
                prefetchLinks();
                prefetchCampaigns();
            }, 100);
        }
    }, [router, pathname]);

    // Loading state
    if (!mounted || isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    const handleLogout = () => {
        logout();
        router.push('/');
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
            type: 'divider' as const
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất'
        }
    ];

    const handleUserMenuClick = ({ key }: { key: string }) => {
        if (key === 'logout') {
            handleLogout();
        } else if (key === 'profile') {
            router.push('/admin/profile');
        }
    };

    const handleMenuClick = ({ key }: { key: string }) => {
        router.push(`/admin/${key}`);
    };

    // Nếu là trang login thì render children full screen (không có layout admin)
    if (pathname === '/admin/login') {
        if (!mounted || isLoading) {
             return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <Spin size="large" />
                </div>
            );
        }
        return <>{children}</>;
    }

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff5f0 0%, #ffe5d9 100%)' }}>
            {/* Fixed Sidebar */}
            <Sider
                breakpoint="lg"
                collapsedWidth={0}
                width={240}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: '#ffffff',
                    zIndex: 1000,
                    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)'
                }}
            >
                {/* Logo/Brand */}
                <div style={{
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000000',
                    fontSize: 20,
                    fontWeight: 600,
                    background: '#ffffff',
                    borderBottom: '1px solid #f0f0f0',
                    padding: '12px 20px'
                }}>
                    <Image src="/logo.png" alt="Logo" width={56} height={56} style={{ marginRight: 8 }} />
                </div>

                {/* Menu */}
                <Menu
                    theme="light"
                    mode="inline"
                    selectedKeys={[currentPage]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{
                        background: '#ffffff',
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
                    borderBottom: '1px solid #f0f0f0',
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
                    padding: '24px 32px 32px',
                    background: '#ffffff',
                    minHeight: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }}>
                    <div style={{ maxWidth: '100%', minHeight: '100%' }}>
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
}
