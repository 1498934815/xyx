// 玩家管理类（控制玩家所有行为）
class Player {
    constructor() {
        // 玩家基础属性（基于配置初始化）
        this.player = {
            x: 0,
            y: 0,
            width: GameConfig.player.width,
            height: GameConfig.player.height,
            speed: GameConfig.player.speed,
            color: GameConfig.player.color,
            hitTimer: 0 // 被击中后闪烁计时器
        };
        // 射击相关状态
        this.fireState = {
            isFiring: false,
            fireInterval: null,
            currentRate: GameConfig.fire.rate
        };
        // 技能相关状态
        this.skillState = {
            activeSkill: null, // 当前激活的技能（null为无）
            cooldownTime: 0,   // 技能冷却时间（ms）
            shieldActive: false, // 护盾是否激活
            shieldHits: 0      // 护盾已吸收伤害次数
        };
        // 摇杆控制状态
        this.joystick = {
            isActive: false,
            baseX: 0,
            baseY: 0,
            direction: { x: 0, y: 0 }
        };
        // 缓存玩家相关DOM元素
        this.joystickElements = {
            area: Utils.getElement('joystickArea'),
            base: Utils.getElement('joystickBase'),
            handle: Utils.getElement('joystickHandle')
        };
        this.fireButton = Utils.getElement('fireButton');
        this.skillButton = Utils.getElement('skillButton');
    }

    // ------------------------------ 初始化与重置 ------------------------------
    /**
     * 初始化玩家状态（游戏开始/重新开始时调用）
     */
    init() {
        // 重置玩家位置（居中底部）
        this.resetPosition();
        // 重置射击状态
        this.fireState.isFiring = false;
        this.fireState.currentRate = GameConfig.fire.initRate;
        if (this.fireState.fireInterval) clearInterval(this.fireState.fireInterval);
        // 重置技能状态
        this.skillState.activeSkill = null;
        this.skillState.cooldownTime = 0;
        this.skillState.shieldActive = false;
        this.skillState.shieldHits = 0;
        // 重置摇杆状态
        this.joystick.isActive = false;
        this.resetJoystick();
        // 同步游戏状态
        GameState.fireRate = this.fireState.currentRate;
        GameState.activeSkill = null;
        // 绑定操作事件（避免重复绑定）
        this.bindControlEvents();
        // 自动射击（根据设置）
        if (GameState.settings.autoFire) this.startFiring();
    }

    /**
     * 重置玩家位置到初始位置
     */
    resetPosition() {
        const canvas = Utils.getElement('gameCanvas');
        this.player.x = canvas.width / 2 - this.player.width / 2;
        this.player.y = canvas.height - 100;
    }

    /**
     * 重置摇杆位置（回到中心）
     */
    resetJoystick() {
        this.joystick.direction = { x: 0, y: 0 };
        this.joystickElements.handle.style.transform = 'translate(0px, 0px)';
        // 固定摇杆模式下重置底座位置
        if (GameState.settings.fixedJoystick) {
            this.joystickElements.base.style.left = '20px';
            this.joystickElements.base.style.top = '20px';
        }
        // 更新摇杆底座中心点坐标
        this.updateJoystickBasePos();
    }

    /**
     * 更新摇杆底座中心点坐标（适配窗口大小变化）
     */
    updateJoystickBasePos() {
        const baseRect = this.joystickElements.base.getBoundingClientRect();
        this.joystick.baseX = baseRect.left + baseRect.width / 2;
        this.joystick.baseY = baseRect.top + baseRect.height / 2;
    }

    // ------------------------------ 操作控制绑定 ------------------------------
    /**
     * 绑定摇杆、射击、技能按钮的交互事件
     */
    bindControlEvents() {
        // 1. 摇杆控制事件（触摸+鼠标）
        this.bindJoystickEvents();
        // 2. 射击按钮事件（触摸+鼠标）
        this.bindFireButtonEvents();
        // 3. 技能按钮事件（触摸+鼠标）
        this.bindSkillButtonEvents();
        // 4. 自动射击开关监听
        Utils.getElement('autoFireToggle').addEventListener('change', (e) => {
            GameState.settings.autoFire = e.target.checked;
            if (GameState.settings.autoFire && GameState.running) {
                this.startFiring();
            } else {
                this.stopFiring();
            }
        });
        // 5. 固定摇杆开关监听
        Utils.getElement('fixedJoystickToggle').addEventListener('change', (e) => {
            GameState.settings.fixedJoystick = e.target.checked;
            this.resetJoystick();
        });
        // 6. 窗口大小变化时更新摇杆位置
        window.addEventListener('resize', () => {
            this.updateJoystickBasePos();
        });
    }

    /**
     * 绑定摇杆控制事件（触摸+鼠标）
     */
    bindJoystickEvents() {
        // 触摸开始/鼠标按下
        this.joystickElements.area.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!GameState.running) return;
            this.joystick.isActive = true;
            // 非固定摇杆：跟随触摸位置生成底座
            if (!GameState.settings.fixedJoystick) {
                const touch = e.touches[0];
                this.joystickElements.base.style.left = `${touch.clientX - this.joystickElements.base.offsetWidth / 2}px`;
                this.joystickElements.base.style.top = `${touch.clientY - this.joystickElements.base.offsetHeight / 2}px`;
                this.updateJoystickBasePos();
            }
            this.updateJoystickPosition(e.touches[0].clientX, e.touches[0].clientY);
        });

        this.joystickElements.area.addEventListener('mousedown', (e) => {
            if (!GameState.running) return;
            this.joystick.isActive = true;
            // 非固定摇杆：跟随鼠标位置生成底座
            if (!GameState.settings.fixedJoystick) {
                this.joystickElements.base.style.left = `${e.clientX - this.joystickElements.base.offsetWidth / 2}px`;
                this.joystickElements.base.style.top = `${e.clientY - this.joystickElements.base.offsetHeight / 2}px`;
                this.updateJoystickBasePos();
            }
            this.updateJoystickPosition(e.clientX, e.clientY);
        });

        // 触摸移动/鼠标移动
        this.joystickElements.area.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystick.isActive && GameState.running) {
                this.updateJoystickPosition(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.joystick.isActive && GameState.running) {
                this.updateJoystickPosition(e.clientX, e.clientY);
            }
        });

        // 触摸结束/鼠标松开
        this.joystickElements.area.addEventListener('touchend', () => {
            this.joystick.isActive = false;
            this.resetJoystick();
        });

        document.addEventListener('mouseup', () => {
            this.joystick.isActive = false;
            this.resetJoystick();
        });
    }

    /**
     * 绑定射击按钮事件（触摸+鼠标）
     */
    bindFireButtonEvents() {
        // 触摸开始/鼠标按下
        this.fireButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!GameState.settings.autoFire && GameState.running) {
                this.startFiring();
            }
        });

        this.fireButton.addEventListener('mousedown', () => {
            if (!GameState.settings.autoFire && GameState.running) {
                this.startFiring();
            }
        });

        // 触摸结束/鼠标松开/鼠标离开
        this.fireButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!GameState.settings.autoFire) {
                this.stopFiring();
            }
        });

        this.fireButton.addEventListener('mouseup', () => {
            if (!GameState.settings.autoFire) {
                this.stopFiring();
            }
        });

        this.fireButton.addEventListener('mouseleave', () => {
            if (!GameState.settings.autoFire) {
                this.stopFiring();
            }
        });
    }

    /**
     * 绑定技能按钮事件（触摸+鼠标）
     */
    bindSkillButtonEvents() {
        this.skillButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (GameState.running) this.activateSkill();
        });

        this.skillButton.addEventListener('click', () => {
            if (GameState.running) this.activateSkill();
        });
    }

    // ------------------------------ 摇杆位置更新 ------------------------------
    /**
     * 根据触摸/鼠标位置更新摇杆方向和手柄位置
     * @param {number} clientX - 触摸/鼠标X坐标
     * @param {number} clientY - 触摸/鼠标Y坐标
     */
    updateJoystickPosition(clientX, clientY) {
        const dx = clientX - this.joystick.baseX;
        const dy = clientY - this.joystick.baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 死区处理：距离小于死区时不改变方向
        if (distance < GameConfig.joystick.deadZone) {
            this.joystick.direction.x = 0;
            this.joystick.direction.y = 0;
            this.joystickElements.handle.style.transform = 'translate(0px, 0px)';
            return;
        }

        // 限制摇杆范围在最大半径内
        if (distance > GameConfig.joystick.maxRadius) {
            const angle = Math.atan2(dy, dx);
            const limitedX = Math.cos(angle) * GameConfig.joystick.maxRadius;
            const limitedY = Math.sin(angle) * GameConfig.joystick.maxRadius;
            this.joystickElements.handle.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
            this.joystick.direction.x = limitedX / GameConfig.joystick.maxRadius;
            this.joystick.direction.y = limitedY / GameConfig.joystick.maxRadius;
        } else {
            this.joystickElements.handle.style.transform = `translate(${dx}px, ${dy}px)`;
            this.joystick.direction.x = dx / GameConfig.joystick.maxRadius;
            this.joystick.direction.y = dy / GameConfig.joystick.maxRadius;
        }
    }

    // ------------------------------ 玩家移动 ------------------------------
    /**
     * 更新玩家位置（基于摇杆方向）
     */
    updatePosition() {
        if (!this.joystick.isActive || !GameState.running) return;

        // 计算移动距离（方向×速度）
        const moveX = this.joystick.direction.x * this.player.speed;
        const moveY = this.joystick.direction.y * this.player.speed;

        // 更新位置
        this.player.x += moveX;
        this.player.y += moveY;

        // 边界检测（防止超出画布）
        const canvas = Utils.getElement('gameCanvas');
        this.player.x = Utils.clamp(this.player.x, 0, canvas.width - this.player.width);
        this.player.y = Utils.clamp(this.player.y, 0, canvas.height - this.player.height);
    }

    // ------------------------------ 射击控制 ------------------------------
    /**
     * 开始连续射击
     */
    startFiring() {
        if (this.fireState.isFiring || !GameState.running) return;
        
        this.fireState.isFiring = true;
        this.fireBullet(); // 立即发射第一颗子弹
        // 后续子弹按当前射速发射
        this.fireState.fireInterval = setInterval(() => {
            this.fireBullet();
        }, this.fireState.currentRate);
    }

    /**
     * 停止连续射击
     */
    stopFiring() {
        if (!this.fireState.isFiring) return;
        
        this.fireState.isFiring = false;
        if (this.fireState.fireInterval) clearInterval(this.fireState.fireInterval);
    }

    /**
     * 发射单颗子弹（从对象池获取）
     * @returns {Object} 发射的子弹对象
     */
    fireBullet() {
        if (!GameState.running) return null;
        
        // 从对象池获取子弹
        const bullet = objectPool.getBullet();
        // 设置子弹位置（玩家中心顶部）
        bullet.x = this.player.x + this.player.width / 2 - bullet.width / 2;
        bullet.y = this.player.y - bullet.height;
        // 设置子弹穿透属性（根据当前激活技能）
        bullet.penetrate = this.skillState.activeSkill === 'penetrate';
        // 播放射击音效
        soundManager.playShoot();
        // 移动端震动反馈（如果支持）
        if (navigator.vibrate) navigator.vibrate(10);
        
        return bullet;
    }

    /**
     * 升级射击速度（等级提升时调用）
     */
    upgradeFireRate() {
        // 每级减少20ms，最低100ms
        this.fireState.currentRate = Math.max(
            GameConfig.fire.minRate,
            this.fireState.currentRate - GameConfig.level.fireRateReduce
        );
        // 同步游戏状态
        GameState.fireRate = this.fireState.currentRate;
        // 如果正在射击，更新射击间隔
        if (this.fireState.isFiring) {
            this.stopFiring();
            this.startFiring();
        }
    }

    // ------------------------------ 技能控制 ------------------------------
    /**
     * 激活当前选中的技能
     */
    activateSkill() {
        // 检查技能激活条件（有选中技能+不在冷却）
        if (!this.skillState.activeSkill || this.skillState.cooldownTime > 0 || !GameState.running) return;
        
        const skillConfig = GameConfig.skill.list.find(s => s.id === this.skillState.activeSkill);
        if (!skillConfig) return;
        
        // 播放技能激活音效
        soundManager.playSkillActivate();
        // 记录技能使用次数（用于成就）
        GameState.skillUsedCount++;
        // 执行技能效果
        switch (this.skillState.activeSkill) {
            case 'penetrate':
                this.activatePenetrateSkill(skillConfig.duration);
                break;
            case 'shield':
                this.activateShieldSkill(skillConfig.duration, skillConfig.maxHits);
                break;
            case 'speedBoost':
                this.activateSpeedBoostSkill(skillConfig.duration, skillConfig.rateReduceRatio);
                break;
        }
        // 设置技能冷却
        this.skillState.cooldownTime = skillConfig.cooldown;
        GameState.skillCooldownTime = skillConfig.cooldown;
    }

    /**
     * 激活"穿透子弹"技能
     * @param {number} duration - 技能持续时间（ms）
     */
    activatePenetrateSkill(duration) {
        // 所有新发射的子弹将带有穿透属性（fireBullet中已处理）
        // 技能结束后重置穿透属性（对已发射的子弹无影响）
        setTimeout(() => {
            // 无需额外操作，新子弹会自动恢复非穿透
        }, duration);
    }

    /**
     * 激活"护盾防御"技能
     * @param {number} duration - 技能持续时间（ms）
     * @param {number} maxHits - 护盾最大吸收伤害次数
     */
    activateShieldSkill(duration, maxHits) {
        this.skillState.shieldActive = true;
        this.skillState.shieldHits = 0;
        // 技能到期自动关闭护盾
        setTimeout(() => {
            this.skillState.shieldActive = false;
        }, duration);
    }

    /**
     * 激活"射速爆发"技能
     * @param {number} duration - 技能持续时间（ms）
     * @param {number} reduceRatio - 射速降低比例（如0.5=降低50%）
     */
    activateSpeedBoostSkill(duration, reduceRatio) {
        const originalRate = this.fireState.currentRate;
        // 临时降低射速（最低50ms）
        this.fireState.currentRate = Math.max(50, originalRate * reduceRatio);
        GameState.fireRate = this.fireState.currentRate;
        // 更新射击间隔（如果正在射击）
        if (this.fireState.isFiring) {
            this.stopFiring();
            this.startFiring();
        }
        // 技能结束后恢复原射速
        setTimeout(() => {
            this.fireState.currentRate = originalRate;
            GameState.fireRate = originalRate;
            // 恢复射击间隔
            if (this.fireState.isFiring) {
                this.stopFiring();
                this.startFiring();
            }
        }, duration);
    }

    /**
     * 选择技能（等级提升时调用）
     * @param {string} skillId - 技能ID（penetrate/shield/speedBoost）
     */
    selectSkill(skillId) {
        this.skillState.activeSkill = skillId;
        GameState.activeSkill = skillId;
        // 同步UI技能按钮状态
        uiManager.updateSkillCooldown(this.skillState.cooldownTime);
    }

    /**
     * 更新技能冷却时间（每帧调用）
     */
    updateSkillCooldown() {
        if (this.skillState.cooldownTime > 0) {
            this.skillState.cooldownTime -= 16; // 约16ms/帧
            GameState.skillCooldownTime = Math.ceil(this.skillState.cooldownTime / 1000); // 转为秒显示
            uiManager.updateSkillCooldown(GameState.skillCooldownTime);
        } else {
            GameState.skillCooldownTime = 0;
            uiManager.updateSkillCooldown(0);
        }
    }

    // ------------------------------ 玩家受伤处理 ------------------------------
    /**
     * 玩家受到伤害（被敌人/BOSS子弹击中时调用）
     * @returns {boolean} 是否真正受伤（护盾抵消则返回false）
     */
    takeDamage() {
        // 护盾抵消伤害
        if (this.skillState.shieldActive) {
            this.skillState.shieldHits++;
            // 护盾吸收次数达到上限，关闭护盾
            if (this.skillState.shieldHits >= GameConfig.skill.list.find(s => s.id === 'shield').maxHits) {
                this.skillState.shieldActive = false;
            }
            return false;
        }

        // 无护盾，减少生命值
        GameState.lives--;
        // 记录最后受伤时间（用于成就检测）
        GameState.lastDamageTime = Date.now();
        // 播放受伤音效
        soundManager.playPlayerHit();
        // 触发被击中闪烁效果
        this.player.hitTimer = GameConfig.player.hitFlashFrames;
        // 更新UI
        uiManager.updateGameInfo();

        // 检查是否死亡
        if (GameState.lives <= 0) {
            return true; // 死亡
        }
        return false; // 受伤但未死亡
    }

    // ------------------------------ 绘制玩家 ------------------------------
    /**
     * 在画布上绘制玩家飞船（含尾焰、护盾效果）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    draw(ctx) {
        if (!GameState.running) return;

        // 被击中闪烁效果：每10帧显示5帧
        if (this.player.hitTimer % 10 >= 5) return;

        // 1. 绘制护盾（如果激活）
        if (this.skillState.shieldActive) {
            Utils.drawGradientCircle(
                ctx,
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                this.player.width / 2 + 10,
                'rgba(52, 152, 219, 0.8)',
                'rgba(52, 152, 219, 0)'
            );
        }

        // 2. 绘制玩家飞船主体（三角形）
        ctx.fillStyle = this.player.color;
        ctx.beginPath();
        ctx.moveTo(this.player.x + this.player.width / 2, this.player.y); // 顶部顶点
        ctx.lineTo(this.player.x, this.player.y + this.player.height);     // 左下顶点
        ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height); // 右下顶点
        ctx.closePath();
        ctx.fill();

        // 3. 绘制飞船尾焰（移动时显示，渐变效果）
        if (this.joystick.isActive) {
            const flameGradient = ctx.createLinearGradient(
                this.player.x + this.player.width / 2, this.player.y + this.player.height,
                this.player.x + this.player.width / 2, this.player.y + this.player.height + 15
            );
            flameGradient.addColorStop(0, '#e74c3c'); // 火焰顶部（红色）
            flameGradient.addColorStop(1, '#f39c12'); // 火焰底部（橙色）

            ctx.fillStyle = flameGradient;
            ctx.beginPath();
            ctx.moveTo(this.player.x + this.player.width / 2 - 8, this.player.y + this.player.height); // 尾焰左顶点
            ctx.moveTo(this.player.x + this.player.width / 2 + 8, this.player.y + this.player.height); // 尾焰右顶点
            ctx.lineTo(this.player.x + this.player.width / 2, this.player.y + this.player.height + 15); // 尾焰底部顶点
            ctx.closePath();
            ctx.fill();
        }

        // 4. 更新闪烁计时器
        if (this.player.hitTimer > 0) {
            this.player.hitTimer--;
        }
    }

    // ------------------------------ 对外暴露属性 ------------------------------
    /**
     * 获取玩家当前位置和尺寸（用于碰撞检测）
     * @returns {Object} 玩家碰撞盒信息
     */
    getCollisionBox() {
        return {
            x: this.player.x,
            y: this.player.y,
            width: this.player.width,
            height: this.player.height,
            active: GameState.running && GameState.lives > 0
        };
    }
}

// 实例化玩家管理器（全局唯一）
const player = new Player();

// 绑定等级提升事件（升级时提升射速）
document.addEventListener('levelUp', () => {
    player.upgradeFireRate();
});

// 绑定技能选择事件（从UI选择技能后调用）
document.addEventListener('skillSelected', (e) => {
    const skillId = e.detail.skillId;
    player.selectSkill(skillId);
});
