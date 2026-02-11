/**
 * SWR Provider - Cấu hình SWR toàn cục cho ứng dụng
 * 
 * Các tính năng:
 * - Stale-while-revalidate: Hiển thị data cached ngay, fetch mới trong background
 * - Revalidate on focus: Tự động refresh khi quay lại tab
 * - Revalidate on reconnect: Refresh khi có internet lại
 * - Error retry: Tự động thử lại khi lỗi
 */

'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { getToken } from '@/lib/authService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher mặc định với authentication
const defaultFetcher = async (url: string) => {
    const token = getToken();
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    const res = await fetch(fullUrl, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    });

    if (!res.ok) {
        const error = new Error('Không thể tải dữ liệu');
        throw error;
    }

    return res.json();
};

interface SWRProviderProps {
    children: React.ReactNode;
}

export default function SWRProvider({ children }: SWRProviderProps) {
    return (
        <SWRConfig
            value={{
                fetcher: defaultFetcher,
                
                // Hiển thị data cũ ngay lập tức trong khi fetch data mới
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                
                // Giữ data cũ khi fetching
                keepPreviousData: true,
                
                // Chống duplicate request trong 5s
                dedupingInterval: 5000,
                
                // Error retry
                errorRetryCount: 3,
                errorRetryInterval: 1000,
                
                // Không loading blocking - hiển thị stale data trong khi revalidate
                revalidateIfStale: true,
                
                // Performance optimizations
                shouldRetryOnError: true,
                
                // Callback khi có lỗi (có thể log hoặc notify)
                onError: (error, key) => {
                    console.error(`[SWR Error] ${key}:`, error);
                },
                
                // Loading timeout để tránh flash
                loadingTimeout: 3000,
            }}
        >
            {children}
        </SWRConfig>
    );
}
