'use client';

/**
 * BannerDisplay Component
 * 
 * Hiển thị banner trên trang bài viết
 * Hỗ trợ các kiểu: sticky_bottom, center_popup, sidebar, inline, header
 * displayWidth là tỉ lệ % so với viewport
 * Chiều cao tự co theo tỉ lệ gốc của ảnh
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BannerData {
    id: string;
    name: string;
    imageUrl: string;
    mobileImageUrl?: string;
    targetSlug?: string;
    targetUrl?: string;
    type: string;
    displayWidth?: number;
    altText?: string;
    showDelay?: number;
    autoHideAfter?: number;
    dismissible?: boolean;
}

interface BannerDisplayProps {
    type?: 'sticky_bottom' | 'center_popup' | 'sidebar' | 'inline' | 'header';
    articleSlug?: string;
    category?: string;
}

export default function BannerDisplay({ type = 'sticky_bottom', articleSlug, category }: BannerDisplayProps) {
    const [banner, setBanner] = useState<BannerData | null>(null);
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const fetchBanner = useCallback(async () => {
        try {
            const params = new URLSearchParams({ type });
            if (articleSlug) params.append('articleSlug', articleSlug);
            if (category) params.append('category', category);

            const res = await fetch(`${API_BASE}/api/banners/random?${params.toString()}`);
            if (!res.ok) return;

            const data = await res.json();
            if (data.success && data.data) {
                setBanner(data.data);

                const delay = data.data.showDelay || 0;
                setTimeout(() => setVisible(true), delay * 1000);

                if (data.data.autoHideAfter > 0) {
                    setTimeout(() => {
                        setVisible(false);
                    }, (delay + data.data.autoHideAfter) * 1000);
                }
            }
        } catch (error) {
            console.error('Failed to fetch banner:', error);
        }
    }, [type, articleSlug, category]);

    useEffect(() => {
        fetchBanner();
    }, [fetchBanner]);

    const handleClick = useCallback(async () => {
        if (!banner) return;

        try {
            await fetch(`${API_BASE}/api/banners/${banner.id}/click`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to record banner click:', error);
        }

        // Use targetUrl from API response (already resolved to the correct destination)
        const targetUrl = banner.targetUrl || (banner.targetSlug ? `/${banner.targetSlug}` : null);

        if (targetUrl) {
            if (targetUrl.startsWith('http')) {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = targetUrl;
            }
        }
    }, [banner]);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissed(true);
        setVisible(false);
    }, []);

    if (!banner || !visible || dismissed) return null;

    const widthPercent = banner.displayWidth || 50;

    // ============= BANNER IMAGE (shared) =============
    const bannerImage = (
        <picture>
            {banner.mobileImageUrl && (
                <source media="(max-width: 768px)" srcSet={banner.mobileImageUrl} />
            )}
            <img
                src={banner.imageUrl}
                alt={banner.altText || banner.name}
                style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'contain'
                }}
            />
        </picture>
    );

    // ============= DISMISS BUTTON (shared) =============
    const dismissButton = banner.dismissible !== false && (
        <button
            onClick={handleDismiss}
            style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                color: '#fff',
                fontSize: 18,
                cursor: 'pointer',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'background 0.2s',
                lineHeight: 1
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            aria-label="Đóng banner"
        >
            ✕
        </button>
    );

    // ============= STICKY BOTTOM =============
    if (type === 'sticky_bottom') {
        return (
            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${widthPercent}vw`,
                    maxWidth: '100vw',
                    zIndex: 9999,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
                    animation: 'bannerSlideUp 0.4s ease-out'
                }}
            >
                <div style={{ position: 'relative' }}>
                    {dismissButton}
                    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {bannerImage}
                    </div>
                </div>

                <style jsx>{`
                    @keyframes bannerSlideUp {
                        from { transform: translateX(-50%) translateY(100%); }
                        to { transform: translateX(-50%) translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    // ============= CENTER POPUP =============
    if (type === 'center_popup') {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    animation: 'bannerFadeIn 0.3s ease-out'
                }}
                onClick={banner.dismissible !== false ? handleDismiss : undefined}
            >
                <div
                    style={{
                        position: 'relative',
                        width: `${widthPercent}vw`,
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                        borderRadius: 12,
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'bannerScaleIn 0.3s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {dismissButton}
                    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {bannerImage}
                    </div>
                </div>

                <style jsx>{`
                    @keyframes bannerFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes bannerScaleIn {
                        from { transform: scale(0.8); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // ============= SIDEBAR =============
    if (type === 'sidebar') {
        return (
            <div
                style={{
                    position: 'fixed',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: `${Math.min(widthPercent, 30)}vw`,
                    maxWidth: 320,
                    zIndex: 9998,
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    animation: 'bannerSlideLeft 0.4s ease-out'
                }}
            >
                <div style={{ position: 'relative' }}>
                    {dismissButton}
                    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {bannerImage}
                    </div>
                </div>

                <style jsx>{`
                    @keyframes bannerSlideLeft {
                        from { transform: translateY(-50%) translateX(100%); }
                        to { transform: translateY(-50%) translateX(0); }
                    }
                `}</style>
            </div>
        );
    }

    // ============= HEADER =============
    if (type === 'header') {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${widthPercent}vw`,
                    maxWidth: '100vw',
                    zIndex: 9999,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    animation: 'bannerSlideDown 0.4s ease-out'
                }}
            >
                <div style={{ position: 'relative' }}>
                    {dismissButton}
                    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {bannerImage}
                    </div>
                </div>

                <style jsx>{`
                    @keyframes bannerSlideDown {
                        from { transform: translateX(-50%) translateY(-100%); }
                        to { transform: translateX(-50%) translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    // ============= INLINE (trong bài viết) =============
    return (
        <div
            style={{
                width: `${widthPercent}%`,
                maxWidth: '100%',
                margin: '24px auto',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
            }}
        >
            <div style={{ position: 'relative' }}>
                {dismissButton}
                <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                    {bannerImage}
                </div>
            </div>
        </div>
    );
}
