"""
PitchBook PDF Parser Service

This module handles extracting benchmark data from PitchBook PDF reports and converting
it to the CSV format expected by the existing import system.

Supported PDF layouts:
- Standard PitchBook benchmark reports with performance tables
- Quarterly returns tables
- Various table layouts and formats

Dependencies: pdfplumber, pandas, re
"""

import pandas as pd
import numpy as np
import re
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, date
import logging
import io
import tempfile
import os

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class PDFParsingError(Exception):
    """Custom exception for PDF parsing errors"""
    pass

class PitchBookPDFParser:
    """
    Parser for PitchBook PDF reports that extracts comprehensive benchmark data
    including performance by vintage, multiples by vintage, multiples quantiles, and quarterly returns
    """

    # Asset class mapping from various naming conventions to our standard
    ASSET_CLASS_MAPPING = {
        'private equity': 'private_equity',
        'private_equity': 'private_equity',
        'pe': 'private_equity',
        'venture capital': 'venture_capital',
        'venture_capital': 'venture_capital',
        'vc': 'venture_capital',
        'real estate': 'real_estate',
        'real_estate': 'real_estate',
        're': 'real_estate',
        'real assets': 'infrastructure',  # Fixed: real assets -> infrastructure
        'real_assets': 'infrastructure',
        'infrastructure': 'infrastructure',
        'infrastructure core': 'infrastructure',
        'infrastructure core plus': 'infrastructure',
        'infrastructure value added': 'infrastructure',
        'infrastructure opportunistic': 'infrastructure',
        'infrastructure greenfield': 'infrastructure',
        'infrastructure debt': 'infrastructure',
        'oil & gas': 'natural_resources',  # Added: natural_resources
        'natural resources': 'natural_resources',
        'natural_resources': 'natural_resources',
        'oil and gas': 'natural_resources',
        'energy': 'natural_resources',
        'commodities': 'natural_resources',
        'private debt': 'private_debt',
        'private_debt': 'private_debt',
        'private credit': 'private_debt',
        'direct lending': 'private_debt',
        'bridge financing': 'private_debt',
        'distressed debt': 'private_debt',
        'credit special situations': 'private_debt',
        'venture debt': 'private_debt',
        'fund of funds': 'fund_of_funds',
        'fund_of_funds': 'fund_of_funds',
        'funds of funds': 'fund_of_funds',
        'fof': 'fund_of_funds',
        'secondaries': 'secondaries',
        'secondary': 'secondaries',
        'private capital': 'private_equity'  # Added: treat private capital as private_equity aggregate
    }

    # Metric code mapping from various naming conventions
    METRIC_MAPPING = {
        'irr': 'IRR',
        'internal rate of return': 'IRR',
        'net irr': 'IRR',
        'pme': 'PME',
        'public market equivalent': 'PME',
        'tvpi': 'TVPI',
        'total value to paid-in': 'TVPI',
        'total value / paid-in': 'TVPI',
        'tv/pi': 'TVPI',
        'dpi': 'DPI',
        'distributions to paid-in': 'DPI',
        'distributions / paid-in': 'DPI',
        'd/pi': 'DPI',
        'rvpi': 'RVPI',
        'residual value to paid-in': 'RVPI',
        'residual value / paid-in': 'RVPI',
        'rv/pi': 'RVPI'
    }

    # Common quartile column headers
    QUARTILE_PATTERNS = {
        'top_quartile': [
            r'top.*quartile', r'1st.*quartile', r'q1', r'first.*quartile',
            r'75th.*percentile', r'upper.*quartile', r'top.*25%'
        ],
        'median': [
            r'median', r'2nd.*quartile', r'q2', r'second.*quartile',
            r'50th.*percentile', r'middle.*quartile', r'mid'
        ],
        'bottom_quartile': [
            r'bottom.*quartile', r'3rd.*quartile', r'q3', r'third.*quartile',
            r'25th.*percentile', r'lower.*quartile', r'bottom.*25%'
        ]
    }

    def __init__(self):
        if pdfplumber is None:
            raise PDFParsingError("pdfplumber library not installed. Please install with: pip install pdfplumber")

    def extract_comprehensive_data_from_pdf(self, pdf_path: str, report_period: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract comprehensive benchmark data from a PitchBook PDF report

        This extracts all 4 table types:
        1. Performance by vintage (IRRs by vintage)
        2. Multiples by vintage (TVPI/DPI by vintage)
        3. Multiples quantiles (decile/quartile multiples)
        4. Quarterly returns

        Args:
            pdf_path: Path to the PDF file
            report_period: Report period (e.g., 'Q4-2024'). If None, will attempt to extract from PDF

        Returns:
            Dictionary containing all extracted benchmark data organized by type
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                results = {
                    'performance_by_vintage': [],
                    'multiples_by_vintage': [],
                    'multiples_quantiles': [],
                    'quarterly_returns': [],
                    'metadata': {
                        'report_period': report_period,
                        'extraction_date': datetime.now().isoformat(),
                        'total_pages': len(pdf.pages)
                    }
                }

                # Process each page systematically
                for page_num, page in enumerate(pdf.pages):
                    page_text = page.extract_text() or ""
                    logger.debug(f"Processing page {page_num + 1}")

                    # TEMPORARILY DISABLED: Check for targeted IRR tables on specific pages first
                    # actual_page_num = page_num + 1  # Convert to 1-based page numbering
                    # target_irr_pages = [12, 19, 26, 33, 40, 47, 54]

                    # if actual_page_num in target_irr_pages:
                    #     logger.debug(f"🎯 Attempting targeted IRR extraction on page {actual_page_num}")
                    #     irr_tables = self._extract_targeted_irr_tables(page, actual_page_num)

                    #     for irr_table in irr_tables:
                    #         # Process IRR table as performance_by_vintage
                    #         irr_data = self._extract_performance_by_vintage(irr_table, None, report_period)
                    #         results['performance_by_vintage'].extend(irr_data)
                    #         logger.debug(f"🎯 Targeted IRR extraction: {len(irr_data)} records from page {actual_page_num}")

                    # Extract tables from page using multiple strategies
                    page_tables = self._extract_tables_with_fallbacks(page)
                    if not page_tables:
                        continue

                    for table_idx, table in enumerate(page_tables):
                        # Clean and fix table
                        cleaned_table = self._clean_and_fix_table(table)
                        if not cleaned_table:
                            continue

                        # Determine table type - don't require asset class for identification
                        table_type = self._identify_table_type(cleaned_table, page_text)
                        fallback_asset_class = self._extract_asset_class_from_table(cleaned_table, page_text)

                        logger.debug(f"Page {page_num + 1}, Table {table_idx}: type={table_type}, fallback_asset_class={fallback_asset_class}")

                        # CRITICAL FIX: Extract data even if asset class detection fails
                        # Many tables contain multiple asset classes within their rows
                        if table_type:
                            data = []

                            if table_type == 'performance_by_vintage':
                                data = self._extract_performance_by_vintage(cleaned_table, fallback_asset_class, report_period)
                                results['performance_by_vintage'].extend(data)

                            elif table_type == 'multiples_by_vintage':
                                data = self._extract_multiples_by_vintage(cleaned_table, fallback_asset_class, report_period)
                                results['multiples_by_vintage'].extend(data)

                            elif table_type == 'multiples_quantiles':
                                data = self._extract_multiples_quantiles(cleaned_table, fallback_asset_class, report_period)
                                results['multiples_quantiles'].extend(data)

                            elif table_type == 'quarterly_returns':
                                # CRITICAL: quarterly tables contain ALL asset classes in rows
                                data = self._extract_quarterly_returns(cleaned_table, fallback_asset_class, report_period)
                                results['quarterly_returns'].extend(data)

                            logger.debug(f"Page {page_num + 1}, Table {table_idx}: {table_type} -> {len(data)} records")
                        else:
                            logger.debug(f"Page {page_num + 1}, Table {table_idx}: Skipped - no table type identified")
                            # Log table content for debugging unidentified tables
                            logger.debug(f"Unidentified table sample: {cleaned_table[:3] if cleaned_table else 'empty'}")

                # Determine report period if not provided
                if not results['metadata']['report_period']:
                    full_text = ''.join([page.extract_text() or '' for page in pdf.pages])
                    results['metadata']['report_period'] = self._extract_report_period(full_text)

                # Deduplicate results to prevent constraint violations
                results = self._deduplicate_extracted_data(results)

                return results

        except Exception as e:
            logger.error(f"Error extracting data from PDF: {str(e)}", exc_info=True)
            raise PDFParsingError(f"Failed to extract data from PDF: {str(e)}")




    def _extract_report_period(self, text: str) -> str:
        """Extract report period from PDF text"""
        # Look for patterns like "Q4 2024", "Q1-2025", "Fourth Quarter 2024"
        patterns = [
            r'Q([1-4])[- ]?(\d{4})',
            r'(\w+)\s+Quarter\s+(\d{4})',
            r'(\d{4})\s+Q([1-4])'
        ]

        quarter_map = {
            'first': '1', 'second': '2', 'third': '3', 'fourth': '4',
            '1st': '1', '2nd': '2', '3rd': '3', '4th': '4'
        }

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                match = matches[0]
                if pattern == patterns[1]:  # Word format
                    quarter_word = match[0].lower()
                    quarter_num = quarter_map.get(quarter_word, '4')
                    year = match[1]
                    return f"Q{quarter_num}-{year}"
                else:
                    if len(match) == 2:
                        return f"Q{match[0]}-{match[1]}"

        # Default to current quarter/year if can't extract
        current_date = datetime.now()
        quarter = ((current_date.month - 1) // 3) + 1
        return f"Q{quarter}-{current_date.year}"










    def _fix_merged_cells(self, table: List[List[str]]) -> List[List[str]]:
        """Fix tables where cells are merged into single columns (common PDF extraction issue)"""
        if not table or not table[0]:
            return table

        # Check if this looks like a merged cell table (few columns with lots of content)
        first_row = table[0]
        avg_cell_length = sum(len(str(cell)) for cell in first_row) / len(first_row) if first_row else 0

        # If we have very few columns but very long cell content, likely merged
        if len(first_row) <= 2 and avg_cell_length > 50:
            logger.debug(f"Detected merged cells: {len(first_row)} columns, avg length {avg_cell_length}")

            fixed_table = []
            for row in table:
                if not row:
                    continue

                fixed_row = []
                for cell in row:
                    if cell and isinstance(cell, str):
                        # Split on multiple spaces or common separators
                        # Look for patterns like "Strategy Q1 2025* Q4 2024 1-year 3-year"
                        parts = self._smart_split_cell(cell)
                        fixed_row.extend(parts)
                    else:
                        fixed_row.append(cell or '')

                if fixed_row:
                    fixed_table.append(fixed_row)

            # Validate the fix - all rows should have similar column counts
            if fixed_table:
                col_counts = [len(row) for row in fixed_table]
                most_common_count = max(set(col_counts), key=col_counts.count)

                # If most rows have the same column count and it's > original, use fixed version
                if most_common_count > len(first_row) and col_counts.count(most_common_count) >= len(col_counts) * 0.6:
                    logger.debug(f"Cell splitting successful: {len(first_row)} -> {most_common_count} columns")
                    return fixed_table

        return table

    def _smart_split_cell(self, cell: str) -> List[str]:
        """Intelligently split a merged cell into proper columns"""
        import re

        # Remove extra whitespace and normalize
        cell = ' '.join(cell.split())

        # Split on multiple patterns:
        # 1. Multiple spaces (2+)
        # 2. Before percentage values
        # 3. Before year patterns
        # 4. Before quarter patterns

        # First, protect certain patterns from being split
        protected_patterns = [
            r'Q[1-4]\s+20\d{2}\*?',  # Q1 2025*, Q4 2024
            r'\d+-year',              # 1-year, 3-year
            r'\d+\.\d+%',            # 7.50%
            r'Private\s+\w+',        # Private capital, Private equity
        ]

        # Create placeholders for protected patterns
        placeholders = {}
        protected_cell = cell
        for i, pattern in enumerate(protected_patterns):
            matches = re.finditer(pattern, protected_cell, re.IGNORECASE)
            for match in matches:
                placeholder = f"__PROTECTED_{i}_{len(placeholders)}__"
                placeholders[placeholder] = match.group()
                protected_cell = protected_cell.replace(match.group(), placeholder, 1)

        # Now split on multiple spaces or specific boundaries
        parts = re.split(r'\s{2,}|\s+(?=\d+\.\d+%|\d+-year|Q[1-4]\s+|\w+\s+20\d{2})', protected_cell)

        # Restore protected patterns
        final_parts = []
        for part in parts:
            restored_part = part
            for placeholder, original in placeholders.items():
                restored_part = restored_part.replace(placeholder, original)
            if restored_part.strip():
                final_parts.append(restored_part.strip())

        # If we didn't get good splits, fall back to simple space splitting with some intelligence
        if len(final_parts) <= 2:
            # Try splitting on spaces but preserve compound terms
            words = cell.split()
            final_parts = []
            i = 0
            while i < len(words):
                current = words[i]

                # Check for compound terms that should stay together
                if i + 1 < len(words):
                    compound = f"{words[i]} {words[i+1]}"
                    if any(pattern in compound.lower() for pattern in ['private capital', 'private equity', 'q1 2025', 'q4 2024']):
                        final_parts.append(compound)
                        i += 2
                        continue

                final_parts.append(current)
                i += 1

        return final_parts

    def _get_quarter_date(self, report_period: str) -> Optional[date]:
        """Convert report period (Q4-2024) to quarter start date (first day of quarter)"""
        try:
            if not report_period or '-' not in report_period:
                return None

            quarter_str, year_str = report_period.split('-')
            quarter_num = int(quarter_str.replace('Q', ''))
            year = int(year_str)

            # Map quarter to start month (first day of quarter)
            quarter_start_months = {1: 1, 2: 4, 3: 7, 4: 10}
            month = quarter_start_months.get(quarter_num, 1)

            # Always use first day of quarter month
            day = 1

            return date(year, month, day)
        except (ValueError, KeyError):
            return None

    def _extract_year(self, year_str: str) -> Optional[int]:
        """Extract year from string"""
        if not year_str:
            return None

        # Look for 4-digit year
        year_match = re.search(r'(\d{4})', str(year_str))
        if year_match:
            year = int(year_match.group(1))
            if 1990 <= year <= 2030:  # Reasonable range
                return year

        return None

    def _extract_numeric_value(self, row: List[str], col_idx: Optional[int]) -> Optional[float]:
        """Extract numeric value from table cell"""
        if col_idx is None or col_idx >= len(row):
            return None

        cell = row[col_idx]
        if not cell:
            return None

        # Clean the cell value
        cell = str(cell).strip()

        # Remove common formatting
        cell = re.sub(r'[%$,()]', '', cell)
        cell = cell.replace('—', '').replace('-', '').strip()

        if not cell or cell.lower() in ['n/a', 'na', 'nm', 'not available']:
            return None

        try:
            value = float(cell)

            # Convert percentages to decimals if value seems to be a percentage
            if value > 1 and value < 100:
                # Likely a percentage, convert to decimal
                return value / 100
            elif value > 100:
                # Very large percentage, convert to decimal
                return value / 100

            return value
        except (ValueError, TypeError):
            return None

    def _extract_integer_value(self, row: List[str], col_idx: Optional[int]) -> Optional[int]:
        """Extract integer value from table cell"""
        if col_idx is None or col_idx >= len(row):
            return None

        cell = row[col_idx]
        if not cell:
            return None

        # Clean the cell value
        cell = str(cell).strip()
        cell = re.sub(r'[,]', '', cell)  # Remove commas

        if not cell or cell.lower() in ['n/a', 'na', 'nm']:
            return None

        try:
            return int(float(cell))  # Convert via float to handle decimals
        except (ValueError, TypeError):
            return None

    def _standardize_asset_class(self, asset_str: str) -> str:
        """Standardize asset class name"""
        if not asset_str:
            return 'private_equity'

        asset_lower = asset_str.lower().strip()
        return self.ASSET_CLASS_MAPPING.get(asset_lower, 'private_equity')

    def _standardize_metric(self, metric_str: str) -> str:
        """Standardize metric code"""
        if not metric_str:
            return 'IRR'

        metric_lower = metric_str.lower().strip()
        return self.METRIC_MAPPING.get(metric_lower, 'IRR')

    def _parse_quarter_info(self, quarter_str: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse quarter information to extract quarter_year and quarter_date"""
        if not quarter_str:
            return None, None

        quarter_str = str(quarter_str).strip()

        # Look for patterns like "Q1 2020", "Q1-2020", "2020Q1", etc.
        patterns = [
            r'Q([1-4])[- ]?(\d{4})',
            r'(\d{4})[- ]?Q([1-4])',
            r'Q([1-4])',  # Just quarter number
            r'([1-4])Q'   # Quarter with Q suffix
        ]

        for pattern in patterns:
            match = re.search(pattern, quarter_str, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    if pattern == patterns[1]:  # Year first
                        year, quarter = groups
                    else:
                        quarter, year = groups
                else:
                    quarter = groups[0]
                    year = '2020'  # Default year if not found

                quarter_year = f"Q{quarter}-{year}"

                # Calculate quarter start date
                quarter_month = (int(quarter) - 1) * 3 + 1
                quarter_date = f"{year}-{quarter_month:02d}-01"

                return quarter_year, quarter_date

        return None, None



    # =====================================================
    # NEW COMPREHENSIVE EXTRACTION METHODS
    # =====================================================

    def _extract_targeted_irr_tables(self, page, page_num: int) -> List[List[List[Any]]]:
        """Extract IRR tables by searching for specific asset class headers"""
        try:
            page_text = page.extract_text()
            if not page_text:
                return []

            # Define the 7 asset classes and their expected patterns
            irr_patterns = [
                ('private equity', 'private equity IRRs by vintage'),
                ('venture capital', 'venture capital IRRs by vintage'),
                ('private debt', 'private debt IRRs by vintage'),
                ('real estate', 'real estate IRRs by vintage'),
                ('funds of funds', 'funds of funds IRRs by vintage'),
                ('secondaries', 'secondaries IRRs by vintage'),
                ('real assets', 'real assets IRRs by vintage')
            ]

            found_tables = []

            # Check if this page contains any of our target IRR tables
            for asset_class, pattern in irr_patterns:
                if pattern.lower() in page_text.lower():
                    logger.debug(f"Found IRR table pattern '{pattern}' on page {page_num}")

                    # Extract all tables from this page using multiple methods
                    page_tables = self._extract_tables_with_fallbacks(page)

                    # Find the table that's most likely the IRR table
                    irr_table = self._identify_irr_table(page_tables, asset_class, page_text)

                    if irr_table:
                        logger.debug(f"Successfully extracted {asset_class} IRR table with {len(irr_table)} rows")
                        found_tables.append(irr_table)
                    else:
                        logger.warning(f"Could not extract IRR table for {asset_class} on page {page_num}")

            return found_tables

        except Exception as e:
            logger.error(f"Targeted IRR extraction error on page {page_num}: {str(e)}")
            return []

    def _identify_irr_table(self, tables: List[List[List[Any]]], asset_class: str, page_text: str) -> Optional[List[List[Any]]]:
        """Identify which table is the IRR table based on content analysis"""
        if not tables:
            return None

        # Look for the table most likely to be an IRR table
        best_table = None
        best_score = 0

        for table in tables:
            if len(table) < 5:  # IRR tables should have at least 5 rows (header + data)
                continue

            score = 0

            # Check for typical IRR table characteristics
            for row in table[:5]:  # Check first 5 rows
                if not row:
                    continue

                row_text = ' '.join(str(cell).lower() for cell in row if cell)

                # Look for vintage years (2000-2025)
                if any(str(year) in row_text for year in range(2000, 2026)):
                    score += 3

                # Look for IRR-related terms
                irr_terms = ['irr', 'pooled', 'equal', 'weighted', 'decile', 'quartile', 'median']
                for term in irr_terms:
                    if term in row_text:
                        score += 2

                # Look for percentage signs or decimal numbers
                if '%' in row_text or any(c in row_text for c in ['0.', '1.', '2.']):
                    score += 1

            # Prefer tables with more columns (IRR tables typically have 8+ columns)
            if table and len(table[0]) >= 8:
                score += 5
            elif table and len(table[0]) >= 6:
                score += 2

            if score > best_score:
                best_score = score
                best_table = table

        return best_table

    def _extract_tables_html_style(self, page) -> List[List[List[Any]]]:
        """Direct adaptation of HTML parser's coordinate-based extraction logic"""
        try:
            # Get all characters from the page (equivalent to HTML parser's content.items)
            chars = page.chars
            if not chars or len(chars) < 10:
                return []

            logger.debug(f"HTML-style extraction: Found {len(chars)} characters")

            # Sort items by Y (top to bottom) then X (left to right) - EXACT HTML PARSER LOGIC
            # HTML: items.sort((a, b) => { if (Math.abs(a.transform[5] - b.transform[5]) > Y_TOLERANCE) return b.transform[5] - a.transform[5]; return a.transform[4] - b.transform[4]; })
            Y_TOLERANCE = 5
            sorted_chars = sorted(chars, key=lambda c: (
                round(-c['y0']), c['x0']  # Y descending (top first), then X ascending (left to right)
            ))

            # Group characters into lines based on Y-coordinate - EXACT HTML PARSER LOGIC
            lines = []
            current_line = []
            last_y = -1

            for char in sorted_chars:
                char_y = char['y0']
                if last_y == -1 or abs(char_y - last_y) < Y_TOLERANCE:
                    current_line.append(char)
                else:
                    if current_line:
                        # Sort line by X coordinate (left to right)
                        current_line.sort(key=lambda c: c['x0'])
                        lines.append(current_line)
                    current_line = [char]
                last_y = char_y

            # Add final line
            if current_line:
                current_line.sort(key=lambda c: c['x0'])
                lines.append(current_line)

            logger.debug(f"HTML-style extraction: Grouped into {len(lines)} lines")

            # Convert character lines to word lines (merge adjacent characters into words)
            word_lines = []
            for line in lines:
                words = []
                current_word = ""
                word_x0 = None

                for i, char in enumerate(line):
                    if current_word == "":
                        # Start new word
                        current_word = char['text']
                        word_x0 = char['x0']
                    else:
                        # Check if we should continue the current word or start a new one
                        prev_char = line[i-1] if i > 0 else None
                        if prev_char and char['x0'] - prev_char['x1'] <= 3:  # Within 3 points = same word
                            current_word += char['text']
                        else:
                            # Finish current word and start new one
                            if current_word.strip():
                                words.append(current_word.strip())
                            current_word = char['text']
                            word_x0 = char['x0']

                # Add final word
                if current_word.strip():
                    words.append(current_word.strip())

                if words:
                    word_lines.append(words)

            logger.debug(f"HTML-style extraction: Converted to {len(word_lines)} word lines")

            # Identify tables using EXACT HTML PARSER LOGIC
            tables = []
            potential_table = []

            for line in word_lines:
                # HTML: if (line.length > 1) - A table line has at least 2 distinct "columns"
                if len(line) > 1:
                    potential_table.append(line)
                else:
                    # HTML: if (potentialTable.length > 2) - A table must have at least 3 rows
                    if len(potential_table) > 2:
                        tables.append(potential_table)
                        logger.debug(f"HTML-style extraction: Found table with {len(potential_table)} rows")
                    potential_table = []

            # Check final potential table
            if len(potential_table) > 2:
                tables.append(potential_table)
                logger.debug(f"HTML-style extraction: Found final table with {len(potential_table)} rows")

            # Clean up and return - HTML: return tables.filter(table => table.every(row => row.length > 0))
            clean_tables = []
            for table in tables:
                if all(len(row) > 0 for row in table):
                    clean_tables.append(table)

            logger.debug(f"HTML-style extraction: Returning {len(clean_tables)} clean tables")
            return clean_tables

        except Exception as e:
            logger.error(f"HTML-style extraction error: {str(e)}")
            return []

    def _extract_tables_with_fallbacks(self, page) -> List[List[List[Any]]]:
        """Extract tables using multiple strategies as fallbacks - ENHANCED for comprehensive extraction"""
        try:
            all_valid_tables = []

            # Strategy 0: NEW - HTML-style extraction (direct port of HTML parser logic)
            logger.debug("Attempting HTML-style table extraction...")
            html_tables = self._extract_tables_html_style(page)
            for table in html_tables:
                if table and len(table) >= 3:  # At least header + 2 data rows
                    all_valid_tables.append(table)
                    logger.debug(f"HTML-style extraction added table with {len(table)} rows")

            # Strategy 1: Default extraction (lines-based) with multiple settings
            extraction_strategies = [
                # Default strategy
                {},
                # More sensitive to text positioning
                {
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "snap_tolerance": 5,
                    "join_tolerance": 5
                },
                # Less strict line detection
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "snap_tolerance": 10,
                    "join_tolerance": 10,
                    "edge_min_length": 1
                },
                # Text-based with larger tolerance
                {
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "snap_tolerance": 15,
                    "join_tolerance": 15
                },
                # Mixed strategy
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "text",
                    "snap_tolerance": 8,
                    "join_tolerance": 8
                }
            ]

            for i, settings in enumerate(extraction_strategies):
                try:
                    if settings:
                        tables = page.extract_tables(table_settings=settings)
                    else:
                        tables = page.extract_tables()

                    logger.debug(f"Strategy {i+1} extracted {len(tables)} raw tables")

                    for table in tables:
                        if table and len(table) > 0:
                            # More detailed validation
                            valid_rows = 0
                            for row in table:
                                if row and any(cell is not None and str(cell).strip() for cell in row):
                                    valid_rows += 1

                            if valid_rows >= 2:  # At least header + 1 data row
                                # Check if this is a new table or duplicate
                                is_duplicate = False
                                for existing_table in all_valid_tables:
                                    if self._tables_similar(table, existing_table):
                                        # If new table has more rows, replace the old one
                                        if len(table) > len(existing_table):
                                            all_valid_tables.remove(existing_table)
                                            all_valid_tables.append(table)
                                        is_duplicate = True
                                        break

                                if not is_duplicate:
                                    all_valid_tables.append(table)
                                    logger.debug(f"Strategy {i+1} added table with {len(table)} rows")

                except Exception as e:
                    logger.debug(f"Strategy {i+1} failed: {str(e)}")
                    continue

            # Sort tables by row count (prefer tables with more data)
            all_valid_tables.sort(key=len, reverse=True)

            if all_valid_tables:
                logger.debug(f"Total extraction successful: {len(all_valid_tables)} unique tables")
                for i, table in enumerate(all_valid_tables):
                    logger.debug(f"  Table {i+1}: {len(table)} rows x {len(table[0]) if table else 0} columns")
                return all_valid_tables

            logger.warning("All table extraction strategies failed")
            return []

        except Exception as e:
            logger.error(f"Table extraction error: {str(e)}")
            return []

    def _tables_similar(self, table1: List[List[Any]], table2: List[List[Any]], threshold: float = 0.7) -> bool:
        """Check if two tables are similar (to avoid duplicates)"""
        if not table1 or not table2:
            return False

        # Compare dimensions
        if abs(len(table1) - len(table2)) > 2:  # Allow small row differences
            return False

        if len(table1) == 0 or len(table2) == 0:
            return False

        if abs(len(table1[0]) - len(table2[0])) > 1:  # Allow small column differences
            return False

        # Compare first row content (headers)
        if len(table1) > 0 and len(table2) > 0:
            row1 = [str(cell).strip().lower() if cell else '' for cell in table1[0]]
            row2 = [str(cell).strip().lower() if cell else '' for cell in table2[0]]

            if row1 and row2:
                # Calculate similarity of first row
                min_len = min(len(row1), len(row2))
                matches = sum(1 for i in range(min_len) if row1[i] == row2[i])
                similarity = matches / max(len(row1), len(row2))
                return similarity >= threshold

        return False

    def _clean_and_fix_table(self, table: List[List[Any]]) -> List[List[str]]:
        """Clean table and fix merged cells - ENHANCED for better data preservation"""
        if not table:
            return []

        # Clean table data to handle None values - preserve more data
        cleaned_table = []
        for row_idx, row in enumerate(table):
            if row:  # Skip completely empty rows
                cleaned_row = []
                for cell in row:
                    if cell is not None:
                        cell_str = str(cell).strip()
                        # Preserve cells with meaningful content
                        if cell_str and cell_str not in ['', 'None', 'nan']:
                            cleaned_row.append(cell_str)
                        else:
                            cleaned_row.append('')
                    else:
                        cleaned_row.append('')

                # Only add rows that have at least some content
                if any(cell.strip() for cell in cleaned_row):
                    cleaned_table.append(cleaned_row)
                else:
                    logger.debug(f"Skipped empty row {row_idx}: {cleaned_row}")

        if not cleaned_table:
            return []

        logger.debug(f"Cleaned table: {len(cleaned_table)} rows (from {len(table)} original)")

        # Fix merged cells
        fixed_table = self._fix_merged_cells(cleaned_table)

        logger.debug(f"After merge fix: {len(fixed_table)} rows")
        return fixed_table

    def _extract_asset_class_from_text(self, text: str) -> Optional[str]:
        """Extract asset class from page text - DEPRECATED: Use table-specific detection instead"""
        # This method is now primarily used as a fallback
        # Most asset class detection should happen at the table level
        if not text:
            return None

        text_lower = text.lower()
        lines = text_lower.split('\n')

        # Look for asset class indicators in first few lines (but be more permissive)
        for line in lines[:15]:  # Increased from 10 to 15
            line = line.strip()
            for asset_pattern, asset_code in self.ASSET_CLASS_MAPPING.items():
                if asset_pattern in line and len(line) < 100:  # Increased from 50 to 100
                    return asset_code

        return None

    def _extract_asset_class_from_table(self, table: List[List[str]], page_text: str) -> Optional[str]:
        """Extract asset class from table content directly"""
        if not table:
            return None

        # Check all table content for asset class mentions
        table_text = ' '.join([
            ' '.join([str(cell) if cell else '' for cell in row])
            for row in table[:10]  # Check first 10 rows
        ]).lower()

        # Score each asset class by frequency in this specific table
        asset_scores = {}
        for asset_pattern, asset_code in self.ASSET_CLASS_MAPPING.items():
            count = table_text.count(asset_pattern)
            if count > 0:
                # Give higher scores to exact matches and full words
                if f' {asset_pattern} ' in f' {table_text} ':
                    count += 2  # Bonus for word boundaries
                asset_scores[asset_code] = count

        # Return the asset class with the highest score
        if asset_scores:
            best_asset = max(asset_scores.items(), key=lambda x: x[1])
            logger.debug(f"Table asset class scores: {asset_scores}, selected: {best_asset[0]}")
            return best_asset[0]

        # Fallback to page-based detection
        page_asset = self._extract_asset_class_from_text(page_text)
        if page_asset:
            logger.debug(f"Using page-based asset class fallback: {page_asset}")
            return page_asset

        return None

    def _identify_table_type(self, table: List[List[str]], page_text: str) -> Optional[str]:
        """Identify the type of table based on headers and context"""
        if not table or not table[0]:
            return None

        # Join all headers and first few data rows for analysis
        analysis_text = ' '.join([' '.join(str(cell) if cell else '' for cell in row) for row in table[:5]]).lower()
        page_text_lower = page_text.lower()

        # Enhanced table type identification based on actual PDF patterns
        # Look for specific column patterns that identify table types

        has_vintage_year = 'vintage year' in analysis_text
        has_pooled_irr = 'pooled irr' in analysis_text
        has_direct_alpha = 'direct alpha' in analysis_text or 'ks-pme' in analysis_text
        has_quartiles = any(term in analysis_text for term in ['top quartile', 'median irr', 'bottom quartile', 'top decile', 'bottom decile'])
        has_number_of_funds = 'number of funds' in analysis_text

        # Define multiples indicators
        has_tvpi = 'tvpi' in analysis_text
        has_dpi = 'dpi' in analysis_text
        has_rvpi = 'rvpi' in analysis_text
        has_tvpi_dpi = has_tvpi or has_dpi or has_rvpi

        # FIRST: Check for multiples quantiles (highest priority)
        # These have TVPI/DPI + deciles/quartiles
        if has_vintage_year and has_tvpi_dpi and has_quartiles and has_number_of_funds:
            logger.debug(f"Identified as multiples_quantiles: vintage={has_vintage_year}, multiples={has_tvpi_dpi}, quartiles={has_quartiles}, funds={has_number_of_funds}")
            return 'multiples_quantiles'

        # SECOND: Performance by vintage identification (IRR tables like Page 14)
        if has_vintage_year and (has_pooled_irr or has_direct_alpha) and has_number_of_funds:
            logger.debug(f"Identified as performance_by_vintage: vintage={has_vintage_year}, irr={has_pooled_irr}, alpha={has_direct_alpha}, funds={has_number_of_funds}")
            return 'performance_by_vintage'

        # THIRD: Alternative performance identification for IRR quantile-based tables
        if has_vintage_year and has_quartiles and has_number_of_funds and ('irr' in analysis_text):
            logger.debug(f"Identified as performance_by_vintage (IRR quantile format): vintage={has_vintage_year}, quartiles={has_quartiles}, funds={has_number_of_funds}")
            return 'performance_by_vintage'

        # Check for regular multiples tables (not quantiles)
        has_pooled_multiples = any(term in analysis_text for term in ['pooled tvpi', 'pooled dpi', 'pooled rvpi'])
        has_equal_weighted = 'equal weighted' in analysis_text or 'equal-weighted' in analysis_text

        if has_vintage_year and (has_tvpi_dpi or has_pooled_multiples) and not has_quartiles:
            logger.debug(f"Identified as multiples_by_vintage: vintage={has_vintage_year}, tvpi={has_tvpi}, dpi={has_dpi}")
            return 'multiples_by_vintage'

        # Check for quarterly returns - ENHANCED DETECTION
        quarterly_patterns = ['q1', 'q2', 'q3', 'q4', 'quarter', 'horizon', '1-year', '3-year', '5-year', '10-year', '15-year', '20-year']
        quarterly_matches = sum(1 for pattern in quarterly_patterns if pattern in analysis_text)

        # Enhanced: Check for horizon IRR tables (pages 8-9)
        horizon_indicators = ['horizon irr', 'strategy q1', 'strategy q4', 'equal-weighted horizon', 'private capital']
        has_horizon_irr = any(indicator in analysis_text for indicator in horizon_indicators)

        if quarterly_matches >= 2 or has_horizon_irr:
            logger.debug(f"Identified as quarterly_returns (quarterly_matches: {quarterly_matches}, horizon: {has_horizon_irr})")
            return 'quarterly_returns'

        # Debug: Log unidentified tables for analysis
        logger.debug(f"Table not identified. Analysis: vintage={has_vintage_year}, irr={has_pooled_irr}, alpha={has_direct_alpha}, tvpi={has_tvpi}, dpi={has_dpi}, quartiles={has_quartiles}, funds={has_number_of_funds}")
        logger.debug(f"Analysis text sample: {analysis_text[:200]}")
        return None

    def _extract_performance_by_vintage(self, table: List[List[str]], asset_class: str, report_period: str) -> List[Dict]:
        """Extract performance by vintage data (IRRs by vintage - page 12 format)"""
        results = []

        # Enhanced debug logging
        logger.debug(f"=== PERFORMANCE EXTRACTION START ===")
        logger.debug(f"Asset class: {asset_class}")
        logger.debug(f"Report period: {report_period}")
        logger.debug(f"Table size: {len(table) if table else 0} rows")

        if not table or len(table) < 2:
            logger.debug(f"Performance table too small or empty: {len(table) if table else 0} rows")
            return results

        # Debug: Log the entire table structure
        for i, row in enumerate(table[:5]):  # First 5 rows
            logger.debug(f"Row {i}: {row}")

        # Debug: Check asset class value
        if not asset_class or asset_class == 'None':
            logger.warning(f"Asset class is missing or None: '{asset_class}'")
            # Try to continue with a default
            asset_class = 'private_equity'

        # For performance tables, we know the structure from the debug data:
        # Column 0: Vintage Year
        # Column 1: "Pooled IRR Equal-weighted pooled IRR Number of funds" (3 values)
        # Column 2: "Top decile Top quartile Median IRR Bottom quartile Bottom decile Standard deviation Number of funds" (7 values)

        # Skip header row and process data rows in pairs (even + odd years)
        row_idx = 1
        while row_idx < len(table):
            row = table[row_idx]
            if not row or len(row) < 3:
                row_idx += 1
                continue

            # Check if this row has a vintage year (even year row)
            vintage_str = str(row[0]).strip()
            if vintage_str and vintage_str.isdigit():
                try:
                    even_vintage_year = int(vintage_str)
                    if even_vintage_year < 1980 or even_vintage_year > datetime.now().year:
                        row_idx += 1
                        continue

                    # Process even year row
                    logger.debug(f"Processing even year {even_vintage_year}, row: {row}")
                    even_record = self._parse_performance_vintage_row(row, asset_class, even_vintage_year, report_period)
                    logger.debug(f"Even year {even_vintage_year} parsed result: {even_record}")
                    if even_record:
                        results.append(even_record)
                        logger.debug(f"Added even year record, total results: {len(results)}")
                    else:
                        logger.warning(f"Even year {even_vintage_year} parsing failed")

                    # Check for odd year row immediately following
                    if row_idx + 1 < len(table):
                        next_row = table[row_idx + 1]
                        # Odd year rows have empty first column but data in columns 1 and 2 (and possibly more)
                        if next_row and len(next_row) >= 2 and (not next_row[0] or not str(next_row[0]).strip()):
                            # Check if next row has data (not empty) - check multiple columns
                            col1_data = str(next_row[1]).strip() if len(next_row) > 1 else ""
                            col2_data = str(next_row[2]).strip() if len(next_row) > 2 else ""

                            # Odd year row has data if either column 1 or 2 has content
                            if (col1_data and col1_data != "") or (col2_data and col2_data != ""):
                                odd_vintage_year = even_vintage_year + 1
                                odd_record = self._parse_performance_vintage_row(next_row, asset_class, odd_vintage_year, report_period)
                                if odd_record:
                                    results.append(odd_record)
                                row_idx += 2  # Skip both even and odd rows
                                continue

                    row_idx += 1  # Move to next row if no odd year row found

                except (ValueError, IndexError) as e:
                    logger.warning(f"Error processing performance row {row_idx}: {e}")
                    row_idx += 1
                    continue
            else:
                row_idx += 1  # Skip rows that don't start with a vintage year

        # Final debug logging
        logger.debug(f"=== PERFORMANCE EXTRACTION END ===")
        logger.debug(f"Total records extracted: {len(results)}")
        if results:
            logger.debug(f"Sample record: {results[0]}")
        else:
            logger.warning("No performance records extracted from table!")

        return results

    def _parse_performance_vintage_row(self, row: List[str], asset_class: str, vintage_year: int, report_period: str) -> Optional[Dict]:
        """Parse a single performance vintage row (for both even and odd years)

        The original logic was correct - the table has merged cells that get extracted as space-separated values.
        Going back to the original approach but with better odd year detection.
        """
        try:
            logger.debug(f"Parsing row for vintage {vintage_year}: {row}")
            logger.debug(f"Row length: {len(row)}, Asset class: {asset_class}")

            # Parse the merged column 1: "14.98% 12.30% 54" (Pooled IRR, Equal-weighted IRR, Number of funds)
            col1_data = str(row[1]).strip() if len(row) > 1 else ""
            col1_parts = col1_data.split() if col1_data else []

            pooled_irr = None
            equal_weighted_pooled_irr = None
            number_of_funds = None

            if len(col1_parts) >= 1:
                pooled_irr = self._parse_percentage_string(col1_parts[0])
            if len(col1_parts) >= 2:
                equal_weighted_pooled_irr = self._parse_percentage_string(col1_parts[1])
            if len(col1_parts) >= 3:
                number_of_funds = self._parse_integer_string(col1_parts[2])

            # Parse the merged column 2: "29.76% 22.70% 13.10% 6.00% -2.26% 12.07%" (Quantiles data)
            col2_data = str(row[2]).strip() if len(row) > 2 else ""
            col2_parts = col2_data.split() if col2_data else []

            top_decile = None
            top_quartile = None
            median_irr = None
            bottom_quartile = None
            bottom_decile = None
            standard_deviation = None

            if len(col2_parts) >= 1:
                top_decile = self._parse_percentage_string(col2_parts[0])
            if len(col2_parts) >= 2:
                top_quartile = self._parse_percentage_string(col2_parts[1])
            if len(col2_parts) >= 3:
                median_irr = self._parse_percentage_string(col2_parts[2])
            if len(col2_parts) >= 4:
                bottom_quartile = self._parse_percentage_string(col2_parts[3])
            if len(col2_parts) >= 5:
                bottom_decile = self._parse_percentage_string(col2_parts[4])
            if len(col2_parts) >= 6:
                standard_deviation = self._parse_percentage_string(col2_parts[5])

            record = {
                'asset_class': asset_class or 'private_equity',
                'vintage_year': vintage_year,
                'pooled_irr': pooled_irr,
                'equal_weighted_pooled_irr': equal_weighted_pooled_irr,
                'top_decile': top_decile,
                'top_quartile': top_quartile,
                'median_irr': median_irr,
                'bottom_quartile': bottom_quartile,
                'bottom_decile': bottom_decile,
                'standard_deviation': standard_deviation,
                'number_of_funds': number_of_funds,
                'quarter_end_date': self._get_quarter_date(report_period)
            }

            logger.debug(f"Extracted performance record for {asset_class} {vintage_year}: pooled_irr={record['pooled_irr']}, median_irr={record['median_irr']}")
            return record

        except (ValueError, IndexError) as e:
            logger.warning(f"Error parsing performance row for {asset_class} {vintage_year}: {e}")
            return None

    def _extract_multiples_by_vintage(self, table: List[List[str]], asset_class: str, report_period: str) -> List[Dict]:
        """Extract multiples by vintage data (TVPI/DPI by vintage - page 15 format)"""
        results = []

        if not table or len(table) < 2:
            return results

        # Find header row and column mappings
        header_info = self._find_multiples_headers(table)
        if not header_info:
            logger.warning("Could not identify multiples table headers")
            return results

        header_row = header_info['header_row']
        col_map = header_info['columns']

        # Process data rows with alternating year detection (same logic as performance)
        row_idx = header_row + 1
        while row_idx < len(table):
            row = table[row_idx]
            if not row or len(row) < 2:
                row_idx += 1
                continue

            # Check if this row has a vintage year (even year row)
            vintage_str = str(row[0]).strip()
            if vintage_str and vintage_str.isdigit():
                try:
                    even_vintage_year = int(vintage_str)
                    if even_vintage_year < 1980 or even_vintage_year > datetime.now().year:
                        row_idx += 1
                        continue

                    # Process even year row
                    logger.debug(f"Processing multiples even year {even_vintage_year}, row: {row}")
                    even_record = {
                        'asset_class': asset_class or 'private_equity',
                        'vintage_year': even_vintage_year,
                        'pooled_tvpi': self._extract_numeric_value(row, col_map.get('pooled_tvpi')),
                        'pooled_dpi': self._extract_numeric_value(row, col_map.get('pooled_dpi')),
                        'pooled_rvpi': self._extract_numeric_value(row, col_map.get('pooled_rvpi')),
                        'equal_weighted_tvpi': self._extract_numeric_value(row, col_map.get('equal_weighted_tvpi')),
                        'equal_weighted_dpi': self._extract_numeric_value(row, col_map.get('equal_weighted_dpi')),
                        'equal_weighted_rvpi': self._extract_numeric_value(row, col_map.get('equal_weighted_rvpi')),
                        'number_of_funds': self._extract_integer_value(row, col_map.get('number_of_funds')),
                        'quarter_end_date': self._get_quarter_date(report_period)
                    }

                    results.append(even_record)
                    logger.debug(f"Added multiples even year record, total results: {len(results)}")

                    # Check for odd year row immediately following
                    if row_idx + 1 < len(table):
                        next_row = table[row_idx + 1]
                        # Odd year rows have empty first column but data in other columns
                        if next_row and len(next_row) >= 2 and (not next_row[0] or not str(next_row[0]).strip()):
                            # Check if next row has data (not empty) - check multiple columns
                            col1_data = str(next_row[1]).strip() if len(next_row) > 1 else ""
                            col2_data = str(next_row[2]).strip() if len(next_row) > 2 else ""

                            # Odd year row has data if either column 1 or 2 has content
                            if (col1_data and col1_data != "") or (col2_data and col2_data != ""):
                                odd_vintage_year = even_vintage_year + 1
                                logger.debug(f"Processing multiples odd year {odd_vintage_year}, row: {next_row}")

                                odd_record = {
                                    'asset_class': asset_class or 'private_equity',
                                    'vintage_year': odd_vintage_year,
                                    'pooled_tvpi': self._extract_numeric_value(next_row, col_map.get('pooled_tvpi')),
                                    'pooled_dpi': self._extract_numeric_value(next_row, col_map.get('pooled_dpi')),
                                    'pooled_rvpi': self._extract_numeric_value(next_row, col_map.get('pooled_rvpi')),
                                    'equal_weighted_tvpi': self._extract_numeric_value(next_row, col_map.get('equal_weighted_tvpi')),
                                    'equal_weighted_dpi': self._extract_numeric_value(next_row, col_map.get('equal_weighted_dpi')),
                                    'equal_weighted_rvpi': self._extract_numeric_value(next_row, col_map.get('equal_weighted_rvpi')),
                                    'number_of_funds': self._extract_integer_value(next_row, col_map.get('number_of_funds')),
                                    'quarter_end_date': self._get_quarter_date(report_period)
                                }

                                results.append(odd_record)
                                logger.debug(f"Added multiples odd year record, total results: {len(results)}")
                                row_idx += 2  # Skip both even and odd rows
                                continue

                    row_idx += 1  # Move to next row if no odd year row found

                except (ValueError, IndexError) as e:
                    logger.warning(f"Error processing multiples row {row_idx}: {e}")
                    row_idx += 1
                    continue
            else:
                row_idx += 1  # Skip rows that don't start with a vintage year

        return results

    def _extract_multiples_quantiles(self, table: List[List[str]], asset_class: str, report_period: str) -> List[Dict]:
        """Extract multiples quantiles data (decile/quartile multiples - page 16 format)"""
        results = []

        if not table or len(table) < 2:
            return results

        # Find header row and column mappings
        header_info = self._find_multiples_quantiles_headers(table)
        if not header_info:
            logger.warning("Could not identify multiples quantiles table headers")
            return results

        header_row = header_info['header_row']
        col_map = header_info['columns']

        # Process data rows with alternating year detection (same logic as performance)
        row_idx = header_row + 1
        while row_idx < len(table):
            row = table[row_idx]
            if not row or len(row) < 2:
                row_idx += 1
                continue

            # Check if this row has a vintage year (even year row)
            vintage_str = str(row[0]).strip()
            if vintage_str and vintage_str.isdigit():
                try:
                    even_vintage_year = int(vintage_str)
                    if even_vintage_year < 1980 or even_vintage_year > datetime.now().year:
                        row_idx += 1
                        continue

                    # Process even year row
                    logger.debug(f"Processing quantiles even year {even_vintage_year}, row: {row}")

                    # Parse TVPI quantiles from concatenated column
                    tvpi_quantiles = {}
                    if col_map.get('tvpi_quantiles_column') is not None:
                        tvpi_cell = row[col_map['tvpi_quantiles_column']]
                        tvpi_quantiles = self._parse_quantile_values(tvpi_cell)

                    # Parse DPI quantiles from concatenated column
                    dpi_quantiles = {}
                    if col_map.get('dpi_quantiles_column') is not None:
                        dpi_cell = row[col_map['dpi_quantiles_column']]
                        dpi_quantiles = self._parse_quantile_values(dpi_cell)

                    even_record = {
                        'asset_class': asset_class or 'private_equity',
                        'vintage_year': even_vintage_year,
                        'tvpi_top_decile': tvpi_quantiles.get('top_decile'),
                        'tvpi_top_quartile': tvpi_quantiles.get('top_quartile'),
                        'tvpi_median': tvpi_quantiles.get('median'),
                        'tvpi_bottom_quartile': tvpi_quantiles.get('bottom_quartile'),
                        'tvpi_bottom_decile': tvpi_quantiles.get('bottom_decile'),
                        'dpi_top_decile': dpi_quantiles.get('top_decile'),
                        'dpi_top_quartile': dpi_quantiles.get('top_quartile'),
                        'dpi_median': dpi_quantiles.get('median'),
                        'dpi_bottom_quartile': dpi_quantiles.get('bottom_quartile'),
                        'dpi_bottom_decile': dpi_quantiles.get('bottom_decile'),
                        'number_of_funds': self._extract_integer_value(row, col_map.get('number_of_funds')),
                        'quarter_end_date': self._get_quarter_date(report_period)
                    }

                    results.append(even_record)
                    logger.debug(f"Added quantiles even year record, total results: {len(results)}")

                    # Check for odd year row immediately following
                    if row_idx + 1 < len(table):
                        next_row = table[row_idx + 1]
                        # Odd year rows have empty first column but data in other columns
                        if next_row and len(next_row) >= 2 and (not next_row[0] or not str(next_row[0]).strip()):
                            # Check if next row has data (not empty) - check multiple columns
                            col1_data = str(next_row[1]).strip() if len(next_row) > 1 else ""
                            col2_data = str(next_row[2]).strip() if len(next_row) > 2 else ""

                            # Odd year row has data if either column 1 or 2 has content
                            if (col1_data and col1_data != "") or (col2_data and col2_data != ""):
                                odd_vintage_year = even_vintage_year + 1
                                logger.debug(f"Processing quantiles odd year {odd_vintage_year}, row: {next_row}")

                                # Parse TVPI quantiles from concatenated column
                                odd_tvpi_quantiles = {}
                                if col_map.get('tvpi_quantiles_column') is not None:
                                    tvpi_cell = next_row[col_map['tvpi_quantiles_column']]
                                    odd_tvpi_quantiles = self._parse_quantile_values(tvpi_cell)

                                # Parse DPI quantiles from concatenated column
                                odd_dpi_quantiles = {}
                                if col_map.get('dpi_quantiles_column') is not None:
                                    dpi_cell = next_row[col_map['dpi_quantiles_column']]
                                    odd_dpi_quantiles = self._parse_quantile_values(dpi_cell)

                                odd_record = {
                                    'asset_class': asset_class or 'private_equity',
                                    'vintage_year': odd_vintage_year,
                                    'tvpi_top_decile': odd_tvpi_quantiles.get('top_decile'),
                                    'tvpi_top_quartile': odd_tvpi_quantiles.get('top_quartile'),
                                    'tvpi_median': odd_tvpi_quantiles.get('median'),
                                    'tvpi_bottom_quartile': odd_tvpi_quantiles.get('bottom_quartile'),
                                    'tvpi_bottom_decile': odd_tvpi_quantiles.get('bottom_decile'),
                                    'dpi_top_decile': odd_dpi_quantiles.get('top_decile'),
                                    'dpi_top_quartile': odd_dpi_quantiles.get('top_quartile'),
                                    'dpi_median': odd_dpi_quantiles.get('median'),
                                    'dpi_bottom_quartile': odd_dpi_quantiles.get('bottom_quartile'),
                                    'dpi_bottom_decile': odd_dpi_quantiles.get('bottom_decile'),
                                    'number_of_funds': self._extract_integer_value(next_row, col_map.get('number_of_funds')),
                                    'quarter_end_date': self._get_quarter_date(report_period)
                                }

                                results.append(odd_record)
                                logger.debug(f"Added quantiles odd year record, total results: {len(results)}")
                                row_idx += 2  # Skip both even and odd rows
                                continue

                    row_idx += 1  # Move to next row if no odd year row found

                except (ValueError, IndexError) as e:
                    logger.warning(f"Error processing multiples quantiles row {row_idx}: {e}")
                    row_idx += 1
                    continue
            else:
                row_idx += 1  # Skip rows that don't start with a vintage year

        return results

    def _extract_quarterly_returns(self, table: List[List[str]], asset_class: str, report_period: str) -> List[Dict]:
        """Extract quarterly returns data - ENHANCED for multi-asset-class tables"""
        results = []

        if not table or len(table) < 2:
            return results

        logger.debug(f"=== QUARTERLY EXTRACTION START ===\nTable size: {len(table)} rows")

        # Debug: Log the entire table structure
        for i, row in enumerate(table[:8]):  # First 8 rows
            logger.debug(f"Row {i}: {row[:6] if row else 'empty'}...")  # First 6 columns

        # Find header row and column mappings
        header_info = self._find_quarterly_headers(table)
        if not header_info:
            logger.debug("Could not find traditional quarterly headers, trying alternative detection")
            # Try alternative detection for horizon IRR tables
            header_info = self._find_horizon_irr_headers(table)
            if not header_info:
                logger.warning("Could not identify quarterly/horizon returns table headers")
                return results

        header_row = header_info['header_row']
        col_map = header_info['columns']

        logger.debug(f"Found headers at row {header_row}: {col_map}")

        # Process data rows - CRITICAL: Extract ALL asset classes from rows
        for row_idx in range(header_row + 1, len(table)):
            row = table[row_idx]
            if not row or len(row) < 2:
                continue

            # Extract asset class from first column - ENHANCED detection
            row_asset_class_raw = row[0].strip().lower() if row[0] else ''

            # Skip empty or header-like rows
            if not row_asset_class_raw or row_asset_class_raw in ['', 'strategy', 'asset class']:
                continue

            # Map to standard asset class
            if row_asset_class_raw in self.ASSET_CLASS_MAPPING:
                current_asset = self.ASSET_CLASS_MAPPING[row_asset_class_raw]
            else:
                # Fallback to provided asset class
                current_asset = asset_class or 'private_equity'
                logger.debug(f"Unknown asset class '{row_asset_class_raw}', using fallback: {current_asset}")

            logger.debug(f"Processing row {row_idx}: {row_asset_class_raw} -> {current_asset}")

            # Extract values for each time period column
            extracted_count = 0
            if col_map.get('time_period_columns'):
                # Time horizon format (Q1 2025, Q4 2024, 1-year, etc.)
                for time_col_idx in col_map['time_period_columns']:
                    if time_col_idx >= len(row):
                        continue

                    # Get time period from header
                    if time_col_idx < len(table[header_row]):
                        time_period = table[header_row][time_col_idx].strip()
                    else:
                        continue

                    # Extract return value
                    return_value = self._extract_percentage_value(row, time_col_idx)
                    if return_value is not None:
                        record = {
                            'asset_class': current_asset,
                            'time_period': time_period,
                            'return_value': return_value,
                            'quarter_end_date': self._get_quarter_date(report_period)
                        }
                        results.append(record)
                        extracted_count += 1
            else:
                # Traditional quarterly format
                if col_map.get('quarter') is not None:
                    quarter_value = self._extract_percentage_value(row, col_map['quarter'])
                    if quarter_value is not None:
                        record = {
                            'asset_class': current_asset,
                            'time_period': 'quarter',
                            'return_value': quarter_value,
                            'quarter_end_date': self._get_quarter_date(report_period)
                        }
                        results.append(record)
                        extracted_count += 1

            logger.debug(f"Row {row_idx} ({current_asset}): extracted {extracted_count} records")

        logger.debug(f"=== QUARTERLY EXTRACTION END ===\nTotal records extracted: {len(results)}")
        return results

    def _find_performance_headers(self, table: List[List[str]]) -> Optional[Dict]:
        """Find headers for performance by vintage tables"""
        for i, row in enumerate(table):
            if not row:
                continue

            row_lower = [cell.lower() if cell else '' for cell in row]
            row_text = ' '.join(row_lower)

            if 'vintage' in row_text and ('pooled irr' in row_text or 'top decile' in row_text):
                col_indices = {}

                for j, cell in enumerate(row_lower):
                    if 'vintage' in cell:
                        col_indices['vintage_year'] = j
                    elif 'pooled irr' in cell and 'equal' not in cell:
                        col_indices['pooled_irr'] = j
                    elif 'equal' in cell and 'pooled' in cell:
                        col_indices['equal_weighted_pooled_irr'] = j
                    elif 'top decile' in cell:
                        col_indices['top_decile'] = j
                    elif 'top quartile' in cell:
                        col_indices['top_quartile'] = j
                    elif 'median irr' in cell or cell == 'median':
                        col_indices['median_irr'] = j
                    elif 'bottom quartile' in cell:
                        col_indices['bottom_quartile'] = j
                    elif 'bottom decile' in cell:
                        col_indices['bottom_decile'] = j
                    elif 'standard deviation' in cell:
                        col_indices['standard_deviation'] = j
                    elif 'number of funds' in cell or cell == 'number':
                        col_indices['number_of_funds'] = j

                logger.debug(f"Found performance header at row {i}, columns found: {col_indices}")
                logger.debug(f"Header row content: {row}")
                return {'header_row': i, 'columns': col_indices}

        logger.debug("No performance headers found in table")
        return None

    def _find_quarterly_headers(self, table: List[List[str]]) -> Optional[Dict[str, Any]]:
        """Find header row and column indices for quarterly table"""
        for i, row in enumerate(table):
            if not row:
                continue

            row_lower = [cell.lower() if cell else '' for cell in row]
            row_text = ' '.join(row_lower)

            col_indices = {}
            time_period_columns = []

            # Enhanced detection for different quarterly table formats
            for j, cell in enumerate(row_lower):
                # Asset class/strategy column (typically first column)
                if any(pattern in cell for pattern in ['asset', 'class', 'strategy']) or j == 0:
                    col_indices['asset_class'] = j
                # Quarter columns (Q1 2025, Q4 2024, etc.)
                elif re.search(r'q[1-4]\s*20\d{2}', cell):
                    time_period_columns.append(j)
                # Time horizon columns (1-year, 3-year, etc.)
                elif re.search(r'\d+-year', cell):
                    time_period_columns.append(j)
                # Traditional quarter columns
                elif any(pattern in cell for pattern in ['quarter', 'q1', 'q2', 'q3', 'q4']):
                    col_indices['quarter'] = j
                elif any(re.search(pattern, cell) for pattern in self.QUARTILE_PATTERNS['top_quartile']):
                    col_indices['top_quartile'] = j
                elif any(re.search(pattern, cell) for pattern in self.QUARTILE_PATTERNS['median']):
                    col_indices['median'] = j
                elif any(re.search(pattern, cell) for pattern in self.QUARTILE_PATTERNS['bottom_quartile']):
                    col_indices['bottom_quartile'] = j
                elif 'sample' in cell or 'count' in cell:
                    col_indices['sample_size'] = j

            # Return if we found valid headers (traditional or time horizon format)
            # Traditional format: requires quarter column + quartile columns
            if 'quarter' in col_indices and any(k in col_indices for k in ['top_quartile', 'median', 'bottom_quartile']):
                return {
                    'header_row': i,
                    'columns': col_indices
                }

            # Time horizon format: requires asset_class column + time period columns
            elif 'asset_class' in col_indices and time_period_columns:
                col_indices['time_period_columns'] = time_period_columns
                col_indices['is_time_horizon'] = True
                return {
                    'header_row': i,
                    'columns': col_indices
                }

        return None

    def _find_horizon_irr_headers(self, table: List[List[str]]) -> Optional[Dict[str, Any]]:
        """Find headers for horizon IRR tables (pages 8-9 format)"""
        for i, row in enumerate(table[:5]):  # Check first 5 rows
            if not row:
                continue

            row_text = ' '.join([str(cell).lower() if cell else '' for cell in row])

            # Look for horizon IRR table patterns
            if ('strategy' in row_text and any(pattern in row_text for pattern in ['q1 2025', 'q4 2024', '1-year', '3-year'])):
                # This looks like a horizon IRR header row
                col_indices = {'asset_class': 0}  # First column is asset class/strategy
                time_period_columns = []

                # Find all time period columns
                for j, cell in enumerate(row):
                    if j == 0:  # Skip first column (asset class)
                        continue
                    cell_lower = str(cell).lower() if cell else ''
                    if any(pattern in cell_lower for pattern in ['q1', 'q2', 'q3', 'q4', 'year']):
                        time_period_columns.append(j)

                if time_period_columns:
                    col_indices['time_period_columns'] = time_period_columns
                    col_indices['is_time_horizon'] = True
                    logger.debug(f"Found horizon IRR headers at row {i}: {time_period_columns} time columns")
                    return {
                        'header_row': i,
                        'columns': col_indices
                    }

        return None

    def _find_multiples_headers(self, table: List[List[str]]) -> Optional[Dict]:
        """Find headers for multiples by vintage tables"""
        for i, row in enumerate(table):
            if not row:
                continue

            row_lower = [cell.lower() if cell else '' for cell in row]
            row_text = ' '.join(row_lower)

            if 'vintage' in row_text and 'tvpi' in row_text:
                col_indices = {}

                for j, cell in enumerate(row_lower):
                    if 'vintage' in cell:
                        col_indices['vintage_year'] = j
                    elif 'pooled' in cell and 'tvpi' in cell:
                        col_indices['pooled_tvpi'] = j
                    elif 'pooled' in cell and 'dpi' in cell:
                        col_indices['pooled_dpi'] = j
                    elif 'pooled' in cell and 'rvpi' in cell:
                        col_indices['pooled_rvpi'] = j
                    elif 'equal' in cell and 'tvpi' in cell:
                        col_indices['equal_weighted_tvpi'] = j
                    elif 'equal' in cell and 'dpi' in cell:
                        col_indices['equal_weighted_dpi'] = j
                    elif 'equal' in cell and 'rvpi' in cell:
                        col_indices['equal_weighted_rvpi'] = j
                    elif 'number of funds' in cell or cell == 'number':
                        col_indices['number_of_funds'] = j

                return {'header_row': i, 'columns': col_indices}

        return None

    def _find_multiples_quantiles_headers(self, table: List[List[str]]) -> Optional[Dict]:
        """Find headers for multiples quantiles tables"""
        for i, row in enumerate(table):
            if not row:
                continue

            row_lower = [cell.lower() if cell else '' for cell in row]
            row_text = ' '.join(row_lower)

            # Look for the specific quantiles header pattern with concatenated values
            if 'vintage' in row_text and 'tvpi' in row_text and 'top decile' in row_text and 'median' in row_text:
                col_indices = {}

                for j, cell in enumerate(row_lower):
                    if 'vintage' in cell:
                        col_indices['vintage_year'] = j
                    elif 'tvpi' in cell and 'top decile' in cell and 'median' in cell:
                        # This column contains all TVPI quantiles: "Top decile Top quartile Median TVPI Bottom quartile Bottom decile"
                        col_indices['tvpi_quantiles_column'] = j
                    elif 'dpi' in cell and 'top decile' in cell and 'median' in cell:
                        # This column contains all DPI quantiles: "Top decile Top quartile Median DPI Bottom quartile Bottom decile"
                        col_indices['dpi_quantiles_column'] = j
                    elif 'number of funds' in cell or cell == 'number':
                        col_indices['number_of_funds'] = j

                if 'vintage_year' in col_indices and ('tvpi_quantiles_column' in col_indices or 'dpi_quantiles_column' in col_indices):
                    return {'header_row': i, 'columns': col_indices}

        return None

    def _parse_quantile_values(self, cell_value: str) -> Dict[str, Optional[float]]:
        """Parse concatenated quantile values like '2.78x 2.26x 1.86x 1.39x 0.98x'"""
        if not cell_value:
            return {}

        # Split by spaces and clean values
        values = []
        parts = cell_value.strip().split()
        for part in parts:
            # Clean the value (remove x, commas, etc.)
            clean_part = re.sub(r'[x×,]', '', part.strip())
            try:
                if clean_part and clean_part not in ['-', 'n/a', 'na']:
                    value = float(clean_part)
                    # Reasonable range for multiples
                    if 0.01 <= value <= 50:
                        values.append(value)
                    else:
                        values.append(None)
                else:
                    values.append(None)
            except (ValueError, TypeError):
                values.append(None)

        # Map to quantile positions (expecting 5 values: top_decile, top_quartile, median, bottom_quartile, bottom_decile)
        quantiles = {}
        if len(values) >= 5:
            quantiles['top_decile'] = values[0]
            quantiles['top_quartile'] = values[1]
            quantiles['median'] = values[2]
            quantiles['bottom_quartile'] = values[3]
            quantiles['bottom_decile'] = values[4]
        elif len(values) >= 3:
            # Sometimes only 3 values: top_quartile, median, bottom_quartile
            quantiles['top_quartile'] = values[0]
            quantiles['median'] = values[1]
            quantiles['bottom_quartile'] = values[2]

        return quantiles

    def _extract_percentage_value(self, row: List[str], col_idx: Optional[int]) -> Optional[float]:
        """Extract percentage value from table cell (for IRR and returns)"""
        if col_idx is None or col_idx >= len(row):
            logger.debug(f"Invalid column index: {col_idx}, row length: {len(row) if row else 0}")
            return None

        cell = row[col_idx]
        if not cell:
            logger.debug(f"Empty cell at column {col_idx}")
            return None

        # Clean the cell value
        original_cell = str(cell).strip()
        cell = re.sub(r'[,%]', '', original_cell)  # Remove commas and % symbols

        if not cell or cell.lower() in ['n/a', 'na', 'nm', '-']:
            logger.debug(f"Skipping empty/invalid cell: '{original_cell}'")
            return None

        try:
            value = float(cell)
            # Convert percentage to decimal if needed (flexible validation)
            if value > 100:
                value = value / 100
            elif value < -5:  # Very negative percentages
                value = value / 100

            # Accept reasonable range for private markets returns (-95% to +200%)
            if -0.95 <= value <= 2.0:
                logger.debug(f"Extracted percentage value: '{original_cell}' -> {value}")
                return value
            else:
                logger.debug(f"Value out of range: '{original_cell}' -> {value}")
                return None
        except (ValueError, TypeError):
            return None

    def _parse_percentage_string(self, value_str: str) -> Optional[float]:
        """Parse a percentage string like '14.98%' into a float"""
        if not value_str:
            return None

        # Clean the string
        cleaned = str(value_str).strip().replace('%', '').replace(',', '')

        if not cleaned or cleaned.lower() in ['n/a', 'na', 'nm', '-']:
            return None

        try:
            value = float(cleaned)
            # Always convert to decimal if it looks like a percentage
            # Check if original string had % symbol OR if value seems like percentage
            original_had_percent = '%' in str(value_str)
            looks_like_percentage = abs(value) > 1 or original_had_percent

            if looks_like_percentage:
                value = value / 100
            return value
        except (ValueError, TypeError):
            return None

    def _parse_integer_string(self, value_str: str) -> Optional[int]:
        """Parse an integer string like '54' into an int"""
        if not value_str:
            return None

        # Clean the string
        cleaned = str(value_str).strip().replace(',', '')

        if not cleaned or cleaned.lower() in ['n/a', 'na', 'nm', '-']:
            return None

        try:
            return int(cleaned)
        except (ValueError, TypeError):
            return None

    def _extract_numeric_value(self, row: List[str], col_idx: Optional[int]) -> Optional[float]:
        """Extract numeric value from table cell (for multiples like TVPI, DPI)"""
        if col_idx is None or col_idx >= len(row):
            return None

        cell = row[col_idx]
        if not cell:
            return None

        # Clean the cell value
        cell = str(cell).strip()
        cell = re.sub(r'[,x×]', '', cell)  # Remove commas and x symbols

        if not cell or cell.lower() in ['n/a', 'na', 'nm', '-']:
            return None

        try:
            value = float(cell)
            # Multiples should be reasonable values (0.01 to 50x)
            if 0.01 <= value <= 50:
                return value
            return None
        except (ValueError, TypeError):
            return None

    def _deduplicate_extracted_data(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove duplicate records from extracted data based on unique constraints

        Deduplication rules:
        - Performance by vintage: unique by asset_class + vintage_year + quarter_end_date
        - Multiples by vintage: unique by asset_class + vintage_year + quarter_end_date
        - Multiples quantiles: unique by asset_class + vintage_year + quarter_end_date
        - Quarterly returns: unique by asset_class + time_period + quarter_end_date
        """
        logger.info("Deduplicating extracted data to prevent constraint violations")

        # Deduplicate performance by vintage
        seen_perf = set()
        deduped_perf = []
        for record in results.get('performance_by_vintage', []):
            key = (record.get('asset_class'), record.get('vintage_year'), record.get('quarter_end_date'))
            if key not in seen_perf:
                seen_perf.add(key)
                deduped_perf.append(record)
            else:
                logger.debug(f"Skipping duplicate performance record: {key}")

        # Deduplicate multiples by vintage
        seen_mult = set()
        deduped_mult = []
        for record in results.get('multiples_by_vintage', []):
            key = (record.get('asset_class'), record.get('vintage_year'), record.get('quarter_end_date'))
            if key not in seen_mult:
                seen_mult.add(key)
                deduped_mult.append(record)
            else:
                logger.debug(f"Skipping duplicate multiples record: {key}")

        # Deduplicate multiples quantiles
        seen_quant = set()
        deduped_quant = []
        for record in results.get('multiples_quantiles', []):
            key = (record.get('asset_class'), record.get('vintage_year'), record.get('quarter_end_date'))
            if key not in seen_quant:
                seen_quant.add(key)
                deduped_quant.append(record)
            else:
                logger.debug(f"Skipping duplicate quantiles record: {key}")

        # Deduplicate quarterly returns
        seen_qrtly = set()
        deduped_qrtly = []
        for record in results.get('quarterly_returns', []):
            key = (record.get('asset_class'), record.get('time_period'), record.get('quarter_end_date'))
            if key not in seen_qrtly:
                seen_qrtly.add(key)
                deduped_qrtly.append(record)
            else:
                logger.debug(f"Skipping duplicate quarterly record: {key}")

        # Update results with deduplicated data
        deduped_results = results.copy()
        deduped_results['performance_by_vintage'] = deduped_perf
        deduped_results['multiples_by_vintage'] = deduped_mult
        deduped_results['multiples_quantiles'] = deduped_quant
        deduped_results['quarterly_returns'] = deduped_qrtly

        # Log deduplication stats
        orig_counts = {
            'performance': len(results.get('performance_by_vintage', [])),
            'multiples': len(results.get('multiples_by_vintage', [])),
            'quantiles': len(results.get('multiples_quantiles', [])),
            'quarterly': len(results.get('quarterly_returns', []))
        }
        deduped_counts = {
            'performance': len(deduped_perf),
            'multiples': len(deduped_mult),
            'quantiles': len(deduped_quant),
            'quarterly': len(deduped_qrtly)
        }

        logger.info(f"Deduplication results:")
        logger.info(f"  Performance: {orig_counts['performance']} -> {deduped_counts['performance']} ({orig_counts['performance'] - deduped_counts['performance']} duplicates removed)")
        logger.info(f"  Multiples: {orig_counts['multiples']} -> {deduped_counts['multiples']} ({orig_counts['multiples'] - deduped_counts['multiples']} duplicates removed)")
        logger.info(f"  Quantiles: {orig_counts['quantiles']} -> {deduped_counts['quantiles']} ({orig_counts['quantiles'] - deduped_counts['quantiles']} duplicates removed)")
        logger.info(f"  Quarterly: {orig_counts['quarterly']} -> {deduped_counts['quarterly']} ({orig_counts['quarterly'] - deduped_counts['quarterly']} duplicates removed)")

        return deduped_results

def extract_pitchbook_pdf(pdf_path: str, report_period: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to extract comprehensive data from a PitchBook PDF

    Args:
        pdf_path: Path to the PDF file
        report_period: Report period (optional)

    Returns:
        Extracted data dictionary
    """
    parser = PitchBookPDFParser()
    return parser.extract_comprehensive_data_from_pdf(pdf_path, report_period)


# CLI interface for testing

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python pdf_parser.py <pdf_file_path> [report_period]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    report_period = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        # Use the comprehensive extraction method
        data = extract_pitchbook_pdf(pdf_file, report_period=report_period)
        print(f"Successfully extracted data from PDF: {pdf_file}")
        print(f"Performance records: {len(data.get('performance_by_vintage', []))}")
        print(f"Multiples records: {len(data.get('multiples_by_vintage', []))}")
        print(f"Quantiles records: {len(data.get('multiples_quantiles', []))}")
        print(f"Quarterly records: {len(data.get('quarterly_returns', []))}")
    except PDFParsingError as e:
        print(f"PDF parsing failed: {e}")
        sys.exit(1)