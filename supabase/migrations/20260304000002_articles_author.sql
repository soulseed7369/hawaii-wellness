-- Add author field to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author text;
