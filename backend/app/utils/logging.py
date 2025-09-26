"""Structured logging utilities."""
import logging
import sys
from typing import Optional


def setup_logging(level: str = "INFO", enable_quantum_tracing: bool = False) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
    if enable_quantum_tracing:
        logging.getLogger("quantum").setLevel(level)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name or "quantum")


__all__ = ["setup_logging", "get_logger"]
