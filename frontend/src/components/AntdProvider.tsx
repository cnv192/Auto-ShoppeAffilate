'use client';

import React from 'react';
import { ConfigProvider, App } from 'antd';
import viVN from 'antd/locale/vi_VN';

// Shopee Orange theme
const theme = {
  token: {
    colorPrimary: '#EE4D2D',
    colorLink: '#EE4D2D',
    colorLinkHover: '#ff7a4d',
    borderRadius: 6,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Button: {
      colorPrimary: '#EE4D2D',
      colorPrimaryHover: '#ff7a4d',
      algorithm: true,
    },
    Menu: {
      itemSelectedBg: '#fff5f0',
      itemSelectedColor: '#EE4D2D',
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
            border: '3px solid #EE4D2D',
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
