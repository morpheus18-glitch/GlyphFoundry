"""User Settings and Profile API"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import json

from ..db import get_db

router = APIRouter(prefix="/api/v1/user", tags=["user-settings"])

class UserSettingsUpdate(BaseModel):
    preferences: Optional[Dict[str, Any]] = None
    theme: Optional[str] = None
    ai_instructions: Optional[str] = None
    visualization_settings: Optional[Dict[str, Any]] = None

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None

def get_current_tenant_id(request: Request) -> str:
    return request.headers.get("X-Tenant-ID", "00000000-0000-0000-0000-000000000000")

def get_current_user_id(request: Request) -> str:
    return request.headers.get("X-User-ID", "demo-user")

@router.get("/settings")
async def get_user_settings(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get user settings"""
    tenant_id = get_current_tenant_id(request)
    user_id = get_current_user_id(request)
    
    query = text("""
        SELECT preferences, theme, ai_instructions, visualization_settings
        FROM user_settings
        WHERE tenant_id = :tenant_id AND user_id = :user_id
    """)
    
    result = db.execute(query, {"tenant_id": tenant_id, "user_id": user_id})
    settings = result.fetchone()
    
    if not settings:
        # Create default settings
        insert_query = text("""
            INSERT INTO user_settings (tenant_id, user_id, preferences, theme, visualization_settings)
            VALUES (:tenant_id, :user_id, :preferences, :theme, :viz_settings)
            RETURNING preferences, theme, ai_instructions, visualization_settings
        """)
        
        result = db.execute(insert_query, {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "preferences": json.dumps({}),
            "theme": "dark",
            "viz_settings": json.dumps({"force_strength": 0.5, "show_labels": True})
        })
        settings = result.fetchone()
        db.commit()
    
    # PostgreSQL JSONB fields are already deserialized by SQLAlchemy
    preferences = settings[0] if settings[0] else {}
    if isinstance(preferences, str):
        preferences = json.loads(preferences)
    
    viz_settings = settings[3] if settings[3] else {}
    if isinstance(viz_settings, str):
        viz_settings = json.loads(viz_settings)
    
    return {
        "preferences": preferences,
        "theme": settings[1],
        "ai_instructions": settings[2],
        "visualization_settings": viz_settings
    }

@router.put("/settings")
async def update_user_settings(
    request: Request,
    settings: UserSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Update user settings"""
    tenant_id = get_current_tenant_id(request)
    user_id = get_current_user_id(request)
    
    # Build update query dynamically
    updates = []
    params = {"tenant_id": tenant_id, "user_id": user_id}
    
    if settings.preferences is not None:
        updates.append("preferences = :preferences")
        params["preferences"] = json.dumps(settings.preferences)
    
    if settings.theme is not None:
        updates.append("theme = :theme")
        params["theme"] = settings.theme
    
    if settings.ai_instructions is not None:
        updates.append("ai_instructions = :ai_instructions")
        params["ai_instructions"] = settings.ai_instructions
    
    if settings.visualization_settings is not None:
        updates.append("visualization_settings = :viz_settings")
        params["viz_settings"] = json.dumps(settings.visualization_settings)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No settings to update")
    
    updates.append("updated_at = now()")
    
    query = text(f"""
        UPDATE user_settings
        SET {', '.join(updates)}
        WHERE tenant_id = :tenant_id AND user_id = :user_id
        RETURNING *
    """)
    
    result = db.execute(query, params)
    updated = result.fetchone()
    
    if not updated:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    db.commit()
    
    return {"success": True, "message": "Settings updated"}

@router.get("/profile")
async def get_user_profile(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get user profile"""
    tenant_id = get_current_tenant_id(request)
    user_id = get_current_user_id(request)
    
    query = text("""
        SELECT id, email, first_name, last_name, profile_image_url, created_at
        FROM users
        WHERE id = :user_id AND tenant_id = :tenant_id
    """)
    
    result = db.execute(query, {"user_id": user_id, "tenant_id": tenant_id})
    user = result.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user[0],
        "email": user[1],
        "first_name": user[2],
        "last_name": user[3],
        "profile_image_url": user[4],
        "created_at": user[5].isoformat()
    }

@router.put("/profile")
async def update_user_profile(
    request: Request,
    profile: UserProfileUpdate,
    db: Session = Depends(get_db)
):
    """Update user profile"""
    tenant_id = get_current_tenant_id(request)
    user_id = get_current_user_id(request)
    
    updates = []
    params = {"user_id": user_id, "tenant_id": tenant_id}
    
    if profile.first_name is not None:
        updates.append("first_name = :first_name")
        params["first_name"] = profile.first_name
    
    if profile.last_name is not None:
        updates.append("last_name = :last_name")
        params["last_name"] = profile.last_name
    
    if profile.profile_image_url is not None:
        updates.append("profile_image_url = :profile_image_url")
        params["profile_image_url"] = profile.profile_image_url
    
    if not updates:
        raise HTTPException(status_code=400, detail="No profile fields to update")
    
    updates.append("updated_at = now()")
    
    query = text(f"""
        UPDATE users
        SET {', '.join(updates)}
        WHERE id = :user_id AND tenant_id = :tenant_id
        RETURNING *
    """)
    
    result = db.execute(query, params)
    updated = result.fetchone()
    
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.commit()
    
    return {"success": True, "message": "Profile updated"}
