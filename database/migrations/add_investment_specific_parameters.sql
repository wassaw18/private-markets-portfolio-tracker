-- Migration: Add investment-specific parameters (interest_rate, maturity_date)
-- Purpose: Support loan-specific fields that override pacing model patterns
-- Date: 2025-01-28

-- Add interest_rate column for loans and credit instruments
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS interest_rate FLOAT;

COMMENT ON COLUMN investments.interest_rate IS 'Annual interest rate for loans/credit instruments (0.05 for 5%)';

-- Add maturity_date column for fixed-term instruments
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS maturity_date DATE;

COMMENT ON COLUMN investments.maturity_date IS 'Maturity date for loans and fixed-term instruments';

-- No rollback needed as these are nullable columns and won't affect existing data
