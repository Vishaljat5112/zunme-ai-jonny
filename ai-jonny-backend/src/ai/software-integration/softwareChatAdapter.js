import crypto from 'crypto';
import { getPool } from '../../db/pool.js';
import { SoftwareIntegrationService } from './softwareIntegrationService.js';
import { OrchestratorService } from '../orchestrator/orchestratorService.js';
import { AdvancedMemoryService } from '../memory/advancedMemoryService.js';
import { resolveAiProvider } from '../../services/ai/index.js';
import { INTEGRATION_STATUS, INTEGRATION_EVENT_TYPES } from './integrationTypes.js';

export class SoftwareChatAdapter {
  /**
   * Retrieves an existing conversation session or securely initializes a new one.
   */
  static async getOrCreateSession({ softwareId, tenantId, userId, conversationId = null, title = null }) {
    const pool = getPool();

    if (conversationId) {
      const [existing] = await pool.query(
        'SELECT * FROM software_conversations WHERE id = ? AND software_id = ?',
        [conversationId, softwareId]
      );

      if (existing.length > 0) {
        const session = existing[0];
        // Ensure tenant isolation
        if (session.tenant_id !== tenantId) {
          throw new Error('Tenant isolation violation: Access denied to conversation outside current tenant.');
        }
        return session;
      }
    }

    const sessionId = conversationId || `swconv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const sessionTitle = title || `Chat with ${softwareId} AI`;

    await pool.query(
      `INSERT INTO software_conversations (
        id, software_id, tenant_id, user_id, title
      ) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, softwareId, tenantId, userId, sessionTitle]
    );

    const [created] = await pool.query('SELECT * FROM software_conversations WHERE id = ?', [sessionId]);
    return created[0];
  }

  /**
   * Handles chat query originating from an external software integration.
   * Isolates identity, binds software context, retrieves scoped memory,
   * invokes orchestrator/tools, and streams or returns AI response.
   */
  static async handleChat({
    softwareIdentity,
    message,
    conversationId = null,
    model = 'kiaan-ultra',
    stream = false,
    onChunk = null,
    signal = null
  }) {
    if (!message || !String(message).trim()) {
      throw new Error('Message content is required for software chat.');
    }

    const softwareId = softwareIdentity.softwareId;
    const tenantId = softwareIdentity.tenantId || 'global';
    const userId = softwareIdentity.userId || 'anonymous';
    const role = softwareIdentity.role || 'MEMBER';

    // 1. Verify Integration is active
    const integration = await SoftwareIntegrationService.getIntegration(softwareId);
    if (!integration) {
      throw new Error(`Software '${softwareId}' is not registered in Kiaan AI.`);
    }

    if (integration.integrationStatus === INTEGRATION_STATUS.DISABLED) {
      throw new Error(`Integration for '${softwareId}' is currently DISABLED by administrator.`);
    }

    // 2. Resolve or create scoped conversation session
    const session = await this.getOrCreateSession({
      softwareId,
      tenantId,
      userId,
      conversationId,
      title: message.slice(0, 40)
    });

    // 3. Multi-tier Contextual Memory Retrieval (strictly partitioned to this software & user)
    let memoryBlock = '';
    try {
      const memories = await AdvancedMemoryService.getContextualMemories({
        userId,
        conversationId: session.id,
        softwareId,
        limit: 5
      });
      if (memories && memories.length > 0) {
        memoryBlock = '\n\n' + AdvancedMemoryService.formatForPrompt(memories);
      }
    } catch (memErr) {
      console.warn('[SoftwareChatAdapter] Memory retrieval warning:', memErr.message);
    }

    // 4. Delegate to Orchestrator with verified software context & role
    const requestContext = {
      headers: {
        'x-software-id': softwareId,
        'x-tenant-id': tenantId
      },
      user: {
        id: userId,
        userId,
        tenantId,
        role,
        permissions: softwareIdentity.permissions || []
      },
      body: {
        softwareId
      }
    };

    const orchResult = await OrchestratorService.orchestrate({
      prompt: message,
      conversationHistory: [],
      requestContext
    });

    // 5. Construct software-scoped contextual prompt
    const baseSystemPrompt = integration.systemInstructions || `You are ${integration.aiName}, an AI assistant integrated into ${integration.softwareName}.`;
    const toolScopeNotice = `\n[Integration Security Context: Software='${integration.softwareName}', Role='${role}', Tenant='${tenantId}']`;

    let activeSystemPrompt = `${baseSystemPrompt}${toolScopeNotice}`;
    if (orchResult.systemPrompt) {
      activeSystemPrompt += `\n\n${orchResult.systemPrompt}`;
    }
    if (memoryBlock) {
      activeSystemPrompt += memoryBlock;
    }

    // 6. Generate AI response
    const aiProvider = resolveAiProvider(model);
    const contextMessages = [
      { role: 'system', content: activeSystemPrompt },
      { role: 'user', content: message }
    ];

    let finalResponse = '';

    try {
      const aiResult = await aiProvider.generateResponse({
        model,
        messages: contextMessages,
        stream,
        onChunk: (chunk) => {
          finalResponse += chunk;
          if (onChunk) onChunk(chunk);
        },
        signal
      });

      if (!stream) {
        finalResponse = aiResult.content;
      }

      // 7. Update conversation metadata
      const pool = getPool();
      await pool.query(
        'UPDATE software_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [session.id]
      );

      // 8. Record audit log
      await SoftwareIntegrationService.recordAuditLog({
        softwareId,
        tenantId,
        userId,
        eventType: INTEGRATION_EVENT_TYPES.CHAT_COMPLETED,
        details: {
          conversationId: session.id,
          toolExecuted: orchResult.toolExecuted || null,
          status: orchResult.status || 'OK'
        }
      });

      return {
        success: true,
        conversationId: session.id,
        content: finalResponse,
        softwareId,
        softwareName: integration.softwareName,
        aiName: integration.aiName,
        toolExecuted: orchResult.toolExecuted || null,
        status: orchResult.status || 'OK'
      };
    } catch (err) {
      await SoftwareIntegrationService.recordAuditLog({
        softwareId,
        tenantId,
        userId,
        eventType: INTEGRATION_EVENT_TYPES.CHAT_FAILED,
        details: { conversationId: session.id, error: err.message }
      });
      throw err;
    }
  }

  /**
   * Retrieves conversation history for a software-scoped session.
   */
  static async listConversations({ softwareId, tenantId, userId = null }) {
    const pool = getPool();
    const conditions = ['software_id = ?', 'tenant_id = ?'];
    const params = [softwareId, tenantId];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    const query = `
      SELECT id, software_id, tenant_id, user_id, title, created_at, updated_at
      FROM software_conversations
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC LIMIT 50
    `;

    const [rows] = await pool.query(query, params);
    return rows;
  }
}

