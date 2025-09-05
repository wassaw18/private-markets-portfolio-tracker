"""
Import/Export functionality for portfolio data
"""
from typing import List, Dict, Any, Tuple
import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from app import models, schemas, crud
from app.models import AssetClass, InvestmentStructure
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
    """Validate and convert a row to InvestmentCreate schema"""
    errors = []
    
    try:
        # Map common column variations with force upload defaults
        name = row.get('name') or row.get('Name') or row.get('Investment Name')
        if not name:
            if force_upload:
                name = f"Investment_{row_num}"
                errors.append(f"Missing name - using default: {name}")
            else:
                errors.append("Missing required field: name")
            
        asset_class = row.get('asset_class') or row.get('Asset Class') or row.get('asset_class')
        if asset_class:
            # Try to match to enum values - updated to match frontend enum
            asset_class_mapping = {
                'public_equity': AssetClass.PUBLIC_EQUITY,
                'public equity': AssetClass.PUBLIC_EQUITY,
                'pe': AssetClass.PRIVATE_EQUITY,
                'private_equity': AssetClass.PRIVATE_EQUITY,
                'private equity': AssetClass.PRIVATE_EQUITY,
                'vc': AssetClass.VENTURE_CAPITAL,
                'venture_capital': AssetClass.VENTURE_CAPITAL,
                'venture capital': AssetClass.VENTURE_CAPITAL,
                'pc': AssetClass.PRIVATE_CREDIT,
                'private_credit': AssetClass.PRIVATE_CREDIT,
                'private credit': AssetClass.PRIVATE_CREDIT,
                're': AssetClass.REAL_ESTATE,
                'real_estate': AssetClass.REAL_ESTATE,
                'real estate': AssetClass.REAL_ESTATE,
                'real_assets': AssetClass.REAL_ASSETS,
                'real assets': AssetClass.REAL_ASSETS,
                'public_fixed_income': AssetClass.PUBLIC_FIXED_INCOME,
                'public fixed income': AssetClass.PUBLIC_FIXED_INCOME,
                'fixed income': AssetClass.PUBLIC_FIXED_INCOME,
                'bonds': AssetClass.PUBLIC_FIXED_INCOME,
                'cash_and_equivalents': AssetClass.CASH_AND_EQUIVALENTS,
                'cash & cash equivalents': AssetClass.CASH_AND_EQUIVALENTS,
                'cash': AssetClass.CASH_AND_EQUIVALENTS,
                'money market': AssetClass.CASH_AND_EQUIVALENTS,
            }
            asset_class_lower = str(asset_class).lower().strip()
            asset_class = asset_class_mapping.get(asset_class_lower)
            
        if not asset_class:
            if force_upload:
                asset_class = AssetClass.PRIVATE_EQUITY  # Default to PE
                errors.append("Invalid/missing asset_class - using default: PRIVATE_EQUITY")
            else:
                errors.append("Invalid or missing asset_class")
            
        investment_structure = row.get('investment_structure') or row.get('Structure') or 'Limited Partnership'
        structure_mapping = {
            'lp': InvestmentStructure.LIMITED_PARTNERSHIP,
            'limited partnership': InvestmentStructure.LIMITED_PARTNERSHIP,
            'fof': InvestmentStructure.FUND_OF_FUNDS,
            'fund of funds': InvestmentStructure.FUND_OF_FUNDS,
            'direct': InvestmentStructure.DIRECT_INVESTMENT,
            'co-investment': InvestmentStructure.CO_INVESTMENT,
            'separate account': InvestmentStructure.SEPARATE_ACCOUNT,
        }
        investment_structure = structure_mapping.get(str(investment_structure).lower().strip(), InvestmentStructure.LIMITED_PARTNERSHIP)
        
        owner = row.get('owner') or row.get('Owner') or row.get('LP')
        if not owner:
            if force_upload:
                owner = "Unknown Owner"
                errors.append("Missing owner - using default: Unknown Owner")
            else:
                errors.append("Missing required field: owner")
            
        strategy = row.get('strategy') or row.get('Strategy') or row.get('Investment Strategy')
        if not strategy:
            if force_upload:
                strategy = "General Investment Strategy"
                errors.append("Missing strategy - using default: General Investment Strategy")
            else:
                errors.append("Missing required field: strategy")
            
        vintage_year = row.get('vintage_year') or row.get('Vintage Year') or row.get('Vintage')
        try:
            vintage_year = int(vintage_year) if vintage_year else None
        except (ValueError, TypeError):
            if force_upload:
                vintage_year = 2024
                errors.append("Invalid vintage_year - using default: 2024")
            else:
                errors.append("Invalid vintage_year: must be integer")
            
        commitment_amount = row.get('commitment_amount') or row.get('Commitment') or row.get('Commitment Amount')
        try:
            commitment_amount = float(commitment_amount) if commitment_amount else None
        except (ValueError, TypeError):
            if force_upload:
                commitment_amount = 1000000.0  # Default 1M
                errors.append("Invalid commitment_amount - using default: 1,000,000")
            else:
                errors.append("Invalid commitment_amount: must be number")
            
        called_amount = row.get('called_amount') or row.get('Called Amount') or 0.0
        try:
            called_amount = float(called_amount) if called_amount else 0.0
        except (ValueError, TypeError):
            called_amount = 0.0
            
        fees = row.get('fees') or row.get('Fees') or 0.0
        try:
            fees = float(fees) if fees else 0.0
        except (ValueError, TypeError):
            fees = 0.0
            
        # Handle entity_id (required by schema but not in current validation)
        entity_id = row.get('entity_id') or row.get('Entity ID')
        if not entity_id:
            if force_upload:
                entity_id = 1  # Default to first entity - will need to be handled in frontend
                errors.append("Missing entity_id - using default: 1 (update manually)")
            else:
                errors.append("Missing required field: entity_id")
        else:
            try:
                entity_id = int(entity_id)
            except (ValueError, TypeError):
                if force_upload:
                    entity_id = 1
                    errors.append("Invalid entity_id - using default: 1 (update manually)")
                else:
                    errors.append("Invalid entity_id: must be integer")
                    
        # Handle commitment_date (required by schema)
        from datetime import date, datetime
        commitment_date = row.get('commitment_date') or row.get('Commitment Date')
        if not commitment_date:
            if force_upload:
                commitment_date = date.today()
                errors.append(f"Missing commitment_date - using today: {commitment_date}")
            else:
                errors.append("Missing required field: commitment_date")
        else:
            try:
                if isinstance(commitment_date, str):
                    commitment_date = datetime.strptime(commitment_date, "%Y-%m-%d").date()
                elif isinstance(commitment_date, datetime):
                    commitment_date = commitment_date.date()
            except (ValueError, TypeError):
                if force_upload:
                    commitment_date = date.today()
                    errors.append(f"Invalid commitment_date - using today: {commitment_date}")
                else:
                    errors.append("Invalid commitment_date: use YYYY-MM-DD format")
        
        if errors and not force_upload:
            return None, errors
            
        investment = schemas.InvestmentCreate(
            name=str(name).strip(),
            asset_class=asset_class,
            investment_structure=investment_structure,
            entity_id=entity_id,
            owner=str(owner).strip(),
            strategy=str(strategy).strip(),
            vintage_year=vintage_year,
            commitment_amount=commitment_amount,
            commitment_date=commitment_date,
            called_amount=called_amount,
            fees=fees
        )
        
        return investment, []
        
    except Exception as e:
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
        else:
            result.add_error(0, "Unsupported file format. Please use CSV or Excel files.")
            return result
            
        logger.info(f"Processing {len(df)} rows from {filename}")
        
        # Process each row
        for index, row in df.iterrows():
            row_num = index + 2  # Excel/CSV row numbers start at 2 (after header)
            
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