/**
 * Link Table Component
 * 
 * Hiển thị danh sách links dưới dạng bảng
 * - Nút copy luôn sẵn sàng cho từng link
 * - Cột điều chỉnh độ rộng linh hoạt
 * - Compact layout, không mất nội dung
 * - Admin: Hiển thị cột User sở hữu
 */

import React, { useState } from 'react';
import { 
    Table, 
    Button, 
    Space, 
    Image, 
    Typography, 
    Tooltip, 
    Popconfirm,
    Tag,
    message,
    Drawer,
    Divider,
    Row,
    Col,
    Avatar
} from 'antd';
import { 
    EditOutlined, 
    DeleteOutlined, 
    CopyOutlined, 
    ExportOutlined,
    EyeOutlined,
    CheckCircleOutlined,
    BarChartOutlined,
    UserOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Text, Link } = Typography;

const LinkTable = ({ links, loading, onEdit, onDelete, onRefresh }) => {
    // Base URL cho short links
    const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:3001';
    
    // Kiểm tra role của user hiện tại
    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedLink, setSelectedLink] = useState(null);

    /**
     * Copy link vào clipboard
     */
    const handleCopy = (slug) => {
        const fullUrl = `${baseUrl}/${slug}`;
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                message.success('✅ Đã copy link!', 1);
            })
            .catch(() => {
                message.error('❌ Không thể copy link');
            });
    };

    /**
     * Mở link trong tab mới
     */
    const handleOpen = (slug) => {
        window.open(`${baseUrl}/${slug}`, '_blank');
    };

    /**
     * Hiển thị chi tiết link trong drawer
     */
    const handleShowDetails = (record) => {
        setSelectedLink(record);
        setDetailsOpen(true);
    };

    /**
     * Format số click
     */
    const formatClicks = (clicks) => {
        if (!clicks) return '0';
        if (clicks >= 1000000) return (clicks / 1000000).toFixed(1) + 'M';
        if (clicks >= 1000) return (clicks / 1000).toFixed(1) + 'K';
        return clicks.toString();
    };

    /**
     * Định nghĩa các cột của bảng
     * Layout compact, không mất nội dung
     */
    const columns = [
        {
            title: 'Ảnh',
            dataIndex: 'imageUrl',
            key: 'imageUrl',
            width: 70,
            render: (imageUrl, record) => (
                <div onClick={() => handleShowDetails(record)} style={{ cursor: 'pointer' }}>
                    <img
                        src={imageUrl}
                        alt={record.title}
                        width={60}
                        height={60}
                        style={{ 
                            objectFit: 'cover', 
                            borderRadius: 6,
                            border: '1px solid #f0f0f0'
                        }}
                        onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/60?text=No+Image';
                        }}
                    />
                </div>
            )
        },
        {
            title: 'Slug',
            dataIndex: 'slug',
            key: 'slug',
            width: 140,
            render: (slug) => (
                <Tooltip title={`Nhấn để copy: /${slug}`}>
                    <div
                        onClick={() => handleCopy(slug)}
                        style={{
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: '#fff7e6',
                            border: '1px solid #ffd591',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: '#d46b08',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ffe7ba';
                            e.currentTarget.style.borderColor = '#ffbb77';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff7e6';
                            e.currentTarget.style.borderColor = '#ffd591';
                        }}
                    >
                        <Space size={4}>
                            <span>/{slug}</span>
                            <CopyOutlined style={{ fontSize: 10 }} />
                        </Space>
                    </div>
                </Tooltip>
            )
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            width: 200,
            render: (title) => (
                <Tooltip title={title} placement="topLeft">
                    <Text 
                        strong 
                        ellipsis 
                        style={{ 
                            maxWidth: '100%',
                            display: 'block'
                        }}
                    >
                        {title}
                    </Text>
                </Tooltip>
            )
        },
        {
            title: 'Clicks',
            dataIndex: 'clicks',
            key: 'clicks',
            width: 100,
            sorter: (a, b) => (a.clicks || 0) - (b.clicks || 0),
            render: (clicks) => {
                const formatted = formatClicks(clicks || 0);
                return (
                    <Tag 
                        color={clicks > 100 ? 'green' : clicks > 10 ? 'blue' : 'default'}
                        style={{ fontSize: 12, fontWeight: 'bold' }}
                    >
                        <BarChartOutlined /> {formatted}
                    </Tag>
                );
            }
        },
        // Cột User sở hữu - Chỉ hiển thị cho Admin
        ...(isAdmin ? [{
            title: 'User sở hữu',
            dataIndex: 'userId',
            key: 'userId',
            width: 140,
            render: (userId) => {
                if (!userId) {
                    return (
                        <Tag color="default">
                            <UserOutlined /> System
                        </Tag>
                    );
                }
                return (
                    <Space size={4}>
                        <Avatar 
                            size="small" 
                            src={userId.avatar}
                            icon={<UserOutlined />}
                            style={{ backgroundColor: '#EE4D2D' }}
                        />
                        <Text ellipsis style={{ maxWidth: 80 }}>
                            {userId.username || userId.displayName || 'Unknown'}
                        </Text>
                    </Space>
                );
            }
        }] : []),
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 90,
            filters: [
                { text: 'Hoạt động', value: true },
                { text: 'Ngưng', value: false }
            ],
            onFilter: (value, record) => record.isActive === value,
            render: (isActive) => (
                <Tag 
                    color={isActive ? 'success' : 'error'}
                    icon={<CheckCircleOutlined />}
                >
                    {isActive ? 'Hoạt động' : 'Ngưng'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Xem chi tiết">
                        <Button 
                            type="text" 
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleShowDetails(record)}
                            style={{ color: '#1890ff' }}
                        />
                    </Tooltip>
                    <Tooltip title="Mở link">
                        <Button 
                            type="text" 
                            size="small"
                            icon={<ExportOutlined />}
                            onClick={() => handleOpen(record.slug)}
                            style={{ color: '#52c41a' }}
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button 
                            type="text" 
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(record)}
                            style={{ color: '#faad14' }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa link"
                        description="Bạn có chắc muốn xóa?"
                        onConfirm={() => onDelete(record.slug)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa">
                            <Button 
                                type="text" 
                                size="small"
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
        <>
            <Table
                columns={columns}
                dataSource={links}
                rowKey="slug"
                loading={loading}
                pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '15', '20', '50'],
                    showQuickJumper: true,
                    showTotal: (total, range) => 
                        `${range[0]}-${range[1]} của ${total} links`,
                    style: { marginTop: 16 }
                }}
                scroll={{ x: 1200 }}
                size="middle"
                style={{ 
                    background: 'white',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0'
                }}
                rowClassName={(record) => 
                    record.isActive ? '' : 'ant-table-row-disabled'
                }
            />

            {/* Drawer chi tiết link */}
            <Drawer
                title={
                    <Space>
                        <EyeOutlined style={{ color: '#EE4D2D' }} />
                        <span>Chi tiết Link</span>
                    </Space>
                }
                onClose={() => setDetailsOpen(false)}
                open={detailsOpen}
                width={500}
                styles={{ body: { padding: '24px' } }}
            >
                {selectedLink && (
                    <div>
                        {/* Ảnh preview */}
                        <div style={{ marginBottom: 24, textAlign: 'center' }}>
                            <Image
                                src={selectedLink.imageUrl}
                                alt={selectedLink.title}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: 300,
                                    borderRadius: 8,
                                    border: '2px solid #EE4D2D'
                                }}
                                preview={{
                                    mask: 'Xem toàn màn'
                                }}
                            />
                        </div>

                        <Divider />

                        {/* Tiêu đề */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={24}>
                                <Text type="secondary" style={{ fontSize: 12 }}>TIÊU ĐỀ</Text>
                                <div style={{ marginTop: 4 }}>
                                    <Text strong style={{ fontSize: 14 }}>
                                        {selectedLink.title}
                                    </Text>
                                </div>
                            </Col>
                        </Row>

                        {/* Slug */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={24}>
                                <Text type="secondary" style={{ fontSize: 12 }}>SHORT LINK</Text>
                                <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <Text 
                                        strong 
                                        code 
                                        style={{ 
                                            background: '#fff7e6',
                                            padding: '8px 12px',
                                            borderRadius: 4,
                                            flex: 1
                                        }}
                                    >
                                        {baseUrl}/{selectedLink.slug}
                                    </Text>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<CopyOutlined />}
                                        onClick={() => handleCopy(selectedLink.slug)}
                                        style={{ background: '#EE4D2D', borderColor: '#EE4D2D' }}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            </Col>
                        </Row>

                        {/* Link đích */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={24}>
                                <Text type="secondary" style={{ fontSize: 12 }}>LINK ĐỊA CHỈ</Text>
                                <div style={{ marginTop: 4 }}>
                                    <Link 
                                        href={selectedLink.targetUrl}
                                        target="_blank"
                                        ellipsis
                                        style={{
                                            display: 'block',
                                            wordBreak: 'break-all'
                                        }}
                                    >
                                        {selectedLink.targetUrl}
                                    </Link>
                                </div>
                            </Col>
                        </Row>

                        {/* Thống kê */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>TỔNG CLICKS</Text>
                                <div style={{ marginTop: 4 }}>
                                    <Text 
                                        strong 
                                        style={{ fontSize: 20, color: '#EE4D2D' }}
                                    >
                                        {(selectedLink.clicks || 0).toLocaleString()}
                                    </Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>TRẠNG THÁI</Text>
                                <div style={{ marginTop: 4 }}>
                                    <Tag 
                                        color={selectedLink.isActive ? 'success' : 'error'}
                                        icon={<CheckCircleOutlined />}
                                    >
                                        {selectedLink.isActive ? 'Hoạt động' : 'Ngưng'}
                                    </Tag>
                                </div>
                            </Col>
                        </Row>

                        <Divider />

                        {/* Nút hành động */}
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Button 
                                type="primary"
                                icon={<ExportOutlined />}
                                onClick={() => {
                                    handleOpen(selectedLink.slug);
                                    setDetailsOpen(false);
                                }}
                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            >
                                Mở Link
                            </Button>
                            <Button 
                                icon={<EditOutlined />}
                                onClick={() => {
                                    onEdit(selectedLink);
                                    setDetailsOpen(false);
                                }}
                                style={{ color: '#faad14', borderColor: '#faad14' }}
                            >
                                Chỉnh sửa
                            </Button>
                            <Popconfirm
                                title="Xóa link"
                                description="Bạn có chắc muốn xóa?"
                                onConfirm={() => {
                                    onDelete(selectedLink.slug);
                                    setDetailsOpen(false);
                                }}
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                            >
                                <Button 
                                    danger
                                    icon={<DeleteOutlined />}
                                >
                                    Xóa
                                </Button>
                            </Popconfirm>
                        </Space>
                    </div>
                )}
            </Drawer>
        </>
    );
};

export default LinkTable;
