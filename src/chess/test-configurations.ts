import { Color, gameBoard, Phase, Piece } from "./implementation-details.ts";
import { resetGameOver } from "./mate-detection.ts";
import { postMove } from "./game-flow.ts";

/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

export let TEST_NORMAL_BOARD = [
    ['r-w', 'n-w', 'b-w', 'q-w', 'k-w', 'b-w', 'n-w', 'r-w'],
    ['p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w'],
    ['',    '',    '',    '',    '',    '',    '',    ''   ],
    ['',    '',    '',    '',    '',    '',    '',    ''   ],
    ['',    '',    '',    '',    '',    '',    '',    ''   ],
    ['',    '',    '',    '',    '',    '',    '',    ''   ],
    ['p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b'],
    ['r-b', 'n-b', 'b-b', 'q-b', 'k-b', 'b-b', 'n-b', 'r-b'],
];

export let TEST_KINGS_AND_ROOKS = [
    ['r-w', '',   '',   '',   'k-w', '',   '',   'r-w'],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['',    '',   '',   '',   '',    '',   '',   ''   ],
    ['r-b', '',   '',   '',   'k-b', '',   '',   'r-b'],
];

export let TEST_DOUBLE_CHECK = [
    [ '',    '',    '',    '',    '',    '',    '',   'k-w'],
    [ '',   'k-b',  '',    '',    '',    '',   'r-b',  ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',   'n-b',  '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',   'r-w',  '',    ''  ],
    [ '',    '',    '',    '',    '',    '',   'b-w',  ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
];

export let TEST_NO_PAWNS = [
    ['r-w', 'n-w', 'b-w', 'q-w', 'k-w', 'b-w', 'n-w', 'r-w'],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    ['r-b', 'n-b', 'b-b', 'q-b', 'k-b', 'b-b', 'n-b', 'r-b'],
];

// En Passant check demo: After double moving the white pawn, capturing via En Passant
// would free the King from check, despite this not being a move to the position of the
// origin of the check, nor a position in between the king and it
export let TEST_EN_PASSANT_CHECK = [
    ['k-w',  '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',   'p-w',  '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',   'p-b',  ''  ],
    [ '',    '',    '',    '',   'k-b',  '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
];

// En Passant pseudo-pin demo. After double moving the white pawn, capturing via En Passant
// would result in exposing the king, even though no pieces are pinned
export let TEST_EN_PASSANT_PSEUDO_PIN = [
    [ '',    '',    '',    '',    '',    '',    '',   'k-w'],
    [ '',    '',   'p-w',  '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    ['r-w',  '',    '',   'p-b',  '',   'k-b',  '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
];

// Loads a test configuration onto a fresh board, then runs the necessary computations
export function loadConfiguration(config: string[][]) {
    loadPosition(config);
    resetGameOver();

    // ATTACK phase belongs to whoever ISN'T about to move, compute
    // Black's attack squares to let them influence white's move
    gameBoard.currentTurn = Color.BLACK;

    postMove();
}

// Replaces all parts of the board to swap it for a different position
export function loadPosition(config: string[][]) {
    for (let row = 1; row <= 8; row++)
        for (let column = 1; column <= 8; column++) {
            const cell = config[row - 1]?.[column - 1] ?? '';
            gameBoard.pieces.set(row, column, Piece.parsePiece(cell === '' ? '' : `${cell}:${row}${column}`));
            gameBoard.markings.set(row, column, new Set());
        }

    gameBoard.phase = Phase.VALIDATE_MOVES;
    gameBoard.currentTurn = Color.WHITE;
    gameBoard.checkCount = 0;
    gameBoard.availableMoves = 0;
    gameBoard.promotingPiece = null;
}