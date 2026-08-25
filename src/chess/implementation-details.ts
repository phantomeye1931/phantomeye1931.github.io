/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways →

// This contains all the underlying data structures and utility classes/functions
// Useful to refer to when unsure about a certain functionality

// Utility class for storing positions without any information
// regarding a potential piece occupying it
export class Position {
    constructor(
        public row: number,
        public column: number,
    ) {};

    // Parse from a string, eg. "11"
    static parse(str: string) {
        return new Position(Number((str as any)[0]), Number((str as any)[1]));
    }

    toString(): string {
        return `${this.row}${this.column}`;
    }

    onBoard() {
        return 0 < this.row && this.row < 9 && 0 < this.column && this.column < 9;
    }
}

// Enums for easy property access and comparison between pieces
export enum Type {
    PAWN = 'pawn',
    KNIGHT = 'knight',
    BISHOP = 'bishop',
    ROOK = 'rook',
    QUEEN = 'queen',
    KING = 'king',
}

export enum Color {
    WHITE = 'white',
    BLACK = 'black',
}

// Simply flip the color. White -> Black - Black -> White
export function otherColor(color: Color) {
    return color == Color.WHITE ? Color.BLACK : Color.WHITE;
}

// Types of marking a square can have
export enum Marking {
    VALID = 'mark-valid',
    ATTACKED = 'mark-attacked',
    CHECK_LINE = 'mark-line-of-check',
    CHECK_ORIGIN = 'mark-check-origin',
    LATEST_MOVE = 'mark-last-move',
    PINNED = 'mark-pinned',
    EN_PASSANTABLE = 'mark-en-passantable',
    PSEUDO_PINNED = 'mark-pseudo-pinned',
}

// For parsing eg. "p-w:11"
const TYPE_CHARS: Record<string, Type> = {
    p: Type.PAWN,
    n: Type.KNIGHT,
    b: Type.BISHOP,
    r: Type.ROOK,
    q: Type.QUEEN,
    k: Type.KING,
};

const COLOR_CHARS: Record<string, Color> = {
    w: Color.WHITE,
    b: Color.BLACK,
};

// An extended utility class to store a Piece as well as its position, and a
// position to navigate while still having easy access to the Piece's properties
export class Piece extends Position {
    public type: Type;
    public color: Color;
    public hasMoved: boolean;

    // These two always represent the actual position of the piece we're working with
    public pieceRow: number;
    public pieceColumn: number;

    constructor(type: Type, color: Color, row: number, column: number, pieceRow: number, pieceColumn: number, hasMoved: boolean) {
        super(row, column);
        this.type = type;
        this.color = color;
        this.hasMoved = hasMoved;

        this.pieceRow = pieceRow;
        this.pieceColumn = pieceColumn;
    }

    // Parse from eg. "p-w:11"
    static parsePiece(str: string): Piece | null {
        if (str == '') return null;

        const [typeColor, position] = str.split(':');
        const [type, color] = typeColor.split('-');
        const pos = Position.parse(position);

        return new Piece(TYPE_CHARS[type], COLOR_CHARS[color], pos.row, pos.column, pos.row, pos.column, false);
    }

    move(row: number, column: number): Piece {
        return new Piece(this.type, this.color, row, column, row, column, true);
    }

    offset(row: number, column: number): Piece {
        return new Piece(this.type, this.color, row + this.row, column + this.column, this.pieceRow, this.pieceColumn, this.hasMoved);
    }

    // One square away from that color's back rank.
    // Comparable to methods below
    inFront() {
        return this.offset(this.color === Color.WHITE ? 1 : -1, 0);
    }

    behind() {
        return this.offset(this.color === Color.WHITE ? -1 : 1, 0);
    }

    left() {
        return this.offset(0, this.color === Color.WHITE ? 1 : -1);
    }

    right() {
        return this.offset(0, this.color === Color.WHITE ? -1 : 1);
    }

    // Simply returns whether THIS is the opposing king of a certain piece
    isOpponentKing(piece: Piece) {
        return this.type === Type.KING && this.color !== piece.color;
    }
}

// Starting position:
// Row 1 = white's back rank
// Row 8 = black's back rank
let STARTING_POSITION: string[][] = [
    ['r-w', 'n-w', 'b-w', 'q-w', 'k-w', 'b-w', 'n-w', 'r-w'],
    ['p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w', 'p-w'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b', 'p-b'],
    ['r-b', 'n-b', 'b-b', 'q-b', 'k-b', 'b-b', 'n-b', 'r-b'],
];


// 1-indexed 2-dimensional matrix
export class Matrix<T> {
    constructor(
        private values: T[][],
    ) {}

    getPos(position: Position) {
        return this.values[position.row - 1][position.column - 1];
    }

    get(row: number, column: number) {
        return this.values[row - 1][column - 1];
    }

    set(row: number, column: number, value: T) {
        this.values[row - 1][column - 1] = value;
    }
}

export enum Phase {
    VALIDATE_MOVES,
    ATTACK,
    COUNT_MOVES,
    PROMOTING,
    IDLE,
    OVER,
}

export class Board {
    public pieces: Matrix<Piece | null> = new Matrix(STARTING_POSITION.map((row, i) => row.map((s, j) => Piece.parsePiece(s == '' ? '' : `${s}:${i + 1}${j + 1}`))) );

    public markings: Matrix<Set<string>> = new Matrix(STARTING_POSITION.map(row => row.map(() => new Set<string>())) );

    public phase: Phase = Phase.VALIDATE_MOVES;
    public currentTurn: Color = Color.WHITE;

    public checkCount: number = 0;
    public availableMoves: number = 0;
    public promotingPiece: Piece | null = null;

    getPiece(position: Position): Piece | null {
        return this.pieces.get(position.row, position.column);
    }
}

export const gameBoard = new Board();

// Check whether a certain position has a piece friendly to the current piece.
export function hasFriendlyPiece(move: Piece) {
    if (!move.onBoard()) return;
    const piece = gameBoard.getPiece(move);

    return piece != null && piece.color === move.color;
}

// Check whether a certain position has a piece offensive to the current piece.
export function hasEnemyPiece(move: Piece) {
    if (!move.onBoard()) return;
    const piece = gameBoard.getPiece(move);

    return piece != null && piece.color !== move.color;
}

// Check whether a certain position has a piece
export function hasPiece(move: Piece) {
    if (!move.onBoard()) return;
    const piece = gameBoard.getPiece(move);

    return piece != null;
}

// Check whether a certain position is marked en-passantable (see movePiece, which sets this
// for exactly one enemy turn whenever a pawn double-moves)
export function isEnPassantable(move: Piece) {
    if (!move.onBoard()) return false;

    return gameBoard.markings.get(move.row, move.column).has(Marking.EN_PASSANTABLE);
}

// Returns the king of the given color
export function getKing(color: Color): Piece {
    return getPiecesByColor(color).find(p => p.type === Type.KING)!;
}

// Returns every piece of the given color still on the board
export function getPiecesByColor(color: Color): Piece[] {
    const pieces: Piece[] = [];

    for (let row = 1; row <= 8; row++)
        for (let column = 1; column <= 8; column++) {
            const piece = gameBoard.getPiece(new Position(row, column));
            if (piece != null && piece.color === color) pieces.push(piece);
        }

    return pieces;
}

// Clears certain markings from every square
export function clearMarkings(markings: Marking[]) {
    for (let row = 1; row < 9; row++)
        for (let column = 1; column < 9; column++)
            for (let marking of markings)
                gameBoard.markings.get(row, column).delete(marking);
}
