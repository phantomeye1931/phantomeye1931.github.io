import {mulberry32, xmur3} from "./random.ts";

export function getItemStyle(seed: string) {
    const hash = xmur3(seed);
    const rand = mulberry32(hash);

    const tapeCount = 4;
    const pick = () => `url('/svg/tape/tape${Math.floor(rand() * tapeCount) + 1}.svg')`;

    return [
        `--tape-a: ${pick()}`,
        `--tape-b: ${pick()}`,
        `--rotation: ${(rand() * 3 - 1.5).toFixed(2)}deg`,
        `--tape-alignment: ${rand() < 0.5 ? "left bottom, right top" : "left top, right bottom"}`
    ].join("; ");
}

export function getPageStyle(seed: string) {
    const hash = xmur3(seed + "y");
    const rand = mulberry32(hash);

    const coffeeCount = 16;
    const images: string[] = [];
    const positions: string[] = [];

    let currentY = 300;
    const maxHeight = 20000;

    while (currentY < maxHeight) {
        const stainId = Math.floor(rand() * coffeeCount) + 1;

        const x = Math.floor(rand() * 1000 - 100);

        images.push(`url('/svg/coffee-stain/coffee-stain${stainId}.svg')`);
        positions.push(`${x}px ${currentY}px`);

        currentY += Math.floor(500 + rand() * 1000);
    }

    return [
        `--coffee-images: ${images.join(", ")}`,
        `--coffee-positions: ${positions.join(", ")};`
    ].join("; ");
}