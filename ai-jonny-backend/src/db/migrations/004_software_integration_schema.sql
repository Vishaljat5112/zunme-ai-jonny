-- Migration 004: Software Integration & Deployment Platform Schema
-- Adds tables for external software integrations, scoped conversations, and integration audit logs

CREATE TABLE IF NOT EXISTS software_integrations (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) UNIQUE NOT NULL,
  software_name VARCHAR(120) NOT NULL,
  integration_status ENUM('INTEGRATION_PENDING', 'CONFIGURED', 'ACTIVE', 'DISABLED', 'ERROR') DEFAULT 'INTEGRATION_PENDING',
  integration_type VARCHAR(64) DEFAULT 'REST_EMBEDDED',
  api_key_hash VARCHAR(128) NULL,
  api_key_prefix VARCHAR(16) NULL,
  allowed_origins LONGTEXT NULL,
  allowed_tools LONGTEXT NULL,
  allowed_roles LONGTEXT NULL,
  ai_name VARCHAR(100) DEFAULT 'Kiaan AI',
  welcome_message TEXT NULL,
  system_instructions TEXT NULL,
  configuration LONGTEXT NULL,
  integration_version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_int_software (software_id, integration_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS software_conversations (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_soft_conv_lookup (software_id, tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS software_integration_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) DEFAULT 'global',
  user_id VARCHAR(64) DEFAULT 'system',
  event_type VARCHAR(64) NOT NULL,
  details LONGTEXT NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_int_audit (software_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

