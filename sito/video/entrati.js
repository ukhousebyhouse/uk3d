// Reel 45 "55 people walked in" (A, 22/11): ontem 55 pessoas entraram no mapa → não numa tela, dentro dele (personagem aparece)
// → criaram o personagem → andaram pela rua → abriram a porta (interior) → baú do tesouro → jogos do dia → ranking com o PM no topo
// → 152 castelos e nenhum dono → entrar é grátis (bio → Sign in → e-mail → créditos todo dia) → comente sua cidade → share.
// Dados reais do snapshot (ranking dos jogos). window.preparar / quadro / suoni (cattura.mjs).
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, RUA, QW, QH, posLote } from '../js/citta.js';
import { costruisci, animaAcc } from '../js/personaggio.js';
import { modello, PEG } from '../js/interni.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { kit, $, clamp, suave, ressalto, fase, esc } from './kit.js';

const $$ = s => [...document.querySelectorAll(s)];
const H = LOTE * 0.3;
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const PG = [
  { c: 'uomo', pelle: 1, capelli: 'ciuffo', colCap: 1, maglia: 1, pant: 0, gonna: false },
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 4, pant: 1, gonna: true },
];
const W = 7, DD = 6;
const MOB = [['pianta', 0, 0, 0], ['tappeto', 1, 2, 0], ['divano', 0, 2, 1], ['letto', 5, 0, 0], ['tv', 2, 0, 0], ['lampada', 4, 0, 0], ['quadro', 1, 0, 0], ['tavolino', 1, 3, 0], ['poltrona', 3, 3, 3], ['acquario', 3, 5, 2]];

let D, mappa, citta, K, R, E, L, CASA, CHEST, cena, omini = [], scene = [], INT = null, base = null, pins = [];
const p = i => E[`p${i}`] - 0.08;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar; window.quadro = quadro; window.suoni = suoni;
}
function frente(o) { const rot = posLote(o.lote).rot, lado = rot === 0 ? 1 : -1; return { x: o.x, z: o.z + lado * (LOTE * 0.5 + RUA / 2), lado }; }
function forziere() {
  const g = new THREE.Group(), Lm = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const legno = Lm('#8B5A2B'), oro = new THREE.MeshLambertMaterial({ color: '#FFC93C', emissive: '#6B4E00' });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.62 * H, 0.36 * H, 0.42 * H), legno); b.position.y = 0.18 * H; g.add(b);
  for (const x of [-0.22, 0.22]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06 * H, 0.38 * H, 0.44 * H), oro); f.position.set(x * H, 0.19 * H, 0); g.add(f); }
  const cop = new THREE.Group(); cop.position.set(0, 0.36 * H, -0.21 * H); g.add(cop);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21 * H, 0.21 * H, 0.62 * H, 10, 1, false, 0, Math.PI), legno);
  c.rotation.z = Math.PI / 2; c.rotation.y = Math.PI / 2; c.position.set(0, 0, 0.21 * H); cop.add(c);
  const raio = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * H, 0.3 * H, 4 * H, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#FFE38A', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  raio.position.y = 2 * H; g.add(raio);
  g.userData = { cop, raio };
  return g;
}

const fasi = () => [
  ['map', 0, p(1)], ['rua', p(1), E.door + 0.3], ['int', E.door + 0.3, E.treasure - 0.1], ['rua', E.treasure - 0.1, p(7)], ['ui', p(7), p(10)], ['map', p(10), p(13)],
  ['ui', p(13), p(18)], ['rua', p(18), 999],
];
const faseDi = t => fasi().find(([, a, b]) => t >= a && t < b)?.[0] ?? 'rua';
function restaurarMapa() { const c = mappa.camera; c.fov = base.fov; c.far = base.far; mappa.scene.fog.near = base.fogN; mappa.scene.fog.far = base.fogF; mappa.mar.visible = true; }

let ultimoAgg = null;
function aggiorna(x, z) {
  if (ultimoAgg && Math.hypot(ultimoAgg.x - x, ultimoAgg.z - z) < 0.25) return;
  ultimoAgg = { x, z }; mappa.alvo.set(x, L.hc, z); mappa.dist = 0.45; citta.atualizar(true);
}
function cameraRua(t) {
  const sc = scene.find(s => t >= s.t0 && t < s.t1) ?? scene[scene.length - 1], k = clamp((t - sc.t0) / (sc.t1 - sc.t0)), ks = sc.liscio ? suave(k) : k;
  const x = sc.A.x + (sc.B.x - sc.A.x) * ks, z = sc.A.z + (sc.B.z - sc.A.z) * ks;
  aggiorna(x, z);
  const c = mappa.camera;
  c.fov = 58; c.near = 0.0015; c.far = 9; mappa.mar.visible = false; mappa.scene.fog.near = 0.35; mappa.scene.fog.far = 2.6;
  const qual = t >= E.character ? 1 : 0;
  omini.forEach((o, i) => { o.visible = i === qual; });
  const o = omini[qual], a = o.userData, anda = sc.anda !== false;
  const dist = Math.hypot(sc.B.x - sc.A.x, sc.B.z - sc.A.z) * ks, fa = anda ? dist / (H * 0.55) : 0, sw = anda ? Math.sin(fa * Math.PI) * 0.7 : 0;
  o.position.set(x, L.hc + 0.0009 + (anda ? Math.abs(Math.sin(fa * Math.PI)) * H * 0.04 : 0), z);
  o.scale.setScalar(Math.max(0.001, sc.pop ? ressalto(fase(t, sc.pop, 0.35)) : 1));
  o.rotation.y = sc.olha ?? Math.atan2(sc.B.x - sc.A.x, sc.B.z - sc.A.z);
  a.pe.rotation.x = sw; a.pd.rotation.x = -sw; a.be.rotation.x = -sw * 0.8; a.bd.rotation.x = sw * 0.8;
  animaAcc(o, t * 1000);
  if (sc.primo) {
    const ang = sc.ang0 + (t - sc.t0) * 0.09;
    o.rotation.y = ang;
    c.position.set(x + Math.sin(ang) * LOTE * 0.95, L.hc + LOTE * 0.42, z + Math.cos(ang) * LOTE * 0.95);
    c.lookAt(x, L.hc + LOTE * 0.36, z);
  } else {
    const yaw = sc.yaw, d = LOTE * 1.8, alt = LOTE * 1.28;
    c.position.set(x + Math.sin(yaw) * d, L.hc + alt, z + Math.cos(yaw) * d);
    c.lookAt(x - Math.sin(yaw) * LOTE * 0.45, L.hc + H * 0.6, z - Math.cos(yaw) * LOTE * 0.45);
  }
  c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  return { x, z };
}
function bau(t) {
  const o = CHEST, a = o.userData, vis = t >= p(6) - 0.2 && t < p(7);
  o.visible = vis; if (!vis) return;
  const ko = suave(fase(t, E.credits6 - 0.15, 0.5));
  a.cop.rotation.x = -1.9 * ko; if (!ko) o.rotation.y = t * 1.2;
  o.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * fase(t, E.credits6 - 0.15, 0.9)));
  a.raio.material.opacity = ko > 0 ? 0.6 * (1 - ko) : 0.25 + 0.15 * Math.sin(t * 4);
}
function tags(t, pos) {
  const out = [], usados = [];
  const add = (x, y, z, html, cls = '') => {
    const q = K.projetar(x, y, z);
    if (!q.ok || q.x < 60 || q.x > 1020 || q.y < 220 || q.y > 1300) return;
    if (usados.some(([ux, uy]) => Math.abs(ux - q.x) < 270 && Math.abs(uy - q.y) < 72)) return;
    usados.push([q.x, q.y]); out.push(`<div class="tg ${cls}" style="left:${q.x.toFixed(0)}px;top:${q.y.toFixed(0)}px">${html}</div>`);
  };
  if (t >= E.door - 0.6 && t < E.door + 0.3) add(CASA.x, L.hc + LOTE * (ALTURA_NIVEL[CASA.livello] + 0.15), CASA.z, '🏠 @your_name', 'mia');
  if (!(t >= p(3) && t < p(4))) {
    const lista = L.casas.map(i => D.casas[i]).filter(c => c !== CASA && Math.abs(c.x - pos.x) < LOTE * 8 && Math.abs(c.z - pos.z) < LOTE * 8).map(c => [Math.hypot(c.x - pos.x, c.z - pos.z), c]).sort((a, b) => a[0] - b[0]);
    for (const [, c] of lista.slice(0, 40)) { if (out.length >= 6) break; add(c.x, L.hc + LOTE * (ALTURA_NIVEL[c.livello] + 0.1), c.z, `@${esc(c.conta)}`); }
  }
  const html = out.join(''), el = $('#tags'); if (el.innerHTML !== html) el.innerHTML = html;
}
function montarInterno() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#DCEBFF');
  s.add(new THREE.HemisphereLight(0xffffff, 0xb0a48c, 2.2));
  const sol = new THREE.DirectionalLight(0xfff1dc, 1.6); sol.position.set(4, 8, 5); s.add(sol);
  const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); s.add(m); return m; };
  box(W, 0.12, DD, '#F3F1EC', 0, -0.06, 0);
  for (let k = 1; k < W; k++) box(0.02, 0.005, DD, '#D6D2C8', -W / 2 + k, 0.003, 0); for (let k = 1; k < DD; k++) box(W, 0.005, 0.02, '#D6D2C8', 0, 0.003, -DD / 2 + k);
  box(W + 0.15, 2.7, 0.15, '#9ED1F2', -0.075, 1.35, -DD / 2 - 0.075); box(0.15, 2.7, DD, '#9ED1F2', -W / 2 - 0.075, 1.35, 0);
  box(W, 0.12, 0.04, '#FFFFFF', 0, 0.06, -DD / 2 + 0.02); box(0.04, 0.12, DD, '#FFFFFF', -W / 2 + 0.02, 0.06, 0);
  box(1.4, 1.1, 0.04, '#FFFFFF', W / 2 - 1.2, 1.55, -DD / 2 + 0.01); box(1.24, 0.94, 0.05, '#9ED1F2', W / 2 - 1.2, 1.55, -DD / 2 + 0.012);
  const porta = box(0.04, 2.0, 0.95, '#7A4A2A', -W / 2 + 0.01, 1.0, DD / 2 - 1.0);
  const items = MOB.map(([t, x, z, r]) => { const m = modello(t); s.add(m); const [w0, d0] = PEG[t], [w, d] = r % 2 ? [d0, w0] : [w0, d0];
    m.position.set(...(PEG[t][2] === 'muro' ? [x + 0.5 - W / 2, 0, -DD / 2 + 0.05] : [x + w / 2 - W / 2, 0.001, z + d / 2 - DD / 2])); m.rotation.y = r * Math.PI / 2; return m; });
  const io = costruisci(PG[1], 1.5); io.position.set(-W / 2 + 0.8, 0, DD / 2 - 1.0); io.rotation.y = Math.PI / 2; s.add(io);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 100);
  INT = { s, cam, items, io, porta };
}
function interno(t) {
  const I = INT, t0 = E.door + 0.3;
  const k = suave(fase(t, t0, 0.8)); I.io.position.x = -W / 2 + 0.6 + k * 1.2;
  const a = I.io.userData, sw = Math.sin(t * 9) * 0.6 * (k < 1 ? 1 : 0); a.pe.rotation.x = sw; a.pd.rotation.x = -sw;
  const yaw = 0.55 + Math.sin((t - t0) * 0.3) * 0.2, Rr = 7 * 2.35 * (1.2 - 0.2 * suave(fase(t, t0, 1.0))), alt = 0.8;
  I.cam.position.set(Math.sin(yaw) * Rr * Math.cos(alt), Rr * Math.sin(alt), Math.cos(yaw) * Rr * Math.cos(alt));
  I.cam.lookAt(0.2, 0.1, 1.0); I.cam.updateMatrixWorld(true);
}
function alfinetes(t, ph) {
  const vis = ph === 'map' && t >= p(10);
  pins.forEach((pn, i) => {
    if (!vis) { pn.el.style.opacity = '0'; return; }
    const q = K.projetar(pn.x, 0.02, pn.z), ti = p(11) + (i / pins.length) * 1.4, k = t >= ti ? ressalto(fase(t, ti, 0.3)) : 0;
    pn.el.style.opacity = q.ok && k > 0 ? (t >= E.owner ? '0.55' : '1') : '0';
    pn.el.style.filter = t >= E.owner ? 'grayscale(1)' : '';
    pn.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${k})`;
  });
}

const GENTE = Array.from({ length: 22 }, (_, i) => ({ dx: ((i * 173) % 900) - 450, atraso: (i * 0.13) % 2.6, sobe: 500 + ((i * 89) % 500), em: ['🚶', '🧍', '🚶‍♀️', '🧍‍♂️'][i % 4] }));
const MONETE = Array.from({ length: 12 }, (_, i) => ({ dx: ((i * 173) % 640) - 320, atraso: (i * 0.05) % 0.5, sobe: 300 + ((i * 89) % 320), em: i % 3 ? '💰' : '⭐' }));
const EMAIL = 'you@email.co.uk';
let tocchi = [];
const centro = el => { const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };

function quadro(t) {
  const ph = faseDi(t);
  omini.forEach(o => { o.visible = false; });
  let pos = null;
  if (ph === 'rua') pos = cameraRua(t); else if (ph !== 'int') { restaurarMapa(); K.camera(t); }
  if (ph === 'int') interno(t);
  bau(t);
  citta.grupo.visible = ph === 'rua' || mappa.dist < 32;
  $('#scuro').style.opacity = String(ph === 'ui' && t < p(16) ? 0.42 : ph === 'map' ? 0.12 : 0);
  // contador de pessoas
  K.pop($('#numero'), t, 0.15, p(1));
  $('#numero b').textContent = String(Math.round(55 * suave(fase(t, 0.2, Math.max(0.5, p(1) - 0.9)))));
  $$('#pins i.gente').forEach((el, i) => {
    const g = GENTE[i], dt = t - 0.3 - g.atraso, vis = dt > 0 && dt < 1.6 && t < p(1);
    el.style.opacity = vis ? String(1 - fase(dt, 1.1, 0.5)) : '0';
    if (vis) el.style.transform = `translate(${520 + g.dx * suave(fase(dt, 0, 1.2))}px, ${1300 - g.sobe * suave(fase(dt, 0, 1.6))}px) scale(${1.6})`;
  });
  // editor (só o selo de criação: close no personagem trocando)
  const ed = $('#editor');
  if (t >= p(3) && t < p(4)) { K.pop(ed, t, p(3) + 0.05, p(4)); const donna = t >= E.character; ed.querySelector('.u').classList.toggle('on', !donna); ed.querySelector('.d').classList.toggle('on', donna); $$('#editor .opz span').forEach((s, i) => s.classList.toggle('on', donna && i === 1)); $$('#editor .sw i').forEach((s, i) => s.classList.toggle('on', i === (donna ? 4 : 1))); } else ed.style.opacity = '0';
  // baú
  if (t >= p(6) && t < p(7)) { K.pop($('#bussola'), t, p(6) + 0.1, p(7)); const m = Math.max(0, Math.round(30 * (1 - fase(t, p(6), E.credits6 - p(6))) / 5) * 5); $('#bussola').innerHTML = m > 0 ? `🧭 Treasure <b>${m} m</b> away` : '🧭 Treasure found! ✅'; } else $('#bussola').style.opacity = '0';
  K.pop($('#piu'), t, E.credits6, p(7));
  const tm = t >= E.credits15 - 0.1 && t < p(16) ? E.credits15 : E.credits6;
  $$('#monete i').forEach((el, i) => {
    const m = MONETE[i], dt = t - tm - m.atraso, vis = dt > 0 && dt < 1.2 && (tm !== E.credits6 || t < p(7));
    el.style.opacity = vis ? String(1 - fase(dt, 0.8, 0.4)) : '0';
    if (vis) el.style.transform = `translate(${500 + m.dx * suave(fase(dt, 0, 0.8))}px, ${900 - m.sobe * Math.sin(Math.min(1, dt / 1.0) * Math.PI)}px)`;
  });
  // jogos e ranking
  const gi = $('#giochi');
  if (t >= p(7) && t < p(8)) { K.pop(gi, t, p(7), p(8)); $$('#giochi .ind').forEach((el, i) => { const ti = p(7) + 0.3 + i * 0.35; el.style.opacity = t >= ti ? '1' : '0'; }); const ri = $('#giochi .ris'); ri.style.opacity = t >= E.games ? '1' : '0'; ri.style.transform = `scale(${t >= E.games ? ressalto(fase(t, E.games, 0.3)) : 0})`; } else gi.style.opacity = '0';
  const cl = $('#classifica');
  if (t >= p(8) && t < p(10)) {
    K.pop(cl, t, p(8), p(10));
    $$('#classifica .r').forEach((el, i) => { const ti = E.leaderboard - 0.2 + (4 - i) * 0.15; el.style.opacity = t >= ti ? '1' : '0'; el.style.transform = `translateX(${(1 - suave(fase(t, ti, 0.3))) * 80}px)`; });
    const pm = $('#classifica .r.pmx'); if (pm) { pm.classList.toggle('pm', t >= E.pm); pm.style.transform = `scale(${batida(t, E.pm)})`; pm.querySelector('.co').textContent = t >= E.pm ? '👑' : ''; }
  } else cl.style.opacity = '0';
  // castelos
  K.pop($('#conta'), t, p(11), p(13));
  $('#conta span .g').style.transform = `scale(${batida(t, E.owner)})`;
  alfinetes(t, ph);
  // telefone
  const tf = $('#telefono');
  if (t >= p(14) - 0.2 && t < p(16)) {
    K.pop(tf, t, p(14) - 0.2, p(16));
    const passo = t >= E.credits15 - 0.4 ? 6 : t >= E.typeemail - 0.1 ? 3 : t >= E.signin - 0.25 ? 2 : 1;
    $$('#telefono .passo').forEach(el => el.classList.toggle('on', +el.dataset.p === passo));
    $('#email .tx').textContent = EMAIL.slice(0, Math.round(EMAIL.length * fase(t, E.typeemail, 0.8))); $('#email .cur').style.opacity = Math.sin(t * 12) > 0 ? '1' : '0';
    $('#saldo').textContent = `${t >= E.credits15 ? 2 : 0} 💰`; $('#saldo').style.transform = `scale(${batida(t, E.credits15)})`;
  } else tf.style.opacity = '0';
  for (const x of cena.timbri) K.pop(x.el, t, x.ini, x.fim, { base: `rotate(${x.rot}deg)` });
  K.banner(t, [E.comment, E.comment + 0.45], R.banner, p(18));
  const tc = $('#tocco'); let tocou = false;
  for (const [ti, alvo] of tocchi) { const k = fase(t, ti, 0.45); if (k <= 0 || k >= 1) continue; const a = alvo(); if (!a) continue; tc.style.left = `${a.x}px`; tc.style.top = `${a.y}px`; tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`; tocou = true; break; }
  if (!tocou) tc.style.opacity = '0';
  const fl = Math.max(0, ...cena.tagli.map(tt => (t >= tt ? 0.7 * (1 - fase(t, tt, 0.22)) : 0)));
  $('#velo').style.opacity = R.copertina ? '0' : String(fl);
  if (ph === 'rua') tags(t, pos); else $('#tags').innerHTML = '';
  K.legenda(t);
  if (ph === 'int') { $('#flash').style.opacity = '0'; mappa.renderer.render(INT.s, INT.cam); } else K.fechar(t);
  return true;
}

function suoni() {
  const S = [], add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata - 0.05) S.push({ t: +t.toFixed(3), tipo, vol: 0.7, ...o }); };
  add(0.02, 'whoosh', { dur: 0.5, vol: 0.5 }); add(0.15, 'rullo', { dur: Math.max(0.5, p(1) - 0.9), vol: 0.35 }); add(p(1) - 0.7, 'coin', { vol: 0.7 });
  GENTE.forEach((g, i) => { if (i % 3 === 0) add(0.3 + g.atraso, 'pop', { vol: 0.25, tono: 1.1 + i * 0.02 }); });
  add(p(1) - 0.5, 'riser', { dur: 0.5, vol: 0.3 }); add(E.inside, 'boom', { vol: 0.35 }); add(E.inside + 0.05, 'scintilla', { vol: 0.5 });
  cena.tagli.forEach(tc => { if (tc > 1) add(tc - 0.1, 'whoosh', { vol: 0.35, dur: 0.3 }); });
  add(E.character, 'select', { vol: 0.55 }); add(E.character + 0.05, 'pop', { vol: 0.5, tono: 1.15 });
  for (const sc of scene) if (sc.anda !== false && !sc.primo) for (let x = sc.t0 + 0.1; x < sc.t1 - 0.05; x += 0.27) add(x, 'tap', { vol: 0.16, tono: 0.75 + ((x * 7) % 1) * 0.1 });
  add(E.door, 'flap', { vol: 0.5 }); add(E.door + 0.3, 'ding', { vol: 0.45, tono: 1.2 });
  add(E.treasure, 'scintilla', { vol: 0.4 }); add(E.credits6 - 0.15, 'flap', { vol: 0.5 }); add(E.credits6, 'coin', { vol: 0.75 });
  MONETE.forEach((m, i) => { if (i % 3 === 0) { add(E.credits6 + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); add(E.credits15 + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); } });
  for (let i = 0; i < 3; i++) add(p(7) + 0.3 + i * 0.35, 'tick', { vol: 0.4, tono: 1 + i * 0.1 }); add(E.games, 'ding', { vol: 0.55, tono: 1.3 });
  for (let i = 0; i < 5; i++) add(E.leaderboard - 0.2 + i * 0.15, 'pop', { vol: 0.35, tono: 1 + i * 0.06 });
  add(E.pm, 'campana', { vol: 0.6 }); add(E.pm + 0.05, 'scintilla', { vol: 0.45 });
  for (let i = 0; i < 10; i++) add(p(11) + i * 0.14, 'pop', { vol: 0.22, tono: 1.1 + i * 0.04 });
  add(E.owner, 'boom', { vol: 0.35 }); add(E.free13, 'ding', { vol: 0.5, tono: 1.2 });
  tocchi.forEach(([ti]) => { add(ti, 'tap', { vol: 0.7 }); add(ti + 0.08, 'select', { vol: 0.35 }); });
  for (let k = 0; k < EMAIL.length; k += 2) add(E.typeemail + k * 0.8 / EMAIL.length, 'tasto', { vol: 0.25 });
  add(E.credits15, 'coin', { vol: 0.75 }); add(E.comment, 'notifica', { tono: 1.1 }); add(E.send, 'stamp'); add(E.send + 0.4, 'notifica', { tono: 1.2 });
  for (const x of cena.timbri) if (x.ini > 1) add(x.ini, 'stamp', { vol: 0.45 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.22 });
  return S.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const c = mappa.camera; base = { fov: c.fov, far: c.far, fogN: mappa.scene.fog.near, fogF: mappa.scene.fog.far };
  L = D.luoghi.find(l => l.nome === R.dati.citta); if (!L) throw new Error('cidade');
  L.hc = citta.dadosCidade(L).hc;
  CASA = L.casas.map(i => D.casas[i]).filter(x => x.livello >= 2 && x.livello <= 5 && posLote(x.lote).rot === 0 && x.lote < 16).sort((a, b) => a.lote - b.lote)[0];
  citta.posCasa(CASA);
  omini = PG.map(pg => { const o = costruisci(pg, H); o.visible = false; mappa.scene.add(o); return o; });
  montarInterno();
  const rua = (j, i0, i1) => ({ A: { x: L.x + i0 * QW, z: L.z + (j + 0.5) * QH }, B: { x: L.x + i1 * QW, z: L.z + (j + 0.5) * QH } });
  const r1 = rua(0, -0.42, -0.08), r2 = rua(1, -1.6, -0.4), rBau = rua(1, 0.1, 0.62), rFim = rua(0, 0.2, 0.55), fC = frente(CASA);
  CHEST = forziere(); CHEST.position.set(rBau.B.x + LOTE * 0.25, L.hc + 0.0009, rBau.B.z); mappa.scene.add(CHEST);
  scene = [
    { t0: p(1), t1: p(3), ...r1, yaw: -Math.PI / 2 + 0.35, pop: E.inside - 0.1 },
    { t0: p(3), t1: p(4), A: r1.B, B: r1.B, anda: false, primo: true, ang0: -Math.PI / 2 - 0.15 },
    { t0: p(4), t1: p(5), ...r2, yaw: -Math.PI / 2 + 0.35 },
    { t0: p(5), t1: E.door + 0.3, A: { x: CASA.x - LOTE * 1.4, z: fC.z }, B: { x: CASA.x, z: fC.z - fC.lado * LOTE * 0.15 }, yaw: -Math.PI / 2 + fC.lado * 0.5, liscio: true },
    { t0: E.treasure - 0.1, t1: p(7), A: rBau.A, B: { x: rBau.B.x - LOTE * 0.2, z: rBau.B.z }, yaw: -Math.PI / 2 + 0.3, liscio: true },
    { t0: p(18), t1: 999, ...rFim, yaw: -Math.PI / 2 + 0.35 },
  ];
  // castelos: 1 por county com casas
  const cont = new Map();
  for (const l of D.luoghi) { const k = l.comune.sigla; if (!k) continue; const a = cont.get(k) ?? { x: 0, z: 0, n: 0 }; a.x += l.x; a.z += l.z; a.n++; cont.set(k, a); }
  const lista = [...cont.values()].map(a => ({ x: a.x / a.n, z: a.z / a.n })).sort((a, b) => (a.z - b.z) || (a.x - b.x));
  $('#pins').innerHTML = GENTE.map(g => `<i class="gente">${g.em}</i>`).join('') + lista.map(() => '<i class="cast">🏰</i>').join('');
  pins = lista.map((x, i) => ({ ...x, el: $$('#pins i.cast')[i] }));
  $('#conta b').textContent = String(lista.length);
  // ranking real dos jogos (o PM em destaque)
  const pm = D.snap.cariche?.presidente?.conta, rk = (D.snap.missioni?.classifica ?? []).slice(0, 5);
  $('#classifica .righe').innerHTML = rk.map((r, i) => `<div class="r${r.conta === pm ? ' pmx' : ''}"><span class="pos">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span><span class="chi">@${esc(r.conta)} <span class="co"></span></span><b>${r.p}</b></div>`).join('');
  $('#monete').innerHTML = MONETE.map(m => `<i>${m.em}</i>`).join('');
  const vista = (o = {}) => ({ x: L.x, z: L.z, dist: 1.4, az: 0.4, el: 42, giu: 0, dy: 0, su: 0, ...o });
  K.chaves([
    [0, K.uk({ dist: mappa.distPais() * 1.06 })],
    [p(1) - 0.06, K.uk({ dist: mappa.distPais() * 0.96, az: 0.06 })],
    [p(7), vista({ dist: 1.6, az: -0.2, el: 46, cut: true })],
    [p(10) - 0.05, vista({ dist: 1.4, az: 0.2, el: 46 })],
    [p(10), K.uk({ cut: true, su: -60 })],
    [p(13) - 0.05, K.uk({ dist: mappa.distPais() * 0.94, su: -60 })],
    [p(13), vista({ dist: 1.8, az: 0.6, el: 44, cut: true })],
    [p(18), vista({ dist: 1.2, az: 1.1, el: 40 })],
  ]);
  cena.tagli = [p(1), p(3), p(4), p(5), E.door + 0.3, E.treasure - 0.1, p(7), p(8), p(10), p(13), p(14) - 0.2, p(16), p(18)];
  cena.impatti = [[E.n55, 0.4], [E.inside, 0.4], [E.credits6, 0.3], [E.pm, 0.3], [E.owner, 0.4], [E.credits15, 0.3]];
  cena.flash = [[0, 0.3], [E.inside, 0.4], [E.pm, 0.3], [E.owner, 0.3]];
  cena.timbri = [
    K.timbro('📱 NOT ON A SCREEN', '#E0306E', 250, p(1) + 0.1, p(2), 3, 84),
    K.timbro('🚶 <span class="g">INSIDE</span> IT', '#1E5AA8', 250, E.inside, p(3), -3, 110),
    K.timbro('🔑 YOUR FRONT DOOR', '#7B2CBF', 250, E.door - 0.6, E.door + 0.3, -3, 84),
    K.timbro('🎁 <span class="g">FREE</span> CREDITS', '#2FB36A', 1180, E.credits6 + 0.1, p(7), 3, 84),
    K.timbro('👀 NOBODY\'S SPOTTED IT', '#E0306E', 1180, p(10), p(11), 3, 76),
    K.timbro('🏰 <span class="g">0</span> OWNERS', '#7B2CBF', 1180, E.owner, p(13), -3, 110),
    K.timbro('🆓 FREE · 10 SECONDS', '#2FB36A', 250, E.free13, p(14), -3, 84),
    K.timbro('📤 Send to a mate', '#1E5AA8', 1150, E.send, Infinity, -3, 84),
  ];
  tocchi = [[E.bio, () => centro($('#telefono .link'))], [E.signin, () => centro($('#btn-signin'))], [E.typeemail, () => centro($('#email'))]];
  if (R.copertina) { K.capa(); for (const s of ['#tocco', '#velo', '#monete']) $(s).style.display = 'none'; }
  console.log(`dados ${D.snap.dati_fino} · ${L.nome} · casa demo lote ${CASA.lote} · ranking ${rk.map(r => r.conta).join(', ')} · ${lista.length} counties`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
