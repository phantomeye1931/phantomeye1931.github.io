import { gameBoard, Phase, Marking, Type, otherColor, getPiecesByColor, clearMarkings, type Piece, type Position } from './implementation-details.ts';
import { knightMoves, pawnMoves, kingMoves } from './movement';
import { rookMoves, bishopMoves, queenMoves } from './long-range-tracing';
import { findRookForCastle } from './special-moves';
import { checkGameOver } from './mate-detection';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

// The function that is called the moment a piece is selected/lifted.
// Shows the valid move for the selected piece
export function selectPiece(piece: Piece) {
    clearMarkings([Marking.VALID]);

    gameBoard.phase = Phase.VALIDATE_MOVES;
    runValidation([ piece ]);
}

// The function that is called the moment a piece is dropped, or a destination square
// was selected. Will only move if this position was marked as valid in selectPiece()
export function movePiece(piece: Piece, position: Position) {
    const markings = gameBoard.markings.get(position.row, position.column);

    // Validate move
    if (!markings.has(Marking.VALID)) {
        clearMarkings([Marking.VALID]);
        return;
    }

    // This is set by this same function further down, thus from a previous call.
    // Whether the current move we're verifying is a capture via En Passant
    const isEnPassantCapture = piece.type === Type.PAWN && markings.has(Marking.EN_PASSANTABLE);

    // Reset things we have remembered about the board, so we have a clean slate to recompute everything
    gameBoard.checkCount = 0;
    clearMarkings([
        Marking.VALID,
        Marking.ATTACKED,
        Marking.CHECK_LINE,
        Marking.CHECK_ORIGIN,
        Marking.LATEST_MOVE,
        Marking.PINNED,
        Marking.EN_PASSANTABLE,
        Marking.PSEUDO_PINNED,
    ]);

    // En Passant capture. Since we're not just capturing on the same square we're moving to, we have
    // to remove the En Passantable pawn manually, here by sampling the current row and new column
    if (isEnPassantCapture)
        gameBoard.pieces.set(piece.row, position.column, null);

    gameBoard.pieces.set(piece.row, piece.column, null); // Leave a void behind on the square we left
    const movedPiece = piece.move(position.row, position.column);
    gameBoard.pieces.set(position.row, position.column, movedPiece);

    // Castling: Simply detected here as the King making a double move, which we follow up by the Rook in
    // that direction moving over to the other side of the King
    if (piece.type === Type.KING && Math.abs(position.column - piece.column) === 2) {
        const direction = Math.sign(position.column - piece.column);
        const rook = findRookForCastle(movedPiece, direction);

        if (rook != null) {
            gameBoard.pieces.set(rook.row, rook.column, null);
            const rookDestination = movedPiece.offset(0, -direction);
            gameBoard.pieces.set(rookDestination.row, rookDestination.column, rook.move(rookDestination.row, rookDestination.column));
        }
    }

    // En Passant: If the pawn just made a double move, we can mark it as En Passantable for now,
    // which will automatically be cleared if the opportunity is ignored
    if (piece.type === Type.PAWN && Math.abs(position.row - piece.row) === 2) {
        const skipped = piece.inFront();
        gameBoard.markings.get(skipped.row, skipped.column).add(Marking.EN_PASSANTABLE);
        gameBoard.markings.get(position.row, position.column).add(Marking.EN_PASSANTABLE);
    }

    gameBoard.markings.get(position.row, position.column).add(Marking.LATEST_MOVE);

    // Promotion: We can easily check whether the pawn has reached the back rank by seeing if the
    // position in front of it is off the board. In that case, we switch to a promoting state, as
    // it is mandatory for the current player to choose a promotion. This prevents the post-move
    // code from running now. It will run once the player has promoted, on an updated board
    if (movedPiece.type === Type.PAWN && !movedPiece.inFront().onBoard()) {
        gameBoard.phase = Phase.PROMOTING;
        gameBoard.promotingPiece = movedPiece;
        return;
    }

    postMove();
}

// The function that is called after a move was made, to prepare the board for the move of the
// next player. This does most of the square marking.
export function postMove() {

    // For all pieces of the current color, scan what squares they are defending now
    gameBoard.phase = Phase.ATTACK;
    runValidation(getPiecesByColor(gameBoard.currentTurn));

    // Count how many valid moves the pieces of the other color can make, combined
    gameBoard.availableMoves = 0;
    gameBoard.phase = Phase.COUNT_MOVES;
    runValidation(getPiecesByColor(otherColor(gameBoard.currentTurn)));

    if (checkGameOver()) return;

    // Ready for the next move
    gameBoard.currentTurn = otherColor(gameBoard.currentTurn);
    gameBoard.phase = Phase.IDLE;
}

// Run the validation code for a set of pieces at the same time
export function runValidation(pieces: Piece[]) {
    for (let piece of pieces) {

        if (piece.type === Type.KNIGHT)  knightMoves(piece);
        if (piece.type === Type.ROOK)    rookMoves(piece);
        if (piece.type === Type.BISHOP)  bishopMoves(piece);
        if (piece.type === Type.QUEEN)   queenMoves(piece);
        if (piece.type === Type.PAWN)    pawnMoves(piece);
        if (piece.type === Type.KING)    kingMoves(piece);
    }
}
