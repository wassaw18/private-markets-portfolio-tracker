-- Migration: Add hierarchical document categorization
-- Date: 2025-10-21
-- Description: Adds category_group and metadata fields to documents table for enhanced categorization

-- Add category_group column (nullable to support existing records)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS category_group VARCHAR(100);

-- Add metadata column for category-specific fields (JSON storage)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index on category_group for faster filtering
CREATE INDEX IF NOT EXISTS ix_document_category_group ON documents(category_group);

-- Add index on metadata for JSONB queries
CREATE INDEX IF NOT EXISTS ix_document_metadata ON documents USING GIN (metadata);

-- Create index for tax year queries (common use case)
CREATE INDEX IF NOT EXISTS ix_document_tax_year ON documents ((metadata->>'tax_year'));

-- Comments for documentation
COMMENT ON COLUMN documents.category_group IS 'Hierarchical document category: Tax Documents, Organizational, Operational, Financial Statements, Legal & Compliance, Correspondence';
COMMENT ON COLUMN documents.metadata IS 'Category-specific metadata stored as JSON (tax_year, document_type, report_period, etc.)';

-- Migration complete
