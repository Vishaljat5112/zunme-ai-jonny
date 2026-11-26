-- Migration 008: CRM nErgy Enterprise Schema
-- Tables: crm_contacts, crm_deals, crm_activities, crm_projects, crm_tasks
-- Strictly multi-tenant and user-isolated with parameterized index optimization.

-- 1. Contacts, Leads & Partners
CREATE TABLE IF NOT EXISTS crm_contacts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  user_id VARCHAR(64) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(50) NULL,
  company VARCHAR(191) NULL,
  job_title VARCHAR(100) NULL,
  type ENUM('LEAD', 'CUSTOMER', 'PARTNER', 'VENDOR') NOT NULL DEFAULT 'LEAD',
  status VARCHAR(50) NOT NULL DEFAULT 'NEW',
  score INT NOT NULL DEFAULT 50,
  source VARCHAR(100) NULL DEFAULT 'MANUAL',
  estimated_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  partner_tier VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crm_contacts_user (user_id),
  INDEX idx_crm_contacts_tenant (tenant_id),
  INDEX idx_crm_contacts_type (type),
  INDEX idx_crm_contacts_status (status),
  INDEX idx_crm_contacts_email (email),
  CONSTRAINT fk_crm_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Commercial Deals & Sales Pipeline
CREATE TABLE IF NOT EXISTS crm_deals (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  user_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NULL,
  title VARCHAR(191) NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  stage ENUM('NEW_LEAD', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') NOT NULL DEFAULT 'NEW_LEAD',
  probability INT NOT NULL DEFAULT 20,
  expected_close_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crm_deals_user (user_id),
  INDEX idx_crm_deals_tenant (tenant_id),
  INDEX idx_crm_deals_stage (stage),
  INDEX idx_crm_deals_contact (contact_id),
  CONSTRAINT fk_crm_deals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_deals_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Activity Timeline & Interaction Logs
CREATE TABLE IF NOT EXISTS crm_activities (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  user_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NULL,
  deal_id VARCHAR(64) NULL,
  activity_type ENUM('NOTE', 'CALL', 'EMAIL', 'MEETING', 'STAGE_CHANGE') NOT NULL DEFAULT 'NOTE',
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_crm_activities_user (user_id),
  INDEX idx_crm_activities_tenant (tenant_id),
  INDEX idx_crm_activities_contact (contact_id),
  INDEX idx_crm_activities_deal (deal_id),
  CONSTRAINT fk_crm_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_activities_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_activities_deal FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Projects & Delivery
CREATE TABLE IF NOT EXISTS crm_projects (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  user_id VARCHAR(64) NOT NULL,
  deal_id VARCHAR(64) NULL,
  name VARCHAR(191) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
  progress INT NOT NULL DEFAULT 0,
  due_date DATE NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crm_projects_user (user_id),
  INDEX idx_crm_projects_tenant (tenant_id),
  INDEX idx_crm_projects_deal (deal_id),
  CONSTRAINT fk_crm_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_projects_deal FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tasks & Action Reminders
CREATE TABLE IF NOT EXISTS crm_tasks (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  user_id VARCHAR(64) NOT NULL,
  related_type VARCHAR(50) NULL,
  related_id VARCHAR(64) NULL,
  title VARCHAR(191) NOT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  due_date DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crm_tasks_user (user_id),
  INDEX idx_crm_tasks_tenant (tenant_id),
  INDEX idx_crm_tasks_status (status),
  INDEX idx_crm_tasks_due (due_date),
  CONSTRAINT fk_crm_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
