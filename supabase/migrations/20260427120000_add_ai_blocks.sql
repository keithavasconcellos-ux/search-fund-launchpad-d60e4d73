-- Add ai_blocks JSONB column to email_templates
-- Stores an array of: { id, label, tier1_prompt, tier2_prompt, tier3_prompt }
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS ai_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;
