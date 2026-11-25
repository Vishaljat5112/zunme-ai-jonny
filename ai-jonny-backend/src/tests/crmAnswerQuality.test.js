import test from 'node:test';
import assert from 'node:assert/strict';
import { CrmQuestionClassifier, CRM_QUESTION_TYPES } from '../ai/rag/crmQuestionClassifier.js';
import { CrmAnswerService } from '../ai/rag/crmAnswerService.js';
import { crmRagService } from '../ai/rag/crmRagService.js';
import { CrmLiveDataService } from '../ai/crm-live/crmLiveDataService.js';

test('CRM nErgy Step 4 — Question Classification & Answer Quality Suite', async (t) => {
  t.after(async () => {
    await CrmLiveDataService.closePool();
  });
  // Test 1: What is CRM nErgy?
  await t.test('1. "What is CRM nErgy?" -> SOFTWARE_OVERVIEW', async () => {
    const cl = CrmQuestionClassifier.classify('What is CRM nErgy?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.SOFTWARE_OVERVIEW);
    assert.strictEqual(cl.isCrmRelated, true);
  });

  // Test 2: Explain all modules
  await t.test('2. "Explain all modules" -> MODULE_EXPLANATION', async () => {
    const cl = CrmQuestionClassifier.classify('Explain all modules');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.MODULE_EXPLANATION);
    assert.strictEqual(cl.isCrmRelated, true);
  });

  // Test 3: Explain Lead Management
  await t.test('3. "Explain Lead Management" -> FEATURE_EXPLANATION (Leads)', async () => {
    const cl = CrmQuestionClassifier.classify('Explain Lead Management');
    assert.strictEqual(cl.relevantModule, 'Leads');
    assert.strictEqual(cl.isCrmRelated, true);
  });

  // Test 4: How does lead conversion work?
  await t.test('4. "How does lead conversion work?" -> WORKFLOW', async () => {
    const cl = CrmQuestionClassifier.classify('How does lead conversion work?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.WORKFLOW);
    assert.strictEqual(cl.isCrmRelated, true);
  });

  // Test 5: Explain Sales Pipeline stages
  await t.test('5. "Explain Sales Pipeline stages" -> FEATURE_EXPLANATION (Sales Pipeline)', async () => {
    const cl = CrmQuestionClassifier.classify('Explain Sales Pipeline stages');
    assert.strictEqual(cl.relevantModule, 'Sales Pipeline');
    assert.strictEqual(cl.isCrmRelated, true);
  });

  // Test 6: Explain inventory management
  await t.test('6. "Explain inventory management" -> FEATURE_EXPLANATION (Warehouse Inventory)', async () => {
    const cl = CrmQuestionClassifier.classify('Explain inventory management');
    assert.strictEqual(cl.relevantModule, 'Warehouse Inventory');
  });

  // Test 7: Explain CRM roles
  await t.test('7. "Explain CRM roles" -> ROLE_PERMISSION', async () => {
    const cl = CrmQuestionClassifier.classify('Explain CRM roles');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.ROLE_PERMISSION);
  });

  // Test 8: Explain CRM API architecture
  await t.test('8. "Explain CRM API architecture" -> API_EXPLANATION', async () => {
    const cl = CrmQuestionClassifier.classify('Explain CRM API architecture');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.API_EXPLANATION);
  });

  // Test 9: How do I navigate to HR?
  await t.test('9. "How do I navigate to HR?" -> MENU_NAVIGATION', async () => {
    const cl = CrmQuestionClassifier.classify('How do I navigate to HR?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.MENU_NAVIGATION);
    assert.strictEqual(cl.relevantModule, 'HR & Recruiting');
  });

  // Test 10: Which module handles invoices?
  await t.test('10. "Which module handles invoices?" -> Invoicing & Accounting', async () => {
    const cl = CrmQuestionClassifier.classify('Which module handles invoices?');
    assert.strictEqual(cl.relevantModule, 'Invoicing & Accounting');
  });

  // Test 11: What is Bestie AI?
  await t.test('11. "What is Bestie AI?" -> AI_FEATURE', async () => {
    const cl = CrmQuestionClassifier.classify('What is Bestie AI?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.AI_FEATURE);
  });

  // Test 12: Explain lead conversion step by step
  await t.test('12. "Explain lead conversion step by step" -> WORKFLOW', async () => {
    const cl = CrmQuestionClassifier.classify('Explain lead conversion step by step');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.WORKFLOW);
  });

  // Test 13: Ask an undocumented CRM feature question
  await t.test('13. "How do I configure quantum teleportation in CRM?" -> UNKNOWN_CRM_QUESTION', async () => {
    const cl = CrmQuestionClassifier.classify('How do I configure quantum teleportation in CRM?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.UNKNOWN_CRM_QUESTION);
    assert.strictEqual(cl.isCrmRelated, false);
  });

  // Test 14: Ask a live lead count question
  await t.test('14. "How many leads were added today?" -> LIVE_DATA_QUERY', async () => {
    const cl = CrmQuestionClassifier.classify('How many leads were added today?');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.LIVE_DATA_QUERY);
    assert.strictEqual(cl.isLiveDataQuery, true);
  });

  // Test 15: Ask a general non-CRM question
  await t.test('15. "Explain photosynthesis and plant biology" -> GENERAL_QUESTION', async () => {
    const cl = CrmQuestionClassifier.classify('Explain photosynthesis and plant biology');
    assert.strictEqual(cl.type, CRM_QUESTION_TYPES.GENERAL_QUESTION);
    assert.strictEqual(cl.isCrmRelated, false);
  });

  // Test 16: Follow-up question using "it", "this", "isme", "uska"
  await t.test('16. Follow-up resolution: "Isme kitne stages hain?" with Sales Pipeline context', async () => {
    const history = [
      { role: 'user', content: 'Explain the Sales Pipeline Kanban board' },
      { role: 'assistant', content: 'The Sales Pipeline organizes deals across multiple stages.' }
    ];
    const cl = CrmQuestionClassifier.classify('Isme kitne stages hain?', history);
    assert.strictEqual(cl.isFollowUp, true);
    assert.strictEqual(cl.antecedentSubject, 'Sales Pipeline');
    assert.strictEqual(cl.language, 'hinglish');
  });

  // Full Answer Service Integration Check
  await t.test('Answer Service: Generates grounded context for live data query without hallucination', async () => {
    const context = await CrmAnswerService.prepareCrmContext({
      query: 'How many deals are currently open right now?'
    });
    assert.strictEqual(context.classification.type, CRM_QUESTION_TYPES.LIVE_DATA_QUERY);
    assert.ok(context.systemPrompt.includes('LIVE DYNAMIC DATA REQUEST'));
    assert.ok(context.systemPrompt.includes('NEVER fabricate'));
  });

  await t.test('Answer Service: Generates workflow instructions for lead conversion', async () => {
    const context = await CrmAnswerService.prepareCrmContext({
      query: 'Lead convert kaise hota hai?'
    });
    assert.strictEqual(context.classification.type, CRM_QUESTION_TYPES.WORKFLOW);
    assert.strictEqual(context.classification.language, 'hinglish');
    assert.ok(context.systemPrompt.includes('Workflow Response Format:'));
    assert.ok(context.retrievalResult.chunks.length > 0);
  });
});

