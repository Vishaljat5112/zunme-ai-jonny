/**
 * Kiaan AI Knowledge Management Types & Lifecycle States (Step 9)
 */

export const DOCUMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  INDEXED: 'INDEXED',
  FAILED: 'FAILED'
};

export const PUBLISHING_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  ROLLED_BACK: 'ROLLED_BACK'
};

export const KNOWLEDGE_LIFECYCLE = {
  KNOWLEDGE_PENDING: 'KNOWLEDGE_PENDING',
  KNOWLEDGE_PROCESSING: 'KNOWLEDGE_PROCESSING',
  KNOWLEDGE_READY: 'KNOWLEDGE_READY',
  KNOWLEDGE_PUBLISHED: 'KNOWLEDGE_PUBLISHED'
};

export const AGENT_LIFECYCLE = {
  AGENT_PENDING: 'AGENT_PENDING',
  ACTIVE: 'ACTIVE'
};

export const AUDIT_ACTIONS = {
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',
  INDEX_START: 'INDEX_START',
  INDEX_COMPLETE: 'INDEX_COMPLETE',
  INDEX_FAIL: 'INDEX_FAIL',
  TEST_RUN: 'TEST_RUN',
  VERSION_PUBLISH: 'VERSION_PUBLISH',
  VERSION_ROLLBACK: 'VERSION_ROLLBACK'
};

export const ALLOWED_DOC_TYPES = ['markdown', 'text', 'json', 'csv'];

/**
 * Validates document upload payload
 */
export function validateDocumentPayload({ softwareId, documentName, content, documentType = 'markdown' }) {
  if (!softwareId || typeof softwareId !== 'string' || !softwareId.trim()) {
    throw new Error('Knowledge Validation: Valid softwareId is required.');
  }
  if (!documentName || typeof documentName !== 'string' || !documentName.trim()) {
    throw new Error('Knowledge Validation: Valid documentName is required.');
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('Knowledge Validation: Document content cannot be empty.');
  }
  if (!ALLOWED_DOC_TYPES.includes(documentType.toLowerCase())) {
    throw new Error(`Knowledge Validation: Unsupported documentType '${documentType}'. Allowed: ${ALLOWED_DOC_TYPES.join(', ')}`);
  }
  return true;
}

