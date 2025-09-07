/**
 * 事件总线模块：负责游戏内所有模块间的事件通信，解耦模块依赖
 * 核心功能：事件订阅、发布、取消订阅、批量清除，支持一次性事件
 */
class EventBus {
    constructor() {
        // 存储事件映射：key=事件名，value=事件回调数组（每个元素含回调+是否一次性）
        this.eventMap = new Map();
        // 存储全局事件前缀（避免事件名冲突）
        this.eventPrefix = 'game_';
        // 调试模式（从全局配置读取，控制日志输出）
        this.debugMode = window.GameGlobalConfig?.debug?.enableDebugMode || false;
    }

    /**
     * 生成带前缀的事件名（避免不同模块事件名冲突）
     * @param {string} eventName - 原始事件名（如"player_level_up"）
     * @returns {string} 带前缀的事件名（如"game_player_level_up"）
     */
    getPrefixedEventName(eventName) {
        if (typeof eventName !== 'string' || eventName.trim() === '') {
            this._logError('事件名必须为非空字符串');
            return '';
        }
        return `${this.eventPrefix}${eventName.trim()}`;
    }

    /**
     * 订阅事件（重复订阅同一回调会被忽略）
     * @param {string} eventName - 事件名（如"player_level_up"）
     * @param {Function} callback - 事件触发时的回调函数（接收事件参数）
     * @param {boolean} once - 是否为一次性事件（触发后自动取消订阅，默认false）
     * @returns {boolean} 订阅成功返回true，失败返回false
     */
    on(eventName, callback, once = false) {
        // 参数校验
        if (typeof callback !== 'function') {
            this._logError(`订阅事件"${eventName}"失败：回调必须是函数`);
            return false;
        }

        const prefixedEvent = this.getPrefixedEventName(eventName);
        if (!prefixedEvent) return false;

        // 初始化事件回调数组（若不存在）
        if (!this.eventMap.has(prefixedEvent)) {
            this.eventMap.set(prefixedEvent, []);
        }

        const callbacks = this.eventMap.get(prefixedEvent);
        // 避免重复订阅同一回调（防止多次触发）
        const isDuplicate = callbacks.some(item => item.callback === callback);
        if (isDuplicate) {
            this._logDebug(`事件"${eventName}"已订阅该回调，无需重复订阅`);
            return true;
        }

        // 添加回调到数组（存储回调+一次性标记）
        callbacks.push({ callback, once });
        this._logDebug(`成功订阅事件"${eventName}"，当前订阅数：${callbacks.length}`);
        return true;
    }

    /**
     * 订阅一次性事件（触发后自动取消订阅）
     * @param {string} eventName - 事件名
     * @param {Function} callback - 事件回调
     * @returns {boolean} 订阅成功返回true，失败返回false
     */
    once(eventName, callback) {
        return this.on(eventName, callback, true);
    }

    /**
     * 发布事件（触发所有订阅该事件的回调）
     * @param {string} eventName - 事件名（如"player_level_up"）
     * @param  {...any} args - 传递给回调的参数（可多个）
     * @returns {boolean} 发布成功返回true，无订阅回调返回false
     */
    emit(eventName, ...args) {
        const prefixedEvent = this.getPrefixedEventName(eventName);
        if (!this.eventMap.has(prefixedEvent)) {
            this._logDebug(`发布事件"${eventName}"：无订阅回调`);
            return false;
        }

        const callbacks = [...this.eventMap.get(prefixedEvent)]; // 浅拷贝，避免触发时数组变化
        let triggeredCount = 0;

        // 遍历触发回调，处理一次性事件
        for (let i = 0; i < callbacks.length; i++) {
            const { callback, once } = callbacks[i];
            try {
                // 执行回调并传递参数
                callback(...args);
                triggeredCount++;

                // 若为一次性事件，从原数组中移除
                if (once) {
                    const originalCallbacks = this.eventMap.get(prefixedEvent);
                    const index = originalCallbacks.findIndex(item => item.callback === callback);
                    if (index !== -1) {
                        originalCallbacks.splice(index, 1);
                    }
                }
            } catch (error) {
                this._logError(`触发事件"${eventName}"的回调失败：`, error);
            }
        }

        this._logDebug(`发布事件"${eventName}"：成功触发${triggeredCount}个回调`);
        return triggeredCount > 0;
    }

    /**
     * 取消订阅事件（支持取消单个回调或所有回调）
     * @param {string} eventName - 事件名（如"player_level_up"）
     * @param {Function|null} callback - 要取消的回调（传null则取消该事件所有订阅）
     * @returns {boolean} 取消成功返回true，无对应订阅返回false
     */
    off(eventName, callback = null) {
        const prefixedEvent = this.getPrefixedEventName(eventName);
        if (!this.eventMap.has(prefixedEvent)) {
            this._logDebug(`取消订阅事件"${eventName}"：无该事件订阅`);
            return false;
        }

        const originalCallbacks = this.eventMap.get(prefixedEvent);
        let removedCount = 0;

        // 情况1：取消该事件所有订阅
        if (callback === null) {
            removedCount = originalCallbacks.length;
            this.eventMap.delete(prefixedEvent);
        }
        // 情况2：取消指定回调
        else if (typeof callback === 'function') {
            const initialLength = originalCallbacks.length;
            // 过滤掉目标回调
            const newCallbacks = originalCallbacks.filter(item => item.callback !== callback);
            removedCount = initialLength - newCallbacks.length;
            // 更新回调数组（若过滤后为空，删除事件键）
            if (newCallbacks.length === 0) {
                this.eventMap.delete(prefixedEvent);
            } else {
                this.eventMap.set(prefixedEvent, newCallbacks);
            }
        }
        // 参数错误
        else {
            this._logError(`取消订阅事件"${eventName}"失败：回调必须是函数或null`);
            return false;
        }

        this._logDebug(`取消订阅事件"${eventName}"：成功移除${removedCount}个回调`);
        return removedCount > 0;
    }

    /**
     * 清除所有事件订阅（游戏重置/结束时调用）
     */
    clearAll() {
        const eventCount = this.eventMap.size;
        this.eventMap.clear();
        this._logDebug(`清除所有事件订阅：共清除${eventCount}个事件类型`);
    }

    /**
     * 获取指定事件的订阅数量（调试用）
     * @param {string} eventName - 事件名
     * @returns {number} 订阅回调数量（无该事件返回0）
     */
    getSubscriptionCount(eventName) {
        const prefixedEvent = this.getPrefixedEventName(eventName);
        return this.eventMap.has(prefixedEvent) ? this.eventMap.get(prefixedEvent).length : 0;
    }

    /**
     * 调试日志输出（仅调试模式下显示）
     * @param  {...any} args - 日志内容
     */
    _logDebug(...args) {
        if (this.debugMode) {
            console.log(`[EventBus Debug]`, ...args);
        }
    }

    /**
     * 错误日志输出（无论是否调试模式都显示）
     * @param  {...any} args - 错误内容
     */
    _logError(...args) {
        console.error(`[EventBus Error]`, ...args);
    }
}

// 实例化事件总线（单例模式，确保全局唯一）
const eventBus = new EventBus();

// 导出事件总线实例（兼容Node.js和浏览器环境）
try {
    module.exports = eventBus;
} catch (e) {
    // 浏览器环境挂载到window，供所有模块全局访问
    window.EventBus = eventBus;
    // 同时挂载常用事件名常量（避免硬编码错误）
    window.GameEvents = {
        // 玩家相关事件
        PLAYER_LEVEL_UP: 'player_level_up',       // 玩家升级
        PLAYER_HIT: 'player_hit',                 // 玩家受击
        PLAYER_DEATH: 'player_death',             // 玩家死亡
        PLAYER_SKILL_ACTIVATE: 'player_skill_activate', // 玩家激活技能
        PLAYER_FIRE: 'player_fire',               // 玩家射击
        // 敌人相关事件
        ENEMY_SPAWN: 'enemy_spawn',               // 敌人生成
        ENEMY_DEATH: 'enemy_death',               // 敌人死亡
        ENEMY_HIT: 'enemy_hit',                   // 敌人受击
        // BOSS相关事件
        BOSS_SPAWN: 'boss_spawn',                 // BOSS生成
        BOSS_DEATH: 'boss_death',                 // BOSS死亡
        BOSS_HIT: 'boss_hit',                     // BOSS受击
        BOSS_SKILL: 'boss_skill',                 // BOSS释放技能
        BOSS_WARNING: 'boss_warning',             // BOSS出现警告
        // 游戏状态事件
        GAME_START: 'game_start',                 // 游戏开始
        GAME_PAUSE: 'game_pause',                 // 游戏暂停
        GAME_RESUME: 'game_resume',               // 游戏继续
        GAME_OVER: 'game_over',                   // 游戏结束
        GAME_RESET: 'game_reset',                 // 游戏重置
        // 道具相关事件
        ITEM_PICKUP: 'item_pickup',               // 拾取道具
        // UI相关事件
        UI_SKILL_SELECT: 'ui_skill_select',       // 技能选择弹窗触发
        UI_SETTING_CHANGE: 'ui_setting_change'    // 游戏设置变更
    };
}
