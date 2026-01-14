const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const FacebookAccount = require('../models/FacebookAccount');
const { authenticate, requireAdmin, authorizeResourceAccess } = require('../middleware/auth');

/**
 * Helper: Parse textarea/string inputs into arrays
 * Splits by newline, handles CRLF, trims whitespace, removes empty lines.
 * @param {String|Array} input - Input value (string or array)
 * @returns {Array} - Cleaned array of non-empty strings
 */
const parseListInput = (input) => {
    if (!input) return [];
    
    // If it's already an array, clean each item
    if (Array.isArray(input)) {
        return input
            .map(x => (typeof x === 'string' ? x.trim() : x))
            .filter(x => x && (typeof x !== 'string' || x.length > 0));
    }
    
    // If it's a string, split by newline (handles \n and \r\n)
    if (typeof input === 'string') {
        return input
            .split(/\r?\n/) // Split by \n or \r\n
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    
    return [];
};

/**
 * Campaign Routes
 * 
 * POST   /api/campaigns - Tạo campaign mới
 * GET    /api/campaigns - Lấy danh sách campaigns
 * GET    /api/campaigns/:id - Lấy chi tiết campaign
 * PUT    /api/campaigns/:id - Cập nhật campaign
 * DELETE /api/campaigns/:id - Xóa campaign
 * 
 * POST   /api/campaigns/:id/start - Bắt đầu campaign
 * POST   /api/campaigns/:id/pause - Tạm dừng campaign
 * POST   /api/campaigns/:id/resume - Tiếp tục campaign
 * POST   /api/campaigns/:id/stop - Dừng campaign hoàn toàn
 */

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * POST /api/campaigns
 * Tạo campaign mới
 */
router.post('/', authenticate, async (req, res) => {
    try {
        // ============================================
        // PARSE LIST INPUTS (String -> Array)
        // Frontend sends newline-separated strings from textareas
        // ============================================
        req.body.slugs = parseListInput(req.body.slugs);
        req.body.commentTemplates = parseListInput(req.body.commentTemplates);
        req.body.targetPostIds = parseListInput(req.body.targetPostIds);
        req.body.linkGroups = parseListInput(req.body.linkGroups);
        req.body.fanpages = parseListInput(req.body.fanpages);
        
        const {
            name,
            description,
            slugs,
            commentTemplates,
            startTime,
            durationHours,
            startDate,
            filters,
            maxCommentsPerPost,
            delayBetweenComments,
            delayMin,
            delayMax,
            linkGroups,
            fanpages,
            targetPostIds,
            facebookAccountId
        } = req.body;
        
        // Log request body for debugging (after parsing)
        console.log('📝 [Campaign Create] Request body (parsed):', {
            name,
            slugsCount: slugs?.length,
            templatesCount: commentTemplates?.length,
            targetPostIdsCount: targetPostIds?.length,
            startTime,
            durationHours,
            delayMin,
            delayMax,
            facebookAccountId,
            hasFilters: !!filters,
            hasLinkGroups: !!linkGroups,
            hasFanpages: !!fanpages
        });
        
        // Validate required fields with detailed logging
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!slugs) missingFields.push('slugs');
        if (!commentTemplates) missingFields.push('commentTemplates');
        if (!startTime) missingFields.push('startTime');
        if (!durationHours && durationHours !== 0) missingFields.push('durationHours');
        if (!facebookAccountId) missingFields.push('facebookAccountId');
        
        if (missingFields.length > 0) {
            console.error('❌ [Campaign Create] Missing required fields:', missingFields);
            return res.status(400).json({
                success: false,
                message: `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`
            });
        }
        
        // Validate slugs and commentTemplates arrays
        if (!Array.isArray(slugs)) {
            console.error('❌ [Campaign Create] slugs is not an array:', typeof slugs, slugs);
            return res.status(400).json({
                success: false,
                message: 'slugs phải là một mảng'
            });
        }
        
        if (slugs.length === 0) {
            console.error('❌ [Campaign Create] slugs array is empty');
            return res.status(400).json({
                success: false,
                message: 'Phải có ít nhất 1 slug'
            });
        }

        if (!Array.isArray(commentTemplates)) {
            console.error('❌ [Campaign Create] commentTemplates is not an array:', typeof commentTemplates, commentTemplates);
            return res.status(400).json({
                success: false,
                message: 'commentTemplates phải là một mảng'
            });
        }
        
        if (commentTemplates.length === 0) {
            console.error('❌ [Campaign Create] commentTemplates array is empty');
            return res.status(400).json({
                success: false,
                message: 'Phải có ít nhất 1 comment template'
            });
        }
        
        // Check Facebook account exists và thuộc về user
        console.log('🔍 [Campaign Create] Checking Facebook account:', facebookAccountId);
        const fbAccount = await FacebookAccount.findById(facebookAccountId);
        
        if (!fbAccount) {
            console.error('❌ [Campaign Create] Facebook account not found');
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        console.log('✅ [Campaign Create] Facebook account found:', fbAccount.accountName);
        
        // User chỉ được dùng FB account của mình, Admin có thể dùng tất cả
        if (req.userRole !== 'admin' && fbAccount.userId.toString() !== req.userId.toString()) {
            console.error('❌ [Campaign Create] Permission denied');
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền sử dụng tài khoản Facebook này'
            });
        }
        
        // Check FB account is active
        if (!fbAccount.isActive || !fbAccount.isTokenValid()) {
            console.error('❌ [Campaign Create] Facebook account inactive or token invalid');
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook không còn hoạt động hoặc token đã hết hạn'
            });
        }
        
        console.log('✅ [Campaign Create] All validations passed, creating campaign...');
        
        // Create campaign
        const campaign = await Campaign.create({
            name,
            description,
            userId: req.userId,
            slugs,
            commentTemplates,
            startTime,
            durationHours,
            startDate: startDate || new Date(),
            filters: filters || {},
            maxCommentsPerPost: maxCommentsPerPost || 1,
            delayBetweenComments: delayBetweenComments || delayMin || 30,
            delayMin: delayMin || 30,
            delayMax: delayMax || 60,
            linkGroups: Array.isArray(linkGroups) ? linkGroups : [],
            fanpages: Array.isArray(fanpages) ? fanpages : [],
            targetPostIds: Array.isArray(targetPostIds) ? targetPostIds : [],
            facebookAccountId,
            status: 'draft'
        });
        
        console.log('✅ [Campaign Create] Campaign created successfully:', campaign._id);
        
        // Populate Facebook account info
        await campaign.populate('facebookAccountId', 'name profileUrl');
        
        return res.status(201).json({
            success: true,
            message: 'Tạo campaign thành công',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Create campaign error:', error);
        console.error('❌ Error stack:', error.stack);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.error('❌ Validation errors:', errors);
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors: errors
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/campaigns
 * Lấy danh sách campaigns
 * Admin: Xem tất cả
 * User: Chỉ xem của mình
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        // Admin có thể xem tất cả, User chỉ xem của mình
        const userId = req.userRole === 'admin' ? req.query.userId : req.userId;
        
        const result = await Campaign.getCampaignsByUser(userId, {
            status,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        return res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('❌ Get campaigns error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/campaigns/:id
 * Lấy chi tiết campaign
 * Ensures all necessary data is populated for Frontend Edit Form
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .populate('facebookAccountId', '_id name profileUrl email isActive tokenStatus accountName')
            .populate('userId', '_id username fullName');
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission: User chỉ xem của mình, Admin xem tất cả
        if (req.userRole !== 'admin' && campaign.userId._id.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem campaign này'
            });
        }
        
        // Convert to plain object to ensure filters are properly serialized
        const campaignData = campaign.toObject();
        
        // Ensure filters object exists with defaults
        campaignData.filters = {
            minLikes: campaign.filters?.minLikes ?? 0,
            minComments: campaign.filters?.minComments ?? 0,
            minShares: campaign.filters?.minShares ?? 0
        };
        
        return res.json({
            success: true,
            data: campaignData
        });
        
    } catch (error) {
        console.error('❌ Get campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * PUT /api/campaigns/:id
 * Cập nhật campaign
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền cập nhật campaign này'
            });
        }
        
        // Chỉ cho phép update khi campaign đang draft hoặc paused
        if (!['draft', 'paused'].includes(campaign.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể cập nhật campaign đang ở trạng thái draft hoặc paused'
            });
        }
        
        // ============================================
        // PARSE LIST INPUTS (String -> Array)
        // Frontend sends newline-separated strings from textareas
        // ============================================
        if (req.body.slugs !== undefined) req.body.slugs = parseListInput(req.body.slugs);
        if (req.body.commentTemplates !== undefined) req.body.commentTemplates = parseListInput(req.body.commentTemplates);
        if (req.body.targetPostIds !== undefined) req.body.targetPostIds = parseListInput(req.body.targetPostIds);
        if (req.body.linkGroups !== undefined) req.body.linkGroups = parseListInput(req.body.linkGroups);
        if (req.body.fanpages !== undefined) req.body.fanpages = parseListInput(req.body.fanpages);
        
        const {
            name,
            description,
            slugs,
            commentTemplates,
            startTime,
            durationHours,
            startDate,
            filters,
            maxCommentsPerPost,
            delayBetweenComments,
            delayMin,
            delayMax,
            linkGroups,
            fanpages,
            targetPostIds
        } = req.body;
        
        // Update fields
        if (name !== undefined) campaign.name = name;
        if (description !== undefined) campaign.description = description;
        if (slugs !== undefined) campaign.slugs = slugs;
        if (commentTemplates !== undefined) campaign.commentTemplates = commentTemplates;
        if (startTime !== undefined) campaign.startTime = startTime;
        if (durationHours !== undefined) campaign.durationHours = durationHours;
        if (startDate !== undefined) campaign.startDate = startDate;
        if (filters !== undefined) campaign.filters = { ...campaign.filters, ...filters };
        if (maxCommentsPerPost !== undefined) campaign.maxCommentsPerPost = maxCommentsPerPost;
        if (delayBetweenComments !== undefined) campaign.delayBetweenComments = delayBetweenComments;
        if (delayMin !== undefined) campaign.delayMin = delayMin;
        if (delayMax !== undefined) campaign.delayMax = delayMax;
        if (linkGroups !== undefined) campaign.linkGroups = linkGroups;
        if (fanpages !== undefined) campaign.fanpages = fanpages;
        if (targetPostIds !== undefined) campaign.targetPostIds = targetPostIds;
        
        await campaign.save();
        await campaign.populate('facebookAccountId', 'name profileUrl');
        
        return res.json({
            success: true,
            message: 'Cập nhật campaign thành công',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Update campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * DELETE /api/campaigns/:id
 * Xóa campaign
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xóa campaign này'
            });
        }
        
        // Không cho xóa campaign đang active
        if (campaign.status === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng dừng campaign trước khi xóa'
            });
        }
        
        await campaign.deleteOne();
        
        return res.json({
            success: true,
            message: 'Xóa campaign thành công'
        });
        
    } catch (error) {
        console.error('❌ Delete campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// ============================================
// CAMPAIGN CONTROLS
// ============================================

/**
 * POST /api/campaigns/:id/start
 * Bắt đầu chạy campaign
 */
router.post('/:id/start', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền start campaign này'
            });
        }
        
        // Validate status
        if (!['draft', 'paused'].includes(campaign.status)) {
            return res.status(400).json({
                success: false,
                message: 'Campaign không thể start từ trạng thái hiện tại'
            });
        }
        
        // Check FB account still valid
        const fbAccount = await FacebookAccount.findById(campaign.facebookAccountId);
        if (!fbAccount || !fbAccount.isActive || !fbAccount.isTokenValid()) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook không còn hoạt động'
            });
        }
        
        // Start campaign
        campaign.status = 'active';
        campaign.activityLogs.push({
            action: 'started',
            message: 'Campaign được bắt đầu',
            timestamp: new Date()
        });
        
        await campaign.save();
        
        return res.json({
            success: true,
            message: 'Đã bắt đầu campaign',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Start campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/pause
 * Tạm dừng campaign
 */
router.post('/:id/pause', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền pause campaign này'
            });
        }
        
        if (campaign.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể pause campaign đang active'
            });
        }
        
        campaign.status = 'paused';
        campaign.activityLogs.push({
            action: 'paused',
            message: 'Campaign bị tạm dừng',
            timestamp: new Date()
        });
        
        await campaign.save();
        
        return res.json({
            success: true,
            message: 'Đã tạm dừng campaign',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Pause campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/resume
 * Tiếp tục campaign
 */
router.post('/:id/resume', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền resume campaign này'
            });
        }
        
        if (campaign.status !== 'paused') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể resume campaign đang paused'
            });
        }
        
        campaign.status = 'active';
        campaign.activityLogs.push({
            action: 'resumed',
            message: 'Campaign được tiếp tục',
            timestamp: new Date()
        });
        
        await campaign.save();
        
        return res.json({
            success: true,
            message: 'Đã tiếp tục campaign',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Resume campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/stop
 * Dừng hoàn toàn campaign
 */
router.post('/:id/stop', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền stop campaign này'
            });
        }
        
        if (!['active', 'paused'].includes(campaign.status)) {
            return res.status(400).json({
                success: false,
                message: 'Campaign không thể stop từ trạng thái hiện tại'
            });
        }
        
        const { reason } = req.body;
        
        await campaign.stopCampaign(reason || 'Người dùng dừng thủ công');
        
        return res.json({
            success: true,
            message: 'Đã dừng campaign',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Stop campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/execute-now
 * Thực hiện chiến dịch ngay lập tức (bỏ qua lịch trình)
 */
router.post('/:id/execute-now', authenticate, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy campaign'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && campaign.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện campaign này'
            });
        }
        
        // Không cho phép thực hiện nếu đang chạy hoặc đã hoàn thành
        if (campaign.status === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Campaign đang chạy, không thể thực hiện ngay'
            });
        }
        
        if (campaign.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Campaign đã hoàn thành'
            });
        }
        
        console.log(`🚀 [Execute Now] Campaign ${campaign.name} được yêu cầu chạy ngay lập tức`);
        
        // Import campaignScheduler để trigger execution
        const campaignScheduler = require('../services/campaignScheduler');
        
        // Lưu trạng thái cũ
        const oldStatus = campaign.status;
        
        // Chuyển sang trạng thái active và cập nhật thời gian bắt đầu
        campaign.status = 'active';
        campaign.startedAt = new Date();
        
        // Tính endTime dựa vào durationHours
        if (campaign.durationHours) {
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + campaign.durationHours);
            campaign.endTime = endTime;
        }
        
        await campaign.save();
        
        console.log(`✅ [Execute Now] Campaign ${campaign.name} đã được kích hoạt`);
        console.log(`   Old Status: ${oldStatus} → New Status: active`);
        console.log(`   Started At: ${campaign.startedAt}`);
        console.log(`   End Time: ${campaign.endTime}`);
        
        // Trigger execution ngay lập tức qua scheduler
        // Scheduler sẽ nhận campaign và xử lý ngay
        try {
            await campaignScheduler.executeCampaignImmediately(campaign._id);
            console.log(`🎯 [Execute Now] Campaign ${campaign.name} đã được gửi đến scheduler`);
        } catch (execError) {
            console.error(`❌ [Execute Now] Lỗi khi thực thi campaign:`, execError);
            // Rollback status nếu execution failed
            campaign.status = oldStatus;
            await campaign.save();
            throw execError;
        }
        
        return res.json({
            success: true,
            message: 'Chiến dịch đang được thực hiện ngay lập tức!',
            data: campaign
        });
        
    } catch (error) {
        console.error('❌ Execute now campaign error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi thực hiện chiến dịch',
            error: error.message
        });
    }
});

module.exports = router;
