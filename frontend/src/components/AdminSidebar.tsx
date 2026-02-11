'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authService } from '@/lib/authService'
import { 
  DashboardOutlined, 
  LinkOutlined, 
  ThunderboltOutlined,
  FileImageOutlined,
  FolderOutlined,
  FacebookOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'

const menuItems = [
  { name: 'Dashboard', href: '/admin/dashboard', key: 'dashboard', icon: DashboardOutlined },
  { name: 'Quản lý Links', href: '/admin/links', key: 'links', icon: LinkOutlined },
  { name: 'Chiến dịch', href: '/admin/campaigns', key: 'campaigns', icon: ThunderboltOutlined },
  { name: 'Quản lý Banner', href: '/admin/banners', key: 'banners', icon: FileImageOutlined },
  { name: 'Resource Sets', href: '/admin/resources', key: 'resources', icon: FolderOutlined },
  { name: 'Tài khoản Facebook', href: '/admin/facebook', key: 'facebook', icon: FacebookOutlined },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = authService.getCurrentUser()

  const handleLogout = () => {
    authService.logout()
    router.push('/admin/login')
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      handleLogout()
    } else if (key === 'profile') {
      router.push('/admin/profile')
    }
  }

  const adminMenuItems = user?.role === 'admin' 
    ? [...menuItems, { name: 'Quản lý User', href: '/admin/users', key: 'users', icon: UserOutlined }]
    : menuItems

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất' }
  ]

  return (
    <>
      {/* Sidebar */}
      <aside 
        style={{
          width: 240,
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#ffffff',
          zIndex: 1000,
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Logo/Brand */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 20px'
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: '#EE4D2D',
              letterSpacing: '-0.5px'
            }}>
              Shoppe
            </span>
            <span style={{
              fontSize: 12,
              color: '#999',
              fontWeight: 500
            }}>
              Affiliate
            </span>
          </Link>
        </div>
        
        {/* Menu */}
        <nav style={{ 
          padding: '8px 0',
          flex: 1,
          overflow: 'auto'
        }}>
          {adminMenuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
            const IconComponent = item.icon
            
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 24px',
                  margin: '2px 8px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: isActive ? '#EE4D2D' : '#595959',
                  background: isActive ? '#fff5f0' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 14,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f5f5f5'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <IconComponent style={{ fontSize: 16 }} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 240,
        right: 0,
        height: 64,
        padding: '0 32px',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        borderBottom: '2px solid #e8eaed',
        zIndex: 999
      }}>
        <Dropdown 
          placement="bottomRight"
          menu={{ items: userMenuItems, onClick: handleMenuClick }}
        >
          <div style={{ 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            padding: '6px 12px',
            borderRadius: 8,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7fa'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Avatar 
              src={user?.avatar}
              icon={<UserOutlined />} 
              style={{ 
                background: '#ff6b35',
                width: 40,
                height: 40
              }} 
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 14,
                color: '#262626',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user?.fullName || user?.username}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
              </div>
            </div>
          </div>
        </Dropdown>
      </header>
    </>
  )
}
