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
