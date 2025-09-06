// 对象池管理类
class ObjectPool {
    constructor() {
        // 初始化各类型对象池
        this.pools = {
            bullets: [],    // 玩家子弹池
            enemies: [],    // 敌人池
            bossBullets: [],// BOSS子弹池
            particles: []   // 粒子池
        };
    }

    // ------------------------------ 子弹对象池 ------------------------------
    getBullet() {
        // 池中有空闲对象则复用，无则创建新对象
        if (this.pools.bullets.length > 0) {
            const bullet = this.pools.bullets.pop();
            bullet.active = true;
            return bullet;
        }
        // 新子弹默认属性（基于GameConfig）
        return {
            x: 0,
            y: 0,
            width: GameConfig.fire.bulletWidth,
            height: GameConfig.fire.bulletHeight,
            speed: GameConfig.fire.bulletSpeed,
            color: GameConfig.fire.bulletColor,
            active: true,
            penetrate: false // 是否穿透（技能控制）
        };
    }

    returnBullet(bullet) {
        // 回收子弹到池，标记为非活跃
        bullet.active = false;
        this.pools.bullets.push(bullet);
    }

    // ------------------------------ 敌人对象池 ------------------------------
    getEnemy(type = 'normal') {
        if (this.pools.enemies.length > 0) {
            const enemy = this.pools.enemies.pop();
            enemy.active = true;
            enemy.type = type;
            return enemy;
        }
        // 新敌人默认属性（基于GameConfig）
        const enemyConfig = GameConfig.enemy.types[type] || GameConfig.enemy.types.normal;
        return {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            speed: 0,
            speedX: 0, // 高速敌人横向速度
            speedY: 0, // 高速敌人纵向速度
            color: '',
            maxHealth: 0,
            health: 0,
            score: 0,
            type: type,
            splitCount: enemyConfig.splitCount || 0,
            active: true
        };
    }

    returnEnemy(enemy) {
        enemy.active = false;
        this.pools.enemies.push(enemy);
    }

    // ------------------------------ BOSS子弹对象池 ------------------------------
    getBossBullet() {
        if (this.pools.bossBullets.length > 0) {
            const bullet = this.pools.bossBullets.pop();
            bullet.active = true;
            return bullet;
        }
        // 新BOSS子弹默认属性
        return {
            x: 0,
            y: 0,
            width: GameConfig.boss.bossBulletSize,
            height: GameConfig.boss.bossBulletSize,
            speedX: 0,
            speedY: 0,
            color: '#e74c3c',
            active: true
        };
    }

    returnBossBullet(bullet) {
        bullet.active = false;
        this.pools.bossBullets.push(bullet);
    }

    // ------------------------------ 粒子对象池 ------------------------------
    getParticle(type = 'enemy') {
        if (this.pools.particles.length > 0) {
            const particle = this.pools.particles.pop();
            particle.active = true;
            particle.type = type;
            return particle;
        }
        // 新粒子默认属性
        return {
            x: 0,
            y: 0,
            width: type === 'boss' ? GameConfig.particle.bossParticleSize : GameConfig.particle.enemyParticleSize,
            height: type === 'boss' ? GameConfig.particle.bossParticleSize : GameConfig.particle.enemyParticleSize,
            color: '#fff',
            speedY: 0,
            opacity: 1,
            active: true,
            type: type
        };
    }

    returnParticle(particle) {
        particle.active = false;
        this.pools.particles.push(particle);
    }

    // ------------------------------ 通用方法 ------------------------------
    // 清空所有对象池（游戏结束时调用）
    clearAll() {
        Object.keys(this.pools).forEach(key => {
            this.pools[key] = [];
        });
    }
}

// 实例化对象池（全局唯一）
const objectPool = new ObjectPool();
