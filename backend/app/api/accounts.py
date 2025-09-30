"""
User Account Management and Personalization API
Handles user profiles, settings, custom instructions, and learned profiles
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Dict, Any
import uuid
import json
from datetime import datetime
import hashlib

from ..db import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])

def set_user_context(db: Session, tenant_id: str, user_id: str, user_role: str = "user"):
    """Set RLS context for the current session"""
    db.execute(text("SELECT set_config('app.tenant_id', :tid, false)"), {"tid": tenant_id})
    db.execute(text("SELECT set_config('app.user_id', :uid, false)"), {"uid": user_id})
    db.execute(text("SELECT set_config('app.user_role', :role, false)"), {"role": user_role})


# =====================================================================
# USER ACCOUNT MANAGEMENT
# =====================================================================

@router.post("/register")
def register_user(
    email: str = Body(...),
    name: str = Body(None),
    password: str = Body(...),
    tenant_id: Optional[str] = Body(None),
    db: Session = Depends(get_db)
):
    """Register a new user account (public endpoint - no auth required)"""
    # Use provided tenant_id or create new tenant
    if not tenant_id:
        tenant_id = str(uuid.uuid4())
        # Create tenant
        tenant_query = text("""
            INSERT INTO tenants (id, slug, name, status)
            VALUES (:id, :slug, :name, 'active')
            ON CONFLICT (id) DO NOTHING
        """)
        db.execute(tenant_query, {
            "id": tenant_id,
            "slug": email.split('@')[0],
            "name": name or email
        })
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Check if user already exists
    check_query = text("SELECT id FROM users WHERE email = :email AND tenant_id = :tenant_id")
    existing = db.execute(check_query, {"email": email, "tenant_id": tenant_id}).fetchone()
    
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    user_id = str(uuid.uuid4())
    
    insert_query = text("""
        INSERT INTO users (id, tenant_id, email, name, role, metadata)
        VALUES (:id, :tenant_id, :email, :name, :role, :metadata::jsonb)
        RETURNING id, email, name, role, created_at
    """)
    
    result = db.execute(insert_query, {
        "id": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "name": name,
        "role": "user",
        "metadata": json.dumps({"password_hash": password_hash})
    })
    
    user = result.fetchone()
    db.commit()
    
    # Create default preferences
    set_user_context(db, tenant_id, user_id, "user")
    
    prefs_query = text("""
        INSERT INTO user_preferences (user_id, tenant_id)
        VALUES (:user_id, :tenant_id)
        ON CONFLICT (user_id, tenant_id) DO NOTHING
    """)
    
    db.execute(prefs_query, {"user_id": user_id, "tenant_id": tenant_id})
    
    # Create learned profile
    profile_query = text("""
        INSERT INTO learned_profiles (user_id, tenant_id)
        VALUES (:user_id, :tenant_id)
        ON CONFLICT (user_id, tenant_id) DO NOTHING
    """)
    
    db.execute(profile_query, {"user_id": user_id, "tenant_id": tenant_id})
    db.commit()
    
    return {
        "id": str(user[0]),
        "email": user[1],
        "name": user[2],
        "role": user[3],
        "tenant_id": tenant_id,
        "created_at": user[4].isoformat()
    }


@router.get("/profile")
def get_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    query = text("""
        SELECT u.id, u.email, u.name, u.role, u.created_at,
               up.theme, up.language, up.timezone, up.dashboard_layout,
               up.default_view, up.items_per_page, up.profile_visibility
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.id = :user_id AND u.tenant_id = :tenant_id
    """)
    
    result = db.execute(query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(result[0]),
        "email": result[1],
        "name": result[2],
        "role": result[3],
        "created_at": result[4].isoformat() if result[4] else None,
        "preferences": {
            "theme": result[5],
            "language": result[6],
            "timezone": result[7],
            "dashboard_layout": json.loads(result[8]) if result[8] else {},
            "default_view": result[9],
            "items_per_page": result[10],
            "profile_visibility": result[11]
        }
    }


# =====================================================================
# USER PREFERENCES & SETTINGS
# =====================================================================

@router.put("/preferences")
def update_preferences(
    current_user: Dict[str, Any] = Depends(get_current_user),
    theme: Optional[str] = Body(None),
    language: Optional[str] = Body(None),
    timezone: Optional[str] = Body(None),
    dashboard_layout: Optional[Dict] = Body(None),
    default_view: Optional[str] = Body(None),
    items_per_page: Optional[int] = Body(None),
    db: Session = Depends(get_db)
):
    """Update user preferences"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    updates = []
    params = {"user_id": str(current_user["id"]), "tenant_id": current_user["tenant_id"]}
    
    if theme is not None:
        updates.append("theme = :theme")
        params["theme"] = theme
    if language is not None:
        updates.append("language = :language")
        params["language"] = language
    if timezone is not None:
        updates.append("timezone = :timezone")
        params["timezone"] = timezone
    if dashboard_layout is not None:
        updates.append("dashboard_layout = :layout::jsonb")
        params["layout"] = json.dumps(dashboard_layout)
    if default_view is not None:
        updates.append("default_view = :view")
        params["view"] = default_view
    if items_per_page is not None:
        updates.append("items_per_page = :items")
        params["items"] = items_per_page
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    updates.append("updated_at = now()")
    
    query = text(f"""
        UPDATE user_preferences
        SET {', '.join(updates)}
        WHERE user_id = :user_id AND tenant_id = :tenant_id
        RETURNING id
    """)
    
    result = db.execute(query, params)
    db.commit()
    
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Preferences not found")
    
    return {"success": True, "message": "Preferences updated"}


# =====================================================================
# CUSTOM INSTRUCTIONS & TUNING
# =====================================================================

@router.post("/instructions")
def create_custom_instruction(
    current_user: Dict[str, Any] = Depends(get_current_user),
    name: str = Body(...),
    content: str = Body(...),
    description: Optional[str] = Body(None),
    instruction_type: str = Body("user"),
    temperature: float = Body(0.7),
    max_tokens: int = Body(2000),
    top_p: float = Body(0.9),
    db: Session = Depends(get_db)
):
    """Create custom instruction/prompt with tuning parameters"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    query = text("""
        INSERT INTO custom_instructions (
            user_id, tenant_id, name, description, instruction_type,
            content, temperature, max_tokens, top_p
        )
        VALUES (
            :user_id, :tenant_id, :name, :description, :type,
            :content, :temp, :tokens, :top_p
        )
        RETURNING id, name, instruction_type, created_at
    """)
    
    result = db.execute(query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"],
        "name": name,
        "description": description,
        "type": instruction_type,
        "content": content,
        "temp": temperature,
        "tokens": max_tokens,
        "top_p": top_p
    })
    
    instruction = result.fetchone()
    db.commit()
    
    return {
        "id": str(instruction[0]),
        "name": instruction[1],
        "instruction_type": instruction[2],
        "created_at": instruction[3].isoformat()
    }


@router.get("/instructions")
def list_custom_instructions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all custom instructions for the user"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    query = text("""
        SELECT id, name, description, instruction_type, content,
               temperature, max_tokens, top_p, is_active, usage_count, last_used_at
        FROM custom_instructions
        WHERE user_id = :user_id AND tenant_id = :tenant_id
        """ + (" AND is_active = true" if active_only else "") + """
        ORDER BY created_at DESC
    """)
    
    results = db.execute(query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchall()
    
    return {
        "instructions": [
            {
                "id": str(r[0]),
                "name": r[1],
                "description": r[2],
                "instruction_type": r[3],
                "content": r[4],
                "tuning": {
                    "temperature": r[5],
                    "max_tokens": r[6],
                    "top_p": r[7]
                },
                "is_active": r[8],
                "usage_count": r[9],
                "last_used_at": r[10].isoformat() if r[10] else None
            }
            for r in results
        ]
    }


# =====================================================================
# SEMANTIC KNOWLEDGE FOUNDRY (Learned Profiles)
# =====================================================================

@router.get("/learned-profile")
def get_learned_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's learned profile and behavioral patterns"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    query = text("""
        SELECT interests, expertise_areas, communication_style, preferred_topics,
               activity_patterns, interaction_frequency, common_queries,
               confidence_score, total_interactions, last_interaction_at
        FROM learned_profiles
        WHERE user_id = :user_id AND tenant_id = :tenant_id
    """)
    
    result = db.execute(query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchone()
    
    if not result:
        return {
            "interests": [],
            "expertise_areas": [],
            "communication_style": None,
            "preferred_topics": [],
            "activity_patterns": {},
            "interaction_frequency": {},
            "common_queries": [],
            "confidence_score": 0.0,
            "total_interactions": 0
        }
    
    return {
        "interests": result[0] or [],
        "expertise_areas": result[1] or [],
        "communication_style": result[2],
        "preferred_topics": result[3] or [],
        "activity_patterns": json.loads(result[4]) if result[4] else {},
        "interaction_frequency": json.loads(result[5]) if result[5] else {},
        "common_queries": result[6] or [],
        "confidence_score": result[7],
        "total_interactions": result[8],
        "last_interaction_at": result[9].isoformat() if result[9] else None
    }


@router.post("/interactions")
def log_interaction(
    current_user: Dict[str, Any] = Depends(get_current_user),
    interaction_type: str = Body(...),
    content: Optional[str] = Body(None),
    context_data: Optional[Dict] = Body(None),
    sentiment: Optional[str] = Body(None),
    feedback_score: Optional[int] = Body(None),
    node_id: Optional[str] = Body(None),
    db: Session = Depends(get_db)
):
    """Log user interaction for learning"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    query = text("""
        INSERT INTO user_interactions (
            user_id, tenant_id, interaction_type, content, context,
            sentiment, feedback_score, node_id
        )
        VALUES (
            :user_id, :tenant_id, :type, :content, :context::jsonb,
            :sentiment, :score, :node_id
        )
        RETURNING id, created_at
    """)
    
    result = db.execute(query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"],
        "type": interaction_type,
        "content": content,
        "context": json.dumps(context_data or {}),
        "sentiment": sentiment,
        "score": feedback_score,
        "node_id": node_id
    })
    
    interaction = result.fetchone()
    
    # Update learned profile
    update_query = text("""
        UPDATE learned_profiles
        SET total_interactions = total_interactions + 1,
            last_interaction_at = now()
        WHERE user_id = :user_id AND tenant_id = :tenant_id
    """)
    
    db.execute(update_query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    })
    
    db.commit()
    
    return {
        "id": str(interaction[0]),
        "created_at": interaction[1].isoformat()
    }


# =====================================================================
# USER DASHBOARD
# =====================================================================

@router.get("/dashboard")
def get_user_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized user dashboard with stats and insights"""
    set_user_context(db, current_user["tenant_id"], str(current_user["id"]), current_user.get("role", "user"))
    
    # User stats
    stats_query = text("""
        SELECT
            (SELECT COUNT(*) FROM files WHERE tenant_id = :tenant_id) as total_files,
            (SELECT COUNT(*) FROM nodes_v2 WHERE tenant_id = :tenant_id) as total_nodes,
            (SELECT COUNT(*) FROM user_interactions WHERE user_id = :user_id) as total_interactions,
            (SELECT COUNT(*) FROM custom_instructions WHERE user_id = :user_id AND is_active = true) as active_instructions,
            (SELECT COUNT(*) FROM search_history WHERE user_id = :user_id) as total_searches
    """)
    
    stats = db.execute(stats_query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchone()
    
    # Recent activity
    activity_query = text("""
        SELECT interaction_type, content, created_at
        FROM user_interactions
        WHERE user_id = :user_id AND tenant_id = :tenant_id
        ORDER BY created_at DESC
        LIMIT 10
    """)
    
    activity = db.execute(activity_query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchall()
    
    # Popular searches
    search_query = text("""
        SELECT query, COUNT(*) as count
        FROM search_history
        WHERE user_id = :user_id AND tenant_id = :tenant_id
        GROUP BY query
        ORDER BY count DESC
        LIMIT 5
    """)
    
    searches = db.execute(search_query, {
        "user_id": str(current_user["id"]),
        "tenant_id": current_user["tenant_id"]
    }).fetchall()
    
    return {
        "stats": {
            "total_files": stats[0],
            "total_nodes": stats[1],
            "total_interactions": stats[2],
            "active_instructions": stats[3],
            "total_searches": stats[4]
        },
        "recent_activity": [
            {
                "type": a[0],
                "content": a[1],
                "timestamp": a[2].isoformat()
            }
            for a in activity
        ],
        "popular_searches": [
            {"query": s[0], "count": s[1]}
            for s in searches
        ]
    }
