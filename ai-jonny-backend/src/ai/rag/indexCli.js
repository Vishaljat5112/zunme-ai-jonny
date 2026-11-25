import { crmRagService } from './crmRagService.js';

async function run() {
  const isForce = process.argv.includes('--force');
  try {
    const result = await crmRagService.indexAllKnowledge({ force: isForce });
    console.log('[Index Summary]', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[Fatal Indexing Error]', err);
    process.exit(1);
  }
}

run();

