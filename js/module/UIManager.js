// UI管理类（封装所有界面操作）
class UIManager {
    constructor() {
        // 缓存常用UI元素（避免重复获取DOM）
        this.uiElements = {
            // 游戏信息区
            score: Utils.getElement('score'),
            lives: Utils.getElement('lives'),
            level: Utils.getElement('level'),
            nextLevel: Utils.getElement('nextLevel'),
            fireRate: Utils.getElement('fireRate'),
            // BOSS相关
            bossTimer: Utils.getElement('bossTimer'),
            bossTime: Utils.getElement('bossTime'),
            bossHealthBar: Utils.getElement('bossHealthBar'),
            bossHealthFill: Utils.getElement('bossHealthFill'),
            bossName: Utils.getElement('bossName'),
            bossWarning: Utils.getElement('bossWarning'),
            // 状态提示
            lifeRegenTimer: Utils.getElement('lifeRegenTimer'),
            regenTime: Utils.getElement('regenTime'),
            skillCooldown: Utils.getElement('skillCooldown'),
            cooldownTime: Utils.getElement('cooldownTime'),
            // 弹窗
            levelUp: Utils.getElement('levelUp'),
            achievementPopup: Utils.getElement('achievementPopup'),
            achievementName: Utils.getElement('achievementName'),
            skillSelectPopup: Utils.getElement('skillSelectPopup'),
            // 页面
            startScreen: Utils.getElement('startScreen'),
            settingsScreen: Utils.getElement('settingsScreen'),
            gameOverScreen: Utils.getElement('gameOverScreen'),
            // 游戏结束数据
            finalScore: Utils.getElement('finalScore'),
            finalLevel: Utils.getElement('finalLevel'),
            bossKilled: Utils.getElement('bossKilled'),
            // 按钮
            startBtn: Utils.getElement('startButton'),
            restartBtn: Utils.getElement('restartButton'),
            settingsBtn: Utils.getElement('settingsButton'),
            backToStartBtn: Utils.getElement('backToStartButton'),
            skillBtn: Utils.getElement('skillButton'),
            // 技能选择选项
            skill1: Utils.getElement('skill1'),
            skill2: Utils.getElement('skill2'),
            skill3: Utils.getElement('skill3')
        };
    }

    // ------------------------------ 基础UI更新 ------------------------------
    // 更新游戏核心信息（分数、生命、等级等）
    updateGameInfo() {
        Utils.setText(this.uiElements.score, GameState.score);
        Utils.setText(this.uiElements.lives, GameState.lives);
        Utils.setText(this.uiElements.level, GameState.level);
        Utils.setText(this.uiElements.nextLevel, GameState.nextLevelScore);
        Utils.setText(this.uiElements.fireRate, GameState.fireRate);
    }

    // 更新BOSS倒计时
    updateBossTimer(time) {
        Utils.setText(this.uiElements.bossTime, time);
        Utils.setVisible(this.uiElements.bossTimer, !GameState.bossActive);
    }

    // 更新BOSS血条
    updateBossHealth(health, maxHealth) {
        const percent = (health / maxHealth) * 100;
        this.uiElements.bossHealthFill.style.width = `${percent}%`;
        // 低血量（≤30%）时添加闪烁效果
        Utils.toggleClass(this.uiElements.bossHealthFill, 'low', percent <= 30);
        // 显示/隐藏血条和名称
        Utils.setVisible(this.uiElements.bossHealthBar, GameState.bossActive);
        Utils.setVisible(this.uiElements.bossName, GameState.bossActive);
    }

    // 更新生命恢复计时器
    updateLifeRegenTimer(time) {
        Utils.setText(this.uiElements.regenTime, time);
        // 生命值满时隐藏计时器
        Utils.setVisible(this.uiElements.lifeRegenTimer, GameState.lives < GameConfig.lifeRegen.maxLives);
    }

    // 更新技能冷却显示
    updateSkillCooldown(time) {
        Utils.setText(this.uiElements.cooldownTime, time);
        Utils.setVisible(this.uiElements.skillCooldown, time > 0);
        // 更新技能按钮状态（冷却中变灰）
        this.uiElements.skillBtn.style.background = time > 0 || !GameState.activeSkill 
            ? 'rgba(155,89,182,0.2)' 
            : 'rgba(155,89,182,0.6)';
    }

    // ------------------------------ 弹窗控制 ------------------------------
    // 显示等级提升弹窗
    showLevelUp() {
        Utils.setVisible(this.uiElements.levelUp, true);
        soundManager.playLevelUp();
        setTimeout(() => {
            Utils.setVisible(this.uiElements.levelUp, false);
        }, 1500);
    }

    // 显示成就解锁弹窗
    showAchievement(name, desc) {
        Utils.setText(this.uiElements.achievementName, `${name}: ${desc}`);
        Utils.setVisible(this.uiElements.achievementPopup, true);
        setTimeout(() => {
            Utils.setVisible(this.uiElements.achievementPopup, false);
        }, 2000);
    }

    // 显示技能选择弹窗（暂停游戏）
    showSkillSelect(onSelect) {
        Utils.setVisible(this.uiElements.skillSelectPopup, 'flex');
        // 绑定技能选择事件
        const bindSkillSelect = (skillId) => {
            return () => {
                onSelect(skillId);
                Utils.setVisible(this.uiElements.skillSelectPopup, false);
                // 解绑事件避免重复触发
                this.uiElements.skill1.removeEventListener('click', selectSkill1);
                this.uiElements.skill2.removeEventListener('click', selectSkill2);
                this.uiElements.skill3.removeEventListener('click', selectSkill3);
            };
        };
        const selectSkill1 = bindSkillSelect('penetrate');
        const selectSkill2 = bindSkillSelect('shield');
        const selectSkill3 = bindSkillSelect('speedBoost');
        
        this.uiElements.skill1.addEventListener('click', selectSkill1);
        this.uiElements.skill2.addEventListener('click', selectSkill2);
        this.uiElements.skill3.addEventListener('click', selectSkill3);
        
        // 触摸事件适配
        this.uiElements.skill1.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectSkill1();
        });
        this.uiElements.skill2.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectSkill2();
        });
        this.uiElements.skill3.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectSkill3();
        });
    }

    // 显示BOSS警告弹窗
    showBossWarning() {
        Utils.setVisible(this.uiElements.bossWarning, true);
        soundManager.playBossWarning();
        setTimeout(() => {
            Utils.setVisible(this.uiElements.bossWarning, false);
        }, 3000);
    }

    // ------------------------------ 页面控制 ------------------------------
    // 显示开始页面
    showStartScreen() {
        Utils.setVisible(this.uiElements.startScreen, 'flex');
        Utils.setVisible(this.uiElements.settingsScreen, false);
        Utils.setVisible(this.uiElements.gameOverScreen, false);
    }

    // 显示设置页面
    showSettingsScreen() {
        Utils.setVisible(this.uiElements.startScreen, false);
        Utils.setVisible(this.uiElements.settingsScreen, 'flex');
        // 同步设置开关状态到界面
        Utils.getElement('autoFireToggle').checked = GameState.settings.autoFire;
        Utils.getElement('fixedJoystickToggle').checked = GameState.settings.fixedJoystick;
        Utils.getElement('soundToggle').checked = GameState.settings.soundEnabled;
    }

    // 显示游戏结束页面
    showGameOverScreen() {
        Utils.setText(this.uiElements.finalScore, GameState.score);
        Utils.setText(this.uiElements.finalLevel, GameState.level);
        Utils.setText(this.uiElements.bossKilled, GameState.bossKilledCount);
        Utils.setVisible(this.uiElements.gameOverScreen, 'flex');
    }

    // 隐藏所有页面（进入游戏时）
    hideAllScreens() {
        Utils.setVisible(this.uiElements.startScreen, false);
        Utils.setVisible(this.uiElements.settingsScreen, false);
        Utils.setVisible(this.uiElements.gameOverScreen, false);
    }

    // ------------------------------ 按钮事件绑定 ------------------------------
    // 绑定页面切换按钮事件
    bindScreenEvents(onStart, onRestart) {
        // 开始游戏
        this.uiElements.startBtn.addEventListener('click', onStart);
        // 重新开始
        this.uiElements.restartBtn.addEventListener('click', onRestart);
        // 打开设置
        this.uiElements.settingsBtn.addEventListener('click', () => {
            this.showSettingsScreen();
        });
        // 返回开始页面
        this.uiElements.backToStartBtn.addEventListener('click', () => {
            this.showStartScreen();
            // 保存设置到游戏状态
            GameState.settings.autoFire = Utils.getElement('autoFireToggle').checked;
            GameState.settings.fixedJoystick = Utils.getElement('fixedJoystickToggle').checked;
            GameState.settings.soundEnabled = Utils.getElement('soundToggle').checked;
        });
        // 自动射击开关
        Utils.getElement('autoFireToggle').addEventListener('change', (e) => {
            GameState.settings.autoFire = e.target.checked;
        });
        // 固定摇杆开关
        Utils.getElement('fixedJoystickToggle').addEventListener('change', (e) => {
            GameState.settings.fixedJoystick = e.target.checked;
        });
    }

    // 绑定技能按钮事件
    bindSkillButtonEvent(onActivate) {
        this.uiElements.skillBtn.addEventListener('click', onActivate);
        this.uiElements.skillBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            onActivate();
        });
    }
}

// 实例化UI管理器（全局唯一）
const uiManager = new UIManager();
