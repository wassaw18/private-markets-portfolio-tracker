# PitchBook Benchmark Database Schema Design

## Overview
This document outlines the database schema design for storing and managing PitchBook benchmark data for private markets performance comparison. The schema supports quarterly data refresh cycles and comprehensive performance metrics across all private market asset classes.

## Data Structure Analysis

Based on the Q4 2024 PitchBook Benchmarks report, the data contains:

### Asset Classes Covered
1. **Private Equity** - Buyout and growth equity strategies
2. **Venture Capital** - Early stage through late stage venture
3. **Real Estate** - Private real estate funds
4. **Real Assets** - Infrastructure, natural resources, etc.
5. **Private Debt** - Direct lending, distressed debt, mezzanine
6. **Fund of Funds** - Multi-manager private market vehicles
7. **Secondaries** - Secondary market transactions

### Performance Metrics Types
- **IRR (Internal Rate of Return)** - Annualized return metrics
- **PME (Public Market Equivalent)** - Relative performance vs public markets
- **TVPI (Total Value to Paid-In)** - Multiple of invested capital
- **DPI (Distributions to Paid-In)** - Cash returned multiple
- **RVPI (Residual Value to Paid-In)** - Unrealized value multiple
- **Quarterly Returns** - Period-by-period return data

### Data Dimensions
- **Vintage Years**: 2000-2023 (24 years of data)
- **Quartiles**: Top quartile (75th %), Median (50th %), Bottom quartile (25th %)
- **Report Periods**: Quarterly publication schedule
- **Sample Sizes**: Number of funds in each cohort

## Proposed Schema

### 1. PitchBook Asset Classes Table
```sql
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
```

### 2. PitchBook Metric Types Table
```sql
CREATE TABLE pitchbook_metric_types (
    id SERIAL PRIMARY KEY,
    metric_code VARCHAR(20) NOT NULL UNIQUE, -- 'IRR', 'PME', 'TVPI', 'DPI', 'RVPI'
    metric_name VARCHAR(100) NOT NULL,
    description TEXT,
    unit_type VARCHAR(20) NOT NULL, -- 'percentage', 'multiple', 'ratio'
    display_format VARCHAR(50) DEFAULT '0.00%',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. PitchBook Reports Table
```sql
CREATE TABLE pitchbook_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(200) NOT NULL,
    report_period VARCHAR(10) NOT NULL, -- 'Q4-2024'
    report_date DATE NOT NULL,
    publication_date DATE,
    file_path VARCHAR(500),
    data_as_of_date DATE,
    preliminary_data BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(report_period)
);
```

### 4. PitchBook Performance Data Table (Main Data)
```sql
CREATE TABLE pitchbook_performance_data (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES pitchbook_reports(id),
    asset_class_id INTEGER NOT NULL REFERENCES pitchbook_asset_classes(id),
    metric_type_id INTEGER NOT NULL REFERENCES pitchbook_metric_types(id),
    vintage_year INTEGER NOT NULL,

    -- Quartile Performance Data
    top_quartile_value DECIMAL(10,4), -- 75th percentile
    median_value DECIMAL(10,4), -- 50th percentile
    bottom_quartile_value DECIMAL(10,4), -- 25th percentile

    -- Sample Statistics
    sample_size INTEGER,
    fund_count INTEGER, -- Number of funds in sample

    -- Data Quality
    data_completeness DECIMAL(5,2), -- Percentage of complete data
    methodology_notes TEXT,

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Composite unique constraint
    UNIQUE(report_id, asset_class_id, metric_type_id, vintage_year)
);
```

### 5. PitchBook Quarterly Returns Table
```sql
CREATE TABLE pitchbook_quarterly_returns (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES pitchbook_reports(id),
    asset_class_id INTEGER NOT NULL REFERENCES pitchbook_asset_classes(id),
    quarter_year VARCHAR(10) NOT NULL, -- 'Q1-2024'
    quarter_date DATE NOT NULL, -- First day of quarter

    -- Quartile Return Data (stored as decimals)
    top_quartile_return DECIMAL(8,4),
    median_return DECIMAL(8,4),
    bottom_quartile_return DECIMAL(8,4),

    -- Sample Statistics
    sample_size INTEGER,

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(report_id, asset_class_id, quarter_year)
);
```

### 6. Data Import Log Table
```sql
CREATE TABLE pitchbook_import_log (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES pitchbook_reports(id),
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_type VARCHAR(50) NOT NULL, -- 'full', 'partial', 'update'
    source_file VARCHAR(500),
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    import_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'success', 'failed'
    error_details TEXT,
    import_duration_seconds INTEGER,
    imported_by VARCHAR(100),

    -- Import validation
    validation_passed BOOLEAN DEFAULT FALSE,
    validation_errors TEXT
);
```

## Indexes for Performance

```sql
-- Performance indexes for common queries
CREATE INDEX idx_pitchbook_perf_lookup ON pitchbook_performance_data(asset_class_id, metric_type_id, vintage_year);
CREATE INDEX idx_pitchbook_perf_report ON pitchbook_performance_data(report_id);
CREATE INDEX idx_pitchbook_quarterly_lookup ON pitchbook_quarterly_returns(asset_class_id, quarter_date);
CREATE INDEX idx_pitchbook_quarterly_report ON pitchbook_quarterly_returns(report_id);
```

## Views for Common Queries

### Latest Performance Data View
```sql
CREATE VIEW latest_pitchbook_performance AS
SELECT
    pac.name as asset_class,
    pmt.metric_code,
    pmt.metric_name,
    ppd.vintage_year,
    ppd.top_quartile_value,
    ppd.median_value,
    ppd.bottom_quartile_value,
    ppd.sample_size,
    pr.report_period,
    pr.report_date
FROM pitchbook_performance_data ppd
JOIN pitchbook_reports pr ON ppd.report_id = pr.id
JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
WHERE pr.id = (SELECT id FROM pitchbook_reports ORDER BY report_date DESC LIMIT 1);
```

### Performance Comparison View
```sql
CREATE VIEW pitchbook_performance_comparison AS
SELECT
    pac.name as asset_class,
    pmt.metric_code,
    ppd.vintage_year,
    ppd.median_value as current_median,
    LAG(ppd.median_value) OVER (
        PARTITION BY ppd.asset_class_id, ppd.metric_type_id, ppd.vintage_year
        ORDER BY pr.report_date
    ) as previous_median,
    pr.report_period
FROM pitchbook_performance_data ppd
JOIN pitchbook_reports pr ON ppd.report_id = pr.id
JOIN pitchbook_asset_classes pac ON ppd.asset_class_id = pac.id
JOIN pitchbook_metric_types pmt ON ppd.metric_type_id = pmt.id
ORDER BY pac.name, pmt.metric_code, ppd.vintage_year, pr.report_date;
```

## Data Ingestion Strategy

### Quarterly Refresh Process
1. **New Report Creation**: Create new report record with Q1-2025, Q2-2025, etc.
2. **Full Data Load**: Import all performance and quarterly return data for the new report
3. **Data Validation**: Verify data completeness and consistency
4. **Historical Comparison**: Compare with previous quarters to identify significant changes
5. **Archive Previous**: Mark older reports as archived while maintaining historical data

### Template-Based Import
1. **Excel/CSV Template**: Standardized format matching the schema
2. **Data Validation**: Pre-import validation rules
3. **Batch Processing**: Efficient bulk import procedures
4. **Error Handling**: Comprehensive error logging and rollback capabilities

## Integration with Existing Schema

The PitchBook benchmark data will integrate with the existing `PerformanceBenchmark` table by:

1. **Expanding Asset Classes**: Adding the PitchBook-specific asset classes to existing enum
2. **Performance Comparison**: Cross-referencing portfolio performance against PitchBook quartiles
3. **Reporting Enhancement**: Including PitchBook benchmarks in performance dashboards
4. **Quartile Positioning**: Showing where portfolio investments rank against industry quartiles

## Benefits of This Design

1. **Scalability**: Supports multiple reports and quarterly updates
2. **Flexibility**: Can accommodate new asset classes and metric types
3. **Performance**: Optimized indexes for common query patterns
4. **Data Integrity**: Comprehensive constraints and validation
5. **Auditability**: Full audit trail of data imports and changes
6. **Usability**: Simplified views for common reporting needs

This schema provides a robust foundation for storing, managing, and analyzing PitchBook benchmark data while supporting the quarterly refresh cycle and integration with existing portfolio tracking systems.