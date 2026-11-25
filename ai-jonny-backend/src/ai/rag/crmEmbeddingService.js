import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const CACHE_FILE = path.join(DATA_DIR, 'crm_embeddings_cache.json');

export class CrmEmbeddingService {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || config.ai.ollamaBaseUrl || 'http://159.198.65.194:11434').replace(/\/+$/, '');
    this.model = options.model || config.rag?.embeddingModel || 'nomic-embed-text';
    this.expectedDim = options.expectedDim || config.rag?.embeddingDim || 768;
    this.timeoutMs = options.timeoutMs || 120000;
    this.maxRetries = options.maxRetries || 3;

    this.cache = new Map();
    this.cacheLoaded = false;
  }

  async _loadCache() {
    if (this.cacheLoaded) return;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        this.cache.set(k, v);
      }
    } catch {}
    this.cacheLoaded = true;
  }

  async _persistCache() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const obj = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      await fs.writeFile(CACHE_FILE, JSON.stringify(obj), 'utf8');
    } catch {}
  }

  _hash(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  async getEmbedding(text) {
    await this._loadCache();
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('[CrmEmbeddingService] Cannot embed empty input.');
    }

    const cleanText = text.trim();
    const cacheKey = this._hash(`${this.model}_${cleanText}`);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        // Native /api/embed
        const response = await fetch(`${this.baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            input: cleanText
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const vector = Array.isArray(data.embeddings) ? data.embeddings[0] : data.embedding;
          if (Array.isArray(vector) && vector.length > 0) {
            this.cache.set(cacheKey, vector);
            return vector;
          }
        }

        // Fallback /api/embeddings
        const fbCtrl = new AbortController();
        const fbTimeout = setTimeout(() => fbCtrl.abort(), this.timeoutMs);
        const fbRes = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, prompt: cleanText }),
          signal: fbCtrl.signal
        });
        clearTimeout(fbTimeout);

        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (Array.isArray(fbData.embedding) && fbData.embedding.length > 0) {
            this.cache.set(cacheKey, fbData.embedding);
            return fbData.embedding;
          }
        }

        throw new Error(`Embedding request failed with HTTP ${response.status}`);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
        }
      }
    }

    throw new Error(
      `[CrmEmbeddingService] Embedding failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  async embedChunks(chunks, onProgress = null) {
    await this._loadCache();
    const embeddedChunks = [];
    const batchSize = 2; // Gentle, highly reliable batch size for VPS CPU
    let completed = 0;
    let newEmbeddingsCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      const uncachedChunks = [];

      for (const ch of slice) {
        const cacheKey = this._hash(`${this.model}_${ch.content.trim()}`);
        if (this.cache.has(cacheKey)) {
          embeddedChunks.push({
            ...ch,
            vector: this.cache.get(cacheKey)
          });
        } else {
          uncachedChunks.push(ch);
        }
      }

      if (uncachedChunks.length > 0) {
        const texts = uncachedChunks.map((c) => c.content.trim());
        let success = false;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

          const res = await fetch(`${this.baseUrl}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: this.model,
              input: texts
            }),
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            const vectors = data.embeddings || [];
            if (vectors.length === texts.length) {
              vectors.forEach((vec, idx) => {
                const targetChunk = uncachedChunks[idx];
                const key = this._hash(`${this.model}_${targetChunk.content.trim()}`);
                this.cache.set(key, vec);
                embeddedChunks.push({
                  ...targetChunk,
                  vector: vec
                });
              });
              success = true;
              newEmbeddingsCount += texts.length;
            }
          }
        } catch {}

        if (!success) {
          for (const ch of uncachedChunks) {
            try {
              const vec = await this.getEmbedding(ch.content);
              embeddedChunks.push({
                ...ch,
                vector: vec
              });
              newEmbeddingsCount++;
            } catch (singleErr) {
              console.error(`[CrmEmbeddingService] Error chunk ${ch.id}:`, singleErr.message);
            }
          }
        }

        // Persist cache incrementally every 20 new embeddings
        if (newEmbeddingsCount >= 20) {
          await this._persistCache();
          newEmbeddingsCount = 0;
        }
      }

      completed += slice.length;
      if (onProgress) {
        onProgress(Math.min(completed, chunks.length), chunks.length);
      }
    }

    await this._persistCache();
    return embeddedChunks;
  }
}
