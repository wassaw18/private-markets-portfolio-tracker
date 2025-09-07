# Multi-Entity Management Implementation

## Overview

The Private Markets Portfolio Tracker has been enhanced with comprehensive multi-entity management capabilities. This implementation allows family offices to track investments across multiple entities (Individuals, Trusts, LLCs, etc.) with proper relationships and family member tracking.

## Key Features Implemented

### 1. Entity Model (`app/models.py`)

**New Entity Types Supported:**
- Individual
- Trust
- LLC
- Partnership
- Corporation
- Foundation
- Other

**Entity Fields:**
- `name`: Entity name
- `entity_type`: Type from EntityType enum
- `tax_id`: SSN/EIN/TIN (unique)
- `legal_address`: Legal address
- `formation_date`: Date of formation (for legal entities)
- `is_active`: Active status (soft delete support)
- `notes`: Additional notes
- Audit fields: `created_date`, `updated_date`

### 2. Family Member Model (`app/models.py`)

**Relationship Types Supported:**
- Self
- Spouse
- Child
- Parent
- Sibling
- Trustee
- Beneficiary
- Manager
- Member
- Partner
- Other

**Family Member Fields:**
- `entity_id`: Foreign key to entity
- `first_name`, `last_name`: Name fields
- `date_of_birth`: Date of birth
- `relationship_type`: Relationship to entity
- `primary_contact`: Primary contact flag
- Contact info: `email`, `phone`, `address`
- `is_active`: Active status
- `notes`: Additional notes
- `full_name`: Property combining first/last name

### 3. Updated Investment Model

**Changes Made:**
- ❌ Removed: `owner` field (string)
- ✅ Added: `entity_id` field (foreign key)
- ✅ Added: `entity` relationship

### 4. API Endpoints (`app/main.py`)

#### Entity Management Endpoints
- `POST /api/entities` - Create entity
- `GET /api/entities` - List entities with filtering
- `GET /api/entities/{entity_id}` - Get specific entity
- `PUT /api/entities/{entity_id}` - Update entity
- `DELETE /api/entities/{entity_id}` - Deactivate entity
- `GET /api/entities/{entity_id}/investments` - Get entity's investments

#### Family Member Endpoints
- `POST /api/entities/{entity_id}/family-members` - Create family member
- `GET /api/entities/{entity_id}/family-members` - Get entity's family members
- `PUT /api/family-members/{member_id}` - Update family member
- `DELETE /api/family-members/{member_id}` - Deactivate family member

#### Enhanced Investment Endpoints
- Updated filtering to work with entities instead of owner strings
- Added entity-based search and filtering options
- Support for filtering by entity types, names, and IDs

### 5. Database Schema Updates

#### New Tables Created
```sql
entities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    tax_id TEXT UNIQUE,
    legal_address TEXT,
    formation_date DATE,
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
)

family_members (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    relationship_type TEXT NOT NULL,
    primary_contact BOOLEAN DEFAULT 0,
    email TEXT,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities (id)
)
```

#### Updated Tables
```sql
-- investments table
ALTER TABLE investments ADD COLUMN entity_id INTEGER;
-- owner column removed during migration (optional)
```

### 6. Migration Script (`migration_entity_management.py`)

**Migration Features:**
- Automatic database backup before migration
- Creates new entity and family_member tables
- Migrates existing `owner` strings to `Entity` records
- Updates investments to use `entity_id` instead of `owner`
- Preserves all existing data
- Optional removal of old `owner` column

**Usage:**
```bash
python migration_entity_management.py
```

### 7. Enhanced CRUD Operations (`app/crud.py`)

#### Entity CRUD
- `get_entity()` - Get single entity with family members
- `get_entities()` - List entities with pagination and filtering
- `get_entities_by_type()` - Filter by entity type
- `create_entity()` - Create new entity
- `update_entity()` - Update existing entity
- `delete_entity()` - Soft delete entity
- `search_entities()` - Search entities by name

#### Family Member CRUD
- `get_family_member()` - Get single family member
- `get_entity_family_members()` - Get entity's family members
- `create_family_member()` - Create new family member
- `update_family_member()` - Update family member
- `delete_family_member()` - Soft delete family member

#### Enhanced Investment CRUD
- Updated filtering to support entity-based searches
- Added `get_investments_by_entity()` function
- Enhanced search across investment name, entity name, and strategy

### 8. Pydantic Schemas (`app/schemas.py`)

#### New Schemas
- `EntityBase`, `EntityCreate`, `EntityUpdate`, `Entity`
- `FamilyMemberBase`, `FamilyMemberCreate`, `FamilyMemberUpdate`, `FamilyMember`
- `EntityWithMembers` - Entity with family members and investment stats

#### Updated Investment Schemas
- Replaced `owner: str` with `entity_id: int`
- Added optional `entity: Entity` relationship

## Usage Examples

### 1. Creating Entities

```python
# Individual
individual = {
    "name": "John Smith",
    "entity_type": "Individual",
    "tax_id": "123-45-6789",
    "legal_address": "123 Main St, Anytown, NY 12345"
}

# Trust
trust = {
    "name": "Smith Family Trust",
    "entity_type": "Trust",
    "tax_id": "98-7654321",
    "formation_date": "2020-01-15",
    "legal_address": "456 Oak Ave, Anytown, NY 12345"
}

# LLC
llc = {
    "name": "Smith Holdings LLC",
    "entity_type": "LLC",
    "tax_id": "45-6789123",
    "formation_date": "2021-06-01"
}
```

### 2. Adding Family Members

```python
# Primary contact for individual
{
    "entity_id": 1,
    "first_name": "John",
    "last_name": "Smith",
    "relationship_type": "Self",
    "primary_contact": true,
    "email": "john@example.com",
    "phone": "555-0001"
}

# Spouse
{
    "entity_id": 2,  # Trust entity
    "first_name": "Jane",
    "last_name": "Smith",
    "relationship_type": "Spouse",
    "primary_contact": true,
    "email": "jane@example.com"
}

# Child beneficiary
{
    "entity_id": 2,  # Trust entity
    "first_name": "Emily",
    "last_name": "Smith",
    "relationship_type": "Child",
    "date_of_birth": "2005-03-15",
    "email": "emily@example.com"
}
```

### 3. Creating Investments with Entities

```python
# Investment owned by Individual
{
    "name": "ABC Private Equity Fund IV",
    "asset_class": "Private Equity",
    "investment_structure": "Limited Partnership",
    "entity_id": 1,  # John Smith Individual
    "strategy": "Large Cap Buyout",
    "vintage_year": 2023,
    "commitment_amount": 1000000.0
}

# Investment owned by Trust
{
    "name": "XYZ Real Estate Fund III",
    "asset_class": "Real Estate",
    "investment_structure": "Limited Partnership",
    "entity_id": 2,  # Smith Family Trust
    "strategy": "Core Plus Real Estate",
    "vintage_year": 2022,
    "commitment_amount": 2000000.0
}
```

### 4. Querying with Entity Filters

```bash
# Get all Trust investments
GET /api/investments?entity_types=Trust

# Get investments for specific entities
GET /api/investments?entity_ids=1,2,3

# Search across entity names
GET /api/investments?search=Smith

# Filter by multiple entity types
GET /api/investments?entity_types=Trust,LLC

# Get entity with family members and investment stats
GET /api/entities/1
```

## Benefits

### For Family Offices
1. **Multi-Entity Tracking** - Track investments across all family entities
2. **Family Member Management** - Maintain relationships and contact information
3. **Entity-Based Reporting** - Generate reports by entity type or specific entities
4. **Compliance Support** - Track tax IDs and legal structures for regulatory compliance
5. **Relationship Mapping** - Understand family member roles across entities

### For Portfolio Management
1. **Better Organization** - Investments organized by legal ownership
2. **Advanced Filtering** - Filter investments by entity characteristics
3. **Consolidated Views** - See all investments for a family across entities
4. **Risk Analysis** - Analyze concentration by entity type
5. **Tax Optimization** - Track investments by tax structure

## Migration Path

1. **Backup Current Data** - Migration script automatically creates backups
2. **Run Migration** - Execute `migration_entity_management.py`
3. **Verify Data** - Check that all investments have proper entity linkages
4. **Update Frontend** - Update UI to use new entity-based endpoints
5. **Test Functionality** - Verify all CRUD operations work correctly

## Testing

The implementation includes comprehensive validation:
- **Structure Validation** - `validate_entity_structure.py`
- **Migration Testing** - Safe migration with rollback capability
- **API Testing** - All endpoints tested for proper functionality
- **Data Integrity** - Foreign key constraints ensure data consistency

## Next Steps

To fully activate the multi-entity management:

1. Run the migration script on your database
2. Update frontend components to use entity selection instead of owner text fields
3. Implement entity management UI for creating and managing entities
4. Add family member management interface
5. Update investment creation forms to use entity selection

The backend implementation is complete and ready for production use!