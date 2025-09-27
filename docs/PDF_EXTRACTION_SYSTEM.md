# PitchBook PDF Extraction System

## Overview

The PDF Extraction System automatically extracts benchmark data from PitchBook PDF reports and converts it to the CSV format expected by the existing import system. This allows users to directly upload PDF reports without manual data entry.

## Features

### ✨ Key Capabilities

- **Automatic PDF Table Detection**: Identifies and extracts performance and quarterly returns tables
- **Intelligent Data Recognition**: Maps various naming conventions to standardized formats
- **Data Validation**: Uses existing validation logic to ensure data quality
- **Preview Functionality**: Shows extracted data before import for user verification
- **Seamless Integration**: Works with existing CSV import infrastructure

### 📊 Supported Data Types

1. **Performance Data**:
   - Vintage year performance metrics (IRR, PME, TVPI, DPI, RVPI)
   - Top quartile, median, and bottom quartile values
   - Sample sizes and fund counts
   - Multiple asset classes

2. **Quarterly Returns Data**:
   - Quarterly return performance by asset class
   - Time series data with quarter dates
   - Quartile distributions
   - Sample size information

### 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Router    │    │  PDF Parser     │
│   Component     │───▶│   Endpoints     │───▶│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │◀───│  CSV Importer   │◀───│  CSV Generator  │
│   Storage       │    │   Service       │    │   (Built-in)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Details

### 🔧 Backend Components

#### 1. PDF Parser Service (`app/services/pdf_parser.py`)

**Main Class**: `PitchBookPDFParser`

**Key Methods**:
- `extract_data_from_pdf(pdf_path, report_period)` - Extract data from PDF
- `convert_to_csv_format(extracted_data)` - Convert to pandas DataFrames
- `generate_csv_content(extracted_data)` - Generate CSV content string

**Features**:
- Asset class mapping (handles various naming conventions)
- Metric code standardization
- Quartile value extraction and validation
- Quarter date parsing
- Report period auto-detection

#### 2. API Endpoints (`app/routers/pitchbook_benchmarks.py`)

**New Endpoints**:

##### `/api/pitchbook/upload-pdf` (POST)
- Extracts data from uploaded PDF
- Returns extraction summary

##### `/api/pitchbook/extract-pdf-preview` (POST)
- Extracts and previews data without importing
- Returns structured data for frontend display

##### `/api/pitchbook/import-from-pdf` (POST)
- Full pipeline: extract → validate → import
- Uses existing CSV importer for consistency

##### `/api/pitchbook/validate-pdf` (POST)
- Validates extracted PDF data
- Returns validation results and error details

### 🎨 Frontend Components

#### Enhanced PitchBookImport Component

**New Features**:
- PDF/CSV upload type selection
- Report period input for PDFs
- PDF extraction preview with data tables
- Generated CSV preview
- Enhanced validation results for PDFs

**UI Elements**:
- Upload type radio buttons (CSV/PDF)
- Report period input field
- Extract & Preview button
- Tabular data preview
- CSV content preview
- Error handling displays

### 📋 Data Flow

#### Standard Workflow

1. **User Upload**: User selects PDF file and optionally specifies report period
2. **File Processing**: PDF is uploaded and temporarily stored
3. **Table Extraction**: PDF parser identifies and extracts tables using pdfplumber
4. **Data Recognition**: Tables are analyzed to identify performance vs. quarterly data
5. **Data Mapping**: Raw values are mapped to standardized formats
6. **CSV Generation**: Extracted data is converted to CSV format
7. **Validation**: Generated CSV is validated using existing validation logic
8. **Import**: Data is imported using existing CSV importer
9. **Storage**: Data is stored using existing database models

#### Preview Workflow

1. **Extract & Preview**: User clicks "Extract & Preview" button
2. **Data Extraction**: Same extraction process as above
3. **Preview Display**: Shows extracted data in tabular format
4. **CSV Preview**: Shows generated CSV content
5. **User Verification**: User can review before importing
6. **Import Decision**: User proceeds with import if satisfied

## Configuration

### Dependencies

```
pdfplumber==0.10.3  # PDF parsing and table extraction
```

### File Handling

- **Temporary Files**: PDFs are stored temporarily during processing
- **Memory Management**: Large PDFs are processed in chunks
- **Security**: File type validation and size limits
- **Cleanup**: Automatic temporary file cleanup

## API Reference

### Request/Response Models

#### PDFExtractionResult
```python
{
  "success": bool,
  "message": str,
  "report_period": str | None,
  "total_performance_rows": int,
  "total_quarterly_rows": int,
  "extraction_timestamp": str | None,
  "errors": List[str]
}
```

#### PDFPreviewData
```python
{
  "performance_data": List[Dict],
  "quarterly_data": List[Dict],
  "csv_preview": str
}
```

### Error Handling

#### Common Error Types

1. **PDFParsingError**: PDF cannot be parsed or contains no tables
2. **ValidationError**: Extracted data fails validation
3. **FileTypeError**: Invalid file type uploaded
4. **ProcessingError**: General processing failures

#### Error Response Format
```python
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error 1", "Detailed error 2"]
}
```

## Usage Examples

### Frontend Usage

```typescript
// PDF Upload and Preview
const handlePDFExtraction = async () => {
  const formData = new FormData();
  formData.append('file', pdfFile);
  formData.append('report_period', 'Q4-2024');

  const response = await fetch('/api/pitchbook/extract-pdf-preview', {
    method: 'POST',
    body: formData,
  });

  const previewData = await response.json();
  // Display preview data in UI
};
```

### Backend Usage

```python
# Direct PDF Processing
from app.services.pdf_parser import PitchBookPDFParser

parser = PitchBookPDFParser()
extracted_data = parser.extract_data_from_pdf('report.pdf', 'Q4-2024')
csv_content = parser.generate_csv_content(extracted_data)
```

## Testing

### Test Coverage

- **Unit Tests**: Individual parser methods
- **Integration Tests**: End-to-end workflow
- **Validation Tests**: Data validation logic
- **API Tests**: Endpoint functionality

### Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run comprehensive tests
python test_pdf_system.py

# Run specific component tests
python -m pytest tests/test_pdf_parser.py
```

## Troubleshooting

### Common Issues

#### 1. PDF Not Recognized
- **Cause**: PDF doesn't contain recognizable tables
- **Solution**: Check table structure and formatting
- **Workaround**: Use CSV import for manual data entry

#### 2. Data Extraction Errors
- **Cause**: Unexpected table layout or formatting
- **Solution**: Review PDF structure and update parser patterns
- **Logs**: Check extraction errors in response

#### 3. Validation Failures
- **Cause**: Extracted data doesn't meet validation criteria
- **Solution**: Review validation errors and PDF content
- **Preview**: Use preview feature to verify extracted data

#### 4. Performance Issues
- **Cause**: Large PDF files or complex layouts
- **Solution**: Implement chunked processing
- **Optimization**: Cache parsed results

### Debugging

#### Enable Debug Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Check Extraction Results
```python
# Review extracted tables before processing
extracted_data = parser.extract_data_from_pdf('file.pdf')
print(f"Performance rows: {len(extracted_data['performance_data'])}")
print(f"Quarterly rows: {len(extracted_data['quarterly_data'])}")
```

## Future Enhancements

### Planned Features

1. **Enhanced Table Detection**:
   - Machine learning-based table recognition
   - Support for additional PDF layouts
   - OCR for scanned documents

2. **Advanced Data Processing**:
   - Multi-currency support
   - Date format auto-detection
   - Custom mapping configurations

3. **User Experience**:
   - Batch PDF processing
   - PDF preview with highlighting
   - Custom validation rules

4. **Integration**:
   - Email attachment processing
   - Cloud storage integration
   - Automated report ingestion

### Performance Optimizations

1. **Caching**: Cache parsed results for repeated uploads
2. **Streaming**: Process large PDFs in chunks
3. **Async Processing**: Background processing for large files
4. **Compression**: Compress temporary files

## Security Considerations

### File Security

- **File Type Validation**: Only PDF files accepted
- **Size Limits**: Maximum file size restrictions
- **Temporary Storage**: Secure temporary file handling
- **Cleanup**: Automatic file cleanup after processing

### Data Security

- **Validation**: All extracted data validated before import
- **Sanitization**: Input sanitization for all extracted values
- **Error Handling**: No sensitive data in error messages
- **Logging**: Secure logging without exposing content

## Maintenance

### Regular Tasks

1. **Dependency Updates**: Keep pdfplumber and related packages updated
2. **Test Maintenance**: Update tests for new PDF formats
3. **Performance Monitoring**: Monitor extraction times and success rates
4. **Error Analysis**: Review failed extractions and improve patterns

### Monitoring

- **Success Rates**: Track successful vs. failed extractions
- **Processing Times**: Monitor performance metrics
- **Error Patterns**: Identify common failure modes
- **User Feedback**: Collect user reports on extraction quality

## Support

### Documentation

- **API Documentation**: Available at `/docs` endpoint
- **Frontend Examples**: See component usage in codebase
- **Test Examples**: Reference test files for usage patterns

### Contact

For issues or questions about the PDF extraction system:
1. Check this documentation
2. Review test examples
3. Check API logs for error details
4. Refer to existing CSV import documentation for context