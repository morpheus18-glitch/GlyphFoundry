/// Simple temporal anti-aliasing history blend. The current implementation
/// performs a straight lerp between the current and previous RGB buffers.
/// Motion vectors are accepted to keep the signature stable for future
/// reprojection improvements.
pub fn taa_reproject(
    curr: &[f32],
    prev: &[f32],
    motion: &[f32],
    w: usize,
    h: usize,
    blend: f32,
    out: &mut [f32],
) {
    let pixel_count = w
        .checked_mul(h)
        .expect("image dimensions overflow when computing pixel count");
    let expected_rgb_len = pixel_count
        .checked_mul(3)
        .expect("pixel count overflow when computing RGB buffer length");

    assert!(
        curr.len() == expected_rgb_len,
        "current buffer length {} does not match expected {}",
        curr.len(),
        expected_rgb_len
    );
    assert!(
        prev.len() == expected_rgb_len,
        "previous buffer length {} does not match expected {}",
        prev.len(),
        expected_rgb_len
    );
    assert!(
        out.len() == expected_rgb_len,
        "output buffer length {} does not match expected {}",
        out.len(),
        expected_rgb_len
    );

    if !motion.is_empty() {
        let expected_motion_len = pixel_count
            .checked_mul(2)
            .expect("pixel count overflow when computing motion buffer length");
        assert!(
            motion.len() == expected_motion_len,
            "motion buffer length {} does not match expected {}",
            motion.len(),
            expected_motion_len
        );
    }

    let blend = blend.clamp(0.0, 1.0);
    let inv_blend = 1.0 - blend;

    for idx in 0..pixel_count {
        let base = idx * 3;
        out[base] = curr[base] * inv_blend + prev[base] * blend;
        out[base + 1] = curr[base + 1] * inv_blend + prev[base + 1] * blend;
        out[base + 2] = curr[base + 2] * inv_blend + prev[base + 2] * blend;
    }
}
