use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use qce_kernels::kernels::{coherence, ssr, taa};

fn pixel_count(w: usize, h: usize) -> PyResult<usize> {
    w.checked_mul(h)
        .ok_or_else(|| PyValueError::new_err("image dimensions overflow"))
}

#[pyfunction]
fn taa_reproject_py(
    curr: Vec<f32>,
    prev: Vec<f32>,
    motion: Vec<f32>,
    w: usize,
    h: usize,
    blend: f32,
) -> PyResult<Vec<f32>> {
    let pixels = pixel_count(w, h)?;
    let expected_rgb = pixels
        .checked_mul(3)
        .ok_or_else(|| PyValueError::new_err("pixel count overflow for RGB buffers"))?;

    if curr.len() != expected_rgb {
        return Err(PyValueError::new_err(format!(
            "expected current buffer length {}, got {}",
            expected_rgb,
            curr.len()
        )));
    }
    if prev.len() != expected_rgb {
        return Err(PyValueError::new_err(format!(
            "expected previous buffer length {}, got {}",
            expected_rgb,
            prev.len()
        )));
    }

    if !motion.is_empty() {
        let expected_motion = pixels
            .checked_mul(2)
            .ok_or_else(|| PyValueError::new_err("pixel count overflow for motion vectors"))?;
        if motion.len() != expected_motion {
            return Err(PyValueError::new_err(format!(
                "expected motion buffer length {} or 0, got {}",
                expected_motion,
                motion.len()
            )));
        }
    }

    let mut out = vec![0.0_f32; expected_rgb];
    taa::taa_reproject(&curr, &prev, &motion, w, h, blend, &mut out);
    Ok(out)
}

#[pyfunction]
fn ssr_step_py(hit_depth: f32, roughness: f32, step_count: u32) -> PyResult<(f32, f32)> {
    Ok(ssr::ssr_step(hit_depth, roughness, step_count))
}

#[pyfunction]
fn interference_py(u: f32, v: f32, t: f32) -> PyResult<f32> {
    Ok(coherence::interference_field(u, v, t))
}

#[pymodule]
fn qce_kernels_py(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(taa_reproject_py, m)?)?;
    m.add_function(wrap_pyfunction!(ssr_step_py, m)?)?;
    m.add_function(wrap_pyfunction!(interference_py, m)?)?;
    Ok(())
}
