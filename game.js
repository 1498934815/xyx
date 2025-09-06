class CardThrower {
    constructor() {
        this.initCanvas();
        this.initVariables();
        this.loadAssets();
        this.setupEventListeners();
        this.animate();
    }

    initCanvas() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initVariables() {
        this.cardWidth = 71;
        this.cardHeight = 96;
        this.scaledWidth = this.cardWidth * Math.round(this.dpr);
        this.scaledHeight = this.cardHeight * Math.round(this.dpr);
        this.halfWidth = this.scaledWidth / 2;
        this.halfHeight = this.scaledHeight / 2;
        this.particles = [];
        this.currentCardId = 52;
        this.gravity = 0.98;
        this.bounceFactor = 0.85;
    }

    loadAssets() {
        this.cardImage = new Image();
        this.cardImage.src = "data:image/png;base64,iVBORw0KGgo..."; // 缩短的base64字符串
    }

    setupEventListeners() {
        const handleInteraction = (e) => {
            const x = (e.clientX || e.touches[0].clientX) * this.dpr;
            const y = (e.clientY || e.touches[0].clientY) * this.dpr;
            this.throwCard(x, y);
        };

        this.canvas.addEventListener('pointerdown', handleInteraction);
        this.canvas.addEventListener('pointermove', (e) => {
            if (e.pressure > 0) handleInteraction(e);
        });
        this.canvas.addEventListener('touchstart', handleInteraction);
        this.canvas.addEventListener('touchmove', handleInteraction);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth * this.dpr;
        this.canvas.height = window.innerHeight * this.dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
    }

    throwCard(x, y) {
        this.currentCardId = (this.currentCardId > 0) ? this.currentCardId - 1 : 51;
        
        const velocityX = (Math.random() * 6 - 3) * 2;
        const velocityY = -Math.random() * 16;
        
        this.particles.push(new CardParticle(
            this.currentCardId, 
            x, y, 
            velocityX, velocityY,
            this.cardImage,
            this.cardWidth,
            this.cardHeight,
            this.scaledWidth,
            this.scaledHeight,
            this.halfWidth,
            this.halfHeight,
            this.gravity,
            this.bounceFactor,
            this.canvas.width,
            this.canvas.height
        ));
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = 0; i < this.particles.length; i++) {
            if (!this.particles[i].update()) {
                this.particles.splice(i, 1);
                i--;
            }
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

class CardParticle {
    constructor(id, x, y, vx, vy, image, width, height, scaledWidth, scaledHeight, halfWidth, halfHeight, gravity, bounceFactor, canvasWidth, canvasHeight) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = vx || 2;
        this.vy = vy;
        this.image = image;
        this.width = width;
        this.height = height;
        this.scaledWidth = scaledWidth;
        this.scaledHeight = scaledHeight;
        this.halfWidth = halfWidth;
        this.halfHeight = halfHeight;
        this.gravity = gravity;
        this.bounceFactor = bounceFactor;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;

        // 边界检查
        if (this.x < -this.halfWidth || this.x > this.canvasWidth + this.halfWidth) {
            return false;
        }

        // 底部反弹
        if (this.y > this.canvasHeight - this.halfHeight) {
            this.y = this.canvasHeight - this.halfHeight;
            this.vy = -this.vy * this.bounceFactor;
        }

        // 绘制卡片
        const srcX = (this.id % 4) * this.width;
        const srcY = Math.floor(this.id / 4) * this.height;
        
        this.ctx.drawImage(
            this.image,
            srcX, srcY, this.width, this.height,
            Math.floor(this.x - this.halfWidth), 
            Math.floor(this.y - this.halfHeight),
            this.scaledWidth, 
            this.scaledHeight
        );

        return true;
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    new CardThrower();
});
