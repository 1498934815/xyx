// 游戏主控制器（整合所有模块，统一管理游戏流程）
const GameMain = {
    // 核心状态与元素
    canvas: null,
    ctx: null,
    gameLoopId: null,
    // 游戏内动态元素数组
    bullets: [],
    particles: [],
    // 计时器
    lifeRegenTimer: null,
    timeToLifeRegen: GameConfig.lifeRegen.interval / 1000, // 60秒

    // ------------------------------ 初始化游戏 ------------------------------
    /**
     * 初始化游戏（入口方法）
     */
    init() {
        // 1. 初始化画布
        this.initCanvas();
        // 2. 初始化全局状态
        this.resetGameState();
        // 3. 初始化各模块
        this.initModules();
        // 4. 绑定UI事件
        this.bindUIEvents();
        // 5. 初始绘制星空背景
        this.initStars();
        // 6. 显示开始页面
        uiManager.showStartScreen();
    },

    /**
     * 初始化画布与上下文
     */
    initCanvas() {
        this.canvas = Utils.getElement('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // 适配窗口大小
        Utils.resizeCanvas(this.canvas);
        window.addEventListener('resize', () => {
            Utils.resizeCanvas(this.canvas);
            this.initStars(); // 窗口变化时重新初始化星空
        });
    },

    /**
     * 重置游戏状态（开始/重新开始时调用）
     */
    resetGameState() {
        // 重置全局状态
        GameState.running = false;
        GameState.score = GameConfig.level.initScore;
        GameState.lives = GameConfig.player.initLives;
        GameState.level = GameConfig.level.initLevel;
        GameState.nextLevelScore = GameConfig.level.firstLevelNeed;
        GameState.fireRate = GameConfig.fire.initRate;
        GameState.bossKilledCount = 0;
        GameState.enemyKilledCount = 0;
        GameState.consecutiveKills = 0;
        GameState.skillUsedCount = 0;
        GameState.bossKilledWithoutDamage = 0;
        GameState.lastDamageTime = Date.now();
        GameState.gameTime = 0;
        // 重置本地状态
        this.bullets = [];
        this.particles = [];
        this.timeToLifeRegen = GameConfig.lifeRegen.interval / 1000;
        // 清除所有计时器
        this.clearAllTimers();
        // 触发游戏重置事件（通知各模块）
        document.dispatchEvent(new Event('gameReset'));
    },

    /**
     * 初始化所有功能模块
     */
    initModules() {
        // 初始化音效（需用户交互后调用，此处先初始化实例）
        soundManager.init();
        // 初始化玩家
        player.init();
        // 初始化敌人管理器
        enemyManager.init();
        // 初始化BOSS管理器
        bossManager.init();
        // 初始化成就管理器
        achievementManager.reset();
    },

    /**
     * 绑定UI交互事件（开始/重新开始/技能选择等）
     */
    bindUIEvents() {
        // 绑定页面切换事件（开始/重新开始）
        uiManager.bindScreenEvents(
            () => this.startGame(), // 开始游戏
            () => this.startGame()  // 重新开始
        );

        // 绑定技能按钮事件（激活技能）
        uiManager.bindSkillButtonEvent(() => {
            player.activateSkill();
        });

        // 绑定技能选择事件（从UI选择技能后触发）
        document.addEventListener('skillSelected', (e) => {
            player.selectSkill(e.detail.skillId);
            // 重启游戏循环
            this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
        });
    },

    /**
     * 初始化星空背景（分层移动）
     */
    initStars() {
        // 根据屏幕尺寸动态调整星星数量
        const starCount = Math.min(
            GameConfig.stars.maxCount,
            Math.floor((this.canvas.width * this.canvas.height) / 10000)
        );
        stars = [];
        for (let i = 0; i < starCount; i++) {
            const layer = Math.floor(Math.random() * 3) + 1; // 1-3层（近/中/远）
            stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Utils.getRandomFloat(GameConfig.stars.sizeRange[0], GameConfig.stars.sizeRange[1]) * layer,
                speed: Utils.getRandomFloat(GameConfig.stars.speedRange[0], GameConfig.stars.speedRange[1]) * layer,
                opacity: Utils.getRandomFloat(0.5, 1),
                layer: layer
            });
        }
    },

    // ------------------------------ 开始游戏 ------------------------------
    /**
     * 开始游戏（从开始页面进入游戏时调用）
     */
    startGame() {
        // 1. 重置游戏状态
        this.resetGameState();
        // 2. 隐藏所有页面
        uiManager.hideAllScreens();
        // 3. 标记游戏运行状态
        GameState.running = true;
        // 4. 初始化各模块
        this.initModules();
        // 5. 启动生命恢复计时器
        this.startLifeRegenTimer();
        // 6. 启动游戏主循环
        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    },

    /**
     * 启动生命恢复计时器（60秒恢复1条生命）
     */
    startLifeRegenTimer() {
        this.clearLifeRegenTimer();
        this.lifeRegenTimer = setInterval(() => {
            if (!GameState.running || GameState.lives >= GameConfig.lifeRegen.maxLives) {
                uiManager.setVisible('lifeRegenTimer', false);
                return;
            }

            this.timeToLifeRegen--;
            uiManager.updateLifeRegenTimer(this.timeToLifeRegen);

            // 时间到，恢复1条生命
            if (this.timeToLifeRegen <= 0) {
                GameState.lives = Math.min(GameConfig.lifeRegen.maxLives, GameState.lives + 1);
                this.timeToLifeRegen = GameConfig.lifeRegen.interval / 1000;
                // 显示生命恢复弹窗
                Utils.createTempPopup('生命值 +1', 'life');
                uiManager.updateGameInfo();
            }
        }, 1000);
    },

    // ------------------------------ 游戏主循环 ------------------------------
    /**
     * 游戏主循环（每帧调用，控制所有元素更新与绘制）
     */
    gameLoop() {
        if (!GameState.running) return;

        // 1. 更新游戏时间（约16ms/帧）
        GameState.gameTime += 16;

        // 2. 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 3. 绘制星空背景
        this.drawStars();

        // 4. 更新并绘制粒子效果
        this.updateParticles();
        this.drawParticles();

        // 5. 更新并绘制玩家
        player.updatePosition();
        player.draw(this.ctx);
        // 更新技能冷却
        player.updateSkillCooldown();

        // 6. 更新并绘制敌人
        enemyManager.update();
        enemyManager.draw(this.ctx);

        // 7. 更新并绘制BOSS
        if (GameState.bossActive) {
            bossManager.update();
            bossManager.draw(this.ctx);
        }

        // 8. 更新并绘制玩家子弹
        this.updateBullets();
        this.drawBullets();

        // 9. 检查所有碰撞
        this.checkAllCollisions();

        // 10. 检查等级提升
        this.checkLevelUp();

        // 11. 检查成就解锁
        achievementManager.syncGameData();
        achievementManager.checkAllAchievements();

        // 12. 继续循环
        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    },

    // ------------------------------ 元素更新与绘制 ------------------------------
    /**
     * 绘制星空背景
     */
    drawStars() {
        stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();

            // 分层移动（层数越高速度越快）
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });
    },

    /**
     * 更新玩家子弹位置
     */
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet.active) continue;

            // 1. 更新子弹位置（向上移动）
            bullet.y -= bullet.speed;

            // 2. 超出屏幕顶部，回收子弹
            if (bullet.y < -bullet.height) {
                objectPool.returnBullet(bullet);
                this.bullets.splice(i, 1);
            }
        }
    },

    /**
     * 绘制玩家子弹（含光晕效果）
     */
    drawBullets() {
        this.bullets.forEach(bullet => {
            if (!bullet.active) return;

            // 1. 绘制子弹光晕（渐变）
            Utils.drawGradientCircle(
                this.ctx,
                bullet.x + bullet.width / 2,
                bullet.y + bullet.height / 2,
                bullet.width * 2,
                bullet.color,
                'transparent'
            );

            // 2. 绘制子弹主体
            this.ctx.fillStyle = bullet.color;
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
    },

    /**
     * 更新粒子效果（下落+淡出）
     */
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            if (!particle.active) continue;

            // 1. 更新粒子位置（向下移动）
            particle.y += particle.speedY;
            // 2. 粒子淡出
            particle.opacity -= 0.01;

            // 3. 透明度为0，回收粒子
            if (particle.opacity <= 0) {
                objectPool.returnParticle(particle);
                this.particles.splice(i, 1);
            }
        }
    },

    /**
     * 绘制粒子效果
     */
    drawParticles() {
        this.particles.forEach(particle => {
            if (!particle.active) return;

            // 绘制半透明圆形粒子
            this.ctx.fillStyle = `${particle.color.replace(')', `, ${particle.opacity})`)}`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    },

    // ------------------------------ 碰撞检测 ------------------------------
    /**
     * 检查所有碰撞（子弹-敌人、子弹-BOSS、玩家-敌人、玩家-BOSS子弹）
     */
    checkAllCollisions() {
        // 1. 子弹与敌人/BOSS的碰撞（倒序遍历，避免删除元素错乱）
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet.active) continue;

            let isHit = false;

            // 优先检测BOSS碰撞
            if (GameState.bossActive) {
                isHit = bossManager.checkBulletCollision(bullet);
            }

            // 未击中BOSS，检测普通敌人碰撞
            if (!isHit) {
                const hitEnemy = enemyManager.checkBulletCollision(bullet);
                if (hitEnemy && !bullet.penetrate) {
                    // 非穿透子弹击中敌人后移除
                    this.bullets.splice(i, 1);
                }
            } else {
                // 击中BOSS，移除子弹
                this.bullets.splice(i, 1);
            }
        }

        // 2. 玩家与普通敌人的碰撞
        enemyManager.checkPlayerCollision();

        // 3. 玩家与BOSS子弹的碰撞
        if (GameState.bossActive) {
            bossManager.checkPlayerCollision();
        }
    },

    // ------------------------------ 等级提升 ------------------------------
    /**
     * 检查等级提升（分数达到目标则升级）
     */
    checkLevelUp() {
        if (GameState.score < GameState.nextLevelScore) return;

        // 1. 等级提升
        const prevLevel = GameState.level;
        GameState.level++;

        // 2. 计算下一级所需分数（不同等级段不同增幅）
        const ratio = GameState.level <= 5 
            ? GameConfig.level.levelUpRatio[1]
            : GameState.level <= 10 
                ? GameConfig.level.levelUpRatio[6]
                : GameConfig.level.levelUpRatio[11];
        GameState.nextLevelScore = Math.floor(GameState.nextLevelScore * ratio);

        // 3. 提升射击速度（通知玩家模块）
        document.dispatchEvent(new Event('levelUp'));

        // 4. 显示等级提升弹窗
        uiManager.showLevelUp();

        // 5. 每2级显示技能选择（1级除外）
        if (GameState.level % 2 === 0 && GameState.level > 1) {
            this.showSkillSelect();
        }

        // 6. 更新UI
        uiManager.updateGameInfo();
    },

    /**
     * 显示技能选择弹窗（暂停游戏循环）
     */
    showSkillSelect() {
        // 暂停游戏循环
        cancelAnimationFrame(this.gameLoopId);
        // 显示技能选择弹窗，传入选择回调
        uiManager.showSkillSelect((skillId) => {
            // 触发技能选择事件（通知玩家模块）
            document.dispatchEvent(new CustomEvent('skillSelected', {
                detail: { skillId: skillId }
            }));
        });
    },

    // ------------------------------ 游戏结束 ------------------------------
    /**
     * 游戏结束（玩家生命为0时调用）
     */
    gameOver() {
        // 1. 标记游戏停止状态
        GameState.running = false;

        // 2. 清除所有计时器和循环
        this.clearAllTimers();
        cancelAnimationFrame(this.gameLoopId);
        enemyManager.stopSpawning();
        if (GameState.bossActive) {
            bossManager.forceEndBossFight();
        }
        player.stopFiring();

        // 3. 回收所有对象到对象池
        this.recycleAllObjects();

        // 4. 显示游戏结束页面
        uiManager.showGameOverScreen();
    },

    /**
     * 回收所有活跃对象（子弹、敌人、粒子等）
     */
    recycleAllObjects() {
        // 回收玩家子弹
        this.bullets.forEach(bullet => objectPool.returnBullet(bullet));
        this.bullets = [];
        // 回收敌人
        enemyManager.clearEnemies();
        // 回收BOSS子弹
        bossManager.bossBullets.forEach(bullet => objectPool.returnBossBullet(bullet));
        bossManager.bossBullets = [];
        // 回收粒子
        this.particles.forEach(particle => objectPool.returnParticle(particle));
        this.particles = [];
        // 清空对象池（可选，释放内存）
        objectPool.clearAll();
    },

    // ------------------------------ 工具方法 ------------------------------
    /**
     * 添加粒子到游戏循环（外部模块调用，如敌人死亡）
     * @param {Array} particles - 要添加的粒子数组
     */
    addParticles(particles) {
        this.particles = [...this.particles, ...particles];
    },

    /**
     * 添加子弹到游戏循环（玩家射击时调用）
     * @param {Object} bullet - 要添加的子弹对象
     */
    addBullet(bullet) {
        if (bullet) this.bullets.push(bullet);
    },

    /**
     * 清除所有计时器
     */
    clearAllTimers() {
        this.clearLifeRegenTimer();
        if (enemyManager.spawnTimer) clearInterval(enemyManager.spawnTimer);
        if (bossManager.attackTimer) clearInterval(bossManager.attackTimer);
        if (bossManager.spawnTimer) clearTimeout(bossManager.spawnTimer);
        if (GameState.consecutiveKillTimer) clearTimeout(GameState.consecutiveKillTimer);
    },

    /**
     * 清除生命恢复计时器
     */
    clearLifeRegenTimer() {
        if (this.lifeRegenTimer) {
            clearInterval(this.lifeRegenTimer);
            this.lifeRegenTimer = null;
        }
    }
};

// 监听玩家射击事件（玩家发射子弹后添加到游戏循环）
document.addEventListener('playerFire', (e) => {
    const bullet = e.detail.bullet;
    if (bullet) GameMain.addBullet(bullet);
});

// 初始化玩家射击事件触发（修改Player模块的fireBullet方法，添加事件触发）
const originalFireBullet = player.fireBullet;
player.fireBullet = function() {
    const bullet = originalFireBullet.call(this);
    if (bullet) {
        document.dispatchEvent(new CustomEvent('playerFire', {
            detail: { bullet: bullet }
        }));
    }
    return bullet;
};

// 页面加载完成后初始化游戏
window.addEventListener('load', () => {
    GameMain.init();
});
