// 游戏常量
const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const HUMAN = BLACK;
const AI = WHITE;

// 游戏状态
let board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
let currentPlayer = BLACK;
let gameOver = false;
let moveHistory = [];
let isAIMode = true;

// DOM元素
const boardEl = document.getElementById('board');
const gameStatusEl = document.getElementById('game-status');
const moveHistoryEl = document.getElementById('move-history');
const difficultySelect = document.getElementById('difficulty');
const restartBtn = document.getElementById('restart');
const undoBtn = document.getElementById('undo');
const modeToggleBtn = document.getElementById('mode-toggle');

// 初始化游戏
function initGame() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
    currentPlayer = BLACK;
    gameOver = false;
    moveHistory = [];
    renderBoard();
    updateStatus();
    
    if (isAIMode && currentPlayer === AI) {
        setTimeout(makeAIMove, 500);
    }
}

// 渲染棋盘
function renderBoard() {
    boardEl.innerHTML = '';
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if (board[row][col] !== EMPTY) {
                const piece = document.createElement('div');
                piece.className = `piece ${board[row][col] === BLACK ? 'black' : 'white'}`;
                cell.appendChild(piece);
            }
            
            cell.addEventListener('click', () => handleMove(row, col));
            boardEl.appendChild(cell);
        }
    }
}

// 处理玩家移动
function handleMove(row, col) {
    if (gameOver || board[row][col] !== EMPTY) return;
    if (isAIMode && currentPlayer === AI) return;
    
    makeMove(row, col, currentPlayer);
    
    if (!gameOver && isAIMode && currentPlayer === AI) {
        setTimeout(makeAIMove, 500);
    }
}

// 执行移动
function makeMove(row, col, player) {
    board[row][col] = player;
    moveHistory.push({row, col, player});
    
    renderBoard();
    
    if (checkWin(row, col, player)) {
        gameOver = true;
        highlightWinningLine(row, col, player);
        updateStatus(`${player === BLACK ? '黑方' : '白方'}获胜！`);
        return;
    }
    
    if (isBoardFull()) {
        gameOver = true;
        updateStatus("平局！");
        return;
    }
    
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    updateStatus();
}

// AI移动
function makeAIMove() {
    if (gameOver || currentPlayer !== AI) return;
    
    const difficulty = parseInt(difficultySelect.value);
    const {row, col} = findBestMove(difficulty);
    makeMove(row, col, AI);
}

// 评估函数
function evaluateBoard() {
    let score = 0;
    
    // 检查所有可能的五子连线
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] !== EMPTY) {
                const player = board[row][col];
                const directions = [[1,0], [0,1], [1,1], [1,-1]];
                
                for (const [dr, dc] of directions) {
                    const line = getLine(row, col, dr, dc);
                    score += evaluateLine(line, player);
                }
            }
        }
    }
    
    return score;
}

// Minimax算法
function minimax(depth, isMaximizing, alpha, beta) {
    if (depth === 0) {
        return evaluateBoard();
    }
    
    const player = isMaximizing ? AI : HUMAN;
    let bestValue = isMaximizing ? -Infinity : Infinity;
    
    const moves = generateMoves();
    
    for (const {row, col} of moves) {
        board[row][col] = player;
        
        const value = minimax(depth - 1, !isMaximizing, alpha, beta);
        
        board[row][col] = EMPTY;
        
        if (isMaximizing) {
            bestValue = Math.max(bestValue, value);
            alpha = Math.max(alpha, bestValue);
        } else {
            bestValue = Math.min(bestValue, value);
            beta = Math.min(beta, bestValue);
        }
        
        if (beta <= alpha) {
            break;
        }
    }
    
    return bestValue;
}

// 查找最佳移动
function findBestMove(depth) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    const moves = generateMoves();
    
    for (const {row, col} of moves) {
        board[row][col] = AI;
        
        const score = minimax(depth, false, -Infinity, Infinity);
        
        board[row][col] = EMPTY;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = {row, col};
        }
    }
    
    return bestMove || moves[0];
}

// 生成可能的移动
function generateMoves() {
    const moves = [];
    const center = Math.floor(BOARD_SIZE / 2);
    
    // 优先考虑已有棋子周围的空位
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === EMPTY && hasNeighbor(row, col)) {
                moves.push({row, col});
            }
        }
    }
    
    // 如果棋盘为空，选择中心点
    if (moves.length === 0 && board[center][center] === EMPTY) {
        moves.push({row: center, col: center});
    }
    
    return moves;
}

// 检查是否有邻居棋子
function hasNeighbor(row, col, distance = 1) {
    for (let r = Math.max(0, row - distance); r <= Math.min(BOARD_SIZE - 1, row + distance); r++) {
        for (let c = Math.max(0, col - distance); c <= Math.min(BOARD_SIZE - 1, col + distance); c++) {
            if ((r !== row || c !== col) && board[r][c] !== EMPTY) {
                return true;
            }
        }
    }
    return false;
}

// 检查胜利条件
function checkWin(row, col, player) {
    const directions = [[1,0], [0,1], [1,1], [1,-1]];
    
    for (const [dr, dc] of directions) {
        let count = 1;
        
        // 正向检查
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
            count++;
        }
        
        // 反向检查
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
            count++;
        }
        
        if (count >= 5) return true;
    }
    
    return false;
}

// 高亮胜利线
function highlightWinningLine(row, col, player) {
    const directions = [[1,0], [0,1], [1,1], [1,-1]];
    
    for (const [dr, dc] of directions) {
        let count = 1;
        let start = {row, col};
        let end = {row, col};
        
        // 正向检查
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
            count++;
            end = {row: r, col: c};
        }
        
        // 反向检查
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
            count++;
            start = {row: r, col: c};
        }
        
        if (count >= 5) {
            drawWinningLine(start, end);
            return;
        }
    }
}

// 绘制胜利线
function drawWinningLine(start, end) {
    const line = document.createElement('div');
    line.className = 'win-line';
    
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
    const startX = start.col * cellSize + cellSize / 2;
    const startY = start.row * cellSize + cellSize / 2;
    const endX = end.col * cellSize + cellSize / 2;
    const endY = end.row * cellSize + cellSize / 2;
    
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    
    line.style.width = `${length}px`;
    line.style.height = '4px';
    line.style.left = `${startX}px`;
    line.style.top = `${startY}px`;
    line.style.transform = `rotate(${angle}deg)`;
    
    boardEl.appendChild(line);
}

// 更新游戏状态显示
function updateStatus(message) {
    if (message) {
        gameStatusEl.textContent = message;
        return;
    }
    
    if (gameOver) return;
    
    const playerName = currentPlayer === BLACK ? '黑方' : '白方';
    const modeText = isAIMode && currentPlayer === AI ? '(电脑思考中...)' : '';
    gameStatusEl.textContent = `${playerName}回合 ${modeText}`;
    
    // 更新移动历史
    moveHistoryEl.textContent = `步数: ${moveHistory.length}`;
}

// 检查棋盘是否已满
function isBoardFull() {
    return board.every(row => row.every(cell => cell !== EMPTY));
}

// 悔棋功能
function undoMove() {
    if (moveHistory.length === 0 || gameOver) return;
    
    // 悔一步（人机模式需要退两步）
    const stepsToUndo = isAIMode && currentPlayer === HUMAN ? 2 : 1;
    
    if (moveHistory.length < stepsToUndo) return;
    
    for (let i = 0; i < stepsToUndo; i++) {
        const {row, col} = moveHistory.pop();
        board[row][col] = EMPTY;
    }
    
    currentPlayer = HUMAN;
    gameOver = false;
    renderBoard();
    updateStatus();
}

// 切换游戏模式
function toggleGameMode() {
    isAIMode = !isAIMode;
    modeToggleBtn.textContent = isAIMode ? '切换为人人对战' : '切换为人机对战';
    document.getElementById('game-mode').textContent = isAIMode ? '人机对战' : '人人对战';
    initGame();
}

// 事件监听
restartBtn.addEventListener('click', initGame);
undoBtn.addEventListener('click', undoMove);
modeToggleBtn.addEventListener('click', toggleGameMode);

// 初始化游戏
initGame();
