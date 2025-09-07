// 敌人全局通用配置（所有敌人共享的基础参数）
const EnemyGlobalConfig = {
    // 生成相关配置
    spawn: {
        baseInterval: 2000,     // 基础生成间隔（2秒，随玩家等级提升缩短）
        levelReduceRate: 100,   // 每升1级，生成间隔减少100毫秒（最低不低于500毫秒）
        minSpawnInterval: 500,  // 最小生成间隔（500毫秒，防止生成过于密集）
        spawnArea: {            // 敌人生成区域（相对画布，避免从玩家位置直接生成）
            xMinPercent: 0.05,  // X轴最小生成位置（画布5%宽度）
            xMaxPercent: 0.95,  // X轴最大生成位置（画布95%宽度）
            yMinPercent: -0.1,  // Y轴最小生成位置（画布外10%高度，从上方入场）
            yMaxPercent: -0.05  // Y轴最大生成位置（画布外5%高度）
        },
        maxOnScreen: 15         // 屏幕上最大同时存在敌人数量（防止性能卡顿）
    },
    // 视觉效果配置
    visual: {
        deathParticleCount: 15, // 敌人死亡时生成的粒子数量
        deathParticleColor: ['#3498db', '#2ecc71', '#e74c3c'], // 死亡粒子颜色组
        hitFlashDuration: 150,  // 敌人受击时闪烁时长（150毫秒）
        hitFlashColor: 'rgba(255,255,255,0.5)' // 受击闪烁颜色
    },
    // 通用掉落配置（所有敌人共享的掉落规则）
    drop: {
        baseDropRate: 0.2,      // 基础掉落概率（20%概率掉落道具）
        maxDropCount: 1,        // 单次最多掉落道具数量（1个）
        itemTypes: [            // 可能掉落的道具类型及概率
            { type: 'scoreBoost', rate: 0.7 },   // 分数加成（70%概率）
            { type: 'lifeFragment', rate: 0.3 }  // 生命碎片（30%概率，3个碎片合成1条生命）
        ],
        // 道具效果参数
        itemEffects: {
            scoreBoost: {
                value: 50,      // 分数加成值（+50分）
                duration: 0     // 即时生效，无持续时间
            },
            lifeFragment: {
                fragmentCount: 1// 每次掉落1个碎片
            }
        }
    }
};

// 敌人类型配置（每种敌人独立参数，新增敌人只需在此添加）
const EnemyTypesConfig = [
    // 1. 基础敌人：小型战机（新手期常见，血少、速度慢）
    {
        id: 'smallFighter',     // 敌人唯一ID（用于JS识别）
        name: '小型战机',       // 敌人名称（可选，用于成就/图鉴）
        // 基础属性
        baseAttr: {
            width: 30,          // 宽度
            height: 25,         // 高度
            baseHealth: 1,      // 基础血量（1点血，1枪秒杀）
            levelHealthBoost: 0,// 玩家升级不增加血量（保持基础难度）
            baseSpeed: 2,       // 基础移动速度（像素/帧）
            levelSpeedBoost: 0.1// 玩家每升1级，速度增加0.1（缓慢提升难度）
        },
        // 攻击配置（无攻击能力，仅移动）
        attack: {
            hasAttack: false,   // 是否具备攻击能力（false=无攻击）
            attackInterval: 0,  // 攻击间隔（无攻击则为0）
            bulletParams: null  // 子弹参数（无攻击则为null）
        },
        // 奖励配置
        reward: {
            baseScore: 10,      // 击败基础得分（10分）
            levelScoreBoost: 1  // 玩家每升1级，得分增加1（最高20分）
        },
        // 特殊行为配置（无特殊行为）
        behavior: {
            type: 'straight',   // 移动类型（straight=直线下落）
            moveRange: null,    // 移动范围（直线下落无需范围）
            turnInterval: 0     // 转向间隔（无转向则为0）
        }
    },

    // 2. 攻击型敌人：中型战机（具备基础射击能力）
    {
        id: 'mediumAttacker',   // 敌人唯一ID
        name: '中型战机',       // 敌人名称
        // 基础属性
        baseAttr: {
            width: 35,          // 宽度
            height: 30,         // 高度
            baseHealth: 2,      // 基础血量（2点血，需2枪击败）
            levelHealthBoost: 0.5,// 玩家每升1级，血量增加0.5（最高4点）
            baseSpeed: 1.8,     // 基础移动速度（比小型战机慢）
            levelSpeedBoost: 0.08// 玩家每升1级，速度增加0.08
        },
        // 攻击配置（具备单发射击能力）
        attack: {
            hasAttack: true,    // 是否具备攻击能力（true=有攻击）
            attackInterval: 3000,// 攻击间隔（3秒发射1次）
            bulletParams: {
                width: 5,       // 子弹宽度
                height: 12,     // 子弹高度
                speed: 4,       // 子弹速度（像素/帧）
                color: '#e74c3c',// 子弹颜色
                damage: 1       // 子弹伤害（1点血）
            }
        },
        // 奖励配置
        reward: {
            baseScore: 20,      // 击败基础得分（20分）
            levelScoreBoost: 2  // 玩家每升1级，得分增加2（最高40分）
        },
        // 特殊行为配置（左右摇摆下落）
        behavior: {
            type: 'swing',      // 移动类型（swing=左右摇摆）
            moveRange: {
                xMinPercent: 0.1, // X轴最小移动范围（画布10%宽度）
                xMaxPercent: 0.9  // X轴最大移动范围（画布90%宽度）
            },
            turnInterval: 2000  // 转向间隔（2秒改变一次摇摆方向）
        }
    },

    // 3. 精英敌人：重型装甲机（高血、高防御，概率掉落优质道具）
    {
        id: 'heavyArmor',       // 敌人唯一ID
        name: '重型装甲机',     // 敌人名称
        // 基础属性
        baseAttr: {
            width: 45,          // 宽度
            height: 40,         // 高度
            baseHealth: 5,      // 基础血量（5点血，需多枪击败）
            levelHealthBoost: 1,// 玩家每升1级，血量增加1（最高10点）
            baseSpeed: 1.2,     // 基础移动速度（最慢，强调防御）
            levelSpeedBoost: 0.05// 玩家每升1级，速度增加0.05
        },
        // 攻击配置（多发散射射击）
        attack: {
            hasAttack: true,    // 是否具备攻击能力（true=有攻击）
            attackInterval: 4000,// 攻击间隔（4秒发射1次）
            bulletParams: {
                width: 6,       // 子弹宽度
                height: 14,     // 子弹高度
                speed: 3.5,     // 子弹速度
                color: '#f39c12',// 子弹颜色
                damage: 1,      // 子弹伤害（1点血）
                spreadCount: 3, // 散射数量（每次发射3发）
                spreadAngle: Math.PI/12 // 散射角度（15°，呈扇形分布）
            }
        },
        // 奖励配置（高得分+高掉落概率）
        reward: {
            baseScore: 50,      // 击败基础得分（50分）
            levelScoreBoost: 5, // 玩家每升1级，得分增加5（最高100分）
            extraDropRate: 0.3  // 额外掉落概率（30%概率多掉1个道具）
        },
        // 特殊行为配置（固定路径移动）
        behavior: {
            type: 'path',       // 移动类型（path=固定路径）
            pathPoints: [       // 固定路径点（相对画布百分比）
                { xPercent: 0.2, yPercent: 0.1 },
                { xPercent: 0.8, yPercent: 0.3 },
                { xPercent: 0.5, yPercent: 0.5 },
                { xPercent: 0.2, yPercent: 0.7 }
            ],
            pathSpeed: 0.8      // 路径移动速度（像素/帧，独立于基础速度）
        },
        // 精英敌人专属配置
        eliteConfig: {
            isElite: true,      // 是否为精英敌人（true=精英）
            spawnRate: 0.1,     // 生成概率（10%概率替换普通敌人生成）
            dropExtraItem: true // 是否额外掉落道具（true=额外掉落）
        }
    },

    // 4. BOSS僚机：辅助型战机（仅由BOSS召唤，无独立生成）
    {
        id: 'bossMinion',       // 敌人唯一ID
        name: 'BOSS僚机',       // 敌人名称
        // 基础属性
        baseAttr: {
            width: 30,          // 宽度
            height: 25,         // 高度
            baseHealth: 3,      // 基础血量（3点血）
            levelHealthBoost: 0.5,// 随BOSS等级提升，血量增加0.5
            baseSpeed: 2.5,     // 基础移动速度（较快，辅助BOSS）
            levelSpeedBoost: 0.1// 随BOSS等级提升，速度增加0.1
        },
        // 攻击配置（快速连发）
        attack: {
            hasAttack: true,    // 是否具备攻击能力（true=有攻击）
            attackInterval: 1500,// 攻击间隔（1.5秒发射1次，高频干扰）
            bulletParams: {
                width: 4,       // 子弹宽度
                height: 10,     // 子弹高度
                speed: 4.5,     // 子弹速度（最快，强调干扰）
                color: '#9b59b6',// 子弹颜色
                damage: 1       // 子弹伤害（1点血）
            }
        },
        // 奖励配置（随BOSS奖励结算，基础得分低）
        reward: {
            baseScore: 5,       // 击败基础得分（5分）
            levelScoreBoost: 1  // 随BOSS等级提升，得分增加1
        },
        // 特殊行为配置（围绕BOSS移动）
        behavior: {
            type: 'followBoss', // 移动类型（followBoss=跟随BOSS）
            followRange: 100,   // 跟随范围（BOSS周围100像素）
            orbitSpeed: 0.03    // 环绕速度（每帧0.03弧度，顺时针环绕）
        },
        // 僚机专属配置
        minionConfig: {
            isMinion: true,     // 是否为BOSS僚机（true=僚机）
            spawnWithBoss: true,// 是否随BOSS生成（true=仅BOSS召唤）
            despawnWithBoss: true// BOSS死亡后是否消失（true=随BOSS消失）
        }
    }
];

// 导出敌人配置（供其他模块调用，兼容Node.js和浏览器环境）
try {
    module.exports = { EnemyGlobalConfig, EnemyTypesConfig };
} catch (e) {
    // 浏览器环境下挂载到window，供全局访问
    window.EnemyConfig = { EnemyGlobalConfig, EnemyTypesConfig };
}
