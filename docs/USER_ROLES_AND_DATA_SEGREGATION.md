# User Roles and Data Segregation

## Overview

This document explains the multi-tenant architecture, user roles, account types, and data segregation model used in the Private Markets Portfolio Tracker.

## Account Types

The system supports three primary account types:

| Account Type | Description | Primary Use Case |
|-------------|-------------|------------------|
| **INDIVIDUAL** | Single investor managing their own portfolio | Individual investors tracking personal investments |
| **FAMILY_OFFICE** | Family office managing investments for multiple family members | Family offices managing portfolios for HNW families |
| **FUND_MANAGER** | Fund managers (GPs) managing funds and LP relationships | Private equity/venture capital fund managers |

## User Roles

Within each account, users can have different roles with varying levels of access:

| Role | Account Types | Description | Data Access |
|------|--------------|-------------|-------------|
| **ADMIN** | All | Full administrative access | All tenant data |
| **GP_ADMIN** | FUND_MANAGER | Fund manager administrator | All fund data, LP management |
| **CONTRIBUTOR** | All | Can create and edit investments | All tenant investments (read/write) |
| **VIEWER** | All | Read-only access | All tenant investments (read-only) |
| **LP_CLIENT** | FUND_MANAGER | Limited partner viewing their investments | **ISOLATED**: Only their entity's investments |

## Data Segregation Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                            TENANT LEVEL                              │
│  (Complete data isolation between tenants - testfm, demo, etc.)     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
            │  INDIVIDUAL  │ │FAMILY_OFFICE│ │FUND_MANAGER│
            │   Account    │ │   Account   │ │   Account  │
            └──────────────┘ └─────────────┘ └─────┬──────┘
                    │               │               │
                    │               │               │
            ┌───────▼───────────────▼───────────────▼────────┐
            │                                                 │
            │          STANDARD USER ROLES                    │
            │   (ADMIN, GP_ADMIN, CONTRIBUTOR, VIEWER)        │
            │                                                 │
            │   Data Access: ALL tenant investments           │
            │   ✓ See all investments                         │
            │   ✓ See all entities                            │
            │   ✓ See all cash flows                          │
            │   ✓ Full dashboard analytics                    │
            │                                                 │
            └─────────────────────────────────────────────────┘

            ┌─────────────────────────────────────────────────┐
            │                                                 │
            │          LP_CLIENT ROLE (Special Case)          │
            │          Only for FUND_MANAGER accounts         │
            │                                                 │
            │   User.entity_id = 12 (ABC Pension Fund)        │
            │                                                 │
            │   Data Access: ISOLATED by entity_id            │
            │   ✓ See ONLY investments where                  │
            │     investment.entity_id == user.entity_id      │
            │   ✗ Cannot see other entities' investments      │
            │   ✓ Dashboard shows only their data             │
            │   ✓ Performance metrics filtered to their data  │
            │                                                 │
            └─────────────────────────────────────────────────┘
```

## Entity-Based Isolation for LP_CLIENT

### How It Works

1. **User Association**: LP_CLIENT users have an `entity_id` field that links them to a specific Entity
2. **Investment Ownership**: Each Investment belongs to an `entity_id` (the GP managing it or the LP that owns it)
3. **Filtering Logic**: When an LP_CLIENT user makes a request, the system filters:
   ```python
   if user.role == LP_CLIENT:
       if not user.entity_id or investment.entity_id != user.entity_id:
           return 404  # Investment not found
   ```

### Example Scenario

```
Tenant: testfm (ID: 5)

Entities:
├── ABC Pension Fund (ID: 12) [LP Entity]
│   └── Investments:
│       ├── Tech Growth Fund I ($5M)
│       └── Real Estate Opportunity Fund III ($10M)
│
└── Test Fund Manager LP (ID: 13) [GP Entity]
    └── Investments:
        ├── GP Co-Investment Fund ($3M)
        └── Secondaries Opportunity ($2M)

Users:
├── gp_admin (Role: GP_ADMIN, entity_id: NULL)
│   └── Can see: ALL 4 investments
│
└── lp_demo (Role: LP_CLIENT, entity_id: 12)
    └── Can see: ONLY 2 investments from ABC Pension Fund
        ✓ Tech Growth Fund I
        ✓ Real Estate Opportunity Fund III
        ✗ GP Co-Investment Fund (belongs to entity 13)
        ✗ Secondaries Opportunity (belongs to entity 13)
```

## Navigation Access Control

Different roles see different navigation tabs based on their account type and role:

### LP_CLIENT Users
- **LP Portal** - Dashboard view with capital accounts, holdings, performance
- **Documents** - Access to quarterly statements and reports
- **HIDDEN**: Holdings, Analytics, Cash Flows, Entities, Benchmarks, Fund Manager tabs

### GP_ADMIN / ADMIN / CONTRIBUTOR / VIEWER Users
- **Dashboard** - Full analytics dashboard (INDIVIDUAL/FAMILY_OFFICE)
- **Fund Manager** - Fund management interface (FUND_MANAGER only)
- **LP Accounts** - LP capital account management (FUND_MANAGER only)
- **Holdings** - All investments view
- **Analytics** - Charts and visualizations
- **Cash Flows** - Liquidity forecasting
- **Entities** - Entity management
- **Benchmarks** - Performance benchmarking
- **Reports** - Report generation
- **Documents** - Document management

## API Endpoint Data Isolation

### Endpoints with LP Isolation

All of these endpoints check user role and filter data accordingly:

| Endpoint | LP_CLIENT Access | Other Roles Access |
|----------|-----------------|-------------------|
| `GET /investments` | Filtered by entity_id | All tenant investments |
| `GET /investments/{id}` | 404 if not their entity | Any tenant investment |
| `GET /investments/{id}/performance` | 404 if not their entity | Any tenant investment |
| `GET /investments/{id}/cashflows` | Empty if not their entity | All investment cash flows |
| `GET /investments/{id}/valuations` | Empty if not their entity | All investment valuations |
| `GET /dashboard/summary` | Filtered calculations | Full tenant calculations |
| `GET /dashboard/asset-class-breakdown` | Their portfolio only | Full tenant portfolio |
| `GET /dashboard/entity-breakdown` | Their entity only | All entities |
| `GET /dashboard/commitment-vs-called` | Their data only | All tenant data |
| `GET /dashboard/allocation-by-asset-class` | Filtered allocations | All allocations |
| `GET /dashboard/allocation-by-vintage` | Filtered vintages | All vintages |
| `GET /dashboard/portfolio-value-timeline` | Their timeline | Full timeline |
| `GET /dashboard/summary-stats` | Their stats | Full tenant stats |

## Security Implementation

### Database Level
```sql
-- User table has entity_id for LP association
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR NOT NULL,
    role user_role NOT NULL,
    entity_id INTEGER REFERENCES entities(id),  -- For LP_CLIENT only
    tenant_id INTEGER REFERENCES tenants(id),
    ...
);

-- Index for fast filtering
CREATE INDEX ix_user_entity ON users(entity_id);
```

### Application Level
```python
# Helper function in tenant_api.py
def _get_user_investments(db: Session, current_user: User):
    """Get investments with LP data isolation"""
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id:
            return []  # LP with no entity sees nothing
        return crud_tenant.get_investments_by_entity(
            db=db,
            entity_id=current_user.entity_id,
            tenant_id=current_user.tenant_id
        )
    # All other roles see all tenant investments
    return crud_tenant.get_investments(db, current_user.tenant_id)
```

## Role Permission Matrix

| Action | LP_CLIENT | VIEWER | CONTRIBUTOR | GP_ADMIN | ADMIN |
|--------|-----------|---------|-------------|----------|-------|
| View own entity's investments | ✓ | ✓ | ✓ | ✓ | ✓ |
| View other entities' investments | ✗ | ✓ | ✓ | ✓ | ✓ |
| Create investments | ✗ | ✗ | ✓ | ✓ | ✓ |
| Edit investments | ✗ | ✗ | ✓ | ✓ | ✓ |
| Delete investments | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage entities | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✗ | ✓ | ✓ |
| View LP Portal | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage LP accounts | ✗ | ✗ | ✗ | ✓ | ✓ |
| Access Fund Manager dashboard | ✗ | ✗ | ✗ | ✓ | ✓ |

## Data Flow Diagram

```
┌──────────────────┐
│   User Login     │
│  (JWT Token)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   Authentication Middleware              │
│   - Verify JWT token                     │
│   - Load user from database              │
│   - Include: role, tenant_id, entity_id  │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   Authorization Check                    │
│   - Is user.role == LP_CLIENT?           │
│   - If yes → Apply entity_id filter      │
│   - If no → Allow tenant-wide access     │
└────────┬─────────────────────────────────┘
         │
         ├─────────────────┬──────────────────┐
         ▼                 ▼                  ▼
┌────────────────┐  ┌──────────────┐  ┌─────────────┐
│  LP_CLIENT     │  │ CONTRIBUTOR  │  │   ADMIN     │
│  User          │  │ User         │  │   User      │
└────────┬───────┘  └──────┬───────┘  └──────┬──────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌────────────────┐  ┌──────────────┐  ┌─────────────┐
│ SELECT * FROM  │  │ SELECT * FROM│  │ SELECT * FROM│
│ investments    │  │ investments  │  │ investments │
│ WHERE          │  │ WHERE        │  │ WHERE       │
│ entity_id = 12 │  │ tenant_id = 5│  │ tenant_id = 5│
│ AND            │  │              │  │             │
│ tenant_id = 5  │  │              │  │             │
└────────────────┘  └──────────────┘  └─────────────┘
```

## Testing Data Isolation

To test that LP data isolation is working:

1. **Login as LP_CLIENT user** (lp_demo)
   - Verify you see only investments from entity_id = 12
   - Verify dashboard shows correct metrics for those investments only
   - Try to access investment from entity_id = 13 → Should get 404

2. **Login as GP_ADMIN user** (gp_admin)
   - Verify you see ALL investments (both entity 12 and 13)
   - Verify dashboard shows metrics for all investments
   - Can access any investment by ID

3. **Check Navigation**
   - LP_CLIENT should only see: LP Portal, Documents
   - GP_ADMIN should see: Fund Manager, LP Accounts, Holdings, etc.

## Best Practices

1. **Always check user role** before returning data
2. **Use helper functions** like `_get_user_investments()` for consistency
3. **Return 404 instead of 403** for isolated data (don't reveal existence)
4. **Index entity_id columns** for performance
5. **Validate entity_id exists** before associating with LP users
6. **Log access attempts** for security auditing
7. **Test isolation** with real user scenarios

## Summary

The data segregation model ensures:
- **Tenant-level isolation**: Complete separation between different organizations
- **Role-based access**: Different capabilities based on user role
- **Entity-level isolation for LPs**: Limited partners only see their own investments
- **Account-type-specific features**: Different UIs and navigation for different account types
- **Secure by default**: Data is filtered at the database query level, not just UI level
