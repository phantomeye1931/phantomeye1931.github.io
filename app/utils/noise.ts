const SCALE = 0.2; // UV scalar
const SPEED = 0.2; // Time scalar

// rotation matrix helper
export function rotate(p: [number, number], angle: number): [number, number] {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * p[0] - s * p[1], s * p[0] + c * p[1]];
}

// simple noise
export function noise(p: [number, number], time: number): number {
    return Math.sin(p[0] * 10) * Math.sin(p[1] * (3 + Math.sin(time / 11))) + 0.2;
}

// fractional Brownian motion
export function fbm(p: [number, number], time: number): number {
    let f = 0;
    let amp = 0.5;
    for (let i = 0; i < 3; i++) {
        const modify = rotate(p, (time / 50) * i * i);
        f += amp * noise(p, time);
        p = [modify[0] * 2, modify[1] * 2];
        amp /= 2.2;
    }
    return f;
}

// pattern function
export function pattern(p: [number, number], time: number): number {
    const q: [number, number] = [
        fbm([p[0] + 1, p[1] + 1], time),
        fbm(rotate(p, 0.1 * time).map(v => v + 1) as [number, number], time),
    ];
    const r: [number, number] = [
        fbm(rotate(q, 0.1), time),
        fbm(q, time),
    ];
    return fbm([p[0] + r[0], p[1] + r[1]], time);
}

function gradient(a: number) {
    const out = 1 - a;
    return Math.min(Math.max(0, out), 1); // Clamp between 0 and 1
}

// generate a 2D noise grid
export function genNoiseGrid(rows: number, cols: number, time: number): number[][] {
    return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
            const uv: [number, number] = [c / cols * SCALE, r / cols * SCALE]; // Both divided by cols to keep an 1:1 aspect ratio
            return pattern(uv, time * SPEED) * gradient(c / cols);
        })
    );
}
