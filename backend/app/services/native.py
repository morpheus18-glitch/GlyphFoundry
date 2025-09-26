from __future__ import annotations

from typing import Iterable, Sequence

try:
    from qce_kernels_py import taa_reproject_py as _taa_reproject
except ImportError as exc:  # pragma: no cover - informative failure during setup
    raise RuntimeError(
        'qce_kernels_py is not installed. Run `maturin develop --release` in '
        'native/rust/qce_kernels/bindings/python` to build the extension.'
    ) from exc


def _as_float_list(buffer: Sequence[float] | Iterable[float]) -> list[float]:
    if isinstance(buffer, list):
        return buffer
    return [float(value) for value in buffer]


def denoise_frame(
    curr: Sequence[float] | Iterable[float],
    prev: Sequence[float] | Iterable[float],
    motion: Sequence[float] | Iterable[float],
    width: int,
    height: int,
    blend: float = 0.9,
) -> list[float]:
    """Blend the current frame with history using the Rust TAA kernel."""
    curr_buf = _as_float_list(curr)
    prev_buf = _as_float_list(prev)
    motion_buf = _as_float_list(motion)
    return _taa_reproject(curr_buf, prev_buf, motion_buf, width, height, blend)
