// BOSS管理类（控制BOSS所有行为）
class BossManager {
    constructor() {
        // BOSS基础状态
        this.boss = null;
        // BOSS子弹数组（从对象池获取）
        this.bossBullets = [];
        // BOSS技能计时器
        this.skillTimer = 0;
        // BOSS攻击计时器
        this.attackTimer = null;
        // BOSS生成倒计时器
        this.spawnTimer = null;
        // 缓存画布元素
        this.canvas = Utils.getElement('gameCanvas');
        // 无伤击败BOSS标记（用于成就）
        this.isNoDamage = true;
    }

    // ------------------------------ 初始化与重置 ------------------------------
    /**
     * 初始化BOSS管理器（游戏开始/重新开始时调用）
     */
    init() {
        // 清空BOSS状态
        this.boss = null;
        this.bossBullets = [];
        this.skillTimer = 0;
        this.isNoDamage = true;
        // 停止现有计时器
        if (this.attackTimer) clearInterval(this.attackTimer);
        if (this.spawnTimer) clearTimeout(this.spawnTimer);
        // 隐藏BOSS UI
        uiManager.setVisible('bossHealthBar', false);
        uiManager.setVisible('bossName', false);
        uiManager.setVisible('bossWarning', false);
        // 开始BOSS生成倒计时
        this.startSpawnCountdown();
    }

    /**
     * 开始BOSS生成倒计时（90秒/次）
     */
    startSpawnCountdown() {
        let countdown = GameConfig.boss.spawnInterval / 1000; // 90秒
        uiManager.updateBossTimer(countdown);
        
        // 每秒更新倒计时
        const timer = setInterval(() => {
            if (!GameState.running || GameState.bossActive) {
                clearInterval(timer);
                return;
            }
            countdown--;
            uiManager.updateBossTimer(countdown);
            // 倒计时结束，生成BOSS
            if (countdown <= 0) {
                clearInterval(timer);
                this.spawnBoss();
            }
        }, 1000);
    }

    // ------------------------------ BOSS生成 ------------------------------
    /**
     * 生成BOSS（随机选择类型）
     */
    spawnBoss() {
        if (!GameState.running || GameState.bossActive) return;
        
        // 1. 触发BOSS警告（弹窗+音效）
        uiManager.showBossWarning();
        // 2. 3秒后生成BOSS主体
        setTimeout(() => {
            // 标记BOSS活跃状态
            GameState.bossActive = true;
            // 随机选择BOSS类型
            const bossType = GameConfig.boss.types[Math.floor(Math.random() * GameConfig.boss.types.length)];
            // 配置BOSS属性（基于等级）
            this.boss = this.#configBossProps(bossType);
            // 显示BOSS血条和名称
            uiManager.updateBossHealth(this.boss.currentHealth, this.boss.health);
            uiManager.setText('bossName', this.boss.name);
            // 开始BOSS攻击和技能
            this.startBossAttack();
            // 触发BOSS开始事件（清空普通敌人）
            document.dispatchEvent(new Event('bossStart'));
        }, GameConfig.boss.warningTime);
    }

    /**
     * 配置BOSS属性（基于类型和玩家等级）
     * @param {Object} bossType - BOSS类型配置
     * @returns {Object} 配置完成的BOSS对象
     */
    #configBossProps(bossType) {
        const levelMulti = {
            health: 1 + GameState.level * GameConfig.boss.levelMultipliers.health,
            score: 1 + GameState.level * GameConfig.boss.levelMultipliers.score
        };

        return {
            ...bossType,
            x: this.canvas.width / 2 - bossType.width / 2, // 居中顶部生成
            y: 50,
            currentHealth: Math.floor(bossType.baseHealth * levelMulti.health),
            health: Math.floor(bossType.baseHealth * levelMulti.health),
            score: Math.floor(bossType.baseScore * levelMulti.score),
            active: true,
            skillTimer: 0 // 技能冷却计时器
        };
    }

    // ------------------------------ BOSS攻击与技能 ------------------------------
    /**
     * 开始BOSS攻击（普通攻击+专属技能）
     */
    startBossAttack() {
        if (!this.boss || !GameState.running) return;
        
        // 按BOSS攻击间隔发射子弹
        this.attackTimer = setInterval(() => {
            if (!this.boss || !GameState.running) {
                clearInterval(this.attackTimer);
                return;
            }

            // 1. 普通攻击（向玩家发射子弹）
            this.#bossNormalAttack();
            // 2. 技能计时器累加（达到间隔触发专属技能）
            this.boss.skillTimer += this.boss.attackSpeed;
            if (this.boss.skillTimer >= this.boss.skill.interval) {
                this.#bossSpecialSkill();
                this.boss.skillTimer = 0;
            }
        }, this.boss.attackSpeed);
    }

    /**
     * BOSS普通攻击（向玩家位置发射子弹）
     */
    #bossNormalAttack() {
        const playerBox = player.getCollisionBox();
        // 计算BOSS到玩家的角度
        const dx = (playerBox.x + playerBox.width / 2) - (this.boss.x + this.boss.width / 2);
        const dy = (playerBox.y + playerBox.height / 2) - (this.boss.y + this.boss.height / 2);
        const angle = Math.atan2(dy, dx);
        // 计算子弹速度分量
        const speedX = Math.cos(angle) * this.boss.bulletSpeed;
        const speedY = Math.sin(angle) * this.boss.bulletSpeed;
        // 从对象池获取BOSS子弹
        const bullet = objectPool.getBossBullet();
        bullet.x = this.boss.x + this.boss.width / 2 - bullet.width / 2;
        bullet.y = this.boss.y + this.boss.height / 2 - bullet.height / 2;
        bullet.speedX = speedX;
        bullet.speedY = speedY;
        bullet.active = true;
        // 添加到BOSS子弹数组
        this.bossBullets.push(bullet);
    }

    /**
     * BOSS专属技能（根据类型执行不同逻辑）
     */
    #bossSpecialSkill() {
        switch (this.boss.skill.type) {
            case 'fanShot':
                // 扇形射击（多发子弹扩散）
                this.#bossFanShot();
                break;
            case 'summonMinions':
                // 召唤僚机（辅助攻击）
                this.#bossSummonMinions();
                break;
            case 'shockwave':
                // 全屏冲击波（中间安全区）
                this.#bossShockwave();
                break;
        }
    }

    /**
     * 毁灭者号专属技能：扇形射击
     */
    #bossFanShot() {
        const startAngle = this.boss.skill.angleRange[0];
        const endAngle = this.boss.skill.angleRange[1];
        const angleStep = this.boss.skill.angleStep;
        
        // 生成扇形子弹
        for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
            const bullet = objectPool.getBossBullet();
            bullet.x = this.boss.x + this.boss.width / 2 - bullet.width / 2;
            bullet.y = this.boss.y + this.boss.height / 2 - bullet.height / 2;
            bullet.speedX = Math.cos(angle) * this.boss.bulletSpeed;
            bullet.speedY = Math.sin(angle) * this.boss.bulletSpeed;
            bullet.active = true;
            this.bossBullets.push(bullet);
        }
    }

    /**
     * 死亡之翼专属技能：召唤僚机
     */
    #bossSummonMinions() {
        const minionCount = this.boss.skill.minionCount;
        for (let i = 0; i < minionCount; i++) {
            // 从对象池获取僚机（复用普通敌人对象）
            const minion = objectPool.getEnemy('minion');
            minion.x = this.boss.x + (i * 80) - 40; // BOSS两侧生成
            minion.y = this.boss.y + this.boss.height + 20;
            minion.width = 30;
            minion.height = 30;
            minion.speed = 2;
            minion.color = '#f39c12';
            minion.maxHealth = 2;
            minion.health = 2;
            minion.score = 50;
            minion.type = 'minion';
            minion.active = true;
            minion.speedY = minion.speed;
            // 添加到敌人群组
            enemyManager.enemies.push(minion);
        }
    }

    /**
     * 末日战舰专属技能：全屏冲击波
     */
    #bossShockwave() {
        // 创建冲击波视觉效果
        const shockwave = document.createElement('div');
        shockwave.className = 'boss-shockwave';
        shockwave.style.left = `${this.canvas.width / 2}px`;
        shockwave.style.top = `${this.canvas.height / 2}px`;
        shockwave.style.transform = 'translate(-50%, -50%)';
        Utils.getElement('gameContainer').appendChild(shockwave);
        
        // 1秒后检测玩家是否在安全区外
        setTimeout(() => {
            shockwave.remove();
            if (!this.boss || !GameState.running) return;
            
            const playerBox = player.getCollisionBox();
            const playerCenterX = playerBox.x + playerBox.width / 2;
            const playerCenterY = playerBox.y + playerBox.height / 2;
            // 计算玩家到屏幕中心的距离
            const distance = Math.sqrt(
                Math.pow(playerCenterX - this.canvas.width / 2, 2) + 
                Math.pow(playerCenterY - this.canvas.height / 2, 2)
            );
            
            // 安全区外且无护盾，玩家受伤
            if (distance > this.boss.skill.safeRadius) {
                this.isNoDamage = false; // 取消无伤标记
                const isDead = player.takeDamage();
                if (isDead) {
                    GameMain.gameOver();
                }
            }
        }, 1000);
    }

    // ------------------------------ BOSS状态更新 ------------------------------
    /**
     * 更新BOSS状态（位置、子弹、技能）
     */
    update() {
        if (!this.boss || !GameState.running) return;

        // 1. 更新BOSS子弹位置
        this.#updateBossBullets();
        // 2. BOSS缓慢左右移动（增加躲避难度）
        this.#updateBossPosition();
    }

    /**
     * 更新BOSS位置（左右往返移动）
     */
    #updateBossPosition() {
        const moveSpeed = 2;
        // 边界检测：到达左右边缘反向
        if (this.boss.x <= 0 || this.boss.x >= this.canvas.width - this.boss.width) {
            this.boss.moveDir = this.boss.moveDir === 'left' ? 'right' : 'left';
        }
        // 初始化移动方向
        if (!this.boss.moveDir) this.boss.moveDir = 'left';
        // 更新位置
        this.boss.x += this.boss.moveDir === 'left' ? -moveSpeed : moveSpeed;
    }

    /**
     * 更新BOSS子弹位置（超出屏幕则回收）
     */
    #updateBossBullets() {
        for (let i = this.bossBullets.length - 1; i >= 0; i--) {
            const bullet = this.bossBullets[i];
            if (!bullet.active) continue;

            // 更新子弹位置
            bullet.x += bullet.speedX;
            bullet.y += bullet.speedY;

            // 超出屏幕，回收子弹
            if (bullet.x < -bullet.width || bullet.x > this.canvas.width + bullet.width ||
                bullet.y < -bullet.height || bullet.y > this.canvas.height + bullet.height) {
                objectPool.returnBossBullet(bullet);
                this.bossBullets.splice(i, 1);
            }
        }
    }

    // ------------------------------ BOSS绘制 ------------------------------
    /**
     * 在画布上绘制BOSS（含主体、炮口特效）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    draw(ctx) {
        if (!this.boss || !GameState.running) return;

        // 1. 绘制BOSS主体（菱形）
        ctx.fillStyle = this.boss.color;
        ctx.beginPath();
        ctx.moveTo(this.boss.x, this.boss.y + this.boss.height / 2);
        ctx.lineTo(this.boss.x + this.boss.width / 2, this.boss.y);
        ctx.lineTo(this.boss.x + this.boss.width, this.boss.y + this.boss.height / 2);
        ctx.lineTo(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height);
        ctx.closePath();
        ctx.fill();

        // 2. 绘制BOSS炮口（发光特效）
        Utils.drawGradientCircle(
            ctx,
            this.boss.x + this.boss.width / 2,
            this.boss.y + this.boss.height / 2,
            20,
            'rgba(255, 0, 0, 0.8)',
            'rgba(255, 0, 0, 0)'
        );

        // 3. 绘制BOSS炮口主体
        ctx.fillStyle = '#000';
        ctx.fillRect(
            this.boss.x + this.boss.width / 2 - 15,
            this.boss.y + this.boss.height / 2 - 5,
            30,
            10
        );

        // 4. 绘制BOSS子弹
        this.#drawBossBullets(ctx);
    }

    /**
     * 绘制BOSS子弹（含脉冲特效）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    #drawBossBullets(ctx) {
        this.bossBullets.forEach(bullet => {
            if (!bullet.active) return;

            // 脉冲特效（随时间缩放）
            const time = Date.now() % 1000 / 1000;
            const scale = 1 + Math.sin(time * Math.PI * 2) * 0.2;

            ctx.save();
            ctx.translate(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(bullet.x + bullet.width / 2), -(bullet.y + bullet.height / 2));

            // 子弹光晕（渐变）
            Utils.drawGradientCircle(
                ctx,
                bullet.x + bullet.width / 2,
                bullet.y + bullet.height / 2,
                bullet.width * 1.5,
                bullet.color,
                'transparent'
            );

            // 子弹主体
            ctx.fillStyle = bullet.color;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            ctx.restore();
        });
    }

    // ------------------------------ 碰撞检测与伤害 ------------------------------
    /**
     * 检查子弹与BOSS的碰撞
     * @param {Object} bullet - 玩家子弹
     * @returns {boolean} 是否击中BOSS（击中则返回true）
     */
    checkBulletCollision(bullet) {
        if (!this.boss || !this.boss.active || !Utils.isColliding(bullet, this.boss)) {
            return false;
        }

        // BOSS受伤
        this.boss.currentHealth--;
        this.isNoDamage = false; // 被击中则取消无伤标记
        // 显示伤害数字
        Utils.createDamagePopup(this.boss.x + this.boss.width / 2, this.boss.y - 30, 1);
        // 更新BOSS血条
        uiManager.updateBossHealth(this.boss.currentHealth, this.boss.health);
        // 回收子弹到对象池
        objectPool.returnBullet(bullet);

        // 检查BOSS是否被击败
        if (this.boss.currentHealth <= 0) {
            this.#handleBossDeath();
        }
        return true;
    }

    /**
     * 检查玩家与BOSS子弹的碰撞
     * @returns {boolean} 是否发生碰撞（发生则返回true）
     */
    checkPlayerCollision() {
        const playerBox = player.getCollisionBox();
        for (let i = this.bossBullets.length - 1; i >= 0; i--) {
            const bullet = this.bossBullets[i];
            if (!bullet.active || !Utils.isColliding(playerBox, bullet)) continue;

            // 回收子弹到对象池
            objectPool.returnBossBullet(bullet);
            this.bossBullets.splice(i, 1);
            // 玩家受伤（取消无伤标记）
            this.isNoDamage = false;
            const isDead = player.takeDamage();
            if (isDead) {
                GameMain.gameOver();
            }
            return true;
        }
        return false;
    }

    // ------------------------------ BOSS死亡处理 ------------------------------
    /**
     * 处理BOSS死亡（生成特效、加分、掉落道具等）
     */
    #handleBossDeath() {
        // 1. 累加分数和BOSS击杀数
        GameState.score += this.boss.score;
        GameState.bossKilledCount++;
        // 2. 播放BOSS死亡音效
        soundManager.playBossDeath();
        // 3. 生成BOSS死亡粒子特效
        const particles = Utils.createParticles(
            this.boss.x + this.boss.width / 2,
            this.boss.y + this.boss.height / 2,
            GameConfig.particle.bossDeathCount,
            this.boss.color,
            'boss'
        );
        GameMain.addParticles(particles);
        // 4. 掉落临时增益道具（50%概率射速提升/50%概率生命恢复）
        this.#dropBossItem();
        // 5. 停止BOSS攻击
        clearInterval(this.attackTimer);
        // 6. 隐藏BOSS UI
        uiManager.setVisible('bossHealthBar', false);
        uiManager.setVisible('bossName', false);
        // 7. 重置BOSS状态
        this.boss = null;
        GameState.bossActive = false;
        // 8. 回收BOSS子弹
        this.bossBullets.forEach(bullet => objectPool.returnBossBullet(bullet));
        this.bossBullets = [];
        // 9. 触发BOSS结束事件（恢复普通敌人生成）
        document.dispatchEvent(new Event('bossEnd'));
        // 10. 触发BOSS击败事件（传递无伤标记，用于成就）
        document.dispatchEvent(new CustomEvent('bossKilled', {
            detail: { isNoDamage: this.isNoDamage }
        }));
        // 11. 重新开始BOSS生成倒计时
        setTimeout(() => {
            this.startSpawnCountdown();
        }, 1000);
        // 12. 更新UI
        uiManager.updateGameInfo();
    }

    /**
     * BOSS死亡后掉落道具
     */
    #dropBossItem() {
        const isSpeedItem = Math.random() > 0.5;
        if (isSpeedItem) {
            // 道具1：10秒射速提升（降低50%间隔）
            const originalRate = player.fireState.currentRate;
            player.fireState.currentRate = Math.max(50, originalRate / 2);
            GameState.fireRate = player.fireState.currentRate;
            // 更新射击间隔（如果正在射击）
            if (player.fireState.isFiring) {
                player.stopFiring();
                player.startFiring();
            }
            // 显示道具弹窗
            Utils.createTempPopup('获得: 10秒射速提升!', 'item');
            // 10秒后恢复原射速
            setTimeout(() => {
                player.fireState.currentRate = originalRate;
                GameState.fireRate = originalRate;
                if (player.fireState.isFiring) {
                    player.stopFiring();
                    player.startFiring();
                }
                uiManager.updateGameInfo();
            }, 10000);
        } else {
            // 道具2：立即恢复1条生命
            GameState.lives = Math.min(GameConfig.lifeRegen.maxLives, GameState.lives + 1);
            // 显示生命恢复弹窗
            Utils.createTempPopup('生命值 +1', 'life');
            // 更新UI
            uiManager.updateGameInfo();
        }
        // 播放道具获取音效
        soundManager.playItemPickup();
    }

    // ------------------------------ 对外暴露方法 ------------------------------
    /**
     * 获取BOSS碰撞盒（用于外部检测）
     * @returns {Object|null} BOSS碰撞盒（无BOSS则返回null）
     */
    getBossCollisionBox() {
        if (!this.boss || !this.boss.active) return null;
        return {
            x: this.boss.x,
            y: this.boss.y,
            width: this.boss.width,
            height: this.boss.height,
            active: this.boss.active
        };
    }

    /**
     * 强制结束BOSS战（游戏结束时调用）
     */
    forceEndBossFight() {
        if (this.boss) {
            this.boss.active = false;
            this.#handleBossDeath();
        }
    }
}

// 实例化BOSS管理器（全局唯一）
const bossManager = new BossManager();
