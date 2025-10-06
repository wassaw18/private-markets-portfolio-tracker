# Utilities Directory

Collection of utility scripts for database management, data import/export, authentication, and user management.

## Directory Structure

### `authentication/`
Scripts for fixing and managing authentication:
- `fix_authentication_system.py` - Comprehensive authentication system repair
- `fix_password_hashes.py` - Password hash migration and fixes
- `simple_password_fix.py` - Quick password reset utility

### `database/`
Database maintenance and migration scripts:
- `backfill_benchmark_data.py` - Backfill benchmark data from historical sources
- `create_pitchbook_tables.py` - Create PitchBook benchmark tables
- `create_quarterly_benchmarks.py` - Set up quarterly benchmark data
- `create_quarterly_table.py` - Create quarterly data tables
- `update_quarterly_data.py` - Update quarterly benchmark data
- `inspect_db.py` - Database inspection and debugging tool
- `migrate_entity_relationships.py` - Migrate entity relationship data
- `fix_relationship_data.py` - Fix entity relationship inconsistencies
- `add_sample_benchmark_data.py` - Add sample benchmark data for testing

### `data-import/`
Data import utilities:
- `import_json_data.py` - Import data from JSON files
- `import_quarterly_returns.py` - Import quarterly return data
- `import_multiples_data.py` - Import multiples (TVPI, DPI, etc.) data

### `data-export/`
Data export utilities:
- `export_pitchbook_data.py` - Export PitchBook benchmark data
- `export_all_pitchbook.py` - Export all PitchBook data to Excel

### `user-management/`
User account management scripts:
- `create_admin_users.py` - Create admin user accounts
- `create_test_user.py` - Create test user accounts for development

## Usage

Most scripts can be run directly from the project root:

```bash
# Activate virtual environment first
source venv/bin/activate

# Run a utility script
python utilities/database/inspect_db.py
python utilities/user-management/create_admin_users.py
```

## Best Practices

1. **Always backup** before running database migration scripts
2. **Test in development** before running in production
3. **Review script contents** before execution to understand what changes will be made
4. **Check dependencies** - ensure all required packages are installed

## Archive

Historical scripts are archived in `data/archives/` for reference but are no longer actively maintained.
