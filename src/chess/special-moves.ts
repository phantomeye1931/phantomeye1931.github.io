import { gameBoard, Phase, Marking, Piece, Type } from './implementation-details.ts';
import { validateSpot } from './validation';
import { postMove } from './game-flow';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

// Locates the rook to castle with in the given column direction from the king: walks outward
// until the first piece and returns it only if it's a friendly, unmoved rook. Doing it this
// way also closes the blog's flagged "TODO: check if the rook is blocked" for free, since
// finding a rook here already proves nothing sits between the king and it. Also used by
// movePiece in game-flow.ts, to find the same rook again when actually executing the castle
export function findRookForCastle(king: Piece, direction: number): Piece | null {
    let scan = king.offset(0, direction);
    while (scan.onBoard()) {
        const found = gameBoard.getPiece(scan);
        if (found != null) return found.type === Type.ROOK && found.color === king.color && !found.hasMoved ? found : null;
        scan = scan.offset(0, direction);
    }
    return null;
}

// Check castling opportunities on both sides. Called directly from the King's movement function
export function attemptCastle(king: Piece, direction: number) {
    if (gameBoard.phase === Phase.ATTACK || king.hasMoved) return;
    if (gameBoard.checkCount > 0) return; // In check

    const rook = findRookForCastle(king, direction);
    if (rook == null) return;

    const first = king.offset(0, direction);
    const second = king.offset(0, direction * 2);

    if (gameBoard.markings.get(first.row, first.column).has(Marking.ATTACKED)) return;
    if (gameBoard.markings.get(second.row, second.column).has(Marking.ATTACKED)) return;

    validateSpot(second);
}

// Finishes a pending promotion: swaps the pawn for the chosen piece type, then resumes the
// normal post-move flow (attack/count-moves/turn switch) that movePiece (game-flow.ts) paused
// for it once it saw the pawn reach the back rank
export function promotePiece(type: Type) {
    const pawn = gameBoard.promotingPiece;
    if (pawn == null) return;

    const promoted = new Piece(type, pawn.color, pawn.row, pawn.column, pawn.row, pawn.column, true);
    gameBoard.pieces.set(promoted.row, promoted.column, promoted);
    gameBoard.promotingPiece = null;

    postMove(promoted);
}