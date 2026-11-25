# Step 8 — Kiaan AI Advanced Memory System Audit

**Audit Date:** 2026-11-02  
**System:** Kiaan AI Intelligent Workspace  
**Chatbot Path:** `C:\kiaan project\jonny\chatbot`  
**Current Baseline Status:** 🟢 86/86 tests passing (Step 7 Orchestrator Baseline)  

---

## 1. Executive Summary

This audit assesses the existing memory, conversation history, context handling, and database schemas in the Kiaan AI project. The goal is to upgrade Kiaan AI with an **Advanced Memory System** that supports 6 distinct memory types:
1. **Conversation Memory** (recent turns & bounded context)
2. **User Preference Memory** (stable preferences, communication style)
3. **Long-Term User Memory** (facts, historical context across sessions)
4. **Project Memory** (project-level guidelines, architecture, constraints)
5. **Software-Specific Memory** (software context, e.g., CRM nErgy active state, tenant context)
6. **Task Memory** (ongoing task progress, decisions, execution outcomes)
7. **Summary Memory** (lossless condensation of older conversation turns)

---

## 2. Existing Memory & Context Architecture Inventory

| Subsystem | Existing Implementation | Findings & Strengths | Gaps Addressed in Step 8 |
| :--- | :--- | :--- | :--- |
| **MySQL Conversations** | `conversations` table | Tracks `id`, `user_id`, `title`, `model`, timestamps. Cascade deletes on user. | No automatic long-conversation compression or persistent conversation summaries. |
| **MySQL Messages** | `messages` table | Tracks `id`, `conversation_id`, `role`, `content`, `status`, `model`, `tokens_used`. | History is retrieved on every turn without semantic relevance filtering or summarization. |
| **User Memories** | `user_memories` table | Tracks `id`, `user_id`, `key_name`, `value_text`, `category`. | Only supports flat key-value pairs (`category = 'general'`). Lacks memory types, software scopes, expiration, or versioning. |
| **Memory Service** | `MemoryService.js` | Basic CRUD (`getMemories`, `saveMemory`, `deleteMemory`). Blocks sensitive keywords (`password`, `api_key`). | Does not support software-level isolation, task memory, expiration, or prioritization. |
| **Context Window** | `MessageService.buildConversationContext` | Retrieves last 6 messages chronologically. Discards cancelled/aborted assistant turns. | Does not compress or summarize turns beyond the 6-message window. |
| **AI Provider Context** | `ollamaProvider.js` | Injects first 5 memories: `Relevant user context:\n- key: value`. | No prompt injection defense on retrieved memories; no prioritization between user, task, and software memory. |
| **Multi-Software Orchestrator** | `OrchestratorService.js` (Step 7) | Resolves software identity (`crm-nergy`, `erp-hub`, etc.) and isolates knowledge domains. | Does not isolate software-scoped memories (e.g. user preferences inside CRM vs ERP). |
| **CRM Agent & Live Data** | `CrmAgentPlanner.js` (Step 6) | Multi-step task planner executing live tools. | Does not persist task state or multi-step execution memory across turns. |

---

## 3. Database Schema Audit & Evolution Plan

The existing `user_memories` table:
```sql
CREATE TABLE IF NOT EXISTS user_memories (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  key_name VARCHAR(128) NOT NULL,
  value_text TEXT NOT NULL,
  category VARCHAR(64) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_memories_user_key (user_id, key_name),
  CONSTRAINT fk_memories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Safe Migration Strategy:
To avoid breaking existing queries or tables:
1. We will create a migration `002_advanced_memory_schema.sql` that adds optional columns to `user_memories`:
   - `memory_type`: `ENUM('conversation', 'user', 'project', 'task', 'software', 'summary') DEFAULT 'user'`
   - `software_id`: `VARCHAR(64) NULL` (for software-scoped memories)
   - `project_id`: `VARCHAR(64) NULL` (for project-scoped memories)
   - `conversation_id`: `VARCHAR(64) NULL` (for conversation/summary/task memories)
   - `metadata`: `JSON NULL` (for arbitrary structured tags, source info, confidence)
   - `expires_at`: `TIMESTAMP NULL` (for TTL/ephemeral task memories)
   - `version`: `INT DEFAULT 1`
2. Add composite indices:
   - `idx_memories_user_type (user_id, memory_type)`
   - `idx_memories_software (software_id, memory_type)`
   - `idx_memories_conversation (conversation_id, memory_type)`
   - `idx_memories_expires (expires_at)`

Existing `SELECT id, key_name, value_text, category, created_at, updated_at FROM user_memories` queries continue to run with 100% compatibility.

---

## 4. Privacy, Security & Isolation Rules

1. **User Isolation:** All memory operations MUST enforce `WHERE user_id = ?`.
2. **Software Isolation:** Software memories are tagged with `software_id`. They are ONLY retrieved when that software is active or requested.
3. **No Cross-User Leaks:** A user cannot query, view, update, or delete another user's memories.
4. **Anti-Poisoning & Injection Defense:**
   - Strict keyword sanitization.
   - Neutralization of prompt injection markers (`Ignore instructions`, `System prompt:`, etc.).
   - Explicit framing: retrieved memories are labeled as passive user context, NEVER as operational instructions.

