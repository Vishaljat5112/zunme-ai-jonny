import { crmRagService } from './crmRagService.js';

async function run() {
  const query = process.argv.slice(2).filter((arg) => !arg.startsWith('--')).join(' ') || 'Explain Sales Pipeline stages and workflow';

  console.log(`\n========================================================`);
  console.log(`  CRM nErgy RAG Retrieval Diagnostic Test`);
  console.log(`  Query: "${query}"`);
  console.log(`========================================================\n`);

  try {
    const start = performance.now();
    const result = await crmRagService.searchKnowledge(query);
    const duration = Math.round(performance.now() - start);

    console.log(`Results: ${result.chunks.length} chunks retrieved in ${duration}ms`);
    console.log(`Has Relevant Knowledge: ${result.hasRelevantKnowledge}`);
    console.log(`Top Score: ${result.topScore ? (result.topScore * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`Sources: ${result.sources.join(', ') || 'None'}\n`);

    if (result.chunks.length > 0) {
      result.chunks.forEach((c, idx) => {
        console.log(`--- [Chunk ${idx + 1}] Score: ${(c.score * 100).toFixed(1)}% | Source: ${c.metadata.document_name} ---`);
        console.log(`Section: ${c.metadata.section_header || 'General'}`);
        console.log(`Snippet: ${c.content.slice(0, 220).replace(/\n/g, ' ')}...`);
        console.log(``);
      });
    } else {
      console.log('No chunks passed the relevance score threshold.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Retrieval error:', err);
    process.exit(1);
  }
}

run();

