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
from ..models import User, UserRole, Tenant, TenantStatus, AccountType, Invitation
from ..schemas_auth.auth import (
    LoginRequest, TokenResponse, RefreshTokenRequest, ChangePasswordRequest,
    UserCreate, UserUpdate, UserResponse, UserListResponse, UserProfile,
    UpdateProfileRequest, ErrorResponse, SignupRequest, SignupResponse,
    InviteUserRequest, InviteUserResponse, AcceptInvitationRequest, AcceptInvitationResponse,
    PasswordResetRequest, PasswordResetResponse, PasswordResetConfirm
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

    # Eager load tenant relationship for token generation
    from sqlalchemy.orm import joinedload
    user = db.query(User).options(joinedload(User.tenant)).filter(User.id == user.id).first()

    tokens = create_user_tokens(user, db)

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

    # Add account_type to response
    account_type = user.tenant.account_type.value if user.tenant else None

    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        user=user_response,
        account_type=account_type
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
# Password Reset Endpoints
# =============================================================================

@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset token.
    In production, this would send an email with the reset link.
    For development, the token is returned in the response.
    """
    from datetime import datetime, timedelta
    import secrets
    from sqlalchemy import select

    # Find user by email (across all tenants)
    user = db.execute(
        select(User).where(User.email == reset_request.email)
    ).scalar_one_or_none()

    # Always return success to prevent email enumeration
    if not user:
        return PasswordResetResponse(
            message="If an account with that email exists, a password reset link has been sent."
        )

    # Check if user is active
    if not user.is_active:
        return PasswordResetResponse(
            message="If an account with that email exists, a password reset link has been sent."
        )

    # Generate reset token
    reset_token = secrets.token_urlsafe(32)

    # Store token in user record with expiration (1 hour)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # In production, send email here with reset link
    # For now, return token in response for development
    reset_link = f"/reset-password/{reset_token}"

    return PasswordResetResponse(
        message="If an account with that email exists, a password reset link has been sent.",
        reset_token=reset_token  # Only for development - remove in production
    )

@router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Confirm password reset using the reset token and set new password.
    """
    from datetime import datetime
    from sqlalchemy import select, and_

    # Find user with valid reset token
    user = db.execute(
        select(User).where(
            and_(
                User.reset_token == reset_confirm.token,
                User.reset_token_expires > datetime.utcnow(),
                User.is_active == True
            )
        )
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Update password
    user.hashed_password = get_password_hash(reset_confirm.new_password)

    # Clear reset token
    user.reset_token = None
    user.reset_token_expires = None

    db.commit()

    return {"message": "Password has been reset successfully. You can now log in with your new password."}

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
# Registration Endpoints
# =============================================================================

@router.post("/signup", response_model=SignupResponse)
async def signup(
    signup_request: SignupRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new organization/user account with account type selection.
    Creates a new tenant and admin user in a single transaction.
    """
    # Check if email already exists across all tenants
    from sqlalchemy import select
    existing_user = db.execute(
        select(User).where(User.email == signup_request.email)
    ).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Check if organization name is too similar to existing tenants (basic check)
    existing_tenant = db.execute(
        select(Tenant).where(Tenant.name == signup_request.organization_name)
    ).scalar_one_or_none()

    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization with this name already exists"
        )

    try:
        # Create new tenant with account type
        from datetime import datetime
        new_tenant = Tenant(
            name=signup_request.organization_name,
            status=TenantStatus.ACTIVE,
            account_type=signup_request.account_type,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_tenant)
        db.flush()  # Get the tenant ID

        # Create admin user for the tenant
        hashed_password = get_password_hash(signup_request.password)
        admin_user = User(
            username=signup_request.username,
            email=signup_request.email,
            hashed_password=hashed_password,
            first_name=signup_request.first_name,
            last_name=signup_request.last_name,
            role=UserRole.ADMIN,
            is_active=True,
            tenant_id=new_tenant.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(admin_user)
        db.commit()
        db.refresh(new_tenant)
        db.refresh(admin_user)

        return SignupResponse(
            tenant_id=new_tenant.id,
            user_id=admin_user.id,
            tenant_name=new_tenant.name,
            account_type=new_tenant.account_type.value,
            message=f"Account created successfully. Welcome to {new_tenant.name}!"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(e)}"
        )

@router.post("/invite", response_model=InviteUserResponse)
async def invite_user(
    invite_request: InviteUserRequest,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    """
    Invite a new user to join the current tenant (Manager+ required).
    Creates an invitation token that can be used to accept the invitation.
    """
    from datetime import datetime, timedelta
    import secrets

    # Check if user already exists in this tenant
    existing_user = crud_tenant.get_user_by_email(db, invite_request.email, current_user.tenant_id)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists in this organization"
        )

    # Check for pending invitations
    from sqlalchemy import select, and_
    existing_invitation = db.execute(
        select(Invitation).where(
            and_(
                Invitation.email == invite_request.email,
                Invitation.tenant_id == current_user.tenant_id,
                Invitation.is_accepted == False,
                Invitation.is_expired == False
            )
        )
    ).scalar_one_or_none()

    if existing_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending invitation already exists for this email"
        )

    # Only admins can invite other admins
    if invite_request.role == UserRole.ADMIN and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can invite admin users"
        )

    # Generate invitation token
    invitation_token = secrets.token_urlsafe(32)

    # Create invitation (expires in 7 days)
    invitation = Invitation(
        email=invite_request.email,
        role=invite_request.role,
        invitation_token=invitation_token,
        expires_at=datetime.utcnow() + timedelta(days=7),
        tenant_id=current_user.tenant_id,
        invited_by_user_id=current_user.id,
        created_at=datetime.utcnow()
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Generate invitation link (in production, this would use actual domain)
    invitation_link = f"/accept-invite/{invitation_token}"

    return InviteUserResponse(
        invitation_id=invitation.id,
        email=invitation.email,
        role=invitation.role,
        invitation_token=invitation_token,
        invitation_link=invitation_link,
        expires_at=invitation.expires_at,
        message=f"Invitation sent to {invitation.email}"
    )

@router.post("/accept-invite/{token}", response_model=AcceptInvitationResponse)
async def accept_invitation(
    token: str,
    accept_request: AcceptInvitationRequest,
    db: Session = Depends(get_db)
):
    """
    Accept an invitation using the invitation token.
    Creates a new user account in the invited tenant.
    """
    from datetime import datetime
    from sqlalchemy import select, and_

    # Find the invitation
    invitation = db.execute(
        select(Invitation).where(
            and_(
                Invitation.invitation_token == token,
                Invitation.is_accepted == False,
                Invitation.is_expired == False
            )
        )
    ).scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation"
        )

    # Check if invitation is expired
    if invitation.expires_at < datetime.utcnow():
        invitation.is_expired = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )

    # Check if user already exists with this email
    existing_user = db.execute(
        select(User).where(User.email == invitation.email)
    ).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Check if username already exists in the tenant
    existing_username = crud_tenant.get_user_by_username(db, accept_request.username, invitation.tenant_id)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists in this organization"
        )

    try:
        # Create the new user
        hashed_password = get_password_hash(accept_request.password)
        new_user = User(
            username=accept_request.username,
            email=invitation.email,
            hashed_password=hashed_password,
            first_name=accept_request.first_name or invitation.email.split('@')[0],
            last_name=accept_request.last_name,
            role=invitation.role,
            is_active=True,
            tenant_id=invitation.tenant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(new_user)
        db.flush()

        # Mark invitation as accepted
        invitation.is_accepted = True
        invitation.accepted_at = datetime.utcnow()
        invitation.accepted_user_id = new_user.id

        db.commit()
        db.refresh(new_user)

        # Get tenant info
        tenant = crud_tenant.get_tenant(db, invitation.tenant_id)

        return AcceptInvitationResponse(
            user_id=new_user.id,
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            username=new_user.username,
            role=new_user.role,
            message=f"Welcome to {tenant.name}! Your account has been created successfully."
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(e)}"
        )

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