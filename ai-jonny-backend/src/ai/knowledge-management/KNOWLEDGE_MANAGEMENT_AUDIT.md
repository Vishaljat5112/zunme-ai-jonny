# Step 9 — Kiaan AI Team Training & Knowledge Management Platform Audit

**Audit Date:** 2026-11-02  
**System:** Kiaan AI Intelligent Multi-Software Workspace  
**Chatbot Path:** `C:\kiaan project\jonny\chatbot`  
**Current Baseline Status:** 🟢 99/99 tests passing (Step 8 Advanced Memory Baseline)  

---

## 1. Executive Summary

This audit assesses the existing knowledge ingestion, vector storage, retrieval, and software orchestration components in Kiaan AI to design and build a **Team AI Training & Knowledge Management Platform**.

Currently, knowledge for **CRM nErgy** is stored in markdown files inside `backend/ai/knowledge/crm energy knowledge/` and indexed into Qdrant/local vector store with 181 chunks. However, there is no generic administrative interface or dynamic management API for non-developer team members to upload documents, index new software knowledge bases, validate versions, test retrieval quality, or safely publish/rollback knowledge for different software ecosystems (e.g., `erp-hub`, `hr-ats`, `omp-deals`) without modifying code.

---

## 2. Existing Architecture & Reusable Component Inventory

| Component | Existing File | Reusability in Step 9 |
| :--- | :--- | :--- |
| **Document Loader** | `backend/src/ai/rag/crmDocumentLoader.js` | Generic text extraction patterns can be reused to process Markdown, JSON, plain text, and documentation files. |
| **Chunking Engine** | `backend/src/ai/rag/crmChunker.js` | Reusable directly. Splits text into 900-char blocks with 120-char overlap preserving headers and metadata. |
| **Embedding Service** | `backend/src/ai/rag/crmEmbeddingService.js` | Reused directly without duplication. Connects to Ollama `nomic-embed-text` (768-dim) on the VPS with local hash caching. |
| **Vector Store** | `backend/src/ai/rag/crmVectorStore.js` | Reused directly. Features Qdrant REST integration with automatic local persistent vector fallback and `filterSoftwareId` isolation. |
| **Software Registry** | `backend/src/ai/orchestrator/softwareRegistry.js` | Central repository of software ecosystems. Will be extended with dynamic knowledge publishing states. |
| **Context Resolver & Orchestrator** | `softwareContextResolver.js` & `orchestratorService.js` | Routes queries to the appropriate software context. Will consume published knowledge metadata for resolved systems. |
| **Database Pool** | `backend/src/db/pool.js` | MariaDB / MySQL connection pool for persistent document metadata, versions, and test logs. |
| **Authentication & RBAC** | `authMiddleware.js` | Validates user identity and permissions (`x-user-id`, role checks). |

---

## 3. Database Schema Migration Plan

To support dynamic multi-software knowledge management, we introduce Migration `003_knowledge_management_schema.sql` adding:
1. `knowledge_documents`: Software-scoped document records with validation status (`PENDING`, `PROCESSING`, `INDEXED`, `FAILED`) and publishing status (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
2. `knowledge_versions`: Version-aware knowledge release bundles with publication timestamps, chunk counts, document counts, and rollback history.
3. `knowledge_evaluations`: Test questions, expected answers, top retrieval scores, and evaluation pass/fail metrics.
4. `knowledge_audit_logs`: Immutable audit trails tracking every document upload, indexing trigger, publishing release, and rollback action.

---

## 4. Software Knowledge Isolation & Security Strategy

1. **Strict Metadata Isolation:** Every document and chunk is tagged with `software_id`. Vector searches strictly filter by `software_id`, ensuring CRM nErgy knowledge never leaks into other software ecosystems.
2. **Untrusted Upload Sanitization:** Uploaded documents are parsed as untrusted text. Dangerous scripts, sensitive credentials, and prompt injection attempts are detected and stripped.
3. **Draft vs Published Lifecycle:** Newly uploaded and indexed documents remain in `DRAFT` state until an authorized team member runs evaluations and explicitly triggers `PUBLISH`. If an issue is discovered, one-click `ROLLBACK` immediately restores the previous verified version.
4. **Agent Status Decoupling:** Having published knowledge does NOT automatically activate an autonomous agent. The orchestrator explicitly distinguishes `KNOWLEDGE_PUBLISHED` from `ACTIVE` agent capabilities.

