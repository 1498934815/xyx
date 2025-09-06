// 音效管理类（统一控制游戏内所有音效）
class SoundManager {
    constructor() {
        this.audioContext = null; // Web Audio API 上下文
        this.soundEnabled = true; // 音效开关状态（默认开启）
        this.initStatus = false;  // 初始化状态
    }

    // 初始化音效上下文（需用户交互后调用，避免浏览器限制）
    init() {
        try {
            // 创建音频上下文（兼容不同浏览器）
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.initStatus = true;
            // 同步音效开关状态（从游戏设置读取）
            this.soundEnabled = GameState.settings.soundEnabled;
        } catch (e) {
            console.warn('浏览器不支持Web Audio API，音效功能已禁用:', e);
            this.initStatus = false;
        }
    }

    // 切换音效开关状态
    toggleSound(enabled) {
        this.soundEnabled = enabled;
        GameState.settings.soundEnabled = enabled;
    }

    // 基础音效生成函数（封装通用逻辑）
    #createSound(type, freqStart, freqEnd, duration, gain = 0.1) {
        if (!this.initStatus || !this.soundEnabled) return;
        
        // 创建振荡器和增益节点
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        // 设置音效类型和参数
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freqStart, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            freqEnd, 
            this.audioContext.currentTime + duration
        );
        
        // 设置音量衰减
        gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
            0.01, 
            this.audioContext.currentTime + duration
        );
        
        // 连接节点并播放
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // ------------------------------ 游戏内具体音效 ------------------------------
    // 射击音效
    playShoot() {
        this.#createSound('sine', 800, 400, 0.1, 0.1);
    }

    // 敌人死亡音效
    playEnemyDeath() {
        this.#createSound('triangle', 600, 200, 0.2, 0.1);
    }

    // BOSS死亡音效（多音叠加）
    playBossDeath() {
        if (!this.initStatus || !this.soundEnabled) return;
        
        // 播放5个连续音效模拟爆炸
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.#createSound(
                    'sawtooth', 
                    400 + Math.random() * 400, 
                    200 + Math.random() * 200, 
                    0.5, 
                    0.2
                );
            }, i * 100);
        }
    }

    // 等级提升音效
    playLevelUp() {
        this.#createSound('sine', 500, 1000, 0.5, 0.1);
    }

    // BOSS警告音效
    playBossWarning() {
        this.#createSound('square', 200, 100, 3, 0.1);
    }

    // 技能激活音效
    playSkillActivate() {
        this.#createSound('sine', 700, 1200, 0.3, 0.15);
    }

    // 玩家被击中音效
    playPlayerHit() {
        this.#createSound('sawtooth', 200, 50, 0.3, 0.2);
    }

    // 道具获取音效
    playItemPickup() {
        this.#createSound('sine', 600, 900, 0.2, 0.1);
    }
}

// 实例化音效管理器（全局唯一）
const soundManager = new SoundManager();

// 监听音效开关变化（从设置界面同步）
Utils.getElement('soundToggle').addEventListener('change', (e) => {
    soundManager.toggleSound(e.target.checked);
});
