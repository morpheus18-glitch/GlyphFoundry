"""
Advanced Authentication and Authorization System
Quantum-Enhanced Security with Multi-Tenant Row Level Security
"""

import jwt
import os
import uuid
from functools import wraps
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .db import get_db
from .security import security_manager, create_jwt_token, verify_jwt_token
security = HTTPBearer()

class AuthenticationError(Exception):
    """Custom authentication error."""
    pass

class AuthorizationError(Exception):
    """Custom authorization error."""
    pass

def create_access_token(data: Dict[str, Any], tenant_id: str, db: Session, 
                       expires_delta: Optional[timedelta] = None) -> str:
    """Create secure JWT access token with enterprise-grade security."""
    to_encode = data.copy()
    to_encode["type"] = "access"
    
    hours = expires_delta.total_seconds() / 3600 if expires_delta else 24
    
    return create_jwt_token(to_encode, tenant_id, db, int(hours))

def verify_token(token: str, tenant_id: str, db: Session) -> Dict[str, Any]:
    """Verify and decode JWT token with enterprise-grade security checks."""
    try:
        payload = verify_jwt_token(token, tenant_id, db)
        
        # Additional security checks
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        
        return payload
        
    except ValueError as e:
        raise AuthenticationError(str(e))

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get current authenticated user with enterprise security and tenant isolation."""
    try:
        # First get basic token info to extract tenant_id
        try:
            # Decode without verification to get tenant_id
            unverified = jwt.decode(credentials.credentials, options={"verify_signature": False})
            tenant_id = unverified.get("tenant_id")
            
            if not tenant_id:
                raise AuthenticationError("No tenant ID in token")
        except jwt.DecodeError:
            raise AuthenticationError("Invalid token format")
        
        # Now verify token with proper tenant security
        payload = verify_token(credentials.credentials, tenant_id, db)
        user_id = payload.get("sub")
        
        if not user_id:
            raise AuthenticationError("Invalid user ID in token")
        
        # Set tenant context for RLS BEFORE querying
        db.execute(text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"), 
                  {"tenant_id": tenant_id})
        
        # Get user from database with tenant info
        user_sql = text("""
            SELECT id, email, first_name, last_name, profile_image_url, 
                   tenant_id, security_clearance, created_at, updated_at
            FROM users 
            WHERE id = :user_id AND tenant_id = :tenant_id
        """)
        
        result = db.execute(user_sql, {"user_id": user_id, "tenant_id": tenant_id})
        user = result.fetchone()
        
        if not user:
            raise AuthenticationError("User not found or access denied")
        
        # Log successful authentication
        security_manager.log_security_event(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type="authentication_success",
            event_data={"user_agent": "api_access"},
            severity="info",
            db=db
        )
        
        return {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "profile_image_url": user.profile_image_url,
            "tenant_id": str(user.tenant_id),
            "security_clearance": user.security_clearance,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Log failed authentication attempt
        try:
            unverified = jwt.decode(credentials.credentials, options={"verify_signature": False})
            tenant_id = unverified.get("tenant_id")
            if tenant_id:
                security_manager.log_security_event(
                    tenant_id=tenant_id,
                    event_type="authentication_failure",
                    event_data={"error": str(e), "user_agent": "api_access"},
                    severity="warning",
                    db=db
                )
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )

def require_security_clearance(min_clearance: int):
    """Decorator to require minimum security clearance level."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            user_clearance = current_user.get('security_clearance', 0)
            if user_clearance < min_clearance:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient security clearance. Required: {min_clearance}, Current: {user_clearance}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

async def get_user_with_clearance(min_clearance: int):
    """Dependency to get user with minimum security clearance."""
    def _get_user(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_clearance = current_user.get('security_clearance', 0)
        if user_clearance < min_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient security clearance. Required: {min_clearance}, Current: {user_clearance}"
            )
        return current_user
    return _get_user

async def create_or_update_user(user_claims: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """Create or update user from authentication claims."""
    user_id = user_claims.get('sub')
    email = user_claims.get('email')
    first_name = user_claims.get('first_name')
    last_name = user_claims.get('last_name')
    profile_image_url = user_claims.get('profile_image_url')
    
    # Check if user exists
    check_sql = text("SELECT id, tenant_id FROM users WHERE id = :user_id")
    result = db.execute(check_sql, {"user_id": user_id})
    existing_user = result.fetchone()
    
    if existing_user:
        # Update existing user
        update_sql = text("""
            UPDATE users 
            SET email = :email, first_name = :first_name, last_name = :last_name,
                profile_image_url = :profile_image_url, updated_at = NOW()
            WHERE id = :user_id
            RETURNING id, email, first_name, last_name, profile_image_url, 
                     tenant_id, security_clearance, created_at, updated_at
        """)
        
        result = db.execute(update_sql, {
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url
        })
    else:
        # Create new user with new tenant
        insert_sql = text("""
            INSERT INTO users (id, email, first_name, last_name, profile_image_url, 
                             tenant_id, security_clearance)
            VALUES (:user_id, :email, :first_name, :last_name, :profile_image_url,
                    gen_random_uuid(), 5)
            RETURNING id, email, first_name, last_name, profile_image_url, 
                     tenant_id, security_clearance, created_at, updated_at
        """)
        
        result = db.execute(insert_sql, {
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url
        })
    
    user = result.fetchone()
    db.commit()
    
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_image_url": user.profile_image_url,
        "tenant_id": str(user.tenant_id),
        "security_clearance": user.security_clearance,
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }

async def encrypt_sensitive_data(data: str, tenant_id: str, db: Session) -> Dict[str, str]:
    """Encrypt sensitive data using enterprise-grade tenant-specific encryption."""
    return security_manager.encrypt_tenant_data(data, tenant_id, db)

async def decrypt_sensitive_data(encrypted_package: Dict[str, str], tenant_id: str, db: Session) -> str:
    """Decrypt sensitive data using enterprise-grade tenant-specific decryption."""
    return security_manager.decrypt_tenant_data(encrypted_package, tenant_id, db)

# Security middleware for enhanced protection
class SecurityMiddleware:
    """Advanced security middleware with threat detection."""
    
    def __init__(self):
        self.failed_attempts = {}
        self.blocked_ips = set()
        
    async def check_rate_limit(self, request: Request) -> bool:
        """Check rate limits and detect brute force attacks."""
        client_ip = request.client.host
        
        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            return False
        
        # Simple rate limiting (in production, use Redis)
        current_time = datetime.utcnow()
        if client_ip not in self.failed_attempts:
            self.failed_attempts[client_ip] = []
        
        # Clean old attempts (older than 1 hour)
        self.failed_attempts[client_ip] = [
            attempt for attempt in self.failed_attempts[client_ip]
            if current_time - attempt < timedelta(hours=1)
        ]
        
        # Check if too many attempts
        if len(self.failed_attempts[client_ip]) >= 10:
            self.blocked_ips.add(client_ip)
            return False
        
        return True
    
    async def record_failed_attempt(self, request: Request):
        """Record failed authentication attempt."""
        client_ip = request.client.host
        if client_ip not in self.failed_attempts:
            self.failed_attempts[client_ip] = []
        
        self.failed_attempts[client_ip].append(datetime.utcnow())

# Global security middleware instance
security_middleware = SecurityMiddleware()

# Authentication dependencies for different security levels
async def get_authenticated_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Basic authentication dependency."""
    return current_user

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_user_with_clearance(8))):
    """Admin-level authentication dependency."""
    return current_user

async def get_superuser(current_user: Dict[str, Any] = Depends(get_user_with_clearance(10))):
    """Superuser authentication dependency."""
    return current_user