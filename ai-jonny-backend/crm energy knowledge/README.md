# CRM nErgy — Complete Knowledge Files Guide (ज्ञान मार्गदर्शिका)

Yeh folder **CRM nErgy** software ki complete knowledge base aur documentation hai. Yaha har ek file ka clear aur aasan matlab diya gaya hai:

---

## 📁 Files List Aur Unka Kaam

### 1. `CRM_MASTER_MEMORY.md` 🌟 (Sabse Important File)
- **Kya hai:** Yeh CRM nErgy ki **Central Master Memory** hai jisme total **24 architectural sections** hain.
- **Kaam:** Isme software identity, modules, menus, routes, forms, fields, workflows, database models, APIs, roles, Bestie/Zunme AI, aur business rules sab kuch ek hi jagah detailed documented hai.

### 2. `CRM_MODULE_INVENTORY.md` 📦
- **Kya hai:** Saare 22 Primary Modules ki list.
- **Kaam:** Dashboard, Leads, Contacts, Sales Pipeline, ERP Projects, Procurement/Purchase Orders, Warehouse Inventory, Manufacturing (BOM), Invoicing, HR Candidates (ATS), Support Tickets, AI SuperHouse Studios ka functional description.

### 3. `CRM_MENU_AND_ROUTES.md` 🧭
- **Kya hai:** Frontend Navigation aur 58 Routing Paths.
- **Kaam:** Frontend me user konse URL par jaa sakta hai (jaise `/crm/dashboard`, `/crm/leads`, `/crm/pipeline`, `/erp/inventory`, `/hr/recruiting`) aur sidebar ke konse menu button se wo page khulta hai.

### 4. `CRM_FEATURES_AND_FIELDS.md` 📝
- **Kya hai:** UI Forms, Modals, Buttons aur Input Fields ki detail.
- **Kaam:** Lead form me kon-kon se fields hain (first name, email, phone, company, status), Lead convert karne ka button, Kanban deal cards, aur filters.

### 5. `CRM_WORKFLOWS.md` ⚡
- **Kya hai:** End-to-end Business Processes (Workflows).
- **Kaam:** 
  1. Lead-to-Cash (Lead banne se Closed Won aur Invoicing tak).
  2. Procurement / Purchase Order Approval workflow.
  3. HR / Candidate ATS Hiring workflow.
  4. Customer Support Ticket SLA resolution.
  5. Zunme AI Action Card confirmation workflow.

### 6. `CRM_ROLES_AND_PERMISSIONS.md` 👥
- **Kya hai:** 12 Business Personas aur RBAC Access Rules.
- **Kaam:** `business_owner`, `operations_sales_admin`, `finance_compliance_admin`, `hr_recruiting_lead`, `inventory_procurement_officer`, `support_service_manager`, `dealer_franchise_partner`, `customer`, etc. kis page ko dekh sakte hain aur kisko access nahi hai.

### 7. `CRM_DATABASE_INVENTORY.md` 🗄️
- **Kya hai:** Database Schema aur 23 Prisma Models.
- **Kaam:** MySQL me bane tables: `Tenant`, `User`, `Lead`, `Contact`, `Deal`, `Task`, `ErpProject`, `InventoryItem`, `PurchaseOrder`, `Invoice`, `HrEmployee`, `CandidateApplication`, `SupportTicket`, etc.

### 8. `CRM_API_INVENTORY.md` 🌐
- **Kya hai:** 48 Backend REST API Endpoints.
- **Kaam:** Express controllers ke routes jaise `GET /api/leads`, `POST /api/leads`, `POST /api/leads/:id/convert`, `GET /api/deals`, `POST /api/purchase-orders`, etc.

### 9. `CRM_SOFTWARE_DISCOVERY.md` 🔍
- **Kya hai:** Discovery aur Architectural Audit Report.
- **Kaam:** React 18 + Vite frontend, Node Express backend, Prisma ORM, multi-tenancy model, ecosystem integrations (OMP, OAL, SEA eBox, WebRTC).

### 10. `CRM_KNOWLEDGE_GAPS.md` ⚠️
- **Kya hai:** Live Dynamic Data vs Static Knowledge ka Farq.
- **Kaam:** AI ko sikhata hai ki documented features explain kare, lekin live tenant customer records (jaise kisi user ka live balance ya aaj ke deal numbers) fake generate na kare.

### 11. `CRM_KNOWLEDGE_INDEX.json` 📑
- **Kya hai:** Machine-readable JSON Index.
- **Kaam:** Saare modules, routes, tables, roles ka structured mapping jo code loader instant read karta hai.

### 12. `CRM_NERGY_AI_TRAINING_DATASET.json` 🧠
- **Kya hai:** Curated Questions & Answers Dataset.
- **Kaam:** Users ke common sawalon ke verified, accurate javab.

### 13. `crm-nergy-system-prompt.md` 🛡️
- **Kya hai:** AI System Instructions.
- **Kaam:** AI ka tone, guardrails, role aur grounding instructions.

---
*Created for Kiaan AI Workspace — CRM nErgy Permanent Knowledge Base.*

