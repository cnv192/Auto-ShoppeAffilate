'use client';

/**
 * HomeBannerDisplay Component
 * 
 * Hiển thị banner trên trang chủ
 * - Fetch tất cả banner active
 * - Random chọn 1 banner để hiển thị
 * - Hỗ trợ showDelay (hiển thị sau X giây)
 * - Auto rotate giữa các banner
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

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

export default function HomeBannerDisplay() {
    const [banners, setBanners] = useState<BannerData[]>([]);
    const [currentBanner, setCurrentBanner] = useState<BannerData | null>(null);
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);
    const rotateTimer = useRef<NodeJS.Timeout | null>(null);
    const bannerIndex = useRef(0);

    // Fetch all active banners
    const fetchBanners = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/banners/public/all`);
            if (!res.ok) return;

            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                // Shuffle banners randomly
                const shuffled = [...data.data].sort(() => Math.random() - 0.5);
                setBanners(shuffled);

                // Pick the first banner
                const first = shuffled[0];
                setCurrentBanner(first);
                bannerIndex.current = 0;

                // Apply showDelay
                const delay = first.showDelay || 0;
                setTimeout(() => {
                    setVisible(true);
                    setFadeIn(true);
                }, delay * 1000);
            }
        } catch (error) {
            console.error('Failed to fetch banners:', error);
        }
    }, []);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    // Auto-rotate banners every 8 seconds
    useEffect(() => {
        if (banners.length <= 1 || dismissed) return;

        rotateTimer.current = setInterval(() => {
            setFadeIn(false);
            setTimeout(() => {
                bannerIndex.current = (bannerIndex.current + 1) % banners.length;
                setCurrentBanner(banners[bannerIndex.current]);
                setFadeIn(true);
            }, 300);
        }, 8000);

        return () => {
            if (rotateTimer.current) clearInterval(rotateTimer.current);
        };
    }, [banners, dismissed]);

    const handleClick = useCallback(async () => {
        if (!currentBanner) return;

        // Record click
        try {
            await fetch(`${API_BASE}/api/banners/${currentBanner.id}/click`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to record banner click:', error);
        }

        // Navigate
        const targetUrl = currentBanner.targetUrl || (currentBanner.targetSlug ? `/${currentBanner.targetSlug}` : null);
        if (targetUrl) {
            if (targetUrl.startsWith('http')) {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = targetUrl;
            }
        }
    }, [currentBanner]);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissed(true);
        setVisible(false);
        if (rotateTimer.current) clearInterval(rotateTimer.current);
    }, []);

    if (!currentBanner || !visible || dismissed) return null;

    const widthPercent = currentBanner.displayWidth || 60;

    return (
        <div
            style={{
                width: `${widthPercent}%`,
                maxWidth: '100%',
                margin: '0 auto 24px auto',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                position: 'relative',
                opacity: fadeIn ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out',
            }}
        >
            {/* Dismiss button */}
            {currentBanner.dismissible !== false && (
                <button
                    onClick={handleDismiss}
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: '#fff',
                        fontSize: 16,
                        cursor: 'pointer',
                        width: 28,
                        height: 28,
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
            )}

            {/* Banner dots indicator */}
            {banners.length > 1 && (
                <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 6,
                    zIndex: 10
                }}>
                    {banners.map((_, idx) => (
                        <span
                            key={idx}
                            style={{
                                width: idx === bannerIndex.current ? 20 : 8,
                                height: 8,
                                borderRadius: 4,
                                background: idx === bannerIndex.current ? '#D31016' : 'rgba(255,255,255,0.6)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setFadeIn(false);
                                setTimeout(() => {
                                    bannerIndex.current = idx;
                                    setCurrentBanner(banners[idx]);
                                    setFadeIn(true);
                                }, 200);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Banner image */}
            <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                <picture>
                    {currentBanner.mobileImageUrl && (
                        <source media="(max-width: 768px)" srcSet={currentBanner.mobileImageUrl} />
                    )}
                    <img
                        src={currentBanner.imageUrl}
                        alt={currentBanner.altText || currentBanner.name}
                        style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            objectFit: 'contain'
                        }}
                    />
                </picture>
            </div>
        </div>
    );
}
