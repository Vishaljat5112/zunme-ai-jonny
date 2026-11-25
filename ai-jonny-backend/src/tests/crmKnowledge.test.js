import test from 'node:test';
import assert from 'node:assert/strict';
import { CrmKnowledgeLoader } from '../ai/knowledge/crmKnowledgeLoader.js';

test('CRM Knowledge Loader - Index and Files Verification', async (t) => {
  await t.test('loads knowledge index JSON with valid metadata', async () => {
    const index = await CrmKnowledgeLoader.loadIndex();
    assert.ok(index, 'Index should be loaded');
    assert.strictEqual(index.software_name, 'CRM nErgy');
    assert.strictEqual(index.software_id, 'crm-nergy');
    assert.ok(Array.isArray(index.module_names));
    assert.ok(index.module_names.length >= 15, 'Must contain core module names');
  });

  await t.test('loads master memory markdown with 24 sections', async () => {
    const masterMemory = await CrmKnowledgeLoader.loadMasterMemory();
    assert.ok(masterMemory.length > 5000, 'Master memory must contain rich content');
    assert.match(masterMemory, /## 1\. CRM nErgy SOFTWARE IDENTITY/i);
    assert.match(masterMemory, /## 24\. KNOWLEDGE GAPS & LIVE DATA DISTINCTION/i);
  });

  await t.test('loads CRM system prompt', async () => {
    const prompt = await CrmKnowledgeLoader.loadSystemPrompt();
    assert.ok(prompt.length > 500);
    assert.match(prompt, /CRM nErgy/i);
    assert.match(prompt, /NEVER fabricate fake live CRM records/i);
  });

  await t.test('context retrieval matches relevant topics without blowing token budget', async () => {
    const questions = [
      'What is CRM nErgy?',
      'Explain all CRM nErgy modules',
      'What menus are available?',
      'Explain CRM nErgy architecture',
      'How many frontend routes are available?',
      'Explain Lead Management',
      'Explain Sales Pipeline',
      'What are CRM nErgy user roles?',
      'Explain ERP operations',
      'Explain HR & Recruiting',
      'What is Bestie AI?',
      'Explain the CRM nErgy workflows',
      'What database models exist?',
      'What APIs are available?',
      'What information is missing from the documentation?',
      'What is the difference between CRM knowledge and live CRM data?'
    ];

    for (const q of questions) {
      const context = await CrmKnowledgeLoader.getRelevantContextForQuery(q);
      assert.ok(context.length > 100, `Context for query "${q}" should not be empty`);
      assert.ok(context.length < 15000, `Context for query "${q}" should remain token-bounded`);
    }
  });

  await t.test('builds full CRM prompt with targeted context', async () => {
    const fullPrompt = await CrmKnowledgeLoader.buildCrmSystemPrompt('Explain Lead Management');
    assert.match(fullPrompt, /CRM nErgy/);
    assert.match(fullPrompt, /Verified CRM nErgy Software Knowledge Reference/);
    assert.match(fullPrompt, /LEAD/i);
  });
});
