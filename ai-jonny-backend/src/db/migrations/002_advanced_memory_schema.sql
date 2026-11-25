-- Migration 002: Advanced Memory System Schema Enhancements
-- Upgrades user_memories with multi-scoped memory types, software isolation, and TTL expiration

ALTER TABLE user_memories
  ADD COLUMN IF NOT EXISTS memory_type ENUM('conversation', 'user', 'project', 'task', 'software', 'summary') DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS software_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS metadata LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Add indices for high-performance scoped retrieval
ALTER TABLE user_memories
  ADD INDEX IF NOT EXISTS idx_memories_user_type (user_id, memory_type),
  ADD INDEX IF NOT EXISTS idx_memories_software (software_id, memory_type),
  ADD INDEX IF NOT EXISTS idx_memories_conversation (conversation_id, memory_type),
  ADD INDEX IF NOT EXISTS idx_memories_expires (expires_at);

