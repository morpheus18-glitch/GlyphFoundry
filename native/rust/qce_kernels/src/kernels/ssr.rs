/// Computes helper values for screen-space reflections.
pub fn ssr_step(hit_depth: f32, roughness: f32, step_count: u32) -> (f32, f32) {
    let edge_fade = (1.0 - hit_depth).clamp(0.0, 1.0).powf(2.0);
    let roughness = (1.0 - roughness).clamp(0.0, 1.0);
    let rough_boost = (step_count as f32 / 32.0).min(1.0) * roughness;
    (edge_fade, rough_boost)
}
