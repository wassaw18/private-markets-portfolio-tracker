"""
PitchBook Benchmark Data Importer Service

This module handles importing quarterly PitchBook benchmark data from CSV templates
into the database. It provides validation, data transformation, and error handling
for the import process.
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
import logging
import os
import hashlib

from app.database import SessionLocal
from app.models import (
    Base,
    # PitchBook specific models (these will be created from the migration)
    # pitchbook_asset_classes, pitchbook_metric_types, pitchbook_reports,
    # pitchbook_performance_data, pitchbook_quarterly_returns, pitchbook_import_log
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PitchBookImportError(Exception):
    """Custom exception for PitchBook import errors"""
    pass

class PitchBookDataValidator:
    """Validates PitchBook data before import"""

    VALID_ASSET_CLASSES = {
        'private_equity', 'venture_capital', 'real_estate', 'real_assets',
        'private_debt', 'fund_of_funds', 'secondaries'
    }

    VALID_METRIC_CODES = {'IRR', 'PME', 'TVPI', 'DPI', 'RVPI'}

    REQUIRED_PERFORMANCE_COLUMNS = [
        'report_period', 'asset_class', 'metric_code', 'vintage_year',
        'top_quartile_value', 'median_value', 'bottom_quartile_value',
        'sample_size', 'fund_count'
    ]

    REQUIRED_QUARTERLY_COLUMNS = [
        'report_period', 'asset_class', 'quarter_year', 'quarter_date',
        'top_quartile_return', 'median_return', 'bottom_quartile_return',
        'sample_size'
    ]

    @classmethod
    def validate_performance_data(cls, df: pd.DataFrame) -> List[str]:
        """Validate performance data CSV format and content"""
        errors = []

        # Check required columns
        missing_cols = set(cls.REQUIRED_PERFORMANCE_COLUMNS) - set(df.columns)
        if missing_cols:
            errors.append(f"Missing required columns: {missing_cols}")

        if not errors:  # Only validate content if columns are present
            for idx, row in df.iterrows():
                row_errors = cls._validate_performance_row(row, idx)
                errors.extend(row_errors)

        return errors

    @classmethod
    def validate_quarterly_data(cls, df: pd.DataFrame) -> List[str]:
        """Validate quarterly returns CSV format and content"""
        errors = []

        # Check required columns
        missing_cols = set(cls.REQUIRED_QUARTERLY_COLUMNS) - set(df.columns)
        if missing_cols:
            errors.append(f"Missing required columns: {missing_cols}")

        if not errors:  # Only validate content if columns are present
            for idx, row in df.iterrows():
                row_errors = cls._validate_quarterly_row(row, idx)
                errors.extend(row_errors)

        return errors

    @classmethod
    def _validate_performance_row(cls, row: pd.Series, row_idx: int) -> List[str]:
        """Validate a single performance data row"""
        errors = []
        row_num = row_idx + 2  # +2 because pandas is 0-indexed and we have header

        # Asset class validation
        if row['asset_class'] not in cls.VALID_ASSET_CLASSES:
            errors.append(f"Row {row_num}: Invalid asset_class '{row['asset_class']}'. Must be one of: {cls.VALID_ASSET_CLASSES}")

        # Metric code validation
        if row['metric_code'] not in cls.VALID_METRIC_CODES:
            errors.append(f"Row {row_num}: Invalid metric_code '{row['metric_code']}'. Must be one of: {cls.VALID_METRIC_CODES}")

        # Vintage year validation
        try:
            vintage_year = int(row['vintage_year'])
            if vintage_year < 1990 or vintage_year > datetime.now().year + 2:
                errors.append(f"Row {row_num}: Vintage year {vintage_year} is outside valid range (1990-{datetime.now().year + 2})")
        except (ValueError, TypeError):
            errors.append(f"Row {row_num}: Invalid vintage_year '{row['vintage_year']}'. Must be a 4-digit year.")

        # Quartile value validation
        try:
            top = float(row['top_quartile_value']) if pd.notna(row['top_quartile_value']) else None
            median = float(row['median_value']) if pd.notna(row['median_value']) else None
            bottom = float(row['bottom_quartile_value']) if pd.notna(row['bottom_quartile_value']) else None

            if top is not None and median is not None and bottom is not None:
                if not (top >= median >= bottom):
                    errors.append(f"Row {row_num}: Quartile values must be in order: top_quartile >= median >= bottom_quartile")

            # Reasonable value checks
            metric_code = row['metric_code']
            if metric_code == 'IRR':
                # IRR typically between -100% and +100%
                for val_name, val in [('top_quartile', top), ('median', median), ('bottom_quartile', bottom)]:
                    if val is not None and (val < -1.0 or val > 2.0):
                        errors.append(f"Row {row_num}: {val_name}_value {val} seems unrealistic for IRR (expected -100% to +200%)")
            elif metric_code in ['TVPI', 'DPI', 'RVPI', 'PME']:
                # Multiples typically between 0.1x and 10x
                for val_name, val in [('top_quartile', top), ('median', median), ('bottom_quartile', bottom)]:
                    if val is not None and (val < 0.0 or val > 20.0):
                        errors.append(f"Row {row_num}: {val_name}_value {val} seems unrealistic for {metric_code} (expected 0x to 20x)")

        except (ValueError, TypeError) as e:
            errors.append(f"Row {row_num}: Invalid quartile values. Must be numeric.")

        # Sample size validation
        try:
            sample_size = int(row['sample_size']) if pd.notna(row['sample_size']) else None
            if sample_size is not None and sample_size <= 0:
                errors.append(f"Row {row_num}: sample_size must be positive")
        except (ValueError, TypeError):
            errors.append(f"Row {row_num}: sample_size must be an integer")

        # Report period format validation
        report_period = str(row['report_period']).strip()
        if not report_period or not report_period.startswith('Q') or '-' not in report_period:
            errors.append(f"Row {row_num}: report_period must be in format 'Q4-2024'")

        return errors

    @classmethod
    def _validate_quarterly_row(cls, row: pd.Series, row_idx: int) -> List[str]:
        """Validate a single quarterly returns row"""
        errors = []
        row_num = row_idx + 2

        # Asset class validation
        if row['asset_class'] not in cls.VALID_ASSET_CLASSES:
            errors.append(f"Row {row_num}: Invalid asset_class '{row['asset_class']}'")

        # Quarter year format validation
        quarter_year = str(row['quarter_year']).strip()
        if not quarter_year.startswith('Q') or '-' not in quarter_year:
            errors.append(f"Row {row_num}: quarter_year must be in format 'Q1-2024'")

        # Quarter date validation
        try:
            quarter_date = pd.to_datetime(row['quarter_date']).date()
            # Should be first day of quarter
            if quarter_date.day != 1:
                errors.append(f"Row {row_num}: quarter_date should be first day of quarter")
        except (ValueError, TypeError):
            errors.append(f"Row {row_num}: quarter_date must be a valid date in YYYY-MM-DD format")

        # Return value validation
        try:
            top = float(row['top_quartile_return']) if pd.notna(row['top_quartile_return']) else None
            median = float(row['median_return']) if pd.notna(row['median_return']) else None
            bottom = float(row['bottom_quartile_return']) if pd.notna(row['bottom_quartile_return']) else None

            if top is not None and median is not None and bottom is not None:
                if not (top >= median >= bottom):
                    errors.append(f"Row {row_num}: Return values must be in order: top_quartile >= median >= bottom_quartile")

            # Reasonable return checks (allow for both quarterly and annualized time horizon returns)
            # Quarterly returns: typically -50% to +50% per quarter
            # Annualized time horizon returns: can be higher (e.g., 15-year private equity returns)
            for val_name, val in [('top_quartile', top), ('median', median), ('bottom_quartile', bottom)]:
                if val is not None and (val < -0.95 or val > 2.0):  # Allow -95% to +200% for time horizon data
                    errors.append(f"Row {row_num}: {val_name}_return {val:.1%} seems extreme for return data")

        except (ValueError, TypeError):
            errors.append(f"Row {row_num}: Invalid return values. Must be numeric.")

        return errors

class PitchBookImporter:
    """Main class for importing PitchBook benchmark data"""

    def __init__(self, db: Session):
        self.db = db
        self.validator = PitchBookDataValidator()

    def import_from_csv(self, file_path: str, import_type: str = 'full') -> Dict[str, Any]:
        """
        Import PitchBook data from CSV file

        Args:
            file_path: Path to CSV file
            import_type: Type of import ('full', 'performance_only', 'quarterly_only')

        Returns:
            Dict with import results and statistics
        """
        try:
            # Start import log
            import_log = self._create_import_log(file_path, import_type)

            # Read and validate CSV
            df = pd.read_csv(file_path, comment='#')  # Skip comment lines

            # Check if DataFrame is empty or has no columns
            if df.empty or len(df.columns) == 0:
                raise PitchBookImportError(
                    "No data found in the uploaded file. The file may contain only comments or headers without actual data rows. "
                    "Please ensure the file contains properly formatted benchmark data."
                )

            logger.info(f"CSV loaded: {len(df)} rows, columns: {list(df.columns)}")

            # Determine data type and validate
            if self._is_performance_data(df):
                return self._import_performance_data(df, import_log)
            elif self._is_quarterly_data(df):
                return self._import_quarterly_data(df, import_log)
            else:
                # Try to parse as combined format
                return self._import_combined_data(df, import_log)

        except Exception as e:
            logger.error(f"Import failed: {str(e)}")
            self._update_import_log(import_log, 'failed', error_details=str(e))
            raise PitchBookImportError(f"Import failed: {str(e)}")

    def _is_performance_data(self, df: pd.DataFrame) -> bool:
        """Check if DataFrame contains performance data"""
        return 'metric_code' in df.columns and 'vintage_year' in df.columns

    def _is_quarterly_data(self, df: pd.DataFrame) -> bool:
        """Check if DataFrame contains quarterly returns data"""
        return 'quarter_year' in df.columns and 'quarter_date' in df.columns

    def _import_performance_data(self, df: pd.DataFrame, import_log) -> Dict[str, Any]:
        """Import performance data"""
        start_time = datetime.now()

        # Filter to performance data rows
        perf_df = df[df.columns.intersection(self.validator.REQUIRED_PERFORMANCE_COLUMNS + ['methodology_notes'])].copy()
        perf_df = perf_df.dropna(subset=['metric_code', 'vintage_year'])

        # Validate data
        validation_errors = self.validator.validate_performance_data(perf_df)
        if validation_errors:
            error_msg = "Validation failed:\n" + "\n".join(validation_errors[:10])  # Limit to first 10 errors
            self._update_import_log(import_log, 'failed', validation_errors=error_msg)
            raise PitchBookImportError(error_msg)

        # Process data
        results = {
            'processed': len(perf_df),
            'inserted': 0,
            'updated': 0,
            'skipped': 0,
            'errors': []
        }

        for _, row in perf_df.iterrows():
            try:
                # Insert or update performance record
                if self._insert_or_update_performance_record(row):
                    results['inserted'] += 1
                else:
                    results['updated'] += 1
            except Exception as e:
                results['errors'].append(f"Row error: {str(e)}")
                results['skipped'] += 1

        # Update import log
        duration = (datetime.now() - start_time).total_seconds()
        self._update_import_log(
            import_log,
            'success',
            records_processed=results['processed'],
            records_inserted=results['inserted'],
            records_updated=results['updated'],
            records_skipped=results['skipped'],
            import_duration_seconds=int(duration)
        )

        self.db.commit()
        return results

    def _import_quarterly_data(self, df: pd.DataFrame, import_log) -> Dict[str, Any]:
        """Import quarterly returns data"""
        start_time = datetime.now()

        # Filter to quarterly data rows
        quarterly_df = df[df.columns.intersection(self.validator.REQUIRED_QUARTERLY_COLUMNS)].copy()
        quarterly_df = quarterly_df.dropna(subset=['quarter_year', 'quarter_date'])

        # Validate data
        validation_errors = self.validator.validate_quarterly_data(quarterly_df)
        if validation_errors:
            error_msg = "Validation failed:\n" + "\n".join(validation_errors[:10])
            self._update_import_log(import_log, 'failed', validation_errors=error_msg)
            raise PitchBookImportError(error_msg)

        # Process data
        results = {
            'processed': len(quarterly_df),
            'inserted': 0,
            'updated': 0,
            'skipped': 0,
            'errors': []
        }

        for _, row in quarterly_df.iterrows():
            try:
                # Insert or update quarterly record
                if self._insert_or_update_quarterly_record(row):
                    results['inserted'] += 1
                else:
                    results['updated'] += 1
            except Exception as e:
                results['errors'].append(f"Row error: {str(e)}")
                results['skipped'] += 1

        # Update import log
        duration = (datetime.now() - start_time).total_seconds()
        self._update_import_log(
            import_log,
            'success',
            records_processed=results['processed'],
            records_inserted=results['inserted'],
            records_updated=results['updated'],
            records_skipped=results['skipped'],
            import_duration_seconds=int(duration)
        )

        self.db.commit()
        return results

    def _import_combined_data(self, df: pd.DataFrame, import_log) -> Dict[str, Any]:
        """Import combined performance and quarterly data"""
        # Split the dataframe into performance and quarterly sections
        perf_results = {'processed': 0, 'inserted': 0, 'updated': 0, 'skipped': 0, 'errors': []}
        quarterly_results = {'processed': 0, 'inserted': 0, 'updated': 0, 'skipped': 0, 'errors': []}

        # Check if we have both types of data
        has_performance = 'metric_code' in df.columns and 'vintage_year' in df.columns
        has_quarterly = 'quarter_year' in df.columns and 'quarter_date' in df.columns

        if has_performance:
            perf_df = df[df['metric_code'].notna() & df['vintage_year'].notna()].copy()
            if not perf_df.empty:
                perf_results = self._import_performance_data(perf_df, import_log)

        if has_quarterly:
            quarterly_df = df[df['quarter_year'].notna() & df['quarter_date'].notna()].copy()
            if not quarterly_df.empty:
                quarterly_results = self._import_quarterly_data(quarterly_df, import_log)

        # Combine results
        combined_results = {
            'performance_data': perf_results,
            'quarterly_data': quarterly_results,
            'total_processed': perf_results['processed'] + quarterly_results['processed'],
            'total_inserted': perf_results['inserted'] + quarterly_results['inserted'],
            'total_updated': perf_results['updated'] + quarterly_results['updated'],
            'total_skipped': perf_results['skipped'] + quarterly_results['skipped'],
            'total_errors': perf_results['errors'] + quarterly_results['errors']
        }

        return combined_results

    def _create_import_log(self, file_path: str, import_type: str):
        """Create initial import log entry"""
        # This would create an entry in pitchbook_import_log table
        # For now, return a placeholder object
        return {
            'id': 1,
            'source_file': file_path,
            'import_type': import_type,
            'import_status': 'running'
        }

    def _update_import_log(self, import_log, status: str, **kwargs):
        """Update import log with results"""
        # This would update the pitchbook_import_log table
        # For now, just log the information
        logger.info(f"Import log update: {status}, {kwargs}")

    def _insert_or_update_performance_record(self, row: pd.Series) -> bool:
        """Insert or update a performance record, returns True if inserted, False if updated"""
        # This would interact with the pitchbook_performance_data table
        # For now, simulate the operation
        logger.info(f"Processing performance record: {row['asset_class']} {row['metric_code']} {row['vintage_year']}")
        return True  # Simulate new insert

    def _insert_or_update_quarterly_record(self, row: pd.Series) -> bool:
        """Insert or update a quarterly record, returns True if inserted, False if updated"""
        from app.models import QuarterlyBenchmark
        from datetime import datetime

        try:
            # Convert quarter_date to proper date object if it's a string
            quarter_date = row['quarter_date']
            if isinstance(quarter_date, str):
                quarter_date = datetime.strptime(quarter_date, '%Y-%m-%d').date()

            # Check if record already exists
            existing = self.db.query(QuarterlyBenchmark).filter(
                QuarterlyBenchmark.report_period == row['report_period'],
                QuarterlyBenchmark.asset_class == row['asset_class'],
                QuarterlyBenchmark.quarter_year == row['quarter_year'],
                QuarterlyBenchmark.quarter_date == quarter_date
            ).first()

            if existing:
                # Update existing record
                existing.top_quartile_return = row.get('top_quartile_return')
                existing.median_return = row.get('median_return')
                existing.bottom_quartile_return = row.get('bottom_quartile_return')
                existing.sample_size = row.get('sample_size')
                existing.updated_at = datetime.utcnow()

                logger.info(f"Updated quarterly record: {row['asset_class']} {row['quarter_year']}")
                self.db.commit()
                return False  # Updated existing
            else:
                # Create new record
                new_record = QuarterlyBenchmark(
                    report_period=row['report_period'],
                    asset_class=row['asset_class'],
                    quarter_year=row['quarter_year'],
                    quarter_date=quarter_date,
                    top_quartile_return=row.get('top_quartile_return'),
                    median_return=row.get('median_return'),
                    bottom_quartile_return=row.get('bottom_quartile_return'),
                    sample_size=row.get('sample_size'),
                    data_source="PitchBook PDF Import"
                )

                self.db.add(new_record)
                logger.info(f"Inserted quarterly record: {row['asset_class']} {row['quarter_year']}")
                self.db.commit()
                return True  # New insert

        except Exception as e:
            logger.error(f"Failed to insert/update quarterly record: {str(e)}")
            self.db.rollback()
            raise

def import_pitchbook_data(file_path: str, import_type: str = 'full') -> Dict[str, Any]:
    """
    Convenience function to import PitchBook data

    Args:
        file_path: Path to CSV file
        import_type: Type of import ('full', 'performance_only', 'quarterly_only')

    Returns:
        Import results dictionary
    """
    db = SessionLocal()
    try:
        importer = PitchBookImporter(db)
        return importer.import_from_csv(file_path, import_type)
    finally:
        db.close()

# CLI interface for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python pitchbook_importer.py <csv_file_path>")
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        results = import_pitchbook_data(file_path)
        print("Import completed successfully!")
        print(f"Results: {results}")
    except PitchBookImportError as e:
        print(f"Import failed: {e}")
        sys.exit(1)