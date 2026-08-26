import {
    gameBoard,
    Phase,
    Marking,
    hasFriendlyPiece,
    hasEnemyPiece,
    type Piece,
    getKing, otherColor
} from './implementation-details.ts';
import { resetTraceState, traceState } from './_trace-state';
import { validateSpot } from './validation';
import { markPinIfFound } from './pins';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

// Movement for the Rook
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

// Movement for the Bishop
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

// Movement for the Queen
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

// A recursive function used by all long-range pieces to validate a line of squares in sequence.
// It also partly handles marking pieces as pinned
function traceSpots(move: Piece, direction: number[]) {
    if (!move.onBoard()) return;

    // Remember whether we passed through an En Passantable piece for Pseudo-pin detection
    const enPassantable = gameBoard.phase === Phase.ATTACK && traceState.firstHit == null
            && gameBoard.markings.get(move.row, move.column).has(Marking.EN_PASSANTABLE);
    if (enPassantable) traceState.passedEnPassantable = true;

    // Can't do anything other than defend you
    if (hasFriendlyPiece(move) && gameBoard.phase !== Phase.ATTACK) return;

    let piece = gameBoard.getPiece(move);
    if (piece != null && piece.isOpponentKing(move)) traceState.foundKing = true;

    // If this is the second piece we hit, stop, unless it's En Passantable
    const enemy = !enPassantable && hasEnemyPiece(move);
    if (enemy && traceState.firstHit != null) return;

    const alreadyHadHit = traceState.firstHit != null;

    // If we hadn't hit anything before, we hit the current move now
    if (enemy) traceState.firstHit = move;

    // Validate up through the first hit as normal, but during Phase.ATTACK keep going past it if
    // that hit was the opponent king, so squares directly behind the king still get marked ATTACKED
    if (!alreadyHadHit || (traceState.foundKing && gameBoard.phase === Phase.ATTACK)) validateSpot(move);

    if (piece != null && !enemy && !enPassantable) return;

    // Recursive call, continue going in the same direction
    traceSpots(move.offset(direction[0], direction[1]), direction);

    // Only mark squares between this piece and the king, not behind it
    const king = getKing(otherColor(move.color));
    if (king.manhattanDist(move.pieceRow, move.pieceColumn) < move.manhattanDist(move.pieceRow, move.pieceColumn)) return;


    // This will always run after the recursion has ended, at all positions of the ray,
    // mark as line of check if we have been confirmed to be the origin of a check
    if (traceState.checkOrigin) gameBoard.markings.get(move.row, move.column).add(Marking.CHECK_LINE);
}
