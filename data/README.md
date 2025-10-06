# Data Directory

Contains runtime-generated data files, exports, and archives.

## Directory Structure

### `archives/`
Historical data and deprecated scripts:
- `migration/` - Completed PostgreSQL migration scripts
- `development/` - Old debug and validation scripts
- `sqlite/` - Archived SQLite database files (pre-PostgreSQL migration)

**Note:** Archive directories are for reference only. Do not use archived scripts without review.

### `backups/`
Database backup files (runtime-generated, gitignored)

### `exports/`
Data exports and generated reports (runtime-generated, gitignored):
- CSV exports from data analysis
- Excel exports from PitchBook data
- PDF reports and extractions

## Gitignore Status

The following directories are automatically excluded from version control:
- `data/backups/` - Runtime backup files
- `data/exports/` - Generated export files
- `data/archives/` - Historical archives

## Best Practices

1. **Backups**: Regular database backups are saved here automatically
2. **Exports**: Query results and data exports are temporary
3. **Retention**: Implement retention policies for old backups/exports
4. **Archives**: Keep for historical reference, but don't execute without review
