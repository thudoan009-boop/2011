const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const envelope = $('#envelope'), stage = $('#stage');
const sceneCard = $('#scene-card'), sceneFw = $('#scene-fw');
const canvas = $('#fw'), ctx = canvas.getContext('2d');

/* ===== Hệ thống âm thanh (Audio Pool) ===== */
const sfxPool = Array.from({ length: 10 }, () => {
  const a = new Audio('/static/firework.mp3');
  a.volume = 0.65;
  return a;
});
let sfxIndex = 0;

function boom() {
  try {
    const s = sfxPool[sfxIndex];
    sfxIndex = (sfxIndex + 1) % sfxPool.length;
    s.currentTime = 0;
    s.volume = rand(0.5, 0.85);
    s.playbackRate = rand(0.88, 1.18);
    s.play().catch(() => {});
  } catch (e) {}
}

const bgm = new Audio('/static/nhac.mp3');
bgm.loop = true;
bgm.volume = 0.35;
bgm.preload = 'auto';

async function playBgm() {
  try {
    await bgm.play();
  } catch (error) {
    console.warn('Không thể phát nhạc nền:', error);
  }
}

let audioUnlockBound = false;
function unlockAudio() {
  if (!audioUnlockBound) {
    audioUnlockBound = true;
  }
  if (bgm.paused) {
    playBgm();
  }
}

bgm.addEventListener('error', () => {
  console.warn('Không tải được file nhạc nền: /static/nhac.mp3');
});

/* ===== Điều khiển cảnh & Mở thiệp ===== */
let opened = false;
if (envelope) {
  envelope.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    stage.classList.add('open');
    unlockAudio();
    sfxPool.forEach(s => {
      s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
    });
    setTimeout(() => stage.classList.add('show-hint'), 4200);
  });
}

const btnNext = $('#btn-next');
if (btnNext) {
  btnNext.addEventListener('click', () => {
    sceneCard.classList.add('leave');
    setTimeout(() => {
      sceneCard.classList.remove('active', 'leave');
      sceneCard.style.display = 'none';
      sceneFw.classList.add('active');
      resize();
      startShow();
    }, 1200);
  });
}

/* ===== Tiện ích tọa độ & màu sắc ===== */
const RAD = Math.PI / 180;
const rand = (a, b) => Math.random() * (b - a) + a;
const randomColor = () => `hsl(${rand(0, 360)}, 100%, 65%)`;

let SCALE = 1;
function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  SCALE = canvas.height / 600;
}
window.addEventListener('resize', resize);
resize();

function circle(x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/* ==========================================================================
   HỆ THỐNG PHÁO HOA: BẮN NHANH - NỔ TO - KHÔNG DÙNG QUE VÀNG
   ========================================================================== */
const LAUNCH_EVERY = 0.55;  // Bắn nhanh liên tục (0.55s mỗi phát)
const BARRAGE_EVERY = 4.5;  // Loạt bắn dồn dập mỗi 4.5s
const DRAG = 0.88;          // Lực cản êm, giúp chùm nổ bung to rộng khắp màn hình
const GRAVITY = -14;        // Trọng lực kéo các cánh hoa rơi tự nhiên

let rockets = [], particles = [], flash = 0, shake = 0;

/* Quả pháo vút lên cực nhanh (không dùng que vàng chậm chạp) */
class FastRocket {
  constructor(startX, targetX, targetY) {
    this.startX = startX;
    this.targetX = targetX;
    this.targetY = targetY;
    this.x = startX;
    this.y = 0;
    // Thời gian vút lên cực ngắn (0.35s - 0.5s) như tên lửa thật
    this.flightTime = rand(0.36, 0.52);
    this.elapsed = 0;
    this.dead = false;
    this.sparkColor = rand(0, 1) < 0.5 ? '#ffffff' : '#ffd060';
    this.trail = [[canvas.width / 2 + this.x * SCALE, canvas.height - this.y * SCALE]];
  }

  simulateTime(dt) {
    this.elapsed += dt;
    const progress = Math.min(1, this.elapsed / this.flightTime);
    // Gia tốc vút lên nhanh vọt, khựng nhẹ ở đỉnh nổ
    const ease = 1 - Math.pow(1 - progress, 2.5);
    
    this.x = this.startX + (this.targetX - this.startX) * progress;
    this.y = this.targetY * ease;

    const px = canvas.width / 2 + this.x * SCALE;
    const py = canvas.height - this.y * SCALE;
    this.trail.push([px, py]);
    if (this.trail.length > 6) this.trail.shift();

    // Vừa bay vừa thả vài tia lửa lấp lánh li ti ở đuôi
    if (Math.random() < 0.6) {
      particles.push(new Particle(
        this.x + rand(-2, 2),
        this.y - rand(1, 5),
        rand(-4, 4),
        rand(-8, -2),
        '#ffeaa7',
        rand(0.15, 0.35),
        1.4,
        true
      ));
    }

    if (progress >= 1) {
      this.explode();
    }
  }

  explode() {
    this.dead = true;
    const c1 = randomColor(), c2 = randomColor();
    const r = Math.random();

    // Chọn kiểu nổ: Chùm cầu cực đại, Trái tim to, Vành đai, hoặc Mưa liễu vàng
    const shape = r < 0.28 ? 'heart' : r < 0.5 ? 'ring' : r < 0.72 ? 'willow' : 'sphere';
    const N = shape === 'heart' ? 150 : shape === 'ring' ? 130 : shape === 'willow' ? 230 : 250;

    for (let i = 0; i < N; i++) {
      let dx, dy, color = c1;
      let life = rand(2.2, 3.6);
      let size = rand(2.4, 3.6);
      let sparkle = false;

      if (shape === 'heart') {
        const t = (i / N) * Math.PI * 2;
        // Trái tim nở to khổng lồ
        dx = 16 * Math.pow(Math.sin(t), 3) * 3.6;
        dy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 3.6;
        color = '#ff3366';
        size = 3.2;
      } else if (shape === 'ring') {
        const a = (i / N) * Math.PI * 2;
        const v = 62;
        dx = Math.cos(a) * v;
        dy = Math.sin(a) * v;
        if (i % 2 === 0) color = c2;
      } else if (shape === 'willow') {
        // Mưa liễu vàng lấp lánh rủ xuống cực đẹp
        const a = Math.random() * Math.PI * 2;
        const v = rand(15, 72);
        dx = Math.cos(a) * v;
        dy = Math.sin(a) * v * 0.9;
        color = '#ffd152';
        life = rand(2.8, 4.2);
        sparkle = true;
      } else {
        // Chùm cầu bung toả siêu to
        const a = Math.random() * Math.PI * 2;
        const v = rand(18, 85);
        dx = Math.cos(a) * v;
        dy = Math.sin(a) * v;
        if (Math.random() < 0.4) color = c2;
        if (Math.random() < 0.15) color = '#ffffff';
      }

      particles.push(new Particle(this.x, this.y, dx, dy, color, life, size, sparkle));
    }

    // 45 tia chớp trắng sáng chói ở tâm vụ nổ
    for (let i = 0; i < 45; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(4, 28);
      particles.push(new Particle(
        this.x, this.y,
        Math.cos(a) * v, Math.sin(a) * v,
        '#ffffff',
        rand(0.3, 0.9),
        2.2,
        true
      ));
    }

    flash = Math.min(0.28, flash + 0.16); // Chớp sáng màn hình
    shake = 9;                           // Rung màn hình uy lực
    boom();
  }

  draw() {
    // Vệt bay sắc nét thanh mảnh, màu trắng - cam rực lửa (không phải que vàng to thô)
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2 * SCALE;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0][0], this.trail[0][1]);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i][0], this.trail[i][1]);
      }
      ctx.stroke();
    }
    const [px, py] = this.pixel();
    circle(px, py, 3 * SCALE, '#ffffff');
  }

  pixel() {
    return [canvas.width / 2 + this.x * SCALE, canvas.height - this.y * SCALE];
  }
}

/* Hạt pháo hoa nổ to rực rỡ */
class Particle {
  constructor(x, y, dx, dy, color, life, size, sparkle = false) {
    Object.assign(this, {
      x, y, dx, dy, color, life, size, sparkle,
      age: 0,
      dead: false
    });
    this.trail = [[canvas.width / 2 + this.x * SCALE, canvas.height - this.y * SCALE]];
  }

  simulateTime(dt) {
    this.x += this.dx * dt;
    this.y += this.dy * dt;
    this.dy += GRAVITY * dt;
    const f = Math.exp(-DRAG * dt);
    this.dx *= f;
    this.dy *= f;
    this.age += dt;

    const px = canvas.width / 2 + this.x * SCALE;
    const py = canvas.height - this.y * SCALE;
    this.trail.push([px, py]);
    if (this.trail.length > 6) this.trail.shift();

    if (this.age >= this.life || this.y < -80) this.dead = true;
  }

  draw() {
    let a = Math.max(0, 1 - this.age / this.life);
    if (this.sparkle || this.age > this.life * 0.55) {
      a *= Math.random() < 0.5 ? 0.35 : 1; // Nhấp nháy lấp lánh
    }
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.size * SCALE;
    ctx.lineCap = 'round';

    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0][0], this.trail[0][1]);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i][0], this.trail[i][1]);
      }
      ctx.stroke();
    }

    const [px, py] = this.pixel();
    circle(px, py, this.size * 0.75 * SCALE, this.color);
    ctx.globalAlpha = 1;
  }

  pixel() {
    return [canvas.width / 2 + this.x * SCALE, canvas.height - this.y * SCALE];
  }
}

/* Hàm bắn pháo hoa nhanh đến toạ độ chỉ định */
function launch(targetWorldX, targetWorldY) {
  const half = (canvas.width / SCALE) * 0.44;
  const tX = targetWorldX !== undefined ? Math.max(-half, Math.min(half, targetWorldX)) : rand(-half * 0.85, half * 0.85);
  const tY = targetWorldY !== undefined ? Math.max(220, Math.min(520, targetWorldY)) : rand(320, 510);
  
  // Điểm phóng từ phía đáy lệch nhẹ tự nhiên
  const sX = tX + rand(-35, 35);
  rockets.push(new FastRocket(sX, tX, tY));
}

// Chạm / Click vào bất kỳ vị trí nào trên màn hình để bắn pháo hoa nổ to ngay vị trí đó!
if (sceneFw) {
  sceneFw.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const clickWorldX = (e.clientX - rect.left - canvas.width / 2) / SCALE;
    const clickWorldY = (canvas.height - (e.clientY - rect.top)) / SCALE;
    launch(clickWorldX, clickWorldY);
  });
}

/* ===== Hoa rơi lãng mạn ===== */
const FLOWERS = ['🌸', '🌼', '🌷', '🌺', '🌻', '✨'];
class Petal {
  constructor() { this.reset(true); }
  reset(initial) {
    this.x = rand(0, canvas.width);
    this.y = initial ? rand(-canvas.height, 0) : rand(-60, -10);
    this.size = rand(16, 28);
    this.vy = rand(0.6, 1.8);
    this.sway = rand(0, 6.28);
    this.swaySpeed = rand(0.01, 0.03);
    this.rot = rand(0, 6.28);
    this.vr = rand(-0.03, 0.03);
    this.char = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
  }
  update(k) {
    this.y += this.vy * k;
    this.sway += this.swaySpeed * k;
    this.x += Math.sin(this.sway) * 0.8 * k;
    this.rot += this.vr * k;
    if (this.y > canvas.height + 40) this.reset(false);
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.font = `${this.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.char, 0, 0);
    ctx.restore();
  }
}

/* ===== Vòng lặp chính pháo hoa ===== */
let petals = [], running = false, last = 0, launchTimer = 0, barrageTimer = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Bắn liên tục nhanh
  launchTimer -= dt;
  if (launchTimer <= 0) {
    launch();
    if (Math.random() < 0.65) launch();
    launchTimer = LAUNCH_EVERY;
  }

  // Loạt bắn dồn dập nhiều quả liên hoàn
  barrageTimer -= dt;
  if (barrageTimer <= 0) {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => launch(), i * 110);
    }
    barrageTimer = BARRAGE_EVERY;
  }

  // Cập nhật tên lửa vút lên
  const curRockets = rockets.slice();
  curRockets.forEach(r => {
    if (!r.dead) r.simulateTime(dt);
  });
  rockets = rockets.filter(r => !r.dead);

  // Cập nhật các hạt pháo hoa nổ to
  const curParticles = particles.slice();
  curParticles.forEach(p => {
    if (!p.dead) p.simulateTime(dt);
  });
  particles = particles.filter(p => !p.dead);

  petals.forEach(p => p.update(dt * 60));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 225, ${flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flash = Math.max(0, flash - dt * 0.85);
  }

  ctx.save();
  if (shake > 0.3) {
    ctx.translate(rand(-shake, shake), rand(-shake, shake));
    shake *= 0.88;
  }
  ctx.globalCompositeOperation = 'lighter';
  rockets.forEach(r => r.draw());
  particles.forEach(p => p.draw());
  ctx.restore();

  petals.forEach(p => p.draw());
  requestAnimationFrame(loop);
}

function startShow() {
  if (running) return;
  running = true;
  bgm.volume = 0.25;
  petals = Array.from({ length: 50 }, () => new Petal());
  launchTimer = 0.1;
  barrageTimer = 2.0;
  last = performance.now();
  requestAnimationFrame(loop);
}

/* ===== Nền sao băng cảnh thiệp ===== */
const sc = $('#stars'), sctx = sc ? sc.getContext('2d') : null;
function resizeStars() {
  if (!sc) return;
  sc.width = window.innerWidth;
  sc.height = window.innerHeight;
}
window.addEventListener('resize', resizeStars);
resizeStars();

class Meteor {
  constructor() {
    this.x = rand(sc.width * 0.25, sc.width * 1.15);
    this.y = rand(-60, sc.height * 0.4);
    this.len = rand(90, 180);
    const speed = rand(9, 15), ang = rand(25, 40) * RAD;
    this.vx = -speed * Math.cos(ang);
    this.vy = speed * Math.sin(ang);
  }
  update() { this.x += this.vx; this.y += this.vy; }
  get dead() { return this.x < -this.len || this.y > sc.height + this.len; }
  draw() {
    const k = this.len / Math.hypot(this.vx, this.vy);
    const tx = this.x - this.vx * k, ty = this.y - this.vy * k;
    const g = sctx.createLinearGradient(this.x, this.y, tx, ty);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.strokeStyle = g; sctx.lineWidth = 2; sctx.lineCap = 'round';
    sctx.beginPath(); sctx.moveTo(this.x, this.y); sctx.lineTo(tx, ty); sctx.stroke();
    sctx.beginPath(); sctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
    sctx.fillStyle = '#fff'; sctx.fill();
  }
}

let meteors = [];
function meteorLoop() {
  if (!sctx) return;
  if (Math.random() < 0.015) meteors.push(new Meteor());
  sctx.clearRect(0, 0, sc.width, sc.height);
  meteors.forEach(m => { m.update(); m.draw(); });
  meteors = meteors.filter(m => !m.dead);
  requestAnimationFrame(meteorLoop);
}
meteorLoop();
