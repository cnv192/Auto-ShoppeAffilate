'use client';

import React, { useState } from 'react';
import {
    Typography,
    Button,
    Space,
    message,
    Empty,
    Spin
} from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    SyncOutlined
} from '@ant-design/icons';
import dynamic from 'next/dynamic';

import LinkTable from '@/components/LinkTable';
import { StatsCards } from '@/components/StatsCards';
import { ListPageSkeleton } from '@/components/PageSkeleton';
import { useLinks, invalidateLinks } from '@/hooks/useAdminData';
import { createLink, updateLink, deleteLink } from '@/lib/adminApi';

const { Title, Text } = Typography;

// Dynamic import for LinkFormArticle (contains ReactQuill which needs client-side only)
const LinkFormArticle = dynamic(() => import('@/components/LinkFormArticle'), {
    ssr: false,
    loading: () => <Spin/>
});

interface Link {
    slug: string;
    title: string;
    imageUrl?: string;
    clicks?: number;
    isActive?: boolean;
    [key: string]: any;
}

export default function LinksPage() {
    // SWR hook - data được cache và hiển thị ngay lập tức
    const { links, isLoading, isValidating, refresh } = useLinks();
    
    // Local state chỉ cho form
    const [editingLink, setEditingLink] = useState<Link | null>(null);
    const [formVisible, setFormVisible] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Hiển thị skeleton khi loading lần đầu (không có cached data)
    if (isLoading && links.length === 0) {
        return <ListPageSkeleton rows={5} />;
    }

    // Handle create new link
    const handleCreate = () => {
        setEditingLink(null);
        setFormVisible(true);
    };

    // Handle edit link
    const handleEdit = (link: Link) => {
        setEditingLink(link);
        setFormVisible(true);
    };

    // Handle form submit (create or update)
    const handleFormSubmit = async (values: any) => {
        try {
            setFormLoading(true);

            // Map customSlug to slug for backend, ensure all fields are included
            const linkData = {
                ...values,
                customSlug: values.customSlug != null && values.customSlug !== '' 
                    ? values.customSlug 
                    : (editingLink ? editingLink.slug : undefined), // Backend expects customSlug
                description: values.description || '',
                content: values.content || '',
                category: values.category || 'Khuyến mãi',
                author: values.author || 'Tin tức 24h',
                publishedAt: values.publishedAt || new Date().toISOString()
            };

            // Remove slug field as backend uses customSlug
            delete linkData.slug;

            console.log('📤 [LinksPage] Submitting link data:', {
                ...linkData,
                content: linkData.content ? `${linkData.content.substring(0, 50)}...` : 'empty'
            });

            if (editingLink) {
                // Update existing link - use slug (not _id) as identifier
                await updateLink(editingLink.slug, linkData);
                message.success('Cập nhật link thành công!');
            } else {
                // Create new link
                await createLink(linkData);
                message.success('Tạo link mới thành công!');
            }

            setFormVisible(false);
            setEditingLink(null);
            // Invalidate cache để fetch data mới
            invalidateLinks();

        } catch (error: any) {
            console.error('❌ [LinksPage] Submit error:', error);
            message.error(error.message || 'Có lỗi xảy ra');
        } finally {
            setFormLoading(false);
        }
    };
    // Handle delete link - receives slug from LinkTable
    const handleDelete = async (slug: string) => {
        try {
            await deleteLink(slug);
            message.success('Xóa link thành công!');
            invalidateLinks();
        } catch (error) {
            message.error('Không thể xóa link');
        }
    };

    // Handle refresh
    const handleRefresh = () => {
        refresh();
    };

    return (
        <>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <Title level={2} style={{
                        margin: 0,
                        marginBottom: 8,
                        color: '#D31016',
                        fontSize: 24,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        lineHeight: 1.3
                    }}>
                        Quản lý Links
                        {isValidating && (
                            <SyncOutlined spin style={{ fontSize: 16, color: '#999' }} />
                        )}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Quản lý tất cả các liên kết affiliate
                    </Text>
                </div>

                <Space wrap>
                    <Button
                        icon={isValidating ? <SyncOutlined spin /> : <ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={isValidating}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Làm mới
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        style={{ height: 40, borderRadius: 8, fontWeight: 500 }}
                    >
                        Tạo Link Mới
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            <StatsCards links={links} />

            {/* Links Table - hiển thị ngay với data cached */}
            {links.length > 0 ? (
                <LinkTable
                    links={links}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={false}
                    onRefresh={refresh}
                />
            ) : (
                <Empty
                    description="Chưa có link nào"
                    style={{ padding: '60px 0' }}
                >
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                    >
                        Tạo Link Đầu Tiên
                    </Button>
                </Empty>
            )}

            {/* Link Form Modal */}
            <LinkFormArticle
                visible={formVisible}
                onCancel={() => {
                    setFormVisible(false);
                    setEditingLink(null);
                }}
                onSubmit={handleFormSubmit}
                editingLink={editingLink}
                loading={formLoading}
            />
        </>
    );
}
