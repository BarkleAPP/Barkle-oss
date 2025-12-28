// Barktres Game Constants and Logic

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const BLOCK_SIZE = 30;

// Tetromino shapes
export const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 1, 0], [0, 1, 1]], // Z
    [[1, 0, 0], [1, 1, 1]], // J
    [[0, 0, 1], [1, 1, 1]], // L
];

export const COLORS = [
    '#00ffff', // cyan - I
    '#ffff00', // yellow - O
    '#800080', // purple - T
    '#00ff00', // green - S
    '#ff0000', // red - Z
    '#0000ff', // blue - J
    '#ff7f00', // orange - L
];

export interface Piece {
    shape: number[][];
    colorIndex: number;
    x: number;
    y: number;
}

export interface GameState {
    board: number[][];
    currentPiece: Piece | null;
    nextPiece: Piece | null;
    holdPiece: Piece | null;
    score: number;
    lines: number;
    level: number;
    canHold: boolean;
}// Initialize empty game board
export function initBoard(): number[][] {
    return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
}

// Create new random piece
export function createPiece(): Piece {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: JSON.parse(JSON.stringify(SHAPES[shapeIndex])),
        colorIndex: shapeIndex,
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(SHAPES[shapeIndex][0].length / 2),
        y: 0,
    };
}

// Check collision
export function collision(piece: Piece, board: number[][], offsetX = 0, offsetY = 0): boolean {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;

                if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
                    return true;
                }

                if (newY >= 0 && board[newY][newX] > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Merge piece into board
export function merge(piece: Piece, board: number[][]): void {
    const colorValue = piece.colorIndex + 1;

    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                    board[boardY][boardX] = colorValue;
                }
            }
        }
    }
}

// Clear completed lines and return number cleared
export function clearLines(board: number[][]): { newBoard: number[][]; linesCleared: number } {
    let linesCleared = 0;
    const newBoard: number[][] = [];

    for (let y = 0; y < BOARD_HEIGHT; y++) {
        if (!board[y].every(cell => cell > 0)) {
            newBoard.push([...board[y]]);
        } else {
            linesCleared++;
        }
    }

    // Add empty lines at top
    while (newBoard.length < BOARD_HEIGHT) {
        newBoard.unshift(Array(BOARD_WIDTH).fill(0));
    }

    return { newBoard, linesCleared };
}

// Calculate score for lines cleared (Tetris Guideline compatible)
export function calculateScore(linesCleared: number, level: number, isTSpin: boolean = false, isMini: boolean = false, isPerfectClear: boolean = false): number {
    let baseScore = 0;

    if (isPerfectClear) {
        // Perfect clear bonuses
        if (linesCleared === 1) baseScore = 800;
        else if (linesCleared === 2) baseScore = 1200;
        else if (linesCleared === 3) baseScore = 1800;
        else if (linesCleared === 4) baseScore = 2000;
    } else if (isTSpin) {
        // T-Spin scoring
        if (isMini) {
            baseScore = 100; // Mini T-Spin
        } else {
            if (linesCleared === 0) baseScore = 400; // T-Spin no lines
            else if (linesCleared === 1) baseScore = 800; // T-Spin Single
            else if (linesCleared === 2) baseScore = 1200; // T-Spin Double
            else if (linesCleared === 3) baseScore = 1600; // T-Spin Triple
        }
    } else {
        // Regular line clear scoring
        if (linesCleared === 1) baseScore = 100;
        else if (linesCleared === 2) baseScore = 300;
        else if (linesCleared === 3) baseScore = 500;
        else if (linesCleared === 4) baseScore = 800;
    }

    return baseScore * level;
}

// Calculate level based on lines cleared (NES Tetris style)
export function calculateLevel(totalLines: number): number {
    return Math.floor(totalLines / 10) + 1;
}

// Rotate piece clockwise
export function rotatePiece(piece: Piece): Piece {
    const rotated = piece.shape[0].map((_, i) =>
        piece.shape.map(row => row[i]).reverse()
    );

    return {
        ...piece,
        shape: rotated,
    };
}

// Get ghost piece drop distance
export function getGhostY(piece: Piece, board: number[][]): number {
    let ghostY = piece.y;
    while (!collision({ ...piece, y: ghostY + 1 }, board)) {
        ghostY++;
    }
    return ghostY;
}// Draw block on canvas
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number): void {
    const color = COLORS[colorIndex];
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    // Fill block
    ctx.fillStyle = color;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    // Add border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    // Add highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, 4);
}

// Draw ghost piece
function drawGhostBlock(ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number): void {
    const color = COLORS[colorIndex];
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    // Ghost outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

    // Subtle fill
    ctx.fillStyle = color + '20'; // 20 = low opacity
    ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
}

// Draw game state on canvas
export function draw(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    board: number[][],
    currentPiece: Piece | null
): void {
    // Clear canvas with dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(canvas.width, y * BLOCK_SIZE);
        ctx.stroke();
    }

    // Draw settled blocks
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x] > 0) {
                drawBlock(ctx, x, y, board[y][x] - 1);
            }
        }
    }

    // Draw ghost piece (where current piece will land)
    if (currentPiece) {
        const ghostY = getGhostY(currentPiece, board);
        if (ghostY !== currentPiece.y) {
            for (let y = 0; y < currentPiece.shape.length; y++) {
                for (let x = 0; x < currentPiece.shape[y].length; x++) {
                    if (currentPiece.shape[y][x]) {
                        drawGhostBlock(ctx, currentPiece.x + x, ghostY + y, currentPiece.colorIndex);
                    }
                }
            }
        }
    }

    // Draw current falling piece
    if (currentPiece) {
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.colorIndex);
                }
            }
        }
    }
}

// Draw preview piece (for next/hold displays)
export function drawPreview(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    piece: Piece | null
): void {
    // Clear canvas
    ctx.fillStyle = 'rgba(26, 26, 46, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!piece) return;

    // Calculate centering offset
    const pieceWidth = piece.shape[0].length * BLOCK_SIZE;
    const pieceHeight = piece.shape.length * BLOCK_SIZE;
    const offsetX = (canvas.width - pieceWidth) / 2;
    const offsetY = (canvas.height - pieceHeight) / 2;

    // Draw piece centered
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const px = offsetX + x * BLOCK_SIZE;
                const py = offsetY + y * BLOCK_SIZE;

                const color = COLORS[piece.colorIndex];
                ctx.fillStyle = color;
                ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
    }
}