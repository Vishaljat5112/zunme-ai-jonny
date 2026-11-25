import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kiaan_ai',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'ollama',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://159.198.65.194:11434',
    ollamaDefaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'gemma3:4b',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    grokApiKey: process.env.GROK_API_KEY || '',
    grokBaseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    grokDefaultModel: process.env.GROK_DEFAULT_MODEL || 'grok-4.20-0309-non-reasoning'
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    enabled: process.env.TAVILY_SEARCH_ENABLED === 'true'
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.AI_QUEUE_ENABLED === 'true',
    concurrency: parseInt(process.env.AI_QUEUE_CONCURRENCY || '1', 10),
    attempts: parseInt(process.env.AI_QUEUE_ATTEMPTS || '2', 10),
    backoffDelay: parseInt(process.env.AI_QUEUE_BACKOFF || '3000', 10)
  },
  upload: {
    dir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)
  },
  rag: {
    enabled: process.env.RAG_ENABLED !== 'false',
    embeddingProvider: process.env.RAG_EMBEDDING_PROVIDER || 'ollama',
    embeddingModel: process.env.RAG_EMBEDDING_MODEL || 'nomic-embed-text',
    embeddingDim: parseInt(process.env.RAG_EMBEDDING_DIM || '768', 10),
    qdrantUrl: process.env.QDRANT_URL || 'http://127.0.0.1:6333',
    qdrantApiKey: process.env.QDRANT_API_KEY || undefined,
    qdrantCollection: process.env.QDRANT_COLLECTION || 'crm_nergy_knowledge',
    topK: parseInt(process.env.RAG_TOP_K || '4', 10),
    scoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.50')
  }
};