/**
 * Link Table Component
 * 
 * Hiển thị danh sách links dưới dạng bảng
 * Sử dụng Ant Design Table với các chức năng:
 * - Xem, Sửa, Xóa link
 * - Copy link
 * - Hiển thị ảnh preview
 */

import React from 'react';
import { 
    Table, 
    Button, 
    Space, 
    Image, 
    Typography, 
    Tooltip, 
    Popconfirm,
    Tag,
    message 
} from 'antd';
import { 
    EditOutlined, 
    DeleteOutlined, 
    CopyOutlined, 
    ExportOutlined,
    EyeOutlined 
} from '@ant-design/icons';

const { Text, Link } = Typography;

const LinkTable = ({ links, loading, onEdit, onDelete, onRefresh }) => {
    // Base URL cho short links
    const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:3001';

    /**
     * Copy link vào clipboard
     */
    const handleCopy = (slug) => {
        const fullUrl = `${baseUrl}/${slug}`;
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                message.success('Đã copy link!');
            })
            .catch(() => {
                message.error('Không thể copy link');
            });
    };

    /**
     * Mở link trong tab mới
     */
    const handleOpen = (slug) => {
        window.open(`${baseUrl}/${slug}`, '_blank');
    };

    // Định nghĩa các cột của bảng
    const columns = [
        {
            title: 'Ảnh Preview',
            dataIndex: 'imageUrl',
            key: 'imageUrl',
            width: 100,
            render: (imageUrl, record) => (
                <Image
                    src={imageUrl}
                    alt={record.title}
                    width={80}
                    height={80}
                    style={{ 
                        objectFit: 'cover', 
                        borderRadius: 8,
                        border: '1px solid #f0f0f0'
                    }}
                    placeholder={
                        <div style={{
                            width: 80,
                            height: 80,
                            background: '#f0f0f0',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <EyeOutlined style={{ color: '#999' }} />
                        </div>
                    }
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAH/0AAAA6ZVhJZk1NACoAAAAIAAAAAAAAA/9AAAAASUVORK5CYII="
                />
            )
        },
        {
            title: 'Slug',
            dataIndex: 'slug',
            key: 'slug',
            width: 150,
            render: (slug) => (
                <Space>
                    <Tag color="orange" style={{ fontFamily: 'monospace' }}>
                        /{slug}
                    </Tag>
                    <Tooltip title="Copy link">
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<CopyOutlined />}
                            onClick={() => handleCopy(slug)}
                        />
                    </Tooltip>
                </Space>
            )
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            width: 250,
            ellipsis: true,
            render: (title) => (
                <Text strong ellipsis style={{ maxWidth: 230 }}>
                    {title}
                </Text>
            )
        },
        {
            title: 'URL đích',
            dataIndex: 'targetUrl',
            key: 'targetUrl',
            ellipsis: true,
            render: (url) => (
                <Link href={url} target="_blank" ellipsis style={{ maxWidth: 250 }}>
                    {url}
                </Link>
            )
        },
        {
            title: 'Clicks',
            dataIndex: 'clicks',
            key: 'clicks',
            width: 100,
            sorter: (a, b) => a.clicks - b.clicks,
            render: (clicks) => (
                <Tag color={clicks > 100 ? 'green' : clicks > 10 ? 'blue' : 'default'}>
                    {clicks.toLocaleString()} clicks
                </Tag>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 100,
            filters: [
                { text: 'Hoạt động', value: true },
                { text: 'Ngưng', value: false }
            ],
            onFilter: (value, record) => record.isActive === value,
            render: (isActive) => (
                <Tag color={isActive ? 'success' : 'error'}>
                    {isActive ? 'Hoạt động' : 'Ngưng'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Mở link">
                        <Button 
                            type="text" 
                            icon={<ExportOutlined />}
                            onClick={() => handleOpen(record.slug)}
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button 
                            type="text" 
                            icon={<EditOutlined />}
                            onClick={() => onEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa link"
                        description="Bạn có chắc muốn xóa link này?"
                        onConfirm={() => onDelete(record.slug)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa">
                            <Button 
                                type="text" 
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Table
            columns={columns}
            dataSource={links}
            rowKey="id"
            loading={loading}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                    `${range[0]}-${range[1]} của ${total} links`
            }}
            scroll={{ x: 1200 }}
            style={{ 
                background: 'white',
                borderRadius: 8
            }}
        />
    );
};

export default LinkTable;
