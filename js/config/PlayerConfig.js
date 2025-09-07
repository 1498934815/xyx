// 玩家全局通用配置（所有玩家相关模块共享的基础参数）
const PlayerConfig = {
    // ================= 玩家基础属性配置 =================
    baseAttr: {
        id: 'player',               // 玩家唯一标识（用于DOM/对象池识别）
        initialWidth: 40,           // 初始宽度（像素）
        initialHeight: 50,          // 初始高度（像素）
        maxWidth: 50,               // 最大宽度（技能/道具效果上限）
        maxHeight: 60,              // 最大高度（技能/道具效果上限）
        initialSpeed: 5,            // 初始移动速度（像素/帧）
        maxSpeed: 8,                // 最大移动速度（技能/道具效果上限）
        speedBoostStep: 0.5,        // 每次速度提升幅度（如技能"速度提升"生效时）
        initialLives: 3,            // 初始生命数量（与GameGlobalConfig.gameRule.initialLives保持一致）
        maxLives: 5,                // 最大生命上限（与GameGlobalConfig.gameRule.maxLives保持一致）
        invincibilityDuration: 1500,// 受击后无敌时间（1.5秒，防止连续掉血）
        invincibilityFlashInterval: 100, // 无敌状态闪烁间隔（100毫秒，视觉提示）
    },

    // ================= 玩家射击系统配置 =================
    fireSystem: {
        initialFireRate: 300,       // 初始射速（300毫秒/发，值越小射速越快）
        minFireRate: 100,           // 最小射速（100毫秒/发，技能/道具效果上限）
        fireRateReduceStep: 20,     // 每次射速提升幅度（如升级/道具"射速提升"生效时）
        initialBulletCount: 1,      // 初始单次发射子弹数量（1发）
        maxBulletCount: 5,          // 最大单次发射子弹数量（技能"多重射击"效果上限）
        bulletCountIncreaseStep: 1, // 每次子弹数量提升幅度
        // 玩家子弹配置（与EnemyConfig的敌人子弹区分）
        bullet: {
            width: 6,               // 子弹宽度（像素）
            height: 12,             // 子弹高度（像素）
            speed: 8,               // 子弹速度（像素/帧，向上飞行）
            damage: 1,              // 子弹基础伤害（1点血）
            maxDamage: 3,           // 子弹最大伤害（技能/道具效果上限）
            damageBoostStep: 0.5,   // 每次伤害提升幅度
            color: '#3498db',       // 子弹默认颜色（蓝色）
            penetrateCount: 0,      // 初始穿透次数（0次，无法穿透敌人）
            maxPenetrateCount: 3,   // 最大穿透次数（技能"穿透子弹"效果上限）
            criticalRate: 0.1,      // 暴击概率（10%，暴击时伤害×2）
            criticalMultiplier: 2,  // 暴击伤害倍率（2倍）
        },
        // 射击偏移配置（多子弹时的散射角度）
        spread: {
            initialAngle: 0,        // 初始射击角度（0弧度，正上方）
            maxSpreadAngle: Math.PI/12, // 最大散射角度（15°，多子弹时的角度范围）
            spreadStep: Math.PI/24, // 每次散射角度提升幅度（7.5°）
        }
    },

    // ================= 玩家技能系统配置 =================
    skillSystem: {
        initialSkillSlots: 1,       // 初始技能槽数量（1个，随等级解锁更多）
        maxSkillSlots: 3,           // 最大技能槽数量（3个，等级上限解锁）
        skillUnlockLevel: [3, 6],   // 解锁技能槽的等级（3级解锁第2个，6级解锁第3个）
        defaultSkill: 'speedBoost', // 默认初始技能（"速度提升"，新手引导用）
        // 技能冷却基础配置（与SkillConfig联动，此处定义玩家专属冷却倍率）
        cooldown: {
            baseMultiplier: 1,      // 基础冷却倍率（1=无加成）
            maxReductionMultiplier: 0.5, // 最大冷却缩减倍率（50%，技能/道具效果上限）
            reductionStep: 0.1,     // 每次冷却缩减幅度（10%）
        },
        // 技能效果持续时间配置（与SkillConfig联动，玩家专属延长倍率）
        duration: {
            baseMultiplier: 1,      // 基础持续时间倍率（1=无加成）
            maxExtensionMultiplier: 2, // 最大持续时间延长倍率（2倍，技能/道具效果上限）
            extensionStep: 0.2,     // 每次持续时间延长幅度（20%）
        }
    },

    // ================= 玩家视觉效果配置 =================
    visual: {
        // 受击效果
        hitEffect: {
            particleCount: 8,        // 受击时生成粒子数量（8个）
            particleColor: ['#e74c3c', '#ff6b6b'], // 受击粒子颜色（红色系）
            particleSizeRange: [3, 6], // 粒子尺寸范围（3-6像素）
            particleSpeedRange: [2, 5], // 粒子速度范围（2-5像素/帧）
            flashColor: 'rgba(255, 59, 48, 0.7)', // 受击闪烁颜色
            flashDuration: 200,      // 受击闪烁时长（200毫秒）
        },
        // 死亡效果
        deathEffect: {
            particleCount: 30,       // 死亡时生成粒子数量（30个）
            particleColor: ['#ff9f43', '#ff6b6b', '#ff3838'], // 死亡粒子颜色（橙红色系）
            particleSizeRange: [5, 10], // 粒子尺寸范围（5-10像素）
            particleSpeedRange: [3, 8], // 粒子速度范围（3-8像素/帧）
            explosionDuration: 800,  // 死亡爆炸动画时长（800毫秒）
            fadeOutDuration: 500,    // 死亡后淡出时长（500毫秒）
        },
        // 无敌状态效果
        invincibilityEffect: {
            flashColor: 'rgba(255, 255, 255, 0.5)', // 无敌闪烁颜色（白色半透明）
            trailColor: 'rgba(52, 152, 219, 0.3)',  // 无敌状态拖影颜色（蓝色半透明）
            trailLength: 5,          // 拖影长度（5帧）
        },
        // 技能激活效果
        skillActivateEffect: {
            particleCount: 15,       // 技能激活时生成粒子数量（15个）
            particleColor: ['#9b59b6', '#8e44ad'], // 技能粒子颜色（紫色系）
            particleSizeRange: [4, 8], // 粒子尺寸范围（4-8像素）
            particleSpeedRange: [2, 6], // 粒子速度范围（2-6像素/帧）
            glowColor: 'rgba(155, 89, 182, 0.8)',  // 技能激活发光颜色
            glowDuration: 1000,      // 发光效果时长（1秒）
        }
    },

    // ================= 玩家移动与边界配置 =================
    movement: {
        // 移动边界（防止玩家移出画布）
        boundary: {
            leftOffset: 10,          // 左边界偏移（10像素，防止玩家一半移出屏幕）
            rightOffset: 10,         // 右边界偏移（10像素）
            topOffset: 10,           // 上边界偏移（10像素）
            bottomOffset: 100,       // 下边界偏移（100像素，避开操作摇杆区域）
        },
        // 移动平滑度配置（缓动效果）
        smoothness: {
            enableEasing: true,      // 是否开启移动缓动（true=开启，提升操作手感）
            easingFactor: 0.1,       // 缓动系数（0.1，值越小缓动越明显）
            maxEasingSpeed: 10,      // 最大缓动速度（防止移动过快）
        },
        // 触摸/摇杆控制适配
        control: {
            speedMultiplier: 1,      // 摇杆控制速度倍率（1=与键盘控制一致）
            deadZone: 0.1,           // 摇杆死区（10%，防止微小操作触发移动）
            maxControlRange: 1,      // 摇杆最大控制范围（1=满速）
        }
    }
};

// 导出玩家配置（兼容Node.js和浏览器环境，供玩家相关模块调用）
try {
    // Node.js环境（如构建工具）：通过module.exports导出
    module.exports = PlayerConfig;
} catch (e) {
    // 浏览器环境：挂载到window全局对象，供player/子模块、ui/ControlUI.js等调用
    window.PlayerConfig = PlayerConfig;
}
