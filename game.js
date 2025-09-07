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
const lifeRegenTimer = document.getElementById('lifeRegenTimer');
const regenTimeElement = document.getElementById('regenTime');
const attackSpeedInfo = document.getElementById('attackSpeedInfo');
const fireRateElement = document.getElementById('fireRate');
const joystickModeToggle = document.getElementById('joystickModeToggle');
const autoFireToggle = document.getElementById('autoFireToggle');
const skillShield = document.getElementById('skillShield');
const skillRapid = document.getElementById('skillRapid');
const cooldownShield = document.getElementById('cooldownShield');
const cooldownRapid = document.getElementById('cooldownRapid');
const achievementNotification = document.getElementById('achievementNotification');
const achievementDesc = document.getElementById('achievementDesc');
const bossRedFlash = document.getElementById('bossRedFlash');
const multiBulletIndicator = document.getElementById('multiBulletIndicator');
const bulletLinesElement = document.getElementById('bulletLines');
const shieldActiveIndicator = document.getElementById('shieldActive');
const rapidActiveIndicator = document.getElementById('rapidActive');

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
let level = 1;
let nextLevelScore = 100;
let enemySpawnInterval;
let bossSpawnInterval;
let gameLoopId;
let fireInterval;
let isFiring = false;
let fireRate = 200;
let bossActive = false;
let boss = null;
let bossBullets = [];
let bossAttackInterval;
let gameTime = 0;
let timeToNextBoss = 90;
let bossTimerInterval;
let timeToLifeRegen = 60;
let lifeRegenTimerId;
let playerHitEffect = 0;
let particles = [];
let explosions = [];
let bulletLines = 1;
let achievements = {
    enemiesKilled: 0,
    survivalTime: 0,
    bossPerfectKill: false
};

// 技能系统
let skills = {
    shield: {
        active: false,
        cooldown: 0,
        duration: 0,
        maxCooldown: 450,
        hits: 0
    },
    rapid: {
        active: false,
        cooldown: 0,
        duration: 0,
        maxCooldown: 600,
        originalFireRate: 0
    }
};

// 玩家飞船
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 100,
    width: 40,
    height: 40,
    speed: 5,
    color: '#3498db',
    shield: false,
    invincible: false
};

// 轮盘控制
const joystick = {
    isActive: false,
    baseX: 0,
    baseY: 0,
    handleX: 0,
    handleY: 0,
    maxRadius: 40,
    direction: { x: 0, y: 0 },
    deadZone: 5,
    followMode: false
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
        baseScore: 500,
        specialAttack: function() {
            for (let i = -1; i <= 1; i++) {
                const dx = (player.x + player.width/2) - (this.x + this.width/2);
                const dy = (player.y + player.height/2) - (this.y + this.height/2);
                const angle = Math.atan2(dy, dx) + (i * 0.3);
                
                const speedX = Math.cos(angle) * this.bulletSpeed;
                const speedY = Math.sin(angle) * this.bulletSpeed;
                
                bossBullets.push({
                    x: this.x + this.width / 2 - 10,
                    y: this.y + this.height / 2 - 10,
                    width: 20,
                    height: 20,
                    speedX: speedX,
                    speedY: speedY,
                    color: '#e74c3c',
                    pulse: true
                });
            }
        }
    }
];

// 子弹数组
let bullets = [];

// 敌人数组
let enemies = [];

// 星星数组
let starsNear = [];
let starsMid = [];
let starsFar = [];

// 初始化星星背景
function initStars() {
    starsNear = [];
    starsMid = [];
    starsFar = [];
    
    for (let i = 0; i < 50; i++) {
        starsNear.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.8 + 0.5
        });
    }
    
    for (let i = 0; i < 70; i++) {
        starsMid.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.5 + 0.5,
            speed: Math.random() * 0.5 + 0.2
        });
    }
    
    for (let i = 0; i < 100; i++) {
        starsFar.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1 + 0.2,
            speed: Math.random() * 0.2 + 0.1
        });
    }
}

// 绘制星星背景
function drawStars() {
    // 远层星星
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    starsFar.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    
    // 中层星星
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    starsMid.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    
    // 近层星星
    ctx.fillStyle = 'white';
    starsNear.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
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
    level = 1;
    nextLevelScore = 100;
    fireRate = 200;
    bulletLines = 1;
    bullets = [];
    enemies = [];
    bossBullets = [];
    particles = [];
    explosions = [];
    achievements = {
        enemiesKilled: 0,
        survivalTime: 0,
        bossPerfectKill: false
    };
    
    // 重置技能
    skills = {
        shield: { active: false, cooldown: 0, duration: 0, maxCooldown: 450, hits: 0 },
        rapid: { active: false, cooldown: 0, duration: 0, maxCooldown: 600, originalFireRate: 0 }
    };
    
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
    multiBulletIndicator.style.display = 'block';
    fireRateElement.textContent = fireRate;
    bulletLinesElement.textContent = bulletLines;
    
    // 重置玩家位置
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    player.shield = false;
    player.invincible = false;
    playerHitEffect = 0;
    
    // 重置轮盘位置
    resetJoystick();
    
    // 初始化星星
    initStars();
    
    // 设置摇杆模式
    joystick.followMode = !joystickModeToggle.checked;
    
    // 设置自动射击
    if (autoFireToggle.checked) {
        startFiring();
    }
    
    // 定期生成敌人
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
    if (!gameRunning || lives >= 3) {
        lifeRegenTimer.style.display = 'none';
        return;
    }
    
    timeToLifeRegen--;
    regenTimeElement.textContent = timeToLifeRegen;
    
    if (timeToLifeRegen <= 0) {
        lives = Math.min(3, lives + 1);
        timeToLifeRegen = 60;
        updateUI();
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
    
    // 显示警告和红色闪烁效果
    bossWarning.style.display = 'block';
    bossRedFlash.style.display = 'block';
    
    setTimeout(() => {
        bossRedFlash.style.display = 'none';
    }, 3000);
    
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
        const healthMultiplier = 1 + (level * 0.1);
        const scoreMultiplier = 1 + (level * 0.2);
        
        boss = {
            ...bossType,
            x: canvas.width / 2 - bossType.width / 2,
            y: 50,
            currentHealth: Math.floor(bossType.baseHealth * healthMultiplier),
            health: Math.floor(bossType.baseHealth * healthMultiplier),
            score: Math.floor(bossType.baseScore * scoreMultiplier),
            minions: []
        };
        
        // 显示BOSS血条和名称
        bossHealthBar.style.display = 'block';
        bossName.style.display = 'block';
        bossName.textContent = boss.name;
        updateBossHealth();
        
        // 隐藏BOSS倒计时
        bossTimer.style.display = 'none';
        
        // BOSS开始攻击
        bossAttackInterval = setInterval(() => {
            bossAttack();
            if (boss.specialAttack) boss.specialAttack();
        }, boss.attackSpeed);
        
        bossActive = true;
        achievements.bossPerfectKill = true;
        
    }, 3000);
}

// BOSS攻击
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
        color: '#e74c3c',
        pulse: true
    });
}

// 更新BOSS血条显示
function updateBossHealth() {
    if (!boss) return;
    
    const healthPercent = (boss.currentHealth / boss.health) * 100;
    bossHealthFill.style.width = `${healthPercent}%`;
    
    // 血量低于30%时闪烁
    if (healthPercent < 30) {
        bossHealthFill.classList.add('low-health');
    } else {
        bossHealthFill.classList.remove('low-health');
    }
}

// 显示等级提升消息
function showLevelUp() {
    levelUpMessage.style.display = 'block';
    setTimeout(() => {
        levelUpMessage.style.display = 'none';
    }, 1500);
}

// 发射子弹
function fireBullet() {
    if (!gameRunning) return;
    
    // 根据弹道数量发射子弹
    for (let i = 0; i < bulletLines; i++) {
        // 计算子弹偏移（奇数弹道时中间一发，偶数弹道时对称分布）
        let offsetX = 0;
        if (bulletLines > 1) {
            const spacing = 10;
            const totalWidth = (bulletLines - 1) * spacing;
            offsetX = (i * spacing) - (totalWidth / 2);
        }
        
        bullets.push({
            x: player.x + player.width / 2 - 3 + offsetX,
            y: player.y,
            width: 6,
            height: 15,
            speed: 12,
            color: '#f1c40f'
        });
        
        // 添加射击粒子
        for (let j = 0; j < 3; j++) {
            particles.push({
                x: player.x + player.width / 2 + offsetX,
                y: player.y,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 3,
                speedY: -Math.random() * 4 - 2,
                color: '#f1c40f',
                life: 15
            });
        }
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

// 检查并处理升级
function checkLevelUp() {
    if (score >= nextLevelScore) {
        level++;
        
        // 调整升级节奏
        let multiplier = 1.5;
        if (level > 5 && level <= 10) multiplier = 1.4;
        if (level > 10) multiplier = 1.3;
        
        nextLevelScore = Math.floor(nextLevelScore * multiplier);
        
        // 提高攻击速度（每级减少20ms，最低100ms）
        fireRate = Math.max(100, fireRate - 20);
        fireRateElement.textContent = fireRate;
        
        // 每3级增加一条弹道，最多5条
        if (level % 3 === 0 && bulletLines < 5) {
            bulletLines++;
            bulletLinesElement.textContent = bulletLines;
            
            // 显示弹道升级提示
            const bulletUpMsg = document.createElement('div');
            bulletUpMsg.textContent = `弹道+1 (${bulletLines}条)`;
            bulletUpMsg.style.position = 'absolute';
            bulletUpMsg.style.top = '60%';
            bulletUpMsg.style.left = '50%';
            bulletUpMsg.style.transform = 'translate(-50%, -50%)';
            bulletUpMsg.style.color = '#f1c40f';
            bulletUpMsg.style.fontSize = '24px';
            bulletUpMsg.style.textShadow = '0 0 5px #000';
            bulletUpMsg.style.animation = 'fadeOut 2s forwards';
            bulletUpMsg.style.zIndex = '15';
            
            document.getElementById('gameContainer').appendChild(bulletUpMsg);
            
            setTimeout(() => {
                bulletUpMsg.remove();
            }, 2000);
        }
        
        // 如果正在射击，更新射击间隔
        if (isFiring) {
            clearInterval(fireInterval);
            fireInterval = setInterval(fireBullet, fireRate);
        }
        
        // 显示升级消息
        showLevelUp();
        
        // 更新UI
        updateUI();
    }
}

// 显示成就
function showAchievement(title, description) {
    achievementDesc.textContent = description;
    achievementNotification.style.display = 'block';
    
    setTimeout(() => {
        achievementNotification.style.display = 'none';
    }, 3000);
}

// 创建爆炸效果
function createExplosion(x, y, size, color) {
    explosions.push({
        x: x,
        y: y,
        size: size,
        color: color,
        life: 100
    });
    
    // 爆炸粒子
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 4 + 2,
            speedX: (Math.random() - 0.5) * 8,
            speedY: (Math.random() - 0.5) * 8,
            color: color,
            life: 30
        });
    }
}

// 游戏主循环
function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    // 更新游戏时间
    gameTime += 16;
    achievements.survivalTime = Math.floor(gameTime / 1000);
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制星空背景
    drawStars();
    
    // 更新和绘制爆炸效果
    updateExplosions();
    drawExplosions();
    
    // 更新和绘制粒子
    updateParticles();
    drawParticles();
    
    // 更新和绘制玩家（如果不在无敌状态或闪烁可见）
    if (!player.invincible || Math.floor(gameTime / 100) % 2 === 0) {
        updatePlayer();
        drawPlayer();
    }
    
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
        
        // 更新BOSS僚机
        if (boss.minions) {
            updateMinions();
            drawMinions();
        }
    }
    
    // 检查碰撞
    checkCollisions();
    
    // 检查升级
    checkLevelUp();
    
    // 更新技能
    updateSkills();
    
    // 检查成就
    checkAchievements();
    
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
        player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
    }
    
    // 玩家被击中效果
    if (playerHitEffect > 0) {
        playerHitEffect--;
    }
}

// 绘制玩家飞船
function drawPlayer() {
    if (player.invincible && Math.floor(gameTime / 100) % 2 === 0) {
        return; // 无敌状态时闪烁
    }
    
    // 绘制护盾
    if (skills.shield.active) {
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    // 玩家被击中效果
    if (playerHitEffect > 0) {
        ctx.fillStyle = `rgba(231, 76, 60, ${0.3 + (playerHitEffect/10)})`;
    } else {
        ctx.fillStyle = player.color;
    }
    
    // 绘制飞船主体
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // 绘制飞船尾焰
    if (joystick.isActive) {
        const flameLength = 15 + Math.abs(joystick.direction.y) * 10;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2 - 8, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2 + 8, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameLength);
        ctx.closePath();
        ctx.fill();
        
        // 添加火焰粒子
        if (Math.random() < 0.3) {
            particles.push({
                x: player.x + player.width / 2,
                y: player.y + player.height + flameLength,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 2,
                speedY: Math.random() * 3 + 2,
                color: `hsl(${Math.random() * 20 + 20}, 100%, 50%)`,
                life: 20
            });
        }
    }
}

// 更新子弹位置
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        
        // 移除超出屏幕的子弹
        if (bullets[i].y < -10) {
            bullets.splice(i, 1);
        }
    }
}

// 绘制子弹
function drawBullets() {
    bullets.forEach(bullet => {
        // 子弹光晕效果
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x + bullet.width/2, bullet.y + bullet.height/2, bullet.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 子弹主体
        ctx.fillStyle = 'white';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

// 生成敌人（根据等级调整属性）
function spawnEnemy() {
    if (!gameRunning || bossActive) return;
    
    const enemyType = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'fast' : 'split') : 'normal';
    let enemySize, enemySpeed, enemyHealth, enemyScore;
    
    // 根据等级计算敌人属性
    const speedMultiplier = 1 + (level * 0.1);
    const healthMultiplier = 1 + (level * 0.15);
    const scoreMultiplier = 1 + (level * 0.1);
    
    switch (enemyType) {
        case 'fast':
            enemySize = 20;
            enemySpeed = 3 * speedMultiplier;
            enemyHealth = 1;
            enemyScore = 25 * scoreMultiplier;
            break;
        case 'split':
            enemySize = 40;
            enemySpeed = 1.5 * speedMultiplier;
            enemyHealth = 2 * healthMultiplier;
            enemyScore = 20 * scoreMultiplier;
            break;
        default:
            enemySize = 30 + Math.random() * 20;
            enemySpeed = (1 + Math.random()) * speedMultiplier;
            enemyHealth = Math.max(1, Math.floor((level > 3 ? 2 : 1) * healthMultiplier));
            enemyScore = Math.floor(15 * scoreMultiplier);
    }
    
    enemies.push({
        x: Math.random() * (canvas.width - enemySize),
        y: -enemySize,
        width: enemySize,
        height: enemySize,
        speed: enemySpeed,
        color: `hsl(${Math.random() * 60}, 70%, 50%)`,
        maxHealth: enemyHealth,
        health: enemyHealth,
        score: Math.floor(enemyScore),
        type: enemyType
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
        
        // 根据敌人类型绘制不同形状
        switch(enemy.type) {
            case 'fast':
                // 高速敌人 - 三角形
                ctx.beginPath();
                ctx.moveTo(enemy.x + enemy.width/2, enemy.y);
                ctx.lineTo(enemy.x, enemy.y + enemy.height);
                ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
                ctx.closePath();
                ctx.fill();
                break;
            case 'split':
                // 分裂敌人 - 六边形
                ctx.beginPath();
                const centerX = enemy.x + enemy.width/2;
                const centerY = enemy.y + enemy.height/2;
                const radius = enemy.width/2;
                for (let i = 0; i < 6; i++) {
                    const angle = i * (Math.PI * 2 / 6);
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.fill();
                break;
            default:
                // 普通敌人 - 矩形
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
        
        // 绘制血条背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(enemy.x, enemy.y - 15, enemy.width, 6);
        
        // 绘制血条
        const healthPercent = (enemy.health / enemy.maxHealth) * 100;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(enemy.x, enemy.y - 15, enemy.width * (healthPercent / 100), 6);
        
        // 绘制血量百分比文字
        ctx.font = '10px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(healthPercent)}%`, enemy.x + enemy.width / 2, enemy.y - 17);
    });
}

// 更新BOSS僚机
function updateMinions() {
    for (let i = boss.minions.length - 1; i >= 0; i--) {
        const minion = boss.minions[i];
        
        // 僚机跟随BOSS移动
        minion.x = boss.x + (i * 50) - 25;
        minion.y = boss.y + boss.height;
        
        // 检查僚机是否被击中
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (isColliding(bullets[j], minion)) {
                minion.health--;
                bullets.splice(j, 1);
                
                // 僚机被摧毁
                if (minion.health <= 0) {
                    boss.minions.splice(i, 1);
                    createExplosion(minion.x + minion.width/2, minion.y + minion.height/2, 30, '#3498db');
                    score += 50;
                    updateUI();
                }
                break;
            }
        }
    }
}

// 绘制BOSS僚机
function drawMinions() {
    boss.minions.forEach(minion => {
        ctx.fillStyle = minion.color;
        ctx.beginPath();
        ctx.arc(minion.x + minion.width/2, minion.y + minion.height/2, minion.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制僚机血条
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(minion.x, minion.y - 10, minion.width, 4);
        
        ctx.fillStyle = '#3498db';
        ctx.fillRect(minion.x, minion.y - 10, minion.width * (minion.health / 10), 4);
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
    
    // 绘制BOSS伤害数字
    if (boss.damageTaken > 0) {
        const damagePopup = document.createElement('div');
        damagePopup.className = 'damage-popup';
        damagePopup.textContent = `-${boss.damageTaken}`;
        damagePopup.style.left = `${boss.x + boss.width/2}px`;
        damagePopup.style.top = `${boss.y - 20}px`;
        document.getElementById('gameContainer').appendChild(damagePopup);
        
        setTimeout(() => {
            damagePopup.remove();
        }, 1000);
        
        boss.damageTaken = 0;
    }
}

// 更新BOSS子弹位置
function updateBossBullets() {
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        const bullet = bossBullets[i];
        
        // 冲击波特殊处理
        if (bullet.shockwave) {
            bullet.duration--;
            if (bullet.duration <= 0) {
                bossBullets.splice(i, 1);
                
                // 检查玩家是否在冲击波范围内
                if (isColliding(player, bullet)) {
                    lives--;
                    updateUI();
                    playerHitEffect = 10;
                    
                    if (lives <= 0) {
                        gameOver();
                    }
                }
            }
            continue;
        }
        
        bullet.x += bullet.speedX;
        bullet.y += bullet.speedY;
        
        // 移除超出屏幕的子弹
        if (bullet.x < -20 || bullet.x > canvas.width + 20 ||
            bullet.y < -20 || bullet.y > canvas.height + 20) {
            bossBullets.splice(i, 1);
        }
    }
}

// 绘制BOSS子弹
function drawBossBullets() {
    bossBullets.forEach(bullet => {
        if (bullet.shockwave) {
            // 绘制冲击波警告
            ctx.fillStyle = bullet.color;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            return;
        }
        
        // 脉冲子弹特效
        if (bullet.pulse) {
            const pulseSize = 5 + Math.sin(Date.now() / 100) * 3;
            ctx.fillStyle = bullet.color;
            ctx.beginPath();
            ctx.arc(bullet.x + bullet.width/2, bullet.y + bullet.height/2, bullet.width/2 + pulseSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.fillStyle = 'white';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

// 更新爆炸效果
function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].life -= 2;
        if (explosions[i].life <= 0) {
            explosions.splice(i, 1);
        }
    }
}

// 绘制爆炸效果
function drawExplosions() {
    explosions.forEach(explosion => {
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, explosion.size
        );
        gradient.addColorStop(0, explosion.color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size * (explosion.life / 100), 0, Math.PI * 2);
        ctx.fill();
    });
}

// 更新粒子效果
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].speedX;
        particles[i].y += particles[i].speedY;
        particles[i].life--;
        
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// 绘制粒子效果
function drawParticles() {
    particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// 检查碰撞
function checkCollisions() {
    // 子弹与敌人碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        // 检查与普通敌人的碰撞
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(bullets[i], enemies[j])) {
                // 敌人受伤
                enemies[j].health--;
                
                // 显示伤害数字
                const damagePopup = document.createElement('div');
                damagePopup.className = 'damage-popup';
                damagePopup.textContent = '-1';
                damagePopup.style.left = `${enemies[j].x + enemies[j].width/2}px`;
                damagePopup.style.top = `${enemies[j].y - 10}px`;
                document.getElementById('gameContainer').appendChild(damagePopup);
                
                setTimeout(() => {
                    damagePopup.remove();
                }, 1000);
                
                if (enemies[j].health <= 0) {
                    // 增加分数
                    score += enemies[j].score;
                    achievements.enemiesKilled++;
                    
                    // 创建爆炸效果
                    createExplosion(
                        enemies[j].x + enemies[j].width/2, 
                        enemies[j].y + enemies[j].height/2, 
                        enemies[j].width, 
                        enemies[j].color
                    );
                    
                    // 分裂敌人特殊处理
                    if (enemies[j].type === 'split' && enemies[j].width > 20) {
                        // 分裂为两个小敌人
                        for (let k = 0; k < 2; k++) {
                            enemies.push({
                                x: enemies[j].x + (k * 20) - 10,
                                y: enemies[j].y,
                                width: enemies[j].width / 2,
                                height: enemies[j].height / 2,
                                speed: enemies[j].speed * 1.2,
                                color: enemies[j].color,
                                maxHealth: 1,
                                health: 1,
                                score: Math.floor(enemies[j].score * 0.7),
                                type: 'split'
                            });
                        }
                    }
                    
                    // 移除敌人
                    enemies.splice(j, 1);
                }
                
                // 移除子弹
                bullets.splice(i, 1);
                break;
            }
        }
        
        // 检查与BOSS的碰撞
        if (bossActive && boss && isColliding(bullets[i], boss)) {
            // BOSS受伤
            boss.currentHealth--;
            boss.damageTaken = (boss.damageTaken || 0) + 1;
            updateBossHealth();
            
            // 创建击中粒子
            for (let k = 0; k < 5; k++) {
                particles.push({
                    x: bullets[i].x + bullets[i].width/2,
                    y: bullets[i].y + bullets[i].height/2,
                    size: Math.random() * 3 + 1,
                    speedX: (Math.random() - 0.5) * 3,
                    speedY: (Math.random() - 0.5) * 3,
                    color: '#e74c3c',
                    life: 20
                });
            }
            
            // 移除子弹
            bullets.splice(i, 1);
            
            // 检查BOSS是否被击败
            if (boss.currentHealth <= 0) {
                // 增加分数
                score += boss.score;
                
                // 创建大型爆炸效果
                createExplosion(
                    boss.x + boss.width/2,
                    boss.y + boss.height/2,
                    100,
                    boss.color
                );
                
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
            
            // 如果护盾激活，消耗护盾
            if (skills.shield.active) {
                skills.shield.hits++;
                
                // 护盾被击中特效
                for (let j = 0; j < 10; j++) {
                    particles.push({
                        x: player.x + player.width/2,
                        y: player.y + player.height/2,
                        size: Math.random() * 3 + 2,
                        speedX: (Math.random() - 0.5) * 5,
                        speedY: (Math.random() - 0.5) * 5,
                        color: '#3498db',
                        life: 20
                    });
                }
                
                if (skills.shield.hits >= 3) {
                    skills.shield.active = false;
                    skills.shield.cooldown = skills.shield.maxCooldown;
                    player.shield = false;
                    shieldActiveIndicator.style.display = 'none';
                    
                    // 护盾破碎特效
                    createExplosion(
                        player.x + player.width/2,
                        player.y + player.height/2,
                        50,
                        '#3498db'
                    );
                }
            } else {
                // 减少生命值
                lives--;
                playerHitEffect = 10;
                
                // 玩家被击中特效
                createExplosion(
                    player.x + player.width/2,
                    player.y + player.height/2,
                    40,
                    '#e74c3c'
                );
                
                // 震动反馈（移动端）
                if ('vibrate' in navigator) {
                    navigator.vibrate(200);
                }
                
                updateUI();
                
                if (lives <= 0) {
                    gameOver();
                } else {
                    // 短暂无敌时间
                    player.invincible = true;
                    setTimeout(() => {
                        player.invincible = false;
                    }, 1000);
                }
            }
            break;
        }
    }
    
    // 玩家与BOSS子弹碰撞
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        if (isColliding(player, bossBullets[i])) {
            // 移除子弹
            bossBullets.splice(i, 1);
            
            // 如果护盾激活，消耗护盾
            if (skills.shield.active) {
                skills.shield.hits++;
                
                // 护盾被击中特效
                for (let j = 0; j < 10; j++) {
                    particles.push({
                        x: player.x + player.width/2,
                        y: player.y + player.height/2,
                        size: Math.random() * 3 + 2,
                        speedX: (Math.random() - 0.5) * 5,
                        speedY: (Math.random() - 0.5) * 5,
                        color: '#3498db',
                        life: 20
                    });
                }
                
                if (skills.shield.hits >= 3) {
                    skills.shield.active = false;
                    skills.shield.cooldown = skills.shield.maxCooldown;
                    player.shield = false;
                    shieldActiveIndicator.style.display = 'none';
                    
                    // 护盾破碎特效
                    createExplosion(
                        player.x + player.width/2,
                        player.y + player.height/2,
                        50,
                        '#3498db'
                    );
                }
            } else {
                // 减少生命值
                lives--;
                playerHitEffect = 10;
                
                // 玩家被击中特效
                createExplosion(
                    player.x + player.width/2,
                    player.y + player.height/2,
                    40,
                    '#e74c3c'
                );
                
                // 震动反馈（移动端）
                if ('vibrate' in navigator) {
                    navigator.vibrate(200);
                }
                
                updateUI();
                
                if (lives <= 0) {
                    gameOver();
                } else {
                    // 短暂无敌时间
                    player.invincible = true;
                    setTimeout(() => {
                        player.invincible = false;
                    }, 1000);
                }
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

// 更新技能状态
function updateSkills() {
    // 护盾技能
    if (skills.shield.active) {
        skills.shield.duration--;
        shieldActiveIndicator.style.display = 'block';
        
        if (skills.shield.duration <= 0 || skills.shield.hits >= 3) {
            skills.shield.active = false;
            skills.shield.cooldown = skills.shield.maxCooldown;
            player.shield = false;
            shieldActiveIndicator.style.display = 'none';
        }
    } else if (skills.shield.cooldown > 0) {
        skills.shield.cooldown--;
        cooldownShield.textContent = Math.ceil(skills.shield.cooldown / 60);
        cooldownShield.style.display = 'flex';
    } else {
        cooldownShield.style.display = 'none';
    }
    
    // 射速爆发技能
    if (skills.rapid.active) {
        skills.rapid.duration--;
        rapidActiveIndicator.style.display = 'block';
        
        if (skills.rapid.duration <= 0) {
            skills.rapid.active = false;
            skills.rapid.cooldown = skills.rapid.maxCooldown;
            fireRate = skills.rapid.originalFireRate;
            fireRateElement.textContent = fireRate;
            rapidActiveIndicator.style.display = 'none';
            
            // 更新射击间隔
            if (isFiring) {
                clearInterval(fireInterval);
                fireInterval = setInterval(fireBullet, fireRate);
            }
        }
    } else if (skills.rapid.cooldown > 0) {
        skills.rapid.cooldown--;
        cooldownRapid.textContent = Math.ceil(skills.rapid.cooldown / 60);
        cooldownRapid.style.display = 'flex';
    } else {
        cooldownRapid.style.display = 'none';
    }
}

// 检查成就
function checkAchievements() {
    // 击败100个敌人
    if (achievements.enemiesKilled >= 100) {
        showAchievement("百人斩", "击败100个敌人!");
        achievements.enemiesKilled = -999;
    }
    
    // 存活5分钟
    if (achievements.survivalTime >= 300) {
        showAchievement("生存专家", "存活5分钟!");
        achievements.survivalTime = -999;
    }
    
    // 完美击败BOSS
    if (bossActive === false && achievements.bossPerfectKill) {
        showAchievement("完美击杀", "无伤击败BOSS!");
        achievements.bossPerfectKill = false;
    }
}

// 更新UI显示
function updateUI() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    levelElement.textContent = level;
    nextLevelElement.textContent = nextLevelScore;
    fireRateElement.textContent = fireRate;
    bulletLinesElement.textContent = bulletLines;
    
    // 更新生命恢复计时器显示
    if (lives < 3) {
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
    if (bossSpawnInterval) clearTimeout(bossSpawnInterval);
    if (bossAttackInterval) clearInterval(bossAttackInterval);
    stopFiring();
    cancelAnimationFrame(gameLoopId);
    
    // 显示游戏结束画面
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'flex';
    
    // 最终爆炸效果
    createExplosion(
        player.x + player.width/2,
        player.y + player.height/2,
        80,
        '#e74c3c'
    );
    
    // 震动反馈（移动端）
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
    }
}

// 初始化触摸事件处理
function initTouchEvents() {
    const joystickArea = document.getElementById('joystickArea');
    const skillBar = document.getElementById('skillBar');
    
    // 触摸开始
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const joystickRect = joystickArea.getBoundingClientRect();
        const skillBarRect = skillBar.getBoundingClientRect();
        
        // 判断触摸区域
        if (touch.clientY < skillBarRect.top - 40) {
            // 摇杆区域
            if (touch.clientX < joystickRect.right + 100 && 
                touch.clientY < joystickRect.bottom + 100) {
                joystick.isActive = true;
                updateJoystickPosition(touch.clientX, touch.clientY);
            }
        } else {
            // 技能区域 - 直接处理技能点击
            handleSkillTouch(touch);
        }
    }, { passive: false });
    
    // 触摸移动
    document.addEventListener('touchmove', (e) => {
        if (!joystick.isActive) return;
        
        const touch = e.touches[0];
        const skillBarRect = skillBar.getBoundingClientRect();
        
        // 如果移动到技能区域，停止摇杆
        if (touch.clientY > skillBarRect.top - 30) {
            joystick.isActive = false;
            resetJoystick();
            return;
        }
        
        updateJoystickPosition(touch.clientX, touch.clientY);
    }, { passive: false });
    
    // 触摸结束
    document.addEventListener('touchend', () => {
        joystick.isActive = false;
        resetJoystick();
    });
}

// 处理技能区域的触摸
function handleSkillTouch(touch) {
    const shieldRect = skillShield.getBoundingClientRect();
    const rapidRect = skillRapid.getBoundingClientRect();
    
    // 检查是否点击护盾技能
    if (touch.clientX >= shieldRect.left && touch.clientX <= shieldRect.right &&
        touch.clientY >= shieldRect.top && touch.clientY <= shieldRect.bottom) {
        if (!skills.shield.active && skills.shield.cooldown <= 0) {
            activateShield();
        }
    }
    
    // 检查是否点击射速爆发技能
    if (touch.clientX >= rapidRect.left && touch.clientX <= rapidRect.right &&
        touch.clientY >= rapidRect.top && touch.clientY <= rapidRect.bottom) {
        if (!skills.rapid.active && skills.rapid.cooldown <= 0) {
            activateRapidFire();
        }
    }
}

// 激活护盾技能
function activateShield() {
    skills.shield.active = true;
    skills.shield.duration = 200; // 20秒持续时间
    skills.shield.hits = 0;
    player.shield = true;
    
    // 护盾激活特效
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: player.x + player.width/2,
            y: player.y + player.height/2,
            size: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            color: '#3498db',
            life: 30
        });
    }
}

// 激活射速爆发技能
function activateRapidFire() {
    skills.rapid.active = true;
    skills.rapid.duration = 120; // 12秒持续时间
    skills.rapid.originalFireRate = fireRate;
    fireRate = Math.max(50, fireRate / 3); // 射速提升66%
    fireRateElement.textContent = fireRate;
    
    // 射速爆发特效
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x + player.width/2,
            y: player.y,
            size: Math.random() * 2 + 1,
            speedX: (Math.random() - 0.5) * 3,
            speedY: -Math.random() * 8 - 4,
            color: '#f1c40f',
            life: 20
        });
    }
    
    // 更新射击间隔
    if (isFiring) {
        clearInterval(fireInterval);
        fireInterval = setInterval(fireBullet, fireRate);
    }
}

// 初始化事件监听
function initEventListeners() {
    initTouchEvents();
    
    // 鼠标事件（用于测试）
    const joystickArea = document.getElementById('joystickArea');
    joystickArea.addEventListener('mousedown', (e) => {
        joystick.isActive = true;
        updateJoystickPosition(e.clientX, e.clientY);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (joystick.isActive) {
            updateJoystickPosition(e.clientX, e.clientY);
        }
    });
    
    document.addEventListener('mouseup', () => {
        joystick.isActive = false;
        resetJoystick();
    });
    
    // 射击按钮
    fireButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!autoFireToggle.checked) {
            startFiring();
        }
    });
    
    fireButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!autoFireToggle.checked) {
            stopFiring();
        }
    });
    
    fireButton.addEventListener('mousedown', () => {
        if (!autoFireToggle.checked) {
            startFiring();
        }
    });
    
    fireButton.addEventListener('mouseup', () => {
        if (!autoFireToggle.checked) {
            stopFiring();
        }
    });
    
    // 开始游戏按钮
    startButton.addEventListener('click', initGame);
    restartButton.addEventListener('click', initGame);
    
    // 窗口大小变化时调整画布
    window.addEventListener('resize', () => {
        resizeCanvas();
        
        // 重新定位玩家（防止超出边界）
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
    });
    
    // 摇杆模式切换
    joystickModeToggle.addEventListener('change', () => {
        joystick.followMode = !joystickModeToggle.checked;
    });
    
    // 自动射击切换
    autoFireToggle.addEventListener('change', () => {
        if (!autoFireToggle.checked && isFiring) {
            stopFiring();
        } else if (autoFireToggle.checked && gameRunning) {
            startFiring();
        }
    });
}

// 初始化游戏
initEventListeners();
initStars();
