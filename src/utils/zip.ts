/**
 * Minimal client-side ZIP writer, "store" method only (no compression).
 *
 * Used to bundle a recorded frame sequence into a single downloadable file.
 * The PNG frames are already compressed, so re-deflating them would just burn
 * CPU for no size benefit. Avoids pulling in a zip dependency for what's a
 * couple hundred lines of well-specified binary format.
 *
 * Streaming on purpose: a halftone frame's dot pattern is high-frequency
 * noise that PNG barely compresses, so real recordings run several MB *per
 * frame*. Doing every frame's CRC32 in one uninterrupted pass at the end (as
 * an earlier version of this file did) blocks the main thread for as long as
 * the whole recording takes to checksum, with zero feedback, so it looks hung
 * even when it isn't. `addEntry` instead does one frame's CRC32 work right
 * when that frame is captured, inside a loop that already yields to the
 * browser periodically, so `finish()` at the end has nothing left to do but
 * concatenate already-built chunks. That's bounded by memory bandwidth, not CPU.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
    const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
    const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
    return { time, date: day };
}

export interface ZipWriter {
    /** Adds one file's worth of bytes. Does its CRC32 + header work immediately,
     *  call this right as each frame is produced rather than batching, so the
     *  cost is spread across the recording loop instead of dumped into finish(). */
    addEntry(name: string, data: Uint8Array): void;
    /** Assembles the central directory and returns the finished archive. Cheap,
     *  since every entry's checksum was already computed in addEntry. */
    finish(): Blob;
}

export function createZipWriter(): ZipWriter {
    const encoder = new TextEncoder();
    const { time: modTime, date: modDate } = dosDateTime(new Date());

    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;
    let count = 0;

    function addEntry(name: string, data: Uint8Array) {
        const nameBytes = encoder.encode(name);
        const crc = crc32(data);
        const size = data.length;

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0, true);
        lv.setUint16(8, 0, true); // store, no compression
        lv.setUint16(10, modTime, true);
        lv.setUint16(12, modDate, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);
        lv.setUint32(22, size, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        local.set(nameBytes, 30);

        localParts.push(local, data);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);  // version made by
        cv.setUint16(6, 20, true);  // version needed
        cv.setUint16(8, 0, true);
        cv.setUint16(10, 0, true); // store
        cv.setUint16(12, modTime, true);
        cv.setUint16(14, modDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0x81a40000, true); // unix perms 0644 in the high word
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centralParts.push(central);

        offset += local.length + data.length;
        count++;
    }

    function finish(): Blob {
        const centralOffset = offset;
        const centralSize = centralParts.reduce((s, p) => s + p.length, 0);

        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, count, true);
        ev.setUint16(10, count, true);
        ev.setUint32(12, centralSize, true);
        ev.setUint32(16, centralOffset, true);
        ev.setUint16(20, 0, true);

        return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
    }

    return { addEntry, finish };
}
