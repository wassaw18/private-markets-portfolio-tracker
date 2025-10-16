"""
Pydantic schemas for authentication and user management
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, validator

from ..models import UserRole, TenantStatus, AccountType

# Authentication Schemas

class LoginRequest(BaseModel):
    """Request schema for user login"""
    username: str  # Can be username or email
    password: str

    class Config:
        schema_extra = {
            "example": {
                "username": "admin@example.com",
                "password": "secure_password"
            }
        }

class TokenResponse(BaseModel):
    """Response schema for token generation"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: 'UserResponse'

class RefreshTokenRequest(BaseModel):
    """Request schema for token refresh"""
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    """Request schema for password change"""
    current_password: str
    new_password: str
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

    @validator('new_password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

# User Management Schemas

class UserBase(BaseModel):
    """Base user schema with common fields"""
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole = UserRole.VIEWER
    is_active: bool = True

class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str
    tenant_id: Optional[int] = None  # Optional for tenant admins creating users

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

    class Config:
        schema_extra = {
            "example": {
                "username": "john_doe",
                "email": "john.doe@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "password": "secure_password",
                "role": "Contributor",
                "is_active": True
            }
        }

class UserUpdate(BaseModel):
    """Schema for updating user information"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    """Response schema for user information"""
    id: int
    tenant_id: int
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    """Response schema for user list"""
    users: list[UserResponse]
    total: int
    page: int
    size: int

# Tenant Management Schemas

class TenantBase(BaseModel):
    """Base tenant schema"""
    name: str
    subdomain: Optional[str] = None
    settings: Optional[str] = None  # JSON string

class TenantCreate(TenantBase):
    """Schema for creating a new tenant"""
    admin_username: str
    admin_email: EmailStr
    admin_password: str
    admin_first_name: Optional[str] = None
    admin_last_name: Optional[str] = None

    @validator('admin_password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Admin password must be at least 8 characters long')
        return v

    class Config:
        schema_extra = {
            "example": {
                "name": "Acme Family Office",
                "subdomain": "acme",
                "admin_username": "admin",
                "admin_email": "admin@acme.com",
                "admin_password": "secure_password",
                "admin_first_name": "Admin",
                "admin_last_name": "User"
            }
        }

class TenantUpdate(BaseModel):
    """Schema for updating tenant information"""
    name: Optional[str] = None
    subdomain: Optional[str] = None
    status: Optional[TenantStatus] = None
    settings: Optional[str] = None

class TenantResponse(TenantBase):
    """Response schema for tenant information"""
    id: int
    status: TenantStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TenantWithStats(TenantResponse):
    """Tenant response with usage statistics"""
    user_count: int
    entity_count: int
    investment_count: int

# Profile Management Schemas

class UserProfile(BaseModel):
    """Schema for user profile information"""
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    role: UserRole
    last_login: Optional[datetime]
    tenant: TenantResponse

    class Config:
        from_attributes = True

class UpdateProfileRequest(BaseModel):
    """Request schema for updating user profile"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

# Registration Schemas (for self-service registration if enabled)

class RegistrationRequest(BaseModel):
    """Request schema for user self-registration"""
    username: str
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

    class Config:
        schema_extra = {
            "example": {
                "username": "john_doe",
                "email": "john.doe@neworg.com",
                "password": "secure_password",
                "first_name": "John",
                "last_name": "Doe",
                "organization_name": "New Family Office"
            }
        }

# Signup Schemas (with account type selection)

class SignupRequest(BaseModel):
    """Request schema for new account signup with account type selection"""
    # Organization details
    organization_name: str
    account_type: AccountType  # individual, family_office, fund_manager

    # Admin user details
    username: str
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

    @validator('username')
    def username_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        return v

    class Config:
        schema_extra = {
            "example": {
                "organization_name": "Smith Family Office",
                "account_type": "family_office",
                "username": "john_smith",
                "email": "john@smithfamily.com",
                "password": "secure_password",
                "first_name": "John",
                "last_name": "Smith"
            }
        }

class SignupResponse(BaseModel):
    """Response schema for signup"""
    tenant_id: int
    user_id: int
    tenant_name: str
    account_type: str
    message: str

# User Invitation Schemas

class InviteUserRequest(BaseModel):
    """Request schema for inviting a user to a tenant"""
    email: EmailStr
    role: UserRole  # Role to assign to the invited user
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    send_email: bool = True  # Whether to send invitation email

    class Config:
        schema_extra = {
            "example": {
                "email": "mary@smithfamily.com",
                "role": "Viewer",
                "first_name": "Mary",
                "last_name": "Smith",
                "send_email": True
            }
        }

class InviteUserResponse(BaseModel):
    """Response schema for user invitation"""
    invitation_id: int
    email: EmailStr
    role: UserRole
    invitation_token: str
    invitation_link: str
    expires_at: datetime
    message: str

class AcceptInvitationRequest(BaseModel):
    """Request schema for accepting an invitation"""
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

    @validator('username')
    def username_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        return v

    class Config:
        schema_extra = {
            "example": {
                "username": "mary_smith",
                "password": "secure_password",
                "first_name": "Mary",
                "last_name": "Smith"
            }
        }

class AcceptInvitationResponse(BaseModel):
    """Response schema for accepting invitation"""
    user_id: int
    tenant_id: int
    tenant_name: str
    username: str
    role: UserRole
    message: str

# Error Schemas

class ErrorResponse(BaseModel):
    """Standard error response schema"""
    detail: str
    error_code: Optional[str] = None

class ValidationErrorResponse(BaseModel):
    """Validation error response schema"""
    detail: str
    errors: list[dict]

# Update forward references
TokenResponse.model_rebuild()