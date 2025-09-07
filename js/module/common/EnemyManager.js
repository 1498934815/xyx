/**
 * 敌人管理系统模块：负责普通敌人的生命周期管控（生成、移动、攻击、死亡），
 * 支持多类型敌人配置、波次生成逻辑，关联碰撞检测与奖励发放，平衡游戏战斗节奏
 */
class EnemyManager {
    constructor() {
        // 基础依赖引用
        this.eventBus = window.EventBus; // 事件总线（订阅战斗事件、发布敌人状态）
        this.gameState = window.GameState; // 游戏状态（获取玩家数据、波次信息）
        this.gameLoop = window.GameLoop; // 主循环（注册敌人更新/渲染）
        this.objectPool = window.ObjectPool; // 对象池（复用敌人、子弹实例，优化性能）
        this.collisionSystem = window.CollisionSystem; // 碰撞系统（检测敌人与玩家/子弹碰撞）
        this.gameMain = window.GameMain; // 游戏入口（获取资源、全局配置）

        // 敌人核心配置（从全局配置读取，无则用默认）
        const globalEnemyConfig = window.EnemyConfig || {};
        this.enemyConfig = {
            // 生成配置（波次、间隔、上限）
            spawn: {
                initialSpawnDelay: globalEnemyConfig.spawn?.initialSpawnDelay || 3000, // 初始生成延迟（3秒）
                baseSpawnInterval: globalEnemyConfig.spawn?.baseSpawnInterval || 2000, // 基础生成间隔（2秒）
                spawnIntervalReduce: globalEnemyConfig.spawn?.spawnIntervalReduce || 50, // 每波次间隔减少量（50ms）
                minSpawnInterval: globalEnemyConfig.spawn?.minSpawnInterval || 500, // 最小生成间隔（500ms）
                maxActiveEnemies: globalEnemyConfig.spawn?.maxActiveEnemies || 15, // 最大活跃敌人数量（15个）
                waveInterval: globalEnemyConfig.spawn?.waveInterval || 15000, // 波次间隔（15秒）
                enemyPerWave: globalEnemyConfig.spawn?.enemyPerWave || 8 // 每波次基础敌人数量（8个）
            },
            // 敌人类型配置（支持多类型差异化属性）
            enemyTypes: globalEnemyConfig.enemyTypes || [
                {
                    id: 'enemySmall', // 小型敌人（基础）
                    name: '小型战机',
                    baseAttr: {
                        health: 50, // 血量
                        maxHealth: 50,
                        width: 40, // 碰撞/渲染宽度
                        height: 35, // 碰撞/渲染高度
                        moveSpeed: 2.5, // 移动速度（像素/帧）
                        moveDir: 'down', // 默认移动方向（向下）
                        attackRange: 300, // 攻击触发范围（像素）
                        attackInterval: 3000, // 攻击间隔（3秒）
                        bulletSpeed: 4, // 子弹速度
                        bulletDamage: 1 // 子弹伤害
                    },
                    visual: {
                        imageKey: 'enemySmall', // 资源键（对应GameMain加载的图片）
                        color: 'rgba(230, 126, 34, 0.9)', // 降级渲染颜色（橙色）
                        deathEffectDuration: 800 // 死亡动画时长（800ms）
                    },
                    reward: {
                        type: 'score', // 死亡奖励类型（分数）
                        value: 100 // 奖励值（100分）
                    }
                },
                {
                    id: 'enemyMedium', // 中型敌人（血厚、伤害高）
                    name: '中型战机',
                    baseAttr: {
                        health: 150,
                        maxHealth: 150,
                        width: 55,
                        height: 50,
                        moveSpeed: 1.8,
                        moveDir: 'down',
                        attackRange: 350,
                        attackInterval: 4500,
                        bulletSpeed: 3.5,
                        bulletDamage: 2
                    },
                    visual: {
                        imageKey: 'enemyMedium',
                        color: 'rgba(231, 76, 60, 0.9)', // 红色
                        deathEffectDuration: 1000
                    },
                    reward: {
                        type: 'score',
                        value: 300
                    }
                },
                {
                    id: 'enemyFast', // 快速敌人（移速快、血量低）
                    name: '快速突袭机',
                    baseAttr: {
                        health: 30,
                        maxHealth: 30,
                        width: 35,
                        height: 30,
                        moveSpeed: 4,
                        moveDir: 'downLeft', // 斜向下左移动
                        attackRange: 250,
                        attackInterval: 2000,
                        bulletSpeed: 5,
                        bulletDamage: 1
                    },
                    visual: {
                        imageKey: 'enemyFast',
                        color: 'rgba(52, 152, 219, 0.9)', // 蓝色
                        deathEffectDuration: 600
                    },
                    reward: {
                        type: 'score',
                        value: 200
                    }
                }
            ],
            // 子弹配置（敌人子弹通用属性）
            bulletConfig: {
                width: 8,
                height: 16,
                color: 'rgba(255, 59, 48, 0.9)', // 红色子弹
                imageKey: 'enemyBullet' // 子弹资源键（可选）
            }
        };

        // 敌人状态管理
        this.enemyState = {
            activeEnemies: [], // 当前活跃敌人列表
            enemyBullets: [], // 当前活跃敌人子弹列表
            currentWave: 1, // 当前波次（初始第1波）
            nextSpawnTime: Date.now() + this.enemyConfig.spawn.initialSpawnDelay, // 下次生成时间
            nextWaveTime: Date.now() + this.enemyConfig.spawn.waveInterval, // 下一波次时间
            spawnedThisWave: 0, // 本波次已生成敌人数量
            enemySpawnWeight: [0.6, 0.3, 0.1] // 敌人生成权重（小型60%、中型30%、快速10%）
        };

        // 初始化：预注册敌人/子弹对象池，订阅核心事件，注册到主循环
        this._registerObjectPoolTypes();
        this._subscribeEvents();
        this.gameLoop.registerRenderObj('enemy', this);
    }

    /**
     * 预注册敌人、子弹到对象池（避免运行时频繁创建/销毁）
     */
    _registerObjectPoolTypes() {
        const { enemyTypes, bulletConfig } = this.enemyConfig;

        // 1. 注册各类型敌人到对象池
        enemyTypes.forEach(enemyType => {
            if (this.objectPool.poolMap.has(enemyType.id)) return; // 已注册则跳过

            this.objectPool.registerType(
                enemyType.id,
                // 敌人实例创建函数（含reset方法用于复用）
                () => ({
                    id: '',
                    typeId: enemyType.id,
                    name: enemyType.name,
                    // 基础属性（初始值从类型配置读取）
                    health: enemyType.baseAttr.health,
                    maxHealth: enemyType.baseAttr.maxHealth,
                    width: enemyType.baseAttr.width,
                    height: enemyType.baseAttr.height,
                    x: 0,
                    y: 0,
                    moveSpeed: enemyType.baseAttr.moveSpeed,
                    moveDir: enemyType.baseAttr.moveDir,
                    attackRange: enemyType.baseAttr.attackRange,
                    attackInterval: enemyType.baseAttr.attackInterval,
                    lastAttackTime: 0, // 上次攻击时间戳
                    // 视觉属性
                    image: null,
                    color: enemyType.visual.color,
                    deathEffectEndTime: 0, // 死亡动画结束时间
                    isDead: false, // 是否已死亡
                    // 复用重置方法
                    reset: function (newData) {
                        Object.assign(this, newData);
                        this.health = newData.maxHealth || enemyType.baseAttr.maxHealth;
                        this.isDead = false;
                        this.deathEffectEndTime = 0;
                        this.lastAttackTime = Date.now();
                    },
                    // 敌人移动方法（按方向更新位置）
                    move: function () {
                        switch (this.moveDir) {
                            case 'down':
                                this.y += this.moveSpeed;
                                break;
                            case 'downLeft':
                                this.y += this.moveSpeed;
                                this.x -= this.moveSpeed * 0.5;
                                break;
                            case 'downRight':
                                this.y += this.moveSpeed;
                                this.x += this.moveSpeed * 0.5;
                                break;
                            case 'horizontal': // 横向往返
                                if (this.x <= 50) this.moveDir = 'horizontalRight';
                                if (this.x + this.width >= this.moveRange.maxX) this.moveDir = 'horizontalLeft';
                                this.x += this.moveDir === 'horizontalRight' ? this.moveSpeed : -this.moveSpeed;
                                break;
                        }
                    },
                    // 敌人攻击方法（生成子弹）
                    attack: function (bulletConfig, enemyBullets, objectPool) {
                        const now = Date.now();
                        if (now - this.lastAttackTime < this.attackInterval) return;

                        // 从对象池获取子弹实例
                        const bullet = objectPool.getObject('enemyBullet', {
                            x: this.x + this.width / 2 - bulletConfig.width / 2, // 子弹居中生成
                            y: this.y + this.height,
                            width: bulletConfig.width,
                            height: bulletConfig.height,
                            speed: this.bulletSpeed || bulletConfig.speed,
                            damage: this.bulletDamage || bulletConfig.damage,
                            color: bulletConfig.color,
                            image: bulletConfig.image,
                            direction: 'down' // 敌人子弹默认向下
                        });

                        if (bullet) {
                            enemyBullets.push(bullet);
                            this.lastAttackTime = now;
                        }
                    },
                    // 敌人死亡方法（触发动画、奖励）
                    die: function (deathEffectDuration) {
                        this.isDead = true;
                        this.deathEffectEndTime = Date.now() + deathEffectDuration;
                    }
                }),
                { initialSize: 5, maxSize: 10 } // 每种敌人初始5个，最大10个
            );
        });

        // 2. 注册敌人子弹到对象池
        if (!this.objectPool.poolMap.has('enemyBullet')) {
            this.objectPool.registerType(
                'enemyBullet',
                () => ({
                    id: '',
                    x: 0,
                    y: 0,
                    width: bulletConfig.width,
                    height: bulletConfig.height,
                    speed: bulletConfig.speed || 4,
                    damage: bulletConfig.damage || 1,
                    color: bulletConfig.color,
                    image: null,
                    direction: 'down',
                    reset: function (newData) {
                        Object.assign(this, newData);
                        this.id = `enemyBullet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    },
                    move: function () {
                        switch (this.direction) {
                            case 'down':
                                this.y += this.speed;
                                break;
                            case 'downLeft':
                                this.y += this.speed;
                                this.x -= this.speed * 0.3;
                                break;
                            case 'downRight':
                                this.y += this.speed;
                                this.x += this.speed * 0.3;
                                break;
                        }
                    }
                }),
                { initialSize: 15, maxSize: 30 } // 子弹初始15个，最大30个
            );
        }
    }

    /**
     * 订阅核心事件：碰撞检测、游戏重置/结束、BOSS生成（暂停敌人生成）
     */
    _subscribeEvents() {
        // 1. 碰撞检测事件：检测敌人与玩家子弹、敌人子弹与玩家的碰撞
        this.eventBus.on(window.GameEvents.COLLISION_DETECT, () => {
            this._detectCollisions();
        });

        // 2. 游戏重置事件：清理所有敌人/子弹，重置波次状态
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._clearAllEnemies();
            this._clearAllBullets();
            this._resetWaveState();
        });

        // 3. 游戏结束事件：清理活跃敌人与子弹
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._clearAllEnemies();
            this._clearAllBullets();
        });

        // 4. BOSS生成事件：暂停敌人生成（避免BOSS战与普通敌人叠加）
        this.eventBus.on(window.GameEvents.BOSS_SPAWN, () => {
            this.enemyState.nextSpawnTime = Date.now() + this.enemyConfig.spawn.waveInterval; // 延迟到下一波次
        });

        // 5. BOSS死亡事件：恢复敌人生成（BOSS战后继续波次）
        this.eventBus.on(window.GameEvents.BOSS_DEATH, () => {
            this.enemyState.nextSpawnTime = Date.now() + 3000; // 3秒后恢复生成
        });
    }

    /**
     * 生成敌人：按波次规则、权重随机选择敌人类型，从对象池获取实例
     */
    _spawnEnemy() {
        const now = Date.now();
        const { spawn, enemyTypes } = this.enemyConfig;
        const { activeEnemies, spawnedThisWave, currentWave, enemySpawnWeight } = this.enemyState;
        const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;

        // 生成条件：未达最大活跃数+到生成时间+本波次未达上限
        const maxEnemyThisWave = spawn.enemyPerWave + Math.floor(currentWave * 0.5); // 每波次敌人数量随波次增加
        if (activeEnemies.length >= spawn.maxActiveEnemies || 
            now < this.enemyState.nextSpawnTime || 
            spawnedThisWave >= maxEnemyThisWave) {
            return;
        }

        // 1. 按权重随机选择敌人类型（如小型60%、中型30%、快速10%）
        const random = Math.random();
        let selectedTypeIndex = 0;
        let weightSum = 0;
        for (let i = 0; i < enemySpawnWeight.length; i++) {
            weightSum += enemySpawnWeight[i];
            if (random <= weightSum) {
                selectedTypeIndex = i;
                break;
            }
        }
        const selectedType = enemyTypes[selectedTypeIndex];
        if (!selectedType) return;

        // 2. 计算敌人生成位置（横向随机，避免超出画布）
        const spawnX = Math.random() * (canvasWidth - selectedType.baseAttr.width - 100) + 50; // 左右留50像素边距
        const spawnY = -selectedType.baseAttr.height; // 从画布顶部外生成（避免突兀）

        // 3. 从对象池获取敌人实例并初始化
        const enemy = this.objectPool.getObject(selectedType.id, {
            id: `${selectedType.id}_${now}_${spawnedThisWave}`,
            typeId: selectedType.id,
            name: selectedType.name,
            maxHealth: selectedType.baseAttr.maxHealth,
            width: selectedType.baseAttr.width,
            height: selectedType.baseAttr.height,
            x: spawnX,
            y: spawnY,
            moveSpeed: selectedType.baseAttr.moveSpeed,
            moveDir: selectedType.baseAttr.moveDir,
            attackRange: selectedType.baseAttr.attackRange,
            attackInterval: selectedType.baseAttr.attackInterval,
            bulletSpeed: selectedType.baseAttr.bulletSpeed,
            bulletDamage: selectedType.baseAttr.bulletDamage,
            // 视觉属性
            image: this.gameMain.getLoadedResource('images', selectedType.visual.imageKey),
            color: selectedType.visual.color,
            deathEffectDuration: selectedType.visual.deathEffectDuration,
            // 移动范围（仅横向移动类型用）
            moveRange: { minX: 50, maxX: canvasWidth - 50 }
        });

        // 4. 添加到活跃敌人列表，更新生成状态
        if (enemy) {
            activeEnemies.push(enemy);
            this.enemyState.spawnedThisWave += 1;
            // 更新下次生成时间（随波次减少间隔）
            const currentSpawnInterval = Math.max(
                spawn.baseSpawnInterval - (currentWave - 1) * spawn.spawnIntervalReduce,
                spawn.minSpawnInterval
            );
            this.enemyState.nextSpawnTime = now + currentSpawnInterval;
        }
    }

    /**
     * 检测碰撞：敌人与玩家子弹碰撞、敌人子弹与玩家碰撞
     */
    _detectCollisions() {
        const { activeEnemies, enemyBullets } = this.enemyState;
        const player = this.gameState.getFullState().player;
        const playerBullets = this.gameState.getFullState().battle.playerBullets;

        // 1. 检测玩家子弹与敌人的碰撞
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const pBullet = playerBullets[i];
            if (!pBullet || pBullet.isDestroyed) continue;

            for (let j = activeEnemies.length - 1; j >= 0; j--) {
                const enemy = activeEnemies[j];
                if (!enemy || enemy.isDead) continue;

                // 调用碰撞系统检测矩形碰撞
                const isCollided = this.collisionSystem.checkRectCollision(
                    { x: pBullet.x, y: pBullet.y, width: pBullet.width, height: pBullet.height },
                    { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height }
                );

                if (isCollided) {
                    // 1.1 敌人受击：扣除血量，检测是否死亡
                    enemy.health = Math.max(0, enemy.health - pBullet.damage);
                    if (enemy.health <= 0 && !enemy.isDead) {
                        this._handleEnemyDeath(enemy, j); // 处理敌人死亡
                    }

                    // 1.2 玩家子弹销毁（回收至对象池）
                    this.objectPool.recycleObject('playerBullet', pBullet);
                    playerBullets.splice(i, 1);
                    break; // 一颗子弹只命中一个敌人
                }
            }
        }

        // 2. 检测敌人子弹与玩家的碰撞（玩家未无敌时生效）
        if (!player.isInvincible && player.health > 0) {
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eBullet = enemyBullets[i];
                if (!eBullet) continue;

                const isCollided = this.collisionSystem.checkRectCollision(
                    { x: eBullet.x, y: eBullet.y, width: eBullet.width, height: eBullet.height },
                    { x: player.x, y: player.y, width: player.width, height: player.height }
                );

                if (isCollided) {
                    // 2.1 玩家受击：发布受击事件（扣除血量由PlayerSystem处理）
                    this.eventBus.emit(window.GameEvents.PLAYER_HIT, { damage: eBullet.damage });

                    // 2.2 敌人子弹销毁（回收至对象池）
                    this.objectPool.recycleObject('enemyBullet', eBullet);
                    enemyBullets.splice(i, 1);
                }
            }
        }

        // 3. 检测敌人与玩家的碰撞（玩家未无敌时生效）
        if (!player.isInvincible && player.health > 0) {
            for (let i = activeEnemies.length - 1; i >= 0; i--) {
                const enemy = activeEnemies[i];
                if (!enemy || enemy.isDead) continue;

                const isCollided = this.collisionSystem.checkRectCollision(
                    { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height },
                    { x: player.x, y: player.y, width: player.width, height: player.height }
                );

                if (isCollided) {
                    // 3.1 玩家受击（碰撞伤害=敌人血量的10%，最低1点）
                    const collisionDamage = Math.max(1, Math.floor(enemy.maxHealth * 0.1));
                    this.eventBus.emit(window.GameEvents.PLAYER_HIT, { damage: collisionDamage });

                    // 3.2 敌人碰撞后死亡（避免重复碰撞）
                    if (!enemy.isDead) {
                        this._handleEnemyDeath(enemy, i);
                    }
                }
            }
        }
    }

    /**
     * 处理敌人死亡：触发死亡动画、发放奖励、回收实例
     * @param {Object} enemy - 死亡的敌人实例
     * @param {number} index - 敌人在活跃列表中的索引
     */
    _handleEnemyDeath(enemy, index) {
        const now = Date.now();
        const enemyType = this.enemyConfig.enemyTypes.find(type => type.id === enemy.typeId);
        if (!enemyType) return;

        // 1. 标记敌人死亡，启动死亡动画
        enemy.die(enemyType.visual.deathEffectDuration);

        // 2. 发放敌人死亡奖励（分数为主，概率掉落道具）
        this._grantEnemyReward(enemyType.reward);

        // 3. 发布敌人死亡事件（供成就系统更新进度）
        this.eventBus.emit(window.GameEvents.ENEMY_DEATH, {
            enemyId: enemy.id,
            enemyType: enemy.typeId,
            enemyMaxHealth: enemy.maxHealth
        });

        // 4. 死亡动画结束后回收敌人实例
        setTimeout(() => {
            if (this.enemyState.activeEnemies[index] === enemy) {
                this.objectPool.recycleObject(enemy.typeId, enemy);
                this.enemyState.activeEnemies.splice(index, 1);
            }
        }, enemyType.visual.deathEffectDuration);
    }

    /**
     * 发放敌人死亡奖励：基础分数奖励+概率道具奖励
     * @param {Object} rewardConfig - 敌人奖励配置（type：类型，value：基础值）
     */
    _grantEnemyReward(rewardConfig) {
        const playerState = this.gameState.getFullState().player;
        switch (rewardConfig.type) {
            case 'score':
                // 1. 分数奖励：基础值+玩家等级加成（等级越高奖励越多）
                const levelBonus = 1 + (playerState.level - 1) * 0.1; // 每级+10%奖励
                const finalScore = Math.floor(rewardConfig.value * levelBonus);
                this.gameState.updatePlayerState('score', playerState.score + finalScore);
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'enemyReward',
                    message: `+${finalScore}分`
                });
                break;

            case 'item':
                // 2. 道具奖励：按概率生成（如10%概率掉落生命包）
                const itemDropRate = rewardConfig.dropRate || 0.1; // 默认10%掉落率
                if (Math.random() <= itemDropRate) {
                    this.eventBus.emit(window.GameEvents.ITEM_SPAWN, {
                        itemType: rewardConfig.itemKey,
                        x: Math.random() * 300 + 100, // 随机X坐标（100~400）
                        y: Math.random() * 200 + 100  // 随机Y坐标（100~300）
                    });
                }
                break;
        }
    }

    /**
     * 清理所有活跃敌人（回收至对象池）
     */
    _clearAllEnemies() {
        this.enemyState.activeEnemies.forEach(enemy => {
            this.objectPool.recycleObject(enemy.typeId, enemy);
        });
        this.enemyState.activeEnemies = [];
        this.enemyState.spawnedThisWave = 0;
    }

    /**
     * 清理所有敌人子弹（回收至对象池）
     */
    _clearAllBullets() {
        this.enemyState.enemyBullets.forEach(bullet => {
            this.objectPool.recycleObject('enemyBullet', bullet);
        });
        this.enemyState.enemyBullets = [];
    }

    /**
     * 重置波次状态（游戏重置时调用）
     */
    _resetWaveState() {
        const now = Date.now();
        this.enemyState.currentWave = 1;
        this.enemyState.nextSpawnTime = now + this.enemyConfig.spawn.initialSpawnDelay;
        this.enemyState.nextWaveTime = now + this.enemyConfig.spawn.waveInterval;
        this.enemyState.spawnedThisWave = 0;
    }

    /**
     * 检测波次切换：本波次敌人全灭+达到波次间隔，切换到下一波
     */
    _checkWaveSwitch() {
        const now = Date.now();
        const { spawn } = this.enemyConfig;
        const { activeEnemies, currentWave, nextWaveTime, spawnedThisWave } = this.enemyState;
        const maxEnemyThisWave = spawn.enemyPerWave + Math.floor(currentWave * 0.5);

        // 波次切换条件：本波次敌人已生成完毕+当前无活跃敌人+达到波次间隔
        const canSwitchWave = spawnedThisWave >= maxEnemyThisWave && 
                             activeEnemies.length === 0 && 
                             now >= nextWaveTime;

        if (canSwitchWave) {
            // 1. 更新波次状态
            this.enemyState.currentWave += 1;
            this.enemyState.nextWaveTime = now + spawn.waveInterval;
            this.enemyState.spawnedThisWave = 0;
            this.enemyState.nextSpawnTime = now + 1000; // 1秒后开始生成下一波敌人

            // 2. 发布波次切换事件（供UI显示“第X波！”提示）
            this.eventBus.emit(window.GameEvents.ENEMY_WAVE_SWITCH, {
                waveNumber: this.enemyState.currentWave,
                enemyCount: spawn.enemyPerWave + Math.floor(this.enemyState.currentWave * 0.5)
            });

            // 3. 随波次提升敌人强度（每3波提升一次移动速度/血量）
            if (this.enemyState.currentWave % 3 === 0) {
                this.enemyConfig.enemyTypes.forEach(type => {
                    type.baseAttr.moveSpeed *= 1.1; // 移动速度+10%
                    type.baseAttr.health *= 1.2;    // 血量+20%
                });
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'waveWarning',
                    message: `敌人强度提升！第${this.enemyState.currentWave}波更具挑战性！`
                });
            }
        }
    }

    /**
     * 主循环更新：敌人生成、移动、攻击，子弹移动，波次检测
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
        const now = Date.now();
        const player = this.gameState.getFullState().player;

        // 1. 玩家死亡时停止所有更新
        if (player.health <= 0) return;

        // 2. 生成敌人（按时间间隔与波次规则）
        this._spawnEnemy();

        // 3. 更新活跃敌人：移动、攻击（检测玩家是否在攻击范围内）
        this.enemyState.activeEnemies.forEach(enemy => {
            if (enemy.isDead) return;

            // 3.1 敌人移动（调用敌人自身move方法）
            enemy.move();

            // 3.2 敌人攻击（玩家在攻击范围内且冷却结束）
            const playerDistance = Math.sqrt(
                Math.pow(player.x + player.width/2 - (enemy.x + enemy.width/2), 2) +
                Math.pow(player.y + player.height/2 - (enemy.y + enemy.height/2), 2)
            );
            if (playerDistance <= enemy.attackRange) {
                enemy.attack(this.enemyConfig.bulletConfig, this.enemyState.enemyBullets, this.objectPool);
            }

            // 3.3 敌人超出画布底部时销毁（避免内存占用）
            if (enemy.y > this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio + enemy.height) {
                const index = this.enemyState.activeEnemies.indexOf(enemy);
                if (index !== -1) {
                    this.objectPool.recycleObject(enemy.typeId, enemy);
                    this.enemyState.activeEnemies.splice(index, 1);
                }
            }
        });

        // 4. 更新敌人子弹：移动+超出画布销毁
        for (let i = this.enemyState.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyState.enemyBullets[i];
            bullet.move();

            // 子弹超出画布（上/下/左/右）则销毁
            const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;
            const canvasHeight = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio;
            if (bullet.y > canvasHeight || bullet.y < -bullet.height || 
                bullet.x > canvasWidth || bullet.x < -bullet.width) {
                this.objectPool.recycleObject('enemyBullet', bullet);
                this.enemyState.enemyBullets.splice(i, 1);
            }
        }

        // 5. 检测波次切换
        this._checkWaveSwitch();
    }

    /**
     * 主循环渲染：绘制敌人、敌人子弹、死亡动画
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        const now = Date.now();

        // 1. 绘制活跃敌人（含死亡动画）
        this.enemyState.activeEnemies.forEach(enemy => {
            if (!enemy) return;

            ctx.save();

            // 1.1 死亡动画：渐隐红色覆盖层
            if (enemy.isDead) {
                const fadeProgress = 1 - (enemy.deathEffectEndTime - now) / enemy.deathEffectDuration;
                ctx.globalAlpha = 0.6 * (1 - fadeProgress); // 随时间渐隐
                ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
                ctx.globalAlpha = 1;
            }

            // 1.2 绘制敌人（优先图片，无则降级为彩色矩形）
            if (enemy.image) {
                ctx.drawImage(enemy.image, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                ctx.fillStyle = enemy.color;
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
                // 绘制白色边框（提升辨识度）
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }

            // 1.3 调试模式：绘制敌人碰撞框与攻击范围
            if (window.GameGlobalConfig?.debug?.enableDebugMode) {
                this._renderEnemyDebugInfo(ctx, enemy);
            }

            ctx.restore();
        });

        // 2. 绘制敌人子弹（优先图片，无则降级为矩形）
        this.enemyState.enemyBullets.forEach(bullet => {
            if (!bullet) return;

            ctx.save();
            if (bullet.image) {
                ctx.drawImage(bullet.image, bullet.x, bullet.y, bullet.width, bullet.height);
            } else {
                ctx.fillStyle = bullet.color;
                ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
            ctx.restore();
        });

        // 3. 调试模式：绘制波次与生成信息
        if (window.GameGlobalConfig?.debug?.enableDebugMode) {
            this._renderDebugInfo(ctx);
        }
    }

    /**
     * 调试模式：绘制敌人碰撞框与攻击范围
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} enemy - 敌人实例
     */
    _renderEnemyDebugInfo(ctx, enemy) {
        // 1. 碰撞框（红色虚线）
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.setLineDash([]);

        // 2. 攻击范围（蓝色虚线圆）
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(
            enemy.x + enemy.width/2,
            enemy.y + enemy.height/2,
            enemy.attackRange,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        // 3. 血量文字（顶部居中）
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${enemy.health}/${enemy.maxHealth}`,
            enemy.x + enemy.width/2,
            enemy.y - 5
        );
        ctx.textAlign = 'start';
    }

    /**
     * 调试模式：绘制波次、生成时间等信息
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    _renderDebugInfo(ctx) {
        const now = Date.now();
        const { currentWave, nextSpawnTime, nextWaveTime, spawnedThisWave } = this.enemyState;
        const maxEnemyThisWave =