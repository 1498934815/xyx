// 游戏全局通用配置（所有模块共享的基础参数，无业务逻辑，仅存静态数据）
const GameGlobalConfig = {
    // ================= 画布与渲染配置 =================
    canvas: {
        id: 'gameCanvas',       // 画布DOM元素ID（对应index.html中的canvas）
        width: window.innerWidth || 375,  // 初始宽度（默认取窗口宽度，适配移动端）
        height: window.innerHeight || 667, // 初始高度（默认取窗口高度）
        bgColor: '#0a0e17',     // 画布背景色（太空深色背景）
        frameRate: 60,          // 游戏目标帧率（60帧/秒，影响GameLoop刷新频率）
        pixelRatio: window.devicePixelRatio || 1, // 设备像素比（适配高清屏，避免模糊）
        renderPriority: {       // 渲染层级优先级（决定元素绘制顺序）
            background: 0,      // 背景层（最低）
            enemy: 1,           // 敌人层
            bullet: 2,          // 子弹层
            player: 3,          // 玩家层
            particle: 4,        // 粒子效果层
            ui: 5               // UI层（最高）
        }
    },

    // ================= 游戏规则配置 =================
    gameRule: {
        initialLives: 3,        // 玩家初始生命数量（3条命）
        maxLives: 5,            // 玩家最大生命上限（最多5条命，防止生命溢出）
        levelUpBaseScore: 100,  // 初始升级所需分数（1级→2级需100分）
        levelUpScoreMultiplier: 1.5, // 升级分数倍率（每升1级，所需分数×1.5，如2→3需150分）
        gameOverCondition: 'livesZero', // 游戏结束条件（livesZero=生命为0时结束）
        lifeRegenEnable: true,  // 是否开启生命自动恢复（true=开启）
        lifeRegenInterval: 20000, // 生命恢复间隔（20秒恢复1条命，需生命未满且不在战斗中）
        maxEnemyOnScreen: 15,   // 屏幕最大同时敌人数量（防止过多敌人导致卡顿）
        bulletPoolSize: 50,     // 子弹对象池初始容量（50个，复用子弹优化性能）
        particlePoolSize: 100   // 粒子对象池初始容量（100个，复用粒子优化性能）
    },

    // ================= 输入控制配置 =================
    input: {
        // 摇杆控制配置（对应joystick.css的操作摇杆）
        joystick: {
            id: 'joystick',      // 摇杆容器DOM ID
            handleId: 'joystickHandle', // 摇杆手柄DOM ID
            maxMoveRadius: 35,   // 摇杆最大移动半径（35像素，控制操作灵敏度）
            deadZone: 5,         // 摇杆死区（移动小于5像素不响应，防止误触）
            fixedModeDefault: false, // 摇杆默认是否固定显示（false=默认隐藏，触摸时显示）
            touchResponseTime: 10 // 触摸响应延迟（10毫秒，避免触摸抖动）
        },
        // 按钮控制配置（对应index.html的功能按钮）
        button: {
            shootBtnId: 'shootBtn', // 射击按钮DOM ID
            skillBtnId: 'skillBtn', // 技能按钮DOM ID
            autoFireDefault: false, // 自动射击默认状态（false=默认关闭，需手动开启）
            autoFireInterval: 300,  // 自动射击间隔（300毫秒/发，与PlayerConfig联动）
            skillBtnCooldownDefault: 5000 // 技能按钮默认冷却时间（5秒，与SkillConfig联动）
        },
        // 键盘控制配置（适配PC端）
        keyboard: {
            moveUpKey: 'ArrowUp',    // 上移按键
            moveDownKey: 'ArrowDown',// 下移按键
            moveLeftKey: 'ArrowLeft',// 左移按键
            moveRightKey: 'ArrowRight',// 右移按键
            shootKey: 'Space',       // 射击按键（空格键）
            skillKey: 'ShiftLeft',   // 技能按键（左Shift键）
            pauseKey: 'Escape',      // 暂停按键（ESC键）
            keyRepeatDelay: 100      // 键盘连按延迟（100毫秒，控制移动灵敏度）
        }
    },

    // ================= 音效与振动配置 =================
    sound: {
        enableDefault: true,    // 音效默认开启状态（true=开启）
        musicVolumeDefault: 0.8, // 背景音乐默认音量（0.8，范围0-1）
        soundVolumeDefault: 0.8, // 音效默认音量（0.8，范围0-1）
        vibrationEnableDefault: true, // 振动默认开启状态（true=开启，适配移动端）
        vibrationDuration: {     // 不同场景振动时长（毫秒）
            shoot: 50,           // 射击振动（50ms，轻微反馈）
            hit: 100,            // 受击振动（100ms，明显反馈）
            bossSpawn: 300,      // BOSS出现振动（300ms，强烈提醒）
            gameOver: 500        // 游戏结束振动（500ms，突出结果）
        },
        // 音效资源路径（实际项目需替换为真实音频文件路径）
        soundPaths: {
            bgMusic: 'audio/bg-music.mp3', // 背景音乐路径
            shoot: 'audio/shoot.wav',      // 射击音效路径
            hit: 'audio/hit.wav',          // 受击音效路径
            enemyDeath: 'audio/enemy-death.wav', // 敌人死亡音效路径
            bossDeath: 'audio/boss-death.wav',   // BOSS死亡音效路径
            levelUp: 'audio/level-up.wav', // 升级音效路径
            skillActivate: 'audio/skill-activate.wav', // 技能激活音效路径
            gameOver: 'audio/game-over.wav' // 游戏结束音效路径
        }
    },

    // ================= 调试与性能配置 =================
    debug: {
        enableDebugMode: false, // 是否开启调试模式（false=默认关闭，发布时需保持关闭）
        showFps: false,         // 是否显示帧率（false=默认隐藏，调试时可开启）
        showHitBox: false,      // 是否显示碰撞盒（false=默认隐藏，调试碰撞时开启）
        showObjectCount: false, // 是否显示对象池数量（false=默认隐藏，调试性能时开启）
        logLevel: 'warn',       // 日志输出等级（warn=仅输出警告/错误，debug=输出所有日志）
        maxLogCount: 100        // 最大日志缓存数量（防止日志过多占用内存）
    }
};

// 导出全局配置（兼容Node.js和浏览器环境，供所有模块调用）
try {
    // Node.js环境（如使用构建工具时）：通过module.exports导出
    module.exports = GameGlobalConfig;
} catch (e) {
    // 浏览器环境：挂载到window全局对象，确保所有脚本可访问
    window.GameGlobalConfig = GameGlobalConfig;
    // 监听窗口resize事件，实时更新画布尺寸（适配窗口缩放）
    window.addEventListener('resize', () => {
        GameGlobalConfig.canvas.width = window.innerWidth;
        GameGlobalConfig.canvas.height = window.innerHeight;
    });
}
