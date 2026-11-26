import { Router } from 'express';
import { HealthController } from '../controllers/healthController.js';
import { ModelController } from '../controllers/modelController.js';
import { ConversationController } from '../controllers/conversationController.js';
import { MessageController } from '../controllers/messageController.js';
import { AttachmentController } from '../controllers/attachmentController.js';
import { SearchController } from '../controllers/searchController.js';
import { MemoryController } from '../controllers/memoryController.js';
import { FeedbackController } from '../controllers/feedbackController.js';
import { GatewayController } from '../controllers/gatewayController.js';
import { VisionController } from '../controllers/visionController.js';
import { ImageController } from '../controllers/imageController.js';
import { AuthController } from '../controllers/authController.js';
import { AdminController } from '../controllers/adminController.js';
import { NotificationController } from '../controllers/notificationController.js';
import { SettingsController } from '../controllers/settingsController.js';
import { LibraryController } from '../controllers/libraryController.js';
import { PlanController } from '../controllers/planController.js';
import { UsageController } from '../controllers/usageController.js';
import { WarehouseController } from '../controllers/warehouseController.js';
import { CreatorController } from '../controllers/creatorController.js';
import { SupportController } from '../controllers/supportController.js';
import { ReportsController } from '../controllers/reportsController.js';
import { SeoController } from '../controllers/seoController.js';
import { AdsController } from '../controllers/adsController.js';
import { SocialController } from '../controllers/socialController.js';
import { StoreController } from '../controllers/storeController.js';
import { MerchantController } from '../controllers/merchantController.js';
import { MailController } from '../controllers/mailController.js';
import { ChartsAdminController } from '../controllers/chartsAdminController.js';
import { CrmController } from '../controllers/crmController.js';

import { AiGenerateController } from '../controllers/aiGenerateController.js';
import { SeoCrawlerController } from '../controllers/seoCrawlerController.js';
import { KnowledgeController } from '../ai/knowledge-management/knowledgeController.js';
import { SoftwareIntegrationController } from '../ai/software-integration/softwareIntegrationController.js';
import { SoftwareIdentityAuth } from '../ai/software-integration/softwareIdentityAuth.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware, requireAuth, requireRole } from '../middleware/authMiddleware.js';

export const apiRouter = Router();

// Public / Health & Models
apiRouter.get('/health', HealthController.check);
apiRouter.get('/health/benchmark', HealthController.benchmark);
apiRouter.get('/models', ModelController.listModels);
apiRouter.get('/images/health', ImageController.health);
apiRouter.get('/images/file/:filename', ImageController.serveFile);
apiRouter.get('/charts/status', ChartsAdminController.getStatus);
apiRouter.get('/crm/status', CrmController.getStatus);

// Authentication Routes (Public)
apiRouter.post('/auth/register', AuthController.register);
apiRouter.post('/auth/login', AuthController.login);
apiRouter.post('/auth/persona-login', AuthController.personaLogin);

// Authenticated Routes
apiRouter.use(authMiddleware);

// Current User Session Profile & RBAC Verification
apiRouter.get('/auth/me', AuthController.me);
apiRouter.get('/auth/admin-check', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res) => {
  res.json({ success: true, authorized: true, role: req.user.role });
});
apiRouter.get('/auth/superadmin-check', requireRole('SUPER_ADMIN'), (req, res) => {
  res.json({ success: true, authorized: true, role: req.user.role });
});

// Admin & Platform Governance (Real Dynamic DB Metrics, Users, Audit Logs)
apiRouter.get('/admin/metrics', AdminController.getMetrics);
apiRouter.get('/admin/users', requireRole('ADMIN', 'SUPER_ADMIN'), AdminController.getUsers);
apiRouter.patch('/admin/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), AdminController.updateUserStatus);
apiRouter.get('/admin/audit-logs', requireRole('ADMIN', 'SUPER_ADMIN'), AdminController.getAuditLogs);

// EgoLytics BFOV Charts Admin Controls & Telemetry
apiRouter.get('/admin/charts/stats', requireRole('ADMIN', 'SUPER_ADMIN'), ChartsAdminController.getStats);
apiRouter.get('/admin/charts/settings', requireRole('ADMIN', 'SUPER_ADMIN'), ChartsAdminController.getSettings);
apiRouter.patch('/admin/charts/settings', requireRole('ADMIN', 'SUPER_ADMIN'), ChartsAdminController.updateSettings);

// CRM nErgy Admin Controls & Telemetry
apiRouter.get('/admin/crm/stats', requireRole('ADMIN', 'SUPER_ADMIN'), CrmController.getAdminStats);
apiRouter.get('/admin/crm/settings', requireRole('ADMIN', 'SUPER_ADMIN'), CrmController.getSettings);
apiRouter.patch('/admin/crm/settings', requireRole('ADMIN', 'SUPER_ADMIN'), CrmController.updateSettings);

// Real-Time Dynamic Notification System
apiRouter.get('/notifications', NotificationController.list);
apiRouter.post('/notifications', NotificationController.create);
apiRouter.patch('/notifications/:id/read', NotificationController.markRead);
apiRouter.post('/notifications/mark-all-read', NotificationController.markAllRead);
apiRouter.delete('/notifications/:id', NotificationController.delete);
apiRouter.delete('/notifications/clear-all', NotificationController.clearAll);

// Conversations
apiRouter.get('/conversations', ConversationController.list);
apiRouter.post('/conversations', ConversationController.create);
apiRouter.get('/conversations/:id', ConversationController.get);
apiRouter.patch('/conversations/:id', ConversationController.rename);
apiRouter.put('/conversations/:id', ConversationController.rename);
apiRouter.delete('/conversations/:id', ConversationController.delete);
apiRouter.delete('/conversations/:id/messages', ConversationController.clearMessages);

// Messages
apiRouter.get('/conversations/:conversationId/messages', MessageController.listMessages);
apiRouter.post('/conversations/:conversationId/messages', MessageController.sendMessage);
apiRouter.post('/conversations/:conversationId/regenerate', MessageController.regenerateMessage);

// Attachments
apiRouter.post('/attachments/upload', upload.array('files', 5), AttachmentController.uploadFiles);
apiRouter.get('/attachments/:id/file', AttachmentController.getFile);
apiRouter.delete('/attachments/:id', AttachmentController.deleteAttachment);

// Search & Search History
apiRouter.get('/search', SearchController.search);
apiRouter.get('/search/history', SearchController.getHistory);
apiRouter.delete('/search/history', SearchController.clearHistory);
apiRouter.delete('/search/history/:id', SearchController.deleteHistoryItem);

// Conversational User Memory
apiRouter.get('/memory', MemoryController.getMemories);
apiRouter.post('/memory', MemoryController.saveMemory);
apiRouter.delete('/memory/:id', MemoryController.deleteMemory);

// Feedback
apiRouter.post('/feedback', FeedbackController.submit);

// Universal AI Gateway (Products, Tools, Concurrency Queue)
apiRouter.get('/gateway/products', GatewayController.listProducts);
apiRouter.post('/gateway/register-product', GatewayController.registerProduct);
apiRouter.get('/gateway/tools', GatewayController.listTools);
apiRouter.post('/gateway/tools/execute', GatewayController.executeTool);
apiRouter.post('/gateway/tools/approve', GatewayController.approveTool);
apiRouter.get('/gateway/queue/status', GatewayController.getQueueMetrics);

// Multimodal Vision & Image Analysis Endpoint
apiRouter.post('/ai/image/analyze', upload.single('image'), VisionController.analyzeImage);

// Universal AI Generation (Tools, Content Studio, Code Studio, SEO, Agents, Spreadsheets)
apiRouter.post('/ai/generate', AiGenerateController.generate);

// SEO Crawler & Real-time Site Audits
apiRouter.post('/seo/crawl', SeoCrawlerController.crawlUrl);

// ComfyUI & Stable Diffusion 1.5 Image Generation
apiRouter.post('/images/generate', ImageController.generateImage);

// Team Training & Knowledge Management Platform (Step 9)
apiRouter.get('/knowledge/softwares', KnowledgeController.listSoftwares);
apiRouter.get('/knowledge/documents', KnowledgeController.listDocuments);
apiRouter.post('/knowledge/documents', KnowledgeController.uploadDocument);
apiRouter.delete('/knowledge/documents/:id', KnowledgeController.deleteDocument);
apiRouter.post('/knowledge/index', KnowledgeController.indexSoftware);
apiRouter.post('/knowledge/test', KnowledgeController.testKnowledge);
apiRouter.post('/knowledge/publish', KnowledgeController.publishVersion);
apiRouter.post('/knowledge/rollback', KnowledgeController.rollbackVersion);
apiRouter.get('/knowledge/versions', KnowledgeController.listVersions);
apiRouter.get('/knowledge/audit-logs', KnowledgeController.listAuditLogs);

// Software Integration & Deployment Platform (Step 10)
apiRouter.get('/integration/list', SoftwareIntegrationController.listIntegrations);
apiRouter.get('/integration/:softwareId', SoftwareIntegrationController.getIntegration);
apiRouter.patch('/integration/:softwareId', SoftwareIntegrationController.updateIntegration);
apiRouter.post('/integration/:softwareId/keys', SoftwareIntegrationController.generateApiKey);
apiRouter.post('/integration/:softwareId/test', SoftwareIntegrationController.testIntegration);
apiRouter.post('/integration/chat', SoftwareIdentityAuth.authenticateIntegration, SoftwareIntegrationController.chat);
apiRouter.get('/integration/:softwareId/conversations', SoftwareIdentityAuth.authenticateIntegration, SoftwareIntegrationController.listConversations);
apiRouter.get('/integration/:softwareId/audit', SoftwareIntegrationController.listAuditLogs);

// ============================================================================
// FULL-PLATFORM SUITE ENDPOINTS (Modules 1 - 14)
// ============================================================================

// 1. Global Platform Settings (Admin & Super Admin)
apiRouter.get('/admin/settings', requireRole('ADMIN', 'SUPER_ADMIN'), SettingsController.getSettings);
apiRouter.patch('/admin/settings', requireRole('SUPER_ADMIN'), SettingsController.updateSettings);
apiRouter.get('/admin/settings/:key', SettingsController.getSettingByKey);

// 2. Saved Library (MySQL Persistence)
apiRouter.get('/library', LibraryController.listItems);
apiRouter.get('/library/folders', LibraryController.listFolders);
apiRouter.post('/library/folders', LibraryController.createFolder);
apiRouter.get('/library/:id', LibraryController.getItem);
apiRouter.post('/library', LibraryController.createItem);
apiRouter.patch('/library/:id', LibraryController.updateItem);
apiRouter.delete('/library/:id', LibraryController.deleteItem);

// 3. Pricing Plans & Subscriptions
apiRouter.get('/plans', PlanController.listPlans);
apiRouter.get('/admin/plans', PlanController.listPlans);
apiRouter.post('/admin/plans', requireRole('SUPER_ADMIN'), PlanController.createPlan);
apiRouter.patch('/admin/plans/:id', requireRole('SUPER_ADMIN'), PlanController.updatePlan);
apiRouter.delete('/admin/plans/:id', requireRole('SUPER_ADMIN'), PlanController.deletePlan);
apiRouter.get('/subscriptions/me', PlanController.getMySubscription);
apiRouter.post('/admin/users/:id/assign-plan', requireRole('ADMIN', 'SUPER_ADMIN'), PlanController.assignPlan);

// 4. User Usage & Quotas
apiRouter.get('/usage/me', UsageController.getMyUsage);
apiRouter.get('/usage/my', UsageController.getMyUsage);
apiRouter.get('/usage/history', UsageController.getUsageHistory);
apiRouter.get('/admin/usage', requireRole('ADMIN', 'SUPER_ADMIN'), UsageController.adminGetUsage);

// 5. AI Warehouse
apiRouter.get('/warehouse/categories', WarehouseController.listCategories);
apiRouter.get('/warehouse/templates', WarehouseController.listTemplates);
apiRouter.get('/warehouse/templates/:id', WarehouseController.getTemplate);
apiRouter.post('/warehouse/templates', WarehouseController.createTemplate);
apiRouter.patch('/warehouse/templates/:id', WarehouseController.updateTemplate);
apiRouter.delete('/warehouse/templates/:id', requireRole('ADMIN', 'SUPER_ADMIN'), WarehouseController.deleteTemplate);
apiRouter.post('/warehouse/templates/:id/deploy', WarehouseController.deployTemplate);
apiRouter.get('/warehouse/deployments', WarehouseController.listDeployments);

// 6. Creator Studio
apiRouter.get('/creator/profile', CreatorController.getProfile);
apiRouter.patch('/creator/profile', CreatorController.updateProfile);
apiRouter.get('/creator/submissions', CreatorController.listSubmissions);
apiRouter.post('/creator/submissions', CreatorController.createSubmission);
apiRouter.get('/creator/earnings', CreatorController.getEarnings);
apiRouter.get('/creator/payouts', CreatorController.listPayouts);
apiRouter.post('/creator/payouts', CreatorController.requestPayout);
apiRouter.get('/admin/creator/submissions', requireRole('ADMIN', 'SUPER_ADMIN'), CreatorController.adminListSubmissions);
apiRouter.patch('/admin/creator/submissions/:id/review', requireRole('ADMIN', 'SUPER_ADMIN'), CreatorController.adminReviewSubmission);

// 7. Support & Moderation
apiRouter.get('/support/tickets', SupportController.listUserTickets);
apiRouter.post('/support/tickets', SupportController.createTicket);
apiRouter.get('/support/tickets/:id', SupportController.getTicket);
apiRouter.post('/support/tickets/:id/messages', SupportController.addMessage);
apiRouter.get('/admin/support/tickets', requireRole('ADMIN', 'SUPER_ADMIN'), SupportController.adminListTickets);
apiRouter.patch('/admin/support/tickets/:id', requireRole('ADMIN', 'SUPER_ADMIN'), SupportController.adminUpdateTicket);

// 8. Admin Reports & Analytics
apiRouter.get('/admin/reports/overview', requireRole('ADMIN', 'SUPER_ADMIN'), ReportsController.getOverview);
apiRouter.get('/admin/reports/export', requireRole('ADMIN', 'SUPER_ADMIN'), ReportsController.exportCsv);

// 9. SEO Marketing
apiRouter.get('/seo/keywords', SeoController.listKeywords);
apiRouter.post('/seo/keywords', SeoController.createKeyword);
apiRouter.patch('/seo/keywords/:id', SeoController.updateKeyword);
apiRouter.delete('/seo/keywords/:id', SeoController.deleteKeyword);
apiRouter.get('/seo/projects', SeoController.listProjects);
apiRouter.post('/seo/projects', SeoController.createProject);

// 10. Ads Manager
apiRouter.get('/ads/campaigns', AdsController.listCampaigns);
apiRouter.post('/ads/campaigns', AdsController.createCampaign);
apiRouter.get('/ads/campaigns/:id', AdsController.getCampaign);
apiRouter.patch('/ads/campaigns/:id', AdsController.updateCampaign);
apiRouter.delete('/ads/campaigns/:id', AdsController.deleteCampaign);

// 11. Social Scheduler
apiRouter.get('/social/accounts', SocialController.listAccounts);
apiRouter.post('/social/accounts/connect', SocialController.connectAccount);
apiRouter.delete('/social/accounts/:id', SocialController.disconnectAccount);
apiRouter.get('/social/posts', SocialController.listPosts);
apiRouter.post('/social/posts', SocialController.createPost);
apiRouter.patch('/social/posts/:id', SocialController.updatePost);
apiRouter.delete('/social/posts/:id', SocialController.deletePost);
apiRouter.get('/social/calendar', SocialController.getCalendar);

// 12. Zunme Store
apiRouter.get('/store/products', StoreController.listProducts);
apiRouter.get('/store/categories', StoreController.listCategories);
apiRouter.post('/store/orders', StoreController.createOrder);
apiRouter.post('/store/orders/:id/confirm-payment', StoreController.confirmPayment);
apiRouter.get('/store/orders', StoreController.listOrders);

// 12b. Merchant Zone
apiRouter.get('/merchant/profile', MerchantController.getProfile);
apiRouter.patch('/merchant/profile', MerchantController.updateProfile);
apiRouter.get('/merchant/transactions', MerchantController.listTransactions);

// 13. zBox Webmail
apiRouter.get('/mail/accounts', MailController.listAccounts);
apiRouter.get('/mail/folders', MailController.listFolders);
apiRouter.get('/mail/inbox', MailController.listMessages);
apiRouter.post('/mail/send', MailController.sendMessage);

// 14. CRM nErgy Enterprise Bridge (Authenticated, Multi-Tenant Isolated, Governed)
apiRouter.get('/crm/metrics', requireAuth, CrmController.checkModuleEnabled, CrmController.getMetrics);
apiRouter.get('/crm/contacts', requireAuth, CrmController.checkModuleEnabled, CrmController.getContacts);
apiRouter.post('/crm/contacts', requireAuth, CrmController.checkModuleEnabled, CrmController.createContact);
apiRouter.post('/crm/contacts/bulk-import', requireAuth, CrmController.checkModuleEnabled, CrmController.bulkImportContacts);
apiRouter.get('/crm/contacts/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.getContactById);
apiRouter.put('/crm/contacts/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.updateContact);
apiRouter.delete('/crm/contacts/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.deleteContact);

apiRouter.get('/crm/deals', requireAuth, CrmController.checkModuleEnabled, CrmController.getDeals);
apiRouter.post('/crm/deals', requireAuth, CrmController.checkModuleEnabled, CrmController.createDeal);
apiRouter.get('/crm/deals/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.getDealById);
apiRouter.patch('/crm/deals/:id/stage', requireAuth, CrmController.checkModuleEnabled, CrmController.updateDealStage);
apiRouter.put('/crm/deals/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.updateDeal);
apiRouter.delete('/crm/deals/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.deleteDeal);
apiRouter.post('/crm/deals/:id/convert-to-project', requireAuth, CrmController.checkModuleEnabled, CrmController.convertDealToProject);

// Activities & Communication History
apiRouter.get('/crm/activities', requireAuth, CrmController.checkModuleEnabled, CrmController.getActivities);
apiRouter.post('/crm/activities', requireAuth, CrmController.checkModuleEnabled, CrmController.createActivity);
apiRouter.delete('/crm/activities/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.deleteActivity);

// Projects & Delivery
apiRouter.get('/crm/projects', requireAuth, CrmController.checkModuleEnabled, CrmController.getProjects);
apiRouter.post('/crm/projects', requireAuth, CrmController.checkModuleEnabled, CrmController.createProject);
apiRouter.get('/crm/projects/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.getProjectById);
apiRouter.put('/crm/projects/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.updateProject);
apiRouter.delete('/crm/projects/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.deleteProject);

// Tasks & Action Reminders
apiRouter.get('/crm/tasks', requireAuth, CrmController.checkModuleEnabled, CrmController.getTasks);
apiRouter.post('/crm/tasks', requireAuth, CrmController.checkModuleEnabled, CrmController.createTask);
apiRouter.put('/crm/tasks/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.updateTask);
apiRouter.delete('/crm/tasks/:id', requireAuth, CrmController.checkModuleEnabled, CrmController.deleteTask);

// Bestie AI CRM Copilot & Prospect Intelligence
apiRouter.post('/crm/ai/copilot', requireAuth, CrmController.checkModuleEnabled, CrmController.copilotChat);
