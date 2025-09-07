/**
 * BOSS攻击系统模块：负责管理BOSS的攻击逻辑（攻击模式切换、子弹生成、技能释放），
 * 关联对象池复用子弹，通过事件总线同步攻击状态，配合GameLoop实现攻击帧更新
 */
class BossAttackSystem {
    /**
     * 构造函数：初始化BOSS攻击配置与依赖
     * @param {Object} bossInstance - BOSS实例（需包含位置、血量、攻击配置等属性）
     * @param {Object} enemyBulletClass - 敌人子弹类（需含reset()方法，用于对象池创建）
     */
    constructor(bossInstance, enemyBulletClass) {
        // 基础依赖引用
        this.boss = bossInstance; // BOSS实例（如BossBigFighter）
        this.enemyBulletClass = enemyBulletClass; // 敌人子弹类
        this.objectPool = window.ObjectPool; // 对象池（复用子弹）
        this.eventBus = window.EventBus; // 事件总线（发布攻击事件）
        this.gameState = window.GameState; // 游戏状态（获取玩家位置、BOSS血量）
        this.gameLoop = window.GameLoop; // 主循环（注册渲染/更新）

        // 攻击核心配置（优先读取BOSS实例的attackConfig，无则用默认）
        const bossAttackConfig = this.boss.attackConfig || {};
        this.attackConfig = {
            // 基础攻击参数
            baseAttackInterval: bossAttackConfig.baseAttackInterval || 1500, // 基础攻击间隔（毫秒）
            bulletSpeed: bossAttackConfig.bulletSpeed || 5, // 子弹飞行速度（像素/帧）
            bulletDamage: bossAttackConfig.bulletDamage || 1, // 子弹伤害（默认1点）
            bulletColor: bossAttackConfig.bulletColor || 'rgba(231, 76, 60, 1)', // 子弹颜色（红色）
            
            // 攻击模式配置（支持多模式切换）
            attackModes: bossAttackConfig.attackModes || [
                { type: 'single', weight: 60 }, // 单发射击（权重60%，概率高）
                { type: 'spread', weight: 30 }, // 散射（权重30%）
                { type: 'laser', weight: 10 }  // 激光（权重10%，概率低）
            ],
            modeSwitchHpThreshold: bossAttackConfig.modeSwitchHpThreshold || [0.7, 0.4], // 模式切换血量阈值（70%、40%血量）
            modeSwitchInterval: bossAttackConfig.modeSwitchInterval || 8000, // 模式切换冷却（毫秒）
            
            // 特殊攻击（激光）参数
            laserDuration: bossAttackConfig.laserDuration || 2000, // 激光持续时间（毫秒）
            laserWidth: bossAttackConfig.laserWidth || 15, // 激光宽度（像素）
            laserDamage: bossAttackConfig.laserDamage || 0.2, // 激光每秒伤害（0.2点/帧，60帧=12点/秒）
            laserColor: bossAttackConfig.laserColor || 'rgba(241, 196, 15, 1)', // 激光颜色（黄色）
            
            // 预警配置（攻击前提示）
            warningDuration: bossAttackConfig.warningDuration || 800, // 预警动画时长（毫秒）
            warningColor: bossAttackConfig.warningColor || 'rgba(231, 76, 60, 0.5)' // 预警颜色（半透红）
        };

        // 攻击状态管理
        this.attackState = {
            lastAttackTime: 0, // 上次攻击时间戳（毫秒）
            currentMode: 'single', // 当前攻击模式（默认单发射击）
            lastModeSwitchTime: 0, // 上次模式切换时间戳（毫秒）
            isWarning: false, // 是否处于攻击预警中
            warningEndTime: 0, // 预警结束时间戳（毫秒）
            isLaserAttacking: false, // 是否正在释放激光
            laserEndTime: 0, // 激光结束时间戳（毫秒）
            laserTargetX: 0, // 激光瞄准X坐标（默认玩家位置）
            activeBullets: [] // 当前活跃的BOSS子弹（用于更新/渲染）
        };

        // 初始化：注册到主循环（更新攻击逻辑+渲染子弹/激光）
        this.gameLoop.registerRenderObj('bullet', this);
        // 订阅BOSS血量变化事件（触发攻击模式切换）
        this._subscribeEvents();
    }

    /**
     * 订阅核心事件：BOSS血量变化、游戏重置/结束（清理攻击状态）
     */
    _subscribeEvents() {
        // 1. BOSS受击事件：检测血量阈值，切换攻击模式
        this.eventBus.on(window.GameEvents.BOSS_HIT, () => {
            this._checkModeSwitchByHp();
        });

        // 2. 游戏重置事件：清理活跃子弹，重置攻击状态
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._clearActiveBullets();
            this._resetAttackState();
        });

        // 3. 游戏结束事件：清理活跃子弹
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._clearActiveBullets();
        });
    }

    /**
     * 检查是否需要按血量切换攻击模式（如70%血切换散射，40%血切换激光）
     */
    _checkModeSwitchByHp() {
        const { bossHealth, bossMaxHealth } = this.gameState.getFullState().battle;
        const currentHpRatio = bossHealth / bossMaxHealth;
        const { modeSwitchHpThreshold, modeSwitchInterval } = this.attackConfig;
        const now = Date.now();

        // 检查是否达到切换冷却
        if (now - this.attackState.lastModeSwitchTime < modeSwitchInterval) return;

        // 按血量阈值切换模式（从高到低匹配）
        if (currentHpRatio <= modeSwitchHpThreshold[1] && this.attackState.currentMode !== 'laser') {
            this._switchAttackMode('laser');
        } else if (currentHpRatio <= modeSwitchHpThreshold[0] && this.attackState.currentMode !== 'spread') {
            this._switchAttackMode('spread');
        }
    }

    /**
     * 切换攻击模式：更新模式并发布模式切换事件
     * @param {string} newMode - 新攻击模式（single/spread/laser）
     */
    _switchAttackMode(newMode) {
        // 过滤无效模式
        const validModes = this.attackConfig.attackModes.map(m => m.type);
        if (!validModes.includes(newMode)) return;

        this.attackState.currentMode = newMode;
        this.attackState.lastModeSwitchTime = Date.now();
        // 发布BOSS模式切换事件（供UI显示提示）
        this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
            bossId: this.boss.id,
            mode: newMode,
            message: `BOSS切换为${this._getModeDisplayName(newMode)}模式！`
        });
        this.eventBus.emit(window.GameEvents.BOSS_WARNING, { mode: newMode }); // 触发预警提示
    }

    /**
     * 获取攻击模式的显示名称（用于UI提示）
     * @param {string} mode - 攻击模式（single/spread/laser）
     * @returns {string} 显示名称
     */
    _getModeDisplayName(mode) {
        const modeMap = { single: '单发', spread: '散射', laser: '激光' };
        return modeMap[mode] || mode;
    }

    /**
     * 攻击预警：攻击前显示预警动画（如散射前的范围提示）
     * @param {string} mode - 即将触发的攻击模式
     */
    _startAttackWarning(mode) {
        this.attackState.isWarning = true;
        this.attackState.warningEndTime = Date.now() + this.attackConfig.warningDuration;
        
        // 激光模式额外记录瞄准位置（玩家当前X坐标）
        if (mode === 'laser') {
            const playerState = this.gameState.getFullState().player;
            this.attackState.laserTargetX = playerState.x + (playerState.width || 20) / 2;
        }
    }

    /**
     * 执行攻击：根据当前模式生成子弹或触发激光
     */
    _executeAttack() {
        const now = Date.now();
        const { currentMode } = this.attackState;
        const bossCenterX = this.boss.x + this.boss.width / 2;
        const bossBottomY = this.boss.y + this.boss.height;

        // 按模式执行攻击
        switch (currentMode) {
            case 'single':
                this._createSingleBullet(bossCenterX, bossBottomY);
                break;
            case 'spread':
                this._createSpreadBullets(bossCenterX, bossBottomY);
                break;
            case 'laser':
                this._startLaserAttack(bossCenterX, bossBottomY);
                break;
        }

        // 更新上次攻击时间
        this.attackState.lastAttackTime = now;
        // 发布BOSS攻击事件（供音效模块播放攻击音效）
        this.eventBus.emit(window.GameEvents.BOSS_SKILL, { bossId: this.boss.id, action: 'attack' });
    }

    /**
     * 创建单发射击子弹（从BOSS中心向下发射）
     * @param {number} x - 子弹生成X坐标（BOSS中心）
     * @param {number} y - 子弹生成Y坐标（BOSS底部）
     */
    _createSingleBullet(x, y) {
        const bullet = this._getBulletFromPool(x, y);
        if (!bullet) return;

        // 单发射击：垂直向下
        bullet.dx = 0;
        bullet.dy = this.attackConfig.bulletSpeed;
        this.attackState.activeBullets.push(bullet);
    }

    /**
     * 创建散射子弹（向下方120°范围发射8枚子弹）
     * @param {number} x - 子弹生成X坐标（BOSS中心）
     * @param {number} y - 子弹生成Y坐标（BOSS底部）
     */
    _createSpreadBullets(x, y) {
        const bulletCount = 8; // 散射子弹数量
        const angleRange = Math.PI * 2 / 3; // 120°角度范围（向下左右各60°）
        const startAngle = Math.PI / 2 - angleRange / 2; // 起始角度（左上）

        for (let i = 0; i < bulletCount; i++) {
            const bullet = this._getBulletFromPool(x, y);
            if (!bullet) break;

            // 计算每枚子弹的角度（均匀分布在120°范围内）
            const angle = startAngle + (angleRange / (bulletCount - 1)) * i;
            bullet.dx = Math.cos(angle) * this.attackConfig.bulletSpeed;
            bullet.dy = Math.sin(angle) * this.attackConfig.bulletSpeed;
            this.attackState.activeBullets.push(bullet);
        }
    }

    /**
     * 启动激光攻击：持续一定时间，对激光范围内玩家造成伤害
     * @param {number} x - 激光起始X坐标（BOSS中心）
     * @param {number} y - 激光起始Y坐标（BOSS底部）
     */
    _startLaserAttack(x, y) {
        this.attackState.isLaserAttacking = true;
        this.attackState.laserEndTime = Date.now() + this.attackConfig.laserDuration;
        // 激光起始位置（BOSS底部中心）
        this.attackState.laserStart = { x, y };
        // 激光结束位置（画布底部）
        this.attackState.laserEnd = { 
            x: this.attackState.laserTargetX, 
            y: this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio 
        };
    }

    /**
     * 从对象池获取敌人子弹（复用闲置子弹，无则创建新子弹）
     * @param {number} x - 子弹生成X坐标
     * @param {number} y - 子弹生成Y坐标
     * @returns {Object|null} 子弹实例（失败返回null）
     */
    _getBulletFromPool(x, y) {
        // 从对象池获取子弹（类型为bulletEnemy，预注册于ObjectPool.initCommonTypes）
        const bullet = this.objectPool.getObject('bulletEnemy', {
            x: x - 5, // 子弹宽度默认10，居中偏移
            y: y,
            width: 10,
            height: 20,
            color: this.attackConfig.bulletColor,
            damage: this.attackConfig.bulletDamage
        });

        // 若对象池获取失败，直接创建新子弹（降级处理）
        return bullet || new this.enemyBulletClass({
            x: x - 5,
            y: y,
            width: 10,
            height: 20,
            color: this.attackConfig.bulletColor,
            damage: this.attackConfig.bulletDamage,
            speed: this.attackConfig.bulletSpeed
        });
    }

    /**
     * 清理所有活跃子弹（回收至对象池或销毁）
     */
    _clearActiveBullets() {
        this.attackState.activeBullets.forEach(bullet => {
            // 回收子弹到对象池
            this.objectPool.recycleObject('bulletEnemy', bullet);
        });
        this.attackState.activeBullets = [];
    }

    /**
     * 重置攻击状态（游戏重置时调用）
     */
    _resetAttackState() {
        this.attackState = {
            lastAttackTime: 0,
            currentMode: 'single',
            lastModeSwitchTime: 0,
            isWarning: false,
            warningEndTime: 0,
            isLaserAttacking: false,
            laserEndTime: 0,
            laserTargetX: 0,
            activeBullets: []
        };
    }

    /**
     * 检测激光是否命中玩家（每帧调用）
     */
    _checkLaserHitPlayer() {
        if (!this.attackState.isLaserAttacking) return;

        const player = this.gameState.getFullState().player;
        const laser = this.attackState;
        const laserHalfWidth = this.attackConfig.laserWidth / 2;

        // 激光碰撞检测：玩家X范围在激光X±半宽，且Y范围在激光起始Y到结束Y之间
        const isXInRange = player.x + player.width >= laser.laserTargetX - laserHalfWidth && 
                           player.x <= laser.laserTargetX + laserHalfWidth;
        const isYInRange = player.y + player.height >= laser.laserStart.y && 
                           player.y <= laser.laserEnd.y;

        // 命中且玩家非无敌状态：触发玩家受击事件
        if (isXInRange && isYInRange && !player.isInvincible) {
            this.eventBus.emit(window.GameEvents.PLAYER_HIT, { damage: this.attackConfig.laserDamage });
        }
    }

    /**
     * 主循环更新：每帧执行攻击逻辑（预警、攻击触发、子弹更新、激光检测）
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
        const now = Date.now();
        const { isWarning, isLaserAttacking, lastAttackTime } = this.attackState;
        const attackInterval = this.attackConfig.baseAttackInterval;

        // 1. 处理攻击预警（预警结束后触发攻击）
        if (isWarning) {
            if (now >= this.attackState.warningEndTime) {
                this.attackState.isWarning = false;
                this._executeAttack(); // 预警结束，执行攻击
            }
            return;
        }

        // 2. 处理激光攻击（持续期间检测命中，结束后重置状态）
        if (isLaserAttacking) {
            this._checkLaserHitPlayer(); // 检测激光命中
            if (now >= this.attackState.laserEndTime) {
                this.attackState.isLaserAttacking = false;
            }
            return;
        }

        // 3. 检测是否需要触发新攻击（达到攻击间隔）
        if (now - lastAttackTime >= attackInterval) {
            this._startAttackWarning(this.attackState.currentMode); // 启动攻击预警
        }

        // 4. 更新活跃子弹位置（超出画布则回收）
        this.attackState.activeBullets = this.attackState.activeBullets.filter(bullet => {
            // 更新子弹位置
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;

            // 子弹超出画布（下边界+20像素）：回收至对象池，过滤出活跃子弹
            const canvasHeight = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio;
            if (bullet.y > canvasHeight + 20) {
                this.objectPool.recycleObject('bulletEnemy', bullet);
                return false;
            }

            // 子弹碰撞检测（已注册到CollisionSystem，此处仅更新位置）
            return true;
        });
    }

    /**
     * 主循环渲染：绘制活跃子弹、攻击预警、激光效果
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        const { isWarning, isLaserAttacking, activeBullets } = this.attackState;
        const bossCenterX = this.boss.x + this.boss.width / 2;
        const bossBottomY = this.boss.y + this.boss.height;
        const canvasHeight = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio;

        // 1. 绘制攻击预警（如散射前的范围提示、激光前的瞄准线）
        if (isWarning) {
            ctx.save();
            ctx.fillStyle = this.attackConfig.warningColor;
            
            if (this.attackState.currentMode === 'spread') {
                // 散射预警：绘制120°扇形范围（BOSS底部向下延伸）
                const warningRadius = 150; // 预警范围半径
                const angleRange = Math.PI * 2 / 3; // 120°角度范围
                const startAngle = Math.PI / 2 - angleRange / 2; // 起始角度
                const endAngle = Math.PI / 2 + angleRange / 2; // 结束角度

                ctx.beginPath();
                ctx.moveTo(bossCenterX, bossBottomY);
                ctx.arc(bossCenterX, bossBottomY, warningRadius, startAngle, endAngle);
                ctx.closePath();
                ctx.fill();
            } else if (this.attackState.currentMode === 'laser') {
                // 激光预警：绘制瞄准线（BOSS底部到画布底部）
                const laserHalfWidth = this.attackConfig.laserWidth / 2;
                ctx.fillRect(
                    this.attackState.laserTargetX - laserHalfWidth,
                    bossBottomY,
                    this.attackConfig.laserWidth,
                    canvasHeight - bossBottomY
                );
            }
            ctx.restore();
        }

        // 2. 绘制激光攻击效果（持续期间显示黄色激光）
        if (isLaserAttacking) {
            ctx.save();
            ctx.fillStyle = this.attackConfig.laserColor;
            
            // 绘制激光矩形（瞄准X坐标为中心，宽度固定）
            const laserHalfWidth = this.attackConfig.laserWidth / 2;
            ctx.fillRect(
                this.attackState.laserTargetX - laserHalfWidth,
                this.attackState.laserStart.y,
                this.attackConfig.laserWidth,
                this.attackState.laserEnd.y - this.attackState.laserStart.y
            );

            // 激光边缘发光效果（外扩2像素，半透明）
            ctx.fillStyle = `${this.attackConfig.laserColor.replace(')', ', 0.3)')}`;
            ctx.fillRect(
                this.attackState.laserTargetX - laserHalfWidth - 2,
                this.attackState.laserStart.y - 2,
                this.attackConfig.laserWidth + 4,
                this.attackState.laserEnd.y - this.attackState.laserStart.y + 4
            );
            ctx.restore();
        }

        // 3. 绘制活跃子弹（遍历所有子弹，调用子弹自身render方法）
        activeBullets.forEach(bullet => {
            if (typeof bullet.render === 'function') {
                bullet.render(ctx);
            } else {
                // 降级绘制：若子弹无render方法，直接绘制矩形
                ctx.save();
                ctx.fillStyle = bullet.color || this.attackConfig.bulletColor;
                ctx.fillRect(bullet.x, bullet.y, bullet.width || 10, bullet.height || 20);
                ctx.restore();
            }
        });
    }

    /**
     * 对外接口：手动触发BOSS特殊攻击（如剧情触发的激光）
     * @param {string} mode - 攻击模式（single/spread/laser）
     */
    triggerSpecialAttack(mode) {
        const validModes = this.attackConfig.attackModes.map(m => m.type);
        if (!validModes.includes(mode)) {
            console.warn(`[BossAttackSystem Warn] 无效的特殊攻击模式：${mode}`);
            return;
        }

        // 强制切换模式并触发攻击（忽略冷却）
        this._switchAttackMode(mode);
        this.attackState.lastAttackTime = 0; // 重置攻击冷却
        this._startAttackWarning(mode);
    }

    /**
     * 对外接口：获取当前攻击状态（供UI显示BOSS攻击信息）
     * @returns {Object} 攻击状态（当前模式、是否预警、是否激光攻击）
     */
    getAttackState() {
        return {
            currentMode: this.attackState.currentMode,
            isWarning: this.attackState.isWarning,
            isLaserAttacking: this.attackState.isLaserAttacking,
            modeDisplayName: this._getModeDisplayName(this.attackState.currentMode)
        };
    }
}

// 导出BOSS攻击系统类（兼容Node.js和浏览器环境）
try {
    module.exports = BossAttackSystem;
} catch (e) {
    // 浏览器环境挂载到window，供BOSS实例调用
    window.BossAttackSystem = BossAttackSystem;
}
