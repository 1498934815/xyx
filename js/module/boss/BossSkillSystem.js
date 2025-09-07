/**
 * BOSS技能系统模块：负责管理BOSS的主动技能（特殊攻击、增益、召唤），
 * 处理技能冷却、释放条件、效果触发，关联事件总线同步技能状态，增强BOSS战斗多样性
 */
class BossSkillSystem {
    /**
     * 构造函数：初始化技能配置与依赖模块
     * @param {Object} bossInstance - BOSS实例（需包含技能配置、位置、血量等属性）
     */
    constructor(bossInstance) {
        // 基础依赖引用
        this.boss = bossInstance; // BOSS实例（获取技能配置、状态）
        this.eventBus = window.EventBus; // 事件总线（发布技能事件）
        this.gameState = window.GameState; // 游戏状态（获取玩家位置、BOSS血量）
        this.gameLoop = window.GameLoop; // 主循环（注册技能效果渲染/更新）
        this.objectPool = window.ObjectPool; // 对象池（复用技能相关实例，如召唤物）

        // 技能核心配置（优先读取BOSS实例的skillConfig，无则用默认）
        const bossSkillConfig = this.boss.skillConfig || {};
        this.skillConfig = {
            // 基础技能参数
            skillList: bossSkillConfig.skillList || [
                {
                    id: 'skillAOE', // 范围AOE技能
                    name: '震荡波',
                    type: 'attack', // 技能类型（attack攻击/buff增益/summon召唤）
                    triggerHpThreshold: [0.8, 0.5, 0.2], // 触发血量阈值（80%/50%/20%血时必放）
                    cd: 8000, // 冷却时间（毫秒）
                    damage: 3, // 技能伤害
                    radius: 120, // AOE范围半径（像素）
                    warningDuration: 1000, // 技能预警时长（毫秒）
                    effectDuration: 800, // 技能效果持续时长（毫秒）
                    color: 'rgba(231, 76, 60, 0.7)', // 技能效果颜色（红色半透）
                    warningColor: 'rgba(231, 76, 60, 0.4)' // 预警颜色（浅红半透）
                },
                {
                    id: 'skillBuff', // 自身增益技能
                    name: '硬化外壳',
                    type: 'buff',
                    triggerHpThreshold: [0.7, 0.4], // 70%/40%血时触发
                    cd: 15000,
                    buffType: 'defense', // 增益类型（defense防御/attack攻击/speed速度）
                    buffValue: 0.5, // 增益数值（防御+50%）
                    buffDuration: 6000, // 增益持续时长（毫秒）
                    effectColor: 'rgba(52, 152, 219, 0.6)' // 增益效果颜色（蓝色半透）
                },
                {
                    id: 'skillSummon', // 召唤小怪技能
                    name: '召唤支援',
                    type: 'summon',
                    triggerHpThreshold: [0.9, 0.6, 0.3], // 90%/60%/30%血时触发
                    cd: 20000,
                    summonType: 'enemySmallFighter', // 召唤物类型（对应对象池类型）
                    summonCount: 3, // 单次召唤数量
                    summonRange: 80, // 召唤范围（基于BOSS中心的偏移范围）
                    summonHp: 50, // 召唤物血量
                    summonDamage: 1 // 召唤物伤害
                }
            ],
            // 技能释放优先级（攻击类>召唤类>增益类）
            skillPriority: ['attack', 'summon', 'buff'],
            // 技能预警与效果配置
            visual: {
                warningPulseSpeed: 2, // 预警范围脉冲速度（越大闪烁越快）
                effectFadeSpeed: 0.02 // 技能效果渐隐速度
            }
        };

        // 技能状态管理
        this.skillState = {
            skillCooldowns: {}, // 技能冷却记录（key=技能ID，value=冷却结束时间戳）
            activeSkills: [], // 当前活跃的技能效果（如持续增益、AOE动画）
            currentWarning: null, // 当前技能预警（null=无预警）
            activeBuffs: {}, // 当前生效的增益（key=增益类型，value=增益结束时间戳+数值）
            summonedUnits: [] // 当前召唤的小怪列表
        };

        // 初始化：注册到主循环（更新技能冷却、效果、召唤物）
        this.gameLoop.registerRenderObj('particle', this);
        // 订阅核心事件（BOSS受击、游戏重置/结束）
        this._subscribeEvents();
        // 初始化技能冷却（所有技能初始无冷却）
        this._initSkillCooldowns();
    }

    /**
     * 订阅核心事件：BOSS受击（触发阈值技能）、游戏重置/结束（清理技能状态）
     */
    _subscribeEvents() {
        // 1. BOSS受击事件：检测血量阈值，触发对应技能
        this.eventBus.on(window.GameEvents.BOSS_HIT, () => {
            this._checkThresholdSkills();
        });

        // 2. 游戏重置事件：清理所有技能状态（冷却、效果、召唤物）
        this.eventBus.on(window.GameEvents.GAME_RESET, () => {
            this._resetSkillState();
        });

        // 3. 游戏结束事件：清理活跃技能与召唤物
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this._clearActiveSkills();
            this._clearSummonedUnits();
        });

        // 4. 召唤物死亡事件：从列表中移除死亡的召唤物
        this.eventBus.on(window.GameEvents.ENEMY_DEATH, (enemyId) => {
            this.skillState.summonedUnits = this.skillState.summonedUnits.filter(
                unit => unit.id !== enemyId
            );
        });
    }

    /**
     * 初始化技能冷却：所有技能初始无冷却（冷却结束时间戳设为当前时间）
     */
    _initSkillCooldowns() {
        const now = Date.now();
        this.skillConfig.skillList.forEach(skill => {
            this.skillState.skillCooldowns[skill.id] = now;
        });
    }

    /**
     * 检查阈值技能：BOSS血量达到指定阈值时，强制触发对应技能（忽略冷却）
     */
    _checkThresholdSkills() {
        const now = Date.now();
        const { bossHealth, bossMaxHealth } = this.gameState.getFullState().battle;
        const currentHpRatio = bossHealth / bossMaxHealth;

        // 遍历所有技能，检测是否达到触发阈值
        this.skillConfig.skillList.forEach(skill => {
            if (!skill.triggerHpThreshold || skill.triggerHpThreshold.length === 0) return;

            // 查找当前血量首次达到的阈值（如80%血首次触发，后续不再触发该阈值）
            const matchedThreshold = skill.triggerHpThreshold.find(
                threshold => currentHpRatio <= threshold && !this._hasTriggeredThreshold(skill.id, threshold)
            );

            if (matchedThreshold) {
                // 标记该阈值已触发（避免重复触发）
                this._markThresholdTriggered(skill.id, matchedThreshold);
                // 强制触发技能（忽略冷却）
                this._triggerSkill(skill.id, true);
            }
        });
    }

    /**
     * 检查技能是否可释放：冷却结束+满足释放条件（如增益类技能需血量低于阈值）
     * @param {string} skillId - 技能ID
     * @returns {boolean} 是否可释放
     */
    _canCastSkill(skillId) {
        const now = Date.now();
        const skill = this._getSkillById(skillId);
        if (!skill) return false;

        // 1. 检查冷却（强制触发时跳过）
        if (this.skillState.skillCooldowns[skillId] > now) return false;

        // 2. 按技能类型检查释放条件
        switch (skill.type) {
            case 'buff':
                // 增益类：仅当前无同类型增益时释放
                return !this.skillState.activeBuffs[skill.buffType];
            case 'summon':
                // 召唤类：当前召唤物数量不超过上限（默认上限=召唤数量*2）
                const summonCount = this.skillState.summonedUnits.filter(
                    unit => unit.type === skill.summonType
                ).length;
                return summonCount < skill.summonCount * 2;
            case 'attack':
                // 攻击类：玩家在技能有效范围内（AOE需玩家在BOSS附近）
                const player = this.gameState.getFullState().player;
                const bossCenterX = this.boss.x + this.boss.width / 2;
                const bossCenterY = this.boss.y + this.boss.height / 2;
                const distance = Math.sqrt(
                    Math.pow(player.x + player.width/2 - bossCenterX, 2) +
                    Math.pow(player.y + player.height/2 - bossCenterY, 2)
                );
                return distance <= skill.radius * 2; // 玩家在2倍AOE范围内才释放
            default:
                return true;
        }
    }

    /**
     * 触发技能：启动预警（如需）→执行技能效果→更新冷却
     * @param {string} skillId - 技能ID
     * @param {boolean} [force=false] - 是否强制触发（忽略冷却与条件）
     */
    _triggerSkill(skillId, force = false) {
        const now = Date.now();
        const skill = this._getSkillById(skillId);
        if (!skill) return;

        // 非强制触发时，检查技能是否可释放
        if (!force && !this._canCastSkill(skillId)) {
            console.warn(`[BossSkillSystem Warn] 技能${skill.name}（${skillId}）无法释放（冷却中/条件不满足）`);
            return;
        }

        // 1. 发布技能触发事件（供UI显示提示、音效播放技能音效）
        this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
            bossId: this.boss.id,
            skillId: skillId,
            skillName: skill.name,
            skillType: skill.type,
            action: 'trigger'
        });

        // 2. 技能需预警时，启动预警（预警结束后执行效果）
        if (skill.warningDuration && skill.warningDuration > 0) {
            this.skillState.currentWarning = {
                skillId: skillId,
                endTime: now + skill.warningDuration,
                skill: skill
            };
            return;
        }

        // 3. 无需预警，直接执行技能效果
        this._executeSkillEffect(skill);

        // 4. 更新技能冷却（强制触发时也需冷却，避免连续释放）
        this.skillState.skillCooldowns[skillId] = now + skill.cd;
    }

    /**
     * 执行技能效果：按技能类型（攻击/增益/召唤）执行对应逻辑
     * @param {Object} skill - 技能配置对象
     */
    _executeSkillEffect(skill) {
        const now = Date.now();
        const bossCenterX = this.boss.x + this.boss.width / 2;
        const bossCenterY = this.boss.y + this.boss.height / 2;

        switch (skill.type) {
            // 1. 攻击类技能（AOE震荡波）
            case 'attack':
                // 添加AOE效果到活跃技能列表（用于渲染）
                this.skillState.activeSkills.push({
                    id: `skillAOE_${now}`,
                    type: 'attack',
                    skillId: skill.id,
                    x: bossCenterX,
                    y: bossCenterY,
                    radius: skill.radius,
                    color: skill.color,
                    endTime: now + skill.effectDuration,
                    damage: skill.damage
                });

                // 检测AOE范围内的玩家，触发伤害
                const player = this.gameState.getFullState().player;
                const playerCenterX = player.x + player.width / 2;
                const playerCenterY = player.y + player.height / 2;
                const distance = Math.sqrt(
                    Math.pow(playerCenterX - bossCenterX, 2) +
                    Math.pow(playerCenterY - bossCenterY, 2)
                );

                if (distance <= skill.radius && !player.isInvincible) {
                    this.eventBus.emit(window.GameEvents.PLAYER_HIT, { damage: skill.damage });
                }
                break;

            // 2. 增益类技能（硬化外壳）
            case 'buff':
                // 添加增益到活跃增益列表
                this.skillState.activeBuffs[skill.buffType] = {
                    skillId: skill.id,
                    value: skill.buffValue,
                    endTime: now + skill.buffDuration,
                    color: skill.effectColor
                };

                // 发布增益生效事件（供UI显示增益提示）
                this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
                    bossId: this.boss.id,
                    skillId: skill.id,
                    skillName: skill.name,
                    action: 'buffActive',
                    buffType: skill.buffType,
                    buffValue: skill.buffValue,
                    buffDuration: skill.buffDuration
                });
                break;

            // 3. 召唤类技能（召唤小怪）
            case 'summon':
                // 从对象池获取召唤物（小怪）
                for (let i = 0; i < skill.summonCount; i++) {
                    // 召唤位置：BOSS中心随机偏移（summonRange范围内）
                    const offsetX = (Math.random() - 0.5) * 2 * skill.summonRange;
                    const offsetY = (Math.random() - 0.5) * 2 * skill.summonRange;

                    // 从对象池获取召唤物（类型为summonType，如enemySmallFighter）
                    const summonUnit = this.objectPool.getObject(skill.summonType, {
                        id: `${skill.summonType}_${now}_${i}`,
                        type: skill.summonType,
                        x: bossCenterX + offsetX - 20, // 小怪宽度默认40，居中偏移
                        y: bossCenterY + offsetY - 20,
                        width: 40,
                        height: 40,
                        health: skill.summonHp,
                        maxHealth: skill.summonHp,
                        damage: skill.summonDamage,
                        speed: 1 // 召唤物移动速度
                    });

                    if (summonUnit) {
                        this.skillState.summonedUnits.push(summonUnit);
                        // 注册召唤物到主循环（更新/渲染）
                        this.gameLoop.registerRenderObj(`summon_${summonUnit.id}`, summonUnit);
                        // 发布召唤事件（供EnemyManager管理）
                        this.eventBus.emit(window.GameEvents.BOSS_SUMMON, {
                            unitId: summonUnit.id,
                            unitType: skill.summonType,
                            unitHealth: skill.summonHp
                        });
                    }
                }
                break;
        }
    }

    /**
     * 清理活跃技能效果（过期或结束的技能）
     */
    _clearExpiredSkills() {
        const now = Date.now();
        // 过滤过期的活跃技能
        this.skillState.activeSkills = this.skillState.activeSkills.filter(skill => {
            return skill.endTime > now;
        });

        // 过滤过期的增益效果
        Object.keys(this.skillState.activeBuffs).forEach(buffType => {
            if (this.skillState.activeBuffs[buffType].endTime <= now) {
                // 发布增益结束事件
                this.eventBus.emit(window.GameEvents.BOSS_SKILL, {
                    bossId: this.boss.id,
                    skillId: this.skillState.activeBuffs[buffType].skillId,
                    action: 'buffEnd',
                    buffType: buffType
                });
                delete this.skillState.activeBuffs[buffType];
            }
        });

        // 过滤过期的召唤物（超出画布或死亡）
        this.skillState.summonedUnits = this.skillState.summonedUnits.filter(unit => {
            const canvasWidth = this.gameLoop.canvas.width / window.GameGlobalConfig.canvas.pixelRatio;
            const canvasHeight = this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio;
            // 保留条件：在画布内且存活（health>0）
            return unit.x >= -unit.width && unit.x <= canvasWidth &&
                   unit.y >= -unit.height && unit.y <= canvasHeight &&
                   unit.health > 0;
        });
    }

    /**
     * 清理所有活跃技能（游戏重置/结束时调用）
     */
    _clearActiveSkills() {
        this.skillState.activeSkills = [];
        this.skillState.currentWarning = null;
    }

    /**
     * 清理所有召唤物（回收至对象池）
     */
    _clearSummonedUnits() {
        this.skillState.summonedUnits.forEach(unit => {
            // 从主循环移除召唤物渲染/更新
            this.gameLoop.unregisterRenderObj(`summon_${unit.id}`);
            // 回收召唤物到对象池
            this.objectPool.recycleObject(unit.type, unit);
        });
        this.skillState.summonedUnits = [];
    }

    /**
     * 重置技能系统状态（游戏重置时调用）
     */
    _resetSkillState() {
        this._initSkillCooldowns(); // 重置技能冷却
        this._clearActiveSkills(); // 清理活跃技能
        this._clearSummonedUnits(); // 清理召唤物
        this.skillState.activeBuffs = {}; // 清空活跃增益
        this.skillState.thresholdTriggers = {}; // 重置阈值触发记录
    }

    /**
     * 检查技能阈值是否已触发（避免重复触发同阈值技能）
     * @param {string} skillId - 技能ID
     * @param {number} threshold - 血量阈值（如0.8）
     * @returns {boolean} 是否已触发
     */
    _hasTriggeredThreshold(skillId, threshold) {
        if (!this.skillState.thresholdTriggers[skillId]) {
            this.skillState.thresholdTriggers[skillId] = [];
        }
        return this.skillState.thresholdTriggers[skillId].includes(threshold);
    }

    /**
     * 标记技能阈值已触发（记录触发的阈值）
     * @param {string} skillId - 技能ID
     * @param {number} threshold - 血量阈值（如0.8）
     */
    _markThresholdTriggered(skillId, threshold) {
        if (!this.skillState.thresholdTriggers[skillId]) {
            this.skillState.thresholdTriggers[skillId] = [];
        }
        this.skillState.thresholdTriggers[skillId].push(threshold);
    }

    /**
     * 根据技能ID获取技能配置
     * @param {string} skillId - 技能ID
     * @returns {Object|null} 技能配置（无则返回null）
     */
    _getSkillById(skillId) {
        return this.skillConfig.skillList.find(skill => skill.id === skillId) || null;
    }

    /**
     * 选择可释放的技能：按优先级（攻击>召唤>增益）筛选，返回首个可释放的技能
     * @returns {string|null} 可释放的技能ID（无则返回null）
     */
    _selectCastableSkill() {
        // 按优先级遍历技能类型
        for (const priorityType of this.skillConfig.skillPriority) {
            // 筛选该类型下所有技能
            const skillsOfType = this.skillConfig.skillList.filter(
                skill => skill.type === priorityType
            );
            // 遍历技能，返回首个可释放的
            for (const skill of skillsOfType) {
                if (this._canCastSkill(skill.id)) {
                    return skill.id;
                }
            }
        }
        return null;
    }

    /**
     * 主循环更新：处理技能预警、冷却、效果、召唤物
     * @param {number} deltaTime - 时间差（秒）
     */
    update(deltaTime) {
        const now = Date.now();
        const currentBoss = this.boss;

        // 1. 无活跃BOSS时不执行更新
        if (!currentBoss || currentBoss.health <= 0) {
            return;
        }

        // 2. 处理技能预警（预警结束后执行技能效果）
        if (this.skillState.currentWarning) {
            const { skillId, endTime, skill } = this.skillState.currentWarning;
            if (now >= endTime) {
                this._executeSkillEffect(skill); // 执行技能效果
                this.skillState.skillCooldowns[skillId] = now + skill.cd; // 更新冷却
                this.skillState.currentWarning = null; // 清空预警
            }
            return;
        }

        // 3. 定期选择并触发技能（每2秒检测一次，避免频繁判定）
        if (now % 2000 < 50) { // 每2秒的前50ms内执行判定（降低性能消耗）
            const castableSkillId = this._selectCastableSkill();
            if (castableSkillId) {
                this._triggerSkill(castableSkillId);
            }
        }

        // 4. 清理过期技能、增益、召唤物
        this._clearExpiredSkills();

        // 5. 更新召唤物状态（移动、攻击逻辑，若召唤物自带update则调用）
        this.skillState.summonedUnits.forEach(unit => {
            if (typeof unit.update === 'function') {
                unit.update(deltaTime);
            } else {
                // 降级移动：召唤物默认向下移动
                unit.y += unit.speed;
            }
        });
    }

    /**
     * 主循环渲染：绘制技能预警、效果、增益边框、召唤物
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} deltaTime - 时间差（秒）
     */
    render(ctx, deltaTime) {
        const now = Date.now();
        const currentBoss = this.boss;

        // 1. 无活跃BOSS时不执行渲染
        if (!currentBoss || currentBoss.health <= 0) {
            return;
        }

        // 2. 绘制技能预警（如AOE范围脉冲）
        if (this.skillState.currentWarning) {
            const { skill } = this.skillState.currentWarning;
            const bossCenterX = currentBoss.x + currentBoss.width / 2;
            const bossCenterY = currentBoss.y + currentBoss.height / 2;
            const pulseProgress = (now - (this.skillState.currentWarning.endTime - skill.warningDuration)) / skill.warningDuration;
            const currentRadius = skill.radius * (0.5 + pulseProgress * 0.5); // 半径从0.5倍增长到1倍

            ctx.save();
            ctx.strokeStyle = skill.warningColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(bossCenterX, bossCenterY, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 3. 绘制活跃技能效果（如AOE震荡波）
        this.skillState.activeSkills.forEach(skillEffect => {
            const fadeProgress = 1 - (skillEffect.endTime - now) / (skillEffect.endTime - (skillEffect.endTime - skillEffect.effectDuration));
            const currentRadius = skillEffect.radius * (1 + fadeProgress * 0.2); // 半径随时间扩大
            const currentAlpha = (1 - fadeProgress).toFixed(2); // 透明度随时间降低

            ctx.save();
            ctx.fillStyle = skillEffect.color.replace(')', `, ${currentAlpha})`);
            ctx.beginPath();
            ctx.arc(skillEffect.x, skillEffect.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 4. 绘制BOSS增益边框（如防御增益的蓝色边框）
        Object.values(this.skillState.activeBuffs).forEach(buff => {
            ctx.save();
            ctx.strokeStyle = buff.color;
            ctx.lineWidth = 5;
            // 边框外扩5像素，突出显示
            ctx.strokeRect(
                currentBoss.x - 5,
                currentBoss.y - 5,
                currentBoss.width + 10,
                currentBoss.height + 10
            );
            ctx.restore();
        });

        // 5. 绘制召唤物（调用召唤物自身render，无则降级绘制）
        this.skillState.summonedUnits.forEach(unit => {
            ctx.save();
            if (typeof unit.render === 'function') {
                unit.render(ctx);
            } else {
                // 降级渲染：灰色矩形（默认召唤物样式）
                ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
                ctx.fillRect(unit.x, unit.y, unit.width, unit.height);
                // 绘制血量文字
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.fillText(`${unit.health}/${unit.maxHealth}`, unit.x + 5, unit.y + 15);
            }
            ctx.restore();
        });

        // 6. 调试模式：绘制技能冷却与增益信息
        if (window.GameGlobalConfig?.debug?.enableDebugMode) {
            this._renderDebugInfo(ctx);
        }
    }

    /**
     * 调试模式渲染：显示技能冷却、增益状态（开发用）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    _renderDebugInfo(ctx) {
        const now = Date.now();
        let debugY = 50; // 调试信息起始Y坐标

        ctx.save();
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText('=== BOSS技能调试信息 ===', 10, debugY);
        debugY += 20;

        // 1. 显示各技能冷却状态
        this.skillConfig.skillList.forEach(skill => {
            const cdEndTime = this.skillState.skillCooldowns[skill.id];
            const cdLeft = Math.max(0, Math.floor((cdEndTime - now) / 1000));
            const cdStatus = cdLeft > 0 ? `冷却中（${cdLeft}s）` : '可释放';
            ctx.fillText(`${skill.name}（${skill.type}）：${cdStatus}`, 10, debugY);
            debugY += 18;
        });

        // 2. 显示活跃增益状态
        if (Object.keys(this.skillState.activeBuffs).length > 0) {
            ctx.fillText('--- 活跃增益 ---', 10, debugY);
            debugY += 18;
            Object.entries(this.skillState.activeBuffs).forEach(([buffType, buff]) => {
                const buffLeft = Math.max(0, Math.floor((buff.endTime - now) / 1000));
                ctx.fillText(`${buffType}增益（+${buff.value*100}%）：剩余${buffLeft}s`, 10, debugY);
                debugY += 18;
            });
        }

        // 3. 显示召唤物数量
        ctx.fillText(`--- 召唤物数量：${this.skillState.summonedUnits.length} ---`, 10, debugY);
        debugY += 18;

        ctx.restore();
    }

    /**
     * 对外接口：手动触发指定技能（测试/剧情场景）
     * @param {string} skillId - 技能ID
     */
    triggerSkillManually(skillId) {
        const skill = this._getSkillById(skillId);
        if (!skill) {
            console.warn(`[BossSkillSystem Warn] 无效技能ID：${skillId}`);
            return;
        }
        this._triggerSkill(skillId, true); // 强制触发，忽略冷却与条件
    }

    /**
     * 对外接口：获取当前技能状态（供UI显示技能冷却、增益提示）
     * @returns {Object} 技能状态（含冷却、活跃增益、召唤物数量）
     */
    getSkillState() {
        const now = Date.now();
        const skillStatus = {};

        // 1. 整理各技能冷却状态
        this.skillConfig.skillList.forEach(skill => {
            const cdEndTime = this.skillState.skillCooldowns[skill.id];
            skillStatus[skill.id] = {
                name: skill.name,
                type: skill.type,
                cdLeft: Math.max(0, Math.floor((cdEndTime - now) / 1000)), // 剩余冷却（秒）
                canCast: this._canCastSkill(skill.id)
            };
        });

        // 2. 整理活跃增益
        const activeBuffs = Object.entries(this.skillState.activeBuffs).reduce((obj, [buffType, buff]) => {
            obj[buffType] = {
                value: buff.value,
                timeLeft: Math.max(0, Math.floor((buff.endTime - now) / 1000))
            };
            return obj;
        }, {});

        return {
            skillStatus,
            activeBuffs,
            summonedUnitCount: this.skillState.summonedUnits.length,
            isWarning: !!this.skillState.currentWarning
        };
    }

    /**
     * 对外接口：获取BOSS当前增益数值（供碰撞系统计算伤害减免）
     * @param {string} buffType - 增益类型（如defense）
     * @returns {number} 增益数值（如0.5=50%防御加成）
     */
    getBuffValue(buffType) {
        return this.skillState.activeBuffs[buffType]?.value || 0;
    }
}

// 导出BOSS技能系统类（兼容Node.js和浏览器环境）
try {
    module.exports = BossSkillSystem;
} catch (e) {
    // 浏览器环境挂载到window，供BOSS实例调用
    window.BossSkillSystem = BossSkillSystem;
}
