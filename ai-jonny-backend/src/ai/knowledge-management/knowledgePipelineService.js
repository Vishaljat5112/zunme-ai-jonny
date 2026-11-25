import crypto from 'crypto';
import { getPool } from '../../db/pool.js';
import { CrmChunker } from '../rag/crmChunker.js';
import { CrmEmbeddingService } from '../rag/crmEmbeddingService.js';
import { CrmVectorStore } from '../rag/crmVectorStore.js';
import { SoftwareRegistry, SOFTWARE_STATUS } from '../orchestrator/softwareRegistry.js';
import {
  DOCUMENT_STATUS,
  PUBLISHING_STATUS,
  KNOWLEDGE_LIFECYCLE,
  AUDIT_ACTIONS,
  validateDocumentPayload
} from './knowledgeTypes.js';
import { DocumentSanitizer } from './documentSanitizer.js';

export class KnowledgePipelineService {
  static chunker = new CrmChunker({ maxChunkSize: 900, chunkOverlap: 120 });
  static embeddingService = new CrmEmbeddingService();
  static vectorStore = new CrmVectorStore();

  /**
   * Uploads and stages a software-scoped knowledge document.
   */
  static async uploadDocument({
    softwareId,
    tenantId = 'default_tenant',
    documentName,
    documentType = 'markdown',
    content,
    uploadUser = 'admin'
  }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();

    // 1. Validate software existence in registry
    const software = SoftwareRegistry.getSoftware(cleanSoftwareId);
    if (!software) {
      throw new Error(`Knowledge Upload Error: Software '${softwareId}' is not registered in the system.`);
    }

    // 2. Validate payload structure
    validateDocumentPayload({ softwareId: cleanSoftwareId, documentName, content, documentType });

    // 3. Security validation: size, secrets, and prompt injection defense
    DocumentSanitizer.validate(content, documentName);
    const normalizedContent = DocumentSanitizer.normalizeText(content);
    const fileSize = Buffer.byteLength(normalizedContent, 'utf8');

    const pool = getPool();
    const docId = crypto.randomUUID();

    // 4. Save to knowledge_documents table
    await pool.query(
      `INSERT INTO knowledge_documents (
        id, software_id, tenant_id, document_name, document_type,
        content, file_size, version, upload_user, processing_status, publishing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        docId,
        cleanSoftwareId,
        tenantId,
        documentName.trim(),
        documentType.toLowerCase(),
        normalizedContent,
        fileSize,
        uploadUser,
        DOCUMENT_STATUS.PENDING,
        PUBLISHING_STATUS.DRAFT
      ]
    );

    // 5. Audit log
    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      userId: uploadUser,
      details: { documentId: docId, documentName, fileSize }
    });

    const [rows] = await pool.query('SELECT * FROM knowledge_documents WHERE id = ?', [docId]);
    return rows[0];
  }

  /**
   * Deletes a document and purges its vector embeddings.
   */
  static async deleteDocument({ id, softwareId, userId = 'admin' }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();

    const [rows] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = ? AND software_id = ?',
      [id, cleanSoftwareId]
    );
    if (rows.length === 0) {
      throw new Error('Knowledge Delete Error: Document not found or unauthorized.');
    }

    const doc = rows[0];
    await pool.query('DELETE FROM knowledge_documents WHERE id = ?', [id]);

    // Clean vector embeddings from vector store
    await this.vectorStore.initialize();
    await this.vectorStore.deleteByDocument(doc.document_name);

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.DOCUMENT_DELETE,
      userId,
      details: { documentId: id, documentName: doc.document_name }
    });

    return { success: true, deletedId: id };
  }

  /**
   * Lists documents for a given software ecosystem.
   */
  static async listDocuments({ softwareId, tenantId = null }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();

    let query = 'SELECT id, software_id, tenant_id, document_name, document_type, file_size, version, upload_user, processing_status, publishing_status, chunk_count, created_at, updated_at FROM knowledge_documents WHERE software_id = ?';
    const params = [cleanSoftwareId];

    if (tenantId) {
      query += ' AND (tenant_id = ? OR tenant_id = "default_tenant")';
      params.push(tenantId);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Indexes all pending or draft documents for a software ecosystem.
   */
  static async indexSoftwareKnowledge({ softwareId, userId = 'admin' }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const software = SoftwareRegistry.getSoftware(cleanSoftwareId);
    if (!software) {
      throw new Error(`Knowledge Index Error: Software '${softwareId}' not found.`);
    }

    const pool = getPool();
    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.INDEX_START,
      userId,
      details: { softwareName: software.softwareName }
    });

    // Update Software Registry knowledge status
    software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_PROCESSING;

    // Retrieve active documents
    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE software_id = ? AND publishing_status != ?',
      [cleanSoftwareId, PUBLISHING_STATUS.ARCHIVED]
    );

    if (docs.length === 0) {
      software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_PENDING;
      throw new Error(`Knowledge Index Error: No active documents found for '${cleanSoftwareId}'.`);
    }

    await this.vectorStore.initialize();
    let totalChunksIndexed = 0;

    for (const doc of docs) {
      try {
        await pool.query(
          'UPDATE knowledge_documents SET processing_status = ? WHERE id = ?',
          [DOCUMENT_STATUS.PROCESSING, doc.id]
        );

        // 1. Chunk document
        const chunks = this.chunker.chunkDocument({
          id: doc.id,
          title: doc.document_name,
          filename: doc.document_name,
          content: doc.content,
          metadata: {
            source_reference: doc.document_name,
            software_id: cleanSoftwareId
          }
        });

        // 2. Embed and upsert chunks with software isolation metadata
        const chunksWithVectors = [];
        for (const chunk of chunks) {
          chunk.metadata = {
            ...chunk.metadata,
            software_id: cleanSoftwareId,
            document_id: doc.id,
            document_name: doc.document_name,
            version: doc.version
          };

          const vector = await this.embeddingService.getEmbedding(chunk.content);
          chunk.vector = vector;
          chunksWithVectors.push(chunk);
          totalChunksIndexed++;
        }

        await this.vectorStore.upsertChunks(chunksWithVectors);

        // 3. Update document status
        await pool.query(
          'UPDATE knowledge_documents SET processing_status = ?, chunk_count = ? WHERE id = ?',
          [DOCUMENT_STATUS.INDEXED, chunks.length, doc.id]
        );
      } catch (docErr) {
        await pool.query(
          'UPDATE knowledge_documents SET processing_status = ?, error_message = ? WHERE id = ?',
          [DOCUMENT_STATUS.FAILED, docErr.message, doc.id]
        );
        software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_PENDING;
        throw docErr;
      }
    }

    // Determine next version
    const [vRows] = await pool.query(
      'SELECT MAX(version) as maxVer FROM knowledge_versions WHERE software_id = ?',
      [cleanSoftwareId]
    );
    const nextVer = (vRows[0]?.maxVer || 0) + 1;
    const versionId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO knowledge_versions (
        id, software_id, version, status, document_count, chunk_count
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [versionId, cleanSoftwareId, nextVer, PUBLISHING_STATUS.DRAFT, docs.length, totalChunksIndexed]
    );

    software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_READY;

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.INDEX_COMPLETE,
      userId,
      details: { version: nextVer, documentCount: docs.length, totalChunksIndexed }
    });

    return {
      success: true,
      softwareId: cleanSoftwareId,
      version: nextVer,
      versionId,
      documentCount: docs.length,
      totalChunksIndexed
    };
  }

  /**
   * Evaluates knowledge retrieval accuracy on test questions.
   */
  static async testKnowledgeRetrieval({
    softwareId,
    testQuestion,
    expectedAnswer = null,
    testedBy = 'admin'
  }) {
    if (!testQuestion || !testQuestion.trim()) {
      throw new Error('Knowledge Test Error: Test question is required.');
    }

    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    await this.vectorStore.initialize();

    // 1. Embed query
    const queryVector = await this.embeddingService.getEmbedding(testQuestion.trim());

    // 2. Query strictly isolated by software_id
    const matches = await this.vectorStore.search({
      queryVector,
      topK: 4,
      scoreThreshold: 0.50,
      filterSoftwareId: cleanSoftwareId
    });

    // Verify isolation
    for (const m of matches) {
      if (m.metadata?.software_id && m.metadata.software_id !== cleanSoftwareId) {
        throw new Error(`Security Violation: Cross-software knowledge leak detected! Chunk software '${m.metadata.software_id}' != '${cleanSoftwareId}'`);
      }
    }

    const topScore = matches.length > 0 ? matches[0].score : 0;
    let passed = matches.length > 0 && topScore >= 0.50;

    if (expectedAnswer && passed) {
      const combinedChunks = matches.map((m) => m.content.toLowerCase()).join(' ');
      const cleanExpected = expectedAnswer.toLowerCase().trim();
      const keywords = cleanExpected.split(/\s+/).filter((w) => w.length > 3);
      if (keywords.length > 0) {
        const matchesKeyword = keywords.some((kw) => combinedChunks.includes(kw));
        if (!matchesKeyword) passed = false;
      }
    }

    const pool = getPool();
    const evalId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO knowledge_evaluations (
        id, software_id, test_question, expected_answer,
        retrieved_chunks_count, top_score, passed, actual_output, tested_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evalId,
        cleanSoftwareId,
        testQuestion.trim(),
        expectedAnswer || null,
        matches.length,
        topScore,
        passed,
        matches.length > 0 ? matches[0].content.slice(0, 300) : 'No chunks found',
        testedBy
      ]
    );

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.TEST_RUN,
      userId: testedBy,
      details: { question: testQuestion, passed, topScore, retrievedChunksCount: matches.length }
    });

    return {
      evalId,
      softwareId: cleanSoftwareId,
      testQuestion,
      passed,
      topScore,
      retrievedChunksCount: matches.length,
      chunks: matches
    };
  }

  /**
   * Publishes the verified draft knowledge version.
   */
  static async publishKnowledgeVersion({ softwareId, userId = 'admin' }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const software = SoftwareRegistry.getSoftware(cleanSoftwareId);
    if (!software) {
      throw new Error(`Knowledge Publish Error: Software '${softwareId}' not found.`);
    }

    const pool = getPool();

    // 1. Retrieve latest draft version
    const [draftRows] = await pool.query(
      'SELECT * FROM knowledge_versions WHERE software_id = ? AND status = ? ORDER BY version DESC LIMIT 1',
      [cleanSoftwareId, PUBLISHING_STATUS.DRAFT]
    );

    if (draftRows.length === 0) {
      throw new Error(`Knowledge Publish Error: No staged draft version found for '${cleanSoftwareId}'.`);
    }

    const draft = draftRows[0];

    // 2. Archive previous published version
    await pool.query(
      'UPDATE knowledge_versions SET status = ? WHERE software_id = ? AND status = ?',
      [PUBLISHING_STATUS.ARCHIVED, cleanSoftwareId, PUBLISHING_STATUS.PUBLISHED]
    );

    // 3. Mark draft as published
    await pool.query(
      'UPDATE knowledge_versions SET status = ?, published_by = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?',
      [PUBLISHING_STATUS.PUBLISHED, userId, draft.id]
    );

    // 4. Update documents publishing status
    await pool.query(
      'UPDATE knowledge_documents SET publishing_status = ? WHERE software_id = ? AND processing_status = ?',
      [PUBLISHING_STATUS.PUBLISHED, cleanSoftwareId, DOCUMENT_STATUS.INDEXED]
    );

    // 5. Update Software Registry definition
    software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_PUBLISHED;
    software.knowledgeSource = {
      collection: 'crm_nergy_knowledge',
      softwareId: cleanSoftwareId,
      version: draft.version,
      chunkCount: draft.chunk_count,
      documentCount: draft.document_count
    };

    // If software was pending agent, it remains pending agent (knowledge is published, but agent decoupled)
    if (software.status === SOFTWARE_STATUS.PENDING_AGENT) {
      software.status = SOFTWARE_STATUS.KNOWLEDGE_READY;
    }

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.VERSION_PUBLISH,
      userId,
      details: { version: draft.version, chunkCount: draft.chunk_count }
    });

    return {
      success: true,
      softwareId: cleanSoftwareId,
      version: draft.version,
      status: PUBLISHING_STATUS.PUBLISHED,
      publishedAt: new Date().toISOString()
    };
  }

  /**
   * Rolls back knowledge version to a previous verified release.
   */
  static async rollbackKnowledgeVersion({ softwareId, userId = 'admin', targetVersion = null }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const software = SoftwareRegistry.getSoftware(cleanSoftwareId);
    if (!software) {
      throw new Error(`Knowledge Rollback Error: Software '${softwareId}' not found.`);
    }

    const pool = getPool();

    // Find target version
    let targetRow = null;
    if (targetVersion) {
      const [rows] = await pool.query(
        'SELECT * FROM knowledge_versions WHERE software_id = ? AND version = ?',
        [cleanSoftwareId, targetVersion]
      );
      targetRow = rows[0] || null;
    } else {
      const [rows] = await pool.query(
        'SELECT * FROM knowledge_versions WHERE software_id = ? AND status = ? ORDER BY version DESC LIMIT 1',
        [cleanSoftwareId, PUBLISHING_STATUS.ARCHIVED]
      );
      targetRow = rows[0] || null;
    }

    if (!targetRow) {
      throw new Error(`Knowledge Rollback Error: No previous verified version found for '${cleanSoftwareId}'.`);
    }

    // Mark current published as rolled back
    await pool.query(
      'UPDATE knowledge_versions SET status = ? WHERE software_id = ? AND status = ?',
      [PUBLISHING_STATUS.ROLLED_BACK, cleanSoftwareId, PUBLISHING_STATUS.PUBLISHED]
    );

    // Restore target version
    await pool.query(
      'UPDATE knowledge_versions SET status = ?, published_by = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?',
      [PUBLISHING_STATUS.PUBLISHED, userId, targetRow.id]
    );

    software.knowledgeStatus = KNOWLEDGE_LIFECYCLE.KNOWLEDGE_PUBLISHED;
    software.knowledgeSource = {
      collection: 'crm_nergy_knowledge',
      softwareId: cleanSoftwareId,
      version: targetRow.version,
      chunkCount: targetRow.chunk_count,
      documentCount: targetRow.document_count
    };

    await this.recordAuditLog({
      softwareId: cleanSoftwareId,
      action: AUDIT_ACTIONS.VERSION_ROLLBACK,
      userId,
      details: { restoredVersion: targetRow.version }
    });

    return {
      success: true,
      softwareId: cleanSoftwareId,
      restoredVersion: targetRow.version
    };
  }

  /**
   * Lists version history.
   */
  static async listVersions({ softwareId }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM knowledge_versions WHERE software_id = ? ORDER BY version DESC',
      [cleanSoftwareId]
    );
    return rows;
  }

  /**
   * Lists audit logs.
   */
  static async listAuditLogs({ softwareId, limit = 50 }) {
    const cleanSoftwareId = String(softwareId).trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM knowledge_audit_logs WHERE software_id = ? ORDER BY created_at DESC LIMIT ?',
      [cleanSoftwareId, parseInt(limit, 10)]
    );
    return rows.map((r) => {
      let details = r.details;
      try {
        if (typeof details === 'string') details = JSON.parse(details);
      } catch {}
      return { ...r, details };
    });
  }

  /**
   * Records an audit log event.
   */
  static async recordAuditLog({ softwareId, action, userId, details = null }) {
    const pool = getPool();
    const logId = crypto.randomUUID();
    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;

    await pool.query(
      'INSERT INTO knowledge_audit_logs (id, software_id, action, user_id, details) VALUES (?, ?, ?, ?, ?)',
      [logId, softwareId, action, userId, detailsStr]
    );
  }
}
