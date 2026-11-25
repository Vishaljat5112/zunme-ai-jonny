import test from 'node:test';
import assert from 'node:assert';
import { SoftwareRegistry, SOFTWARE_STATUS } from '../ai/orchestrator/softwareRegistry.js';
import { SoftwareContextResolver } from '../ai/orchestrator/softwareContextResolver.js';
import { OrchestratorService } from '../ai/orchestrator/orchestratorService.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';

test('Kiaan AI Multi-Software Orchestrator Test Suite (Step 7)', async (t) => {
  t.after(async () => {
    await CrmLiveDataService.closePool();
  });

  const verifiedUser = {
    userId: 'cmuo3wl3c0001toeory5wre6k',
    name: 'Business Owner',
    email: 'business.owner@nergy.io',
    role: 'BUSINESS_OWNER',
    tenantId: 'TENANT-08492'
  };

  // 1. Software Registry initialization and discovery
  await t.test('1. Software Registry discovers active and pending software ecosystems', async () => {
    const active = SoftwareRegistry.listActiveSoftwares();
    assert.ok(active.some((s) => s.softwareId === 'crm-nergy'));

    const all = SoftwareRegistry.listAllSoftwares();
    assert.ok(all.some((s) => s.softwareId === 'erp-hub' && s.status === SOFTWARE_STATUS.PENDING_AGENT));
    assert.ok(all.some((s) => s.softwareId === 'hr-ats' && s.status === SOFTWARE_STATUS.PENDING_AGENT));
  });

  // 2. Software Registry alias lookups
  await t.test('2. Software Registry finds software by name, ID, and aliases', async () => {
    assert.strictEqual(SoftwareRegistry.findByAlias('crm-nergy').softwareId, 'crm-nergy');
    assert.strictEqual(SoftwareRegistry.findByAlias('CRM nErgy Enterprise').softwareId, 'crm-nergy');
    assert.strictEqual(SoftwareRegistry.findByAlias('crm energy').softwareId, 'crm-nergy');
    assert.strictEqual(SoftwareRegistry.findByAlias('nergy crm').softwareId, 'crm-nergy');
    assert.strictEqual(SoftwareRegistry.findByAlias('erp hub').softwareId, 'erp-hub');
  });

  // 3. Explicit Software Identification in Prompt
  await t.test('3. Context Resolver identifies explicit software mention in prompt', async () => {
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'In CRM nErgy, how do I configure lead conversion?'
    });
    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.software.softwareId, 'crm-nergy');
    assert.strictEqual(res.resolutionMethod, 'EXPLICIT_NAME_OR_ALIAS');
  });

  // 4. Software Alias Resolution in Prompt
  await t.test('4. Context Resolver resolves software by alias in prompt', async () => {
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'Show me my energy crm pipeline value'
    });
    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.software.softwareId, 'crm-nergy');
  });

  // 5. Authenticated Software Context via Request Headers/Body
  await t.test('5. Context Resolver validates authenticated software request headers', async () => {
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'How many items were added today?',
      requestContext: {
        headers: { 'x-software-id': 'crm-nergy' }
      }
    });
    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.software.softwareId, 'crm-nergy');
    assert.strictEqual(res.resolutionMethod, 'AUTHENTICATED_REQUEST_CONTEXT');
  });

  // 6. Security: Rejection of Untrusted/Unknown Software ID
  await t.test('6. Context Resolver rejects untrusted/unregistered softwareId from client', async () => {
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'Show me all data',
      requestContext: {
        body: { softwareId: 'unauthorized-external-hack' }
      }
    });
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.resolutionMethod, 'UNAUTHORIZED_SOFTWARE_ID');
    assert.ok(res.error.includes('not registered or authorized'));
  });

  // 7. General Non-Software Query Routing
  await t.test('7. Context Resolver routes general non-software questions to general chat', async () => {
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'Explain photosynthesis and the Calvin cycle in plant biology'
    });
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.isGeneralQuery, true);
    assert.strictEqual(res.resolutionMethod, 'GENERAL_CHAT_FALLBACK');
  });

  // 8. Conversation Follow-up Context Resolution
  await t.test('8. Context Resolver carries forward software context on follow-up questions', async () => {
    const history = [
      { role: 'user', content: 'What are the Sales Pipeline stages in CRM nErgy?' },
      { role: 'assistant', content: 'CRM nErgy features 8 stages from NEW_LEAD to WON.' }
    ];
    const res = SoftwareContextResolver.resolveContext({
      prompt: 'Isme kitne stages hain?',
      conversationHistory: history
    });
    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.software.softwareId, 'crm-nergy');
    assert.strictEqual(res.resolutionMethod, 'CONVERSATION_FOLLOW_UP');
  });

  // 9. Ambiguity Detection (Multiple Software Matches)
  await t.test('9. Context Resolver flags ambiguity when prompt matches multiple softwares', async () => {
    // Add temporary second active software to test genuine multi-software ambiguity
    SoftwareRegistry.register({
      softwareId: 'test-billing',
      softwareName: 'Billing & Invoicing Suite',
      aliases: ['invoices'],
      status: SOFTWARE_STATUS.ACTIVE
    });

    const res = SoftwareContextResolver.resolveContext({
      prompt: 'Invoices check karo in CRM nErgy or Billing'
    });

    assert.strictEqual(res.isAmbiguous, true);
    assert.strictEqual(res.resolved, false);
    assert.ok(res.candidates.length >= 2);

    // Clean up temporary entry
    SoftwareRegistry.initDefaults();
  });

  // 10. Orchestrator: Pending Software Agent Handling
  await t.test('10. Orchestrator returns honest staging notice for pending software agents', async () => {
    const result = await OrchestratorService.orchestrate({
      prompt: 'How many items are in warehouse inventory in Kiaan ERP Hub?'
    });
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.status, 'PENDING_AGENT');
    assert.strictEqual(result.softwareId, 'erp-hub');
    assert.ok(result.systemPrompt.includes('pending deployment'));
  });

  // 11. Orchestrator: Active CRM Agent Delegation
  await t.test('11. Orchestrator delegates active CRM inquiries to CRM Agent & Live Data', async () => {
    const result = await OrchestratorService.orchestrate({
      prompt: 'In CRM nErgy, how many leads were added today?',
      requestContext: { user: verifiedUser }
    });
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.status, 'ACTIVE_DELEGATION');
    assert.strictEqual(result.softwareId, 'crm-nergy');
    assert.ok(result.systemPrompt.includes('LIVE REAL-TIME DATABASE RECORDS'));
  });

  // 12. Knowledge Isolation Verification
  await t.test('12. Knowledge Isolation: CRM requests only bind to CRM knowledge source', async () => {
    const crm = SoftwareRegistry.getSoftware('crm-nergy');
    assert.strictEqual(crm.knowledgeSource.collection, 'crm_nergy_knowledge');
    assert.strictEqual(crm.knowledgeSource.chunkCount, 181);

    const erp = SoftwareRegistry.getSoftware('erp-hub');
    assert.strictEqual(erp.knowledgeSource.collection, 'erp_hub_knowledge');
    assert.notStrictEqual(crm.knowledgeSource.collection, erp.knowledgeSource.collection);
  });
});

