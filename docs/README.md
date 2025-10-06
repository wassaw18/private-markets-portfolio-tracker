# Documentation Directory

Technical documentation, implementation guides, and reference materials.

## Directory Structure

### `benchmarks/`
Benchmark data documentation and source materials:
- `source_documents/` - PDF reports from industry sources (Bain, NVCA, PitchBook)
- Implementation notes for benchmark data integration

### `development/`
Development guidelines and workflows (to be added)

### `implementations/`
Feature implementation guides and technical specifications (to be added)

## Main Documentation Files

- `FAMILY_OFFICE_FEATURE_ROADMAP.md` - Roadmap for family office features
- `GITHUB_SECURITY_CHECKLIST.md` - Security best practices and checklist
- `PDF_EXTRACTION_SYSTEM.md` - PDF data extraction documentation

## Large Files

**Note:** Large PDF files in `benchmarks/source_documents/` should ideally be:
1. Stored in Git LFS for better repository performance
2. Referenced externally for very large files (>10MB)
3. Kept locally only if actively used in development

Current source documents:
- Bain Global PE Report 2023 (4.3MB)
- NVCA Yearbook 2023 (11.5MB)
- PitchBook Benchmarks Q4 2024 (1.3MB)

## Contributing

When adding documentation:
1. Use Markdown format (.md)
2. Include table of contents for long documents
3. Add diagrams where helpful (use Mermaid or draw.io)
4. Keep documentation up-to-date with code changes
