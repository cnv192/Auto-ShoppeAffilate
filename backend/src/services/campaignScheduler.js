const cron = require('node-cron');
const { automationService } = require('./facebookAutomationService');
const FacebookAccount = require('../models/FacebookAccount');
const Campaign = require('../models/Campaign');

/**
 * Campaign Scheduler
 * 
 * Features:
 * - Cron job để chạy campaigns theo lịch
 * - Check expired tokens
 * - Process active campaigns
 */

class CampaignScheduler {
    constructor() {
        this.jobs = [];
    }
    
    /**
     * Start scheduler
     */
    start() {
        console.log('🕐 Starting Campaign Scheduler...');
        
        // Job 1: Process active campaigns mỗi 5 phút
        const campaignJob = cron.schedule('*/5 * * * *', async () => {
            console.log('⏰ [CRON] Processing active campaigns...');
            await automationService.processAllActiveCampaigns();
        });
        
        // Job 2: Check expired tokens mỗi 1 giờ
        const tokenCheckJob = cron.schedule('0 * * * *', async () => {
            console.log('⏰ [CRON] Checking expired tokens...');
            await FacebookAccount.checkExpiredTokens();
        });
        
        this.jobs.push(campaignJob, tokenCheckJob);
        
        console.log('✅ Campaign Scheduler started successfully');
    }
    
    /**
     * Stop scheduler
     */
    stop() {
        console.log('🛑 Stopping Campaign Scheduler...');
        
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        
        console.log('✅ Campaign Scheduler stopped');
    }
    
    /**
     * Execute campaign immediately (bypass schedule)
     * @param {String} campaignId - Campaign ID to execute
     */
    async executeCampaignImmediately(campaignId) {
        console.log(`🚀 [Execute Immediately] Starting campaign ${campaignId}...`);
        
        try {
            // Load campaign from database
            const campaign = await Campaign.findById(campaignId);
            
            if (!campaign) {
                throw new Error('Campaign not found');
            }
            
            console.log(`📋 [Execute Immediately] Loaded campaign: ${campaign.name}`);
            console.log(`   Status: ${campaign.status}`);
            console.log(`   Posts: ${campaign.targetPostIds?.length || 0}`);
            
            // Trigger immediate execution through automation service
            await automationService.processCampaign(campaign);
            
            console.log(`✅ [Execute Immediately] Campaign ${campaign.name} executed successfully`);
            return { success: true };
        } catch (error) {
            console.error(`❌ [Execute Immediately] Error executing campaign ${campaignId}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
const scheduler = new CampaignScheduler();

module.exports = scheduler;
