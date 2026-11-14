
/* ───────────── sound: a crowd cheer (or groan) and the ball hitting the net, made on the fly with Web Audio ───────────── */
/* (the constant background of chatter and traffic, and the bicycle bells, are further down) */
const SND = { ctx: null, on: true };
try { SND.on = localStorage.getItem('psf-sound') !== 'off'; } catch (e) {}
function audioUnlock() {                                   // browsers only allow sound after a tap or key press, so the first one wakes it
  if (!SND.on) return;
  try {
    if (!SND.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; SND.ctx = new AC(); }
    if (SND.ctx.state === 'suspended') { const r = SND.ctx.resume(); if (r && r.catch) r.catch(() => {}); }
  } catch (e) { SND.ctx = null; }
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, audioUnlock, { passive: true });
function noiseBuf(ctx) {
  if (ctx._psfNoise) return ctx._psfNoise;
  const n = Math.floor(ctx.sampleRate * 3), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let p = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; p = 0.97 * p + 0.03 * w; d[i] = w * 0.5 + p * 2.4; }   // white noise with a warmer, lower body
  return (ctx._psfNoise = b);
}
/* happy: the crowd roars "hey!" as the net ripples; otherwise a deflated "ohh" */
function goalSound(happy, ctx = SND.ctx, t0, dest) {
  if (!ctx) return;
  t0 = t0 ?? ctx.currentTime + 0.02; dest = dest || ctx.destination;
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  master.gain.value = 0.6; master.connect(comp); comp.connect(dest);
  const nb = noiseBuf(ctx), env = (g, at, peak, rise, hold, fall) => {
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + rise); g.gain.setTargetAtTime(0.0001, at + rise + hold, fall);
  };
  /* the net: a soft thump and a swish */
  const th = ctx.createOscillator(), tg = ctx.createGain();
  th.type = 'sine'; th.frequency.setValueAtTime(115, t0); th.frequency.exponentialRampToValueAtTime(46, t0 + 0.22);
  env(tg, t0, 0.8, 0.008, 0.02, 0.07); th.connect(tg); tg.connect(master); th.start(t0); th.stop(t0 + 0.6);
  const sw = ctx.createBufferSource(), sf = ctx.createBiquadFilter(), sg = ctx.createGain();
  sw.buffer = nb; sf.type = 'highpass'; sf.frequency.value = 1900; env(sg, t0, 0.32, 0.015, 0.05, 0.09);
  sw.connect(sf); sf.connect(sg); sg.connect(master); sw.start(t0, Math.random() * 2); sw.stop(t0 + 0.7);
  /* the crowd: a wash of voices swelling then dying away */
  const c0 = t0 + 0.07, len = happy ? 3.4 : 2.4;
  const bed = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), bg = ctx.createGain();
  bed.buffer = nb; bed.loop = true; bf.type = 'bandpass'; bf.Q.value = 0.8; lp.type = 'lowpass'; lp.frequency.value = happy ? 3400 : 1500;
  bf.frequency.setValueAtTime(happy ? 650 : 520, c0); bf.frequency.linearRampToValueAtTime(happy ? 1150 : 330, c0 + 0.6);
  env(bg, c0, happy ? 0.5 : 0.3, happy ? 0.3 : 0.45, happy ? 0.9 : 0.5, happy ? 0.55 : 0.4);
  bed.connect(bf); bf.connect(lp); lp.connect(bg); bg.connect(master); bed.start(c0, Math.random() * 2); bed.stop(c0 + len + 1);
  const n = happy ? 20 : 13;                                // single voices on top, each sung through two vowel formants
  for (let i = 0; i < n; i++) {
    const st = c0 + Math.random() * (happy ? 0.9 : 0.55), d = 0.4 + Math.random() * (happy ? 0.9 : 0.8);
    const f0 = Math.random() < 0.6 ? 130 + Math.random() * 90 : 230 + Math.random() * 150;
    const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * (happy ? 0.92 : 1.15), st); o.frequency.exponentialRampToValueAtTime(f0 * (happy ? 1.32 : 0.8), st + d * 0.55); o.frequency.exponentialRampToValueAtTime(f0 * (happy ? 1.08 : 0.66), st + d);
    f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    f1.frequency.value = happy ? 720 + Math.random() * 160 : 470 + Math.random() * 80;    // "ay" for a goal, "oh" for one against
    f2.frequency.value = happy ? 1500 + Math.random() * 300 : 820 + Math.random() * 120;
    env(g, st, happy ? 0.11 : 0.09, 0.05, d * 0.6, d * 0.18);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(master); o.start(st); o.stop(st + d + 1);
  }
}
function playGoal(happy) { if (SND.on && SND.ctx && SND.ctx.state === 'running') { try { goalSound(happy); } catch (e) {} } }

/* ───────────── the crowd: neighbours watching from behind the wall, the goals, the corners, the tea-stall bench ───────────── */
const CROWD = [];
const CR = { mat: null, shot: 0, cool: 0, lastPhase: '' };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const MX = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
/* bake several coloured pieces into one mesh, so each body part costs a single draw */
function mergeParts(parts) {
  let nV = 0, nI = 0;
  const gs = parts.map(([g, m, c]) => { const cl = g.clone(); cl.applyMatrix4(m); nV += cl.attributes.position.count; nI += cl.index ? cl.index.count : cl.attributes.position.count; return [cl, col(c)]; });
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), clr = new Float32Array(nV * 3), idx = nV > 65535 ? new Uint32Array(nI) : new Uint16Array(nI);
  let v = 0, k = 0;
  for (const [g, c] of gs) {
    const p = g.attributes.position, n = g.attributes.normal;
    pos.set(p.array, v * 3); nor.set(n.array, v * 3);
    for (let i = 0; i < p.count; i++) { clr[(v + i) * 3] = c.r; clr[(v + i) * 3 + 1] = c.g; clr[(v + i) * 3 + 2] = c.b; }
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[k++] = a[i] + v; } else for (let i = 0; i < p.count; i++) idx[k++] = v + i;
    v += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(clr, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
const SKINS = ['#8f5d3b', '#a9744f', '#7d5234', '#b98058', '#9a6845', '#6e472d', '#c08a62'];
const SHIRTS = ['#f1eee6', '#9cc3d9', '#d9cfb4', '#7a8fa6', '#c9a46a', '#e8e1cf', '#5f7d5c', '#b8413a', '#3e5c8a', '#d6b26a', '#8a5a8c'];
const LUNGIS = ['#2f5a8a', '#3b6b4a', '#6a3f6e', '#3a4a7a', '#7a5a2a', '#8a3a3a'];
const SAREES = ['#c0392b', '#d68910', '#1e8449', '#7d3c98', '#2471a3', '#e67e22', '#b03a5b', '#117a65'];
const TROUSERS = ['#3a3530', '#2d3340', '#5a5248', '#22262c', '#6b5d4a', '#2f4560'];
/* one neighbour, about 1.2 m to 1.8 m tall: hips, torso and head, two-part arms and legs, each part one mesh */
function fanSpec(rng, kind) {
  const pick = a => a[(rng() * a.length) | 0], skin = pick(SKINS);
  if (!kind) { const r = rng(); kind = r < 0.3 ? 'man' : r < 0.46 ? 'lungi' : r < 0.6 ? 'old' : r < 0.78 ? 'woman' : r < 0.9 ? 'youth' : 'boy'; }
  const s = { kind, skin, hair: '#141110', top: pick(SHIRTS), bottom: pick(TROUSERS), sleeve: 'half', style: 'short', skirt: null, hem: null, scale: 0.94 + rng() * 0.12, cup: false, phone: false, mous: false, bindi: false, pallu: null, foot: '#3a2a1e', shorts: false };
  if (kind === 'lungi') { s.skirt = pick(LUNGIS); s.hem = '#e8e1cf'; s.sleeve = rng() < 0.5 ? 'none' : 'half'; s.top = s.sleeve === 'none' ? '#efece4' : s.top; s.mous = rng() < 0.6; s.cup = rng() < 0.6; }
  if (kind === 'man') { s.mous = rng() < 0.45; s.cup = rng() < 0.35; s.sleeve = rng() < 0.5 ? 'full' : 'half'; }
  if (kind === 'old') { s.top = rng() < 0.6 ? '#f1eee6' : '#e3d6b8'; s.skirt = '#f1eee6'; s.hem = '#d8cfb8'; s.style = rng() < 0.6 ? 'bald' : 'short'; s.hair = '#cfcac0'; s.sleeve = 'full'; s.cup = rng() < 0.6; s.scale = 0.92 + rng() * 0.06; s.mous = rng() < 0.5; }
  if (kind === 'woman') { const sa = pick(SAREES); s.top = sa; s.skirt = sa; s.hem = rng() < 0.5 ? '#e0b84a' : '#f1eee6'; s.pallu = s.hem; s.style = rng() < 0.6 ? 'bun' : 'long'; s.bindi = rng() < 0.7; s.scale = 0.88 + rng() * 0.08; s.sleeve = 'half'; s.foot = '#6a3a2a'; }
  if (kind === 'youth') { s.top = pick(['#1d1d22', '#b8413a', '#3e5c8a', '#f1eee6', '#2e6b4a', '#d6b26a']); s.bottom = pick(['#2f4560', '#22262c', '#3a3a40']); s.phone = rng() < 0.7; s.scale = 0.9 + rng() * 0.08; s.style = rng() < 0.5 ? 'short' : 'mop'; }
  if (kind === 'boy') { s.top = pick(['#c8302a', '#2471a3', '#f2c230', '#1e8449', '#f1eee6']); s.bottom = pick(['#22304a', '#3a3530', '#5a5248']); s.shorts = true; s.scale = 0.66 + rng() * 0.08; s.style = 'mop'; s.foot = '#2a2a2e'; }
  return s;
}
function buildFan(s) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.scale.setScalar(s.scale);
  const mesh = (parts, parent, x, y, z) => { const m = new THREE.Mesh(mergeParts(parts), CR.mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = !LOWSPEC; m.receiveShadow = false; parent.add(m); return m; };
  const I = MX(0, 0, 0), sph = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h), cyl = (a, b, h, n = 12) => new THREE.CylinderGeometry(a, b, h, n);
  const HIP = 58;
  const hips = new THREE.Group(); hips.position.y = HIP; body.add(hips);
  const hp = [[lathe([[0.01, -6.5], [7, -6.2], [9.6, -4], [9.8, 1], [9.4, 4], [0.01, 4.2]], 14), MX(0, 0, 0, 0, 0, 0, 1, 1, 0.74), s.skirt || s.bottom]];
  if (s.skirt) {                                              // lungi, dhoti or saree: a long wrap to the ankles, with a border at the hem
    hp.push([lathe([[9.8, 2], [10.6, -10], [11.6, -28], [12.6, -46], [12.8, -50], [0.01, -50.2]], 16), MX(0, 0, 0, 0, 0, 0, 1, 1, 0.8), s.skirt]);
    hp.push([cyl(12.85, 12.95, 3.4, 16), MX(0, -48.2, 0, 0, 0, 0, 1, 1, 0.8), s.hem]);
  }
  mesh(hp, hips);
  const torso = new THREE.Group(); torso.position.y = 2; hips.add(torso);
  const tp = [[lathe([[0.01, -1], [9.4, -0.6], [10, 3], [9.4, 10], [10.2, 20], [12, 30], [12.8, 36], [12, 40], [8, 43], [4, 44.6], [0.01, 44.8]], 18), MX(0, 0, 0, 0, 0, 0, 1, 1, 0.64), s.top],
    [cyl(3.4, 3.8, 6, 10), MX(0, 46.5, 0), s.skin]];
  if (s.kind === 'lungi' && s.sleeve === 'none') tp.push([cyl(10.6, 9.9, 1.6, 16), MX(0, 8, 0, 0, 0, 0, 1, 1, 0.68), '#d8d2c4']);      // a vest over the lungi
  if (s.pallu) tp.push([new THREE.BoxGeometry(6.5, 50, 2.4), MX(1.5, 22, 7.4, 0, 0, -0.55), s.pallu]);                           // the saree's end, across the chest
  mesh(tp, torso);
  const head = new THREE.Group(); head.position.y = 56.5; torso.add(head);
  const sk = s.skin, hc = s.hair;
  const hd = [[lathe([[0.01, -10.2], [3.2, -10], [5.5, -8.2], [6.9, -5.2], [7.6, -1.2], [8, 2.8], [7.6, 6.5], [6.2, 9.2], [3.8, 10.8], [0.01, 11.4]], 14), MX(0, 0, 0, 0, 0, 0, 0.93, 1, 1.02), sk],
    [sph(1.9, 8, 6), MX(0, -1.6, 7.7, 0, 0, 0, 0.9, 1.15, 1), sk], [sph(0.72, 6, 5), MX(-3, 1.5, 7.25), '#15110f'], [sph(0.72, 6, 5), MX(3, 1.5, 7.25), '#15110f'],
    [sph(2.2, 6, 6), MX(-7.3, 0.2, 0.3, 0, 0, 0, 0.5, 1.1, 0.8), sk], [sph(2.2, 6, 6), MX(7.3, 0.2, 0.3, 0, 0, 0, 0.5, 1.1, 0.8), sk]];
  if (s.style === 'bald') hd.push([new THREE.SphereGeometry(8.5, 16, 6, Math.PI - 0.35, Math.PI + 0.7, 0.36 * Math.PI, 0.17 * Math.PI), MX(0, 0.6, 0, 0, 0, 0, 0.95, 1, 1.03), hc]);
  else hd.push([new THREE.SphereGeometry(8.6, 16, 10, 0, TAU, 0, Math.PI * 0.6), MX(0, 2.6, -0.8, -0.42, 0, 0, 0.98, 1.06, 1.06), hc]);
  if (s.style === 'mop') for (const [x, y, z, r] of [[-3.6, 10, 2.6, 4.4], [3.4, 10.4, 1.6, 4.6], [0, 10.6, -3.4, 5]]) hd.push([sph(r, 8, 6), MX(x, y, z), hc]);
  if (s.style === 'bun') hd.push([sph(4.4, 10, 8), MX(0, 2.6, -9.2), hc]);
  if (s.style === 'long') hd.push([new THREE.BoxGeometry(13, 20, 3.4), MX(0, -6, -6.8, 0.12, 0, 0), hc]);
  if (s.mous) hd.push([new THREE.BoxGeometry(4.8, 1.1, 1.2), MX(0, -4.2, 7.3), s.kind === 'old' ? '#cfcac0' : '#15110f']);
  if (s.bindi) hd.push([sph(0.75, 6, 5), MX(0, 4.4, 7.95), '#b3141c']);
  mesh(hd, head);
  const limb = (side, arm) => {
    const a = new THREE.Group(), b = new THREE.Group();
    if (arm) {
      a.position.set(side * 12.4, 39.5, 0); torso.add(a);
      const up = [[limbGeo(3.8, 3.2, 21, 0.3), I, s.sleeve === 'full' ? s.top : sk]];
      if (s.sleeve === 'half') up.push([limbGeo(4.3, 4.0, 10), MX(0, 0.6, 0), s.top]);
      mesh(up, a);
      b.position.y = -21; a.add(b);
      const lo = [[limbGeo(s.sleeve === 'full' ? 3.4 : 3.1, 2.5, 17, 0.2), I, s.sleeve === 'full' ? s.top : sk], [sph(2.9, 8, 6), MX(0, -19.6, 0.4, 0, 0, 0, 0.62, 1.2, 1), sk]];
      if (s.sleeve === 'full') lo.push([limbGeo(2.6, 2.4, 3), MX(0, -14.5, 0), sk]);
      if (side < 0 && s.cup) lo.push([cyl(2.3, 1.6, 4.4, 10), MX(0, -20.5, 3.6), '#b0613a']);       // a clay cup of tea
      if (side < 0 && s.phone) lo.push([new THREE.BoxGeometry(3.4, 6.4, 0.8), MX(0, -20.2, 3.2, -0.3, 0, 0), '#1a1a1e']);
      mesh(lo, b);
    } else {
      a.position.set(side * 5.8, -2, 0); hips.add(a);
      const leg = s.skirt ? sk : s.shorts ? sk : s.bottom;
      const th = [[limbGeo(6, 4.6, 26.5, 0.4), I, leg]];
      if (s.shorts) th.push([limbGeo(6.6, 6.2, 11), MX(0, 0.6, 0), s.bottom]);
      mesh(th, a);
      b.position.y = -26.5; a.add(b);
      mesh([[limbGeo(4.4, 3, 26, 0.6), MX(0, 0, -0.3), leg], [sph(3.6, 8, 6), MX(0, -28.2, 2.8, 0, 0, 0, 0.9, 0.5, 1.9), s.foot]], b);
    }
    return [a, b];
  };
  const f = { root, body, hips, torso, head, s };
  [f.armL, f.elbL] = limb(1, true); [f.armR, f.elbR] = limb(-1, true);
  [f.legL, f.kneeL] = limb(1, false); [f.legR, f.kneeR] = limb(-1, false);
  world.add(root);
  return f;
}
/* where they stand: [x, y, facing, spot type, scale override]; types decide what they get up to */
function crowdSpots(fx, FY) {
  const L = F.R - F.L, spots = [], wy = F.T - 24;
  for (const u of [0.04, 0.185, 0.24, 0.33, 0.37, 0.52, 0.63, 0.67, 0.71, 0.88, 0.94]) spots.push({ x: F.L + u * L, y: wy + (u * 97 % 1) * 8 - 4, home: Math.PI / 2, type: 'wall', keep: [0.185, 0.33, 0.52, 0.67, 0.88, 0.94].includes(u) });   // none in front of the tea-stall bench, where the lane is narrowest
  for (const [x, y] of [[F.L - 70, F.cy - 150], [F.L - 82, F.cy + 40], [F.L - 66, F.cy + 120]]) spots.push({ x, y, home: 0, type: 'stand', zone: [F.L - 120, F.L - 58, F.cy - 190, F.cy + 190], keep: y !== F.cy + 40 });
  for (const [x, y] of [[F.R + 70, F.cy - 100], [F.R + 84, F.cy + 30], [F.R + 66, F.cy + 150]]) spots.push({ x, y, home: Math.PI, type: 'stand', zone: [F.R + 58, F.R + 120, F.cy - 110, F.cy + 200], keep: y !== F.cy + 30 });
  for (const [x, keep] of [[F.L - 44, true], [F.L - 14, false], [F.R + 16, true], [F.R + 46, false]]) spots.push({ x, y: F.B + 22, home: -Math.PI / 2, type: 'stand', zone: [x - 30, x + 30, F.B + 16, F.B + 26], keep });
  for (const x of [fx(258), fx(318)]) spots.push({ x, y: FY + 64, home: Math.PI / 2, type: 'seat', seat: 20, keep: true, kind: x === fx(258) ? 'lungi' : 'man' });
  for (const x of [fx(40), fx(150)]) spots.push({ x, y: FY + 24, home: Math.PI / 2, type: 'seat', seat: 26, keep: false, kind: 'old' });
  const cx = F.R + 98, cy = F.T + 86;                          // the carrom players on their stools
  spots.push({ x: cx - 4, y: cy - 50, home: Math.PI / 2, type: 'carrom', seat: 20, keep: true, kind: 'lungi', board: [cx, cy] });
  spots.push({ x: cx + 6, y: cy + 52, home: -Math.PI / 2, type: 'carrom', seat: 20, keep: true, kind: 'man', board: [cx, cy] });
  spots.push({ x: F.cx + 270, y: F.B + 116 + 38, home: -Math.PI / 2, type: 'driver', keep: true, kind: 'man' });   // the taxi driver, over his roof
  return LOWSPEC ? spots.filter(s => s.keep) : spots;
}
function buildCrowd(fx, FY) {
  CR.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rng = mul32(31337);
  for (const sp of crowdSpots(fx, FY)) {
    const s = fanSpec(rng, sp.kind || (sp.type === 'wall' && rng() < 0.12 ? 'boy' : null));
    if (sp.type === 'wall' && s.kind === 'boy') s.scale = 0.8;                       // a boy has to stand on something to see over the wall
    const f = buildFan(s);
    Object.assign(f, { x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, home: sp.home, ang: sp.home, type: sp.type, seat: sp.seat || 0, zone: sp.zone, board: sp.board,
      act: 'watch', actT: rng() * 3, react: null, reactT: 0, reactDelay: 0, ph: rng() * TAU, walkPh: 0, goal: null, look: 0, cur: {}, tg: {}, rng });
    CROWD.push(f);
  }
  for (const f of CROWD) {                                     // the nearest neighbour to talk to
    let b = null, bd = 95; for (const g of CROWD) { if (g === f) continue; const d = Math.hypot(g.x - f.x, g.y - f.y); if (d < bd) { bd = d; b = g; } } f.buddy = b;
  }
  for (const f of CROWD) poseFan(f, 1, 0);
}
const ACTS = {
  wall: [['lean', 5, 3, 8], ['watch', 3, 2, 6], ['clap', 1, 1.2, 2.4], ['chat', 2, 2, 4.5], ['sip', 2, 3, 6], ['phone', 2, 3, 7], ['point', 1, 1, 1.8], ['fold', 2, 3, 6]],
  stand: [['watch', 4, 2, 6], ['fold', 2, 3, 6], ['clap', 1, 1.2, 2.4], ['chat', 2, 2, 4.5], ['sip', 2, 3, 6], ['phone', 2, 3, 7], ['point', 1, 1, 1.8], ['stroll', 1.5, 0, 0]],
  seat: [['watch', 4, 2, 6], ['sip', 3, 3, 6], ['chat', 2, 2, 4.5], ['clap', 1, 1.2, 2.4], ['fold', 1, 3, 6]],
  carrom: [['carrom', 6, 3, 7], ['watch', 2, 1.5, 3]],
  driver: [['lean', 5, 4, 9], ['watch', 2, 2, 5], ['fold', 2, 3, 6], ['phone', 1, 3, 6]]
};
function nextAct(f) {
  const opts = ACTS[f.type].filter(([a]) => (a !== 'sip' || f.s.cup) && (a !== 'phone' || f.s.phone) && (a !== 'chat' || f.buddy) && (a !== 'stroll' || f.zone));
  let tot = 0; for (const o of opts) tot += o[1];
  let r = f.rng() * tot, o = opts[0]; for (const q of opts) { if ((r -= q[1]) <= 0) { o = q; break; } }
  f.act = o[0]; f.actT = o[2] + f.rng() * (o[3] - o[2]);
  if (f.act === 'stroll') {
    const z = f.zone, away = Math.hypot(f.x - f.hx, f.y - f.hy) > 12;
    f.goal = away && f.rng() < 0.6 ? [f.hx, f.hy] : [z[0] + f.rng() * (z[1] - z[0]), z[2] + f.rng() * (z[3] - z[2])];
    f.actT = 12;
  }
}
/* the whole crowd reacts: a goal (cheering, or hands on heads when the CPU scores) or a near miss */
function crowdReact(kind, happy) {
  for (const f of CROWD) {
    if (kind === 'goal') { f.react = happy || f.rng() < 0.45 ? 'cheer' : 'ooh'; f.reactT = 2 + f.rng() * 1.4; f.reactDelay = f.rng() * 0.35; }
    else if (f.rng() < 0.5 && !f.react) { f.react = 'ooh'; f.reactT = 1.1 + f.rng() * 0.6; f.reactDelay = f.rng() * 0.25; }
    if (f.type === 'carrom' && f.rng() < 0.5) f.react = null;               // some carrom games are more important than goals
  }
}
function setPose(t, a) { t.aLx = a[0]; t.aLz = a[1]; t.eL = a[2]; t.aRx = a[3]; t.aRz = a[4]; t.eR = a[5]; }
function poseFan(f, dt, t) {
  if (f.react) { if (f.reactDelay > 0) f.reactDelay -= dt; else if ((f.reactT -= dt) <= 0) f.react = null; }
  const reacting = f.react && f.reactDelay <= 0;
  if (!reacting && (f.actT -= dt) <= 0) nextAct(f);
  const act = reacting ? f.react : f.act, seated = f.seat > 0, g = f.tg, ph = f.ph;
  /* where they are and which way they face */
  let lx = ball.x, ly = ball.y, walking = false;
  if (act === 'chat' && f.buddy) { lx = f.buddy.x; ly = f.buddy.y; }
  if (act === 'carrom') { lx = f.board[0]; ly = f.board[1]; }
  if (act === 'stroll' && f.goal) {
    const dx = f.goal[0] - f.x, dy = f.goal[1] - f.y, d = Math.hypot(dx, dy);
    if (d < 3) { f.goal = null; f.actT = 0; }
    else { const sp = Math.min(d, 38 * dt); f.x += dx / d * sp; f.y += dy / d * sp; walking = true; f.walkPh += sp * 0.075; lx = f.x + dx; ly = f.y + dy; }
  }
  const toward = Math.atan2(ly - f.y, lx - f.x), lim = seated ? 0.55 : walking ? 9 : 1.15;
  const want = walking ? toward : f.home + clamp(wrapA(toward - f.home), -lim, lim);
  f.ang += clamp(wrapA(want - f.ang), -2.4 * dt, 2.4 * dt);
  f.root.position.set(f.x, 0, f.y); f.root.rotation.y = Math.PI / 2 - f.ang;
  f.look += (clamp(-wrapA(toward - f.ang), -0.9, 0.9) - f.look) * Math.min(1, dt * 6);
  /* the pose they are aiming for */
  setPose(g, [0.06, 0.1, -0.18, 0.06, -0.1, -0.18]);
  g.lL = g.lR = g.kL = g.kR = 0; g.lean = 0.02 + Math.sin(t * 0.8 + ph) * 0.015; g.hx = 0.05; g.bob = 0;
  if (seated) { g.lL = g.lR = -1.5; g.kL = g.kR = 1.5; g.lean = 0.1; setPose(g, [-0.55, 0.06, -0.5, -0.55, -0.06, -0.5]); }
  const s1 = Math.sin(t * 13 + ph);
  switch (act) {
    case 'lean': g.lean = 0.3; setPose(g, [-1.15, 0.16, -0.75, -1.15, -0.16, -0.75]); break;
    case 'clap': g.lean += 0.04; setPose(g, [-0.8, -0.26 + 0.2 * s1, -1.2, -0.8, 0.26 - 0.2 * s1, -1.2]); break;
    case 'fold': setPose(g, [-0.5, -0.2, -1.95, -0.42, 0.2, -2.0]); break;
    case 'sip': { const up = (t * 0.9 + ph) % 3.2 < 1.1; g.aRx = up ? -0.6 : -0.3; g.aRz = up ? 0.32 : 0.1; g.eR = up ? -2.35 : -1.4; if (up) g.hx = -0.1; break; }
    case 'phone': g.aRx = -0.45; g.aRz = 0.26; g.eR = -1.7; g.aLx = -0.2; g.eL = -0.6; g.hx = 0.45; break;
    case 'point': g.aRx = -1.55; g.aRz = -0.15; g.eR = -0.1; break;
    case 'chat': g.aRx = -0.3; g.aRz = 0.08; g.eR = -1.1 - 0.35 * Math.sin(t * 4 + ph); g.hx = 0; break;
    case 'carrom': g.lean = 0.55; g.aRx = -1.0; g.aRz = 0.1; g.eR = -0.55 + 0.25 * Math.max(0, Math.sin(t * 2.2 + ph)) ** 8; g.aLx = -0.9; g.aLz = -0.05; g.eL = -0.6; g.hx = 0.3; break;
    case 'ooh': g.lean = -0.04; setPose(g, [-2.3, 0.72, -2.2, -2.3, -0.72, -2.2]); break;
    case 'cheer': { const w = Math.sin(t * 9 + ph) * 0.14; setPose(g, [-2.8, 0.34 + w, -0.25, -2.8, -0.34 - w, -0.25]); g.hx = -0.2; if (!seated) g.bob = Math.abs(Math.sin(t * 7.5 + ph)) * 7; break; }
  }
  if (walking) { const w = Math.sin(f.walkPh); g.lL = 0.45 * w; g.lR = -0.45 * w; g.kL = Math.max(0, -Math.cos(f.walkPh)) * 0.6; g.kR = Math.max(0, Math.cos(f.walkPh)) * 0.6; g.aLx = -0.35 * w; g.aRx = 0.35 * w; g.bob = Math.abs(w) * 1.5; }
  /* ease towards it */
  const c = f.cur, k = Math.min(1, dt * 7);
  for (const key in g) c[key] = c[key] === undefined ? g[key] : c[key] + (g[key] - c[key]) * k;
  f.armL.rotation.x = c.aLx; f.armL.rotation.z = c.aLz; f.elbL.rotation.x = c.eL;
  f.armR.rotation.x = c.aRx; f.armR.rotation.z = c.aRz; f.elbR.rotation.x = c.eR;
  f.legL.rotation.x = c.lL; f.legR.rotation.x = c.lR; f.kneeL.rotation.x = c.kL; f.kneeR.rotation.x = c.kR;
  f.torso.rotation.x = c.lean; f.head.rotation.x = c.hx; f.head.rotation.y = f.look * 0.9;
  f.body.position.y = (seated ? f.seat + 5 - 58 : 0) + c.bob;
}
function updateCrowd(dt, t) {
  if (!CROWD.length) return;
  if (S.phase !== CR.lastPhase) { if (S.phase === 'goal' && CR.lastPhase === 'play') CR.shot = 0; CR.lastPhase = S.phase; }
  if (S.phase === 'play' && ball.owner < 0) {                 // a hard shot that flies at goal and does not go in: "ooh"
    const sp = Math.hypot(ball.vx, ball.vy), toward = ball.vx > 0 ? F.R - ball.x : ball.x - F.L;
    if (!CR.shot && CR.cool <= 0 && sp > 560 && toward < 520) CR.shot = 1.1;
  }
  CR.cool -= dt;
  if (CR.shot > 0 && (CR.shot -= dt) <= 0) { CR.shot = 0; CR.cool = 2.5; if (S.phase === 'play') crowdReact('ooh'); }
  for (const f of CROWD) poseFan(f, dt, t);
  updateCyclists(dt, t);
}

/* ───────────── background sound: the crowd chattering and the road beyond, generated live ───────────── */
/* People: eight talkers, each a buzzing voice sung through two vowel formants that change every syllable, speaking in phrases with
   pauses between (and the odd laugh), over a low murmur. Road: a rumble, vehicles that swell past from one side to the other, and horns. */
const VOWELS = [[750, 1200], [500, 1800], [330, 2200], [520, 900], [360, 820], [650, 1500]];
function ambBuild(ctx, dest) {
  const pan = (x) => { if (!ctx.createStereoPanner) return null; const p = ctx.createStereoPanner(); p.pan.value = x; return p; };
  const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(dest);
  const st = { ctx, master, talkers: [], nextCar: 0, nextHorn: 0, nextMurmur: 0, rng: mul32(4242) }, R = st.rng;
  /* the murmur under the voices, and the voices' bus */
  const nb = noiseBuf(ctx), voices = ctx.createGain(), vlp = ctx.createBiquadFilter();
  voices.gain.value = 1; vlp.type = 'lowpass'; vlp.frequency.value = 2600; voices.connect(vlp); vlp.connect(master);
  const mur = ctx.createBufferSource(), mbf = ctx.createBiquadFilter(), mg = ctx.createGain();
  mur.buffer = nb; mur.loop = true; mbf.type = 'bandpass'; mbf.frequency.value = 650; mbf.Q.value = 0.7; mg.gain.value = 0.045;
  mur.connect(mbf); mbf.connect(mg); mg.connect(vlp); mur.start(); st.murmur = mg;
  for (let i = 0; i < 8; i++) {
    const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), p = pan(-0.85 + i * 0.24);
    const male = i % 3 !== 2, f0 = male ? 105 + R() * 45 : 190 + R() * 60;
    o.type = 'sawtooth'; o.frequency.value = f0; f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7; g.gain.value = 0.0001;
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); if (p) { g.connect(p); p.connect(voices); } else g.connect(voices);
    o.start();
    st.talkers.push({ o, f1, f2, g, f0, loud: 0.016 + R() * 0.02, next: ctx.currentTime + R() * 2, talking: R() < 0.5, left: 1 + R() * 3, laugh: false });
  }
  /* the road: a low rumble that never quite stops */
  const rum = ctx.createBufferSource(), rlp = ctx.createBiquadFilter(), rg = ctx.createGain();
  rum.buffer = nb; rum.loop = true; rlp.type = 'lowpass'; rlp.frequency.value = 170; rg.gain.value = 0.16;
  rum.connect(rlp); rlp.connect(rg); rg.connect(master); rum.start(); st.rumble = rg;
  st.road = master; st.pan = pan;
  master.gain.setTargetAtTime(0.85, ctx.currentTime + 0.05, 1.2);          // fade in, to well under the goal cheer
  st.nextCar = ctx.currentTime + 1.5; st.nextHorn = ctx.currentTime + 4 + R() * 6; st.nextMurmur = ctx.currentTime;
  return st;
}
function ambTick(st, until) {
  const ctx = st.ctx, R = st.rng;
  for (const k of st.talkers) {                                            // syllables, scheduled a little ahead
    while (k.next < until) {
      const t = Math.max(k.next, ctx.currentTime);
      if (!k.talking) { k.talking = true; k.left = 0.8 + R() * 3.2; k.laugh = R() < 0.07; k.next = t; continue; }
      const dur = k.laugh ? 0.11 + R() * 0.04 : 0.1 + R() * 0.14, gap = k.laugh ? 0.05 : 0.02 + R() * 0.07;
      const v = k.laugh ? VOWELS[0] : VOWELS[(R() * VOWELS.length) | 0], f0 = k.f0 * (k.laugh ? 1.5 : 0.9 + R() * 0.25);
      k.o.frequency.setTargetAtTime(f0, t, 0.03);
      k.f1.frequency.setTargetAtTime(v[0] * (0.92 + R() * 0.16), t, 0.02); k.f2.frequency.setTargetAtTime(v[1] * (0.92 + R() * 0.16), t, 0.02);
      const peak = k.loud * (k.laugh ? 1.4 : 0.6 + R() * 0.6);
      k.g.gain.setTargetAtTime(peak, t, 0.018); k.g.gain.setTargetAtTime(0.0001, t + dur, 0.025);
      k.left -= dur + gap; k.next = t + dur + gap;
      if (k.left <= 0) { k.talking = false; k.next += 0.5 + R() * 2.8; }  // a pause between phrases
    }
  }
  while (st.nextMurmur < until) {                                          // the murmur drifts up and down
    st.murmur.gain.setTargetAtTime(0.03 + R() * 0.035, Math.max(st.nextMurmur, ctx.currentTime), 1.2); st.nextMurmur += 2 + R() * 3;
  }
  while (st.nextCar < until) { const t = Math.max(st.nextCar, ctx.currentTime); passBy(st, t); st.nextCar = t + 4 + R() * 9; }
  while (st.nextHorn < until) { const t = Math.max(st.nextHorn, ctx.currentTime); horn(st, t); st.nextHorn = t + 6 + R() * 16; }
}
/* a vehicle going past on the road: a swell of tyre noise (or a motorbike's engine) moving across from one side to the other */
function passBy(st, t) {
  const ctx = st.ctx, R = st.rng, dir = R() < 0.5 ? -1 : 1, d = 2.6 + R() * 2.4, g = ctx.createGain(), p = st.pan(-0.9 * dir);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 + R() * 0.06, t + d * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  if (p) { p.pan.setValueAtTime(-0.9 * dir, t); p.pan.linearRampToValueAtTime(0.9 * dir, t + d); g.connect(p); p.connect(st.road); } else g.connect(st.road);
  if (R() < 0.35) {                                                        // a motorbike
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), f = 62 + R() * 40;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + d);
    lp.type = 'lowpass'; lp.frequency.value = 700; o.connect(lp); lp.connect(g); o.start(t); o.stop(t + d + 0.1);
  } else {
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter();
    n.buffer = noiseBuf(ctx); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(820, t + d * 0.5); bp.frequency.linearRampToValueAtTime(240, t + d);
    n.connect(bp); bp.connect(g); n.start(t, R() * 2); n.stop(t + d + 0.1);
  }
}
/* horns from the road: a car's double beep, an auto-rickshaw's rubber bulb, or a bus */
function horn(st, t) {
  const ctx = st.ctx, R = st.rng, kind = R(), p = st.pan(-0.8 + R() * 1.6), out = ctx.createGain();
  out.gain.value = 0.55; if (p) { out.connect(p); p.connect(st.road); } else out.connect(st.road);
  const beep = (at, len, freqs, type, vol, drop = 1) => {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.015); g.gain.setValueAtTime(vol, at + len - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    for (const f of freqs) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * drop, at + len); o.connect(lp); o.start(at); o.stop(at + len + 0.05); }
  };
  if (kind < 0.45) { const n = R() < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) beep(t + i * 0.28, 0.2 + R() * 0.1, [410, 515], 'square', 0.035); }
  else if (kind < 0.8) { for (let i = 0; i < 2; i++) beep(t + i * 0.24, 0.17, [330], 'triangle', 0.09, 0.72); }      // paa-pom
  else beep(t, 0.6 + R() * 0.4, [240, 302], 'sawtooth', 0.025);
}
/* a bicycle bell: two quick rings of a bright, slightly clashing metal tone */
function bell(pan = 0, vol = 0.05) {
  const ctx = SND.ctx; if (!SND.on || !ctx || ctx.state !== 'running' || !AMB.st) return;
  const t = ctx.currentTime + 0.02, out = ctx.createGain(), p = AMB.st.pan(clamp(pan, -1, 1));
  out.gain.value = vol; if (p) { out.connect(p); p.connect(AMB.st.master); } else out.connect(AMB.st.master);
  for (let r = 0; r < 2; r++) for (const [f, a] of [[2650, 1], [3980, 0.6], [5300, 0.35]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), at = t + r * 0.16;
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(a, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.45);
  }
}
const AMB = { st: null, timer: 0 };
function ambStart() {
  if (AMB.st || !SND.on || !SND.ctx) return;
  try { AMB.st = ambBuild(SND.ctx, SND.ctx.destination); } catch (e) { AMB.st = null; return; }
  AMB.timer = setInterval(() => { if (AMB.st && SND.ctx.state === 'running') { try { ambTick(AMB.st, SND.ctx.currentTime + 0.45); } catch (e) {} } }, 150);
}
addEventListener('pointerdown', () => ambStart(), { passive: true }); addEventListener('keydown', () => ambStart()); addEventListener('touchend', () => ambStart(), { passive: true });
document.addEventListener('visibilitychange', () => {                     // silence when the tab is hidden, back when it returns
  if (!SND.ctx) return;
  try { if (document.hidden) SND.ctx.suspend(); else if (SND.on) SND.ctx.resume(); } catch (e) {}
});

/* ───────────── old men cycling past: along the lane behind the wall, and on the road ───────────── */
const CYC = [];
function tubeM(a, b, r, colr) {                                            // a tube from point a to point b, as a mergeParts piece
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
  return [new THREE.CylinderGeometry(r, r, len, 6), m, colr];
}
/* a black roadster of the kind every para has: upright, rod brakes, a chain case, a carrier on the back (sometimes a sack, sometimes milk cans) */
function buildBike(rng, frame) {
  const g = new THREE.Group(), steel = '#9aa0a2', black = '#16171a', rubber = '#121212', WR = 17, RA = [0, WR, -27], FA = [0, WR, 28];
  const mat = CR.mat, mk = (parts, parent = g) => { const m = new THREE.Mesh(mergeParts(parts), mat); m.castShadow = !LOWSPEC; parent.add(m); return m; };
  const crank = [0, 15, -2], seat = [0, 45, -9], head = [0, 47, 20], headLo = [0, 37, 21.5];
  const parts = [tubeM(crank, seat, 1.5, frame), tubeM([0, 44, -8], head, 1.5, frame), tubeM(crank, headLo, 1.6, frame),
    tubeM([3, 15, -2], [3, WR, -27], 1.1, frame), tubeM([-3, 15, -2], [-3, WR, -27], 1.1, frame), tubeM([2.6, 43, -9], [3, WR, -27], 1, frame), tubeM([-2.6, 43, -9], [-3, WR, -27], 1, frame),
    tubeM(head, headLo, 1.9, frame), tubeM([2.6, 38, 21.5], [2.4, WR, 28], 1.1, frame), tubeM([-2.6, 38, 21.5], [-2.4, WR, 28], 1.1, frame),
    tubeM(head, [0, 54, 20], 1.1, steel), tubeM([-13, 54, 15], [13, 54, 15], 0.9, steel), tubeM([0, 54, 20], [0, 54, 15], 0.9, steel),
    tubeM([-13, 54, 15], [-15, 53, 9], 0.9, steel), tubeM([13, 54, 15], [15, 53, 9], 0.9, steel),
    [new THREE.CylinderGeometry(1.4, 1.4, 6, 8), MX(-15.5, 53, 7, Math.PI / 2, 0, 0), black], [new THREE.CylinderGeometry(1.4, 1.4, 6, 8), MX(15.5, 53, 7, Math.PI / 2, 0, 0), black],   // grips
    [new THREE.SphereGeometry(1.7, 8, 6), MX(-9, 55.6, 15), '#c9ccc8'],                                                         // the bell
    [new THREE.BoxGeometry(8, 3, 12), MX(0, 47.5, -11, 0.08, 0, 0), '#4a2c1c'], [new THREE.CylinderGeometry(0.8, 0.8, 4, 6), MX(0, 45.5, -10), steel],   // saddle
    [new THREE.BoxGeometry(3.5, 7, 26), MX(4.4, 16, -14, -0.06, 0, 0), frame],                                                 // chain case
    [new THREE.BoxGeometry(12, 1.4, 22), MX(0, 37, -29), steel], tubeM([5.5, 36, -38], [3, WR, -27], 0.7, steel), tubeM([-5.5, 36, -38], [-3, WR, -27], 0.7, steel),
    [new THREE.TorusGeometry(WR + 2.2, 1.1, 4, 14, Math.PI * 0.9), MX(0, WR, -27, 0, Math.PI / 2, 0.15 * Math.PI), black],      // mudguards
    [new THREE.TorusGeometry(WR + 2.2, 1.1, 4, 14, Math.PI * 0.75), MX(0, WR, 28, 0, Math.PI / 2, 0.12 * Math.PI), black]];
  const load = rng();
  if (load < 0.4) parts.push([new THREE.SphereGeometry(8, 10, 8), MX(0, 44, -30, 0, 0, 0, 1, 0.75, 1.35), '#b89a62']);          // a jute sack
  else if (load < 0.7) for (const x of [-6.5, 6.5]) { parts.push([new THREE.CylinderGeometry(4.6, 5, 13, 12), MX(x, 44.5, -29), '#c3c7c6']); parts.push([new THREE.CylinderGeometry(2.4, 3.6, 3, 10), MX(x, 52.5, -29), '#c3c7c6']); }   // milk cans
  mk(parts);
  const wheel = (at) => {
    const w = new THREE.Group(); w.position.set(at[0], at[1], at[2]); g.add(w);
    const wp = [[new THREE.TorusGeometry(WR, 1.5, 6, 26), MX(0, 0, 0, 0, Math.PI / 2, 0), rubber], [new THREE.TorusGeometry(WR - 1.6, 0.5, 4, 26), MX(0, 0, 0, 0, Math.PI / 2, 0), steel],
      [new THREE.CylinderGeometry(1.6, 1.6, 4.5, 8), MX(0, 0, 0, 0, 0, Math.PI / 2), steel]];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; wp.push(tubeM([0, 0, 0], [0, Math.cos(a) * (WR - 1.6), Math.sin(a) * (WR - 1.6)], 0.22, steel)); }
    mk(wp, w); return w;
  };
  const crk = new THREE.Group(); crk.position.set(0, 15, -2); g.add(crk);
  mk([[new THREE.CylinderGeometry(6, 6, 0.9, 16), MX(4.4, 0, 0, 0, 0, Math.PI / 2), '#2a2a2c'], [new THREE.BoxGeometry(1.2, 1.6, 9), MX(5.8, 0, 4.5), steel], [new THREE.BoxGeometry(1.2, 1.6, 9), MX(-5.8, 0, -4.5), steel],
    [new THREE.BoxGeometry(5, 1.2, 3), MX(8.6, 0, 9), black], [new THREE.BoxGeometry(5, 1.2, 3), MX(-8.6, 0, -9), black]], crk);
  return { g, front: wheel(FA), rear: wheel(RA), crank: crk, WR };
}
/* routes: [x from, x to, y, which way]; the lane behind the wall runs between the shops and the crowd */
function buildCyclists() {
  const rng = mul32(9071), lanes = [{ y: F.T - 46, x0: -420, x1: 2120, lane: true }, { y: F.T - 46, x0: -420, x1: 2120, lane: true }, { y: F.B + 225, x0: -620, x1: 2320 }, { y: F.B + 300, x0: -620, x1: 2320 }];
  for (const [i, r] of lanes.entries()) {
    if (LOWSPEC && (i === 1 || i === 3)) continue;
    const rig = new THREE.Group(); rig.visible = false; world.add(rig);
    const bike = buildBike(rng, ['#16171a', '#16171a', '#1f3a2c', '#4a1f22'][i % 4]); rig.add(bike.g);
    const s = fanSpec(rng, rng() < 0.6 ? 'old' : 'lungi');
    s.skirt = null; s.hem = null; s.bottom = s.kind === 'old' ? '#e9e5da' : '#3a3530'; s.cup = s.phone = false; s.scale = 0.93; s.mous = true;   // trousers for pedalling
    if (s.kind === 'lungi') { s.style = rng() < 0.5 ? 'bald' : 'short'; s.hair = '#bdb8ae'; }
    const f = buildFan(s); world.remove(f.root); rig.add(f.root);
    f.root.position.set(0, 0, -9);
    CYC.push({ rig, bike, f, route: r, x: 0, dir: 1, v: 0, wait: 2 + i * 5 + rng() * 6, crank: rng() * 6, rolled: 0, rang: false, look: 0, rng });
  }
}
/* two-bone leg reach: put the foot (ankle) on the pedal; works in the rider's own units */
function legTo(thigh, knee, dy, dz) {
  const a = 26.5, b = 28, L = Math.min(Math.hypot(dy, dz), a + b - 0.5), al = Math.atan2(-dz, -dy);
  const be = Math.acos(clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1)), kn = Math.PI - Math.acos(clamp((a * a + b * b - L * L) / (2 * a * b), -1, 1));
  thigh.rotation.x = al - be; knee.rotation.x = kn;
}
function updateCyclists(dt, t) {
  for (const c of CYC) {
    const r = c.route;
    if (!c.rig.visible) {
      if ((c.wait -= dt) > 0) continue;
      c.dir = c.rng() < 0.5 ? 1 : -1; c.x = c.dir > 0 ? r.x0 : r.x1; c.v = 75 + c.rng() * 45; c.rang = c.rng() < 0.35; c.rig.visible = true;   // only some ring their bell
    }
    c.x += c.dir * c.v * dt;
    const wob = Math.sin(t * 1.3 + c.crank) * 0.035;                       // the slight weave of an unhurried rider
    c.rig.position.set(c.x, 0, r.y + Math.sin(t * 0.4 + c.crank) * 3); c.rig.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; c.rig.rotation.z = wob * 0.5;
    const roll = c.v * dt / c.bike.WR; c.bike.front.rotation.x += roll; c.bike.rear.rotation.x += roll; c.crank += roll / 2.4; c.bike.crank.rotation.x = c.crank;
    /* the rider: hands on the bars, a slight stoop, feet on the pedals, and a long look at the game as he passes */
    const f = c.f, s = f.s.scale, k = 1 / s;
    f.body.position.y = 52.5 * k - 58; f.torso.rotation.x = 0.2; f.hips.rotation.x = 0;
    f.armL.rotation.x = f.armR.rotation.x = -0.95; f.armL.rotation.z = 0.12; f.armR.rotation.z = -0.12; f.elbL.rotation.x = f.elbR.rotation.x = -0.35;
    for (const [side, th, kn, ph] of [[1, f.legL, f.kneeL, 0], [-1, f.legR, f.kneeR, Math.PI]]) {
      const a = c.crank + ph, pz = -2 + 9 * Math.cos(a), py = 15 - 9 * Math.sin(a);                   // the pedal, in bike units
      const hipY = (f.body.position.y + 58 - 2) * s, hipZ = -9;                                      // the hip joint, in bike units
      legTo(th, kn, (py + 2.5 - hipY) * k, (pz - 2 - hipZ) * k);   // ankle just behind the pedal, so the ball of the foot is on it
    }
    const near = c.x > F.L - 100 && c.x < F.R + 100;
    let want = 0;
    if (near) { const toBall = Math.atan2(ball.y - r.y, ball.x - c.x), facing = c.dir > 0 ? 0 : Math.PI; want = clamp(-wrapA(toBall - facing), -1.2, 1.2); }
    c.look += (want - c.look) * Math.min(1, dt * 2);
    f.head.rotation.y = c.look; f.head.rotation.x = 0.05;
    if (c.rang && Math.abs(c.x - F.cx) < 500) { c.rang = false; bell(clamp((c.x - F.cx) / 900, -1, 1), r.lane ? 0.05 : 0.035); }
    if ((c.dir > 0 && c.x > r.x1) || (c.dir < 0 && c.x < r.x0)) { c.rig.visible = false; c.wait = 6 + c.rng() * 16; }
  }
}
