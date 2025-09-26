//! Core rendering kernels shared between WASM and Python bindings.

pub mod kernels {
    pub mod coherence;
    pub mod ssr;
    pub mod taa;
}

pub mod utils;

pub use kernels::coherence::interference_field;
pub use kernels::ssr::ssr_step;
pub use kernels::taa::taa_reproject;
