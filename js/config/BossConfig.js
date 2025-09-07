// BOSS全局通用配置（所有BOSS共享的基础参数）
const BossGlobalConfig = {
    // 生成相关配置
    spawn: {
        baseInterval: 90000,    // 基础生成间隔（90秒，随玩家等级提升缩短）
        levelReduceRate: 5000,  // 每升1级，生成间隔减少5秒（最低不低于30秒）
        minSpawnInterval: 30000,// 最小生成间隔（30秒，防止间隔过短）
        warningTime: 3000,      // BOSS出现前警告弹窗时长（3秒）
        spawnPosition: {        // BOSS初始生成位置（相对画布）
            xPercent: 0.5,      // X轴：画布50%宽度（居中）
            yPercent: 0.1       // Y轴：画布10%高度（顶部区域）
        }
    },
    // 视觉效果配置
    visual: {
        deathParticleCount: 50, // BOSS死亡时生成的粒子数量
        deathParticleColor: ['#e74c3c', '#9b59b6', '#f39c12'], // 死亡粒子颜色组
        hitFlashDuration: 200,  // BOSS受击时闪烁时长（200毫秒）
        hitFlashColor: 'rgba(255,255,255,0.6)' // 受击闪烁颜色
    },
    // 通用掉落配置（所有BOSS共享的掉落规则）
    drop: {
        baseDropRate: 1,        // 基础掉落概率（100%必掉落道具）
        maxDropCount: 2,        // 单次最多掉落道具数量（2个）
        itemTypes: [            // 可能掉落的道具类型及概率
            { type: 'speedBoost', rate: 0.6 },  // 射速提升（60%概率）
            { type: 'lifeRestore', rate: 0.4 }, // 生命恢复（40%概率）
            { type: 'shield', rate: 0.3 }       // 护盾（30%概率）
        ],
        // 道具效果参数
        itemEffects: {
            speedBoost: {
                duration: 10000, // 射速提升持续时间（10秒）
                boostRate: 0.3   // 射速提升比例（30%）
            },
            lifeRestore: {
                restoreCount: 1  // 生命恢复数量（1条）
            },
            shield: {
                duration: 15000  // 护盾持续时间（15秒）
            }
        }
    }
};

// BOSS类型配置（每种BOSS独立参数，新增BOSS只需在此添加）
const BossTypesConfig = [
    // 1. 毁灭者号（基础型BOSS，扇形射击技能）
    {
        id: 'destroyer',                // BOSS唯一ID（用于JS识别）
        name: '毁灭者号',               // BOSS显示名称（UI展示）
        desc: '擅长扇形弹幕攻击，移动速度较慢但血量较高', // BOSS描述（可选，用于成就/图鉴）
        // 基础属性
        baseAttr: {
            width: 120,                 // 宽度
            height: 120,                // 高度
            baseHealth: 50,             // 基础血量（随玩家等级提升）
            levelHealthBoost: 2,        // 玩家每升1级，BOSS血量增加2点
            moveSpeed: 1.2,             // 移动速度（像素/帧）
            score: 1000                 // 击败后获得的分数
        },
        // 普通攻击配置
        normalAttack: {
            bulletSpeed: 5,             // 子弹速度（像素/帧）
            attackInterval: 1000,       // 攻击间隔（1秒）
            bulletCount: 3,             // 每次攻击发射子弹数量（3发）
            bulletSize: { width: 8, height: 15 }, // 子弹尺寸
            bulletColor: '#e74c3c'      // 子弹颜色
        },
        // 技能配置（支持多技能，按优先级触发）
        skills: [
            {
                id: 'fanShot',          // 技能唯一ID
                name: '扇形弹幕',       // 技能名称（可选）
                triggerInterval: 5000,  // 技能触发间隔（5秒）
                coolDown: 3000,         // 技能冷却时间（3秒，防止连续触发）
                // 扇形射击参数
                params: {
                    angleRange: [-Math.PI/4, Math.PI/4], // 角度范围（-45° 到 45°）
                    angleStep: Math.PI/12,               // 每发子弹角度差（15°）
                    bulletCount: 7,                      // 技能发射子弹数量（7发）
                    bulletSpeed: 4.5,                    // 技能子弹速度
                    bulletSize: { width: 6, height: 12 },// 技能子弹尺寸
                    bulletColor: '#f39c12'               // 技能子弹颜色
                }
            }
        ]
    },

    // 2. 死亡之翼（召唤型BOSS，召唤僚机+追踪弹）
    {
        id: 'deathWing',                // BOSS唯一ID
        name: '死亡之翼',               // BOSS显示名称
        desc: '能召唤僚机协助战斗，同时发射追踪子弹，需优先处理僚机', // BOSS描述
        // 基础属性
        baseAttr: {
            width: 150,                 // 宽度
            height: 150,                // 高度
            baseHealth: 60,             // 基础血量
            levelHealthBoost: 2.5,      // 玩家每升1级，BOSS血量增加2.5点
            moveSpeed: 1.0,             // 移动速度（比毁灭者慢）
            score: 1500                 // 击败后获得的分数
        },
        // 普通攻击配置
        normalAttack: {
            bulletSpeed: 4,             // 子弹速度
            attackInterval: 1200,       // 攻击间隔（1.2秒）
            bulletCount: 2,             // 每次攻击发射子弹数量（2发）
            bulletSize: { width: 10, height: 18 }, // 子弹尺寸
            bulletColor: '#9b59b6',     // 子弹颜色
            isHoming: true,             // 是否为追踪弹（true=追踪玩家）
            homingAngleStep: 0.05       // 追踪弹转向角度（每帧0.05弧度，越大数据越灵活）
        },
        // 技能配置（召唤僚机 + 追踪弹幕）
        skills: [
            {
                id: 'summonMinions',    // 技能1：召唤僚机
                name: '僚机召唤',       // 技能名称
                triggerInterval: 8000,  // 触发间隔（8秒）
                coolDown: 5000,         // 冷却时间（5秒）
                // 召唤参数
                params: {
                    minionCount: 3,     // 每次召唤僚机数量（3个）
                    minionType: 'smallEnemy', // 僚机类型（对应EnemyConfig中的敌人ID）
                    spawnOffsetX: 80,   // 僚机X轴生成偏移（左右各80像素）
                    spawnOffsetY: 50    // 僚机Y轴生成偏移（BOSS下方50像素）
                }
            },
            {
                id: 'homingBarrage',    // 技能2：追踪弹幕
                name: '追踪弹幕',       // 技能名称
                triggerInterval: 6000,  // 触发间隔（6秒）
                coolDown: 4000,         // 冷却时间（4秒）
                // 追踪弹幕参数
                params: {
                    bulletCount: 5,      // 每次发射追踪弹数量（5发）
                    bulletSpeed: 3.5,    // 子弹速度
                    bulletSize: { width: 8, height: 14 }, // 子弹尺寸
                    bulletColor: '#8e44ad', // 子弹颜色
                    homingAngleStep: 0.08 // 追踪灵活性（比普通攻击更高）
                }
            }
        ]
    },

    // 3. 风暴泰坦（范围伤害型BOSS，冲击波+全屏弹幕）
    {
        id: 'stormTitan',               // BOSS唯一ID
        name: '风暴泰坦',               // BOSS显示名称
        desc: '拥有大范围冲击波和全屏弹幕技能，需注意躲避时机', // BOSS描述
        // 基础属性
        baseAttr: {
            width: 180,                 // 宽度（更大体型）
            height: 180,                // 高度
            baseHealth: 80,             // 基础血量（更高）
            levelHealthBoost: 3,        // 玩家每升1级，BOSS血量增加3点
            moveSpeed: 0.8,             // 移动速度（最慢）
            score: 2000                 // 击败后获得的分数（最高）
        },
        // 普通攻击配置（范围伤害）
        normalAttack: {
            bulletSpeed: 3,             // 子弹速度（较慢，但范围大）
            attackInterval: 1500,       // 攻击间隔（1.5秒）
            bulletCount: 1,             // 每次攻击发射1个范围弹
            bulletSize: { width: 15, height: 15 }, // 子弹尺寸（更大）
            bulletColor: '#3498db',     // 子弹颜色
            isAreaDamage: true,         // 是否为范围伤害（true）
            areaRadius: 30              // 范围伤害半径（30像素）
        },
        // 技能配置（冲击波 + 全屏弹幕）
        skills: [
            {
                id: 'shockwave',        // 技能1：冲击波
                name: '能量冲击波',     // 技能名称
                triggerInterval: 10000, // 触发间隔（10秒）
                coolDown: 6000,         // 冷却时间（6秒）
                // 冲击波参数
                params: {
                    waveCount: 3,       // 每次释放3道冲击波
                    waveSpeed: 6,       // 冲击波速度
                    waveWidth: 20,      // 冲击波宽度
                    waveHeight: 100,    // 冲击波高度
                    waveColor: '#2ecc71',// 冲击波颜色
                    waveInterval: 500,  // 每道冲击波间隔（500毫秒）
                    damage: 2           // 冲击波伤害（2点血）
                }
            },
            {
                id: 'fullScreenBarrage',// 技能2：全屏弹幕
                name: '全屏弹幕',       // 技能名称
                triggerInterval: 12000, // 触发间隔（12秒，大招技能）
                coolDown: 8000,         // 冷却时间（8秒）
                warningTime: 1500,      // 技能释放前警告时长（1.5秒，提示玩家躲避）
                // 全屏弹幕参数
                params: {
                    bulletCount: 30,     // 单次发射子弹数量（30发）
                    bulletSpeed: 4,      // 子弹速度
                    bulletSize: { width: 6, height: 6 }, // 子弹尺寸（小而密集）
                    bulletColor: '#e67e22', // 子弹颜色
                    spreadRange: Math.PI, // 弹幕扩散范围（180°，全屏覆盖）
                    safeAreaRadius: 50   // 玩家周围安全区域半径（50像素，留躲避空间）
                }
            }
        ]
    }
];

// 导出BOSS配置（供其他模块调用，若不支持ES6 export则注释此行，直接通过全局变量访问）
try {
    module.exports = { BossGlobalConfig, BossTypesConfig };
} catch (e) {
    // 浏览器环境下挂载到window，供全局访问
    window.BossConfig = { BossGlobalConfig, BossTypesConfig };
}
