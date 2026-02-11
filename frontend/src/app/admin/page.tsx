'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getCurrentUser } from '@/lib/authService';

export default function AdminPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const user = getCurrentUser();
        if (!user) {
            router.push('/admin/login');
        } else {
            // Redirect to dashboard
            router.push('/admin/dashboard');
        }
        setIsLoading(false);
    }, [router]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return null;
}
