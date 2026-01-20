/**
 * Generates a seedable PRNG.
 * High-quality randomness for a small amount of code.
 */
export function mulberry32(a: number) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * Simple string hash to turn "my-image.jpg" into a number
 */
export function xmur3(str: string) {
    str = str ?? "";
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return h >>> 0;
}