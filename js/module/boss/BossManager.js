/**
 * BOSS管理器模块：负责BOSS的生命周期管理（生成、战斗、死亡），
 * 关联BOSS攻击系统、掉落系统，控制BOSS生成时机与战斗逻辑，同步游戏状态
 */
class BossManager {
    constructor() {
        // 基础依赖引用
        this.eventBus = window.EventBus; // 事件总线（发布BOSS相关事件）
        this.gameState = window.GameState; // 游戏状态（同步BOSS血量、生成状态）
        this.gameLoop = window.GameLoop; // 主循环（注册BOSS渲染/更新）
        this.objectPool = window.ObjectPool; // 对象池（复用BOSS实例，可选）
        this.gameMain = window.GameMain; // 游戏入口（获取资源、重置逻辑）

        // BOSS核心配置（从全局配置读取，无则用默认）
        const globalBossConfig = window.BossConfig || {};
        this.bossConfig = {
            // 生成配置
            spawn: {
                triggerScore: globalBossConfig.spawn?.triggerScore || 5000, // 触发生成的分数阈值
                minSpawnInterval: globalBossConfig.spawn?.minSpawnInterval || 60000, // 最小生成间隔（60秒）
                spawnPosition: { // BOSS生成位置（基于画布中心）
                    xOffset: 0,
                    yOffset: -100 // 从画布顶部外生成，避免突兀
                }
            },
            // BOSS类型配置（支持多类型BOSS，默认基础BOSS）
            bossTypes: globalBossConfig.bossTypes || [
                {
                    id: 'bossBasic', // BOSS唯一ID
                    name: '基础BOSS', // BOSS名称（用于UI显示）
                    baseAttr: {
                        maxHealth: 500, // 最大血量
                        width: 120, // 碰撞/渲染宽度
                        height: 150, // 碰撞/渲染高度
                        moveSpeed: 1.2, // 移动速度（像素/帧）
                        moveRange: { minX: 50, maxX: 750 } // 横向移动范围（基于画布宽度）
                    },
                    // 关联攻击系统配置（引用BossAttackSystem的默认配置）
                    attackConfig: globalBossConfig.bossTypes?.[0]?.attackConfig || {},
                    // 关联掉落系统配置（引用BossDropSystem的默认配置）
                    dropConfig: globalBossConfig.bossTypes?.[0]?.dropConfig || {}
                }
            ],
            // 视觉配置（资源、特效）
            visual: {
                imageKey: globalBossConfig.visual?.imageKey || 'bossBasic', // BOSS图片资源键
                deathEffectDuration: 1500, // 死亡动画时长（毫秒）
                hitFlashDuration: 200 // 受击闪烁时长（毫秒）
            }
        };

        // BOSS状态管理
        this.bossState = {
            currentBoss: null, // 当前活跃的BOSS实例（null=无BOSS）
            isSpawning: false, // 是否正在生成BOSS（避免重复生成）
            lastSpawnTime: 0, // 上次BOSS生成时间戳（毫秒）
            isBossDead: false, // 当前BOSS是否已死亡
            deathEffectEndTime: 0, // 死亡动画结束时间戳（毫秒）
            hitFlashEndTime: 0 // 受击闪烁结束时间戳（毫秒）
        };

        // 系统实例（攻击、掉落）
        this.bossAttackSystem = null; // BOSS攻击系统实例
        this.bossDropSystem = null; // BOSS掉落系统实例

        // 初始化：注册到主循环（更新BOSS逻辑+渲染）
        this.gameLoop.registerRenderObj('boss', this);
        // 订阅核心事件（分数变化、游戏重置/结束）
        this._subscribeEvents();
    }

    /**
     * 订阅核心事件：分数变化（触发BOSS生成）、BOSS受击/死亡、游戏重置/结束
     */
    _subscribeEvents() {
        // 1. 玩家分数变化事件：检测是否达到BOSS生成阈值
        this.eventBus.on(window.GameEvents.PLAYER_SCORE_CHANGE, () => {
            this._checkSpawnCondition();
        });

        // 2. BOSS受击事件：同步BOSS血量到游戏状态，触发受击闪烁
        this.eventBus.on(window.GameEvents.BOSS_HIT, (damage) => {
            if (!this.bossState.currentBoss) return;
            
            // 扣除BOSS血量（不低于0）
            this.bossState.currentBoss.health = Math.max(0, this.bossState.currentBoss.health - damage);
            // 同步血量到游戏状态
            this.gameState.updateBattleState({
                bossHealth: this.bossState.currentBoss.health,
                bossMaxHealth: this.bossState.currentBoss.maxHealth
            });
            // 触发受击闪烁
            this.bossState.hitFlashEndTime = Date.now() + this.bossConfig.visual.hitFlashDuration;

            // 检测BOSS是否死亡
            if (this.bossState.currentBoss.health <= 0 && !this.bossState.isBossDead) {
                this._handleBossDeath();
            }
        });

        // 3. 游戏重置事件：清理当前BOSS，重置管理器状态
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._clearCurrentBoss();
            this._resetManagerState();
        });

        // 4. 游戏结束事件：清理当前BOSS
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._clearCurrentBoss();
        });
    }

    /**
     * 检查BOSS生成条件：达到分数阈值+超过最小生成间隔+当前无BOSS
     */
    _checkSpawnCondition() {
        const now = Date.now();
        const playerState = this.gameState.getFullState().player;
        const battleState = this.gameState.getFullState().battle;
        const { spawn } = this.bossConfig;

        // 生成条件：当前无BOSS+分数达标+超过最小间隔+不在生成中
        const canSpawn = !battleState.bossSpawned && 
                         playerState.score >= spawn.triggerScore && 
                         now - this.bossState.lastSpawnTime >= spawn.minSpawnInterval && 
                         !this.bossState.isSpawning;

        if (canSpawn) {
            this._spawnBoss(); // 满足条件，生成BOSS
        }
    }

    /**
     * 生成BOSS：创建BOSS实例，初始化攻击/掉落系统，同步游戏状态
     * @param {string} [bossTypeId='bossBasic'] - 要生成的BOSS类型ID
     */
    _spawnBoss(bossTypeId = 'bossBasic') {
        this.bossState.isSpawning = true;
        const now = Date.now();
        const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;
        const bossType = this.bossConfig.bossTypes.find(type => type.id === bossTypeId);

        // 校验BOSS类型是否存在
        if (!bossType) {
            console.error(`[BossManager Error] 无效的BOSS类型：${bossTypeId}`);
            this.bossState.isSpawning = false;
            return;
        }

        // 1. 创建BOSS实例（从对象池获取或新建）
        let bossInstance = this.objectPool.getObject('boss', {
            id: bossType.id,
            name: bossType.name,
            // 基础属性
            maxHealth: bossType.baseAttr.maxHealth,
            health: bossType.baseAttr.maxHealth,
            width: bossType.baseAttr.width,
            height: bossType.baseAttr.height,
            moveSpeed: bossType.baseAttr.moveSpeed,
            moveRange: bossType.baseAttr.moveRange,
            // 生成位置（画布中心+偏移）
            x: canvasWidth / 2 + this.bossConfig.spawn.spawnPosition.xOffset - bossType.baseAttr.width / 2,
            y: this.bossConfig.spawn.spawnPosition.yOffset,
            // 关联配置
            attackConfig: bossType.attackConfig,
            dropConfig: bossType.dropConfig,
            // 资源（从GameMain获取BOSS图片）
            image: this.gameMain.getLoadedResource('images', this.bossConfig.visual.imageKey)
        });

        // 若对象池无闲置实例，新建BOSS实例（降级处理）
        if (!bossInstance) {
            bossInstance = {
                id: bossType.id,
                name: bossType.name,
                maxHealth: bossType.baseAttr.maxHealth,
                health: bossType.baseAttr.maxHealth,
                width: bossType.baseAttr.width,
                height: bossType.baseAttr.height,
                moveSpeed: bossType.baseAttr.moveSpeed,
                moveRange: bossType.baseAttr.moveRange,
                x: canvasWidth / 2 + this.bossConfig.spawn.spawnPosition.xOffset - bossType.baseAttr.width / 2,
                y: this.bossConfig.spawn.spawnPosition.yOffset,
                attackConfig: bossType.attackConfig,
                dropConfig: bossType.dropConfig,
                image: this.gameMain.getLoadedResource('images', this.bossConfig.visual.imageKey),
                // 对象池复用所需的reset方法
                reset: function (newData) {
                    Object.assign(this, newData);
                }
            };
        }

        // 2. 初始化BOSS状态
        this.bossState.currentBoss = bossInstance;
        this.bossState.isSpawning = false;
        this.bossState.lastSpawnTime = now;
        this.bossState.isBossDead = false;
        this.bossState.deathEffectEndTime = 0;

        // 3. 同步游戏状态（标记BOSS已生成）
        this.gameState.updateBattleState({
            bossSpawned: true,
            bossId: bossInstance.id,
            bossHealth: bossInstance.health,
            bossMaxHealth: bossInstance.maxHealth
        });

        // 4. 初始化BOSS攻击系统、掉落系统
        this.bossAttackSystem = new window.BossAttackSystem(bossInstance, window.EnemyBullet);
        this.bossDropSystem = new window.BossDropSystem(bossInstance);

        // 5. 发布BOSS生成事件（供UI显示BOSS名称、血量条，音效播放BOSS出场音效）
        this.eventBus.emit(window.GameEvents.BOSS_SPAWN, {
            bossId: bossInstance.id,
            bossName: bossInstance.name,
            maxHealth: bossInstance.maxHealth
        });

        console.log(`[BossManager] BOSS ${bossInstance.name}（ID: ${bossInstance.id}）生成成功，初始血量：${bossInstance.maxHealth}`);
    }

    /**
     * 处理BOSS死亡：触发死亡动画、生成掉落物、同步游戏状态
     */
    _handleBossDeath() {
        this.bossState.isBossDead = true;
        this.bossState.deathEffectEndTime = Date.now() + this.bossConfig.visual.deathEffectDuration;

        // 1. 停止BOSS攻击（清理攻击系统状态）
        if (this.bossAttackSystem) {
            this.bossAttackSystem._clearActiveBullets();
        }

        // 2. 触发BOSS掉落物生成（调用掉落系统）
        if (this.bossDropSystem) {
            this.eventBus.emit(window.GameEvents.BOSS_DEATH, this.bossState.currentBoss.id);
        }

        // 3. 同步游戏状态（标记BOSS已死亡）
        this.gameState.updateBattleState({
            bossSpawned: false,
            bossHealth: 0,
            bossMaxHealth: 0
        });

        // 4. 发布BOSS死亡事件（供UI隐藏血量条、播放死亡音效/特效）
        this.eventBus.emit(window.GameEvents.BOSS_DEATH, {
            bossId: this.bossState.currentBoss.id,
            bossName: this.bossState.currentBoss.name,
            deathEffectDuration: this.bossConfig.visual.deathEffectDuration
        });

        console.log(`[BossManager] BOSS ${this.bossState.currentBoss.name}（ID: ${this.bossState.currentBoss.id}）已死亡`);
    }

    /**
     * 清理当前BOSS：回收至对象池，重置攻击/掉落系统
     */
    _clearCurrentBoss() {
        // 1. 回收BOSS实例到对象池
        if (this.bossState.currentBoss) {
            this.objectPool.recycleObject('boss', this.bossState.currentBoss);
            this.bossState.currentBoss = null;
        }

        // 2. 重置攻击系统、掉落系统
        this.bossAttackSystem = null;
        this.bossDropSystem = null;

        // 3. 同步游戏状态
        this.gameState.updateBattleState({
            bossSpawned: false,
            bossId: null,
            bossHealth: 0,
            bossMaxHealth: 0
        });
    }

    /**
     * 重置管理器状态（游戏重置时调用）
     */
    _resetManagerState() {
        this.bossState = {
            currentBoss: null,
            isSpawning: false,
            lastSpawnTime: 0,
            isBossDead: false,
            deathEffectEndTime: 0,
            hitFlashEndTime: 0
        };
    }

    /**
     * BOSS移动逻辑：横向往返移动（在moveRange范围内）
     * @param {Object} boss - 当前BOSS实例
     */
    _updateBossMovement(boss) {
        // 若BOSS死亡或无移动范围，不执行移动
        if (this.bossState.isBossDead || !boss.moveRange) return;

        // 1. 检测是否到达移动边界，反转移动方向
        if (boss.x <= boss.moveRange.minX) {
            boss.moveDir = 'right'; // 向右移动
        } else if (boss.x + boss.width >= boss.moveRange.maxX) {
            boss.moveDir = 'left'; // 向左移动
        }

        // 2. 根据方向更新BOSS位置
        if (boss.moveDir === 'right') {
            boss.x += boss.moveSpeed;
        } else {
            boss.x -= boss.moveSpeed;
        }
    }

    /**
     * 主循环更新：BOSS移动、攻击系统更新、死亡动画处理
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
        const now = Date.now();
        const currentBoss = this.bossState.currentBoss;

        // 1. 无BOSS时不执行更新
        if (!currentBoss) return;

        // 2. 处理BOSS死亡动画（动画结束后清理BOSS）
        if (this.bossState.isBossDead) {
            if (now >= this.bossState.deathEffectEndTime) {
                this._clearCurrentBoss();
            }
            return;
        }

        // 3. 更新BOSS移动（横向往返）
        this._updateBossMovement(currentBoss);

        // 4. 更新BOSS攻击系统（攻击逻辑、子弹更新）
        if (this.bossAttackSystem) {
            this.bossAttackSystem.update(deltaTime);
        }

        // 5. 更新BOSS掉落系统（掉落物位置、拾取检测）
        if (this.bossDropSystem) {
            this.bossDropSystem.update(deltaTime);
        }
    }

    /**
     * 主循环渲染：绘制BOSS、攻击效果、死亡效果、受击闪烁
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        const now = Date.now();
        const currentBoss = this.bossState.currentBoss;

        // 1. 无BOSS或死亡动画结束，不渲染
        if (!currentBoss || (this.bossState.isBossDead && now >= this.bossState.deathEffectEndTime)) {
            return;
        }

        ctx.save();

        // 2. 处理受击闪烁（闪烁期间半透明白色覆盖）
        if (now < this.bossState.hitFlashEndTime) {
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = 'white';
            ctx.fillRect(currentBoss.x, currentBoss.y, currentBoss.width, currentBoss.height);
            ctx.globalAlpha = 1;
        }

        // 3. 绘制BOSS（优先使用图片，无图片则降级为彩色矩形）
        if (currentBoss.image) {
            ctx.drawImage(
                currentBoss.image,
                currentBoss.x,
                currentBoss.y,
                currentBoss.width,
                currentBoss.height
            );
        } else {
            // 降级渲染：紫色矩形（基础BOSS默认色）
            ctx.fillStyle = 'rgba(128, 0, 128, 0.8)';
            ctx.fillRect(currentBoss.x, currentBoss.y, currentBoss.width, currentBoss.height);
            // 绘制白色边框，提升辨识度
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeRect(currentBoss.x, currentBoss.y, currentBoss.width, currentBoss.height);
        }

        // 4. 绘制BOSS死亡效果（半透明红色+渐隐）
        if (this.bossState.isBossDead) {
            const fadeProgress = 1 - (this.bossState.deathEffectEndTime - now) / this.bossConfig.visual.deathEffectDuration;
            ctx.globalAlpha = 0.5 * (1 - fadeProgress); // 随时间渐隐
            ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
            ctx.fillRect(currentBoss.x, currentBoss.y, currentBoss.width, currentBoss.height);
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // 5. 渲染BOSS攻击效果（子弹、激光）
        if (this.bossAttackSystem && typeof this.bossAttackSystem.render === 'function') {
            this.bossAttackSystem.render(ctx, deltaTime);
        }

        // 6. 渲染BOSS掉落物
        if (this.bossDropSystem && typeof this.bossDropSystem.render === 'function') {
            this.bossDropSystem.render(ctx, deltaTime);
        }

        // 7. 调试模式：绘制BOSS碰撞框与移动范围
        if (window.GameGlobalConfig?.debug?.enableDebugMode) {
            this._renderDebugInfo(ctx, currentBoss);
        }
    }

    /**
     * 调试模式渲染：绘制BOSS碰撞框、移动范围（开发用）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} boss - 当前BOSS实例
     */
    _renderDebugInfo(ctx, boss) {
        ctx.save();
        // 1. 绘制BOSS碰撞框（红色虚线）
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(boss.x, boss.y, boss.width, boss.height);
        ctx.setLineDash([]);

        // 2. 绘制BOSS移动范围（绿色虚线）
        if (boss.moveRange) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            // 移动范围矩形（仅横向，Y范围覆盖BOSS高度）
            ctx.strokeRect(
                boss.moveRange.minX,
                boss.y,
                boss.moveRange.maxX - boss.moveRange.minX,
                boss.height
            );
            // 标记范围边界文字
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.font = '12px Arial';
            ctx.fillText('移动范围', boss.moveRange.minX + 10, boss.y + 20);
        }

        // 3. 绘制BOSS血量文字（顶部居中）
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${boss.health}/${boss.maxHealth} HP`,
            boss.x + boss.width / 2,
            boss.y - 10
        );
        ctx.textAlign = 'start';
        ctx.restore();
    }

    /**
     * 对外接口：手动触发BOSS生成（测试/剧情场景）
     * @param {string} [bossTypeId='bossBasic'] - 要生成的BOSS类型ID
     */
    triggerBossSpawn(bossTypeId = 'bossBasic') {
        // 强制生成，忽略分数阈值与间隔（仅用于特殊场景）
        this.bossState.lastSpawnTime = 0; // 重置生成间隔
        this._spawnBoss(bossTypeId);
    }

    /**
     * 对外接口：获取当前BOSS状态（供UI显示血量、名称）
     * @returns {Object} 当前BOSS状态（含ID、名称、血量、是否存活）
     */
    getCurrentBossState() {
        if (!this.bossState.currentBoss) {
            return { isAlive: false, id: null, name: null, health: 0, maxHealth: 0 };
        }
        return {
            isAlive: !this.bossState.isBossDead,
            id: this.bossState.currentBoss.id,
            name: this.bossState.currentBoss.name,
            health: this.bossState.currentBoss.health,
            maxHealth: this.bossState.currentBoss.maxHealth,
            isSpawning: this.bossState.isSpawning
        };
    }

    /**
     * 对外接口：获取BOSS攻击状态（供UI显示攻击模式提示）
     * @returns {Object|null} BOSS攻击状态（无BOSS时返回null）
     */
    getBossAttackState() {
        if (!this.bossAttackSystem) return null;
        return this.bossAttackSystem.getAttackState();
    }

    /**
     * 对外接口：获取技能碎片收集状态（供UI显示碎片进度）
     * @returns {Object|null} 技能碎片状态（无掉落系统时返回null）
     */
    getSkillShardState() {
        if (!this.bossDropSystem) return null;
        return this.bossDropSystem.getSkillShardState();
    }
}

// 导出BOSS管理器类（兼容Node.js和浏览器环境）
try {
    module.exports = BossManager;
} catch (e) {
    // 浏览器环境挂载到window，供游戏主模块调用
    window.BossManager = BossManager;
    // 预注册BOSS对象池类型（在ObjectPool未预注册时补充）
    if (window.ObjectPool && !window.ObjectPool.poolMap.has('boss')) {
        window.ObjectPool.registerType(
            'boss',
            () => ({
                id: 'bossBasic',
                name: '基础BOSS',
                maxHealth: 500,
                health: 500,
                width: 120,
                height: 150,
                moveSpeed: 1.2,
                moveRange: { minX: 50, maxX: 750 },
                x: 0,
                y: 0,
                attackConfig: {},
                dropConfig: {},
                image: null,
                reset: function (newData) { Object.assign(this, newData); }
            }),
            { initialSize: 1, maxSize: 2 } // BOSS池初始1个，最大2个（避免同时存在多个BOSS）
        );
    }
}
