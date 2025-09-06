/* ----------  工具  ---------- */
const rand = (min, max) => Math.random() * (max - min) + min;

/* ----------  画布  ---------- */
const dpr = window.devicePixelRatio || 1;
const c = document.getElementById('c');
const ctx = c.getContext('2d');
function resize() {
  c.width = window.innerWidth * dpr;
  c.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildOrbits();
}
resize();
window.addEventListener('resize', resize);

/* ----------  星轨  ---------- */
const orbits = []; // 提前声明，避免 TDZ
function buildOrbits() {
  orbits.length = 0;
  const W = c.clientWidth, H = c.clientHeight, step = W / 6;
  for (let i = 0; i < 5; i++) {
    const x0 = step * (i + 0.5), x1 = step * (i + 1.5);
    const y0 = H * rand(0.2, 0.4), y1 = H * rand(0.6, 0.8);
    orbits.push({
      p0: { x: x0, y: y0 }, p1: { x: x0, y: y1 },
      p2: { x: x1, y: y1 }, p3: { x: x1, y: y0 }
    });
  }
}

/* ----------  碎片纹理  ---------- */
const fragW = 64, fragH = 64;
const atlas = new Image();
// 占位 Base64（透明图），可替换成真实 13×4 拼合图
atlas.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARwAAATgCAQAAAD2ceiHAAAAeklEQVR4Ae3UsQ0AAAzCsP7/NP3A'; 

/* ----------  季节色  ---------- */
const seasonColor = ['#4fc3f7', '#f06292', '#ffb74d', '#81c784'];

/* ----------  碎片类  ---------- */
class Fragment {
  constructor() { this.reset(); }
  reset() {
    this.dead = false; this.x = this.y = this.vx = this.vy = this.rot = 0;
    this.id = 0; this.orbitIdx = 0; this.t = 0; this.speed = rand(0.008, 0.018);
    this.state = 'fly'; this.home = false; this.trail = [];
  }
  launch(mx, my) {
    const W = c.clientWidth, H = c.clientHeight;
    this.x = W / 2; this.y = H / 2;
    const ang = Math.atan2(my - this.y, mx - this.x);
    this.vx = Math.cos(ang) * 6; this.vy = Math.sin(ang) * 6;
  }
  update() {
    if (this.state === 'fly') {
      this.x += this.vx; this.y += this.vy;
      for (let i = 0; i < orbits.length; i++) {
        if (distToBezier(this.x, this.y, orbits[i]) < 30) {
          this.orbitIdx = i; this.state = 'orbit'; this.t = 0; break;
        }
      }
    } else if (this.state === 'orbit') {
      const pt = getBezierPoint(orbits[this.orbitIdx], this.t);
      this.x = pt.x; this.y = pt.y; this.t += this.speed;
      if (this.t >= 1) { this.t = 1; this.state = 'home'; }
    } else if (this.state === 'home') {
      const end = orbits[this.orbitIdx].p3, dx = end.x - this.x, dy = end.y - this.y;
      if (Math.hypot(dx, dy) < 2) { this.x = end.x; this.y = end.y; this.home = true; this.dead = true; }
      else { this.x += dx * 0.08; this.y += dy * 0.08; }
    }
  }
  draw() {
    const season = Math.floor(this.id / 13);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    // 彗尾
    ctx.globalAlpha = 0.4;
    for (let i = 5; i > 0; i--) {
      ctx.beginPath(); ctx.arc(-this.vx * i, -this.vy * i, i * 2, 0, 6.28);
      ctx.fillStyle = seasonColor[season]; ctx.fill();
    }
    // 本体
    ctx.globalAlpha = 1;
    const u = (this.id % 13) * fragW, v = Math.floor(this.id / 13) * fragH;
    ctx.drawImage(atlas, u, v, fragW, fragH, -fragW / 2, -fragH / 2, fragW, fragH);
    ctx.restore();
  }
}

/* ----------  数学  ---------- */
function getBezierPoint(o, t) {
  const c = 1 - t;
  return {
    x: c * c * c * o.p0.x + 3 * c * c * t * o.p1.x + 3 * c * t * t * o.p2.x + t * t * t * o.p3.x,
    y: c * c * c * o.p0.y + 3 * c * c * t * o.p1.y + 3 * c * t * t * o.p2.y + t * t * t * o.p3.y
  };
}
function distToBezier(px, py, o) {
  let min = Infinity;
  for (let i = 0; i <= 20; i++) {
    const pt = getBezierPoint(o, i / 20);
    const d = Math.hypot(pt.x - px, pt.y - py);
    if (d < min) min = d;
  }
  return min;
}

/* ----------  发射 & 交互  ---------- */
const particles = [];
function spawn(mx, my) {
  const f = new Fragment();
  f.launch(mx, my);
  f.id = deck[deckPtr];
  deckPtr = (deckPtr + 1) % 52;
  if (deckPtr === 0) shuffle();
  particles.push(f);
}
let deck = Array.from({ length: 52 }, (_, i) => i), deckPtr = 0;
function shuffle() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/* ----------  事件  ---------- */
c.addEventListener('mousedown', e => spawn(e.clientX, e.clientY));
c.addEventListener('touchstart', e => {
  const t = e.touches[0]; spawn(t.clientX, t.clientY); e.preventDefault();
});

/* ----------  主循环  ---------- */
function loop() {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  // 轨道
  orbits.forEach(o => {
    ctx.beginPath(); ctx.moveTo(o.p0.x, o.p0.y);
    ctx.bezierCurveTo(o.p1.x, o.p1.y, o.p2.x, o.p2.y, o.p3.x, o.p3.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke();
  });
  // 碎片
  let homeCount = 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(); p.draw();
    if (p.home) homeCount++;
    if (p.dead) particles.splice(i, 1);
  }
  if (homeCount === 52 && !finished) {
    finished = true;
    setTimeout(() => { particles.length = 0; shuffle(); finished = false; }, 500);
  }
  requestAnimationFrame(loop);
}
let finished = false;
loop();
</script>
