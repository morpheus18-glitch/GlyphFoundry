from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class KafkaCfg(BaseModel):
    brokers: str = Field(default="gf_redpanda:9092")
    client_id: str = "gf_backend"
    ingest_topic: str = "nlp.ingest"
    candidates_topic: str = "nlp.candidates"
    curation_topic: str = "curation.out"
    glyph_topic: str = "glyphs.created"
    tag_proposals_topic: str = "tags.proposals"
    tag_decisions_topic: str = "tags.decisions"
    graph_events_topic: str = "graph.events"

class S3Cfg(BaseModel):
    endpoint: str = "http://minio:9000"
    region: str = "us-east-1"
    access_key: str = "admin"
    secret_key: str = "adminadmin"
    bucket_exports: str = "gf-exports"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", case_sensitive=False)

    app_env: str = "production"
    cors_allow_origins: str = "*"

    database_url: str = Field(default="postgresql+psycopg://gf_user:gf_pass@gf_postgres:5432/glyph_foundry", env="DATABASE_URL")
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800

    # gunicorn/uvicorn knobs (if used elsewhere)
    gunicorn_workers: int = 4
    gunicorn_threads: int = 2

    kafka: KafkaCfg = KafkaCfg()
    s3: S3Cfg = S3Cfg()

    emb_model: str = "text-embedding-3-large@3072"
    emb_dim: int = 384

settings = Settings()

# --- Tunables for graph3d ---
class Graph3dCfg(BaseModel):
    default_window: int = 60
    default_nodes: int = 300
    default_edges: int = 1500
    max_nodes: int = 5000
    max_edges: int = 5000
    fallback_windows: list[int] = [4320, 43200, 525600]  # 3d, 30d, 1y

    @classmethod
    def from_env(cls):
        import os
        vals = {}
        if "GRAPH3D_FALLBACK_WINDOWS" in os.environ:
            vals["fallback_windows"] = [int(x) for x in os.environ["GRAPH3D_FALLBACK_WINDOWS"].split(",")]
        return cls(**vals)

Settings.graph3d: Graph3dCfg = Graph3dCfg.from_env()
