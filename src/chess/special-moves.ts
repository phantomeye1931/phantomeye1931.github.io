import { gameBoard, Phase, Marking, Piece, Type } from './implementation-details.ts';
import { validateSpot } from './validation';
import { postMove } from './game-flow';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

// Utility function for finding a rook in a certain direction for castling. Checks it has not moved,
// and there are no pieces in the way. Returns null otherwise
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

// Runs when the player has selected a promotion for their piece. Swaps it out on the board,
// and then resumes the post-move code that was paused in movePiece() under 'Game Flow'
export function promotePiece(type: Type) {
    const pawn = gameBoard.promotingPiece;
    if (pawn == null) return;

    const promoted = new Piece(type, pawn.color, pawn.row, pawn.column, pawn.row, pawn.column, true);
    gameBoard.pieces.set(promoted.row, promoted.column, promoted);
    gameBoard.promotingPiece = null;

    postMove();
}