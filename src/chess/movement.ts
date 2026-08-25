import { gameBoard, Phase, Marking, hasFriendlyPiece, hasEnemyPiece, hasPiece, isEnPassantable, type Piece } from './implementation-details.ts';
import { attemptCastle } from './special-moves';
import { validateSpot } from './validation';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

// Movement for the Knight
export function knightMoves(knight: Piece) {
    const knightOffsets = [
        [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]
    ];

    for (let offset of knightOffsets) {
        let move = knight.offset( offset[0], offset[1] );

        if (move.onBoard() && !hasFriendlyPiece(move))
            validateSpot(move);
    }
}


// Movement for the Pawns, including En Passant and Pseudo-pin logic
export function pawnMoves(pawn: Piece) {
    if (gameBoard.phase === Phase.ATTACK) {
        // Pawns are the only moves that attack different compared to how they move,
        // thus the distinction here. It always defends these two spots
        validateSpot(pawn.inFront().left());
        validateSpot(pawn.inFront().right());

    } else {
        // Simple moves
        if (!hasPiece(pawn.inFront())) validateSpot(pawn.inFront()); // Single move
        if (!hasPiece(pawn.inFront()) && !hasPiece(pawn.inFront().inFront()) && !pawn.hasMoved )
            validateSpot(pawn.inFront().inFront()); // Double move

        if (hasEnemyPiece(pawn.inFront().left())) validateSpot(pawn.inFront().left());
        if (hasEnemyPiece(pawn.inFront().right())) validateSpot(pawn.inFront().right());

        // Edge Case Nr.2: 'En Passant Pseudo-pin'
        // This is marked, simply, in markPinIfFound(), under 'Pinned Pieces'
        const pseudoPinned = gameBoard.markings.get(pawn.row, pawn.column).has(Marking.PSEUDO_PINNED);

        // The isEnPassantable flag is set in movePiece(), under 'Game Flow',
        // right after a pawn has moved two squares
        if (!pseudoPinned && isEnPassantable(pawn.inFront().left())) validateSpot(pawn.inFront().left());
        if (!pseudoPinned && isEnPassantable(pawn.inFront().right())) validateSpot(pawn.inFront().right());
    }
}

// Movement for the King, including avoiding defended squares
export function kingMoves(king: Piece) {
    const kingAdjacentSquares = [
        [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (let square of kingAdjacentSquares) {
        let move = king.offset(square[0], square[1]);

        if (!move.onBoard() || hasFriendlyPiece(move)
                || gameBoard.markings.get(move.row, move.column).has(Marking.ATTACKED)) continue;

        validateSpot(move);
    }

    attemptCastle(king, 1);
    attemptCastle(king, -1);
}

// The movement code for long-range pieces is below this one,
// as their combined movement logic is substantially more complex