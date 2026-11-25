import crypto from 'crypto';
import { getPool } from '../../db/pool.js';
import { SoftwareRegistry } from '../orchestrator/softwareRegistry.js';
import {
  INTEGRATION_STATUS,
  INTEGRATION_EVENT_TYPES,
  DEFAULT_SOFTWARE_INTEGRATIONS
} from './integrationTypes.js';

export class SoftwareIntegrationService {
  static initialized = false;

  /**
   * Initializes default software integration records in MySQL.
   */
  static async initializeDefaults() {
    if (this.initialized) return;
    const pool = getPool();

    for (const def of DEFAULT_SOFTWARE_INTEGRATIONS) {
      const [existing] = await pool.query(
        'SELECT id FROM software_integrations WHERE software_id = ?',
        [def.softwareId]
      );

      if (existing.length === 0) {
        const id = crypto.randomUUID();
        await pool.query(
          `INSERT INTO software_integrations (
            id, software_id, software_name, integration_status, integration_type,
            allowed_tools, allowed_roles, ai_name, welcome_message, system_instructions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            def.softwareId,
            def.softwareName,
            def.integrationStatus,
            def.integrationType,
            JSON.stringify(def.allowedTools || []),
            JSON.stringify(def.allowedRoles || []),
            def.aiName,
            def.welcomeMessage,
            def.systemInstructions
          ]
        );
      }
    }
    this.initialized = true;
  }

  /**
   * Lists all registered software integrations with live knowledge and agent readiness.
   */
  static async listIntegrations() {
    await this.initializeDefaults();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM software_integrations ORDER BY software_name ASC');

    return rows.map((r) => {
      const sw = SoftwareRegistry.getSoftware(r.software_id);
      return {
        id: r.id,
        softwareId: r.software_id,
        softwareName: r.software_name,
        integrationStatus: r.integration_status,
        integrationType: r.integration_type,
        knowledgeStatus: sw?.knowledgeStatus || 'KNOWLEDGE_PENDING',
        agentStatus: sw?.agentStatus || 'AGENT_PENDING',
        aiName: r.ai_name,
        welcomeMessage: r.welcome_message,
        systemInstructions: r.system_instructions,
        allowedTools: this._parseJson(r.allowed_tools, []),
        allowedRoles: this._parseJson(r.allowed_roles, []),
        hasApiKey: Boolean(r.api_key_hash),
        apiKeyPrefix: r.api_key_prefix,
        integrationVersion: r.integration_version,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }

  /**
   * Retrieves a specific software integration by ID.
   */
  static async getIntegration(softwareId) {
    await this.initializeDefaults();
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM software_integrations WHERE software_id = ?', [cleanSoftwareId]);
    if (rows.length === 0) return null;

    const r = rows[0];
    const sw = SoftwareRegistry.getSoftware(r.software_id);

    return {
      id: r.id,
      softwareId: r.software_id,
      softwareName: r.software_name,
      integrationStatus: r.integration_status,
      integrationType: r.integration_type,
      knowledgeStatus: sw?.knowledgeStatus || 'KNOWLEDGE_PENDING',
      agentStatus: sw?.agentStatus || 'AGENT_PENDING',
      aiName: r.ai_name,
      welcomeMessage: r.welcome_message,
      systemInstructions: r.system_instructions,
      allowedTools: this._parseJson(r.allowed_tools, []),
      allowedRoles: this._parseJson(r.allowed_roles, []),
      api_key_hash: r.api_key_hash,
      apiKeyPrefix: r.api_key_prefix,
      configuration: this._parseJson(r.configuration, {}),
      integrationVersion: r.integration_version,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Updates an integration configuration.
   */
  static async updateIntegration(softwareId, updates = {}) {
    await this.initializeDefaults();
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();

    const fields = [];
    const values = [];

    if (updates.integrationStatus) {
      fields.push('integration_status = ?');
      values.push(updates.integrationStatus);
    }
    if (updates.aiName) {
      fields.push('ai_name = ?');
      values.push(updates.aiName.trim());
    }
    if (updates.welcomeMessage !== undefined) {
      fields.push('welcome_message = ?');
      values.push(updates.welcomeMessage);
    }
    if (updates.systemInstructions !== undefined) {
      fields.push('system_instructions = ?');
      values.push(updates.systemInstructions);
    }
    if (updates.allowedTools) {
      fields.push('allowed_tools = ?');
      values.push(JSON.stringify(updates.allowedTools));
    }
    if (updates.allowedRoles) {
      fields.push('allowed_roles = ?');
      values.push(JSON.stringify(updates.allowedRoles));
    }

    if (fields.length === 0) return await this.getIntegration(cleanSoftwareId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(cleanSoftwareId);

    await pool.query(
      `UPDATE software_integrations SET ${fields.join(', ')} WHERE software_id = ?`,
      values
    );

    // Update in-memory registry status if changed
    if (updates.integrationStatus) {
      const sw = SoftwareRegistry.getSoftware(cleanSoftwareId);
      if (sw && updates.integrationStatus === INTEGRATION_STATUS.DISABLED) {
        sw.status = 'INACTIVE';
      }
    }

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      eventType: INTEGRATION_EVENT_TYPES.CONFIG_UPDATE,
      details: updates
    });

    return await this.getIntegration(cleanSoftwareId);
  }

  /**
   * Generates a new secure API integration key for external software.
   */
  static async generateApiKey(softwareId) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();

    const rawKey = `kiaan_sec_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 14);

    await pool.query(
      'UPDATE software_integrations SET api_key_hash = ?, api_key_prefix = ? WHERE software_id = ?',
      [keyHash, prefix, cleanSoftwareId]
    );

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      eventType: INTEGRATION_EVENT_TYPES.CONFIG_UPDATE,
      details: { action: 'GENERATE_API_KEY', prefix }
    });

    return {
      softwareId: cleanSoftwareId,
      apiKey: rawKey,
      prefix,
      notice: 'Store this key securely. It will not be shown again.'
    };
  }

  /**
   * Performs an end-to-end integration health test.
   */
  static async testIntegration(softwareId, { testUser = null, tenantId = null } = {}) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const integration = await this.getIntegration(cleanSoftwareId);

    if (!integration) {
      throw new Error(`Integration Test Error: Software '${softwareId}' not registered.`);
    }

    const checks = [];

    // 1. Status check
    const isStatusActive = integration.integrationStatus === INTEGRATION_STATUS.ACTIVE || integration.integrationStatus === INTEGRATION_STATUS.CONFIGURED;
    checks.push({
      check: 'Integration Lifecycle Status',
      passed: isStatusActive,
      detail: `Current status is '${integration.integrationStatus}'.`
    });

    // 2. Knowledge readiness
    const sw = SoftwareRegistry.getSoftware(cleanSoftwareId);
    const hasKnowledge = sw?.knowledgeStatus === 'KNOWLEDGE_PUBLISHED' || Boolean(sw?.knowledgeSource?.chunkCount > 0);
    checks.push({
      check: 'Published Knowledge Base',
      passed: hasKnowledge,
      detail: hasKnowledge
        ? `Knowledge is published with ${sw?.knowledgeSource?.chunkCount || 'active'} chunks.`
        : 'Knowledge base is pending ingestion or publishing.'
    });

    // 3. Tool permissions
    const toolCount = (integration.allowedTools || []).length;
    checks.push({
      check: 'Allowed Live Data Tools',
      passed: toolCount > 0 || cleanSoftwareId !== 'crm-nergy',
      detail: `${toolCount} tools authorized.`
    });

    // 4. Identity / Credentials configuration
    const hasCredentials = Boolean(integration.api_key_hash) || cleanSoftwareId === 'crm-nergy';
    checks.push({
      check: 'Authentication Credentials',
      passed: hasCredentials,
      detail: hasCredentials ? 'Integration key or connector bridge is configured.' : 'API Key not yet generated.'
    });

    const allPassed = checks.every((c) => c.passed);

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      eventType: INTEGRATION_EVENT_TYPES.INTEGRATION_TEST_RUN,
      details: { allPassed, checksCount: checks.length }
    });

    return {
      healthy: allPassed,
      softwareId: cleanSoftwareId,
      softwareName: integration.softwareName,
      integrationStatus: integration.integrationStatus,
      checks
    };
  }

  /**
   * Records an audit log event.
   */
  static async recordAuditLog({ softwareId, tenantId = 'global', userId = 'system', eventType = 'INTEGRATION_EVENT', details = null, ipAddress = null }) {
    const pool = getPool();
    const id = crypto.randomUUID();
    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;
    const safeEventType = eventType || 'INTEGRATION_EVENT';

    try {
      await pool.query(
        `INSERT INTO software_integration_audit_logs (
          id, software_id, tenant_id, user_id, event_type, details, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, softwareId, tenantId, userId, safeEventType, detailsStr, ipAddress]
      );
    } catch (err) {
      console.warn('[SoftwareIntegrationService] Audit log write failed:', err.message);
    }
  }

  /**
   * Lists audit logs for a software integration.
   */
  static async listAuditLogs(softwareId, limit = 50) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM software_integration_audit_logs WHERE software_id = ? ORDER BY created_at DESC LIMIT ?',
      [cleanSoftwareId, parseInt(limit, 10)]
    );
    return rows.map((r) => ({
      ...r,
      details: this._parseJson(r.details, r.details)
    }));
  }

  static _parseJson(val, fallback) {
    if (!val) return fallback;
    try {
      return typeof val === 'object' ? val : JSON.parse(val);
    } catch {
      return fallback;
    }
  }
}

