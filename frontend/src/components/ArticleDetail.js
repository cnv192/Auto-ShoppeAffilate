import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Tag, message } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text, Paragraph } = Typography;

// Bridge Server URL for safe redirects
const BRIDGE_SERVER_URL = process.env.REACT_APP_BRIDGE_URL || 'http://localhost:3002';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * StickyBanner Component
 * Displays a sticky banner at the bottom of the screen
 */
const StickyBanner = ({ banner, onBannerClick }) => {
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!banner) return;
        
        // Show banner after delay
        const timer = setTimeout(() => {
            setVisible(true);
        }, banner.showDelay || 0);

        // Auto-hide after duration (if set)
        let hideTimer;
        if (banner.autoHideAfter > 0) {
            hideTimer = setTimeout(() => {
                setVisible(false);
            }, (banner.showDelay || 0) + banner.autoHideAfter);
        }

        return () => {
            clearTimeout(timer);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [banner]);

    if (!banner || !visible || dismissed) return null;

    const handleDismiss = (e) => {
        e.stopPropagation();
        setDismissed(true);
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'white',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: '12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            {banner.dismissible && (
                <button
                    onClick={handleDismiss}
                    style={{
                        position: 'absolute',
                        top: 4,
                        right: 8,
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
            )}
            <img
                src={window.innerWidth < 768 && banner.mobileImageUrl ? banner.mobileImageUrl : banner.imageUrl}
                alt={banner.altText || banner.name}
                style={{
                    maxWidth: '100%',
                    maxHeight: 80,
                    cursor: 'pointer',
                    borderRadius: 4
                }}
                onClick={() => onBannerClick(banner)}
            />
        </div>
    );
};

/**
 * ArticleDetail - Trang chi tiết bài viết
 * Hiển thị nội dung đầy đủ của bài viết
 * + Banner system + Deep Link support
 */
const ArticleDetail = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [banner, setBanner] = useState(null);

    // Detect device type
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    /**
     * Invisible Cookie Injection
     * Creates a hidden 1x1 iframe to seed affiliate cookies
     */
    const injectCookieIframe = useCallback((targetSlug) => {
        // Check if iframe already exists
        if (document.getElementById('cookie-injection-iframe')) return;

        const iframe = document.createElement('iframe');
        iframe.id = 'cookie-injection-iframe';
        iframe.src = `${BRIDGE_SERVER_URL}/go/${targetSlug}`;
        iframe.style.cssText = 'width:1px;height:1px;position:absolute;top:-9999px;left:-9999px;border:none;opacity:0;';
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        iframe.setAttribute('loading', 'lazy');
        
        document.body.appendChild(iframe);
        console.log('🍪 Cookie injection iframe created');

        // Cleanup after 5 seconds
        setTimeout(() => {
            const el = document.getElementById('cookie-injection-iframe');
            if (el) el.remove();
        }, 5000);
    }, []);

    useEffect(() => {
        fetchArticle();
        fetchBanner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    
    useEffect(() => {
        if (article?.targetUrl && banner?.targetSlug) {
            injectCookieIframe(banner.targetSlug);
        }
    }, [article, banner, injectCookieIframe]);

    const fetchArticle = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_URL}/api/links/${slug}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Không tìm thấy bài viết');
                }
                throw new Error('Không thể tải bài viết');
            }

            const data = await response.json();
            setArticle(data.data);
            
            // Track view
            trackView(slug);

        } catch (error) {
            console.error('Article fetch error:', error);
            setError(error.message || 'Không thể tải bài viết');
            message.error(error.message || 'Không thể tải bài viết');
        } finally {
            setLoading(false);
        }
    };

    const fetchBanner = async () => {
        try {
            const device = isMobile ? 'mobile' : 'desktop';
            const response = await fetch(
                `${API_URL}/api/banners/random?type=sticky_bottom&device=${device}&articleSlug=${slug}`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    setBanner(data.data);
                    console.log('🎯 Banner loaded:', data.data.name);
                }
            }
        } catch (error) {
            console.log('Banner fetch failed (non-critical):', error.message);
        }
    };
    
    const trackView = async (slug) => {
        try {
            await fetch(`${API_URL}/api/links/${slug}/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userAgent: navigator.userAgent,
                    referer: document.referrer,
                    device: isMobile ? 'mobile' : 'desktop'
                })
            });
        } catch (error) {
            // Silent fail - không ảnh hưởng đến UX
            console.log('Track view failed:', error);
        }
    };

    /**
     * Handle Banner Click
     * Mobile: Direct redirect (trigger app deep link)
     * Desktop: Open in new tab via Bridge Server
     */
    const handleBannerClick = async (bannerData) => {
        // Record click
        try {
            await fetch(`${API_URL}/api/banners/${bannerData.id}/click`, {
                method: 'POST'
            });
        } catch (e) {
            // Silent fail
        }

        const targetUrl = `${BRIDGE_SERVER_URL}/go/${bannerData.targetSlug}`;

        if (isMobile) {
            // Mobile: Direct redirect to trigger app deep link
            window.location.href = targetUrl;
        } else {
            // Desktop: Open in new tab
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleRedirect = () => {
        if (article?.targetUrl) {
            if (isMobile) {
                window.location.href = article.targetUrl;
            } else {
                window.open(article.targetUrl, '_blank', 'noopener,noreferrer');
            }
        }
    };

    const getCategoryColor = (category) => {
        const colors = {
            'Khuyến mãi': '#ee4d2d',
            'Flash Sale': '#ff6b35',
            'Thời trang': '#eb2f96',
            'Điện tử': '#1890ff',
            'Làm đẹp': '#9c27b0',
            'Gia dụng': '#52c41a'
        };
        return colors[category] || '#595959';
    };

    if (loading) {
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '100px 20px',
                minHeight: '100vh',
                background: '#f5f5f5'
            }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#999' }}>Đang tải bài viết...</div>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '100px 20px',
                minHeight: '100vh',
                background: '#f5f5f5'
            }}>
                <div style={{ color: '#ff4d4f', marginBottom: 16, fontSize: 16 }}>
                    ❌ {error || 'Không tìm thấy bài viết'}
                </div>
                <Button 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => navigate('/')}
                    type="primary"
                >
                    Về trang chủ
                </Button>
            </div>
        );
    }

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: banner ? 100 : 0 }}>
            {/* Header */}
            <div style={{
                background: 'white',
                borderBottom: '3px solid #26a9e0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                padding: '16px 20px'
            }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <Button 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => navigate('/')}
                        style={{ marginBottom: 8 }}
                    >
                        Về trang chủ
                    </Button>
                </div>
            </div>

            {/* Hero Image */}
            <div style={{
                width: '100%',
                height: '60vh',
                minHeight: 400,
                maxHeight: 600,
                background: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${article.imageUrl}) center/cover`,
                display: 'flex',
                alignItems: 'flex-end',
                padding: '40px 20px'
            }}>
                <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
                    {article.category && (
                        <Tag 
                            style={{ 
                                background: getCategoryColor(article.category),
                                color: 'white',
                                border: 'none',
                                padding: '4px 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 12
                            }}
                        >
                            {article.category}
                        </Tag>
                    )}
                    <Title 
                        level={1} 
                        style={{ 
                            color: 'white', 
                            margin: 0,
                            textShadow: '2px 2px 8px rgba(0,0,0,0.7)',
                            fontSize: '2.5rem',
                            lineHeight: 1.2
                        }}
                    >
                        {article.title}
                    </Title>
                </div>
            </div>

            {/* Article Content */}
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>
                {/* Meta Info */}
                <div style={{
                    background: 'white',
                    padding: '20px',
                    marginTop: '-40px',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    position: 'relative',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                        <Text type="secondary">
                            <ClockCircleOutlined /> {dayjs(article.publishedAt || article.createdAt).format('DD/MM/YYYY HH:mm')}
                        </Text>
                        <Text type="secondary">
                            <EyeOutlined /> {article.totalClicks || 0} lượt xem
                        </Text>
                        {article.author && (
                            <Text type="secondary">
                                ✍️ {article.author}
                            </Text>
                        )}
                    </div>

                    {/* Description */}
                    {article.description && (
                        <Paragraph 
                            style={{ 
                                fontSize: 16, 
                                color: '#555',
                                fontWeight: 500,
                                lineHeight: 1.6,
                                marginBottom: 0
                            }}
                        >
                            {article.description}
                        </Paragraph>
                    )}
                </div>

                {/* Main Content */}
                <div style={{
                    background: 'white',
                    padding: '40px',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: 40
                }}>
                    {/* Content */}
                    <div 
                        style={{
                            fontSize: 16,
                            lineHeight: 1.8,
                            color: '#333'
                        }}
                        dangerouslySetInnerHTML={{ __html: article.content || '<p>Nội dung đang được cập nhật...</p>' }}
                    />

                    {/* CTA Button */}
                    <div style={{
                        background: 'linear-gradient(135deg, #ee4d2d 0%, #ff6b35 100%)',
                        borderRadius: 8,
                        padding: 40,
                        textAlign: 'center',
                        marginTop: 60
                    }}>
                        <Title level={3} style={{ color: 'white', marginBottom: 16 }}>
                            🎁 Xem ngay ưu đãi hot!
                        </Title>
                        <Text style={{ color: 'white', fontSize: 16, display: 'block', marginBottom: 24 }}>
                            Nhấn vào nút bên dưới để được chuyển đến trang ưu đãi
                        </Text>
                        <Button 
                            type="primary"
                            size="large"
                            onClick={handleRedirect}
                            style={{
                                background: 'white',
                                color: '#ee4d2d',
                                border: 'none',
                                height: 50,
                                padding: '0 40px',
                                fontSize: 16,
                                fontWeight: 600,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                        >
                            👉 XEM NGAY DEAL HOT
                        </Button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                background: '#26a9e0',
                color: '#fff',
                padding: '24px 20px',
                textAlign: 'center',
                borderTop: '3px solid #1e88c7'
            }}>
                <Text style={{ color: '#fff', fontSize: 13 }}>
                    © 2026 Hot News - Tin tức khuyến mãi điện tử
                </Text>
            </div>

            {/* Sticky Banner */}
            <StickyBanner banner={banner} onBannerClick={handleBannerClick} />
        </div>
    );
};

export default ArticleDetail;
