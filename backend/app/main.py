import importlib
import logging
from fastapi import FastAPI, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session

# Logging config (fallback to basic if module missing)
try:
    from logging_config import configure_logging
except Exception:
    def configure_logging(*_a, **_k):
        logging.basicConfig(level=logging.INFO)

from settings import settings
from db import get_db
from exports import export_graph_json, export_tags_json
# optional: create minimal schema if migrations/init haven’t run
try:
    from ensure_schema import ensure_min_schema  # only if you created it
except Exception:
    ensure_min_schema = None  # harmless if absent

# ---------------- App & middleware ----------------
configure_logging("INFO")
app = FastAPI(title="Glyph Foundry API", version="1.0.0")
from routes import router as api_router
app.include_router(api_router)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Optional: auto-include routers ----------------
def _try_include_routers():
    candidates = [
        ("routes", ["router", "api", "app_router"]),
        ("api", ["router", "api", "app_router"]),
        ("endpoints", ["router", "api", "app_router"]),
    ]
    for mod_name, attrs in candidates:
        try:
            mod = importlib.import_module(mod_name)
        except Exception:
            continue
        for attr in attrs:
            r = getattr(mod, attr, None)
            if r is not None:
                try:
                    app.include_router(r)
                    logging.getLogger(__name__).info("Included router: %s.%s", mod_name, attr)
                except Exception as e:
                    logging.getLogger(__name__).warning("Failed to include %s.%s: %s", mod_name, attr, e)

_try_include_routers()

# ---------------- Lifecycle ----------------
@app.on_event("startup")
def _startup():
    # light, non-blocking boot tasks
    if ensure_min_schema is not None:
        try:
            db = next(get_db())
            ensure_min_schema(db)
        except Exception as e:
            logging.getLogger(__name__).warning("ensure_min_schema skipped: %s", e)

# ---------------- Health & error handler ----------------
@app.get("/healthz", response_class=PlainTextResponse)
def healthz():
    return "ok"

@app.exception_handler(Exception)
async def unhandled_exc(_: Request, exc: Exception):
    # keep responses JSON-ish even on unexpected errors
    return JSONResponse(status_code=500, content={"error": "internal", "detail": str(exc)})

# ---------------- Public endpoints ----------------
@app.get("/graph3d/data")
def graph3d_data(
    window_minutes: int = Query(60, alias="w", ge=1),
    limit_nodes: int = Query(300, alias="ln", ge=1),
    limit_edges: int = Query(1500, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    return export_graph_json(db, limit_nodes, limit_edges, window_minutes)

@app.get("/tags/data")
def tags_data(db: Session = Depends(get_db)):
    return export_tags_json(db)

# --- Override /graph3d/data with tunables + fallback ---
@app.get("/graph3d/data")
def graph3d_data(
    w: int = Query(settings.graph3d.default_window, alias="w", ge=1),
    ln: int = Query(settings.graph3d.default_nodes, alias="ln", ge=1),
    le: int = Query(settings.graph3d.default_edges, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    # clamp
    ln = min(ln, settings.graph3d.max_nodes)
    le = min(le, settings.graph3d.max_edges)

    payload = export_graph_json(db, ln, le, w)
    if payload["stats"]["edge_count"] == 0 and payload["stats"]["node_count"] == 0:
        for win in settings.graph3d.fallback_windows:
            payload = export_graph_json(db, ln, le, win)
            if payload["stats"]["edge_count"] > 0:
                payload["stats"]["fallback_used"] = win
                break
    return payload

@app.get("/graph3d/settings")
def graph3d_settings():
    """Return current tunable defaults and fallbacks for debugging/UI."""
    return {
        "default_window": settings.graph3d.default_window,
        "default_nodes": settings.graph3d.default_nodes,
        "default_edges": settings.graph3d.default_edges,
        "max_nodes": settings.graph3d.max_nodes,
        "max_edges": settings.graph3d.max_edges,
        "fallback_windows": settings.graph3d.fallback_windows,
    }

# ---------------- Jinja setup ----------------
from fastapi.templating import Jinja2Templates
import pathlib
templates = Jinja2Templates(directory=str(pathlib.Path(__file__).parent / "templates"))

@app.get("/graph3d/view")
def graph3d_view(
    request: Request,
    w: int = Query(settings.graph3d.default_window, alias="w", ge=1),
    ln: int = Query(settings.graph3d.default_nodes, alias="ln", ge=1),
    le: int = Query(settings.graph3d.default_edges, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    payload = export_graph_json(db, ln, le, w)
    return templates.TemplateResponse("graph3d.html", {"request": request, "data": payload})

@app.post("/pipeline/trigger/{worker_name}")
def trigger_worker(worker_name: str, db=Depends(get_db)):
    """Trigger a specific worker manually"""
    topic_map = {
        "nlp_extract": settings.kafka.ingest_topic,
        "linker_worker": settings.kafka.candidates_topic,
        "layout_worker": settings.kafka.graph_events_topic,
        "tag_suggester": settings.kafka.candidates_topic,
        "curation_worker": settings.kafka.curation_topic
    }
    
    if worker_name not in topic_map:
        raise HTTPException(400, f"Unknown worker: {worker_name}")
        
    # Trigger the worker by sending a test message
    produce(topic_map[worker_name], {"type": "manual_trigger", "timestamp": datetime.utcnow().isoformat()})
    return {"status": "triggered", "worker": worker_name}

@app.get("/graph/stats")
def get_graph_stats(db=Depends(get_db)):
    """Get detailed graph statistics"""
    stats = db.execute(text("""
        SELECT 
            (SELECT COUNT(*) FROM nodes WHERE kind='message') as message_count,
            (SELECT COUNT(*) FROM nodes WHERE kind='glyph') as glyph_count,
            (SELECT COUNT(*) FROM edges) as edge_count,
            (SELECT AVG(degree) FROM (
                SELECT COUNT(*) as degree FROM edges GROUP BY src_id
            ) t) as avg_degree
    """)).first()
    
    return {
        "message_count": stats[0] or 0,
        "glyph_count": stats[1] or 0,
        "edge_count": stats[2] or 0,
        "avg_degree": float(stats[3] or 0)
    }
