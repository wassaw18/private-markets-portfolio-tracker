# Performance Grade Calculation Methodology
**Private Markets Portfolio Tracker - Internal Documentation**

## Overview
The Performance Grade is a composite score designed to provide users with an at-a-glance assessment of investment and portfolio performance quality. This methodology combines multiple quantitative metrics to create a single, intuitive grade.

## Core Methodology

### 1. Performance Metrics Calculated

#### **IRR (Internal Rate of Return)**
- **Method**: Newton-Raphson iterative calculation
- **Formula**: NPV = Σ(CFₜ / (1 + r)^t) = 0
- **Cash Flow Treatment**:
  - Capital Calls/Contributions: Negative outflows
  - Distributions: Positive inflows  
  - Current NAV: Positive inflow at latest valuation date
- **Convergence**: 1e-6 tolerance, max 1000 iterations
- **Bounds**: -99% to +1000% annual return
- **Failure Cases**: Returns `None` if unable to converge

#### **TVPI (Total Value to Paid-In)**
- **Formula**: TVPI = (Current NAV + Total Distributions) / Total Contributions
- **Components**:
  - Current NAV: Latest valuation amount
  - Total Distributions: Sum of all distribution cash flows
  - Total Contributions: Sum of all contribution cash flows

#### **DPI (Distributions to Paid-In)**
- **Formula**: DPI = Total Distributions / Total Contributions
- **Measures**: Cash returned to investors as percentage of invested capital

#### **RVPI (Residual Value to Paid-In)**
- **Formula**: RVPI = Current NAV / Total Contributions  
- **Measures**: Unrealized value remaining as percentage of invested capital

## 2. Performance Grade Algorithm

### **Grade Calculation Logic**
```
Performance Grade = Weighted Average of:
- IRR Score (40% weight)
- TVPI Score (35% weight) 
- Risk-Adjusted Score (15% weight)
- Vintage Adjustment (10% weight)
```

### **IRR Score (40% weighting)**
| IRR Range | Score | Grade Letter | Description |
|-----------|-------|--------------|-------------|
| ≥ 25% | 95-100 | A+ | Exceptional |
| 20-24.9% | 85-94 | A | Excellent |
| 15-19.9% | 75-84 | B+ | Very Good |
| 10-14.9% | 65-74 | B | Good |
| 5-9.9% | 55-64 | C+ | Satisfactory |
| 0-4.9% | 45-54 | C | Fair |
| -5-0% | 35-44 | D+ | Below Average |
| < -5% | 0-34 | F | Poor |

### **TVPI Score (35% weighting)**
| TVPI Range | Score | Description |
|------------|-------|-------------|
| ≥ 3.0x | 95-100 | Outstanding multiple |
| 2.5-2.99x | 85-94 | Excellent multiple |
| 2.0-2.49x | 75-84 | Very good multiple |
| 1.5-1.99x | 65-74 | Good multiple |
| 1.2-1.49x | 55-64 | Acceptable multiple |
| 1.0-1.19x | 45-54 | Break-even range |
| 0.8-0.99x | 35-44 | Below break-even |
| < 0.8x | 0-34 | Significant loss |

### **Risk-Adjusted Score (15% weighting)**
Adjusts performance based on investment characteristics:

**Asset Class Adjustments**:
- Private Equity: Baseline (no adjustment)
- Venture Capital: +5% (higher risk tolerance)
- Private Credit: -3% (lower risk expectation)  
- Real Estate: -2% (stable asset class)
- Infrastructure: -2% (stable, regulated returns)

**Structure Adjustments**:
- Direct Investment: +3% (higher risk)
- Co-Investment: +2% (moderate additional risk)
- Fund of Funds: -2% (diversified, lower volatility)

### **Vintage Adjustment (10% weighting)**
Accounts for market conditions during investment vintage year:

**Market Environment Scoring**:
- **Hot Markets** (high valuations): -5% adjustment
- **Normal Markets**: No adjustment
- **Distressed Markets** (crisis periods): +5% adjustment

**Vintage Year Classifications**:
- 2007-2008: Distressed (+5%)
- 2009-2011: Recovery (0%)
- 2012-2019: Hot Market (-5%)
- 2020-2021: Crisis/Recovery (+3%)
- 2022+: Normalization (0%)

## 3. Portfolio-Level Grading

### **Weighted Average Calculation**
```
Portfolio Grade = Σ(Investment Grade × Investment Weight)
Weight = Investment Total Value / Portfolio Total Value
```

### **Portfolio Adjustments**
- **Diversification Bonus**: +2% for >15 investments across ≥3 asset classes
- **Concentration Penalty**: -3% if any single investment >25% of portfolio
- **Liquidity Penalty**: -1% for each 10% of portfolio in investments >7 years old

## 4. Grade Display

### **Letter Grade Mapping**
| Score Range | Letter | Color | Description |
|-------------|---------|-------|-------------|
| 90-100 | A+ | Dark Green | Outstanding |
| 85-89 | A | Green | Excellent |
| 80-84 | A- | Light Green | Very Good |
| 75-79 | B+ | Yellow-Green | Good |
| 70-74 | B | Yellow | Satisfactory |
| 65-69 | B- | Orange | Fair |
| 60-64 | C+ | Light Orange | Below Average |
| 55-59 | C | Red-Orange | Poor |
| <55 | F | Red | Failing |

### **Additional Indicators**
- **Trend Arrow**: ↗️ Improving, ➡️ Stable, ↘️ Declining (based on last 4 quarters)
- **Confidence Level**: High/Medium/Low (based on data completeness and investment maturity)

## 5. Data Requirements

### **Minimum Data for Grading**
- At least 2 cash flow events (1 contribution + 1 distribution OR current NAV)
- Investment age ≥ 12 months
- Current NAV or distribution within last 12 months

### **Data Quality Impact**
- **Complete Data** (all cash flows + recent NAV): Full grade calculation
- **Partial Data** (missing recent NAV): Reduced confidence, limited to DPI-based scoring
- **Insufficient Data**: Grade marked as "Pending" with explanation

## 6. Limitations and Disclaimers

### **Important Notes**
1. **Not Investment Advice**: Grades are analytical tools only
2. **Historical Performance**: Past performance does not predict future results
3. **Data Dependent**: Accuracy depends on complete and accurate cash flow data
4. **Market Context**: Grades should be considered within broader market context
5. **Vintage Bias**: Newer investments may be disadvantaged due to J-curve effect

### **Best Practices for Users**
- Consider grades alongside absolute returns and market context
- Review individual metrics (IRR, TVPI, DPI) for complete picture
- Account for investment lifecycle stage and strategy-specific factors
- Use for portfolio construction and performance monitoring, not as sole decision criteria

---

**Document Version**: 1.0  
**Last Updated**: {{ current_date }}  
**Prepared By**: Private Markets Portfolio Tracker Development Team  
**Classification**: Internal Use Only