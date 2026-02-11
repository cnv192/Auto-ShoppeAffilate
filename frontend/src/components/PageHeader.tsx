'use client';

import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Consistent page header styles
export const PAGE_HEADER_STYLES = {
    container: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap' as const,
        gap: 16
    },
    title: {
        margin: 0,
        marginBottom: 8,
        color: '#EE4D2D',
        fontSize: 24,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        lineHeight: 1.3
    },
    subtitle: {
        fontSize: 14
    }
};

// Consistent button styles
export const BUTTON_STYLES = {
    primary: {
        height: 40,
        borderRadius: 8,
        fontWeight: 500,
        fontSize: 14
    },
    secondary: {
        height: 40,
        borderRadius: 8,
        fontWeight: 500,
        fontSize: 14
    },
    icon: {
        height: 40,
        width: 40,
        borderRadius: 8
    }
};

// Consistent card styles
export const CARD_STYLES = {
    stats: {
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    },
    content: {
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }
};

interface PageHeaderProps {
    icon?: React.ReactNode;
    title: string;
    subtitle: string;
    isLoading?: boolean;
    onRefresh?: () => void;
    extra?: React.ReactNode;
    titleColor?: string;
}

export function PageHeader({
    icon,
    title,
    subtitle,
    isLoading = false,
    onRefresh,
    extra,
    titleColor = '#EE4D2D'
}: PageHeaderProps) {
    return (
        <div style={PAGE_HEADER_STYLES.container}>
            <div>
                <Title level={2} style={{
                    ...PAGE_HEADER_STYLES.title,
                    color: titleColor
                }}>
                    {icon}
                    {title}
                    {isLoading && (
                        <SyncOutlined spin style={{ marginLeft: 8, fontSize: 16, color: '#999' }} />
                    )}
                </Title>
                <Text type="secondary" style={PAGE_HEADER_STYLES.subtitle}>
                    {subtitle}
                </Text>
            </div>

            <Space wrap>
                {onRefresh && (
                    <Button
                        icon={isLoading ? <SyncOutlined spin /> : <ReloadOutlined />}
                        onClick={onRefresh}
                        loading={isLoading}
                        style={BUTTON_STYLES.secondary}
                    >
                        Làm mới
                    </Button>
                )}
                {extra}
            </Space>
        </div>
    );
}

// Stats Row with consistent styling
export const STATS_ROW_STYLES = {
    container: {
        marginBottom: 24
    },
    card: {
        borderRadius: 12,
        border: '1px solid #f0f0f0'
    }
};

export default PageHeader;
