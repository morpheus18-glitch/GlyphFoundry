#[inline]
pub fn clamp01(x: f32) -> f32 {
    x.max(0.0).min(1.0)
}
