-- Migration 003: Knowledge Management System Schema
-- Adds tables for document management, knowledge versioning, testing evaluations, and audit trails

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) DEFAULT 'default_tenant',
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(64) DEFAULT 'markdown',
  content LONGTEXT NOT NULL,
  file_size INT DEFAULT 0,
  version INT DEFAULT 1,
  upload_user VARCHAR(64) NOT NULL,
  processing_status ENUM('PENDING', 'PROCESSING', 'INDEXED', 'FAILED') DEFAULT 'PENDING',
  publishing_status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') DEFAULT 'DRAFT',
  chunk_count INT DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_docs_software (software_id, publishing_status),
  INDEX idx_docs_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  status ENUM('DRAFT', 'PROCESSING', 'PUBLISHED', 'ROLLED_BACK') DEFAULT 'DRAFT',
  published_by VARCHAR(64) NULL,
  published_at TIMESTAMP NULL,
  chunk_count INT DEFAULT 0,
  document_count INT DEFAULT 0,
  manifest_data LONGTEXT NULL,
  evaluation_score FLOAT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_versions_software (software_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_evaluations (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  version_id VARCHAR(64) NULL,
  test_question VARCHAR(500) NOT NULL,
  expected_answer TEXT NULL,
  retrieved_chunks_count INT DEFAULT 0,
  top_score FLOAT DEFAULT 0,
  passed BOOLEAN DEFAULT FALSE,
  actual_output TEXT NULL,
  tested_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_evals_software (software_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  software_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_software (software_id, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

