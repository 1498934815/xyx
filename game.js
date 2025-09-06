// 游戏核心模块
class SpaceShooter {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.livesElement = document.getElementById('lives');
        this.levelElement = document.getElementById('level');
        this.finalScoreElement = document.getElementById('finalScore');
        this.highScoreElement = document.getElementById('highScore');
        
        // 游戏状态
        this.gameState = 'MENU'; // MENU, PLAYING, GAME_OVER, SETTINGS
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = localStorage.getItem('highScore') || 0;
        this.gameRunning = false;
        
        // 游戏设置
        this.settings = {
            gyroControl: true,
            soundEnabled: true,
            sensitivity: 5
        };
        
        // 游戏对象
        this.player = null;
        this.bullets = [];
        this.enemies = [];
        this.explosions = [];
        this.particles = [];
        
        // 游戏控制
        this.keys = {
            left: false,
            right: false
        };
        
        // 音效
        this.sounds = {
            shoot: document.getElementById('shootSound'),
            explosion: document.getElementById('explosionSound'),
            gameOver: document.getElementById('gameOverSound')
        };
        
        // 初始化
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 初始化玩家
        this.player = new Player(
            this.canvas.width / 2 - 20,
            this.canvas.height - 100,
            40, 40, 
            this.settings.sensitivity,
            '#3498db'
        );
        
        // 设置事件监听
        this.setupEventListeners();
        
        // 加载设置
        this.loadSettings();
        
        // 开始游戏循环
        this.gameLoop();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // 如果游戏正在运行，调整玩家位置
        if (this.player) {
            this.player.y = this.canvas.height - 100;
            this.player.x = Math.min(this.player.x, this.canvas.width - this.player.width);
        }
    }
    
    setupEventListeners() {
        // 控制按钮
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const fireBtn = document.getElementById('fireBtn');
        
        // 触摸控制
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.left = true;
        });
        
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys.left = false;
        });
        
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.right = true;
        });
        
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys.right = false;
        });
        
        fireBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.fireBullet();
        });
        
        // 鼠标控制（用于测试）
        leftBtn.addEventListener('mousedown', () => this.keys.left = true);
        leftBtn.addEventListener('mouseup', () => this.keys.left = false);
        leftBtn.addEventListener('mouseleave', () => this.keys.left = false);
        
        rightBtn.addEventListener('mousedown', () => this.keys.right = true);
        rightBtn.addEventListener('mouseup', () => this.keys.right = false);
        rightBtn.addEventListener('mouseleave', () => this.keys.right = false);
        
        fireBtn.addEventListener('mousedown', () => this.fireBullet());
        
        // 键盘控制
        window.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft') this.keys.left = true;
            if (e.code === 'ArrowRight') this.keys.right = true;
            if (e.code === 'Space') this.fireBullet();
            if (e.code === 'Escape') this.togglePause();
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft') this.keys.left = false;
            if (e.code === 'ArrowRight') this.keys.right = false;
        });
        
        // 陀螺仪控制
        if (window.DeviceOrientationEvent && this.settings.gyroControl) {
            window.addEventListener('deviceorientation', (e) => {
                if (this.gameState === 'PLAYING' && e.gamma) {
                    const tilt = e.gamma / (30 - this.settings.sensitivity);
                    if (tilt < -0.2) {
                        this.keys.left = true;
                        this.keys.right = false;
                    } else if (tilt > 0.2) {
                        this.keys.right = true;
                        this.keys.left = false;
                    } else {
                        this.keys.left = false;
                        this.keys.right = false;
                    }
                }
            });
        }
        
        // 按钮事件
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('settingsButton').addEventListener('click', () => this.showSettings());
        document.getElementById('restartButton').addEventListener('click', () => this.startGame());
        document.getElementById('menuButton').addEventListener('click', () => this.showMenu());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettings').addEventListener('click', () => this.showMenu());
    }
    
    gameLoop() {
        // 根据游戏状态执行不同的逻辑
        switch(this.gameState) {
            case 'MENU':
                this.drawMenu();
                break;
            case 'PLAYING':
                this.updateGame();
                this.drawGame();
                break;
            case 'GAME_OVER':
                this.drawGameOver();
                break;
            case 'SETTINGS':
                // 设置界面不需要持续绘制
                break;
            case 'PAUSED':
                this.drawPause();
                break;
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    startGame() {
        this.gameState = 'PLAYING';
        this.gameRunning = true;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.bullets = [];
        this.enemies = [];
        this.explosions = [];
        this.particles = [];
        
        // 更新UI
        this.updateUI();
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
        
        // 重置玩家位置
        this.player.x = this.canvas.width / 2 - this.player.width / 2;
        this.player.y = this.canvas.height - 100;
        
        // 开始生成敌人
        this.enemySpawnInterval = setInterval(() => this.spawnEnemy(), 2000 - (this.level * 100));
        
        // 游戏难度递增
        this.difficultyInterval = setInterval(() => {
            this.level++;
            this.updateUI();
            clearInterval(this.enemySpawnInterval);
            this.enemySpawnInterval = setInterval(() => this.spawnEnemy(), Math.max(500, 2000 - (this.level * 100)));
        }, 30000);
    }
    
    updateGame() {
        if (!this.gameRunning) return;
        
        // 更新玩家
        this.player.update(this.keys);
        
        // 更新子弹
        this.updateBullets();
        
        // 更新敌人
        this.updateEnemies();
        
        // 更新爆炸效果
        this.updateExplosions();
        
        // 更新粒子效果
        this.updateParticles();
        
        // 检查碰撞
        this.checkCollisions();
    }
    
    drawGame() {
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制星空背景
        this.drawStars();
        
        // 绘制粒子效果
        this.drawParticles();
        
        // 绘制玩家
        this.player.draw(this.ctx);
        
        // 绘制子弹
        this.drawBullets();
        
        // 绘制敌人
        this.drawEnemies();
        
        // 绘制爆炸效果
        this.drawExplosions();
    }
    
    drawMenu() {
        // 菜单界面已经由HTML/CSS处理
    }
    
    drawGameOver() {
        // 游戏结束界面已经由HTML/CSS处理
    }
    
    drawPause() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('游戏暂停', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '20px Arial';
        this.ctx.fillText('按ESC继续游戏', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
    
    togglePause() {
        if (this.gameState === 'PLAYING') {
            this.gameState = 'PAUSED';
            this.gameRunning = false;
        } else if (this.gameState === 'PAUSED') {
            this.gameState = 'PLAYING';
            this.gameRunning = true;
        }
    }
    
    fireBullet() {
        if (!this.gameRunning || this.bullets.length > 5) return;
        
        if (this.settings.soundEnabled) {
            this.sounds.shoot.currentTime = 0;
            this.sounds.shoot.play();
        }
        
        this.bullets.push(new Bullet(
            this.player.x + this.player.width / 2 - 3,
            this.player.y,
            6, 15,
            10 + this.level,
            '#f1c40f'
        ));
    }
    
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update();
            
            // 移除超出屏幕的子弹
            if (this.bullets[i].y < 0) {
                this.bullets.splice(i, 1);
            }
        }
    }
    
    drawBullets() {
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
    }
    
    spawnEnemy() {
        if (!this.gameRunning) return;
        
        const size = 30 + Math.random() * 20;
        const type = Math.random() > 0.8 ? 'strong' : 'normal';
        
        this.enemies.push(new Enemy(
            Math.random() * (this.canvas.width - size),
            -size,
            size, size,
            1 + Math.random() * (1 + this.level * 0.2),
            type
        ));
    }
    
    updateEnemies() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.enemies[i].update();
            
            // 移除超出屏幕的敌人
            if (this.enemies[i].y > this.canvas.height) {
                this.enemies.splice(i, 1);
                this.lives--;
                this.updateUI();
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
            }
        }
    }
    
    drawEnemies() {
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
    }
    
    createExplosion(x, y, size) {
        this.explosions.push({
            x, y, size,
            frames: 15,
            currentFrame: 0
        });
        
        // 创建粒子效果
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x,
                y,
                size: Math.random() * 3 + 1,
                color: `hsl(${Math.random() * 60}, 100%, 50%)`,
                speedX: (Math.random() - 0.5) * 5,
                speedY: (Math.random() - 0.5) * 5,
                life: 30 + Math.random() * 20
            });
        }
        
        if (this.settings.soundEnabled) {
            this.sounds.explosion.currentTime = 0;
            this.sounds.explosion.play();
        }
    }
    
    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].currentFrame++;
            if (this.explosions[i].currentFrame >= this.explosions[i].frames) {
                this.explosions.splice(i, 1);
            }
        }
    }
    
    drawExplosions() {
        this.explosions.forEach(exp => {
            const progress = exp.currentFrame / exp.frames;
            const radius = exp.size * (1 - progress);
            const alpha = 1 - progress;
            
            this.ctx.fillStyle = `rgba(255, ${Math.floor(255 * (1 - progress))}, 0, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].x += this.particles[i].speedX;
            this.particles[i].y += this.particles[i].speedY;
            this.particles[i].life--;
            
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / 50;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
            this.ctx.globalAlpha = 1;
        });
    }
    
    drawStars() {
        this.ctx.fillStyle = 'white';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * this.canvas.width;
            const y = (Math.random() * this.canvas.height + (Date.now() * 0.05)) % this.canvas.height;
            const size = Math.random() * 2;
            this.ctx.fillRect(x, y, size, size);
        }
    }
    
    checkCollisions() {
        // 子弹与敌人碰撞
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                if (this.checkCollision(this.bullets[i], this.enemies[j])) {
                    // 敌人受伤或被消灭
                    if (this.enemies[j].takeDamage(1)) {
                        this.createExplosion(
                            this.enemies[j].x + this.enemies[j].width / 2,
                            this.enemies[j].y + this.enemies[j].height / 2,
                            this.enemies[j].width
                        );
                        this.enemies.splice(j, 1);
                    }
                    
                    // 移除子弹
                    this.bullets.splice(i, 1);
                    
                    // 增加分数
                    this.score += 10;
                    this.updateUI();
                    break;
                }
            }
        }
        
        // 玩家与敌人碰撞
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.checkCollision(this.player, this.enemies[i])) {
                this.createExplosion(
                    this.enemies[i].x + this.enemies[i].width / 2,
                    this.enemies[i].y + this.enemies[i].height / 2,
                    this.enemies[i].width
                );
                this.enemies.splice(i, 1);
                
                // 减少生命值
                this.lives--;
                this.updateUI();
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
                break;
            }
        }
    }
    
    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    updateUI() {
        this.scoreElement.textContent = this.score;
        this.livesElement.textContent = this.lives;
        this.levelElement.textContent = this.level;
    }
    
    gameOver() {
        this.gameState = 'GAME_OVER';
        this.gameRunning = false;
        
        clearInterval(this.enemySpawnInterval);
        clearInterval(this.difficultyInterval);
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }
        
        // 显示游戏结束画面
        this.finalScoreElement.textContent = this.score;
        this.highScoreElement.textContent = this.highScore;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        if (this.settings.soundEnabled) {
            this.sounds.gameOver.currentTime = 0;
            this.sounds.gameOver.play();
        }
    }
    
    showMenu() {
        this.gameState = 'MENU';
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
    }
    
    showSettings() {
        this.gameState = 'SETTINGS';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('settingsScreen').classList.remove('hidden');
        
        // 加载当前设置到表单
        document.getElementById('gyroControl').checked = this.settings.gyroControl;
        document.getElementById('soundToggle').checked = this.settings.soundEnabled;
        document.getElementById('sensitivity').value = this.settings.sensitivity;
    }
    
    saveSettings() {
        this.settings = {
            gyroControl: document.getElementById('gyroControl').checked,
            soundEnabled: document.getElementById('soundToggle').checked,
            sensitivity: parseInt(document.getElementById('sensitivity').value)
        };
        
        // 保存到localStorage
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        
        // 更新玩家速度
        this.player.speed = this.settings.sensitivity;
        
        this.showMenu();
    }
    
    loadSettings() {
        const savedSettings = localStorage.getItem('gameSettings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        }
    }
}

// 游戏对象类
class GameObject {
    constructor(x, y, width, height, speed, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
    }
    
    update() {}
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Player extends GameObject {
    constructor(x, y, width, height, speed, color) {
        super(x, y, width, height, speed, color);
    }
    
    update(keys) {
        if (keys.left && this.x > 0) {
            this.x -= this.speed;
        }
        if (keys.right && this.x < this.canvas.width - this.width) {
            this.x += this.speed;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        // 绘制飞船主体
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // 绘制飞船火焰
        if (this.keys.left || this.keys.right) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2 - 5, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2 + 5, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height + 10);
            ctx.closePath();
            ctx.fill();
        }
    }
}

class Bullet extends GameObject {
    constructor(x, y, width, height, speed, color) {
        super(x, y, width, height, speed, color);
    }
    
    update() {
        this.y -= this.speed;
    }
}

class Enemy extends GameObject {
    constructor(x, y, width, height, speed, type) {
        const color = type === 'strong' ? 
            `hsl(${Math.random() * 60 + 300}, 70%, 50%)` : 
            `hsl(${Math.random() * 60}, 70%, 50%)`;
        
        super(x, y, width, height, speed, color);
        this.type = type;
        this.health = type === 'strong' ? 3 : 1;
    }
    
    update() {
        this.y += this.speed;
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        
        if (this.type === 'strong') {
            // 强大敌人 - 方形
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // 绘制生命值条
            const healthWidth = this.width * (this.health / 3);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(this.x, this.y - 10, this.width, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x, this.y - 10, healthWidth, 5);
        } else {
            // 普通敌人 - 三角形
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + this.height);
            ctx.lineTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
}

// 启动游戏
window.addEventListener('load', () => {
    const game = new SpaceShooter();
});
