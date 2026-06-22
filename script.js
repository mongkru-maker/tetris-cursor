// --- 상수 ---
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 800;
const WALL_KICK_OFFSETS = [0, -1, 1];

const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const PIECES = {
  I: {
    color: "#00f0f0",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#f0f000",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "#a000f0",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    color: "#00f000",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#f00000",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: "#0000f0",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#f0a000",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);

const GAME_KEY_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
]);

const KEY_ACTIONS = {
  ArrowLeft: () => tryMove(-1, 0),
  ArrowRight: () => tryMove(1, 0),
  ArrowDown: () => tryMoveDown(),
  ArrowUp: () => tryRotate(),
  Space: () => hardDrop(),
};

// --- DOM 참조 ---
const boardElement = document.getElementById("game-board");
const scoreElement = document.getElementById("score");
const gameOverElement = document.getElementById("game-over");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

// --- 게임 상태 ---
let score = 0;
let board = createEmptyBoard();
let boardCells = [];
let currentPiece = null;
let dropTimerId = null;
let isPlaying = false;
let isGameOver = false;

// --- 보드 데이터 ---
function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function isRowFull(row) {
  return row.every((cell) => cell !== null);
}

function clearLines() {
  const remainingRows = board.filter((row) => !isRowFull(row));
  const linesCleared = ROWS - remainingRows.length;

  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(null));
  }

  board = remainingRows;
  return linesCleared;
}

// --- 보드 DOM ---
function initBoardGrid() {
  boardElement.innerHTML = "";
  boardCells = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      boardElement.appendChild(cell);
      boardCells.push(cell);
    }
  }
}

function getBoardCell(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return null;
  }

  return boardCells[row * COLS + col];
}

function clearBoardCell(cell) {
  cell.classList.remove("filled");
  cell.style.backgroundColor = "";
}

function paintBoardCell(cell, color) {
  cell.classList.add("filled");
  cell.style.backgroundColor = color;
}

// --- 블록 생성 ---
function createPiece(type) {
  const pieceType = type || PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const pieceDef = PIECES[pieceType];

  if (!pieceDef) {
    throw new Error(`Unknown piece type: ${pieceType}`);
  }

  const { shape, color } = pieceDef;

  return {
    type: pieceType,
    shape: shape.map((row) => [...row]),
    color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  };
}

function rotateShape(shape) {
  const rowCount = shape.length;
  const colCount = shape[0].length;
  const rotated = Array.from({ length: colCount }, () => Array(rowCount).fill(0));

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      rotated[col][rowCount - 1 - row] = shape[row][col];
    }
  }

  return rotated;
}

// --- 충돌 판정 ---
function iterateFilledCells(piece, offsetX, offsetY, callback) {
  for (let rowIndex = 0; rowIndex < piece.shape.length; rowIndex++) {
    for (let colIndex = 0; colIndex < piece.shape[rowIndex].length; colIndex++) {
      if (!piece.shape[rowIndex][colIndex]) {
        continue;
      }

      callback(
        piece.y + offsetY + rowIndex,
        piece.x + offsetX + colIndex
      );
    }
  }
}

function isPlacementValid(boardRow, boardCol, boardMatrix) {
  if (boardCol < 0 || boardCol >= COLS) {
    return false;
  }

  if (boardRow >= ROWS) {
    return false;
  }

  if (boardRow >= 0 && boardMatrix[boardRow][boardCol]) {
    return false;
  }

  return true;
}

function canMove(piece, offsetX, offsetY, boardMatrix) {
  let movable = true;

  iterateFilledCells(piece, offsetX, offsetY, (boardRow, boardCol) => {
    if (!movable) {
      return;
    }

    if (!isPlacementValid(boardRow, boardCol, boardMatrix)) {
      movable = false;
    }
  });

  return movable;
}

// --- 게임 상태 헬퍼 ---
function isControllable() {
  return isPlaying && currentPiece !== null && !isGameOver;
}

function showGameOverMessage() {
  gameOverElement.hidden = false;
}

function hideGameOverMessage() {
  gameOverElement.hidden = true;
}

function triggerGameOver() {
  stopDropTimer();
  isPlaying = false;
  isGameOver = true;
  currentPiece = null;
  showGameOverMessage();
}

function updateScoreDisplay() {
  scoreElement.textContent = score;
}

function addScoreForLines(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  score += LINE_SCORES[linesCleared] || linesCleared * 100;
}

function processLineClears() {
  const linesCleared = clearLines();

  if (linesCleared > 0) {
    addScoreForLines(linesCleared);
    updateScoreDisplay();
  }
}

// --- 블록 조작 ---
function tryMove(offsetX, offsetY) {
  if (!isControllable()) {
    return;
  }

  if (!canMove(currentPiece, offsetX, offsetY, board)) {
    return;
  }

  currentPiece.x += offsetX;
  currentPiece.y += offsetY;
  renderBoard();
}

function tryRotate() {
  if (!isControllable()) {
    return;
  }

  const originalShape = currentPiece.shape;
  const originalX = currentPiece.x;
  const rotatedShape = rotateShape(originalShape);

  for (const kickOffset of WALL_KICK_OFFSETS) {
    const candidatePiece = {
      ...currentPiece,
      shape: rotatedShape,
      x: originalX + kickOffset,
    };

    if (canMove(candidatePiece, 0, 0, board)) {
      currentPiece.shape = rotatedShape;
      currentPiece.x = originalX + kickOffset;
      renderBoard();
      return;
    }
  }
}

function lockPiece(piece) {
  const pendingLocks = [];
  let hasInvalidPlacement = false;

  iterateFilledCells(piece, 0, 0, (boardRow, boardCol) => {
    if (hasInvalidPlacement) {
      return;
    }

    if (boardRow < 0) {
      hasInvalidPlacement = true;
      return;
    }

    if (boardRow >= ROWS || boardCol < 0 || boardCol >= COLS) {
      return;
    }

    if (board[boardRow][boardCol] !== null) {
      hasInvalidPlacement = true;
      return;
    }

    pendingLocks.push({ boardRow, boardCol, color: piece.color });
  });

  if (hasInvalidPlacement) {
    return false;
  }

  pendingLocks.forEach(({ boardRow, boardCol, color }) => {
    board[boardRow][boardCol] = color;
  });

  return true;
}

function spawnPiece() {
  currentPiece = createPiece();

  if (!canMove(currentPiece, 0, 0, board)) {
    triggerGameOver();
  }
}

function settlePiece() {
  const locked = lockPiece(currentPiece);

  if (!locked) {
    triggerGameOver();
    renderBoard();
    return;
  }

  processLineClears();
  spawnPiece();
}

function applyGravityStep() {
  if (canMove(currentPiece, 0, 1, board)) {
    currentPiece.y += 1;
    return;
  }

  settlePiece();
}

function tryMoveDown() {
  if (!isControllable()) {
    return;
  }

  applyGravityStep();
  renderBoard();
}

function hardDrop() {
  if (!isControllable()) {
    return;
  }

  while (canMove(currentPiece, 0, 1, board)) {
    currentPiece.y += 1;
  }

  settlePiece();
  renderBoard();
}

// --- 타이머 ---
function tick() {
  if (!isControllable()) {
    return;
  }

  applyGravityStep();
  renderBoard();
}

function startDropTimer() {
  stopDropTimer();
  dropTimerId = setInterval(tick, DROP_INTERVAL_MS);
}

function stopDropTimer() {
  if (dropTimerId !== null) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
}

// --- 렌더링 ---
function drawPiece(piece) {
  iterateFilledCells(piece, 0, 0, (boardRow, boardCol) => {
    const cell = getBoardCell(boardRow, boardCol);
    if (cell) {
      paintBoardCell(cell, piece.color);
    }
  });
}

function renderLockedCells() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = board[row][col];
      if (!color) {
        continue;
      }

      const cell = getBoardCell(row, col);
      if (cell) {
        paintBoardCell(cell, color);
      }
    }
  }
}

function renderBoard() {
  boardCells.forEach(clearBoardCell);
  renderLockedCells();

  if (currentPiece) {
    drawPiece(currentPiece);
  }
}

// --- 입력 ---
function handleKeyDown(event) {
  if (!GAME_KEY_CODES.has(event.code)) {
    return;
  }

  event.preventDefault();

  if (!isControllable()) {
    return;
  }

  const action = KEY_ACTIONS[event.code];
  if (action) {
    action();
  }
}

// --- 게임 흐름 ---
function resetGameState() {
  stopDropTimer();
  isGameOver = false;
  isPlaying = false;
  hideGameOverMessage();
  score = 0;
  board = createEmptyBoard();
  currentPiece = null;
  updateScoreDisplay();
}

function startGame() {
  resetGameState();
  currentPiece = createPiece();
  isPlaying = true;
  renderBoard();

  if (!canMove(currentPiece, 0, 0, board)) {
    triggerGameOver();
    renderBoard();
    return;
  }

  startDropTimer();
}

function restartGame() {
  startGame();
}

// --- 초기화 ---
initBoardGrid();
currentPiece = createPiece();
renderBoard();
updateScoreDisplay();

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);
document.addEventListener("keydown", handleKeyDown);
