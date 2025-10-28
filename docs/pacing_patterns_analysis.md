# Pacing Pattern Analysis & Comparison

**Date:** 2025-01-28 (Updated)
**Purpose:** Evaluate existing pacing patterns for consolidation opportunities

---

## Executive Summary

The system now uses **two distinct forecasting approaches**:

1. **Contract-Based Forecasting** (Loans): Uses actual contractual terms (interest rate, maturity date, payment frequency) to generate precise cash flow forecasts. **No pacing patterns needed.**

2. **Pattern-Based Forecasting** (Funds): Uses 8 pacing patterns for fund investments where cash flows are uncertain. **Consolidation recommended to 4-5 patterns.**

### Key Insight
**Loans should NOT use pacing patterns at all.** When a user creates a loan investment with:
- Interest rate (e.g., 5%)
- Maturity date (e.g., 2028-12-31)
- Payment frequency (e.g., Quarterly)

The system now calculates exact cash flows based on these contractual terms, providing **95% confidence** forecasts (vs. 68% for pattern-based forecasts).

---

## Loan-Based Forecasting (NEW)

### Contract-Based Cash Flow Calculator
**Implementation:** `pacing_model.py:349-486`
**Use Case:** Any loan with complete contractual terms
**Required Fields:**
- `investment_structure`: LOAN
- `interest_rate`: Annual interest rate (as decimal)
- `maturity_date`: Loan maturity date
- `payment_frequency`: MONTHLY | QUARTERLY | SEMI_ANNUALLY | ANNUALLY | AT_MATURITY

**How It Works:**
```python
# Example: $1,000,000 loan at 5% annual interest, quarterly payments, 5-year term
principal = 1,000,000
annual_rate = 0.05
payment_frequency = "Quarterly"  # 4 payments per year
maturity_date = "2028-12-31"

# Calculated automatically:
quarterly_interest = principal * (annual_rate / 4) = $12,500
# Quarterly payments of $12,500 for 5 years
# Final payment: $12,500 + $1,000,000 (principal)
```

**Cash Flow Generation:**
1. **Capital Call**: 100% of commitment at origination date
2. **Interest Payments**: Calculated based on payment frequency
   - Monthly: 12 payments/year
   - Quarterly: 4 payments/year
   - Semi-annually: 2 payments/year
   - Annually: 1 payment/year
   - At Maturity: 0 periodic payments (bullet)
3. **Principal Repayment**: Returned at maturity date
4. **Confidence Level**: 95% (contractual obligations are highly predictable)

**Advantages Over Patterns:**
- ✅ Precise cash flow timing (down to specific dates)
- ✅ Accurate interest calculations
- ✅ Handles different payment frequencies automatically
- ✅ No need for MOIC assumptions or pattern selection
- ✅ Higher confidence level (95% vs. 68%)

**Status:** ✅ **IMPLEMENTED** (pacing_model.py:349-486)

---

## Current Pacing Patterns (For Fund Investments)

### 1. Traditional PE
**Implementation:** `pacing_model.py:394-415`
**Use Case:** Standard private equity buyout funds
**Default MOIC:** 2.0x (Private Equity asset class)
**Fund Life:** 10 years
**Investment Period:** 4 years

**Capital Calls:**
- Distributed over investment period (typically 4 years)
- Schedule controlled by `call_schedule` parameter:
  - Front Loaded: 40%, 35%, 20%, 5%
  - Steady: 25%, 30%, 30%, 15%
  - Back Loaded: 15%, 25%, 35%, 25%

**Distributions:**
- Start after investment period
- Peak in years 6-8
- Bell curve with skew toward backend
- Timing controlled by `distribution_timing` parameter

**J-Curve:** Moderate bow factor (0.3)

---

### 2. Venture Capital
**Implementation:** `pacing_model.py:417-454`
**Use Case:** VC funds with fast deployment, long exit tail
**Default MOIC:** 2.5x (Venture Capital asset class)
**Fund Life:** 12 years
**Investment Period:** 3 years

**Capital Calls:**
- Fast deployment: 40%, 40%, 20% over 3 years
- Compressed timeline vs. traditional PE

**Distributions:**
- Long tail pattern (years 5-12)
- Start in year 5
- Exponential growth phase (years 5-7)
- Long decay tail (years 8-12)

**J-Curve:** Deep bow factor (0.4) - reflects higher risk

---

### 3. Immediate Steady Yield ⚠️ **DEPRECATED FOR LOANS**
**Implementation:** `pacing_model.py:488-517`
**Use Case:** ~~Private debt, senior loans, direct lending~~ **NOW HANDLED BY CONTRACT-BASED FORECASTING**
**Default MOIC:** 1.3x (Private Credit asset class)
**Fund Life:** 5 years
**Investment Period:** 1 year

**⚠️ STATUS**: This pattern should only be used for **credit funds** (portfolios of loans), NOT individual loans. Individual loans should use the contract-based forecasting with actual interest rate, maturity date, and payment frequency.

**Capital Calls:**
- 100% upfront deployment (year 0)
- No subsequent calls

**Distributions:**
- Steady quarterly yield payments throughout life
- Annual yield = (MOIC - 1.0) / fund_life
- Final year: yield + principal return

**J-Curve:** Shallow (0.1) - low risk profile

**Formula:**
```python
annual_yield_rate = (target_moic - 1.0) / fund_life
annual_yield_amount = commitment_amount * annual_yield_rate
# Years 0-(n-1): annual_yield_amount
# Year n: annual_yield_amount + commitment_amount (principal)
```

---

### 4. Immediate Bullet ⚠️ **DEPRECATED FOR LOANS**
**Implementation:** `pacing_model.py:519-538`
**Use Case:** ~~Bonds, structured products, term loans~~ **NOW HANDLED BY CONTRACT-BASED FORECASTING**
**Default MOIC:** 1.3x (Private Credit asset class)
**Fund Life:** 5 years
**Investment Period:** 1 year

**⚠️ STATUS**: This pattern should only be used for **bond funds or structured credit funds**, NOT individual loans or bonds. Individual instruments should use contract-based forecasting with `payment_frequency = AT_MATURITY`.

**Capital Calls:**
- 100% upfront deployment (year 0)

**Distributions:**
- No interim cash flows
- Single bullet payment at maturity
- Maturity payment = commitment_amount × MOIC

**J-Curve:** Shallow (0.1)

---

### 5. Real Estate Core
**Implementation:** Uses Traditional PE pattern with different defaults
**Use Case:** Core real estate funds, stable income properties
**Default MOIC:** 1.8x (Real Estate asset class)
**Fund Life:** 8 years
**Investment Period:** 3 years

**Capital Calls:**
- Moderate deployment over 3 years
- Similar to PE but compressed

**Distributions:**
- Steady income throughout
- Earlier start than traditional PE

**J-Curve:** Moderate (0.2)

---

### 6. Real Estate Opportunistic
**Implementation:** Uses Traditional PE pattern with different defaults
**Use Case:** Value-add, opportunistic real estate
**Default MOIC:** 1.8x (Real Estate asset class)
**Fund Life:** 8 years
**Investment Period:** 3 years

**Capital Calls:**
- Fast deployment
- Similar to Core but potentially front-loaded

**Distributions:**
- Lumpy exits (backend-heavy)
- Less predictable than Core

**J-Curve:** Moderate (0.25)

---

### 7. Credit Fund
**Implementation:** Not explicitly defined, falls back to Traditional PE
**Use Case:** Diversified credit portfolios
**Default MOIC:** 1.3x (Private Credit asset class)
**Fund Life:** 5 years
**Investment Period:** Variable

**Pattern Behavior:**
- Currently defaults to Traditional PE implementation
- Should behave more like Immediate Steady Yield

**Status:** ⚠️ **Incomplete implementation**

---

### 8. Custom
**Implementation:** User-defined parameters
**Use Case:** Non-standard structures requiring custom modeling

**Characteristics:**
- User provides all parameters manually
- No default assumptions
- Maximum flexibility

---

## Consolidation Recommendations

### Updated Pattern Structure (After Loan Implementation)

#### 1. **Loans** ✅ **NO PATTERNS NEEDED**
**Approach:** Contract-based forecasting using actual loan terms

**When to Use:**
- Investment structure = LOAN
- User provides: interest_rate, maturity_date, payment_frequency

**Implementation:**
- `generate_loan_forecast()` method (pacing_model.py:349-486)
- Calculates precise cash flows based on contractual terms
- Supports Monthly, Quarterly, Semi-annual, Annual, and Bullet payments
- 95% confidence level

**Status:** ✅ IMPLEMENTED

---

#### 2. **Credit/Debt Funds** (For future consolidation)
**Merge:** Immediate Steady Yield + Immediate Bullet + Credit Fund

**Rationale:**
- These patterns are only needed for **funds** that invest in loans/credit, not individual loans
- Individual loans now use contract-based forecasting
- Credit funds still need patterns because they're portfolios with uncertain cash flows

**Recommendation:**
- Keep "Immediate Steady Yield" for income-focused credit funds
- Keep "Immediate Bullet" for term-structured credit funds
- "Credit Fund" can use one of the above with adjusted parameters

**Priority:** MEDIUM (lower priority now that loans are handled separately)

---

#### 2. **Traditional PE** ✓ KEEP AS-IS
**No changes needed**

**Rationale:**
- Well-differentiated from other patterns
- Existing `call_schedule` and `distribution_timing` provide sufficient flexibility
- Widely used standard

---

#### 3. **Venture Capital** ✓ KEEP AS-IS
**No changes needed**

**Rationale:**
- Unique timing characteristics (fast deployment, long tail)
- Different risk/return profile
- Cannot be reasonably merged with PE pattern

---

#### 4. **Real Estate** ⭐ CONSOLIDATED
**Merge:** Real Estate Core + Real Estate Opportunistic

**Rationale:**
- Same MOIC target (1.8x)
- Same fund life (8 years)
- Both use same underlying Traditional PE mechanics
- Difference is `call_schedule` (Core = Steady, Opportunistic = Front-Loaded) and `distribution_timing` (Core = Steady/Early, Opportunistic = Backend)

**Implementation:**
- Single "Real Estate" pattern
- Users select Core vs. Opportunistic via:
  - `call_schedule`: STEADY (Core) vs. FRONT_LOADED (Opportunistic)
  - `distribution_timing`: STEADY (Core) vs. BACKEND (Opportunistic)

**Code Location:** Use existing Traditional PE pattern with Real Estate defaults

---

#### 5. **Custom** ✓ KEEP AS-IS
**No changes needed**

**Rationale:**
- Essential flexibility for non-standard structures
- Cannot be consolidated

---

## Pattern Comparison Matrix

| Pattern | MOIC | Fund Life | Inv. Period | Call Pattern | Dist Pattern | J-Curve | Asset Class Default |
|---------|------|-----------|-------------|--------------|--------------|---------|-------------------|
| **Traditional PE** | 2.0x | 10y | 4y | Gradual (4y) | Backend | 0.3 | Private Equity |
| **Venture Capital** | 2.5x | 12y | 3y | Fast (3y) | Long tail | 0.4 | Venture Capital |
| **Immediate Steady Yield** | 1.3x | 5y | 1y | 100% Y0 | Steady yield | 0.1 | Private Credit |
| **Immediate Bullet** | 1.3x | 5y | 1y | 100% Y0 | Bullet | 0.1 | Private Credit |
| **Real Estate Core** | 1.8x | 8y | 3y | Steady | Steady | 0.2 | Real Estate |
| **Real Estate Opp.** | 1.8x | 8y | 3y | Front-loaded | Backend | 0.25 | Real Estate |
| **Credit Fund** | 1.3x | 5y | Varies | Steady | Mixed | 0.1 | Private Credit |
| **Custom** | User | User | User | User | User | User | Any |

---

## Consolidation Impact

### Before: 8 Patterns
1. Traditional PE
2. Venture Capital
3. Immediate Steady Yield
4. Immediate Bullet
5. Real Estate Core
6. Real Estate Opportunistic
7. Credit Fund
8. Custom

### After: 5 Patterns
1. **Private Equity** (Traditional PE)
2. **Venture Capital** (unchanged)
3. **Credit/Debt** (consolidates ISY + IB + Credit Fund)
4. **Real Estate** (consolidates Core + Opportunistic)
5. **Custom** (unchanged)

---

## Implementation Plan

### Phase 1: Add Distribution Pattern Parameter
```python
class DistributionPattern(str, enum.Enum):
    STEADY_YIELD = "Steady Yield"      # Quarterly/annual payments
    BULLET = "Bullet"                   # Single maturity payment
    MIXED = "Mixed"                     # Blend of yield and bullet
```

### Phase 2: Consolidate Credit Patterns
**File:** `pacing_model.py`

```python
def pattern_credit_debt(self, params: PacingParameters, actuals: ActualsSummary,
                        distribution_pattern: DistributionPattern) -> Tuple[List[float], List[float]]:
    """
    Unified pattern for credit and debt instruments
    Supports: Steady yield, Bullet, Mixed distributions
    """
    calls = [0.0] * params.fund_life
    distributions = [0.0] * params.fund_life

    # Capital call in year 0
    remaining_commitment = params.commitment_amount - actuals.total_calls
    if remaining_commitment > 0:
        calls[0] = remaining_commitment

    if distribution_pattern == DistributionPattern.STEADY_YIELD:
        # Existing Immediate Steady Yield logic
        ...
    elif distribution_pattern == DistributionPattern.BULLET:
        # Existing Immediate Bullet logic
        ...
    else:  # MIXED
        # Blend: 60% steady yield, 40% bullet
        ...

    return calls, distributions
```

### Phase 3: Consolidate Real Estate Patterns
**No code changes needed** - already uses Traditional PE pattern

Update frontend dropdown:
- Remove "Real Estate Core" and "Real Estate Opportunistic"
- Add single "Real Estate" option
- Add helper text: "Use Call Schedule and Distribution Timing to configure Core vs. Opportunistic"

### Phase 4: Database Migration
```sql
-- Update existing investments to new pattern names
UPDATE investments
SET pacing_pattern = 'Credit/Debt'
WHERE pacing_pattern IN ('Immediate Steady Yield', 'Immediate Bullet', 'Credit Fund');

UPDATE investments
SET pacing_pattern = 'Real Estate'
WHERE pacing_pattern IN ('Real Estate Core', 'Real Estate Opportunistic');
```

---

## User Experience Impact

### Current UX (8 patterns)
User sees overwhelming dropdown:
```
[Select pacing pattern]
- Traditional PE
- Venture Capital
- Immediate Steady Yield
- Immediate Bullet
- Real Estate Core
- Real Estate Opportunistic
- Credit Fund
- Custom
```

### Proposed UX (5 patterns)
Simplified dropdown:
```
[Select pacing pattern]
- Private Equity
- Venture Capital
- Credit/Debt
- Real Estate
- Custom
```

**Additional controls appear conditionally:**
- Credit/Debt → Shows "Distribution Pattern" dropdown (Steady Yield | Bullet | Mixed)
- Real Estate → Highlights "Call Schedule" and "Distribution Timing" as key differentiators

---

## Risk Assessment

### Low Risk
- **Real Estate consolidation**: Already uses same underlying code
- **Frontend changes**: Simple dropdown updates

### Medium Risk
- **Credit/Debt consolidation**: Requires new unified pattern function
- **Data migration**: Need to update existing investments

### Mitigation
1. Implement new `pattern_credit_debt()` alongside existing functions
2. Test thoroughly with various MOIC targets and fund lives
3. Migration script with rollback capability
4. Deprecate old patterns gradually (6-month transition period)

---

## Recommendations

### Immediate Actions
1. ✅ Add `target_moic` field to investment form (COMPLETED)
2. ✅ Complete pattern comparison analysis (COMPLETED)
3. Implement Credit/Debt consolidation (HIGH PRIORITY)
4. Implement Real Estate consolidation (MEDIUM PRIORITY)

### Future Enhancements
1. Add `distribution_pattern` parameter for credit instruments
2. Consider additional patterns for infrastructure, secondaries
3. Machine learning to suggest optimal pattern based on asset class + strategy

---

## Appendix: Code References

### Pattern Implementations
- `ASSET_CLASS_DEFAULTS`: `pacing_model.py:16-52`
- `pattern_immediate_steady_yield()`: `pacing_model.py:342-371`
- `pattern_immediate_bullet()`: `pacing_model.py:373-392`
- `pattern_traditional_pe()`: `pacing_model.py:394-415`
- `pattern_venture_capital()`: `pacing_model.py:417-454`

### Pattern Selection Logic
- Pattern determination: `pacing_model.py:197-230`
- Scenario adjustments: `pacing_model.py:293-308`

### Related Files
- **Frontend:** `AddInvestmentModal.tsx:614-648` (pattern selector)
- **Types:** `investment.ts:64-73` (PacingPattern enum)
- **Models:** `models.py:72-81` (PacingPattern enum)
