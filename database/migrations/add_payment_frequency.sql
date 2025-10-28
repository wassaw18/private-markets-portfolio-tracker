-- Migration: Add payment_frequency column to investments table
-- Purpose: Support payment frequency for loan-type investments
-- Date: 2025-01-28

-- Create enum type for payment frequency
CREATE TYPE paymentfrequency AS ENUM ('Monthly', 'Quarterly', 'Semi-annually', 'Annually', 'At Maturity');

-- Add payment_frequency column
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS payment_frequency paymentfrequency;

COMMENT ON COLUMN investments.payment_frequency IS 'Payment frequency for loans and credit instruments';

-- No rollback needed as this is a nullable column
