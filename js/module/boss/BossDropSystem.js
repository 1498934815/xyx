/**
 * BOSS掉落系统模块：负责BOSS死亡后生成掉落物（道具、技能碎片、分数道具），
 * 管理掉落物的生成规则、飞行轨迹、拾取判定，关联对象池复用掉落物实例
 */
class BossDropSystem {
    /**
     * 构造函数：初始化掉落配置与依赖模块
     * @param {Object} bossInstance - BOSS实例（需包含位置、尺寸、掉落配置）
     */
    constructor(bossInstance) {
        // 基础依赖引用
        this.boss = bossInstance; // BOSS实例（获取死亡位置、掉落配置）
        this.objectPool = window.ObjectPool; // 对象池（复用掉落物）
        this.eventBus = window.EventBus; // 事件总线（发布拾取事件）
        this.gameState = window.GameState; // 游戏状态（获取玩家位置、更新分数）
        this.gameLoop = window.GameLoop; // 主循环（注册掉落物渲染/更新）

        // 掉落核心配置（优先读取BOSS实例的dropConfig，无则用默认）
        const bossDropConfig = this.boss.dropConfig || {};
        this.dropConfig = {
            // 掉落物类型配置（每种类型的概率、数量、属性）
            dropTypes: bossDropConfig.dropTypes || [
                { 
                    key: 'scoreSmall', // 小型分数道具
                    name: '小型分数包',
                    score: 500, // 拾取增加分数
                    count: 3, // 每次掉落数量
                    probability: 0.9, // 掉落概率（90%）
                    speed: 2, // 下落速度（像素/帧）
                    acceleration: 0.02, // 下落加速度（逐渐加速）
                    size: 15, // 碰撞/渲染尺寸（像素）
                    color: 'rgba(255, 215, 0, 1)', // 渲染颜色（金色）
                    iconKey: 'dropScoreSmall' // 资源图标键（对应loadedResources.images）
                },
                { 
                    key: 'scoreBig', // 大型分数道具
                    name: '大型分数包',
                    score: 2000,
                    count: 1,
                    probability: 0.5, // 50%概率
                    speed: 1.8,
                    acceleration: 0.015,
                    size: 25,
                    color: 'rgba(255, 165, 0, 1)', // 橙色
                    iconKey: 'dropScoreBig'
                },
                { 
                    key: 'skillShard', // 技能碎片（集齐3个解锁技能）
                    name: '技能碎片',
                    shardCount: 1, // 拾取增加碎片数
                    targetSkill: 'shield', // 对应技能（护盾技能）
                    count: 1,
                    probability: 0.3, // 30%概率
                    speed: 1.5,
                    acceleration: 0.01,
                    size: 20,
                    color: 'rgba(153, 102, 255, 1)', // 紫色
                    iconKey: 'dropSkillShard'
                },
                { 
                    key: 'life', // 生命道具（增加1条生命）
                    name: '生命包',
                    addLife: 1, // 拾取增加生命
                    count: 1,
                    probability: 0.1, // 10%概率（稀有）
                    speed: 1.2,
                    acceleration: 0.008,
                    size: 22,
                    color: 'rgba(255, 69, 0, 1)', // 红色
                    iconKey: 'dropLife'
                }
            ],
            // 掉落范围配置（基于BOSS中心的随机偏移）
            dropRange: {
                minX: -this.boss.width / 2, // 最小X偏移（BOSS左半宽）
                maxX: this.boss.width / 2,  // 最大X偏移（BOSS右半宽）
                minY: -this.boss.height / 4, // 最小Y偏移（BOSS上1/4高）
                maxY: this.boss.height / 4   // 最大Y偏移（BOSS下1/4高）
            },
            // 拾取配置
            pickUp: {
                triggerRange: 80, // 玩家靠近此范围时，掉落物自动飞向玩家
                attractSpeed: 5, // 自动飞向玩家的速度
                expireTime: 15000 // 掉落物过期时间（15秒后自动消失）
            },
            // 资源引用（从GameMain的loadedResources读取）
            dropIcons: window.GameMain ? window.GameMain.getLoadedResource('images') : {}
        };

        // 掉落物状态管理
        this.dropState = {
            activeDrops: [], // 当前活跃的掉落物列表（待拾取/飞行中）
            skillShardStorage: {} // 玩家收集的技能碎片（key=技能名，value=碎片数）
        };

        // 初始化：注册到主循环（更新掉落物位置+渲染）
        this.gameLoop.registerRenderObj('particle', this);
        // 订阅核心事件（BOSS死亡、游戏重置/结束）
        this._subscribeEvents();
    }

    /**
     * 订阅核心事件：响应BOSS死亡、游戏重置/结束、技能碎片收集
     */
    _subscribeEvents() {
        // 1. BOSS死亡事件：触发掉落物生成
        this.eventBus.on(window.GameEvents.BOSS_DEATH, (bossId) => {
            if (bossId === this.boss.id) { // 仅当前BOSS死亡时触发
                this._generateDrops();
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'drop',
                    message: `BOSS掉落了道具，快去拾取！`
                });
            }
        });

        // 2. 游戏重置事件：清理所有活跃掉落物，重置碎片存储
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._clearAllDrops();
            this.dropState.skillShardStorage = {};
        });

        // 3. 游戏结束事件：清理所有活跃掉落物
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._clearAllDrops();
        });

        // 4. 玩家升级事件：重置部分掉落概率（可选，高等级提升稀有道具概率）
        this.eventBus.on(window.GameEvents.PLAYER_LEVEL_UP, (newLevel) => {
            if (newLevel >= 5) { // 玩家5级后，生命道具概率提升
                const lifeDrop = this.dropConfig.dropTypes.find(type => type.key === 'life');
                if (lifeDrop) lifeDrop.probability = Math.min(0.3, 0.1 + (newLevel - 5) * 0.05);
            }
        });
    }

    /**
     * 生成BOSS掉落物：根据配置概率和数量，创建对应类型的掉落物
     */
    _generateDrops() {
        const bossCenterX = this.boss.x + this.boss.width / 2;
        const bossCenterY = this.boss.y + this.boss.height / 2;
        const now = Date.now();

        // 遍历所有掉落类型，按概率生成
        this.dropConfig.dropTypes.forEach(dropType => {
            // 1. 概率判定：是否生成该类型掉落物
            if (Math.random() > dropType.probability) return;

            // 2. 生成指定数量的掉落物
            for (let i = 0; i < dropType.count; i++) {
                // 获取BOSS死亡位置的随机偏移（在dropRange范围内）
                const offsetX = Math.random() * (this.dropConfig.dropRange.maxX - this.dropConfig.dropRange.minX) + this.dropConfig.dropRange.minX;
                const offsetY = Math.random() * (this.dropConfig.dropRange.maxY - this.dropConfig.dropRange.minY) + this.dropConfig.dropRange.minY;

                // 3. 从对象池获取掉落物实例（复用）
                const dropObj = this._getDropFromPool({
                    typeKey: dropType.key,
                    x: bossCenterX + offsetX,
                    y: bossCenterY + offsetY,
                    size: dropType.size,
                    color: dropType.color,
                    icon: this.dropConfig.dropIcons[dropType.iconKey],
                    expireTime: now + this.dropConfig.pickUp.expireTime,
                    props: { ...dropType } // 携带该类型的所有属性（分数、碎片数等）
                });

                if (dropObj) {
                    // 4. 初始化掉落物飞行状态（随机初始横向速度，模拟扩散）
                    dropObj.speedY = dropType.speed;
                    dropObj.speedX = (Math.random() - 0.5) * 2; // -1 ~ 1 横向速度（左右扩散）
                    dropObj.acceleration = dropType.acceleration;
                    this.dropState.activeDrops.push(dropObj);
                }
            }
        });

        this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
            bossId: this.boss.id,
            action: 'drop',
            dropCount: this.dropState.activeDrops.length
        });
    }

    /**
     * 从对象池获取掉落物实例（复用闲置实例，无则创建新实例）
     * @param {Object} dropData - 掉落物初始化数据（位置、类型、属性）
     * @returns {Object|null} 掉落物实例（失败返回null）
     */
    _getDropFromPool(dropData) {
        // 1. 尝试从对象池获取（类型统一为"dropItem"，预注册于ObjectPool.initCommonTypes）
        let dropObj = this.objectPool.getObject('dropItem', dropData);

        // 2. 若对象池无闲置实例，创建新掉落物实例（降级处理）
        if (!dropObj) {
            dropObj = {
                // 基础属性
                typeKey: dropData.typeKey,
                x: dropData.x,
                y: dropData.y,
                size: dropData.size,
                color: dropData.color,
                icon: dropData.icon,
                expireTime: dropData.expireTime,
                props: dropData.props,
                // 运动属性
                speedX: 0,
                speedY: 0,
                acceleration: 0,
                // 重置方法（对象池复用需包含reset）
                reset: function (newData) {
                    Object.assign(this, newData);
                    this.speedX = 0;
                    this.speedY = 0;
                    this.acceleration = 0;
                },
                // 渲染方法（支持图标或颜色填充）
                render: function (ctx) {
                    ctx.save();
                    if (this.icon) {
                        // 有图标时渲染图标（居中显示）
                        ctx.drawImage(
                            this.icon,
                            this.x - this.size / 2,
                            this.y - this.size / 2,
                            this.size,
                            this.size
                        );
                    } else {
                        // 无图标时渲染圆形（降级）
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
                        ctx.fill();
                        // 绘制白色边框，提升辨识度
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            };
        }

        return dropObj;
    }

    /**
     * 检测掉落物与玩家的拾取交互：普通碰撞拾取/范围吸引拾取
     * @param {Object} dropObj - 单个掉落物实例
     * @param {Object} playerState - 玩家当前状态（位置、尺寸）
     * @returns {boolean} 是否拾取成功
     */
    _checkPickUp(dropObj, playerState) {
        const playerCenterX = playerState.x + playerState.width / 2;
        const playerCenterY = playerState.y + playerState.height / 2;
        const dropCenterX = dropObj.x;
        const dropCenterY = dropObj.y;

        // 1. 计算玩家与掉落物的距离（勾股定理）
        const distance = Math.sqrt(
            Math.pow(playerCenterX - dropCenterX, 2) + 
            Math.pow(playerCenterY - dropCenterY, 2)
        );

        // 2. 范围吸引判定：距离≤triggerRange时，掉落物自动飞向玩家
        if (distance <= this.dropConfig.pickUp.triggerRange) {
            const angle = Math.atan2(playerCenterY - dropCenterY, playerCenterX - dropCenterX);
            dropObj.speedX = Math.cos(angle) * this.dropConfig.pickUp.attractSpeed;
            dropObj.speedY = Math.sin(angle) * this.dropConfig.pickUp.attractSpeed;
            dropObj.acceleration = 0; // 吸引时取消下落加速度
        }

        // 3. 碰撞拾取判定：距离≤（玩家半径+掉落物半径）时，触发拾取
        const pickUpRadius = (playerState.width / 2) + (dropObj.size / 2);
        if (distance <= pickUpRadius) {
            this._handlePickUpEffect(dropObj); // 处理拾取效果（加分、加生命等）
            return true;
        }

        // 4. 过期判定：超过expireTime时，自动消失
        if (Date.now() > dropObj.expireTime) {
            return true;
        }

        return false;
    }

    /**
     * 处理拾取效果：根据掉落物类型执行对应逻辑（加分、加生命、收集碎片）
     * @param {Object} dropObj - 被拾取的掉落物实例
     */
    _handlePickUpEffect(dropObj) {
        const dropProps = dropObj.props;
        const playerState = this.gameState.getFullState().player;

        switch (dropObj.typeKey) {
            // 1. 分数道具：增加玩家分数
            case 'scoreSmall':
            case 'scoreBig':
                this.gameState.updatePlayerState('score', playerState.score + dropProps.score);
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'pickUp',
                    message: `获得${dropProps.name}，+${dropProps.score}分！`
                });
                break;

            // 2. 生命道具：增加玩家生命（不超过最大生命）
            case 'life':
                const newLives = Math.min(playerState.lives + dropProps.addLife, playerState.maxLives);
                if (newLives > playerState.lives) {
                    this.gameState.updatePlayerState('lives', newLives);
                    this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                        type: 'pickUp',
                        message: `获得${dropProps.name}，生命+1！`
                    });
                }
                break;

            // 3. 技能碎片：收集碎片，集齐后解锁技能
            case 'skillShard':
                const skillKey = dropProps.targetSkill;
                // 初始化碎片存储（若不存在）
                if (!this.dropState.skillShardStorage[skillKey]) {
                    this.dropState.skillShardStorage[skillKey] = 0;
                }
                // 增加碎片数
                this.dropState.skillShardStorage[skillKey] += dropProps.shardCount;
                const currentShards = this.dropState.skillShardStorage[skillKey];
                const needShards = 3; // 集齐3个碎片解锁技能
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'pickUp',
                    message: `获得${dropProps.name}（${currentShards}/${needShards}）`
                });

                // 碎片集齐：解锁对应技能
                if (currentShards >= needShards) {
                    this.eventBus.emit(window.GameEvents.PLAYER_SKILL_ACTIVATE, {
                        skillId: skillKey,
                        message: `集齐${needShards}个碎片，解锁${skillKey === 'shield' ? '护盾' : '未知'}技能！`
                    });
                    // 重置该技能碎片计数（避免重复解锁）
                    this.dropState.skillShardStorage[skillKey] = 0;
                }
                break;
        }

        // 发布拾取事件（供音效模块播放拾取音效）
        this.eventBus.emit(window.GameEvents.ITEM_PICKUP, {
            type: dropObj.typeKey,
            score: dropProps.score || 0
        });
    }

    /**
     * 清理所有活跃掉落物（回收至对象池）
     */
    _clearAllDrops() {
        this.dropState.activeDrops.forEach(dropObj => {
            this.objectPool.recycleObject('dropItem', dropObj);
        });
        this.dropState.activeDrops = [];
    }

    /**
     * 主循环更新：每帧更新掉落物位置、检测拾取/过期
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
               const playerState = this.gameState.getFullState().player;
        // 过滤活跃掉落物：保留未拾取/未过期的，回收已处理的
        this.dropState.activeDrops = this.dropState.activeDrops.filter(dropObj => {
            // 1. 检测拾取/过期（已处理则回收，不保留）
            if (this._checkPickUp(dropObj, playerState)) {
                this.objectPool.recycleObject('dropItem', dropObj);
                return false;
            }

            // 2. 更新掉落物位置（未被吸引时，应用下落加速度）
            if (Math.abs(dropObj.speedX) <= 1) { // 仅非吸引状态下应用加速度
                dropObj.speedY += dropObj.acceleration;
            }
            dropObj.x += dropObj.speedX;
            dropObj.y += dropObj.speedY;

            // 3. 边界检测：超出画布范围则回收（不保留）
            const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;
            const canvasHeight = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio;
            if (dropObj.x < -dropObj.size || dropObj.x > canvasWidth + dropObj.size || 
                dropObj.y > canvasHeight + dropObj.size) {
                this.objectPool.recycleObject('dropItem', dropObj);
                return false;
            }

            // 4. 保留活跃掉落物
            return true;
        });
    }

    /**
     * 主循环渲染：绘制所有活跃掉落物（支持图标/圆形降级渲染）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        this.dropState.activeDrops.forEach(dropObj => {
            // 调用掉落物自身的render方法（优先渲染图标，无图标则渲染圆形）
            if (typeof dropObj.render === 'function') {
                dropObj.render(ctx);
            } else {
                // 降级渲染：默认圆形+边框
                ctx.save();
                ctx.fillStyle = dropObj.color || 'rgba(255, 215, 0, 1)';
                ctx.beginPath();
                ctx.arc(dropObj.x, dropObj.y, dropObj.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            // 可选：绘制掉落物拾取范围提示（调试模式下）
            if (window.GameGlobalConfig?.debug?.enableDebugMode) {
                ctx.save();
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(dropObj.x, dropObj.y, this.dropConfig.pickUp.triggerRange, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    /**
     * 对外接口：手动触发BOSS掉落（如测试或剧情场景）
     * @param {Array<string>} [forceTypes] - 强制掉落的类型（如['life', 'skillShard']，跳过概率判定）
     */
    triggerForceDrop(forceTypes = []) {
        if (!forceTypes.length) {
            this._generateDrops(); // 无强制类型时，按默认规则生成
            return;
        }

        const bossCenterX = this.boss.x + this.boss.width / 2;
        const bossCenterY = this.boss.y + this.boss.height / 2;
        const now = Date.now();

        // 强制生成指定类型的掉落物（跳过概率判定）
        forceTypes.forEach(typeKey => {
            const dropType = this.dropConfig.dropTypes.find(type => type.key === typeKey);
            if (!dropType) return;

            for (let i = 0; i < dropType.count; i++) {
                const offsetX = Math.random() * (this.dropConfig.dropRange.maxX - this.dropConfig.dropRange.minX) + this.dropConfig.dropRange.minX;
                const offsetY = Math.random() * (this.dropConfig.dropRange.maxY - this.dropConfig.dropRange.minY) + this.dropConfig.dropRange.minY;

                const dropObj = this._getDropFromPool({
                    typeKey: dropType.key,
                    x: bossCenterX + offsetX,
                    y: bossCenterY + offsetY,
                    size: dropType.size,
                    color: dropType.color,
                    icon: this.dropConfig.dropIcons[dropType.iconKey],
                    expireTime: now + this.dropConfig.pickUp.expireTime,
                    props: { ...dropType }
                });

                if (dropObj) {
                    dropObj.speedY = dropType.speed;
                    dropObj.speedX = (Math.random() - 0.5) * 2;
                    dropObj.acceleration = dropType.acceleration;
                    this.dropState.activeDrops.push(dropObj);
                }
            }
        });

        this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
            bossId: this.boss.id,
            action: 'forceDrop',
            dropCount: this.dropState.activeDrops.length
        });
    }

    /**
     * 对外接口：获取当前技能碎片收集状态（供UI显示）
     * @returns {Object} 碎片状态（key=技能名，value=当前碎片数）
     */
    getSkillShardState() {
        return { ...this.dropState.skillShardStorage };
    }

    /**
     * 对外接口：获取当前活跃掉落物数量（供调试或UI显示）
     * @returns {number} 活跃掉落物数量
     */
    getActiveDropCount() {
        return this.dropState.activeDrops.length;
    }
}

// 导出BOSS掉落系统类（兼容Node.js和浏览器环境）
try {
    module.exports = BossDropSystem;
} catch (e) {
    // 浏览器环境挂载到window，供BOSS实例调用
    window.BossDropSystem = BossDropSystem;
    // 预注册掉落物对象池类型（在ObjectPool未预注册时补充）
    if (window.ObjectPool && !window.ObjectPool.poolMap.has('dropItem')) {
        window.ObjectPool.registerType(
            'dropItem',
            () => ({
                typeKey: '',
                x: 0,
                y: 0,
                size: 15,
                color: 'rgba(255, 215, 0, 1)',
                icon: null,
                expireTime: 0,
                props: {},
                speedX: 0,
                speedY: 0,
                acceleration: 0,
                reset: function (newData) { Object.assign(this, newData); },
                render: function (ctx) {
                    ctx.save();
                    if (this.icon) {
                        ctx.drawImage(this.icon, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
                    } else {
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size/2, 0, Math.PI*2);
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }),
            { initialSize: 10, maxSize: 30 } // 掉落物池初始10个，最大30个
        );
    }
}

