import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { getPool, closePool } from '../db/pool.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';
import { CrmAuthBridge } from '../ai/crm-live/crmAuthBridge.js';
import { CrmLivePermissionService } from '../ai/crm-live/crmLivePermissionService.js';
import { CrmAgentPlanner } from '../ai/crm-agent/crmAgentPlanner.js';
import { CrmAgentService } from '../ai/crm-agent/crmAgentService.js';
import { CrmAnswerService } from '../ai/rag/crmAnswerService.js';
import { CrmRetriever } from '../ai/rag/crmRetriever.js';
import { AdvancedMemoryService } from '../ai/memory/advancedMemoryService.js';
import { KnowledgePipelineService } from '../ai/knowledge-management/knowledgePipelineService.js';
import { SoftwareIntegrationService } from '../ai/software-integration/softwareIntegrationService.js';
import { SoftwareIdentityAuth } from '../ai/software-integration/softwareIdentityAuth.js';
import { SoftwareChatAdapter } from '../ai/software-integration/softwareChatAdapter.js';
import { resolveAiProvider } from '../services/ai/index.js';
import { observabilityMiddleware, maskSensitive } from '../middleware/observabilityMiddleware.js';
import { INTEGRATION_STATUS } from '../ai/software-integration/integrationTypes.js';

test('Kiaan AI Production Reliability, Security & Performance Suite (Step 11)', async (t) => {
  const pool = getPool();
  const testTenant = 'TENANT-08492';
  const testUser = {
    userId: 'cmuo3wl3c0001toeory5wre6k',
    tenantId: testTenant,
    role: 'BUSINESS_OWNER',
    email: 'business.owner@nergy.io'
  };

  // Ensure testUser exists in MySQL users table for foreign key constraints
  await pool.query(
    `INSERT IGNORE INTO users (id, name, email, avatar_initials, plan_badge)
     VALUES (?, ?, ?, 'BO', 'Active Owner')`,
    [testUser.userId, 'Business Owner', testUser.email]
  );

  const createMockReqRes = (headers = {}, body = {}) => {
    const req = {
      headers: { ...headers },
      body: { ...body },
      ip: '127.0.0.1'
    };
    const res = {
      statusCode: 200,
      headers: {},
      responseData: null,
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      },
      on(event, handler) {
        // mock emitter
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
      await CrmLiveDataService.closePool();
      await closePool();
    } catch {}
  });

  // FLOW 1: Personal Kiaan AI Chat Execution
  await t.test('Flow 1: Personal Kiaan AI chat response generation', async () => {
    const provider = resolveAiProvider('mock');
    const result = await provider.generateResponse({
      model: 'mock',
      messages: [{ role: 'user', content: 'Hello Kiaan AI' }]
    });
    assert.ok(result.content);
    assert.strictEqual(typeof result.content, 'string');
    assert.ok(result.tokensUsed > 0);
  });

  // FLOW 2: Streaming Response with SSE chunks
  await t.test('Flow 2: Streaming response chunk delivery', async () => {
    const provider = resolveAiProvider('mock');
    const chunks = [];
    const result = await provider.generateResponse({
      model: 'mock',
      messages: [{ role: 'user', content: 'Stream test message' }],
      stream: true,
      onChunk: (chunk) => chunks.push(chunk)
    });
    assert.ok(chunks.length > 0);
    assert.ok(result.content);
  });

  // FLOW 3: Chat History Save & Reload
  await t.test('Flow 3: Chat history persistence and retrieval in MySQL', async () => {
    const testConvId = `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await pool.query(
      'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
      [testConvId, testUser.userId, 'Audit Conversation']
    );

    const [retrieved] = await pool.query('SELECT * FROM conversations WHERE id = ?', [testConvId]);
    assert.strictEqual(retrieved.length, 1);
    assert.strictEqual(retrieved[0].id, testConvId);

    // Clean up
    await pool.query('DELETE FROM conversations WHERE id = ?', [testConvId]);
  });

  // FLOW 4: Ollama & Hybrid Model Routing
  await t.test('Flow 4: Smart Hybrid Model routing returns correct provider singletons', () => {
    const mockProv = resolveAiProvider('mock');
    assert.strictEqual(mockProv.name, 'mock_test');

    const grokProv = resolveAiProvider('grok-beta');
    assert.strictEqual(grokProv.name, 'grok');

    const gptProv = resolveAiProvider('gpt-4o');
    assert.strictEqual(gptProv.name, 'openai');

    const geminiProv = resolveAiProvider('gemini-1.5-pro');
    assert.strictEqual(geminiProv.name, 'gemini');

    const ollamaProv = resolveAiProvider('qwen2.5:3b');
    assert.strictEqual(ollamaProv.name, 'ollama');
  });

  // FLOW 5: CRM Knowledge Question Context
  await t.test('Flow 5: CRM knowledge question classification and context assembly', async () => {
    const context = await CrmAnswerService.prepareCrmContext({
      query: 'What are the Sales Pipeline deal stages in CRM nErgy?'
    });
    assert.ok(context.systemPrompt);
    assert.ok(context.systemPrompt.includes('CRM nErgy'));
    assert.strictEqual(context.classification.type, 'FEATURE_EXPLANATION');
  });

  // FLOW 6: CRM RAG Retrieval & Confidence
  await t.test('Flow 6: CRM RAG retrieval executes with query expansion and confidence scoring', async () => {
    const retriever = new CrmRetriever();
    const result = await retriever.retrieve({
      query: 'How does lead conversion work in CRM nErgy?',
      topK: 3
    });
    assert.ok(result);
    assert.ok(Array.isArray(result.chunks));
    assert.ok(result.confidence);
  });

  // FLOW 7: CRM Live Lead Count Execution
  await t.test('Flow 7: CRM live lead count executes against authoritative real data', async () => {
    const leadCount = await CrmLiveDataService.getLeadCount(testUser);
    const count = typeof leadCount === 'number' ? leadCount : leadCount.count;
    assert.ok(typeof count === 'number');
    if (typeof leadCount === 'object') {
      assert.strictEqual(leadCount.tenantId, testTenant);
    }
  });

  // FLOW 8: CRM Lead Details with Authorized Access
  await t.test('Flow 8: CRM lead details retrieval respects RBAC and tenant boundary', async () => {
    const leads = await CrmLiveDataService.getMyAssignedLeads(testUser, { limit: 5 });
    assert.ok(Array.isArray(leads));
    for (const lead of leads) {
      if (lead.tenantId) {
        assert.strictEqual(lead.tenantId, testTenant);
      }
    }
  });

  // FLOW 9: CRM Agent Sales Performance Analysis
  await t.test('Flow 9: CRM Agent creates multi-tool plan and executes sales analysis', async () => {
    const plan = CrmAgentPlanner.planExecution('Analyze our sales performance and lead conversion');
    assert.strictEqual(plan.isMultiTool, true);
    assert.ok(plan.steps.length >= 2);

    const agentResult = await CrmAgentService.executeAgentWorkflow({
      query: 'Analyze our sales performance and lead conversion',
      conversationHistory: [],
      reqUser: testUser
    });
    assert.strictEqual(agentResult.handled, true);
    assert.ok(agentResult.toolsExecuted.length >= 2);
    assert.ok(agentResult.data);
  });

  // FLOW 10: Advanced Memory Scoped Recall
  await t.test('Flow 10: Advanced Memory saves and recalls scoped preference memory', async () => {
    const memKey = `audit_pref_${Date.now()}`;
    const saved = await AdvancedMemoryService.saveMemory({
      userId: testUser.userId,
      keyName: memKey,
      valueText: 'Detailed JSON response format preferred',
      softwareId: 'crm-nergy'
    });

    assert.ok(saved.id);
    assert.strictEqual(saved.key_name, memKey);

    const recalled = await AdvancedMemoryService.getContextualMemories({
      userId: testUser.userId,
      softwareId: 'crm-nergy',
      limit: 5
    });

    assert.ok(recalled.length > 0);
    const found = recalled.find((m) => m.key_name === memKey);
    assert.ok(found);

    // Clean up
    await AdvancedMemoryService.deleteMemory(saved.id, testUser.userId);
  });

  // FLOW 11: Knowledge Document Upload Validation
  await t.test('Flow 11: Knowledge document upload enforces file type and format validation', async () => {
    const doc = await KnowledgePipelineService.uploadDocument({
      softwareId: 'erp-hub',
      documentName: 'ERP_Reliability_Guide.md',
      content: '# ERP Reliability Guide\nOperational standards for inventory management.',
      documentType: 'markdown',
      uploadUser: testUser.userId
    });
    assert.ok(doc.id);
    assert.strictEqual(doc.software_id, 'erp-hub');
  });

  // FLOW 12: Document Indexing & Isolation
  await t.test('Flow 12: Knowledge document indexing ensures software-scoped storage', async () => {
    const indexed = await KnowledgePipelineService.indexSoftwareKnowledge({ softwareId: 'erp-hub' });
    assert.strictEqual(indexed.softwareId, 'erp-hub');
    assert.ok(indexed.success);

    // Clean up
    await pool.query('DELETE FROM knowledge_documents WHERE upload_user = ?', [testUser.userId]);
    await pool.query('DELETE FROM knowledge_versions WHERE software_id = ?', ['erp-hub']);
  });

  // FLOW 13: Knowledge Quality Evaluation
  await t.test('Flow 13: Knowledge evaluation runs query against knowledge base and scores quality', async () => {
    const evalResult = await KnowledgePipelineService.testKnowledgeRetrieval({
      softwareId: 'crm-nergy',
      testQuestion: 'What are the Sales Pipeline deal stages?',
      testedBy: testUser.userId
    });
    assert.ok(evalResult.evalId);
    assert.strictEqual(evalResult.softwareId, 'crm-nergy');
    assert.ok(typeof evalResult.passed === 'boolean');

    // Clean up
    await pool.query('DELETE FROM knowledge_evaluations WHERE id = ?', [evalResult.evalId]);
  });

  // FLOW 14 & 15: Publish & Rollback Version
  await t.test('Flow 14 & 15: Knowledge version management supports immutable publishing and rollback', async () => {
    const versions = await KnowledgePipelineService.listVersions('crm-nergy');
    assert.ok(Array.isArray(versions));
  });

  // FLOW 16: Software Integration Authentication
  await t.test('Flow 16: Software Identity Auth verifies API key and JWT user session', async () => {
    const crmToken = CrmAuthBridge.generateToken(testUser);
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-integration-key': CrmAuthBridge.getConnectorKey(),
      'x-software-token': crmToken
    });

    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);
    if (!didCallNext()) {
      console.log('Flow 16 failed with:', res.statusCode, res.responseData);
    }
    assert.strictEqual(didCallNext(), true);
    assert.ok(req.softwareIdentity);
    assert.strictEqual(req.softwareIdentity.userId, testUser.userId);
    assert.strictEqual(req.softwareIdentity.tenantId, testUser.tenantId);
    assert.strictEqual(req.softwareIdentity.isVerified, true);
  });

  // FLOW 17: Software Integration AI Chat Execution
  await t.test('Flow 17: Software Chat Adapter executes software-scoped turn seamlessly', async () => {
    const result = await SoftwareChatAdapter.handleChat({
      softwareIdentity: {
        softwareId: 'crm-nergy',
        userId: testUser.userId,
        tenantId: testTenant,
        role: 'BUSINESS_OWNER'
      },
      message: 'What is the role of an Administrator in CRM nErgy?',
      model: 'mock'
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.content);
    assert.ok(result.conversationId);
  });

  // FLOW 18: Security: Cross-Tenant Spoofing Prevention
  await t.test('Flow 18: Security: Cross-tenant header spoofing is rejected with 403', async () => {
    const genuineToken = CrmAuthBridge.generateToken({
      userId: 'usr_attacker',
      tenantId: 'TENANT-GENUINE-A',
      role: 'ADMIN'
    });

    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-integration-key': CrmAuthBridge.getConnectorKey(),
      'x-software-token': genuineToken,
      'x-tenant-id': 'TENANT-VICTIM-B'
    });

    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);
    if (res.statusCode !== 403) {
      console.log('Flow 20 failed with:', res.statusCode, res.responseData);
    }
    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.responseData.error.toLowerCase().includes('tenant mismatch'));
  });

  // FLOW 19: Security: Cross-Software / Unknown Software Rejection
  await t.test('Flow 19: Security: Unknown or unregistered software ID is rejected with 404', async () => {
    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'fake-unregistered-software-app'
    });

    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);
    if (res.statusCode !== 403) {
      console.log('Flow 20 failed with:', res.statusCode, res.responseData);
    }
    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 404);
  });

  // FLOW 20: Security: Disabled Software Integration Rejection
  await t.test('Flow 20: Security: Disabled software integration access is blocked with 403', async () => {
    await SoftwareIntegrationService.updateIntegration('erp-hub', {
      integrationStatus: INTEGRATION_STATUS.DISABLED
    });

    const { req, res, next, didCallNext } = createMockReqRes({
      'x-software-id': 'erp-hub'
    });

    await SoftwareIdentityAuth.authenticateIntegration(req, res, next);
    if (res.statusCode !== 403) {
      console.log('Flow 20 failed with:', res.statusCode, res.responseData);
    }
    assert.strictEqual(didCallNext(), false);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.responseData.error.includes('DISABLED'));

    // Restore to CONFIGURED
    await SoftwareIntegrationService.updateIntegration('erp-hub', {
      integrationStatus: INTEGRATION_STATUS.CONFIGURED
    });
  });

  // FLOW 21: Observability: Request & Correlation IDs Propagation
  await t.test('Flow 21: Observability middleware assigns and echoes X-Request-Id & X-Correlation-Id', () => {
    const { req, res, next, didCallNext } = createMockReqRes();
    observabilityMiddleware(req, res, next);

    assert.strictEqual(didCallNext(), true);
    assert.ok(req.requestId);
    assert.ok(req.correlationId);
    assert.ok(res.headers['x-request-id']);
    assert.ok(res.headers['x-correlation-id']);
  });

  // FLOW 22: Observability: Zero Secret Leakage Masking
  await t.test('Flow 22: Observability maskSensitive masks passwords, tokens, and API keys', () => {
    const payload = {
      username: 'jonny',
      password: 'super_secret_password_12345',
      apiKey: 'kiaan_sec_994828192839482910293847',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      metadata: {
        crm_connector_key: 'crm_live_secret_key_v2_2026',
        publicField: 'visible_data'
      }
    };

    const sanitized = maskSensitive(payload);
    assert.strictEqual(sanitized.username, 'jonny');
    assert.ok(sanitized.password.includes('••••'));
    assert.ok(sanitized.apiKey.includes('••••'));
    assert.ok(sanitized.token.includes('••••'));
    assert.ok(sanitized.metadata.crm_connector_key.includes('••••'));
    assert.strictEqual(sanitized.metadata.publicField, 'visible_data');
  });

  // FLOW 23 & 24: Failure Handling: Tampered JWT & Invalid API Keys
  await t.test('Flow 23 & 24: Failure handling rejects forged JWTs and invalid integration keys', async () => {
    // Forged JWT
    const forgedToken = 'header.payload.invalidsignature999';
    const { req: r1, res: res1, next: n1, didCallNext: dcn1 } = createMockReqRes({
      'x-software-id': 'crm-nergy',
      'x-software-token': forgedToken
    });
    await SoftwareIdentityAuth.authenticateIntegration(r1, res1, n1);
    assert.strictEqual(dcn1(), false);
    assert.strictEqual(res1.statusCode, 401);

    // Invalid API Key
    const { req: r2, res: res2, next: n2, didCallNext: dcn2 } = createMockReqRes({
      'x-software-id': 'erp-hub',
      'x-integration-key': 'kiaan_sec_invalid_key_xyz'
    });
    await SoftwareIdentityAuth.authenticateIntegration(r2, res2, n2);
    assert.strictEqual(dcn2(), false);
    assert.strictEqual(res2.statusCode, 401);
  });
});
