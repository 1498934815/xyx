/****************************
 *  Star Dust Loop  -  单文件零依赖
 ***************************/
const dpr = window.devicePixelRatio || 1;
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const hud = {
  score: document.getElementById('score'),
  life: document.getElementById('life'),
  combo: document.getElementById('combo')
};
function resize() {
  c.width = window.innerWidth * dpr;
  c.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* 色表 */
const colors = ['#4fc3f7', '#f06292', '#ffb74d', '#81c784'];
const suitSym = ['♠', '♥', '♦', '♣'];

/* 全局状态 */
let score = 0, life = 3, combo = 0, level = 1;
let ringAngle = 0;          // 环旋转角度
let bulletTime = 0;         // 子弹时间剩余秒
let particles = [];         // 粒子池
let dusts = [];             // 星尘
let mouseX = c.clientWidth / 2;
let lastShoot = 0;          // 节流

/* 输入 */
window.addEventListener('mousemove', e => mouseX = e.clientX);
window.addEventListener('touchmove', e => {
  mouseX = e.touches[0].clientX; e.preventDefault();
});
window.addEventListener('click', shoot);
window.addEventListener('touchstart', e => {
  e.preventDefault(); shoot();
});

/* 发射 */
function shoot() {
  if (Date.now() - lastShoot < 150) return;
  lastShoot = Date.now();
  // 生成"发射粒子"视觉效果
  particles.push(new Particle(mouseX, c.clientHeight - 30, 0, -6, colors[currSlot()], 12));
}

/* 当前 slot 序号 */
function currSlot() {
  const seg = 360 / 4;
  return Math.floor(((ringAngle % 360) + 360 + seg / 2) % 360 / seg);
}

/* 粒子类 */
class Particle {
  constructor(x, y, vx, vy, color, r = 4) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.r = r; this.life = 1;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt * 1.5;
  }
  draw() {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * this.life, 0, 6.28);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* 星尘类 */
class Dust {
  constructor() {
    this.x = rand(40, c.clientWidth - 40);
    this.y = -30;
    this.vy = rand(60, 80) * (1 + level * 0.15);
    this.vy *= bulletTime > 0 ? 0.3 : 1;
    this.r = 12;
    this.colorIdx = Math.floor(rand(0, 4));
    this.color = colors[this.colorIdx];
    this.rot = 0;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.rot += 180 * dt;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot * Math.PI / 180);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * 60 * Math.PI / 180;
      const rr = i % 2 === 0 ? this.r : this.r * 0.5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* 环外圈 */
function drawRing() {
  const cx = c.clientWidth / 2, cy = c.clientHeight - 60, R = 50;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ringAngle * Math.PI / 180);
  // 外圈
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, 6.28);
  ctx.stroke();
  // 四个扇形口
  for (let i = 0; i < 4; i++) {
    const a1 = i * 90 - 45, a2 = i * 90 + 45;
    const active = i === currSlot();
    ctx.fillStyle = active ? colors[i] : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, R - 2, a1 * Math.PI / 180, a2 * Math.PI / 180);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mid = (a1 + a2) / 2 * Math.PI / 180;
    ctx.fillText(suitSym[i], Math.cos(mid) * (R * 0.6), Math.sin(mid) * (R * 0.6));
  }
  ctx.restore();
}

/* 碰撞检测 */
function checkCollide(d) {
  const cx = c.clientWidth / 2, cy = c.clientHeight - 60, R = 50;
  const dx = d.x - cx, dy = d.y - cy;
  const dst = Math.hypot(dx, dy);
  if (dst > R - d.r) {
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const slot = Math.floor(((ang + 360 + 45) % 360) / 90);
    if (slot === d.colorIdx) { // 正确入口
      score++; combo++;
      particles.push(new Particle(d.x, d.y, 0, 0, d.color, 20));
      if (combo >= 10) {
        combo = 0; score += 10;
        bulletTime = 1;
        for (let i = 0; i < 30; i++) particles.push(new Particle(cx, cy, rand(-80, 80), rand(-80, 80), '#fff', rand(3, 8)));
      }
      return true;
    } else { // 错误
      life--;
      particles.push(new Particle(d.x, d.y, 0, 0, '#ff3b30', 25));
      return true;
    }
  }
  return false;
}

/* 更新 HUD */
function updateHUD() {
  hud.score.textContent = score;
  hud.life.textContent = '❤'.repeat(Math.max(0, life)) + '💔'.repeat(Math.max(0, 3 - life));
  hud.combo.textContent = `连消 ${combo}/10`;
}

/* 主循环 */
let last = 0, spawnAcc = 0, levelAcc = 0;
function frame(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000);
  last = ts;
  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  // 星空视差
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 60; i++) {
    const y = ((ts * 0.02 * (i % 4 + 1) + i * 37) % c.clientHeight);
    ctx.fillRect(i * 23 % c.clientWidth, y, 2, 2);
  }
  // 环旋转
  ringAngle += 120 * dt;
  drawRing();
  // 生成星尘
  const spawnInterval = 0.8 / (1 + level * 0.1);
  spawnAcc += dt;
  if (spawnAcc > spawnInterval) {
    spawnAcc = 0;
    dusts.push(new Dust());
  }
  // 更新星尘
  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    d.update(dt);
    if (checkCollide(d)) { dusts.splice(i, 1); continue; }
    if (d.y > c.clientHeight + d.r) { life--; dusts.splice(i, 1); }
    d.draw();
  }
  // 子弹时间递减
  if (bulletTime > 0) bulletTime -= dt;
  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    p.draw();
    if (p.life <= 0) particles.splice(i, 1);
  }
  // 难度提升
  levelAcc += dt;
  if (levelAcc > 20) { levelAcc = 0; level++; }
  updateHUD();
  // Game Over
  if (life <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '48px Orbitron';
    ctx.fillText('GAME OVER', c.clientWidth / 2, c.clientHeight / 2 - 30);
    ctx.font = '24px Orbitron';
    ctx.fillText(`最终得分 ${score}`, c.clientWidth / 2, c.clientHeight / 2 + 20);
    return; // 停止循环
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>
