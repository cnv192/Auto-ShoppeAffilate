import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';

// Components
import Login from './components/Login';
import Homepage from './components/Homepage';
import AdminLayout from './components/AdminLayout';
import Dashboard from './components/Dashboard';
import LinksPage from './components/LinksPage';
import CampaignList from './components/CampaignList';
import FacebookAccountManager from './components/FacebookAccountManager';
import UserManagement from './components/UserManagement';
import UserProfile from './components/UserProfile';
import ResourceManagement from './components/ResourceManagement';
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
 * Sử dụng nested routes để sidebar chỉ render 1 lần
 */
function App() {
    const navigate = useNavigate();
    
    const handleLoginSuccess = (userData) => {
        navigate('/admin/dashboard');
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
                    
                    {/* Protected admin routes với nested layout */}
                    <Route 
                        path="/admin/*" 
                        element={
                            <ProtectedRoute>
                                <AdminLayout>
                                    <Routes>
                                        <Route path="dashboard" element={<Dashboard />} />
                                        <Route path="links" element={<LinksPage />} />
                                        <Route path="campaigns" element={<CampaignList />} />
                                        <Route path="facebook" element={<FacebookAccountManager />} />
                                        <Route path="resources" element={<ResourceManagement />} />
                                        <Route path="profile" element={<UserProfile />} />
                                        {authService.isAdmin() && (
                                            <Route path="users" element={<UserManagement />} />
                                        )}
                                        <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
                                        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                                    </Routes>
                                </AdminLayout>
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
