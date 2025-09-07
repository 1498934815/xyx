/**
 * 游戏入口主模块：负责初始化所有核心模块、加载资源、启动游戏流程，是游戏的“总开关”
 * 核心流程：初始化配置→加载资源→初始化核心模块→绑定输入事件→启动主循环
 */
class GameMain {
    constructor() {
        // 游戏启动状态标记
        this.isInit = false;          // 核心模块是否初始化完成
        this.isResourceLoaded = false;// 资源是否加载完成
        this.isGameReady = false;     // 游戏是否准备就绪（可启动）

        // 依赖模块引用（后续初始化后赋值）
        this.gameLoop = null;         // 主循环模块
        this.gameState = null;        // 状态管理模块
        this.eventBus = null;         // 事件总线模块
        this.objectPool = null;       // 对象池模块

        // 资源加载列表（图片、音频等）
        this.resourceList = {
            images: [
                { key: 'playerShip', path: 'assets/images/player-ship.png' },
                { key: 'enemySmall', path: 'assets/images/enemy-small.png' },
                { key: 'bulletPlayer', path: 'assets/images/bullet-player.png' },
                { key: 'bulletEnemy', path: 'assets/images/bullet-enemy.png' },
                { key: 'skillIconShield', path: 'assets/images/skill-shield.png' },
                { key: 'skillIconSpeed', path: 'assets/images/skill-speed.png' }
            ],
            audios: [
                { key: 'bgMusic', path: window.GameGlobalConfig?.sound?.soundPaths?.bgMusic },
                { key: 'shootSound', path: window.GameGlobalConfig?.sound?.soundPaths?.shoot },
                { key: 'hitSound', path: window.GameGlobalConfig?.sound?.soundPaths?.hit },
                { key: 'levelUpSound', path: window.GameGlobalConfig?.sound?.soundPaths?.levelUp }
            ]
        };

        // 已加载资源缓存
        this.loadedResources = { images: {}, audios: {} };
    }

    /**
     * 游戏启动入口：对外暴露的启动方法，触发完整初始化流程
     */
    startGame() {
        console.log('[GameMain] 开始启动游戏...');
        // 1. 先加载核心配置（确保全局配置已挂载）
        if (!window.GameGlobalConfig) {
            console.error('[GameMain Error] 全局配置 GameGlobalConfig 未加载，启动失败');
            return;
        }

        // 2. 加载游戏资源（图片、音频）
        this._loadResources()
            .then(() => {
                this.isResourceLoaded = true;
                console.log('[GameMain] 所有资源加载完成');
                // 3. 初始化核心模块（事件总线、状态、对象池、主循环）
                return this._initCoreModules();
            })
            .then(() => {
                this.isInit = true;
                console.log('[GameMain] 核心模块初始化完成');
                // 4. 初始化业务模块（玩家、敌人、UI、技能）
                return this._initBusinessModules();
            })
            .then(() => {
                this.isGameReady = true;
                console.log('[GameMain] 游戏准备就绪，等待开始指令');
                // 5. 绑定开始游戏的触发事件（如点击开始按钮）
                this._bindStartGameEvent();
            })
            .catch(error => {
                console.error('[GameMain Error] 游戏启动失败：', error);
            });
    }

    /**
     * 加载游戏资源（图片+音频），返回Promise
     */
    _loadResources() {
        return new Promise((resolve, reject) => {
            const totalResources = this.resourceList.images.length + this.resourceList.audios.length;
            let loadedCount = 0;

            // 资源加载完成的回调（计数+判断是否全部加载）
            const onResourceLoaded = () => {
                loadedCount++;
                console.log(`[GameMain] 资源加载进度：${loadedCount}/${totalResources}`);
                if (loadedCount === totalResources) {
                    resolve();
                }
            };

            // 1. 加载图片资源
            this.resourceList.images.forEach(imgInfo => {
                const img = new Image();
                img.src = imgInfo.path;
                img.onload = () => {
                    this.loadedResources.images[imgInfo.key] = img;
                    onResourceLoaded();
                };
                img.onerror = () => {
                    reject(new Error(`图片资源加载失败：${imgInfo.path}`));
                };
            });

            // 2. 加载音频资源
            this.resourceList.audios.forEach(audioInfo => {
                if (!audioInfo.path) {
                    onResourceLoaded(); // 路径为空时视为加载完成（跳过）
                    return;
                }
                const audio = new Audio(audioInfo.path);
                audio.load(); // 预加载音频
                audio.oncanplaythrough = () => {
                    this.loadedResources.audios[audioInfo.key] = audio;
                    onResourceLoaded();
                };
                audio.onerror = () => {
                    reject(new Error(`音频资源加载失败：${audioInfo.path}`));
                };
            });
        });
    }

    /**
     * 初始化核心模块（事件总线、状态管理、对象池、主循环）
     */
    _initCoreModules() {
        return new Promise((resolve) => {
            try {
                // 1. 初始化事件总线（全局已实例化，直接引用）
                this.eventBus = window.EventBus;
                if (!this.eventBus) {
                    throw new Error('事件总线 EventBus 未找到');
                }

                // 2. 初始化状态管理（全局已实例化，直接引用）
                this.gameState = window.GameState;
                if (!this.gameState) {
                    throw new Error('状态管理 GameState 未找到');
                }

                // 3. 初始化对象池（预注册常用对象类型）
                this.objectPool = window.ObjectPool;
                if (!this.objectPool) {
                    throw new Error('对象池 ObjectPool 未找到');
                }
                this.objectPool.initCommonTypes(); // 预注册子弹、粒子、敌人等类型

                // 4. 初始化主循环（全局已实例化，绑定渲染对象）
                this.gameLoop = window.GameLoop;
                if (!this.gameLoop) {
                    throw new Error('主循环 GameLoop 未找到');
                }

                // 5. 订阅核心事件（监听游戏状态变化）
                this._subscribeCoreEvents();

                resolve();
            } catch (error) {
                throw new Error(`核心模块初始化失败：${error.message}`);
            }
        });
    }

    /**
     * 初始化业务模块（玩家、敌人管理器、UI管理器、技能系统）
     */
    _initBusinessModules() {
        return new Promise((resolve) => {
            try {
                // 1. 初始化玩家模块（传入已加载的玩家图片资源）
                if (!window.Player) {
                    throw new Error('玩家模块 Player 未定义');
                }
                this.player = new window.Player({
                    image: this.loadedResources.images.playerShip,
                    x: this.gameLoop.canvas.width / (2 * window.GameGlobalConfig.canvas.pixelRatio) - window.PlayerConfig.baseAttr.initialWidth / 2,
                    y: this.gameLoop.canvas.height / window.GameGlobalConfig.canvas.pixelRatio - window.PlayerConfig.baseAttr.initialHeight - 20
                });
                this.gameLoop.registerRenderObj('player', this.player); // 注册到主循环渲染

                // 2. 初始化敌人管理器（传入敌人图片资源）
                if (!window.EnemyManager) {
                    throw new Error('敌人管理器 EnemyManager 未定义');
                }
                this.enemyManager = new window.EnemyManager({
                    enemyImages: {
                        smallFighter: this.loadedResources.images.enemySmall
                    }
                });
                this.gameLoop.registerRenderObj('enemy', this.enemyManager); // 注册到主循环渲染

                // 3. 初始化UI管理器（传入UI所需图片资源）
                if (!window.UIManager) {
                    throw new Error('UI管理器 UIManager 未定义');
                }
                this.uiManager = new window.UIManager({
                    skillIcons: {
                        shield: this.loadedResources.images.skillIconShield,
                        speed: this.loadedResources.images.skillIconSpeed
                    },
                    canvas: this.gameLoop.canvas
                });
                this.gameLoop.registerRenderObj('ui', this.uiManager); // 注册到主循环渲染

                // 4. 初始化技能系统（绑定玩家）
                if (!window.PlayerSkillSystem) {
                    throw new Error('玩家技能系统 PlayerSkillSystem 未定义');
                }
                this.playerSkillSystem = new window.PlayerSkillSystem(this.player);

                // 5. 初始化碰撞检测系统（绑定玩家、敌人、子弹）
                if (!window.CollisionSystem) {
                    throw new Error('碰撞检测系统 CollisionSystem 未定义');
                }
                this.collisionSystem = new window.CollisionSystem({
                    player: this.player,
                    enemyManager: this.enemyManager,
                    objectPool: this.objectPool
                });
                this.gameLoop.registerRenderObj('background', this.collisionSystem); // 碰撞检测无需渲染，挂到背景层仅触发update

                resolve();
            } catch (error) {
                throw new Error(`业务模块初始化失败：${error.message}`);
            }
        });
    }

    /**
     * 订阅核心事件（游戏状态变化、模块间通信）
     */
    _subscribeCoreEvents() {
        // 1. 游戏结束事件：停止主循环，显示结束界面
        this.eventBus.on(window.GameEvents.GAME_OVER, () => {
            this.uiManager.showGameOverUI(this.gameState.getFullState().player.score);
        });

        // 2. 玩家升级事件：显示升级提示，触发技能选择
        this.eventBus.on(window.GameEvents.PLAYER_LEVEL_UP, (newLevel) => {
            this.uiManager.showLevelUpTip(newLevel);
            // 解锁新技能槽时，触发技能选择弹窗
            const skillSlots = window.PlayerConfig.skillSystem.skillUnlockLevel;
            if (skillSlots.includes(newLevel)) {
                this.gameLoop.pause(); // 暂停主循环，等待技能选择
                this.uiManager.showSkillSelectPopup((selectedSkillId) => {
                    this.playerSkillSystem.learnSkill(selectedSkillId); // 玩家学习技能
                    this.gameLoop.resume(); // 恢复主循环
                });
            }
        });

        // 3. 音效设置变更事件：更新音频播放状态
        this.eventBus.on(window.GameEvents.UI_SETTING_CHANGE, (data) => {
            if (data.type === 'setting' && data.updated.soundEnable !== undefined) {
                const bgMusic = this.loadedResources.audios.bgMusic;
                if (bgMusic) {
                    data.updated.soundEnable ? bgMusic.play() : bgMusic.pause();
                }
            }
        });
    }

    /**
     * 绑定开始游戏的触发事件（如点击“开始游戏”按钮）
     */
    _bindStartGameEvent() {
        const startBtn = document.getElementById('startGameBtn');
        if (!startBtn) {
            console.warn('[GameMain Warn] 未找到开始游戏按钮，自动启动游戏');
            this._onStartGameClick();
            return;
        }

        startBtn.addEventListener('click', () => {
            this._onStartGameClick();
            startBtn.style.display = 'none'; // 隐藏开始按钮
        });
    }

    /**
     * 点击开始游戏后的逻辑（启动主循环、播放背景音乐）
     */
    _onStartGameClick() {
        if (!this.isGameReady) {
            console.warn('[GameMain Warn] 游戏未准备就绪，无法启动');
            return;
        }

        // 1. 启动主循环
        this.gameLoop.start();

        // 2. 播放背景音乐（根据设置状态）
        const soundSetting = this.gameState.getFullState().setting;
        if (soundSetting.soundEnable && this.loadedResources.audios.bgMusic) {
            const bgMusic = this.loadedResources.audios.bgMusic;
            bgMusic.loop = true; // 循环播放
            bgMusic.volume = soundSetting.musicVolume;
            bgMusic.play().catch(error => {
                console.warn('[GameMain Warn] 背景音乐播放失败（可能需要用户交互）：', error);
            });
        }

        // 3. 开始生成敌人
        this.enemyManager.startSpawn();

        // 4. 显示游戏UI（分数、生命、技能冷却）
        this.uiManager.showGameUI();
    }

    /**
     * 获取已加载的资源（对外提供资源访问接口）
     * @param {string} type - 资源类型（images/audios）
     * @param {string} key - 资源键（如"playerShip"）
     * @returns {Image|Audio|null} 已加载的资源
     */
    getLoadedResource(type, key) {
        return this.loadedResources[type]?.[key] || null;
    }

    /**
     * 游戏重置（重新开始游戏）
     */
    resetGame() {
        // 1. 重置状态管理
        this.gameState.resetGameState();

        // 2. 重置业务模块
        this.player.reset(); // 重置玩家状态
        this.enemyManager.clearAllEnemies(); // 清除所有敌人
        this.objectPool.clearAllPools(true); // 清理对象池（保留初始大小）
        this.uiManager.hideGameOverUI(); // 隐藏结束界面

        // 3. 重启主循环
        this.gameLoop.reset();
        this.gameLoop.start();

        // 4. 重新开始生成敌人
        this.enemyManager.startSpawn();
    }
}

// 页面加载完成后，初始化并启动游戏
document.addEventListener('DOMContentLoaded', () => {
    // 等待全局配置加载完成（确保GameGlobalConfig已挂载）
    const checkConfigLoaded = setInterval(() => {
        if (window.GameGlobalConfig) {
            clearInterval(checkConfigLoaded);
            const gameMain = new GameMain();
            window.GameMain = gameMain; // 挂载到window，供外部调用（如重置游戏）
            gameMain.startGame(); // 启动游戏
        }
    }, 100); // 每100ms检查一次
});
