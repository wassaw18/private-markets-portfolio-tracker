"""
Authentication and User Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import (
    authenticate_user, create_user_tokens, refresh_access_token,
    get_current_active_user, require_admin, require_manager,
    get_tenant_context, verify_password, get_password_hash
)
from ..models import User, UserRole
from ..schemas_auth.auth import (
    LoginRequest, TokenResponse, RefreshTokenRequest, ChangePasswordRequest,
    UserCreate, UserUpdate, UserResponse, UserListResponse, UserProfile,
    UpdateProfileRequest, ErrorResponse
)
from .. import crud_tenant

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()

# =============================================================================
# Authentication Endpoints
# =============================================================================

@router.post("/login", response_model=TokenResponse)
async def login(
    login_request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT tokens"""
    user = authenticate_user(db, login_request.username, login_request.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = create_user_tokens(user)

    # Convert user to response format
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        tenant_id=user.tenant_id,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        user=user_response
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    try:
        tokens = refresh_access_token(refresh_request.refresh_token, db)

        # Get user info for response
        from ..auth import verify_token
        token_data = verify_token(refresh_request.refresh_token, "refresh")
        user = crud_tenant.get_user(db, token_data.user_id, token_data.tenant_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            tenant_id=user.tenant_id,
            last_login=user.last_login,
            created_at=user.created_at,
            updated_at=user.updated_at
        )

        return TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type=tokens["token_type"],
            expires_in=tokens["expires_in"],
            user=user_response
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """Logout user (client should discard tokens)"""
    return {"message": "Successfully logged out"}

# =============================================================================
# User Profile Endpoints
# =============================================================================

@router.get("/profile", response_model=UserProfile)
async def get_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile"""
    tenant = crud_tenant.get_tenant(db, current_user.tenant_id)

    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        last_login=current_user.last_login,
        tenant={
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "status": tenant.status,
            "settings": tenant.settings,
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at
        }
    )

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_update: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    user_update = UserUpdate(
        first_name=profile_update.first_name,
        last_name=profile_update.last_name,
        email=profile_update.email
    )

    updated_user = crud_tenant.update_user(
        db, current_user.id, current_user.tenant_id, user_update, current_user.id
    )

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(updated_user)

@router.post("/change-password")
async def change_password(
    password_change: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change current user's password"""
    # Verify current password
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.hashed_password = get_password_hash(password_change.new_password)
    db.commit()

    return {"message": "Password changed successfully"}

# =============================================================================
# User Management Endpoints (Admin/Manager only)
# =============================================================================

@router.get("/users", response_model=UserListResponse)
async def get_users(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    """Get users in the current tenant (Manager+ required)"""
    users = crud_tenant.get_users(
        db, current_user.tenant_id, skip, limit, active_only
    )

    user_responses = [UserResponse.model_validate(user) for user in users]
    total = len(user_responses)  # For simplicity, not doing a separate count query

    return UserListResponse(
        users=user_responses,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.post("/users", response_model=UserResponse)
async def create_user(
    user_create: UserCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    """Create a new user in the current tenant (Manager+ required)"""
    # Check if user already exists
    existing_user = crud_tenant.get_user_by_email(db, user_create.email, current_user.tenant_id)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    existing_username = crud_tenant.get_user_by_username(db, user_create.username, current_user.tenant_id)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username already exists"
        )

    # Only admins can create other admins
    if user_create.role == UserRole.ADMIN and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create admin users"
        )

    new_user = crud_tenant.create_user(
        db, user_create, current_user.tenant_id, current_user.id
    )

    return UserResponse.model_validate(new_user)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    """Get a specific user (Manager+ required)"""
    user = crud_tenant.get_user(db, user_id, current_user.tenant_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    """Update a user (Manager+ required)"""
    user_to_update = crud_tenant.get_user(db, user_id, current_user.tenant_id)

    if not user_to_update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Only admins can update admin users or change roles to admin
    if (user_to_update.role == UserRole.ADMIN or user_update.role == UserRole.ADMIN) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify admin users"
        )

    # Users can't update themselves through this endpoint (use profile endpoint)
    if user_to_update.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the profile endpoint to update your own information"
        )

    updated_user = crud_tenant.update_user(
        db, user_id, current_user.tenant_id, user_update, current_user.id
    )

    return UserResponse.model_validate(updated_user)

@router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Deactivate a user (Admin only)"""
    user_to_deactivate = crud_tenant.get_user(db, user_id, current_user.tenant_id)

    if not user_to_deactivate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Can't deactivate yourself
    if user_to_deactivate.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate yourself"
        )

    # Deactivate user
    user_update = UserUpdate(is_active=False)
    crud_tenant.update_user(
        db, user_id, current_user.tenant_id, user_update, current_user.id
    )

    return {"message": "User deactivated successfully"}

# =============================================================================
# Tenant Information Endpoints
# =============================================================================

@router.get("/tenant/info")
async def get_tenant_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current tenant information"""
    tenant = crud_tenant.get_tenant(db, current_user.tenant_id)
    stats = crud_tenant.get_tenant_stats(db, current_user.tenant_id)

    return {
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "status": tenant.status,
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at
        },
        "stats": stats
    }