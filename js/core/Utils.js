// 工具函数集合（通用功能封装，供各模块调用）
const Utils = {
    // ------------------------------ 碰撞检测 ------------------------------
    /**
     * 矩形碰撞检测（AABB算法）
     * @param {Object} obj1 - 第一个碰撞物体（需含x, y, width, height属性）
     * @param {Object} obj2 - 第二个碰撞物体（需含x, y, width, height属性）
     * @returns {boolean} 是否发生碰撞
     */
    isColliding(obj1, obj2) {
        if (!obj1 || !obj2 || !obj1.active || !obj2.active) return false;
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    },

    // ------------------------------ DOM 操作工具 ------------------------------
    /**
     * 根据ID快速获取DOM元素
     * @param {string} id - DOM元素ID
     * @returns {HTMLElement|null} 获取到的DOM元素（不存在则返回null）
     */
    getElement(id) {
        return document.getElementById(id) || null;
    },

    /**
     * 设置DOM元素显示/隐藏状态
     * @param {string|HTMLElement} target - 元素ID或DOM元素本身
     * @param {boolean|string} state - true=显示，false=隐藏；或直接传入display属性值（如"flex"）
     */
    setVisible(target, state) {
        const elem = typeof target === 'string' ? this.getElement(target) : target;
        if (!elem) return;
        
        if (typeof state === 'boolean') {
            elem.style.display = state ? '' : 'none';
        } else {
            elem.style.display = state;
        }
    },

    /**
     * 更新DOM元素文本内容
     * @param {string|HTMLElement} target - 元素ID或DOM元素本身
     * @param {string|number} text - 要设置的文本内容
     */
    setText(target, text) {
        const elem = typeof target === 'string' ? this.getElement(target) : target;
        if (elem) elem.textContent = text;
    },

    /**
     * 为DOM元素添加/移除CSS类
     * @param {string|HTMLElement} target - 元素ID或DOM元素本身
     * @param {string} className - 要操作的CSS类名
     * @param {boolean} add - true=添加类，false=移除类
     */
    toggleClass(target, className, add) {
        const elem = typeof target === 'string' ? this.getElement(target) : target;
        if (!elem) return;
        
        if (add) {
            elem.classList.add(className);
        } else {
            elem.classList.remove(className);
        }
    },

    // ------------------------------ 动画与特效工具 ------------------------------
    /**
     * 创建粒子效果（敌人死亡、BOSS爆炸等）
     * @param {number} x - 粒子生成中心点X坐标
     * @param {number} y - 粒子生成中心点Y坐标
     * @param {number} count - 粒子数量
     * @param {string} color - 粒子颜色（默认白色）
     * @param {string} type - 粒子类型（"enemy"普通敌人/"boss"BOSS，影响大小）
     * @returns {Array} 生成的粒子数组
     */
    createParticles(x, y, count, color = '#fff', type = 'enemy') {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const particle = objectPool.getParticle(type);
            // 粒子在中心点周围随机分布
            particle.x = x + Math.random() * 20 - 10;
            particle.y = y + Math.random() * 20 - 10;
            particle.color = color;
            particle.speedY = Math.random() * 2 + 1; // 随机下落速度
            particle.opacity = 1;
            particle.active = true;
            particles.push(particle);
        }
        return particles;
    },

    /**
     * 创建伤害数字弹窗（敌人/BOSS被击中时显示）
     * @param {number} x - 弹窗X坐标
     * @param {number} y - 弹窗Y坐标
     * @param {number} damage - 伤害值
     */
    createDamagePopup(x, y, damage) {
        const popup = document.createElement('div');
        popup.className = 'damage-number';
        popup.textContent = `-${damage}`;
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        this.getElement('gameContainer').appendChild(popup);
        
        // 1秒后自动移除弹窗
        setTimeout(() => {
            popup?.remove();
        }, 1000);
    },

    /**
     * 创建临时提示弹窗（如生命恢复、道具获取）
     * @param {string} content - 提示内容
     * @param {string} type - 提示类型（"life"生命/"item"道具，影响颜色）
     * @param {number} duration - 显示时长（默认1500ms）
     */
    createTempPopup(content, type = 'item', duration = 1500) {
        const popupId = type === 'life' ? 'lifeRegenPopup' : 'itemPopup';
        const popup = this.getElement(popupId);
        if (!popup) return;
        
        this.setText(popup, content);
        this.setVisible(popup, true);
        
        // 时长后隐藏
        setTimeout(() => {
            this.setVisible(popup, false);
        }, duration);
    },

    // ------------------------------ 数学计算工具 ------------------------------
    /**
     * 生成指定范围的随机整数
     * @param {number} min - 最小值（包含）
     * @param {number} max - 最大值（包含）
     * @returns {number} 随机整数
     */
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 生成指定范围的随机浮点数
     * @param {number} min - 最小值（包含）
     * @param {number} max - 最大值（包含）
     * @returns {number} 随机浮点数
     */
    getRandomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * 限制数值在指定范围内（防溢出）
     * @param {number} value - 要限制的数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的值
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // ------------------------------ 事件绑定工具 ------------------------------
    /**
     * 绑定触摸/鼠标双事件（适配移动/PC端）
     * @param {HTMLElement} elem - 要绑定事件的元素
     * @param {string} eventType - 事件类型前缀（如"start"对应touchstart/mousedown）
     * @param {Function} callback - 事件回调函数
     */
    bindTouchMouseEvent(elem, eventType, callback) {
        if (!elem) return;
        
        // 触摸事件（移动端）
        const touchEvent = `touch${eventType}`;
        elem.addEventListener(touchEvent, (e) => {
            e.preventDefault(); // 阻止默认行为（如页面滚动）
            callback(e.touches[0] || e);
        });
        
        // 鼠标事件（PC端）
        const mouseEvent = eventType === 'start' ? 'mousedown' : 
                          eventType === 'move' ? 'mousemove' : 
                          eventType === 'end' ? 'mouseup' : '';
        if (mouseEvent) {
            elem.addEventListener(mouseEvent, callback);
        }
    },

    // ------------------------------ 画布工具 ------------------------------
    /**
     * 调整画布大小以适配窗口
     * @param {HTMLCanvasElement} canvas - 游戏画布元素
     */
    resizeCanvas(canvas) {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // 同步更新游戏配置中的画布尺寸
        GameConfig.canvas.defaultWidth = canvas.width;
        GameConfig.canvas.defaultHeight = canvas.height;
    },

    /**
     * 绘制渐变圆形（用于子弹光晕、护盾等效果）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - 圆心X坐标
     * @param {number} y - 圆心Y坐标
     * @param {number} radius - 圆半径
     * @param {string} startColor - 渐变起始色
     * @param {string} endColor - 渐变结束色
     */
    drawGradientCircle(ctx, x, y, radius, startColor, endColor) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
};
