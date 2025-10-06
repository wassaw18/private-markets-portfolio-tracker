# Templates Directory

Data templates and sample generators for bulk upload and testing.

This folder contains comprehensive sample data templates for the Private Markets Portfolio Tracker bulk upload functionality.

## Directory Structure

### `bulk-upload/`
Excel templates for bulk data import:
- `investment_template.xlsx` - Investment data bulk upload template
- `entity_template.xlsx` - Entity/family member bulk upload template
- `cashflow_template.xlsx` - Cash flow data bulk upload template
- `nav_template.xlsx` - NAV valuation bulk upload template

### `sample-csv/`
CSV sample data and templates for testing and reference.

### `generators/`
Python scripts to generate sample/test data:
- `create_sample_data.py` - Generate comprehensive sample data
- `sample_holdings_data.py` - Generate sample holdings data

## 📁 Sample Data Files Overview

### **Entity Data**
- **File**: `sample-csv/entity_sample_template.csv`
- **Records**: 3 entities representing realistic family office structure
- **Entity Types**: Trust, LLC, Individual
- **Use Case**: Upload entities first to establish ownership structure

### **Investment Data** 
- **File**: `investment_sample_template.csv`
- **Records**: 10 diversified investments
- **Asset Classes**: Private Equity (3), Private Credit (2), Real Estate (1), Venture Capital (1), Hedge Fund (1), Real Assets (1), Cash (1)
- **Vintage Years**: 2019-2024
- **Commitment Amounts**: $5M - $25M range
- **Use Case**: Bulk upload investments after entities are created

### **NAV Data**
- **File**: `nav_sample_template.csv` 
- **Records**: 40 NAV points (4 per investment)
- **Date Range**: 2020 Q1 - 2025 Q2
- **Pattern**: Quarterly valuations showing realistic performance progression
- **Use Case**: Upload NAV updates to track investment performance over time

### **Cash Flow Data**
- **File**: `cashflow_sample_template.csv`
- **Records**: 110+ cash flow transactions
- **Flow Types**: Capital Calls, Distributions, Fees, Yield, Contributions
- **Monthly Distributions**: 5 investments with 50-100bps monthly distributions
- **Use Case**: Upload cash flows to demonstrate liquidity forecasting

## 🎯 Key Features Demonstrated

### **Realistic Family Office Structure**
- **Adams Family Trust** - Primary investment entity for illiquid investments
- **Adams Holdings LLC** - Direct investment vehicle for structured deals  
- **Robert C. Adams** - Individual principal for liquid investments

### **Diversified Investment Portfolio**
- **Private Equity**: Apollo, KKR, Tiger Global funds
- **Private Credit**: Oaktree, Carlyle credit strategies  
- **Real Estate**: Blackstone real estate partnerships
- **Infrastructure**: Brookfield infrastructure fund
- **Venture Capital**: Sequoia growth fund
- **Hedge Funds**: Citadel multi-strategy fund
- **Cash Management**: Prime brokerage cash account

### **Comprehensive Cash Flow Patterns**
- **5 investments** with regular monthly distributions (50-100bps)
- **Capital calls** for fund commitments and follow-on investments
- **Large distributions** from successful exits and realizations
- **Management fees** and performance fees
- **Interest income** from cash balances

## 📊 Performance Characteristics

### **NAV Progression Examples**
- **Apollo PE Fund**: 25M → 33.8M (+35.2% over 4 years)
- **Sequoia VC Fund**: 8M → 14.75M (+84.4% over 3 years) 
- **Oaktree Credit**: 12M → 15.9M (+32.5% over 5 years)
- **Brookfield Infrastructure**: 22M → 27.4M (+24.5% over 4 years)

### **Cash Flow Yield Examples**
- **Apollo**: ~75-100bps monthly (9-12% annual yield on called capital)
- **Blackstone RE**: ~50-100bps monthly (6-12% annual yield)
- **KKR**: ~50-100bps monthly (6-12% annual yield)
- **Oaktree**: ~50-100bps monthly (6-12% annual yield)
- **Carlyle Credit**: ~50-100bps monthly (6-12% annual yield)

## 🚀 Usage Instructions

### **Step 1: Upload Entities**
```bash
1. Use entity bulk upload template
2. Upload entity_sample_template.csv
3. Verify 3 entities created successfully
```

### **Step 2: Upload Investments**  
```bash
1. Use investment bulk upload template
2. Upload investment_sample_template.csv
3. Assign appropriate entity ownership during upload
4. Verify 10 investments created across 3 entities
```

### **Step 3: Upload NAV Data**
```bash
1. Use NAV bulk upload template  
2. Upload nav_sample_template.csv
3. Verify quarterly NAV updates for all investments
4. Check performance calculations are working
```

### **Step 4: Upload Cash Flows**
```bash
1. Use cash flow bulk upload template
2. Upload cashflow_sample_template.csv  
3. Verify cash flows imported correctly
4. Test liquidity forecasting dashboard
```

## 📈 Expected Results

After uploading all sample data, you should see:

### **Dashboard Metrics**
- **Total Commitments**: ~$162M across 10 investments
- **Total NAV**: ~$220M+ (latest valuations)
- **Net IRR**: 15-25% range across portfolio
- **TVPI**: 1.2-1.8x range showing performance progression

### **Liquidity Forecast**
- **Monthly distributions** from 5 investments providing regular cash flow
- **Upcoming capital calls** for growth investments
- **12-month forecast** showing cash flow patterns
- **Liquidity matching opportunities** between distributions and calls

### **Entity Ownership**
- **Adams Family Trust**: Primary PE/credit investments (~70% of portfolio)  
- **Adams Holdings LLC**: Direct/structured investments (~25% of portfolio)
- **Robert C. Adams**: Liquid investments and cash (~5% of portfolio)

## 🔍 Data Quality Features

### **Realistic Details**
- **Actual manager names** and fund structures
- **Realistic vintage years** and investment sizes  
- **Professional contact information** and fund terms
- **Accurate asset class categorizations**

### **Validation Testing**
- **All required fields** populated correctly
- **Enum values** match exactly with system definitions
- **Date formats** consistent (YYYY-MM-DD)
- **Numeric precision** appropriate for financial data

### **Performance Realism** 
- **J-curve patterns** in early-stage funds
- **Steady distributions** from mature investments
- **Market-appropriate returns** by asset class
- **Reasonable fee structures** (1.5-2.5% mgmt, 12.5-25% carry)

## 💡 Testing Scenarios

Use this sample data to test:

### **Bulk Upload Functionality**
- **Entity creation** with different entity types
- **Investment creation** with all 32 fields populated
- **NAV uploads** with performance tracking
- **Cash flow imports** with multiple flow types

### **Dashboard Features**
- **Portfolio summary** calculations
- **Performance metrics** (IRR, TVPI, DPI)
- **Asset allocation** charts and visualizations
- **Liquidity forecasting** with 12-month projections

### **Family Office Workflows**
- **Multi-entity ownership** structures
- **Cross-entity reporting** and consolidation  
- **Cash flow optimization** and matching
- **Investment pipeline** management

This sample data provides a comprehensive foundation for testing all family office private markets management capabilities.