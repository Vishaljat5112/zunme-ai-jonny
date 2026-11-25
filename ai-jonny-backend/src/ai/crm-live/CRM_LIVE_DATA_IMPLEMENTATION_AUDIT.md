# CRM nErgy Live Data Intelligence Engine — Implementation Audit

**Audit Date:** 2026-11-02  
**Auditor:** Kiaan AI Safe Continuation System  
**Chatbot Workspace:** `C:\kiaan project\jonny\chatbot`  
**CRM Source Path:** `C:\kiaan project\jonny\crm-energy personal`  

---

## 1. Executive Summary

This audit establishes the baseline before implementing **STEP 5 — CRM nErgy LIVE DATA INTELLIGENCE ENGINE**. The existing Kiaan AI chatbot is fully functional, with 43/43 existing tests passing, SSE streaming intact, MySQL running at `127.0.0.1:3306`, and the Ollama remote VPS (`gemma3:4b`, `qwen2.5:3b`, etc.) fully operational.

CRM nErgy source code and database have been thoroughly inspected. The CRM MySQL database `crm-db` is active on `127.0.0.1:3306` with 24 tables, including real multi-tenant records (`TENANT-08492`), real users with 12 RBAC roles, active leads, pending tasks, and contacts. The CRM HTTP server (`port 5002`) is currently stopped in this environment.

---

## 2. Component Classification Matrix

| Component | Status | Verification & Finding Details |
| :--- | :--- | :--- |
| **CRM Knowledge RAG Engine** | **VERIFIED WORKING** | 181 chunks in vector store, `nomic-embed-text` embeddings, hybrid disk cache, 43/43 tests passing. |
| **SSE Streaming & Chat History** | **VERIFIED WORKING** | `messageController.js` streams tokens via Server-Sent Events, records history in MySQL `kiaan_ai`. |
| **Ollama VPS & Model Routing** | **VERIFIED WORKING** | `http://159.198.65.194:11434` tested and responding with HTTP 200, fast warmup active. |
| **Kiaan AI Database (`kiaan_ai`)**| **VERIFIED WORKING** | Connected at `127.0.0.1:3306`, all migrations up to date. |
| **CRM nErgy Database (`crm-db`)** | **VERIFIED WORKING** | 24 tables found (`tenants`, `users`, `leads`, `deals`, `tasks`, `invoices`, `contacts`, etc.). Real data present. |
| **Question Classifier (Live Query)**| **VERIFIED WORKING** | `crmQuestionClassifier.js` correctly classifies live data questions to `LIVE_DATA_QUERY`. |
| **CRM HTTP API Server (Port 5002)** | **IMPLEMENTED BUT OFFLINE** | Complete Express + Prisma API in CRM source code, currently not running on port 5002 (TCP connect failed). |
| **CRM Authentication Bridge** | **NOT IMPLEMENTED** | Needs bridge to handle JWT tokens, service connector keys (`CRM_NERGY_CONNECTOR_KEY`), and session resolution. |
| **CRM Permission & RBAC Service** | **NOT IMPLEMENTED** | Needs service to validate user permissions and tenant isolation matching CRM's 12 RBAC roles. |
| **CRM Live Tool Registry** | **NOT IMPLEMENTED** | Needs registry for the 9 read-only tools (`getLeadCount`, `getMyAssignedLeads`, etc.). |
| **CRM Live Data Service** | **NOT IMPLEMENTED** | Needs dual-tier data access service (HTTP REST API when online, direct secure parameterized queries when offline). |
| **CRM Live Query Router** | **NOT IMPLEMENTED** | Needs query parser and router to invoke matching tools and format sanitized context. |
| **messageController Integration** | **PARTIALLY IMPLEMENTED** | Detects `LIVE_DATA_QUERY` and passes to `crmAnswerService`, which currently explains how to view data manually. |

---

## 3. Real CRM Schema & Data Findings

Direct inspection of `crm-db` on `127.0.0.1:3306`:
- **Tenants:**
  - `TENANT-08492`: `nErgy Enterprise Logistics`
  - `cmunoyqx50000tovon49iw6gx`: `Tenant B Logistics`
- **Users (Sample):**
  - `cmuo3wl3c0001toeory5wre6k`: `Business Owner` (`business.owner@nergy.io`, role: `BUSINESS_OWNER`)
  - `cmuo3wl3m0003toeoslzck7oq`: `Customer` (`customer@nergy.io`, role: `CUSTOMER`)
  - `cmuo3wl50000ltoeojmmdwqth`: `CRM Pro` (`crm.pro@nergy.io`, role: `CRM_PRO`)
- **Leads:**
  - `cmv1yua2l000btoycolttbs7x`: `abd` (`solar`, `$250,000`, `NEW`, assigned: `cmuo3wl50000ltoeojmmdwqth`)
  - `cmvhy0nup0007ure0r7qe26tj`: `FVCX` (`SDX`, `$250,000`, `NEW`, assigned: `cmuo3wl3c0001toeory5wre6k`)
  - `cmvyxeb310001urbsnbayb1a9`: `Jordan Reed` (`Apex Logistics Corp`, `$120,000`, `NEW`, assigned: `cmuo3wl3c0001toeory5wre6k`, created today: `2026-11-02`)
- **Tasks:**
  - `cmvhxzno60003ure0sdhe95t4`: `A` (`PENDING`, `MEDIUM`, due: `2026-10-20` -> OVERDUE)
- **Contacts:**
  - `cmv1ysfaq0003toycmjhnrc3b`: `Stiv Smith` (`Global`, `smith@gmail.com`, `Enterprise Client`, `Active`)

---

## 4. Implementation Strategy (Zero Risk to Existing Chatbot)

1. **Dual-Tier Live Data Architecture:**
   - **Tier 1 (HTTP REST):** If CRM HTTP server at `http://127.0.0.1:5002` is listening, queries are dispatched to authenticated endpoints (`/api/leads`, `/api/deals`, etc.) with user JWT.
   - **Tier 2 (Direct Local Connector):** If port 5002 is offline, queries run through a secure, parameterized local client connecting to `crm-db`.
   - **Zero Fake Data:** If records are empty or user lacks permission, returns honest zero-state or access-denied response.
   - **Strict Multi-Tenancy:** Every query strictly enforces `tenantId` isolation.
   - **Strict RBAC:** Role restrictions (e.g. `AFFILIATE_PARTNER` can only see their deals, `CUSTOMER` can only see their tickets/tasks) are enforced before queries execute.
2. **Read-Only Tools:**
   1. `getLeadCount`
   2. `getMyAssignedLeads`
   3. `getLeadDetails`
   4. `getDealPipelineSummary`
   5. `getPipelineValue`
   6. `getOverdueTasks`
   7. `getPendingInvoices`
   8. `getContactDetails`
   9. `getDashboardSummary`
3. **Smallest Footprint in `messageController.js`:**
   - Preserve all existing branches (General chat, CRM knowledge RAG, attachments, streaming).
   - Only when `classification.type === CRM_QUESTION_TYPES.LIVE_DATA_QUERY`, route to `crmLiveQueryRouter` to execute tool and inject live factual context into the system prompt for natural language streaming answer.

