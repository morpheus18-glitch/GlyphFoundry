"""
Enterprise-Grade Security System
Fixed Encryption and Authentication with True Enterprise Security
"""

import os
import secrets
import base64
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, padding
import jwt

from .db import get_db

logger = logging.getLogger(__name__)

@dataclass
class TenantSecrets:
    """Secure tenant secret management."""
    tenant_id: str
    encryption_key: bytes
    signing_key: bytes
    created_at: datetime
    last_rotated: datetime
    key_version: int

class EnterpriseSecurityManager:
    """Enterprise-grade security with proper key management."""
    
    def __init__(self):
        self.backend = default_backend()
        
        # Master application key (MUST be provided via environment)
        self._master_key = self._get_master_key_from_environment()
        
        # Tenant secrets cache (in production, use Redis with encryption)
        self._tenant_secrets_cache: Dict[str, TenantSecrets] = {}
        
        # Initialize security infrastructure
        self._ensure_security_tables()
        self._validate_master_key_integrity()
    
    def _get_master_key_from_environment(self) -> bytes:
        """Get master key from environment - FAIL CLOSED if not available."""
        master_key_b64 = os.environ.get("MASTER_ENCRYPTION_KEY")
        
        if not master_key_b64:
            # For development only - use a fixed development key
            if os.environ.get("ENVIRONMENT", "").lower() in ["development", "dev", "local"]:
                logger.warning("Using development master key - NOT suitable for production")
                dev_key = "x" * 44  # base64-encoded 32 bytes of 'x'
                return base64.b64decode(dev_key + "==")
            
            # FAIL CLOSED in production
            raise ValueError(
                "MASTER_ENCRYPTION_KEY environment variable is required for production. "
                "Generate with: python -c \"import secrets, base64; "
                "print(base64.b64encode(secrets.token_bytes(32)).decode())\" "
                "and set as environment variable. NEVER log this key."
            )
        
        try:
            key = base64.b64decode(master_key_b64)
            if len(key) != 32:
                raise ValueError("Master key must be exactly 32 bytes (256 bits)")
            return key
        except Exception as e:
            raise ValueError(f"Invalid MASTER_ENCRYPTION_KEY format: {e}")
    
    def _validate_master_key_integrity(self):
        """Validate that master key can decrypt existing tenant secrets."""
        try:
            db_gen = get_db()
            db = next(db_gen)
            
            # Test decryption of existing tenant secrets
            result = db.execute(text("""
                SELECT tenant_id, encrypted_key_material 
                FROM tenant_secrets 
                WHERE status = 'active' 
                LIMIT 1
            """))
            
            row = result.fetchone()
            if row:
                try:
                    # Test decryption
                    self._decrypt_with_master_key(row.encrypted_key_material)
                    logger.info("Master key validation successful")
                except Exception as e:
                    # FAIL CLOSED - cannot decrypt existing data
                    raise RuntimeError(
                        f"Master key cannot decrypt existing tenant secrets. "
                        f"This indicates key rotation without migration or corrupted key. "
                        f"Error: {e}"
                    )
            else:
                logger.info("No existing tenant secrets to validate")
            
            db.close()
            
        except Exception as e:
            if "Master key cannot decrypt" in str(e):
                raise  # Re-raise key validation failures
            logger.warning(f"Could not validate master key integrity: {e}")
    
    def _ensure_security_tables(self):
        """Ensure security tables exist."""
        try:
            db_gen = get_db()
            db = next(db_gen)
            
            # Create tenant secrets table with proper encryption
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_secrets (
                    tenant_id UUID PRIMARY KEY,
                    encrypted_key_material BYTEA NOT NULL,
                    key_version INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_rotated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    status TEXT DEFAULT 'active',
                    metadata JSONB DEFAULT '{}'::jsonb
                )
            """))
            
            # Create security audit log
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS security_audit_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID,
                    user_id TEXT,
                    event_type TEXT NOT NULL,
                    event_data JSONB NOT NULL,
                    ip_address INET,
                    user_agent TEXT,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    severity TEXT DEFAULT 'info'
                )
            """))
            
            db.commit()
            db.close()
            
        except Exception as e:
            raise RuntimeError(f"Failed to initialize security tables: {e}")
    
    def get_tenant_secrets(self, tenant_id: str, db: Session) -> TenantSecrets:
        """Get or create secure tenant secrets."""
        # Check cache first
        if tenant_id in self._tenant_secrets_cache:
            return self._tenant_secrets_cache[tenant_id]
        
        # Check database
        result = db.execute(text("""
            SELECT tenant_id, encrypted_key_material, key_version, created_at, last_rotated
            FROM tenant_secrets 
            WHERE tenant_id = :tenant_id AND status = 'active'
        """), {"tenant_id": tenant_id})
        
        row = result.fetchone()
        
        if row:
            # Decrypt the key material using master key
            decrypted_material = self._decrypt_with_master_key(row.encrypted_key_material)
            key_data = json.loads(decrypted_material.decode())
            
            secrets_obj = TenantSecrets(
                tenant_id=tenant_id,
                encryption_key=base64.b64decode(key_data['encryption_key']),
                signing_key=base64.b64decode(key_data['signing_key']),
                created_at=row.created_at,
                last_rotated=row.last_rotated,
                key_version=row.key_version
            )
        else:
            # Create new tenant secrets
            secrets_obj = self._create_tenant_secrets(tenant_id, db)
        
        # Cache the secrets
        self._tenant_secrets_cache[tenant_id] = secrets_obj
        return secrets_obj
    
    def _create_tenant_secrets(self, tenant_id: str, db: Session) -> TenantSecrets:
        """Create new secure tenant secrets."""
        # Generate cryptographically secure random keys
        encryption_key = secrets.token_bytes(32)  # 256-bit AES key
        signing_key = secrets.token_bytes(64)     # 512-bit HMAC key
        
        # Create secrets object
        secrets_obj = TenantSecrets(
            tenant_id=tenant_id,
            encryption_key=encryption_key,
            signing_key=signing_key,
            created_at=datetime.utcnow(),
            last_rotated=datetime.utcnow(),
            key_version=1
        )
        
        # Encrypt key material with master key
        key_data = {
            'encryption_key': base64.b64encode(encryption_key).decode(),
            'signing_key': base64.b64encode(signing_key).decode(),
            'created_at': secrets_obj.created_at.isoformat()
        }
        
        encrypted_material = self._encrypt_with_master_key(json.dumps(key_data).encode())
        
        # Store in database
        db.execute(text("""
            INSERT INTO tenant_secrets (tenant_id, encrypted_key_material, key_version)
            VALUES (:tenant_id, :encrypted_material, 1)
            ON CONFLICT (tenant_id) DO UPDATE SET
                encrypted_key_material = EXCLUDED.encrypted_key_material,
                last_rotated = NOW()
        """), {
            "tenant_id": tenant_id,
            "encrypted_material": encrypted_material
        })
        
        db.commit()
        return secrets_obj
    
    def _encrypt_with_master_key(self, data: bytes) -> bytes:
        """Encrypt data with master key using AES-GCM."""
        # Generate random nonce
        nonce = secrets.token_bytes(12)  # 96 bits for GCM
        
        # Create cipher
        cipher = Cipher(algorithms.AES(self._master_key), modes.GCM(nonce), backend=self.backend)
        encryptor = cipher.encryptor()
        
        # Encrypt
        ciphertext = encryptor.update(data) + encryptor.finalize()
        
        # Return nonce + tag + ciphertext
        return nonce + encryptor.tag + ciphertext
    
    def _decrypt_with_master_key(self, encrypted_data: bytes) -> bytes:
        """Decrypt data with master key using AES-GCM."""
        # Extract components
        nonce = encrypted_data[:12]
        tag = encrypted_data[12:28]
        ciphertext = encrypted_data[28:]
        
        # Create cipher
        cipher = Cipher(algorithms.AES(self._master_key), modes.GCM(nonce, tag), backend=self.backend)
        decryptor = cipher.decryptor()
        
        # Decrypt
        return decryptor.update(ciphertext) + decryptor.finalize()
    
    def encrypt_tenant_data(self, data: str, tenant_id: str, db: Session) -> Dict[str, str]:
        """Encrypt data with proper tenant-specific encryption."""
        tenant_secrets = self.get_tenant_secrets(tenant_id, db)
        
        # Generate random nonce
        nonce = secrets.token_bytes(12)  # 96 bits for GCM
        
        # Create cipher with tenant's encryption key
        cipher = Cipher(
            algorithms.AES(tenant_secrets.encryption_key),
            modes.GCM(nonce),
            backend=self.backend
        )
        encryptor = cipher.encryptor()
        
        # Encrypt data
        ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
        
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'tag': base64.b64encode(encryptor.tag).decode(),
            'key_version': tenant_secrets.key_version,
            'algorithm': 'AES-256-GCM',
            'tenant_id': tenant_id
        }
    
    def decrypt_tenant_data(self, encrypted_package: Dict[str, str], tenant_id: str, db: Session) -> str:
        """Decrypt data with proper tenant-specific decryption."""
        tenant_secrets = self.get_tenant_secrets(tenant_id, db)
        
        # Verify tenant ID matches
        if encrypted_package.get('tenant_id') != tenant_id:
            raise ValueError("Tenant ID mismatch in encrypted package")
        
        # Extract components
        ciphertext = base64.b64decode(encrypted_package['ciphertext'])
        nonce = base64.b64decode(encrypted_package['nonce'])
        tag = base64.b64decode(encrypted_package['tag'])
        
        # Handle key version compatibility
        package_key_version = encrypted_package.get('key_version', 1)
        if package_key_version != tenant_secrets.key_version:
            # In production, implement key version management
            raise ValueError(f"Key version mismatch: package={package_key_version}, current={tenant_secrets.key_version}")
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(tenant_secrets.encryption_key),
            modes.GCM(nonce, tag),
            backend=self.backend
        )
        decryptor = cipher.decryptor()
        
        # Decrypt data
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        return plaintext.decode()
    
    def create_secure_jwt(self, payload: Dict[str, Any], tenant_id: str, db: Session, 
                         expires_in_hours: int = 24) -> str:
        """Create secure JWT token with tenant-specific signing."""
        tenant_secrets = self.get_tenant_secrets(tenant_id, db)
        
        # Add standard claims
        now = datetime.utcnow()
        payload.update({
            'iat': now,
            'exp': now + timedelta(hours=expires_in_hours),
            'iss': 'quantum-nexus',
            'aud': tenant_id,
            'jti': secrets.token_urlsafe(32),  # Unique token ID for revocation
            'tenant_id': tenant_id,
            'key_version': tenant_secrets.key_version
        })
        
        # Sign with tenant's signing key
        return jwt.encode(payload, tenant_secrets.signing_key, algorithm='HS512')
    
    def verify_secure_jwt(self, token: str, tenant_id: str, db: Session) -> Dict[str, Any]:
        """Verify JWT token with proper tenant validation."""
        tenant_secrets = self.get_tenant_secrets(tenant_id, db)
        
        try:
            # Decode and verify
            payload = jwt.decode(
                token, 
                tenant_secrets.signing_key, 
                algorithms=['HS512'],
                audience=tenant_id,
                issuer='quantum-nexus'
            )
            
            # Additional security checks
            if payload.get('tenant_id') != tenant_id:
                raise jwt.InvalidTokenError("Tenant ID mismatch")
            
            token_key_version = payload.get('key_version', 1)
            if token_key_version != tenant_secrets.key_version:
                # Token signed with old key - in production, implement grace period
                raise jwt.InvalidTokenError("Key version mismatch - token may be compromised")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise ValueError(f"Invalid token: {e}")
    
    def rotate_tenant_keys(self, tenant_id: str, db: Session) -> bool:
        """Rotate tenant encryption and signing keys."""
        try:
            # Create new secrets with incremented version
            current_secrets = self.get_tenant_secrets(tenant_id, db)
            new_version = current_secrets.key_version + 1
            
            # Generate new keys
            new_encryption_key = secrets.token_bytes(32)
            new_signing_key = secrets.token_bytes(64)
            
            # Encrypt new key material
            key_data = {
                'encryption_key': base64.b64encode(new_encryption_key).decode(),
                'signing_key': base64.b64encode(new_signing_key).decode(),
                'created_at': datetime.utcnow().isoformat()
            }
            
            encrypted_material = self._encrypt_with_master_key(json.dumps(key_data).encode())
            
            # Update database
            db.execute(text("""
                UPDATE tenant_secrets 
                SET encrypted_key_material = :encrypted_material,
                    key_version = :new_version,
                    last_rotated = NOW()
                WHERE tenant_id = :tenant_id
            """), {
                "tenant_id": tenant_id,
                "encrypted_material": encrypted_material,
                "new_version": new_version
            })
            
            db.commit()
            
            # Update cache
            if tenant_id in self._tenant_secrets_cache:
                self._tenant_secrets_cache[tenant_id].encryption_key = new_encryption_key
                self._tenant_secrets_cache[tenant_id].signing_key = new_signing_key
                self._tenant_secrets_cache[tenant_id].key_version = new_version
                self._tenant_secrets_cache[tenant_id].last_rotated = datetime.utcnow()
            
            # Log security event
            self.log_security_event(
                tenant_id=tenant_id,
                event_type="key_rotation",
                event_data={"new_version": new_version, "old_version": current_secrets.key_version},
                severity="info",
                db=db
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to rotate keys for tenant {tenant_id}: {e}")
            return False
    
    def log_security_event(self, tenant_id: str, event_type: str, event_data: Dict[str, Any],
                          severity: str = "info", user_id: str = None, ip_address: str = None,
                          user_agent: str = None, db: Session = None):
        """Log security events for audit purposes."""
        if db is None:
            db_gen = get_db()
            db = next(db_gen)
            should_close = True
        else:
            should_close = False
        
        try:
            db.execute(text("""
                INSERT INTO security_audit_log 
                (tenant_id, user_id, event_type, event_data, ip_address, user_agent, severity)
                VALUES (:tenant_id, :user_id, :event_type, :event_data, :ip_address, :user_agent, :severity)
            """), {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "event_type": event_type,
                "event_data": json.dumps(event_data),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "severity": severity
            })
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
        finally:
            if should_close:
                db.close()

# Global security manager instance
security_manager = EnterpriseSecurityManager()

# Convenience functions
def encrypt_data(data: str, tenant_id: str, db: Session) -> Dict[str, str]:
    """Encrypt data with enterprise-grade security."""
    return security_manager.encrypt_tenant_data(data, tenant_id, db)

def decrypt_data(encrypted_package: Dict[str, str], tenant_id: str, db: Session) -> str:
    """Decrypt data with enterprise-grade security."""
    return security_manager.decrypt_tenant_data(encrypted_package, tenant_id, db)

def create_jwt_token(payload: Dict[str, Any], tenant_id: str, db: Session) -> str:
    """Create secure JWT token."""
    return security_manager.create_secure_jwt(payload, tenant_id, db)

def verify_jwt_token(token: str, tenant_id: str, db: Session) -> Dict[str, Any]:
    """Verify secure JWT token."""
    return security_manager.verify_secure_jwt(token, tenant_id, db)

__all__ = [
    'EnterpriseSecurityManager',
    'TenantSecrets', 
    'security_manager',
    'encrypt_data',
    'decrypt_data',
    'create_jwt_token',
    'verify_jwt_token'
]