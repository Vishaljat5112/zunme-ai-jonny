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
import { KnowledgeController } from '../ai/knowledge-management/knowledgeController.js';
import { SoftwareIntegrationController } from '../ai/software-integration/softwareIntegrationController.js';
import { SoftwareIdentityAuth } from '../ai/software-integration/softwareIdentityAuth.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export const apiRouter = Router();

// Public / Health & Models
apiRouter.get('/health', HealthController.check);
apiRouter.get('/health/benchmark', HealthController.benchmark);
apiRouter.get('/models', ModelController.listModels);
apiRouter.get('/images/health', ImageController.health);
apiRouter.get('/images/file/:filename', ImageController.serveFile);

// Authenticated Routes
apiRouter.use(authMiddleware);

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
