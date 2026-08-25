import { gameBoard, Phase, otherColor } from './implementation-details.ts';

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

export let endMessage: string | null = null;

// Reset the message that appears after a game ended
export function resetGameOver() {
    endMessage = null;
}

// Mate/stalemate detection: postMove above already computes availableMoves for the side about to
// move, so this just has to interpret that count against whether they're in check
export function checkGameOver(): boolean {
    if (gameBoard.availableMoves > 0) return false;

    gameBoard.phase = Phase.OVER;

    if (gameBoard.checkCount == 0) {
        endMessage = "Stalemate.";
    } else {
        endMessage = `${otherColor(gameBoard.currentTurn)} got Checkmated!`;
    }
    return true;
}