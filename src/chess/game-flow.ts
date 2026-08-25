import { gameBoard, Phase, Marking, Type, otherColor, getPiecesByColor, clearMarkings, type Piece, type Position } from './implementation-details.ts';
import { knightMoves, pawnMoves, kingMoves } from './movement';
import { rookMoves, bishopMoves, queenMoves } from './long-range-tracing';
import { findRookForCastle } from './special-moves';
import { checkGameOver } from './mate-detection';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

export function selectPiece(piece: Piece) {
    clearMarkings([Marking.VALID]);

    gameBoard.phase = Phase.VALIDATE_MOVES;
    runValidation([ piece ]);
}

export function movePiece(piece: Piece, position: Position) {
    const markings = gameBoard.markings.get(position.row, position.column);

    // Validate move
    if (!markings.has(Marking.VALID)) {
        clearMarkings([Marking.VALID]);
        return;
    }

    // clearMarkings mutates this same Set in place, so this has to be read before that call
    const isEnPassantCapture = piece.type === Type.PAWN && markings.has(Marking.EN_PASSANTABLE);

    gameBoard.checkCount = 0;
    clearMarkings([Marking.VALID, Marking.ATTACKED, Marking.CHECK_LINE, Marking.CHECK_ORIGIN, Marking.LATEST_MOVE, Marking.PINNED, Marking.EN_PASSANTABLE, Marking.PSEUDO_PINNED]);

    // En Passant capture: per the blog, "check if the new position is behind an En-Passantable
    // piece, and if so, capture said piece." The captured pawn isn't on the destination square
    // (that's the whole point - it's an empty square being moved into), it's one rank behind the
    // destination, on the same rank the capturing pawn started from
    if (isEnPassantCapture)
        gameBoard.pieces.set(piece.row, position.column, null);

    gameBoard.pieces.set(piece.row, piece.column, null); // Leave a void behind
    const movedPiece = piece.move(position.row, position.column);
    gameBoard.pieces.set(position.row, position.column, movedPiece);

    // Castling: Detected here as the king making a double move. The matching rook (found the same way
    // attemptCastle found it) hops to the square the king just crossed over
    if (piece.type === Type.KING && Math.abs(position.column - piece.column) === 2) {
        const direction = Math.sign(position.column - piece.column);
        const rook = findRookForCastle(movedPiece, direction);
        if (rook != null) {
            gameBoard.pieces.set(rook.row, rook.column, null);
            const rookDestination = movedPiece.offset(0, -direction);
            gameBoard.pieces.set(rookDestination.row, rookDestination.column, rook.move(rookDestination.row, rookDestination.column));
        }
    }

    // En Passant tracking: per the blog, "track which pawn has just moved two squares, mark
    // said pawn as En-Passantable." Deviation: the blog's pseudocode does this inside the pawn's
    // own move-validation function (pawnMoves), but that function runs every time any pawn's
    // moves are previewed or counted - not just when a double move is actually taken - so
    // marking it there would flag every pawn that *could* double-move, not the one that just
    // did. Doing it here, at the one point a move is actually committed, is the equivalent for
    // this codebase's split between move validation and move execution.
    // Second deviation: the blog's own prose says "mark said pawn", but its code marks the
    // *skipped* square instead (needed so the capture check in pawnMoves can find it - see the
    // note there). The pseudo-pin edge case below needs the marking on the pawn's own square
    // too (traceSpots visits the piece, not the empty square behind it), so both get marked
    if (piece.type === Type.PAWN && Math.abs(position.row - piece.row) === 2) {
        const skipped = piece.inFront();
        gameBoard.markings.get(skipped.row, skipped.column).add(Marking.EN_PASSANTABLE);
        gameBoard.markings.get(position.row, position.column).add(Marking.EN_PASSANTABLE);
    }

    gameBoard.markings.get(position.row, position.column).add(Marking.LATEST_MOVE);

    // Promotion: per the blog, check if the square right in front of the pawn's new position
    // is still on the board - if not, it's reached the back rank. Pause here instead of
    // running postMove; postMove only runs once promotePiece (promotion.ts) finishes the job,
    // since the move isn't resolved until the player picks what to promote to
    if (movedPiece.type === Type.PAWN && !movedPiece.inFront().onBoard()) {
        gameBoard.phase = Phase.PROMOTING;
        gameBoard.promotingPiece = movedPiece;
        return;
    }

    postMove(piece);
}

export function postMove(piece: Piece) {

    gameBoard.phase = Phase.ATTACK;
    runValidation(getPiecesByColor(gameBoard.currentTurn));

    gameBoard.availableMoves = 0;
    gameBoard.phase = Phase.COUNT_MOVES;
    runValidation(getPiecesByColor(otherColor(gameBoard.currentTurn)));

    if (checkGameOver()) return;

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
