# Step 7 — Kiaan AI Multi-Software AI Orchestrator Architecture Audit

**Audit Date:** 2026-11-02  
**System:** Kiaan AI Intelligent Workspace + Multi-Software Orchestration  
**Chatbot Path:** `C:\kiaan project\jonny\chatbot`  
**Current Baseline Status:** 🟢 73/73 tests passing (100% Green)  

---

## 1. Executive Summary

This audit establishes the architectural foundation for **STEP 7 — KIAAN AI MULTI-SOFTWARE AI ORCHESTRATOR**. The Kiaan AI platform already contains a comprehensive, highly stable single-software integration for **CRM nErgy** spanning Knowledge RAG, Live Real-Time Data (Step 5), and an autonomous Multi-Tool Agent (Step 6).

The objective of Step 7 is to elevate Kiaan AI from a single-software assistant into a **central AI Orchestrator** capable of managing multiple software-specific AI agents while maintaining strict software context resolution, knowledge isolation, permission boundaries, and zero regressions for existing chat workflows.

---

## 2. Existing Architecture Audit & Component Inventory

| Component | Current State | Step 7 Reuse & Integration Strategy |
| :--- | :--- | :--- |
| **CRM nErgy Live Data Engine (Step 5)** | Active & Verified | Preserved 100%. Provides real-time CRM database access for CRM queries. |
| **CRM nErgy AI Agent (Step 6)** | Active & Verified | Preserved 100%. Registered in the Software Registry as the authoritative agent for `crm-nergy`. |
| **CRM Knowledge & RAG System** | Active & Verified | 181 chunks indexed. Isolated strictly to the `crm-nergy` knowledge domain. |
| **`messageController.js`** | Active & Verified | Central entry point. Currently contains hardcoded CRM detection. Will delegate software resolution to the Orchestrator. |
| **Universal AI Provider & Model Router** | Active & Verified | Ollama VPS (`http://159.198.65.194:11434`) handles synthesis. Preserved completely. |
| **SSE Streaming & History** | Active & Verified | Preserved. The Orchestrator returns compatible system prompt augmentations to ensure identical SSE streaming behavior. |

---

## 3. Multi-Software Registry & Isolation Strategy

1. **Software Registry (`softwareRegistry.js`):**
   - Central repository of software definitions:
     - `crm-nergy`: Status `ACTIVE`. Full agent, RAG, and live data support.
     - `erp-hub`: Status `PENDING_AGENT`. Knowledge-ready / pending implementation.
     - `hr-ats`: Status `PENDING_AGENT`. Knowledge-ready / pending implementation.
   - Transparently declares operational status (never pretends pending agents are active).
2. **Context Resolution Priority (`softwareContextResolver.js`):**
   - 1. Authenticated software headers / body parameters (`x-software-id`, `project: 'crm-nergy'`).
   - 2. Explicit software names or registered aliases (e.g. *"CRM nErgy"*, *"Energy CRM"*, *"CRM"*).
   - 3. Conversation follow-up context (previous software turn).
   - 4. Ambiguity detection (asks clarification if prompt matches multiple active softwares).
   - 5. Unrelated / general questions (e.g. *"Explain photosynthesis"*) -> routes to general chatbot without software overhead.
3. **Strict Knowledge & Tenant Isolation:**
   - Software knowledge sources are completely partitioned. CRM queries never access other software files or vector collections.
   - User permissions and tenant contexts remain strictly bound to the resolved software identity.

