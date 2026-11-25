import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CrmDocumentLoader } from './crmDocumentLoader.js';
import { CrmChunker } from './crmChunker.js';
import { CrmEmbeddingService } from './crmEmbeddingService.js';
import { CrmVectorStore } from './crmVectorStore.js';
import { CrmRetriever } from './crmRetriever.js';
import { config } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');
const MANIFEST_FILE = path.join(DATA_DIR, 'crm_rag_manifest.json');

export class CrmRagService {
  constructor() {
    this.loader = CrmDocumentLoader;
    this.chunker = new CrmChunker({ maxChunkSize: 900, chunkOverlap: 120 });
    this.embeddingService = new CrmEmbeddingService();
    this.vectorStore = new CrmVectorStore();
    this.retriever = new CrmRetriever({
      embeddingService: this.embeddingService,
      vectorStore: this.vectorStore
    });
  }

  /**
   * Reads previous indexing manifest
   */
  async _readManifest() {
    try {
      const data = await fs.readFile(MANIFEST_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return { indexedAt: null, files: {}, totalChunks: 0 };
    }
  }

  /**
   * Writes updated manifest
   */
  async _writeManifest(manifest) {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[CrmRagService] Failed to write manifest:`, err.message);
    }
  }

  /**
   * Full or incremental knowledge base indexing
   * @param {Object} options
   * @param {boolean} options.force - If true, re-indexes all files regardless of manifest
   */
  async indexAllKnowledge(options = {}) {
    const { force = false } = options;
    console.log(`\n========================================================`);
    console.log(`  CRM nErgy Production RAG Engine — Indexing Pipeline`);
    console.log(`  Embedding Model: ${this.embeddingService.model} (${this.embeddingService.expectedDim}d)`);
    console.log(`  Qdrant URL: ${this.vectorStore.qdrantUrl}`);
    console.log(`  Collection: ${this.vectorStore.collectionName}`);
    console.log(`  Mode: ${force ? 'Force Full Re-index' : 'Incremental / Change-Detection'}`);
    console.log(`========================================================\n`);

    const prevManifest = force ? { files: {} } : await this._readManifest();

    // 1. Load documents
    const loadResult = await this.loader.loadAllDocuments({
      skipUnchanged: !force,
      previousManifest: prevManifest.files || {}
    });

    const { documents, manifest: newFileHashes, stats } = loadResult;
    console.log(`[1/4] Document Loading: ${stats.loaded} loaded, ${stats.skipped} unchanged (skipped), ${stats.errors} errors.`);

    if (documents.length === 0) {
      console.log(`[Index Status] All documents are already up-to-date in the vector index!`);
      const storeStats = await this.vectorStore.getStats();
      return {
        success: true,
        alreadyUpToDate: true,
        documentsCount: stats.total,
        totalChunks: storeStats.localChunksCount
      };
    }

    // 2. Chunk documents
    console.log(`[2/4] Chunking ${documents.length} document(s)...`);
    const chunks = this.chunker.chunkAllDocuments(documents);
    console.log(` -> Generated ${chunks.length} structured chunk(s).`);

    // Clean up old vectors for changed files to prevent duplication
    for (const doc of documents) {
      await this.vectorStore.deleteByDocument(doc.filename);
    }

    // 3. Generate embeddings
    console.log(`[3/4] Generating Ollama embeddings for ${chunks.length} chunk(s) via ${this.embeddingService.model}...`);
    const startEmbed = performance.now();
    const embeddedChunks = await this.embeddingService.embedChunks(chunks, (done, total) => {
      const pct = Math.round((done / total) * 100);
      if (done % 10 === 0 || done === total) {
        console.log(` -> Progress: ${done}/${total} chunks embedded (${pct}%)...`);
      }
    });
    console.log(` -> Embeddings generated in ${Math.round(performance.now() - startEmbed)}ms.`);

    // 4. Upsert into Vector Store (Qdrant + Local persistent storage)
    console.log(`[4/4] Upserting vectors into vector database...`);
    const upsertResult = await this.vectorStore.upsertChunks(embeddedChunks);
    console.log(` -> Successfully upserted ${upsertResult.count} chunks. Total in store: ${upsertResult.totalStored}`);

    // Update manifest
    const updatedManifest = {
      indexedAt: new Date().toISOString(),
      embeddingModel: this.embeddingService.model,
      embeddingDim: this.embeddingService.expectedDim,
      files: { ...(prevManifest.files || {}), ...newFileHashes },
      totalChunks: upsertResult.totalStored
    };
    await this._writeManifest(updatedManifest);

    console.log(`\n[SUCCESS] CRM nErgy RAG indexing complete! Verified persistent knowledge ready.\n`);
    return {
      success: true,
      newlyIndexedChunks: upsertResult.count,
      totalChunks: upsertResult.totalStored,
      documentsIndexed: documents.length
    };
  }

  /**
   * Search knowledge base for query
   */
  async searchKnowledge(query, options = {}) {
    return this.retriever.retrieve(query, options);
  }

  /**
   * Prepare complete system prompt enriched with RAG context
   */
  async buildAugmentedContext(userQuery, baseSystemPrompt = '') {
    const retrieval = await this.searchKnowledge(userQuery);
    if (!retrieval.hasRelevantKnowledge) {
      return {
        hasRetrievedKnowledge: false,
        sources: [],
        augmentedPrompt: baseSystemPrompt
      };
    }

    const ragContextBlock = this.retriever.formatContextForPrompt(retrieval);
    const augmentedPrompt = [
      baseSystemPrompt,
      '',
      '---',
      ragContextBlock,
      '---'
    ].join('\n');

    return {
      hasRetrievedKnowledge: true,
      topScore: retrieval.topScore,
      sources: retrieval.sources,
      chunksCount: retrieval.chunks.length,
      augmentedPrompt
    };
  }

  /**
   * Diagnostics and health check
   */
  async getDiagnostics() {
    const storeStats = await this.vectorStore.getStats();
    const manifest = await this._readManifest();
    return {
      embeddingService: {
        model: this.embeddingService.model,
        dim: this.embeddingService.expectedDim,
        baseUrl: this.embeddingService.baseUrl
      },
      vectorStore: storeStats,
      manifest
    };
  }
}

// Singleton instance
export const crmRagService = new CrmRagService();
