/**
 * 成就管理系统模块：负责游戏成就的配置、进度追踪、条件判定与奖励发放，
 * 通过事件总线同步成就状态，支持成就解锁动画与进度UI更新，增强游戏可玩性
 */
class AchievementManager {
    constructor() {
        // 基础依赖引用
        this.eventBus = window.EventBus; // 事件总线（订阅游戏行为、发布成就事件）
        this.gameState = window.GameState; // 游戏状态（获取玩家数据、战斗数据）
        this.gameLoop = window.GameLoop; // 主循环（注册成就解锁动画渲染）
        this.localStorageKey = 'gameAchievementData'; // 本地存储键（持久化成就进度）

        // 成就核心配置（按类型分类，支持多维度解锁条件）
        this.achievementConfig = {
            // 战斗类成就（击败BOSS、累计伤害等）
            battle: [
                {
                    id: 'achievement_boss_first_kill',
                    name: '初露锋芒',
                    desc: '首次击败任意BOSS',
                    iconKey: 'achievement_boss_first',
                    type: 'battle',
                    condition: {
                        type: 'bossKillCount', // 条件类型：BOSS击杀次数
                        target: 1, // 目标值：1次
                        current: 0 // 初始进度：0
                    },
                    reward: {
                        type: 'score', // 奖励类型：分数
                        value: 10000 // 奖励值：10000分
                    },
                    isUnlocked: false // 是否已解锁
                },
                {
                    id: 'achievement_boss_5_kills',
                    name: 'BOSS猎手',
                    desc: '累计击败5个BOSS',
                    iconKey: 'achievement_boss_5',
                    type: 'battle',
                    condition: {
                        type: 'bossKillCount',
                        target: 5,
                        current: 0
                    },
                    reward: {
                        type: 'skillShard', // 奖励类型：技能碎片
                        skillKey: 'shield', // 对应技能：护盾
                        value: 2 // 奖励值：2个碎片
                    },
                    isUnlocked: false
                },
                {
                    id: 'achievement_total_damage_10000',
                    name: '伤害大师',
                    desc: '累计造成10000点伤害',
                    iconKey: 'achievement_damage_10000',
                    type: 'battle',
                    condition: {
                        type: 'totalDamage', // 条件类型：累计伤害
                        target: 10000,
                        current: 0
                    },
                    reward: {
                        type: 'life', // 奖励类型：生命
                        value: 1 // 奖励值：1条生命
                    },
                    isUnlocked: false
                }
            ],
            // 得分类成就（累计分数、单次得分等）
            score: [
                {
                    id: 'achievement_score_50000',
                    name: '得分新秀',
                    desc: '累计获得50000分',
                    iconKey: 'achievement_score_50000',
                    type: 'score',
                    condition: {
                        type: 'totalScore', // 条件类型：累计分数
                        target: 50000,
                        current: 0
                    },
                    reward: {
                        type: 'score',
                        value: 5000
                    },
                    isUnlocked: false
                },
                {
                    id: 'achievement_score_200000',
                    name: '得分王者',
                    desc: '累计获得200000分',
                    iconKey: 'achievement_score_200000',
                    type: 'score',
                    condition: {
                        type: 'totalScore',
                        target: 200000,
                        current: 0
                    },
                    reward: {
                        type: 'skillUnlocked', // 奖励类型：直接解锁技能
                        skillKey: 'ultimate', // 对应技能：终极技能
                        value: 1
                    },
                    isUnlocked: false
                },
                {
                    id: 'achievement_single_battle_30000',
                    name: '单局之星',
                    desc: '单局战斗获得30000分',
                    iconKey: 'achievement_single_30000',
                    type: 'score',
                    condition: {
                        type: 'singleBattleScore', // 条件类型：单局分数
                        target: 30000,
                        current: 0
                    },
                    reward: {
                        type: 'score',
                        value: 8000
                    },
                    isUnlocked: false
                }
            ],
            // 收集类成就（拾取道具、解锁技能等）
            collect: [
                {
                    id: 'achievement_collect_life_5',
                    name: '生命收藏家',
                    desc: '累计拾取5个生命包',
                    iconKey: 'achievement_collect_life',
                    type: 'collect',
                    condition: {
                        type: 'itemCollectCount', // 条件类型：道具拾取次数
                        itemKey: 'life', // 道具类型：生命包
                        target: 5,
                        current: 0
                    },
                    reward: {
                        type: 'life',
                        value: 2
                    },
                    isUnlocked: false
                },
                {
                    id: 'achievement_unlock_3_skills',
                    name: '技能大师',
                    desc: '累计解锁3个主动技能',
                    iconKey: 'achievement_skill_3',
                    type: 'collect',
                    condition: {
                        type: 'unlockedSkillCount', // 条件类型：解锁技能数量
                        target: 3,
                        current: 0
                    },
                    reward: {
                        type: 'skillShard',
                        skillKey: 'all', // 所有技能碎片
                        value: 1 // 每个技能各1个
                    },
                    isUnlocked: false
                }
            ]
        };

        // 成就状态管理（解锁动画、本地存储）
        this.achievementState = {
            pendingAnimations: [], // 待播放的解锁动画队列
            lastSaveTime: 0, // 上次本地存储时间（毫秒）
            saveInterval: 30000 // 本地存储间隔（30秒，避免频繁IO）
        };

        // 初始化：加载本地存储的成就进度，订阅游戏行为事件
        this._loadFromLocalStorage();
        this._subscribeGameEvents();
        // 注册成就动画渲染到主循环
        this.gameLoop.registerRenderObj('ui', this);
    }

    /**
     * 订阅游戏核心事件（玩家行为、战斗结果等），用于更新成就进度
     */
    _subscribeGameEvents() {
        // 1. BOSS死亡事件：更新BOSS击杀次数成就
        this.eventBus.on(window.GameEvents.BOSS_DEATH, () => {
            this._updateAchievementProgress('bossKillCount', 1);
        });

        // 2. 玩家造成伤害事件：更新累计伤害成就
        this.eventBus.on(window.GameEvents.PLAYER_DAMAGE_DEAL, (damage) => {
            this._updateAchievementProgress('totalDamage', damage);
        });

        // 3. 玩家分数变化事件：更新累计分数、单局分数成就
        this.eventBus.on(window.GameEvents.PLAYER_SCORE_CHANGE, (newScore, singleBattleScore) => {
            this._updateAchievementProgress('totalScore', newScore - this.achievementConfig.score.find(a => a.condition.type === 'totalScore').condition.current);
            this._updateAchievementProgress('singleBattleScore', singleBattleScore);
        });

        // 4. 道具拾取事件：更新道具收集成就
        this.eventBus.on(window.GameEvents.ITEM_PICKUP, (itemType) => {
            this._updateAchievementProgress('itemCollectCount', 1, { itemKey: itemType });
        });

        // 5. 技能解锁事件：更新解锁技能数量成就
        this.eventBus.on(window.GameEvents.PLAYER_SKILL_ACTIVATE, () => {
            const unlockedCount = this.gameState.getFullState().player.unlockedSkills.length;
            this._updateAchievementProgress('unlockedSkillCount', unlockedCount, { overwrite: true });
        });

        // 6. 游戏重置事件：重置单局相关成就进度（如单局分数）
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._resetSingleBattleProgress();
        });

        // 7. 游戏结束事件：强制保存成就进度
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._saveToLocalStorage(true);
        });
    }

    /**
     * 更新成就进度：根据条件类型匹配成就，累加或覆盖进度
     * @param {string} conditionType - 条件类型（如bossKillCount、totalDamage）
     * @param {number} value - 进度变化值（或当前值，当overwrite为true时）
     * @param {Object} [options={}] - 额外参数（如itemKey：道具类型）
     * @param {boolean} [options.overwrite=false] - 是否直接覆盖进度（而非累加）
     * @param {string} [options.itemKey=''] - 道具类型（仅itemCollectCount条件用）
     */
    _updateAchievementProgress(conditionType, value, options = {}) {
        const { overwrite = false, itemKey = '' } = options;

        // 遍历所有成就配置，匹配条件类型
        Object.values(this.achievementConfig).forEach(achievementGroup => {
            achievementGroup.forEach(achievement => {
                // 跳过已解锁的成就
                if (achievement.isUnlocked) return;

                const { condition } = achievement;
                // 匹配条件类型，且（道具条件需匹配道具类型）
                const isConditionMatch = condition.type === conditionType && 
                    (conditionType !== 'itemCollectCount' || condition.itemKey === itemKey);

                if (isConditionMatch) {
                    // 更新进度：覆盖或累加
                    if (overwrite) {
                        condition.current = Math.min(value, condition.target); // 进度不超过目标
                    } else {
                        condition.current = Math.min(condition.current + value, condition.target); // 累加不超过目标
                    }

                    // 检查是否满足解锁条件
                    this._checkAchievementUnlock(achievement);
                }
            });
        });

        // 定期保存成就进度到本地存储
        this._saveToLocalStorage();
    }

    /**
     * 检查成就是否满足解锁条件，满足则触发解锁逻辑
     * @param {Object} achievement - 成就配置对象
     */
    _checkAchievementUnlock(achievement) {
        if (achievement.isUnlocked) return;

        const { condition } = achievement;
        // 条件满足：当前进度 >= 目标值
        const isConditionMet = condition.current >= condition.target;

        if (isConditionMet) {
            // 1. 标记成就为已解锁
            achievement.isUnlocked = true;

            // 2. 发放成就奖励
            this._grantAchievementReward(achievement.reward);

            // 3. 添加解锁动画到队列
            this.achievementState.pendingAnimations.push({
                id: achievement.id,
                name: achievement.name,
                iconKey: achievement.iconKey,
                startTime: Date.now()
            });

            // 4. 发布成就解锁事件（供UI显示提示、播放音效）
            this.eventBus.emit(window.GameEvents.ACHIEVEMENT_UNLOCKED, {
                id: achievement.id,
                name: achievement.name,
                desc: achievement.desc,
                reward: achievement.reward
            });

            console.log(`[AchievementManager] 成就解锁：${achievement.name}（${achievement.desc}），奖励：${achievement.reward.type} x ${achievement.reward.value}`);
        }
    }

    /**
     * 发放成就奖励：根据奖励类型执行对应逻辑（加分、加生命、解锁技能等）
     * @param {Object} reward - 奖励配置（type：类型，value：值，skillKey：技能键）
     */
    _grantAchievementReward(reward) {
        if (!reward) return;

        const playerState = this.gameState.getFullState().player;
        switch (reward.type) {
            // 1. 奖励分数
            case 'score':
                this.gameState.updatePlayerState('score', playerState.score + reward.value);
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'achievementReward',
                    message: `获得成就奖励：+${reward.value}分！`
                });
                break;

            // 2. 奖励生命
            case 'life':
                const newLives = Math.min(playerState.lives + reward.value, playerState.maxLives);
                this.gameState.updatePlayerState('lives', newLives);
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'achievementReward',
                    message: `获得成就奖励：+${reward.value}条生命！`
                });
                break;

            // 3. 奖励技能碎片
            case 'skillShard':
                if (reward.skillKey === 'all') {
                    // 奖励所有技能碎片（各1个）
                    Object.keys(playerState.skillShards).forEach(skillKey => {
                        playerState.skillShards[skillKey] += 1;
                    });
                } else {
                    // 奖励指定技能碎片
                    playerState.skillShards[reward.skillKey] = (playerState.skillShards[reward.skillKey] || 0) + reward.value;
                }
                this.eventBus.emit(window.GameEvents.UI_SETTING_CHANGE, {
                    type: 'achievementReward',
                    message: `获得成就奖励：${reward.skillKey === 'all' ? '所有技能' : reward.skillKey}碎片 x ${reward.value}！`
                });
                break;

            // 4. 直接解锁技能
            case 'skillUnlocked':
                if (!playerState.unlockedSkills.includes(reward.skillKey)) {
                    playerState.unlockedSkills.push(reward.skillKey);
                    this.eventBus.emit(window.GameEvents.PLAYER_SKILL_ACTIVATE, {
                        skillId: reward.skillKey,
                        message: `成就奖励：直接解锁${reward.skillKey}技能！`
                    });
                }
                break;
        }
    }

    /**
     * 从本地存储加载成就进度（持久化恢复）
     */
    _loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(this.localStorageKey);
            if (!savedData) return;

            const parsedData = JSON.parse(savedData);
            // 遍历保存的成就数据，更新到当前配置
            Object.values(parsedData).forEach(savedGroup => {
                savedGroup.forEach(savedAchievement => {
                    // 找到对应ID的成就
                    const targetAchievement = this._getAchievementById(savedAchievement.id);
                    if (targetAchievement) {
                        // 更新进度、解锁状态（覆盖初始值）
                        targetAchievement.condition.current = savedAchievement.condition.current;
                        targetAchievement.isUnlocked = savedAchievement.isUnlocked;
                    }
                });
            });

            console.log(`[AchievementManager] 从本地存储加载成就进度成功`);
        } catch (e) {
            console.error(`[AchievementManager Error] 加载本地存储失败：${e.message}`);
        }
    }

    /**
     * 保存成就进度到本地存储（定期自动保存/强制保存）
     * @param {boolean} [force=false] - 是否强制保存（忽略间隔）
     */
    _saveToLocalStorage(force = false) {
        const now = Date.now();
        // 非强制保存时，检查是否达到保存间隔
        if (!force && now - this.achievementState.lastSaveTime < this.achievementState.saveInterval) {
            return;
        }

        try {
            // 深拷贝成就配置（避免修改原对象）
            const saveData = JSON.parse(JSON.stringify(this.achievementConfig));
            localStorage.setItem(this.localStorageKey, JSON.stringify(saveData));
            
            this.achievementState.lastSaveTime = now;
            console.log(`[AchievementManager] 成就进度已保存到本地存储`);
        } catch (e) {
            console.error(`[AchievementManager Error] 保存本地存储失败：${e.message}`);
        }
    }

    /**
     * 重置单局相关的成就进度（如单局分数）
     */
    _resetSingleBattleProgress() {
        Object.values(this.achievementConfig).forEach(achievementGroup => {
            achievementGroup.forEach(achievement => {
                if (achievement.condition.type === 'singleBattleScore') {
                    achievement.condition.current = 0;
                }
            });
        });
        // 重置后保存进度
        this._saveToLocalStorage();
    }

    /**
     * 根据成就ID获取成就配置（跨类型查找）
     * @param {string} achievementId - 成就ID
     * @returns {Object|null} 成就配置（无
     * 则返回null）
     */
    _getAchievementById(achievementId) {
        // 遍历所有成就分类，查找匹配ID的成就
        for (const groupKey of Object.keys(this.achievementConfig)) {
            const target = this.achievementConfig[groupKey].find(
                achievement => achievement.id === achievementId
            );
            if (target) return target;
        }
        return null;
    }

    /**
     * 主循环更新：处理成就解锁动画队列（控制动画播放时长）
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
        const now = Date.now();
        const animationDuration = 5000; // 成就解锁动画持续时长（5秒）

        // 过滤已过期的动画（超过播放时长）
        this.achievementState.pendingAnimations = this.achievementState.pendingAnimations.filter(
            anim => now - anim.startTime < animationDuration
        );

        // 定期保存成就进度（依赖主循环触发）
        this._saveToLocalStorage();
    }

    /**
     * 主循环渲染：绘制成就解锁动画（屏幕底部弹窗）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        const now = Date.now();
        const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;
        const animationDuration = 5000; // 与update保持一致的动画时长
        const popupWidth = 300;
        const popupHeight = 100;
        const popupPadding = 15;
        const iconSize = 70; // 成就图标尺寸
        const baseY = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio - 120; // 弹窗基础Y坐标

        // 遍历待播放的动画队列，逐个绘制弹窗
        this.achievementState.pendingAnimations.forEach((anim, index) => {
            const achievement = this._getAchievementById(anim.id);
            if (!achievement) return;

            // 计算动画进度（0~1，控制透明度与位置）
            const progress = (now - anim.startTime) / animationDuration;
            const alpha = progress < 0.1 ? progress / 0.1 : (progress > 0.9 ? (1 - progress) / 0.1 : 1); // 淡入淡出效果
            const offsetY = progress < 0.1 ? -50 + progress * 500 : 0; // 初始向上偏移，淡入时归位
            const currentY = baseY - index * (popupHeight + 10) + offsetY; // 多个弹窗上下排列

            // 1. 绘制弹窗背景（半透明白色圆角矩形）
            ctx.save();
            ctx.globalAlpha = alpha * 0.9;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.roundRect(
                (canvasWidth - popupWidth) / 2,
                currentY,
                popupWidth,
                popupHeight,
                10 // 圆角半径
            );
            ctx.fill();
            // 绘制弹窗边框（深色）
            ctx.strokeStyle = 'rgba(50, 50, 50, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // 2. 绘制成就图标（优先使用资源，无则降级为彩色圆形）
            const iconX = (canvasWidth - popupWidth) / 2 + popupPadding;
            const iconY = currentY + (popupHeight - iconSize) / 2;
            ctx.save();
            ctx.globalAlpha = alpha;
            const icon = window.GameMain.getLoadedResource('images', achievement.iconKey);
            if (icon) {
                ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            } else {
                // 降级图标：根据成就类型设置颜色
                const typeColors = { battle: 'rgba(231, 76, 60, 0.8)', score: 'rgba(241, 196, 15, 0.8)', collect: 'rgba(46, 204, 113, 0.8)' };
                ctx.fillStyle = typeColors[achievement.type] || 'rgba(155, 89, 182, 0.8)';
                ctx.beginPath();
                ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
                ctx.fill();
                // 绘制白色边框
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // 3. 绘制成就文字（名称+描述）
            const textX = iconX + iconSize + popupPadding;
            const textY = currentY + popupPadding + 20;
            ctx.save();
            ctx.globalAlpha = alpha;
            // 成就名称（粗体）
            ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`成就解锁：${achievement.name}`, textX, textY);
            // 成就描述（常规字体）
            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(70, 70, 70, 0.8)';
            ctx.fillText(achievement.desc, textX, textY + 25);
            // 奖励提示（浅色小字）
            const rewardText = this._getRewardText(achievement.reward);
            ctx.font = '11px Arial';
            ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
            ctx.fillText(`奖励：${rewardText}`, textX, textY + 45);
            ctx.globalAlpha = 1;
            ctx.restore();

            ctx.restore();
        });
    }

    /**
     * 生成奖励文字描述（用于渲染弹窗）
     * @param {Object} reward - 奖励配置
     * @returns {string} 奖励文字（如“+10000分”）
     */
    _getRewardText(reward) {
        if (!reward) return '无';
        switch (reward.type) {
            case 'score':
                return `+${reward.value}分`;
            case 'life':
                return `+${reward.value}条生命`;
            case 'skillShard':
                return reward.skillKey === 'all' ? '所有技能碎片各1个' : `${reward.skillKey}碎片x${reward.value}`;
            case 'skillUnlocked':
                return `解锁${reward.skillKey}技能`;
            default:
                return '未知奖励';
        }
    }

    /**
     * 对外接口：获取所有成就状态（供成就UI页面显示）
     * @param {string} [groupKey=''] - 成就分类（如battle/score，空则返回所有）
     * @returns {Array<Object>} 成就列表（含ID、名称、进度、解锁状态）
     */
    getAchievementList(groupKey = '') {
        let result = [];
        if (groupKey && this.achievementConfig[groupKey]) {
            // 返回指定分类的成就
            result = this.achievementConfig[groupKey].map(achievement => ({
                id: achievement.id,
                name: achievement.name,
                desc: achievement.desc,
                type: achievement.type,
                iconKey: achievement.iconKey,
                progress: `${achievement.condition.current}/${achievement.condition.target}`,
                progressPercent: Math.min(100, Math.floor((achievement.condition.current / achievement.condition.target) * 100)),
                isUnlocked: achievement.isUnlocked,
                rewardText: this._getRewardText(achievement.reward)
            }));
        } else {
            // 返回所有分类的成就（按分类分组）
            Object.keys(this.achievementConfig).forEach(key => {
                result.push({
                    groupKey: key,
                    groupName: this._getGroupNameByKey(key),
                    achievements: this.achievementConfig[key].map(achievement => ({
                        id: achievement.id,
                        name: achievement.name,
                        desc: achievement.desc,
                        type: achievement.type,
                        iconKey: achievement.iconKey,
                        progress: `${achievement.condition.current}/${achievement.condition.target}`,
                        progressPercent: Math.min(100, Math.floor((achievement.condition.current / achievement.condition.target) * 100)),
                        isUnlocked: achievement.isUnlocked,
                        rewardText: this._getRewardText(achievement.reward)
                    }))
                });
            });
        }
        return result;
    }

    /**
     * 根据分类键获取分类名称（用于UI显示）
     * @param {string} groupKey - 分类键（如battle）
     * @returns {string} 分类名称（如“战斗类”）
     */
    _getGroupNameByKey(groupKey) {
        const groupNames = { battle: '战斗类', score: '得分类', collect: '收集类' };
        return groupNames[groupKey] || groupKey;
    }

    /**
     * 对外接口：手动触发成就解锁（测试/剧情场景）
     * @param {string} achievementId - 成就ID
     */
    triggerAchievementUnlock(achievementId) {
        const achievement = this._getAchievementById(achievementId);
        if (!achievement || achievement.isUnlocked) return;

        // 强制更新进度为目标值，触发解锁
        achievement.condition.current = achievement.condition.target;
        this._checkAchievementUnlock(achievement);
    }

    /**
     * 对外接口：获取已解锁成就数量（供UI显示统计）
     * @returns {number} 已解锁成就总数
     */
    getUnlockedCount() {
        let count = 0;
        Object.values(this.achievementConfig).forEach(group => {
            count += group.filter(achievement => achievement.isUnlocked).length;
        });
        return count;
    }

    /**
     * 对外接口：获取总成就数量（供UI显示统计）
     * @returns {number} 成就总数
     */
    getTotalCount() {
        let count = 0;
        Object.values(this.achievementConfig).forEach(group => {
            count += group.length;
        });
        return count;
    }
}

// 导出成就管理系统类（兼容Node.js和浏览器环境）
try {
    module.exports = AchievementManager;
} catch (e) {
    // 浏览器环境挂载到window，供游戏主模块调用
    window.AchievementManager = AchievementManager;
}
