import { gameBoard, Phase, Marking, hasFriendlyPiece, hasEnemyPiece, type Piece } from './implementation-details.ts';
import { traceState } from './_trace-state';
import { validateSpot } from './validation';
import { markPinIfFound } from './pins';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

// Four deviations from the blog's pin-detection pseudocode below, all needed to make this
// function pull double duty (attack/check marking AND pin lookahead) without breaking either:
// 1. The pseudocode gates markValid on `firstHit == null` using firstHit's value *after* this
//    square may have just set it, which skips marking the square that becomes firstHit itself
//    (including a king reached with a clear line, silently breaking check detection). Snapshot
//    the value from before this square instead
// 2. The pseudocode's "existing code" continuation only passed through the opponent king. Pin
//    detection needs the ray to also continue silently past the first enemy piece, so it can
//    reach a second piece (possibly the king) behind it. Only a friendly piece stops the ray now
// 3. The pseudocode's `if (hasEnemyKing(pos)) foundKing = true` runs unconditionally near the
//    top, but this version had it after the "second enemy piece" return, so in a real pin (king
//    is the *second* piece hit) the function returned one line before ever noticing. Moved the
//    king check back above that return, matching the pseudocode's ordering
// 4. En Passant pseudo-pin (blog's "Edge cases" section): during the attack pass, a piece
//    marked En-Passantable is transparent to pin-tracing, but only if it's the very first thing
//    the ray has hit (firstHit is still null). It and whatever captures it could both vanish
//    from this line in a single en-passant move, so we look straight through it for the king.
//    If something else was already hit first, this piece is a normal blocker - en passant has
//    nothing to do with it, and treating it as transparent unconditionally (regardless of what
//    came before) would falsely "pin" pieces that have nothing to do with the en-passant pair
function traceSpots(move: Piece, direction: number[]) {
    if (!move.onBoard()) return;

    const passable = gameBoard.phase === Phase.ATTACK && traceState.firstHit == null
        && gameBoard.markings.get(move.row, move.column).has(Marking.EN_PASSANTABLE);
    if (passable) traceState.passedEnPassantable = true;

    if (hasFriendlyPiece(move) && gameBoard.phase !== Phase.ATTACK) return;

    // Third deviation: the king check has to run before the "second enemy piece" return below,
    // not after it. In a real pin the king IS the second piece hit (first piece = the pinned
    // piece), so checking isOpponentKing only after that return meant foundKing could only ever
    // become true when the king was the *first* piece hit, i.e. a direct check, never a pin
    let piece = gameBoard.getPiece(move);
    if (piece != null && piece.isOpponentKing(move)) traceState.foundKing = true;

    const enemy = !passable && hasEnemyPiece(move);
    if (enemy && traceState.firstHit != null) return;
    const alreadyHadHit = traceState.firstHit != null;
    if (enemy) traceState.firstHit = move;

    if (!alreadyHadHit) validateSpot(move);

    if (piece != null && !enemy && !passable) return;

    traceSpots(move.offset(direction[0], direction[1]), direction);

    // This will always run after the recursion has ended,
    // at all positions of the ray
    if (traceState.checkOrigin) gameBoard.markings.get(move.row, move.column).add(Marking.CHECK_LINE);
}

// traceSpots/markPinIfFound share state across recursive calls (see trace-state.ts) rather than
// passing it around, since the recursion needs to read decisions made earlier in the same ray
// after it unwinds. Reset before every ray a rook/bishop/queen casts
function resetTraceState() {
    traceState.checkOrigin = false;
    traceState.firstHit = null;
    traceState.foundKing = false;
    traceState.passedEnPassantable = false;
}

export function rookMoves(rook: Piece) {
    const rookDirections = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (let direction of rookDirections) {
        resetTraceState();
        traceSpots(rook.offset(direction[0], direction[1]), direction);
        markPinIfFound();
    }
}

export function bishopMoves(bishop: Piece) {
    const bishopDirections = [
        [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    for (let direction of bishopDirections) {
        resetTraceState();
        traceSpots(bishop.offset(direction[0], direction[1]), direction);
        markPinIfFound();
    }
}

export function queenMoves(queen: Piece) {
    const queenDirections = [
        [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (let direction of queenDirections) {
        resetTraceState();
        traceSpots(queen.offset(direction[0], direction[1]), direction);
        markPinIfFound();
    }
}
