/**
 * Custom hooks cho Admin data fetching với SWR
 * Giúp cải thiện UX với:
 * - Stale-while-revalidate: Hiển thị data cũ ngay lập tức, fetch mới trong background
 * - Automatic revalidation: Tự động refresh khi focus window
 * - Optimistic updates: Cập nhật UI trước khi API hoàn thành
 * - Error retry: Tự động thử lại khi lỗi
 */

import useSWR, { mutate } from 'swr';
import { getToken } from '@/lib/authService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher function với authentication
const fetcher = async (url: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}${url}`, {
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

// SWR config mặc định cho admin
const swrConfig = {
    revalidateOnFocus: true,  // Refresh khi quay lại tab
    revalidateOnReconnect: true,  // Refresh khi có internet lại
    dedupingInterval: 5000,  // Chống duplicate request trong 5s
    errorRetryCount: 3,  // Thử lại 3 lần khi lỗi
    errorRetryInterval: 1000,  // Đợi 1s giữa các lần thử
    keepPreviousData: true,  // Giữ data cũ khi fetching
};

/**
 * Hook lấy danh sách Links
 */
export function useLinks() {
    const { data, error, isLoading, isValidating, mutate: mutateLinks } = useSWR(
        '/api/links',
        fetcher,
        {
            ...swrConfig,
            fallbackData: [], // Data mặc định để tránh undefined
        }
    );

    // Extract links from response format: { success, data, total }
    const links = (() => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data.data && Array.isArray(data.data)) return data.data;
        return [];
    })();

    return {
        links,
        isLoading,
        isValidating, // true khi đang revalidate trong background
        isError: !!error,
        error,
        refresh: () => mutateLinks(),
        // Optimistic update helper
        optimisticUpdate: async (updateFn: (currentData: any[]) => any[]) => {
            await mutateLinks(updateFn, { revalidate: false });
        }
    };
}

/**
 * Hook lấy danh sách Campaigns
 */
export function useCampaigns() {
    const { data, error, isLoading, isValidating, mutate: mutateCampaigns } = useSWR(
        '/api/campaigns',
        fetcher,
        {
            ...swrConfig,
            refreshInterval: 30000, // Refresh mỗi 30s vì campaigns có thể thay đổi status
        }
    );

    // Parse response format
    const campaigns = (() => {
        if (!data) return [];
        const parsed = data.data || data;
        const list = parsed.campaigns || parsed || [];
        return Array.isArray(list) ? list : [];
    })();

    return {
        campaigns,
        isLoading,
        isValidating,
        isError: !!error,
        error,
        refresh: () => mutateCampaigns(),
    };
}

/**
 * Hook lấy Dashboard data
 */
export function useDashboard() {
    // Fetch links
    const { links, isLoading: linksLoading } = useLinks();

    // Fetch hourly traffic
    const { data: trafficData, isLoading: trafficLoading } = useSWR(
        '/api/dashboard/hourly-traffic',
        fetcher,
        {
            ...swrConfig,
            refreshInterval: 60000, // Refresh traffic mỗi phút
        }
    );

    const hourlyTraffic = (() => {
        if (!trafficData?.success || !trafficData?.data) return [];
        return Array.isArray(trafficData.data) ? trafficData.data : [];
    })();

    return {
        links,
        hourlyTraffic,
        isLoading: linksLoading || trafficLoading,
        isLinksLoading: linksLoading,
        isTrafficLoading: trafficLoading,
    };
}

/**
 * Hook lấy Facebook Accounts
 */
export function useFacebookAccounts() {
    const { data, error, isLoading, isValidating, mutate: mutateAccounts } = useSWR(
        '/api/facebook-accounts',
        fetcher,
        swrConfig
    );

    return {
        accounts: Array.isArray(data) ? data : (data?.data || []),
        isLoading,
        isValidating,
        isError: !!error,
        error,
        refresh: () => mutateAccounts(),
    };
}

/**
 * Hook lấy Banners
 */
export function useBanners() {
    const { data, error, isLoading, isValidating, mutate: mutateBanners } = useSWR(
        '/api/banners',
        fetcher,
        swrConfig
    );

    return {
        banners: Array.isArray(data) ? data : (data?.data || []),
        isLoading,
        isValidating,
        isError: !!error,
        error,
        refresh: () => mutateBanners(),
    };
}

/**
 * Hook lấy Resource Sets
 */
export function useResourceSets() {
    const { data, error, isLoading, isValidating, mutate: mutateResourceSets } = useSWR(
        '/api/resource-sets',
        fetcher,
        swrConfig
    );

    return {
        resourceSets: Array.isArray(data) ? data : (data?.data || []),
        isLoading,
        isValidating,
        isError: !!error,
        error,
        refresh: () => mutateResourceSets(),
    };
}

/**
 * Hook lấy Users (Admin only)
 */
export function useUsers() {
    const { data, error, isLoading, isValidating, mutate: mutateUsers } = useSWR(
        '/api/users',
        fetcher,
        swrConfig
    );

    return {
        users: Array.isArray(data) ? data : (data?.data || []),
        isLoading,
        isValidating,
        isError: !!error,
        error,
        refresh: () => mutateUsers(),
    };
}

/**
 * Prefetch data - gọi trước khi navigate để data sẵn sàng
 */
export const prefetchLinks = () => mutate('/api/links', fetcher('/api/links'));
export const prefetchCampaigns = () => mutate('/api/campaigns', fetcher('/api/campaigns'));
export const prefetchDashboard = () => {
    mutate('/api/links', fetcher('/api/links'));
    mutate('/api/dashboard/hourly-traffic', fetcher('/api/dashboard/hourly-traffic'));
};

/**
 * Invalidate cache - buộc fetch lại data mới
 */
export const invalidateLinks = () => mutate('/api/links');
export const invalidateCampaigns = () => mutate('/api/campaigns');
export const invalidateAll = () => {
    mutate('/api/links');
    mutate('/api/campaigns');
    mutate('/api/dashboard/hourly-traffic');
    mutate('/api/facebook-accounts');
    mutate('/api/banners');
    mutate('/api/resource-sets');
};
