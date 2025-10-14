# Reports Roadmap

## Overview
Standardized reports for portfolio performance, entity visuals, current holdings, and operational analytics.

## High Priority (Phase 1 - Implement First)

### 1. Portfolio Summary Report
**Complexity:** Easy
**Data Sources:** Existing PortfolioSummary component
**Contents:**
- Total NAV, commitments, called capital, lifetime distributions
- Performance metrics: IRR, TVPI, DPI, RVPI
- Asset allocation breakdown
- Vintage year analysis
- Active vs. realized investments count

**Why First:** Most requested report, data already calculated, establishes report infrastructure

### 2. Holdings Report (Current Positions)
**Complexity:** Medium
**Data Sources:** EnhancedInvestmentsTable data
**Contents:**
- All active investments with current NAV
- Commitment, called amounts, uncalled commitments
- Performance metrics by investment
- Grouped by entity or asset class
- Status indicators

**Why Second:** Core operational report, minimal new logic needed, high operational value

### 3. Entity-Level Performance Report
**Complexity:** Medium
**Data Sources:** Entity relationships, investment aggregations
**Contents:**
- Each entity's total commitments, NAV, distributions
- Performance metrics aggregated by entity
- Investment count per entity
- Useful for tax planning and entity management

**Why Third:** Leverages existing entity relationships, straightforward aggregation

## Medium Priority (Phase 2)

### 4. Cash Flow Activity Report
**Complexity:** Medium-High
**Data Sources:** CashFlow table with date filtering
**Contents:**
- Capital calls and distributions over selected period
- Monthly/quarterly/annual views
- Breakdown by investment, entity, or asset class
- Running totals and net cash flow

**Implementation Notes:** Requires date range filtering and aggregation logic

### 5. Performance Attribution Report
**Complexity:** Medium-High
**Data Sources:** Investment performance, aggregations
**Contents:**
- Which investments/asset classes/vintages driving portfolio returns
- IRR and MOIC contributions by category
- Performance vs. allocation analysis
- Top/bottom performers

**Implementation Notes:** More complex calculations, high value for understanding portfolio drivers

### 6. Commitment Pacing Report
**Complexity:** Medium
**Data Sources:** Pacing model, investment periods
**Contents:**
- Unfunded commitments by investment
- Expected future capital calls timeline
- Deployment pace vs. plan
- Comparison to target pacing

**Implementation Notes:** Uses existing pacing model data, fairly straightforward

## Lower Priority (Phase 3)

### 7. Benchmark Comparison Report
**Complexity:** High
**Data Sources:** Benchmark data, PME calculations
**Contents:**
- Portfolio vs. benchmarks (Russell 2000, etc.)
- Individual investment benchmark comparisons
- PME analysis results
- Relative performance metrics

**Implementation Notes:** Depends on benchmark infrastructure being solid

### 8. Tax Package Report
**Complexity:** High
**Data Sources:** Entity data, cash flows, fee tracking
**Contents:**
- K-1 tracking by entity
- Distributions by entity for tax year
- Fee summary and deductions
- Tax lot tracking if applicable

**Implementation Notes:** Requires domain expertise for tax reporting rules

### 9. Liquidity Forecast Report
**Complexity:** Medium
**Data Sources:** LiquidityForecastDashboard component
**Contents:**
- Projected capital calls and distributions over 12/24/36 months
- Funding gaps identification
- Cash balance projections
- Investment-level detail

**Implementation Notes:** Component exists, needs PDF/export formatting

### 10. Vintage Year Analysis Report
**Complexity:** Medium
**Data Sources:** Investment data grouped by vintage
**Contents:**
- Performance by vintage year across portfolio
- J-curve progression by vintage
- Maturity analysis
- Vintage year comparisons

**Implementation Notes:** Interesting analytical report but lower operational priority

## Implementation Strategy

### Phase 1: Foundation (Reports 1-3)
**Goal:** Build reports infrastructure while delivering high-value reports

**Steps:**
1. Create `/reports` page with report list
2. Implement report generation framework:
   - PDF generation library integration
   - CSV/Excel export capability
   - Date range selectors
   - Report templates
3. Build Portfolio Summary Report
4. Build Holdings Report
5. Build Entity-Level Performance Report

**Benefits:**
- Establishes reusable infrastructure
- Delivers immediate operational value
- Uses existing data/components
- Lower complexity = faster delivery

### Phase 2: Operational Reports (Reports 4-6)
**Goal:** Add time-series and forward-looking analytics

**Prerequisites:** Phase 1 infrastructure complete

**Focus:**
- Cash flow analysis
- Performance attribution
- Commitment pacing

### Phase 3: Advanced Analytics (Reports 7-10)
**Goal:** Sophisticated analysis and compliance

**Prerequisites:** Phases 1-2 complete, benchmark system stable

**Focus:**
- Benchmark comparisons
- Tax packages
- Advanced forecasting
- Vintage analysis

## Technical Considerations

### Export Formats
- **PDF:** Primary format for formal reports
- **CSV:** Data exports for Excel analysis
- **Excel:** Formatted spreadsheets with multiple sheets
- **Web View:** Interactive HTML version

### Report Features
- Date range selection (as of date, period ranges)
- Entity filtering
- Asset class filtering
- Vintage year filtering
- Custom report titles/headers
- Logo/branding support

### Infrastructure Needs
- PDF generation library (e.g., react-pdf, pdfmake)
- Excel generation (e.g., xlsx library)
- Report templates/layouts
- Report history/audit trail
- Scheduled report generation (future enhancement)

## Success Metrics
- Time to generate report < 5 seconds
- Reports accurately reflect real-time data
- User adoption rate
- Reduction in manual reporting time
- Report accuracy vs. manual calculations
