/**
 * 对象池模块：通过复用频繁创建/销毁的对象（如子弹、粒子、敌人），减少内存分配与垃圾回收，提升游戏性能
 * 核心功能：对象类型注册、对象获取、对象回收、池大小动态调整、批量清理
 */
class ObjectPool {
    constructor() {
        // 存储对象池映射：key=对象类型（如"bulletPlayer"、"particleEnemyDeath"），value=该类型的对象池
        this.poolMap = new Map();
        // 全局默认配置（可被单类型配置覆盖）
        this.defaultConfig = {
            initialSize: 10,        // 初始池大小（默认每种对象预创建10个）
            maxSize: 50,            // 最大池大小（默认每种对象最多缓存50个，防止内存溢出）
            autoShrink: true,       // 是否自动收缩（默认开启，闲置对象超过阈值时减少池大小）
            shrinkThreshold: 0.6,   // 收缩阈值（闲置对象占比超过60%时触发收缩）
            shrinkInterval: 30000   // 自动收缩间隔（默认30秒检查一次）
        };
        // 自动收缩定时器（全局统一管理，避免多类型重复计时）
        this.shrinkTimer = null;
        // 依赖模块引用（全局配置、调试模式）
        this.debugMode = window.GameGlobalConfig?.debug?.enableDebugMode || false;
        this.eventBus = window.EventBus;
        this.GameEvents = window.GameEvents;

        // 初始化：订阅游戏重置事件，清理所有对象池
        this._initEventSubscription();
        // 启动全局自动收缩定时器
        this._startAutoShrinkTimer();
    }

    /**
     * 初始化事件订阅：响应游戏重置/结束事件，清理对象池
     */
    _initEventSubscription() {
        if (!this.eventBus || !this.GameEvents) {
            this._logError('事件总线或事件常量未初始化，无法订阅清理事件');
            return;
        }

        // 游戏重置时清理所有对象池（释放闲置对象，保留初始大小）
        this.eventBus.on(this.GameEvents.GAME_RESET, () => {
            this.clearAllPools(true);
            this._logDebug('游戏重置，所有对象池已清理并恢复初始大小');
        });

        // 游戏结束时清空所有对象池（释放所有闲置对象，避免内存占用）
        this.eventBus.on(this.GameEvents.GAME_OVER, () => {
            this.clearAllPools(false);
            this._logDebug('游戏结束，所有对象池已清空');
        });
    }

    /**
     * 启动全局自动收缩定时器：定期检查所有对象池，触发符合条件的池收缩
     */
    _startAutoShrinkTimer() {
        if (this.shrinkTimer) clearInterval(this.shrinkTimer);

        this.shrinkTimer = setInterval(() => {
            this.poolMap.forEach((pool, type) => {
                const { autoShrink, shrinkThreshold, initialSize, maxSize } = pool.config;
                // 仅当开启自动收缩，且闲置对象占比超过阈值时触发
                if (autoShrink && pool.idleList.length / Math.max(pool.activeList.length + pool.idleList.length, 1) >= shrinkThreshold) {
                    // 收缩目标：闲置对象数量不低于初始大小，且不超过最大大小
                    const targetIdleSize = Math.max(initialSize, Math.min(pool.idleList.length, maxSize));
                    if (pool.idleList.length > targetIdleSize) {
                        const removeCount = pool.idleList.length - targetIdleSize;
                        pool.idleList.splice(targetIdleSize); // 移除超出部分的闲置对象
                        this._logDebug(`对象池${type}自动收缩：移除${removeCount}个闲置对象，剩余闲置${pool.idleList.length}个`);
                    }
                }
            });
        }, this.defaultConfig.shrinkInterval);
    }

    /**
     * 注册对象类型：为特定类型对象创建对象池（需指定对象创建函数）
     * @param {string} type - 对象类型（唯一标识，如"bulletPlayer"、"particleEnemyDeath"）
     * @param {Function} createFunc - 对象创建函数（返回新创建的对象，需包含reset()方法用于重置状态）
     * @param {Object} [customConfig] - 单类型自定义配置（覆盖defaultConfig）
     */
    registerType(type, createFunc, customConfig = {}) {
        if (typeof type !== 'string' || type.trim() === '') {
            this._logError('对象类型必须为非空字符串');
            return;
        }
        if (this.poolMap.has(type)) {
            this._logWarn(`对象类型${type}已注册，无需重复注册`);
            return;
        }
        if (typeof createFunc !== 'function') {
            this._logError(`对象类型${type}注册失败：createFunc必须是返回对象的函数`);
            return;
        }

        // 合并默认配置与自定义配置（自定义配置优先级更高）
        const poolConfig = { ...this.defaultConfig, ...customConfig };
        // 初始化对象池：包含活跃列表（正在使用）、闲置列表（待复用）、配置、创建函数
        const pool = {
            activeList: [],    // 正在使用的对象列表
            idleList: [],      // 闲置待复用的对象列表
            config: poolConfig,
            createFunc: createFunc
        };

        // 预创建初始数量的对象，加入闲置列表
        for (let i = 0; i < poolConfig.initialSize; i++) {
            const obj = createFunc();
            // 校验对象是否包含reset()方法（用于复用前重置状态）
            if (typeof obj.reset !== 'function') {
                this._logError(`对象类型${type}创建的对象缺少reset()方法，无法复用`);
                return;
            }
            pool.idleList.push(obj);
        }

        this.poolMap.set(type, pool);
        this._logDebug(`对象类型${type}注册成功：初始池大小${poolConfig.initialSize}，最大池大小${poolConfig.maxSize}`);
    }

    /**
     * 获取对象：从指定类型的对象池获取一个对象（优先复用闲置对象，无闲置则创建新对象）
     * @param {string} type - 对象类型（需提前通过registerType注册）
     * @param  {...any} resetArgs - 传递给对象reset()方法的参数（用于初始化对象状态）
     * @returns {Object|null} 获取到的对象（失败返回null）
     */
    getObject(type, ...resetArgs) {
        if (!this.poolMap.has(type)) {
            this._logError(`获取对象失败：对象类型${type}未注册，请先调用registerType`);
            return null;
        }

        const pool = this.poolMap.get(type);
        let obj;

        // 1. 优先从闲置列表获取对象（复用）
        if (pool.idleList.length > 0) {
            obj = pool.idleList.pop();
        }
        // 2. 闲置列表为空，且未达到最大池大小：创建新对象
        else if (pool.activeList.length + pool.idleList.length < pool.config.maxSize) {
            obj = pool.createFunc();
            this._logDebug(`对象类型${type}无闲置对象，创建新对象（当前总数量：${pool.activeList.length + 1}）`);
        }
        // 3. 已达到最大池大小：无法创建新对象，返回null（避免内存溢出）
        else {
            this._logWarn(`对象类型${type}已达最大池大小${pool.config.maxSize}，无法获取新对象`);
            return null;
        }

        // 重置对象状态（传递reset参数，如子弹的初始位置、方向）
        obj.reset(...resetArgs);
        // 将对象加入活跃列表
        pool.activeList.push(obj);

        return obj;
    }

    /**
     * 回收对象：将使用完毕的对象放回对象池（从活跃列表移至闲置列表，待下次复用）
     * @param {string} type - 对象类型
     * @param {Object} obj - 要回收的对象（必须是该类型池之前分配的对象）
     * @returns {boolean} 回收成功返回true，失败返回false
     */
    recycleObject(type, obj) {
        if (!this.poolMap.has(type)) {
            this._logError(`回收对象失败：对象类型${type}未注册`);
            return false;
        }
        if (!obj) {
            this._logError(`回收对象失败：对象不能为空`);
            return false;
        }

        const pool = this.poolMap.get(type);
        const activeIndex = pool.activeList.findIndex(item => item === obj);

        // 校验对象是否属于该类型的活跃列表（防止回收不属于当前池的对象）
        if (activeIndex === -1) {
            this._logWarn(`回收对象失败：对象不属于${type}的活跃列表，可能已被回收或不属于该池`);
            return false;
        }

        // 1. 从活跃列表移除对象
        pool.activeList.splice(activeIndex, 1);
        // 2. 若闲置列表未达最大大小，将对象加入闲置列表（否则直接丢弃，释放内存）
        if (pool.idleList.length < pool.config.maxSize) {
            pool.idleList.push(obj);
            this._logDebug(`对象类型${type}回收成功：当前闲置${pool.idleList.length}个，活跃${pool.activeList.length}个`);
        } else {
            this._logDebug(`对象类型${type}闲置列表已达最大大小，回收对象被丢弃`);
        }

        return true;
    }

    /**
     * 清理指定对象池：清空闲置列表，可选保留初始大小
     * @param {string} type - 对象类型
     * @param {boolean} keepInitial - 是否保留初始大小（true=保留initialSize个闲置对象，false=清空所有闲置）
     */
    clearPool(type, keepInitial = true) {
        if (!this.poolMap.has(type)) {
            this._logError(`清理对象池失败：对象类型${type}未注册`);
            return;
        }

        const pool = this.poolMap.get(type);
        const initialSize = pool.config.initialSize;
        // 清理逻辑：保留指定数量的闲置对象（或清空）
        if (keepInitial) {
            const removeCount = pool.idleList.length - initialSize;
            if (removeCount > 0) {
                pool.idleList.splice(initialSize);
                this._logDebug(`对象池${type}清理完成：保留${initialSize}个闲置对象，移除${removeCount}个`);
            }
        } else {
            const clearCount = pool.idleList.length;
            pool.idleList = [];
            this._logDebug(`对象池${type}清理完成：清空所有${clearCount}个闲置对象`);
        }
    }

    /**
     * 清理所有对象池：批量清理所有已注册类型的对象池
     * @param {boolean} keepInitial - 是否保留初始大小（true=保留initialSize，false=清空所有闲置）
     */
    clearAllPools(keepInitial = true) {
        this.poolMap.forEach((_, type) => {
            this.clearPool(type, keepInitial);
        });
    }

    /**
     * 获取对象池状态（调试用）：返回指定类型或所有类型的池状态（活跃/闲置数量、配置）
     * @param {string|null} [type=null] - 对象类型（null=返回所有类型状态）
     * @returns {Object} 对象池状态
     */
    getPoolState(type = null) {
        const state = {};
        if (type) {
            if (!this.poolMap.has(type)) {
                this._logError(`获取状态失败：对象类型${type}未注册`);
                return state;
            }
            const pool = this.poolMap.get(type);
            state[type] = {
                activeCount: pool.activeList.length,
                idleCount: pool.idleList.length,
                totalCount: pool.activeList.length + pool.idleList.length,
                config: { ...pool.config }
            };
        } else {
            this.poolMap.forEach((pool, typeKey) => {
                state[typeKey] = {
                    activeCount: pool.activeList.length,
                    idleCount: pool.idleList.length,
                    totalCount: pool.activeList.length + pool.idleList.length,
                    config: { ...pool.config }
                };
            });
        }
        return state;
    }

    /**
     * 调试日志：仅调试模式下输出
     * @param  {...any} args - 日志内容
     */
    _logDebug(...args) {
        if (this.debugMode) {
            console.log(`[ObjectPool Debug]`, ...args);
        }
    }

    /**
     * 警告日志：无论是否调试模式都输出（非致命错误）
     * @param  {...any} args - 日志内容
     */
    _logWarn(...args) {
        console.warn(`[ObjectPool Warn]`, ...args);
    }

    /**
     * 错误日志：无论是否调试模式都输出（致命错误）
     * @param  {...any} args - 日志内容
     */
    _logError(...args) {
        console.error(`[ObjectPool Error]`, ...args);
    }
}

// 实例化对象池（单例模式，全局唯一）
const objectPool = new ObjectPool();

// 导出对象池实例（兼容Node.js和浏览器环境）
try {
    module.exports = objectPool;
} catch (e) {
    // 浏览器环境挂载到window，供子弹、粒子、敌人等模块调用
    window.ObjectPool = objectPool;
    // 预注册游戏常用对象类型（基于全局配置，减少业务模块注册代码）
    window.ObjectPool.initCommonTypes = () => {
        const gameConfig = window.GameGlobalConfig;
        if (!gameConfig) return;

        // 1. 预注册玩家子弹对象池（基于GameGlobalConfig的子弹池大小）
        if (window.PlayerBullet) {
            window.ObjectPool.registerType(
                'bulletPlayer',
                () => new window.PlayerBullet(), // 假设PlayerBullet已定义且含reset()
                { initialSize: gameConfig.gameRule.bulletPoolSize, maxSize: gameConfig.gameRule.bulletPoolSize * 2 }
            );
        }

        // 2. 预注册敌人子弹对象池
        if (window.EnemyBullet) {
            window.ObjectPool.registerType(
                'bulletEnemy',
                () => new window.EnemyBullet(), // 假设EnemyBullet已定义且含reset()
                { initialSize: gameConfig.gameRule.bulletPoolSize, maxSize: gameConfig.gameRule.bulletPoolSize * 2 }
            );
        }

        // 3. 预注册粒子对象池（基于GameGlobalConfig的粒子池大小）
        if (window.Particle) {
            window.ObjectPool.registerType(
                'particle',
                () => new window.Particle(), // 假设Particle已定义且含reset()
                { initialSize: gameConfig.gameRule.particlePoolSize, maxSize: gameConfig.gameRule.particlePoolSize * 2 }
            );
        }

        // 4. 预注册基础敌人对象池（基于EnemyConfig的最大屏幕敌人数量）
        if (window.Enemy && window.EnemyConfig) {
            const maxEnemy = window.EnemyConfig.EnemyGlobalConfig.spawn.maxOnScreen;
            window.ObjectPool.registerType(
                'enemySmallFighter',
                () => new window.Enemy('smallFighter'), // 假设Enemy已定义且含reset()
                { initialSize: maxEnemy / 2, maxSize: maxEnemy * 2 }
            );
        }

        window.ObjectPool._logDebug('游戏常用对象类型预注册完成');
    };
}
