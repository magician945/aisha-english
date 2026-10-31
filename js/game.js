/* =========================================================
 * 爱莎英语 · 字母港 Alphabet Harbor — 可玩原型（M0 · Sprint 1）
 * 引擎：Babylon.js（本地 vendor，离线可用）
 * 课程循环：听音 → 点对应字母方块 → 鼓励/低挫败反馈 → 金币
 *           → 3 轮结算（方块奖励 + 宠物蛋彩蛋）
 * 设计铁律（与架构方案 3.5 一致）：
 *   奖励只绑定学习行为 / 确定性奖励无开箱 / 鼓励努力不制造焦虑
 * ========================================================= */
(function () {
  'use strict';

  /* ---------------- 数据 ---------------- */
  var ROUNDS = [
    { letter: 'A', word: 'apple', cn: '苹果', ipa: '/æ/' },
    { letter: 'B', word: 'boat',  cn: '小船', ipa: '/b/' },
    { letter: 'C', word: 'crab',  cn: '螃蟹', ipa: '/k/' }
  ];
  var CHEERS = [
    { en: 'Great job!',  cn: '太棒了！' },
    { en: 'Super!',      cn: '超级棒！' },
    { en: 'You did it!', cn: '你做到了！' },
    { en: 'Awesome!',    cn: '真厉害！' },
    { en: 'Well done!',  cn: '完成得漂亮！' },
    { en: 'Amazing!',    cn: '太惊人了！' }
  ];
  var SOFT = [
    '再试一次，方块精灵相信你！',
    '差一点点，再试试！',
    '方块精灵给你加油！'
  ];

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 音效（WebAudio 合成，无音频文件） ---------------- */
  var AC = null, muted = false;
  function ac() {
    if (!AC) {
      var A = window.AudioContext || window.webkitAudioContext;
      if (A) AC = new A();
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, delay, type, vol) {
    if (muted) return;
    try {
      var ctx = ac(); if (!ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* 音频失败不阻塞游戏 */ }
  }
  var sndCorrect = function () { tone(659, .12, 0); tone(880, .14, .11); tone(1175, .22, .22); };
  var sndWrong   = function () { tone(233, .25, 0, 'triangle', .10); };
  var sndCoin    = function () { tone(1319, .07, 0, 'square', .06); tone(1760, .12, .07, 'square', .06); };

  /* ---------------- 发音（系统语音合成） ---------------- */
  function speak(text, lang) {
    if (muted || !('speechSynthesis' in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang || 'en-US';
      u.rate = 0.85; u.pitch = 1.05;
      var want = (lang || 'en-US').slice(0, 2).toLowerCase();
      var voices = window.speechSynthesis.getVoices() || [];
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].lang && voices[i].lang.toLowerCase().indexOf(want) === 0) { u.voice = voices[i]; break; }
      }
      window.speechSynthesis.speak(u);
    } catch (e) { /* TTS 失败不阻塞 */ }
  }
  if ('speechSynthesis' in window) {
    // 触发音色列表异步加载
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () {};
  }

  /* ---------------- 补间动画 ---------------- */
  var tweens = [];
  function anim(dur, step, done) { tweens.push({ t0: performance.now(), dur: dur, step: step, done: done }); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------------- 场景 ---------------- */
  var canvas = $('scene');
  var engine, scene, camera;
  var blocks = [];          // 字母方块
  var boat = null, clouds = [], water = null;

  function C(hex) { return BABYLON.Color3.FromHexString(hex); }

  function letterTexture(letter) {
    var dt = new BABYLON.DynamicTexture('tex-' + letter, 256, scene, true);
    var c = dt.getContext();
    c.fillStyle = '#79b03f'; c.fillRect(0, 0, 256, 256);
    var s = 11;
    var rnd = function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    for (var y = 0; y < 256; y += 16) {
      for (var x = 0; x < 256; x += 16) {
        if (rnd() < 0.16) { c.fillStyle = 'rgba(60,93,34,.32)'; c.fillRect(x, y, 16, 16); }
      }
    }
    c.strokeStyle = '#4c7a2f'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 246);
    c.fillStyle = '#ffffff';
    c.font = 'bold 152px "Segoe UI", "Microsoft YaHei", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(letter, 128, 142);
    dt.update();
    return dt;
  }

  function woodTexture() {
    var dt = new BABYLON.DynamicTexture('tex-wood', 256, scene, true);
    var c = dt.getContext();
    c.fillStyle = '#a97c50'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#8a6238';
    for (var y = 0; y < 256; y += 32) { c.fillRect(0, y, 256, 3); }
    var s = 5;
    var rnd = function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    for (var i = 0; i < 60; i++) {
      c.fillRect(rnd() * 256, rnd() * 256, 10 + rnd() * 20, 2);
    }
    dt.update();
    return dt;
  }

  function buildScene() {
    engine = new BABYLON.Engine(canvas, true, { stencil: false, antialias: true }, true);
    // 嵌入式 WebView / 自动化环境中 document.hidden 可能误报为隐藏，
    // 导致 Babylon 默认跳过渲染（矩阵全零、点击落空）——原型阶段强制后台继续渲染。
    engine.renderEvenInBackground = true;
    scene = new BABYLON.Scene(engine);
    scene.clearColor = BABYLON.Color4.FromHexString('#bfe3f2ff');

    camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 3.1, 1.08, 11, new BABYLON.Vector3(0, 0.7, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerBetaLimit = 0.55; camera.upperBetaLimit = 1.30;
    camera.lowerRadiusLimit = 7;  camera.upperRadiusLimit = 15;
    camera.wheelPrecision = 60;
    camera.panningSensibility = 0; // 关闭平移，孩子只旋转

    var hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0.3, 1, 0.2), scene);
    hemi.intensity = 0.85;
    var sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.45, -1, 0.35), scene);
    sun.intensity = 0.65;

    // 海面
    water = BABYLON.MeshBuilder.CreateGround('water', { width: 60, height: 60 }, scene);
    water.position.y = -0.55;
    var wMat = new BABYLON.StandardMaterial('wMat', scene);
    wMat.diffuseColor = C('#3f7fb5'); wMat.specularColor = C('#9fd0ea');
    wMat.specularPower = 48;
    water.material = wMat;

    // 木栈桥（码头）
    var dock = BABYLON.MeshBuilder.CreateBox('dock', { width: 9.5, height: 0.5, depth: 5.5 }, scene);
    dock.position.set(0, -0.25, 0.6);
    var dMat = new BABYLON.StandardMaterial('dMat', scene);
    dMat.diffuseTexture = woodTexture(); dMat.specularColor = C('#333333');
    dock.material = dMat;
    // 桥墩
    [[-4, 1.6], [-1.4, 3.1], [1.4, 3.1], [4, 1.6]].forEach(function (p, i) {
      var leg = BABYLON.MeshBuilder.CreateBox('leg' + i, { width: 0.45, height: 1.2, depth: 0.45 }, scene);
      leg.position.set(p[0], -0.85, p[1]);
      leg.material = dMat;
    });

    // 背景草坡（体素堆）
    var grassTop = new BABYLON.StandardMaterial('gT', scene); grassTop.diffuseColor = C('#6aa63b'); grassTop.specularColor = C('#222222');
    var dirt = new BABYLON.StandardMaterial('gD', scene); dirt.diffuseColor = C('#8a5a3b'); dirt.specularColor = C('#222222');
    var positions = [
      [-5.5, 0.5, -3.6], [-4.5, 0.5, -3.9], [-3.5, 0.5, -3.6], [-4.5, 1.5, -3.75],
      [4.2, 0.5, -4.1], [5.2, 0.5, -3.8], [4.7, 1.5, -3.95], [4.7, 2.5, -3.95],
      [-2.2, 0.5, -4.2], [2.9, 0.5, -4.3]
    ];
    positions.forEach(function (p, i) {
      var b = BABYLON.MeshBuilder.CreateBox('g' + i, { size: 1 }, scene);
      b.position.set(p[0], p[1], p[2]);
      b.material = (p[1] >= 1.5) ? grassTop : (i % 3 === 2 ? grassTop : dirt);
      // 顶面统一绿色：简单起见，最高层用草绿
      if (p[1] >= 1.5) b.material = grassTop;
    });

    // 灯塔
    var lhX = 5.2, lhZ = -3.6;
    var segs = [
      { h: 0.7, r: 0.75, col: '#e8e4da' }, { h: 0.7, r: 0.62, col: '#c9584a' },
      { h: 0.7, r: 0.5, col: '#e8e4da' }, { h: 0.6, r: 0.4, col: '#c9584a' }
    ];
    var ly = 0;
    segs.forEach(function (sg, i) {
      var m = BABYLON.MeshBuilder.CreateCylinder('lh' + i, { height: sg.h, diameterTop: sg.r * 2 * 0.92, diameterBottom: sg.r * 2, tessellation: 16 }, scene);
      m.position.set(lhX, ly + sg.h / 2, lhZ);
      var mm = new BABYLON.StandardMaterial('lhM' + i, scene); mm.diffuseColor = C(sg.col); mm.specularColor = C('#222222');
      m.material = mm; ly += sg.h;
    });
    var roof = BABYLON.MeshBuilder.CreateCylinder('roof', { diameterTop: 0, diameterBottom: 1.0, height: 0.55, tessellation: 12 }, scene);
    roof.position.set(lhX, ly + 0.27, lhZ);
    var roofM = new BABYLON.StandardMaterial('roofM', scene); roofM.diffuseColor = C('#8a4a3e'); roofM.specularColor = C('#222222');
    roof.material = roofM;

    // 小船
    boat = BABYLON.MeshBuilder.CreateBox('boat', { width: 1.7, height: 0.5, depth: 0.85 }, scene);
    boat.position.set(-4.6, 0.02, 3.2);
    var bMat = new BABYLON.StandardMaterial('bMat', scene); bMat.diffuseColor = C('#8a6238'); bMat.specularColor = C('#222222');
    boat.material = bMat;
    var sail = BABYLON.MeshBuilder.CreatePlane('sail', { width: 1.05, height: 1.15 }, scene);
    sail.parent = boat; sail.position.set(0.1, 0.95, 0);
    var sMat = new BABYLON.StandardMaterial('sMat', scene); sMat.backFaceCulling = false; sMat.diffuseColor = C('#f2efe6'); sMat.specularColor = C('#111111');
    sail.material = sMat;

    // 云
    var cloudMat = new BABYLON.StandardMaterial('cM', scene); cloudMat.diffuseColor = C('#ffffff'); cloudMat.specularColor = C('#111111'); cloudMat.disableLighting = true;
    [[-6, 6.2, -2], [3, 7.0, -4], [8, 6.4, 2]].forEach(function (p, i) {
      var cl = BABYLON.MeshBuilder.CreateBox('cl' + i, { width: 2.6, height: 0.7, depth: 1.2 }, scene);
      cl.position.set(p[0], p[1], p[2]); cl.material = cloudMat;
      clouds.push(cl);
    });

    // 字母方块（游戏主体）
    var defs = [
      { letter: 'A', x: -2.7, z: 0.9 },
      { letter: 'B', x: 0,    z: 0.2 },
      { letter: 'C', x: 2.7,  z: 1.0 }
    ];
    defs.forEach(function (d) {
      var m = BABYLON.MeshBuilder.CreateBox('blk-' + d.letter, { size: 1.5 }, scene);
      m.position.set(d.x, 1.05, d.z);
      var mat = new BABYLON.StandardMaterial('mat-' + d.letter, scene);
      mat.diffuseTexture = letterTexture(d.letter);
      mat.specularColor = C('#26301c');
      m.material = mat;
      m.metadata = { letter: d.letter, home: m.position.clone() };
      blocks.push(m);
    });
  }

  /* ---------------- 粒子（正确时的方块礼花） ---------------- */
  var burstMats = null;
  function ensureBurstMats() {
    if (burstMats) return;
    burstMats = ['#f2c14e', '#e86a5e', '#7fb241', '#5aa9d6'].map(function (hex) {
      var m = new BABYLON.StandardMaterial('pM' + hex, scene);
      m.diffuseColor = C(hex); m.specularColor = C('#111111'); m.emissiveColor = C(hex).scale(0.35);
      return m;
    });
  }
  function burst(pos) {
    ensureBurstMats();
    var parts = [];
    for (var i = 0; i < 16; i++) {
      var b = BABYLON.MeshBuilder.CreateBox('p', { size: 0.16 }, scene);
      b.position.copyFrom(pos);
      b.material = burstMats[i % burstMats.length];
      b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      parts.push({
        m: b,
        v: new BABYLON.Vector3((Math.random() - 0.5) * 4.2, 2.6 + Math.random() * 2.6, (Math.random() - 0.5) * 4.2),
        w: 4 + Math.random() * 5
      });
    }
    var obs = scene.onBeforeRenderObservable.add(function () {
      var dt = Math.min(0.05, engine.getDeltaTime() / 1000);
      parts.forEach(function (p) {
        p.v.y -= 9.8 * dt;
        p.m.position.addInPlace(p.v.scale(dt));
        p.m.rotation.x += p.w * dt; p.m.rotation.z += p.w * dt * 0.7;
      });
    });
    setTimeout(function () {
      scene.onBeforeRenderObservable.remove(obs);
      parts.forEach(function (p) { p.m.dispose(); });
    }, 1000);
  }

  /* ---------------- 游戏状态 ---------------- */
  var state = 'idle';   // idle | play | settle
  var round = 0, coins = 0, blocksWon = 0, current = null;

  function updateCoins() { $('coin-num').textContent = String(coins); }
  function updateDots() {
    var dots = document.querySelectorAll('#progress .dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = 'dot' + (i < round ? ' done' : '');
    }
  }
  function bubble(text) {
    var el = $('bubble');
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function cheer() {
    var i = Math.floor(Math.random() * CHEERS.length);
    bubble(CHEERS[i].en + ' ' + CHEERS[i].cn);
    speak(CHEERS[i].en);
  }
  function softWord() { bubble(SOFT[Math.floor(Math.random() * SOFT.length)]); }
  function floatCoin() {
    var s = document.createElement('span');
    s.className = 'float-coin'; s.textContent = '+1';
    $('coin-wrap').appendChild(s);
    setTimeout(function () { s.remove(); }, 900);
  }

  function startGame() {
    state = 'play'; round = 0; coins = 0; blocksWon = 0;
    updateCoins(); updateDots();
    $('overlay-start').classList.remove('show');
    $('overlay-settle').classList.remove('show');
    resetBlocks();
    ac(); // 首次手势解锁音频
    nextRound();
  }

  function nextRound() {
    if (round >= ROUNDS.length) { settle(); return; }
    current = ROUNDS[round];
    $('prompt-letter').textContent = current.letter;
    $('prompt-word').textContent = current.word + ' · ' + current.cn;
    $('prompt-ipa').textContent = current.ipa;
    $('prompt-card').classList.add('show');
    bubble('点一点字母 ' + current.letter + '！');
    speak(current.letter + '. ' + current.word + '.');
  }

  function handlePick(mesh) {
    if (mesh.metadata.letter === current.letter) {
      // —— 答对：跳跃旋转 + 礼花 + 金币 + 鼓励语
      sndCorrect(); sndCoin();
      coins++; blocksWon++; round++;
      updateCoins(); updateDots(); floatCoin();
      cheer();
      var home = mesh.metadata.home;
      anim(700, function (t) {
        var e = easeInOut(t);
        mesh.position.y = home.y + Math.sin(e * Math.PI) * 1.7;
        mesh.rotation.y = e * Math.PI * 2;
      }, function () { mesh.rotation.y = 0; });
      burst(mesh.position);
      setTimeout(nextRound, 1400);
    } else {
      // —— 答错：低挫败话术 + 轻微摇晃（不扣分、不惩罚）
      sndWrong(); softWord();
      anim(430, function (t) {
        mesh.rotation.z = Math.sin(t * Math.PI * 6) * 0.13 * (1 - t);
      }, function () { mesh.rotation.z = 0; });
    }
  }

  function resetBlocks() {
    blocks.forEach(function (m) {
      m.position.copyFrom(m.metadata.home);
      m.rotation.set(0, 0, 0);
    });
  }

  function settle() {
    state = 'settle';
    $('prompt-card').classList.remove('show');
    bubble('');
    $('settle-coins').textContent = String(coins);
    $('settle-blocks').textContent = '+' + blocksWon;
    $('overlay-settle').classList.add('show');
    speak('Lesson complete! Great job!');
    tone(523, .15, 0); tone(659, .15, .15); tone(784, .3, .3);
  }

  /* ---------------- 点按（区分拖拽旋转与点击） ---------------- */
  function bindPointer() {
    var down = null;
    scene.onPointerObservable.add(function (info) {
      if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        down = { x: scene.pointerX, y: scene.pointerY };
      } else if (info.type === BABYLON.PointerEventTypes.POINTERUP && down) {
        var dx = scene.pointerX - down.x, dy = scene.pointerY - down.y;
        down = null;
        if (dx * dx + dy * dy < 14 * 14 && state === 'play') {
          var pick = scene.pick(scene.pointerX, scene.pointerY, function (m) {
            return m.metadata && m.metadata.letter;
          });
          if (pick && pick.pickedMesh) handlePick(pick.pickedMesh);
        }
      }
    });
  }

  /* ---------------- 环境动画（水波 / 小船 / 云） ---------------- */
  function bindAmbient() {
    var t = 0;
    scene.onBeforeRenderObservable.add(function () {
      var dt = engine.getDeltaTime() / 1000; t += dt;
      water.position.y = -0.55 + Math.sin(t * 0.9) * 0.035;
      if (boat) {
        boat.position.y = 0.02 + Math.sin(t * 1.3) * 0.05;
        boat.rotation.z = Math.sin(t * 1.1) * 0.03;
      }
      clouds.forEach(function (cl, i) {
        cl.position.x += dt * (0.12 + i * 0.04);
        if (cl.position.x > 12) cl.position.x = -12;
      });
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    try {
      if (typeof BABYLON === 'undefined') throw new Error('引擎未加载');
      buildScene();
      bindPointer(); bindAmbient();
      engine.runRenderLoop(function () {
        var now = performance.now();
        for (var i = tweens.length - 1; i >= 0; i--) {
          var tw = tweens[i];
          var t = Math.min(1, (now - tw.t0) / tw.dur);
          tw.step(t);
          if (t >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
        }
        scene.render();
      });
      window.addEventListener('resize', function () { engine.resize(); });
      window.addEventListener('orientationchange', function () { setTimeout(function () { engine.resize(); }, 250); });
    } catch (err) {
      var msg = $('gl-error');
      if (msg) { msg.style.display = 'block'; msg.textContent = '3D 引擎初始化失败：' + err.message + '（请在自检页确认 WebGL 支持）'; }
    }
  }

  /* ---------------- UI 绑定 ---------------- */
  $('btn-start').addEventListener('click', startGame);
  $('btn-replay').addEventListener('click', startGame);
  $('btn-sound').addEventListener('click', function () {
    muted = !muted;
    if (muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    $('icon-sound-on').style.display = muted ? 'none' : '';
    $('icon-sound-off').style.display = muted ? '' : 'none';
  });

  boot();
})();
