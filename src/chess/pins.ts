import { gameBoard, Phase, Marking, Type, type Piece, type Position, getKing } from './implementation-details.ts';
import { traceState } from "./_trace-state";

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

// Check if we found a piece that is pinned, and mark it as actually pinned.
// The code that prevents this piece from then moving outside its path is in
// validateSpot(), under Validation
export function markPinIfFound() {
    const hit: Position | null = traceState.firstHit;
    if (gameBoard.phase !== Phase.ATTACK || !traceState.foundKing || hit == null) return;

    const hitPiece = gameBoard.getPiece(hit);
    if (hitPiece == null || hitPiece.type === Type.KING) return;

    gameBoard.markings.get(hit.row, hit.column).add(traceState.passedEnPassantable ? Marking.PSEUDO_PINNED : Marking.PINNED);
}

// Checks whether the piece position, move and king positions line up
// This is the only way a pinned piece can move
export function moveLinesUpWithKing(move: Piece) {
    const king = getKing(move.color);

    const toKingRow = king.row - move.pieceRow;
    const toKingColumn = king.column - move.pieceColumn;
    const toMoveRow = move.row - move.pieceRow;
    const toMoveColumn = move.column - move.pieceColumn;

    return toKingRow * toMoveColumn === toKingColumn * toMoveRow;
}