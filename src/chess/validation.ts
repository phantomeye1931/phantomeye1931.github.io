import { gameBoard, Phase, Marking, Type, Position, type Piece } from './implementation-details';
import { traceState } from './_trace-state';
import { moveLinesUpWithKing } from './pins';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

// The final validation filter function that does two things:
// - Filter away pseudo-valid moves that are blocked by niche rules
// - Decide how the move should be validated, depending on the current game Phase
export function validateSpot(move: Piece) {
    if (!move.onBoard()) return;

    switch (gameBoard.phase) {
        // Normal behavior, seeing what moves are valid and counting
        // how many valid moves one of the players still has
        case Phase.VALIDATE_MOVES:
        case Phase.COUNT_MOVES: {
            // Marking pieces as pinned is done by the logic under 'Long-ranged movement' and 'Pinned Pieces'
            const pinned = gameBoard.markings.get(move.pieceRow, move.pieceColumn).has(Marking.PINNED);

            // If this piece is pinned, it can only be moved in line with the King, as not to break the pin
            if (pinned && !moveLinesUpWithKing(move)) return;

            // If there are 2 or more checks, this piece can't get the king out of check and thus can't move
            if (gameBoard.checkCount >= 2 && move.type !== Type.KING) return;

            // If there's exactly 1 check (and we're not the King), we may be able to stop it by capturing or
            // blocking. This block rules out the possibility of both before we mark this move as valid
            if (gameBoard.checkCount === 1 && move.type !== Type.KING
                && !gameBoard.markings.get(move.row, move.column).has(Marking.CHECK_LINE)
                && !gameBoard.markings.get(move.row, move.column).has(Marking.CHECK_ORIGIN)) return;

            // If we're only counting moves, we don't need to remember which moves were the valid ones
            if (gameBoard.phase === Phase.COUNT_MOVES) {
                gameBoard.availableMoves++;
            } else {
                gameBoard.markings.get(move.row, move.column).add(Marking.VALID);
            }

            break;
        }

        case Phase.ATTACK:    {
            // Attacking/defending pieces is way more lenient, no conditions!
            gameBoard.markings.get(move.row, move.column).add(Marking.ATTACKED);

            // Check for attacks on the king, to remember which pieces and how many are checking the king
            let piece = gameBoard.getPiece(move);
            if (piece !== null && piece.isOpponentKing(move)) {
                gameBoard.checkCount++;
                traceState.checkOrigin = true; // Remember we are attacking the King so we can trace back our path

                gameBoard.markings.get(move.pieceRow, move.pieceColumn).add(Marking.CHECK_ORIGIN);

                // Edge Case Nr.1: 'En Passant Check'
                // If a pawn attacking the king just did a double move, we could defend against this
                // by capturing the pawn via En Passant, if possible
                if (move.type === Type.PAWN) {
                    const checkingPawn = gameBoard.getPiece(new Position(move.pieceRow, move.pieceColumn));
                    if (checkingPawn != null) {
                        const behind = checkingPawn.behind();
                        gameBoard.markings.get(behind.row, behind.column).add(Marking.CHECK_LINE);
                    }
                }
            }

            break;
        }
    }
}
