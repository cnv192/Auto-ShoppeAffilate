/**
 * AdminPageHeader - Header chuẩn cho các trang admin
 * Đảm bảo đồng bộ layout giữa tất cả các trang
 */

'use client';

import React, { ReactNode } from 'react';
import { Typography, Space, Button } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    titleColor?: string;
    isLoading?: boolean;
    onRefresh?: () => void;
    extra?: ReactNode;
    children?: ReactNode;
}

export default function AdminPageHeader({
    title,
    subtitle,
    icon,
    titleColor = '#EE4D2D',
    isLoading = false,
    onRefresh,
    extra,
    children
}: AdminPageHeaderProps) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16
        }}>
            <div style={{ minWidth: 200 }}>
                <Title level={2} style={{
                    margin: 0,
                    marginBottom: subtitle ? 8 : 0,
                    color: titleColor,
                    fontSize: 24,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    {icon}
                    {title}
                    {isLoading && (
                        <SyncOutlined spin style={{ marginLeft: 8, fontSize: 16, color: '#999' }} />
                    )}
                </Title>
                {subtitle && (
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        {subtitle}
                    </Text>
                )}
            </div>

            <Space wrap>
                {onRefresh && (
                    <Button
                        icon={isLoading ? <SyncOutlined spin /> : <ReloadOutlined />}
                        onClick={onRefresh}
                        loading={isLoading}
                    >
                        Làm mới
                    </Button>
                )}
                {extra}
                {children}
            </Space>
        </div>
    );
}
