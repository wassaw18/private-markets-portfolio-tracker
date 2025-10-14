# Investment Deletion Strategy

**Feature:** Soft Delete with Archive Flag
**Priority:** High (Data Integrity)
**Status:** Needs Implementation
**Last Updated:** 2025-10-06

---

## Problem Statement

### Current Behavior
The delete button sets investment status to `DORMANT` instead of removing it from view:
- ❌ "Deleted" investments still appear in Holdings list
- ❌ Confuses users (expecting investment to disappear)
- ❌ No distinction between paused vs deleted investments
- ❌ No easy restore functionality

### User Expectation
When clicking the trash icon, users expect:
- ✅ Investment disappears from main list
- ✅ Can be restored if mistake
- ✅ Doesn't break historical data/reports
- ✅ Clear distinction from active investments

---

## Industry Best Practices

### Financial Data Deletion Standards

**NEVER hard delete financial records** due to:

1. **Regulatory Requirements**
   - SEC Rule 17a-4: Maintain books and records for 6+ years
   - FINRA: Transaction records must be preserved
   - IRS: Tax records for realized investments (7 years)
   - SOX Compliance: Audit trail requirements

2. **Data Integrity**
   - Investments referenced by cash flows, valuations
   - Performance calculations depend on historical data
   - Reports need historical investment data
   - Foreign key constraints prevent deletion

3. **Business Continuity**
   - Accidental deletions are common
   - Restore should be simple and fast
   - Historical analysis requires all data
   - Client onboarding may need old records

---

## Recommended Solution

### **Approach: Soft Delete with `is_archived` Flag**

```python
class Investment:
    status = Column(Enum(InvestmentStatus))  # ACTIVE, DORMANT, REALIZED
    is_archived = Column(Boolean, default=False)  # NEW FIELD

    # Status meanings:
    # ACTIVE = Currently investing/holding
    # DORMANT = Commitment not funded yet, or paused
    # REALIZED = Fully exited (all capital returned)

    # is_archived meanings:
    # False = Show in normal views
    # True = Hidden ("deleted"), only show in archive view
```

### **Status + Archive Combinations**

| Status | Archived | Meaning | Shown In |
|--------|----------|---------|----------|
| ACTIVE | False | Active investment | Holdings, Dashboard |
| ACTIVE | True | Deleted (was active) | Archive only |
| DORMANT | False | Unfunded commitment | Holdings (with indicator) |
| DORMANT | True | Deleted (was unfunded) | Archive only |
| REALIZED | False | Fully exited | Holdings (with indicator), Performance |
| REALIZED | True | Deleted (was realized) | Archive only |

---

## Implementation

### 1. Database Migration

**File:** `migrations/add_is_archived_to_investments.py`

```python
"""Add is_archived flag to investments

Revision ID: xxx
Created: 2025-10-06
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add is_archived column with default False
    op.add_column(
        'investments',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false')
    )

    # Add index for faster queries
    op.create_index(
        'ix_investments_archived',
        'investments',
        ['tenant_id', 'is_archived']
    )

    # Add archived_date for audit
    op.add_column(
        'investments',
        sa.Column('archived_date', sa.DateTime(), nullable=True)
    )

    # Add archived_by for audit
    op.add_column(
        'investments',
        sa.Column('archived_by_user_id', sa.Integer(), nullable=True)
    )

    # Add foreign key
    op.create_foreign_key(
        'fk_investments_archived_by',
        'investments', 'users',
        ['archived_by_user_id'], ['id']
    )

def downgrade():
    op.drop_constraint('fk_investments_archived_by', 'investments')
    op.drop_column('investments', 'archived_by_user_id')
    op.drop_column('investments', 'archived_date')
    op.drop_index('ix_investments_archived', 'investments')
    op.drop_column('investments', 'is_archived')
```

---

### 2. Model Update

**File:** `app/models.py`

```python
class Investment(Base):
    __tablename__ = 'investments'

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)

    # ... existing fields ...

    status = Column(Enum(InvestmentStatus), default=InvestmentStatus.ACTIVE)

    # NEW: Archive flag (soft delete)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_date = Column(DateTime, nullable=True)
    archived_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    archived_by = relationship("User", foreign_keys=[archived_by_user_id])

    __table_args__ = (
        Index('ix_investments_tenant_archived', 'tenant_id', 'is_archived'),
    )
```

---

### 3. CRUD Functions Update

**File:** `app/crud_tenant.py`

```python
from datetime import datetime
from typing import Optional

def get_investments(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    filters: Optional[dict] = None,
    include_archived: bool = False  # NEW parameter
) -> List[Investment]:
    """
    Get investments with optional filters

    Args:
        include_archived: If False (default), exclude archived investments
    """
    query = db.query(Investment).filter(Investment.tenant_id == tenant_id)

    # Exclude archived by default
    if not include_archived:
        query = query.filter(Investment.is_archived == False)

    # Apply other filters
    if filters:
        if 'asset_class' in filters:
            query = query.filter(Investment.asset_class == filters['asset_class'])
        if 'status' in filters:
            query = query.filter(Investment.status == filters['status'])
        # ... other filters

    return query.offset(skip).limit(limit).all()


def archive_investment(
    db: Session,
    investment_id: int,
    tenant_id: int,
    user_id: int
) -> bool:
    """
    Archive an investment (soft delete)

    This hides the investment from normal views but preserves all data.
    The investment can be restored later.
    """
    db_investment = get_investment(db, investment_id, tenant_id)

    if not db_investment:
        return False

    # Set archived flag
    db_investment.is_archived = True
    db_investment.archived_date = datetime.utcnow()
    db_investment.archived_by_user_id = user_id
    db_investment.updated_date = datetime.utcnow()

    db.commit()
    return True


def unarchive_investment(
    db: Session,
    investment_id: int,
    tenant_id: int
) -> bool:
    """
    Restore an archived investment
    """
    db_investment = get_investment(db, investment_id, tenant_id, include_archived=True)

    if not db_investment:
        return False

    # Unset archived flag
    db_investment.is_archived = False
    db_investment.archived_date = None
    db_investment.archived_by_user_id = None
    db_investment.updated_date = datetime.utcnow()

    db.commit()
    return True


def get_investment(
    db: Session,
    investment_id: int,
    tenant_id: int,
    include_archived: bool = True  # Allow getting archived for admin operations
) -> Optional[Investment]:
    """
    Get single investment by ID
    """
    query = db.query(Investment).filter(
        Investment.id == investment_id,
        Investment.tenant_id == tenant_id
    )

    if not include_archived:
        query = query.filter(Investment.is_archived == False)

    return query.first()


# DEPRECATED: Old delete function
def delete_investment(db: Session, investment_id: int, tenant_id: int) -> bool:
    """
    DEPRECATED: Use archive_investment() instead

    This function kept for backward compatibility but now calls archive_investment
    """
    # Get current user from context (you'll need to pass this in)
    # For now, use a placeholder
    return archive_investment(db, investment_id, tenant_id, user_id=0)
```

---

### 4. API Endpoints Update

**File:** `app/routers/tenant_api.py`

```python
@router.delete("/investments/{investment_id}")
def archive_investment_endpoint(
    investment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Archive an investment (soft delete)

    The investment will be hidden from normal views but can be restored.
    All related data (cash flows, valuations) is preserved.
    """
    success = crud_tenant.archive_investment(
        db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")

    return {"success": True, "message": "Investment archived successfully"}


@router.post("/investments/{investment_id}/restore")
def restore_investment(
    investment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore an archived investment

    Only admins or managers should have access to this endpoint
    """
    # Check permissions (optional)
    if current_user.role not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    success = crud_tenant.unarchive_investment(
        db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")

    return {"success": True, "message": "Investment restored successfully"}


@router.get("/investments/archived")
def get_archived_investments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of archived investments

    For archive management UI
    """
    # Only get archived investments
    query = db.query(Investment).filter(
        Investment.tenant_id == current_user.tenant_id,
        Investment.is_archived == True
    )

    investments = query.offset(skip).limit(limit).all()

    return investments
```

---

### 5. Frontend Updates

**File:** `frontend/src/services/api.ts`

```typescript
// Update deleteInvestment to archiveInvestment
archiveInvestment: async (id: number): Promise<void> => {
  await apiClient.delete(`/api/investments/${id}`);
},

// Add restore function
restoreInvestment: async (id: number): Promise<void> => {
  await apiClient.post(`/api/investments/${id}/restore`);
},

// Add get archived investments
getArchivedInvestments: async (skip: number = 0, limit: number = 100): Promise<Investment[]> => {
  const response = await apiClient.get(`/api/investments/archived?skip=${skip}&limit=${limit}`);
  return response.data;
},
```

**File:** `frontend/src/pages/Holdings.tsx`

```typescript
const handleDeleteInvestment = useCallback(async (id: number) => {
  // Show confirmation dialog
  if (!window.confirm('Archive this investment? It can be restored later from the archive.')) {
    return;
  }

  try {
    await investmentAPI.archiveInvestment(id); // Changed from deleteInvestment
    fetchInvestments(); // Refresh the list (archived won't show)
    setPortfolioUpdateTrigger(prev => prev + 1);
  } catch (err) {
    setError('Failed to archive investment');
    console.error('Error archiving investment:', err);
  }
}, [fetchInvestments]);
```

---

### 6. Archive Management UI (Optional)

**File:** `frontend/src/pages/Archive.tsx` (New file)

```typescript
import React, { useState, useEffect } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI } from '../services/api';

const Archive: React.FC = () => {
  const [archivedInvestments, setArchivedInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    try {
      const data = await investmentAPI.getArchivedInvestments();
      setArchivedInvestments(data);
    } catch (err) {
      console.error('Error fetching archived investments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (!window.confirm('Restore this investment?')) return;

    try {
      await investmentAPI.restoreInvestment(id);
      fetchArchived(); // Refresh
    } catch (err) {
      console.error('Error restoring investment:', err);
    }
  };

  if (loading) return <div>Loading archive...</div>;

  return (
    <div className="archive-page">
      <h1>Archived Investments</h1>
      <p>These investments have been deleted but can be restored.</p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Asset Class</th>
            <th>Archived Date</th>
            <th>Archived By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {archivedInvestments.map(inv => (
            <tr key={inv.id}>
              <td>{inv.name}</td>
              <td>{inv.asset_class}</td>
              <td>{inv.archived_date ? new Date(inv.archived_date).toLocaleDateString() : '-'}</td>
              <td>{inv.archived_by?.name || '-'}</td>
              <td>
                <button onClick={() => handleRestore(inv.id)}>
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {archivedInvestments.length === 0 && (
        <p>No archived investments.</p>
      )}
    </div>
  );
};

export default Archive;
```

---

## Migration Path

### Phase 1: Add Archive Functionality (Week 1)
1. Run database migration to add `is_archived` column
2. Update CRUD functions to use `is_archived`
3. Update API endpoints (keep DELETE but make it archive)
4. Frontend: Change deleteInvestment → archiveInvestment
5. Test: Verify "deleted" investments disappear from Holdings

### Phase 2: Archive Management UI (Week 2)
1. Create Archive page
2. Add "Restore" functionality
3. Add navigation link to Archive
4. Permissions: Only admin/manager can restore

### Phase 3: Enhanced Features (Future)
1. Auto-archive realized investments after X years
2. Bulk archive operations
3. Export archived data
4. Permanent delete (admin only, after confirmation)

---

## Testing Checklist

### Unit Tests
- [ ] Archive investment sets flags correctly
- [ ] Archived investments excluded from getInvestments()
- [ ] Restore investment clears flags
- [ ] Cannot restore non-archived investment

### Integration Tests
- [ ] DELETE /investments/{id} archives (not deletes)
- [ ] POST /investments/{id}/restore works
- [ ] GET /investments excludes archived
- [ ] GET /investments/archived returns only archived

### Manual Testing
- [ ] Delete investment from Holdings → disappears
- [ ] Check database → investment still exists, is_archived=true
- [ ] Go to Archive page → see deleted investment
- [ ] Restore investment → reappears in Holdings
- [ ] Performance metrics still calculate correctly
- [ ] Historical reports include archived data

---

## Alternative: Hard Delete with Constraints

**NOT RECOMMENDED** but if you must:

```python
def hard_delete_investment(db: Session, investment_id: int, tenant_id: int) -> bool:
    """
    Permanently delete investment (NOT RECOMMENDED)

    WARNING: This will fail if investment has:
    - Cash flows
    - Valuations
    - Documents

    All related records must be deleted first (cascading delete).
    """
    db_investment = get_investment(db, investment_id, tenant_id)

    if not db_investment:
        return False

    try:
        # Delete related records first
        db.query(CashFlow).filter(CashFlow.investment_id == investment_id).delete()
        db.query(Valuation).filter(Valuation.investment_id == investment_id).delete()

        # Delete investment
        db.delete(db_investment)
        db.commit()
        return True

    except IntegrityError:
        db.rollback()
        raise Exception("Cannot delete investment with related records")
```

**Problems with hard delete:**
- ❌ Breaks audit trail
- ❌ Violates regulatory requirements
- ❌ No recovery from mistakes
- ❌ Foreign key constraints complicated
- ❌ Historical reports break

---

## Recommendation

✅ **Use soft delete with `is_archived` flag**

This provides:
- ✓ Clean user experience (deleted items disappear)
- ✓ Data integrity (nothing actually deleted)
- ✓ Easy restore functionality
- ✓ Regulatory compliance
- ✓ Audit trail maintained
- ✓ Historical analysis preserved

**Estimated Implementation Time:** 1-2 days
**Risk Level:** Low (non-breaking change)
**Priority:** High (user confusion with current behavior)
