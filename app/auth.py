"""
JWT Authentication System for Multi-Tenant Private Markets Tracker

This module provides JWT token generation, validation, and user authentication
with tenant isolation and role-based access control.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, Tenant, UserRole

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Bearer scheme
security = HTTPBearer()

class AuthenticationError(Exception):
    """Custom exception for authentication errors"""
    pass

class AuthorizationError(Exception):
    """Custom exception for authorization errors"""
    pass

class TokenData:
    """Data structure for JWT token payload"""
    def __init__(self, user_id: int, tenant_id: int, username: str, role: str):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.username = username
        self.role = role

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Handle development SHA256 format
    if hashed_password.startswith('sha256:'):
        import hashlib
        sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return hashed_password == f'sha256:{sha256_hash}'

    # Handle plain text (for testing only - NOT for production)
    if hashed_password == plain_password:
        return True

    # Handle bcrypt format
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # If bcrypt fails, it might be an unknown format
        return False

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Authenticate a user by username/email and password

    Args:
        db: Database session
        username: Username or email
        password: Plain text password

    Returns:
        User object if authentication successful, None otherwise
    """
    # Try to find user by username or email
    user = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token

    Args:
        data: Token payload data
        expires_delta: Token expiration time (optional)

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token

    Args:
        data: Token payload data

    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str, token_type: str = "access") -> TokenData:
    """
    Verify and decode a JWT token

    Args:
        token: JWT token to verify
        token_type: Expected token type ("access" or "refresh")

    Returns:
        TokenData object with token payload

    Raises:
        AuthenticationError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Verify token type
        if payload.get("type") != token_type:
            raise AuthenticationError("Invalid token type")

        user_id = payload.get("user_id")
        tenant_id = payload.get("tenant_id")
        username = payload.get("username")
        role = payload.get("role")

        if user_id is None or tenant_id is None or username is None:
            raise AuthenticationError("Invalid token payload")

        return TokenData(
            user_id=user_id,
            tenant_id=tenant_id,
            username=username,
            role=role
        )

    except JWTError:
        raise AuthenticationError("Invalid token")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user

    Args:
        credentials: HTTP Bearer token credentials
        db: Database session

    Returns:
        Current authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_data = verify_token(credentials.credentials)

        # Get user from database to ensure they still exist and are active
        user = db.query(User).filter(
            User.id == token_data.user_id,
            User.tenant_id == token_data.tenant_id
        ).first()

        if user is None or not user.is_active:
            raise credentials_exception

        return user

    except AuthenticationError:
        raise credentials_exception

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to get the current active user

    Args:
        current_user: Current authenticated user

    Returns:
        Current active user

    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return current_user

def require_role(required_role: UserRole):
    """
    Dependency factory to require a specific user role

    Args:
        required_role: Minimum required user role

    Returns:
        Dependency function that checks user role
    """
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        role_hierarchy = {
            UserRole.VIEWER: 1,
            UserRole.CONTRIBUTOR: 2,
            UserRole.MANAGER: 3,
            UserRole.ADMIN: 4
        }

        user_role_level = role_hierarchy.get(current_user.role, 0)
        required_role_level = role_hierarchy.get(required_role, 999)

        if user_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {required_role.value}"
            )

        return current_user

    return role_checker

def get_tenant_context(current_user: User = Depends(get_current_active_user)) -> Tuple[User, int]:
    """
    Dependency to get current user and tenant context

    Args:
        current_user: Current authenticated user

    Returns:
        Tuple of (user, tenant_id)
    """
    return current_user, current_user.tenant_id

def create_user_tokens(user: User) -> dict:
    """
    Create access and refresh tokens for a user

    Args:
        user: User to create tokens for

    Returns:
        Dictionary with access_token and refresh_token
    """
    token_data = {
        "user_id": user.id,
        "tenant_id": user.tenant_id,
        "username": user.username,
        "role": user.role.value
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds
    }

def refresh_access_token(refresh_token: str, db: Session) -> dict:
    """
    Create a new access token using a refresh token

    Args:
        refresh_token: Valid refresh token
        db: Database session

    Returns:
        New token dictionary

    Raises:
        AuthenticationError: If refresh token is invalid
    """
    try:
        token_data = verify_token(refresh_token, "refresh")

        # Verify user still exists and is active
        user = db.query(User).filter(
            User.id == token_data.user_id,
            User.tenant_id == token_data.tenant_id
        ).first()

        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        return create_user_tokens(user)

    except AuthenticationError:
        raise AuthenticationError("Invalid refresh token")

# Convenience dependencies for common role requirements
require_admin = require_role(UserRole.ADMIN)
require_manager = require_role(UserRole.MANAGER)
require_contributor = require_role(UserRole.CONTRIBUTOR)
require_viewer = require_role(UserRole.VIEWER)