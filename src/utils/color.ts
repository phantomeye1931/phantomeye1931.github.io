/**
 * Perceptual color math (OKLCH) for generating pixel-art style shade ramps:
 * hue-shifted shadows/highlights, chroma tapering near black/white, and
 * optional per-step hue jitter.
 */

import { mulberry32, xmur3 } from "./random";

export interface Rgb {
    r: number; // 0-1
    g: number; // 0-1
    b: number; // 0-1
}

export interface PaletteSwatch {
    step: number; // negative = shadow, 0 = base, positive = highlight
    hex: `#${string}`;
    l: number;
    c: number;
    h: number;
    hueJitter: number; // signed degrees of hue jitter applied to this swatch
}

export interface PaletteOptions {
    stepsUp?: number;         // lighter/highlight swatches to generate above the base
    stepsDown?: number;       // darker/shadow swatches to generate below the base
    lightnessDelta?: number;  // lightness change per step - the "distance" between adjacent colors

    hueShiftDeg?: number;     // max hue rotation applied at the outermost step on each side
    hueJitterDeg?: number;    // max random per-swatch hue deviation, at unchanged lightness
    hueJitterSeed?: number;   // rerolls the jitter pattern without changing hueJitterDeg

    chromaTaper?: number;     // how aggressively chroma falls off near black/white

    lightnessFloor?: number;
    lightnessCeil?: number;

    shadowHue?: number;       // hue shadows are rotated towards (blue/violet)
    highlightHue?: number;    // hue highlights are rotated towards (warm yellow)
}

// Shared defaults, also used by hueAtLightness so the chart matches generatePalette
export const DEFAULT_STEPS_UP = 2;
export const DEFAULT_STEPS_DOWN = 4;
export const DEFAULT_LIGHTNESS_DELTA = 0.1;
export const DEFAULT_HUE_SHIFT_DEG = 30;
export const DEFAULT_HUE_JITTER_DEG = 0;
export const DEFAULT_HUE_JITTER_SEED = 0;
export const DEFAULT_CHROMA_TAPER = 1.4;
export const DEFAULT_LIGHTNESS_FLOOR = 0.06;
export const DEFAULT_LIGHTNESS_CEIL = 0.96;
export const DEFAULT_SHADOW_HUE = 265;
export const DEFAULT_HIGHLIGHT_HUE = 55;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function hexToRgb(hex: string): Rgb {
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const num = parseInt(h, 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255,
    };
}

export function rgbToHex({ r, g, b }: Rgb): `#${string}` {
    const toByte = (v: number) => clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, "0");
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export interface Oklch {
    l: number; // 0-1
    c: number; // 0-~0.4
    h: number; // 0-360
}

// OKLCH, not HSV: HSV's "value" isn't perceptually uniform, so its hue slider
// can swing perceived brightness between hues at a fixed s/v
export function hexToOklch(hex: string): Oklch {
    const [l, c, h] = rgbToOklch(hexToRgb(hex));
    return { l, c, h };
}

// Gamut-mapped so an out-of-range L/C/H still yields a displayable color
export function oklchToHex({ l, c, h }: Oklch): `#${string}` {
    return rgbToHex(oklchToSrgbGamutMapped(l, c, h));
}

function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// sRGB (0-1) -> OKLab, via Björn Ottosson's matrices
function linearRgbToOklab({ r, g, b }: Rgb): [number, number, number] {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
}

// Inverse of linearRgbToOklab
function oklabToLinearRgb(L: number, a: number, b: number): Rgb {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    return {
        r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    };
}

export function normalizeHue(h: number): number {
    return ((h % 360) + 360) % 360;
}

// Shortest signed angular distance from `a` to `b`, in (-180, 180]
export function shortestHueDelta(a: number, b: number): number {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

export function rgbToOklch(rgb: Rgb): [number, number, number] {
    const linear: Rgb = {
        r: srgbToLinear(rgb.r),
        g: srgbToLinear(rgb.g),
        b: srgbToLinear(rgb.b),
    };
    const [L, oklabA, oklabB] = linearRgbToOklab(linear);
    const C = Math.sqrt(oklabA * oklabA + oklabB * oklabB);
    const H = normalizeHue((Math.atan2(oklabB, oklabA) * 180) / Math.PI);
    return [L, C, H];
}

function isInSrgbGamut({ r, g, b }: Rgb, eps = 1e-4): boolean {
    return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

function clampRgb({ r, g, b }: Rgb): Rgb {
    return { r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1) };
}

function oklchToRawSrgb(L: number, C: number, H: number): Rgb {
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    const linear = oklabToLinearRgb(L, a, b);
    return {
        r: linearToSrgb(linear.r),
        g: linearToSrgb(linear.g),
        b: linearToSrgb(linear.b),
    };
}

// Comfortably above sRGB's real peak chroma (~0.32) - a safe binary-search ceiling
const CHROMA_SEARCH_CEILING = 0.5;

/** Maximum OKLCH chroma at a given lightness/hue that still renders inside the sRGB gamut. */
export function maxInGamutChroma(L: number, H: number): number {
    L = clamp(L, 0, 1);
    if (isInSrgbGamut(oklchToRawSrgb(L, CHROMA_SEARCH_CEILING, H))) return CHROMA_SEARCH_CEILING;

    let lo = 0;
    let hi = CHROMA_SEARCH_CEILING;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (isInSrgbGamut(oklchToRawSrgb(L, mid, H))) lo = mid;
        else hi = mid;
    }
    return lo;
}

// OKLCH -> sRGB, no gamut search - only safe when C is already known to be in-gamut
export function oklchToSrgb(L: number, C: number, H: number): Rgb {
    return clampRgb(oklchToRawSrgb(clamp(L, 0, 1), Math.max(C, 0), H));
}

// OKLCH -> sRGB, clamping chroma down into gamut instead of clipping to a wrong hue
export function oklchToSrgbGamutMapped(L: number, C: number, H: number): Rgb {
    L = clamp(L, 0, 1);
    if (C <= 0) return clampRgb(oklchToRawSrgb(L, 0, H));

    const clampedC = Math.min(C, maxInGamutChroma(L, H));
    return clampRgb(oklchToRawSrgb(L, clampedC, H));
}

export interface HueRampOptions {
    hueShiftDeg?: number;
    shadowHue?: number;
    highlightHue?: number;
}

// t is -1..1: negative towards the shadow end, positive towards the highlight end
function hueAtStepFraction(h0: number, t: number, opts: Required<HueRampOptions>): number {
    if (t === 0) return h0;
    const targetHue = t > 0 ? opts.highlightHue : opts.shadowHue;
    const delta = shortestHueDelta(h0, targetHue);
    const rotate = Math.sign(delta) * Math.min(Math.abs(delta), opts.hueShiftDeg * Math.abs(t));
    return normalizeHue(h0 + rotate);
}

// Chroma-taper envelope at a lightness, relative to a ramp anchored at l0 (always 1 at l0 itself)
export function chromaTaperRatio(l: number, l0: number, chromaTaper: number): number {
    const shapeAt = (L: number) => Math.pow(Math.sin(Math.PI * clamp(L, 0.001, 0.999)), chromaTaper);
    const baseShape = shapeAt(l0) || 1e-6;
    return shapeAt(l) / baseShape;
}

// Hue at a given lightness for a ramp anchored at (l0, h0) - shared by generatePalette and the chart
export function hueAtLightness(
    l: number,
    l0: number,
    h0: number,
    lightnessFloor: number,
    lightnessCeil: number,
    opts: HueRampOptions = {},
): number {
    const { hueShiftDeg = DEFAULT_HUE_SHIFT_DEG, shadowHue = DEFAULT_SHADOW_HUE, highlightHue = DEFAULT_HIGHLIGHT_HUE } = opts;
    const halfRange = (lightnessCeil - lightnessFloor) / 2 || 1e-6;
    const t = clamp((l - l0) / halfRange, -1, 1);
    return hueAtStepFraction(h0, t, { hueShiftDeg, shadowHue, highlightHue });
}

// Generates a shade/tint ramp: perceptual lightness steps, chroma taper, hue shift
export function generatePalette(baseHex: string, options: PaletteOptions = {}): PaletteSwatch[] {
    const {
        stepsUp = DEFAULT_STEPS_UP,
        stepsDown = DEFAULT_STEPS_DOWN,
        lightnessDelta = DEFAULT_LIGHTNESS_DELTA,
        hueShiftDeg = DEFAULT_HUE_SHIFT_DEG,
        hueJitterDeg = DEFAULT_HUE_JITTER_DEG,
        hueJitterSeed = DEFAULT_HUE_JITTER_SEED,
        chromaTaper = DEFAULT_CHROMA_TAPER,
        lightnessFloor = DEFAULT_LIGHTNESS_FLOOR,
        lightnessCeil = DEFAULT_LIGHTNESS_CEIL,
        shadowHue = DEFAULT_SHADOW_HUE,
        highlightHue = DEFAULT_HIGHLIGHT_HUE,
    } = options;

    const [L0, C0, H0] = rgbToOklch(hexToRgb(baseHex));

    const swatches: PaletteSwatch[] = [];

    for (let i = -stepsDown; i <= stepsUp; i++) {
        if (i === 0) {
            swatches.push({ step: 0, hex: rgbToHex(hexToRgb(baseHex)), l: L0, c: C0, h: H0, hueJitter: 0 });
            continue;
        }

        // Clamped against the base's own lightness too, not just [floor, ceil]
        const L = clamp(L0 + i * lightnessDelta, Math.min(lightnessFloor, L0), Math.max(lightnessCeil, L0));
        let H = hueAtLightness(L, L0, H0, lightnessFloor, lightnessCeil, { hueShiftDeg, shadowHue, highlightHue });

        // Seeded by step index + hueJitterSeed (not Math.random), so palettes stay reproducible
        let hueJitter = 0;
        if (hueJitterDeg > 0) {
            const roll = mulberry32(xmur3(`${i}:${hueJitterSeed}`))();
            hueJitter = (roll * 2 - 1) * hueJitterDeg;
            H = normalizeHue(H + hueJitter);
        }

        // Clamped before converting, so the swatch's stored c always matches what's rendered
        const desiredC = Math.max(0, C0 * chromaTaperRatio(L, L0, chromaTaper));
        const C = Math.min(desiredC, maxInGamutChroma(L, H));

        const rgb = oklchToSrgb(L, C, H);
        swatches.push({ step: i, hex: rgbToHex(rgb), l: L, c: C, h: H, hueJitter });
    }

    return swatches;
}
