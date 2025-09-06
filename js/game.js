// 游戏变量
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const levelElement = document.getElementById('level');
const nextLevelElement = document.getElementById('nextLevel');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const joystickHandle = document.getElementById('joystickHandle');
const joystickBase = document.getElementById('joystickBase');
const fireButton = document.getElementById('fireButton');
const bossHealthBar = document.getElementById('bossHealthBar');
const bossHealthFill = document.getElementById('bossHealthFill');
const bossName = document.getElementById('bossName');
const bossWarning = document.getElementById('bossWarning');
const bossTimer = document.getElementById('bossTimer');
const bossTimeElement = document.getElementById('bossTime');
const levelUpMessage = document.getElementById('levelUp');
const powerUpMessage = document.getElementById('powerUp');
const healthUpEffect = document.getElementById('healthUpEffect');
const beamUpEffect = document.getElementById('beamUpEffect');
const lifeRegenTimer = document.getElementById('lifeRegenTimer');
const regenTimeElement = document.getElementById('regenTime');
const attackSpeedInfo = document.getElementById('attackSpeedInfo');
const fireRateElement = document.getElementById('fireRate');
const attackPowerInfo = document.getElementById('attackPowerInfo');
const attackPowerElement = document.getElementById('attackPower');
const maxHealthInfo = document.getElementById('maxHealthInfo');
const maxLivesElement = document.getElementById('maxLives');
const beamWidthInfo = document.getElementById('beamWidthInfo');
const beamWidthElement = document.getElementById('beamWidth');

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
let maxLives = 3;
let level = 1;
let nextLevelScore = 100;
let enemySpawnInterval;
let bossSpawnInterval;
let gameLoopId;
let fireInterval;
let isFiring = false;
let fireRate = 200; // 初始射击间隔200ms
let attackPower = 1; // 初始攻击力为1倍
const MAX_FIRE_RATE = 100; // 最大攻击速度(最小间隔)
let beamWidth = 1; // 弹道宽度(同时发射的子弹数量)
let bossActive = false;
let boss = null;
let bossBullets = [];
let bossAttackInterval;
let gameTime = 0;
let timeToNextBoss = 90;
let bossTimerInterval;
let lifeRegenInterval;
let timeToLifeRegen = 60;
let lifeRegenTimerId;
let powerups = []; // 道具数组
let powerupSpawnInterval;
let powerupSpawnTime = 15000; // 道具生成间隔(毫秒)

// 道具类型
const POWERUP_TYPES = {
    HEALTH: {
        name: '生命上限',
        class: 'powerup-health',
        effect: increaseMaxHealth
    },
    BEAM: {
        name: '弹道宽度',
        class: 'powerup-beam',
        effect: increaseBeamWidth
    }
};

// 玩家飞船
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 100,
    width: 40,
    height: 40,
    speed: 5,
    color: '#3498db'
};

// 轮盘控制
const joystick = {
    isActive: false,
    baseX: 0,
    baseY: 0,
    handleX: 0,
    handleY: 0,
    maxRadius: 40,
    direction: { x: 0, y: 0 }
};

// BOSS列表
const bosses = [
    {
        name: "毁灭者号",
        width: 150,
        height: 80,
        baseHealth: 50,
        color: '#e74c3c',
        attackSpeed: 1500,
        bulletSpeed: 4,
        baseScore: 500
    },
    {
        name: "死亡之翼",
        width: 180,
        height: 100,
        baseHealth: 70,
        color: '#9b59b6',
        attackSpeed: 1200,
        bulletSpeed: 5,
        baseScore: 700
    },
    {
        name: "末日战舰",
        width: 200,
        height: 120,
        baseHealth: 100,
        color: '#3498db',
        attackSpeed: 1000,
        bulletSpeed: 6,
        baseScore: 1000
    }
];

// 子弹数组
let bullets = [];

// 敌人数组
let enemies = [];

// 星星数组（背景）
let stars = [];

// 增加最大生命值
function increaseMaxHealth() {
    maxLives++;
    lives = Math.min(lives + 1, maxLives); // 同时恢复1点生命
    maxLivesElement.textContent = maxLives;
    livesElement.textContent = lives;
    healthUpEffect.style.display = 'block';
    setTimeout(() => {
        healthUpEffect.style.display = 'none';
    }, 1500);
}

// 增加弹道宽度
function increaseBeamWidth() {
    beamWidth = Math.min(5, beamWidth + 1); // 最大5道
    beamWidthElement.textContent = beamWidth;
    beamUpEffect.style.display = 'block';
    setTimeout(() => {
        beamUpEffect.style.display = 'none';
    }, 1500);
}

// 生成随机道具
function spawnPowerup() {
    if (!gameRunning || bossActive) return;
    
    // 随机选择道具类型
    const powerupTypes = Object.values(POWERUP_TYPES);
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    const powerup = {
        x: Math.random() * (canvas.width - 30),
        y: -30,
        width: 30,
        height: 30,
        type: type,
        speed: 2,
        element: document.createElement('div')
    };
    
    powerup.element.className = `powerup ${type.class}`;
    powerup.element.style.left = `${powerup.x}px`;
    powerup.element.style.top = `${powerup.y}px`;
    document.getElementById('gameContainer').appendChild(powerup.element);
    
    powerups.push(powerup);
}

// 更新道具位置
function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        powerup.y += powerup.speed;
        powerup.element.style.top = `${powerup.y}px`;
        
        // 移除超出屏幕的道具
        if (powerup.y > canvas.height) {
            powerup.element.remove();
            powerups.splice(i, 1);
        }
    }
}

// 绘制道具
function drawPowerups() {
    powerups.forEach(powerup => {
        ctx.fillStyle = powerup.type.class === 'powerup-health' ? '#e74c3c' : '#3498db';
        ctx.beginPath();
        ctx.arc(powerup.x + powerup.width/2, powerup.y + powerup.height/2, powerup.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制道具图标
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerup.type.name.includes('生命') ? '♥' : '⇉', 
                    powerup.x + powerup.width/2, 
                    powerup.y + powerup.height/2);
    });
}

// 检查道具碰撞
function checkPowerupCollisions() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        
        if (isColliding(player, powerup)) {
            // 触发道具效果
            powerup.type.effect();
            
            // 移除道具
            powerup.element.remove();
            powerups.splice(i, 1);
        }
    }
}

// 初始化星星背景
function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.5 + 0.2
        });
    }
}

// 绘制星星背景
function drawStars() {
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
        // 移动星星
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

// 初始化游戏
function initGame() {
    score = 0;
    lives = 3;
    maxLives = 3;
    level = 1;
    nextLevelScore = 100;
    fireRate = 200; // 重置射击间隔
    attackPower = 1; // 重置攻击力
    beamWidth = 1; // 重置弹道宽度
    bullets = [];
    enemies = [];
    bossBullets = [];
    powerups = [];
    gameTime = 0;
    timeToNextBoss = 90;
    timeToLifeRegen = 60;
    updateUI();
    gameRunning = true;
    bossActive = false;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    bossHealthBar.style.display = 'none';
    bossName.style.display = 'none';
    bossTimer.style.display = 'block';
    lifeRegenTimer.style.display = 'block';
    attackSpeedInfo.style.display = 'block';
    attackPowerInfo.style.display = 'block';
    maxHealthInfo.style.display = 'block';
    beamWidthInfo.style.display = 'block';
    fireRateElement.textContent = fireRate;
    attackPowerElement.textContent = attackPower.toFixed(1);
    maxLivesElement.textContent = maxLives;
    beamWidthElement.textContent = beamWidth;
    
    // 重置玩家位置
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    
    // 重置轮盘位置
    resetJoystick();
    
    // 初始化星星
    initStars();
    
    // 定期生成敌人（速度调慢）
    enemySpawnInterval = setInterval(spawnEnemy, 2000);
    
    // 更新BOSS倒计时
    updateBossTimer();
    bossTimerInterval = setInterval(updateBossTimer, 1000);
    
    // 每90秒生成BOSS
    bossSpawnInterval = setTimeout(() => {
        if (!bossActive) {
            spawnBoss();
        }
    }, timeToNextBoss * 1000);
    
    // 生命恢复计时器
    updateLifeRegenTimer();
    lifeRegenTimerId = setInterval(updateLifeRegenTimer, 1000);
    
    // 定期生成道具
    powerupSpawnInterval = setInterval(spawnPowerup, powerupSpawnTime);
    
    // 开始游戏循环
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 更新BOSS倒计时
function updateBossTimer() {
    if (!gameRunning || bossActive) return;
    
    timeToNextBoss--;
    bossTimeElement.textContent = timeToNextBoss;
    
    if (timeToNextBoss <= 0) {
        timeToNextBoss = 90;
    }
}

// 更新生命恢复计时器
function updateLifeRegenTimer() {
    if (!gameRunning || lives >= maxLives) {
        lifeRegenTimer.style.display = 'none';
        return;
    }
    
    timeToLifeRegen--;
    regenTimeElement.textContent = timeToLifeRegen;
    
    if (timeToLifeRegen <= 0) {
        lives = Math.min(maxLives, lives + 1);
        timeToLifeRegen = 60;
        updateUI();
        
        // 显示生命恢复提示
        showLifeRegen();
    }
}

// 显示生命恢复提示
function showLifeRegen() {
    const regenMsg = document.createElement('div');
    regenMsg.textContent = '生命值 +1';
    regenMsg.style.position = 'absolute';
    regenMsg.style.top = '50%';
    regenMsg.style.left = '50%';
    regenMsg.style.transform = 'translate(-50%, -50%)';
    regenMsg.style.color = '#2ecc71';
    regenMsg.style.fontSize = '24px';
    regenMsg.style.textShadow = '0 0 5px #000';
    regenMsg.style.animation = 'fadeOut 2s forwards';
    regenMsg.style.zIndex = '15';
    
    document.getElementById('gameContainer').appendChild(regenMsg);
    
    setTimeout(() => {
        regenMsg.remove();
    }, 2000);
}

// 重置轮盘位置
function resetJoystick() {
    joystickHandle.style.transform = 'translate(0px, 0px)';
    joystick.direction = { x: 0, y: 0 };
}

// 生成BOSS
function spawnBoss() {
    if (!gameRunning || bossActive) return;
    
    // 显示警告
    bossWarning.style.display = 'block';
    
    // 3秒后生成BOSS
    setTimeout(() => {
        bossWarning.style.display = 'none';
        
        // 停止生成普通敌人
        clearInterval(enemySpawnInterval);
        
        // 清除现有敌人
        enemies = [];
        
        // 随机选择一个BOSS
        const bossType = bosses[Math.floor(Math.random() * bosses.length)];
        
        // 根据等级计算BOSS属性
        const healthMultiplier = 1 + (level * 0.2); // 每级增加20%血量
        const scoreMultiplier = 1 + (level * 0.1); // 每级增加10%分数
        
        boss = {
            ...bossType,
            x: canvas.width / 2 - bossType.width / 2,
            y: 50,
            currentHealth: Math.floor(bossType.baseHealth * healthMultiplier),
            health: Math.floor(bossType.baseHealth * healthMultiplier),
            score: Math.floor(bossType.baseScore * scoreMultiplier)
        };
        
        // 显示BOSS血条和名称
        bossHealthBar.style.display = 'block';
        bossName.style.display = 'block';
        bossName.textContent = boss.name;
        updateBossHealth();
        
        // 隐藏BOSS倒计时
        bossTimer.style.display = 'none';
        
        // BOSS开始攻击
        bossAttackInterval = setInterval(() => bossAttack(), boss.attackSpeed);
        
        bossActive = true;
        
    }, 3000);
}

// BOSS攻击（向玩家发射子弹）
function bossAttack() {
    if (!boss || !gameRunning) return;
    
    // 计算BOSS到玩家的角度
    const dx = (player.x + player.width/2) - (boss.x + boss.width/2);
    const dy = (player.y + player.height/2) - (boss.y + boss.height/2);
    const angle = Math.atan2(dy, dx);
    
    // 计算子弹速度分量
    const speedX = Math.cos(angle) * boss.bulletSpeed;
    const speedY = Math.sin(angle) * boss.bulletSpeed;
    
    // 从BOSS中心发射子弹
    bossBullets.push({
        x: boss.x + boss.width / 2 - 10,
        y: boss.y + boss.height / 2 - 10,
        width: 20,
        height: 20,
        speedX: speedX,
        speedY: speedY,
        color: '#e74c3c'
    });
}

// 更新BOSS血条显示
function updateBossHealth() {
    if (!boss) return;
    
    const healthPercent = (boss.currentHealth / boss.health) * 100;
    bossHealthFill.style.width = `${healthPercent}%`;
}

// 显示等级提升消息
function showLevelUp() {
    levelUpMessage.style.display = 'block';
    setTimeout(() => {
        levelUpMessage.style.display = 'none';
    }, 1500);
}

// 显示攻击力提升消息
function showPowerUp() {
    powerUpMessage.style.display = 'block';
    setTimeout(() => {
        powerUpMessage.style.display = 'none';
    }, 1500);
}

// 检查并处理升级
function checkLevelUp() {
    if (score >= nextLevelScore) {
        level++;
        
        // 计算下一级需要的分数（每级增加50%）
        nextLevelScore = Math.floor(nextLevelScore * 1.5);
        
        // 如果攻击速度未达上限，继续提升攻击速度
        if (fireRate > MAX_FIRE_RATE) {
            fireRate = Math.max(MAX_FIRE_RATE, fireRate - 20);
            fireRateElement.textContent = fireRate;
            
            // 如果正在射击，更新射击间隔
            if (isFiring) {
                clearInterval(fireInterval);
                fireInterval = setInterval(fireBullet, fireRate);
            }
            
            showLevelUp();
        } 
        // 如果攻击速度已达上限，提升攻击力
        else {
            attackPower += 0.5; // 每次增加0.5倍攻击力
            attackPowerElement.textContent = attackPower.toFixed(1);
            showPowerUp();
        }
        
        // 更新UI
        updateUI();
    }
}

// 游戏主循环
function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    // 更新游戏时间
    gameTime += 16; // 大约16ms每帧
    
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
    
    // 更新和绘制BOSS
    if (bossActive) {
        drawBoss();
        updateBossBullets();
        drawBossBullets();
    }
    
    // 更新和绘制道具
    updatePowerups();
    drawPowerups();
    
    // 检查碰撞
    checkCollisions();
    
    // 检查道具碰撞
    checkPowerupCollisions();
    
    // 检查升级
    checkLevelUp();
    
    // 继续循环
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 更新玩家位置（基于轮盘输入）
function updatePlayer() {
    if (joystick.isActive) {
        player.x += joystick.direction.x * player.speed;
        player.y += joystick.direction.y * player.speed;
        
        // 边界检查
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        player.y = Math.max(0, Math.min(canheight - player.height, player.y));

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

// 绘制飞船火焰（移动时）
if (joystick.isActive) {
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
 
 // 根据弹道宽度决定发射多少颗子弹
for (let i = 0; i < beamWidth; i++) {
    // 计算子弹偏移量
    const offset = (i - (beamWidth - 1) / 2) * 15;
    
    // 根据攻击力决定子弹大小和颜色
    const bulletSize = 6 + (attackPower - 1) * 2;
    const bulletColor = attackPower > 1 ? 
        `hsl(${30 + (attackPower - 1) * 10}, 100%, 50%)` : '#f1c40f';
    
    bullets.push({
        x: player.x + player.width / 2 - bulletSize/2 + offset,
        y: player.y,
        width: bulletSize,
        height: 15 + (attackPower - 1) * 5,
        speed: 12,
        color: bulletColor,
        power: attackPower // 子弹威力
    });
}

}

// 开始连续射击

function startFiring() {

if (!isFiring) {

isFiring = true;

fireBullet(); // 立即发射第一颗子弹

fireInterval = setInterval(fireBullet, fireRate); // 根据当前射速发射

}

}

// 停止连续射击

function stopFiring() {

if (isFiring) {

isFiring = false;

clearInterval(fireInterval);

}

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

// 生成敌人（根据等级调整属性）

function spawnEnemy() {

if (!gameRunning || bossActive) return;
 const enemySize = 30 + Math.random() * 20;

// 根据等级计算敌人属性
const speedMultiplier = 1 + (level * 0.1); // 每级增加10%速度
const healthMultiplier = 1 + (level * 0.15); // 每级增加15%血量
const scoreMultiplier = 1 + (level * 0.05); // 每级增加5%分数

enemies.push({
    x: Math.random() * (canvas.width - enemySize),
    y: -enemySize,
    width: enemySize,
    height: enemySize,
    speed: (1 + Math.random()) * speedMultiplier,
    color: `hsl(${Math.random() * 60}, 70%, 50%)`,
    maxHealth: Math.max(1, Math.floor((level > 3 ? 2 : 1) * healthMultiplier)),
    health: Math.max(1, Math.floor((level > 3 ? 2 : 1) * healthMultiplier)),
    score: Math.floor(10 * scoreMultiplier)
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
    updateUI();
    
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

ctx.lineTo(en enemy.x, enemy.y);

ctx.lineTo(enemy.x + enemy.width, enemy.y);

ctx.closePath();

ctx.fill();
 // 绘制血条背景
ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
ctx.fillRect(enemy.x, enemy.y - 15, enemy.width, 5);

// 绘制血条
const healthPercent = (enemy.health / enemy.maxHealth) * 100;
ctx.fillStyle = '#2ecc71';
ctx.fillRect(enemy.x, enemy.y - 15, enemy.width * (healthPercent / 100), 5);

// 绘制血量百分比文字
ctx.font = '10px Arial';
ctx.fillStyle = 'white';
ctx.textAlign = 'center';
ctx.fillText(`${Math.round(healthPercent)}%`, enemy.x + enemy.width / 2, enemy.y - 17);
});
}

// 绘制BOSS

function drawBoss() {

if (!boss) return;
 ctx.fillStyle = boss.color;
// 绘制BOSS主体
ctx.beginPath();
ctx.moveTo(boss.x, boss.y + boss.height / 2);
ctx.lineTo(boss.x + boss.width / 2, boss.y);
ctx.lineTo(boss.x + boss.width, boss.y + boss.height / 2);
ctx.lineTo(boss.x + boss.width / 2, boss.y + boss.height);
ctx.closePath();
ctx.fill();

// 绘制BOSS炮口
ctx.fillStyle = '#000';
ctx.fillRect(boss.x + boss.width / 2 - 15, boss.y + boss.height / 2 - 5, 30, 10);
}

// 更新BOSS子弹位置

function updateBossBullets() {

for (let i = bossBullets.length - 1; i >= 0; i--) {

bossBullets[i].x += bossBullets[i].speedX;

bossBullets[i].y += bossBullets[i].speedY;
 // 移除超出屏幕的子弹
if (bossBullets[i].x < 0 || bossBullets[i].x > canvas.width ||
    bossBullets[i].y < 0 || bossBullets[i].y > canvas.height) {
    bossBullets.splice(i, 1);
}
}
}

// 绘制BOSS子弹

function drawBossBullets() {

bossBullets.forEach(bullet => {

ctx.fillStyle = bullet.color;

ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

});

}

// 检查碰撞

function checkCollisions() {

// 子弹与敌人碰撞

for (let i = bullets.length - 1; i >= 0; i--) {

// 检查与普通敌人的碰撞

for (let j = enemies.length - 1; j >= 0; j--) {

if (isColliding(bullets[i], enemies[j])) {

// 敌人受伤，伤害值取决于子弹威力

enemies[j].health -= bullets[i].power;
if (enemies[j].health <= 0) {
    // 增加分数
    score += enemies[j].score;
    // 移除敌人
    enemies.splice(j, 1);
}

// 移除子弹
bullets.splice(i, 1);
updateUI();
break;
}
}

// 检查与BOSS的碰撞
if (bossActive && boss && isColliding(bullets[i], boss)) {
// BOSS受伤，伤害值取决于子弹威力
boss.currentHealth -= bullets[i].power;
updateBossHealth();

// 移除子弹
bullets.splice(i, 1);

// 检查BOSS是否被击败
if (boss.currentHealth <= 0) {
// 增加分数
score += boss.score;

// 隐藏BOSS血条
bossHealthBar.style.display = 'none';
bossName.style.display = 'none';

// 停止BOSS攻击
clearInterval(bossAttackInterval);

// 清除BOSS子弹
bossBullets = [];

// 恢复生成普通敌人
enemySpawnInterval = setInterval(spawnEnemy, 2000);

// 重置BOSS倒计时
timeToNextBoss = 90;
bossTimer.style.display = 'block';
bossTimeElement.textContent = timeToNextBoss;

// 设置下一个BOSS
bossSpawnInterval = setTimeout(() => {
    if (!bossActive) {
        spawnBoss();
    }
}, timeToNextBoss * 1000);

bossActive = false;
boss = null;
}

updateUI();
break;
}
}

// 玩家与敌人碰撞
for (let i = enemies.length - 1; i >= 0; i--) {
if (isColliding(player, enemies[i])) {
// 移除敌人
enemies.splice(i, 1);

// 减少生命值
lives--;
updateUI();

if (lives <= 0) {
gameOver();
}
break;
}
}

// 玩家与BOSS子弹碰撞
for (let i = bossBullets.length - 1; i >= 0; i--) {
if (isColliding(player, bossBullets[i])) {
// 移除子弹
bossBullets.splice(i, 1);

// 减少生命值
lives--;
updateUI();

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

// 更新UI显示

function updateUI() {

scoreElement.textContent = score;

livesElement.textContent = lives;

levelElement.textContent = level;

nextLevelElement.textContent = nextLevelScore;

fireRateElement.textContent = fireRate;

attackPowerElement.textContent = attackPower.toFixed(1);

maxLivesElement.textContent = maxLives;

beamWidthElement.textContent = beamWidth;
 // 更新生命恢复计时器显示
if (lives < maxLives) {
    lifeRegenTimer.style.display = 'block';
} else {
    lifeRegenTimer.style.display = 'none';
}
}

// 游戏结束

function gameOver() {

gameRunning = false;

clearInterval(enemySpawnInterval);

clearInterval(bossTimerInterval);

clearInterval(lifeRegenTimerId);

clearInterval(powerupSpawnInterval);

if (bossSpawnInterval) clearTimeout(bossSpawnInterval);

if (bossAttackInterval) clearInterval(bossAttackInterval);

stopFiring();

cancelAnimationFrame(gameLoopId);
 // 移除所有道具元素
powerups.forEach(powerup => {
    if (powerup.element && powerup.element.parentNode) {
        powerup.element.remove();
    }
});
powerups = [];

// 显示游戏结束画面
finalScoreElement.textContent = score;
gameOverScreen.style.display = 'flex';
}

// 轮盘控制事件

function setupJoystick() {

const joystickArea = document.getElementById('joystickArea');

const baseRect = joystickBase.getBoundingClientRect();
 joystick.baseX = baseRect.left + baseRect.width / 2;
joystick.baseY = baseRect.top + baseRect.height / 2;

// 触摸事件
joystickArea.addEventListener('touchstart', handleTouchStart);
joystickArea.addEventListener('touchmove', handleTouchMove);
joystickArea.addEventListener('touchend', handleTouchEnd);

// 鼠标事件（用于测试）
joystickArea.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);
}

function handleTouchStart(e) {

e.preventDefault();

joystick.isActive = true;

updateJoystickPosition(e.touches[0].clientX, e.touches[0].clientY);

}

function handleTouchMove(e) {

e.preventDefault();

if (joystick.isActive) {

updateJoystickPosition(e.touches[0].clientX, e.touches[0].clientY);

}

}

function handleTouchEnd() {

joystick.isActive = false;

resetJoystick();

}

function handleMouseDown(e) {

joystick.isActive = true;

updateJoystickPosition(e.clientX, e.clientY);

}

function handleMouseMove(e) {

if (joystick.isActive) {

updateJoystickPosition(e.clientX, e.clientY);

}

}

function handleMouseUp() {

joystick.isActive = false;

resetJoystick();

}

function updateJoystickPosition(clientX, clientY) {

const dx = clientX - joystick.baseX;

const dy = clientY - joystick.baseY;

const distance = Math.sqrt(dx * dx + dy * dy);
 if (distance > joystick.maxRadius) {
    const angle = Math.atan2(dy, dx);
    const limitedX = Math.cos(angle) * joystick.maxRadius;
    const limitedY = Math.sin(angle) * joystick.maxRadius;
    
    joystickHandle.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
    joystick.direction.x = limitedX / joystick.maxRadius;
    joystick.direction.y = limitedY / joystick.maxRadius;
} else {
    joystickHandle.style.transform = `translate(${dx}px, ${dy}px)`;
    joystick.direction.x = dx / joystick.maxRadius;
    joystick.direction.y = dy / joystick.maxRadius;
}
}

// 射击按钮事件

function setupFireButton() {

// 触摸事件

fireButton.addEventListener('touchstart', (e) => {

e.preventDefault();

startFiring();

});
 fireButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopFiring();
});

fireButton.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    stopFiring();
});

// 鼠标事件
fireButton.addEventListener('mousedown', () => {
    startFiring();
});

fireButton.addEventListener('mouseup', () => {
    stopFiring();
});

fireButton.addEventListener('mouseleave', () => {
    stopFiring();
});
}

// 初始化事件监听

setupJoystick();

setupFireButton();

// 开始游戏按钮

startButton.addEventListener('click', initGame);

restartButton.addEventListener('click', initGame);

// 初始绘制

initStars();
 