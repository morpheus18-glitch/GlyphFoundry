"""Quantum backend orchestration primitives."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class QuantumBackend:
    name: str
    coherence_time_ms: float
    fidelity: float
    is_active: bool


class QuantumRegistry:
    """Tracks the status of simulated quantum backends."""

    def __init__(self) -> None:
        self._backends: Dict[str, QuantumBackend] = {}
        self._lock = asyncio.Lock()

    async def initialize_quantum_backends(self) -> None:
        async with self._lock:
            self._backends = {
                "simulated_qpu": QuantumBackend("simulated_qpu", coherence_time_ms=3.5, fidelity=0.97, is_active=True),
                "experimental_qpu": QuantumBackend("experimental_qpu", coherence_time_ms=1.2, fidelity=0.91, is_active=False),
            }

    async def preserve_quantum_states(self) -> None:
        async with self._lock:
            for backend in self._backends.values():
                backend.is_active = False

    async def list_backends(self) -> List[QuantumBackend]:
        async with self._lock:
            return list(self._backends.values())


quantum_registry = QuantumRegistry()


__all__ = ["quantum_registry", "QuantumRegistry", "QuantumBackend"]
