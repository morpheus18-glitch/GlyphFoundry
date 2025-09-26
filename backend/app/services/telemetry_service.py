"""Telemetry aggregation helpers."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from prometheus_client import REGISTRY


class TelemetryService:
    """Provides snapshots of Prometheus metrics."""

    def capture_metrics(self) -> Dict[str, Any]:
        snapshot: Dict[str, Any] = {"generated_at": datetime.utcnow().isoformat()}
        metrics: Dict[str, Any] = {}
        for metric in REGISTRY.collect():
            samples = []
            for sample in metric.samples:
                samples.append({
                    "name": sample.name,
                    "labels": sample.labels,
                    "value": sample.value,
                    "timestamp": sample.timestamp,
                    "exemplar": sample.exemplar,
                })
            metrics[metric.name] = {
                "documentation": metric.documentation,
                "type": metric.type,
                "samples": samples,
            }
        snapshot["metrics"] = metrics
        return snapshot


telemetry_service = TelemetryService()


__all__ = ["telemetry_service", "TelemetryService"]
