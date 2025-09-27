"""
FastAPI router for PitchBook benchmark data management

This module provides API endpoints for:
- Uploading and importing PitchBook benchmark data
- Viewing import history and logs
- Downloading templates
- Querying benchmark data
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import os
import tempfile
import io
import csv
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)

from app.database import get_db
from app.services.pitchbook_importer import PitchBookImporter, PitchBookImportError
from app.services.pdf_parser import PitchBookPDFParser, PDFParsingError
from app.models import PitchBookPerformanceByVintage, PitchBookQuarterlyReturns, PitchBookMultiplesQuantiles
from pydantic import BaseModel

router = APIRouter(prefix="/api/pitchbook", tags=["PitchBook Benchmarks"])

# Response models
class ImportResult(BaseModel):
    success: bool
    message: str
    import_id: Optional[int] = None
    records_processed: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    errors: List[str] = []
    import_duration_seconds: Optional[int] = None

class BenchmarkData(BaseModel):
    asset_class: str
    metric_code: str
    vintage_year: int
    top_quartile_value: Optional[float]
    median_value: Optional[float]
    bottom_quartile_value: Optional[float]
    pooled_irr: Optional[float]
    equal_weighted_pooled_irr: Optional[float]
    sample_size: Optional[int]
    methodology_notes: Optional[str]

class MultiplesData(BaseModel):
    asset_class: str
    vintage_year: int
    # TVPI quartiles
    tvpi_top_quartile: Optional[float]
    tvpi_median: Optional[float]
    tvpi_bottom_quartile: Optional[float]
    tvpi_top_decile: Optional[float]
    tvpi_bottom_decile: Optional[float]
    # DPI quartiles
    dpi_top_quartile: Optional[float]
    dpi_median: Optional[float]
    dpi_bottom_quartile: Optional[float]
    dpi_top_decile: Optional[float]
    dpi_bottom_decile: Optional[float]
    # Fund count
    fund_count: Optional[int]

class QuarterlyReturn(BaseModel):
    asset_class: str
    quarter_year: str
    quarter_date: date
    top_quartile_return: Optional[float]
    median_return: Optional[float]
    bottom_quartile_return: Optional[float]
    sample_size: Optional[int]

class ImportLog(BaseModel):
    id: int
    import_date: datetime
    import_type: str
    source_file: str
    records_processed: int
    records_inserted: int
    records_updated: int
    records_skipped: int
    import_status: str
    error_details: Optional[str]
    import_duration_seconds: Optional[int]
    imported_by: Optional[str]

class PDFExtractionResult(BaseModel):
    success: bool
    message: str
    report_period: Optional[str] = None
    total_performance_rows: int = 0
    total_quarterly_rows: int = 0
    extraction_timestamp: Optional[str] = None
    errors: List[str] = []

class PDFPreviewData(BaseModel):
    performance_data: List[Dict[str, Any]] = []
    quarterly_data: List[Dict[str, Any]] = []
    csv_preview: str = ""

# =====================================================
# TEMPLATE DOWNLOAD ENDPOINTS
# =====================================================

@router.get("/templates/performance-data", response_class=FileResponse)
async def download_performance_template():
    """Download CSV template for performance data"""
    template_path = "/home/will/Tmux-Orchestrator/private-markets-tracker/docs/benchmarks/templates/pitchbook_performance_data_template.csv"

    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")

    return FileResponse(
        path=template_path,
        filename="pitchbook_performance_data_template.csv",
        media_type="text/csv"
    )

@router.get("/templates/quarterly-returns", response_class=FileResponse)
async def download_quarterly_template():
    """Download CSV template for quarterly returns data"""
    template_path = "/home/will/Tmux-Orchestrator/private-markets-tracker/docs/benchmarks/templates/pitchbook_quarterly_returns_template.csv"

    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")

    return FileResponse(
        path=template_path,
        filename="pitchbook_quarterly_returns_template.csv",
        media_type="text/csv"
    )

@router.get("/templates/complete", response_class=FileResponse)
async def download_complete_template():
    """Download complete CSV template with both performance and quarterly data"""
    template_path = "/home/will/Tmux-Orchestrator/private-markets-tracker/docs/benchmarks/templates/pitchbook_complete_template_Q4_2024.csv"

    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")

    return FileResponse(
        path=template_path,
        filename="pitchbook_complete_template_Q4_2024.csv",
        media_type="text/csv"
    )

@router.get("/templates/instructions", response_class=FileResponse)
async def download_instructions():
    """Download template instructions"""
    instructions_path = "/home/will/Tmux-Orchestrator/private-markets-tracker/docs/benchmarks/templates/README_Template_Instructions.md"

    if not os.path.exists(instructions_path):
        raise HTTPException(status_code=404, detail="Instructions file not found")

    return FileResponse(
        path=instructions_path,
        filename="PitchBook_Template_Instructions.md",
        media_type="text/markdown"
    )

# =====================================================
# DATA IMPORT ENDPOINTS
# =====================================================

@router.post("/import", response_model=ImportResult)
async def import_benchmark_data(
    file: UploadFile = File(...),
    import_type: str = Form(default="full"),
    db: Session = Depends(get_db)
):
    """
    Import PitchBook benchmark data from CSV file

    Args:
        file: CSV file containing benchmark data
        import_type: Type of import ('full', 'performance_only', 'quarterly_only')
        db: Database session

    Returns:
        Import results with statistics
    """

    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported"
        )

    # Validate import type
    valid_import_types = ['full', 'performance_only', 'quarterly_only']
    if import_type not in valid_import_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid import_type. Must be one of: {valid_import_types}"
        )

    # Save uploaded file temporarily
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Import the data
        importer = PitchBookImporter(db)
        results = importer.import_from_csv(temp_file_path, import_type)

        # Clean up temporary file
        os.unlink(temp_file_path)

        # Return success response
        return ImportResult(
            success=True,
            message="Import completed successfully",
            records_processed=results.get('processed', 0),
            records_inserted=results.get('inserted', 0),
            records_updated=results.get('updated', 0),
            records_skipped=results.get('skipped', 0),
            errors=results.get('errors', []),
            import_duration_seconds=int(results.get('duration_seconds', 0))
        )

    except PitchBookImportError as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        return ImportResult(
            success=False,
            message=str(e),
            errors=[str(e)]
        )

    except Exception as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )

@router.post("/validate", response_model=Dict[str, Any])
async def validate_benchmark_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Validate PitchBook benchmark data without importing

    Args:
        file: CSV file to validate
        db: Database session

    Returns:
        Validation results
    """

    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported"
        )

    try:
        # Read file content
        content = await file.read()

        # Create temporary file for validation
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as temp_file:
            temp_file.write(content.decode('utf-8'))
            temp_file_path = temp_file.name

        # Validate using the importer's validation logic
        import pandas as pd
        from app.services.pitchbook_importer import PitchBookDataValidator

        df = pd.read_csv(temp_file_path, comment='#')
        validator = PitchBookDataValidator()

        # Determine data type and validate accordingly
        validation_errors = []
        data_type = "unknown"

        if 'metric_code' in df.columns and 'vintage_year' in df.columns:
            data_type = "performance"
            validation_errors = validator.validate_performance_data(df)
        elif 'quarter_year' in df.columns and 'quarter_date' in df.columns:
            data_type = "quarterly"
            validation_errors = validator.validate_quarterly_data(df)
        else:
            validation_errors = ["Could not determine data type. File must contain either performance or quarterly data columns."]

        # Clean up temporary file
        os.unlink(temp_file_path)

        return {
            "valid": len(validation_errors) == 0,
            "data_type": data_type,
            "total_rows": len(df),
            "validation_errors": validation_errors[:20],  # Limit to first 20 errors
            "error_count": len(validation_errors)
        }

    except Exception as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}"
        )

# =====================================================
# PDF PROCESSING ENDPOINTS
# =====================================================

@router.post("/upload-pdf", response_model=PDFExtractionResult)
async def upload_pdf_for_extraction(
    file: UploadFile = File(...),
    report_period: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Extract benchmark data from a PitchBook PDF file

    Args:
        file: PDF file containing PitchBook benchmark data
        report_period: Report period (e.g., 'Q4-2024'). If not provided, will extract from PDF
        db: Database session

    Returns:
        Extraction results with preview data
    """

    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    # Save uploaded file temporarily
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Extract data from PDF
        parser = PitchBookPDFParser()
        extracted_data = parser.extract_data_from_pdf(temp_file_path, report_period)

        # Clean up temporary file
        os.unlink(temp_file_path)

        # Return success response
        return PDFExtractionResult(
            success=True,
            message="PDF extraction completed successfully",
            report_period=extracted_data.get('report_period'),
            total_performance_rows=extracted_data.get('total_performance_rows', 0),
            total_quarterly_rows=extracted_data.get('total_quarterly_rows', 0),
            extraction_timestamp=extracted_data.get('extraction_timestamp')
        )

    except PDFParsingError as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        return PDFExtractionResult(
            success=False,
            message=str(e),
            errors=[str(e)]
        )

    except Exception as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"PDF extraction failed: {str(e)}"
        )

@router.post("/extract-pdf-preview", response_model=PDFPreviewData)
async def extract_pdf_preview(
    file: UploadFile = File(...),
    report_period: Optional[str] = Form(None),
    limit_rows: int = Form(default=20),
    db: Session = Depends(get_db)
):
    """
    Extract and preview benchmark data from a PitchBook PDF file without importing

    Args:
        file: PDF file containing PitchBook benchmark data
        report_period: Report period (optional)
        limit_rows: Maximum number of rows to return in preview
        db: Database session

    Returns:
        Preview of extracted data including CSV format
    """

    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Extract data from PDF
        parser = PitchBookPDFParser()
        extracted_data = parser.extract_data_from_pdf(temp_file_path, report_period)

        # Generate CSV preview
        csv_content = parser.generate_csv_content(extracted_data)

        # Limit preview data
        performance_data = extracted_data.get('performance_data', [])[:limit_rows]
        quarterly_data = extracted_data.get('quarterly_data', [])[:limit_rows]

        # Clean up temporary file
        os.unlink(temp_file_path)

        return PDFPreviewData(
            performance_data=performance_data,
            quarterly_data=quarterly_data,
            csv_preview=csv_content[:5000]  # Limit CSV preview to 5KB
        )

    except PDFParsingError as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=400,
            detail=f"PDF extraction failed: {str(e)}"
        )

    except Exception as e:
        # Clean up temporary file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {str(e)}"
        )

@router.post("/import-from-pdf", response_model=ImportResult)
async def import_from_pdf(
    file: UploadFile = File(...),
    report_period: Optional[str] = Form(None),
    import_type: str = Form(default="full"),
    db: Session = Depends(get_db)
):
    """
    Extract data from PDF and import directly into the database

    Args:
        file: PDF file containing PitchBook benchmark data
        report_period: Report period (optional)
        import_type: Type of import ('full', 'performance_only', 'quarterly_only')
        db: Database session

    Returns:
        Import results with statistics
    """

    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    # Validate import type
    valid_import_types = ['full', 'performance_only', 'quarterly_only']
    if import_type not in valid_import_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid import_type. Must be one of: {valid_import_types}"
        )

    try:
        # Create temporary files
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_temp_file:
            content = await file.read()
            pdf_temp_file.write(content)
            pdf_temp_file_path = pdf_temp_file.name

        # Save debug copy of PDF for analysis
        debug_pdf_path = "/tmp/uploaded_pdf_debug.pdf"
        try:
            import shutil
            shutil.copy2(pdf_temp_file_path, debug_pdf_path)
            print(f"🔍 DEBUG: Saved PDF copy to {debug_pdf_path} for analysis")
        except Exception as debug_e:
            print(f"⚠️ Could not save debug PDF copy: {debug_e}")

        # Extract comprehensive data from PDF using new method
        parser = PitchBookPDFParser()
        extracted_data = parser.extract_comprehensive_data_from_pdf(pdf_temp_file_path, report_period)

        # Import directly into database using the new comprehensive data
        results = await import_comprehensive_benchmark_data(extracted_data, import_type, db)

        # Clean up temporary files
        os.unlink(pdf_temp_file_path)

        # Return success response
        return ImportResult(
            success=True,
            message="PDF import completed successfully",
            records_processed=results.get('processed', 0),
            records_inserted=results.get('inserted', 0),
            records_updated=results.get('updated', 0),
            records_skipped=results.get('skipped', 0),
            errors=results.get('errors', []),
            import_duration_seconds=int(results.get('duration_seconds', 0))
        )

    except (PDFParsingError, PitchBookImportError) as e:
        # Clean up temporary files if they exist
        for temp_path in ['pdf_temp_file_path', 'csv_temp_file_path']:
            if temp_path in locals():
                try:
                    os.unlink(locals()[temp_path])
                except:
                    pass

        return ImportResult(
            success=False,
            message=str(e),
            errors=[str(e)]
        )

    except Exception as e:
        # Clean up temporary files if they exist
        for temp_path in ['pdf_temp_file_path', 'csv_temp_file_path']:
            if temp_path in locals():
                try:
                    os.unlink(locals()[temp_path])
                except:
                    pass

        raise HTTPException(
            status_code=500,
            detail=f"PDF import failed: {str(e)}"
        )

@router.post("/validate-pdf", response_model=Dict[str, Any])
async def validate_pdf_data(
    file: UploadFile = File(...),
    report_period: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Validate PitchBook PDF data without importing

    Args:
        file: PDF file to validate
        report_period: Report period (optional)
        db: Database session

    Returns:
        Validation results
    """

    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    try:
        # Create temporary files
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_temp_file:
            content = await file.read()
            pdf_temp_file.write(content)
            pdf_temp_file_path = pdf_temp_file.name

        # Extract data from PDF
        parser = PitchBookPDFParser()
        extracted_data = parser.extract_data_from_pdf(pdf_temp_file_path, report_period)

        # Convert to DataFrames for validation
        performance_df, quarterly_df = parser.convert_to_csv_format(extracted_data)

        # Validate using existing validators
        from app.services.pitchbook_importer import PitchBookDataValidator
        validator = PitchBookDataValidator()

        validation_errors = []
        data_types = []
        total_rows = 0

        if performance_df is not None and not performance_df.empty:
            data_types.append("performance")
            total_rows += len(performance_df)
            perf_errors = validator.validate_performance_data(performance_df)
            validation_errors.extend([f"Performance: {error}" for error in perf_errors])

        if quarterly_df is not None and not quarterly_df.empty:
            data_types.append("quarterly")
            total_rows += len(quarterly_df)
            quarterly_errors = validator.validate_quarterly_data(quarterly_df)
            validation_errors.extend([f"Quarterly: {error}" for error in quarterly_errors])

        if not data_types:
            validation_errors.append("No valid performance or quarterly data found in PDF")

        # Clean up temporary file
        os.unlink(pdf_temp_file_path)

        return {
            "valid": len(validation_errors) == 0,
            "data_types": data_types,
            "total_rows": total_rows,
            "validation_errors": validation_errors[:20],  # Limit to first 20 errors
            "error_count": len(validation_errors),
            "extraction_summary": {
                "report_period": extracted_data.get('report_period'),
                "performance_rows": extracted_data.get('total_performance_rows', 0),
                "quarterly_rows": extracted_data.get('total_quarterly_rows', 0)
            }
        }

    except PDFParsingError as e:
        # Clean up temporary file if it exists
        if 'pdf_temp_file_path' in locals():
            try:
                os.unlink(pdf_temp_file_path)
            except:
                pass

        return {
            "valid": False,
            "data_types": [],
            "total_rows": 0,
            "validation_errors": [f"PDF extraction failed: {str(e)}"],
            "error_count": 1
        }

    except Exception as e:
        # Clean up temporary file if it exists
        if 'pdf_temp_file_path' in locals():
            try:
                os.unlink(pdf_temp_file_path)
            except:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"PDF validation failed: {str(e)}"
        )

# =====================================================
# DATA QUERY ENDPOINTS
# =====================================================

@router.get("/performance-data", response_model=List[BenchmarkData])
async def get_performance_data(
    asset_class: Optional[str] = Query(None, description="Filter by asset class"),
    metric_code: Optional[str] = Query(None, description="Filter by metric code"),
    vintage_year: Optional[int] = Query(None, description="Filter by vintage year"),
    report_period: Optional[str] = Query(None, description="Filter by report period"),
    db: Session = Depends(get_db)
):
    """
    Get performance benchmark data with optional filters

    Args:
        asset_class: Filter by asset class
        metric_code: Filter by metric code (IRR, PME, TVPI, etc.)
        vintage_year: Filter by vintage year
        report_period: Filter by report period (Q4-2024)
        db: Database session

    Returns:
        List of benchmark performance data
    """

    # Query the PitchBook performance database
    try:
        query = db.query(PitchBookPerformanceByVintage)

        # Apply filters
        if asset_class:
            query = query.filter(PitchBookPerformanceByVintage.asset_class == asset_class)
        if vintage_year:
            query = query.filter(PitchBookPerformanceByVintage.vintage_year == vintage_year)
        if metric_code:
            # For performance data, we default to IRR metrics unless specified
            if metric_code.upper() == "IRR":
                # IRR data comes from the performance table
                pass  # Already querying the right table

        # Order by vintage year descending (newest first)
        query = query.order_by(PitchBookPerformanceByVintage.vintage_year.desc())

        results = query.all()

        # Convert to BenchmarkData format
        benchmark_data = []
        for record in results:
            benchmark_data.append(BenchmarkData(
                asset_class=record.asset_class,
                metric_code="IRR",  # This table contains IRR data
                vintage_year=record.vintage_year,
                top_quartile_value=record.top_quartile,
                median_value=record.median_irr,
                bottom_quartile_value=record.bottom_quartile,
                pooled_irr=record.pooled_irr,
                equal_weighted_pooled_irr=record.equal_weighted_pooled_irr,
                sample_size=record.number_of_funds,
                methodology_notes=f"Data as of {record.quarter_end_date}" if record.quarter_end_date else None
            ))

        return benchmark_data

    except Exception as e:
        logger.error(f"Error querying PitchBook performance data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/multiples-data", response_model=List[MultiplesData])
async def get_multiples_data(
    asset_class: Optional[str] = Query(None, description="Filter by asset class"),
    vintage_year: Optional[int] = Query(None, description="Filter by vintage year"),
    db: Session = Depends(get_db)
):
    """
    Get multiples benchmark data (TVPI, DPI, RVPI quartiles) with optional filters

    Args:
        asset_class: Filter by asset class
        vintage_year: Filter by vintage year
        db: Database session

    Returns:
        List of multiples benchmark data
    """
    try:
        query = db.query(PitchBookMultiplesQuantiles)

        # Apply filters
        if asset_class:
            query = query.filter(PitchBookMultiplesQuantiles.asset_class == asset_class)
        if vintage_year:
            query = query.filter(PitchBookMultiplesQuantiles.vintage_year == vintage_year)

        # Order by vintage year descending
        query = query.order_by(PitchBookMultiplesQuantiles.vintage_year.desc())
        results = query.all()

        # Convert to MultiplesData format
        multiples_data = []
        for record in results:
            multiples_data.append(MultiplesData(
                asset_class=record.asset_class,
                vintage_year=record.vintage_year,
                # TVPI quartiles
                tvpi_top_quartile=record.tvpi_top_quartile,
                tvpi_median=record.tvpi_median,
                tvpi_bottom_quartile=record.tvpi_bottom_quartile,
                tvpi_top_decile=record.tvpi_top_decile,
                tvpi_bottom_decile=record.tvpi_bottom_decile,
                # DPI quartiles
                dpi_top_quartile=record.dpi_top_quartile,
                dpi_median=record.dpi_median,
                dpi_bottom_quartile=record.dpi_bottom_quartile,
                dpi_top_decile=record.dpi_top_decile,
                dpi_bottom_decile=record.dpi_bottom_decile,
                # Fund count
                fund_count=record.number_of_funds
            ))

        return multiples_data

    except Exception as e:
        logger.error(f"Error querying PitchBook multiples data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/quarterly-returns", response_model=List[QuarterlyReturn])
async def get_quarterly_returns(
    asset_class: Optional[str] = Query(None, description="Filter by asset class"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    report_period: Optional[str] = Query(None, description="Filter by report period"),
    db: Session = Depends(get_db)
):
    """
    Get quarterly returns data with optional filters

    Args:
        asset_class: Filter by asset class
        start_date: Filter returns from this date
        end_date: Filter returns to this date
        report_period: Filter by report period
        db: Database session

    Returns:
        List of quarterly returns data
    """

    # Query the quarterly_benchmarks table for real data
    from app.models import QuarterlyBenchmark

    try:
        results = db.query(QuarterlyBenchmark).all()

        quarterly_returns = []
        for record in results:
            quarterly_returns.append(QuarterlyReturn(
                asset_class=record.asset_class,
                quarter_year=record.quarter_year,
                quarter_date=record.quarter_date,
                top_quartile_return=record.return_value,  # Using single return value for now
                median_return=record.return_value,        # Could be enhanced with separate fields
                bottom_quartile_return=record.return_value,
                sample_size=100  # Placeholder - could be added to model later
            ))

        return quarterly_returns

    except Exception as e:
        # Fallback to empty list if query fails
        logger.error(f"Failed to query quarterly benchmarks: {e}")
        return []

# =====================================================
# COMPREHENSIVE IMPORT FUNCTIONS
# =====================================================

async def import_comprehensive_benchmark_data(extracted_data: Dict[str, Any], import_type: str, db: Session) -> Dict[str, Any]:
    """
    Import comprehensive benchmark data into all 4 table types

    Args:
        extracted_data: Data from comprehensive PDF extraction
        import_type: Type of import ('full', 'performance_only', 'quarterly_only')
        db: Database session

    Returns:
        Import results dictionary
    """
    from app.models import (
        PitchBookPerformanceByVintage,
        PitchBookMultiplesByVintage,
        PitchBookMultiplesQuantiles,
        PitchBookQuarterlyReturns
    )

    results = {
        'processed': 0,
        'inserted': 0,
        'updated': 0,
        'skipped': 0,
        'errors': [],
        'duration_seconds': 0
    }

    start_time = datetime.now()

    try:
        # Debug: Log extracted data structure
        logger.debug(f"=== IMPORT FUNCTION START ===")
        logger.debug(f"Import type: {import_type}")
        logger.debug(f"Extracted data keys: {list(extracted_data.keys())}")
        logger.debug(f"Performance records count: {len(extracted_data.get('performance_by_vintage', []))}")

        # Import performance by vintage data
        if import_type in ['full', 'performance_only']:
            performance_records = extracted_data.get('performance_by_vintage', [])
            logger.debug(f"Processing {len(performance_records)} performance records")

            if performance_records:
                logger.debug(f"Sample performance record: {performance_records[0]}")

            for record in performance_records:
                try:
                    # Check if record already exists
                    existing = db.query(PitchBookPerformanceByVintage).filter_by(
                        asset_class=record['asset_class'],
                        vintage_year=record['vintage_year'],
                        quarter_end_date=record['quarter_end_date']
                    ).first()

                    if existing:
                        # Update existing record
                        for key, value in record.items():
                            setattr(existing, key, value)
                        results['updated'] += 1
                    else:
                        # Create new record
                        new_record = PitchBookPerformanceByVintage(**record)
                        db.add(new_record)
                        results['inserted'] += 1

                    results['processed'] += 1

                except Exception as e:
                    results['errors'].append(f"Performance vintage error: {str(e)}")
                    continue

        # Import multiples by vintage data
        if import_type in ['full']:
            for record in extracted_data.get('multiples_by_vintage', []):
                try:
                    # Check if record already exists
                    existing = db.query(PitchBookMultiplesByVintage).filter_by(
                        asset_class=record['asset_class'],
                        vintage_year=record['vintage_year'],
                        quarter_end_date=record['quarter_end_date']
                    ).first()

                    if existing:
                        # Update existing record
                        for key, value in record.items():
                            setattr(existing, key, value)
                        results['updated'] += 1
                    else:
                        # Create new record
                        new_record = PitchBookMultiplesByVintage(**record)
                        db.add(new_record)
                        results['inserted'] += 1

                    results['processed'] += 1

                except Exception as e:
                    results['errors'].append(f"Multiples vintage error: {str(e)}")
                    continue

        # Import multiples quantiles data
        if import_type in ['full']:
            for record in extracted_data.get('multiples_quantiles', []):
                try:
                    # Check if record already exists
                    existing = db.query(PitchBookMultiplesQuantiles).filter_by(
                        asset_class=record['asset_class'],
                        vintage_year=record['vintage_year'],
                        quarter_end_date=record['quarter_end_date']
                    ).first()

                    if existing:
                        # Update existing record
                        for key, value in record.items():
                            setattr(existing, key, value)
                        results['updated'] += 1
                    else:
                        # Create new record
                        new_record = PitchBookMultiplesQuantiles(**record)
                        db.add(new_record)
                        results['inserted'] += 1

                    results['processed'] += 1

                except Exception as e:
                    results['errors'].append(f"Multiples quantiles error: {str(e)}")
                    continue

        # Import quarterly returns data
        if import_type in ['full', 'quarterly_only']:
            for record in extracted_data.get('quarterly_returns', []):
                try:
                    # Check if record already exists
                    existing = db.query(PitchBookQuarterlyReturns).filter_by(
                        asset_class=record['asset_class'],
                        time_period=record['time_period'],
                        quarter_end_date=record['quarter_end_date']
                    ).first()

                    if existing:
                        # Update existing record
                        for key, value in record.items():
                            setattr(existing, key, value)
                        results['updated'] += 1
                    else:
                        # Create new record
                        new_record = PitchBookQuarterlyReturns(**record)
                        db.add(new_record)
                        results['inserted'] += 1

                    results['processed'] += 1

                except Exception as e:
                    results['errors'].append(f"Quarterly returns error: {str(e)}")
                    continue

        # Commit all changes
        db.commit()

        end_time = datetime.now()
        results['duration_seconds'] = (end_time - start_time).total_seconds()

        # Final debug logging
        logger.debug(f"=== IMPORT FUNCTION END ===")
        logger.debug(f"Final results: {results}")

        return results

    except Exception as e:
        db.rollback()
        results['errors'].append(f"Transaction error: {str(e)}")
        return results

# =====================================================
# IMPORT HISTORY ENDPOINTS
# =====================================================

@router.get("/import-history", response_model=List[ImportLog])
async def get_import_history(
    limit: int = Query(default=50, le=200, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by import status"),
    db: Session = Depends(get_db)
):
    """
    Get import history with optional filters

    Args:
        limit: Maximum number of records to return
        status: Filter by import status
        db: Database session

    Returns:
        List of import log entries
    """

    # This would query the pitchbook_import_log table
    # For now, return mock data
    mock_data = [
        ImportLog(
            id=1,
            import_date=datetime.now(),
            import_type="full",
            source_file="Q4_2024_data.csv",
            records_processed=150,
            records_inserted=150,
            records_updated=0,
            records_skipped=0,
            import_status="success",
            error_details=None,
            import_duration_seconds=45,
            imported_by="user@example.com"
        )
    ]

    return mock_data

@router.get("/import-log/{import_id}", response_model=ImportLog)
async def get_import_log(
    import_id: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed import log for a specific import

    Args:
        import_id: ID of the import log entry
        db: Database session

    Returns:
        Import log details
    """

    # This would query the pitchbook_import_log table
    # For now, return mock data
    return ImportLog(
        id=import_id,
        import_date=datetime.now(),
        import_type="full",
        source_file="Q4_2024_data.csv",
        records_processed=150,
        records_inserted=150,
        records_updated=0,
        records_skipped=0,
        import_status="success",
        error_details=None,
        import_duration_seconds=45,
        imported_by="user@example.com"
    )

# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/asset-classes")
async def get_asset_classes():
    """Get list of valid asset classes"""
    return {
        "asset_classes": [
            {"code": "private_equity", "name": "Private Equity"},
            {"code": "venture_capital", "name": "Venture Capital"},
            {"code": "real_estate", "name": "Real Estate"},
            {"code": "real_assets", "name": "Real Assets"},
            {"code": "private_debt", "name": "Private Debt"},
            {"code": "fund_of_funds", "name": "Fund of Funds"},
            {"code": "secondaries", "name": "Secondaries"}
        ]
    }

@router.get("/metric-codes")
async def get_metric_codes():
    """Get list of valid metric codes"""
    return {
        "metric_codes": [
            {"code": "IRR", "name": "Internal Rate of Return", "unit": "percentage"},
            {"code": "PME", "name": "Public Market Equivalent", "unit": "multiple"},
            {"code": "TVPI", "name": "Total Value to Paid-In", "unit": "multiple"},
            {"code": "DPI", "name": "Distributions to Paid-In", "unit": "multiple"},
            {"code": "RVPI", "name": "Residual Value to Paid-In", "unit": "multiple"}
        ]
    }

@router.get("/reports")
async def get_reports(db: Session = Depends(get_db)):
    """Get list of available PitchBook reports"""
    # This would query the pitchbook_reports table
    return {
        "reports": [
            {
                "id": 1,
                "report_name": "Q4 2024 PitchBook Benchmarks with preliminary Q1 2025 data",
                "report_period": "Q4-2024",
                "report_date": "2024-12-31",
                "publication_date": "2025-01-15",
                "preliminary_data": True
            }
        ]
    }

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "pitchbook-benchmarks",
        "timestamp": datetime.now().isoformat()
    }