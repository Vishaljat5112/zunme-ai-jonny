import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent local vector file path
const DATA_DIR = path.resolve(__dirname, '../../../data');
const LOCAL_VECTOR_FILE = path.join(DATA_DIR, 'crm_nergy_vectors.json');

/**
 * Cosine similarity between two numerical vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class CrmVectorStore {
  constructor(options = {}) {
    this.qdrantUrl = options.qdrantUrl || config.rag?.qdrantUrl || 'http://127.0.0.1:6333';
    this.apiKey = options.apiKey || config.rag?.qdrantApiKey || undefined;
    this.collectionName = options.collectionName || config.rag?.qdrantCollection || 'crm_nergy_knowledge';
    this.vectorDim = options.vectorDim || config.rag?.embeddingDim || 768;

    this.qdrantClient = null;
    this.isQdrantAvailable = false;
    this.localStore = new Map(); // Map<chunkId, { id, vector, content, metadata }>
    this.initialized = false;
  }

  /**
   * Initializes connections, creates Qdrant collection if reachable, and loads persistent local vectors
   */
  async initialize() {
    if (this.initialized) return;

    // 1. Try connecting to Qdrant REST
    try {
      this.qdrantClient = new QdrantClient({
        url: this.qdrantUrl,
        apiKey: this.apiKey,
        timeout: 2500,
        checkCompatibility: false
      });

      const collections = await this.qdrantClient.getCollections();
      this.isQdrantAvailable = true;

      const exists = collections.collections?.some((c) => c.name === this.collectionName);
      if (!exists) {
        console.log(`[CrmVectorStore] Creating Qdrant collection '${this.collectionName}' (${this.vectorDim}d, Cosine)...`);
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorDim,
            distance: 'Cosine'
          }
        });
      }
      console.log(`[CrmVectorStore] Connected to Qdrant at ${this.qdrantUrl} (Collection: ${this.collectionName})`);
    } catch (err) {
      this.isQdrantAvailable = false;
      // Normal when running locally without Docker Qdrant
    }

    // 2. Load persistent local vector store from disk
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(LOCAL_VECTOR_FILE, 'utf8');
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            this.localStore.set(item.id, item);
          }
        }
      }
    } catch {
      // First run or empty local store
    }

    this.initialized = true;
  }

  /**
   * Saves local vectors to disk for persistent zero-downtime offline storage
   */
  async _persistLocalStore() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const array = Array.from(this.localStore.values());
      await fs.writeFile(LOCAL_VECTOR_FILE, JSON.stringify(array, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[CrmVectorStore] Failed to persist local vector store:`, err.message);
    }
  }

  /**
   * Upsert document chunks into vector database
   */
  async upsertChunks(chunks = []) {
    await this.initialize();
    if (!Array.isArray(chunks) || chunks.length === 0) return { count: 0 };

    let upsertedCount = 0;

    // 1. Store in local persistent vector memory
    for (const ch of chunks) {
      if (!ch.id || !ch.vector) continue;
      this.localStore.set(ch.id, {
        id: ch.id,
        vector: ch.vector,
        content: ch.content,
        metadata: {
          software_id: 'crm-nergy',
          ...ch.metadata
        }
      });
      upsertedCount++;
    }
    await this._persistLocalStore();

    // 2. If Qdrant is connected, upsert points to Qdrant
    if (this.isQdrantAvailable && this.qdrantClient) {
      try {
        const points = chunks
          .filter((c) => c.id && c.vector)
          .map((c) => ({
            id: c.id,
            vector: c.vector,
            payload: {
              software_id: 'crm-nergy',
              content: c.content,
              ...c.metadata
            }
          }));

        // Batch in groups of 50
        for (let i = 0; i < points.length; i += 50) {
          const slice = points.slice(i, i + 50);
          await this.qdrantClient.upsert(this.collectionName, {
            wait: true,
            points: slice
          });
        }
      } catch (err) {
        console.warn(`[CrmVectorStore] Qdrant upsert warning (falling back to local persistent store):`, err.message);
      }
    }

    return { count: upsertedCount, totalStored: this.localStore.size };
  }

  /**
   * Semantic vector search with software_id isolation and threshold filtering
   */
  async search({ queryVector, topK = 4, scoreThreshold = 0.50, filterSoftwareId = 'crm-nergy' }) {
    await this.initialize();

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return [];
    }

    // A. If Qdrant is available, query Qdrant
    if (this.isQdrantAvailable && this.qdrantClient) {
      try {
        const filter = filterSoftwareId
          ? {
              must: [
                {
                  key: 'software_id',
                  match: { value: filterSoftwareId }
                }
              ]
            }
          : undefined;

        const results = await this.qdrantClient.search(this.collectionName, {
          vector: queryVector,
          limit: topK,
          score_threshold: scoreThreshold,
          filter,
          with_payload: true
        });

        if (results && results.length > 0) {
          return results.map((r) => ({
            id: r.id,
            score: r.score,
            content: r.payload?.content || '',
            metadata: r.payload || {}
          }));
        }
      } catch (err) {
        // Fallback gracefully to local store
      }
    }

    // B. Local Persistent Vector Store Search (Exact Cosine Similarity)
    const scored = [];
    for (const [id, item] of this.localStore.entries()) {
      // Isolate strictly by software_id
      if (filterSoftwareId && item.metadata?.software_id !== filterSoftwareId) {
        continue;
      }

      const score = cosineSimilarity(queryVector, item.vector);
      if (score >= scoreThreshold) {
        scored.push({
          id,
          score,
          content: item.content,
          metadata: item.metadata
        });
      }
    }

    // Sort descending by score and pick topK
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Delete chunks for specific document to support clean re-indexing
   */
  async deleteByDocument(documentName) {
    await this.initialize();
    let removed = 0;

    for (const [id, item] of this.localStore.entries()) {
      if (item.metadata?.document_name === documentName) {
        this.localStore.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      await this._persistLocalStore();
    }

    if (this.isQdrantAvailable && this.qdrantClient) {
      try {
        await this.qdrantClient.delete(this.collectionName, {
          filter: {
            must: [{ key: 'document_name', match: { value: documentName } }]
          }
        });
      } catch {}
    }

    return removed;
  }

  /**
   * Diagnostic statistics
   */
  async getStats() {
    await this.initialize();
    return {
      collection: this.collectionName,
      vectorDim: this.vectorDim,
      isQdrantAvailable: this.isQdrantAvailable,
      qdrantUrl: this.qdrantUrl,
      localChunksCount: this.localStore.size
    };
  }
}
