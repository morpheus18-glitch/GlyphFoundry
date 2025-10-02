#!/bin/bash
# Rust Wasm Physics Engine Build Script

set -e

echo "🦀 Building Rust Wasm Physics Engine..."

# Build the Wasm module
cd "$(dirname "$0")"
cargo build --target wasm32-unknown-unknown --release

# Generate JavaScript bindings
echo "🔧 Generating JavaScript bindings..."
WASM_BINDGEN="/tmp/wasm-bindgen-0.2.104-x86_64-unknown-linux-musl/wasm-bindgen"

if [ ! -f "$WASM_BINDGEN" ]; then
    echo "📥 Downloading wasm-bindgen..."
    curl -L https://github.com/rustwasm/wasm-bindgen/releases/download/0.2.104/wasm-bindgen-0.2.104-x86_64-unknown-linux-musl.tar.gz -o /tmp/wasm-bindgen.tar.gz
    cd /tmp && tar -xzf wasm-bindgen.tar.gz
fi

# Create output directory
mkdir -p ../../frontend/src/wasm

# Generate bindings
$WASM_BINDGEN --target web --out-dir ../../frontend/src/wasm target/wasm32-unknown-unknown/release/glyph_physics.wasm

echo "✅ Wasm module built successfully!"
echo "📦 Output: frontend/src/wasm/"
ls -lh ../../frontend/src/wasm/
