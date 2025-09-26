/// Generates a stable interference field useful for procedural shading.
pub fn interference_field(u: f32, v: f32, t: f32) -> f32 {
    let w1 = ((u * 0.9 + v * 0.2) * core::f32::consts::TAU * 0.75 + t * 0.07).sin();
    let w2 = ((-u * 0.3 + v * 1.0) * core::f32::consts::TAU * 0.95 + t * 0.05 + 1.7).sin();
    let w3 = ((u * 0.2 - v * 1.0) * core::f32::consts::TAU * 0.60 + t * 0.09 + 3.4).sin();
    (w1 + w2 + w3) / 3.0
}
