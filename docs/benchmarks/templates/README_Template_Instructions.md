# PitchBook Benchmark Data Templates

## Overview
These templates are designed for importing quarterly PitchBook benchmark data into the private markets tracker database. Use these templates to structure data from the quarterly PitchBook Benchmarks reports.

## Templates Available

### 1. Performance Data Template (`pitchbook_performance_data_template.csv`)
**Purpose**: Import vintage year performance metrics (IRR, PME, TVPI, DPI, RVPI) by asset class

**Required Columns**:
- `report_period`: Format "Q4-2024" (quarter and year)
- `asset_class`: Must match database values exactly
- `metric_code`: Must be one of: IRR, PME, TVPI, DPI, RVPI
- `vintage_year`: 4-digit year (1990-2025)
- `top_quartile_value`: 75th percentile value (decimal format)
- `median_value`: 50th percentile value (decimal format)
- `bottom_quartile_value`: 25th percentile value (decimal format)
- `sample_size`: Number of funds in sample (integer)
- `fund_count`: Number of funds (integer, can be same as sample_size)
- `methodology_notes`: Brief description (optional)

**Data Format Guidelines**:
- **IRR Values**: Enter as decimals (0.1420 = 14.20%)
- **Multiple Values**: Enter as decimals (2.45 = 2.45x multiple)
- **PME Values**: Enter as decimals (1.15 = 1.15x PME)

### 2. Quarterly Returns Template (`pitchbook_quarterly_returns_template.csv`)
**Purpose**: Import quarterly return data by asset class

**Required Columns**:
- `report_period`: Format "Q4-2024" (quarter and year)
- `asset_class`: Must match database values exactly
- `quarter_year`: Format "Q1-2020" (quarter and year of the return period)
- `quarter_date`: First day of quarter in YYYY-MM-DD format (2020-01-01)
- `top_quartile_return`: 75th percentile quarterly return (decimal format)
- `median_return`: 50th percentile quarterly return (decimal format)
- `bottom_quartile_return`: 25th percentile quarterly return (decimal format)
- `sample_size`: Number of funds in sample (integer)

**Data Format Guidelines**:
- **Return Values**: Enter as decimals (0.0650 = 6.50% quarterly return)
- **Negative Returns**: Use negative decimals (-0.0250 = -2.50% quarterly return)

## Valid Asset Class Values

Use these exact values in the `asset_class` column:
- `private_equity`
- `venture_capital`
- `real_estate`
- `real_assets`
- `private_debt`
- `fund_of_funds`
- `secondaries`

## Valid Metric Codes

Use these exact values in the `metric_code` column:
- `IRR` - Internal Rate of Return
- `PME` - Public Market Equivalent
- `TVPI` - Total Value to Paid-In
- `DPI` - Distributions to Paid-In
- `RVPI` - Residual Value to Paid-In

## Data Entry Guidelines

### 1. Extract Data from PitchBook Report

**For Performance Data**:
1. Locate the performance tables for each asset class
2. Find the vintage year tables showing quartile data
3. Extract top quartile (75th %), median (50th %), and bottom quartile (25th %) values
4. Note the sample size for each vintage year

**For Quarterly Returns**:
1. Locate the quarterly returns section for each asset class
2. Extract quarterly return data by quarter and year
3. Ensure you capture the correct time periods
4. Note the sample sizes

### 2. Data Conversion

**Converting Percentages to Decimals**:
- 14.20% → 0.1420
- -2.50% → -0.0250
- 245.5% → 2.4550

**Converting Multiples**:
- 2.45x → 2.45
- 1.15x → 1.15

### 3. Quality Checks

Before importing, verify:
- [ ] All required columns are present
- [ ] Asset class names match exactly (case sensitive)
- [ ] Metric codes are valid
- [ ] Vintage years are reasonable (1990-2025)
- [ ] Quarter dates are first day of quarter
- [ ] Return values are in decimal format
- [ ] Sample sizes are positive integers
- [ ] Top quartile ≥ Median ≥ Bottom quartile for each row

### 4. Sample Data Validation

**Good Examples**:
```csv
Q4-2024,private_equity,IRR,2020,0.1850,0.1420,0.0980,125,125,Net IRR as of Q4 2024
Q4-2024,venture_capital,TVPI,2019,4.85,2.85,1.45,89,89,Total Value multiple as of Q4 2024
```

**Bad Examples** (will cause import errors):
```csv
Q4-2024,Private Equity,IRR,2020,18.50%,14.20%,9.80%,125,125,Net IRR  # Wrong asset class format, percentages not decimals
Q4-2024,private_equity,irr,2020,0.0980,0.1420,0.1850,125,125,Net IRR  # Wrong metric case, quartiles out of order
```

## Import Process

1. **Prepare Data**: Use these templates to structure your data
2. **Validate Data**: Check all format requirements
3. **Create Report Entry**: Ensure the report period exists in the database
4. **Import Performance Data**: Upload the performance data CSV
5. **Import Quarterly Returns**: Upload the quarterly returns CSV
6. **Verify Import**: Check import logs for any errors

## Troubleshooting Common Issues

**Import Errors**:
- **"Asset class not found"**: Check spelling and case sensitivity
- **"Invalid metric code"**: Ensure using exact values (IRR, PME, TVPI, DPI, RVPI)
- **"Quartile validation failed"**: Verify top ≥ median ≥ bottom for each row
- **"Date format error"**: Use YYYY-MM-DD format for quarter_date
- **"Duplicate record"**: Check for duplicate combinations of report_period + asset_class + metric_code + vintage_year

**Data Quality Issues**:
- **Unrealistic values**: IRRs typically range from -50% to +100%, multiples from 0.1x to 10x
- **Sample size zero**: Sample sizes should be positive integers
- **Missing methodology notes**: While optional, these help with data interpretation

## Contact and Support

For questions about template usage or import issues, refer to the system documentation or contact the development team.

## Version History

- **v1.0** (2025-01-22): Initial template creation with support for Q4 2024 PitchBook report structure