import type { Position } from './implementation-details.ts';

// Shared mutable state for a single ray of the long-range tracer (long-range-tracing.ts): written
// to by mark-spot.ts when a ray reaches the opponent king (a check), and read back by the tracer
// once the recursion unwinds to paint the whole ray as a "line of check". Reset before every ray
export const traceState = {
    checkOrigin: false,
    firstHit: null as Position | null,
    foundKing: false,
    passedEnPassantable: false,
};

export function resetTraceState() {
    traceState.checkOrigin = false;
    traceState.firstHit = null;
    traceState.foundKing = false;
    traceState.passedEnPassantable = false;
}