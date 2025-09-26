from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from db import get_db
from models import Glyph, Edge

router = APIRouter()

@router.get("/busz")
def bus_status():
    return {"enabled": True, "producer_ok": True}

@router.post("/produce/message")
def produce_message(payload: dict, db: Session = Depends(get_db)):
    text = (payload or {}).get("text", "").strip()
    g1 = Glyph(kind="glyph", title="Ada", body=text or "pioneer", created_at=datetime.utcnow())
    g2 = Glyph(kind="glyph", title="Graph", body="data structure", created_at=datetime.utcnow())
    db.add_all([g1, g2]); db.flush()
    e = Edge(src_id=g1.id, dst_id=g2.id, kind="studies", weight=0.9, created_at=datetime.utcnow())
    db.add(e); db.commit()
    return {"status": "ok"}
