import test from 'node:test';
import assert from 'node:assert/strict';
import { crmRagService } from '../ai/rag/crmRagService.js';
import { CrmDocumentLoader } from '../ai/rag/crmDocumentLoader.js';
import { CrmChunker } from '../ai/rag/crmChunker.js';

test('CRM nErgy Production RAG Engine — Full Pipeline Verification', async (t) => {
  await t.test('1. Document Loader reads and validates 12 CRM files', async () => {
    const res = await CrmDocumentLoader.loadAllDocuments();
    assert.strictEqual(res.stats.errors, 0, 'Should load with 0 errors');
    assert.ok(res.documents.length >= 10, 'Must load at least 10 CRM documents');

    const masterDoc = res.documents.find((d) => d.filename === 'CRM_MASTER_MEMORY.md');
    assert.ok(masterDoc, 'Must find CRM_MASTER_MEMORY.md');
    assert.strictEqual(masterDoc.metadata.software_id, 'crm-nergy');
  });

  await t.test('2. Chunker produces structured chunks preserving metadata', async () => {
    const loaderRes = await CrmDocumentLoader.loadAllDocuments();
    const chunker = new CrmChunker({ maxChunkSize: 900, chunkOverlap: 120 });
    const chunks = chunker.chunkAllDocuments(loaderRes.documents);

    assert.ok(chunks.length > 100, `Expected > 100 chunks, got ${chunks.length}`);
    for (const ch of chunks.slice(0, 10)) {
      assert.ok(ch.id.startsWith('crm_chunk_'));
      assert.strictEqual(ch.metadata.software_id, 'crm-nergy');
      assert.ok(ch.content.length > 30);
    }
  });

  await t.test('3. Diagnostics and Vector Store Status', async () => {
    const diag = await crmRagService.getDiagnostics();
    assert.ok(diag.vectorStore.localChunksCount >= 100, 'Vector store should hold all indexed chunks');
    assert.strictEqual(diag.embeddingService.dim, 768);
    assert.strictEqual(diag.embeddingService.model, 'nomic-embed-text');
  });

  // Task 16 — 14 Test Queries
  const testQueries = [
    { id: 1, query: 'Explain CRM nErgy architecture', expectKeyword: 'Architecture' },
    { id: 2, query: 'Explain Sales Pipeline stages', expectKeyword: 'Pipeline' },
    { id: 3, query: 'Explain Lead Management and conversion', expectKeyword: 'Lead' },
    { id: 4, query: 'Explain all CRM modules', expectKeyword: 'Module' },
    { id: 5, query: 'Explain HR & Recruiting ATS pipeline', expectKeyword: 'HR' },
    { id: 6, query: 'Explain ERP Inventory management', expectKeyword: 'Inventory' },
    { id: 7, query: 'Explain CRM nErgy user roles and RBAC', expectKeyword: 'Role' },
    { id: 8, query: 'Explain CRM nErgy workflows', expectKeyword: 'Workflow' },
    { id: 9, query: 'What is Bestie AI and Zunme?', expectKeyword: 'Bestie' },
    { id: 10, query: 'Explain CRM nErgy API architecture and endpoints', expectKeyword: 'API' },
    { id: 11, query: 'What does Secured eBox and SWMTP do?', expectKeyword: 'eBox' }
  ];

  for (const tq of testQueries) {
    await t.test(`Query ${tq.id}: "${tq.query}"`, async () => {
      const result = await crmRagService.searchKnowledge(tq.query, { topK: 4 });
      assert.strictEqual(result.hasRelevantKnowledge, true, `Query "${tq.query}" should retrieve chunks`);
      assert.ok(result.chunks.length > 0, 'Should return chunks');
      assert.ok(result.topScore >= 0.50, `Score should be >= 0.50, got ${result.topScore}`);
      assert.ok(result.sources.length > 0, 'Should return document source list');
    });
  }

  await t.test('Query 12: Undocumented feature handling (Zero hallucination)', async () => {
    const result = await crmRagService.searchKnowledge('How do I configure quantum crypto teleportation in CRM nErgy?', {
      scoreThreshold: 0.70
    });
    // Should NOT find high-confidence chunks for completely imaginary topics
    const hasHighMatch = result.chunks.some((c) => c.score > 0.85);
    assert.strictEqual(hasHighMatch, false, 'Should not have high-confidence match for fake concept');
  });

  await t.test('Query 13: Unrelated software project filtering', async () => {
    const result = await crmRagService.searchKnowledge('How does Salesforce Einstein Lightning CRM work?', {
      scoreThreshold: 0.68
    });
    // Chunks returned must strictly belong to software_id = crm-nergy
    for (const c of result.chunks) {
      assert.strictEqual(c.metadata.software_id, 'crm-nergy');
    }
  });

  await t.test('Query 14: Prompt augmentation integrates ground-truth sources', async () => {
    const res = await crmRagService.buildAugmentedContext('Explain Sales Pipeline Kanban', 'Base system prompt.');
    assert.strictEqual(res.hasRetrievedKnowledge, true);
    assert.ok(res.augmentedPrompt.includes('Retrieved CRM nErgy Software Documentation'));
    assert.ok(res.augmentedPrompt.includes('Document Sources:'));
    assert.ok(res.chunksCount > 0);
  });
});

