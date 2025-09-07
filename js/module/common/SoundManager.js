/**
 * 音频管理系统模块：负责游戏内所有音频资源的加载、播放、暂停、音量控制，
 * 支持背景音循环、音效分类管理、音频预加载，适配不同场景的音频需求，提升游戏沉浸感
 */
class SoundManager {
    constructor() {
        // 基础依赖引用
        this.eventBus = window.EventBus; // 事件总线（订阅场景切换、技能触发等事件，自动播放对应音频）
        this.gameMain = window.GameMain; // 游戏入口（获取资源加载器、全局配置）
        this.gameState = window.GameState; // 游戏状态（获取当前场景、静音状态）

        // 音频核心配置（按类型分类，支持多音频源）
        this.soundConfig = {
            // 音频类型枚举（避免硬编码）
            soundType: {
                BGM: 'bgm', // 背景音（循环播放）
                UI: 'ui', // 界面交互音效（如按钮点击）
                BATTLE: 'battle', // 战斗音效（如射击、爆炸）
                SKILL: 'skill', // 技能音效（如AOE释放、增益生效）
                ENEMY: 'enemy', // 敌人相关音效（如敌人死亡、召唤）
                PLAYER: 'player' // 玩家相关音效（如受击、拾取道具）
            },
            // 音频资源列表（key为音频ID，value含路径、类型、默认音量）
            soundList: {
                // 背景音（BGM）
                bgm_main: {
                    url: 'assets/sounds/bgm_main.mp3',
                    type: 'bgm',
                    defaultVolume: 0.6, // 背景音默认音量（0~1）
                    loop: true // 背景音默认循环
                },
                bgm_boss: {
                    url: 'assets/sounds/bgm_boss.mp3',
                    type: 'bgm',
                    defaultVolume: 0.7,
                    loop: true
                },
                // 界面音效（UI）
                ui_click: {
                    url: 'assets/sounds/ui_click.wav',
                    type: 'ui',
                    defaultVolume: 0.8,
                    loop: false
                },
                ui_open: {
                    url: 'assets/sounds/ui_open.wav',
                    type: 'ui',
                    defaultVolume: 0.7,
                    loop: false
                },
                ui_close: {
                    url: 'assets/sounds/ui_close.wav',
                    type: 'ui',
                    defaultVolume: 0.7,
                    loop: false
                },
                // 战斗音效（BATTLE）
                battle_shoot: {
                    url: 'assets/sounds/battle_shoot.wav',
                    type: 'battle',
                    defaultVolume: 0.5,
                    loop: false
                },
                battle_explode: {
                    url: 'assets/sounds/battle_explode.wav',
                    type: 'battle',
                    defaultVolume: 0.6,
                    loop: false
                },
                // 技能音效（SKILL）
                skill_aoe: {
                    url: 'assets/sounds/skill_aoe.mp3',
                    type: 'skill',
                    defaultVolume: 0.7,
                    loop: false
                },
                skill_buff: {
                    url: 'assets/sounds/skill_buff.wav',
                    type: 'skill',
                    defaultVolume: 0.6,
                    loop: false
                },
                skill_summon: {
                    url: 'assets/sounds/skill_summon.wav',
                    type: 'skill',
                    defaultVolume: 0.6,
                    loop: false
                },
                // 敌人音效（ENEMY）
                enemy_death: {
                    url: 'assets/sounds/enemy_death.wav',
                    type: 'enemy',
                    defaultVolume: 0.5,
                    loop: false
                },
                enemy_spawn: {
                    url: 'assets/sounds/enemy_spawn.wav',
                    type: 'enemy',
                    defaultVolume: 0.4,
                    loop: false
                },
                boss_roar: {
                    url: 'assets/sounds/boss_roar.mp3',
                    type: 'enemy',
                    defaultVolume: 0.8,
                    loop: false
                },
                // 玩家音效（PLAYER）
                player_hit: {
                    url: 'assets/sounds/player_hit.wav',
                    type: 'player',
                    defaultVolume: 0.6,
                    loop: false
                },
                player_pickup: {
                    url: 'assets/sounds/player_pickup.wav',
                    type: 'player',
                    defaultVolume: 0.7,
                    loop: false
                },
                player_levelup: {
                    url: 'assets/sounds/player_levelup.mp3',
                    type: 'player',
                    defaultVolume: 0.8,
                    loop: false
                }
            },
            // 全局音量配置（默认值，可通过UI调整）
            volumeConfig: {
                master: 1.0, // 主音量（0~1）
                bgm: 1.0,    // 背景音音量（基于主音量的倍率）
                effect: 1.0  // 音效音量（基于主音量的倍率）
            },
            // 音频加载配置
            loadConfig: {
                preloadAll: true, // 是否预加载所有音频（进入游戏前加载）
                loadTimeout: 10000 // 音频加载超时时间（10秒）
            }
        };

        // 音频状态管理
        this.soundState = {
            loadedSounds: new Map(), // 已加载的音频对象（key=音频ID，value=Audio实例）
            playingBGM: null, // 当前播放的背景音ID（仅一个BGM同时播放）
            muted: false, // 是否全局静音（true=静音）
            loadFailed: new Set() // 加载失败的音频ID集合
        };

        // 初始化：预加载音频、订阅事件、绑定全局静音状态
        this._preloadSounds();
        this._subscribeEvents();
        this._syncMuteState();
    }

    /**
     * 预加载音频资源（根据loadConfig配置，预加载所有或指定音频）
     */
    _preloadSounds() {
        const { preloadAll, loadTimeout } = this.soundConfig.loadConfig;
        const targetSoundIds = preloadAll 
            ? Object.keys(this.soundConfig.soundList) 
            : ['bgm_main', 'ui_click', 'battle_shoot', 'enemy_death']; // 核心音频优先加载

        console.log(`[SoundManager] 开始预加载音频（共${targetSoundIds.length}个）`);

        targetSoundIds.forEach(soundId => {
            const soundInfo = this.soundConfig.soundList[soundId];
            if (!soundInfo) return;

            // 创建Audio实例
            const audio = new Audio();
            audio.src = soundInfo.url;
            audio.volume = this._calcFinalVolume(soundId); // 计算最终音量（主音量×类型音量×默认音量）
            audio.loop = soundInfo.loop || false;

            // 加载成功回调
            audio.oncanplaythrough = () => {
                this.soundState.loadedSounds.set(soundId, audio);
                console.log(`[SoundManager] 音频加载成功：${soundId}（${soundInfo.url}）`);
            };

            // 加载失败回调
            audio.onerror = () => {
                this.soundState.loadFailed.add(soundId);
                console.error(`[SoundManager Error] 音频加载失败：${soundId}（${soundInfo.url}）`);
            };

            // 加载超时处理
            setTimeout(() => {
                if (!this.soundState.loadedSounds.has(soundId) && !this.soundState.loadFailed.has(soundId)) {
                    this.soundState.loadFailed.add(soundId);
                    console.error(`[SoundManager Error] 音频加载超时：${soundId}（超时${loadTimeout}ms）`);
                }
            }, loadTimeout);

            // 触发加载（预加载）
            audio.load();
        });
    }

    /**
     * 订阅游戏核心事件，自动播放对应音频（无需手动调用播放方法）
     */
    _subscribeEvents() {
        const { soundType } = this.soundConfig;

        // 1. 场景切换事件：播放对应场景BGM（如主菜单→主BGM，BOSS战→BOSS BGM）
        this.eventBus.on(window.GameEvents.SCENE_CHANGE, (sceneName) => {
            switch (sceneName) {
                case 'mainMenu':
                    this.playSound('bgm_main', { force: true }); // 强制切换BGM
                    break;
                case 'battleBoss':
                    this.playSound('bgm_boss', { force: true });
                    break;
                case 'gameOver':
                    this.stopCurrentBGM(); // 游戏结束时停止BGM
                    break;
            }
        });

        // 2. UI交互事件：按钮点击、界面开关
        this.eventBus.on(window.GameEvents.UI_CLICK, () => {
            this.playSound('ui_click');
        });
        this.eventBus.on(window.GameEvents.UI_OPEN, () => {
            this.playSound('ui_open');
        });
        this.eventBus.on(window.GameEvents.UI_CLOSE, () => {
            this.playSound('ui_close');
        });

        // 3. 战斗事件：射击、爆炸
        this.eventBus.on(window.GameEvents.PLAYER_SHOOT, () => {
            this.playSound('battle_shoot');
        });
        this.eventBus.on(window.GameEvents.ENEMY_EXPLODE, () => {
            this.playSound('battle_explode');
        });

        // 4. 技能事件：AOE释放、增益生效、召唤
        this.eventBus.on(window.GameEvents.BOSS_SKILL, (skillData) => {
            if (skillData.action === 'trigger') {
                switch (skillData.skillType) {
                    case 'attack':
                        this.playSound('skill_aoe');
                        break;
                    case 'buff':
                        this.playSound('skill_buff');
                        break;
                    case 'summon':
                        this.playSound('skill_summon');
                        break;
                }
            }
        });

        // 5. 敌人事件：死亡、生成、BOSS怒吼
        this.eventBus.on(window.GameEvents.ENEMY_DEATH, () => {
            this.playSound('enemy_death');
        });
        this.eventBus.on(window.GameEvents.ENEMY_SPAWN, () => {
            this.playSound('enemy_spawn');
        });
        this.eventBus.on(window.GameEvents.BOSS_SPAWN, () => {
            this.playSound('boss_roar');
        });

        // 6. 玩家事件：受击、拾取道具、升级
        this.eventBus.on(window.GameEvents.PLAYER_HIT, () => {
            this.playSound('player_hit');
        });
        this.eventBus.on(window.GameEvents.ITEM_PICKUP, () => {
            this.playSound('player_pickup');
        });
        this.eventBus.on(window.GameEvents.PLAYER_LEVELUP, () => {
            this.playSound('player_levelup');
        });

        // 7. 全局静音切换事件：同步静音状态
        this.eventBus.on(window.GameEvents.MUTE_TOGGLE, (isMuted) => {
            this.setMuted(isMuted);
        });

        // 8. 音量调整事件：更新主音量/BGM音量/音效音量
        this.eventBus.on(window.GameEvents.VOLUME_CHANGE, (volumeData) => {
            const { type, value } = volumeData;
            if (this.soundConfig.volumeConfig[type] !== undefined) {
                this.soundConfig.volumeConfig[type] = Math.max(0, Math.min(1, value)); // 限制音量在0~1
                this._updateAllVolumes(); // 更新所有已加载音频的音量
            }
        });
    }

    /**
     * 计算音频最终音量（主音量 × 类型音量 × 音频默认音量）
     * @param {string} soundId - 音频ID
     * @returns {number} 最终音量（0~1）
     */
    _calcFinalVolume(soundId) {
        if (this.soundState.muted) return 0; // 静音时音量为0

        const soundInfo = this.soundConfig.soundList[soundId];
        if (!soundInfo) return 0;

        const { master, bgm, effect } = this.soundConfig.volumeConfig;
        // BGM类型用bgm音量倍率，其他音效用effect倍率
        const typeVolume = soundInfo.type === 'bgm' ? bgm : effect;

        return master * typeVolume * soundInfo.defaultVolume;
    }

    /**
     * 更新所有已加载音频的音量（音量调整时调用）
     */
    _updateAllVolumes() {
        this.soundState.loadedSounds.forEach((audio, soundId) => {
            audio.volume = this._calcFinalVolume(soundId);
        });
    }

    /**
     * 同步全局静音状态（从游戏状态读取，初始化时调用）
     */
    _syncMuteState() {
        const { muted } = this.gameState.getFullState().settings;
        this.soundState.muted = muted;
        this._updateAllVolumes(); // 同步静音后的音量
    }

    /**
     * 停止当前播放的BGM（切换BGM或游戏结束时调用）
     */
    stopCurrentBGM() {
        if (this.soundState.playingBGM && this.soundState.loadedSounds.has(this.soundState.playingBGM)) {
            const currentBGM = this.soundState.loadedSounds.get(this.soundState.playingBGM);
            currentBGM.pause();
            currentBGM.currentTime = 0; // 重置播放位置到开头
            this.soundState.playingBGM = null;
        }
    }

    /**
     * 播放音频（核心方法，支持BGM单例播放、音效多实例播放）
     * @param {string} soundId - 音频ID
     * @param {Object} [options={}] - 播放选项
     * @param {boolean} [options.force=false] - 是否强制播放（BGM专用，true=停止当前BGM并播放新BGM）
     * @param {boolean} [options.loop=false] - 是否循环播放（覆盖音频默认loop配置）
     * @returns {boolean} 播放成功返回true，失败返回false
     */
    playSound(soundId, options = {}) {
        const { force = false, loop = undefined } = options;
        const soundInfo = this.soundConfig.soundList[soundId];

        // 校验：音频不存在或加载失败，返回失败
        if (!soundInfo || this.soundState.loadFailed.has(soundId)) {
            console.warn(`[SoundManager Warn] 无法播放音频：${soundId}（不存在或加载失败）`);
            return false;
        }

        // 处理BGM播放（单例模式，同一时间仅一个BGM播放）
        if (soundInfo.type === 'bgm') {
            // 已在播放且不强制切换，返回成功（避免重复播放）
            if (this.soundState.playingBGM === soundId && !force) return true;

            // 强制切换：先停止当前BGM
            this.stopCurrentBGM();

            // 获取BGM音频实例并播放
            const bgmAudio = this.soundState.loadedSounds.get(soundId) || new Audio(soundInfo.url);
            // 若未预加载，初始化音频配置
            if (!this.soundState.loadedSounds.has(soundId)) {
                bgmAudio.volume = this._calcFinalVolume(soundId);
                bgmAudio.loop = loop !== undefined ? loop : soundInfo.loop;
                this.soundState.loadedSounds.set(soundId, bgmAudio);
            } else {
                // 覆盖循环配置（若有）
                if (loop !== undefined) bgmAudio.loop = loop;
            }

            // 播放BGM
            bgmAudio.play().then(() => {
                this.soundState.playingBGM = soundId;
                console.log(`[SoundManager] BGM播放：${soundId}`);
            }).catch(err => {
                console.error(`[SoundManager Error] BGM播放失败：${soundId}，${err.message}`);
            });

            return true;
        }

        // 处理音效播放（多实例，支持同时播放多个相同音效，如连续射击）
        let soundAudio;
        // 若已加载，创建新实例（避免同一音效被打断）
        if (this.soundState.loadedSounds.has(soundId)) {
            const originalAudio = this.soundState.loadedSounds.get(soundId);
            soundAudio = new Audio(originalAudio.src);
            soundAudio.volume = this._calcFinalVolume(soundId);
            soundAudio.loop = loop !== undefined ? loop : soundInfo.loop;
        } else {
            // 未预加载，直接创建新实例并加载
            soundAudio = new Audio
