(() => {
'use strict';

/* ───────────── constants (all distances in court units; 50 units ≈ 1 m) ───────────── */
const TAU = Math.PI * 2;
const F = { L: 150, R: 1550, T: 236, B: 856 };          // playing area in ground coords (x across, y towards the side camera)
F.cx = (F.L + F.R) / 2; F.cy = (F.T + F.B) / 2;
const GOAL = { half: 84, depth: 44, post: 5, h: 100 };
const NT = 3, NP = 6, FPI = 2;                          // three a side: slot 0 keeps goal, slot 1 is the back, slot 2 the forward; in first person you are kid 2
const GY1 = F.cy - GOAL.half, GY2 = F.cy + GOAL.half;
const PR = 17, BR = 9;                                   // player / ball collision radius
const STEP = 1 / 120;
const MAX_SPEED = 262, WITH_BALL = 0.93, ACC = 1500, DEC = 2100;
/* how good the opposing CPU is: running speed, shooting range and scatter, thinking time, patience on the ball, and how often a tackle comes off */
const LEVELS = {
  easy:   { speed: 150, range: 330, err: 0.95, think: 0.45, hold: 0.9,  poke: 0.04, tackle: 0.3,  gk: 110, dive: 120, gkAcc: 450, save: 0.15 },
  medium: { speed: 205, range: 300, err: 0.55, think: 0.2,  hold: 0.45, poke: 0.14, tackle: 0.75, gk: 160, dive: 185, gkAcc: 700, save: 0.4 },
  hard:   { speed: 228, range: 280, err: 0.3,  think: 0.1,  hold: 0.22, poke: 0.28, tackle: 1,    gk: 190, dive: 220, gkAcc: 900, save: 0.55 }
};
let level = 'medium';
const TUNE = { weave: 0.4, steer: 9, jockey: true };
const brain = p => (p.team === 1 && !S.demo && S.mode !== 'net') ? LEVELS[level] : LEVELS.hard;   // your own teammate always plays at full strength
const SHOT = 780, KICK_REACH = 13, KICK_CD = 0.32, KICK_ANIM = 0.26;
const GRAV = 900, AIR_DRAG = 0.22, ROLL_DRAG = 0.9, ROLL_FRIC = 46, BOUNCE = 0.55, WALL_REST = 0.62;
const TRAP_SPEED = 440;                                  // a ball arriving faster than this cannot be trapped, it comes off the body
const WIN = 5;

/* original kids: a keeper, a back and a forward on each side (the first NP looks are used) */
const LOOKS = [
  { skin: '#9a6845', hair: '#120e0b', style: 'crop', shoe: '#2a2a2e', vest: false, s: 1.04 },
  { skin: '#8f5d3b', hair: '#120e0b', style: 'mop',  shoe: null,      vest: true,  s: 0.95 },
  { skin: '#b98058', hair: '#17110d', style: 'part', shoe: '#e9e6dc', vest: false, s: 1.0 },
  { skin: '#a9744f', hair: '#17110d', style: 'crop', shoe: '#e9e6dc', vest: false, s: 1.0 },
  { skin: '#7d5234', hair: '#0e0b09', style: 'mop',  shoe: null,      vest: true,  s: 0.93 },
  { skin: '#a9744f', hair: '#0e0b09', style: 'part', shoe: '#e9e6dc', vest: false, s: 1.03 },
  { skin: '#7d5234', hair: '#120e0b', style: 'crop', shoe: null,      vest: true,  s: 0.96 },
  { skin: '#9a6845', hair: '#17110d', style: 'mop',  shoe: '#2a2a2e', vest: false, s: 1.0 },
  { skin: '#b98058', hair: '#17110d', style: 'part', shoe: null,      vest: false, s: 0.96 },
  { skin: '#8f5d3b', hair: '#0e0b09', style: 'crop', shoe: '#2a2a2e', vest: true,  s: 1.0 }
];
const KIT = [
  { jersey: '#c8302a', trim: '#f2c230', gkJersey: '#2d3440', gkTrim: '#f2c230', shorts: ['#1c1c20', '#b39a68', '#1c1c20'], nums: ['1', '4', '10'] },
  { jersey: '#1c7a4c', trim: '#7d1f2e', gkJersey: '#d9731c', gkTrim: '#22304a', shorts: ['#22304a', '#efece2', '#22304a'], nums: ['1', '6', '9'] }
];
const KIDS = [0, 1, 3, 5, 6, 8].slice(0, NP).map(j => LOOKS[j]).map((l, i) => { const k = KIT[i < NT ? 0 : 1], sl = i % NT, gk = sl === 0;
  return Object.assign({}, l, { gk, num: k.nums[sl], jersey: gk ? k.gkJersey : k.jersey, trim: gk ? k.gkTrim : k.trim, shorts: k.shorts[sl], vest: gk ? false : l.vest }); });

/* ───────────── state ───────────── */
const S = { mode: null, phase: 'menu', paused: false, hold: false, score: [0, 0], scorer: 0, timer: 0, clock: 0, demo: false, still: 0, ax: 0, ay: 0 };
const TEAM = [
  { dir: 1, goalX: F.R, ownX: F.L, players: [0, 1, 2], gk: 0, ctrl: 2, chaser: 2, sw: 0, recv: 0 },
  { dir: -1, goalX: F.L, ownX: F.R, players: [3, 4, 5], gk: 3, ctrl: 5, chaser: 5, sw: 0, recv: 0 }
];
const HOME0 = [[F.L + 30, F.cy], [F.L + 340, F.cy + 95], [F.cx - 160, F.cy - 50]];
const HOME = [...HOME0, ...HOME0.map(([x, y]) => [2 * F.cx - x, 2 * F.cy - y])];   // the other three mirror these through the centre spot
/* where each outfielder likes to be: depth up the pitch (0 own line, 1 theirs), side (-1 far touchline, 1 near), and how far it follows the ball */
const SLOT = [null, { d: 0.27, l: 0.22, push: 0.55, min: 0.1, max: 0.66, shift: 0.45, back: true }, { d: 0.58, l: -0.36, push: 0.55, min: 0.3, max: 0.9, shift: 0.3 }];
const mkPlayer = i => ({ i, team: i < NT ? 0 : 1, slot: i % NT, gk: i % NT === 0, x: 0, y: 0, vx: 0, vy: 0, fx: 1, fy: 0, ang: 0, phase: 0, kickCd: 0, kickAnim: 0, noCap: 0, kc: 0 });
const P = Array.from({ length: NP }, (_, i) => mkPlayer(i));
const ball = { x: F.cx, y: F.cy, vx: 0, vy: 0, h: 0, vh: 0, owner: -1, protect: 0 };
const keys = new Set();
const kickBuf = [0, 0], passBuf = [0, 0];
const INPUT = [{ mx: 0, my: 0 }, { mx: 0, my: 0 }];        // movement asked for by each side's human
const AI = P.map(() => ({ t: 0, tx: 0, ty: 0, mx: 0, my: 0, side: 0, flank: 0, held: 0, kick: null, dir: 0, jockey: false, runT: 0, cut: false, dive: false, lane: 0 }));
const FP = { yaw: 0, pitch: 0.3, look: 0, turn: 0 };
let myTeam = 0;                                          // 1 only for the guest of an online match
let seed = 987654321;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ───────────── DOM ───────────── */
const $ = id => document.getElementById(id);
const app = $('app'), shell = $('shell'), hud = $('hud'), frameEl = $('frame'), cv = $('cv');
for (const id of ['pips1', 'pips2']) $(id).innerHTML = '<i></i>'.repeat(WIN);

const inMatch = () => S.phase === 'kickoff' || S.phase === 'play' || S.phase === 'goal';
const isFP = () => S.mode === 'fp';
const isNet = () => S.mode === 'net';
const isGuest = () => S.mode === 'net' && N.role === 'guest';
const humanTeam = t => !S.demo && (t === 0 || S.mode === 'net');
const teamName = t => t === myTeam ? 'You' : (isNet() ? 'Opponent' : 'CPU');
const says = (t, verb) => teamName(t) + ' ' + (teamName(t) === 'You' ? verb : verb + 's');
function updateHud() {
  $('s1').textContent = S.score[0]; $('s2').textContent = S.score[1];
  [...$('pips1').children].forEach((e, k) => e.classList.toggle('on', WIN - 1 - k < S.score[0]));
  [...$('pips2').children].forEach((e, k) => e.classList.toggle('on', k < S.score[1]));
  $('n1').textContent = teamName(0); $('n2').textContent = teamName(1);
  $('pauseBtn').disabled = !(inMatch() || (isNet() && S.phase === 'over'));
  $('pauseBtn').textContent = isNet() ? 'Leave' : (S.paused ? 'Resume' : 'Pause');
}

/* ───────────── match flow ───────────── */
function resetPositions() {
  P.forEach((p, i) => {
    p.x = HOME[i][0]; p.y = HOME[i][1]; p.vx = p.vy = 0;
    p.fx = TEAM[p.team].dir; p.fy = 0; p.ang = p.team ? Math.PI : 0; p.kickCd = 0; p.kickAnim = 0; p.noCap = 0; p.phase = 0;
  });
  TEAM.forEach(t => { t.ctrl = t.chaser = t.players[NT - 1]; t.sw = 0; t.recv = 0; });
  Object.assign(ball, { x: F.cx, y: F.cy, vx: 0, vy: 0, h: 0, vh: 0, owner: -1, protect: 0 });
  kickBuf[0] = kickBuf[1] = passBuf[0] = passBuf[1] = 0;
  AI.forEach((a, i) => { a.t = (i % NT) * 0.02; a.flank = 0; a.kick = null; a.held = 0; a.jockey = false; a.dive = false; a.runT = i * 0.37 % 2; a.cut = i % 2 === 0; a.dir = P[i].ang; a.tx = P[i].x; a.ty = P[i].y; });
  FP.yaw = 0; FP.pitch = 0.3; FP.look = 0; FP.turn = 0;
  S.still = 0; S.ax = ball.x; S.ay = ball.y;
}
function show(id, on) { $(id).hidden = !on; }
function hideOverlays() { for (const id of ['menu', 'over', 'pause', 'banner', 'online']) show(id, false); }
function startMatch(mode, score) {
  S.mode = mode; S.score = score ? [score[0] | 0, score[1] | 0] : [0, 0];
  S.paused = S.hold = false; S.phase = 'kickoff'; S.timer = 1.0;
  resetPositions(); keys.clear(); hideOverlays(); updateHud();
  frameEl.focus({ preventScroll: true });
}
function toMenu() {
  S.phase = 'menu'; S.paused = S.hold = false; S.score = [0, 0]; S.mode = S.mode === 'fp' ? 'fp' : 'cpu'; myTeam = 0;
  resetPositions(); keys.clear(); hideOverlays(); show('menu', true); updateHud();
}
function setPaused(v) {
  if (isNet()) {                                          // an online match cannot stop: this only asks about leaving
    S.hold = v; keys.clear();
    $('pauseTitle').textContent = 'Leave the match?'; $('btnResume').textContent = 'Keep playing'; $('btnRestart').hidden = true; $('btnQuit').textContent = 'Leave match';
    show('pause', v); if (v) $('btnResume').focus({ preventScroll: true }); else frameEl.focus({ preventScroll: true });
    return;
  }
  if (!inMatch()) return;
  S.paused = v; keys.clear(); kickBuf[0] = kickBuf[1] = passBuf[0] = passBuf[1] = 0;
  $('pauseTitle').textContent = 'Paused'; $('btnResume').textContent = 'Resume'; $('btnRestart').hidden = false; $('btnQuit').textContent = 'Change mode';
  show('pause', v); updateHud();
  if (v) $('btnResume').focus({ preventScroll: true }); else frameEl.focus({ preventScroll: true });
}
function showGoal(t) { $('bannerWho').textContent = says(t, 'score'); show('banner', true); }
function scored(t) {
  S.score[t]++; S.scorer = t; S.phase = 'goal'; S.timer = 1.7;
  showGoal(t); updateHud();
  const happy = teamName(t) === 'You'; playGoal(happy); crowdReact('goal', happy);
}
function showOver() {
  const w = S.score[0] > S.score[1] ? 0 : 1;
  $('overTitle').textContent = says(w, 'win');
  $('finalScore').textContent = S.score[0] + ' : ' + S.score[1];
  const guest = isGuest();
  $('btnAgain').hidden = guest; $('overNote').hidden = !guest; $('btnMode').textContent = isNet() ? 'Leave match' : 'Change mode';
  show('banner', false); show('pause', false); S.hold = false; show('over', true); updateHud();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  if (!guest) setTimeout(() => { if (S.phase === 'over') $('btnAgain').focus({ preventScroll: true }); }, 900);
}
function endMatch() { S.phase = 'over'; keys.clear(); showOver(); }
function quit() { if (isNet()) { leaveMatch(); toMenu(); openOnline(); } else toMenu(); }

function setLevel(l) {
  if (!LEVELS[l]) return;
  level = l;
  document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === l)));
  try { localStorage.setItem('psf-level', l); } catch (e) {}
}
document.querySelectorAll('#levels button').forEach(b => { b.onclick = () => setLevel(b.dataset.level); });
try { setLevel(localStorage.getItem('psf-level') || 'medium'); } catch (e) { setLevel('medium'); }
$('btnCpu').onclick = () => startMatch('cpu');
$('btnFp').onclick = () => startMatch('fp');
$('btnAgain').onclick = () => startMatch(S.mode);
$('btnMode').onclick = quit;
$('btnResume').onclick = () => setPaused(false);
$('btnRestart').onclick = () => startMatch(S.mode);
$('btnQuit').onclick = quit;
$('pauseBtn').onclick = () => setPaused(isNet() ? !S.hold : !S.paused);
$('btnHost').onclick = () => hostMatch();
$('btnNetBack').onclick = () => { leaveMatch(); show('online', false); toMenu(); };

/* ───────────── input ───────────── */
const SHOOT_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']), PASS_KEYS = new Set(['KeyF', 'ShiftRight']);
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...SHOOT_KEYS, ...PASS_KEYS]);
const playing = () => inMatch() && !S.paused && !S.hold;
addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (inMatch()) { e.preventDefault(); setPaused(isNet() ? !S.hold : !S.paused); } return; }
  if (!GAME_KEYS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (playing()) {
    e.preventDefault();                                    // no page scroll, no button activation mid-match
    if (e.repeat) return;
    keys.add(e.code);
    if (SHOOT_KEYS.has(e.code)) { if (isGuest()) N.kSeq++; else kickBuf[myTeam] = 0.16; }
    else if (PASS_KEYS.has(e.code)) { if (isGuest()) N.pSeq++; else passBuf[myTeam] = 0.16; }
  } else if (e.code.startsWith('Arrow') || (e.code === 'Space' && !(e.target instanceof HTMLButtonElement))) {
    e.preventDefault();                                    // menus: still never scroll the page
  }
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (GAME_KEYS.has(e.code) && playing()) e.preventDefault();
});
addEventListener('blur', () => { keys.clear(); if (inMatch() && !S.paused && !isNet()) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inMatch() && !S.paused && !isNet()) setPaused(true); });

const IDLE = { mx: 0, my: 0 };
const held = (a, b) => keys.has(a) || keys.has(b);
function localMove() {                                     // side view: screen directions
  if (!playing()) return IDLE;
  let x = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0), y = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  if (TOUCH.x || TOUCH.y) { x += TOUCH.x; y += TOUCH.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } }   // the thumbstick is analogue: a small push walks
  return { mx: x, my: y };
}
/* First person: one set of keys both moves and turns you. W runs the way you look and A/D steer, so turning while running carves a curve:
   the turn builds up and eases off rather than snapping, it is quicker standing still than at a sprint or with the ball, and a hard turn at speed costs pace. */
const TURN = { still: 3.4, sprint: 2.0, ball: 0.85, ramp: 9, carve: 0.22 };
function fpMove(dt) {
  if (!playing()) { FP.turn = 0; return { mx: 0, my: 0, face: FP.yaw }; }
  const p = P[FPI], run = Math.min(1, Math.hypot(p.vx, p.vy) / MAX_SPEED);
  const fwd = clamp((held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0) - TOUCH.y, -1, 1);   // thumbstick: push up to run, sideways to steer
  const steer = clamp((held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0) + TOUCH.x, -1, 1), str = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  const max = (TURN.still + (TURN.sprint - TURN.still) * run) * (ball.owner === FPI ? TURN.ball : 1);
  FP.turn += (steer * max - FP.turn) * Math.min(1, dt * TURN.ramp);       // angular speed eases towards what the keys ask for
  FP.yaw += FP.turn * dt;
  const cs = Math.cos(FP.yaw), sn = Math.sin(FP.yaw);
  let f = fwd > 0 ? fwd * (1 - TURN.carve * Math.abs(FP.turn) / TURN.still * run) : fwd * 0.6;   // braking or backing off is slower than running
  let mx = cs * f - sn * str * 0.8, my = sn * f + cs * str * 0.8; const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  return { mx, my, face: FP.yaw };
}
cv.addEventListener('click', () => {                         // optional mouse look
  if (isFP() && playing() && !TOUCH.on && document.pointerLockElement !== cv) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === cv && isFP() && playing()) { FP.yaw += e.movementX * 0.0026; FP.look = clamp(FP.look + e.movementY * 0.002, -0.6, 0.5); }
});

/* ───────────── touch controls: a thumbstick anywhere on the left half of the court, Shoot and Pass on the right ───────────── */
const UA = navigator.userAgent || '', mq = q => !!(window.matchMedia && matchMedia(q).matches);
const MOBILE = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA)) || (mq('(pointer: coarse)') && !mq('(any-pointer: fine)'));
const LOWSPEC = MOBILE;                                      // phones get fewer pixels, softer shadows and a smaller crowd
const TOUCH = { on: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
function setTouchMode(on) { TOUCH.on = on; document.body.classList.toggle('touch-mode', on); updateFsBtn(); }
const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
const stickR = () => stickBase.offsetWidth / 2 || 50;
function stickRelease() { TOUCH.id = null; TOUCH.x = TOUCH.y = 0; stickBase.classList.remove('live'); stickBase.style.left = stickBase.style.top = ''; stickKnob.style.transform = ''; }
function stickMove(e) {
  if (e.pointerId !== TOUCH.id) return;
  const r = stickZone.getBoundingClientRect(), R = stickR();
  let dx = e.clientX - r.left - TOUCH.ox, dy = e.clientY - r.top - TOUCH.oy; const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  stickKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
  const ux = dx / R, uy = dy / R, l = Math.hypot(ux, uy), k = l < 0.14 ? 0 : (l - 0.14) / 0.86 / l;   // a small dead zone in the middle
  TOUCH.x = ux * k; TOUCH.y = uy * k;
}
stickZone.addEventListener('pointerdown', e => {
  if (TOUCH.id !== null) return;
  e.preventDefault(); setTouchMode(true);
  TOUCH.id = e.pointerId; try { stickZone.setPointerCapture(e.pointerId); } catch (err) {}
  const r = stickZone.getBoundingClientRect(), R = stickR();
  TOUCH.ox = clamp(e.clientX - r.left, R + 6, Math.max(R + 6, r.width - R - 6)); TOUCH.oy = clamp(e.clientY - r.top, R + 6, Math.max(R + 6, r.height - R - 6));
  stickBase.style.left = (TOUCH.ox - R) + 'px'; stickBase.style.top = (TOUCH.oy - R) + 'px'; stickBase.classList.add('live');
  stickMove(e);
});
stickZone.addEventListener('pointermove', stickMove);
for (const ev of ['pointerup', 'pointercancel']) stickZone.addEventListener(ev, e => { if (e.pointerId === TOUCH.id) stickRelease(); });
function tapAction(kind) {
  if (!playing()) return;
  if (kind === 'shoot') { if (isGuest()) N.kSeq++; else kickBuf[myTeam] = 0.16; }
  else { if (isGuest()) N.pSeq++; else passBuf[myTeam] = 0.16; }
}
for (const [id, kind] of [['tShoot', 'shoot'], ['tPass', 'pass']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); tapAction(kind); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('down'));
  b.addEventListener('contextmenu', e => e.preventDefault());
}
addEventListener('touchstart', () => { if (!TOUCH.on) setTouchMode(true); }, { passive: true });   // a touchscreen laptop gets the buttons as soon as it is touched

/* scoreboard buttons: sound on or off, and full screen on phones that allow it */
function updateSoundBtn() { const b = $('soundBtn'); b.textContent = SND.on ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(SND.on)); }
$('soundBtn').onclick = () => {
  SND.on = !SND.on; try { localStorage.setItem('psf-sound', SND.on ? 'on' : 'off'); } catch (e) {}
  if (SND.on) { audioUnlock(); ambStart(); } else if (SND.ctx) { try { SND.ctx.suspend(); } catch (e) {} }
  updateSoundBtn();
};
const fsOK = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
function updateFsBtn() { const b = $('fsBtn'); b.hidden = !(TOUCH.on && fsOK()); b.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; }
$('fsBtn').onclick = () => {
  try {
    if (document.fullscreenElement) { const r = document.exitFullscreen(); if (r && r.catch) r.catch(() => {}); return; }
    const r = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if (r && r.then) r.then(() => { try { const o = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (o && o.catch) o.catch(() => {}); } catch (e) {} }, () => {});
  } catch (e) {}
};
document.addEventListener('fullscreenchange', updateFsBtn);

/* ───────────── teams: who is on the ball ───────────── */
function pickRoles(tm, dt) {
  const t = tm.dir > 0 ? 0 : 1, b = ball, loose = b.owner < 0;
  const px = b.x + (loose ? b.vx * 0.25 : 0), py = b.y + (loose ? b.vy * 0.25 : 0);
  const d = i => Math.hypot(P[i].x - px, P[i].y - py);
  const ours = !loose && P[b.owner].team === t ? b.owner : -1, keeperHas = !loose && P[b.owner].gk;
  const nearest = (cur, margin) => { let best = cur, bd = d(cur) - margin; for (let k = 1; k < NT; k++) { const i = tm.players[k]; if (d(i) < bd) { bd = d(i); best = i; } } return best; };
  if (isFP() && t === 0 && !S.demo) { tm.ctrl = FPI; tm.chaser = keeperHas ? -1 : (ours >= 0 ? ours : nearest(tm.chaser < 0 ? FPI : tm.chaser, 34)); }   // your teammates think for themselves
  else if (humanTeam(t)) {
    // the human always plays the kid with the ball, or else whichever outfielder is nearest it
    tm.sw -= dt;
    if (ours >= 0 && ours !== tm.gk) { if (tm.ctrl !== ours) { tm.ctrl = ours; tm.sw = 0.3; } }
    else if (tm.sw <= 0) { const n = nearest(tm.ctrl, 40); if (n !== tm.ctrl) { tm.ctrl = n; tm.sw = 0.45; } }
    tm.chaser = tm.ctrl;
  } else tm.chaser = keeperHas ? -1 : (ours >= 0 ? ours : nearest(tm.chaser < 0 ? tm.players[NT - 1] : tm.chaser, 34));   // nobody harries a keeper with the ball in his hands
}
const others = team => TEAM[team ? 0 : 1].players;
function oppNear(team, to) {                                            // nearest opposing outfielder
  let best = null, bd = 1e9; const o = others(team);
  for (let k = 1; k < NT; k++) { const q = P[o[k]], dd = dist(q, to); if (dd < bd) { bd = dd; best = q; } }
  return best;
}
function laneClear(x1, y1, x2, y2, team, width) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, o = others(team);
  for (let k = 1; k < NT; k++) {
    const q = P[o[k]], t = clamp(((q.x - x1) * dx + (q.y - y1) * dy) / l2, 0, 1);
    if (Math.hypot(q.x - (x1 + dx * t), q.y - (y1 + dy * t)) < width) return false;
  }
  return true;
}
/* the best teammate to give it to: open, not marked, and ideally further up the pitch */
function bestPass(p, tm, anyway) {
  const b = ball, atk = tm.dir, L = F.R - F.L; let best = null, bs = -1e9;
  for (const i of tm.players) {
    if (i === p.i || (i === tm.gk && !anyway)) continue;
    const m = P[i], md = dist(m, b);
    if (md < 110 || md > 640 || !laneClear(b.x, b.y, m.x, m.y, p.team, 42)) continue;
    const mark = dist(oppNear(p.team, m), m); if (mark < 52) continue;
    const prog = (m.x - b.x) * atk, sc = prog / 300 + Math.min(mark, 200) / 400 - Math.abs(md - 320) / 1200 + (1 - Math.abs(tm.goalX - m.x) / L) * 0.6 - (i === tm.gk ? 1 : 0);
    if (sc > bs) { bs = sc; best = { m, md, prog, sc }; }
  }
  return best;
}
/* where an outfielder without the ball should be: his place in the shape, a slanting run, or goal-side of the kid he is marking */
function offBall(p, a, tm) {
  const b = ball, atk = tm.dir, s = SLOT[p.slot], L = F.R - F.L, Hh = (F.B - F.T) / 2, fwd = !s.back;
  const adv = clamp((b.x - tm.ownX) * atk / L, 0, 1), poss = b.owner >= 0 && P[b.owner].team === p.team, theirs = b.owner >= 0 && !poss;
  let d = s.d + (adv - 0.5) * s.push + (poss ? 0.07 : theirs ? -0.05 : 0), l = s.l;
  if (fwd && poss && adv > 0.4) {                                        // alternately hold the width, then slant in behind the defence
    if ((a.runT -= 0.12) <= 0) { a.runT = 1.5 + rnd() * 1.7; a.cut = !a.cut; }
    if (a.cut) { l = s.l * 0.2; d += 0.14; } else l = s.l * 1.12;
  } else if (!fwd && poss && adv > 0.5 && (b.y - F.cy) * s.l > 0) d += 0.1;   // the back on the ball's side steps up behind play
  d = clamp(d, s.min, s.max);
  let x = tm.ownX + atk * d * L, y = F.cy + l * Hh * 0.82 + (b.y - F.cy) * s.shift;
  a.jockey = theirs;
  if (theirs && !fwd) {                                                  // a back covers: he gets between the carrier and the goal, and steps in when the carrier arrives
    const ob = tm.players.find(i => i !== p.i && SLOT[P[i].slot] && SLOT[P[i].slot].back), other = ob === undefined ? null : P[ob], gx = b.x - tm.ownX, gy = b.y - F.cy, gl = Math.hypot(gx, gy) || 1;
    const off = q => Math.abs((q.x - tm.ownX) * gy - (q.y - F.cy) * gx) / gl + (tm.chaser === q.i ? 1e4 : 0);      // how far each back is from the carrier's line to goal
    if (!other || off(p) <= off(other) + (a.cover ? 40 : 0)) {           // with two backs, the one nearer that line takes it
      a.cover = true;
      const d = clamp(gl * 0.36, 80, 280); x = tm.ownX + gx / gl * d; y = F.cy + gy / gl * d;
      if (dist(p, b) < 150) { x = b.x; y = b.y; }
      a.tx = clamp(x, F.L + PR, F.R - PR); a.ty = clamp(y, F.T + PR, F.B - PR); return;
    }
  }
  a.cover = false;
  if (!poss && !fwd) {                                                   // the other back marks the nearest of their forwards, goal-side
    let m = null, md = 280; const o = others(p.team);
    for (let k = 1; k < NT; k++) { const q = P[o[k]]; if (q.i === b.owner || (q.x - tm.ownX) * atk > L * 0.62) continue; const dd = Math.hypot(q.x - x, q.y - y); if (dd < md) { md = dd; m = q; } }
    if (m) { const gx = tm.ownX - m.x, gy = F.cy - m.y, gl = Math.hypot(gx, gy) || 1; x = x * 0.4 + (m.x + gx / gl * 48) * 0.6; y = y * 0.4 + (m.y + gy / gl * 48) * 0.6; }
  }
  a.tx = clamp(x, F.L + PR, F.R - PR); a.ty = clamp(y, F.T + PR, F.B - PR);
}

/* ───────────── CPU brain ───────────── */
function cpuPlay(p, dt, onBall, mayAct) {
  const tm = TEAM[p.team], atk = tm.dir, a = AI[p.i], b = ball, K = brain(p);
  const own = b.owner === p.i;
  a.held = own ? a.held + dt : 0;
  a.t -= dt;
  let kick = null;
  if (a.t <= 0) {
    a.t = K.think + rnd() * 0.06;
    const op = oppNear(p.team, b);
    if (own && mayAct) {
      /* with the ball: carry it at goal, go round whoever is in the way, pass or shoot */
      const gd = Math.hypot(tm.goalX - b.x, F.cy - b.y), keeper = P[TEAM[p.team ? 0 : 1].gk];
      if (!a.side || rnd() < 0.05) a.side = Math.abs(keeper.y - F.cy) > 12 ? (keeper.y > F.cy ? -1 : 1) : (rnd() < 0.5 ? -1 : 1);   // aim for the side the keeper has left
      const gy = F.cy + a.side * GOAL.half * 0.7;
      const pressure = dist(op, p) < 74;
      const aimAt = (tx, ty, pw, lift, err) => {
        let dx = tx - b.x, dy = ty - b.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const e = (rnd() - 0.5) * err, c = Math.cos(e), s = Math.sin(e);
        return { dx: dx * c - dy * s, dy: dx * s + dy * c, pw, lift };
      };
      if (a.held > K.hold) {
        const bp = bestPass(p, tm, pressure && (b.x - tm.ownX) * atk < 420);
        if (gd < Math.min(230, K.range * 0.6) || (gd < K.range && laneClear(b.x, b.y, tm.goalX, gy, p.team, 30))) kick = aimAt(tm.goalX, gy, SHOT, 200, K.err);
        else if (bp && (bp.prog > 70 || pressure) && (bp.sc > 0.3 || pressure) && rnd() < (pressure ? 0.7 : 0.4)) kick = aimAt(bp.m.x + bp.m.vx * 0.2, bp.m.y + bp.m.vy * 0.2, clamp(260 + bp.md * 1.2, 380, 720), 40, K.err * 0.5);
        else if (a.held > 3 || (pressure && gd < 520 && rnd() < 0.1)) kick = aimAt(tm.goalX, gy, SHOT, 200, K.err * 1.6);
      }
      if (gd > 520 && (!a.lane || rnd() < 0.03)) a.lane = (p.y > F.cy ? 1 : -1) * (rnd() < 0.7 ? 1 : -1);            // far out: carry it up one channel or slant across to the other
      const far = gd > 470, ax = far ? tm.goalX - atk * 330 : tm.goalX - atk * 30, ay = far ? F.cy + a.lane * 150 : gy;
      let dx = ax - p.x, dy = ay - p.y, l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      for (let k = 1; k < NT; k++) { const o = P[others(p.team)[k]];
        const rx = o.x - p.x, ry = o.y - p.y, ahead = rx * dx + ry * dy, lat = -rx * dy + ry * dx;
        if (ahead > 0 && ahead < 140 && Math.abs(lat) < 52) {
          const qx = -dy, qy = dx;                                         // sideways, relative to the run
          let side = lat > 0 ? -1 : 1;
          if (p.y < F.T + 70) side = qy > 0 ? 1 : -1; else if (p.y > F.B - 70) side = qy > 0 ? -1 : 1;   // near a touchline, cut inside
          dx += qx * side * 1.15; dy += qy * side * 1.15; l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        }
      }
      if (gd > 260 && dist(op, p) > 150) {                               // with room ahead, weave on the way up instead of running a straight line
        const w = Math.sin(S.clock * 2.3 + p.i * 1.9) * TUNE.weave, qx = -dy, qy = dx;
        if (!((p.y < F.T + 60 && qy * w < 0) || (p.y > F.B - 60 && qy * w > 0))) { dx += qx * w; dy += qy * w; l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
      }
      a.mx = dx; a.my = dy; a.jockey = false;
    } else if (onBall && mayAct) {
      /* without it: meet a loose ball, or get goal-side of the carrier and go in for the tackle */
      const o = b.owner >= 0 ? P[b.owner] : null, db = dist(p, b);
      let tx, ty;
      a.press = o && db < 72 ? (a.press || 0) + K.think + 0.03 : 0;      // how long this kid has been right on the carrier
      if (o) {
        const lead = clamp(db / 400, 0, 0.3); tx = b.x + o.vx * lead; ty = b.y + o.vy * lead;
        if (db > 120) {                                                    // far off: cut the carrier off from our goal first
          const gx = tm.ownX - b.x, gy = F.cy - b.y, gl = Math.hypot(gx, gy) || 1, off = Math.min(56, db * 0.4);
          if (((p.x - b.x) * gx + (p.y - b.y) * gy) / gl < 12) { tx = b.x + gx / gl * off; ty = b.y + gy / gl * off; }
        } else {
          const ux = b.x - o.x, uy = b.y - o.y, ul = Math.hypot(ux, uy) || 1, rx = p.x - o.x, ry = p.y - o.y;
          if ((rx * ux + ry * uy) / ul < 14) {                             // the carrier is shielding it: go round to the ball side
            let sd = (-rx * uy + ry * ux) >= 0 ? 1 : -1;
            const spot = k => [o.x + (-uy / ul) * k * 50 + ux / ul * 30, o.y + (ux / ul) * k * 50 + uy / ul * 30];
            let [qx, qy] = spot(sd);
            if (qx < F.L + PR || qx > F.R - PR || qy < F.T + PR || qy > F.B - PR) [qx, qy] = spot(-sd);   // no room that side
            tx = qx; ty = qy;
          }
        }
        const stretch = a.press > 2 ? Math.min(44, 12 + (a.press - 2) * 6) : 0;   // a ball shielded for too long gets nicked, from further off the longer it goes on
        if (db < PR + BR + KICK_REACH - 2 + stretch && b.protect <= 0 && rnd() < K.poke) {
          const ay = b.y < F.cy ? -0.6 : 0.6, al = Math.hypot(1, ay); kick = { dx: atk / al, dy: ay / al, pw: 520, lift: 120, far: stretch };
        }
      } else { const lead = clamp(db / 520, 0, 0.5); tx = b.x + b.vx * lead; ty = b.y + b.vy * lead; }
      a.jockey = !!o && db > 48 && db < 200 && (p.x - b.x) * (tm.ownX - b.x) > 0;   // goal-side and close: square up to the carrier and shuffle
      a.tx = clamp(tx, F.L + PR, F.R - PR); a.ty = clamp(ty, F.T + PR, F.B - PR);
    } else {
      offBall(p, a, tm);
    }
  }
  let mx, my;
  if (own && mayAct) { mx = a.mx; my = a.my; }
  else {
    mx = a.tx - p.x; my = a.ty - p.y; const ml = Math.hypot(mx, my), slow = onBall && mayAct ? 6 : 26;
    if (ml > 2) { const k = Math.min(1, ml / slow) / ml; mx *= k; my *= k; } else mx = my = 0;
  }
  const mag = Math.hypot(mx, my);
  if (onBall && !own && mayAct) a.dir = Math.atan2(my, mx);             // going for the ball: no easing, cut straight to it
  else if (mag > 0.05) {                                                 // otherwise steer in curves: the heading can only swing round so fast
    let d = Math.atan2(my, mx) - a.dir; d = Math.atan2(Math.sin(d), Math.cos(d));
    a.dir += clamp(d, -TUNE.steer * dt, TUNE.steer * dt); mx = Math.cos(a.dir) * mag; my = Math.sin(a.dir) * mag;
  }
  const out = { mx, my, kick };
  if (a.jockey && !own && TUNE.jockey) { const lx = b.x - p.x, ly = b.y - p.y, ll = Math.hypot(lx, ly) || 1; out.lx = lx / ll; out.ly = ly / ll; }   // eyes on the ball while backing off or shuffling across
  return out;
}

/* The keeper: narrows the angle, gets across to shots, comes for loose balls in the box, then gives it to someone open */
function keeperPlay(p, dt) {
  const tm = TEAM[p.team], atk = tm.dir, a = AI[p.i], b = ball, K = brain(p), own = b.owner === p.i;
  a.held = own ? a.held + dt : 0;
  let kick = null;
  const lx = b.x - p.x, ly = b.y - p.y, ll = Math.hypot(lx, ly) || 1, home = tm.ownX + atk * 26;
  if (own) {
    if (a.held > 0.8) {
      const bp = bestPass(p, tm, false);
      if (bp) { const m = bp.m, dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy) || 1; kick = { dx: dx / d, dy: dy / d, pw: clamp(280 + d * 1.2, 400, 760), lift: 120 }; }
      else if (a.held > 1.6) { const ay = (rnd() < 0.5 ? -1 : 1) * 0.5, l = Math.hypot(1, ay); kick = { dx: atk / l, dy: ay / l, pw: SHOT, lift: 330 }; }   // nobody free: hoof it clear
    }
    return { mx: clamp((home + atk * 34 - p.x) / 30, -1, 1) * 0.5, my: clamp((F.cy - p.y) / 40, -1, 1) * 0.5, kick, lx: atk, ly: 0, top: K.gk, acc: K.gkAcc };
  }
  if ((a.t -= dt) <= 0) {
    a.t = K.think * 0.6 + rnd() * 0.04;
    const out = (b.x - tm.ownX) * atk, loose = b.owner < 0;
    let tx = home + atk * (out < 340 ? 20 : 0), ty = F.cy + clamp((b.y - F.cy) * (out < 520 ? 0.6 : 0.3), -GOAL.half + 12, GOAL.half - 12);
    a.dive = false;
    if (loose && b.vx * atk < -200) {                                    // something is coming at goal: get on its line
      const tt = (p.x - b.x) / b.vx, py = b.y + b.vy * tt;
      if (tt > 0 && tt < 1.3 && Math.abs(py - F.cy) < GOAL.half + 30) { ty = clamp(py, GY1 + 6, GY2 - 6); a.dive = true; }
    } else if (loose && out < 190 && Math.abs(b.y - F.cy) < GOAL.half + 110 && Math.hypot(b.vx, b.vy) < 280) {
      const mine = dist(p, b); let first = true;                         // a loose ball in the box: claim it if he gets there first
      for (let k = 1; k < NT; k++) if (dist(P[others(p.team)[k]], b) < mine - 12) first = false;
      if (first) { tx = b.x; ty = b.y; }
    }
    a.tx = tx; a.ty = ty;
  }
  let mx = a.tx - p.x, my = a.ty - p.y; const ml = Math.hypot(mx, my);
  if (ml > 1.5) { const k = Math.min(1, ml / 10) / ml; mx *= k; my *= k; } else mx = my = 0;
  return { mx, my, kick: null, lx: lx / ll, ly: ly / ll, top: a.dive ? K.dive : K.gk, acc: K.gkAcc };
}

/* ───────────── physics ───────────── */
function drive(p, c, dt, top) {
  if (ball.owner === p.i) top *= WITH_BALL;
  const len = Math.hypot(c.mx, c.my);
  if (c.face !== undefined) { p.fx = Math.cos(c.face); p.fy = Math.sin(c.face); }
  else if (c.lx !== undefined) { p.fx = c.lx; p.fy = c.ly; }
  else if (len > 0.3) { p.fx = c.mx / len; p.fy = c.my / len; }
  if (c.face !== undefined && len > 0.01) { const along = (c.mx * p.fx + c.my * p.fy) / len; top *= along >= 0 ? 0.74 + 0.26 * along : 0.74 + 0.12 * along; }   // sideways and backwards are slower than a straight run
  let tx = 0, ty = 0;
  if (len > 0.01) { tx = c.mx * top; ty = c.my * top; }
  const ax = tx - p.vx, ay = ty - p.vy, d = Math.hypot(ax, ay), rate = (len > 0.01 ? (c.acc || ACC) : DEC) * dt;
  if (d <= rate) { p.vx = tx; p.vy = ty; } else { p.vx += ax / d * rate; p.vy += ay / d * rate; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  clampPlayer(p);
  p.phase += Math.hypot(p.vx, p.vy) * dt * 0.062;
  if (c.face !== undefined) p.ang = c.face;
  else { let da = Math.atan2(p.fy, p.fx) - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); p.ang += da * Math.min(1, dt * 14); }
}
function clampPlayer(p) {
  if (p.x < F.L + PR) { p.x = F.L + PR; if (p.vx < 0) p.vx = 0; }
  if (p.x > F.R - PR) { p.x = F.R - PR; if (p.vx > 0) p.vx = 0; }
  if (p.y < F.T + PR) { p.y = F.T + PR; if (p.vy < 0) p.vy = 0; }
  if (p.y > F.B - PR) { p.y = F.B - PR; if (p.vy > 0) p.vy = 0; }
}
/* Strike the ball: from your own feet, first-time if it is loose within reach, or as a poke at an opponent's ball */
function strike(p, dx, dy, power, lift, far) {
  const b = ball;
  if (p.kickCd > 0) return false;
  if (b.owner !== p.i) {
    if (dist(p, b) > PR + BR + KICK_REACH + (far || 0) || b.h > 60) return false;
    if (b.owner >= 0) { const o = P[b.owner]; if (o.team === p.team || b.protect > 0) return false; o.noCap = 0.4; }
  }
  b.owner = -1; b.protect = 0; b.vx = dx * power; b.vy = dy * power; b.vh = lift;
  p.kickCd = KICK_CD; p.kickAnim = KICK_ANIM; p.kc++; p.noCap = 0.28; p.fx = dx; p.fy = dy;
  return true;
}
function airKick(p) { if (p.kickAnim <= 0) { p.kickAnim = KICK_ANIM; p.kc++; } }
/* Shoot: always at the opponents' goal, whichever way the kid is facing, aimed at the side the keeper is not covering */
function shoot(p) {
  const tm = TEAM[p.team], keeper = P[TEAM[1 - p.team].gk];
  const off = keeper.y - F.cy, side = Math.abs(off) > 6 ? -Math.sign(off) : (ball.y > F.cy ? -1 : 1);   // keeper central: go for the far post
  const tx = tm.goalX + tm.dir * 10, ty = F.cy + side * GOAL.half * 0.62;
  const dx = tx - ball.x, dy = ty - ball.y, l = Math.hypot(dx, dy) || 1;
  return strike(p, dx / l, dy / l, SHOT, 210);
}
/* Pass: along the ground to the teammate, weighted for the distance; control goes with the ball */
function passTarget(p) {                                                // the teammate you are facing, as long as the ball can get there
  const tm = TEAM[p.team]; let best = null, bs = -1e9;
  for (const i of tm.players) {
    if (i === p.i) continue;
    const m = P[i], vx = m.x - ball.x, vy = m.y - ball.y, d = Math.hypot(vx, vy) || 1;
    if (d < 70) continue;
    const sc = (vx * p.fx + vy * p.fy) / d * 1.4 - Math.abs(d - 300) / 700 + (laneClear(ball.x, ball.y, m.x, m.y, p.team, 40) ? 0.3 : 0) - (i === tm.gk ? 0.6 : 0);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
function pass(p) {
  const tm = TEAM[p.team], m = passTarget(p); if (!m) return false;
  const tx = clamp(m.x + m.vx * 0.15, F.L + PR, F.R - PR), ty = clamp(m.y + m.vy * 0.15, F.T + PR, F.B - PR);
  const dx = tx - ball.x, dy = ty - ball.y, d = Math.hypot(dx, dy) || 1, power = clamp(260 + d * 1.2, 380, 720);
  if (!strike(p, dx / d, dy / d, power, 40)) return false;
  if (!isFP() && !m.gk) { tm.ctrl = m.i; tm.sw = clamp(d / power * 1.3, 0.5, 1.2); tm.recv = tm.sw + 0.4; }
  return true;
}
/* The ball at a kid's feet: nudged ahead on each stride, swung round as they turn */
function carry(p, dt) {
  const b = ball, run = Math.min(1, Math.hypot(p.vx, p.vy) / 200);
  const reach = p.gk ? 13 : PR + BR - 5 + 6 * Math.max(0, Math.sin(p.phase)) * run, hold = p.gk ? 46 : 0;   // a keeper holds it in his arms
  const tx = p.x + p.fx * reach - p.fy * 2.5, ty = p.y + p.fy * reach + p.fx * 2.5;      // just inside the right foot
  const k = 1 - Math.exp(-dt * 24), nx = b.x + (tx - b.x) * k, ny = b.y + (ty - b.y) * k;
  b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt; b.x = nx; b.y = ny;
  b.h += (hold - b.h) * k; b.vh = 0;
  ballBounds();
}
function moveBall(dt) {
  const b = ball;
  b.protect = Math.max(0, b.protect - dt);
  if (b.owner >= 0) { carry(P[b.owner], dt); return; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  const air = b.h > 0.5 || b.vh > 0, sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    let ns;
    if (b.x < F.L || b.x > F.R) ns = sp * Math.exp(-7 * dt);            // the net kills the ball
    else if (air) ns = sp * Math.exp(-AIR_DRAG * dt);
    else ns = Math.max(0, sp * Math.exp(-ROLL_DRAG * dt) - ROLL_FRIC * dt);
    b.vx *= ns / sp; b.vy *= ns / sp;
  }
  if (air) {
    b.vh -= GRAV * dt; b.h += b.vh * dt;
    if (b.h <= 0) { b.h = 0; if (b.vh < -90) { b.vh = -b.vh * BOUNCE; b.vx *= 0.86; b.vy *= 0.86; } else b.vh = 0; }   // each bounce bites
  }
  ballBounds();
}
function ballBounds() {
  const b = ball;
  if (b.x < F.L || b.x > F.R) {                                         // inside a goal
    const s = b.x < F.L ? -1 : 1, back = s < 0 ? F.L - GOAL.depth + BR : F.R + GOAL.depth - BR;
    if (b.y < GY1 + BR) { b.y = GY1 + BR; if (b.vy < 0) b.vy *= -0.25; }
    if (b.y > GY2 - BR) { b.y = GY2 - BR; if (b.vy > 0) b.vy *= -0.25; }
    if ((b.x - back) * s > 0) { b.x = back; if (b.vx * s > 0) b.vx *= -0.15; }
    return;
  }
  if (b.y < F.T + BR) { b.y = F.T + BR; if (b.vy < 0) { b.vy *= -WALL_REST; b.vx *= 0.92; } }
  if (b.y > F.B - BR) { b.y = F.B - BR; if (b.vy > 0) { b.vy *= -WALL_REST; b.vx *= 0.92; } }
  if (!(b.y > GY1 && b.y < GY2 && b.h < GOAL.h - BR)) {
    if (b.x < F.L + BR) { b.x = F.L + BR; if (b.vx < 0) { b.vx *= -WALL_REST; b.vy *= 0.92; } }
    if (b.x > F.R - BR) { b.x = F.R - BR; if (b.vx > 0) { b.vx *= -WALL_REST; b.vy *= 0.92; } }
  }
  for (const px of [F.L, F.R]) for (const py of [GY1, GY2]) {           // goal posts
    const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy), min = BR + GOAL.post;
    if (d < min && d > 1e-4) {
      const nx = dx / d, ny = dy / d; b.x = px + nx * min; b.y = py + ny * min;
      const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
    }
  }
}
/* Who has the ball now: traps, blocks and tackles */
function contest(first) {
  const b = ball;
  for (let n = 0; n < NP; n++) {
    const p = P[first ? NP - 1 - n : n];
    if (p.noCap > 0) continue;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1e-3;
    if (b.owner < 0) {
      if (d > PR + BR + (p.gk ? 5 : 1.5) || b.h > (p.gk ? 92 : 52)) continue;
      const hot = Math.hypot(b.vx - p.vx, b.vy - p.vy) >= TRAP_SPEED;
      if (!hot || (p.gk && rnd() < brain(p).save)) { b.owner = p.i; b.protect = p.gk ? 99 : 0.1; b.vh = 0; return; }   // brought under control, or held by the keeper
      const nx = dx / d, ny = dy / d, off = PR + BR + (p.gk ? 5 : 1.5);    // too hot to handle: it comes off the body, or the keeper parries
      b.x = p.x + nx * off; b.y = p.y + ny * off;
      const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
      if (vn < 0) { b.vx -= 1.35 * vn * nx; b.vy -= 1.35 * vn * ny; }
      const a = (rnd() - 0.5) * 0.5, c = Math.cos(a), s = Math.sin(a), vx = b.vx * 0.55, vy = b.vy * 0.55;
      b.vx = vx * c - vy * s; b.vy = vx * s + vy * c; b.vh = Math.max(b.vh, 90 + rnd() * 90);
      if (p.gk) p.noCap = 0.35;
    } else if (b.owner !== p.i && P[b.owner].team !== p.team && b.protect <= 0 && d < PR + BR - 2 && !p.gk) {
      if (!(humanTeam(p.team) && !isFP()) && rnd() > brain(p).tackle) { p.noCap = 0.6; continue; }   // a weaker CPU mistimes it and has to recover
      const o = P[b.owner]; o.noCap = 0.5;                               // a foot on the ball: win it clean or knock it loose
      if (rnd() < 0.3) { const a = rnd() * TAU; b.owner = -1; b.vx = (p.vx + o.vx) * 0.4 + Math.cos(a) * 150; b.vy = (p.vy + o.vy) * 0.4 + Math.sin(a) * 150; b.vh = 110; p.noCap = 0.2; }
      else { b.owner = p.i; b.protect = 0.45; }
      return;
    }
  }
}
function bump(a, b) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); const min = PR * 2;
  if (d >= min) return;
  if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
  const nx = dx / d, ny = dy / d, o = (min - d) / 2;
  a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) { a.vx += nx * vn * 0.6; a.vy += ny * vn * 0.6; b.vx -= nx * vn * 0.6; b.vy -= ny * vn * 0.6; }   // shoulder to shoulder: both are knocked back a little
  clampPlayer(a); clampPlayer(b);
}

let flip = false;
function step(dt) {
  S.clock += dt;
  if (S.phase === 'kickoff') { S.timer -= dt; if (S.timer <= 0) S.phase = 'play'; }
  const live = S.phase === 'play', fp = isFP() && !S.demo;
  if (live) { pickRoles(TEAM[0], dt); pickRoles(TEAM[1], dt); }
  flip = !flip;                                                          // alternate who acts first, so neither side wins every 50-50
  for (let n = 0; n < NP; n++) {
    const p = P[flip ? NP - 1 - n : n];
    const tm = TEAM[p.team], t = p.team, hum = humanTeam(t), mine = hum && (fp ? p.i === FPI : tm.ctrl === p.i);
    let c = IDLE, top = MAX_SPEED;
    if (live) {
      if (mine) {
        c = fp ? fpMove(dt) : (t === myTeam ? localMove() : INPUT[t]);
        if (tm.recv > 0) {                                               // run on to a pass until the player steers
          tm.recv -= dt;
          if (c.mx || c.my || ball.owner >= 0) tm.recv = 0;
          else { const ix = ball.x + ball.vx * 0.22 - p.x, iy = ball.y + ball.vy * 0.22 - p.y, l = Math.hypot(ix, iy); if (l > PR + BR) c = { mx: ix / l, my: iy / l }; }
        }
      } else if (p.gk) { c = keeperPlay(p, dt); top = c.top; }
      else { top = brain(p).speed; c = cpuPlay(p, dt, tm.chaser === p.i, !hum || fp); }
    } else if (fp && p.i === FPI) c = { mx: 0, my: 0, face: FP.yaw };
    p.kickCd = Math.max(0, p.kickCd - dt); p.kickAnim = Math.max(0, p.kickAnim - dt); p.noCap = Math.max(0, p.noCap - dt);
    drive(p, c, dt, top);
    if (!live) continue;
    if (mine) {
      if (passBuf[t] > 0) {
        if (pass(p)) passBuf[t] = kickBuf[t] = 0;
        else { passBuf[t] -= dt; if (passBuf[t] <= 0) airKick(p); }
      } else if (kickBuf[t] > 0) {
        if (shoot(p)) kickBuf[t] = 0;
        else { kickBuf[t] -= dt; if (kickBuf[t] <= 0) airKick(p); }
      }
    } else if (c.kick) strike(p, c.kick.dx, c.kick.dy, c.kick.pw, c.kick.lift, c.kick.far);
  }
  if (!live) kickBuf[0] = kickBuf[1] = passBuf[0] = passBuf[1] = 0;
  moveBall(dt);
  if (!live || ball.owner >= 0 || Math.hypot(ball.x - S.ax, ball.y - S.ay) > 10) { S.ax = ball.x; S.ay = ball.y; S.still = 0; }
  else if ((S.still += dt) > 4) { ball.vx = (F.cx - ball.x) * 0.6; ball.vy = (F.cy - ball.y) * 0.6; S.still = 0; }   // a ball nobody can get at rolls back into play
  for (let k = 0; k < 2; k++) for (let i = 0; i < NP; i++) for (let j = i + 1; j < NP; j++) bump(P[i], P[j]);
  if (live) {
    contest(flip);
    if (ball.x < F.L - BR + 1) scored(1);
    else if (ball.x > F.R + BR - 1) scored(0);
  } else if (S.phase === 'goal') {
    if (ball.owner >= 0) { ball.owner = -1; }
    S.timer -= dt;
    if (S.timer <= 0) {
      if (Math.max(S.score[0], S.score[1]) >= WIN) endMatch();
      else { resetPositions(); show('banner', false); S.phase = 'kickoff'; S.timer = 0.9; }
    }
  }
}

/* ───────────── online play: one device hosts the match, the other sends its keys ───────────── */
const N = { room: undefined, mr: null, role: null, code: '', me: null, opp: null, started: false, kSeq: 0, pSeq: 0, lastK: 0, lastP: 0, primed: false, seq: 0, lastT: -1, snap: null, snapAt: 0, fresh: true, sentI: '', off: [], lobbyOff: null, joinTimer: 0 };
const ROOM_PREFIX = 'psf-';
async function getRoom() {
  if (N.room !== undefined) return N.room;
  try { N.room = (await window.claude?.use?.('room')) || null; } catch (e) { N.room = null; }
  return N.room;
}
const netStatus = text => { $('netStatus').textContent = text; };
function renderLobby() {
  const box = $('netList'); box.textContent = '';
  if (!N.room || N.mr) { $('netEmpty').hidden = true; return; }
  const seen = new Set();
  for (const p of N.room.peers()) {
    const c = p.presence && p.presence.host;
    if (p.sameTab || typeof c !== 'string' || !/^[a-z0-9]{4}$/.test(c) || seen.has(c)) continue;
    seen.add(c);
    const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = 'Join match ' + c.toUpperCase(); b.onclick = () => joinMatch(c);
    box.appendChild(b);
  }
  $('netEmpty').hidden = seen.size > 0;
}
async function openOnline(msg) {
  show('menu', false); show('online', true);
  $('btnHost').hidden = true; $('netEmpty').hidden = true; $('netList').textContent = '';
  netStatus('Connecting…');
  const room = await getRoom();
  if ($('online').hidden) return;
  if (!room) { netStatus('Online play is not available in this view. Both players need to open this page signed in to Claude, and it has to be shared with the other player.'); return; }
  $('btnHost').hidden = false;
  netStatus(msg || 'Host a match, or join one that is open. The other player opens this same page on their own device.');
  if (!N.lobbyOff) N.lobbyOff = room.onPeers(renderLobby, () => {});
  renderLobby();
}
async function hostMatch() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; let code = ''; for (let i = 0; i < 4; i++) code += abc[(Math.random() * abc.length) | 0];
  $('btnHost').hidden = true; netStatus('Opening a match…');
  try { N.mr = await N.room.join(ROOM_PREFIX + code); } catch (e) { N.mr = null; $('btnHost').hidden = false; netStatus('Could not open a match. Try again in a moment.'); return; }
  Object.assign(N, { role: 'host', code, opp: null, started: false, primed: false, seq: 0 });
  N.mr.presence({ role: 'host', g: null }).catch(() => {}); N.room.presence({ host: code }).catch(() => {});
  N.off.push(N.mr.onPeers(matchPeers, netLost));
  netStatus('Match ' + code.toUpperCase() + ' is open. Waiting for the other player to join it from their device…'); renderLobby();
}
async function joinMatch(code) {
  $('btnHost').hidden = true; netStatus('Joining match ' + code.toUpperCase() + '…');
  try { N.mr = await N.room.join(ROOM_PREFIX + code); } catch (e) { N.mr = null; $('btnHost').hidden = false; netStatus('Could not join that match. Try again in a moment.'); return; }
  Object.assign(N, { role: 'guest', code, opp: null, started: false, kSeq: 0, pSeq: 0, sentI: '', lastT: -1, snap: null, fresh: true });
  N.mr.presence({ role: 'guest', i: [0, 0, 0, 0] }).catch(() => {});
  N.off.push(N.mr.onPeers(matchPeers, netLost));
  N.joinTimer = setTimeout(() => { if (!N.started) { leaveMatch(); openOnline('That match did not answer. It may have started already or closed.'); } }, 9000);
  renderLobby();
}
function matchPeers(ch) {
  if (!N.mr) return;
  const me = ch.peers.find(p => p.sameTab); if (me) N.me = me.peer;
  if (N.role === 'host') {
    if (!N.opp) {
      const g = ch.peers.find(p => !p.sameTab && p.presence && p.presence.role === 'guest');
      if (g) { N.opp = g.peer; N.mr.presence({ g: g.peer }).catch(() => {}); N.room.presence({ host: null }).catch(() => {}); beginNet(); }
    } else if (ch.left.some(p => p.peer === N.opp)) netEnded('The other player left the match.');
  } else {
    const h = ch.peers.find(p => !p.sameTab && p.presence && p.presence.role === 'host');
    if (!N.started) {
      if (h && N.me && h.presence.g === N.me) { N.opp = h.peer; beginNet(); }
      else if (h && h.presence.g && N.me && h.presence.g !== N.me) { leaveMatch(); openOnline('That match is already full.'); }
    } else if (!h || ch.left.some(p => p.peer === N.opp)) netEnded('The host left the match.');
  }
}
function beginNet() {
  clearTimeout(N.joinTimer); N.started = true; myTeam = N.role === 'host' ? 0 : 1;
  startMatch('net');
}
function leaveMatch() {
  N.off.forEach(f => { try { f(); } catch (e) {} }); N.off = []; clearTimeout(N.joinTimer);
  const mr = N.mr; N.mr = null; if (mr) mr.leave().catch(() => {});
  if (N.room) N.room.presence({ host: null }).catch(() => {});
  Object.assign(N, { role: null, opp: null, started: false, snap: null });
  INPUT[1].mx = INPUT[1].my = 0; myTeam = 0;
}
function netEnded(msg) { leaveMatch(); toMenu(); openOnline(msg); }
function netLost() { if (N.mr) netEnded('The connection to the match was lost.'); }

const r1 = v => Math.round(v * 10) / 10;
function netHostFrame() {
  const g = N.mr.peers().find(p => p.peer === N.opp), i = g && g.presence && g.presence.i;
  if (Array.isArray(i) && i.length >= 4 && i.every(Number.isFinite)) {   // the guest's keys: untrusted, so clamp everything
    let mx = clamp(i[0], -1, 1), my = clamp(i[1], -1, 1); const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    INPUT[1].mx = mx; INPUT[1].my = my;
    if (i[2] !== N.lastK) { N.lastK = i[2]; if (N.primed) kickBuf[1] = 0.16; }
    if (i[3] !== N.lastP) { N.lastP = i[3]; if (N.primed) passBuf[1] = 0.16; }
    N.primed = true;
  }
  const p = [];
  for (const q of P) p.push(r1(q.x), r1(q.y), Math.round(q.vx), Math.round(q.vy), Math.round(q.ang * 100) / 100, q.kc);
  N.mr.presence({ s: { t: ++N.seq, ph: S.phase, sc: S.score.slice(), sr: S.scorer, c: [TEAM[0].ctrl, TEAM[1].ctrl], b: [r1(ball.x), r1(ball.y), Math.round(ball.vx), Math.round(ball.vy), r1(ball.h)], p } }).catch(() => {});
}
const PHASES = new Set(['kickoff', 'play', 'goal', 'over']);
function validSnap(s) {
  return s && typeof s === 'object' && PHASES.has(s.ph) && Array.isArray(s.p) && s.p.length === NP * 6 && s.p.every(Number.isFinite)
    && Array.isArray(s.b) && s.b.length === 5 && s.b.every(Number.isFinite) && Array.isArray(s.sc) && s.sc.length === 2 && s.sc.every(Number.isFinite) && Array.isArray(s.c);
}
function netGuestFrame(dt, now) {
  const h = N.mr.peers().find(p => p.peer === N.opp), s = h && h.presence && h.presence.s;
  if (s && s.t !== N.lastT && validSnap(s)) {
    N.lastT = s.t; N.snap = s; N.snapAt = now;
    S.score = [clamp(s.sc[0] | 0, 0, WIN), clamp(s.sc[1] | 0, 0, WIN)]; S.scorer = s.sr ? 1 : 0;
    for (const k of [0, 1]) if (TEAM[k].players.includes(s.c[k]) && s.c[k] !== TEAM[k].gk) TEAM[k].ctrl = s.c[k];
    if (s.ph !== S.phase) {
      S.phase = s.ph;
      if (s.ph === 'goal') showGoal(S.scorer); else if (s.ph === 'over') showOver(); else { show('banner', false); show('over', false); }
      if (s.ph === 'kickoff') N.fresh = true;
    }
    updateHud();
  }
  const m = localMove(), line = m.mx.toFixed(2) + ',' + m.my.toFixed(2) + ',' + N.kSeq + ',' + N.pSeq;
  if (line !== N.sentI) { N.sentI = line; N.mr.presence({ i: [+m.mx.toFixed(2), +m.my.toFixed(2), N.kSeq, N.pSeq] }).catch(() => {}); }
  const sn = N.snap; if (!sn) return;
  if (now - N.snapAt > 7000) { netLost(); return; }
  const age = Math.min((now - N.snapAt) / 1000, 0.15), mineI = TEAM[1].ctrl;
  for (let i = 0; i < NP; i++) {
    const q = P[i], o = i * 6, tx = sn.p[o] + sn.p[o + 2] * age, ty = sn.p[o + 1] + sn.p[o + 3] * age;
    if (N.fresh) { q.x = tx; q.y = ty; q.ang = sn.p[o + 4]; q.vx = q.vy = 0; }
    if (i === mineI && S.phase === 'play') {                             // my own kid answers my keys at once, then eases onto the host's truth
      drive(q, m, dt, MAX_SPEED);
      const ex = tx - q.x, ey = ty - q.y, k = Math.hypot(ex, ey) > 90 ? 1 : 1 - Math.exp(-dt * 5); q.x += ex * k; q.y += ey * k;
    } else {
      const k = 1 - Math.exp(-dt * 18); q.x += (tx - q.x) * k; q.y += (ty - q.y) * k; q.vx = sn.p[o + 2]; q.vy = sn.p[o + 3];
      let da = sn.p[o + 4] - q.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); q.ang += da * Math.min(1, dt * 16); q.fx = Math.cos(q.ang); q.fy = Math.sin(q.ang);
      q.phase += Math.hypot(q.vx, q.vy) * dt * 0.062;
    }
    q.kickAnim = Math.max(0, q.kickAnim - dt);
    if (sn.p[o + 5] !== q.kcSeen) { if (q.kcSeen !== undefined && !N.fresh) q.kickAnim = KICK_ANIM; q.kcSeen = sn.p[o + 5]; }
  }
  const kb = N.fresh ? 1 : 1 - Math.exp(-dt * 24);
  ball.x += (sn.b[0] + sn.b[2] * age - ball.x) * kb; ball.y += (sn.b[1] + sn.b[3] * age - ball.y) * kb; ball.h += (Math.max(0, sn.b[4]) - ball.h) * kb;
  ball.vx = sn.b[2]; ball.vy = sn.b[3]; ball.owner = -1;
  N.fresh = false;
}
