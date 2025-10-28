# Pacing Model Pattern Selector - Implementation Roadmap

## Status: Backend Complete ✅ | Frontend Pending 📋

---

## Completed Backend Work ✅

### 1. Pattern-Based System
- **Added PacingPattern enum** with 8 patterns:
  - Traditional PE
  - Venture Capital
  - Immediate Steady Yield (for private debt)
  - Immediate Bullet (for bonds)
  - Real Estate Core
  - Real Estate Opportunistic
  - Credit Fund
  - Custom

### 2. Asset Class Defaults with MOIC Targets
- **Private Credit**: 1.3x MOIC → IMMEDIATE_STEADY_YIELD
- **Private Equity**: 2.0x MOIC → TRADITIONAL_PE
- **Real Estate**: 1.8x MOIC → REAL_ESTATE_CORE
- **Venture Capital**: 2.5x MOIC → VENTURE_CAPITAL
- **Real Assets**: 1.8x MOIC → REAL_ESTATE_CORE

### 3. Pattern Generators
- `pattern_immediate_steady_yield()` - Upfront call, quarterly yields, principal at maturity
- `pattern_immediate_bullet()` - Upfront call, bullet payment at maturity
- `pattern_traditional_pe()` - 4-year calls, backend distributions
- `pattern_venture_capital()` - Fast deployment, long tail distributions

### 4. Actual Cash Flow Reconciliation
- Queries historical cash flows
- Compares with forecasted amounts
- Adjusts future forecasts based on what's already happened
- Zeros out past forecasts (actuals shown separately)

### 5. Database Migration
- Added `pacing_pattern` column to investments table
- Created PacingPattern ENUM type in PostgreSQL

---

## Frontend Implementation Plan 📋

### Location: Individual Investment Page
**File**: `/frontend/src/components/PacingModelPanel.tsx` (Line 285 in InvestmentDetails.tsx)

### User Experience Design

#### Phase 1: Pattern Selector in Pacing Model Section

**Display Logic:**
```
┌─────────────────────────────────────────────────────────┐
│ 📊 Cash Flow Pacing Model                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Current Pattern: [Immediate Steady Yield] 🔹 (Default)  │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Based on your asset class (Private Credit),      │   │
│ │ this investment uses the "Immediate Steady       │   │
│ │ Yield" pattern with a 1.3x MOIC target.         │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ [Change Pattern ▼]  [Customize Parameters]             │
│                                                          │
│ ┌─ Pattern Dropdown (when clicked) ───────────────┐   │
│ │ • Immediate Steady Yield (Current)               │   │
│ │ • Immediate Bullet                               │   │
│ │ • Traditional PE                                 │   │
│ │ • Venture Capital                                │   │
│ │ • Real Estate Core                               │   │
│ │ • Real Estate Opportunistic                      │   │
│ │ • Credit Fund                                    │   │
│ │ • Custom (Advanced)                              │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ Current Parameters:                                      │
│ • Target MOIC: 1.3x                                     │
│ • Fund Life: 5 years                                    │
│ • Investment Period: 1 year                             │
│ • Bow Factor: 0.1                                       │
│                                                          │
│ [Customize Parameters] opens modal ↓                    │
└─────────────────────────────────────────────────────────┘
```

#### Phase 2: Parameter Customization Modal

**Triggered by**: "Customize Parameters" button

```
┌─────────────────────────────────────────────────────────┐
│ ✏️  Customize Pacing Model Parameters                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Pattern: [Immediate Steady Yield ▼]                     │
│                                                          │
│ Financial Targets:                                       │
│ • Target MOIC:            [1.3x        ]                │
│ • Target IRR:             [15%         ]                │
│                                                          │
│ Investment Timeline:                                     │
│ • Fund Life (years):      [5           ]                │
│ • Investment Period:      [1           ]                │
│                                                          │
│ Model Parameters:                                        │
│ • Bow Factor (J-curve):   [0.1         ] (0.1-0.5)     │
│ • Call Schedule:          [Steady ▼    ]                │
│ • Distribution Timing:    [Backend ▼   ]                │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ℹ️  Preview: With these settings, forecasts will:  │   │
│ │ • 100% capital call in year 1                     │   │
│ │ • Quarterly yield payments of ~$X,XXX             │   │
│ │ • Principal return of $XXX,XXX in year 5         │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ [Cancel]  [Reset to Default]  [Save & Generate Forecast]│
└─────────────────────────────────────────────────────────┘
```

### Implementation Tasks

#### Backend API Updates
1. **Add pattern field to Investment schema** (`app/schemas.py`)
   ```python
   class InvestmentBase(BaseModel):
       # ... existing fields ...
       pacing_pattern: Optional[PacingPattern] = None
   ```

2. **Update Investment endpoints** to accept/return pacing_pattern

3. **Create pattern description endpoint** (optional)
   ```python
   @router.get("/pacing-patterns/{pattern}")
   def get_pattern_description(pattern: PacingPattern):
       """Return description and default parameters for a pattern"""
   ```

#### Frontend Components

1. **Update PacingModelPanel.tsx**
   - Add pattern selector dropdown
   - Show current pattern with visual indicator
   - Display "Default" badge if using asset class default
   - Show current parameters in read-only view
   - Add "Customize Parameters" button

2. **Create PatternCustomizationModal.tsx**
   - Pattern dropdown
   - Parameter input fields
   - Real-time preview of forecast behavior
   - Save/Cancel/Reset buttons
   - Validation for parameter ranges

3. **Update Investment TypeScript types**
   ```typescript
   export interface Investment {
     // ... existing fields ...
     pacing_pattern?: PacingPattern;
   }

   export enum PacingPattern {
     TRADITIONAL_PE = "Traditional PE",
     VENTURE_CAPITAL = "Venture Capital",
     IMMEDIATE_STEADY_YIELD = "Immediate Steady Yield",
     IMMEDIATE_BULLET = "Immediate Bullet",
     REAL_ESTATE_CORE = "Real Estate Core",
     REAL_ESTATE_OPPORTUNISTIC = "Real Estate Opportunistic",
     CREDIT_FUND = "Credit Fund",
     CUSTOM = "Custom"
   }
   ```

4. **Add pattern descriptions** (constants or from API)
   ```typescript
   const PATTERN_DESCRIPTIONS = {
     [PacingPattern.IMMEDIATE_STEADY_YIELD]: {
       title: "Immediate Steady Yield",
       description: "100% capital call upfront, steady quarterly yield payments, principal at maturity",
       bestFor: "Private debt, loans, bonds with regular interest",
       defaultMOIC: 1.3
     },
     // ... etc
   };
   ```

### Testing Plan

1. **Test with SV Financing 12% Note**
   - Should default to IMMEDIATE_STEADY_YIELD pattern
   - 1.3x MOIC target
   - Verify quarterly yield calculations

2. **Test Pattern Switching**
   - Switch from default to custom pattern
   - Verify forecast regeneration
   - Check that actuals are preserved

3. **Test Parameter Customization**
   - Adjust MOIC target
   - Modify fund life
   - Verify preview calculations

---

## Future Enhancement: Smart Create Investment Modal 🔮

### Concept: Dynamic Form Based on Asset Class & Structure

**Current State**: All fields visible at once → overwhelming

**Proposed State**: Progressive disclosure based on selections

```
┌─────────────────────────────────────────────────────────┐
│ Create New Investment                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Step 1: Basic Information (Always Visible)              │
│ • Investment Name:        [________________]            │
│ • Owner Entity:           [Select Entity ▼ ]            │
│                                                          │
│ Step 2: Classification (Triggers Field Visibility)      │
│ • Asset Class:            [Private Credit ▼]            │
│ • Structure:              [Direct Investment ▼]         │
│                                                          │
│ ─────────────────────────────────────────────────────   │
│                                                          │
│ Relevant Fields Appear Below ↓                          │
│ (Based on Private Credit + Direct Investment)           │
│                                                          │
│ Financial Terms:                                         │
│ • Commitment Amount:      [________________]            │
│ • Interest Rate:          [_____%          ]  ← NEW     │
│ • Maturity Date:          [MM/DD/YYYY      ]  ← NEW     │
│ • Payment Frequency:      [Quarterly ▼     ]  ← NEW     │
│                                                          │
│ Pacing Model (Auto-Selected):                           │
│ • Pattern: Immediate Steady Yield (default for debt)    │
│   [Customize]                                           │
│                                                          │
│ [Cancel]                          [Create Investment]   │
└─────────────────────────────────────────────────────────┘
```

### Field Visibility Matrix (To Be Designed)

| Asset Class      | Structure           | Show Fields                                    |
|------------------|---------------------|------------------------------------------------|
| Private Credit   | Direct/Loan         | Interest Rate, Maturity, Payment Frequency     |
| Private Equity   | LP/Co-Invest        | Investment Period, Fund Life, GP/LP Split      |
| Real Estate      | Direct              | Property Type, Acquisition Date, Exit Strategy |
| Venture Capital  | Fund                | Stage Focus, Investment Period, Follow-on %    |

### Benefits
1. **Reduces Overwhelm**: Only see relevant fields
2. **Improves Data Quality**: Contextual fields encourage complete information
3. **Smart Defaults**: Auto-select appropriate pacing pattern
4. **Guided Experience**: Helps users understand what's needed

### Implementation Approach
- Create field visibility rules engine
- Map asset class + structure → required/optional fields
- Pre-populate pacing model pattern based on selection
- Allow override of auto-selected pattern

---

## Notes

- **Priority**: Pattern selector in PacingModelPanel (Phase 1)
- **Secondary**: Parameter customization modal (Phase 2)
- **Future**: Smart create modal (separate epic)

## Decision Log

1. **Why in Individual Investment Page?**
   - Users aren't overwhelmed during initial investment creation
   - Can see cash flows and performance before adjusting model
   - Natural place to review and refine forecasts

2. **Why Show Default Pattern?**
   - Transparency about where settings come from
   - Users can trust the system's intelligent defaults
   - Clear indicator when using custom vs. default

3. **Why Asset Class Defaults?**
   - 80% of investments follow typical patterns
   - Reduces manual configuration burden
   - Can always override when needed
