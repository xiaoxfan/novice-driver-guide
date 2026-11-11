/* =====================================================
 * car.js - 车辆模型 / 物理 / AI 车辆
 * 约定: heading h, forward = (sin h, 0, cos h)
 * ===================================================== */

const CAR_L = 4.6, CAR_W = 1.84, CAR_HL = CAR_L / 2, CAR_HW = CAR_W / 2;

function carMat(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.35, metalness: 0.65
  }, opts || {}));
}

/* ---------- 车辆模型 ---------- */
class Car {
  constructor(color, isTruck) {
    ALL_CARS.push(this);
    this.isTruck = !!isTruck;
    this.group = new THREE.Group();
    this.color = color;
    this.buildMesh(color);
    // 物理状态
    this.x = 0; this.z = 0; this.heading = 0;
    this.speed = 0; this.steer = 0; this.steerInput = 0;
    this.gear = 'N';                 // D / R / N
    this.wheelBase = isTruck ? 3.6 : 2.75;
    this.maxSteer = isTruck ? 0.45 : 0.62;
    this.blinker = null;            // 'L' | 'R' | null
    this._blinkT = 0; this._blinkStartHead = 0;
    this.braking = false;
    // AI
    this.aiPath = null; this.aiIdx = 0; this.aiSpeed = 0; this.aiLoop = false; this.aiPingpong = false; this.aiDir = 1;
  }
  buildMesh(color) {
    const g = this.group;
    const L = this.isTruck ? 9 : CAR_L, W = this.isTruck ? 2.3 : CAR_W;
    const bodyMat = carMat(color);
    if (this.isTruck) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(W, 2.4, 2.2), bodyMat);
      cab.position.set(0, 1.7, L / 2 - 1.1); g.add(cab);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.9, 0.1), carMat(0x223344, { roughness: 0.15, metalness: 0.8 }));
      glass.position.set(0, 2.1, L / 2 - 0.02); g.add(glass);
      const box = new THREE.Mesh(new THREE.BoxGeometry(W + 0.15, 2.9, L - 2.6), carMat(0xdadfe6, { roughness: 0.7, metalness: 0.15 }));
      box.position.set(0, 2.2, -1.2); g.add(box);
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.5, L - 1), carMat(0x2a2e33));
      chassis.position.set(0, 0.55, 0); g.add(chassis);
    } else {
      // 底盘
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(W - 0.25, 0.42, L - 0.5), carMat(0x23262b));
      chassis.position.y = 0.48; g.add(chassis);
      // 车身主体(略带楔形, 用两段 box 模拟)
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), bodyMat);
      body.position.y = 0.82; g.add(body);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(W - 0.18, 0.4, 1.3), bodyMat);
      nose.position.set(0, 0.7, L / 2 - 0.35); g.add(nose);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.18, 0.44, 0.9), bodyMat);
      tail.position.set(0, 0.72, -L / 2 + 0.45); g.add(tail);
      // 座舱
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.28, 0.62, L * 0.45), bodyMat);
      cabin.position.set(0, 1.42, -0.25); g.add(cabin);
      // 玻璃
      const glassMat = carMat(0x1d2b3a, { roughness: 0.12, metalness: 0.85 });
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.5, 0.06), glassMat);
      windshield.position.set(0, 1.42, L * 0.2 - 0.05); windshield.rotation.x = -0.42; g.add(windshield);
      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.46, 0.06), glassMat);
      rearGlass.position.set(0, 1.42, -L * 0.42 - 0.05); rearGlass.rotation.x = 0.5; g.add(rearGlass);
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, L * 0.42), glassMat);
      winL.position.set(W / 2 - 0.16, 1.44, -0.25); g.add(winL);
      const winR = winL.clone(); winR.position.x = -(W / 2 - 0.16); g.add(winR);
      // 后视镜
      const mirrorMat = carMat(0x2a2e33);
      const mL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), mirrorMat);
      mL.position.set(W / 2 + 0.05, 1.28, L * 0.2 - 0.2); g.add(mL);
      const mR = mL.clone(); mR.position.x = -(W / 2 + 0.05); g.add(mR);
    }
    // 车灯
    const W2 = this.isTruck ? 2.3 : CAR_W, L2 = this.isTruck ? 9 : CAR_L;
    this.headLights = [];
    this.tailLights = [];
    this.blinkL = []; this.blinkR = [];
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff6cc, emissiveIntensity: 0.8 }));
      hl.position.set(s * (W2 / 2 - 0.32), this.isTruck ? 1.6 : 0.9, L2 / 2 - 0.02);
      g.add(hl); this.headLights.push(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x992222, emissive: 0xff2211, emissiveIntensity: 0.35 }));
      tl.position.set(s * (W2 / 2 - 0.3), this.isTruck ? 1.1 : 0.95, -L2 / 2 + 0.02);
      g.add(tl); this.tailLights.push(tl);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xaa6600, emissive: 0xff9500, emissiveIntensity: 0.15 }));
      bl.position.set(s * (W2 / 2 - 0.08), this.isTruck ? 1.6 : 0.88, L2 / 2 - 0.02);
      g.add(bl); this.blinkL.push(bl);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xaa6600, emissive: 0xff9500, emissiveIntensity: 0.15 }));
      br.position.set(s * (W2 / 2 - 0.08), this.isTruck ? 1.1 : 0.9, -L2 / 2 + 0.02);
      g.add(br); this.blinkR.push(br);
    }
    // 车牌
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.03), carMat(0xeeeeca, { roughness: 0.6, metalness: 0.1 }));
    plate.position.set(0, 0.62, -L2 / 2 - 0.01); g.add(plate);
    // 车轮
    this.wheels = [];
    const wheelR = this.isTruck ? 0.55 : 0.34, wheelW = this.isTruck ? 0.35 : 0.24;
    const axleF = this.wheelBase / 2, axleR = -this.wheelBase / 2;
    const track = (this.isTruck ? 2.3 : CAR_W) / 2 - wheelW / 2 + 0.02;
    for (const [sx, sz, front] of [[1, axleF, true], [-1, axleF, false], [1, axleR, false], [-1, axleR, false]]) {
      const wg = new THREE.Group();
      wg.rotation.order = 'YXZ';
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 18), carMat(0x18191c, { roughness: 0.95, metalness: 0 }));
      tire.rotation.z = Math.PI / 2; tire.castShadow = true; wg.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW + 0.015, 12), carMat(0xb9c0c9, { roughness: 0.35, metalness: 0.85 }));
      rim.rotation.z = Math.PI / 2; wg.add(rim);
      wg.position.set(sx * track, wheelR, sz);
      g.add(wg);
      this.wheels.push({ g: wg, tire, front, radius: wheelR });
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  }
  /* ---- 姿态 ---- */
  setPose(x, z, headingDeg) {
    this.x = x; this.z = z; this.heading = (headingDeg || 0) * D2R;
    this.speed = 0; this.steer = 0; this.gear = 'N';
    this.blinker = null;
    this.syncMesh();
  }
  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;  // 见下: forward=(sin h,cos h) => mesh +Z 前方与 rotation.y=h 对应
    // 前轮转向 + 车轮滚动
    for (const w of this.wheels) {
      if (w.front) w.g.rotation.y = this.steer;
      w.g.rotation.x += this.speed * 0.06;
    }
  }
  corners() {
    const f = fwd(this.heading), r = rightOf(this.heading);
    const hl = this.isTruck ? 4.5 : CAR_HL, hw = this.isTruck ? 1.15 : CAR_HW;
    const pts = [];
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      pts.push({ x: this.x + f.x * a * hl + r.x * b * hw, z: this.z + f.z * a * hl + r.z * b * hw });
    }
    return pts;
  }
  /* ---- 玩家操控物理 ----
   * input: {throttle 0..1, brake 0..1, steer -1..1, handbrake}
   */
  updatePlayer(dt, input, onRoad) {
    const maxFwd = this.isTruck ? 22 : 33;      // m/s
    const maxRev = 3.2;
    // 挡位逻辑: 停止时 S 保持在制动状态切换 R / D
    if (input.gearCmd === 'R') this.gear = 'R';
    else if (input.gearCmd === 'D') this.gear = 'D';
    let accel = 0;
    if (this.gear === 'D' || this.gear === 'N') {
      if (input.throttle > 0 && this.gear === 'N') this.gear = 'D';
      if (this.gear === 'D') accel = input.throttle * (this.isTruck ? 3.0 : 4.6);
    }
    if (this.gear === 'R') accel = -input.throttle * 1.5;
    let brake = input.brake * 9 + (input.handbrake ? 6 : 0);
    // 阻力
    const drag = 0.04 + (onRoad ? 0 : 1.4) + (Math.abs(this.speed) > 0.5 ? 0.12 : 0);
    let v = this.speed + accel * dt;
    if (input.brake > 0 || input.handbrake) {
      const dec = brake * dt;
      if (Math.abs(v) <= dec) v = 0; else v -= Math.sign(v) * dec;
    }
    v -= Math.sign(v) * Math.min(Math.abs(v), drag * dt * Math.abs(v) * 0.5 + 0.35 * dt);
    if (this.gear === 'R') v = clamp(v, -2.5, 0.5);
    else v = clamp(v, -maxRev * 0.4, maxFwd);
    if (!onRoad) v = clamp(v, -3, 14);
    this.speed = v;
    this.braking = input.brake > 0 || input.handbrake;
    // 转向
    const speedFactor = 1 / (1 + Math.abs(v) * 0.055);
    const target = input.steer * this.maxSteer * speedFactor;
    this.steer = lerp(this.steer, target, clamp(dt * 7, 0, 1));
    // 自行车模型
    if (Math.abs(v) > 0.01) {
      this.heading = angNorm(this.heading + (v / this.wheelBase) * Math.tan(this.steer) * dt);
      const f = fwd(this.heading);
      this.x += f.x * v * dt;
      this.z += f.z * v * dt;
    }
    // 转向灯闪烁 + 自动回位
    this._blinkT += dt;
    if (this.blinker && Math.abs(angNorm(this.heading - this._blinkStartHead)) > 1.9) {
      // 已完成明显转向, 自动熄灭
      if (Math.abs(this.steer) < 0.08) this.blinker = null;
    }
    this.updateLights();
    this.syncMesh();
  }
  updateLights() {
    const on = Math.floor(this._blinkT * 1.6) % 2 === 0;
    for (const b of this.blinkL) b.material.emissiveIntensity = (this.blinker === 'L' && on) ? 2.2 : 0.12;
    for (const b of this.blinkR) b.material.emissiveIntensity = (this.blinker === 'R' && on) ? 2.2 : 0.12;
    for (const t of this.tailLights) t.material.emissiveIntensity = this.braking ? 1.6 : 0.3;
  }
  blinkerOn(sec) {
    return this.blinker !== null && this._blinkT - (this._blinkerSince || 0) >= (sec || 0);
  }
  setBlinker(side) {
    if (this.blinker !== side) { this.blinker = side; this._blinkerSince = this._blinkT; this._blinkStartHead = this.heading; }
  }
  /* ---- AI 巡逻 ---- */
  setAI(path, speed, opts) {
    this.aiPath = path; this.aiIdx = 0; this.aiSpeed = speed;
    this.aiLoop = !!(opts && opts.loop);
    this.aiPingpong = !!(opts && opts.pingpong);
    this.closedLoop = !!(opts && opts.closed);
    this.aiDone = false;
    this.aiDir = 1;
    const p = path[0];
    this.x = p.x; this.z = p.z;
    if (p.h != null) this.heading = p.h * D2R; else this.heading = headingTo(p.x, p.z, path[1].x, path[1].z);
    this.speed = speed;
    this.syncMesh();
  }
  updateAI(dt) {
    if (!this.aiPath || !this.aiPath.length) return;
    if (this.aiDone) { this._blinkT += dt; this.updateLights(); this.syncMesh(); return; }
    const path = this.aiPath;
    let idx = clamp(Math.round(this.aiIdx), 0, path.length - 1);
    let target = path[idx];
    const d = dist2d(this.x, this.z, target.x, target.z);
    if (d < 2.5) {
      this.aiIdx += this.aiDir;
      if (this.aiIdx >= path.length) {
        if (this.aiPingpong) { this.aiDir = -1; this.aiIdx = path.length - 2; }
        else if (this.aiLoop) {
          this.aiIdx = 0;
          if (!this.closedLoop) { this.x = path[0].x; this.z = path[0].z; this.heading = headingTo(path[0].x, path[0].z, path[1] ? path[1].x : path[0].x, path[1] ? path[1].z : path[0].z); }
        }
        else { this.aiDone = true; this.speed = 0; }
      } else if (this.aiIdx < 0) {
        if (this.aiPingpong) { this.aiDir = 1; this.aiIdx = 1; }
        else this.aiIdx = 0;
      }
      idx = clamp(Math.round(this.aiIdx), 0, path.length - 1);
      target = path[idx];
    }
    const th = headingTo(this.x, this.z, target.x, target.z);
    this.heading = angNorm(this.heading + angNorm(th - this.heading) * clamp(dt * 2.2, 0, 1));
    const f = fwd(this.heading);
    // 跟车避撞: 清理已移除车辆, 检查前方同向近距离车辆
    for (let i = ALL_CARS.length - 1; i >= 0; i--) if (!ALL_CARS[i].group.parent) ALL_CARS.splice(i, 1);
    let blocked = false;
    // 被堵计时: 长时间被近乎静止的车辆阻塞时, 尝试收窄车道宽度从内侧绕行
    if (this._blk && this._blk.sp < 1) this._blkT = (this._blkT || 0) + dt; else this._blkT = 0;
    const laneW = this._blkT > 2.5 ? 1.0 : 2.2;
    for (const o of ALL_CARS) {
      if (o === this) continue;
      const dx = o.x - this.x, dz = o.z - this.z;
      const ahead = dx * f.x + dz * f.z;
      if (ahead <= 0.5) continue;
      // 只对同向行驶的车辆跟行避撞; 对向/交叉车流不在此处理
      const fo = fwd(o.heading);
      if (f.x * fo.x + f.z * fo.z < 0.35) continue;
      const lat = Math.abs(-dx * f.z + dz * f.x);
      if (ahead < 5 + this.speed * 0.6 && lat < laneW) { blocked = true; this._blk = o; break; }
    }
    if (!blocked) this._blk = null;
    if (blocked) this.speed = Math.max(0, this.speed - 10 * dt);
    else this.speed = Math.min(this.aiSpeed, this.speed + 6 * dt);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this._blinkT += dt;
    this.updateLights();
    this.syncMesh();
  }
}
