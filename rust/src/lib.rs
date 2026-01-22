use wasm_bindgen::prelude::*;

const CHARS: &[u8] = b" .-=:*@@";
const SCALE: f64 = 0.2;
const SPEED: f64 = 0.15;

#[wasm_bindgen]
pub fn get_ascii_grid(gradient_enabled: bool, x: usize, y: usize, time: f64) -> String {
    let mut out = String::with_capacity(y * (x + 1));
    let t = time * SPEED;

    for r in 0..y {
        for c in 0..x {
            let uv = [c as f64 / x as f64 * SCALE, r as f64 / x as f64 * SCALE];
            let mut val = pattern(uv, t);

            if gradient_enabled {
                val *= (1.0 - (c as f64 / x as f64)).clamp(0.0, 1.0);
            }

            let char_idx = (val * (CHARS.len() - 1) as f64).floor() as i32;
            let idx = char_idx.clamp(0, (CHARS.len() - 1) as i32) as usize;
            out.push(CHARS[idx] as char);
        }
        if r < y - 1 { out.push('\n'); }
    }
    out
}

fn rotate(p: [f64; 2], angle: f64) -> [f64; 2] {
    let (s, c) = angle.sin_cos();
    [c * p[0] - s * p[1], s * p[0] + c * p[1]]
}

fn noise(p: [f64; 2], time: f64) -> f64 {
    (p[0] * 10.0).sin() * (p[1] * (3.0 + (time / 11.0).sin())).sin() + 0.2
}

fn fbm(mut p: [f64; 2], time: f64) -> f64 {
    let mut f = 0.0;
    let mut amp = 0.5;
    for i in 0..3 {
        let modify = rotate(p, (time / 50.0) * (i * i) as f64);
        f += amp * noise(p, time);
        p = [modify[0] * 2.0, modify[1] * 2.0];
        amp /= 2.2;
    }
    f
}

fn pattern(p: [f64; 2], time: f64) -> f64 {
    let q = [
        fbm([p[0] + 1.0, p[1] + 1.0], time),
        fbm(rotate([p[0] + 1.0, p[1] + 1.0], 0.1 * time), time),
    ];
    let r = [
        fbm(rotate(q, 0.1), time),
        fbm(q, time),
    ];
    fbm([p[0] + r[0], p[1] + r[1]], time)
}