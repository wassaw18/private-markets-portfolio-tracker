"""
Pydantic schemas for the private markets tracker application
"""

from .auth import (
    LoginRequest, TokenResponse, RefreshTokenRequest, ChangePasswordRequest,
    UserCreate, UserUpdate, UserResponse, UserListResponse, UserProfile,
    TenantCreate, TenantUpdate, TenantResponse, TenantWithStats,
    UpdateProfileRequest, RegistrationRequest,
    ErrorResponse, ValidationErrorResponse
)

__all__ = [
    # Authentication schemas
    "LoginRequest",
    "TokenResponse",
    "RefreshTokenRequest",
    "ChangePasswordRequest",

    # User schemas
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    "UserProfile",

    # Tenant schemas
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantWithStats",

    # Profile schemas
    "UpdateProfileRequest",

    # Registration schemas
    "RegistrationRequest",

    # Error schemas
    "ErrorResponse",
    "ValidationErrorResponse"
]