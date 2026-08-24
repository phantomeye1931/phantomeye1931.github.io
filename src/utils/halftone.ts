/**
 * The CMYK halftone effect's pure rendering engine, shared between the live
 * animated background (HalftoneBackground.astro) and the offline frame-by-frame
 * recorder (pages/cmyk-halftone.astro). Everything about *how big the canvas is
 * or when to draw a frame* stays with the caller. This module only knows how
 * to build a dot lattice for a given pixel size and paint it at a given time t.
 *
 * Channel colors and each channel's blob list are live-mutable on the returned
 * handle (see `channels` below). None of that requires rebuilding the dot
 * lattice, since the lattice only depends on FILL/lattice geometry, not on
 * how many blobs a channel has or what color it's painted with.
 *
 * Keeping this as the single source of truth means CONFIG tuning only ever
 * happens in one place, and the recorder is guaranteed to produce exactly what
 * the live background (or the tool's own live preview) would have shown.
 */

const CONFIG = {
    DOT_SPACING: 6.2,          // px between halftone grid points (dot pitch) — the grid itself never moves
    DOT_RADIUS_SCALE: 0.55,    // max dot radius, as a fraction of DOT_SPACING
    DOT_MIN_RADIUS: 0.35,      // px; smaller dots are skipped entirely
    DOT_ALPHA_SKIP: 0.02,      // density below this is treated as blank paper

    WARP_FREQ: 0.0016,         // domain-warp noise frequency (lower = broader flow)
    WARP_AMOUNT: 0.06,         // domain-warp amplitude, as a fraction of canvas span
    GRAIN_FREQ: 0.05,          // fine per-dot dither frequency
    GRAIN_AMOUNT: 0.08,        // fine per-dot dither strength
    SOFT_FREQ: 0.005,          // broad tonal-variation frequency
    SOFT_AMOUNT: 0.14,         // broad tonal-variation strength

    RIGHT_FADE_START: 0.46,    // fraction of width where the art starts fading out (keeps the name legible)
    RIGHT_FADE_END: 0.80,      // fraction of width where the art is fully faded

    BOTTOM_FADE_START: 0.40,   // fraction of height where a bottom-fade render starts dissolving
    BOTTOM_FADE_END: 0.88,     // fraction of height where a bottom-fade render is fully faded

    DRIFT_SPEED: 26,           // global multiplier on every blob's angular speed
    DRIFT_AMOUNT: 2,           // global multiplier on every blob's travel distance
};

// the live background's default redraw-rate cap. Exported so consumers that
// want to match the on-site motion pace (rather than pick their own) can reuse it
export const DEFAULT_DRIFT_FPS = 20;

// ---- EXPERIMENT: long-tail blob falloff ------------------------------------
// Adds a slow, faint secondary falloff on top of each blob's normal Gaussian
// core, so a few tiny dots keep going well past where the blob would normally
// cut off entirely, reaching toward the edges of the canvas instead of
// stopping a couple of radii out. The core itself (TAIL.amount is small) is
// barely touched, so this is meant to read as "the same blobs, with a longer
// fade" rather than a different shape.
//
// To fully revert: set TAIL.enabled to false. Nothing else in this file needs
// to change. fieldAt() falls straight back to the original pure-Gaussian
// behavior when it's off.
// NOTE on tuning: the field value computed here is NOT what decides whether a
// dot is actually visible. drawFrame() raises it to the channel's `gamma`
// and multiplies by `gain`, and the result has to clear DOT_MIN_RADIUS once
// scaled to a pixel radius. For the CMY channels (gamma ~0.9-0.95) that works
// out to an effective visibility floor around 0.09, not CONFIG.DOT_ALPHA_SKIP
// (0.02), so `amount` has to comfortably clear THAT floor out at `reach`
// radii, or the tail is invisible in practice despite being nonzero on paper.
const TAIL = {
    enabled: true,
    amount: 0.2,  // tail strength right at the blob center, before the (1 - core) falloff
    reach: 10,    // in blob radii: where the tail's own exponential decay drops it below the ~0.09 effective visibility floor (roughly 7-8 radii out, in practice)
};

// sane authored range for a blob's radius (as a fraction of min(W,H)). The
// hand-placed blobs below all fall inside this; exported so UI sliders and
// the "add blob" default stay consistent with what the effect actually expects
export const BLOB_RADIUS_RANGE = { min: 0.06, max: 0.55 };

function hash2(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const top = a + (b - a) * u, bot = c + (d - c) * u;
    return top + (bot - top) * v;
}
function fbm2(x: number, y: number, octaves: number) {
    let total = 0, amp = 0.5, freq = 1, sum = 0;
    for (let o = 0; o < octaves; o++) {
        total += amp * noise2(x * freq, y * freq);
        sum += amp;
        amp *= 0.5;
        freq *= 2.1;
    }
    return total / sum;
}
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a: number, b: number, x: number) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

export interface Blob { cx: number; cy: number; r: number; dx: number; dy: number; wx: number; wy: number; px: number; py: number; }
function blob(cx: number, cy: number, r: number, dx: number, dy: number, wx: number, wy: number, px: number, py: number): Blob {
    return { cx, cy, r, dx, dy, wx, wy, px, py };
}

// a fresh blob for the "add blob" UI action, randomized within the same
// authored ranges as the hand-placed blobs below, so it fits the same visual
// character rather than sticking out. Left-half-biased cx like the originals;
// callers on a FILL channel get the same X_SPREAD stretch applied at draw time.
export function randomBlob(): Blob {
    return blob(
        0.06 + Math.random() * 0.38,
        0.10 + Math.random() * 0.78,
        BLOB_RADIUS_RANGE.min + Math.random() * (BLOB_RADIUS_RANGE.max - BLOB_RADIUS_RANGE.min) * 0.6,
        0.040 + Math.random() * 0.022,
        0.040 + Math.random() * 0.022,
        0.022 + Math.random() * 0.022,
        0.022 + Math.random() * 0.022,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );
}

// Rewrites a blob's drift frequencies so its motion completes a whole number
// of cycles over exactly `durationSeconds`. sin(t*wx*DRIFT_SPEED+px) at
// t=durationSeconds lands back on sin(px), identical to t=0, on both value AND
// derivative (a pure sinusoid resampled one period later is indistinguishable
// from itself). Do this to every blob in a recording and the last rendered
// frame flows into the first with no visible seam. `k` is floored to 1 rather
// than 0 so a blob never just freezes for the whole clip.
export function loopSafeBlobs(blobs: Blob[], durationSeconds: number): Blob[] {
    const speed = CONFIG.DRIFT_SPEED;
    const twoPi = Math.PI * 2;
    function quantize(w: number): number {
        const omega = w * speed;
        const cycles = Math.max(1, Math.round((omega * durationSeconds) / twoPi));
        return (twoPi * cycles) / (speed * durationSeconds);
    }
    return blobs.map((b) => ({ ...b, wx: quantize(b.wx), wy: quantize(b.wy) }));
}

interface DefaultChannel { id: string; label: string; color: string; blobs: Blob[]; angle: number; ox: number; oy: number; gamma: number; gain: number; alpha: number; }

function defaultChannelDefs(): DefaultChannel[] {
    // three overlapping color fields (cyan / magenta / yellow) flowing diagonally
    // across the paper, plus a faint key plate that only grounds the deepest overlaps
    return [
        {
            id: 'cyan', label: 'Cyan', color: 'var(--col-cmyk-cyan)', angle: 15, ox: -1.3, oy: 0.6, gamma: 0.95, gain: 1.0, alpha: 0.82,
            blobs: [
                blob(0.10, 0.26, 0.30, 0.060, 0.048, 0.031, 0.024, 0.4, 2.1),
                blob(0.30, 0.12, 0.19, 0.044, 0.062, 0.045, 0.033, 1.7, 0.6),
                blob(0.04, 0.56, 0.23, 0.052, 0.040, 0.026, 0.041, 3.3, 4.4),
            ],
        },
        {
            id: 'magenta', label: 'Magenta', color: 'var(--col-cmyk-magenta)', angle: 75, ox: 1.1, oy: -0.9, gamma: 0.95, gain: 1.0, alpha: 0.82,
            blobs: [
                blob(0.25, 0.48, 0.28, 0.050, 0.054, 0.038, 0.028, 2.6, 1.1),
                blob(0.44, 0.66, 0.21, 0.058, 0.042, 0.024, 0.047, 0.9, 3.8),
                blob(0.10, 0.80, 0.20, 0.044, 0.060, 0.052, 0.030, 4.1, 2.4),
            ],
        },
        {
            id: 'yellow', label: 'Yellow', color: 'var(--col-cmyk-yellow)', angle: 0, ox: 0.3, oy: 1.4, gamma: 0.9, gain: 0.95, alpha: 0.78,
            blobs: [
                blob(0.19, 0.78, 0.32, 0.052, 0.046, 0.028, 0.036, 1.2, 4.9),
                blob(0.39, 0.38, 0.23, 0.048, 0.052, 0.041, 0.022, 3.7, 0.3),
                blob(0.49, 0.86, 0.17, 0.040, 0.050, 0.035, 0.049, 5.0, 1.8),
            ],
        },
        // the key plate only reads on light paper (multiply); on dark paper the canvas
        // switches to a 'screen' blend, under which this near-black plate is a no-op —
        // the bare dark substrate already reads as the shadow, exactly as on real dark stock
        {
            id: 'key', label: 'Key (black)', color: 'var(--col-text-1)', angle: 45, ox: 0, oy: 0, gamma: 2.1, gain: 0.55, alpha: 0.75,
            blobs: [
                blob(0.23, 0.50, 0.15, 0.032, 0.032, 0.020, 0.026, 0.7, 3.1),
            ],
        },
    ];
}

export interface Channel {
    id: string; label: string;
    color: string;               // css color / var(--...) reference used as the default
    colorOverride: string | null; // explicit color set via setChannelColor, takes priority over `color`
    resolved: string;             // the actual fill color drawFrame uses this frame
    blobs: Blob[];                // live and mutable, push/splice directly to add/remove blobs
    angle: number; ox: number; oy: number; gamma: number; gain: number; alpha: number;
    gx: number[]; gy: number[]; gwx: number[]; gwy: number[]; gsf: number[];
}

function makeChannels(): Channel[] {
    return defaultChannelDefs().map((d) => ({
        ...d, colorOverride: null, resolved: '',
        gx: [], gy: [], gwx: [], gwy: [], gsf: [],
    }));
}

export interface HalftoneOptions {
    // when true, skip the right-edge fade entirely and let the halftone cover
    // the full width — for pages with no right-aligned hero text to keep clear
    // of, rather than the hero's default fade-to-nothing look
    fill?: boolean;
    // full-width blob spread like `fill`, but fades out near the bottom instead of the right
    bottomFade?: boolean;
}

export interface HalftoneEffect {
    /** (Re)builds the dot lattice for a canvas of exactly `width`x`height` device pixels.
     *  `scale` only affects how CONFIG's CSS-px tunables (dot spacing, warp amount, etc.)
     *  convert into device pixels. Pass 1 to size dots in actual output pixels. */
    resize(width: number, height: number, scale?: number): void;
    /** Switches the right-edge fade on/off and rebuilds the lattice. Unlike `resize`,
     *  does not touch channel colors or blobs, so live edits survive the toggle. */
    setFill(fill: boolean): void;
    /** Switches the bottom-edge fade (mobile hero band render) on/off and rebuilds
     *  the lattice, same caveats as `setFill`. */
    setBottomFade(bottomFade: boolean): void;
    /** Re-reads the CMYK ink CSS custom properties off `document.documentElement` for
     *  every channel that doesn't have an explicit colorOverride. Call once up front,
     *  and again any time the [color-scheme] attribute changes. */
    resolveColors(): void;
    /** Sets (or, with `null`, clears) an explicit color for one channel, bypassing its
     *  CSS custom property. Takes effect immediately, no rebuild needed. */
    setChannelColor(id: string, color: string | null): void;
    /** Paints one frame at animation time `t` (seconds). `isDark` selects the ink
     *  blend mode (multiply on light paper, screen on dark paper). */
    drawFrame(t: number, isDark: boolean): void;
    /** Live per-channel state (id/label/color/blobs). Mutate `blobs` (push/splice)
     *  or call setChannelColor to edit; read `resolved` for the current paint color. */
    channels: Channel[];
}

export function createHalftoneEffect(canvas: HTMLCanvasElement, options: HalftoneOptions = {}): HalftoneEffect {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');

    let FILL = options.fill ?? false;
    let BOTTOM_FADE = options.bottomFade ?? false;
    function fullWidthMode() { return FILL || BOTTOM_FADE; }
    const channels = makeChannels();

    let W = 0, H = 0, scale = 1;

    // low-frequency domain warp so blob edges flow rather than sitting as perfect circles.
    // purely a function of position (no time term) — it's baked into the static grid below.
    function warp(x: number, y: number) {
        const f = CONFIG.WARP_FREQ;
        const wx = fbm2(x * f + 12, y * f + 12, 3) - 0.5;
        const wy = fbm2(x * f + 77, y * f + 77, 3) - 0.5;
        const amp = W * CONFIG.WARP_AMOUNT;
        return { x: x + wx * amp, y: y + wy * amp };
    }

    // per-point factor that never changes frame to frame (grain/tone/edge fade)
    function staticFactorAt(x: number, y: number) {
        const grain = (1 - CONFIG.GRAIN_AMOUNT) + CONFIG.GRAIN_AMOUNT * noise2(x * CONFIG.GRAIN_FREQ, y * CONFIG.GRAIN_FREQ);
        const soft = (1 - CONFIG.SOFT_AMOUNT) + CONFIG.SOFT_AMOUNT * fbm2(x * CONFIG.SOFT_FREQ, y * CONFIG.SOFT_FREQ, 3);
        const rightFade = fullWidthMode() ? 1 : 1 - smoothstep(W * CONFIG.RIGHT_FADE_START, W * CONFIG.RIGHT_FADE_END, x);
        const bottomFade = BOTTOM_FADE ? 1 - smoothstep(H * CONFIG.BOTTOM_FADE_START, H * CONFIG.BOTTOM_FADE_END, y) : 1;
        return grain * soft * rightFade * bottomFade;
    }

    function resolveOne(ch: Channel) {
        if (ch.colorOverride) { ch.resolved = ch.colorOverride; return; }
        const varName = ch.color.match(/var\((--[\w-]+)\)/)?.[1];
        const style = getComputedStyle(document.documentElement);
        ch.resolved = (varName ? style.getPropertyValue(varName).trim() : '') || ch.color;
    }

    function resolveColors() {
        channels.forEach(resolveOne);
    }

    function setChannelColor(id: string, color: string | null) {
        const ch = channels.find((c) => c.id === id);
        if (!ch) return;
        ch.colorOverride = color;
        resolveOne(ch);
    }

    // caches, per channel, every dot's fixed (x,y) grid position plus its
    // warped sample point and static factor — the lattice itself never moves,
    // only the blob field sampled at those fixed points changes over time
    function buildGrids() {
        if (W <= 0 || H <= 0) return;

        const diag = Math.sqrt(W * W + H * H);
        const sp = CONFIG.DOT_SPACING * scale;
        // the lattice only bothers generating points up to ~90% of the
        // width, since the hero's fade zeroes out anything past 80%
        // anyway — but in FILL/BOTTOM_FADE modes there's no *right-edge*
        // fade, so the sweep has to cover the full canvas or the right
        // side is just never painted
        const rxLimit = (fullWidthMode() ? W : W * 0.9) + diag * 0.15;

        channels.forEach(ch => {
            const rad = ch.angle * Math.PI / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const gx: number[] = [], gy: number[] = [], gwx: number[] = [], gwy: number[] = [], gsf: number[] = [];

            for (let ry = -diag; ry < diag; ry += sp) {
                for (let rx = -diag * 0.15; rx < rxLimit; rx += sp) {
                    const x = rx * cos - ry * sin;
                    const y = rx * sin + ry * cos;
                    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
                    const sx = x + ch.ox * scale, sy = y + ch.oy * scale;
                    const sf = staticFactorAt(sx, sy);
                    if (sf <= CONFIG.DOT_ALPHA_SKIP) continue;
                    const wp = warp(sx, sy);
                    gx.push(x); gy.push(y);
                    gwx.push(wp.x); gwy.push(wp.y);
                    gsf.push(sf);
                }
            }

            ch.gx = gx; ch.gy = gy; ch.gwx = gwx; ch.gwy = gwy; ch.gsf = gsf;
        });
    }

    // every blob's authored cx sits in [0.04, 0.49] — the left half —
    // since they were placed assuming the right-edge fade would hide
    // anything further out anyway. In FILL/BOTTOM_FADE modes there's no
    // such fade, so stretch blob centers horizontally to actually spread
    // ink across the full width instead of leaving the right side blank.
    function xSpread() { return fullWidthMode() ? 1.9 : 1; }

    // a blob's center only depends on t, never on the sample point — computed once
    // per channel per frame, outside the (much hotter) per-dot loop below
    function currentCenters(blobs: Blob[], t: number) {
        const span = Math.min(W, H);
        const spSpeed = CONFIG.DRIFT_SPEED, am = CONFIG.DRIFT_AMOUNT, spread = xSpread();
        return blobs.map(b => ({
            cx: (b.cx * spread + b.dx * am * Math.sin(t * b.wx * spSpeed + b.px)) * W,
            cy: (b.cy + b.dy * am * Math.sin(t * b.wy * spSpeed + b.py)) * H,
            r: b.r * span
        }));
    }

    // soft metaball union of a channel's (already time-evaluated) blob centers,
    // sampled at a cached warped point
    function fieldAt(wx: number, wy: number, centers: { cx: number, cy: number, r: number }[]) {
        let total = 0;
        for (let i = 0; i < centers.length; i++) {
            const c = centers[i];
            const dx = wx - c.cx, dy = wy - c.cy;
            const dSq = dx * dx + dy * dy;
            let g = Math.exp(-dSq / (2 * c.r * c.r));
            if (TAIL.enabled) {
                // exponential decay too, but with a much longer time-constant than
                // the core's. Additive via (1 - g) so it never pushes the core
                // above 1 and fades to ~0 wherever the core is already saturated
                const tail = TAIL.amount * Math.exp(-Math.sqrt(dSq) / (c.r * TAIL.reach));
                g = g + tail * (1 - g);
            }
            total = Math.max(total, g) + Math.min(total, g) * 0.35;
        }
        return clamp(total, 0, 1);
    }

    function resize(width: number, height: number, resizeScale = 1) {
        W = width; H = height; scale = resizeScale;
        canvas.width = width;
        canvas.height = height;
        buildGrids();
    }

    function setFill(fill: boolean) {
        FILL = fill;
        buildGrids();
    }

    function setBottomFade(bottomFade: boolean) {
        BOTTOM_FADE = bottomFade;
        buildGrids();
    }

    function drawFrame(t: number, isDark: boolean) {
        ctx!.clearRect(0, 0, W, H);
        ctx!.globalCompositeOperation = isDark ? 'screen' : 'multiply';

        const maxR = CONFIG.DOT_SPACING * scale * CONFIG.DOT_RADIUS_SCALE;
        const minR = CONFIG.DOT_MIN_RADIUS * scale;

        channels.forEach(ch => {
            if (ch.blobs.length === 0) return;
            const centers = currentCenters(ch.blobs, t);
            ctx!.fillStyle = ch.resolved;
            ctx!.globalAlpha = ch.alpha;
            const { gx, gy, gwx, gwy, gsf } = ch;
            for (let i = 0; i < gx.length; i++) {
                let d = fieldAt(gwx[i], gwy[i], centers) * gsf[i];
                if (d <= CONFIG.DOT_ALPHA_SKIP) continue;
                d = Math.pow(d, ch.gamma) * ch.gain;
                const r = d * maxR;
                if (r < minR) continue;
                // filled square rather than an arc: cheap enough to redraw every
                // frame, and square dots are a real halftone screen shape — at
                // high density they interlock into diamonds just like on press
                ctx!.fillRect(gx[i] - r, gy[i] - r, r * 2, r * 2);
            }
        });

        ctx!.globalAlpha = 1;
        ctx!.globalCompositeOperation = 'source-over';
    }

    return { resize, setFill, setBottomFade, resolveColors, setChannelColor, drawFrame, channels };
}
