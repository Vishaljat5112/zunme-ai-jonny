-- Migration 006: Complete Full-Platform Relational Schema & Seed Data
-- Comprehensive persistence for Library, Plans, Settings, Quotas, Warehouse, Creator Studio,
-- SEO, Ads, Social Scheduler, Store, Merchant Zone, Webmail, Reports, and Support.

-- 1. Global Settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id VARCHAR(64) PRIMARY KEY,
  setting_key VARCHAR(128) NOT NULL UNIQUE,
  setting_value LONGTEXT NOT NULL,
  category VARCHAR(64) DEFAULT 'general',
  updated_by VARCHAR(64) DEFAULT 'SUPER_ADMIN',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL,
  action VARCHAR(128) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) DEFAULT '127.0.0.1',
  status VARCHAR(32) DEFAULT 'SUCCESS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Saved Library
CREATE TABLE IF NOT EXISTS library_folders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  color VARCHAR(32) DEFAULT '#6E56CF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lib_folder_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS library_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  folder_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(32) DEFAULT 'TEXT',
  content LONGTEXT NOT NULL,
  preview_text TEXT NOT NULL,
  source_metadata LONGTEXT NULL,
  tags LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lib_item_user (user_id),
  INDEX idx_lib_item_type (content_type),
  INDEX idx_lib_item_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Pricing Plans & Subscriptions
CREATE TABLE IF NOT EXISTS pricing_plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  price VARCHAR(32) NOT NULL,
  billing_period VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  features LONGTEXT NOT NULL,
  badge VARCHAR(64) NULL,
  is_current TINYINT(1) DEFAULT 0,
  active_subscribers INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  billing_cycle VARCHAR(32) DEFAULT 'MONTHLY',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  INDEX idx_sub_user (user_id),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. User Quotas & Usage Tracking
CREATE TABLE IF NOT EXISTS user_quotas (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  plan_tier VARCHAR(64) DEFAULT 'Pro Creator & Marketer',
  max_chats_per_month INT DEFAULT 1000,
  used_chats INT DEFAULT 14,
  max_searches_per_month INT DEFAULT 500,
  used_searches INT DEFAULT 8,
  max_storage_bytes BIGINT DEFAULT 10737418240,
  used_storage_bytes BIGINT DEFAULT 128974848,
  reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quota_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usage_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  operation_type VARCHAR(64) NOT NULL,
  units INT DEFAULT 1,
  details LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usage_user (user_id),
  INDEX idx_usage_type (operation_type),
  INDEX idx_usage_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. AI Warehouse
CREATE TABLE IF NOT EXISTS warehouse_categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  slug VARCHAR(64) NOT NULL UNIQUE,
  icon VARCHAR(64) DEFAULT 'package',
  display_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS warehouse_templates (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  creator_name VARCHAR(128) NOT NULL,
  creator_id VARCHAR(64) NULL,
  is_verified_creator TINYINT(1) DEFAULT 1,
  tags LONGTEXT NOT NULL,
  licensing VARCHAR(64) DEFAULT 'Commercial Pro',
  downloads INT DEFAULT 0,
  likes INT DEFAULT 0,
  format VARCHAR(64) DEFAULT 'Structured Blueprint',
  rating FLOAT DEFAULT 4.9,
  moderation_status VARCHAR(32) DEFAULT 'APPROVED',
  is_saved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wh_cat (category),
  INDEX idx_wh_status (moderation_status),
  INDEX idx_wh_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_template_deployments (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target_environment VARCHAR(64) DEFAULT 'workspace',
  deployment_status VARCHAR(32) DEFAULT 'ACTIVE',
  config LONGTEXT NULL,
  INDEX idx_deploy_user (user_id),
  INDEX idx_deploy_template (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Creator Studio
CREATE TABLE IF NOT EXISTS creator_profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  bio TEXT NULL,
  tier_level VARCHAR(32) DEFAULT 'Tier 1',
  is_verified TINYINT(1) DEFAULT 1,
  total_earnings DECIMAL(10,2) DEFAULT 4260.00,
  pending_balance DECIMAL(10,2) DEFAULT 850.00,
  followers_count INT DEFAULT 1420,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_creator_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS creator_submissions (
  id VARCHAR(64) PRIMARY KEY,
  creator_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(64) DEFAULT 'Template',
  category VARCHAR(64) NOT NULL,
  status VARCHAR(32) DEFAULT 'IN_REVIEW',
  downloads INT DEFAULT 0,
  feedback TEXT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub_creator (creator_id),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS creator_payouts (
  id VARCHAR(64) PRIMARY KEY,
  creator_id VARCHAR(64) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'PENDING',
  payout_method VARCHAR(64) DEFAULT 'Direct Bank / ACH',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  INDEX idx_payout_creator (creator_id),
  INDEX idx_payout_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Support & Moderation
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_email VARCHAR(150) NOT NULL,
  user_name VARCHAR(128) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(64) DEFAULT 'Technical',
  status VARCHAR(32) DEFAULT 'OPEN',
  priority VARCHAR(32) DEFAULT 'Medium',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ticket_user (user_id),
  INDEX idx_ticket_status (status),
  INDEX idx_ticket_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(64) PRIMARY KEY,
  ticket_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  sender_role VARCHAR(32) DEFAULT 'USER',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. SEO Marketing & Tracking
CREATE TABLE IF NOT EXISTS seo_projects (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  target_country VARCHAR(10) DEFAULT 'US',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seo_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seo_keywords (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NULL,
  keyword VARCHAR(255) NOT NULL,
  search_volume VARCHAR(64) DEFAULT '10,000/mo',
  difficulty VARCHAR(64) DEFAULT 'Moderate',
  difficulty_score INT DEFAULT 50,
  cpc VARCHAR(32) DEFAULT '$3.50',
  intent VARCHAR(64) DEFAULT 'Commercial',
  status VARCHAR(64) DEFAULT 'Targeted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seo_kw (keyword),
  INDEX idx_seo_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Ads Manager
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  objective VARCHAR(64) DEFAULT 'Lead Generation',
  status VARCHAR(32) DEFAULT 'ACTIVE',
  budget_amount DECIMAL(10,2) DEFAULT 1200.00,
  budget_type VARCHAR(32) DEFAULT 'DAILY',
  start_date VARCHAR(64) DEFAULT '2026-10-01',
  end_date VARCHAR(64) NULL,
  impressions INT DEFAULT 48200,
  clicks INT DEFAULT 1840,
  spend DECIMAL(10,2) DEFAULT 840.50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ad_user (user_id),
  INDEX idx_ad_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_creatives (
  id VARCHAR(64) PRIMARY KEY,
  campaign_id VARCHAR(64) NOT NULL,
  headline VARCHAR(255) NOT NULL,
  body_text TEXT NOT NULL,
  format VARCHAR(64) DEFAULT 'Responsive Search Ad',
  media_url VARCHAR(500) NULL,
  destination_url VARCHAR(500) DEFAULT 'https://zunme.ai',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ad_creative_camp (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Social Scheduler
CREATE TABLE IF NOT EXISTS social_accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  account_handle VARCHAR(128) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  status VARCHAR(32) DEFAULT 'CONNECTED',
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_social_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS social_posts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  format VARCHAR(64) DEFAULT 'Thought Leadership',
  scheduled_date VARCHAR(64) NOT NULL,
  status VARCHAR(32) DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_social_post_user (user_id),
  INDEX idx_social_post_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Zunme Store
CREATE TABLE IF NOT EXISTS store_categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,
  icon VARCHAR(64) DEFAULT 'store'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS store_products (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2) NULL,
  rating FLOAT DEFAULT 5.0,
  reviews_count INT DEFAULT 42,
  badge VARCHAR(64) NULL,
  tags LONGTEXT NULL,
  stock_status VARCHAR(32) DEFAULT 'IN_STOCK',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_store_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS store_orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'COMPLETED',
  payment_status VARCHAR(32) DEFAULT 'PAID',
  items_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Merchant Zone
CREATE TABLE IF NOT EXISTS merchant_profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  store_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  payout_account VARCHAR(128) DEFAULT 'Verified ACH / Direct',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merchant_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchant_transactions (
  id VARCHAR(64) PRIMARY KEY,
  merchant_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0.00,
  net_payout DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'COMPLETED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merchant_tx (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. zBox Webmail
CREATE TABLE IF NOT EXISTS email_accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  email_address VARCHAR(150) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  is_primary TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_folders (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  unread_count INT DEFAULT 0,
  INDEX idx_folder_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_messages (
  id VARCHAR(64) PRIMARY KEY,
  folder_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  from_address VARCHAR(150) NOT NULL,
  to_address VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  snippet VARCHAR(500) NOT NULL,
  body LONGTEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  is_starred TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_msg_user (user_id),
  INDEX idx_email_msg_folder (folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

