'use client';

import React from 'react';
import { ConfigProvider, App } from 'antd';
import viVN from 'antd/locale/vi_VN';

// Tin tức 24h - Red theme (matching public site)
const theme = {
  token: {
    colorPrimary: '#D31016',
    colorLink: '#D31016',
    colorLinkHover: '#b80d12',
    borderRadius: 6,
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Button: {
      colorPrimary: '#D31016',
      colorPrimaryHover: '#b80d12',
      algorithm: true,
    },
    Menu: {
      itemSelectedBg: '#fef2f2',
      itemSelectedColor: '#D31016',
    },
  },
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid #D31016',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: '#666' }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={theme} locale={viVN}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
