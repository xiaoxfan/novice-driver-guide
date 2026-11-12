/* =====================================================
 * util.js - 数学工具 / 纹理生成 / 世界构建器
 * ===================================================== */
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const ALL_CARS = [];   // 全部车辆注册表(用于 AI 跟车避撞, car.js 使用)
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function angNorm(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function dist2d(x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1; return Math.sqrt(dx * dx + dz * dz); }
/* heading 约定: forward = (sin h, 0, cos h), h=0 朝 +Z, h=90° 朝 +X */
function fwd(h) { return { x: Math.sin(h), z: Math.cos(h) }; }
function rightOf(h) { return { x: Math.cos(h), z: -Math.sin(h) }; }
function headingTo(x1, z1, x2, z2) { return Math.atan2(x2 - x1, z2 - z1); }

function pointSegDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const L2 = dx * dx + dz * dz;
  let t = L2 === 0 ? 0 : ((px - x1) * dx + (pz - z1) * dz) / L2;
  t = clamp(t, 0, 1);
  return dist2d(px, pz, x1 + t * dx, z1 + t * dz);
}
/* OBB(带角度矩形) 相交检测 - SAT */
function obbOverlap(ax, az, ah, ahl, ahw, bx, bz, bh, bhl, bhw) {
  const axes = [];
  const fa = fwd(ah), ra = rightOf(ah), fb = fwd(bh), rb = rightOf(bh);
  axes.push([fa.x, fa.z]); axes.push([ra.x, ra.z]);
  axes.push([fb.x, fb.z]); axes.push([rb.x, rb.z]);
  const ca = [ax + Math.cos(ah) * 0, az]; // 中心即 (ax,az)
  for (const ax2 of axes) {
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    // A 的四个角
    for (const s of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const cx = ax + fa.x * ahl * s[0] + ra.x * ahw * s[1];
      const cz = az + fa.z * ahl * s[0] + ra.z * ahw * s[1];
      const p = cx * ax2[0] + cz * ax2[1];
      aMin = Math.min(aMin, p); aMax = Math.max(aMax, p);
      const cx2 = bx + fb.x * bhl * s[0] + rb.x * bhw * s[1];
      const cz2 = bz + fb.z * bhl * s[0] + rb.z * bhw * s[1];
      const p2 = cx2 * ax2[0] + cz2 * ax2[1];
      bMin = Math.min(bMin, p2); bMax = Math.max(bMax, p2);
    }
    if (aMax < bMin || bMax < aMin) return false;
  }
  return true;
}

/* ---------------- 纹理 ---------------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(w, h, draw, repeat) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let _asphaltTex = null;
function asphaltTex() {
  if (_asphaltTex) return _asphaltTex;
  _asphaltTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3f45'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 45 + Math.random() * 38;
      g.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.35 + Math.random() * 0.4})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2.2, 2.2);
    }
    for (let i = 0; i < 40; i++) { // 修补痕
      g.fillStyle = `rgba(30,32,36,${0.12 + Math.random() * 0.15})`;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 16, 0, TAU); g.fill();
    }
  }, [4, 4]);
  return _asphaltTex;
}
let _grassTex = null;
function grassTex() {
  if (_grassTex) return _grassTex;
  _grassTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4d6b38'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const gr = 90 + Math.random() * 50;
      g.fillStyle = `rgba(${gr * 0.55 | 0},${gr | 0},${gr * 0.5 | 0},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, [30, 30]);
  return _grassTex;
}
function buildingTex(base) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 8, 8); }
    const cols = 6, rows = 14;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? `rgba(255,225,150,${0.55 + Math.random() * 0.3})` : `rgba(28,40,58,${0.75 + Math.random() * 0.2})`;
      g.fillRect(14 + c * (w - 28) / cols, 16 + r * (h - 32) / rows, (w - 28) / cols - 10, (h - 32) / rows - 12);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 26, w, 26);
  }, [2, 1]);
}
/* 路面箭头贴图 (透明底白箭头), kind: straight/left/right/leftStraight/uturn/down */
function arrowTex(kind, color) {
  color = color || '#e8e8e8';
  return canvasTex(128, 256, (g, w, h) => {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 20; g.lineCap = 'round'; g.lineJoin = 'round';
    const cx = w / 2;
    function shaft(x) { g.beginPath(); g.moveTo(x, h - 20); g.lineTo(x, h * 0.38); g.stroke(); }
    function head(x, dir) { // dir: 0 上直, -1 左, 1 右
      g.beginPath(); g.moveTo(x, 26);
      if (dir === 0) { g.lineTo(x - 26, 72); g.lineTo(x + 26, 72); }
      else { g.lineTo(x + dir * 44, 96); g.lineTo(x + dir * 44, 60); g.lineTo(x + 18, 60); }
      g.closePath(); g.fill();
    }
    if (kind === 'straight') { shaft(cx); head(cx, 0); }
    else if (kind === 'left') {
      g.beginPath(); g.moveTo(cx + 30, h - 20); g.lineTo(cx + 30, h * 0.55); g.lineTo(cx - 10, h * 0.38); g.stroke();
      head(cx + 30, -1);
    } else if (kind === 'right') {
      g.beginPath(); g.moveTo(cx - 30, h - 20); g.lineTo(cx - 30, h * 0.55); g.lineTo(cx + 10, h * 0.38); g.stroke();
      head(cx - 30, 1);
    } else if (kind === 'leftStraight') {
      shaft(cx); head(cx, 0);
      g.beginPath(); g.moveTo(cx - 26, h - 20); g.lineTo(cx - 26, h * 0.6); g.lineTo(cx + 12, h * 0.46); g.stroke();
      head(cx - 26, -1);
    } else if (kind === 'down') { // 潮汐/汇入用向下绿箭头
      g.strokeStyle = color; g.fillStyle = color;
      g.beginPath(); g.moveTo(cx, h - 18); g.lineTo(cx, 60); g.stroke();
      g.beginPath(); g.moveTo(cx, 22); g.lineTo(cx - 28, 78); g.lineTo(cx + 28, 78); g.closePath(); g.fill();
    }
  });
}
/* 车道信号牌: 绿↓ / 红× */
function laneSignalTex(state) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#101418'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2f36'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    if (state === 'green') {
      g.fillStyle = '#2ee65a'; g.beginPath();
      g.moveTo(64, 108); g.lineTo(30, 58); g.lineTo(52, 58); g.lineTo(52, 22); g.lineTo(76, 22); g.lineTo(76, 58); g.lineTo(98, 58);
      g.closePath(); g.fill();
    } else {
      g.strokeStyle = '#ff4438'; g.lineWidth = 14; g.lineCap = 'round';
      g.beginPath(); g.moveTo(36, 36); g.lineTo(92, 92); g.moveTo(92, 36); g.lineTo(36, 92); g.stroke();
    }
  });
}
/* 中文文字标志牌 */
function signTex(lines, opts) {
  opts = opts || {};
  const w = opts.w || 256, h = opts.h || 256;
  return canvasTex(w, h, (g) => {
    if (opts.blue) {
      g.fillStyle = '#0a5a9e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8ecf2'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    } else if (opts.led) {
      g.fillStyle = '#0a0d10'; g.fillRect(0, 0, w, h);
    } else {
      g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#0a5a9e'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      let fs = ln.fs || opts.fs || Math.min(w / (ln.t.length * 1.15), (h - 30) / n);
      g.font = `bold ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      g.fillStyle = ln.c || (opts.blue || opts.led ? '#ffffff' : '#123');
      if (opts.led) g.fillStyle = ln.c || '#ffd24a';
      g.fillText(ln.t, w / 2, (h / n) * (i + 0.5));
    });
  });
}

/* ---------------- 世界构建器 ---------------- */
class WorldBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.obstacles = [];       // {type:'obb',x,z,h,hl,hw} | {type:'circle',x,z,r}
    this.forbiddenLines = [];  // 压线判定 {x1,z1,x2,z2}
    this.drivables = [];       // {x,z,hl,hw,rot}
    this.disposables = [];
  }
  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }
    });
    this.scene.remove(this.group);
  }
  mat(opts) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.92, metalness: 0.02 }, opts)); }
  add(mesh) { this.group.add(mesh); return mesh; }
  /* 大地 */
  ground(size) {
    const t = grassTex();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.02; m.receiveShadow = true;
    return this.add(m);
  }
  /* 沥青路面矩形 (中心x,z 宽w 长l rot绕Y) */
  asphalt(x, z, w, l, rot) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.96 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -(rot || 0);
    m.position.set(x, 0, z); m.receiveShadow = true;
    return this.add(m);
  }
  /* 环形路面 (圆心 半径 内外) */
  ringRoad(x, z, rIn, rOut) {
    const g = new THREE.RingGeometry(rIn, rOut, 64, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8);
    const m = new THREE.Mesh(g, this.mat({ map: asphaltTex(), roughness: 0.96 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true;
    return this.add(m);
  }
  /* 地面标线矩形 */
  markRect(x, z, w, l, rot, color, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshLambertMaterial({ color: color || 0xffffff, transparent: !!(opacity && opacity < 1), opacity: opacity || 1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -(rot || 0);
    m.position.set(x, 0.015, z);
    m.renderOrder = 1;
    return this.add(m);
  }
  /* 实线 */
  line(x1, z1, x2, z2, width, color) {
    const len = dist2d(x1, z1, x2, z2);
    const rot = Math.atan2(x2 - x1, z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    return this.markRect(cx, cz, width || 0.15, len, rot, color || 0xffffff);
  }
  /* 虚线 */
  dashed(x1, z1, x2, z2, width, color, dash, gap) {
    dash = dash || 2; gap = gap == null ? 4 : gap;
    const len = dist2d(x1, z1, x2, z2), rot = Math.atan2(x2 - x1, z2 - z1);
    const f = fwd(rot), n = Math.floor(len / (dash + gap));
    const g = new THREE.Group();
    for (let i = 0; i <= n; i++) {
      const d = i * (dash + gap) + dash / 2;
      const m = this.markRect(x1 + f.x * d, z1 + f.z * d, width || 0.15, dash, rot, color || 0xffffff);
      g.add(m);
    }
    this.add(g); return g;
  }
  /* 双黄线(实) */
  doubleYellow(x1, z1, x2, z2, sep) {
    sep = sep || 0.25;
    const rot = Math.atan2(x2 - x1, z2 - z1), r = rightOf(rot);
    const off = (dx, dz) => [x1 + dx, z1 + dz, x2 + dx, z2 + dz];
    const a = off(r.x * sep, r.z * sep), b = off(-r.x * sep, -r.z * sep);
    this.line(a[0], a[1], a[2], a[3], 0.15, 0xf5c518);
    this.line(b[0], b[1], b[2], b[3], 0.15, 0xf5c518);
  }
  /* 双黄虚线(潮汐车道边界) */
  doubleYellowDash(x1, z1, x2, z2) {
    const rot = Math.atan2(x2 - x1, z2 - z1), r = rightOf(rot);
    this.dashed(x1 + r.x * 0.25, z1 + r.z * 0.25, x2 + r.x * 0.25, z2 + r.z * 0.25, 0.15, 0xf5c518, 3, 3);
    this.dashed(x1 - r.x * 0.25, z1 - r.z * 0.25, x2 - r.x * 0.25, z2 - r.z * 0.25, 0.15, 0xf5c518, 3, 3);
  }
  /* 锯齿状可变车道线 */
  fishbone(x1, z1, x2, z2, side) {
    const len = dist2d(x1, z1, x2, z2), rot = Math.atan2(x2 - x1, z2 - z1);
    const f = fwd(rot), r = rightOf(rot);
    const g = new THREE.Group();
    for (let d = 0; d < len; d += 1.6) {
      const bx = x1 + f.x * d, bz = z1 + f.z * d;
      // 斜短线从主线位置向 side 偏
      const m = this.markRect(bx + r.x * side * 0.35, bz + r.z * side * 0.35, 0.14, 1.1, rot + side * 0.5, 0xffffff);
      g.add(m);
    }
    this.add(g); return g;
  }
  /* 地面箭头 */
  arrow(x, z, rotDeg, kind, w) {
    const t = arrowTex(kind);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 1.1, (w || 1.1) * 2),
      new THREE.MeshLambertMaterial({ map: t, transparent: true }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotDeg * D2R + Math.PI;
    m.position.set(x, 0.016, z); m.renderOrder = 2;
    return this.add(m);
  }
  /* 人行横道 */
  zebra(x, z, w, l, rot) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshLambertMaterial({
      map: canvasTex(64, 256, (g, cw, ch) => {
        g.clearRect(0, 0, cw, ch);
        g.fillStyle = '#e8e8e8';
        for (let i = 0; i < 8; i++) g.fillRect(0, i * 32 + 4, cw, 18);
      }), transparent: true }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -(rot || 0);
    m.position.set(x, 0.017, z); m.renderOrder = 2;
    return this.add(m);
  }
  /* 减速让行标线 */
  yieldMark(x, z, rot, w) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 3, 1.6), new THREE.MeshLambertMaterial({
      map: canvasTex(256, 128, (g, cw, ch) => {
        g.clearRect(0, 0, cw, ch); g.fillStyle = '#e8e8e8';
        for (let i = 0; i < 6; i++) { const t = i / 6; g.fillRect(t * cw, ch - t * ch * 0.7 - 14, cw / 8, 14 + t * ch * 0.5); }
      }), transparent: true }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -(rot || 0);
    m.position.set(x, 0.016, z); m.renderOrder = 2;
    return this.add(m);
  }
  /* 锥桶 */
  cone(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), this.mat({ color: 0xd9500a }));
    base.position.y = 0.03;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.75, 12), this.mat({ color: 0xe86415 }));
    body.position.y = 0.4;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.13, 12), this.mat({ color: 0xf5f5f5 }));
    band.position.y = 0.45;
    [base, body, band].forEach(o => { o.castShadow = true; g.add(o); });
    g.position.set(x, 0, z);
    this.obstacles.push({ type: 'circle', x, z, r: 0.22 });
    return this.add(g);
  }
  /* 建筑物 */
  building(x, z, w, d, h, rot, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      this.mat({ map: buildingTex(color || '#8a94a3'), roughness: 0.85 }));
    m.position.set(x, h / 2, z); m.rotation.y = -(rot || 0);
    m.castShadow = true; m.receiveShadow = true;
    this.obstacles.push({ type: 'obb', x, z, h: rot || 0, hl: d / 2 + 0.3, hw: w / 2 + 0.3 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.4, d * 0.98), this.mat({ color: 0x565e6a }));
    roof.position.set(x, h + 0.2, z); roof.rotation.y = -(rot || 0);
    this.add(roof);
    return this.add(m);
  }
  /* 树 */
  tree(x, z, s) {
    s = s || 1;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.4 * s, 8), this.mat({ color: 0x6b4a2c }));
    trunk.position.y = 0.7 * s; trunk.castShadow = true;
    g.add(trunk);
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.05 * s, 10, 8), this.mat({ color: 0x3f6d2e, roughness: 1 }));
    c1.position.y = 1.9 * s; c1.castShadow = true; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.75 * s, 10, 8), this.mat({ color: 0x4b7d36, roughness: 1 }));
    c2.position.set(0.5 * s, 1.4 * s, 0.2 * s); c2.castShadow = true; g.add(c2);
    g.position.set(x, 0, z);
    this.obstacles.push({ type: 'circle', x, z, r: 0.35 * s });
    return this.add(g);
  }
  /* 路灯 */
  lamp(x, z, rot) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8), this.mat({ color: 0x6a7280, metalness: 0.5, roughness: 0.5 }));
    pole.position.y = 3.25; pole.castShadow = true; g.add(pole);
    const armLen = 2.2, f = fwd(rot || 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, armLen), this.mat({ color: 0x6a7280 }));
    arm.position.set(f.x * armLen / 2, 6.4, f.z * armLen / 2);
    arm.rotation.y = Math.atan2(f.x, f.z) + Math.PI / 2; g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), this.mat({ color: 0xd8dde4, emissive: 0xfff2cc, emissiveIntensity: 0.35 }));
    head.position.set(f.x * armLen, 6.32, f.z * armLen);
    head.rotation.y = arm.rotation.y; g.add(head);
    g.position.set(x, 0, z);
    this.obstacles.push({ type: 'circle', x, z, r: 0.2 });
    return this.add(g);
  }
  /* 护栏 */
  guardrail(x1, z1, x2, z2) {
    const len = dist2d(x1, z1, x2, z2), rot = Math.atan2(x2 - x1, z2 - z1);
    const f = fwd(rot), n = Math.floor(len / 4);
    const g = new THREE.Group();
    for (let i = 0; i <= n; i++) {
      const d = Math.min(i * 4, len);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), this.mat({ color: 0x9aa2ad, metalness: 0.6, roughness: 0.4 }));
      post.position.set(x1 + f.x * d, 0.38, z1 + f.z * d); post.castShadow = true; g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, len), this.mat({ color: 0xb8c0cb, metalness: 0.65, roughness: 0.35 }));
    rail.position.set((x1 + x2) / 2, 0.65, (z1 + z2) / 2);
    rail.rotation.y = rot + Math.PI / 2; rail.castShadow = true; g.add(rail);
    this.obstacles.push({ type: 'obb', x: (x1 + x2) / 2, z: (z1 + z2) / 2, h: rot, hl: len / 2, hw: 0.35 });
    return this.add(g);
  }
  /* 路缘石 */
  curb(x1, z1, x2, z2, hgt) {
    const len = dist2d(x1, z1, x2, z2), rot = Math.atan2(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, hgt || 0.15, len), this.mat({ color: 0xb9bcc0 }));
    m.position.set((x1 + x2) / 2, (hgt || 0.15) / 2, (z1 + z2) / 2);
    m.rotation.y = rot + Math.PI / 2; m.castShadow = true; m.receiveShadow = true;
    this.obstacles.push({ type: 'obb', x: (x1 + x2) / 2, z: (z1 + z2) / 2, h: rot, hl: len / 2, hw: 0.2 });
    return this.add(m);
  }
  /* 绿化环岛中心岛 */
  island(x, z, r) {
    const curbM = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.22, 48), this.mat({ color: 0xc4c8cd }));
    curbM.position.set(x, 0.11, z); curbM.receiveShadow = true; this.add(curbM);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 48), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
    isl.position.set(x, 0.14, z); isl.receiveShadow = true; this.add(isl);
    // 中心雕塑
    const mon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 4.2, 6), this.mat({ color: 0x9fb4c8, metalness: 0.3, roughness: 0.5 }));
    mon.position.set(x, 2.2, z); mon.castShadow = true; this.add(mon);
    for (let i = 0; i < 5; i++) this.tree(x + Math.cos(i / 5 * TAU) * (r * 0.6), z + Math.sin(i / 5 * TAU) * (r * 0.6), 0.9);
    this.obstacles.push({ type: 'circle', x, z, r: r + 0.4 });
    return this;
  }
  /* 立柱标志牌 (蓝底白字/白底) */
  sign(lines, x, z, rot, y, opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const pw = opts.post === false ? 0 : 0.08;
    const w = opts.w || 2.2, h = opts.h || 1.6;
    if (pw) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(pw, pw, y || 2.6, 8), this.mat({ color: 0x8a929e, metalness: 0.5, roughness: 0.45 }));
      pole.position.y = (y || 2.6) / 2; pole.castShadow = true; g.add(pole);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08));
    const tex = signTex(lines, opts);
    board.material = [this.mat({ color: 0x777 }), this.mat({ color: 0x777 }), this.mat({ color: 0x777 }), this.mat({ color: 0x777 }),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: opts.led ? 0.5 : 0.08, roughness: 0.6 }),
      this.mat({ color: 0x888 })];
    board.position.y = (y || 2.6); board.castShadow = true;
    board.rotation.y = (rot || 0) * D2R + Math.PI;
    g.add(board);
    g.position.set(x, 0, z);
    return this.add(g);
  }
  /* 龙门架车道指示 (overhead gantry) */
  gantry(x, z, rot, laneSigns) {
    // laneSigns: [{offsetX, w, h, tex, y}] offsetX 为沿右侧向的偏移
    const g = new THREE.Group();
    const span = 22;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.5, 0.5), this.mat({ color: 0x77808c, metalness: 0.55, roughness: 0.4 }));
    beam.position.y = 6; beam.rotation.y = (rot || 0) * D2R; beam.castShadow = true; g.add(beam);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), this.mat({ color: 0x77808c, metalness: 0.55, roughness: 0.4 }));
      const r = rightOf(rot || 0);
      leg.position.set(r.x * s * span / 2, 3, r.z * s * span / 2);
      leg.castShadow = true; g.add(leg);
    }
    const r = rightOf(rot || 0), f = fwd(rot || 0);
    for (const s of laneSigns) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.1),
        [this.mat({ color: 0x555 }), this.mat({ color: 0x555 }), this.mat({ color: 0x555 }), this.mat({ color: 0x555 }),
        new THREE.MeshStandardMaterial({ map: s.tex, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: s.led ? 0.55 : 0.1, roughness: 0.5 }),
        this.mat({ color: 0x666 })]);
      board.position.set(r.x * s.offsetX, s.y || 5.1, r.z * s.offsetX);
      board.rotation.y = (rot || 0) * D2R + Math.PI;
      g.add(board);
      if (s.led) s._mesh = board;
    }
    g.position.set(x, 0, z);
    return this.add(g);
  }
  /* 静止车辆(障碍) */
  parkedCar(x, z, rotDeg, color, isTruck) {
    const v = new Car(color || 0x8a9bb0, isTruck);
    const h = (rotDeg || 0) * D2R;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = h;
    this.add(v.group);
    this.obstacles.push({ type: 'obb', x, z, h, hl: (isTruck ? 4.4 : 2.26), hw: 0.9, kind: 'car' });
    return v;
  }
  /* 禁压线段 */
  forbid(x1, z1, x2, z2) { this.forbiddenLines.push({ x1, z1, x2, z2 }); return this; }
  /* 可行驶区域 */
  drive(x, z, hl, hw, rot) { this.drivables.push({ x, z, hl, hw, rot: rot || 0 }); return this; }
  isDrivable(px, pz) {
    for (const d of this.drivables) {
      const dx = px - d.x, dz = pz - d.z;
      if (!d.rot) { if (Math.abs(dx) <= d.hw && Math.abs(dz) <= d.hl) return true; }
      else {
        const c = Math.cos(d.rot), s = Math.sin(d.rot);
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= d.hw && Math.abs(lz) <= d.hl) return true;
      }
    }
    return false;
  }
}

/* ---------------- 共享违规检查器 (主程序与测试共用) ---------------- */
function createWorldChecker(car, world, aiCars, nowFn) {
  const st = { cool: {}, crashCool: 0, offroadCool: 0, last: 0 };
  return function (addViolation, crashFx) {
    const now = nowFn ? nowFn() : performance.now();
    const cs = car.corners();
    const carHL = car.isTruck ? 4.5 : CAR_HL, carHW = car.isTruck ? 1.15 : CAR_HW;
    let hit = null;
    for (const ob of world.obstacles) {
      if (ob.type === 'circle') {
        let best = Infinity;
        for (const c of cs) best = Math.min(best, dist2d(c.x, c.z, ob.x, ob.z));
        const dc = dist2d(car.x, car.z, ob.x, ob.z) - 0.6;
        if (Math.min(best, dc) < ob.r + 0.25) { hit = ob; break; }
      } else {
        if (obbOverlap(car.x, car.z, car.heading, carHL, carHW, ob.x, ob.z, ob.h, ob.hl, ob.hw)) { hit = ob; break; }
      }
    }
    if (!hit) {
      for (const a of aiCars) {
        if (obbOverlap(car.x, car.z, car.heading, carHL, carHW, a.x, a.z, a.heading, a.isTruck ? 4.5 : CAR_HL, a.isTruck ? 1.15 : CAR_HW)) {
          hit = { kind: 'car' }; break;
        }
      }
    }
    if (hit && now - st.crashCool > 1800) {
      st.crashCool = now;
      const msg = hit.kind === 'cone' ? '撞到锥桶（车辆出界/压线）' : hit.kind === 'car' ? '与车辆发生碰撞' : '碰撞障碍物';
      addViolation(msg, hit.kind === 'cone' ? 5 : 15, 3);
      if (crashFx) crashFx();
      car.speed *= -0.25;
    }
    // 车身采样点: 4 角 + 4 边中点(防止短线段从车身下方穿过漏判)
    const f = fwd(car.heading), rg = rightOf(car.heading);
    const hl2 = carHL, hw2 = carHW;
    const pts = cs.concat([
      { x: car.x + f.x * hl2, z: car.z + f.z * hl2 }, { x: car.x - f.x * hl2, z: car.z - f.z * hl2 },
      { x: car.x + rg.x * hw2, z: car.z + rg.z * hw2 }, { x: car.x - rg.x * hw2, z: car.z - rg.z * hw2 }
    ]);
    for (let i = 0; i < world.forbiddenLines.length; i++) {
      const L = world.forbiddenLines[i];
      // 线段两端各内缩 0.45m: 车角从库线端头外侧经过不算压线(消除误判)
      const dx = L.x2 - L.x1, dz = L.z2 - L.z1, len = Math.hypot(dx, dz);
      if (len < 1.2) continue;
      const ux = dx / len, uz = dz / len, ins = 0.45;
      const ax = L.x1 + ux * ins, az = L.z1 + uz * ins, bx = L.x2 - ux * ins, bz = L.z2 - uz * ins;
      let on = false;
      for (const c of pts) if (pointSegDist(c.x, c.z, ax, az, bx, bz) < 0.1) { on = true; break; }
      if (on) {
        const key = 'line' + i;
        if (!st.cool[key] || now - st.cool[key] > 4000) {
          st.cool[key] = now;
          addViolation('车辆压线（实线/库线）', 10, 4);
        }
      }
    }
    if (world.drivables.length && !world.isDrivable(car.x, car.z) && Math.abs(car.speed) > 0.5) {
      if (now - st.offroadCool > 6000) {
        st.offroadCool = now;
        addViolation('驶出路面（越野行驶）', 5, 6);
      }
    }
  };
}
