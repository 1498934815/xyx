// 游戏全局配置对象
const GameConfig = {
    // 画布基础设置
    canvas: {
        defaultWidth: window.innerWidth,
        defaultHeight: window.innerHeight
    },

    // 玩家初始属性
    player: {
        width: 40,
        height: 40,
        speed: 5,
        color: '#3498db',
        initLives: 3,
        hitFlashFrames: 60 // 被击中后闪烁帧数
    },

    // 射击系统配置
    fire: {
        initRate: 200, // 初始射击间隔(ms)
        minRate: 100,  // 最低射击间隔(ms)
        bulletSpeed: 12,
        bulletWidth: 6,
        bulletHeight: 15,
        bulletColor: '#f1c40f'
    },

    // 等级与成长配置
    level: {
        initScore: 0,
        initLevel: 1,
        firstLevelNeed: 100, // 1级升2级所需分数
        levelUpRatio: {      // 不同等级段升级分数增幅
            1: 1.5,   // 1-5级
            6: 1.4,   // 6-10级
            11: 1.3   // 10级后
        },
        fireRateReduce: 20, // 每级减少的射击间隔(ms)
        skillUnlockLevel: 2 // 首次解锁技能的等级
    },

    // 敌人系统配置
    enemy: {
        spawnInterval: 1500, // 普通敌人生成间隔(ms)
        types: {             // 敌人类型配置
            normal: {
                sizeRange: [30, 50],  // 宽高范围
                speedMultiplier: 1,
                healthMultiplier: 1,
                scoreBase: 10,
                colorHueRange: [0, 60] // HSL色相范围
            },
            fast: {
                sizeRange: [20, 30],
                speedMultiplier: 1.5,
                health: 1,
                scoreBase: 20,
                colorHueRange: [180, 210]
            },
            split: {
                sizeRange: [35, 50],
                speedMultiplier: 0.8,
                healthMultiplier: 2,
                scoreBase: 15,
                colorHueRange: [300, 330],
                splitCount: 2 // 分裂次数
            }
        },
        levelMultipliers: { // 敌人属性随等级增幅
            speed: 0.1,   // 每级+10%
            health: 0.15, // 每级+15%
            score: 0.1    // 每级+10%
        }
    },

    // BOSS系统配置
    boss: {
        spawnInterval: 90000, // BOSS生成间隔(ms)
        warningTime: 3000,    // BOSS出现前警告时长(ms)
        types: [
            {
                name: "毁灭者号",
                width: 150,
                height: 80,
                baseHealth: 50,
                color: '#e74c3c',
                attackSpeed: 1500,
                bulletSpeed: 4,
                baseScore: 500,
                skill: { type: 'fanShot', interval: 5000, angleRange: [-Math.PI/4, Math.PI/4], angleStep: 0.2 }
            },
            {
                name: "死亡之翼",
                width: 180,
                height: 100,
                baseHealth: 70,
                color: '#9b59b6',
                attackSpeed: 1200,
                bulletSpeed: 5,
                baseScore: 700,
                skill: { type: 'summonMinions', interval: 8000, minionCount: 2 }
            },
            {
                name: "末日战舰",
                width: 200,
                height: 120,
                baseHealth: 100,
                color: '#3498db',
                attackSpeed: 1000,
                bulletSpeed: 6,
                baseScore: 1000,
                skill: { type: 'shockwave', interval: 8000, safeRadius: 50 }
            }
        ],
        levelMultipliers: { // BOSS属性随等级增幅
            health: 0.1,  // 每级+10%（原0.2优化）
            score: 0.1    // 每级+10%
        },
        bossBulletSize: 20
    },

    // 技能系统配置
    skill: {
        list: [
            {
                id: 'penetrate',
                name: '穿透子弹',
                desc: '子弹可穿透1个敌人，持续10秒，冷却30秒',
                duration: 10000,
                cooldown: 30000
            },
            {
                id: 'shield',
                name: '护盾防御',
                desc: '生成护盾吸收3次伤害，持续8秒，冷却45秒',
                duration: 8000,
                cooldown: 45000,
                maxHits: 3
            },
            {
                id: 'speedBoost',
                name: '射速爆发',
                desc: '射速临时降低50%，持续5秒，冷却60秒',
                duration: 5000,
                cooldown: 60000,
                rateReduceRatio: 0.5
            }
        ]
    },

    // 生命恢复配置
    lifeRegen: {
        interval: 60000, // 恢复间隔(ms)
        maxLives: 3      // 最大生命值
    },

    // 星星背景配置
    stars: {
        baseCount: 60,       // 基础星星数量
        maxCount: 100,       // 最大星星数量
        sizeRange: [0.5, 3], // 星星大小范围
        speedRange: [0.2, 1] // 星星移动速度范围
    },

    // 摇杆控制配置
    joystick: {
        baseSize: 80,    // 摇杆底座大小(px)
        handleSize: 40,  // 摇杆手柄大小(px)
        maxRadius: 40,   // 摇杆最大活动半径(px)
        deadZone: 5,     // 死区范围(px)
        areaSize: 120    // 摇杆操作区大小(px)
    },

    // 粒子效果配置
    particle: {
        enemyDeathCount: 10,  // 敌人死亡粒子数量
        bossDeathCount: 30,   // BOSS死亡粒子数量
        enemyParticleSize: 4,
        bossParticleSize: 8,
        fadeTime: 1000        // 粒子消失时间(ms)
    },

    // 成就系统配置
    achievement: {
        list: [
            { id: 'newbie', name: '新手飞行员', condition: (data) => data.score >= 100, desc: '首次获得100分' },
            { id: 'killer', name: '敌人杀手', condition: (data) => data.enemyKilled >= 10, desc: '击败10个敌人' },
            { id: 'bossHunter', name: 'BOSS猎人', condition: (data) => data.bossKilled >= 1, desc: '首次击败BOSS' },
            { id: 'survivor', name: '生存大师', condition: (data) => data.gameTime >= 120000, desc: '存活2分钟' },
            { id: 'skilled', name: '技能专家', condition: (data) => data.skillUsed >= 3, desc: '激活3次技能' },
            { id: 'sharpshooter', name: '神枪手', condition: (data) => data.consecutiveKills >= 10, desc: '连续击杀10个敌人' },
            { id: 'maxLevel', name: '等级达人', condition: (data) => data.level >= 5, desc: '达到5级' },
            { id: 'noDamage', name: '无伤战神', condition: (data) => data.bossKilledWithoutDamage >= 1, desc: '无伤击败BOSS' },
            { id: 'fullLife', name: '满血战神', condition: (data) => data.fullLifeTime >= 30000, desc: '保持满血30秒' },
            { id: 'master', name: '太空大师', condition: (data) => data.score >= 10000, desc: '获得10000分' }
        ]
    }
};

// 游戏状态管理（全局可访问）
const GameState = {
    running: false,
    score: 0,
    lives: 0,
    level: 0,
    nextLevelScore: 0,
    fireRate: 0,
    bossActive: false,
    bossKilledCount: 0,
    enemyKilledCount: 0,
    consecutiveKills: 0,
    consecutiveKillTimer: null,
    activeSkill: null,
    skillUsedCount: 0,
    bossKilledWithoutDamage: 0,
    fullLifeTime: 0,
    lastDamageTime: 0,
    gameTime: 0,
    settings: {
        autoFire: false,
        fixedJoystick: false,
        soundEnabled: true
    }
};
