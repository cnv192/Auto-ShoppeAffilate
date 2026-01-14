import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';

// Components
import Login from './components/Login';
import Homepage from './components/Homepage';
import AdminDashboard from './components/AdminDashboard';
import ExtensionAuthPage from './pages/ExtensionAuthPage';
import authService from './services/authService';

// Theme configuration
const themeConfig = {
    token: {
        colorPrimary: '#EE4D2D',
        colorLink: '#EE4D2D',
        colorLinkHover: '#d94429',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    algorithm: theme.defaultAlgorithm
};

/**
 * Protected Route - Chỉ cho phép user đã đăng nhập
 */
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = authService.isAuthenticated();
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    return children;
};

/**
 * Main App Component với React Router
 */
function App() {
    const navigate = useNavigate();
    
    const handleLoginSuccess = (userData) => {
        navigate('/admin');
    };
    
    return (
        <ConfigProvider theme={themeConfig}>
            <AntApp>
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Homepage />} />
                    <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
                    
                    {/* Extension Auth route - Public để extension có thể access */}
                    <Route path="/ext-auth" element={<ExtensionAuthPage />} />
                    
                    {/* Protected admin route */}
                    <Route 
                        path="/admin/*" 
                        element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AntApp>
        </ConfigProvider>
    );
}

export default App;
