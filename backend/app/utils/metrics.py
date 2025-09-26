"""Prometheus metric definitions."""
from prometheus_client import Counter, Gauge, Histogram

request_duration_histogram = Histogram(
    "quantum_backend_request_duration_seconds",
    "HTTP request duration",
    labelnames=("method", "endpoint", "status_code", "quantum_enabled"),
)

request_count_counter = Counter(
    "quantum_backend_request_total",
    "Number of HTTP requests",
    labelnames=("method", "endpoint", "status_code"),
)

active_connections_gauge = Gauge(
    "quantum_backend_active_connections",
    "Number of active HTTP connections",
)


__all__ = [
    "request_duration_histogram",
    "request_count_counter",
    "active_connections_gauge",
]
