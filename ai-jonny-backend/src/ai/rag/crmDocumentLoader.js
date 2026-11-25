import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary, user-facing, and fallback knowledge directory paths
const USER_KNOWLEDGE_DIR = path.resolve(__dirname, '../../../crm energy knowledge');
const PRIMARY_KNOWLEDGE_DIR = path.resolve(__dirname, '../../../ai/knowledge/crm-nergy');
const BACKUP_KNOWLEDGE_DIR = path.resolve(__dirname, '../knowledge/crm-nergy');

export class CrmDocumentLoader {
  /**
   * Resolves the active knowledge directory
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
   * Calculate SHA-256 hash of text content to detect changes
   */
  static computeHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Determine document category from filename
   */
  static determineCategory(filename) {
    const upper = filename.toUpperCase();
    if (upper.includes('MASTER_MEMORY')) return 'master_reference';
    if (upper.includes('INDEX')) return 'index_registry';
    if (upper.includes('MODULE')) return 'module_specs';
    if (upper.includes('MENU') || upper.includes('ROUTES')) return 'navigation';
    if (upper.includes('FEATURES') || upper.includes('FIELDS')) return 'ui_fields';
    if (upper.includes('API')) return 'api_specifications';
    if (upper.includes('DATABASE')) return 'database_schema';
    if (upper.includes('ROLES') || upper.includes('PERMISSIONS')) return 'security_rbac';
    if (upper.includes('WORKFLOWS')) return 'business_workflows';
    if (upper.includes('TRAINING_DATASET')) return 'curated_qa_dataset';
    if (upper.includes('DISCOVERY')) return 'system_architecture';
    if (upper.includes('GAPS')) return 'operational_boundaries';
    return 'documentation';
  }

  /**
   * Extract module name from document content or title
   */
  static extractModuleName(filename) {
    const base = path.basename(filename, path.extname(filename)).replace(/^CRM_/, '');
    return base.replace(/_/g, ' ');
  }

  /**
   * Load and validate all CRM nErgy knowledge documents
   * @param {Object} options
   * @param {boolean} options.skipUnchanged - Whether to skip documents matching provided manifest hashes
   * @param {Object} options.previousManifest - Map of { filename: hash }
   * @returns {Promise<{ documents: Array, manifest: Object, stats: Object }>}
   */
  static async loadAllDocuments(options = {}) {
    const { skipUnchanged = false, previousManifest = {} } = options;
    const baseDir = await this.getKnowledgeDir();

    let dirEntries = [];
    try {
      dirEntries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch (err) {
      console.error(`[CrmDocumentLoader] Failed to read knowledge directory ${baseDir}:`, err.message);
      return { documents: [], manifest: {}, stats: { total: 0, loaded: 0, skipped: 0, errors: 1 } };
    }

    const targetFiles = dirEntries
      .filter((d) => d.isFile() && (d.name.endsWith('.md') || d.name.endsWith('.json')))
      // Exclude temp/index manifests
      .filter((d) => !d.name.startsWith('.') && !d.name.includes('manifest'))
      .map((d) => d.name);

    const documents = [];
    const newManifest = {};
    let skippedCount = 0;
    let loadedCount = 0;
    let errorCount = 0;

    for (const filename of targetFiles) {
      const filePath = path.join(baseDir, filename);
      try {
        const rawContent = await fs.readFile(filePath, 'utf8');
        const hash = this.computeHash(rawContent);
        newManifest[filename] = hash;

        // Skip unchanged documents if previous manifest matches
        if (skipUnchanged && previousManifest[filename] === hash) {
          skippedCount++;
          continue;
        }

        let parsedContent = rawContent;
        let isJson = filename.endsWith('.json');
        let qaPairs = null;

        if (isJson) {
          try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
              // Curated training dataset Q&A items
              qaPairs = parsed;
              parsedContent = parsed
                .map((item, idx) => {
                  const q = item.question || item.prompt || item.instruction || '';
                  const a = item.answer || item.response || item.output || '';
                  const topic = item.topic || item.category || 'General';
                  return `### Q&A Item ${idx + 1} [Topic: ${topic}]\n**User Question:** ${q}\n**Verified Answer:** ${a}`;
                })
                .join('\n\n---\n\n');
            } else {
              parsedContent = JSON.stringify(parsed, null, 2);
            }
          } catch (jsonErr) {
            console.warn(`[CrmDocumentLoader] JSON parse error in ${filename}:`, jsonErr.message);
          }
        }

        const stats = await fs.stat(filePath);
        const category = this.determineCategory(filename);
        const moduleName = this.extractModuleName(filename);

        documents.push({
          id: `crm_doc_${crypto.createHash('md5').update(filename).digest('hex').slice(0, 12)}`,
          filename,
          filePath,
          category,
          moduleName,
          content: parsedContent,
          hash,
          qaPairs,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
          metadata: {
            software_id: 'crm-nergy',
            software_name: 'CRM nErgy',
            document_name: filename,
            category,
            module_name: moduleName,
            knowledge_version: '2.0.0',
            source_reference: `backend/ai/knowledge/crm-nergy/${filename}`
          }
        });
        loadedCount++;
      } catch (fileErr) {
        console.error(`[CrmDocumentLoader] Error reading ${filename}:`, fileErr.message);
        errorCount++;
      }
    }

    return {
      documents,
      manifest: newManifest,
      stats: {
        total: targetFiles.length,
        loaded: loadedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    };
  }
}

