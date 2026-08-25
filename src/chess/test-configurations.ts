
/* START SHOWN CODE */
// Scroll + 🖱️ to pan sideways ->

export let TEST_DOUBLE_CHECK = [
    ['n-w',  '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',   'q-w',  '',   'n-b',  '',   'k-b',  ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',   'k-w'],
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

// En Passant check demo: play f2-f4 (white pawn double move), which delivers check on the
// black king at e5. Then play g4xf3 (black pawn, en passant) to resolve it
export let TEST_EN_PASSANT_CHECK = [
    ['k-w',  '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',   'p-w',  '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',   'p-b',  ''  ],
    [ '',    '',    '',    '',   'k-b',  '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
    [ '',    '',    '',    '',    '',    '',    '',    ''  ],
];

// En Passant pseudo-pin demo: rank 4 holds, in order, white rook (a4), white pawn (c2, about
// to double-move to c4), black pawn (d4), black king (f4). Play c2-c4 - the black pawn on d4
// should NOT get an en-passant capture to c3 offered (it would expose the king to the rook),
// but its normal moves (d4-d3, d4-d2) should still be there
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