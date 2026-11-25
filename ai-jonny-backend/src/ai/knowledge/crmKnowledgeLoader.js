import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary, user-facing, and fallback knowledge directories
const USER_KNOWLEDGE_DIR = path.resolve(__dirname, '../../../crm energy knowledge');
const PRIMARY_KNOWLEDGE_DIR = path.resolve(__dirname, '../../../ai/knowledge/crm-nergy');
const BACKUP_KNOWLEDGE_DIR = path.resolve(__dirname, 'crm-nergy');

// Primary prompts directory inside backend
const USER_PROMPT_PATH = path.resolve(__dirname, '../../../crm energy knowledge/crm-nergy-system-prompt.md');
const PRIMARY_PROMPT_PATH = path.resolve(__dirname, '../../../ai/prompts/crm-nergy-system-prompt.md');
const BACKUP_PROMPT_PATH = path.resolve(__dirname, '../prompts/crm-nergy-system-prompt.md');

let cachedKnowledgeIndex = null;
let cachedMasterMemory = null;
let cachedSystemPrompt = null;
let cachedSectionSummaries = null;

export class CrmKnowledgeLoader {
  /**
   * Resolves existing knowledge directory path safely
   */
  static async getKnowledgeDir() {
    try {
      await fs.access(USER_KNOWLEDGE_DIR);
      return USER_KNOWLEDGE_DIR;
    } catch {
      try {
        await fs.access(PRIMARY_KNOWLEDGE_DIR);
        return PRIMARY_KNOWLEDGE_DIR;
      } catch {
        return BACKUP_KNOWLEDGE_DIR;
      }
    }
  }

  /**
   * Resolves existing system prompt path safely
   */
  static async getPromptPath() {
    try {
      await fs.access(USER_PROMPT_PATH);
      return USER_PROMPT_PATH;
    } catch {
      try {
        await fs.access(PRIMARY_PROMPT_PATH);
        return PRIMARY_PROMPT_PATH;
      } catch {
        return BACKUP_PROMPT_PATH;
      }
    }
  }

  /**
   * Load and cache CRM Knowledge Index JSON
   */
  static async loadIndex() {
    if (cachedKnowledgeIndex) return cachedKnowledgeIndex;

    const baseDir = await this.getKnowledgeDir();
    const indexPath = path.join(baseDir, 'CRM_KNOWLEDGE_INDEX.json');

    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      cachedKnowledgeIndex = JSON.parse(raw);
      return cachedKnowledgeIndex;
    } catch (err) {
      console.warn(`[CrmKnowledgeLoader] Failed to read ${indexPath}:`, err.message);
      return null;
    }
  }

  /**
   * Load and cache CRM Master Memory file
   */
  static async loadMasterMemory() {
    if (cachedMasterMemory) return cachedMasterMemory;

    const baseDir = await this.getKnowledgeDir();
    const memoryPath = path.join(baseDir, 'CRM_MASTER_MEMORY.md');

    try {
      cachedMasterMemory = await fs.readFile(memoryPath, 'utf8');
      return cachedMasterMemory;
    } catch (err) {
      console.warn(`[CrmKnowledgeLoader] Failed to read ${memoryPath}:`, err.message);
      return '';
    }
  }

  /**
   * Load and cache CRM System Prompt
   */
  static async loadSystemPrompt() {
    if (cachedSystemPrompt) return cachedSystemPrompt;

    const promptPath = await this.getPromptPath();

    try {
      cachedSystemPrompt = await fs.readFile(promptPath, 'utf8');
      return cachedSystemPrompt;
    } catch (err) {
      console.warn(`[CrmKnowledgeLoader] Failed to read system prompt ${promptPath}:`, err.message);
      return 'You are CRM nErgy AI Assistant, helping users navigate and operate CRM nErgy enterprise software.';
    }
  }

  /**
   * Parses Master Memory into semantic section snippets for token-efficient retrieval
   */
  static async getSectionSnippets() {
    if (cachedSectionSummaries) return cachedSectionSummaries;

    const memoryContent = await this.loadMasterMemory();
    if (!memoryContent) return [];

    const sections = [];
    const parts = memoryContent.split(/(?=^## \d+\. )/gm);

    for (const part of parts) {
      const lines = part.trim().split('\n');
      const header = lines[0] || '';
      const content = lines.slice(1).join('\n').trim();
      if (header.startsWith('## ')) {
        const title = header.replace(/^## \d+\.\s*/, '').trim();
        sections.push({ title, content });
      }
    }

    cachedSectionSummaries = sections;
    return sections;
  }

  /**
   * Identifies relevant CRM topics based on query keywords to prevent prompt token bloat
   */
  static async getRelevantContextForQuery(query = '') {
    const lower = query.toLowerCase();
    const sections = await this.getSectionSnippets();

    if (!sections || sections.length === 0) return '';

    const matchedSections = [];

    // Keyword topic mappings
    const topicRules = [
      { keywords: ['module', 'feature', 'all modules'], titles: ['ALL CRM MODULES', 'MODULE FEATURES'] },
      { keywords: ['menu', 'sidebar', 'navigation', 'navigate'], titles: ['NAVIGATION MENUS', 'FRONTEND ROUTES'] },
      { keywords: ['route', 'path', 'url'], titles: ['FRONTEND ROUTES'] },
      { keywords: ['lead', 'convert'], titles: ['FORMS AND FIELDS', 'BUSINESS WORKFLOWS', 'ALL CRM MODULES'] },
      { keywords: ['pipeline', 'stage', 'kanban', 'deal'], titles: ['BUSINESS WORKFLOWS', 'FORMS AND FIELDS', 'DATABASE MODELS'] },
      { keywords: ['role', 'permission', 'rbac', 'persona', 'access'], titles: ['ROLES AND PERMISSIONS'] },
      { keywords: ['erp', 'procurement', 'purchase order', 'inventory', 'sku', 'warehouse', 'manufacturing'], titles: ['ERP OPERATIONS', 'BUSINESS WORKFLOWS'] },
      { keywords: ['hr', 'recruiting', 'candidate', 'ats', 'employee', 'hire'], titles: ['HR AND RECRUITING', 'BUSINESS WORKFLOWS'] },
      { keywords: ['support', 'ticket', 'sla', 'knowledge base'], titles: ['CUSTOMER SUPPORT', 'BUSINESS WORKFLOWS'] },
      { keywords: ['bestie', 'zunme', 'action', 'json'], titles: ['ZUNME AND eBOX', 'AI AGENTS AND STUDIOS', 'BUSINESS WORKFLOWS'] },
      { keywords: ['ebox', 'swmtp'], titles: ['ZUNME AND eBOX', 'SOFTWARE ARCHITECTURE'] },
      { keywords: ['database', 'model', 'prisma', 'table', 'schema'], titles: ['DATABASE MODELS'] },
      { keywords: ['api', 'endpoint', 'rest', 'controller'], titles: ['API ENDPOINTS'] },
      { keywords: ['workflow', 'flow', 'process'], titles: ['BUSINESS WORKFLOWS'] },
      { keywords: ['limitation', 'missing', 'gap', 'live data'], titles: ['KNOWN LIMITATIONS', 'KNOWLEDGE GAPS'] },
      { keywords: ['what is crm', 'identity', 'about'], titles: ['CRM nErgy SOFTWARE IDENTITY', 'SOFTWARE PURPOSE', 'SOFTWARE ARCHITECTURE'] }
    ];

    for (const rule of topicRules) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        for (const targetTitle of rule.titles) {
          const match = sections.find((s) => s.title.toUpperCase().includes(targetTitle));
          if (match && !matchedSections.includes(match)) {
            matchedSections.push(match);
          }
        }
      }
    }

    // Default if no specific topic was triggered (broad summary)
    if (matchedSections.length === 0) {
      const coreIdentity = sections.find((s) => s.title.toUpperCase().includes('IDENTITY'));
      const corePurpose = sections.find((s) => s.title.toUpperCase().includes('PURPOSE'));
      const coreModules = sections.find((s) => s.title.toUpperCase().includes('ALL CRM MODULES'));
      if (coreIdentity) matchedSections.push(coreIdentity);
      if (corePurpose) matchedSections.push(corePurpose);
      if (coreModules) matchedSections.push(coreModules);
    }

    // Cap output to 3 most relevant sections to keep prompt lightweight & token-efficient
    const selected = matchedSections.slice(0, 3);
    return selected.map((s) => `### ${s.title}\n${s.content}`).join('\n\n');
  }

  /**
   * Builds high-level injection block for AI prompt
   */
  static async buildCrmSystemPrompt(userQuery = '') {
    const basePrompt = await this.loadSystemPrompt();
    const relevantContext = await this.getRelevantContextForQuery(userQuery);

    return `${basePrompt}\n\n---\n## Verified CRM nErgy Software Knowledge Reference:\n${relevantContext}`;
  }
}

