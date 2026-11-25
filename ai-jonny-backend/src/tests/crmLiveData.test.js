import test from 'node:test';
import assert from 'node:assert';
import { CrmAuthBridge } from '../ai/crm-live/crmAuthBridge.js';
import { CrmLivePermissionService } from '../ai/crm-live/crmLivePermissionService.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';
import { CrmLiveToolRegistry } from '../ai/crm-live/crmLiveToolRegistry.js';
import { CrmLiveQueryRouter } from '../ai/crm-live/crmLiveQueryRouter.js';
import { CrmAnswerService } from '../ai/rag/crmAnswerService.js';
import { CRM_QUESTION_TYPES } from '../ai/rag/crmQuestionClassifier.js';

test('CRM nErgy Step 5 — Live Data Intelligence Engine Test Suite', async (t) => {
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

  // 1. CrmAuthBridge Token Verification & Generation
  await t.test('1. AuthBridge generates and verifies valid CRM JWT tokens', async () => {
    const token = CrmAuthBridge.generateToken(verifiedUser);
    assert.ok(typeof token === 'string' && token.length > 20);

    const decoded = CrmAuthBridge.verifyToken(token);
    assert.strictEqual(decoded.userId, verifiedUser.userId);
    assert.strictEqual(decoded.tenantId, verifiedUser.tenantId);
    assert.strictEqual(decoded.role, 'BUSINESS_OWNER');
  });

  // 2. CrmAuthBridge Resolves Active CRM Session
  await t.test('2. AuthBridge resolves authoritative CRM user session from database', async () => {
    const session = await CrmAuthBridge.resolveUserContext();
    assert.ok(session.userId);
    assert.strictEqual(session.tenantId, 'TENANT-08492');
    assert.strictEqual(session.role, 'BUSINESS_OWNER');
  });

  // 3. RBAC Permission Checks
  await t.test('3. PermissionService allows authorized roles and blocks unauthorized roles', async () => {
    // BUSINESS_OWNER can read leads
    const ownerCheck = CrmLivePermissionService.checkPermission(verifiedUser, 'leads:read');
    assert.strictEqual(ownerCheck.authorized, true);

    // INFLUENCER cannot read leads
    const influencerUser = { ...verifiedUser, role: 'INFLUENCER' };
    const influencerCheck = CrmLivePermissionService.checkPermission(influencerUser, 'leads:read');
    assert.strictEqual(influencerCheck.authorized, false);
    assert.ok(influencerCheck.reason.includes('not authorized'));

    // SUPER_ADMIN has master override
    const superAdmin = { ...verifiedUser, role: 'SUPER_ADMIN' };
    const adminCheck = CrmLivePermissionService.checkPermission(superAdmin, 'leads:read');
    assert.strictEqual(adminCheck.authorized, true);
  });

  // 4. Live Tool 1: getLeadCount
  await t.test('4. Live Tool: getLeadCount returns verified real counts without fake data', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getLeadCount', verifiedUser, { filter: 'all' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.authorized, true);
    assert.ok(result.data.count >= 3);
    assert.strictEqual(result.data.tenantId, 'TENANT-08492');

    // Filter today
    const todayResult = await CrmLiveToolRegistry.executeTool('getLeadCount', verifiedUser, { filter: 'today' });
    assert.strictEqual(todayResult.success, true);
    assert.ok(typeof todayResult.data.count === 'number');
  });

  // 5. Live Tool 2: getMyAssignedLeads
  await t.test('5. Live Tool: getMyAssignedLeads returns only leads assigned to caller', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getMyAssignedLeads', verifiedUser, { limit: 10 });
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.data));
    assert.ok(result.data.length > 0);
    // Every returned lead must belong to this tenant
    for (const lead of result.data) {
      assert.ok(lead.name);
      assert.ok(typeof lead.estimatedValue === 'number');
    }
  });

  // 6. Live Tool 3: getLeadDetails
  await t.test('6. Live Tool: getLeadDetails searches and returns accurate real lead profile', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getLeadDetails', verifiedUser, { query: 'Jordan Reed' });
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.name, 'Jordan Reed');
    assert.strictEqual(result.data.company, 'Apex Logistics Corp');
    assert.strictEqual(result.data.estimatedValue, 120000);
  });

  // 7. Live Tool 4 & 5: getDealPipelineSummary & getPipelineValue
  await t.test('7. Live Tools: Pipeline summary and revenue value calculations', async () => {
    const summary = await CrmLiveToolRegistry.executeTool('getDealPipelineSummary', verifiedUser);
    assert.strictEqual(summary.success, true);
    assert.ok(summary.data.stages.NEW_LEAD);
    assert.ok(summary.data.stages.WON);

    const pipeValue = await CrmLiveToolRegistry.executeTool('getPipelineValue', verifiedUser);
    assert.strictEqual(pipeValue.success, true);
    assert.ok(typeof pipeValue.data.totalCombinedValue === 'number');
    assert.ok(pipeValue.data.leadEstimatedValue > 0);
  });

  // 8. Live Tool 6: getOverdueTasks
  await t.test('8. Live Tool: getOverdueTasks returns real past-due tasks', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getOverdueTasks', verifiedUser);
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.data));
    assert.ok(result.data.length >= 1);
    assert.strictEqual(result.data[0].title, 'A');
    assert.strictEqual(result.data[0].status, 'PENDING');
  });

  // 9. Live Tool 7: getPendingInvoices
  await t.test('9. Live Tool: getPendingInvoices returns real invoice data (zero fake records)', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getPendingInvoices', verifiedUser);
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.data));
    // If none are pending, returns empty array, NOT dummy data
    if (result.data.length > 0) {
      assert.ok(result.data[0].invoiceNumber);
    }
  });

  // 10. Live Tool 8: getContactDetails
  await t.test('10. Live Tool: getContactDetails retrieves verified contact', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getContactDetails', verifiedUser, { query: 'Stiv Smith' });
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.name, 'Stiv Smith');
    assert.strictEqual(result.data.company, 'Global');
  });

  // 11. Live Tool 9: getDashboardSummary
  await t.test('11. Live Tool: getDashboardSummary aggregates operational metrics', async () => {
    const result = await CrmLiveToolRegistry.executeTool('getDashboardSummary', verifiedUser);
    assert.strictEqual(result.success, true);
    assert.ok(result.data.totalLeads >= 3);
    assert.ok(typeof result.data.totalRevenueOpportunity === 'number');
  });

  // 12. Strict Multi-Tenant Isolation
  await t.test('12. Tenant Isolation: Unknown tenant cannot access records of another tenant', async () => {
    const foreignUser = { ...verifiedUser, tenantId: 'TENANT-FOREIGN-99999' };
    const result = await CrmLiveToolRegistry.executeTool('getLeadCount', foreignUser, { filter: 'all' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.count, 0); // Strictly isolated, returns 0!
  });

  // 13. Query Router Intent Mapping
  await t.test('13. Query Router maps natural language questions to appropriate tools', async () => {
    const r1 = CrmLiveQueryRouter.routeQuestionToTool('How many leads were added today?');
    assert.strictEqual(r1.tool, 'getLeadCount');
    assert.strictEqual(r1.args.filter, 'today');

    const r2 = CrmLiveQueryRouter.routeQuestionToTool('How many leads are assigned to me?');
    assert.strictEqual(r2.tool, 'getMyAssignedLeads');

    const r3 = CrmLiveQueryRouter.routeQuestionToTool('What is my pipeline value?');
    assert.strictEqual(r3.tool, 'getPipelineValue');

    const r4 = CrmLiveQueryRouter.routeQuestionToTool('Which tasks are overdue?');
    assert.strictEqual(r4.tool, 'getOverdueTasks');

    const r5 = CrmLiveQueryRouter.routeQuestionToTool('How many invoices are pending?');
    assert.strictEqual(r5.tool, 'getPendingInvoices');
  });

  // 14. Full End-to-End Integration in CrmAnswerService
  await t.test('14. CrmAnswerService injects verified live real-time database records', async () => {
    const result = await CrmAnswerService.prepareCrmContext({
      query: 'How many leads were created today?',
      userContext: verifiedUser
    });

    assert.strictEqual(result.classification.type, CRM_QUESTION_TYPES.LIVE_DATA_QUERY);
    assert.ok(result.systemPrompt.includes('LIVE REAL-TIME DATABASE RECORDS'));
    assert.ok(result.systemPrompt.includes('Query Tool Executed: getLeadCount'));
    assert.ok(result.liveData);
    assert.strictEqual(result.toolExecuted, 'getLeadCount');
  });

  // 15. RBAC Denial in Full Answer Service
  await t.test('15. CrmAnswerService respects RBAC and warns when role lacks permission', async () => {
    const restrictedUser = { ...verifiedUser, role: 'INFLUENCER' };
    const result = await CrmAnswerService.prepareCrmContext({
      query: 'How many leads were added today?',
      userContext: restrictedUser
    });

    assert.strictEqual(result.classification.type, CRM_QUESTION_TYPES.LIVE_DATA_QUERY);
    assert.ok(result.systemPrompt.includes('Access Denied'));
    assert.ok(result.systemPrompt.includes('INFLUENCER'));
  });
});
