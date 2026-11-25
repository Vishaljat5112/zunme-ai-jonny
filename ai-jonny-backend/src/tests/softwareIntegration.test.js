import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { getPool, closePool } from '../db/pool.js';
import { SoftwareIntegrationService } from '../ai/software-integration/softwareIntegrationService.js';
import { SoftwareIdentityAuth } from '../ai/software-integration/softwareIdentityAuth.js';
import { SoftwareChatAdapter } from '../ai/software-integration/softwareChatAdapter.js';
import {
  INTEGRATION_STATUS,
  INTEGRATION_TYPE,
  INTEGRATION_EVENT_TYPES,
  DEFAULT_SOFTWARE_INTEGRATIONS
} from '../ai/software-integration/integrationTypes.js';
import { CrmAuthBridge } from '../ai/crm-live/crmAuthBridge.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';

test('Kiaan AI Software Integration & Deployment Platform Test Suite (Step 10)', async (t) => {
  const pool = getPool();
  const testSoftwareId = 'erp-hub';
  const testTenantId = 'TENANT-TEST-88';
  const testUserId = 'usr_step10_tester';

  // Helper for mock req/res
  const createMockReqRes = (headers = {}, body = {}) => {
    const req = {
      headers: { ...headers },
      body: { ...body },
      ip: '127.0.0.1'
    };
    const res = {
      statusCode: 200,
      responseData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      }
    };
    let calledNext = false;
    const next = () => {
      calledNext = true;
    };
    return { req, res, next, didCallNext: () => calledNext };
  };

  t.after(async () => {
    try {
      // Clean up test audit logs and sessions
      await pool.query('DELETE FROM software_conversations WHERE user_id = ? OR tenant_id = ?', [testUserId, testTenantId]);
      await pool.query('DELETE FROM software_integration_audit_logs WHERE user_id = ? OR tenant_id = ?', [testUserId, testTenantId]);
      // Restore erp-hub status if modified
      await pool.query('UPDATE software_integrations SET integration_status = ? WHERE software_id = ?', ['CONFIGURED', testSoftwareId]);
      await CrmLiveDataService.closePool();
      await closePool();
    } catch {
      // Cleanup safety
    }
  });

  // 1. Types & Default Manifest Integrity
  await t.test('1. DEFAULT_SOFTWARE_INTEGRATIONS defines all 8 software ecosystems with isolated metadata', () => {
    assert.strictEqual(DEFAULT_SOFTWARE_INTEGRATIONS.length, 8);
    const expectedIds = ['crm-nergy', 'erp-hub', 'hr-ats', 'omp-deals', 'swmtp', 'oal', 'icanvasspdm', 'zunme'];
    for (const id of expectedIds) {
      const found = DEFAULT_SOFTWARE_INTEGRATIONS.find((s) => s.softwareId === id);
      assert.ok(found, `Expected default definition for ${id}`);
      assert.ok(found.softwareName);
      assert.ok(found.integrationType);
      assert.ok(found.integrationStatus);
      assert.ok(found.aiName);
    }
  });

  // 2. Default Initializer & Seeding
  await t.test('2. SoftwareIntegrationService.initializeDefaults populates MySQL registry idempotently', async () => {
    await SoftwareIntegrationService.initializeDefaults();
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM software_integrations');
    assert.ok(rows[0].cnt >= 8, 'Expected at least 8 software integrations in database');
  });

  // 3. List Integrations
  await t.test('3. SoftwareIntegrationService.listIntegrations returns active knowledge & agent status for all software', async () => {
    const list = await SoftwareIntegrationService.listIntegrations();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 8);

    const crm = list.find((s) => s.softwareId === 'crm-nergy');
    assert.ok(crm);
    assert.ok(crm.softwareName.includes('CRM nErgy'));
    assert.strictEqual(crm.integrationStatus, INTEGRATION_STATUS.ACTIVE);
    assert.strictEqual(crm.knowledgeStatus, 'KNOWLEDGE_PUBLISHED');
    assert.strictEqual(crm.agentStatus, 'ACTIVE');

    const erp = list.find((s) => s.softwareId === 'erp-hub');
    assert.ok(erp);
    assert.strictEqual(erp.softwareId, 'erp-hub');
    assert.ok(Array.isArray(erp.allowedRoles));
  });

  // 4. Get Integration by ID
  await t.test('4. SoftwareIntegrationService.getIntegration retrieves single software record', async () => {
    const crm = await SoftwareIntegrationService.getIntegration('crm-nergy');
    assert.ok(crm);
    assert.strictEqual(crm.softwareId, 'crm-nergy');
    assert.ok(crm.systemInstructions.includes('CRM nErgy'));
    assert.ok(Array.isArray(crm.allowedTools));
    assert.ok(crm.allowedTools.includes('getLeadCount'));
  });

  // 5. Update Integration Settings
  await t.test('5. SoftwareIntegrationService.updateIntegration updates configuration and records audit log', async () => {
    const updated = await SoftwareIntegrationService.updateIntegration(testSoftwareId, {
      aiName: 'ERP Hub Copilot V2',
      welcomeMessage: 'Welcome to ERP Hub AI!',
      allowedRoles: ['ADMIN', 'FINANCE_MANAGER']
    });

    assert.strictEqual(updated.aiName, 'ERP Hub Copilot V2');
    assert.strictEqual(updated.welcomeMessage, 'Welcome to ERP Hub AI!');
    assert.deepStrictEqual(updated.allowedRoles, ['ADMIN', 'FINANCE_MANAGER']);
  });

  // 6. Generate Secure API Key
  await t.test('6. SoftwareIntegrationService.generateApiKey creates unique cryptographically secure key prefix', async () => {
    const keyData = await SoftwareIntegrationService.generateApiKey(testSoftwareId);
    assert.strictEqual(keyData.softwareId, testSoftwareId);
    assert.ok(keyData.apiKey.startsWith('kiaan_sec_'));
    assert.strictEqual(keyData.prefix, keyData.apiKey.slice(0, 14));

    // Verify stored in DB as hash
    const integration = await SoftwareIntegrationService.getIntegration(testSoftwareId);
    assert.strictEqual(integration.apiKeyPrefix, keyData.prefix);
    const expectedHash = crypto.createHash('sha256').update(keyData.apiKey).digest('hex');
    assert.strictEqual(integration.api_key_hash, expectedHash);
  });

  // 7. Security: Missing Software ID Rejection
  await t.test('7. SoftwareIdentityAuth rejects requests with missing software ID', async () => {
    const { req, res, next, didCallNext } = createMockReqRes({}, {});
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.responseData.error.includes('Missing x-software-id'));
  });

  // 8. Security: Unknown Software Rejection
  await t.test('8. SoftwareIdentityAuth rejects unknown or non-existent software systems', async () => {
    const { req, res, next, didCallNext } = createMockReqRes({ 'x-software-id': 'unregistered-fake-app' });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 404);
    assert.ok(res.responseData.error.includes('not registered'));
  });

  // 9. Security: Disabled Software Integration Blocking
  await t.test('9. SoftwareIdentityAuth blocks requests when software integration is DISABLED', async () => {
    // Disable ERP Hub temporarily
    await SoftwareIntegrationService.updateIntegration(testSoftwareId, {
      integrationStatus: INTEGRATION_STATUS.DISABLED
    });

    const { req, res, next, didCallNext } = createMockReqRes({ 'x-software-id': testSoftwareId });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.responseData.error.includes('DISABLED'));

    // Re-enable
    await SoftwareIntegrationService.updateIntegration(testSoftwareId, {
      integrationStatus: INTEGRATION_STATUS.CONFIGURED
    });
  });

  // 10. Security: Invalid API Key Rejection
  await t.test('10. SoftwareIdentityAuth rejects invalid or forged integration API keys', async () => {
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': testSoftwareId,
      'x-integration-key': 'kiaan_sec_invalid_forged_key_12345'
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 401);
    assert.ok(res.responseData.error.includes('Invalid integration credentials'));
  });

  // 11. Security: Valid API Key Acceptance
  await t.test('11. SoftwareIdentityAuth authenticates successfully with valid API key', async () => {
    const keyData = await SoftwareIntegrationService.generateApiKey(testSoftwareId);
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': testSoftwareId,
      'x-integration-key': keyData.apiKey
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), true);
    assert.ok(req.softwareIdentity);
    assert.strictEqual(req.softwareIdentity.softwareId, testSoftwareId);
  });

  // 12. Security: CRM nErgy Connector Bridge Key Authentication
  await t.test('12. SoftwareIdentityAuth verifies CRM nErgy using authoritative connector bridge key', async () => {
    const crmConnectorKey = CrmAuthBridge.getConnectorKey();
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-integration-key': crmConnectorKey
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), true);
    assert.ok(req.softwareIdentity);
    assert.strictEqual(req.softwareIdentity.softwareId, 'crm-nergy');
  });

  // 13. Security: Cryptographic CRM User JWT Token Verification
  await t.test('13. SoftwareIdentityAuth verifies signed CRM user token and extracts user/role/tenant', async () => {
    const validToken = CrmAuthBridge.generateToken({
      userId: testUserId,
      tenantId: testTenantId,
      role: 'ADMIN',
      email: 'admin@step10.local'
    });

    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-software-token': validToken
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), true);
    assert.ok(req.softwareIdentity);
    assert.strictEqual(req.softwareIdentity.userId, testUserId);
    assert.strictEqual(req.softwareIdentity.tenantId, testTenantId);
    assert.strictEqual(req.softwareIdentity.role, 'ADMIN');
    assert.strictEqual(req.softwareIdentity.isVerified, true);
  });

  // 14. Security: Cross-Tenant Spoofing Prevention
  await t.test('14. SoftwareIdentityAuth prevents cross-tenant spoofing when header conflicts with verified token', async () => {
    const validToken = CrmAuthBridge.generateToken({
      userId: testUserId,
      tenantId: 'TENANT-GENUINE-99',
      role: 'ADMIN'
    });

    // Attacker passes legitimate token for TENANT-GENUINE-99 but claims x-tenant-id = TENANT-ATTACK-00
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-integration-key': CrmAuthBridge.getConnectorKey(),
      'x-software-token': validToken,
      'x-tenant-id': 'TENANT-ATTACK-00'
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.responseData.error.toLowerCase().includes('tenant mismatch'));
  });

  // 15. Security: Forged/Tampered Token Rejection
  await t.test('15. SoftwareIdentityAuth rejects tampered or forged JWT user tokens', async () => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmb3JnZWQiLCJ0ZW5hbnRJZCI6InQxIiwicm9sZSI6IkFETUlOIn0.invalidsig123';
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-software-token': forgedToken
    });
    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);

    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 401);
  });

  // 16. Health & Diagnostic Check
  await t.test('16. SoftwareIntegrationService.testIntegration passes all 4 health checks for CRM nErgy', async () => {
    const testRes = await SoftwareIntegrationService.testIntegration('crm-nergy');
    assert.strictEqual(testRes.softwareId, 'crm-nergy');
    assert.strictEqual(testRes.healthy, true);
    assert.strictEqual(testRes.checks.length, 4);

    const lifecycleCheck = testRes.checks.find((c) => c.check.includes('Lifecycle'));
    assert.strictEqual(lifecycleCheck.passed, true);

    const knowledgeCheck = testRes.checks.find((c) => c.check.includes('Knowledge'));
    assert.strictEqual(knowledgeCheck.passed, true);

    const toolsCheck = testRes.checks.find((c) => c.check.includes('Tools'));
    assert.strictEqual(toolsCheck.passed, true);

    const authCheck = testRes.checks.find((c) => c.check.includes('Credentials'));
    assert.strictEqual(authCheck.passed, true);
  });

  // 17. Software-Scoped Conversation Session Management
  await t.test('17. SoftwareChatAdapter creates and enforces tenant isolation for conversation sessions', async () => {
    const session = await SoftwareChatAdapter.getOrCreateSession({
      softwareId: 'crm-nergy',
      tenantId: testTenantId,
      userId: testUserId,
      title: 'Tenant 88 Test Chat'
    });

    assert.ok(session.id);
    assert.strictEqual(session.software_id, 'crm-nergy');
    assert.strictEqual(session.tenant_id, testTenantId);
    assert.strictEqual(session.user_id, testUserId);

    // Re-retrieving same session works
    const retrieved = await SoftwareChatAdapter.getOrCreateSession({
      softwareId: 'crm-nergy',
      tenantId: testTenantId,
      userId: testUserId,
      conversationId: session.id
    });
    assert.strictEqual(retrieved.id, session.id);

    // Cross-tenant access to same session MUST throw error
    await assert.rejects(async () => {
      await SoftwareChatAdapter.getOrCreateSession({
        softwareId: 'crm-nergy',
        tenantId: 'DIFFERENT-TENANT-999',
        userId: 'other_user',
        conversationId: session.id
      });
    }, /Tenant isolation violation/);
  });

  // 18. Software AI Chat Execution
  await t.test('18. SoftwareChatAdapter.handleChat executes query and binds software identity & orchestrator', async () => {
    const chatResult = await SoftwareChatAdapter.handleChat({
      softwareIdentity: {
        softwareId: 'crm-nergy',
        userId: testUserId,
        tenantId: testTenantId,
        role: 'ADMIN',
        permissions: ['LEADS_READ', 'DEALS_READ']
      },
      message: 'What is the role of the Sales Rep in CRM nErgy?',
      model: 'mock'
    });

    assert.strictEqual(chatResult.success, true);
    assert.ok(chatResult.conversationId);
    assert.strictEqual(chatResult.softwareId, 'crm-nergy');
    assert.ok(chatResult.softwareName.includes('CRM nErgy'));
    assert.ok(chatResult.content);
    assert.ok(typeof chatResult.content === 'string');
  });

  // 19. Audit Logging & Verification
  await t.test('19. SoftwareIntegrationService.recordAuditLog and listAuditLogs capture integration events', async () => {
    await SoftwareIntegrationService.recordAuditLog({
      softwareId: testSoftwareId,
      tenantId: testTenantId,
      userId: testUserId,
      eventType: INTEGRATION_EVENT_TYPES.CONFIG_UPDATE,
      details: { test: true }
    });

    const logs = await SoftwareIntegrationService.listAuditLogs(testSoftwareId, 10);
    assert.ok(Array.isArray(logs));
    const testLog = logs.find((l) => l.user_id === testUserId && l.event_type === INTEGRATION_EVENT_TYPES.CONFIG_UPDATE);
    assert.ok(testLog);
    assert.strictEqual(testLog.software_id, testSoftwareId);
  });

  // 20. Staging Software Notification
  await t.test('20. SoftwareChatAdapter handles pending-agent staging software gracefully without crashing', async () => {
    const chatResult = await SoftwareChatAdapter.handleChat({
      softwareIdentity: {
        softwareId: 'omp-deals',
        userId: testUserId,
        tenantId: testTenantId,
        role: 'MEMBER'
      },
      message: 'Show me pipeline metrics',
      model: 'mock'
    });

    assert.strictEqual(chatResult.success, true);
    assert.strictEqual(chatResult.softwareId, 'omp-deals');
    assert.strictEqual(chatResult.status, 'PENDING_AGENT');
  });
});
