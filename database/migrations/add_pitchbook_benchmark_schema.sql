-- Migration: Add PitchBook Benchmark Schema
-- Description: Creates tables and views for storing quarterly PitchBook benchmark data
-- Author: Claude Code
-- Date: 2025-01-22

-- =====================================================
-- 1. PITCHBOOK ASSET CLASSES TABLE
-- =====================================================
CREATE TABLE pitchbook_asset_classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard PitchBook asset classes
INSERT INTO pitchbook_asset_classes (name, display_name, description, sort_order) VALUES
('private_equity', 'Private Equity', 'Buyout and growth equity strategies', 1),
('venture_capital', 'Venture Capital', 'Early stage through late stage venture capital', 2),
('real_estate', 'Real Estate', 'Private real estate funds', 3),
('real_assets', 'Real Assets', 'Infrastructure, natural resources, and other real assets', 4),
('private_debt', 'Private Debt', 'Direct lending, distressed debt, and mezzanine financing', 5),
('fund_of_funds', 'Fund of Funds', 'Multi-manager private market vehicles', 6),
('secondaries', 'Secondaries', 'Secondary market transactions', 7);

-- =====================================================
-- 2. PITCHBOOK METRIC TYPES TABLE
-- =====================================================
CREATE TABLE pitchbook_metric_types (
    id SERIAL PRIMARY KEY,
    metric_code VARCHAR(20) NOT NULL UNIQUE,
    metric_name VARCHAR(100) NOT NULL,
    description TEXT,
    unit_type VARCHAR(20) NOT NULL,
    display_format VARCHAR(50) DEFAULT '0.00%',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard performance metrics
INSERT INTO pitchbook_metric_types (metric_code, metric_name, description, unit_type, display_format, sort_order) VALUES
('IRR', 'Internal Rate of Return', 'Annualized return rate accounting for timing of cash flows', 'percentage', '0.00%', 1),
('PME', 'Public Market Equivalent', 'Performance relative to public market benchmarks', 'multiple', '0.00x', 2),
('TVPI', 'Total Value to Paid-In', 'Total value (realized + unrealized) divided by paid-in capital', 'multiple', '0.00x', 3),
('DPI', 'Distributions to Paid-In', 'Cumulative distributions divided by paid-in capital', 'multiple', '0.00x', 4),
('RVPI', 'Residual Value to Paid-In', 'Unrealized value divided by paid-in capital', 'multiple', '0.00x', 5);

-- =====================================================
-- 3. PITCHBOOK REPORTS TABLE
-- =====================================================
CREATE TABLE pitchbook_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(200) NOT NULL,
    report_period VARCHAR(10) NOT NULL,
    report_date DATE NOT NULL,
    publication_date DATE,
    file_path VARCHAR(500),
    data_as_of_date DATE,
    preliminary_data BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_pitchbook_report_period UNIQUE(report_period)
);

-- Insert the Q4 2024 report
INSERT INTO pitchbook_reports (report_name, report_period, report_date, data_as_of_date, preliminary_data, notes) VALUES
('Q4 2024 PitchBook Benchmarks with preliminary Q1 2025 data', 'Q4-2024', '2024-12-31', '2024-12-31', TRUE, 'Initial report with preliminary Q1 2025 data');

-- =====================================================
-- 4. PITCHBOOK PERFORMANCE DATA TABLE (MAIN DATA)
-- =====================================================
CREATE TABLE pitchbook_performance_data (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    asset_class_id INTEGER NOT NULL,
    metric_type_id INTEGER NOT NULL,
    vintage_year INTEGER NOT NULL,

    -- Quartile Performance Data (stored as decimals)
    top_quartile_value DECIMAL(10,4),    -- 75th percentile
    median_value DECIMAL(10,4),          -- 50th percentile
    bottom_quartile_value DECIMAL(10,4), -- 25th percentile

    -- Sample Statistics
    sample_size INTEGER,
    fund_count INTEGER,

    -- Data Quality
    data_completeness DECIMAL(5,2),
    methodology_notes TEXT,

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_pitchbook_perf_report FOREIGN KEY (report_id) REFERENCES pitchbook_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_pitchbook_perf_asset_class FOREIGN KEY (asset_class_id) REFERENCES pitchbook_asset_classes(id),
    CONSTRAINT fk_pitchbook_perf_metric_type FOREIGN KEY (metric_type_id) REFERENCES pitchbook_metric_types(id),

    -- Composite unique constraint
    CONSTRAINT uk_pitchbook_perf_unique UNIQUE(report_id, asset_class_id, metric_type_id, vintage_year),

    -- Data validation constraints
    CONSTRAINT chk_vintage_year CHECK (vintage_year >= 1990 AND vintage_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2),
    CONSTRAINT chk_quartile_order CHECK (
        (top_quartile_value IS NULL OR median_value IS NULL OR bottom_quartile_value IS NULL) OR
        (top_quartile_value >= median_value AND median_value >= bottom_quartile_value)
    ),
    CONSTRAINT chk_sample_size CHECK (sample_size IS NULL OR sample_size > 0),
    CONSTRAINT chk_data_completeness CHECK (data_completeness IS NULL OR (data_completeness >= 0 AND data_completeness <= 100))
);

-- =====================================================
-- 5. PITCHBOOK QUARTERLY RETURNS TABLE
-- =====================================================
CREATE TABLE pitchbook_quarterly_returns (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    asset_class_id INTEGER NOT NULL,
    quarter_year VARCHAR(10) NOT NULL, -- 'Q1-2024'
    quarter_date DATE NOT NULL,         -- First day of quarter

    -- Quartile Return Data (stored as decimals)
    top_quartile_return DECIMAL(8,4),
    median_return DECIMAL(8,4),
    bottom_quartile_return DECIMAL(8,4),

    -- Sample Statistics
    sample_size INTEGER,

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_pitchbook_qret_report FOREIGN KEY (report_id) REFERENCES pitchbook_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_pitchbook_qret_asset_class FOREIGN KEY (asset_class_id) REFERENCES pitchbook_asset_classes(id),

    -- Unique constraint
    CONSTRAINT uk_pitchbook_qret_unique UNIQUE(report_id, asset_class_id, quarter_year),

    -- Data validation
    CONSTRAINT chk_quarter_format CHECK (quarter_year ~ '^Q[1-4]-[0-9]{4}$'),
    CONSTRAINT chk_quarter_sample_size CHECK (sample_size IS NULL OR sample_size > 0)
);

-- =====================================================
-- 6. DATA IMPORT LOG TABLE
-- =====================================================
CREATE TABLE pitchbook_import_log (
    id SERIAL PRIMARY KEY,
    report_id INTEGER,
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_type VARCHAR(50) NOT NULL,
    source_file VARCHAR(500),
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    import_status VARCHAR(20) DEFAULT 'pending',
    error_details TEXT,
    import_duration_seconds INTEGER,
    imported_by VARCHAR(100),

    -- Import validation
    validation_passed BOOLEAN DEFAULT FALSE,
    validation_errors TEXT,

    -- Foreign Key
    CONSTRAINT fk_pitchbook_import_report FOREIGN KEY (report_id) REFERENCES pitchbook_reports(id),

    -- Constraints
    CONSTRAINT chk_import_type CHECK (import_type IN ('full', 'partial', 'update', 'quarterly_returns')),
    CONSTRAINT chk_import_status CHECK (import_status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    CONSTRAINT chk_import_counts CHECK (
        records_processed >= 0 AND
        records_inserted >= 0 AND
        records_updated >= 0 AND
        records_skipped >= 0 AND
        records_processed >= (records_inserted + records_updated + records_skipped)
    )
);

-- =====================================================
-- 7. PERFORMANCE INDEXES
-- =====================================================
-- Performance indexes for common queries
CREATE INDEX idx_pitchbook_perf_lookup ON pitchbook_performance_data(asset_class_id, metric_type_id, vintage_year);
CREATE INDEX idx_pitchbook_perf_report ON pitchbook_performance_data(report_id);
CREATE INDEX idx_pitchbook_perf_vintage ON pitchbook_performance_data(vintage_year);
CREATE INDEX idx_pitchbook_quarterly_lookup ON pitchbook_quarterly_returns(asset_class_id, quarter_date);
CREATE INDEX idx_pitchbook_quarterly_report ON pitchbook_quarterly_returns(report_id);
CREATE INDEX idx_pitchbook_quarterly_date ON pitchbook_quarterly_returns(quarter_date);
CREATE INDEX idx_pitchbook_import_status ON pitchbook_import_log(import_status, import_date);

-- =====================================================
-- 8. VIEWS FOR COMMON QUERIES
-- =====================================================

-- Latest Performance Data View
CREATE VIEW latest_pitchbook_performance AS
SELECT
    pac.name as asset_class,
    pac.display_name as asset_class_display,
    pmt.metric_code,
    pmt.metric_name,
    pmt.unit_type,
    pmt.display_format,
    ppd.vintage_year,
    ppd.top_quartile_value,
    ppd.median_value,
    ppd.bottom_quartile_value,
    ppd.sample_size,
    ppd.fund_count,
    pr.report_period,
    pr.report_date,
    pr.data_as_of_date
FROM pitchbook_performance_data ppd
JOIN pitchbook_reports pr ON ppd.report_id = pr.id
JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
WHERE pr.id = (SELECT id FROM pitchbook_reports ORDER BY report_date DESC LIMIT 1)
ORDER BY pac.sort_order, pmt.sort_order, ppd.vintage_year;

-- Performance Comparison View (Current vs Previous Quarter)
CREATE VIEW pitchbook_performance_comparison AS
SELECT
    pac.name as asset_class,
    pac.display_name as asset_class_display,
    pmt.metric_code,
    pmt.metric_name,
    ppd.vintage_year,
    ppd.median_value as current_median,
    LAG(ppd.median_value) OVER (
        PARTITION BY ppd.asset_class_id, ppd.metric_type_id, ppd.vintage_year
        ORDER BY pr.report_date
    ) as previous_median,
    (ppd.median_value - LAG(ppd.median_value) OVER (
        PARTITION BY ppd.asset_class_id, ppd.metric_type_id, ppd.vintage_year
        ORDER BY pr.report_date
    )) as median_change,
    pr.report_period,
    pr.report_date,
    ROW_NUMBER() OVER (
        PARTITION BY ppd.asset_class_id, ppd.metric_type_id, ppd.vintage_year
        ORDER BY pr.report_date DESC
    ) as recency_rank
FROM pitchbook_performance_data ppd
JOIN pitchbook_reports pr ON ppd.report_id = pr.id
JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
ORDER BY pac.sort_order, pmt.sort_order, ppd.vintage_year, pr.report_date DESC;

-- Quarterly Returns Summary View
CREATE VIEW latest_pitchbook_quarterly_returns AS
SELECT
    pac.name as asset_class,
    pac.display_name as asset_class_display,
    pqr.quarter_year,
    pqr.quarter_date,
    pqr.top_quartile_return,
    pqr.median_return,
    pqr.bottom_quartile_return,
    pqr.sample_size,
    pr.report_period,
    pr.report_date
FROM pitchbook_quarterly_returns pqr
JOIN pitchbook_reports pr ON pqr.report_id = pr.id
JOIN pitchbook_asset_classes pac ON pqr.asset_class_id = pac.id
WHERE pr.id = (SELECT id FROM pitchbook_reports ORDER BY report_date DESC LIMIT 1)
ORDER BY pac.sort_order, pqr.quarter_date DESC;

-- Performance Summary by Asset Class (Latest Report)
CREATE VIEW pitchbook_asset_class_summary AS
SELECT
    pac.name as asset_class,
    pac.display_name as asset_class_display,
    COUNT(DISTINCT ppd.vintage_year) as vintage_years_covered,
    MIN(ppd.vintage_year) as earliest_vintage,
    MAX(ppd.vintage_year) as latest_vintage,
    COUNT(DISTINCT pmt.metric_code) as metrics_available,
    AVG(ppd.sample_size) as avg_sample_size,
    SUM(ppd.fund_count) as total_funds,
    pr.report_period,
    pr.report_date
FROM pitchbook_performance_data ppd
JOIN pitchbook_reports pr ON ppd.report_id = pr.id
JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
WHERE pr.id = (SELECT id FROM pitchbook_reports ORDER BY report_date DESC LIMIT 1)
GROUP BY pac.id, pac.name, pac.display_name, pac.sort_order, pr.report_period, pr.report_date
ORDER BY pac.sort_order;

-- =====================================================
-- 9. UTILITY FUNCTIONS
-- =====================================================

-- Function to get quartile position for a given value
CREATE OR REPLACE FUNCTION get_pitchbook_quartile_position(
    p_asset_class VARCHAR(100),
    p_metric_code VARCHAR(20),
    p_vintage_year INTEGER,
    p_value DECIMAL(10,4)
) RETURNS TEXT AS $$
DECLARE
    v_top_quartile DECIMAL(10,4);
    v_median DECIMAL(10,4);
    v_bottom_quartile DECIMAL(10,4);
BEGIN
    -- Get the latest benchmark data
    SELECT
        ppd.top_quartile_value,
        ppd.median_value,
        ppd.bottom_quartile_value
    INTO v_top_quartile, v_median, v_bottom_quartile
    FROM pitchbook_performance_data ppd
    JOIN pitchbook_reports pr ON ppd.report_id = pr.id
    JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
    JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
    WHERE pac.name = p_asset_class
      AND pmt.metric_code = p_metric_code
      AND ppd.vintage_year = p_vintage_year
      AND pr.id = (SELECT id FROM pitchbook_reports ORDER BY report_date DESC LIMIT 1);

    -- Determine quartile position
    IF v_top_quartile IS NULL OR v_median IS NULL OR v_bottom_quartile IS NULL THEN
        RETURN 'No Data';
    ELSIF p_value >= v_top_quartile THEN
        RETURN 'Top Quartile';
    ELSIF p_value >= v_median THEN
        RETURN 'Above Median';
    ELSIF p_value >= v_bottom_quartile THEN
        RETURN 'Below Median';
    ELSE
        RETURN 'Bottom Quartile';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. TRIGGERS FOR AUDIT TRAIL
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_pitchbook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER trg_pitchbook_asset_classes_updated_at
    BEFORE UPDATE ON pitchbook_asset_classes
    FOR EACH ROW EXECUTE FUNCTION update_pitchbook_updated_at();

CREATE TRIGGER trg_pitchbook_reports_updated_at
    BEFORE UPDATE ON pitchbook_reports
    FOR EACH ROW EXECUTE FUNCTION update_pitchbook_updated_at();

CREATE TRIGGER trg_pitchbook_performance_data_updated_at
    BEFORE UPDATE ON pitchbook_performance_data
    FOR EACH ROW EXECUTE FUNCTION update_pitchbook_updated_at();

CREATE TRIGGER trg_pitchbook_quarterly_returns_updated_at
    BEFORE UPDATE ON pitchbook_quarterly_returns
    FOR EACH ROW EXECUTE FUNCTION update_pitchbook_updated_at();

-- =====================================================
-- 11. PERMISSIONS (OPTIONAL - ADJUST AS NEEDED)
-- =====================================================

-- Grant appropriate permissions for application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT SELECT ON ALL VIEWS IN SCHEMA public TO app_user;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log the migration completion
INSERT INTO pitchbook_import_log (
    import_type,
    import_status,
    imported_by,
    records_processed,
    records_inserted,
    import_duration_seconds
) VALUES (
    'schema_migration',
    'success',
    'migration_script',
    0,
    7, -- Asset classes inserted
    0
);

COMMENT ON TABLE pitchbook_asset_classes IS 'Asset classes used in PitchBook benchmark reports';
COMMENT ON TABLE pitchbook_metric_types IS 'Performance metric types (IRR, PME, TVPI, etc.)';
COMMENT ON TABLE pitchbook_reports IS 'Quarterly PitchBook benchmark reports';
COMMENT ON TABLE pitchbook_performance_data IS 'Main benchmark performance data by asset class, metric, and vintage';
COMMENT ON TABLE pitchbook_quarterly_returns IS 'Quarterly return data by asset class';
COMMENT ON TABLE pitchbook_import_log IS 'Log of data import operations and their results';

-- Verify the migration
SELECT 'Migration completed successfully. Tables created:' as status;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'pitchbook%'
ORDER BY table_name;