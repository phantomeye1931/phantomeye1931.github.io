import { gameBoard, Phase, Marking, Type, type Piece, type Position, getKing } from './implementation-details.ts';
import { traceState } from "./_trace-state";

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

// Part of the long-range tracing logic. We check if the first piece we hit is actually pinned on a king
export function markPinIfFound() {
    const hit: Position | null = traceState.firstHit;

    // If we're not looking for pins right now, never found a King or never hit any piece at all, do nothing
    if (gameBoard.phase !== Phase.ATTACK || !traceState.foundKing || hit == null) return;

    const hitPiece = gameBoard.getPiece(hit);
    if (hitPiece == null || hitPiece.type === Type.KING) return; // Make sure a King can't be pinned on itself

    gameBoard.markings.get(hit.row, hit.column).add(traceState.passedEnPassantable ? Marking.PSEUDO_PINNED : Marking.PINNED);
}

// Checks whether the piece position, move and king positions line up. If not, the pinned
// piece will not be allowed to move to this square.
export function moveLinesUpWithKing(move: Piece) {
    const king = getKing(move.color);

    const toKingRow = king.row - move.pieceRow;
    const toKingColumn = king.column - move.pieceColumn;
    const toMoveRow = move.row - move.pieceRow;
    const toMoveColumn = move.column - move.pieceColumn;

    return toKingRow * toMoveColumn === toKingColumn * toMoveRow;
}