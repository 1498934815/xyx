// 敌人管理类（控制所有普通敌人行为）
class EnemyManager {
    constructor() {
        // 敌人群组（存储活跃敌人）
        this.enemies = [];
        // 敌人生成计时器（控制生成间隔）
        this.spawnTimer = null;
        // 缓存画布元素
        this.canvas = Utils.getElement('gameCanvas');
    }

    // ------------------------------ 初始化与重置 ------------------------------
    /**
     * 初始化敌人管理器（游戏开始/重新开始时调用）
     */
    init() {
        // 清空敌人群组并回收对象池
        this.clearEnemies();
        // 停止现有生成计时器
        if (this.spawnTimer) clearInterval(this.spawnTimer);
        // 开始生成敌人（基于配置间隔）
        this.startSpawning();
    }

    /**
     * 清空所有敌人（游戏结束/BOSS战开始时调用）
     */
    clearEnemies() {
        // 回收敌人到对象池
        this.enemies.forEach(enemy => {
            objectPool.returnEnemy(enemy);
        });
        // 清空数组
        this.enemies = [];
    }

    // ------------------------------ 敌人生成 ------------------------------
    /**
     * 开始定期生成敌人
     */
    startSpawning() {
        if (!GameState.running || this.spawnTimer) return;
        
        // 按配置间隔生成敌人
        this.spawnTimer = setInterval(() => {
            this.spawnEnemy();
        }, GameConfig.enemy.spawnInterval);
        // 立即生成第一个敌人
        this.spawnEnemy();
    }

    /**
     * 停止生成敌人（BOSS战开始时调用）
     */
    stopSpawning() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
    }

    /**
     * 生成单个敌人（随机类型）
     * @returns {Object} 生成的敌人对象
     */
    spawnEnemy() {
        if (!GameState.running || GameState.bossActive) return null;
        
        // 1. 随机选择敌人类型（普通60%、高速25%、分裂15%）
        const enemyType = this.#getRandomEnemyType();
        // 2. 从对象池获取敌人
        const enemy = objectPool.getEnemy(enemyType);
        // 3. 配置敌人属性（基于类型和等级）
        this.#configEnemyProps(enemy, enemyType);
        // 4. 添加到活跃敌人群组
        this.enemies.push(enemy);
        
        return enemy;
    }

    /**
     * 随机选择敌人类型（按概率分布）
     * @returns {string} 敌人类型（normal/fast/split）
     */
    #getRandomEnemyType() {
        const rand = Math.random();
        if (rand > 0.75) return 'fast';    // 25%概率高速敌人
        else if (rand > 0.6) return 'split';// 15%概率分裂敌人
        else return 'normal';              // 60%概率普通敌人
    }

    /**
     * 配置敌人属性（尺寸、速度、血量、分数等）
     * @param {Object} enemy - 敌人对象
     * @param {string} type - 敌人类型
     */
    #configEnemyProps(enemy, type) {
        const enemyConfig = GameConfig.enemy.types[type];
        const levelMulti = {
            speed: 1 + GameState.level * GameConfig.enemy.levelMultipliers.speed,
            health: 1 + GameState.level * GameConfig.enemy.levelMultipliers.health,
            score: 1 + GameState.level * GameConfig.enemy.levelMultipliers.score
        };

        // 1. 尺寸配置
        const size = Utils.getRandomInt(enemyConfig.sizeRange[0], enemyConfig.sizeRange[1]);
        enemy.width = size;
        enemy.height = size;

        // 2. 速度配置（不同类型不同逻辑）
        if (type === 'fast') {
            // 高速敌人：从屏幕两侧斜向生成
            enemy.speed = enemyConfig.speedMultiplier * levelMulti.speed;
            enemy.x = Math.random() > 0.5 ? -enemy.width : this.canvas.width;
            enemy.y = Utils.getRandomFloat(0, this.canvas.height / 2);
            // 计算斜向移动速度分量
            const targetX = enemy.x < 0 ? this.canvas.width + enemy.width : -enemy.width;
            const targetY = Utils.getRandomFloat(this.canvas.height / 4, this.canvas.height / 2);
            const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
            enemy.speedX = Math.cos(angle) * enemy.speed;
            enemy.speedY = Math.sin(angle) * enemy.speed;
        } else {
            // 普通/分裂敌人：从顶部随机位置生成
            enemy.speed = enemyConfig.speedMultiplier * levelMulti.speed;
            enemy.x = Utils.getRandomFloat(0, this.canvas.width - enemy.width);
            enemy.y = -enemy.height;
            enemy.speedX = 0;
            enemy.speedY = enemy.speed;
        }

        // 3. 血量配置
        enemy.maxHealth = type === 'fast' 
            ? enemyConfig.health // 高速敌人固定1血
            : Math.max(1, Math.floor(enemyConfig.healthMultiplier * levelMulti.health));
        enemy.health = enemy.maxHealth;

        // 4. 分数配置
        enemy.score = Math.floor(enemyConfig.scoreBase * levelMulti.score);

        // 5. 颜色配置（基于HSL色相范围）
        const hue = Utils.getRandomInt(enemyConfig.colorHueRange[0], enemyConfig.colorHueRange[1]);
        enemy.color = `hsl(${hue}, 70%, 50%)`;

        // 6. 分裂敌人特殊配置
        if (type === 'split') {
            enemy.splitCount = enemyConfig.splitCount;
        }

        // 7. 标记为活跃
        enemy.active = true;
    }

    // ------------------------------ 敌人行为更新 ------------------------------
    /**
     * 更新所有敌人位置和状态（每帧调用）
     */
    update() {
        if (!GameState.running) return;

        // 倒序遍历（删除元素时避免索引错乱）
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.active) continue;

            // 1. 更新敌人位置
            this.#updateEnemyPosition(enemy);

            // 2. 检查敌人是否超出屏幕（超出则删除并扣血）
            if (this.#isEnemyOutOfScreen(enemy)) {
                this.#handleEnemyEscape(enemy, i);
                continue;
            }

            // 3. 检查敌人是否死亡（血量≤0）
            if (enemy.health <= 0) {
                this.#handleEnemyDeath(enemy, i);
                continue;
            }
        }
    }

    /**
     * 更新单个敌人位置（不同类型不同移动逻辑）
     * @param {Object} enemy - 敌人对象
     */
    #updateEnemyPosition(enemy) {
        if (enemy.type === 'fast') {
            // 高速敌人：斜向移动（x/y轴均有速度）
            enemy.x += enemy.speedX;
            enemy.y += enemy.speedY;
        } else {
            // 普通/分裂敌人：垂直下落
            enemy.y += enemy.speedY;
        }
    }

    /**
     * 检查敌人是否超出屏幕
     * @param {Object} enemy - 敌人对象
     * @returns {boolean} 是否超出屏幕
     */
    #isEnemyOutOfScreen(enemy) {
        if (enemy.type === 'fast') {
            // 高速敌人：超出左右两侧或底部
            return enemy.x < -enemy.width * 2 || 
                   enemy.x > this.canvas.width + enemy.width * 2 || 
                   enemy.y > this.canvas.height;
        } else {
            // 普通/分裂敌人：超出底部
            return enemy.y > this.canvas.height;
        }
    }

    /**
     * 处理敌人逃脱屏幕（扣玩家生命值）
     * @param {Object} enemy - 敌人对象
     * @param {number} index - 敌人在数组中的索引
     */
    #handleEnemyEscape(enemy, index) {
        // 高速敌人逃脱不扣血（难度平衡）
        if (enemy.type !== 'fast') {
            // 玩家扣血
            const isDead = player.takeDamage();
            if (isDead) {
                GameMain.gameOver();
            }
        }
        // 回收敌人到对象池并删除
        objectPool.returnEnemy(enemy);
        this.enemies.splice(index, 1);
    }

    /**
     * 处理敌人死亡（生成粒子、加分、分裂等）
     * @param {Object} enemy - 敌人对象
     * @param {number} index - 敌人在数组中的索引
     */
    #handleEnemyDeath(enemy, index) {
        // 1. 累加分数
        GameState.score += enemy.score;
        // 2. 累加敌人击杀数（用于成就）
        GameState.enemyKilledCount++;
        // 3. 累加连续击杀数（10秒内有效）
        this.#updateConsecutiveKills();
        // 4. 播放敌人死亡音效
        soundManager.playEnemyDeath();
        // 5. 生成死亡粒子效果
        const particles = Utils.createParticles(
            enemy.x + enemy.width / 2,
            enemy.y + enemy.height / 2,
            GameConfig.particle.enemyDeathCount,
            enemy.color,
            'enemy'
        );
        // 将粒子添加到游戏主循环（需GameMain处理）
        GameMain.addParticles(particles);
        // 6. 处理分裂敌人（生成小敌人）
        if (enemy.type === 'split' && enemy.splitCount > 0) {
            this.#spawnSplitEnemies(enemy);
        }
        // 7. 回收敌人到对象池并删除
        objectPool.returnEnemy(enemy);
        this.enemies.splice(index, 1);
        // 8. 更新UI
        uiManager.updateGameInfo();
    }

    /**
     * 更新连续击杀计数（10秒内无击杀则重置）
     */
    #updateConsecutiveKills() {
        GameState.consecutiveKills++;
        // 重置连续击杀计时器
        if (GameState.consecutiveKillTimer) clearTimeout(GameState.consecutiveKillTimer);
        GameState.consecutiveKillTimer = setTimeout(() => {
            GameState.consecutiveKills = 0;
        }, 10000);
        // 连续击杀5个以上，额外加分（20%）
        if (GameState.consecutiveKills >= 5) {
            GameState.score += Math.floor(GameConfig.enemy.types.normal.scoreBase * 0.2);
        }
    }

    /**
     * 分裂敌人死亡时生成小敌人
     * @param {Object} parentEnemy - 父敌人（分裂前的敌人）
     */
    #spawnSplitEnemies(parentEnemy) {
        for (let i = 0; i < parentEnemy.splitCount; i++) {
            // 从对象池获取小敌人
            const smallEnemy = objectPool.getEnemy('split');
            // 配置小敌人属性（父敌人的1/2）
            smallEnemy.width = parentEnemy.width / 2;
            smallEnemy.height = parentEnemy.height / 2;
            smallEnemy.speed = parentEnemy.speed * 1.2; // 速度更快
            smallEnemy.color = parentEnemy.color;
            smallEnemy.maxHealth = 1;
            smallEnemy.health = 1;
            smallEnemy.score = Math.floor(parentEnemy.score / 2);
            smallEnemy.splitCount = 0; // 小敌人不再分裂
            // 位置：父敌人中心两侧
            smallEnemy.x = parentEnemy.x + (i * smallEnemy.width) - smallEnemy.width / 2;
            smallEnemy.y = parentEnemy.y + parentEnemy.height / 2;
            smallEnemy.speedX = 0;
            smallEnemy.speedY = smallEnemy.speed;
            smallEnemy.active = true;
            // 添加到活跃敌人群组
            this.enemies.push(smallEnemy);
        }
    }

    // ------------------------------ 敌人绘制 ------------------------------
    /**
     * 在画布上绘制所有活跃敌人（含血条、类型标记）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    draw(ctx) {
        if (!GameState.running) return;

        this.enemies.forEach(enemy => {
            if (!enemy.active) return;

            // 1. 绘制敌人主体（不同类型不同形状）
            this.#drawEnemyBody(ctx, enemy);

            // 2. 绘制敌人血条
            this.#drawEnemyHealthBar(ctx, enemy);

            // 3. 绘制分裂敌人标记
            if (enemy.type === 'split' && enemy.splitCount > 0) {
                this.#drawSplitMarker(ctx, enemy);
            }
        });
    }

    /**
     * 绘制敌人主体（三角形/菱形/六边形）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} enemy - 敌人对象
     */
    #drawEnemyBody(ctx, enemy) {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();

        switch (enemy.type) {
            case 'normal':
                // 普通敌人：倒三角形
                ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
                ctx.lineTo(enemy.x, enemy.y);
                ctx.lineTo(enemy.x + enemy.width, enemy.y);
                break;

            case 'fast':
                // 高速敌人：菱形
                ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
                ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height / 2);
                ctx.lineTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
                ctx.lineTo(enemy.x, enemy.y + enemy.height / 2);
                break;

            case 'split':
                // 分裂敌人：六边形
                ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
                ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height / 3);
                ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height * 2 / 3);
                ctx.lineTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
                ctx.lineTo(enemy.x, enemy.y + enemy.height * 2 / 3);
                ctx.lineTo(enemy.x, enemy.y + enemy.height / 3);
                break;
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * 绘制敌人血条（渐变背景+前景）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} enemy - 敌人对象
     */
    #drawEnemyHealthBar(ctx, enemy) {
        const healthPercent = (enemy.health / enemy.maxHealth) * 100;
        const barX = enemy.x;
        const barY = enemy.y - 15;
        const barWidth = enemy.width;
        const barHeight = 5;

        // 1. 血条背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 2. 血条前景（渐变）
        const healthGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        healthGradient.addColorStop(0, '#2ecc71');
        healthGradient.addColorStop(1, '#27ae60');
        ctx.fillStyle = healthGradient;
        ctx.fillRect(barX, barY, barWidth * (healthPercent / 100), barHeight);

        // 3. 血量百分比文字
        ctx.font = '10px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(healthPercent)}%`, barX + barWidth / 2, barY - 2);
    }

    /**
     * 绘制分裂敌人标记（文字提示）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} enemy - 敌人对象
     */
    #drawSplitMarker(ctx, enemy) {
        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('分裂', enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
    }

    // ------------------------------ 碰撞检测与伤害 ------------------------------
    /**
    
     * 检查子弹与敌人的碰撞（返回被击中的敌人）
     * @param {Object} bullet - 子弹对象
     * @returns {Object|null} 被击中的敌人（无则返回null）
     */
    checkBulletCollision(bullet) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.active || !Utils.isColliding(bullet, enemy)) continue;

            // 敌人受伤
            enemy.health--;
            // 显示伤害数字
            Utils.createDamagePopup(enemy.x + enemy.width / 2, enemy.y - 20, 1);

            // 非穿透子弹：击中后销毁
            if (!bullet.penetrate) {
                objectPool.returnBullet(bullet);
                return enemy;
            }
            // 穿透子弹：继续检测下一个敌人（但仅击中1次）
            return enemy;
        }
        return null;
    }

    /**
     * 检查玩家与敌人的碰撞
     * @returns {boolean} 是否发生碰撞（发生则返回true）
     */
    checkPlayerCollision() {
        const playerBox = player.getCollisionBox();
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.active || !Utils.isColliding(playerBox, enemy)) continue;

            // 敌人死亡（生成粒子+音效）
            soundManager.playEnemyDeath();
            const particles = Utils.createParticles(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                GameConfig.particle.enemyDeathCount,
                enemy.color
            );
            GameMain.addParticles(particles);
            // 回收敌人到对象池
            objectPool.returnEnemy(enemy);
            this.enemies.splice(i, 1);
            // 玩家受伤
            const isDead = player.takeDamage();
            if (isDead) {
                GameMain.gameOver();
            }
            return true;
        }
        return false;
    }

    // ------------------------------ 对外暴露方法 ------------------------------
    /**
     * 获取所有活跃敌人的碰撞盒（用于外部检测）
     * @returns {Array} 敌人碰撞盒数组
     */
    getEnemyCollisionBoxes() {
        return this.enemies.filter(enemy => enemy.active).map(enemy => ({
            x: enemy.x,
            y: enemy.y,
            width: enemy.width,
            height: enemy.height,
            active: enemy.active,
            type: enemy.type
        }));
    }

    /**
     * BOSS战开始时的敌人处理（清空普通敌人+停止生成）
     */
    onBossStart() {
        this.stopSpawning();
        this.clearEnemies();
    }

    /**
     * BOSS战结束时的敌人处理（恢复生成）
     */
    onBossEnd() {
        this.startSpawning();
    }
}

// 实例化敌人管理器（全局唯一）
const enemyManager = new EnemyManager();

// 绑定BOSS战状态事件（BOSS开始/结束时控制敌人生成）
document.addEventListener('bossStart', () => {
    enemyManager.onBossStart();
});

document.addEventListener('bossEnd', () => {
    enemyManager.onBossEnd();
});
