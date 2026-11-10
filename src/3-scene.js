
/* a second row of plain houses, used on the other three sides (seen in first person) */
function paintPlainRow(c) {
  const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 440, -FT * 2);
  const rng = mul32(9091);
  const cols = ['#c9b089', '#b9c2b0', '#d2a892', '#a9b8c2', '#cdbf9c', '#c4a47c', '#b3a79a', '#c8b7a2'], sh = ['#2f5d4e', '#7a3b2a', '#3b5f73', '#2f5d4e', '#5a4a3a', '#3b5f73', '#7a3b2a', '#2f5d4e'];
  let x = -220, k = 0;
  while (x < 1500) {
    const w = Math.min(190 + ((k * 37) % 70), 1500 - x);
    plainHouse(g, x, w, cols[k % cols.length], rng, sh[k % sh.length]);
    if (k % 3 === 1 && w > 150) {                                        // a closed shop shutter here and there
      R(g, x + 16, 104, 62, 64, '#3a3b3c'); R(g, x + 18, 106, 58, 62, '#8b9094');
      g.fillStyle = 'rgba(0,0,0,.22)'; for (let sy = 108; sy < 168; sy += 4) g.fillRect(x + 18, sy, 58, 1.4);
    }
    x += w; k++;
  }
}

/* ───────────── 3D scene (three.js) ───────────── */
let renderer = null, scene, camera, world, fpGroup, sun, maxAniso = 1, facadeC, wallC, facadeT, wallT, camFP = null, radar = null;
const kids = [], marks = {};
let ballMesh, lastBX = 0, lastBY = 0;
const col = hex => new THREE.Color(hex).convertSRGBToLinear();
const lam = (hex, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: col(hex) }, o));
const std = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.82, metalness: 0 }, o));
function mkTex(c, rep) {
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function add(mesh, x, h, y, cast = true, recv = true, parent = world) { mesh.position.set(x, h, y); mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); return mesh; }
function box(x0, y0, x1, y1, h0, h1, mat, cast = true) { return add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h1 - h0, y1 - y0), mat), (x0 + x1) / 2, (h0 + h1) / 2, (y0 + y1) / 2, cast); }
function flat(x0, y0, x1, y1, h, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat); m.rotation.x = -Math.PI / 2; return add(m, (x0 + x1) / 2, h, (y0 + y1) / 2, false, true); }
function pole(x, y, h0, h1, r, mat, r2) { return add(new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, h1 - h0, 10), mat), x, (h0 + h1) / 2, y); }
function quad(pts, mat, parent = world) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); parent.add(m); return m;
}
function meshTex(color, alpha, lw) {                                    // diamond mesh for nets and fencing
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  g.strokeStyle = rgba(color, alpha); g.lineWidth = lw; g.lineCap = 'square';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(32, 0); g.lineTo(0, 32); g.stroke();
  return c;
}
function netMat(c, rx, ry) { return new THREE.MeshBasicMaterial({ map: mkTex(c, [rx, ry]), transparent: true, side: THREE.DoubleSide, depthWrite: false }); }

function buildGoal(s) {
  const white = lam('#f4f1e6'), grey = lam('#b9b6aa');
  const x0 = s < 0 ? F.L : F.R, xb = x0 + s * GOAL.depth, H = GOAL.h;
  pole(x0, GY1, 0, H, 3.4, white); pole(x0, GY2, 0, H, 3.4, white);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, GY2 - GY1 + 6.8, 10), white); bar.rotation.x = Math.PI / 2; add(bar, x0, H, F.cy);
  pole(xb, GY1, 0, H, 1.6, grey); pole(xb, GY2, 0, H, 1.6, grey);
  for (const gy of [GY1, GY2]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, GOAL.depth, 8), grey); b.rotation.z = Math.PI / 2; add(b, (x0 + xb) / 2, H, gy); }
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, GY2 - GY1, 8), grey); bb.rotation.x = Math.PI / 2; add(bb, xb, H, F.cy);
  const nc = meshTex('#f6f4ea', 0.85, 1.6), dz = GY2 - GY1;
  quad([[xb, H, GY1], [xb, H, GY2], [xb, 0, GY2], [xb, 0, GY1]], netMat(nc, dz / 9, H / 9));                    // back
  quad([[x0, H, GY1], [xb, H, GY1], [xb, 0, GY1], [x0, 0, GY1]], netMat(nc, GOAL.depth / 9, H / 9));            // far side
  quad([[x0, H, GY2], [xb, H, GY2], [xb, 0, GY2], [x0, 0, GY2]], netMat(nc, GOAL.depth / 9, H / 9));            // near side
  quad([[x0, H, GY1], [x0, H, GY2], [xb, H, GY2], [xb, H, GY1]], netMat(nc, dz / 9, GOAL.depth / 9));           // roof
}

/* ── a kid, modelled limb by limb: rounded muscles, a shaped torso and a proper face ── */
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function limbGeo(r0, r1, len, bulge = 0) {                                // hangs from y = 0 down to -len, rounded at both ends
  return lathe([[0.01, -len - r1], [r1 * 0.72, -len - r1 * 0.68], [r1, -len], [(r0 + r1) / 2 + bulge, -len * 0.55], [r0 + bulge * 0.5, -len * 0.18], [r0, 0], [r0 * 0.72, r0 * 0.68], [0.01, r0]], 12);
}
function jerseyTex(o) {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  R(g, 0, 0, 256, 256, o.jersey);
  g.fillStyle = o.trim;
  for (const x of [-10, 44, 202]) g.fillRect(x, 0, 20, 256); g.fillRect(246, 0, 10, 256);    // stripes down the front; the back stays plain for the number
  g.fillRect(0, 0, 256, 9); g.fillRect(0, 238, 256, 8);                                       // collar and hem
  g.font = '800 62px "Anek Latin",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.trim; g.fillText(o.num, 128, 96);
  for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  return mkTex(c);
}
function buildKid(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(o.s * 1.2);
  const skin = std(o.skin, { roughness: 0.7 }), cloth = std('#ffffff', { map: jerseyTex(o), roughness: 0.9 }), plain = std(o.jersey, { roughness: 0.9 }), trim = std(o.trim, { roughness: 0.9 });
  const shorts = std(o.shorts, { roughness: 0.92 }), hair = std(o.hair, { roughness: 0.95 }), shoe = o.shoe ? std(o.shoe, { roughness: 0.75 }) : skin, dark = std('#15110f');
  const glove = o.gk ? std('#f3f0e4', { roughness: 0.6 }) : skin;
  const part = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

  const hips = new THREE.Group(); hips.position.y = 34.5; body.add(hips);
  part(lathe([[0.01, -7.4], [5.4, -7.2], [8.5, -6.2], [8.8, -2], [8.3, 1.4], [7.6, 3], [0.01, 3.2]]), shorts, hips, 0, 0, 0).scale.z = 0.7;       // shorts
  const torso = new THREE.Group(); torso.position.y = 2; hips.add(torso);
  part(lathe([[0.01, -0.6], [6.6, -0.4], [7.4, 1.6], [7.0, 6.4], [7.5, 11.5], [8.7, 16.6], [8.9, 19.4], [7.4, 21.8], [4.2, 23.3], [3.2, 23.8]], 20), cloth, torso, 0, 0, 0).scale.z = 0.62;
  const chest = torso.children[torso.children.length - 1], neck = part(new THREE.CylinderGeometry(2.6, 2.9, 4, 12), skin, torso, 0, 24.6, 0);

  const head = new THREE.Group(); head.position.y = 32.4; torso.add(head); head.scale.setScalar(0.9);
  part(lathe([[0.01, -8.2], [2.6, -8], [4.4, -6.6], [5.5, -4.2], [6.1, -1], [6.4, 2.2], [6.1, 5.2], [5, 7.4], [3, 8.7], [0.01, 9.1]], 18), skin, head, 0, 0, 0).scale.set(0.93, 1, 1.02);
  part(sph(1.5, 10, 8), skin, head, 0, -1.4, 6.3).scale.set(0.9, 1.15, 1);                                 // nose
  for (const ex of [-2.5, 2.5]) {
    part(sph(1.3, 10, 8), std('#f3efe6', { roughness: 0.4 }), head, ex, 1.3, 5.25).scale.set(1.15, 0.8, 0.6);   // eye
    part(sph(0.78, 8, 6), dark, head, ex, 1.25, 5.85).scale.z = 0.6;
    part(new THREE.BoxGeometry(2.7, 0.55, 0.6), hair, head, ex, 3.25, 5.75).rotation.z = ex > 0 ? -0.12 : 0.12;   // brow
    part(sph(1.9, 8, 8), skin, head, ex * 2.5, 0.2, 0.3).scale.set(0.5, 1.1, 0.8);                           // ear
  }
  part(new THREE.BoxGeometry(3.1, 0.6, 0.5), std('#6e3a30'), head, 0, -4.5, 5.25);                          // mouth
  const cap = part(new THREE.SphereGeometry(6.9, 20, 14, 0, TAU, 0, Math.PI * 0.6), hair, head, 0, 2.2, -0.7); cap.rotation.x = -0.42; cap.scale.set(0.98, 1.06, 1.06);
  if (o.style === 'mop') { for (const [hx, hy, hz, r] of [[-3, 8.2, 2.4, 3.6], [2.8, 8.6, 1.4, 3.9], [0, 8.4, 4.4, 3.2], [-4.6, 6.6, -1, 3.2], [4.6, 6.6, -1.4, 3.2], [0, 7.4, -4, 4]]) part(sph(r, 10, 8), hair, head, hx, hy, hz); }
  else if (o.style === 'part') { const f = part(sph(4.4, 12, 8), hair, head, 1.6, 7.2, 3.4); f.scale.set(1.25, 0.5, 0.9); f.rotation.z = -0.25; }
  else part(sph(4.6, 12, 8), hair, head, 0, 7.6, 2.6).scale.set(1.15, 0.36, 0.9);

  const limb = (px, isArm) => {
    const a = new THREE.Group(), b = new THREE.Group();
    if (isArm) {
      a.position.set(px, 19.6, 0); torso.add(a);
      part(limbGeo(2.9, 2.4, 10.5, 0.2), skin, a, 0, 0, 0);
      if (!o.vest) { part(limbGeo(3.5, 3.3, 5.6), plain, a, 0, 0.4, 0); part(new THREE.CylinderGeometry(3.4, 3.4, 1.3, 12), trim, a, 0, -5.6, 0); }
      else part(sph(3.2, 10, 8), plain, a, -Math.sign(px) * 1.2, 1.2, 0).scale.set(1, 0.7, 1);
      b.position.y = -10.5; a.add(b);
      part(limbGeo(2.4, 1.8, 9.6, 0.15), skin, b, 0, 0, 0);
      const h = part(sph(o.gk ? 2.9 : 2.3, 10, 8), glove, b, 0, -11.6, 0.3); h.scale.set(0.62, 1.25, 1);
      part(sph(o.gk ? 1.3 : 0.95, 6, 6), glove, b, -Math.sign(px) * 0.4, -10.6, 1.9);                                    // thumb
    } else {
      a.position.set(px, -2.4, 0); hips.add(a);
      part(limbGeo(4.4, 3.3, 15.2, 0.25), skin, a, 0, 0, 0);
      part(limbGeo(4.9, 4.7, 5.4), shorts, a, 0, 0.6, 0);                                                    // shorts leg
      b.position.y = -15.2; a.add(b);
      part(limbGeo(3.2, 2.2, 14.4, 0.55), skin, b, 0, 0, -0.3);                                              // calf
      const f = part(sph(3, 12, 8), shoe, b, 0, -15.6, 2.7); f.scale.set(0.95, 0.62, 1.95);
      if (o.shoe) { part(new THREE.CylinderGeometry(2.7, 2.5, 4.6, 12), std('#e9e6dc'), b, 0, -11.6, 0); part(new THREE.BoxGeometry(5.4, 1, 11), std('#2a2623'), b, 0, -17.3, 2.8); }
    }
    return [a, b];
  };
  const k = { root, body, hips, torso, head, o, look: 0, hide: [chest, neck] };
  head.traverse(m => { if (m.isMesh) k.hide.push(m); });
  [k.armL, k.elbL] = limb(10.4, true); [k.armR, k.elbR] = limb(-10.4, true);
  [k.legL, k.kneeL] = limb(4.4, false); [k.legR, k.kneeR] = limb(-4.4, false);
  world.add(root);
  return k;
}
function poseKid(k, p, t, dt) {
  const sp = Math.hypot(p.vx, p.vy), run = Math.min(1, sp / 200), s = Math.sin(p.phase), c = Math.cos(p.phase);
  const f = sp > 8 ? (p.vx * p.fx + p.vy * p.fy) / sp : 1, sd = sp > 8 ? (-p.vx * p.fy + p.vy * p.fx) / sp : 0;   // how much of the motion is forwards, and how much to the kid's right
  k.root.position.set(p.x, 0, p.y); k.root.rotation.y = Math.PI / 2 - p.ang;
  const idle = 1 - run, br = Math.sin(t * 1.9 + p.i * 2.1), fr = run * f, sr = run * sd;
  let lT = (-s * 0.95 - 0.12) * fr + 0.04 * idle, rT = (s * 0.95 - 0.12) * fr - 0.04 * idle;
  let lK = (Math.max(0, c) * 1.45 + 0.18) * run * Math.max(Math.abs(f), 0.45) + 0.08 * idle, rK = (Math.max(0, -c) * 1.45 + 0.18) * run * Math.max(Math.abs(f), 0.45) + 0.08 * idle;
  let lZ = -sr * 0.5 * Math.max(0, -s), rZ = -sr * 0.5 * Math.max(0, s);                                           // sidestep: one leg reaches, the other closes
  let lA = s * 0.95 * fr, rA = -s * 0.95 * fr, elb = -(0.3 + 1.15 * run), twist = s * 0.16 * fr;
  const acc = dt > 0 ? clamp((sp - (k.sp ?? sp)) / dt, -2400, 2400) : 0; k.sp = sp;
  k.push = (k.push || 0) + (clamp(acc * 0.00011, -0.16, 0.16) - (k.push || 0)) * Math.min(1, dt * 7);           // lean into a sprint start, sit back when braking
  let lean = 0.24 * fr + 0.03 * idle + k.push;
  let dA = p.ang - (k.ang ?? p.ang); dA = Math.atan2(Math.sin(dA), Math.cos(dA)); k.ang = p.ang;
  const want = clamp((dt > 0 ? dA / dt : 0) * 0.05, -0.3, 0.3) * run + sr * 0.13;                                  // bank into turns and into a sidestep
  k.roll = (k.roll || 0) + (want - (k.roll || 0)) * Math.min(1, dt * 9);
  let hop = Math.abs(s) * 2.6 * run;
  if (p.kickAnim > 0) {                                                 // plant the left foot, swing the right through the ball
    const u = 1 - p.kickAnim / KICK_ANIM, q = Math.sin(u * Math.PI);
    rT = u < 0.3 ? 0.8 * (u / 0.3) : (0.8 - 2.3 * Math.min(1, (u - 0.3) / 0.3)) * (u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1);
    rK = u < 0.3 ? 1.2 * (u / 0.3) : Math.max(0, 1.2 - (u - 0.3) / 0.2 * 1.2);
    lT = 0.12 * q; lK = 0.3 * q; lean = -0.16 * q; lA = -0.8 * q; rA = 0.7 * q; twist = -0.25 * q; rZ = lZ = 0;
  }
  k.legL.rotation.x = lT; k.legR.rotation.x = rT; k.kneeL.rotation.x = lK; k.kneeR.rotation.x = rK;
  k.legL.rotation.z = lZ; k.legR.rotation.z = rZ;
  k.armL.rotation.x = lA; k.armR.rotation.x = rA; k.armL.rotation.z = 0.13 + 0.06 * run + Math.abs(sr) * 0.25; k.armR.rotation.z = -0.13 - 0.06 * run - Math.abs(sr) * 0.25;
  k.elbL.rotation.x = k.elbR.rotation.x = elb;
  k.torso.rotation.x = lean + br * 0.012 * idle; k.torso.rotation.y = twist; k.hips.rotation.y = -twist * 0.5;
  k.torso.scale.y = 1 + br * 0.008 * idle;
  k.body.position.y = hop; k.body.rotation.z = k.roll;
  let d = Math.atan2(ball.y - p.y, ball.x - p.x) - p.ang; d = Math.atan2(Math.sin(d), Math.cos(d));          // eyes on the ball
  k.look += (clamp(-d, -1.1, 1.1) * 0.75 - k.look) * Math.min(1, dt * 8);
  k.head.rotation.y = k.look - twist; k.head.rotation.x = -lean * 0.5 + (dist(p, ball) < 60 ? 0.22 : 0);
  if (S.phase === 'goal' || S.phase === 'over') {                        // arms up for the scorers, heads down for the rest
    if (p.team === S.scorer) {
      k.armL.rotation.x = k.armR.rotation.x = -2.8; k.armL.rotation.z = 0.34; k.armR.rotation.z = -0.34; k.elbL.rotation.x = k.elbR.rotation.x = -0.2;
      k.body.position.y = S.phase === 'goal' ? Math.abs(Math.sin(t * 8 + p.i)) * 7 : 0; k.head.rotation.x = -0.25;
    } else { k.head.rotation.x = 0.42; k.head.rotation.y = 0; }
  }
}

function buildMarker(label, hex) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(20.5, 24.5, 48), new THREE.MeshBasicMaterial({ color: col(hex), transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.9; g.add(ring);
  const c = mkCanvas(160, 96), x = c.getContext('2d');
  x.fillStyle = 'rgba(17,14,11,.9)'; x.beginPath(); x.moveTo(20, 6); x.lineTo(140, 6); x.quadraticCurveTo(152, 6, 152, 18); x.lineTo(152, 50); x.quadraticCurveTo(152, 62, 140, 62); x.lineTo(94, 62); x.lineTo(80, 84); x.lineTo(66, 62); x.lineTo(20, 62); x.quadraticCurveTo(8, 62, 8, 50); x.lineTo(8, 18); x.quadraticCurveTo(8, 6, 20, 6); x.fill();
  x.font = '800 38px "Anek Latin",system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = hex; x.fillText(label, 80, 36);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: mkTex(c), depthTest: false, transparent: true })); tag.scale.set(52, 31, 1); tag.position.y = 128; tag.renderOrder = 10; g.add(tag);
  g.visible = false; world.add(g); return g;
}

function buildScene() {
  const rng = mul32(5150);
  /* sky, for the first-person view */
  const sk = mkCanvas(16, 256), sg = sk.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#7fa3c4'); gr.addColorStop(0.36, '#b4c9d6'); gr.addColorStop(0.5, '#ecdfc6'); gr.addColorStop(0.53, '#b9ad97'); gr.addColorStop(1, '#8a8072');
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 256);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(5200, 24, 16), new THREE.MeshBasicMaterial({ map: mkTex(sk), side: THREE.BackSide, depthWrite: false })));

  /* ground */
  const laneC = tile(256, '#857d70', rng, 2600);                        // the lanes round the court: three pieces, so nothing ever lies under the court itself
  for (const [x0, y0, x1, y1] of [[-2700, -1500, 3900, CT.y], [-2700, CT.y, CT.x, F.B + 10], [CT.x + CT.w, CT.y, 3900, F.B + 10]]) flat(x0, y0, x1, y1, 0, lam('#ffffff', { map: mkTex(laneC, [(x1 - x0) / 256, (y1 - y0) / 256]) }));
  const courtC = mkCanvas(CT.w * 2, CT.h * 2); paintCourt(courtC);
  flat(CT.x, CT.y, CT.x + CT.w, CT.y + CT.h, 0, lam('#ffffff', { map: mkTex(courtC) }));
  const pv = mkCanvas(184, 60), pg = pv.getContext('2d'); R(pg, 0, 0, 184, 60, '#989082'); speck(pg, 0, 0, 184, 60, 700, rng, '#1e1a16', 0.2, 1.5); speck(pg, 0, 0, 184, 60, 400, rng, '#fff8e8', 0.18, 1.5); R(pg, 0, 0, 2, 60, 'rgba(30,25,20,.35)'); R(pg, 92, 0, 2, 60, 'rgba(30,25,20,.35)');
  flat(-2700, F.B + 10, 3900, F.B + 28, 0, lam('#ffffff', { map: mkTex(pv, [72, 1]) }));
  const kb = mkCanvas(120, 12), kg = kb.getContext('2d'); R(kg, 0, 0, 60, 12, '#2c2a27'); R(kg, 60, 0, 60, 12, '#d8d2c2'); speck(kg, 0, 0, 120, 12, 120, rng, '#6f685c', 0.6, 1.8);
  flat(-2700, F.B + 28, 3900, F.B + 35, 0, lam('#ffffff', { map: mkTex(kb, [110, 1]) }));
  flat(-2700, F.B + 35, 3900, 2400, 0, lam('#ffffff', { map: mkTex(tile(256, '#4b4845', rng, 3000), [26, 6]) }));

  /* kerb walls round the court, with the goal mouths left open */
  const kerb = lam('#b3ac9d');
  for (const [x0, y0, x1, y1] of [[F.L - 10, F.T, F.L, GY1], [F.L - 10, GY2, F.L, F.B + 10], [F.R, F.T, F.R + 10, GY1], [F.R, GY2, F.R + 10, F.B + 10], [F.L, F.B, F.R, F.B + 10]]) box(x0, y0, x1, y1, 0, 12, kerb);
  for (const gx of [CT.x, CT.x + CT.w]) box(gx - 3, F.T, gx + 3, F.B + 10, 0, 4, kerb);

  /* painted boundary wall on the far side */
  wallC = mkCanvas(CT.w * 2, 110); paintWall(wallC); wallT = mkTex(wallC);
  const plaster = lam('#c9c1ad'), wallFace = lam('#ffffff', { map: wallT });
  add(new THREE.Mesh(new THREE.BoxGeometry(CT.w, 55, 10), [plaster, plaster, plaster, plaster, wallFace, plaster]), CT.x + CT.w / 2, 27.5, F.T - 5);
  box(CT.x - 2, F.T - 12, CT.x + CT.w + 2, F.T + 1, 55, 58, lam('#b7b0a0'));

  /* the cage: chain-link above the kerbs on all four sides, cut away round each goal */
  const steel = lam('#59605c'), FH2 = 150;
  const fence = (pts, a, len, hgt) => quad(pts, netMat(meshTex('#2f3634', a, 1.2), len / 7, hgt / 7));
  for (const s of [-1, 1]) {
    const fx = s < 0 ? F.L - 5 : F.R + 5;
    for (const fy of [F.T + 3, GY1 - 6, GY2 + 6, F.B + 7]) pole(fx, fy, 0, FH2, 2, steel);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, F.B + 4 - F.T, 8), steel); rail.rotation.x = Math.PI / 2; add(rail, fx, FH2, (F.T + F.B + 10) / 2);
    fence([[fx, FH2, F.T], [fx, FH2, GY1 - 6], [fx, 12, GY1 - 6], [fx, 12, F.T]], 0.62, GY1 - F.T, FH2);
    fence([[fx, FH2, GY2 + 6], [fx, FH2, F.B + 8], [fx, 12, F.B + 8], [fx, 12, GY2 + 6]], 0.62, GY1 - F.T, FH2);
    fence([[fx, FH2, GY1 - 6], [fx, FH2, GY2 + 6], [fx, GOAL.h + 6, GY2 + 6], [fx, GOAL.h + 6, GY1 - 6]], 0.62, GY2 - GY1, FH2 - GOAL.h);
  }
  const thin = lam('#7d847f');
  const NH = 86;                                                         // the near side is kept low and faint so it never hides play
  for (let px = F.L - 5; px <= F.R + 6; px += (F.R - F.L + 10) / 7) { pole(px, F.B + 5, 0, NH, 1.3, thin); pole(px, F.T - 5, 55, FH2, 1.8, steel); }
  for (const [ry, h0] of [[F.B + 5, NH], [F.T - 5, FH2]]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, F.R - F.L + 10, 8), steel); rail.rotation.z = Math.PI / 2; add(rail, F.cx, h0, ry); }
  fence([[F.L - 5, NH, F.B + 5], [F.R + 5, NH, F.B + 5], [F.R + 5, 12, F.B + 5], [F.L - 5, 12, F.B + 5]], 0.2, F.R - F.L, NH);
  fence([[F.L - 5, FH2, F.T - 5], [F.R + 5, FH2, F.T - 5], [F.R + 5, 58, F.T - 5], [F.L - 5, 58, F.T - 5]], 0.4, F.R - F.L, FH2 - 58);
  buildGoal(-1); buildGoal(1);

  /* the row of shops and houses */
  facadeC = mkCanvas(3440, FH * 2); paintFacade(facadeC); facadeT = mkTex(facadeC);
  const SC = 1.5, FY = 80, fx = v => F.cx + (v - 640) * SC, fh = v => (168 - v) * SC;       // facade drawing → world
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(1720 * SC, FH * SC), lam('#ffffff', { map: facadeT })); add(fm, fx(640), FH * SC / 2, FY, false, true);
  const oxide = lam('#8c3122');                                          // red-oxide rowak
  box(fx(8), FY, fx(198), FY + 30, 0, 26, oxide); box(fx(74), FY + 30, fx(136), FY + 44, 0, 13, lam('#7a2a1d'));
  const tin = mkCanvas(128, 32), tg = tin.getContext('2d'); R(tg, 0, 0, 128, 32, '#6f7f86'); for (let i = 0; i < 128; i += 8) { R(tg, i, 0, 3, 32, 'rgba(0,0,0,.22)'); R(tg, i + 4, 0, 2, 32, 'rgba(255,255,255,.12)'); } speck(tg, 0, 0, 128, 32, 260, rng, '#7a3b1a', 0.6, 3);
  const aw = quad([[fx(208), fh(100), FY + 1], [fx(430), fh(100), FY + 1], [fx(432), fh(116), FY + 44], [fx(206), fh(116), FY + 44]], lam('#ffffff', { map: mkTex(tin, [6, 1]), side: THREE.DoubleSide })); aw.castShadow = true;
  const bamboo = lam('#a58a55'); pole(fx(212), FY + 42, 0, fh(116), 1.6, bamboo); pole(fx(426), FY + 42, 0, fh(116), 1.6, bamboo);
  const wood = lam('#8a6038'); box(fx(244), FY + 58, fx(330), FY + 72, 17, 20, wood); for (const bx of [fx(250), fx(324)]) box(bx - 2, FY + 60, bx + 2, FY + 70, 0, 17, wood);

  /* the other three sides of the neighbourhood: only ever seen in first person */
  fpGroup = new THREE.Group(); world.add(fpGroup);
  const plainC = mkCanvas(3440, FH * 2); paintPlainRow(plainC);
  const side = (w, ox) => { const t = mkTex(plainC); t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / (1720 * SC), 1); t.offset.x = ox; return lam('#ffffff', { map: t }); };
  const near = new THREE.Mesh(new THREE.PlaneGeometry(1720 * SC, FH * SC), lam('#ffffff', { map: mkTex(plainC) })); near.rotation.y = Math.PI; add(near, fx(640), FH * SC / 2, F.B + 378, false, false, fpGroup);
  const sideLen = F.B + 378 - FY, sideMid = (F.B + 378 + FY) / 2;
  const lft = new THREE.Mesh(new THREE.PlaneGeometry(sideLen, FH * SC), side(sideLen, 0.08)); lft.rotation.y = Math.PI / 2; add(lft, F.L - 320, FH * SC / 2, sideMid, false, false, fpGroup);
  const rgt = new THREE.Mesh(new THREE.PlaneGeometry(sideLen, FH * SC), side(sideLen, 0.5)); rgt.rotation.y = -Math.PI / 2; add(rgt, F.R + 320, FH * SC / 2, sideMid, false, false, fpGroup);
  fpGroup.visible = false;

  /* lamp post and the wires */
  const lp = fx(432), ly = FY + 26;
  pole(lp, ly, 0, 300, 3.4, steel, 2.6); box(lp - 46, ly - 2, lp, ly + 2, 228, 231, steel); box(lp - 52, ly - 3, lp - 20, ly + 3, 222, 228, lam('#eef0e6', { emissive: col('#55584a') })); box(lp - 9, ly - 5, lp + 9, ly + 5, 150, 178, lam('#6b716d'));
  const wire = new THREE.LineBasicMaterial({ color: 0x0c0c0c });
  for (const [x2, h1, h2, y2, sag] of [[-900, 240, 236, ly, 26], [-900, 232, 190, ly + 10, 30], [2300, 240, 232, ly, 30], [2300, 226, 200, ly + 12, 34], [fx(700), 170, 150, FY + 2, 16], [fx(214), 168, 160, FY + 2, 12], [2300, 214, 176, ly - 14, 40]]) {
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector3(lp + (x2 - lp) * u, h1 + (h2 - h1) * u - Math.sin(u * Math.PI) * sag, ly + (y2 - ly) * u)); }
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
  }

  /* tree, hand pump, carrom board, taxi */
  const tx = F.R + 170, ty = F.T - 22; pole(tx, ty, 0, 110, 10, lam('#4a3626'), 7);
  const greens = ['#2b4428', '#34532e', '#3f6436', '#4a733c', '#557f42'].map(h => lam(h)), petal = lam('#d5522a');
  for (let i = 0; i < 14; i++) { const a = rng() * TAU, r = rng() * 44, h = 112 + rng() * 62, s = 24 + rng() * 20; add(new THREE.Mesh(new THREE.SphereGeometry(s, 12, 9), greens[(rng() * greens.length) | 0]), tx + Math.cos(a) * r, h, ty + Math.sin(a) * r * 0.8); }
  for (let i = 0; i < 40; i++) { const a = rng() * TAU, e = rng() * 1.2, r = 58; add(new THREE.Mesh(new THREE.SphereGeometry(2 + rng() * 2, 6, 5), petal), tx + Math.cos(a) * Math.sin(e + 0.3) * r, 146 + Math.cos(e) * 44, ty + Math.sin(a) * Math.sin(e + 0.3) * r * 0.8, false, false); }
  box(22, 318, 74, 370, 0, 3, lam('#a39c8d')); const iron = lam('#2f3b36'); pole(48, 344, 3, 40, 4, iron); pole(48, 344, 40, 48, 5.5, iron);
  const hd = box(26, 342.5, 54, 345.5, 42, 45, iron); hd.rotation.z = 0.32; box(50, 342, 64, 346, 28, 32, iron);
  const cc = mkCanvas(128, 128), cg = cc.getContext('2d'); R(cg, 0, 0, 128, 128, '#4b2c17'); R(cg, 12, 12, 104, 104, '#dfc08a'); cg.strokeStyle = '#7b4a28'; cg.lineWidth = 2; cg.strokeRect(30, 30, 68, 68); cg.strokeStyle = '#a3201a'; cg.beginPath(); cg.arc(64, 64, 15, 0, TAU); cg.stroke();
  for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cg.fillStyle = '#1b130c'; cg.beginPath(); cg.arc(64 + ox * 45, 64 + oy * 45, 7, 0, TAU); cg.fill(); }
  for (const [ox, oy, c] of [[0, 0, '#b3261e'], [8, -6, '#1b1b1b'], [-8, 4, '#f1ead6'], [4, 10, '#1b1b1b'], [-6, -10, '#f1ead6'], [26, 20, '#1b1b1b'], [-24, -28, '#f1ead6']]) { cg.fillStyle = c; cg.beginPath(); cg.arc(64 + ox, 64 + oy, 4.4, 0, TAU); cg.fill(); }
  const cx = F.R + 98, cy = F.T + 86, dark = lam('#4b2c17');
  add(new THREE.Mesh(new THREE.BoxGeometry(60, 4, 60), [dark, dark, lam('#ffffff', { map: mkTex(cc) }), dark, dark, dark]), cx, 34, cy);
  for (const [ox, oy] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) pole(cx + ox, cy + oy, 0, 32, 1.8, dark);
  for (const [sx, sy] of [[cx - 4, cy - 54], [cx + 6, cy + 56]]) { pole(sx, sy, 0, 20, 9, lam('#a82e26'), 10); }
  const tg3 = new THREE.Group(); tg3.position.set(F.cx + 300, 0, F.B + 116); tg3.scale.setScalar(0.92); world.add(tg3);
  const tp = (geo, mat, x, h, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, h, z); m.castShadow = true; tg3.add(m); return m; };
  const yel = lam('#e9ad12'), glass = lam('#1c2a33'), tyre = lam('#161616'), chrome = lam('#c9ccc8');
  tp(new THREE.BoxGeometry(176, 22, 64), yel, 0, 21, 0); tp(new THREE.BoxGeometry(177, 3.4, 65), lam('#1d2b53'), 0, 17, 0);
  tp(new THREE.BoxGeometry(50, 7, 58), yel, -60, 35, 0); tp(new THREE.BoxGeometry(34, 6, 58), yel, 68, 34.5, 0);      // bonnet, boot
  tp(new THREE.BoxGeometry(84, 22, 57), glass, 6, 43, 0); tp(new THREE.BoxGeometry(80, 4, 58), yel, 6, 55.5, 0);
  for (const px of [-35, 6, 47]) for (const pz of [-28, 28]) tp(new THREE.BoxGeometry(5, 22, 3.4), yel, px, 43, pz);
  for (const wx of [-56, 56]) for (const wz of [-30, 30]) { const w = tp(new THREE.CylinderGeometry(13, 13, 9, 16), tyre, wx, 13, wz); w.rotation.x = Math.PI / 2; }
  for (const rz of [-22, 22]) tp(new THREE.BoxGeometry(64, 1.6, 1.6), tyre, 8, 60, rz);
  for (const rx of [-18, 8, 34]) tp(new THREE.BoxGeometry(1.6, 1.6, 46), tyre, rx, 60, 0);
  tp(new THREE.BoxGeometry(12, 5, 8), lam('#fff3bf', { emissive: col('#5a5020') }), -26, 60, 0);
  tp(new THREE.BoxGeometry(4, 5, 62), chrome, -89, 15, 0); tp(new THREE.BoxGeometry(4, 5, 62), chrome, 89, 15, 0);

  /* ball */
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(7.6, 22, 16), std('#f4f2ea', { roughness: 0.55 })); ballMesh.castShadow = true; world.add(ballMesh);
  const patch = std('#1e2126', { roughness: 0.6 }), ph = (1 + Math.sqrt(5)) / 2;
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const v of [[0, a, b * ph], [a, b * ph, 0], [a * ph, 0, b]]) {
    const n = new THREE.Vector3(...v).normalize(), d = new THREE.Mesh(new THREE.CircleGeometry(2.7, 5), patch);
    d.position.copy(n).multiplyScalar(7.68); d.lookAt(n.clone().multiplyScalar(20)); ballMesh.add(d);
  }

  KIDS.forEach(o => kids.push(buildKid(o)));
  marks.you = buildMarker('YOU', '#ffd24a'); marks.opp = buildMarker('RIVAL', '#8ff0c0');
}

function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  maxAniso = renderer.capabilities.getMaxAnisotropy();
  scene = new THREE.Scene(); scene.background = col('#14110f');
  camera = new THREE.PerspectiveCamera(30, 16 / 9, 200, 12000);
  world = new THREE.Group(); world.position.set(-F.cx, 0, -F.cy); scene.add(world);
  scene.add(new THREE.HemisphereLight(col('#eef2f6'), col('#9a8e7c'), 0.6));
  sun = new THREE.DirectionalLight(col('#ffe3b8'), 0.62);         // late-afternoon sun from behind the side camera's left shoulder
  sun.position.set(-560, 900, 520); sun.castShadow = true;
  const sm = Math.min(4096, renderer.capabilities.maxTextureSize); sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0006;
  const sc = sun.shadow.camera; sc.left = -960; sc.right = 960; sc.top = 760; sc.bottom = -760; sc.near = 200; sc.far = 2800;
  scene.add(sun); scene.add(sun.target);
  buildScene();
  radar = $('radar').getContext('2d');
}

/* side-on broadcast view, or the world through one kid's eyes */
const look = { v: null }, cam = { x: 0, z: 0 }, ghost = { m: null };
const CAM = { h: 965, back: 945, aim: -72, panX: 255, panZ: 70 };     // side view: height, distance back, where it aims, and how far it follows the ball
function aimCamera(dt) {
  const fp = isFP() && S.phase !== 'menu', me = kids[FPI];
  if (fp !== camFP) {
    camFP = fp; camera.fov = fp ? 100 : 30; camera.near = fp ? 2 : 200; camera.updateProjectionMatrix();
    ghost.m = ghost.m || new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const m of me.hide) { if (fp) { m.userData.mat = m.material; m.material = ghost.m; } else if (m.userData.mat) m.material = m.userData.mat; }   // in first person your own head and chest are unseen but still cast a shadow: you see your arms, legs and the ball
    fpGroup.visible = fp;
  }
  if (document.pointerLockElement === cv && !(fp && playing())) { try { document.exitPointerLock(); } catch (e) {} }
  let fx0, fz0;
  if (!fp) {                                                            // side-on broadcast view that drifts with the ball
    const live = S.phase !== 'menu', tx = live ? clamp(ball.x - F.cx, -CAM.panX, CAM.panX) : 0, tz = live ? clamp((ball.y - F.cy) * 0.3, -CAM.panZ, CAM.panZ) : 0, k = Math.min(1, dt * 2.6);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
    camera.position.set(cam.x, CAM.h, cam.z + CAM.back); camera.lookAt(cam.x, 0, cam.z + CAM.aim);
    fx0 = cam.x; fz0 = cam.z;
  } else {
    const p = P[FPI], fx = Math.cos(FP.yaw), fy = Math.sin(FP.yaw), eye = 97 * KIDS[FPI].s + Math.abs(Math.sin(p.phase)) * 1.6 * Math.min(1, Math.hypot(p.vx, p.vy) / 200);
    const bx = ball.x - p.x, by = ball.y - p.y, ahead = bx * fx + by * fy, side = Math.abs(-bx * fy + by * fx), d = Math.hypot(bx, by);
    let want = 0.3;                                                     // eyes drop to the ball at your feet, and lift again when it is away
    if (ball.owner === FPI) want = 0.74;
    else if (ahead > 0 && d < 260 && side < ahead * 1.3 + 30) want = clamp(Math.atan2(eye - ball.h - 8, d) - 0.55, 0.3, 0.74);
    FP.pitch += (want - FP.pitch) * Math.min(1, dt * 5);
    const pitch = clamp(FP.pitch + FP.look, -0.5, 1.25), cp = Math.cos(pitch);
    camera.position.set(p.x - F.cx + fx * 4, eye, p.y - F.cy + fy * 4);
    look.v = look.v || new THREE.Vector3();
    look.v.set(camera.position.x + fx * cp * 100, eye - Math.sin(pitch) * 100, camera.position.z + fy * cp * 100);
    camera.lookAt(look.v);
    fx0 = p.x - F.cx; fz0 = p.y - F.cy;
  }
  fx0 = Math.round(fx0 / 16) * 16; fz0 = Math.round(fz0 / 16) * 16;     // the sun's shadow box moves with the view, in steps so shadows do not shimmer
  sun.position.set(fx0 - 560, 900, fz0 + 520); sun.target.position.set(fx0, 0, fz0); sun.target.updateMatrixWorld();
}
function drawRadar() {
  const g = radar, W = 220, H = 100, sx = v => 8 + (v - (F.L - 40)) / (F.R - F.L + 80) * (W - 16), sy = v => 8 + (v - F.T) / (F.B - F.T) * (H - 16);
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(239,227,200,.7)'; g.lineWidth = 1.2; g.strokeRect(sx(F.L), sy(F.T), sx(F.R) - sx(F.L), sy(F.B) - sy(F.T));
  g.beginPath(); g.moveTo(sx(F.cx), sy(F.T)); g.lineTo(sx(F.cx), sy(F.B)); g.stroke();
  g.strokeRect(sx(F.L - 40), sy(GY1), sx(F.L) - sx(F.L - 40), sy(GY2) - sy(GY1)); g.strokeRect(sx(F.R), sy(GY1), sx(F.R + 40) - sx(F.R), sy(GY2) - sy(GY1));
  P.forEach((p, i) => {
    const me = camFP ? i === FPI : i === TEAM[myTeam].ctrl;
    g.fillStyle = p.team ? '#35c07f' : '#e8463c'; g.beginPath(); g.arc(sx(p.x), sy(p.y), me ? 4.4 : 3.2, 0, TAU); g.fill();
    if (me) { g.strokeStyle = '#ffd24a'; g.lineWidth = 1.6; g.stroke(); if (camFP) { g.beginPath(); g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(p.x) + Math.cos(FP.yaw) * 11, sy(p.y) + Math.sin(FP.yaw) * 11); g.stroke(); } }
  });
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx(ball.x), sy(ball.y), 2.6, 0, TAU); g.fill();
}

const roll = {};
function render(now, dt) {
  if (!renderer) return;
  const t = now / 1000;
  aimCamera(dt);
  P.forEach((p, i) => poseKid(kids[i], p, t, dt));
  const b = ball, dx = b.x - lastBX, dy = b.y - lastBY, d = Math.hypot(dx, dy);
  if (d > 1e-4 && d < 80) {
    roll.q = roll.q || new THREE.Quaternion(); roll.axis = roll.axis || new THREE.Vector3();
    roll.axis.set(dy / d, 0, -dx / d); roll.q.setFromAxisAngle(roll.axis, d / 7.6); ballMesh.quaternion.premultiply(roll.q);
  }
  lastBX = b.x; lastBY = b.y;
  ballMesh.position.set(b.x, 7.6 + b.h, b.y);
  const on = S.phase !== 'menu' && !S.demo;
  const put = (m, vis, p) => { m.visible = vis; if (vis) { m.position.set(p.x, 0, p.y); m.children[1].position.y = 128 + Math.sin(t * 4) * 1.6; } };
  put(marks.you, on && !camFP, P[TEAM[myTeam].ctrl]);
  put(marks.opp, on && isNet(), P[TEAM[1 - myTeam].ctrl]);
  const rd = $('radar'), showRadar = S.phase !== 'menu'; if (rd.hidden === showRadar) rd.hidden = !showRadar;
  if (showRadar) drawRadar();
  renderer.render(scene, camera);
}

/* ───────────── layout ───────────── */
function fit() {
  const cs = getComputedStyle(app);
  const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const hudH = Math.round(clamp(ah * 0.085, 36, 62));
  const w = Math.max(160, Math.floor(Math.min(aw, (ah - hudH) * 16 / 9))), h = Math.round(w * 9 / 16);
  shell.style.width = w + 'px'; hud.style.height = hudH + 'px'; frameEl.style.height = h + 'px';
  if (renderer) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); }
}
addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(app);

/* ───────────── loop + boot ───────────── */
let last = 0, acc = 0;
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
  const online = isNet() && N.mr && N.started;
  if (online && N.role === 'guest') netGuestFrame(dt, t);
  else if ((inMatch() && !S.paused) || (online && S.phase === 'over')) {
    if (inMatch()) { acc += dt; let n = 0; while (acc >= STEP && n++ < 12) { step(STEP); acc -= STEP; } }
    if (online) netHostFrame();
  } else acc = 0;
  render(t, dt);
  requestAnimationFrame(tick);
}
function boot(data) {
  try { if (!window.THREE) throw new Error('three.js did not load'); initGL(); }
  catch (e) { renderer = null; show('nogl', true); console.error(e); }
  fit();
  if (data && (data.mode === 'cpu' || data.mode === 'fp') && Array.isArray(data.score)) { startMatch(data.mode, data.score); setPaused(true); }
  else toMenu();
  if (document.fonts && renderer) {
    const again = () => { paintFacade(facadeC); paintWall(wallC); facadeT.needsUpdate = wallT.needsUpdate = true; };
    Promise.all([document.fonts.load('800 16px "Anek Bangla"', 'পাড়া'), document.fonts.load('400 16px "Galada"', 'পাড়া')]).then(again, () => {});
  }
  requestAnimationFrame(tick);
}
try { window.claude?.hot?.snapshot?.(() => ({ mode: inMatch() && !isNet() ? S.mode : null, score: S.score.slice() })); } catch (e) {}
window.__psf = { get sun() { return sun; }, S, P, TEAM, ball, AI, LEVELS, TUNE, CAM, NT, NP, FPI, setLevel, N, FP, step, F, kickBuf, passBuf, get level() { return level; }, get camera() { return camera; }, get myTeam() { return myTeam; } };
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? {});
})();
