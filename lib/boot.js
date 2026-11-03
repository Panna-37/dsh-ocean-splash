/* dsh-ocean-splash — boot overlay, injected before first paint. */
(function () {
  if (window.__DSH_OCEAN_SPLASH__) return;
  window.__DSH_OCEAN_SPLASH__ = true;

  const WORD = 'DEEPSEEK HARNESS';
  const TRACKING = 0.44;
  const HOLD = 3000;
  const FADE = 1800;
  const CAP = 20000;

  const root = document.createElement('div');
  root.id = 'dsh-ocean-splash';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;overflow:hidden;';

  const style = document.createElement('style');
  style.textContent = `
    #dsh-ocean-splash .og-horizon{position:absolute;left:0;height:1px;width:100%;
      transform-origin:left center;transform:scaleX(0);opacity:0;
      background:linear-gradient(90deg,rgba(126,168,198,0) 0%,rgba(126,168,198,.22) 18%,rgba(126,168,198,.22) 82%,rgba(126,168,198,0) 100%);}
    #dsh-ocean-splash .og-h2{top:32%}
    #dsh-ocean-splash .og-h1{top:50%}
    #dsh-ocean-splash .og-caustic{position:absolute;left:0;width:100%;height:4px;top:calc(50% + 2px);
      background:linear-gradient(90deg,transparent 0%,rgba(126,168,198,.05) 28%,rgba(126,168,198,.13) 48%,rgba(126,168,198,.06) 62%,transparent 100%);
      background-size:240% 100%;filter:blur(1.6px);opacity:0}
    #dsh-ocean-splash canvas{position:absolute;inset:0;width:100%;height:100%}
    #dsh-ocean-splash .og-hint{position:absolute;right:28px;bottom:24px;font:9px/1 "Segoe UI",system-ui,sans-serif;
      letter-spacing:.28em;color:rgba(214,224,234,.22);opacity:0}
  `;
  root.appendChild(style);

  const h2 = document.createElement('div'); h2.className = 'og-horizon og-h2';
  const h1 = document.createElement('div'); h1.className = 'og-horizon og-h1';
  const caustic = document.createElement('div'); caustic.className = 'og-caustic';
  const ocean = document.createElement('canvas');
  const textCv = document.createElement('canvas');
  const hint = document.createElement('div'); hint.className = 'og-hint'; hint.textContent = 'ESC';

  root.appendChild(h2); root.appendChild(h1); root.appendChild(caustic);
  root.appendChild(ocean); root.appendChild(textCv); root.appendChild(hint);
  (document.documentElement || document.body).appendChild(root);

  /* ── 窗口按钮：用一条 CSS 规则把 titleBarOverlay 的探测色改成透明 ── */
  const chrome = (function () {
    const ATTR = 'data-dsh-ocean-splash-chrome';
    const styleEl = document.createElement('style');
    styleEl.textContent = [
      'html[' + ATTR + ']{--dsw-specific-sidebar-fill:rgba(0,0,0,0)!important;--dsw-alias-label-primary:rgba(0,0,0,0)!important;}',
      'html[' + ATTR + '] span[style*="dsw-specific-sidebar-fill"]{background-color:rgba(0,0,0,0)!important;color:rgba(0,0,0,0)!important;}'
    ].join('\n');
    const rootEl = document.documentElement;
    let on = false;

    function isDesktop() {
      try {
        if (!/Win/.test(navigator.userAgent || '')) return false;
        if (location.protocol === 'dsh-app:') return true;
        return !!(rootEl && rootEl.hasAttribute && rootEl.hasAttribute('data-windows-titlebar'));
      } catch { return false; }
    }

    return {
      start() {
        if (!isDesktop()) return;
        try {
          document.head.appendChild(styleEl);
          rootEl.setAttribute(ATTR, '');
          on = true;
        } catch { /* ignore */ }
      },
      stop() {
        if (!on) return;
        try {
          rootEl.removeAttribute(ATTR);
          styleEl.remove();
        } catch { /* ignore */ }
      }
    };
  })();

  const tctx = textCv.getContext('2d');
  const textLayer = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const probe = document.createElement('canvas');
  probe.width = 160; probe.height = 90;

  let W = 0, H = 0, DPR = 1, FONT = 26;
  let renderer = null, world = null;
  let sim = 0, spawned = 0, phase = 'run', holdAt = 0, raf = 0, skipped = false;
  let cov0 = 1;

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    FONT = Math.round(Math.min(34, Math.max(18, W * 0.0163)));
    for (const c of [ocean, textCv]) {
      c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    }
    textLayer.width = textCv.width; textLayer.height = textCv.height;
    mask.width = textCv.width; mask.height = textCv.height;
    drawText();
    cov0 = Math.max(0.0001, coverage());
  }

  function drawText() {
    const c = textLayer.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    c.font = '300 ' + FONT + 'px "Segoe UI", system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(228,236,245,.9)';
    const chars = [...WORD];
    const space = FONT * TRACKING;
    let total = 0;
    const widths = chars.map(ch => {
      const w = ch === ' ' ? space * 1.6 : c.measureText(ch).width;
      total += w + space; return w;
    });
    total -= space;
    let x = (W - total) / 2;
    const y = H * 0.5;
    chars.forEach((ch, i) => { if (ch !== ' ') c.fillText(ch, x, y); x += widths[i] + space; });

    const m = mask.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, mask.width, mask.height);
    m.drawImage(textLayer, 0, 0);
  }

  let covCache = { at: -1e9, val: 1 };
  function coverageRaw() {
    const p = probe.getContext('2d');
    p.clearRect(0, 0, probe.width, probe.height);
    p.drawImage(mask, 0, 0, probe.width, probe.height);
    const d = p.getImageData(0, 0, probe.width, probe.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n / (probe.width * probe.height);
  }
  function coverage() {
    if (sim - covCache.at < 250) return covCache.val;
    const val = coverageRaw();
    covCache = { at: sim, val };
    return val;
  }

  function erode() {
    const cs = renderer.cols, cw = renderer.cw, ch = renderer.ch;
    const m = mask.getContext('2d');
    m.save();
    m.setTransform(DPR, 0, 0, DPR, 0, 0);
    m.globalCompositeOperation = 'destination-out';
    m.fillStyle = '#000';
    for (let i = 0; i < cs * renderer.rows; i++) {
      if (!renderer.sharkFlag[i]) continue;
      m.fillRect((i % cs) * cw, ((i / cs) | 0) * ch, cw + 0.5, ch + 0.5);
    }
    m.restore();
  }

  /* Catmull-Rom：给规划路线用 */
  function cr(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }
  function routePoint(sh, k) {
    const pts = sh.route;
    const n = pts.length - 1;
    const x = Math.min(n - 0.0001, Math.max(0, k * n));
    const i = Math.floor(x);
    const f = x - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n, i + 1)], p3 = pts[Math.min(n, i + 2)];
    return cr(p0, p1, p2, p3, f);
  }

  const SPAWNS = [
    { at: 300, route: true, fromLeft: true, size: 1.0, dur: 10.6 },
    { at: 1500, route: true, fromLeft: false, size: 1.45, dur: 12.6 },
    { at: 3000, route: false, fromLeft: true, size: 0.85 },
    { at: 3600, route: false, fromLeft: false, size: 1.1 }
  ];

  function spawnShark(cfg) {
    const minSide = Math.min(W, H);
    const baseLength = Math.max(160, Math.min(420, minSide * 0.44));
    const length = baseLength * cfg.size * 0.8;
    const dir = cfg.fromLeft ? 1 : -1;
    const y0 = H * (0.34 + Math.random() * 0.32);
    const x = dir > 0 ? -length * 1.15 : W + length * 1.15;

    const nodes = new Float32Array(40);
    const heading = Math.atan2(H * 0.5 - y0, (W * 0.5) - x);
    const seg = length / 19;
    for (let n = 0; n < 20; n++) {
      nodes[n * 2] = x - Math.cos(heading) * seg * n;
      nodes[n * 2 + 1] = y0 - Math.sin(heading) * seg * n;
    }

    const sh = {
      id: 100 + world.sharks.length, kind: 'shark', length, nodes, heading,
      speed: 55, phase: Math.random() * Math.PI * 2,
      turn: 0, hunger: 0.2, wander: 0,
      orbitDir: dir, orbitRadius: minSide * (0.16 + Math.random() * 0.16),
      target: null, retargetAt: 0,
      depth: cfg.size, spook: 0, spookFrom: null
    };

    if (cfg.route) {
      // 一条"大致穿过字标、但每一步都不规整"的曲线
      const yMid = H * 0.5;
      const n = 6;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const x = dir > 0 ? (-0.005 + f * 1.01) * W : (1.005 - f * 1.01) * W;
        const near = i >= 2 && i <= 4;                    // 中段贴着字标
        const spread = near ? H * 0.045 : H * 0.17;
        pts.push({ x: x + (Math.random() * 2 - 1) * W * 0.008, y: yMid + (Math.random() * 2 - 1) * spread });
      }
      sh.route = pts;
      sh.routeS = 0;
      sh.routeSpeed = 40 + sh.length * 0.09;   // 与渲染器里自由鲨鱼的 cruise 完全一致
      let len = 0, prev = null;
      for (let q = 0; q <= 200; q++) {
        const pt = routePoint({ route: pts }, q / 200);
        if (prev) len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        prev = pt;
      }
      sh.routeLen = Math.max(1, len);
      sh.routed = true;
    }
    world.sharks.push(sh);
  }

  function step(dt) {
    sim += dt * 1000;
    while (spawned < SPAWNS.length && sim >= SPAWNS[spawned].at) {
      spawnShark(SPAWNS[spawned]); spawned++;
    }
    world.step(dt);

    // 规划路线的两条：直接把头按曲线摆好，身体交给引擎的链条跟
    for (const sh of world.sharks) {
      if (!sh.routed) continue;
      sh.routeS = Math.min(sh.routeLen, sh.routeS + sh.routeSpeed * dt);
      const k = sh.routeS / sh.routeLen;
      const a = routePoint(sh, k);
      const b = routePoint(sh, Math.min(1, k + 0.006));
      // 我们自己算转向速率并写回 sh.turn：
      // 引擎那套 turn 是它自己算的，被我们强行改 heading 后会失真，
      // 表现为左右胸鳍一大一小乱跳（bank 由 turn 推出来）。
      const newHeading = Math.atan2(b.y - a.y, b.x - a.x);
      let dh = newHeading - sh.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const rate = Math.max(-0.45, Math.min(0.45, dh / Math.max(dt, 1e-3)));
      sh.turn += (rate - sh.turn) * Math.min(1, dt * 2);
      sh.turn = Math.max(-0.18, Math.min(0.18, sh.turn));

      sh.nodes[0] = a.x; sh.nodes[1] = a.y;
      sh.heading = newHeading;
      sh.speed = sh.routeSpeed;
    }

    renderer.render(world, dt);
    erode();

    if (phase === 'run' && sim > 1600) {
      const cov = coverage();
      // 必须是"字标完全看不见"才开始计时；万一有残点吃不掉，16 秒后兜底
      if (skipped || cov <= 1e-5 || sim > 16000) {
        phase = 'hold'; holdAt = sim;
      }
    } else if (phase === 'hold') {
      const wait = skipped ? 350 : HOLD;
      if (sim - holdAt >= wait) phase = 'fade';
    } else if (phase === 'fade' && sim - holdAt >= (skipped ? 350 + 1200 : HOLD + FADE)) {
      finish();
    }
  }

  function paint() {
    const p1 = easeOut(ramp(sim, 0, 1700));
    h1.style.transform = 'scaleX(' + p1 + ')';
    h1.style.opacity = String(0.9 * p1);
    const p2 = easeOut(ramp(sim, 2400, 4200));
    h2.style.transform = 'scaleX(' + p2 + ')';
    h2.style.opacity = String(0.5 * p2);
    caustic.style.opacity = String(ramp(sim, 4200, 5600) * 0.9);
    caustic.style.backgroundPosition = ((sim * 0.006) % 100) + '% 0';
    hint.style.opacity = String(ramp(sim, 2400, 3200));

    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, textCv.width, textCv.height);
    tctx.globalAlpha = skipped ? 1 : ramp(sim, 1500, 3000);
    tctx.drawImage(mask, 0, 0);
    tctx.globalAlpha = 1;

    if (phase === 'fade') {
      const start = skipped ? holdAt + 350 : holdAt + HOLD;
      root.style.opacity = String(1 - ramp(sim, start, start + (skipped ? 1200 : FADE)));
    }
  }

  function finish() {
    phase = 'done';
    cancelAnimationFrame(raf);
    try { chrome.stop(); } catch { /* ignore */ }
    try { root.remove(); } catch { /* ignore */ }
    window.__DSH_OCEAN_SPLASH_DONE__ = true;
  }

  
  // 最后兜底：万一卡住，45 秒后淡出（不是硬摘）
  setTimeout(function () {
    try {
      if (phase === 'run' || phase === 'hold') { phase = 'fade'; holdAt = sim - HOLD - FADE + 1200; }
    } catch { /* ignore */ }
  }, 45000);

  window.__DSH_OCEAN_SPLASH_STATE__ = function () {
    return { sim: Math.round(sim), phase, cov: +coverage().toFixed(4), cov0: +cov0.toFixed(4),
      sharks: world ? world.sharks.length : -1,
      routed: world ? world.sharks.filter(function (s) { return s.routed; }).length : -1,
      speeds: world ? world.sharks.map(function (s) { return Math.round(s.speed); }) : [],
      free: world ? world.sharks.filter(function (s) { return !s.routed; }).map(function (s) { return Math.round(s.speed); }) : [],
      spawned, raf: !!raf };
  };

  function skip() { skipped = true; }

  // 进度按墙钟推进：rAF 被降频/暂停也不会让动画变慢。
  let t0 = 0, lastFrame = 0;
  function loop(now) {
    if (!t0) t0 = now;
    if (now - lastFrame < 30) {          // 约 30fps，把主线程让给应用启动
      if (phase !== 'done') raf = requestAnimationFrame(loop);
      return;
    }
    lastFrame = now;
    try {
      const target = now - t0;           // 应该到达的毫秒数
      let guard = 0;
      while (sim < target - 1 && guard < 6) {
        const remain = (target - sim) / 1000;
        step(Math.min(0.05, remain));
        guard++;
      }
      if (sim < target) sim = target;    // 追不上就直接对齐，不要慢动作
      paint();
    } catch (e) {
      finish();
      return;
    }
    if (phase !== 'done') raf = requestAnimationFrame(loop);
  }

  function start() {
    const mod = window.__OCEAN__;
    if (!mod || !mod.AsciiRenderer || !mod.World) { finish(); return; }

    renderer = new mod.AsciiRenderer(ocean);
    renderer.settings.species = 'shark';
    renderer.settings.grid = 0;
    renderer.settings.dotDensity = 0;
    renderer.settings.transparent = true;
    renderer.settings.cellSize = 6;
    renderer.settings.sharkColor = '#4284FF';
    renderer.bgColor = null; renderer.gridAlpha = 0; renderer.dotDensity = 0;
    if (typeof renderer.applyPalette === 'function') renderer.applyPalette();

    world = new mod.World([{ kind: 'shark', size: 1 }, { kind: 'shark', size: 1.45 }]);
    renderer.resize(W, H, DPR);
    world.resize(W, H, renderer.cw, renderer.ch);
    world.sharks = [];
    renderer.render(world, 1 / 60);
    world.sharks = [];
    drawText();

    chrome.start();
    window.addEventListener('keydown', e => { if (e.key === 'Escape') skip(); });
    root.addEventListener('pointerdown', skip);

    raf = requestAnimationFrame(loop);
  }

  layout();
  window.addEventListener('resize', () => { layout(); if (renderer) renderer.resize(W, H, DPR); });

  window.__DSH_OCEAN_LOADER__ = {
    load(mod) {
      try { window.__OCEAN__ = mod.factory(function () { return {}; }); }
      catch (e) { window.__OCEAN__ = null; }
    }
  };

  const src = (document.currentScript && document.currentScript.src) || '';
  const base = src.replace(/\/[^\/]*$/, '');
  const tag = document.createElement('script');
  tag.src = base + '/ocean-renderer.js';
  tag.onload = start;
  tag.onerror = finish;
  document.head.appendChild(tag);
})();
