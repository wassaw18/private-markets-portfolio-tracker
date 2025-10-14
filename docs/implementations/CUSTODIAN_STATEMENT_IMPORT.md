# Custodian Statement Import System

**Feature Status:** Planned
**Priority:** High
**Estimated Implementation:** 2-4 weeks (Phase 1)
**Last Updated:** 2025-10-06

---

## Table of Contents
1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Phased Implementation Plan](#phased-implementation-plan)
5. [Technical Specifications](#technical-specifications)
6. [API Integration Complexity](#api-integration-complexity)
7. [Database Schema](#database-schema)
8. [User Workflows](#user-workflows)
9. [Testing Strategy](#testing-strategy)
10. [Future Enhancements](#future-enhancements)

---

## Overview

Automate the import of NAV statements, capital calls, distributions, and transaction data from custodians and fund administrators through an intelligent, template-based parsing system.

### Goals
- Eliminate manual data entry for NAV updates and cash flows
- Support multiple custodians/administrators without custom parsers
- Provide reusable templates for common statement formats
- Enable community-driven template sharing

### Non-Goals (Phase 1)
- Real-time API integrations with custodians
- Automated SFTP file fetching
- PDF parsing (Phase 2+)
- OCR for scanned documents

---

## Problem Statement

### Current Pain Points
1. **Manual Data Entry:** Users manually transcribe data from PDF/Excel NAV statements
2. **Error-Prone:** Typos, incorrect dates, mismatched investments
3. **Time-Consuming:** 30+ minutes per statement for portfolios with 20+ investments
4. **Format Diversity:** Every custodian/administrator uses different formats
5. **Scale Issues:** Doesn't scale beyond small portfolios

### Target Users
- **Family Offices:** Managing 10-50 private market investments
- **RIAs:** Tracking client private market allocations
- **Fund Administrators:** Internal use for client reporting
- **Institutional Investors:** Pension funds, endowments with PE allocations

### Success Metrics
- **80% time reduction** in NAV data entry
- **<5% error rate** in automated imports
- **Support for top 10 administrators** within 6 months
- **50+ reusable templates** in community library

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                         User Upload                          │
│                  (CSV, Excel, PDF - future)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Intelligent Statement Parser                    │
│  • Auto-detect columns                                       │
│  • Apply saved templates                                     │
│  • Fuzzy matching to investments                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preview & Mapping UI                      │
│  • Show detected fields                                      │
│  • Let user confirm/adjust                                   │
│  • Save as template for reuse                               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Import Engine                        │
│  • Create/update valuations                                  │
│  • Create cash flows                                         │
│  • Update investment metrics                                │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **IntelligentStatementParser** - Core parsing engine
2. **TemplateManager** - Template storage and retrieval
3. **ColumnDetector** - Automatic column mapping
4. **DataCleaner** - Standardize formats (dates, numbers, etc.)
5. **InvestmentMatcher** - Fuzzy match fund names to database
6. **ImportEngine** - Create database records

---

## Phased Implementation Plan

### Phase 1: CSV/Excel Import with Templates (Weeks 1-2)

**Deliverables:**
- ✅ Upload CSV/Excel files
- ✅ Auto-detect column mappings
- ✅ User confirmation UI
- ✅ Save mapping templates
- ✅ Import NAV data
- ✅ Import transaction/cash flow data
- ✅ Template library (saved per tenant)

**Success Criteria:**
- Import 10 investments in <2 minutes
- 95% column auto-detection accuracy
- Zero crashes on malformed files

**Estimated Time:** 1-2 weeks
**Complexity:** Low-Medium

---

### Phase 2: Template Sharing & PDF Support (Weeks 3-6)

**Deliverables:**
- ✅ Community template library
- ✅ Template versioning
- ✅ PDF table extraction (pdfplumber)
- ✅ Basic PDF text pattern matching
- ✅ Template usage analytics

**Success Criteria:**
- 10+ public templates available
- 70% of PDFs successfully parsed

**Estimated Time:** 3-4 weeks
**Complexity:** Medium

---

### Phase 3: SFTP Automation (Months 2-3)

**Deliverables:**
- ✅ SFTP connection management
- ✅ Scheduled file fetching (Celery tasks)
- ✅ Automatic processing with saved templates
- ✅ Error notification system
- ✅ Processing queue with retry logic

**Success Criteria:**
- Daily automated imports for 80% of clients
- <5% failure rate with proper error handling

**Estimated Time:** 4-6 weeks
**Complexity:** Medium-High

---

### Phase 4: API Integrations (Months 6-12)

**Deliverables:**
- ✅ Plaid integration for cash accounts
- ✅ Direct custodian APIs (if partnerships secured)
- ✅ OAuth flow for client authorization
- ✅ Real-time sync capabilities

**Prerequisites:**
- Institutional relationships established
- Compliance requirements met
- API access approvals obtained

**Estimated Time:** 6-12 months
**Complexity:** High

---

## Technical Specifications

### Phase 1 Implementation

#### 1. Intelligent Statement Parser

**File:** `app/services/statement_parser.py`

```python
import pandas as pd
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from fuzzywuzzy import fuzz

class IntelligentStatementParser:
    """
    Core parsing engine for custodian/administrator statements
    """

    # Field patterns for auto-detection
    FIELD_PATTERNS = {
        'investment_name': [
            'fund name', 'investment name', 'fund', 'security name',
            'description', 'security', 'investment', 'portfolio name'
        ],
        'nav_date': [
            'date', 'as of', 'nav date', 'valuation date', 'report date',
            'quarter end', 'period end', 'statement date'
        ],
        'nav_value': [
            'nav', 'net asset value', 'market value', 'fair value',
            'current value', 'ending value', 'fmv', 'balance'
        ],
        'commitment': [
            'commitment', 'committed capital', 'total commitment',
            'pledge', 'subscription amount', 'committed'
        ],
        'called': [
            'called', 'funded', 'called capital', 'contributions',
            'paid in capital', 'capital called', 'contributed'
        ],
        'distributed': [
            'distributed', 'distributions', 'returned capital',
            'proceeds', 'distributions received', 'returned'
        ],
        'unfunded': [
            'unfunded', 'uncalled', 'remaining commitment',
            'undrawn', 'available'
        ]
    }

    def detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        Auto-detect which columns map to which fields

        Args:
            df: DataFrame with original column names

        Returns:
            Dictionary mapping standard field names to column names
        """
        detected = {}

        for field, patterns in self.FIELD_PATTERNS.items():
            for col in df.columns:
                col_lower = str(col).lower().strip()

                # Check for exact or partial matches
                if any(pattern in col_lower for pattern in patterns):
                    detected[field] = col
                    break

        return detected

    def parse_file(
        self,
        file_path: str,
        column_mapping: Optional[Dict[str, str]] = None
    ) -> pd.DataFrame:
        """
        Parse CSV or Excel file with optional column mapping

        Args:
            file_path: Path to file
            column_mapping: Optional predefined column mapping

        Returns:
            Standardized DataFrame
        """
        # Read file
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")

        # Auto-detect columns if no mapping provided
        if not column_mapping:
            column_mapping = self.detect_columns(df)

        # Rename columns to standard names
        reverse_mapping = {v: k for k, v in column_mapping.items()}
        df_renamed = df.rename(columns=reverse_mapping)

        # Clean and validate data
        return self.clean_data(df_renamed)

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Standardize data formats
        """
        # Clean numeric fields (remove $, commas)
        numeric_fields = [
            'nav_value', 'commitment', 'called',
            'distributed', 'unfunded'
        ]

        for field in numeric_fields:
            if field in df.columns:
                # Convert to string, remove currency symbols and commas
                df[field] = (
                    df[field]
                    .astype(str)
                    .str.replace(r'[$,£€¥]', '', regex=True)
                    .str.replace(r'[()]', '', regex=True)  # Remove parentheses
                    .str.strip()
                )

                # Convert to numeric, coerce errors to NaN
                df[field] = pd.to_numeric(df[field], errors='coerce')

        # Parse dates flexibly
        if 'nav_date' in df.columns:
            df['nav_date'] = pd.to_datetime(
                df['nav_date'],
                infer_datetime_format=True,
                errors='coerce'
            )

        # Clean investment names
        if 'investment_name' in df.columns:
            df['investment_name'] = (
                df['investment_name']
                .astype(str)
                .str.strip()
                .str.replace(r'\s+', ' ', regex=True)  # Normalize whitespace
            )

        return df

    def preview_data(
        self,
        df: pd.DataFrame,
        rows: int = 5
    ) -> Dict:
        """
        Generate preview for UI
        """
        return {
            'total_rows': len(df),
            'columns': list(df.columns),
            'preview_rows': df.head(rows).to_dict('records'),
            'data_types': df.dtypes.astype(str).to_dict()
        }


class InvestmentMatcher:
    """
    Fuzzy match fund names from statements to database
    """

    def __init__(self, db_session, tenant_id: int):
        self.db = db_session
        self.tenant_id = tenant_id

        # Load all investments for this tenant
        self.investments = (
            self.db.query(Investment)
            .filter(Investment.tenant_id == tenant_id)
            .all()
        )

        self.investment_names = {
            inv.id: inv.name for inv in self.investments
        }

    def match_investment(
        self,
        statement_name: str,
        threshold: int = 85
    ) -> Optional[Tuple[int, str, int]]:
        """
        Find best matching investment

        Args:
            statement_name: Name from statement
            threshold: Minimum match score (0-100)

        Returns:
            Tuple of (investment_id, matched_name, score) or None
        """
        best_match = None
        best_score = 0

        for inv_id, inv_name in self.investment_names.items():
            # Calculate fuzzy match score
            score = fuzz.token_sort_ratio(
                statement_name.lower(),
                inv_name.lower()
            )

            if score > best_score and score >= threshold:
                best_score = score
                best_match = (inv_id, inv_name, score)

        return best_match

    def match_all(
        self,
        df: pd.DataFrame,
        threshold: int = 85
    ) -> pd.DataFrame:
        """
        Add matched investment IDs to dataframe
        """
        matches = []

        for idx, row in df.iterrows():
            statement_name = row.get('investment_name', '')
            match = self.match_investment(statement_name, threshold)

            if match:
                matches.append({
                    'investment_id': match[0],
                    'matched_name': match[1],
                    'match_score': match[2],
                    'statement_name': statement_name
                })
            else:
                matches.append({
                    'investment_id': None,
                    'matched_name': None,
                    'match_score': 0,
                    'statement_name': statement_name
                })

        # Add to dataframe
        match_df = pd.DataFrame(matches)
        return pd.concat([df, match_df], axis=1)


class DataImporter:
    """
    Import parsed data into database
    """

    def __init__(self, db_session, tenant_id: int, user_id: int):
        self.db = db_session
        self.tenant_id = tenant_id
        self.user_id = user_id

    def import_nav_data(
        self,
        df: pd.DataFrame
    ) -> Dict[str, int]:
        """
        Import NAV valuations from dataframe

        Returns:
            Statistics about import
        """
        stats = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': []
        }

        for idx, row in df.iterrows():
            try:
                investment_id = row.get('investment_id')
                nav_date = row.get('nav_date')
                nav_value = row.get('nav_value')

                # Skip if missing required fields
                if not investment_id or pd.isna(nav_date) or pd.isna(nav_value):
                    stats['skipped'] += 1
                    continue

                # Check if valuation exists
                existing = (
                    self.db.query(Valuation)
                    .filter(
                        Valuation.investment_id == investment_id,
                        Valuation.date == nav_date
                    )
                    .first()
                )

                if existing:
                    # Update existing
                    existing.nav_value = nav_value
                    existing.updated_by_user_id = self.user_id
                    stats['updated'] += 1
                else:
                    # Create new
                    valuation = Valuation(
                        investment_id=investment_id,
                        date=nav_date,
                        nav_value=nav_value,
                        tenant_id=self.tenant_id,
                        created_by_user_id=self.user_id,
                        updated_by_user_id=self.user_id
                    )
                    self.db.add(valuation)
                    stats['created'] += 1

            except Exception as e:
                stats['errors'].append({
                    'row': idx,
                    'error': str(e),
                    'data': row.to_dict()
                })

        # Commit all changes
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise Exception(f"Import failed: {str(e)}")

        return stats

    def import_cash_flows(
        self,
        df: pd.DataFrame
    ) -> Dict[str, int]:
        """
        Import cash flow transactions from dataframe
        """
        # Similar implementation for cash flows
        pass
```

---

#### 2. Template Management

**File:** `app/models.py` (additions)

```python
class StatementTemplate(Base):
    """
    Saved column mapping templates for reuse
    """
    __tablename__ = 'statement_templates'

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)

    # Template metadata
    name = Column(String(200), nullable=False)
    description = Column(Text)
    provider = Column(String(100))  # "UMB Fund Services", "Opus", etc.
    statement_type = Column(String(50))  # "NAV", "Capital Call", "Distribution"
    file_format = Column(String(10))  # "CSV", "XLSX", "PDF"

    # Column mapping (JSON)
    column_mapping = Column(JSON, nullable=False)
    # Example: {"Fund Name": "investment_name", "NAV 3/31/25": "nav_value"}

    # Sharing
    is_public = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)

    # Audit
    created_by_user_id = Column(Integer, ForeignKey('users.id'))
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_tenant_template_name'),
        Index('ix_template_provider_type', 'provider', 'statement_type'),
    )


class ImportHistory(Base):
    """
    Track import jobs for audit and debugging
    """
    __tablename__ = 'import_history'

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)

    # Import details
    filename = Column(String(500))
    file_size = Column(Integer)
    template_id = Column(Integer, ForeignKey('statement_templates.id'), nullable=True)
    statement_type = Column(String(50))

    # Results
    status = Column(String(20))  # "success", "partial", "failed"
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_skipped = Column(Integer, default=0)
    error_log = Column(JSON)  # List of errors

    # Audit
    imported_by_user_id = Column(Integer, ForeignKey('users.id'))
    import_date = Column(DateTime, default=datetime.utcnow)

    Index('ix_import_tenant_date', 'tenant_id', 'import_date')
```

---

#### 3. API Endpoints

**File:** `app/routers/statement_import.py`

```python
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import tempfile
import os

from app.database import get_db
from app.auth import get_current_user
from app.services.statement_parser import (
    IntelligentStatementParser,
    InvestmentMatcher,
    DataImporter
)
from app.models import User, StatementTemplate, ImportHistory

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/detect-columns")
async def detect_columns(
    file: UploadFile = File(...),
    template_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 1: Upload file and detect column mappings
    """
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parser = IntelligentStatementParser()

        # Load template if provided
        column_mapping = None
        if template_id:
            template = db.query(StatementTemplate).filter(
                StatementTemplate.id == template_id,
                StatementTemplate.tenant_id == current_user.tenant_id
            ).first()

            if template:
                column_mapping = template.column_mapping

        # Parse file
        df = parser.parse_file(tmp_path, column_mapping)

        # Auto-detect if no template
        if not column_mapping:
            column_mapping = parser.detect_columns(df)

        # Match investments
        matcher = InvestmentMatcher(db, current_user.tenant_id)
        df_matched = matcher.match_all(df)

        # Generate preview
        preview = parser.preview_data(df_matched, rows=10)

        return {
            "detected_mapping": column_mapping,
            "preview": preview,
            "total_rows": len(df),
            "matched_count": df_matched['investment_id'].notna().sum(),
            "unmatched_count": df_matched['investment_id'].isna().sum()
        }

    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/confirm")
async def confirm_import(
    file: UploadFile = File(...),
    column_mapping: dict,
    statement_type: str,  # "nav" or "cash_flows"
    save_as_template: bool = False,
    template_name: Optional[str] = None,
    template_provider: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 2: User confirms mapping and imports data
    """
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Parse with confirmed mapping
        parser = IntelligentStatementParser()
        df = parser.parse_file(tmp_path, column_mapping)

        # Match investments
        matcher = InvestmentMatcher(db, current_user.tenant_id)
        df_matched = matcher.match_all(df)

        # Import data
        importer = DataImporter(db, current_user.tenant_id, current_user.id)

        if statement_type == "nav":
            stats = importer.import_nav_data(df_matched)
        elif statement_type == "cash_flows":
            stats = importer.import_cash_flows(df_matched)
        else:
            raise HTTPException(400, "Invalid statement_type")

        # Save template if requested
        template_id = None
        if save_as_template and template_name:
            template = StatementTemplate(
                tenant_id=current_user.tenant_id,
                name=template_name,
                provider=template_provider,
                statement_type=statement_type,
                file_format=file.filename.split('.')[-1].upper(),
                column_mapping=column_mapping,
                created_by_user_id=current_user.id
            )
            db.add(template)
            db.flush()
            template_id = template.id

        # Log import
        import_log = ImportHistory(
            tenant_id=current_user.tenant_id,
            filename=file.filename,
            file_size=len(content),
            template_id=template_id,
            statement_type=statement_type,
            status="success" if not stats['errors'] else "partial",
            records_processed=len(df),
            records_created=stats['created'],
            records_updated=stats['updated'],
            records_skipped=stats['skipped'],
            error_log=stats.get('errors'),
            imported_by_user_id=current_user.id
        )
        db.add(import_log)
        db.commit()

        return {
            "success": True,
            "stats": stats,
            "template_saved": save_as_template
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Import failed: {str(e)}")

    finally:
        os.unlink(tmp_path)


@router.get("/templates")
async def list_templates(
    include_public: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List available templates
    """
    query = db.query(StatementTemplate)

    # Get user's own templates
    user_templates = query.filter(
        StatementTemplate.tenant_id == current_user.tenant_id
    ).all()

    # Get public templates
    public_templates = []
    if include_public:
        public_templates = query.filter(
            StatementTemplate.is_public == True
        ).all()

    return {
        "user_templates": user_templates,
        "public_templates": public_templates
    }


@router.get("/history")
async def import_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get import history
    """
    history = (
        db.query(ImportHistory)
        .filter(ImportHistory.tenant_id == current_user.tenant_id)
        .order_by(ImportHistory.import_date.desc())
        .limit(limit)
        .all()
    )

    return history
```

---

## API Integration Complexity

### Difficulty Assessment by Provider

| Provider | API Availability | Difficulty | Access Requirements | Timeline |
|----------|-----------------|------------|-------------------|----------|
| **Schwab** | ✅ Trading API | Medium | RIA or broker relationship | 3-6 months |
| **Fidelity** | ⚠️ IWS (limited) | High | Institutional client ($10M+ AUM) | 6-12 months |
| **Pershing** | ✅ NetX360 | Medium-High | Must custody at Pershing | 6-12 months |
| **UMB** | ❌ No public API | N/A | SFTP only | 1-2 months |
| **Opus** | ❌ Portal only | N/A | Manual download | N/A |
| **Plaid** | ✅ Public API | Low | Just sign up | 2-4 weeks |
| **Addepar** | ✅ API | Medium | Client must use Addepar | 2-3 months |

### Why File Import is Better to Start

1. **No API Access Required** - Works immediately
2. **User Controls Timing** - Not dependent on API availability
3. **Covers 100% of Cases** - Every provider gives you files
4. **Low Maintenance** - Template-based approach scales
5. **Compliance Light** - No credential storage in Phase 1

### When to Consider APIs

- **50+ active clients** using the same custodian
- **Formal partnership** with custodian/administrator
- **Compliance infrastructure** in place (SOC 2, etc.)
- **Engineering resources** for ongoing API maintenance

---

## Database Schema

### New Tables

```sql
-- Statement templates
CREATE TABLE statement_templates (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    provider VARCHAR(100),
    statement_type VARCHAR(50),
    file_format VARCHAR(10),
    column_mapping JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_by_user_id INTEGER REFERENCES users(id),
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_tenant_template_name UNIQUE (tenant_id, name)
);

CREATE INDEX ix_template_provider_type ON statement_templates(provider, statement_type);

-- Import history
CREATE TABLE import_history (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    filename VARCHAR(500),
    file_size INTEGER,
    template_id INTEGER REFERENCES statement_templates(id),
    statement_type VARCHAR(50),
    status VARCHAR(20),
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    error_log JSONB,
    imported_by_user_id INTEGER REFERENCES users(id),
    import_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_import_tenant_date ON import_history(tenant_id, import_date);
```

---

## User Workflows

### Workflow 1: First-Time Import

```
1. User uploads UMB NAV statement (CSV)
   ↓
2. System auto-detects columns:
   "Fund Name" → investment_name ✓
   "NAV 3/31/25" → nav_value ✓
   "Commitment" → commitment ✓
   ↓
3. System matches fund names:
   "Apollo Fund VIII" → Apollo PE Fund VIII (95% match)
   "KKR Infrastructure" → KKR Global Infrastructure (88% match)
   ↓
4. User reviews preview:
   - Confirms matches
   - Manually maps unmatched (if any)
   - Adjusts column mappings if needed
   ↓
5. User saves as "UMB NAV Statement" template
   ↓
6. System imports data:
   ✓ 12 valuations created
   ✓ 3 valuations updated
   ✓ 2 skipped (missing data)
```

### Workflow 2: Subsequent Import (Same Format)

```
1. User uploads new UMB NAV statement
   ↓
2. User selects "UMB NAV Statement" template
   ↓
3. System applies saved mapping automatically
   ↓
4. User clicks "Import" (no review needed)
   ↓
5. Done in 30 seconds!
```

### Workflow 3: Template Sharing

```
1. Admin creates "UMB NAV Statement" template
   ↓
2. Admin marks as "Public"
   ↓
3. All other users see template in community library
   ↓
4. User B uploads UMB statement → Uses admin's template
   ↓
5. Template usage_count increments
```

---

## Testing Strategy

### Unit Tests

```python
# test_statement_parser.py

def test_column_detection():
    """Test auto-detection of column mappings"""
    parser = IntelligentStatementParser()

    # Mock dataframe with common column names
    df = pd.DataFrame({
        'Fund Name': ['Apollo Fund'],
        'NAV 3/31/25': [5100000],
        'Commitment': [5000000]
    })

    mapping = parser.detect_columns(df)

    assert mapping['investment_name'] == 'Fund Name'
    assert mapping['nav_value'] == 'NAV 3/31/25'
    assert mapping['commitment'] == 'Commitment'


def test_data_cleaning():
    """Test numeric cleaning"""
    parser = IntelligentStatementParser()

    df = pd.DataFrame({
        'nav_value': ['$5,100,000', '12,400,000', '(250,000)']
    })

    cleaned = parser.clean_data(df)

    assert cleaned['nav_value'][0] == 5100000
    assert cleaned['nav_value'][1] == 12400000
    assert cleaned['nav_value'][2] == -250000  # Parentheses = negative


def test_investment_matching():
    """Test fuzzy matching"""
    # Mock database with known investments
    matcher = InvestmentMatcher(mock_db, tenant_id=1)

    match = matcher.match_investment("Apollo Fund VIII LP")

    assert match[0] == 1  # investment_id
    assert match[2] > 85  # match score > threshold
```

### Integration Tests

```python
# test_import_api.py

def test_full_import_workflow(client, test_user, test_db):
    """Test complete import flow"""

    # 1. Upload file
    with open('test_data/umb_nav_sample.csv', 'rb') as f:
        response = client.post(
            "/api/import/detect-columns",
            files={"file": f},
            headers={"Authorization": f"Bearer {test_user.token}"}
        )

    assert response.status_code == 200
    data = response.json()
    assert 'detected_mapping' in data

    # 2. Confirm import
    with open('test_data/umb_nav_sample.csv', 'rb') as f:
        response = client.post(
            "/api/import/confirm",
            files={"file": f},
            json={
                "column_mapping": data['detected_mapping'],
                "statement_type": "nav",
                "save_as_template": True,
                "template_name": "Test Template"
            },
            headers={"Authorization": f"Bearer {test_user.token}"}
        )

    assert response.status_code == 200
    result = response.json()
    assert result['success'] == True
    assert result['stats']['created'] > 0
```

### Sample Test Data

Create realistic test files:

**`test_data/umb_nav_sample.csv`:**
```csv
Fund Name,NAV Date,Net Asset Value,Total Commitment,Called Capital,Distributions
Apollo Fund VIII LP,3/31/2025,$5100000,$5000000,$5000000,$250000
KKR Infrastructure Fund,3/31/2025,$12400000,$12000000,$10000000,$500000
Blackstone Real Estate,3/31/2025,$8200000,$8000000,$7500000,$300000
```

**`test_data/opus_capital_call.xlsx`:**
| Investment Name | Call Date | Call Amount | Due Date | Purpose |
|----------------|-----------|-------------|----------|---------|
| Sequoia VC Fund | 4/15/2025 | $2,000,000 | 4/30/2025 | Follow-on Investment |

---

## Future Enhancements

### Phase 2: PDF Support
- Extract tables from PDFs using pdfplumber
- OCR for scanned documents (Tesseract)
- Pattern-based text extraction for unstructured PDFs
- Template customization for PDF layouts

### Phase 3: SFTP Automation
- Scheduled jobs to fetch files from administrator SFTP
- Automatic processing with saved templates
- Error notifications and retry logic
- File deduplication

### Phase 4: Real-Time APIs
- Plaid integration for cash accounts
- Direct custodian APIs (requires partnerships)
- OAuth flows for client authorization
- Webhook support for push notifications

### Phase 5: AI/ML Enhancements
- Machine learning for better column detection
- Natural language processing for unstructured data
- Automatic categorization of transactions
- Anomaly detection for data validation

### Phase 6: Bulk Operations
- Import multiple statements at once
- Batch processing queue
- Progress tracking dashboard
- Rollback capabilities

---

## Dependencies

### Python Packages
```txt
pandas>=2.0.0          # Data manipulation
openpyxl>=3.1.0        # Excel file support
fuzzywuzzy>=0.18.0     # Fuzzy string matching
python-Levenshtein>=0.20.0  # Speed up fuzzy matching
pdfplumber>=0.9.0      # PDF table extraction (Phase 2)
celery>=5.3.0          # Background tasks (Phase 3)
```

### Installation
```bash
pip install pandas openpyxl fuzzywuzzy python-Levenshtein
```

---

## Success Metrics

### Phase 1 (CSV/Excel)
- ✅ 80% reduction in NAV data entry time
- ✅ <5% error rate in imports
- ✅ 95% column auto-detection accuracy
- ✅ 10+ saved templates per client

### Phase 2 (PDF + Sharing)
- ✅ 70% of PDFs successfully parsed
- ✅ 50+ public templates in library
- ✅ 90% of imports use templates (vs manual mapping)

### Phase 3 (SFTP)
- ✅ 80% of clients automated
- ✅ Daily automated imports
- ✅ <5% failure rate

---

## Questions & Decisions Needed

### Before Starting
- [ ] Which statement types to prioritize? (NAV, capital calls, distributions)
- [ ] Should templates be tenant-specific or system-wide by default?
- [ ] File size limits? (Recommend: 10MB max for Phase 1)
- [ ] How long to keep import history? (Recommend: 12 months)

### During Development
- [ ] Should we support multi-sheet Excel files?
- [ ] How to handle currency conversions?
- [ ] Should users be able to edit imported data immediately?
- [ ] Preview UI: show all rows or just first 10?

### Before Launch
- [ ] What permissions needed for import feature?
- [ ] Should we track which user created public templates?
- [ ] Error notification strategy (email? in-app only?)

---

## Related Documentation
- [Bulk Upload Feature](./BULK_UPLOAD_SYSTEM.md)
- [Investment Data Model](../INVESTMENT_DATA_MODEL.md)
- [Multi-Tenant Security](../MULTI_TENANT_SECURITY.md)

---

**Document Maintainer:** Development Team
**Next Review Date:** After Phase 1 completion
