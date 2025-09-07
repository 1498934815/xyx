// 游戏初始化
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const levelElement = document.getElementById('level');
const nextLevelElement = document.getElementById('nextLevel');
const bossTimerElement = document.getElementById('bossTimer');
const bossTimeElement = document.getElementById('bossTime');
const bossHealthBar = document.getElementById('bossHealthBar');
const bossHealthFill = document.getElementById('bossHealthFill');
const bossHealthText = document.getElementById('bossHealthText');
const bulletLinesElement = document.getElementById('bulletLines');
const fireRateElement = document.getElementById('fireRate');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const joystickHandle = document.getElementById('joystickHandle');
const joystickBase = document.getElementById('joystickBase');
const fireButton = document.getElementById('fireButton');
const skillShield = document.getElementById('skillShield');
const skillRapid = document.getElementById('skillRapid');
const cooldownShield = document.getElementById('cooldownShield');
const cooldownRapid = document.getElementById('cooldownRapid');
const bossWarning = document.getElementById('bossWarning');
const levelUpEffect = document.getElementById('levelUpEffect');
const damageEffect = document.getElementById('damageEffect');

// 设置画布大小
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 游戏状态
let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let nextLevelScore = 100;
let fireRate = 200;
let bulletLines = 1;
let bossActive = false;
let boss = null;
let bossHealth = 100;
let timeToNextBoss = 90;
let gameLoopId;
let enemySpawnInterval;
let bossSpawnInterval;
let bossAttackInterval;
let fireInterval;
let isFiring = false;
let joystickActive = false;
let joystickDirection = { x: 0, y: 0 };
let particles = [];
let explosions = [];
let bullets = [];
let enemies = [];
let bossBullets = [];

// 玩家飞船
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 100,
    width: 40,
    height: 40,
    speed: 5,
    color: '#3498db',
    invincible: false
};

// 摇杆控制
const joystick = {
    isActive: false,
    baseX: 0,
    baseY: 0,
    handleX: 0,
    handleY: 0,
    maxRadius: 40,
    direction: { x: 0, y: 0 },
    deadZone: 5
};

// 技能系统
const skills = {
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

// 初始化游戏
function initGame() {
    // 重置游戏状态
    score = 0;
    lives = 3;
    level = 1;
    nextLevelScore = 100;
    fireRate = 200;
    bulletLines = 1;
    bossActive = false;
    boss = null;
    bossHealth = 100;
    timeToNextBoss = 90;
    
    // 清空数组
    particles = [];
    explosions = [];
    bullets = [];
    enemies = [];
    bossBullets = [];
    
    // 重置技能
    skills.shield.active = false;
    skills.shield.cooldown = 0;
    skills.rapid.active = false;
    skills.rapid.cooldown = 0;
    
    // 重置玩家位置
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    player.invincible = false;
    
    // 更新UI
    updateUI();
    
    // 隐藏界面
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    bossHealthBar.style.display = 'none';
    
    // 开始游戏
    gameRunning = true;
    
    // 生成敌人
    enemySpawnInterval = setInterval(spawnEnemy, 2000);
    
    // BOSS倒计时
    updateBossTimer();
    bossTimerInterval = setInterval(updateBossTimer, 1000);
    
    // 90秒后生成BOSS
    bossSpawnInterval = setTimeout(() => {
        if (!bossActive) {
            spawnBoss();
        }
    }, timeToNextBoss * 1000);
    
    // 开始游戏循环
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 更新UI
function updateUI() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    levelElement.textContent = level;
    nextLevelElement.textContent = nextLevelScore;
    fireRateElement.textContent = fireRate;
    bulletLinesElement.textContent = bulletLines;
    bossTimeElement.textContent = timeToNextBoss;
}

// 生成敌人
function spawnEnemy() {
    if (!gameRunning || bossActive) return;
    
    const enemySize = 30 + Math.random() * 20;
    const enemySpeed = 1 + Math.random();
    const enemyHealth = level > 3 ? 2 : 1;
    const enemyScore = 15 + level * 5;
    
    enemies.push({
        x: Math.random() * (canvas.width - enemySize),
        y: -enemySize,
        width: enemySize,
        height: enemySize,
        speed: enemySpeed,
        color: `hsl(${Math.random() * 60}, 70%, 50%)`,
        health: enemyHealth,
        maxHealth: enemyHealth,
        score: enemyScore
    });
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
        
        // 创建BOSS
        boss = {
            x: canvas.width / 2 - 75,
            y: 50,
            width: 150,
            height: 80,
            color: '#e74c3c',
            health: 50 + level * 10,
            maxHealth: 50 + level * 10,
            score: 500 + level * 100,
            attackSpeed: 1500,
            bulletSpeed: 4
        };
        
        // 显示BOSS血条
        bossHealthBar.style.display = 'block';
        updateBossHealth();
        
        // 隐藏BOSS倒计时
        bossTimerElement.style.display = 'none';
        
        // BOSS开始攻击
        bossAttackInterval = setInterval(bossAttack, boss.attackSpeed);
        
        bossActive = true;
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

// 更新BOSS血条
function updateBossHealth() {
    if (!boss) return;
    
    const healthPercent = (boss.health / boss.maxHealth) * 100;
    bossHealthFill.style.width = `${healthPercent}%`;
    bossHealthText.textContent = `${Math.round(healthPercent)}%`;
    
    // 血量低于30%时闪烁
    if (healthPercent < 30) {
        bossHealthFill.classList.add('low-health');
    } else {
        bossHealthFill.classList.remove('low-health');
    }
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

// 激活护盾技能
function activateShield() {
    if (skills.shield.active || skills.shield.cooldown > 0) return;
    
    skills.shield.active = true;
    skills.shield.duration = 200; // 20秒持续时间
    skills.shield.hits = 0;
    
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
    if (skills.rapid.active || skills.rapid.cooldown > 0) return;
    
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

// 检查升级
function checkLevelUp() {
    if (score >= nextLevelScore) {
        level++;
        nextLevelScore = Math.floor(nextLevelScore * 1.5);
        
        // 提高攻击速度（每级减少20ms，最低100ms）
        fireRate = Math.max(100, fireRate - 20);
        fireRateElement.textContent = fireRate;
        
        // 每3级增加一条弹道，最多5条
        if (level % 3 === 0 && bulletLines < 5) {
            bulletLines++;
            bulletLinesElement.textContent = bulletLines;
        }
        
        // 显示升级消息
        showLevelUp();
        
        // 更新UI
        updateUI();
        
        // 如果正在射击，更新射击间隔
        if (isFiring) {
            clearInterval(fireInterval);
            fireInterval = setInterval(fireBullet, fireRate);
        }
    }
}

// 显示升级消息
function showLevelUp() {
    levelUpEffect.style.display = 'block';
    setTimeout(() => {
        levelUpEffect.style.display = 'none';
    }, 1500);
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 更新和绘制游戏对象
    updatePlayer();
    drawPlayer();
    updateBullets();
    drawBullets();
    updateEnemies();
    drawEnemies();
    
    if (bossActive) {
        updateBoss();
        drawBoss();
        updateBossBullets();
        drawBossBullets();
    }
    
    updateParticles();
    drawParticles();
    updateExplosions();
    drawExplosions();
    
    // 检查碰撞
    checkCollisions();
    
    // 检查升级
    checkLevelUp();
    
    // 更新技能
    updateSkills();
    
    // 继续循环
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 更新玩家位置
function updatePlayer() {
    if (joystick.isActive) {
        player.x += joystick.direction.x * player.speed;
        player.y += joystick.direction.y * player.speed;
        
        // 边界检查
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
    }
}

// 绘制玩家飞船
function drawPlayer() {
    // 绘制护盾
    if (skills.shield.active) {
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    // 绘制飞船主体
    ctx.fillStyle = player.color;
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
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // 绘制血条背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(enemy.x, enemy.y - 15, enemy.width, 6);
        
        // 绘制血条
        const healthPercent = (enemy.health / enemy.maxHealth) * 100;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(enemy.x, enemy.y - 15, enemy.width * (healthPercent / 100), 6);
    });
}

// 更新BOSS
function updateBoss() {
    if (!boss) return;
    
    // BOSS左右移动
    boss.x += Math.sin(Date.now() / 1000) * 2;
    boss.x = Math.max(0, Math.min(canvas.width - boss.width, boss.x));
}

// 绘制BOSS
function drawBoss() {
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

// 更新BOSS子弹
function updateBossBullets() {
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        bossBullets[i].x += bossBullets[i].speedX;
        bossBullets[i].y += bossBullets[i].speedY;
        
        // 移除超出屏幕的子弹
        if (bossBullets[i].x < -20 || bossBullets[i].x > canvas.width + 20 ||
            bossBullets[i].y < -20 || bossBullets[i].y > canvas.height + 20) {
            bossBullets.splice(i, 1);
        }
    }
}

// 绘制BOSS子弹
function drawBossBullets() {
    bossBullets.forEach(bullet => {
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

// 检查碰撞
function checkCollisions() {
    // 子弹与敌人碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(bullets[i], enemies[j])) {
                // 敌人受伤
                enemies[j].health--;
                
                if (enemies[j].health <= 0) {
                    // 增加分数
                    score += enemies[j].score;
                    
                    // 创建爆炸效果
                    createExplosion(
                        enemies[j].x + enemies[j].width/2, 
                        enemies[j].y + enemies[j].height/2, 
                        enemies[j].width, 
                        enemies[j].color
                    );
                    
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
            boss.health--;
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
            if (boss.health <= 0) {
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
                
                // 停止BOSS攻击
                clearInterval(bossAttackInterval);
                
                // 清除BOSS子弹
                bossBullets = [];
                
                // 恢复生成普通敌人
                enemySpawnInterval = setInterval(spawnEnemy, 2000);
                
                // 重置BOSS倒计时
                timeToNextBoss = 90;
                bossTimerElement.style.display = 'block';
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
                
                // 玩家被击中特效
                createExplosion(
                    player.x + player.width/2,
                    player.y + player.height/2,
                    40,
                    '#e74c3c'
                );
                
                // 显示伤害效果
                damageEffect.style.display = 'block';
                setTimeout(() => {
                    damageEffect.style.display = 'none';
                }, 300);
                
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
                
                // 玩家被击中特效
                createExplosion(
                    player.x + player.width/2,
                    player.y + player.height/2,
                    40,
                    '#e74c3c'
                );
                
                // 显示伤害效果
                damageEffect.style.display = 'block';
                setTimeout(() => {
                    damageEffect.style.display = 'none';
                }, 300);
                
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
        
        if (skills.shield.duration <= 0 || skills.shield.hits >= 3) {
            skills.shield.active = false;
            skills.shield.cooldown = skills.shield.maxCooldown;
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
        
        if (skills.rapid.duration <= 0) {
            skills.rapid.active = false;
            skills.rapid.cooldown = skills.rapid.maxCooldown;
            fireRate = skills.rapid.originalFireRate;
            fireRateElement.textContent = fireRate;
            
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

// 游戏结束
function gameOver() {
    gameRunning = false;
    clearInterval(enemySpawnInterval);
    clearInterval(bossTimerInterval);
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
}

// 摇杆控制事件
function setupJoystick() {
    const joystickArea = document.getElementById('joystickArea');
    
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
    const touch = e.touches[0];
    const rect = joystickArea.getBoundingClientRect();
    
    joystick.isActive = true;
    joystick.baseX = rect.left + rect.width / 2;
    joystick.baseY = rect.top + rect.height / 2;
    
    updateJoystickPosition(touch.clientX, touch.clientY);
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
    const rect = joystickArea.getBoundingClientRect();
    
    joystick.isActive = true;
    joystick.baseX = rect.left + rect.width / 2;
    joystick.baseY = rect.top + rect.height / 2;
    
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
    
    // 死区范围检查
    if (distance < joystick.deadZone) {
        joystickHandle.style.transform = 'translate(0px, 0px)';
        joystick.direction = { x: 0, y: 0 };
        return;
    }
    
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

function resetJoystick() {
    joystickHandle.style.transform = 'translate(0px, 0px)';
    joystick.direction = { x: 0, y: 0 };
}

// 射击按钮事件
function setupFireButton() {
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
}

// 技能按钮事件
function setupSkillButtons() {
    skillShield.addEventListener('touchstart', (e) => {
        e.preventDefault();
        activateShield();
    });
    
    skillShield.addEventListener('mousedown', () => {
        activateShield();
    });
    
    skillRapid.addEventListener('touchstart', (e) => {
        e.preventDefault();
        activateRapidFire();
    });
    
    skillRapid.addEventListener('mousedown', () => {
        activateRapidFire();
    });
}

// 初始化事件监听
function initEventListeners() {
    // 窗口大小变化
    window.addEventListener('resize', resizeCanvas);
    
    // 开始游戏按钮
    startButton.addEventListener('click', initGame);
    restartButton.addEventListener('click', initGame);
    
    // 设置控制
    setupJoystick();
    setupFireButton();
    setupSkillButtons();
}

// 初始化游戏
resizeCanvas();
initEventListeners();
initGame();
