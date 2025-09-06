// 成就系统模块（管理成就解锁、状态记录与弹窗提示）
class AchievementManager {
    constructor() {
        // 初始化成就状态（基于配置，默认全部未解锁）
        this.achievements = this.#initAchievements();
        // 缓存游戏数据（用于实时检测成就条件）
        this.gameData = {
            score: 0,
            enemyKilled: 0,
            bossKilled: 0,
            gameTime: 0,
            skillUsed: 0,
            consecutiveKills: 0,
            level: 1,
            bossKilledWithoutDamage: 0,
            fullLifeTime: 0
        };
    }

    // ------------------------------ 初始化方法 ------------------------------
    /**
     * 从GameConfig初始化成就列表（添加解锁状态）
     * @returns {Object} 格式化后的成就对象（key为成就ID，value为成就详情）
     */
    #initAchievements() {
        return GameConfig.achievement.list.reduce((acc, ach) => {
            acc[ach.id] = {
                id: ach.id,
                name: ach.name,
                desc: ach.desc,
                condition: ach.condition,
                unlocked: false // 初始未解锁
            };
            return acc;
        }, {});
    }

    // ------------------------------ 数据同步 ------------------------------
    /**
     * 同步游戏实时数据到成就系统（从GameState读取）
     * 用于后续成就条件检测
     */
    syncGameData() {
        this.gameData.score = GameState.score;
        this.gameData.enemyKilled = GameState.enemyKilledCount;
        this.gameData.bossKilled = GameState.bossKilledCount;
        this.gameData.gameTime = GameState.gameTime;
        this.gameData.skillUsed = GameState.skillUsedCount;
        this.gameData.consecutiveKills = GameState.consecutiveKills;
        this.gameData.level = GameState.level;
        this.gameData.bossKilledWithoutDamage = GameState.bossKilledWithoutDamage;
        
        // 计算"保持满血时长"（仅当生命值满且无伤害时累加）
        if (GameState.lives === GameConfig.lifeRegen.maxLives) {
            const currentTime = Date.now();
            const lastDamage = GameState.lastDamageTime || currentTime;
            this.gameData.fullLifeTime = Math.max(this.gameData.fullLifeTime, currentTime - lastDamage);
        }
    }

    // ------------------------------ 成就检测 ------------------------------
    /**
     * 检测所有未解锁成就的条件是否满足
     * 游戏主循环中调用，实时检测
     */
    checkAllAchievements() {
        if (!GameState.running) return;
        
        // 遍历所有成就，逐个检测条件
        Object.values(this.achievements).forEach(achievement => {
            if (!achievement.unlocked && this.#isConditionMet(achievement)) {
                this.#unlockAchievement(achievement);
            }
        });
    }

    /**
     * 检测单个成就的条件是否满足
     * @param {Object} achievement - 单个成就对象
     * @returns {boolean} 条件是否满足
     */
    #isConditionMet(achievement) {
        try {
            // 调用成就配置中的条件函数，传入当前游戏数据
            return achievement.condition(this.gameData);
        } catch (e) {
            console.warn(`成就${achievement.name}条件检测失败:`, e);
            return false;
        }
    }

    // ------------------------------ 成就解锁 ------------------------------
    /**
     * 解锁指定成就（标记状态+显示弹窗）
     * @param {Object} achievement - 要解锁的成就对象
     */
    #unlockAchievement(achievement) {
        // 标记为已解锁
        achievement.unlocked = true;
        // 通过UI管理器显示成就弹窗
        uiManager.showAchievement(achievement.name, achievement.desc);
        // 可选：记录成就解锁日志（便于调试）
        console.log(`[成就解锁] ${achievement.name}: ${achievement.desc}`);
    }

    // ------------------------------ 特殊成就触发 ------------------------------
    /**
     * 手动触发"无伤击败BOSS"成就（需在BOSS击败时检测是否无伤）
     * @param {boolean} isNoDamage - 是否无伤击败BOSS
     */
    triggerNoDamageBoss(isNoDamage) {
        if (isNoDamage) {
            GameState.bossKilledWithoutDamage++;
            this.syncGameData(); // 同步数据后重新检测成就
            this.checkAllAchievements();
        }
    }

    // ------------------------------ 状态重置 ------------------------------
    /**
     * 重置所有成就状态（游戏重新开始时调用）
     * 注意：仅重置"解锁状态"，不删除成就配置
     */
    reset() {
        // 重置成就解锁状态
        Object.values(this.achievements).forEach(achievement => {
            achievement.unlocked = false;
        });
        // 重置游戏数据缓存
        this.gameData = {
            score: 0,
            enemyKilled: 0,
            bossKilled: 0,
            gameTime: 0,
            skillUsed: 0,
            consecutiveKills: 0,
            level: 1,
            bossKilledWithoutDamage: 0,
            fullLifeTime: 0
        };
    }

    // ------------------------------ 辅助方法 ------------------------------
    /**
     * 获取已解锁成就列表（用于游戏结束页面展示，可选扩展）
     * @returns {Array} 已解锁的成就数组
     */
    getUnlockedAchievements() {
        return Object.values(this.achievements).filter(ach => ach.unlocked);
    }
}

// 实例化成就管理器（全局唯一，供其他模块调用）
const achievementManager = new AchievementManager();

// 绑定游戏状态重置事件（重新开始游戏时重置成就检测状态）
document.addEventListener('gameReset', () => {
    achievementManager.reset();
});

// 绑定BOSS击败事件（用于检测"无伤击败BOSS"成就，需在BOSS模块触发）
document.addEventListener('bossKilled', (e) => {
    const isNoDamage = e.detail.isNoDamage;
    achievementManager.triggerNoDamageBoss(isNoDamage);
});
