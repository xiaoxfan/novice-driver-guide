/* =====================================================
 * scenarios.js - 七大训练场景 (按中国交规)
 * 约定: heading h, forward=(sin h, cos h); 东行(+X)右侧为 +Z
 * api: { car, world, scene, s(状态), t(秒), aiCars[], toast, addViolation }
 * ===================================================== */

function inRect(px, pz, x1, z1, x2, z2) { return px >= x1 && px <= x2 && pz >= z1 && pz <= z2; }
function carCornersIn(api, x1, z1, x2, z2, pad) {
  pad = pad || 0;
  return api.car.corners().every(c => inRect(c.x, c.z, x1 - pad, z1 - pad, x2 + pad, z2 + pad));
}
function angDiff(a, b) { return Math.abs(angNorm(a - b)); }
function kmh(v) { return v * 3.6; }
/* 找出龙门架上所有 LED 板(可换贴图) */
function ledBoards(g) {
  const out = [];
  g.children.forEach(ch => {
    if (Array.isArray(ch.material) && ch.material[4] && ch.material[4].emissiveIntensity === 0.55) out.push(ch);
  });
  return out;
}
function setLedTex(g, tex) {
  ledBoards(g).forEach(b => { b.material[4].map = tex; b.material[4].emissiveMap = tex; b.material[4].needsUpdate = true; });
}

/* 道路沿线装饰 */
function dressRoadside(w, x1, z1, x2, z2, sideDist, opts) {
  opts = opts || {};
  const len = dist2d(x1, z1, x2, z2);
  const n = Math.floor(len / 26);
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    const bx = lerp(x1, x2, t), bz = lerp(z1, z2, t);
    const off = sideDist + Math.random() * 6;
    w.tree(bx + off, bz + (Math.random() - 0.5) * 6, 0.8 + Math.random() * 0.7);
    if (i % 2 === 0) w.lamp(bx - sideDist * 0.35, bz, headingTo(x1, z1, x2, z2));
  }
  if (opts.buildings) {
    const nb = Math.floor(len / 42);
    const side = opts.side || (z1 >= 0 ? 1 : -1);   // 远离道路的方向
    for (let i = 0; i < nb; i++) {
      const t = (i + 0.5) / Math.max(1, nb);
      const bx = lerp(x1, x2, t) + (Math.random() - 0.5) * 16;
      const off = 14 + Math.random() * 12;
      const h = 12 + Math.random() * 26;
      const cc = ['#8a94a3', '#9aa5b1', '#7e8a99', '#a3aab5'][i % 4];
      w.building(bx, z1 + side * off, 16 + Math.random() * 10, 14 + Math.random() * 10, h, 0, cc);
    }
  }
}

/* =====================================================
 * 场景一: 倒车入库 (垂直车位, 车头朝外)
 * ===================================================== */
const SCN_reverseBay = {
  id: 'reverseBay', name: '倒车入库', ico: '🅿️',
  desc: '停车场内将车辆倒驶入垂直车位（车头朝外停放）。掌握「一米半边距、对位停车、打死方向、后视镜观察」的科目二核心技巧。',
  tags: ['科目二', '停车场', '后视镜观察'],
  speedLimit: 10,
  rules: [
    '倒车前应观察后方情况，确认安全后再倒车',
    '倒车时车速要慢（怠速），随时准备制动',
    '观察后视镜，当车身与库位边线平行时迅速回正方向',
    '入库后车身不得压线、出线，车头不得超出库位前边线',
    '停车场内行驶车速不得超过限速（一般5~10km/h）'
  ],
  brief: '目标：将车倒入前方右侧的目标车位（两侧有锥桶标记）。提示：停车时按住 S 挂入倒挡；倒挡中按 S 倒车、按 W 刹停。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(600);
    w.asphalt(20, 2, 180, 84, 0);
    w.drive(20, 2, 42, 90, 0);
    w.asphalt(-95, 3.6, 50, 9, 0);
    w.drive(-95, 3.6, 4.5, 25, 0);
    w.line(-120, 0, -6, 0, 0.15, 0xffffff);
    w.line(-120, 7.2, -6, 7.2, 0.15, 0xffffff);
    w.curb(-70, -40, 110, -40); w.curb(-70, 44, 110, 44);
    w.curb(110, -40, 110, 44); w.curb(-70, -40, -70, 44);
    // 两排垂直车位: 右排(+Z)前沿 z=6 深5.4; 左排镜像
    s.bayX0 = 6; s.bayW = 3.2;
    for (let i = 0; i <= 9; i++) {
      const bx = s.bayX0 + s.bayW * i;
      w.line(bx, 6, bx, 11.4, 0.12, 0xffffff);
      w.line(bx, -6, bx, -11.4, 0.12, 0xffffff);
    }
    s.tgt = { x1: 22, x2: 25.2, z1: 6, z2: 11.4 };
    w.cone(21.45, 11.15); w.cone(25.75, 11.15);
    w.forbid(22, 6, 22, 11.4); w.forbid(25.2, 6, 25.2, 11.4); w.forbid(22, 11.4, 25.2, 11.4);
    const parkedCols = [0x8f9bb0, 0x5a6f8f, 0x7f8a95, 0x4a5568, 0x9aa5b0, 0x6f7f95, 0x8a95a5, 0x55617a, 0x90a0b8, 0x708090];
    for (let i = 0; i < 9; i++) {
      if (i === 5) continue;
      w.parkedCar(s.bayX0 + s.bayW * i + 1.6, 8.7, 180, parkedCols[i]);   // 车头朝外
    }
    for (const i of [0, 1, 3, 5, 7]) w.parkedCar(s.bayX0 + s.bayW * i + 1.6, -8.7, 0, parkedCols[(i + 3) % 10]);
    w.sign([{ t: 'P', fs: 90 }, { t: '停车场', fs: 44 }], -60, -14, 90, 3.2, { blue: true, w: 2.4, h: 3.0 });
    w.sign([{ t: '限速', fs: 40 }, { t: '5', fs: 90 }], -48, 10, 90, 2.6, { w: 1.8, h: 2.2 });
    dressRoadside(w, -70, -48, 110, -48, 6, { buildings: true });
    dressRoadside(w, -70, 52, 110, 52, 6, { buildings: true });
    api.car.setPose(-35, 3.6, 90);
  },
  steps: [
    { name: '起步准备', tip: () => '绕车检查、调整座椅与后视镜、系好安全带。按 W 起步。', check: api => api.car.speed > 0.1 },
    {
      name: '低速接近车位', tip: () => '以怠速缓慢直行（≤10km/h），车身与右侧车位线保持约1.5米。',
      check: api => kmh(api.car.speed) < 13 && api.car.x > 8
    },
    {
      name: '停车对位', tip: api => api.car.x < 26 ? '继续前进，让车头完全越过目标车位。' : '当右后视镜越过车位前边线约1米时停车（S 或空格刹停）。',
      check: api => Math.abs(api.car.speed) < 0.05 && api.car.x > 27.2 && api.car.x < 28.3 && api.car.z > 2.2 && api.car.z < 5.2
    },
    {
      name: '挂倒挡并右打满方向', tip: () => '停稳后长按 S 挂入倒挡（仪表显示R），按住 D 将方向盘向右打满，再按 S 怠速倒车。',
      check: api => api.car.gear === 'R' && api.car.steer < -0.42
    },
    {
      name: '缓慢倒入车位', tip: api => `怠速倒车，从左后视镜观察库位左前角。当前车身转角: ${(angDiff(api.car.heading, 90 * D2R) / D2R).toFixed(0)}°（倒至车身与库线平行）`,
      check: api => api.car.z > 6.6 && angDiff(api.car.heading, 180 * D2R) < 22 * D2R && api.car.gear === 'R'
    },
    {
      name: '车身平行时回正方向', tip: api => `从后视镜看到车身与两侧库线平行时，立即回正方向（松开方向键）继续倒入。当前转角: ${(angDiff(api.car.heading, 180 * D2R) / D2R).toFixed(0)}°`,
      check: api => Math.abs(api.car.steer) < 0.16 && angDiff(api.car.heading, 180 * D2R) < 12 * D2R && api.car.z > 7.4 && api.car.gear === 'R' && api.car.speed < 0
    },
    {
      name: '倒至库位中停稳', tip: api => api.car.z < 10 ? '继续倒车，观察后方锥桶，车尾接近库底时刹停。' : '注意车尾即将到达库位底线，踩住刹车！',
      check: api => Math.abs(api.car.speed) < 0.05 && angDiff(api.car.heading, 180 * D2R) < 8 * D2R && Math.abs(api.car.x - 23.6) < 0.7 && api.car.z > 7.0 && api.car.z < 10.9
    }
  ],
  update(api, dt) {
    const c = api.car;
    if (kmh(Math.abs(c.speed)) > 13 && c.x > -5) api.addViolation('停车场内超速行驶', 10, 4);
    if (c.x > 21.5 && c.x < 25.5 && c.z > 11.6) api.addViolation('倒车出线：车尾超出库位底线', 10, 4);
  }
};

/* =====================================================
 * 场景二: 侧方停车 (路右侧 +Z)
 * ===================================================== */
const SCN_parallel = {
  id: 'parallel', name: '侧方停车', ico: '🚗',
  desc: '路边平行车位停车（科目二经典项目）。掌握与前车对位、右打满倒车、45°回正、左打满入库的完整流程。',
  tags: ['科目二', '路侧车位', '路缘判断'],
  speedLimit: 30,
  rules: [
    '侧方停车应提前开启右转向灯，靠边减速',
    '停车后不得妨碍其他车辆、行人通行',
    '车身右侧与路缘保持约30厘米，不得骑压路缘',
    '倒车时注意观察后方来车和行人',
    '停稳后拉紧手刹，防止溜车'
  ],
  brief: '目标：将车停入前方右侧两车之间的平行车位（约6米），车身摆正、不压线、不撞路缘。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(600);
    // 双向道路: 西行 z<0, 东行 z>0 (东行右侧为+Z)
    w.asphalt(-20, 0, 260, 21, 0);
    w.drive(-20, 0, 10.5, 130, 0);
    w.line(-150, -10.5, 110, -10.5, 0.18, 0xffffff);
    w.line(-150, 10.5, 110, 10.5, 0.18, 0xffffff);
    w.doubleYellow(-150, 0, 110, 0);
    w.dashed(-150, -5.25, 110, -5.25, 0.15, 0xffffff);
    w.dashed(-150, 5.25, 110, 5.25, 0.15, 0xffffff);
    w.forbid(-150, -10.5, 110, -10.5);
    w.forbid(-150, 10.5, 8, 10.5); w.forbid(30, 10.5, 110, 10.5);
    w.curb(-150, 10.85, 110, 10.85);
    // 路侧车位: 后车 x11.9 与前车 x23.1, 车位 x∈[14.2,20.8], 停车带 z≈8.3
    s.spot = { x1: 14.2, x2: 20.8, z: 8.3 };
    w.line(14.2, 7.9, 14.2, 10.4, 0.12, 0xffffff);
    w.line(20.8, 7.9, 20.8, 10.4, 0.12, 0xffffff);

    w.parkedCar(11.9, 8.3, 90, 0x7f8a99);
    w.parkedCar(23.1, 8.3, 90, 0x5a6f8f);
    const ai1 = new Car(0xc0c8d2); api.scene.add(ai1.group);
    ai1.setAI([{ x: 100, z: -1.75, h: 270 }, { x: -140, z: -1.75, h: 270 }], 8, { loop: true });
    api.aiCars.push(ai1);
    dressRoadside(w, -140, -16, 100, -16, 5, { buildings: true });
    dressRoadside(w, -140, 16, 100, 16, 5, { buildings: true });
    w.sign([{ t: '路侧车位', fs: 48 }, { t: '平行停车', fs: 36 }], -40, 13, 90, 2.8, { blue: true });
    api.car.setPose(-60, 5.25, 90);
    api.car.speed = 8; api.car.gear = 'D';
  },
  steps: [
    {
      name: '开启右转向灯靠边', tip: () => '按 Q 开启右转向灯（提前3秒示意），向右贴近路缘减速行驶。',
      check: api => api.car.blinker === 'R'
    },
    {
      name: '与前车平行对位', tip: api => api.car.x < 17.5 ? '保持约0.5米侧向间距，与右侧前车平行行驶。' : '当你的右后视镜与前车B柱（车身中部）平齐时停车。',
      check: api => Math.abs(api.car.speed) < 0.05 && api.car.x > 21.3 && api.car.x < 22.9 && api.car.z > 5.2 && api.car.z < 6.9
    },
    {
      name: '挂倒挡、右打满倒车', tip: () => '长按 S 挂倒挡，按住 D 向右打满方向，按 S 怠速倒车。',
      check: api => api.car.gear === 'R' && api.car.speed < -0.05 && api.car.steer < -0.4
    },
    {
      name: '倒至45°角', tip: api => `观察右后视镜，当车身与前车约呈45°（当前 ${(angDiff(api.car.heading, 90 * D2R) / D2R).toFixed(0)}°）时回正方向。`,
      check: api => angDiff(api.car.heading, 90 * D2R) > 28 * D2R && angDiff(api.car.heading, 90 * D2R) < 62 * D2R && api.car.z > 6.8
    },
    {
      name: '回正继续倒车', tip: () => '回正方向继续倒车，从左后视镜观察左后轮逐渐贴近路边线。',
      check: api => Math.abs(api.car.steer) < 0.18 && api.car.z > 7.15 && api.car.x < 21 && api.car.gear === 'R'
    },
    {
      name: '左打满倒入车位', tip: () => '当左后轮临近路边线时，迅速向左打满（按住 A），继续倒车。',
      check: api => api.car.steer > 0.4 && api.car.z > 7.5 && api.car.speed < -0.02
    },
    {
      name: '车身摆正、停车到位', tip: api => `车身与路缘平行后立即回正并踩停。当前车身角度: ${(angDiff(api.car.heading, 90 * D2R) / D2R).toFixed(0)}°`,
      check: api => Math.abs(api.car.speed) < 0.05 && angDiff(api.car.heading, 90 * D2R) < 8 * D2R &&
        Math.abs(api.car.x - 17.5) < 0.95 && api.car.z > 7.3 && api.car.z < 9.6
    }
  ],
  update(api, dt) {
    if (kmh(Math.abs(api.car.speed)) > 35) api.addViolation('超速行驶（限速30km/h）', 10, 4);
  }
};

/* =====================================================
 * 场景三: 变道超车 (三车道, 左道 -Z)
 * ===================================================== */
const SCN_overtake = {
  id: 'overtake', name: '变道超车', ico: '🛣️',
  desc: '城市快速路三车道路段超越前方慢行货车。掌握「左灯3秒—观察盲区—左侧超车—保持车距—驶回原车道」的规范流程。',
  tags: ['科目三', '转向灯', '安全车距'],
  speedLimit: 80,
  rules: [
    '超车应当从前车的左侧超越',
    '超车前提前开启左转向灯，提示前车与后方车辆',
    '变更车道前观察内外后视镜，确认侧后方无来车',
    '超车后在与被超车辆拉开必要安全距离后，开启右转向灯驶回原车道',
    '不得在实线路段、弯道、坡顶等禁止超车路段超车'
  ],
  brief: '目标：规范超越中间车道的慢行货车。注意左后方快速来车！不得从右侧超车。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(700);
    w.asphalt(0, 0, 480, 12.6, 0);
    w.drive(0, 0, 6.3, 240, 0);
    w.line(-240, -6.3, 240, -6.3, 0.18, 0xffffff);
    w.line(-240, 6.3, 240, 6.3, 0.18, 0xffffff);
    w.forbid(-240, -6.3, 240, -6.3); w.forbid(-240, 6.3, 240, 6.3);
    w.dashed(-240, -3.15, 240, -3.15, 0.15, 0xffffff);
    w.dashed(-240, 3.15, 240, 3.15, 0.15, 0xffffff);
    for (const x of [-220, -190, -160, -130, -100, -70, -40, -10, 20, 50, 80, 110, 140]) {
      w.arrow(x, -3.5, 90, 'leftStraight', 1.0);
      w.arrow(x, 0, 90, 'leftStraight', 1.0);
      w.arrow(x, 3.5, 90, 'straight', 1.0);
    }
    const truck = new Car(0xd8dde4, true);
    api.scene.add(truck.group);
    truck.setAI([{ x: -35, z: 0, h: 90 }, { x: 280, z: 0, h: 90 }], 9);
    api.aiCars.push(truck); s.truck = truck;
    const fast = new Car(0xb0392e); api.scene.add(fast.group);
    fast.setAI([{ x: -230, z: -3.5 }, { x: 420, z: -3.5 }], 26);
    api.aiCars.push(fast);
    for (const [x0, spd] of [[-80, 17], [-160, 19]]) {
      const c = new Car(0x4a6da8); api.scene.add(c.group);
      c.setAI([{ x: x0, z: 3.5 }, { x: 320, z: 3.5 }], spd, { loop: true });
      api.aiCars.push(c);
    }
    w.sign([{ t: '城市快速路', fs: 44 }, { t: '最高时速 80', fs: 34 }], -230, -10, 90, 3.0, { blue: true });
    dressRoadside(w, -300, -14, 300, -14, 6, { buildings: true });
    dressRoadside(w, -300, 14, 300, 14, 6, { buildings: true });
    api.car.setPose(-140, 0, 90);
    api.car.speed = 9; api.car.gear = 'D';
  },
  steps: [
    {
      name: '跟随前车保持车距', tip: api => {
        const d = api.car.x - api.s.truck.x;
        return d < 14 ? '⚠ 跟车过近！保持15米以上安全车距。' : '与货车保持安全车距跟随行驶（15米以上）。';
      },
      check: api => (api.s.truck.x - api.car.x) > 15 && api.car.x > -90 && Math.abs(api.car.z) < 1.7
    },
    { name: '开启左转向灯', tip: () => '按 Q 开启左转向灯（提前3秒以上示意）。', check: api => api.car.blinker === 'L' },
    {
      name: '观察后视镜确认安全', tip: () => '保持转向灯点亮，观察左后视镜——注意左后方快速来车！确认安全后再变道。',
      check: api => api.car.blinkerOn(2.5) && api.car.blinker === 'L' && api.car.z > -1.7
    },
    {
      name: '平稳变道至左车道', tip: () => '小角度缓打方向，一次性平顺变入左侧车道。',
      check: api => api.car.z < -2.0 && angDiff(api.car.heading, 90 * D2R) < 18 * D2R
    },
    {
      name: '加速完成超越', tip: api => api.car.x < api.s.truck.x + 6 ? '果断加速超越货车，横向保持安全间距。' : '即将完成超越。',
      check: api => api.car.x > api.s.truck.x + 12 && api.car.z < -1.9
    },
    { name: '开启右转向灯', tip: () => '超车后按 E 开启右转向灯，准备返回原车道。', check: api => api.car.blinker === 'R' },
    {
      name: '驶回原车道', tip: () => '与货车拉开足够距离后，平顺驶回中间车道。',
      check: api => Math.abs(api.car.z) < 1.6 && angDiff(api.car.heading, 90 * D2R) < 15 * D2R && api.car.blinkerOn(2)
    },
    { name: '完成超车', tip: () => '关闭转向灯（明显转向后会自动回位），稳定车速行驶。', check: api => api.car.blinker === null && Math.abs(api.car.z) < 1.7 && api.car.x > api.s.truck.x + 25 }
  ],
  update(api, dt) {
    const c = api.car, s = api.s;
    if (kmh(c.speed) > 85) api.addViolation('超速行驶（限速80km/h）', 10, 4);
    if (c.z > 1.9 && c.x > s.truck.x - 6 && !s.rightPass) {
      s.rightPass = true;
      api.addViolation('从右侧违法超车（应从左侧超车）', 25, 6);
    }
  }
};

/* =====================================================
 * 场景四: 汇入高速 (加速车道在右 +Z)
 * ===================================================== */
const SCN_merge = {
  id: 'merge', name: '汇入高速', ico: '🚦',
  desc: '从匝道经加速车道汇入高速公路主线。掌握「加速至车流速度—开左灯—观察后视镜—择机果断汇入」的要领。',
  tags: ['高速', '加速车道', '车流融合'],
  speedLimit: 100,
  rules: [
    '进入加速车道应迅速将车速提高到60km/h以上',
    '汇入前开启左转向灯，观察后方主线车流',
    '寻找车流间隙，在不影响主线车辆行驶的前提下汇入',
    '禁止在加速车道减速慢行或停车等待',
    '汇入后关闭转向灯，保持安全车距（100米以上）'
  ],
  brief: '目标：经加速车道加速后向左汇入主线最右（慢）车道，全程不停车、不影响主线车辆。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(900);
    // 主线: 快车道 z=-3.5, 慢车道 z=0; 加速车道 z=3.5
    w.asphalt(0, -1.75, 460, 7, 0);
    w.drive(0, -1.75, 3.5, 230, 0);
    w.asphalt(-100, 3.5, 260, 3.5, 0);
    w.drive(-100, 3.5, 1.75, 130, 0);
    w.line(-230, -5.25, 230, -5.25, 0.18, 0xffffff);
    w.line(-230, 1.75, -40, 1.75, 0.18, 0xffffff);
    w.forbid(-230, 1.75, -40, 1.75);
    w.dashed(-40, 1.75, 75, 1.75, 0.18, 0xffffff, 3, 4);
    w.line(75, 1.75, 230, 1.75, 0.18, 0xffffff);
    w.forbid(75, 1.75, 230, 1.75);
    w.dashed(-230, -1.75, 230, -1.75, 0.15, 0xffffff);
    // 楔形端部沥青
    (function () {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(45, 0); shape.lineTo(0, -3.5); shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.96 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(30, 0.005, 1.75);
      mesh.receiveShadow = true;
      w.add(mesh);
    })();
    for (const [x0, lane, spd, col] of [[-200, 0, 24, 0x4a6da8], [-130, 0, 24, 0x8f9bb0], [-60, 0, 23, 0xb0392e], [-160, -3.5, 29, 0x3f7f5f], [40, -3.5, 28, 0x6f5f9f]]) {
      const c = new Car(col); api.scene.add(c.group);
      c.setAI([{ x: x0, z: lane }, { x: 400, z: lane }], spd, { loop: true });
      api.aiCars.push(c);
    }
    w.sign([{ t: '高速公路', fs: 44 }, { t: '加速合流', fs: 44 }], -180, 6.8, 90, 3.4, { blue: true, w: 3.4, h: 2.2 });
    w.sign([{ t: '主线车流', fs: 40 }, { t: '注意瞭望', fs: 40 }], -50, 6.8, 90, 3.4, { blue: true, w: 3.2, h: 2.0 });
    w.gantry(-120, -1.75, 90, [
      { offsetX: 5.25, w: 1.6, h: 1.3, tex: laneSignalTex('green'), led: true },
      { offsetX: 1.75, w: 1.6, h: 1.3, tex: laneSignalTex('green'), led: true },
      { offsetX: -1.75, w: 1.6, h: 1.3, tex: laneSignalTex('green'), led: true }
    ]);
    w.guardrail(-230, -5.8, 230, -5.8);
    w.guardrail(-230, 5.8, 25, 5.8);
    w.guardrail(80, 2.3, 230, 2.3);
    dressRoadside(w, -230, -12, 230, -12, 5, {});
    dressRoadside(w, -230, 10, 230, 10, 5, {});
    api.car.setPose(-180, 3.5, 90);
    api.car.speed = 9; api.car.gear = 'D';
  },
  steps: [
    {
      name: '加速车道内加速', tip: api => `全力加速！汇入前应达到60km/h以上（当前 ${kmh(api.car.speed).toFixed(0)} km/h）`,
      check: api => kmh(api.car.speed) >= 58 && api.car.z > 1.9
    },
    { name: '开启左转向灯', tip: () => '按 Q 开启左转向灯，示意汇入主线。', check: api => api.car.blinker === 'L' },
    {
      name: '观察主线车流', tip: () => '保持转向灯，观察左后视镜：主线慢车道有车流接近，寻找车间空隙。',
      check: api => api.car.blinkerOn(2.5) && api.car.blinker === 'L' && api.car.x > -60
    },
    {
      name: '择机汇入主线', tip: () => '选择空隙，果断小角度汇入最右（慢）车道，不要减速犹豫！',
      check: api => api.car.z < 1.6 && api.car.z > -1.7 && api.car.x > -5
    },
    {
      name: '关闭转向灯稳定行驶', tip: api => api.car.blinker !== null ? '汇入完成后关闭转向灯。' : '保持车速，与前方车辆保持100米以上车距。',
      check: api => api.car.blinker === null && api.car.z < 1.7 && api.car.x > 120
    }
  ],
  update(api, dt) {
    const c = api.car;
    if (kmh(c.speed) > 105) api.addViolation('超速行驶（限速100km/h）', 10, 4);
    if (c.z > 1.85 && c.x > 10 && c.x < 70) {
      if (Math.abs(c.speed) < 4) api.addViolation('在加速车道停车（禁止行为）', 20, 5);
      else if (kmh(c.speed) < 45 && c.x > 35) api.addViolation('汇入速度过低（应≥60km/h）', 15, 5);
    }
    if (c.x > 85 && c.z > 1.85) api.addViolation('错过汇入点，冲出加速车道末端', 30, 8);
  }
};

/* =====================================================
 * 场景五: 环岛行驶
 * ===================================================== */
const SCN_roundabout = {
  id: 'roundabout', name: '环岛行驶', ico: '🌀',
  desc: '通过四路口环形路口（转盘）。掌握「入岛让行—沿岛逆时针行驶—出岛提前开右灯」规则，从南入口进入并从第三出口（西出口）驶出。',
  tags: ['让行规则', '转向灯', '出口计数'],
  speedLimit: 40,
  rules: [
    '准备进入环形路口的车辆，应让已在环岛内的车辆先行',
    '环岛内车辆按逆时针方向行驶（按 C 切换俯视图观察更直观）',
    '驶出环岛前，应提前开启右转向灯',
    '第一出口（右转）走外侧车道，依次通过各出口',
    '进出环岛均需减速，注意非机动车和行人'
  ],
  brief: '目标：从南入口进入环岛，绕行至第三出口（西出口）驶出。入岛前正确让行，出岛前开启右转向灯。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(700);
    const R = 17, rIn = 14, rOut = 20;
    s.R = R; s.phi = null; s.traveled = 0; s.exitCheck = false; s.entered = false;
    // 四条岔路 (避开中心岛)
    w.asphalt(0, -62, 14, 96, 0);
    w.asphalt(0, 62, 14, 96, 0);
    w.asphalt(-62, 0, 96, 14, 0);
    w.asphalt(62, 0, 96, 14, 0);
    w.drive(0, -62, 48, 7.5, 0); w.drive(0, 62, 48, 7.5, 0);
    w.drive(-62, 0, 7.5, 48, 0); w.drive(62, 0, 7.5, 48, 0);
    w.ringRoad(0, 0, rIn, rOut);
    w.drive(0, 0, 21, 21, 0);
    w.island(0, 0, 13.2);
    // 环道内外边线
    (function () {
      const n = 72;
      for (let i = 0; i < n; i++) {
        const a1 = i / n * TAU, a2 = (i + 0.55) / n * TAU, b2 = (i + 0.5) / n * TAU;
        w.line(Math.cos(a1) * (rOut - 0.3), Math.sin(a1) * (rOut - 0.3), Math.cos(a2) * (rOut - 0.3), Math.sin(a2) * (rOut - 0.3), 0.15, 0xffffff);
        w.line(Math.cos(a1) * (rIn + 0.3), Math.sin(a1) * (rIn + 0.3), Math.cos(b2) * (rIn + 0.3), Math.sin(b2) * (rIn + 0.3), 0.15, 0xf5c518);
      }
    })();
    // 岔路标线: 双黄中线 + 车道虚线 + 边缘线
    for (const arm of ['N', 'S', 'E', 'W']) {
      let x1, z1, x2, z2;
      if (arm === 'N') { x1 = 0; z1 = -108; x2 = 0; z2 = -21; }
      if (arm === 'S') { x1 = 0; z1 = 108; x2 = 0; z2 = 21; }
      if (arm === 'E') { x1 = 108; z1 = 0; x2 = 21; z2 = 0; }
      if (arm === 'W') { x1 = -108; z1 = 0; x2 = -21; z2 = 0; }
      w.doubleYellow(x1, z1, x2, z2);
      const rot = headingTo(x1, z1, x2, z2), r = rightOf(rot);
      w.dashed(x1 + r.x * 3.5, z1 + r.z * 3.5, x2 + r.x * 3.5, z2 + r.z * 3.5, 0.14, 0xffffff);
      w.dashed(x1 - r.x * 3.5, z1 - r.z * 3.5, x2 - r.x * 3.5, z2 - r.z * 3.5, 0.14, 0xffffff);
      w.line(x1 + r.x * 6.7, z1 + r.z * 6.7, x2 + r.x * 6.7, z2 + r.z * 6.7, 0.15, 0xffffff);
      w.line(x1 - r.x * 6.7, z1 - r.z * 6.7, x2 - r.x * 6.7, z2 - r.z * 6.7, 0.15, 0xffffff);
    }
    // 南入口: 让行标线 + 方向箭头
    w.yieldMark(3.5, 23.5, Math.PI, 6.5);
    w.arrow(3.5, 70, 180, 'straight', 1.0);
    w.arrow(-3.5, 70, 180, 'straight', 1.0);
    w.arrow(-70, -3.5, 0, 'straight', 1.0);
    w.arrow(70, 3.5, 0, 'straight', 1.0);
    w.sign([{ t: '环形交叉', fs: 48 }, { t: '第三出口驶出', fs: 30 }], -10, 45, 180, 3.0, { blue: true, w: 2.6, h: 2.0 });
    // 环岛内 AI 车辆 (逆时针)
    s.circ = [];
    for (let k = 0; k < 3; k++) {
      const c = new Car([0x4a6da8, 0xb0392e, 0x3f7f5f][k]);
      api.scene.add(c.group);
      const path = [];
      const n = 26;
      for (let i = 0; i < n; i++) {
        const phi = 90 * D2R - (i / n) * TAU;
        path.push({ x: Math.cos(phi) * R, z: Math.sin(phi) * R });
      }
      c.setAI(path, 8, { loop: true, closed: true });
      c.aiIdx = k * 8;
      const wp = path[k * 8], wn = path[(k * 8 + 1) % path.length];
      c.x = wp.x; c.z = wp.z; c.heading = headingTo(wp.x, wp.z, wn.x, wn.z); c.syncMesh();
      api.aiCars.push(c);
      s.circ.push(c);
    }
    (function scenery() {
      for (let i = 0; i < 34; i++) {
        const ang = (i / 34) * TAU + Math.random() * 0.15;
        const rr = 30 + Math.random() * 60;
        const tx = Math.cos(ang) * rr, tz = Math.sin(ang) * rr;
        if (Math.abs(tx) < 12 || Math.abs(tz) < 12) continue;  // 避开四条岔路
        w.tree(tx, tz, 0.8 + Math.random() * 0.8);
      }
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU + 0.3;
        const rr = 55 + Math.random() * 45;
        const bx = Math.cos(ang) * rr, bz = Math.sin(ang) * rr;
        if (Math.abs(bx) < 16 || Math.abs(bz) < 16) continue;
        w.building(bx, bz, 14 + Math.random() * 10, 12 + Math.random() * 8, 12 + Math.random() * 22, 0, ['#8a94a3', '#9aa5b1', '#7e8a99', '#a3aab5'][i % 4]);
      }
    })();
    api.car.setPose(0, 75, 180);
    api.car.speed = 10; api.car.gear = 'D';
  },
  steps: [
    {
      name: '接近环岛减速', tip: api => `提前减速观察（环岛限速40km/h，当前 ${kmh(Math.abs(api.car.speed)).toFixed(0)}km/h）`,
      check: api => api.car.z < 48 && kmh(Math.abs(api.car.speed)) < 42 && api.car.z > 23
    },
    {
      name: '让行后驶入环岛', tip: () => '环岛内车辆优先！观察左后方来车，确认安全空隙后驶入。',
      check: api => Math.hypot(api.car.x, api.car.z) < 19
    },
    {
      name: '沿环岛行驶', tip: () => '沿环道右侧（外圈）逆时针行驶，依次通过第一、第二出口。',
      check: api => api.s.traveled > 170 * D2R
    },
    { name: '开启右转向灯', tip: () => '即将到达第三出口（西出口），按 E 提前开启右转向灯！', check: api => api.car.blinker === 'R' && api.s.traveled > 185 * D2R },
    {
      name: '从第三出口驶出', tip: () => '开启右灯后，沿切线方向驶出西出口。',
      check: api => Math.hypot(api.car.x, api.car.z) > 22 && Math.abs(angNorm(Math.atan2(api.car.z, api.car.x) - 180 * D2R)) < 45 * D2R
    },
    {
      name: '驶离环岛', tip: () => '驶出后关闭转向灯，沿右侧车道正常行驶。',
      check: api => api.car.x < -40 && api.car.blinker === null
    }
  ],
  update(api, dt) {
    const c = api.car, s = api.s;
    const r = Math.hypot(c.x, c.z);
    const phi = Math.atan2(c.z, c.x);
    if (s.phi !== null) s.traveled -= angNorm(phi - s.phi);
    s.phi = phi;
    if (kmh(Math.abs(c.speed)) > 45 && r < 30) api.addViolation('环岛内超速', 10, 4);
    // 入岛让行检测
    if (!s.entered && c.z < 23 && c.z > 14 && Math.abs(c.x) < 8) {
      s.entered = true;
      let nearest = 999;
      for (const a of s.circ) {
        const ad = angNorm(Math.atan2(a.z, a.x) - phi);
        if (ad > 0) nearest = Math.min(nearest, ad * s.R);   // 逆时针接近本入口的来车
      }
      if (nearest < 8) api.addViolation('未让行环岛内来车', 25, 6);
    }
    // 出岛打灯检测
    if (!s.exitCheck && r > 20.5 && r < 24 && s.traveled > 90 * D2R) {
      if (c.blinker !== 'R' && Math.abs(angNorm(phi - 180 * D2R)) < 60 * D2R) {
        api.addViolation('驶出环岛未提前开启右转向灯', 15, 6);
      }
      s.exitCheck = true;
    }
  }
};

/* =====================================================
 * 场景六: 可变车道 (左道 -Z)
 * ===================================================== */
const SCN_variableLane = {
  id: 'variableLane', name: '可变车道', ico: '🔀',
  desc: '通过设有可变导向车道的路口。可变车道（锯齿状标线）的行驶方向随上方车道信号变化，必须按信号指示的方向行驶。',
  tags: ['路口', '信号指示', '锯齿车道'],
  speedLimit: 60,
  rules: [
    '可变导向车道线为白色锯齿状斜线，车道内不施划固定导向箭头',
    '进入可变车道前，必须观察车道上方信号灯显示的行驶方向',
    '一旦进入可变车道，必须按信号指示的方向行驶，不得临时变更',
    '车道信号显示左转时只准左转，显示直行时只准直行',
    '转弯时注意观察对向车流和行人'
  ],
  brief: '目标：驶入中间的可变车道，并根据锁定时的车道信号（左转/直行）通过路口。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(700);
    // 东行单向三车道: 左 -3.5 / 中 0(可变) / 右 +3.5
    w.asphalt(-40, 0, 280, 12.6, 0);       // x -180~100
    w.drive(-40, 0, 6.3, 140, 0);
    w.asphalt(55, 0, 92, 12.6, 0);         // 路口后 x 9~101
    w.drive(55, 0, 6.3, 46, 0);
    w.asphalt(0, 0, 14, 280, 0);         // 南北向道路
    w.drive(0, 0, 140, 7, 0);
    // 横向道路中线与车道线
    w.doubleYellow(0, -140, 0, -8.2); w.doubleYellow(0, 8.2, 0, 140);
    w.dashed(3.5, -140, 3.5, -8.2, 0.14, 0xffffff); w.dashed(3.5, 8.2, 3.5, 140, 0.14, 0xffffff);
    w.dashed(-3.5, -140, -3.5, -8.2, 0.14, 0xffffff); w.dashed(-3.5, 8.2, -3.5, 140, 0.14, 0xffffff);
    // 主路标线
    w.line(-180, -6.3, -8.2, -6.3, 0.18, 0xffffff); w.line(-180, 6.3, -8.2, 6.3, 0.18, 0xffffff);
    w.forbid(-180, -6.3, -8.2, -6.3); w.forbid(-180, 6.3, -8.2, 6.3);
    w.line(8.2, -6.3, 100, -6.3, 0.18, 0xffffff); w.line(8.2, 6.3, 100, 6.3, 0.18, 0xffffff);
    w.forbid(8.2, -6.3, 100, -6.3); w.forbid(8.2, 6.3, 100, 6.3);
    w.dashed(-180, -3.15, -102, -3.15, 0.15, 0xffffff);
    w.dashed(-180, 3.15, -102, 3.15, 0.15, 0xffffff);
    w.dashed(8.2, -3.15, 100, -3.15, 0.15, 0xffffff);
    w.dashed(8.2, 3.15, 100, 3.15, 0.15, 0xffffff);
    // 可变车道锯齿线 (中车道两侧, x -102 ~ -12)
    w.fishbone(-102, -1.75, -12, -1.75, 1);
    w.fishbone(-102, 1.75, -12, 1.75, -1);
    // 固定车道箭头
    for (const x of [-160, -130, -100, -70, -40]) {
      w.arrow(x, -3.5, 90, 'left', 1.0);
      w.arrow(x, 3.5, 90, 'straight', 1.0);
    }
    for (const x of [30, 60, 90]) {
      w.arrow(x, -3.5, 90, 'left', 1.0);
      w.arrow(x, 0, 90, 'left', 1.0);
      w.arrow(x, 3.5, 90, 'straight', 1.0);
    }
    // 停止线 + 人行横道
    w.line(-8, -6.3, -8, 6.3, 0.4, 0xffffff);
    w.zebra(-11.5, 0, 3.2, 12.6, 0);
    w.zebra(11.5, 0, 3.2, 12.6, 0);
    w.zebra(0, -11.5, 3, 12.6, Math.PI / 2);
    w.zebra(0, 11.5, 3, 12.6, Math.PI / 2);
    // 可变信号
    s.phase = 'left'; s.timer = 0; s.locked = null;
    s.texLeft = signTex([{ t: '↰', fs: 90, c: '#ffd24a' }], { led: true });
    s.texStraight = signTex([{ t: '↑', fs: 90, c: '#ffd24a' }], { led: true });
    const blueLeft = signTex([{ t: '↰' }], { blue: true });
    const blueStraight = signTex([{ t: '↑' }], { blue: true });
    s.gantry = w.gantry(-55, 0, 90, [
      { offsetX: -3.5, w: 1.7, h: 1.5, tex: blueLeft },
      { offsetX: 0, w: 1.7, h: 1.5, tex: s.texLeft, led: true },
      { offsetX: 3.5, w: 1.7, h: 1.5, tex: blueStraight }
    ]);
    s.gantry2 = w.gantry(-20, 0, 90, [
      { offsetX: -3.5, w: 1.7, h: 1.5, tex: blueLeft },
      { offsetX: 0, w: 1.7, h: 1.5, tex: s.texLeft, led: true },
      { offsetX: 3.5, w: 1.7, h: 1.5, tex: blueStraight }
    ]);
    w.sign([{ t: '可变车道', fs: 48 }, { t: '按车道信号行驶', fs: 28 }], -130, -10, 90, 3.0, { blue: true, w: 3.0, h: 2.0 });
    // 横向道路车流: 北行 x=+3.5(h=180), 南行 x=-3.5(h=0)
    const aiN = new Car(0x8f9bb0); api.scene.add(aiN.group);
    aiN.setAI([{ x: 3.5, z: -130, h: 180 }, { x: 3.5, z: 130, h: 180 }], 12, { loop: true });
    api.aiCars.push(aiN);
    const aiS = new Car(0x4a6da8); api.scene.add(aiS.group);
    aiS.setAI([{ x: -3.5, z: 130, h: 0 }, { x: -3.5, z: -130, h: 0 }], 12, { loop: true });
    api.aiCars.push(aiS);
    dressRoadside(w, -180, -14, 100, -14, 5, { buildings: true });
    dressRoadside(w, -180, 14, 100, 14, 5, { buildings: true });
    api.car.setPose(-160, 0, 90);
    api.car.speed = 11; api.car.gear = 'D';
  },
  steps: [
    {
      name: '观察可变车道信号', tip: api => `注意前方龙门架中间车道的信号（当前: ${api.s.phase === 'left' ? '左转 ↰' : '直行 ↑'}，每15秒切换）`,
      check: api => api.car.x > -95
    },
    {
      name: '按信号驶入可变车道', tip: api => api.s.locked ? `信号已锁定: ${api.s.locked === 'left' ? '左转' : '直行'}。驶入中间可变车道。` : '驶入中间可变车道（锯齿线车道），信号即将锁定!',
      check: api => Math.abs(api.car.z) < 1.7 && api.car.x > -35 && api.car.x < -10
    },
    {
      name: '按指示方向通过路口', tip: api => api.s.locked === 'left' ? '信号指示左转：开启左转向灯，减速向左转弯通过路口。' : '信号指示直行：保持车道直行通过路口。',
      check: api => api.s.locked === 'left'
        ? (api.car.z < -18 && angDiff(api.car.heading, 180 * D2R) < 45 * D2R)
        : (api.car.x > 30 && Math.abs(api.car.z) < 2.4)
    },
    { name: '完成通过', tip: () => '按信号指示方向通过路口即完成训练。', check: api => api.s.passed }
  ],
  update(api, dt) {
    const c = api.car, s = api.s;
    s.timer += dt;
    if (kmh(c.speed) > 65) api.addViolation('超速行驶（限速60km/h）', 10, 4);
    if (!s.locked) {
      if (s.timer > 15) { s.timer = 0; s.phase = s.phase === 'left' ? 'straight' : 'left'; }
      if (c.x > -28) s.locked = s.phase;
    }
    const tex = s.phase === 'left' ? s.texLeft : s.texStraight;
    setLedTex(s.gantry, tex); setLedTex(s.gantry2, tex);
    if (!s.passed) {
      if (s.locked === 'left' && c.x > 2 && c.x < 12 && Math.abs(c.z) < 3.2 && !s.vStraight) {
        s.vStraight = true; api.addViolation('可变车道指示左转，却直行通过', 30, 8);
      }
      if (s.locked === 'straight' && c.z < -12 && !s.vLeft) {
        s.vLeft = true; api.addViolation('可变车道指示直行，却左转通过', 30, 8);
      }
    }
    if ((s.locked === 'left' && c.z < -18) || (s.locked === 'straight' && c.x > 30 && Math.abs(c.z) < 2.4)) s.passed = true;
  }
};

/* =====================================================
 * 场景七: 潮汐车道 (东行普通车道 +Z 侧)
 * ===================================================== */
const SCN_tidal = {
  id: 'tidal', name: '潮汐车道', ico: '🌊',
  desc: '通过设有潮汐车道的城市干道。潮汐车道（双黄虚线内侧）根据早晚车流切换通行方向，必须按潮汐信号灯指示驶入或驶离。',
  tags: ['潮汐车道', '信号灯', '双黄虚线'],
  speedLimit: 60,
  rules: [
    '潮汐车道两侧为双黄色虚线，车道方向随交通流量时段切换',
    '潮汐车道信号灯显示绿色向下箭头时，允许本方向驶入',
    '信号灯显示红色叉形时禁止驶入；已驶入的应及时驶离',
    '驶入/驶出潮汐车道需开启相应转向灯，并注意对向车流',
    '潮汐车道内不得停车、掉头'
  ],
  brief: '目标：观察潮汐车道信号——初始红灯禁止驶入；变绿后开左灯驶入；前方信号变红时及时驶回普通车道。',
  setup(api) {
    const w = api.world, s = api.s;
    w.ground(700);
    // 西行 z<0, 东行 z>0; 潮汐车道 z=0 (±1.75 双黄虚线)
    w.asphalt(-40, 0, 340, 21, 0);
    w.drive(-40, 0, 10.5, 170, 0);
    w.line(-210, -10.5, 130, -10.5, 0.18, 0xffffff);
    w.line(-210, 10.5, 130, 10.5, 0.18, 0xffffff);
    w.forbid(-210, -10.5, 130, -10.5); w.forbid(-210, 10.5, 130, 10.5);
    w.dashed(-210, -5.25, 130, -5.25, 0.15, 0xffffff);
    w.dashed(-210, 5.25, 130, 5.25, 0.15, 0xffffff);
    w.doubleYellowDash(-210, -1.75, 130, -1.75);
    w.doubleYellowDash(-210, 1.75, 130, 1.75);
    for (const x of [-190, -150, -110, -70, -30, 10, 50, 90]) {
      w.arrow(x, 3.5, 90, 'straight', 1.0);
      w.arrow(x, 7, 90, 'straight', 1.0);
      w.arrow(x, -3.5, 270, 'straight', 1.0);
      w.arrow(x, -7, 270, 'straight', 1.0);
    }
    s.open = false; s.closed = false;
    s.signalTexRed = laneSignalTex('red');
    s.signalTexGreen = laneSignalTex('green');
    s.gantries = [];
    const laneGreen = laneSignalTex('green');
    for (const gx of [-150, -70, 10]) {
      const g = w.gantry(gx, 0, 90, [
        { offsetX: 0, w: 1.5, h: 1.5, tex: s.signalTexRed, led: true, y: 5.4 },
        { offsetX: 3.5, w: 1.5, h: 1.5, tex: laneGreen, y: 5.4 },
        { offsetX: 7, w: 1.5, h: 1.5, tex: laneGreen, y: 5.4 }
      ]);
      s.gantries.push(g);
    }
    w.sign([{ t: '潮汐车道', fs: 52 }, { t: '按信号灯指示行驶', fs: 26 }], -185, -13, 90, 3.2, { blue: true, w: 3.4, h: 2.2 });
    // 对向车流 (西行, 正常车道)
    for (const [x0, lane, spd] of [[60, -3.5, 12], [130, -7, 11]]) {
      const c = new Car([0x8f9bb0, 0x4a6da8][x0 > 100 ? 1 : 0]); api.scene.add(c.group);
      c.setAI([{ x: x0, z: lane, h: 270 }, { x: -260, z: lane, h: 270 }], spd, { loop: true });
      api.aiCars.push(c);
    }
    s.oncoming = null;
    dressRoadside(w, -210, -16, 130, -16, 5, { buildings: true });
    dressRoadside(w, -210, 16, 130, 16, 5, { buildings: true });
    api.car.setPose(-190, 3.5, 90);
    api.car.speed = 12; api.car.gear = 'D';
  },
  steps: [
    { name: '观察潮汐车道信号', tip: api => api.s.open ? '信号已变绿！' : '当前潮汐车道信号为红色（禁止驶入），先沿普通车道行驶。', check: api => api.car.x > -140 },
    { name: '开启左转向灯', tip: () => '潮汐车道信号变为绿色箭头，准备驶入。按 Q 开启左转向灯。', check: api => api.s.open && api.car.blinker === 'L' },
    { name: '驶入潮汐车道', tip: () => '确认对向无来车后，平顺驶入潮汐车道（中间车道）。', check: api => api.s.open && Math.abs(api.car.z) < 1.7 && api.car.x > -120 },
    { name: '潮汐车道内行驶', tip: () => '保持车速沿潮汐车道行驶，注意观察前方信号灯变化。', check: api => Math.abs(api.car.z) < 1.7 && api.car.x > -20 },
    { name: '信号变红—开启右转向灯', tip: () => '⚠ 前方潮汐车道信号变为红色叉形！按 E 开启右转向灯，准备驶回右侧普通车道。', check: api => api.s.closed && api.car.blinker === 'R' },
    {
      name: '及时驶回普通车道', tip: api => api.car.z > 1.9 ? '已驶回普通车道。' : '尽快驶回右侧普通车道！对向车流即将进入潮汐车道！',
      check: api => api.s.closed && api.car.z > 1.9 && api.car.x < 72
    },
    { name: '通过潮汐路段', tip: () => '保持正常行驶，通过潮汐车道路段。', check: api => api.car.x > 85 }
  ],
  update(api, dt) {
    const c = api.car, s = api.s;
    if (kmh(c.speed) > 65) api.addViolation('超速行驶（限速60km/h）', 10, 4);
    if (!s.open && c.x > -125) {
      s.open = true;
      api.toast('潮汐车道信号：绿色↓ 允许驶入', 'info');
      s.gantries.forEach(g => setLedTex(g, s.signalTexGreen));
    }
    if (s.open && !s.closed && c.x > 25) {
      s.closed = true;
      api.toast('⚠ 潮汐车道信号变红：请立即驶回普通车道！', 'err');
      s.gantries.forEach(g => setLedTex(g, s.signalTexRed));
      const oc = new Car(0xb0392e); api.scene.add(oc.group);
      oc.setAI([{ x: 150, z: 0, h: 270 }, { x: -260, z: 0, h: 270 }], 13);
      api.aiCars.push(oc); s.oncoming = oc;
    }
    if (!s.open && c.x > -122 && Math.abs(c.z) < 1.7 && !s.vRedIn) {
      s.vRedIn = true; api.addViolation('潮汐车道信号为红，违规驶入', 30, 8);
    }
    if (s.closed && c.x > 75 && Math.abs(c.z) < 1.75 && !s.vStay) {
      s.vStay = true; api.addViolation('潮汐车道已关闭仍占用（对向车流已进入！）', 35, 10);
    }
  }
};

/* ---------- 场景清单 ---------- */
const SCENARIOS = [SCN_reverseBay, SCN_parallel, SCN_overtake, SCN_merge, SCN_roundabout, SCN_variableLane, SCN_tidal];
