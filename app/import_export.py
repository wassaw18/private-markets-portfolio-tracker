"""
Import/Export functionality for portfolio data
"""
from typing import List, Dict, Any, Tuple
import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from app import models, schemas, crud
from app.models import AssetClass, InvestmentStructure, LiquidityProfile, ReportingFrequency, RiskRating, TaxClassification, ActivityClassification
import logging

logger = logging.getLogger(__name__)

class ImportResult:
    """Result of import operation"""
    def __init__(self):
        self.success_count = 0
        self.error_count = 0
        self.errors = []
        self.warnings = []
        
    def add_success(self):
        self.success_count += 1
        
    def add_error(self, row: int, message: str):
        self.error_count += 1
        self.errors.append({"row": row, "message": message})
        
    def add_warning(self, row: int, message: str):
        self.warnings.append({"row": row, "message": message})

def validate_and_convert_row(row: Dict[str, Any], row_num: int, force_upload: bool = False) -> Tuple[schemas.InvestmentCreate, List[str]]:
    """Validate and convert a row to InvestmentCreate schema with full 32-field support"""
    errors = []
    
    from datetime import date, datetime
    from app.models import LiquidityProfile, ReportingFrequency, RiskRating, TaxClassification, ActivityClassification
    
    def get_field_value(field_name: str, *alternatives):
        """Helper to get field value with fallbacks"""
        for field in [field_name] + list(alternatives):
            if field in row and pd.notna(row[field]) and row[field] != "":
                return row[field]
        return None
    
    def parse_date(date_str, field_name: str):
        """Helper to parse dates consistently"""
        if not date_str or pd.isna(date_str):
            return None
        try:
            if isinstance(date_str, str):
                return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
            elif isinstance(date_str, datetime):
                return date_str.date()
            elif isinstance(date_str, date):
                return date_str
        except (ValueError, AttributeError):
            errors.append(f"Invalid {field_name} format: {date_str}. Use YYYY-MM-DD")
        return None
    
    def parse_float(value, field_name: str, default_val: float = 0.0):
        """Helper to parse float values"""
        if not value or pd.isna(value) or value == "":
            return default_val
        try:
            return float(value)
        except (ValueError, TypeError):
            errors.append(f"Invalid {field_name}: {value} must be numeric")
            return default_val
    
    def parse_percentage(value, field_name: str):
        """Helper to parse percentage values (converts % to decimal)"""
        if not value or pd.isna(value) or value == "":
            return None
        try:
            val = float(value)
            # If value is likely a percentage (>1), convert to decimal
            if val > 1:
                val = val / 100.0
            return val
        except (ValueError, TypeError):
            errors.append(f"Invalid {field_name}: {value} must be numeric")
            return None
    
    try:
        # ============ REQUIRED FIELDS ============
        
        # Investment Name* (Required)
        name = get_field_value('name', 'Investment Name')
        if not name:
            if force_upload:
                name = f"Investment_{row_num}"
                errors.append(f"Missing name - using default: {name}")
            else:
                errors.append("Missing required field: name")
        
        # Asset Class* (Required)
        asset_class_str = get_field_value('asset_class', 'Asset Class')
        asset_class = None
        if asset_class_str:
            # Enhanced mapping to handle exact enum values from template
            asset_class_mapping = {
                'PUBLIC_EQUITY': AssetClass.PUBLIC_EQUITY,
                'PUBLIC_FIXED_INCOME': AssetClass.PUBLIC_FIXED_INCOME,
                'PRIVATE_EQUITY': AssetClass.PRIVATE_EQUITY,
                'VENTURE_CAPITAL': AssetClass.VENTURE_CAPITAL,
                'PRIVATE_CREDIT': AssetClass.PRIVATE_CREDIT,
                'REAL_ESTATE': AssetClass.REAL_ESTATE,
                'REAL_ASSETS': AssetClass.REAL_ASSETS,
                'CASH_AND_EQUIVALENTS': AssetClass.CASH_AND_EQUIVALENTS,
                # Backward compatibility
                'public equity': AssetClass.PUBLIC_EQUITY,
                'private equity': AssetClass.PRIVATE_EQUITY,
                'venture capital': AssetClass.VENTURE_CAPITAL,
                'private credit': AssetClass.PRIVATE_CREDIT,
                'real estate': AssetClass.REAL_ESTATE,
                'real assets': AssetClass.REAL_ASSETS,
                'cash': AssetClass.CASH_AND_EQUIVALENTS,
            }
            asset_class = asset_class_mapping.get(str(asset_class_str).strip())
        
        if not asset_class:
            if force_upload:
                asset_class = AssetClass.PRIVATE_EQUITY
                errors.append("Invalid/missing asset_class - using default: PRIVATE_EQUITY")
            else:
                errors.append(f"Invalid or missing asset_class: {asset_class_str}")
        
        # Investment Structure* (Required)
        structure_str = get_field_value('investment_structure', 'Investment Structure')
        structure_mapping = {
            'LIMITED_PARTNERSHIP': InvestmentStructure.LIMITED_PARTNERSHIP,
            'DIRECT_INVESTMENT': InvestmentStructure.DIRECT_INVESTMENT,
            'CO_INVESTMENT': InvestmentStructure.CO_INVESTMENT,
            'FUND_OF_FUNDS': InvestmentStructure.FUND_OF_FUNDS,
            'SEPARATE_ACCOUNT': InvestmentStructure.SEPARATE_ACCOUNT,
            'HEDGE_FUND': InvestmentStructure.HEDGE_FUND,
            'PUBLIC_MARKETS': InvestmentStructure.PUBLIC_MARKETS,
            'BANK_ACCOUNT': InvestmentStructure.BANK_ACCOUNT,
            'LOAN': InvestmentStructure.LOAN,
            # Backward compatibility
            'limited partnership': InvestmentStructure.LIMITED_PARTNERSHIP,
            'fund of funds': InvestmentStructure.FUND_OF_FUNDS,
            'co-investment': InvestmentStructure.CO_INVESTMENT,
        }
        investment_structure = structure_mapping.get(str(structure_str).strip() if structure_str else '', InvestmentStructure.LIMITED_PARTNERSHIP)
        
        # Entity ID* (Required by backend but not in Excel template - use default)
        # Note: Excel template doesn't include entity_id field since frontend uses EntitySelector dropdown
        # Future enhancement: Allow entity selection by name in Excel and map to ID during import
        entity_id = 1  # Default to first entity
        if force_upload:
            errors.append("Entity ID defaulted to 1 - please assign correct entity after import")
        # Note: We don't add this as an error for normal upload since it's not expected in Excel
        
        # Manager (Optional)
        manager = get_field_value('manager', 'Manager') or None
        
        # Strategy* (Required)
        strategy = get_field_value('strategy', 'Strategy')
        if not strategy:
            if force_upload:
                strategy = "General Investment Strategy"
                errors.append("Missing strategy - using default: General Investment Strategy")
            else:
                errors.append("Missing required field: strategy")
        
        # Vintage Year* (Required)
        vintage_year_val = get_field_value('vintage_year', 'Vintage Year')
        try:
            vintage_year = int(vintage_year_val) if vintage_year_val else None
            if not vintage_year:
                if force_upload:
                    vintage_year = 2024
                    errors.append("Missing vintage_year - using default: 2024")
                else:
                    errors.append("Missing required field: vintage_year")
        except (ValueError, TypeError):
            if force_upload:
                vintage_year = 2024
                errors.append("Invalid vintage_year - using default: 2024")
            else:
                errors.append("Invalid vintage_year: must be integer")
        
        # Target Raise (Optional)
        target_raise = parse_float(get_field_value('target_raise', 'Target Raise'), 'target_raise', None)
        
        # Geography Focus (Optional)
        geography_focus = get_field_value('geography_focus', 'Geography Focus') or None
        
        # Commitment Amount* (Required)
        commitment_amount_val = get_field_value('commitment_amount', 'Commitment Amount')
        try:
            commitment_amount = float(commitment_amount_val) if commitment_amount_val else None
            if not commitment_amount:
                if force_upload:
                    commitment_amount = 1000000.0
                    errors.append("Missing commitment_amount - using default: 1,000,000")
                else:
                    errors.append("Missing required field: commitment_amount")
        except (ValueError, TypeError):
            if force_upload:
                commitment_amount = 1000000.0
                errors.append("Invalid commitment_amount - using default: 1,000,000")
            else:
                errors.append("Invalid commitment_amount: must be number")
        
        # Commitment Date* (Required)
        commitment_date_val = get_field_value('commitment_date', 'Commitment Date')
        commitment_date = parse_date(commitment_date_val, 'commitment_date')
        if not commitment_date:
            if force_upload:
                commitment_date = date.today()
                errors.append(f"Missing commitment_date - using today: {commitment_date}")
            else:
                errors.append("Missing required field: commitment_date")
        
        # ============ OPTIONAL FINANCIAL FIELDS ============
        
        # Financial percentages (convert from percentage to decimal)
        management_fee = parse_percentage(get_field_value('management_fee', 'Management Fee (%)'), 'management_fee')
        performance_fee = parse_percentage(get_field_value('performance_fee', 'Performance Fee (%)'), 'performance_fee')
        hurdle_rate = parse_percentage(get_field_value('hurdle_rate', 'Hurdle Rate (%)'), 'hurdle_rate')
        
        # Distribution Target (Optional text)
        distribution_target = get_field_value('distribution_target', 'Distribution Target') or None
        
        # Currency (Optional, default USD)
        currency = get_field_value('currency', 'Currency') or "USD"
        
        # Liquidity Profile* (Required with default)
        liquidity_str = get_field_value('liquidity_profile', 'Liquidity Profile')
        liquidity_mapping = {
            'ILLIQUID': LiquidityProfile.ILLIQUID,
            'SEMI_LIQUID': LiquidityProfile.SEMI_LIQUID,
            'LIQUID': LiquidityProfile.LIQUID,
        }
        liquidity_profile = liquidity_mapping.get(str(liquidity_str).strip() if liquidity_str else '', LiquidityProfile.ILLIQUID)
        
        # ============ OPTIONAL OPERATIONAL FIELDS ============
        
        expected_maturity_date = parse_date(get_field_value('expected_maturity_date', 'Expected Maturity Date'), 'expected_maturity_date')
        
        # Reporting Frequency (Optional)
        reporting_freq_str = get_field_value('reporting_frequency', 'Reporting Frequency')
        reporting_freq_mapping = {
            'MONTHLY': ReportingFrequency.MONTHLY,
            'QUARTERLY': ReportingFrequency.QUARTERLY,
            'SEMI_ANNUALLY': ReportingFrequency.SEMI_ANNUALLY,
            'ANNUALLY': ReportingFrequency.ANNUALLY,
        }
        reporting_frequency = reporting_freq_mapping.get(str(reporting_freq_str).strip() if reporting_freq_str else '', None)
        
        # Contact fields
        contact_person = get_field_value('contact_person', 'Contact Person') or None
        email = get_field_value('email', 'Email') or None
        portal_link = get_field_value('portal_link', 'Portal Link') or None
        fund_administrator = get_field_value('fund_administrator', 'Fund Administrator') or None
        
        # ============ OPTIONAL LEGAL & RISK FIELDS ============
        
        fund_domicile = get_field_value('fund_domicile', 'Fund Domicile') or None
        
        # Tax Classification (Optional)
        tax_class_str = get_field_value('tax_classification', 'Tax Classification')
        tax_class_mapping = {
            '1099': TaxClassification.FORM_1099,
            'K-1': TaxClassification.K1_PARTNERSHIP,
            'Schedule C': TaxClassification.SCHEDULE_C,
            'W-2': TaxClassification.W2_EMPLOYMENT,
            '1041': TaxClassification.FORM_1041,
            '1120S': TaxClassification.FORM_1120S,
        }
        tax_classification = tax_class_mapping.get(str(tax_class_str).strip() if tax_class_str else '', None)
        
        # Activity Classification (Optional)
        activity_str = get_field_value('activity_classification', 'Activity Classification')
        activity_mapping = {
            'ACTIVE': ActivityClassification.ACTIVE,
            'PASSIVE': ActivityClassification.PASSIVE,
            'PORTFOLIO': ActivityClassification.PORTFOLIO,
        }
        activity_classification = activity_mapping.get(str(activity_str).strip() if activity_str else '', None)
        
        # Due diligence and IC dates
        due_diligence_date = parse_date(get_field_value('due_diligence_date', 'Due Diligence Date'), 'due_diligence_date')
        ic_approval_date = parse_date(get_field_value('ic_approval_date', 'IC Approval Date'), 'ic_approval_date')
        
        # Risk Rating (Optional)
        risk_str = get_field_value('risk_rating', 'Risk Rating')
        risk_mapping = {
            'LOW': RiskRating.LOW,
            'MEDIUM': RiskRating.MEDIUM,
            'HIGH': RiskRating.HIGH,
        }
        risk_rating = risk_mapping.get(str(risk_str).strip() if risk_str else '', None)
        
        # Benchmark Index (Optional)
        benchmark_index = get_field_value('benchmark_index', 'Benchmark Index') or None
        
        # Called Amount and Fees (Optional with defaults)
        called_amount = parse_float(get_field_value('called_amount', 'Called Amount'), 'called_amount', 0.0)
        fees = parse_float(get_field_value('fees', 'Fees'), 'fees', 0.0)
        
        # ============ VALIDATION AND CREATION ============
        
        if errors and not force_upload:
            return None, errors
        
        # Create InvestmentCreate schema object with all fields
        investment_data = {
            'name': str(name).strip(),
            'asset_class': asset_class,
            'investment_structure': investment_structure,
            'entity_id': entity_id,
            'strategy': str(strategy).strip(),
            'vintage_year': vintage_year,
            'commitment_amount': commitment_amount,
            'commitment_date': commitment_date,
            'called_amount': called_amount,
            'fees': fees,
            'manager': manager,
            'target_raise': target_raise,
            'geography_focus': geography_focus,
            'management_fee': management_fee,
            'performance_fee': performance_fee,
            'hurdle_rate': hurdle_rate,
            'distribution_target': distribution_target,
            'currency': currency,
            'liquidity_profile': liquidity_profile,
            'expected_maturity_date': expected_maturity_date,
            'reporting_frequency': reporting_frequency,
            'contact_person': contact_person,
            'email': email,
            'portal_link': portal_link,
            'fund_administrator': fund_administrator,
            'fund_domicile': fund_domicile,
            'tax_classification': tax_classification,
            'activity_classification': activity_classification,
            'due_diligence_date': due_diligence_date,
            'ic_approval_date': ic_approval_date,
            'risk_rating': risk_rating,
            'benchmark_index': benchmark_index,
        }
        
        # Remove None values to let schema defaults apply
        investment_data = {k: v for k, v in investment_data.items() if v is not None}
        
        investment = schemas.InvestmentCreate(**investment_data)
        
        return investment, errors if force_upload else []
        
    except Exception as e:
        logger.error(f"Unexpected error in validate_and_convert_row: {str(e)}")
        return None, [f"Unexpected error processing row: {str(e)}"]

def import_investments_from_file(file_content: bytes, filename: str, db: Session, force_upload: bool = False) -> ImportResult:
    """Import investments from CSV or Excel file"""
    result = ImportResult()
    
    try:
        # Detect file type and read
        if filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(file_content))
        elif filename.endswith(('.xlsx', '.xls')):
            # For Excel files, read from 'Investment Data' sheet 
            # Skip user headers (row 1) and examples (row 3), use db field names (row 2) as headers
            df = pd.read_excel(BytesIO(file_content), sheet_name='Investment Data', skiprows=[0, 2], header=0)
            
            # Clean column names - remove brackets from field names like '[name]' -> 'name'
            df.columns = [col.strip('[]') if isinstance(col, str) else col for col in df.columns]
            logger.info(f"Cleaned column names: {list(df.columns)}")
        else:
            result.add_error(0, "Unsupported file format. Please use CSV or Excel files.")
            return result
            
        logger.info(f"Processing {len(df)} rows from {filename}")
        
        # Process each row
        for index, row in df.iterrows():
            # Calculate correct row number for error reporting
            # For Excel: +4 accounts for 3-row header structure (user headers, db fields, examples) + 0-based index
            # For CSV: +2 accounts for header + 0-based index  
            row_num = index + 4 if filename.endswith(('.xlsx', '.xls')) else index + 2
            
            # Skip empty rows
            if row.isna().all():
                continue
                
            investment, errors = validate_and_convert_row(row.to_dict(), row_num, force_upload)
            
            if errors:
                for error in errors:
                    result.add_error(row_num, error)
                continue
                
            try:
                # Create investment in database
                crud.create_investment(db, investment)
                result.add_success()
                
            except Exception as e:
                result.add_error(row_num, f"Database error: {str(e)}")
                
        logger.info(f"Import completed: {result.success_count} success, {result.error_count} errors")
        return result
        
    except Exception as e:
        result.add_error(0, f"File processing error: {str(e)}")
        return result

def export_investments_to_excel(investments: List[models.Investment]) -> BytesIO:
    """Export investments to Excel format"""
    # Prepare data for DataFrame
    data = []
    
    for investment in investments:
        # Calculate performance metrics
        irr = tvpi = dpi = 0.0
        # Note: Performance calculation requires database session - simplified for export
        
        data.append({
            'ID': investment.id,
            'Name': investment.name or '',
            'Asset Class': investment.asset_class.value if investment.asset_class else '',
            'Investment Structure': investment.investment_structure.value if investment.investment_structure else '',
            'Owner': investment.owner or '',
            'Strategy': investment.strategy or '',
            'Vintage Year': investment.vintage_year or '',
            'Commitment Amount': investment.commitment_amount or 0,
            'Called Amount': investment.called_amount or 0,
            'Fees': investment.fees or 0,
            'IRR (%)': round(irr * 100, 2) if irr else 0.0,
            'TVPI': round(tvpi, 2) if tvpi else 0.0,
            'DPI': round(dpi, 2) if dpi else 0.0,
        })
    
    # Create DataFrame and Excel file
    df = pd.DataFrame(data)
    
    excel_buffer = BytesIO()
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Investments', index=False)
        
        # Format the worksheet
        worksheet = writer.sheets['Investments']
        
        # Auto-adjust column widths
        for column in worksheet.columns:
            max_length = 0
            column_name = column[0].column_letter
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
                    
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_name].width = adjusted_width
    
    excel_buffer.seek(0)
    return excel_buffer