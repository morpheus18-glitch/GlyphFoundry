# qce_kernels

Shared rendering kernels for GlyphFoundry. The crate is designed to be reused
from WebAssembly (frontend) and Python (backend workers) so the same
implementations power both code paths.

## Layout

```
native/
  rust/
    qce_kernels/
      Cargo.toml          # core kernels crate
      src/                # Rust implementations
      bindings/
        python/           # PyO3 shim (maturin)
        wasm/             # wasm-bindgen shim (wasm-pack)
```

## Building for Python

```
cd native/rust/qce_kernels/bindings/python
maturin develop --release
```

This command produces and installs the `qce_kernels_py` extension module into
the active Python environment. You can then import the kernels directly:

```
python -c "import qce_kernels_py; print(qce_kernels_py.ssr_step_py(0.3, 0.2, 24))"
```

## Building for WebAssembly

```
cargo install wasm-pack # if not installed yet
cd native/rust/qce_kernels/bindings/wasm
wasm-pack build --release --target web
```

The build outputs a `pkg/` directory with JavaScript and WebAssembly artifacts.
The frontend imports the module via the `@qce-wasm` alias configured in
`frontend/vite.config.ts`.
