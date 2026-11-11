/* =====================================================
 * main.js - 新手驾驶员指导系统 主程序
 * ===================================================== */
(function () {
  'use strict';

  /* ---------- 渲染器与场景 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('app').appendChild(renderer.domElement);
  renderer.domElement.id = 'view';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb8e0);
  scene.fog = new THREE.Fog(0xa8c6e6, 160, 700);

  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5a6647, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);

  const perspCam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  const topCam = new THREE.OrthographicCamera(-60, 60, 60, -60, 1, 400);
  const CAM_MODES = ['chase', 'top', 'hood'];
  const CAM_NAMES = { chase: '第三人称追尾视角', top: '俯视图（鸟瞰）', hood: '驾驶舱视角' };
  let camMode = 0;

  /* ---------- 玩家车辆 ---------- */
  const car = new Car(0xc23b2e);
  scene.add(car.group);

  /* ---------- 音效 (WebAudio 合成) ---------- */
  const AudioSys = {
    ctx: null, engineOsc: null, engineGain: null, started: false,
    init() {
      if (this.started) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 320;
        this.engineOsc.connect(this.engineGain); this.engineGain.connect(lp); lp.connect(this.ctx.destination);
        this.engineOsc.start();
        this.started = true;
      } catch (e) { /* 无音频 */ }
    },
    engine(speed, throttle) {
      if (!this.started) return;
      const f = 52 + Math.abs(speed) * 7 + throttle * 18;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.018 + throttle * 0.03 + Math.min(Math.abs(speed) * 0.0012, 0.02), this.ctx.currentTime, 0.1);
    },
    beep(freq, dur, type, vol) {
      if (!this.started) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.15));
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + (dur || 0.15) + 0.02);
    },
    ok() { this.beep(660, 0.12, 'sine', 0.1); setTimeout(() => this.beep(880, 0.18, 'sine', 0.1), 110); },
    err() { this.beep(180, 0.3, 'square', 0.08); },
    blink() { this.beep(720, 0.05, 'square', 0.03); },
    crash() { this.beep(90, 0.35, 'sawtooth', 0.2); this.beep(60, 0.4, 'square', 0.15); }
  };

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);
  const el = {
    menu: $('menu'), cards: $('menuCards'), brief: $('brief'), briefBox: $('briefBox'),
    hud: $('hud'), stepBar: $('stepBar'), stepTitle: $('stepTitle'), stepTip: $('stepTip'), stepProg: $('stepProg'),
    stepList: $('stepList'), speedV: $('speedV'), gearD: $('gearD'), gearR: $('gearR'),
    blinkL: $('blinkL'), blinkR: $('blinkR'), scoreV: $('scoreV'), violList: $('violList'),
    toast: $('toast'), result: $('result'), flash: $('flash'), sceneTitle: $('sceneTitle'), camName: $('camName')
  };

  /* ---------- 全局状态 ---------- */
  const G = {
    scenario: null, world: null, s: {}, t: 0,
    stepIdx: 0, score: 100, violations: [], violCool: {}, finished: false,
    aiCars: [], keys: {}, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(),
    sHold: 0, crashCool: 0, offroadCool: 0, lastStepDoneAt: 0, startAt: 0
  };

  const api = {
    car, scene, get s() { return G.s; }, get t() { return G.t; },
    get world() { return G.world; },
    aiCars: G.aiCars,
    toast(text, type) { toast(text, type); },
    addViolation(text, penalty, cooldownSec) {
      const cd = (cooldownSec || 4) * 1000, now = performance.now();
      if (G.violCool[text] && now - G.violCool[text] < cd) return;
      G.violCool[text] = now;
      G.score = Math.max(0, G.score - (penalty || 10));
      G.violations.push({ text, penalty: penalty || 10 });
      refreshScore();
      toast('✕ ' + text + '（-' + (penalty || 10) + '分）', 'err');
      AudioSys.err();
    }
  };

  function toast(text, type) {
    const d = document.createElement('div');
    d.className = 'toastItem ' + (type || 'info');
    d.textContent = text;
    el.toast.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; }, 2200);
    setTimeout(() => d.remove(), 2700);
  }

  function refreshScore() {
    el.scoreV.textContent = G.score;
    el.scoreV.className = 'val' + (G.score < 80 ? ' bad' : '');
    el.violList.innerHTML = G.violations.length
      ? G.violations.map(v => `<div class="v">✕ ${v.text}（-${v.penalty}）</div>`).join('')
      : '<div class="empty">暂无违规，继续保持！</div>';
  }

  /* ---------- 场景加载 ---------- */
  function clearScenario() {
    if (G.world) G.world.dispose();
    for (const c of G.aiCars) scene.remove(c.group);
    G.aiCars.length = 0;
  }
  function loadScenario(def) {
    clearScenario();
    G.scenario = def; G.s = {}; G.t = 0;
    G.stepIdx = 0; G.score = 100; G.violations = []; G.violCool = {};
    G.finished = false; G.sHold = 0; G.crashCool = 0; G.startAt = performance.now();
    G.world = new WorldBuilder(scene);
    worldChecker.fn = null;
    def.setup(api);
    buildStepList();
    el.sceneTitle.querySelector('.n').textContent = def.ico + ' ' + def.name;
    el.sceneTitle.querySelector('.m').textContent = '限速 ' + def.speedLimit + ' km/h · 按中国交规';
    el.menu.classList.remove('show'); el.menu.style.display = 'none';
    el.result.classList.remove('show');
    el.hud.classList.add('show');
    refreshScore();
    toast('开始训练：' + def.name, 'info');
    // 相机初始位置
    const f = fwd(car.heading);
    G.camPos.set(car.x - f.x * 9, 5, car.z - f.z * 9);
  }
  function restart() { if (G.scenario) loadScenario(G.scenario); }

  function buildStepList() {
    el.stepList.innerHTML = '<div class="tt">训练步骤</div>' + G.scenario.steps.map((st, i) =>
      `<div class="st" id="stp${i}"><div class="dot">${i + 1}</div><div>${st.name}</div></div>`).join('');
    updateStepUI();
  }
  function updateStepUI() {
    G.scenario.steps.forEach((st, i) => {
      const d = $('stp' + i);
      if (!d) return;
      d.className = 'st' + (i < G.stepIdx ? ' done' : i === G.stepIdx ? ' cur' : '');
      if (i < G.stepIdx) d.querySelector('.dot').textContent = '✓';
    });
    const pct = Math.round(G.stepIdx / G.scenario.steps.length * 100);
    el.stepProg.style.width = pct + '%';
  }

  function finishScenario() {
    G.finished = true;
    const pass = G.score >= 80;
    const dur = Math.round((performance.now() - G.startAt) / 1000);
    $('resIco').textContent = pass ? '🎉' : '😔';
    $('resTitle').textContent = pass ? '训练通过！' : '训练未通过';
    $('resScore').textContent = G.score;
    $('resScore').style.color = pass ? '#6fe08a' : '#ff7a6a';
    $('resStats').innerHTML =
      `完成步骤：${G.stepIdx}/${G.scenario.steps.length}　·　用时 ${Math.floor(dur / 60)}分${dur % 60}秒<br>` +
      (G.violations.length ? `违规 ${G.violations.length} 次：${G.violations.map(v => v.text).join('；')}` : '全程无违规，非常棒！');
    el.result.classList.add('show');
    if (pass) { AudioSys.ok(); toast('训练完成！得分 ' + G.score, 'ok'); }
    else AudioSys.err();
  }

  /* ---------- 菜单 ---------- */
  function buildMenu() {
    el.cards.innerHTML = SCENARIOS.map((sc, i) =>
      `<div class="card" data-i="${i}">
        <div class="no">0${i + 1}</div>
        <div class="ico">${sc.ico}</div>
        <h3>${sc.name}</h3>
        <p>${sc.desc}</p>
        <div class="tags">${sc.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>`).join('');
    el.cards.querySelectorAll('.card').forEach(c => {
      c.onclick = () => showBrief(SCENARIOS[+c.dataset.i]);
    });
  }
  function showBrief(def) {
    el.briefBox.innerHTML = `
      <h2>${def.ico} ${def.name}</h2>
      <div class="desc">${def.brief}</div>
      <h4>📋 交规要点</h4>
      <ul>${def.rules.map(r => `<li>${r}</li>`).join('')}</ul>
      <h4>⌨️ 操作方式</h4>
      <ul>
        <li><b>W/S</b> 油门 / 刹车（停稳后长按 S 挂倒挡，倒挡中 S 后退、W 刹停）</li>
        <li><b>A/D</b> 转向　<b>Q/E</b> 左/右转向灯　<b>空格</b> 手刹</li>
        <li><b>C</b> 切换视角（追尾 / 俯视 / 驾驶舱）　<b>R</b> 重新开始　<b>Esc</b> 返回菜单</li>
      </ul>
      <div class="btns">
        <button class="btn primary" id="btnStart">🚗 开始训练</button>
        <button class="btn ghost" id="btnBack">返回</button>
      </div>`;
    el.brief.classList.add('show');
    $('btnStart').onclick = () => { AudioSys.init(); loadScenario(def); };
    $('btnBack').onclick = () => el.brief.classList.remove('show');
  }

  /* ---------- 输入 ---------- */
  window.addEventListener('keydown', e => {
    AudioSys.init();
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    G.keys[k] = true;
    if (k === 'escape') { backToMenu(); }
    if (k === 'r' && G.scenario && !G.finished) restart();
    if (k === 'c') { camMode = (camMode + 1) % CAM_MODES.length; el.camName.textContent = CAM_NAMES[CAM_MODES[camMode]]; }
    if (k === 'q') { car.setBlinker(car.blinker === 'L' ? null : 'L'); AudioSys.blink(); }
    if (k === 'e') { car.setBlinker(car.blinker === 'R' ? null : 'R'); AudioSys.blink(); }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { G.keys = {}; });

  function backToMenu() {
    clearScenario();
    G.scenario = null;
    el.hud.classList.remove('show');
    el.result.classList.remove('show');
    el.brief.classList.remove('show');
    el.menu.style.display = 'block';
  }

  /* ---------- 每帧逻辑 ---------- */
  function buildInput(dt) {
    const k = G.keys;
    const up = k['w'] || k['arrowup'], down = k['s'] || k['arrowdown'];
    const left = k['a'] || k['arrowleft'], right = k['d'] || k['arrowright'];
    // 挡位切换
    if (Math.abs(car.speed) < 0.15) {
      if (down) G.sHold += dt; else G.sHold = 0;
      if (G.sHold > 0.35 && car.gear !== 'R') { car.gear = 'R'; G.sHold = 1; toast('已挂入倒挡 R', 'info'); }
      if (up && car.gear === 'R') { car.gear = 'D'; toast('已挂入前进挡 D', 'info'); }
    } else G.sHold = 0;
    if (car.gear === 'N' && up) car.gear = 'D';
    let throttle = 0, brake = 0;
    if (car.gear === 'R') { throttle = down ? 1 : 0; brake = up ? 1 : 0; }
    else { throttle = up ? 1 : 0; brake = down ? 1 : 0; }
    let steer = 0;
    if (right) steer -= 1;   // D = 右转(负 steer)
    if (left) steer += 1;
    return { throttle, brake, steer, handbrake: k[' '] };
  }

  const worldChecker = { fn: null };
  function checkCollisions() {
    if (!worldChecker.fn) worldChecker.fn = createWorldChecker(car, G.world, G.aiCars);
    worldChecker.fn(api.addViolation, () => {
      AudioSys.crash();
      el.flash.style.opacity = '1';
      setTimeout(() => el.flash.style.opacity = '0', 250);
    });
  }

  function updateHUD() {
    el.speedV.textContent = Math.round(Math.abs(kmh(car.speed)));
    el.gearD.className = 'g' + (car.gear === 'D' ? ' on' : '');
    el.gearR.className = 'g' + (car.gear === 'R' ? ' on rOn' : '');
    const blinkOn = Math.floor(car._blinkT * 1.6) % 2 === 0;
    el.blinkL.className = 'bl' + (car.blinker === 'L' && blinkOn ? ' on' : '');
    el.blinkR.className = 'bl' + (car.blinker === 'R' && blinkOn ? ' on' : '');
    // 当前步骤
    if (!G.finished && G.scenario) {
      const st = G.scenario.steps[G.stepIdx];
      if (st) {
        el.stepTitle.textContent = `第 ${G.stepIdx + 1}/${G.scenario.steps.length} 步：${st.name}`;
        el.stepTip.textContent = st.tip ? st.tip(api) : '';
      }
    }
  }

  function updateCamera(dt) {
    const f = fwd(car.heading);
    const mode = CAM_MODES[camMode];
    if (mode === 'chase') {
      const back = 8.5 + Math.min(Math.abs(car.speed) * 0.12, 2.5);
      const tx = car.x - f.x * back, tz = car.z - f.z * back, ty = 4.4;
      const t = 1 - Math.pow(0.0015, dt);
      G.camPos.x = lerp(G.camPos.x, tx, t);
      G.camPos.y = lerp(G.camPos.y, ty, t);
      G.camPos.z = lerp(G.camPos.z, tz, t);
      perspCam.position.copy(G.camPos);
      perspCam.lookAt(car.x + f.x * 8, 1.2, car.z + f.z * 8);
    } else if (mode === 'hood') {
      perspCam.position.set(car.x + f.x * 0.4, 1.42, car.z + f.z * 0.4);
      perspCam.lookAt(car.x + f.x * 30, 1.1, car.z + f.z * 30);
    } else {
      const view = 46;
      const asp = window.innerWidth / window.innerHeight;
      topCam.left = -view * asp; topCam.right = view * asp;
      topCam.top = view; topCam.bottom = -view;
      topCam.position.set(car.x, 150, car.z);
      topCam.up.set(f.x, 0, f.z);
      topCam.lookAt(car.x, 0, car.z);
      topCam.updateProjectionMatrix();
    }
    // 太阳跟随(保证阴影)
    sun.position.set(car.x + 60, 110, car.z + 45);
    sun.target.position.set(car.x, 0, car.z);
    sun.target.updateMatrixWorld();
  }

  /* ---------- 主循环 ---------- */
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    last = now;
    if (!G.scenario) { return; }
    G.t += dt;

    const input = buildInput(dt);
    const onRoad = !G.world.drivables.length || G.world.isDrivable(car.x, car.z);
    car.updatePlayer(dt, input, onRoad);
    for (const a of G.aiCars) a.updateAI(dt);

    // 步骤推进
    if (!G.finished) {
      const st = G.scenario.steps[G.stepIdx];
      if (st) {
        let ok = false;
        try { ok = !!st.check(api); } catch (e) { console.error(e); }
        if (ok) {
          G.stepIdx++;
          AudioSys.ok();
          toast('✓ ' + st.name + ' 完成', 'ok');
          updateStepUI();
          if (G.stepIdx >= G.scenario.steps.length) finishScenario();
        }
      }
      if (G.scenario.update) {
        try { G.scenario.update(api, dt); } catch (e) { console.error(e); }
      }
      checkCollisions();
    }

    AudioSys.engine(car.speed, input.throttle);
    updateHUD();
    updateCamera(dt);
    renderer.render(scene, CAM_MODES[camMode] === 'top' ? topCam : perspCam);
  }

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    perspCam.aspect = window.innerWidth / window.innerHeight;
    perspCam.updateProjectionMatrix();
  });

  /* ---------- 启动 ---------- */
  buildMenu();
  el.menu.style.display = 'block';
  $('btnMenu').onclick = () => backToMenu();
  window.__restart = restart; window.__menu = backToMenu; window.__car = car;
  // 自动化测试支持: ?auto=<场景id>
  window.addEventListener('error', e => { console.error('PAGE_ERROR: ' + e.message + ' @' + (e.filename || '') + ':' + (e.lineno || '')); });
  (function () {
    const qs = new URLSearchParams(location.search);
    const id = qs.get('auto');
    if (!id) return;
    const def = SCENARIOS.find(s => s.id === id);
    if (!def) { console.error('AUTO: scenario not found ' + id); return; }
    console.log('AUTO: loading ' + id);
    loadScenario(def);
    const cam = qs.get('cam');
    if (cam === 'top') { camMode = 1; el.camName.textContent = CAM_NAMES.top; }
    if (cam === 'hood') { camMode = 2; el.camName.textContent = CAM_NAMES.hood; }
    if (!qs.get('still')) G.keys['w'] = true;   // still=1: 静止截图模式
    setInterval(() => console.log(`AUTO: t=${G.t.toFixed(1)} step=${G.stepIdx}/${def.steps.length} pos=(${car.x.toFixed(1)},${car.z.toFixed(1)}) h=${(car.heading / D2R).toFixed(0)} v=${car.speed.toFixed(1)} score=${G.score}`), 1000);
  })();
  requestAnimationFrame(loop);
})();
