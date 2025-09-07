// 技能全局通用配置（所有技能共享的基础参数）
const SkillGlobalConfig = {
    // 技能系统基础规则
    rule: {
        maxActiveSkills: 3,        // 最大同时激活技能数量（3个，与PlayerConfig.skillSystem.maxSkillSlots一致）
        skillSelectTimeout: 10000,  // 技能选择弹窗超时时间（10秒，超时默认选择第一个技能）
        skillEffectStackRule: 'refresh', // 同类型技能效果叠加规则（refresh=刷新持续时间，不叠加强度）
        skillCooldownGlobalReduce: 0.1, // 全局技能冷却缩减（10%，所有技能冷却统一减少）
        skillUnlockLevelBase: 2,    // 初始解锁技能的等级（2级开始，每2级解锁1次技能选择）
        skillUnlockLevelStep: 2     // 技能选择解锁间隔（每升2级可再次选择技能）
    },
    // 技能视觉效果通用配置
    visual: {
        activateGlowDuration: 800,  // 技能激活时发光时长（800毫秒）
        activateGlowColor: 'rgba(155, 89, 182, 0.7)', // 激活发光颜色（紫色半透明）
        cooldownIconGray: 0.5,      // 技能冷却时图标灰度（0.5=半灰色）
        effectParticleCount: 12,    // 技能效果粒子数量（12个/次）
        effectParticleSpeedRange: [2, 6] // 技能粒子速度范围（2-6像素/帧）
    },
    // 技能音效配置（对应GameGlobalConfig.sound.soundPaths）
    sound: {
        activateSound: 'skillActivate', // 技能激活音效（关联GameGlobalConfig的skill-activate.wav）
        cooldownEndSound: 'skillCooldownEnd', // 冷却结束提示音效（需在soundPaths中补充）
        soundVolumeMultiplier: 1.2     // 技能音效音量倍率（1.2倍于基础音量）
    }
};

// 技能类型配置（每种技能独立参数，新增技能只需在此添加）
const SkillTypesConfig = [
    // 1. 穿透子弹（核心输出型技能）
    {
        id: 'penetrateBullet',      // 技能唯一ID（用于JS识别）
        name: '穿透子弹',           // 技能显示名称（UI展示）
        desc: '子弹可穿透多个敌人，提升清场效率', // 技能描述（弹窗/成就说明）
        type: 'passive',            // 技能类型（passive=被动，active=主动）
        // 基础属性
        baseAttr: {
            cooldown: 15000,        // 冷却时间（15秒，被动技能生效后进入冷却）
            duration: 8000,         // 效果持续时间（8秒，期间子弹具备穿透能力）
            maxLevel: 3,            // 技能最大等级（3级，等级提升增强效果）
            unlockLevel: 2,         // 解锁等级（2级可选择该技能）
        },
        // 等级效果（每级提升的具体参数）
        levelEffects: [
            { penetrateCount: 1 },  // 1级：穿透1个敌人
            { penetrateCount: 2 },  // 2级：穿透2个敌人
            { penetrateCount: 3 }   // 3级：穿透3个敌人（上限）
        ],
        // 视觉效果（专属效果，覆盖全局配置）
        visual: {
            particleColor: ['#3498db', '#2980b9'], // 穿透粒子颜色（蓝色系）
            bulletGlowColor: 'rgba(52, 152, 219, 0.6)', // 子弹发光颜色
            hitEffectParticleCount: 5 // 子弹命中敌人时额外生成5个粒子
        },
        // 关联系统（该技能影响的模块）
        relatedSystem: 'PlayerFireSystem' // 关联玩家射击系统（修改子弹穿透属性）
    },

    // 2. 护盾防御（生存型技能）
    {
        id: 'shieldDefense',        // 技能唯一ID
        name: '护盾防御',           // 技能显示名称
        desc: '生成临时护盾，免疫1次伤害，护盾破裂时造成范围伤害', // 技能描述
        type: 'active',             // 技能类型（active=主动，需点击释放）
        // 基础属性
        baseAttr: {
            cooldown: 20000,        // 冷却时间（20秒）
            duration: 0,            // 主动技能无持续时间（触发后立即生效）
            maxLevel: 3,            // 最大等级（3级）
            unlockLevel: 2,         // 解锁等级（2级可选择）
            shieldHealth: 1,        // 护盾基础生命值（1点，免疫1次伤害）
            explosionDamage: 1      // 护盾破裂时范围伤害（1点血，对周围敌人生效）
        },
        // 等级效果
        levelEffects: [
            { explosionRadius: 80, cooldownReduce: 0 }, // 1级：范围80像素，无冷却缩减
            { explosionRadius: 120, cooldownReduce: 3000 }, // 2级：范围120像素，冷却-3秒
            { explosionRadius: 160, cooldownReduce: 6000 }  // 3级：范围160像素，冷却-6秒
        ],
        // 视觉效果
        visual: {
            shieldColor: 'rgba(52, 152, 219, 0.8)', // 护盾颜色（蓝色半透明）
            shieldThickness: 3,    // 护盾边框厚度（3像素）
            explosionParticleColor: ['#3498db', '#2980b9', '#1abc9c'], // 爆炸粒子颜色
            explosionParticleCount: 20, // 爆炸粒子数量（20个）
            icon: 'shield-icon'    // 技能图标标识（用于UI显示）
        },
        // 关联系统
        relatedSystem: 'PlayerLifeSystem' // 关联玩家生命系统（管理护盾状态）
    },

    // 3. 速度提升（机动型技能）
    {
        id: 'speedBoost',           // 技能唯一ID
        name: '速度提升',           // 技能显示名称
        desc: '短时间内大幅提升移动速度，灵活躲避弹幕', // 技能描述
        type: 'passive',            // 技能类型（passive=被动，激活后自动生效）
        // 基础属性
        baseAttr: {
            cooldown: 12000,        // 冷却时间（12秒）
            duration: 6000,         // 效果持续时间（6秒）
            maxLevel: 3,            // 最大等级（3级）
            unlockLevel: 2,         // 解锁等级（2级可选择）
            speedBoostRate: 0.3     // 基础速度提升比例（30%）
        },
        // 等级效果
        levelEffects: [
            { speedBoostRate: 0.3, durationExtend: 0 }, // 1级：提升30%，无时长延长
            { speedBoostRate: 0.5, durationExtend: 2000 }, // 2级：提升50%，时长+2秒
            { speedBoostRate: 0.8, durationExtend: 4000 }  // 3级：提升80%，时长+4秒
        ],
        // 视觉效果
        visual: {
            trailColor: 'rgba(241, 196, 15, 0.6)', // 移动拖影颜色（黄色半透明）
            trailLength: 8,         // 拖影长度（8帧）
            effectParticleColor: ['#f1c40f', '#f39c12'], // 效果粒子颜色（黄色系）
        },
        // 关联系统
        relatedSystem: 'Player'     // 关联玩家主体（修改移动速度属性）
    },

    // 4. 多重射击（输出型技能）
    {
        id: 'multiShoot',           // 技能唯一ID
        name: '多重射击',           // 技能显示名称
        desc: '每次射击额外发射多枚子弹，覆盖更广范围', // 技能描述
        type: 'passive',            // 技能类型（passive=被动）
        // 基础属性
        baseAttr: {
            cooldown: 18000,        // 冷却时间（18秒）
            duration: 7000,         // 效果持续时间（7秒）
            maxLevel: 3,            // 最大等级（3级）
            unlockLevel: 4,         // 解锁等级（4级可选择，后期技能）
            extraBulletCount: 1     // 基础额外子弹数量（1枚，即单次共射2枚）
        },
        // 等级效果
        levelEffects: [
            { extraBulletCount: 1, spreadAngleReduce: 0 }, // 1级：+1弹，无散射缩减
            { extraBulletCount: 2, spreadAngleReduce: Math.PI/24 }, // 2级：+2弹，散射-7.5°
            { extraBulletCount: 3, spreadAngleReduce: Math.PI/12 }  // 3级：+3弹，散射-15°
        ],
        // 视觉效果
        visual: {
            bulletGlowColor: 'rgba(231, 76, 60, 0.6)', // 额外子弹发光颜色（红色半透明）
            shootEffectParticleCount: 8, // 射击时额外生成8个粒子
            particleColor: ['#e74c3c', '#c0392b'] // 粒子颜色（红色系）
        },
        // 关联系统
        relatedSystem: 'PlayerFireSystem' // 关联玩家射击系统（修改子弹数量/散射）
    },

    // 5. 生命恢复（生存型技能）
    {
        id: 'lifeRegen',            // 技能唯一ID
        name: '生命恢复',           // 技能显示名称
        desc: '立即恢复1条生命值，并在短时间内持续恢复少量生命', // 技能描述
        type: 'active',             // 技能类型（active=主动，需点击释放）
        // 基础属性
        baseAttr: {
            cooldown: 25000,        // 冷却时间（25秒，生存技能冷却较长）
            duration: 5000,         // 持续恢复时长（5秒）
            maxLevel: 3,            // 最大等级（3级）
            unlockLevel: 4,         // 解锁等级（4级可选择）
            instantRegen: 1,        // 立即恢复生命数量（1条）
            tickRegen: 0.2,         // 持续恢复每秒生命值（0.2条/秒，5秒共1条）
        },
        // 等级效果
        levelEffects: [
            { instantRegen: 1, tickRegen: 0.2, cooldownReduce: 0 }, // 1级：基础效果
            { instantRegen: 1, tickRegen: 0.3, cooldownReduce: 4000 }, // 2级：持续恢复+0.1，冷却-4秒
            { instantRegen: 2, tickRegen: 0.4, cooldownReduce: 8000 }  // 3级：立即恢复+1，持续+0.2，冷却-8秒
        ],
        // 视觉效果
        visual: {
            healParticleColor: ['#2ecc71', '#27ae60'], // 恢复粒子颜色（绿色系）
            healParticleCount: 15,  // 恢复粒子数量（15个）
            bodyGlowColor: 'rgba(46, 204, 113, 0.7)', // 身体发光颜色（绿色半透明）
            glowDuration: 1000,     // 发光时长（1秒）
        },
        // 关联系统
        relatedSystem: 'PlayerLifeSystem' // 关联玩家生命系统（修改生命值）
    }
];

// 技能等级映射（快速查询技能等级对应的效果，避免重复计算）
const SkillLevelMap = SkillTypesConfig.reduce((map, skill) => {
    map[skill.id] = skill.levelEffects.reduce((levelMap, effect, index) => {
        // 等级从1开始，index+1对应等级
        levelMap[index + 1] = {
            ...effect,
            // 合并基础属性与等级效果（等级效果优先级更高）
            cooldown: skill.baseAttr.cooldown - (effect.cooldownReduce || 0) * SkillGlobalConfig.rule.skillCooldownGlobalReduce,
            duration: skill.baseAttr.duration + (effect.durationExtend || 0)
        };
        return levelMap;
    }, {});
    return map;
}, {});

// 导出技能配置（兼容Node.js和浏览器环境，供技能相关模块调用）
try {
    module.exports = { SkillGlobalConfig, SkillTypesConfig, SkillLevelMap };
} catch (e) {
    // 浏览器环境下挂载到window，供player/PlayerSkillSystem.js、ui/PopupUI.js等调用
    window.SkillConfig = { SkillGlobalConfig, SkillTypesConfig, SkillLevelMap };
}
