"""Application configuration management for Quantum Nexus backend."""
from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class KafkaSettings(BaseModel):
    brokers: List[str] = Field(default_factory=lambda: ["gf_redpanda:9092"])
    client_id: str = "quantum-backend"
    ingest_topic: str = "quantum.ingest"
    telemetry_topic: str = "quantum.telemetry"
    state_topic: str = "quantum.state"
    enable_idempotence: bool = True


class RedisSettings(BaseModel):
    url: str = "redis://gf_redis:6379/0"
    health_check_interval: int = 30


class SecuritySettings(BaseModel):
    api_keys: List[str] = Field(default_factory=list)
    cors_allow_origins: List[AnyHttpUrl] = Field(default_factory=list)


class DatabaseSettings(BaseModel):
    url: str = "postgresql+psycopg://gf_user:gf_pass@gf_postgres:5432/glyph_foundry"
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 1800


class FeatureFlags(BaseModel):
    enable_docs: bool = True
    enable_quantum_features: bool = False
    enable_quantum_messaging: bool = False


class TelemetrySettings(BaseModel):
    prometheus_port: int = 9102


class Settings(BaseSettings):
    """Runtime settings for the backend service."""

    model_config = SettingsConfigDict(env_prefix="", env_file=".env", case_sensitive=False)

    environment: str = Field(default="production", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    database: DatabaseSettings = DatabaseSettings()
    kafka: KafkaSettings = KafkaSettings()
    redis: RedisSettings = RedisSettings()
    security: SecuritySettings = SecuritySettings()
    telemetry: TelemetrySettings = TelemetrySettings()
    features: FeatureFlags = FeatureFlags()

    service_name: str = "Quantum Nexus Backend Service"
    service_version: str = "1.0.0-alpha"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance to avoid repeated environment reads."""
    return Settings()


__all__ = ["Settings", "get_settings"]
