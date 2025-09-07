/**
 * 游戏状态管理模块：统一管理游戏全局状态（如分数、等级、设置、战斗状态），
 * 提供状态读写、监听、变更通知能力，确保状态一致性与模块间数据同步
 */
class GameState {
    constructor() {
        // 1. 基础游戏状态（初始化默认值）
        this.baseState = {
            isGameStarted: false,   // 游戏是否已开始（false=未开始，true=运行中）
            isGameOver: false,      // 游戏是否结束（false=正常，true=结束）
            isPaused: false,        // 游戏是否暂停（false=正常，true=暂停）
            currentScene: 'menu',   // 当前游戏场景（menu=菜单，game=战斗，over=结束界面）
            gameStartTime: 0        // 游戏开始时间戳（毫秒，用于计算游戏时长）
        };

        // 2. 玩家核心数据（与PlayerConfig联动，初始化默认值）
        this.playerState = {
            level: 1,               // 玩家当前等级（初始1级）
            score: 0,               // 玩家当前分数（初始0分）
            lives: window.PlayerConfig?.baseAttr?.initialLives || 3, // 剩余生命（默认3条）
            maxLives: window.PlayerConfig?.baseAttr?.maxLives || 5,  // 最大生命上限
            currentExp: 0,          // 当前升级经验（每级所需经验=levelUpScore）
            levelUpScore: window.GameGlobalConfig?.gameRule?.levelUpBaseScore || 100, // 升级所需分数
            isInvincible: false,    // 是否处于无敌状态（false=正常，true=无敌）
            invincibleEndTime: 0    // 无敌状态结束时间戳（毫秒）
        };

        // 3. 游戏设置状态（与GameGlobalConfig联动，初始化默认值）
        this.settingState = {
            soundEnable: window.GameGlobalConfig?.sound?.enableDefault || true, // 音效是否开启
            musicEnable: window.GameGlobalConfig?.sound?.enableDefault || true, // 音乐是否开启
            vibrationEnable: window.GameGlobalConfig?.sound?.vibrationEnableDefault || true, // 振动是否开启
            soundVolume: window.GameGlobalConfig?.sound?.soundVolumeDefault || 0.8, // 音效音量（0-1）
            musicVolume: window.GameGlobalConfig?.sound?.musicVolumeDefault || 0.8, // 音乐音量（0-1）
            fixedJoystick: window.GameGlobalConfig?.input?.joystick?.fixedModeDefault || false, // 摇杆是否固定
            autoFire: window.GameGlobalConfig?.input?.button?.autoFireDefault || false // 是否开启自动射击
        };

        // 4. 战斗状态数据（与EnemyConfig、BossConfig联动）
        this.battleState = {
            enemyCount: 0,          // 当前屏幕敌人数量
            maxEnemyCount: window.EnemyConfig?.EnemyGlobalConfig?.spawn?.maxOnScreen || 15, // 最大敌人数量
            bossSpawned: false,     // 是否有BOSS已生成（false=无，true=有）
            bossId: null,           // 当前存在的BOSS ID（null=无BOSS）
            bossHealth: 0,          // 当前BOSS剩余血量
            bossMaxHealth: 0,       // 当前BOSS最大血量
            lastEnemySpawnTime: 0,  // 上次敌人生成时间戳（毫秒）
            lastBossSpawnTime: 0    // 上次BOSS生成时间戳（毫秒）
        };

        // 状态变更监听器（key=状态类型，value=回调数组）
        this.stateListeners = {
            base: [],    // 基础状态监听器
            player: [],  // 玩家状态监听器
            setting: [], // 设置状态监听器
            battle: []   // 战斗状态监听器
        };

        // 依赖模块引用（事件总线、全局配置）
        this.eventBus = window.EventBus;
        this.GameEvents = window.GameEvents;
        this.debugMode = window.GameGlobalConfig?.debug?.enableDebugMode || false;

        // 初始化：订阅游戏事件，同步状态变更
        this._initEventSubscription();
    }

    /**
     * 初始化事件订阅：响应外部事件（如玩家升级、BOSS生成），同步更新内部状态
     */
    _initEventSubscription() {
        if (!this.eventBus || !this.GameEvents) {
            this._logError('事件总线或事件常量未初始化，无法订阅事件');
            return;
        }

        // 1. 玩家升级事件：更新玩家等级、升级所需分数
        this.eventBus.on(this.GameEvents.PLAYER_LEVEL_UP, (newLevel) => {
            this.updatePlayerState({
                level: newLevel,
                levelUpScore: Math.floor(this.playerState.levelUpScore * window.GameGlobalConfig.gameRule.levelUpScoreMultiplier)
            });
            this._logDebug(`玩家等级更新至${newLevel}级，下次升级需${this.playerState.levelUpScore}分`);
        });

        // 2. 玩家受击事件：减少生命，触发无敌状态
        this.eventBus.on(this.GameEvents.PLAYER_HIT, () => {
            if (this.playerState.isInvincible) return; // 无敌状态下不扣血

            const newLives = Math.max(0, this.playerState.lives - 1);
            this.updatePlayerState({ lives: newLives });

            // 生命为0时触发游戏结束
            if (newLives === 0) {
                this.setBaseState('isGameOver', true);
                this.setBaseState('currentScene', 'over');
                this.eventBus.emit(this.GameEvents.GAME_OVER);
            } else {
                // 生命>0时触发无敌状态（时长从PlayerConfig读取）
                const invincibilityDuration = window.PlayerConfig.baseAttr.invincibilityDuration;
                this.updatePlayerState({
                    isInvincible: true,
                    invincibleEndTime: Date.now() + invincibilityDuration
                });
                this._logDebug(`玩家受击，剩余生命${newLives}条，进入${invincibilityDuration}ms无敌状态`);
            }
        });

        // 3. BOSS生成事件：更新BOSS战斗状态
        this.eventBus.on(this.GameEvents.BOSS_SPAWN, (bossId, maxHealth) => {
            this.updateBattleState({
                bossSpawned: true,
                bossId: bossId,
                bossHealth: maxHealth,
                bossMaxHealth: maxHealth,
                lastBossSpawnTime: Date.now()
            });
            this._logDebug(`BOSS ${bossId}生成，初始血量${maxHealth}`);
        });

        // 4. BOSS死亡事件：重置BOSS战斗状态
        this.eventBus.on(this.GameEvents.BOSS_DEATH, () => {
            this.updateBattleState({
                bossSpawned: false,
                bossId: null,
                bossHealth: 0,
                bossMaxHealth: 0
            });
            this._logDebug('BOSS已死亡，战斗状态重置');
        });

        // 5. BOSS受击事件：更新BOSS剩余血量
        this.eventBus.on(this.GameEvents.BOSS_HIT, (damage) => {
            if (!this.battleState.bossSpawned) return;

            const newBossHealth = Math.max(0, this.battleState.bossHealth - damage);
            this.updateBattleState({ bossHealth: newBossHealth });
            this._logDebug(`BOSS受击，扣除${damage}点血，剩余${newBossHealth}/${this.battleState.bossMaxHealth}血`);
        });

        // 6. 敌人死亡事件：减少敌人计数
        this.eventBus.on(this.GameEvents.ENEMY_DEATH, () => {
            if (this.battleState.enemyCount > 0) {
                this.updateBattleState({ enemyCount: this.battleState.enemyCount - 1 });
            }
        });

        // 7. 敌人生成事件：增加敌人计数
        this.eventBus.on(this.GameEvents.ENEMY_SPAWN, () => {
            if (this.battleState.enemyCount < this.battleState.maxEnemyCount) {
                this.updateBattleState({ 
                    enemyCount: this.battleState.enemyCount + 1,
                    lastEnemySpawnTime: Date.now()
                });
            }
        });

        // 8. 游戏开始事件：初始化基础状态与玩家状态
        this.eventBus.on(this.GameEvents.GAME_START, () => {
            this.resetGameState(); // 重置游戏状态
            this.setBaseState({
                isGameStarted: true,
                isGameOver: false,
                isPaused: false,
                currentScene: 'game',
                gameStartTime: Date.now()
            });
            this._logDebug('游戏开始，基础状态初始化完成');
        });

        // 9. 游戏暂停/继续事件：同步暂停状态
        this.eventBus.on(this.GameEvents.GAME_PAUSE, () => {
            this.setBaseState('isPaused', true);
        });
        this.eventBus.on(this.GameEvents.GAME_RESUME, () => {
            this.setBaseState('isPaused', false);
        });

        // 10. 游戏重置事件：完全重置所有状态
        this.eventBus.on(this.GameEvents.GAME_RESET, () => {
            this.resetGameState();
            this._logDebug('游戏重置，所有状态恢复默认值');
        });
    }

    /**
     * 基础状态设置：单个或多个基础状态更新
     * @param {string|Object} key - 状态键（如"isPaused"）或状态对象（如{isPaused: true, currentScene: "game"}）
     * @param {any} [value] - 状态值（仅key为字符串时需传）
     */
    setBaseState(key, value) {
        this._updateState('base', key, value);
    }

    /**
     * 玩家状态更新：单个或多个玩家状态更新
     * @param {string|Object} key - 状态键（如"score"）或状态对象（如{score: 100, level: 2}）
     * @param {any} [value] - 状态值（仅key为字符串时需传）
     */
    updatePlayerState(key, value) {
        const result = this._updateState('player', key, value);
        // 若更新了分数，检查是否满足升级条件
        if (result.updatedKeys.includes('score') || result.updatedKeys.includes('currentExp')) {
            this._checkLevelUp();
        }
        return result;
    }

    /**
     * 设置状态更新：单个或多个设置状态更新
     * @param {string|Object} key - 状态键（如"soundEnable"）或状态对象（如{soundEnable: true, autoFire: false}）
     * @param {any} [value] - 状态值（仅key为字符串时需传）
     */
    updateSettingState(key, value) {
        const result = this._updateState('setting', key, value);
        // 发布设置变更事件，通知UI/音效模块同步
        this.eventBus.emit(this.GameEvents.UI_SETTING_CHANGE, {
            type: 'setting',
            updated: result.updated
        });
        return result;
    }

    /**
     * 战斗状态更新：单个或多个战斗状态更新
     * @param {string|Object} key - 状态键（如"enemyCount"）或状态对象（如{enemyCount: 5, bossSpawned: true}）
     * @param {any} [value] - 状态值（仅key为字符串时需传）
     */
    updateBattleState(key, value) {
        return this._updateState('battle', key, value);
    }

    /**
     * 获取完整状态：返回所有状态的深拷贝（避免外部直接修改内部状态）
     * @returns {Object} 包含base、player、setting、battle的完整状态
     */
    getFullState() {
        return {
            base: JSON.parse(JSON.stringify(this.baseState)),
            player: JSON.parse(JSON.stringify(this.playerState)),
            setting: JSON.parse(JSON.stringify(this.settingState)),
            battle: JSON.parse(JSON.stringify(this.battleState))
        };
    }

    /**
     * 状态变更监听：注册指定类型状态的变更回调
     * @param {string} stateType - 状态类型（base/player/setting/battle）
     * @param {Function} callback - 回调函数（参数：{type: 状态类型, updated: 更新的键值对}）
     */
    onStateChange(stateType, callback) {
        if (!this.stateListeners[stateType]) {
            this._logError(`无效的状态类型：${stateType}，可选类型：${Object.keys(this.stateListeners).join(', ')}`);
            return;
        }
        if (typeof callback !== 'function') {
            this._logError('状态监听回调必须是函数');
            return;
        }
        // 避免重复注册同一回调
        if (!this.stateListeners[stateType].includes(callback)) {
            this.stateListeners[stateType].push(callback);
            this._logDebug(`成功注册${stateType}状态监听器，当前监听数：${this.stateListeners[stateType].length}`);
        }
    }

    /**
     * 取消状态监听：移除指定类型的状态回调
     * @param {string} stateType - 状态类型（base/player/setting/battle）
     * @param {Function} callback - 要移除的回调函数
     */
    offStateChange(stateType, callback) {
        if (!this.stateListeners[stateType]) {
            this._logError(`无效的状态类型：${stateType}`);
            return;
        }
        const initialLength = this.stateListeners[stateType].length;
        this.stateListeners[stateType] = this.stateListeners[stateType].filter(cb => cb !== callback);
        const removedCount = initialLength - this.stateListeners[stateType].length;
        if (removedCount > 0) {
            this._logDebug(`成功移除${stateType}状态监听器，移除数量：${removedCount}`);
        }
    }

    /**
     * 游戏状态完全重置：恢复所有状态到初始默认值
     */
    resetGameState() {
        // 1. 重置基础状态
        this.baseState = {
            isGameStarted: false,
            isGameOver: false,
            isPaused: false,
            currentScene: 'menu',
            gameStartTime: 0
        };

        // 2. 重置玩家状态（从配置读取初始值）
        const initialLives = window.PlayerConfig?.baseAttr?.initialLives || 3;
        const maxLives = window.PlayerConfig?.baseAttr?.maxLives || 5;
        const initialLevelUpScore = window.GameGlobalConfig?.gameRule?.levelUpBaseScore || 100;
        this.playerState = {
            level: 1,
            score: 0,
            lives: initialLives,
            maxLives: maxLives,
            currentExp: 0,
            levelUpScore: initialLevelUpScore,
            isInvincible: false,
            invincibleEndTime: 0
        };

        // 3. 重置战斗状态（从配置读取初始值）
        const maxEnemyCount = window.EnemyConfig?.EnemyGlobalConfig?.spawn?.maxOnScreen || 15;
        this.battleState = {
            enemyCount: 0,
            maxEnemyCount: maxEnemyCount,
            bossSpawned: false,
            bossId: null,
            bossHealth: 0,
            bossMaxHealth: 0,
            lastEnemySpawnTime: 0,
            lastBossSpawnTime: 0
        };

        // 4. 通知所有监听器状态已重置
        Object.keys(this.stateListeners).forEach(type => {
            this._notifyListeners(type, {
                [type]: this[`${type}State`],
                isReset: true
            });
        });
    }

    /**
     * 检查无敌状态是否过期（每帧调用，由GameLoop驱动）
     */
    checkInvincibilityExpire() {
        if (this.playerState.isInvincible && Date.now() >= this.playerState.invincibleEndTime) {
            this.updatePlayerState('isInvincible', false);
            this._logDebug('玩家无敌状态已过期');
        }
    }

    /**
     * 内部工具：通用状态更新逻辑（支持单个/多个状态更新）
     * @param {string} stateType - 状态类型（base/player/setting/battle）
     * @param {string|Object} key - 状态键或状态对象
     * @param {any} value - 状态值（仅key为字符串时有效）
     * @returns {Object} 更新结果（updated: 更新的键值对, updatedKeys: 更新的键数组）
     */
    _updateState(stateType, key, value) {
        const targetState = this[`${stateType}State`];
        if (!targetState) {
            this._logError(`不存在的状态类型：${stateType}`);
            return { updated: {}, updatedKeys: [] };
        }

        let updates = {};
        // 情况1：key是对象（批量更新）
        if (typeof key === 'object' && key !== null) {
            updates = { ... ...key };
        }
        // 情况2：key是字符串（单个更新）
        else if (typeof key === 'string') {
            updates[key] = value;
        }
        // 情况3：参数错误
        else {
            this._logError('状态更新参数错误：key必须是字符串或对象');
            return { updated: {}, updatedKeys: [] };
        }

        // 过滤无效更新（值未变化的不处理）
        const validUpdates = {};
        Object.keys(updates).forEach(k => {
            // 仅当目标状态存在该键，且值与当前不同时，才视为有效更新
            if (targetState.hasOwnProperty(k) && targetState[k] !== updates[k]) {
                validUpdates[k] = updates[k];
            }
        });

        if (Object.keys(validUpdates).length === 0) {
            this._logDebug(`[${stateType}] 状态无变化，无需更新`);
            return { updated: {}, updatedKeys: [] };
        }

        // 执行状态更新（覆盖目标状态的有效键）
        Object.assign(targetState, validUpdates);
        const updatedKeys = Object.keys(validUpdates);

        // 通知所有监听该状态类型的回调
        this._notifyListeners(stateType, validUpdates);

        this._logDebug(`[${stateType}] 状态更新完成，更新键：${updatedKeys.join(', ')}，更新值：`, validUpdates);
        return { updated: validUpdates, updatedKeys: updatedKeys };
    }

    /**
     * 内部工具：通知状态监听器（触发所有注册的回调）
     * @param {string} stateType - 状态类型（base/player/setting/battle）
     * @param {Object} updates - 已更新的键值对
     */
    _notifyListeners(stateType, updates) {
        const listeners = this.stateListeners[stateType] || [];
        if (listeners.length === 0) return;

        // 遍历所有监听器，执行回调（传递状态类型和更新内容）
        listeners.forEach(callback => {
            try {
                callback({
                    type: stateType,
                    updated: updates,
                    timestamp: Date.now()
                });
            } catch (error) {
                this._logError(`[${stateType}] 状态监听器回调执行失败：`, error);
            }
        });
    }

    /**
     * 内部工具：检查玩家是否满足升级条件（分数达到levelUpScore）
     */
    _checkLevelUp() {
        const { score, level, levelUpScore } = this.playerState;
        // 若当前分数 >= 升级所需分数，触发升级
        if (score >= levelUpScore) {
            const newLevel = level + 1;
            // 发布玩家升级事件（供其他模块响应，如解锁技能槽、提升难度）
            this.eventBus.emit(this.GameEvents.PLAYER_LEVEL_UP, newLevel);
            this._logDebug(`玩家升级触发：当前分数${score} >= 升级所需${levelUpScore}，即将升至${newLevel}级`);
        }
    }

    /**
     * 内部工具：调试日志输出（仅调试模式下显示）
     * @param  {...any} args - 日志内容
     */
    _logDebug(...args) {
        if (this.debugMode) {
            console.log(`[GameState Debug]`, ...args);
        }
    }

    /**
     * 内部工具：错误日志输出（无论是否调试模式都显示）
     * @param  {...any} args - 错误内容
     */
    _logError(...args) {
        console.error(`[GameState Error]`, ...args);
    }
}

// 实例化游戏状态管理器（单例模式，全局唯一）
const gameState = new GameState();

// 导出状态管理器实例（兼容Node.js和浏览器环境）
try {
    module.exports = gameState;
} catch (e) {
    // 浏览器环境挂载到window，供所有模块全局访问
    window.GameState = gameState;
}
