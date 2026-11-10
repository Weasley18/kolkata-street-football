/* ───────────── texture painting (2D canvas) ───────────── */
const BN = '"Anek Bangla","Noto Sans Bengali","Nirmala UI","Kohinoor Bangla","Bangla MN",sans-serif';
const BNB = '"Galada","Anek Bangla","Noto Sans Bengali","Nirmala UI","Kohinoor Bangla","Bangla MN",cursive';
const mul32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const shade = (hex, d) => { const n = parseInt(hex.slice(1), 16), c = v => clamp(v + d, 0, 255); return `rgb(${c(n >> 16)},${c(n >> 8 & 255)},${c(n & 255)})`; };
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function soft(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
function speck(g, x, y, w, h, n, rng, col, aMax, sMax) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = rng() * aMax; const s = 0.5 + rng() * sMax; g.fillRect(x + rng() * w, y + rng() * h, s, s); } g.globalAlpha = 1; }
function clipRect(g, x, y, w, h) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); }
function T(g, s, x, y, px, font, color, o = {}) {
  g.save(); g.font = `${o.w || 700} ${px}px ${font}`; g.textAlign = o.al || 'center'; g.textBaseline = 'middle';
  g.globalAlpha = o.a ?? 1; g.fillStyle = color;
  if (o.maxW) g.fillText(s, x, y, o.maxW); else g.fillText(s, x, y);
  g.restore();
}
function concrete(g, x, y, w, h, base, rng, dens = 1) {
  clipRect(g, x, y, w, h);
  R(g, x, y, w, h, base);
  const n = Math.round(w * h / 9000 * dens);
  for (let i = 0; i < n; i++) soft(g, x + rng() * w, y + rng() * h, 40 + rng() * 110, rng() < 0.55 ? '#3a3128' : '#fff6e0', 0.04 + rng() * 0.06);
  speck(g, x, y, w, h, w * h / 24 * dens, rng, '#2b2620', 0.17, 1.4);
  speck(g, x, y, w, h, w * h / 34 * dens, rng, '#fff8e8', 0.15, 1.4);
  g.restore();
}
function crack(g, x, y, len, ang, rng, depth = 0) {
  g.beginPath(); g.moveTo(x, y); let a = ang;
  const forks = [];
  for (let i = 0; i < len; i += 6) { a += (rng() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); if (depth < 1 && rng() < 0.09) forks.push([x, y, a + (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.6)]); }
  g.strokeStyle = 'rgba(30,25,20,.42)'; g.lineWidth = depth ? 0.6 : 0.9; g.stroke();
  for (const f of forks) crack(g, f[0], f[1], len * 0.35, f[2], rng, depth + 1);
}
function blob(g, cx, cy, r, rng) {
  g.beginPath();
  const n = 9; for (let i = 0; i <= n; i++) { const a = i / n * TAU, rad = r * (0.6 + rng() * 0.55); const px = cx + Math.cos(a) * rad * 1.3, py = cy + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath();
}
function brickPatch(g, cx, cy, r, rng) {
  g.save(); blob(g, cx, cy, r, rng); g.clip();
  R(g, cx - r * 2, cy - r * 2, r * 4, r * 4, '#8a4936');
  g.fillStyle = 'rgba(214,196,170,.55)';
  for (let y = cy - r * 2, k = 0; y < cy + r * 2; y += 5, k++) { g.fillRect(cx - r * 2, y, r * 4, 1); for (let x = cx - r * 2 + (k % 2 ? 6 : 0); x < cx + r * 2; x += 12) g.fillRect(x, y, 1, 5); }
  speck(g, cx - r * 2, cy - r * 2, r * 4, r * 4, r * 10, rng, '#2a1a12', 0.35, 1.6);
  g.restore();
}

/* building fronts, drawn as an elevation: y = 168 is the pavement, y = -64 the parapet */
const FT = -64, FH = 232;
function wallBase(g, x, w, col, rng, peel = 2) {
  clipRect(g, x, FT, w, FH);
  R(g, x, FT, w, FH, col);
  for (let i = 0; i < 14; i++) soft(g, x + rng() * w, FT + rng() * FH, 30 + rng() * 60, rng() < 0.55 ? '#2a221a' : '#fff4dc', 0.05 + rng() * 0.07);
  for (let i = 0; i < w / 6; i++) {                                    // rain streaks under ledges
    const sx = x + rng() * w, sy = rng() < 0.5 ? 80 : -34, len = 18 + rng() * 64;
    const gr = g.createLinearGradient(0, sy, 0, sy + len); gr.addColorStop(0, 'rgba(38,32,26,.26)'); gr.addColorStop(1, 'rgba(38,32,26,0)');
    g.fillStyle = gr; g.fillRect(sx, sy, 1 + rng() * 3.5, len);
  }
  const damp = g.createLinearGradient(0, 124, 0, 168); damp.addColorStop(0, 'rgba(46,54,38,0)'); damp.addColorStop(1, 'rgba(46,54,38,.42)');
  g.fillStyle = damp; g.fillRect(x, 124, w, 44);
  for (let k = 0; k < peel; k++) brickPatch(g, x + 14 + rng() * (w - 28), rng() < 0.5 ? 10 + rng() * 50 : 118 + rng() * 40, 7 + rng() * 9, rng);
  speck(g, x, FT, w, FH, w * FH / 26, rng, '#1e1812', 0.14, 1.3);
  speck(g, x, FT, w, FH, w * FH / 40, rng, '#fff6e4', 0.12, 1.3);
  g.restore();
  R(g, x, 70, w, 8, shade(col, -26)); R(g, x, 70, w, 2, shade(col, 16)); R(g, x, 78, w, 3, 'rgba(0,0,0,.2)');      // floor ledge
  R(g, x, -40, w, 7, shade(col, -22)); R(g, x, -40, w, 2, shade(col, 18)); R(g, x, -33, w, 3, 'rgba(0,0,0,.2)');   // cornice
  R(g, x + w - 2, FT, 2, FH, 'rgba(0,0,0,.28)'); R(g, x, FT, 1, FH, 'rgba(255,255,255,.1)');
}
function shutterWin(g, x, y, w, h, rng, col = '#2f5d4e') {
  R(g, x - 5, y - 5, w + 10, h + 10, 'rgba(255,250,235,.22)'); R(g, x - 2, y - 2, w + 4, h + 4, 'rgba(0,0,0,.42)');
  const half = w / 2;
  for (let k = 0; k < 2; k++) {
    const lx = x + k * half + (k ? 1 : 0);
    R(g, lx, y, half - 1, h, col);
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let sy = y + 3; sy < y + h - 2; sy += 4) g.fillRect(lx + 2, sy, half - 5, 1.5);
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let sy = y + 4.5; sy < y + h - 2; sy += 4) g.fillRect(lx + 2, sy, half - 5, 0.8);
    R(g, lx, y + h * 0.52, half - 1, 3, 'rgba(0,0,0,.25)');
  }
  clipRect(g, x, y, w, h); speck(g, x, y, w, h, w * h / 12, rng, '#d9d2bd', 0.3, 1.5); g.restore();
  R(g, x - 7, y + h + 2, w + 14, 4, 'rgba(255,250,235,.3)'); R(g, x - 7, y + h + 6, w + 14, 2, 'rgba(0,0,0,.22)');
}
function grillWin(g, x, y, w, h) {
  R(g, x - 3, y - 3, w + 6, h + 6, 'rgba(255,250,235,.2)'); R(g, x, y, w, h, '#1d1a17');
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(90,110,110,.35)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = '#6f6a5f'; g.lineWidth = 1;
  g.beginPath(); for (let k = 1; k < w / 6; k++) { g.moveTo(x + k * 6, y); g.lineTo(x + k * 6, y + h); }
  g.moveTo(x, y + h / 3); g.lineTo(x + w, y + h / 3); g.moveTo(x, y + h * 2 / 3); g.lineTo(x + w, y + h * 2 / 3); g.stroke();
}
function door(g, x, y, w, h, col, rng) {
  R(g, x - 3, y - 3, w + 6, h + 3, 'rgba(0,0,0,.4)');
  for (let k = 0; k < 2; k++) {
    const lx = x + k * w / 2; R(g, lx, y, w / 2 - 0.6, h, col);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.strokeRect(lx + 3, y + 4, w / 2 - 7, h * 0.4); g.strokeRect(lx + 3, y + h * 0.5, w / 2 - 7, h * 0.42);
  }
  R(g, x + w / 2 - 3, y + h * 0.48, 6, 2, '#b9a45a');
  clipRect(g, x, y, w, h); speck(g, x, y, w, h, w * h / 10, rng, '#e6dcc4', 0.25, 1.6); g.restore();
}
function balcony(g, x, w, items) {
  const top = 36, slab = 63;
  for (const it of items || []) {                                       // laundry over the rail
    if (it.t === 'gamcha') {
      R(g, it.x, top - 1, 20, 24, '#b5332c'); g.fillStyle = 'rgba(255,245,230,.75)';
      for (let k = 3; k < 20; k += 5) g.fillRect(it.x + k, top - 1, 1.2, 24);
      for (let k = 3; k < 24; k += 5) g.fillRect(it.x, top - 1 + k, 20, 1.2);
      R(g, it.x, top + 21, 20, 2, 'rgba(0,0,0,.25)');
    } else { R(g, it.x, top - 1, it.w || 22, 22, it.c); R(g, it.x, top + 19, it.w || 22, 2, 'rgba(0,0,0,.2)'); }
  }
  g.strokeStyle = '#1d2322'; g.lineWidth = 1.1; g.beginPath();
  for (let bx = x + 3; bx < x + w; bx += 5.5) { g.moveTo(bx, top); g.lineTo(bx, slab); }
  g.stroke();
  R(g, x, top - 2, w, 2.6, '#161b1a'); R(g, x, top + 12, w, 1.4, '#1d2322');
  g.strokeStyle = '#1d2322'; g.lineWidth = 1; for (let bx = x + 8.5; bx < x + w - 4; bx += 11) { g.beginPath(); g.arc(bx, top + 7, 3, 0, TAU); g.stroke(); }
  R(g, x - 5, slab, w + 10, 7, '#7a7265'); R(g, x - 5, slab, w + 10, 2, '#a39b8b'); R(g, x - 3, slab + 7, w + 6, 4, 'rgba(0,0,0,.25)');
}
function sign(g, x, y, w, h, bgc, fgc, str, px, font, rng, o = {}) {
  R(g, x - 1.5, y - 1.5, w + 3, h + 3, 'rgba(0,0,0,.5)'); R(g, x, y, w, h, bgc);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 1; g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5); }
  T(g, str, x + w / 2 + (o.dx || 0), y + h / 2 + 1, px, font, fgc, { maxW: (o.tw || w) - 12, w: o.w || 800 });
  clipRect(g, x, y, w, h);
  speck(g, x, y, w, h, w * h / 9, rng, '#efe6d2', 0.3, 1.5);
  speck(g, x, y, w, h, w * h / 30, rng, '#5a3018', 0.35, 1.8);
  g.restore();
  R(g, x, y + h, w, 2.5, 'rgba(0,0,0,.22)');
}
function plainHouse(g, x, w, col, rng, sh) {
  wallBase(g, x, w, col, rng, 3);
  for (let wx = x + 22; wx + 38 < x + w; wx += 64) shutterWin(g, wx, -14, 38, 66, rng, sh);
  grillWin(g, x + 22, 98, 40, 40); door(g, x + w / 2 - 22, 94, 44, 74, sh, rng); grillWin(g, x + w - 62, 98, 40, 40);
}
function paintFacade(c) {
  const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 440, -FT * 2);
  const rng = mul32(20261110);
  plainHouse(g, -220, 220, '#b7a58c', rng, '#7a3b2a');

  /* 1 ─ old house (its red-oxide rowak is built in 3D in front) */
  wallBase(g, 0, 206, '#d0ad6c', rng, 3);
  for (const wx of [20, 84, 148]) shutterWin(g, wx, -14, 38, 66, rng);
  R(g, 8, 150, 190, 18, '#8c3122');
  grillWin(g, 22, 98, 40, 40); grillWin(g, 146, 98, 40, 40);
  door(g, 83, 94, 44, 56, '#2c5a66', rng);
  R(g, 74, 83, 62, 10, '#e9e4d6'); T(g, 'শান্তি নিবাস', 105, 88.5, 8, BN, '#2a2622', { w: 600 });
  R(g, 148, 83, 54, 11, '#1f4e8c'); g.strokeStyle = '#e8eef5'; g.lineWidth = 0.6; g.strokeRect(149, 84, 52, 9);
  T(g, 'বকুলতলা লেন', 175, 89, 7.5, BN, '#f2f5f8', { w: 600, maxW: 48 });

  /* 2 ─ tea stall */
  wallBase(g, 206, 226, '#cb9a8a', rng, 2);
  shutterWin(g, 246, -14, 40, 77, rng, '#3b5f73'); shutterWin(g, 352, -14, 40, 77, rng, '#3b5f73');
  balcony(g, 226, 186, [{ t: 'gamcha', x: 300 }, { t: 'c', x: 326, c: '#e9e6dc', w: 18 }]);
  R(g, 222, 104, 196, 58, '#241c16');
  const tg = g.createLinearGradient(0, 104, 0, 162); tg.addColorStop(0, 'rgba(0,0,0,.55)'); tg.addColorStop(1, 'rgba(90,60,30,.15)'); g.fillStyle = tg; g.fillRect(222, 104, 196, 58);
  R(g, 228, 124, 184, 2, '#5a4634');
  for (let k = 0; k < 9; k++) R(g, 232 + k * 20, 115, 12, 9, ['#c9b15a', '#a84a32', '#d8d2c0', '#6e8a4a'][k % 4]);
  sign(g, 214, 82, 210, 21, '#e3b320', '#9c1f18', 'বাপির চায়ের দোকান', 16, BN, rng);
  R(g, 222, 142, 196, 26, '#6a482c'); R(g, 222, 142, 196, 2.5, '#8f6a45');
  R(g, 232, 148, 108, 13, '#274a5c'); T(g, 'চা • বিস্কুট • ঘুগনি', 286, 155, 8.5, BN, '#f0e6c8', { w: 600, maxW: 100 });
  for (let k = 0; k < 4; k++) {                                         // biscuit jars
    const jx = 230 + k * 17; R(g, jx, 128, 13, 14, 'rgba(205,225,222,.45)'); R(g, jx + 1, 134, 11, 8, ['#b98545', '#8a5a2e', '#d2a55c', '#a06a38'][k]); R(g, jx - 0.5, 126, 14, 3, '#b3261e');
    R(g, jx + 1.5, 129, 1.5, 12, 'rgba(255,255,255,.5)');
  }
  soft(g, 322, 140, 16, '#ff8a2a', 0.55); R(g, 312, 137, 20, 5, '#3a3530');                 // coal stove
  g.fillStyle = '#b9bcbc'; g.beginPath(); g.ellipse(322, 131, 10, 7.5, 0, 0, TAU); g.fill();   // kettle
  g.fillStyle = '#8f9393'; g.beginPath(); g.ellipse(322, 133.5, 10, 5, 0, 0, Math.PI); g.fill();
  g.strokeStyle = '#9a9d9d'; g.lineWidth = 2; g.beginPath(); g.moveTo(331, 131); g.lineTo(338, 126); g.stroke();
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.4; g.beginPath(); g.arc(322, 125, 6, Math.PI, TAU); g.stroke();
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6 - row; k++) {  // clay cups
    const cx = 358 + k * 8 + row * 4, cy = 138 - row * 5; g.fillStyle = row % 2 ? '#b0613a' : '#bd6c42';
    g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx + 7, cy - 4); g.lineTo(cx + 5.5, cy + 1); g.lineTo(cx + 1.5, cy + 1); g.closePath(); g.fill();
  }

  /* 3 ─ sweet shop */
  wallBase(g, 432, 258, '#a3bfad', rng, 2);
  for (const wx of [458, 541, 624]) shutterWin(g, wx, -14, 40, 66, rng, '#7a3b2a');
  R(g, 448, 108, 226, 60, '#33261a');
  const sg = g.createLinearGradient(0, 108, 0, 162); sg.addColorStop(0, 'rgba(255,225,170,.28)'); sg.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = sg; g.fillRect(448, 108, 226, 54);
  R(g, 470, 111, 180, 2.2, '#f4f2e6'); soft(g, 560, 112, 60, '#fff3d0', 0.25);
  for (let k = 0; k < 8; k++) { R(g, 456 + k * 27, 118, 20, 12, k % 2 ? '#a9adad' : '#c2c5c4'); R(g, 456 + k * 27, 118, 20, 2, 'rgba(255,255,255,.4)'); }
  sign(g, 444, 83, 234, 22, '#7a1f24', '#f3e3b0', 'অন্নপূর্ণা মিষ্টান্ন ভাণ্ডার', 16, BN, rng, { border: '#d9b45a' });
  R(g, 448, 134, 226, 34, '#c9d6d4'); R(g, 448, 134, 226, 34, 'rgba(40,60,60,.35)');       // glass counter
  const trays = ['#f6f1e4', '#e7902c', '#6a3a22', '#f0d37a', '#f1b9b0', '#f6f1e4', '#c98a3a'];
  for (let row = 0; row < 2; row++) for (let k = 0; k < 7; k++) {
    const tx = 454 + k * 31.4, ty = 138 + row * 12; R(g, tx, ty, 27, 8.5, '#aeb3b3'); g.fillStyle = trays[(k + row * 3) % trays.length];
    for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(tx + 3.6 + q * 5, ty + 4.2, 2.1, 0, TAU); g.fill(); }
  }
  g.strokeStyle = '#8d9494'; g.lineWidth = 1.6; g.strokeRect(448.8, 134.8, 224.4, 26.4); R(g, 448, 147.5, 226, 1.3, '#8d9494'); R(g, 448, 161, 226, 7, '#8a8f8e');
  g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(500, 134); g.lineTo(520, 134); g.lineTo(496, 162); g.lineTo(476, 162); g.closePath(); g.fill();

  /* 4 ─ para club */
  wallBase(g, 690, 212, '#d6ccb2', rng, 2);
  R(g, 690, 136, 210, 32, 'rgba(140,49,34,.82)');
  shutterWin(g, 734, -14, 40, 77, rng); shutterWin(g, 820, -14, 40, 77, rng);
  balcony(g, 714, 166, [{ t: 'c', x: 786, c: '#c9d4dc', w: 24 }]);
  sign(g, 702, 83, 188, 23, '#ece7d8', '#1d3f7a', 'তরুণ সংঘ', 19, BNB, rng, { w: 400, border: '#1d3f7a', dx: -26, tw: 130 });
  T(g, 'স্থাপিত ১৯৬২', 856, 95, 8, BN, '#8c2a20', { w: 600, maxW: 56 });
  R(g, 704, 110, 104, 58, '#3a3b3c'); R(g, 706, 112, 100, 56, '#8b9094');                   // roller shutter
  g.fillStyle = 'rgba(0,0,0,.22)'; for (let sy = 114; sy < 168; sy += 4) g.fillRect(706, sy, 100, 1.4);
  g.fillStyle = 'rgba(255,255,255,.14)'; for (let sy = 115.5; sy < 168; sy += 4) g.fillRect(706, sy, 100, 0.8);
  g.fillStyle = 'rgba(236,231,216,.8)'; g.beginPath(); g.arc(756, 138, 13, 0, TAU); g.fill();   // painted football
  g.fillStyle = 'rgba(29,63,122,.8)'; g.beginPath(); g.arc(756, 138, 4.4, 0, TAU); g.fill();
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - 1.2; g.beginPath(); g.arc(756 + Math.cos(a) * 10.5, 138 + Math.sin(a) * 10.5, 2.8, 0, TAU); g.fill(); }
  clipRect(g, 706, 112, 100, 56); speck(g, 706, 112, 100, 56, 460, rng, '#5a2e16', 0.4, 1.8); g.restore();
  door(g, 824, 108, 42, 60, '#2f5d4e', rng);
  R(g, 873, 114, 22, 30, '#5b3d22'); R(g, 875, 116, 18, 26, '#2f4b3c');
  R(g, 876.5, 118, 8, 10, '#ece7d8'); R(g, 885.5, 119, 6, 7, '#f0d98a'); R(g, 877, 130, 14, 9, '#e3dccb');

  /* 5 ─ neighbourhood stores */
  wallBase(g, 902, 190, '#a8bbc3', rng, 3);
  for (const wx of [928, 1022]) shutterWin(g, wx, -14, 40, 66, rng);
  R(g, 914, 108, 166, 60, '#2c241c');
  const pg = g.createLinearGradient(0, 108, 0, 162); pg.addColorStop(0, 'rgba(255,230,180,.2)'); pg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = pg; g.fillRect(914, 108, 166, 54);
  const packs = ['#c8302a', '#f2c230', '#2d6fb5', '#3f8f4f', '#e7842c', '#d9d9d9', '#7a3f9a'];
  for (let row = 0; row < 3; row++) { R(g, 918, 121 + row * 11, 158, 1.5, '#6a5038'); for (let k = 0; k < 19; k++) R(g, 920 + k * 8.2, 113 + row * 11, 6.4, 8, packs[(k * 3 + row * 2) % packs.length]); }
  sign(g, 910, 83, 174, 22, '#1f5c45', '#f2d14a', 'ভাই ভাই স্টোর্স', 17, BN, rng, { border: '#f2d14a' });
  for (let k = 0; k < 8; k++) {                                         // hanging sachet strings
    const sx = 922 + k * 21.5; R(g, sx + 2.4, 108, 0.8, 30, '#d8d2c0');
    for (let q = 0; q < 5; q++) { R(g, sx, 110 + q * 5.8, 5.6, 5, packs[(k + q * 2) % packs.length]); R(g, sx, 110 + q * 5.8, 5.6, 1.2, 'rgba(255,255,255,.4)'); }
  }
  R(g, 914, 144, 166, 24, '#5c4a38'); R(g, 914, 144, 166, 2.5, '#84705a');
  for (let k = 0; k < 3; k++) { const jx = 1024 + k * 17; R(g, jx, 131, 13, 13, 'rgba(205,225,222,.45)'); R(g, jx + 1, 136, 11, 8, ['#d95a5a', '#e8c14a', '#7fb07a'][k]); R(g, jx - 0.5, 129, 14, 3, '#2d6fb5'); }

  /* 6 ─ coaching centre */
  wallBase(g, 1092, 188, '#c3a777', rng, 3);
  for (const wx of [1126, 1214]) shutterWin(g, wx, -14, 38, 66, rng, '#3b5f73');
  sign(g, 1116, 83, 154, 22, '#f1ede0', '#b3261e', 'সাফল্য কোচিং সেন্টার', 13.5, BN, rng, { border: '#1d3f7a' });
  door(g, 1148, 108, 44, 60, '#4a5f6e', rng);
  grillWin(g, 1214, 112, 42, 34);
  R(g, 1122, 120, 14, 22, '#b3261e'); R(g, 1122, 120, 14, 4, '#8e1c16'); R(g, 1125, 128, 8, 1.6, '#1a1210'); R(g, 1122, 142, 14, 2, 'rgba(0,0,0,.3)');   // letterbox

  plainHouse(g, 1280, 220, '#c49c8c', rng, '#2f5d4e');
}

/* the boundary wall's painted face: 1072 × 55 units */
function paintWall(c) {
  const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
  const rng = mul32(77), Wd = CT.w, Hd = 55, X = f => f * Wd;
  R(g, 0, 0, Wd, Hd, '#d9d0b8');
  R(g, X(0.29), 0, X(0.225), Hd, '#2a5d8f');                             // club's blue panel
  for (let i = 0; i < 42; i++) soft(g, rng() * Wd, rng() * Hd, 20 + rng() * 60, rng() < 0.6 ? '#2a221a' : '#fff4dc', 0.06 + rng() * 0.08);
  for (let i = 0; i < 240; i++) { const sx = rng() * Wd, len = 8 + rng() * 34; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(38,32,26,.3)'); gr.addColorStop(1, 'rgba(38,32,26,0)'); g.fillStyle = gr; g.fillRect(sx, 0, 1 + rng() * 3, len); }
  T(g, 'এখানে বিজ্ঞাপন মারিবেন না', X(0.145), 29, 27, BNB, '#1e1a16', { w: 400, a: 0.82, maxW: 330 });
  T(g, 'তরুণ সংঘ পরিচালিত পাড়া ফুটবল প্রতিযোগিতা', X(0.4025), 29, 25, BNB, '#f1ead6', { w: 400, a: 0.9, maxW: X(0.21) });
  T(g, 'রক্তদান শিবির • ২৬শে জানুয়ারি', X(0.605), 29, 22, BN, '#9c1f18', { w: 800, a: 0.8, maxW: 210 });
  T(g, 'খেলার মাঠ পরিষ্কার রাখুন', X(0.755), 29, 21, BN, '#1f5c45', { w: 800, a: 0.82, maxW: 180 });
  T(g, 'ফুটবল কোচিং • প্রতি রবিবার সকালে', X(0.905), 29, 19, BN, '#1d3f7a', { w: 800, a: 0.8, maxW: 210 });
  R(g, 22, 8, 22, 30, 'rgba(236,228,205,.7)'); R(g, X(0.7), 4, 16, 13, 'rgba(240,214,140,.5)');     // torn poster scraps
  brickPatch(g, X(0.275), 42, 11, rng); brickPatch(g, X(0.53), 12, 8, rng); brickPatch(g, X(0.845), 40, 10, rng); brickPatch(g, X(0.985), 14, 9, rng);
  const dm = g.createLinearGradient(0, Hd - 18, 0, Hd); dm.addColorStop(0, 'rgba(40,48,34,0)'); dm.addColorStop(1, 'rgba(40,48,34,.5)'); g.fillStyle = dm; g.fillRect(0, Hd - 18, Wd, 18);
  speck(g, 0, 0, Wd, Hd, 8400, rng, '#e9e1cc', 0.35, 1.6);
  speck(g, 0, 0, Wd, Hd, 4700, rng, '#1e1812', 0.2, 1.4);
}

/* the court slab and the strip around it: ground x 104…1176, y 226…662 */
const CT = { x: F.L - 46, y: F.T - 10, w: F.R - F.L + 92, h: F.B - F.T + 20 };
function paintCourt(c) {
  const sc = 2, g = c.getContext('2d'); g.setTransform(sc, 0, 0, sc, -CT.x * sc, -CT.y * sc);
  const rng = mul32(424242);
  concrete(g, CT.x, CT.y, CT.w, CT.h, '#857d70', rng, 1.2);
  for (const s of [-1, 1]) {                                            // packed earth inside the goals
    const gx = s < 0 ? F.L - GOAL.depth - 4 : F.R;
    concrete(g, gx, GY1 - 6, GOAL.depth + 4, GOAL.half * 2 + 12, '#8d8475', rng, 1.6);
    soft(g, s < 0 ? F.L - 12 : F.R + 12, F.cy, 80, '#5e5648', 0.3);
  }
  const x = F.L, y = F.T, w = F.R - F.L, h = F.B - F.T;
  concrete(g, x, y, w, h, '#a9a192', rng);
  clipRect(g, x, y, w, h);
  soft(g, F.cx, F.cy, 190, '#efe5cc', 0.2); soft(g, F.L + 90, F.cy, 190, '#efe5cc', 0.24); soft(g, F.R - 90, F.cy, 190, '#efe5cc', 0.24);   // scuffed pale where play happens
  g.strokeStyle = 'rgba(40,34,28,.22)'; g.lineWidth = 1;                // cement repairs
  for (const [fx, fy, rw, rh, col] of [[0.17, 0.66, 150, 92, 'rgba(146,139,127,.42)'], [0.7, 0.07, 108, 66, 'rgba(186,178,162,.38)'], [0.52, 0.8, 190, 70, 'rgba(160,152,138,.34)'], [0.34, 0.12, 96, 120, 'rgba(176,168,152,.3)']]) { R(g, x + fx * w, y + fy * h, rw, rh, col); g.strokeRect(x + fx * w, y + fy * h, rw, rh); }
  g.fillStyle = 'rgba(40,34,28,.28)';                                    // slab joints
  for (let k = 1; k < 8; k++) g.fillRect(x + k * w / 8, y, 1.3, h);
  for (let k = 1; k < 4; k++) g.fillRect(x, y + k * h / 4, w, 1.3);
  g.fillStyle = 'rgba(255,250,235,.12)';
  for (let k = 1; k < 8; k++) g.fillRect(x + k * w / 8 + 1.3, y, 0.8, h);
  for (let i = 0; i < 18; i++) crack(g, x + rng() * w, y + rng() * h, 60 + rng() * 170, rng() * TAU, rng);
  for (let i = 0; i < 13; i++) soft(g, x + rng() * w, y + rng() * h, 16 + rng() * 38, '#2a241c', 0.1 + rng() * 0.1);       // stains
  g.restore();

  /* painted lines, then worn away */
  const tmp = mkCanvas(c.width, c.height), t = tmp.getContext('2d'); t.setTransform(sc, 0, 0, sc, -CT.x * sc, -CT.y * sc);
  t.strokeStyle = t.fillStyle = '#f1ebd8'; t.lineWidth = 4.5;
  t.strokeRect(x + 2, y + 2, w - 4, h - 4);
  t.beginPath(); t.moveTo(F.cx, y); t.lineTo(F.cx, y + h); t.stroke();
  t.beginPath(); t.arc(F.cx, F.cy, 82, 0, TAU); t.stroke();
  t.beginPath(); t.arc(F.cx, F.cy, 5.5, 0, TAU); t.fill();
  const BX = 190, BH = 200, SX = 72, SH = 126, SPOT = 146, ARC = 72;
  for (const s of [-1, 1]) {
    const gx = s < 0 ? F.L + 2 : F.R - 2;
    t.strokeRect(Math.min(gx, gx - s * BX), F.cy - BH, BX, BH * 2);
    t.strokeRect(Math.min(gx, gx - s * SX), F.cy - SH, SX, SH * 2);
    t.beginPath(); t.arc(gx - s * SPOT, F.cy, 4.5, 0, TAU); t.fill();
    const a = Math.acos((BX - SPOT) / ARC); t.beginPath();
    if (s < 0) t.arc(gx + SPOT, F.cy, ARC, -a, a); else t.arc(gx - SPOT, F.cy, ARC, Math.PI - a, Math.PI + a);
    t.stroke();
  }
  t.globalCompositeOperation = 'destination-out';
  speck(t, x, y, w, h, 56000, rng, '#000', 0.95, 2.8);
  for (let i = 0; i < 130; i++) soft(t, x + rng() * w, y + rng() * h, 14 + rng() * 50, '#000000', 0.35 + rng() * 0.5);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.8; g.drawImage(tmp, 0, 0); g.restore();
}
function tile(size, base, rng, n) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  R(g, 0, 0, size, size, base);
  for (let i = 0; i < 10; i++) { const x = rng() * size, y = rng() * size, r = 30 + rng() * 60, col = rng() < 0.55 ? '#2a241c' : '#fff6e0', a = 0.03 + rng() * 0.04; for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) soft(g, x + ox, y + oy, r, col, a); }
  speck(g, 0, 0, size, size, n, rng, '#1e1a16', 0.2, 1.6); speck(g, 0, 0, size, size, n * 0.6, rng, '#fff8e8', 0.16, 1.6);
  return c;
}

