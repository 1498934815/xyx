// 获取DOM元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const fireBtn = document.getElementById('fireBtn');

// 设置画布大小
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 初始化时设置画布大小
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 游戏状态
let gameRunning = false;
let score = 0;
let lives = 3;
let enemySpawnInterval;

// 玩家飞船
const player = {
    x: canvas.width / 2,
    y: canvas.height - 100,
    width: 40,
    height: 40,
    speed: 2,
    color: '#3498db'
};

// 子弹数组
let bullets = [];

// 敌人数组
let enemies = [];

// 按键状态
const keys = {
    left: false,
    right: false
};

// 初始化游戏
function initGame() {
    score = 0;
    lives = 3;
    bullets = [];
    enemies = [];
    updateScore();
    gameRunning = true;
    startScreen.style.display = 'none';
    
    // 重置玩家位置
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    
    // 定期生成敌人
    enemySpawnInterval = setInterval(spawnEnemy, 1800);
    
    // 开始游戏循环
    gameLoop();
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制星空背景
    drawStars();
    
    // 更新和绘制玩家
    updatePlayer();
    drawPlayer();
    
    // 更新和绘制子弹
    updateBullets();
    drawBullets();
    
    // 更新和绘制敌人
    updateEnemies();
    drawEnemies();
    
    // 检查碰撞
    checkCollisions();
    
    // 继续循环
    requestAnimationFrame(gameLoop);
}

// 绘制星空背景
function drawStars() {
    ctx.fillStyle = 'white';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2;
        ctx.fillRect(x, y, size, size);
    }
}

// 更新玩家位置
function updatePlayer() {
    if (keys.left && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys.right && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// 绘制玩家飞船
function drawPlayer() {
    ctx.fillStyle = player.color;
    // 绘制飞船主体
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // 绘制飞船火焰
    if (keys.left || keys.right) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2 - 5, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + 10);
        ctx.closePath();
        ctx.fill();
    }
}

// 发射子弹
function fireBullet() {
    if (!gameRunning) return;
    
    bullets.push({
        x: player.x + player.width / 2 - 3,
        y: player.y,
        width: 6,
        height: 15,
        speed: 10,
        color: '#f1c40f'
    });
}

// 更新子弹位置
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        
        // 移除超出屏幕的子弹
        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
        }
    }
}

// 绘制子弹
function drawBullets() {
    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

// 生成敌人
function spawnEnemy() {
    if (!gameRunning) return;
    
    const enemySize = 30 + Math.random() * 20;
    
    enemies.push({
        x: Math.random() * (canvas.width - enemySize),
        y: -enemySize,
        width: enemySize,
        height: enemySize,
        speed: 1 + Math.random() * 2,
        color: `hsl(${Math.random() * 60 + 0}, 70%, 50%)`
    });
}

// 更新敌人位置
function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;
        
        // 移除超出屏幕的敌人
        if (enemies[i].y > canvas.height) {
            enemies.splice(i, 1);
            lives--;
            updateScore();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
}

// 绘制敌人
function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        // 绘制敌人飞船
        ctx.beginPath();
        ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
        ctx.lineTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x + enemy.width, enemy.y);
        ctx.closePath();
        ctx.fill();
    });
}

// 检查碰撞
function checkCollisions() {
    // 子弹与敌人碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(bullets[i], enemies[j])) {
                // 移除子弹和敌人
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                
                // 增加分数
                score += 10;
                updateScore();
                break;
            }
        }
    }
    
    // 玩家与敌人碰撞
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (isColliding(player, enemies[i])) {
            // 移除敌人
            enemies.splice(i, 1);
            
            // 减少生命值
            lives--;
            updateScore();
            
            if (lives <= 0) {
                gameOver();
            }
            break;
        }
    }
}

// 碰撞检测
function isColliding(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// 更新分数显示
function updateScore() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    clearInterval(enemySpawnInterval);
    
    // 显示游戏结束画面
    startScreen.style.display = 'flex';
    startScreen.innerHTML = `
        <h1>游戏结束</h1>
        <p>你的最终得分: ${score}</p>
        <button id="restartButton">再玩一次</button>
    `;
    
    document.getElementById('restartButton').addEventListener('click', initGame);
}

// 触摸控制事件
leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.left = true;
});

leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.left = false;
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.right = true;
});

rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.right = false;
});

fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fireBullet();
});

// 键盘控制（用于测试）
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space') fireBullet();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
});

// 鼠标控制（用于测试）
leftBtn.addEventListener('mousedown', () => keys.left = true);
leftBtn.addEventListener('mouseup', () => keys.left = false);
leftBtn.addEventListener('mouseleave', () => keys.left = false);

rightBtn.addEventListener('mousedown', () => keys.right = true);
rightBtn.addEventListener('mouseup', () => keys.right = false);
rightBtn.addEventListener('mouseleave', () => keys.right = false);

fireBtn.addEventListener('mousedown', fireBullet);

startButton.addEventListener('click', initGame);

// 初始绘制
drawStars();
