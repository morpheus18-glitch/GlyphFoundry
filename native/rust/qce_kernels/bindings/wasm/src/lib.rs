use js_sys::Array;
use wasm_bindgen::prelude::*;

use qce_kernels::kernels::{coherence, ssr, taa};

#[wasm_bindgen]
pub fn taa_reproject_wasm(
    curr: &[f32],
    prev: &[f32],
    motion: &[f32],
    w: usize,
    h: usize,
    blend: f32,
) -> Vec<f32> {
    let pixels = w
        .checked_mul(h)
        .expect("image dimensions overflow when computing pixel count");
    let total = pixels
        .checked_mul(3)
        .expect("pixel count overflow when computing RGB buffer length");
    let mut out = vec![0.0_f32; total];
    taa::taa_reproject(curr, prev, motion, w, h, blend, &mut out);
    out
}

#[wasm_bindgen]
pub fn ssr_step_wasm(hit_depth: f32, roughness: f32, step_count: u32) -> Array {
    let (edge, boost) = ssr::ssr_step(hit_depth, roughness, step_count);
    let arr = Array::new();
    arr.push(&JsValue::from(edge));
    arr.push(&JsValue::from(boost));
    arr
}

#[wasm_bindgen]
pub fn interference_wasm(u: f32, v: f32, t: f32) -> f32 {
    coherence::interference_field(u, v, t)
}
