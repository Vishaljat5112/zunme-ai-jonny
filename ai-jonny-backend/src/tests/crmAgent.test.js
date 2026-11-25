import test from 'node:test';
import assert from 'node:assert';
import { CrmAgentPlanner } from '../ai/crm-agent/crmAgentPlanner.js';
import { CrmAgentActionGuard } from '../ai/crm-agent/crmAgentActionGuard.js';
import { CrmAgentExecutor } from '../ai/crm-agent/crmAgentExecutor.js';
import { CrmAgentService } from '../ai/crm-agent/crmAgentService.js';
import { CrmAnswerService } from '../ai/rag/crmAnswerService.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';

test('CRM nErgy Step 6 — AI Agent Engine Test Suite', async (t) => {
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

  // 1. Planner: Multi-Tool BANT Qualification Analysis
  await t.test('1. Planner creates multi-tool plan for BANT qualification analysis', async () => {
    const plan = CrmAgentPlanner.planExecution('Please do a BANT qualification analysis on our leads');
    assert.strictEqual(plan.goal, CrmAgentPlanner.GOALS.BANT_QUALIFICATION_ANALYSIS);
    assert.strictEqual(plan.isMultiTool, true);
    assert.strictEqual(plan.steps.length, 2);
    assert.strictEqual(plan.steps[0].tool, 'getMyAssignedLeads');
    assert.strictEqual(plan.steps[1].tool, 'getPipelineValue');
  });

  // 2. Planner: Comprehensive Sales Operational Analysis
  await t.test('2. Planner creates 3-step operational performance analysis plan', async () => {
    const plan = CrmAgentPlanner.planExecution('Analyze our sales performance and lead conversion opportunities');
    assert.strictEqual(plan.goal, CrmAgentPlanner.GOALS.SALES_OPERATIONAL_ANALYSIS);
    assert.strictEqual(plan.isMultiTool, true);
    assert.strictEqual(plan.steps.length, 3);
    assert.strictEqual(plan.steps[0].tool, 'getLeadCount');
    assert.strictEqual(plan.steps[1].tool, 'getPipelineValue');
    assert.strictEqual(plan.steps[2].tool, 'getOverdueTasks');
  });

  // 3. Planner: Pipeline Stage Breakdown
  await t.test('3. Planner creates plan for deal pipeline stage evaluation', async () => {
    const plan = CrmAgentPlanner.planExecution('Analyze our deal pipeline health and stage distribution');
    assert.strictEqual(plan.goal, CrmAgentPlanner.GOALS.PIPELINE_STAGE_ANALYSIS);
    assert.strictEqual(plan.steps[0].tool, 'getDealPipelineSummary');
  });

  // 4. Action Guard: Blocks Arbitrary Unapproved Tools
  await t.test('4. Action Guard blocks unapproved or arbitrary tools', async () => {
    const check = CrmAgentActionGuard.validateAction('runRawBashCommand', verifiedUser, {});
    assert.strictEqual(check.allowed, false);
    assert.ok(check.reason.includes('not an approved CRM tool'));
  });

  // 5. Action Guard: Sanitizes SQL Injection attempts in arguments
  await t.test('5. Action Guard strips SQL injection attempts from arguments', async () => {
    const dirtyArgs = {
      query: "Jordan' OR 1=1; DROP TABLE leads; --"
    };
    const sanitized = CrmAgentActionGuard.sanitizeArgs(dirtyArgs);
    assert.ok(!sanitized.query.includes('DROP TABLE'));
    assert.ok(!sanitized.query.includes(';'));
    assert.ok(!sanitized.query.includes("'"));
  });

  // 6. Action Guard: Mutating Actions Require User Confirmation
  await t.test('6. Action Guard mandates explicit user confirmation for write actions', async () => {
    const unconfirmed = CrmAgentActionGuard.validateAction('createLead', verifiedUser, {
      name: 'Acme Test',
      company: 'Acme'
    }, false);

    assert.strictEqual(unconfirmed.allowed, false);
    assert.strictEqual(unconfirmed.requiresConfirmation, true);
    assert.ok(unconfirmed.reason.includes('Confirmation Required'));

    // When confirmed
    const confirmed = CrmAgentActionGuard.validateAction('createLead', verifiedUser, {
      name: 'Acme Test',
      company: 'Acme'
    }, true);
    assert.strictEqual(confirmed.allowed, true);
    assert.strictEqual(confirmed.isWriteAction, true);
  });

  // 7. Action Guard: RBAC Enforcement for Write Actions
  await t.test('7. Action Guard blocks write actions for unauthorized roles', async () => {
    const customerUser = { ...verifiedUser, role: 'CUSTOMER' };
    const check = CrmAgentActionGuard.validateAction('createLead', customerUser, {
      name: 'Test',
      company: 'Test'
    }, true);
    assert.strictEqual(check.allowed, false);
    assert.ok(check.reason.includes('lacks permission'));
  });

  // 8. Executor: Executes Multi-Tool Plan with Real CRM Data
  await t.test('8. Executor successfully executes multi-tool plan aggregating verified data', async () => {
    const plan = {
      goal: CrmAgentPlanner.GOALS.SALES_OPERATIONAL_ANALYSIS,
      steps: [
        { tool: 'getLeadCount', args: { filter: 'all' } },
        { tool: 'getPipelineValue', args: {} },
        { tool: 'getOverdueTasks', args: {} }
      ]
    };

    const execution = await CrmAgentExecutor.executePlan(plan, verifiedUser);
    assert.strictEqual(execution.success, true);
    assert.strictEqual(execution.toolsExecuted.length, 3);
    assert.ok(execution.results.getLeadCount);
    assert.ok(execution.results.getPipelineValue);
    assert.ok(execution.results.getOverdueTasks);
    assert.strictEqual(execution.guardsEnforced.length, 0);
  });

  // 9. Executor: Enforces Tenant Isolation on Multi-Tool Plans
  await t.test('9. Executor enforces tenant isolation across all multi-tool queries', async () => {
    const foreignUser = { ...verifiedUser, tenantId: 'TENANT-ISOLATED-999' };
    const plan = {
      goal: CrmAgentPlanner.GOALS.SALES_OPERATIONAL_ANALYSIS,
      steps: [
        { tool: 'getLeadCount', args: { filter: 'all' } },
        { tool: 'getPipelineValue', args: {} }
      ]
    };

    const execution = await CrmAgentExecutor.executePlan(plan, foreignUser);
    assert.strictEqual(execution.success, true);
    assert.strictEqual(execution.results.getLeadCount.count, 0);
    assert.strictEqual(execution.results.getPipelineValue.dealPipelineValue, 0);
  });

  // 10. Agent Service: End-to-End Workflow for BANT Qualification
  await t.test('10. Agent Service coordinates BANT qualification workflow', async () => {
    const workflow = await CrmAgentService.executeAgentWorkflow({
      query: 'Do a BANT qualification analysis on our active leads',
      reqUser: verifiedUser
    });

    assert.strictEqual(workflow.handled, true);
    assert.strictEqual(workflow.goal, CrmAgentPlanner.GOALS.BANT_QUALIFICATION_ANALYSIS);
    assert.strictEqual(workflow.isMultiTool, true);
    assert.ok(workflow.toolsExecuted.includes('getMyAssignedLeads'));
    assert.ok(workflow.systemPrompt.includes('BANT QUALIFICATION FRAMEWORK INSTRUCTIONS'));
    assert.ok(workflow.systemPrompt.includes('Jordan Reed'));
  });

  // 11. Agent Service: End-to-End Workflow for Sales Operational Performance
  await t.test('11. Agent Service coordinates comprehensive sales performance analysis', async () => {
    const workflow = await CrmAgentService.executeAgentWorkflow({
      query: 'Analyze our sales performance and lead conversion opportunities',
      reqUser: verifiedUser
    });

    assert.strictEqual(workflow.handled, true);
    assert.strictEqual(workflow.goal, CrmAgentPlanner.GOALS.SALES_OPERATIONAL_ANALYSIS);
    assert.ok(workflow.toolsExecuted.includes('getLeadCount'));
    assert.ok(workflow.toolsExecuted.includes('getPipelineValue'));
    assert.ok(workflow.systemPrompt.includes('SALES & OPERATIONAL HEALTH INSTRUCTIONS'));
    assert.ok(workflow.systemPrompt.includes('VERIFIED LIVE DATABASE RECORDS'));
  });

  // 12. Full Integration in CrmAnswerService
  await t.test('12. CrmAnswerService seamlessly routes complex analytical inquiries to Agent', async () => {
    const result = await CrmAnswerService.prepareCrmContext({
      query: 'Analyze our sales performance and lead conversion opportunities',
      userContext: verifiedUser
    });

    assert.ok(result.systemPrompt.includes('AUTONOMOUS AI AGENT EXECUTION REPORT'));
    assert.ok(result.systemPrompt.includes('SALES_OPERATIONAL_ANALYSIS'));
    assert.ok(result.liveData);
  });

  // 13. Audit Logging Verification
  await t.test('13. Action Guard produces structured audit log events', async () => {
    const log = CrmAgentActionGuard.logAuditEvent({
      action: 'getLeadCount',
      tenantId: verifiedUser.tenantId,
      userId: verifiedUser.userId,
      role: verifiedUser.role,
      status: 'SUCCESS'
    });
    assert.ok(log.timestamp);
    assert.strictEqual(log.action, 'getLeadCount');
    assert.strictEqual(log.status, 'SUCCESS');
  });
});

