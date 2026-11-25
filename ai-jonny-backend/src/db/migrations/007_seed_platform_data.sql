-- Migration 007: Seed initial authentic records for new full-platform modules

-- Seed Platform Settings
INSERT IGNORE INTO platform_settings (id, setting_key, setting_value, category, updated_by) VALUES
('set_1', 'platform_name', 'Zunme AI Enterprise', 'general', 'SUPER_ADMIN'),
('set_2', 'default_model', 'gemma3:4b', 'ai', 'SUPER_ADMIN'),
('set_3', 'maintenance_mode', 'false', 'safety', 'SUPER_ADMIN'),
('set_4', 'chat_hourly_cap', '60', 'rate_limits', 'SUPER_ADMIN'),
('set_5', 'search_hourly_cap', '30', 'rate_limits', 'SUPER_ADMIN'),
('set_6', 'session_timeout_minutes', '120', 'security', 'SUPER_ADMIN'),
('set_7', 'strict_citation_grounding', 'true', 'search', 'SUPER_ADMIN');

-- Seed Pricing Plans
INSERT IGNORE INTO pricing_plans (id, name, price, billing_period, description, features, badge, is_current, active_subscribers) VALUES
('plan_free', 'Starter Workspace', '$0', 'Forever Free', 'Essential AI chat, web search with verified sources, and basic content studio tools.', '["50 AI Chats per month", "25 Web Searches with citations", "Standard Content Studio templates", "100MB Library cloud storage", "Community Support"]', NULL, 0, 1120),
('plan_pro', 'Pro Creator & Marketer', '$29', 'per month', 'For solopreneurs, creators, and professionals needing unlimited research and advanced studio workflows.', '["Unlimited AI Conversations", "Unlimited Real-time Web Searches", "All 1,000+ AI Content Builders", "AI Warehouse full access", "10GB Saved Library & exports", "Priority response latency"]', 'Verified & Popular', 1, 384),
('plan_enterprise', 'Business & Agency Suite', '$99', 'per month', 'Dedicated team workspace, SEO professional suite, brand voice profiles, and content calendar management.', '["Everything in Pro Plan", "Dedicated SEO Workspace & Keyword Tracking", "Brand Profile Voice Customization", "Integrated Content Calendar", "Team seats & role-based permissions", "Dedicated account manager"]', 'Enterprise Grade', 0, 42);

-- Seed Warehouse Categories & Assets
INSERT IGNORE INTO warehouse_categories (id, name, slug, icon, display_order) VALUES
('cat_templates', 'Templates', 'templates', 'layout', 1),
('cat_prompts', 'Prompts', 'prompts', 'sparkles', 2),
('cat_scripts', 'Scripts', 'scripts', 'video', 3),
('cat_copy', 'Copy Packs', 'copy-packs', 'file-text', 4),
('cat_workflows', 'Workflows', 'workflows', 'cpu', 5),
('cat_placement', 'Product Placement', 'product-placement', 'package', 6);

INSERT IGNORE INTO warehouse_templates (id, title, description, category, creator_name, is_verified_creator, tags, licensing, downloads, likes, format, rating, moderation_status, is_saved) VALUES
('asset_1', 'High-Converting SaaS Landing Page Framework', 'Proven multi-section copy blueprint with value proposition, pain point hooks, and feature comparison matrix.', 'Templates', 'Elena Rostova', 1, '["SaaS", "Copywriting", "Conversion"]', 'Commercial Pro', 1420, 312, 'Structured Blueprint', 4.9, 'APPROVED', 1),
('asset_2', 'Autonomous Competitor SEO Audit Prompt Chain', 'Systematic prompt chain for extracting semantic keyword gaps, backlink opportunities, and SERP competitor weaknesses.', 'Prompts', 'Marcus Vance', 0, '["SEO", "Keyword Research", "Auditing"]', 'Standard Community', 840, 198, 'Multi-step Prompt Chain', 4.8, 'APPROVED', 0),
('asset_3', 'YouTube Creator 10x Script Pipeline', 'Hook-Story-Offer template engineered for YouTube long-form retention, timestamps, and thumbnail caption pairings.', 'Scripts', 'Alex Johnson', 1, '["Video", "YouTube", "Retention"]', 'Commercial Pro', 2150, 540, 'Video Script Matrix', 5.0, 'APPROVED', 1),
('asset_4', 'Omnichannel B2B Cold Outreach Campaign Pack', '7-stage personalized email sequence, LinkedIn connection messages, and follow-up templates for enterprise sales.', 'Copy Packs', 'Sarah Connor', 1, '["Outreach", "B2B Sales", "Email Sequence"]', 'Commercial Pro', 1670, 422, 'Email Pack (.md)', 4.9, 'APPROVED', 0),
('asset_5', 'AI Newsletter Automated Editorial Workflow', 'Curate, synthesize, and format weekly industry tech briefs with citation anchors and sponsor shoutouts.', 'Workflows', 'Dev Team', 1, '["Newsletter", "Workflow", "Editorial"]', 'Open Source', 980, 245, 'SOP & Prompt Workflow', 4.7, 'APPROVED', 0),
('asset_6', 'Brand Sponsorship Integration Kit & Product Placement Schema', 'Complete contract schema, native video sponsor integration overlay, and automated conversion tracking for brand product placements in AI content.', 'Product Placement', 'Marcus Vance', 1, '["ProductPlacement", "Sponsorship", "BrandDeals", "Monetization"]', 'Commercial Pro', 4120, 890, 'Sponsorship Schema (.json / .md)', 4.97, 'APPROVED', 0);

-- Seed Creator Submissions
INSERT IGNORE INTO creator_submissions (id, creator_id, title, type, category, status, downloads, feedback) VALUES
('sub_1', 'usr_creator', 'Viral Hooks 2026 for Short-form Creators', 'Prompt Pack', 'Social Media', 'APPROVED', 184, 'Approved by Admin team for quality standards.'),
('sub_2', 'usr_creator', 'Solopreneur Brand Voice Architecture Blueprint', 'Template', 'Branding', 'IN_REVIEW', 0, 'Under routine moderation review by Operations.'),
('sub_3', 'usr_creator', 'Local SEO Schema Generator for Service Businesses', 'Workflow', 'SEO', 'CHANGES_REQUESTED', 0, 'Please clarify the JSON-LD formatting requirements for local business schemas.');

-- Seed SEO Keywords
INSERT IGNORE INTO seo_keywords (id, keyword, search_volume, difficulty, difficulty_score, cpc, intent, status) VALUES
('kw_1', 'ai productivity workspace for creators', '14,800/mo', 'Moderate', 48, '$3.40', 'Commercial', 'Targeted'),
('kw_2', 'best real time web search ai tool', '22,400/mo', 'Hard', 72, '$5.10', 'Commercial', 'In Content'),
('kw_3', 'how to generate high converting newsletter copy', '8,200/mo', 'Easy', 28, '$1.85', 'Informational', 'Ranking'),
('kw_4', 'ai marketing templates 2026', '19,500/mo', 'Moderate', 54, '$4.20', 'Transactional', 'Identified');

-- Seed Support Tickets
INSERT IGNORE INTO support_tickets (id, user_id, user_email, user_name, subject, category, status, priority, message) VALUES
('tkt_101', 'usr_2', 'sarah.c@cyberdyne.org', 'Sarah Connor', 'Request for custom brand tone export in Content Studio', 'Feature Request', 'IN_PROGRESS', 'Medium', 'We want to enforce a persistent brand persona across all generated marketing newsletters.'),
('tkt_102', 'usr_3', 'marcus@soloventure.io', 'Marcus Vance', 'Web search citation domain filter request', 'Technical', 'OPEN', 'High', 'Can we restrict real-time search queries to whitelist specific academic or patent domains?'),
('tkt_103', 'usr_creator', 'alex.creator@zunme.ai', 'Alex Johnson', 'Account subscription tier receipt confirmation', 'Billing', 'RESOLVED', 'Low', 'Need official enterprise invoice statement for tax reporting.');

-- Seed Social Posts
INSERT IGNORE INTO social_posts (id, user_id, platform, title, content, format, scheduled_date, status) VALUES
('post_1', 'usr_creator', 'Newsletter', 'Solid-State Battery 2026 Tech Breakdown', 'Comprehensive technical overview of automotive solid-state battery commercialization milestones in 2026.', 'Email Deep-dive', '2026-11-10', 'Scheduled'),
('post_2', 'usr_creator', 'LinkedIn', 'Why Real-Time Search Beats Hallucinating LLMs', 'Grounding conversational AI with live index search eliminates hallucinations and provides verifiable corporate trust.', 'Thought Leadership Post', '2026-11-12', 'Draft'),
('post_3', 'usr_creator', 'Blog', '5 Steps to 10x Your Content Studio Output', 'Practical workflows for integrating autonomous research with multi-channel template generation.', 'Long-form Pillar Guide', '2026-11-15', 'Draft');

-- Seed Store Categories & Products
INSERT IGNORE INTO store_categories (id, name, slug, icon) VALUES
('scat_templates', 'Creator Prompts & Blueprints', 'prompts-blueprints', 'sparkles'),
('scat_audio', 'AI Voices & Audio Kits', 'audio-kits', 'volume-2'),
('scat_video', 'Motion & Video Assets', 'video-assets', 'film');

INSERT IGNORE INTO store_products (id, category_id, title, description, price, compare_price, rating, reviews_count, badge, tags, stock_status) VALUES
('prod_1', 'scat_templates', 'Master Growth Prompt Pack 2026', '500+ curated prompts for SEO growth, high-converting copy, and automated research.', 49.00, 99.00, 4.95, 128, 'Bestseller', '["PromptPack", "Growth", "Marketing"]', 'IN_STOCK'),
('prod_2', 'scat_templates', 'Enterprise SaaS Cold Email System', 'Multi-step outbound sales sequence tested across 10,000+ enterprise prospects.', 29.00, 59.00, 4.90, 84, 'Verified', '["Sales", "B2B", "ColdEmail"]', 'IN_STOCK'),
('prod_3', 'scat_video', '4K Cinematic Prompt Camera Angles', 'Over 100 Midjourney & Stable Diffusion camera setup directives for production-grade cinematics.', 19.00, 39.00, 4.88, 46, NULL, '["CameraAngles", "Diffusion", "Cinematic"]', 'IN_STOCK');

-- Seed Initial Saved Library Items
INSERT IGNORE INTO library_items (id, user_id, title, content_type, content, preview_text, tags) VALUES
('lib_1', 'usr_creator', 'Competitive Analysis: Cloud AI Inference 2026', 'RESEARCH', 'Comprehensive breakdown comparing specialized GPU inference clouds with on-premise local Ollama architectures.', 'Comprehensive breakdown comparing specialized GPU inference clouds with on-premise...', '["Research", "AI", "Cloud"]'),
('lib_2', 'usr_creator', 'B2B Cold Email Outreach Sequence', 'MARKETING', 'Subject: Quick question regarding your Q4 AI initiatives...\n\nHi {{firstName}}, noticing your team is scaling content operations...', 'Subject: Quick question regarding your Q4 AI initiatives... Hi {{firstName}}...', '["Email", "B2B", "Outreach"]');

-- Seed zBox Email Accounts & Messages
INSERT IGNORE INTO email_accounts (id, user_id, email_address, display_name, is_primary) VALUES
('em_acc_1', 'usr_creator', 'alex.creator@zunme.ai', 'Alex Creator', 1);

INSERT IGNORE INTO email_folders (id, account_id, name, slug, unread_count) VALUES
('fld_inbox', 'em_acc_1', 'Inbox', 'inbox', 1),
('fld_sent', 'em_acc_1', 'Sent', 'sent', 0),
('fld_drafts', 'em_acc_1', 'Drafts', 'drafts', 0);

INSERT IGNORE INTO email_messages (id, folder_id, user_id, from_address, to_address, subject, snippet, body, is_read, is_starred) VALUES
('msg_em_1', 'fld_inbox', 'usr_creator', 'notifications@zunme.ai', 'alex.creator@zunme.ai', 'Welcome to zBox Secured Workspace Mail', 'Your unified business inbox is active and grounded with AI synthesis.', 'Welcome to zBox! Your mailbox is ready with end-to-end encrypted message dispatching and instant AI synthesis.', 0, 1);

