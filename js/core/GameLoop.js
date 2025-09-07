/**
 * 游戏主循环模块：负责控制游戏帧率、更新游戏状态、渲染游戏画面，是游戏运行的核心驱动
 * 核心功能：启动/暂停/停止循环、固定时间步更新（防止帧率波动导致逻辑异常）、画布渲染调度
 */
class GameLoop {
    constructor() {
        // 画布相关引用
        this.canvas = document.getElementById(window.GameGlobalConfig?.canvas?.id || 'gameCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // 循环状态标识
        this.isRunning = false; // 循环是否正在运行
        this.isPaused = false;  // 循环是否暂停
        this.animationId = null;// requestAnimationFrame的ID（用于停止循环）
        
        // 时间管理变量（固定时间步更新用）
        this.targetFps = window.GameGlobalConfig?.canvas?.frameRate || 60; // 目标帧率（默认60）
        this.fpsInterval = 1000 / this.targetFps; // 每帧目标间隔时间（毫秒）
        this.lastTime = 0; // 上一帧时间戳
        this.deltaTime = 0; // 两帧之间的时间差（毫秒）
        this.accumulator = 0; // 时间累加器（用于固定时间步）
        this.fixedTimeStep = 16.666; // 固定更新步长（≈60fps的每帧时间，确保逻辑稳定）
        
        // 调试相关变量
        this.debugMode = window.GameGlobalConfig?.debug?.enableDebugMode || false;
        this.fpsCount = 0; // 帧率计数器
        this.fpsTimer = 0; // 帧率统计计时器
        this.currentFps = 0; // 当前实时帧率
        
        // 渲染层级队列（对应GameGlobalConfig.canvas.renderPriority，确保渲染顺序正确）
        this.renderLayers = {
            background: [], // 背景层（最低层级）
            enemy: [],      // 敌人层
            bullet: [],     // 子弹层
            player: [],     // 玩家层
            particle: [],   // 粒子效果层
            ui: []          // UI层（最高层级）
        };

        // 初始化画布尺寸（适配窗口）
        this._initCanvasSize();
        // 订阅游戏状态事件（响应暂停/继续/重置）
        this._subscribeGameEvents();
    }

    /**
     * 初始化画布尺寸（适配窗口大小，处理高清屏像素比）
     */
    _initCanvasSize() {
        if (!this.canvas || !this.ctx) {
            console.error('[GameLoop Error] 画布元素获取失败，无法初始化');
            return;
        }

        // 获取全局配置的画布尺寸和像素比
        const { width, height, pixelRatio } = window.GameGlobalConfig.canvas;
        // 物理像素尺寸 = 逻辑尺寸 × 像素比（适配高清屏，避免模糊）
        this.canvas.width = width * pixelRatio;
        this.canvas.height = height * pixelRatio;
        // 样式尺寸 = 逻辑尺寸（确保画布显示大小正确）
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        // 缩放上下文，确保绘制坐标对应逻辑尺寸
        this.ctx.scale(pixelRatio, pixelRatio);

        // 监听窗口resize事件，动态调整画布尺寸
        window.addEventListener('resize', () => this._initCanvasSize());
    }

    /**
     * 订阅游戏状态事件（响应暂停、继续、重置、结束）
     */
    _subscribeGameEvents() {
        const eventBus = window.EventBus;
        const GameEvents = window.GameEvents;

        // 游戏暂停
        eventBus.on(GameEvents.GAME_PAUSE, () => {
            this.isPaused = true;
            console.log('[GameLoop] 游戏暂停，主循环停止更新');
        });

        // 游戏继续
        eventBus.on(GameEvents.GAME_RESUME, () => {
            this.isPaused = false;
            this.lastTime = performance.now(); // 重置时间戳，避免暂停期间累积deltaTime
            console.log('[GameLoop] 游戏继续，主循环恢复更新');
        });

        // 游戏重置（清空渲染队列，重启循环）
        eventBus.on(GameEvents.GAME_RESET, () => {
            this.stop();
            this._clearRenderLayers();
            this.start();
            console.log('[GameLoop] 游戏重置，主循环重启');
        });

        // 游戏结束（停止循环，清空渲染队列）
        eventBus.on(GameEvents.GAME_OVER, () => {
            this.stop();
            this._clearRenderLayers();
            console.log('[GameLoop] 游戏结束，主循环停止');
        });
    }

    /**
     * 清空所有渲染层级队列（游戏重置/结束时调用）
     */
    _clearRenderLayers() {
        Object.keys(this.renderLayers).forEach(layerKey => {
            this.renderLayers[layerKey] = [];
        });
    }

    /**
     * 注册渲染对象到指定层级（供其他模块调用，添加需要渲染的元素）
     * @param {string} layerKey - 渲染层级键（对应renderLayers的key，如"player"）
     * @param {Object} renderObj - 渲染对象（必须包含render(ctx, deltaTime)方法）
     */
    registerRenderObj(layerKey, renderObj) {
        if (!this.renderLayers.hasOwnProperty(layerKey)) {
            console.error(`[GameLoop Error] 无效的渲染层级：${layerKey}，可选层级：${Object.keys(this.renderLayers).join(', ')}`);
            return;
        }
        if (!renderObj || typeof renderObj.render !== 'function') {
            console.error('[GameLoop Error] 渲染对象必须包含render(ctx, deltaTime)方法');
            return;
        }
        // 避免重复注册同一对象
        const isDuplicate = this.renderLayers[layerKey].some(obj => obj === renderObj);
        if (!isDuplicate) {
            this.renderLayers[layerKey].push(renderObj);
        }
    }

    /**
     * 移除指定层级的渲染对象（供其他模块调用，如元素销毁时）
     * @param {string} layerKey - 渲染层级键
     * @param {Object} renderObj - 要移除的渲染对象
     */
    unregisterRenderObj(layerKey, renderObj) {
        if (!this.renderLayers.hasOwnProperty(layerKey)) {
            console.error(`[GameLoop Error] 无效的渲染层级：${layerKey}`);
            return;
        }
        this.renderLayers[layerKey] = this.renderLayers[layerKey].filter(obj => obj !== renderObj);
    }

    /**
     * 固定时间步更新游戏逻辑（确保不同帧率下逻辑速度一致）
     * @param {number} deltaTime - 上一帧到当前帧的时间差（毫秒）
     */
    _fixedUpdate(deltaTime) {
        this.accumulator += deltaTime;
        // 当累加时间 >= 固定步长时，执行逻辑更新（确保每步时间一致）
        while (this.accumulator >= this.fixedTimeStep) {
            // 遍历所有渲染对象，执行update方法（若有）
            Object.keys(this.renderLayers).forEach(layerKey => {
                this.renderLayers[layerKey].forEach(renderObj => {
                    if (typeof renderObj.update === 'function') {
                        try {
                            renderObj.update(this.fixedTimeStep / 1000); // 传递秒数（便于计算速度）
                        } catch (error) {
                            console.error(`[GameLoop Error] 渲染对象更新失败（层级：${layerKey}）：`, error);
                        }
                    }
                });
            });
            this.accumulator -= this.fixedTimeStep;
        }
    }

    /**
     * 渲染游戏画面（按层级顺序渲染，确保遮挡关系正确）
     */
    _render() {
        if (!this.canvas || !this.ctx) return;

        // 1. 清空画布（使用全局配置的背景色）
        const bgColor = window.GameGlobalConfig.canvas.bgColor;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width / window.GameGlobalConfig.canvas.pixelRatio, this.canvas.height / window.GameGlobalConfig.canvas.pixelRatio);

        // 2. 按层级顺序渲染（从最低层到最高层）
        const layerOrder = ['background', 'enemy', 'bullet', 'player', 'particle', 'ui'];
        layerOrder.forEach(layerKey => {
            this.renderLayers[layerKey].forEach(renderObj => {
                try {
                    renderObj.render(this.ctx, this.deltaTime / 1000); // 传递秒数（便于动画计算）
                } catch (error) {
                    console.error(`[GameLoop Error] 渲染对象绘制失败（层级：${layerKey}）：`, error);
                }
            });
        });

        // 3. 调试模式：绘制帧率信息
        if (this.debugMode && window.GameGlobalConfig.debug.showFps) {
            this._renderFpsInfo();
        }
    }

    /**
     * 调试模式：渲染帧率信息到画布
     */
    _renderFpsInfo() {
        if (!this.ctx) return;

        const fpsText = `FPS: ${Math.round(this.currentFps)}`;
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(fpsText, 10, 30); // 绘制在画布左上角（x=10, y=30）
    }

    /**
     * 计算实时帧率（每1秒更新一次）
     * @param {number} deltaTime - 上一帧到当前帧的时间差（毫秒）
     */
    _calculateFps(deltaTime) {
        this.fpsCount++;
        this.fpsTimer += deltaTime;

        if (this.fpsTimer >= 1000) {
            this.currentFps = this.fpsCount;
            this.fpsCount = 0;
            this.fpsTimer = 0;

            // 调试模式：输出帧率日志
            if (this.debugMode) {
                console.log(`[GameLoop Debug] 当前帧率：${this.currentFps} FPS（目标：${this.targetFps} FPS）`);
            }
        }
    }

    /**
     * 主循环核心函数（由requestAnimationFrame驱动）
     * @param {number} timestamp - 当前时间戳（由requestAnimationFrame自动传递）
     */
    _loop(timestamp) {
        // 若循环已停止，终止递归
        if (!this.isRunning) return;
        // 若暂停，只请求下一帧但不更新渲染
        if (this.isPaused) {
            this.animationId = requestAnimationFrame(t => this._loop(t));
            return;
        }

        // 1. 计算两帧之间的时间差（deltaTime）
        this.deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // 2. 计算实时帧率（调试用）
        this._calculateFps(this.deltaTime);

        // 3. 固定时间步更新游戏逻辑
        this._fixedUpdate(this.deltaTime);

        // 4. 渲染游戏画面
        this._render();

        // 5. 请求下一帧，继续循环
        this.animationId = requestAnimationFrame(t => this._loop(t));
    }

    /**
     * 启动游戏主循环
     */
    start() {
        if (this.isRunning) {
            console.warn('[GameLoop Warning] 主循环已在运行中，无需重复启动');
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now(); // 初始化时间戳
        this.animationId = requestAnimationFrame(t => this._loop(t));
        console.log(`[GameLoop] 主循环启动，目标帧率：${this.targetFps} FPS`);

        // 发布游戏开始事件（通知其他模块）
        window.EventBus.emit(window.GameEvents.GAME_START);
    }

    /**
     * 暂停游戏主循环（逻辑停止，画面冻结）
     */
    pause() {
        if (!this.isRunning || this.isPaused) {
            console.warn('[GameLoop Warning] 主循环未运行或已暂停，无需重复暂停');
            return;
        }

        this.isPaused = true;
        console.log('[GameLoop] 主循环暂停');
        window.EventBus.emit(window.GameEvents.GAME_PAUSE);
    }

    /**
     * 继续游戏主循环（从暂停状态恢复）
     */
    resume() {
        if (!this.isRunning || !this.isPaused) {
            console.warn('[GameLoop Warning] 主循环未运行或未暂停，无需恢复');
            return;
        }

        this.isPaused = false;
        this.lastTime = performance.now(); // 重置时间戳，避免时间差累积
        console.log('[GameLoop] 主循环恢复');
        window.EventBus.emit(window.GameEvents.GAME_RESUME);
    }

    /**
     * 停止游戏主循环（完全终止，需调用start重启）
     */
    stop() {
        if (!this.isRunning) {
            console.warn('[GameLoop Warning] 主循环已停止，无需重复停止');
            return;
        }

        this.isRunning = false;
        this.isPaused = false;
        cancelAnimationFrame(this.animationId); // 取消下一帧请求
        console.log('[GameLoop] 主循环停止');
    }

    /**
     * 获取当前主循环状态
     * @returns {Object} 状态对象（isRunning: 是否运行, isPaused: 是否暂停, currentFps: 当前帧率）
     */
    getState() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentFps: this.currentFps,
            targetFps: this.targetFps
        };
    }
}

// 实例化游戏主循环（单例模式，全局唯一）
const gameLoop = new GameLoop();

// 导出主循环实例（兼容Node.js和浏览器环境）
try {
    module.exports = gameLoop;
} catch (e) {
    // 浏览器环境挂载到window，供所有模块全局访问
    window.GameLoop = gameLoop;
}
