"""
Multi-Tenant FastAPI Application

This is the new main application file with JWT authentication and tenant isolation.
Use this to replace main.py after testing.
"""

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from .database import get_db, create_database
from .auth import get_current_active_user, require_contributor
from .models import User, Tenant, DocumentCategory, DocumentStatus
from .routers.auth import router as auth_router
from .routers.tenant_api import router as tenant_api_router
from .routers.pitchbook_benchmarks import router as pitchbook_router
from .routers.relative_performance import router as relative_performance_router
from .routers.reports import router as reports_router

# Create FastAPI app
app = FastAPI(
    title="Private Markets Portfolio Tracker",
    version="2.0.0",
    description="Multi-tenant private markets portfolio management system with JWT authentication"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://172.23.5.82:3000", "http://172.23.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001", "http://172.23.5.82:3001"],  # WSL2 networking support
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Create database tables on startup"""
    create_database()

# Include routers
app.include_router(auth_router)  # Authentication routes
app.include_router(tenant_api_router)  # Tenant-aware API routes
app.include_router(reports_router)  # Report generation routes

# Include existing benchmark routers (these may need tenant filtering too)
app.include_router(pitchbook_router)
app.include_router(relative_performance_router)

# Global exception handler for authentication errors
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom exception handler for better error responses"""
    if exc.status_code == 401:
        return JSONResponse(
            status_code=401,
            content={
                "detail": "Authentication required",
                "error_code": "AUTHENTICATION_REQUIRED"
            },
            headers={"WWW-Authenticate": "Bearer"}
        )
    elif exc.status_code == 403:
        return JSONResponse(
            status_code=403,
            content={
                "detail": exc.detail,
                "error_code": "INSUFFICIENT_PERMISSIONS"
            }
        )
    else:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )

# Root endpoint
@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Private Markets Portfolio Tracker API",
        "version": "2.0.0",
        "features": [
            "Multi-tenant architecture",
            "JWT authentication",
            "Role-based access control",
            "Tenant data isolation"
        ]
    }

# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "multi_tenant": True
    }

# Legacy compatibility endpoint (for testing)
@app.get("/api/legacy/user")
def get_legacy_user(
    x_user: Optional[str] = Header(None, alias="X-User"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Legacy compatibility endpoint that shows both old header-based
    and new JWT-based user information for testing
    """
    return {
        "legacy_header_user": x_user or "not provided",
        "jwt_user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "role": current_user.role.value,
            "tenant_id": current_user.tenant_id
        }
    }

# =============================================================================
# Migration and Development Endpoints
# =============================================================================

@app.post("/api/dev/migrate")
def run_migration(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Development endpoint to run database migration
    Only available to admin users
    """
    from .auth import require_admin
    from .migration_utility import MigrationUtility

    # Ensure only admin can run migration
    if current_user.role.value != "Admin":
        raise HTTPException(
            status_code=403,
            detail="Only admin users can run database migrations"
        )

    try:
        migration = MigrationUtility()

        # Check if migration is needed
        tenant_count = db.query(Tenant).count()
        if tenant_count == 0:
            return {"message": "No tenants found. Migration not needed or database is fresh."}

        # For development, just verify the migration
        verification_result = migration.verify_migration(current_user.tenant_id)

        return {
            "message": "Migration verification completed",
            "verification_passed": verification_result,
            "tenant_id": current_user.tenant_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {str(e)}"
        )

# =============================================================================
# Backwards Compatibility Section
# =============================================================================

# For gradual migration, we can include some backwards-compatible endpoints
# These would be removed after frontend is fully updated

from typing import List
from datetime import date
from . import schemas, crud_tenant
from .document_service import get_document_service
import os

@app.get("/api/legacy/entities")
def legacy_get_entities(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Legacy entities endpoint for backwards compatibility
    Redirects to tenant-aware endpoint
    """
    from .crud_tenant import get_entities

    entities = get_entities(db, current_user.tenant_id)

    # Convert to old format if needed
    return [
        {
            **entity.__dict__,
            "tenant_info": {
                "tenant_id": entity.tenant_id,
                "isolation_enabled": True
            }
        }
        for entity in entities
    ]

# Note: Investment detail endpoints (performance, valuations, cashflows)
# are now handled by the tenant_api router to avoid duplicate route registration

# =============================================================================
# Document Management Endpoints with Tenant Isolation
# =============================================================================

@app.post("/api/documents/upload", response_model=schemas.Document)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: DocumentCategory = Form(...),
    status: DocumentStatus = Form(DocumentStatus.PENDING_REVIEW),
    document_date: Optional[date] = Form(None),
    due_date: Optional[date] = Form(None),
    investment_id: Optional[int] = Form(None),
    entity_id: Optional[int] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a document with tenant isolation"""
    try:
        # Initialize document service
        doc_service = get_document_service()

        # Validate file
        file_info = await doc_service.validate_and_store_file(file)

        # Parse tags if provided
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

        # Create document data
        document_data = schemas.DocumentCreate(
            title=title,
            description=description,
            category=category,
            status=status,
            document_date=document_date,
            due_date=due_date,
            investment_id=investment_id,
            entity_id=entity_id,
            tags=tag_list
        )

        # Create document with tenant isolation
        document = crud_tenant.create_document(
            db=db,
            tenant_id=current_user.tenant_id,
            document=document_data,
            file_info=file_info,
            current_user_id=current_user.id
        )

        return document

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@app.get("/api/documents", response_model=List[schemas.Document])
def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    categories: Optional[List[DocumentCategory]] = Query(None),
    statuses: Optional[List[DocumentStatus]] = Query(None),
    investment_ids: Optional[List[int]] = Query(None),
    entity_ids: Optional[List[int]] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get documents with filtering and tenant isolation"""
    # Use search if provided
    if search:
        results = crud_tenant.search_documents(
            db=db,
            tenant_id=current_user.tenant_id,
            search_query=search,
            skip=skip,
            limit=limit
        )
        return [result['document'] for result in results]

    # Use filters for regular retrieval
    filters = {}
    if categories:
        filters['categories'] = categories
    if statuses:
        filters['statuses'] = statuses
    if investment_ids:
        filters['investment_ids'] = investment_ids
    if entity_ids:
        filters['entity_ids'] = entity_ids
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date

    return crud_tenant.get_documents(
        db=db,
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit,
        include_archived=include_archived
    )

@app.get("/api/documents/{document_id}", response_model=schemas.Document)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific document with tenant isolation"""
    document = crud_tenant.get_document(db, document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.put("/api/documents/{document_id}", response_model=schemas.Document)
def update_document(
    document_id: int,
    document_update: schemas.DocumentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a document with tenant isolation"""
    updated_document = crud_tenant.update_document(
        db=db,
        document_id=document_id,
        tenant_id=current_user.tenant_id,
        document_update=document_update,
        current_user_id=current_user.id
    )

    if not updated_document:
        raise HTTPException(status_code=404, detail="Document not found")

    return updated_document

@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: int,
    permanent: bool = Query(False, description="Permanently delete the document"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document with tenant isolation"""
    success = crud_tenant.delete_document(
        db=db,
        document_id=document_id,
        tenant_id=current_user.tenant_id,
        soft_delete=not permanent
    )

    if not success:
        raise HTTPException(status_code=404, detail="Document not found")

    action = "deleted permanently" if permanent else "archived"
    return {"message": f"Document {action} successfully"}

@app.get("/api/documents/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download a document file with tenant isolation"""
    document = crud_tenant.get_document(db, document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )

@app.post("/api/documents/{document_id}/tags", response_model=schemas.DocumentTag)
def add_document_tag(
    document_id: int,
    tag: schemas.DocumentTagCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a tag to a document with tenant isolation"""
    # First verify document belongs to tenant
    document = crud_tenant.get_document(db, document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return crud_tenant.create_document_tag(db, document_id, current_user.tenant_id, tag)

@app.delete("/api/documents/{document_id}/tags/{tag_name}")
def remove_document_tag(
    document_id: int,
    tag_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a tag from a document with tenant isolation"""
    # First verify document belongs to tenant
    document = crud_tenant.get_document(db, document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    success = crud_tenant.delete_document_tag(db, document_id, current_user.tenant_id, tag_name)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")

    return {"message": "Tag removed successfully"}

@app.get("/api/documents/search", response_model=List[schemas.DocumentSearchResult])
def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search documents with tenant isolation"""
    search_results = crud_tenant.search_documents(
        db=db,
        tenant_id=current_user.tenant_id,
        search_query=q,
        skip=skip,
        limit=limit
    )

    return search_results

@app.get("/api/documents/statistics", response_model=schemas.DocumentStatistics)
def get_document_statistics(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive document management statistics with tenant isolation"""
    stats = crud_tenant.get_document_statistics(db, current_user.tenant_id)

    return schemas.DocumentStatistics(**stats)

@app.get("/api/documents/tags", response_model=List[str])
def get_all_document_tags(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all unique tag names across documents with tenant isolation"""
    return crud_tenant.get_all_document_tags(db, current_user.tenant_id)

@app.get("/api/investments/{investment_id}/documents", response_model=List[schemas.Document])
def get_investment_documents(
    investment_id: int,
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all documents for a specific investment with tenant isolation"""
    return crud_tenant.get_documents_by_investment(
        db=db,
        tenant_id=current_user.tenant_id,
        investment_id=investment_id,
        include_archived=include_archived
    )

@app.get("/api/entities/{entity_id}/documents", response_model=List[schemas.Document])
def get_entity_documents(
    entity_id: int,
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all documents for a specific entity with tenant isolation"""
    return crud_tenant.get_documents_by_entity(
        db=db,
        tenant_id=current_user.tenant_id,
        entity_id=entity_id,
        include_archived=include_archived
    )

# =============================================================================
# Entity Management Endpoints
# =============================================================================

@app.get("/api/entities", response_model=List[schemas.Entity])
def get_entities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search entities by name"),
    include_inactive: bool = Query(False, description="Include inactive entities"),
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Get entities with tenant isolation (Contributor+ required)"""
    if search:
        return crud_tenant.search_entities(
            db=db,
            tenant_id=current_user.tenant_id,
            search_term=search,
            skip=skip,
            limit=limit
        )

    if entity_type:
        return crud_tenant.get_entities_by_type(
            db=db,
            tenant_id=current_user.tenant_id,
            entity_type=entity_type,
            skip=skip,
            limit=limit
        )

    return crud_tenant.get_entities(
        db=db,
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit,
        include_inactive=include_inactive
    )

@app.post("/api/entities", response_model=schemas.Entity)
def create_entity(
    entity: schemas.EntityCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new entity with tenant isolation (Contributor+ required)"""
    return crud_tenant.create_entity(
        db=db,
        entity=entity,
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id
    )

@app.get("/api/entities/{entity_id}", response_model=schemas.Entity)
def get_entity(
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific entity with tenant isolation"""
    entity = crud_tenant.get_entity(db, entity_id, current_user.tenant_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@app.put("/api/entities/{entity_id}", response_model=schemas.Entity)
def update_entity(
    entity_id: int,
    entity_update: schemas.EntityUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update an entity with tenant isolation (Contributor+ required)"""
    updated_entity = crud_tenant.update_entity(
        db=db,
        entity_id=entity_id,
        tenant_id=current_user.tenant_id,
        entity_update=entity_update,
        updated_by_user_id=current_user.id
    )

    if not updated_entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return updated_entity

@app.delete("/api/entities/{entity_id}")
def delete_entity(
    entity_id: int,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete an entity with tenant isolation (Contributor+ required)"""
    success = crud_tenant.delete_entity(
        db=db,
        entity_id=entity_id,
        tenant_id=current_user.tenant_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")

    return {"message": "Entity deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)