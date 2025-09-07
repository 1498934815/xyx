// 游戏常量
const BOARD_SIZE = 19;
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
const aiThinkingEl = document.getElementById('ai-thinking');
const situationAnalysis = document.getElementById('situation-analysis');
const aiDecisionEl = document.getElementById('ai-decision');
const threatLevelEl = document.getElementById('threat-level');

// 初始化游戏
function initGame() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
    currentPlayer = BLACK;
    gameOver = false;
    moveHistory = [];
    renderBoard();
    updateStatus();
    updateAnalysis();
    
    if (isAIMode && currentPlayer === AI) {
        setTimeout(makeAIMove, 500);
    }
}

// 渲染棋盘
function renderBoard() {
    boardEl.innerHTML = '';
    
    // 创建棋盘格子
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 添加坐标标记（可选）
            if (row === 0 || col === 0) {
                const coord = document.createElement('span');
                coord.className = 'coord';
                coord.textContent = row === 0 ? col + 1 : row + 1;
                coord.style.position = 'absolute';
                coord.style.fontSize = '10px';
                coord.style.color = 'rgba(0,0,0,0.3)';
                coord.style.top = '2px';
                coord.style.left = '2px';
                cell.appendChild(coord);
            }
            
            if (board[row][col] !== EMPTY) {
                const piece = document.createElement('div');
                piece.className = `piece ${board[row][col] === BLACK ? 'black' : 'white'}`;
                cell.appendChild(piece);
                
                // 添加高亮效果（可选）
                if (moveHistory.length > 0 && 
                    moveHistory[moveHistory.length - 1].row === row && 
                    moveHistory[moveHistory.length - 1].col === col) {
                    piece.style.boxShadow = '0 0 15px rgba(255, 255, 0, 0.8)';
                }
            }
            
            cell.addEventListener('click', () => handleMove(row, col));
            boardEl.appendChild(cell);
        }
    }
    
    // 调整棋盘容器大小
    const container = document.querySelector('.board-container');
    container.style.width = `${BOARD_SIZE * 32 + 4}px`;
    container.style.height = `${BOARD_SIZE * 32 + 4}px`;
}

// 处理玩家移动
function handleMove(row, col) {
    if (gameOver || board[row][col] !== EMPTY) return;
    if (isAIMode && currentPlayer === AI) return;
    
    makeMove(row, col, currentPlayer);
    updateAnalysis();
    
    if (!gameOver && isAIMode && currentPlayer === AI) {
        setTimeout(makeAIMove, 1000);
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
    moveHistoryEl.textContent = `步数: ${moveHistory.length}`;
}

// AI移动
function makeAIMove() {
    if (gameOver || currentPlayer !== AI) return;
    
    aiThinkingEl.style.display = 'block';
    updateAnalysis();
    
    setTimeout(() => {
        const difficulty = parseInt(difficultySelect.value);
        const {row, col} = findBestMove(difficulty);
        makeMove(row, col, AI);
        aiThinkingEl.style.display = 'none';
        updateAnalysis();
    }, 1000);
}

// 评估函数 - 改进版
function evaluateBoard() {
    let score = 0;
    let maxPlayerThreat = 0;
    
    // 检查所有可能的五子连线
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] !== EMPTY) {
                const player = board[row][col];
                const directions = [[1,0], [0,1], [1,1], [1,-1]];
                
                for (const [dr, dc] of directions) {
                    const line = getLine(row, col, dr, dc);
                    const lineScore = evaluateLine(line, player);
                    score += (player === AI) ? lineScore : -lineScore;
                    
                    // 记录玩家的最大威胁
                    if (player === HUMAN) {
                        maxPlayerThreat = Math.max(maxPlayerThreat, lineScore);
                    }
                }
            }
        }
    }
    
    // 更新威胁指示器
    const threatPercent = Math.min(100, maxPlayerThreat / 1000 * 100);
    threatLevelEl.style.width = `${threatPercent}%`;
    
    return score;
}

// 获取一条线上的棋子
function getLine(row, col, dr, dc) {
    const line = [];
    for (let i = -4; i <= 4; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            line.push(board[r][c]);
        } else {
            line.push(-1); // 边界外
        }
    }
    return line;
}

// 评估一条线 - 改进版
function evaluateLine(line, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let score = 0;
    
    // 检查5个连续的位置
    for (let i = 0; i <= line.length - 5; i++) {
        const segment = line.slice(i, i + 5);
        
        // 统计玩家和对手的棋子
        const playerCount = segment.filter(c => c === player).length;
        const opponentCount = segment.filter(c => c === opponent).length;
        
        if (opponentCount > 0) continue; // 对手有棋子，这条线无效
        
        if (playerCount === 5) score += 100000; // 五连
        else if (playerCount === 4) score += 10000; // 活四
        else if (playerCount === 3) score += 1000; // 活三
        else if (playerCount === 2) score += 100; // 活二
        else if (playerCount === 1) score += 10; // 活一
    }
    
    return score;
}

// 查找最佳移动
function findBestMove(depth) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    const moves = generateMoves();
    
    for (const {row, col} of moves) {
        board[row][col] = AI;
        
        const score = evaluateBoard();
        
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
    
    const cellSize = 32;
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
    
    if (gameOver) {
        const playerName = currentPlayer === BLACK ? '黑方' : '白方';
        gameStatusEl.textContent = `${playerName}获胜！`;
        return;
    }
    
    if (isAIMode && currentPlayer === AI) {
        gameStatusEl.textContent = '电脑思考中...';
    } else {
        const playerName = currentPlayer === BLACK ? '黑方' : '白方';
        gameStatusEl.textContent = `${playerName}回合`;
    }
}

// 更新局势分析
function updateAnalysis() {
    if (gameOver) {
        situationAnalysis.textContent = "游戏已结束";
        aiDecisionEl.textContent = "请点击重新开始按钮开始新游戏";
        return;
    }
    
    // 分析当前局势
    let playerThreat = 0;
    let aiThreat = 0;
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] !== EMPTY) {
                const player = board[row][col];
                const directions = [[1,0], [0,1], [1,1], [1,-1]];
                
                for (const [dr, dc] of directions) {
                    const line = getLine(row, col, dr, dc);
                    const threat = evaluateLine(line, player);
                    
                    if (player === HUMAN) {
                        playerThreat = Math.max(playerThreat, threat);
                    } else {
                        aiThreat = Math.max(aiThreat, threat);
                    }
                }
            }
        }
    }
    
    // 更新局势分析
    if (moveHistory.length === 0) {
        situationAnalysis.textContent = "棋盘初始状态，暂无威胁";
    } else if (playerThreat >= 100000) {
        situationAnalysis.textContent = "玩家已经获胜！";
    } else if (playerThreat >= 10000) {
        situationAnalysis.textContent = "玩家形成了活四，极大威胁！";
    } else if (playerThreat >= 1000) {
        situationAnalysis.textContent = "玩家形成了活三，需要密切关注";
    } else if (playerThreat >= 100) {
        situationAnalysis.textContent = "玩家形成了活二，有潜在威胁";
    } else {
        situationAnalysis.textContent = "局势相对平稳，暂无重大威胁";
    }
    
    // 更新AI决策逻辑
    if (currentPlayer === AI) {
        aiDecisionEl.textContent = "AI正在评估最佳落子位置，考虑进攻和防守的平衡";
    } else {
        aiDecisionEl.textContent = "AI将评估您的落子并做出相应反应";
    }
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
    updateAnalysis();
    moveHistoryEl.textContent = `步数: ${moveHistory.length}`;
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

// 防止长按和拖动
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('dragstart', function(e) {
    e.preventDefault();
});

document.addEventListener('selectstart', function(e) {
    e.preventDefault();
});

// 初始化游戏
initGame();
