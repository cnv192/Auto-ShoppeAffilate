const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Link = require('../models/Link');
const Campaign = require('../models/Campaign');

/**
 * Dashboard Routes
 * 
 * GET /api/dashboard/stats - Lấy thống kê dashboard
 * GET /api/dashboard/hourly-traffic - Lấy traffic theo giờ hôm nay
 */

/**
 * GET /api/dashboard/stats
 * Lấy thống kê dashboard (phân quyền Admin/User)
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const userId = req.user._id;

        let stats = {};

        if (isAdmin) {
            // Admin: xem toàn bộ thống kê
            const [totalLinks, totalUsers, totalCampaigns] = await Promise.all([
                Link.countDocuments({ isActive: true }),
                User.countDocuments({ isActive: true }),
                Campaign.countDocuments()
            ]);

            // Tổng lượt truy cập từ tất cả links
            const clicksAggregation = await Link.aggregate([
                { $group: { _id: null, totalClicks: { $sum: '$validClicks' } } }
            ]);
            const totalClicks = clicksAggregation[0]?.totalClicks || 0;

            stats = {
                totalLinks,
                totalUsers,
                totalClicks,
                totalCampaigns,
                isAdmin: true
            };
        } else {
            // User: chỉ xem dữ liệu của mình
            const [userLinks, userCampaigns] = await Promise.all([
                Link.countDocuments({ userId: userId, isActive: true }),
                Campaign.countDocuments({ userId: userId })
            ]);

            // Tổng lượt truy cập chỉ thuộc user này
            const clicksAggregation = await Link.aggregate([
                { $match: { userId: userId } },
                { $group: { _id: null, totalClicks: { $sum: '$validClicks' } } }
            ]);
            const totalClicks = clicksAggregation[0]?.totalClicks || 0;

            stats = {
                totalLinks: userLinks,
                totalClicks,
                totalCampaigns: userCampaigns,
                isAdmin: false
            };
        }

        return res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/dashboard/hourly-traffic
 * Lấy traffic theo khung giờ trong ngày hôm nay
 */
router.get('/hourly-traffic', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const userId = req.user._id;

        // Lấy ngày hôm nay (00:00:00 - 23:59:59)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Match condition based on role
        const matchCondition = isAdmin 
            ? {} 
            : { userId: userId };

        // Aggregate clicks by hour
        const hourlyData = await Link.aggregate([
            { $match: matchCondition },
            { $unwind: '$clickLogs' },
            { 
                $match: {
                    'clickLogs.clickedAt': { $gte: today, $lt: tomorrow }
                }
            },
            {
                $group: {
                    _id: { $hour: '$clickLogs.clickedAt' },
                    clicks: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format data for chart (24 hours)
        const trafficByHour = Array.from({ length: 24 }, (_, hour) => {
            const found = hourlyData.find(d => d._id === hour);
            return {
                hour: `${hour.toString().padStart(2, '0')}:00`,
                clicks: found ? found.clicks : 0
            };
        });

        return res.json({
            success: true,
            data: trafficByHour
        });

    } catch (error) {
        console.error('❌ Hourly traffic error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/dashboard/recent-links
 * Lấy links gần đây
 */
router.get('/recent-links', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 5;

        const query = isAdmin ? {} : { userId: userId };

        const recentLinks = await Link.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'username fullName')
            .select('slug title validClicks createdAt userId');

        return res.json({
            success: true,
            data: recentLinks
        });

    } catch (error) {
        console.error('❌ Recent links error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

module.exports = router;
