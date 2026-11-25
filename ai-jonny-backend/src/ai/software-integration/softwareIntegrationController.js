import { SoftwareIntegrationService } from './softwareIntegrationService.js';
import { SoftwareChatAdapter } from './softwareChatAdapter.js';

export class SoftwareIntegrationController {
  /**
   * GET /api/integration/list
   * Returns list of all software integrations with multi-software readiness.
   */
  static async listIntegrations(req, res) {
    try {
      const integrations = await SoftwareIntegrationService.listIntegrations();
      return res.status(200).json({ success: true, integrations });
    } catch (err) {
      console.error('[SoftwareIntegrationController] list error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/integration/:softwareId
   * Returns details of a specific integration.
   */
  static async getIntegration(req, res) {
    try {
      const { softwareId } = req.params;
      const integration = await SoftwareIntegrationService.getIntegration(softwareId);
      if (!integration) {
        return res.status(404).json({ success: false, error: `Software '${softwareId}' not found.` });
      }
      return res.status(200).json({ success: true, integration });
    } catch (err) {
      console.error('[SoftwareIntegrationController] get error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/integration/:softwareId
   * Updates configuration for a software integration.
   */
  static async updateIntegration(req, res) {
    try {
      const { softwareId } = req.params;
      const updates = req.body;
      const updated = await SoftwareIntegrationService.updateIntegration(softwareId, updates);
      return res.status(200).json({ success: true, integration: updated });
    } catch (err) {
      console.error('[SoftwareIntegrationController] update error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/integration/:softwareId/keys
   * Generates a new secure API key for the integration.
   */
  static async generateApiKey(req, res) {
    try {
      const { softwareId } = req.params;
      const keyData = await SoftwareIntegrationService.generateApiKey(softwareId);
      return res.status(200).json({ success: true, ...keyData });
    } catch (err) {
      console.error('[SoftwareIntegrationController] key gen error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/integration/:softwareId/test
   * Runs an automated integration health check.
   */
  static async testIntegration(req, res) {
    try {
      const { softwareId } = req.params;
      const result = await SoftwareIntegrationService.testIntegration(softwareId, {
        testUser: req.body?.testUser,
        tenantId: req.body?.tenantId
      });
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error('[SoftwareIntegrationController] test error:', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/integration/chat
   * Core AI Chat endpoint for external software integrations.
   * Handles both SSE streaming and standard JSON responses.
   */
  static async chat(req, res) {
    const { message, conversationId, model = 'kiaan-ultra', stream = false } = req.body;
    const softwareIdentity = req.softwareIdentity;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    if (!softwareIdentity) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing verified software identity.' });
    }

    const abortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    // 1. Streaming response (SSE)
    if (Boolean(stream)) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      res.write(`event: start\ndata: ${JSON.stringify({ softwareId: softwareIdentity.softwareId })}\n\n`);

      try {
        const result = await SoftwareChatAdapter.handleChat({
          softwareIdentity,
          message,
          conversationId,
          model,
          stream: true,
          onChunk: (chunk) => {
            res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
          },
          signal: abortController.signal
        });

        res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
        return res.end();
      } catch (chatErr) {
        console.error('[SoftwareIntegrationController] Streaming chat error:', chatErr.message);
        res.write(`event: error\ndata: ${JSON.stringify({ error: chatErr.message })}\n\n`);
        return res.end();
      }
    }

    // 2. Standard JSON response
    try {
      const result = await SoftwareChatAdapter.handleChat({
        softwareIdentity,
        message,
        conversationId,
        model,
        stream: false,
        signal: abortController.signal
      });
      return res.status(200).json(result);
    } catch (chatErr) {
      console.error('[SoftwareIntegrationController] JSON chat error:', chatErr.message);
      return res.status(500).json({ success: false, error: chatErr.message });
    }
  }

  /**
   * GET /api/integration/:softwareId/conversations
   * Returns conversations scoped to the software and tenant.
   */
  static async listConversations(req, res) {
    try {
      const { softwareId } = req.params;
      const tenantId = req.softwareIdentity?.tenantId || req.query.tenantId || 'global';
      const userId = req.softwareIdentity?.userId || req.query.userId || null;

      const conversations = await SoftwareChatAdapter.listConversations({
        softwareId,
        tenantId,
        userId
      });

      return res.status(200).json({ success: true, conversations });
    } catch (err) {
      console.error('[SoftwareIntegrationController] conv list error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/integration/:softwareId/audit
   * Returns recent audit logs for integration monitoring.
   */
  static async listAuditLogs(req, res) {
    try {
      const { softwareId } = req.params;
      const limit = parseInt(req.query.limit || 50, 10);
      const logs = await SoftwareIntegrationService.listAuditLogs(softwareId, limit);
      return res.status(200).json({ success: true, logs });
    } catch (err) {
      console.error('[SoftwareIntegrationController] audit list error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

