// Reel 43 "You can now walk inside this map" (lançamento, 21/11): mapa → todo @ é gente de verdade → passeio em Coventry
// (personagem aparece, editor: cabelo/pele/roupa) → rua com @, loja real (Binley Mega Chippy), pub e outdoor → baú do tesouro (+2 💰)
// → dentro da casa (móveis entrando, piso e paredes mudando, visita) → bike/scooter/esportivo pegando a estrada → jogos (Guess the
// Town, Big Ben) → como entrar (bio → Sign in → e-mail → código, sem senha → liga o Instagram → +2 💰 por dia) → comente sua cidade → share.
// A casa por dentro é de demonstração (sem @ de ninguém). window.preparar / quadro / suoni (cattura.mjs).
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, RUA, QW, QH, posLote } from '../js/citta.js';
import { costruisci, animaAcc } from '../js/personaggio.js';
import { costruisciVeicolo, SEDUTO } from '../js/veicoli.js';
import { modello, PEG } from '../js/interni.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { kit, $, clamp, suave, ressalto, fase, esc } from './kit.js';

const $$ = s => [...document.querySelectorAll(s)];
const H = LOTE * 0.3;
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const PG = [
  { c: 'uomo', pelle: 1, capelli: 'ciuffo', colCap: 1, maglia: 1, pant: 0, gonna: false },
  { c: 'donna', pelle: 1, capelli: 'lunghi', colCap: 1, maglia: 1, pant: 0, gonna: false },
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 1, pant: 0, gonna: false },
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 4, pant: 1, gonna: true },
];
// interior 7 x 6: [tipo, x, z, rot] (ordem = ordem em que aparecem)
const W = 7, DD = 6;
const BASE = [['pianta', 0, 0, 0], ['tappeto', 1, 2, 0]];
const NUOVI = [['divano', 0, 2, 1], ['letto', 5, 0, 0], ['tv', 2, 0, 0], ['lampada', 4, 0, 0], ['quadro', 1, 0, 0], ['tavolino', 1, 3, 0], ['poltrona', 3, 3, 3], ['pianoforte', 5, 3, 0], ['acquario', 3, 5, 2]];

let D, mappa, citta, K, R, E, L, NEG, PUB, BILL, CHEST, cena, omini = [], veic = {}, scene = [], INT = null, base = null;
const p = i => E[`p${i}`] - 0.08;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar; window.quadro = quadro; window.suoni = suoni;
}
function frente(o) { const rot = posLote(o.lote).rot, lado = rot === 0 ? 1 : -1; return { x: o.x, z: o.z + lado * (LOTE * 0.5 + RUA / 2), lado }; }

// ---------- baú do tesouro (o mesmo modelo de js/tesori.js) ----------
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

// ---------- fases ----------
const fasi = () => [
  ['map', 0, E.p2 - 0.05], ['rua', E.p2 - 0.05, p(11)], ['int', p(11), p(15)], ['rua', p(15), p(17)],
  ['ui', p(17), p(31)], ['rua', p(31), 999],
];
const faseDi = t => fasi().find(([, a, b]) => t >= a && t < b)?.[0] ?? 'rua';

function restaurarMapa() {
  const c = mappa.camera; c.fov = base.fov; c.far = base.far; mappa.scene.fog.near = base.fogN; mappa.scene.fog.far = base.fogF; mappa.mar.visible = true;
}

// ---------- rua: personagem, veículos, câmera ----------
let ultimoAgg = null;
function aggiorna(x, z) {
  if (ultimoAgg && Math.hypot(ultimoAgg.x - x, ultimoAgg.z - z) < 0.25) return;
  ultimoAgg = { x, z }; mappa.alvo.set(x, L.hc, z); mappa.dist = 0.45; citta.atualizar(true);
}
function scena(t) { return scene.find(s => t >= s.t0 && t < s.t1) ?? scene[scene.length - 1]; }
function cameraRua(t) {
  const sc = scena(t), k = clamp((t - sc.t0) / (sc.t1 - sc.t0)), ks = sc.liscio ? suave(k) : k;
  const x = sc.A.x + (sc.B.x - sc.A.x) * ks, z = sc.A.z + (sc.B.z - sc.A.z) * ks;
  aggiorna(x, z);
  const c = mappa.camera;
  c.fov = 58; c.near = 0.0015; c.far = 9; mappa.mar.visible = false; mappa.scene.fog.near = 0.35; mappa.scene.fog.far = 2.6;
  // qual personagem (editor muda cabelo, pele, roupa)
  const qual = t >= E.clothes - 0.05 ? 3 : t >= E.skin - 0.05 ? 2 : t >= E.hair - 0.05 ? 1 : (t >= p(3) ? 0 : 0);
  const pgIdx = t < p(3) ? 0 : qual;
  omini.forEach((o, i) => { o.visible = i === pgIdx && !sc.carro; });
  Object.values(veic).forEach(v => { v.visible = false; });
  const o = omini[pgIdx], a = o.userData, anda = sc.anda !== false;
  const dist = Math.hypot(sc.B.x - sc.A.x, sc.B.z - sc.A.z) * ks, fa = anda ? dist / (H * 0.55) : 0, sw = anda ? Math.sin(fa * Math.PI) * 0.7 : 0;
  const pop = sc.pop ? ressalto(fase(t, sc.pop, 0.35)) : 1;
  const dir = sc.olha ?? Math.atan2(sc.B.x - sc.A.x, sc.B.z - sc.A.z);
  o.position.set(x, L.hc + 0.0009 + (anda && !sc.veicolo ? Math.abs(Math.sin(fa * Math.PI)) * H * 0.04 : 0), z);
  o.scale.setScalar(Math.max(0.001, pop));
  o.rotation.y = dir;
  a.pe.rotation.x = sw; a.pd.rotation.x = -sw; a.be.rotation.x = -sw * 0.8; a.bd.rotation.x = sw * 0.8;
  if (sc.veicolo) {
    const id = sc.veicolo(t), v = veic[id], sed = SEDUTO[id];
    v.visible = true; v.position.set(x, L.hc + 0.0009, z); v.rotation.y = dir;
    v.scale.setScalar(Math.max(0.001, ressalto(fase(t, sc.cambio(t), 0.3))));
    for (const r of v.userData.ruote) r.rotation.x = dist / v.userData.raggio;
    o.visible = !!sed;
    if (sed) {
      o.position.set(x + Math.sin(dir) * sed.z * H, L.hc + 0.0009 + sed.y * H, z + Math.cos(dir) * sed.z * H);
      const ped = sed.gambe === 'pedala' ? Math.sin(fa * Math.PI) * 0.5 : 0;
      a.pe.rotation.x = -1.25 + ped; a.pd.rotation.x = -1.25 - ped; a.be.rotation.x = -1.1; a.bd.rotation.x = -1.1;
    }
  }
  animaAcc(o, t * 1000);
  if (sc.primo) {   // editor: de frente, girando devagar
    const ang = sc.ang0 + (t - sc.t0) * 0.09;
    o.rotation.y = ang;
    c.position.set(x + Math.sin(ang) * LOTE * 0.95, L.hc + LOTE * 0.42, z + Math.cos(ang) * LOTE * 0.95);
    c.lookAt(x, L.hc + LOTE * 0.36, z);
  } else {
    const yaw = sc.yaw, kd = sc.veicolo ? 1.6 : 1, d = LOTE * 1.8 * kd, alt = LOTE * 1.28 * kd;
    c.position.set(x + Math.sin(yaw) * d, L.hc + alt, z + Math.cos(yaw) * d);
    c.lookAt(x - Math.sin(yaw) * LOTE * 0.45, L.hc + H * 0.6, z - Math.cos(yaw) * LOTE * 0.45);
  }
  c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  return { sc, x, z };
}

// baú: parado na esquina, gira; abre no "free credits"
function bau(t) {
  const o = CHEST, a = o.userData, vis = t >= p(8) - 0.2 && t < p(11);
  o.visible = vis;
  if (!vis) return;
  const ko = suave(fase(t, E.credits10 - 0.15, 0.5));
  a.cop.rotation.x = -1.9 * ko;
  o.rotation.y = ko > 0 ? o.rotation.y : t * 1.2;
  o.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * fase(t, E.credits10 - 0.15, 0.9)));
  a.raio.material.opacity = ko > 0 ? 0.6 * (1 - ko) : 0.25 + 0.15 * Math.sin(t * 4);
}

// @ das casas perto + rótulos especiais (loja, pub, outdoor, sua casa)
function tags(t, pos) {
  const out = [], usados = [];
  const add = (x, y, z, html, cls = '', prende = false) => {
    const q = K.projetar(x, y, z);
    if (prende && q.ok) { q.x = clamp(q.x, 300, 780); q.y = clamp(q.y, 380, 1150); }
    if (!q.ok || q.x < 60 || q.x > 1020 || q.y < 220 || q.y > 1300) return;
    if (usados.some(([ux, uy]) => Math.abs(ux - q.x) < 270 && Math.abs(uy - q.y) < 72)) return;
    usados.push([q.x, q.y]); out.push(`<div class="tg ${cls}" style="left:${q.x.toFixed(0)}px;top:${q.y.toFixed(0)}px">${html}</div>`);
  };
  const ph = faseDi(t);
  if (ph === 'rua' && t >= E.shops - 0.1 && t < E.pub - 0.05) add(NEG.x, L.hc + LOTE * 0.95, NEG.z, `🏪 ${esc(NEG.nome)}<small>A REAL SHOP</small>`, 'neg', true);
  if (ph === 'rua' && t >= E.pub - 0.1 && t < p(8)) {
    add(PUB.x, L.hc + LOTE * 1.0, PUB.z, `🍺 The town pub`, 'pub', true);
    if (t >= E.billboards - 0.1) add(BILL.x, L.hc + LOTE * 1.15, BILL.z, `📣 Billboards`, 'neg', true);
  }
  if (ph === 'rua' && t >= E.p2 + 0.4 && t < p(31) && !(t >= p(3) && t < p(5))) {
    const lista = L.casas.map(i => D.casas[i]).filter(c => Math.abs(c.x - pos.x) < LOTE * 8 && Math.abs(c.z - pos.z) < LOTE * 8)
      .map(c => [Math.hypot(c.x - pos.x, c.z - pos.z), c]).sort((a, b) => a[0] - b[0]);
    for (const [, c] of lista.slice(0, 40)) { if (out.length >= 6) break; add(c.x, L.hc + LOTE * (ALTURA_NIVEL[c.livello] + 0.1), c.z, `@${esc(c.conta)}`); }
  }
  const html = out.join(''), el = $('#tags'); if (el.innerHTML !== html) el.innerHTML = html;
}

// ---------- interior ----------
function montarInterno() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#DCEBFF');
  s.add(new THREE.HemisphereLight(0xffffff, 0xb0a48c, 2.2));
  const sol = new THREE.DirectionalLight(0xfff1dc, 1.6); sol.position.set(4, 8, 5); s.add(sol);
  const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); s.add(m); return m; };
  const pav = box(W, 0.12, DD, '#C8955C', 0, -0.06, 0);
  const righe = []; for (let k = 1; k < DD * 2; k++) righe.push(box(W, 0.005, 0.015, '#B07F4E', 0, 0.002, -DD / 2 + k * 0.5));
  const piastr = []; for (let k = 1; k < W; k++) piastr.push(box(0.02, 0.005, DD, '#D6D2C8', -W / 2 + k, 0.003, 0)); for (let k = 1; k < DD; k++) piastr.push(box(W, 0.005, 0.02, '#D6D2C8', 0, 0.003, -DD / 2 + k));
  const muri = [box(W + 0.15, 2.7, 0.15, '#FFF6E6', -0.075, 1.35, -DD / 2 - 0.075), box(0.15, 2.7, DD, '#FFF6E6', -W / 2 - 0.075, 1.35, 0)];
  box(W, 0.12, 0.04, '#FFFFFF', 0, 0.06, -DD / 2 + 0.02); box(0.04, 0.12, DD, '#FFFFFF', -W / 2 + 0.02, 0.06, 0);
  box(1.4, 1.1, 0.04, '#FFFFFF', W / 2 - 1.2, 1.55, -DD / 2 + 0.01); box(1.24, 0.94, 0.05, '#9ED1F2', W / 2 - 1.2, 1.55, -DD / 2 + 0.012);
  box(0.04, 2.0, 0.95, '#7A4A2A', -W / 2 + 0.01, 1.0, DD / 2 - 1.0);
  const items = [...BASE, ...NUOVI].map(([t, x, z, r]) => {
    const m = modello(t); s.add(m);
    const [w0, d0] = PEG[t], [w, d] = r % 2 ? [d0, w0] : [w0, d0];
    const pos = PEG[t][2] === 'muro' ? [x + 0.5 - W / 2, 0, -DD / 2 + 0.05] : [x + w / 2 - W / 2, 0.001, z + d / 2 - DD / 2];
    m.position.set(...pos); m.rotation.y = r * Math.PI / 2;
    return { t, m, pos };
  });
  // visita: um amigo dentro da casa
  const amico = costruisci({ c: 'uomo', pelle: 2, capelli: 'ricci', colCap: 0, maglia: 2, pant: 0 }, 1.5);
  amico.position.set(1.2, 0, 1.3); amico.rotation.y = 0.7; s.add(amico);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 100);
  INT = { s, cam, pav, righe, piastr, muri, items, amico };
}
function interno(t) {
  const I = INT, t0 = p(11);
  const quando = { divano: E.sofa, letto: E.bed, tv: E.tv };
  let extra = 0;
  I.items.forEach(it => {
    let ti = null;
    if (quando[it.t]) ti = quando[it.t] - 0.05;
    else if (!BASE.some(b => b[0] === it.t)) ti = E.tv + 0.25 + 0.16 * extra++;
    const k = ti == null ? 1 : t < ti ? 0 : ressalto(fase(t, ti, 0.3));
    it.m.visible = k > 0.001; it.m.scale.setScalar(Math.max(0.001, k));
  });
  const marmo = t >= E.floor - 0.05, azz = t >= E.walls - 0.05;
  I.pav.material.color.set(marmo ? '#F3F1EC' : '#C8955C'); I.righe.forEach(r => { r.visible = !marmo; }); I.piastr.forEach(r => { r.visible = marmo; });
  I.muri.forEach(m => m.material.color.set(azz ? '#9ED1F2' : '#FFF6E6'));
  const ka = ressalto(fase(t, p(14), 0.35));
  I.amico.visible = t >= p(14); I.amico.scale.setScalar(Math.max(0.001, ka) * 1);
  const a = I.amico.userData, sw = Math.sin(t * 6) * 0.4; a.bd.rotation.x = -2.6 + sw * 0.3;   // acenando
  const yaw = 0.55 + Math.sin((t - t0) * 0.3) * 0.25, Rr = 7 * 2.35 * (1.18 - 0.18 * suave(fase(t, t0, 1.2))), alt = 0.8;
  I.cam.position.set(Math.sin(yaw) * Rr * Math.cos(alt), Rr * Math.sin(alt), Math.cos(yaw) * Rr * Math.cos(alt));
  I.cam.lookAt(0.4, 0.1, 1.1);
  I.cam.updateMatrixWorld(true);
}

// ---------- Big Ben (canvas): andares empilhando sozinhos ----------
function bigben(t) {
  const cv = $('#bigben canvas'), c = cv.getContext('2d'), Wc = 380, Hc = 450, BH = 34, LG = 200;
  const ini = E.bigben, fim = E.clock + 0.2, n = Math.max(0, Math.min(10, Math.floor((t - ini) / ((fim - ini) / 9)))) ;
  c.clearRect(0, 0, Wc, Hc);
  const cam = Math.max(0, (n + 1) * BH - Hc * 0.55);
  c.fillStyle = '#7FB55C'; c.fillRect(0, Hc - 40 + cam, Wc, 400);
  const y = i => Hc - 40 - (i + 1) * BH + cam;
  const piano = (x, yy, w, baseP) => {
    c.fillStyle = baseP ? '#D9C08A' : '#E8D3A0'; c.fillRect(x, yy, w, BH);
    c.strokeStyle = '#A88B52'; c.lineWidth = 2; c.strokeRect(x + 1, yy + 1, w - 2, BH - 2);
    c.fillStyle = '#8C7B62';
    for (let ax = x + 9; ax + 12 <= x + w - 4; ax += 20) { c.beginPath(); c.moveTo(ax, yy + BH - 6); c.lineTo(ax, yy + 16); c.quadraticCurveTo(ax, yy + 8, ax + 6, yy + 6); c.quadraticCurveTo(ax + 12, yy + 8, ax + 12, yy + 16); c.lineTo(ax + 12, yy + BH - 6); c.fill(); }
  };
  piano((Wc - LG - 30) / 2, y(0), LG + 30, true);
  for (let i = 1; i <= n; i++) { const off = Math.sin(i * 2.3) * 6; piano((Wc - LG) / 2 + off, y(i), LG - Math.abs(off) * 0.5, false); }
  // andar balançando em cima
  if (n < 9) { const sx = (Math.sin(t * 5) * 0.5 + 0.5) * (Wc - LG); piano(sx, y(n + 1), LG, false); }
  const y8 = y(8) + BH;
  c.setLineDash([6, 6]); c.strokeStyle = '#E0473C'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y8); c.lineTo(Wc, y8); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#E0473C'; c.font = '900 16px Nunito, sans-serif'; c.fillText("🕰️ Big Ben's clock: 8 floors", 10, y8 - 8);
  if (n >= 8) { c.font = '900 26px Nunito'; c.fillStyle = '#152033'; c.textAlign = 'center'; c.fillText('🏆 YOU REACHED THE CLOCK!', Wc / 2, 54); c.textAlign = 'left'; }
}

// ---------- quadro ----------
const MONETE = Array.from({ length: 12 }, (_, i) => ({ dx: ((i * 173) % 640) - 320, atraso: (i * 0.05) % 0.5, sobe: 300 + ((i * 89) % 320), em: i % 3 ? '💰' : '⭐' }));
const CORI = Array.from({ length: 16 }, (_, i) => ({ atraso: (i * 0.06) % 0.8, dx: ((i * 137) % 760) - 380, sobe: 520 + ((i * 71) % 420), giro: ((i * 53) % 60) - 30, em: ['🎉', '⭐', '✨', '🎊'][i % 4] }));
const EMAIL = 'you@email.co.uk', CODICE = '482913';
let tocchi = [];
const centro = el => { const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };

function quadro(t) {
  const ph = faseDi(t);
  omini.forEach(o => { o.visible = false; }); Object.values(veic).forEach(v => { v.visible = false; });
  let pos = null;
  if (ph === 'map' || ph === 'ui') { restaurarMapa(); K.camera(t); }
  else if (ph === 'rua') pos = cameraRua(t);
  if (ph === 'int') interno(t);
  if (CHEST) bau(t);
  citta.grupo.visible = ph === 'rua' || mappa.dist < 32;
  // escurece o mapa atrás dos painéis
  const dim = ph === 'ui' && t < p(28) ? 0.42 : t < E.p2 - 0.05 ? 0.15 * (1 - fase(t, 0, 0.6)) : 0;
  $('#scuro').style.opacity = String(dim);
  K.pop($('#titolo'), t, E.p1 - 0.05, E.p2 - 0.1);
  // editor
  const ed = $('#editor');
  if (t >= p(3) && t < p(5)) {
    K.pop(ed, t, p(3) + 0.05, p(5));
    const donna = t >= E.hair - 0.05;
    ed.querySelector('.u').classList.toggle('on', !donna); ed.querySelector('.d').classList.toggle('on', donna);
    ed.querySelector('.d').style.transform = `scale(${batida(t, E.hair)})`;
    $$('#editor .opz span').forEach((s, i) => s.classList.toggle('on', donna && i === (t >= E.skin - 0.05 ? 1 : 0)));
    const ci = t < E.clothes - 0.05 ? 1 : Math.min(4, 1 + Math.floor((t - E.clothes + 0.05) / 0.18));
    $$('#editor .sw i').forEach((s, i) => s.classList.toggle('on', i === ci));
  } else ed.style.opacity = '0';
  // bússola + moedas do baú
  if (t >= p(8) && t < p(11)) { K.pop($('#bussola'), t, p(8) + 0.1, p(11)); const m = Math.max(0, Math.round(40 * (1 - fase(t, p(8), E.credits10 - p(8))) / 5) * 5); $('#bussola').innerHTML = m > 0 ? `🧭 Treasure <b class="dist">${m} m</b> away` : '🧭 Treasure found! ✅'; } else $('#bussola').style.opacity = '0';
  const tm = t >= E.credits27 - 0.1 && t < p(28) ? E.credits27 : E.credits10;
  K.pop($('#piu'), t, E.credits10, p(11));
  $$('#monete i').forEach((el, i) => {
    const m = MONETE[i], dt = t - tm - m.atraso, vis = dt > 0 && dt < 1.2;
    el.style.opacity = vis ? String(1 - fase(dt, 0.8, 0.4)) : '0';
    if (vis) el.style.transform = `translate(${500 + m.dx * suave(fase(dt, 0, 0.8))}px, ${900 - m.sobe * Math.sin(Math.min(1, dt / 1.0) * Math.PI)}px)`;
  });
  // confetes quando o personagem aparece
  $$('#coriandoli i').forEach((el, i) => {
    const c = CORI[i], dt = t - E.p2 - c.atraso, vis = dt > 0 && dt < 1.5;
    el.style.opacity = vis ? String(1 - fase(dt, 1.0, 0.5)) : '0';
    if (vis) el.style.transform = `translate(${500 + c.dx * suave(fase(dt, 0, 0.6))}px, ${1150 - c.sobe * suave(fase(dt, 0, 1.5))}px) rotate(${c.giro}deg)`;
  });
  // jogos
  const gi = $('#giochi');
  if (t >= p(18) && t < p(19)) {
    K.pop(gi, t, p(18), p(19));
    $$('#giochi .ind').forEach((el, i) => { const ti = E.clues - 0.2 + i * 0.35; el.style.opacity = t >= ti ? '1' : '0'; el.style.transform = `translateY(${(1 - ressalto(fase(t, ti, 0.3))) * 30}px)`; });
    const ri = $('#giochi .ris'), tr = E.oneguess; ri.style.opacity = t >= tr ? '1' : '0'; ri.style.transform = `scale(${t >= tr ? ressalto(fase(t, tr, 0.3)) : 0})`;
  } else gi.style.opacity = '0';
  if (t >= p(19) && t < p(21)) { K.pop($('#bigben'), t, p(19), p(21)); bigben(t); } else $('#bigben').style.opacity = '0';
  // telefone: passo a passo para entrar
  const tf = $('#telefono');
  if (t >= p(21) + 0.3 && t < p(28)) {
    K.pop(tf, t, p(21) + 0.3, p(28));
    const passo = t >= E.credits27 - 0.6 ? 6 : t >= E.insta - 0.1 ? 5 : t >= E.code - 0.1 ? 4 : t >= E.typeemail - 0.1 ? 3 : t >= E.signin - 0.3 ? 2 : 1;
    $$('#telefono .passo').forEach(el => el.classList.toggle('on', +el.dataset.p === passo));
    const tx = Math.round(EMAIL.length * fase(t, E.typeemail, 0.9)); $('#email .tx').textContent = EMAIL.slice(0, tx); $('#email .cur').style.opacity = Math.sin(t * 12) > 0 ? '1' : '0';
    $('#codice').textContent = CODICE.slice(0, Math.round(6 * fase(t, E.code + 0.1, 0.6))).padEnd(6, '·');
    $('#nopass').style.transform = `scale(${batida(t, E.nopass)})`;
    $('#collegato').style.opacity = t >= p(27) - 0.2 ? '1' : '0.25';
    $('#saldo').textContent = `${t >= E.credits27 ? 2 : 0} 💰`; $('#saldo').style.transform = `scale(${batida(t, E.credits27)})`;
  } else tf.style.opacity = '0';
  // carimbos, banner, toques
  for (const x of cena.timbri) K.pop(x.el, t, x.ini, x.fim, { base: `rotate(${x.rot}deg)` });
  K.banner(t, [E.comment, E.comment + 0.45], R.banner, p(31));
  const tc = $('#tocco'); let tocou = false;
  for (const [ti, alvo] of tocchi) { const k = fase(t, ti, 0.45); if (k <= 0 || k >= 1) continue; const a = alvo(); if (!a) continue; tc.style.left = `${a.x}px`; tc.style.top = `${a.y}px`; tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`; tocou = true; break; }
  if (!tocou) tc.style.opacity = '0';
  // corte: véu branco
  const fl = Math.max(0, ...cena.tagli.map(tt => (t >= tt ? 0.7 * (1 - fase(t, tt, 0.22)) : 0)));
  $('#velo').style.opacity = R.copertina ? '0' : String(fl);
  if (ph === 'rua') tags(t, pos); else $('#tags').innerHTML = '';
  K.legenda(t);
  if (ph === 'int') { $('#flash').style.opacity = '0'; mappa.renderer.render(INT.s, INT.cam); }
  else K.fechar(t);
  return true;
}

function suoni() {
  const S = [], add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata - 0.05) S.push({ t: +t.toFixed(3), tipo, vol: 0.7, ...o }); };
  add(0.02, 'whoosh', { dur: 0.5, vol: 0.5 }); add(0.1, 'campana', { tono: 1.2, vol: 0.45 });
  add(E.p1, 'ding', { vol: 0.45, tono: 1.1 }); add(p(2) - 0.6, 'riser', { dur: 0.6, vol: 0.3 });
  add(E.p2, 'boom', { vol: 0.35 }); add(E.p2 + 0.05, 'pop', { vol: 0.7, tono: 1.1 }); add(E.p2 + 0.1, 'scintilla', { vol: 0.5 });
  cena.tagli.forEach(tc => { if (tc > 1) add(tc - 0.1, 'whoosh', { vol: 0.35, dur: 0.3 }); });
  [E.hair, E.skin, E.clothes].forEach((ti, i) => { add(ti - 0.05, 'select', { vol: 0.5, tono: 1 + i * 0.12 }); add(ti, 'pop', { vol: 0.45, tono: 1.1 + i * 0.1 }); });
  for (const sc of scene) if (sc.anda !== false && !sc.veicolo && !sc.primo) for (let x = sc.t0 + 0.1; x < sc.t1 - 0.05; x += 0.27) add(x, 'tap', { vol: 0.16, tono: 0.75 + ((x * 7) % 1) * 0.1 });
  add(E.shops, 'ding', { vol: 0.5, tono: 1.15 }); add(E.pub, 'ding', { vol: 0.45, tono: 1.25 }); add(E.billboards, 'ding', { vol: 0.45, tono: 1.35 });
  add(E.chest, 'scintilla', { vol: 0.4 }); add(E.credits10 - 0.15, 'flap', { vol: 0.5 }); add(E.credits10, 'coin', { vol: 0.75 });
  MONETE.forEach((m, i) => { if (i % 3 === 0) { add(E.credits10 + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); add(E.credits27 + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); } });
  add(E.floor, 'select', { vol: 0.5 }); add(E.walls, 'select', { vol: 0.5, tono: 1.15 });
  [E.sofa, E.bed, E.tv].forEach((ti, i) => add(ti, 'pop', { vol: 0.6, tono: 1 + i * 0.12 }));
  for (let k = 0; k < 6; k++) add(E.tv + 0.25 + 0.16 * k, 'pop', { vol: 0.3, tono: 1.2 + k * 0.05 });
  add(p(14), 'notifica', { vol: 0.5 });
  [E.bike, E.scooter, E.sports].forEach((ti, i) => { add(ti, 'pop', { vol: 0.6, tono: 0.9 + i * 0.1 }); add(ti + 0.05, 'whoosh', { vol: 0.35, dur: 0.4 }); });
  add(E.road, 'riser', { dur: 1.0, vol: 0.3 });
  add(E.clues, 'tick', { vol: 0.4 }); add(E.clues + 0.35, 'tick', { vol: 0.4, tono: 1.1 }); add(E.clues + 0.7, 'tick', { vol: 0.4, tono: 1.2 }); add(E.oneguess, 'ding', { vol: 0.6, tono: 1.3 });
  for (let k = 1; k <= 9; k++) add(E.bigben + k * (E.clock + 0.2 - E.bigben) / 9, 'tasto', { vol: 0.4, tono: 0.9 + k * 0.04 });
  add(E.clock + 0.2, 'campana', { vol: 0.55 }); add(E.grows, 'coin', { vol: 0.5 });
  tocchi.forEach(([ti]) => { add(ti, 'tap', { vol: 0.7 }); add(ti + 0.08, 'select', { vol: 0.35 }); });
  for (let k = 0; k < EMAIL.length; k += 2) add(E.typeemail + k * 0.9 / EMAIL.length, 'tasto', { vol: 0.25, tono: 1 + (k % 4) * 0.05 });
  for (let k = 0; k < 6; k++) add(E.code + 0.1 + k * 0.1, 'tick', { vol: 0.3, tono: 1 + k * 0.05 });
  add(E.nopass, 'ding', { vol: 0.55, tono: 1.2 }); add(p(27) - 0.2, 'ding', { vol: 0.5, tono: 1.3 }); add(E.credits27, 'coin', { vol: 0.75 });
  add(E.comment, 'notifica', { tono: 1.1 }); add(E.p31, 'stamp'); add(E.p31 + 0.4, 'notifica', { tono: 1.2 });
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
  NEG = (L.commerci ?? []).find(x => x.nome === R.dati.negozio); if (!NEG) throw new Error('loja');
  citta.posCommercio(NEG);
  PUB = { x: L.x, z: L.z - QH };
  BILL = { x: L.x - QW / 2 + LOTE * 0.25, z: L.z };
  omini = PG.map(pg => { const o = costruisci(pg, H); o.visible = false; mappa.scene.add(o); return o; });
  for (const id of ['bici', 'vespa', 'sportiva']) { const v = costruisciVeicolo(id, H); v.visible = false; mappa.scene.add(v); veic[id] = v; }
  montarInterno();
  // ruas: rua(j, i0, i1) = rua horizontal entre as quadras j e j+1, de i0 a i1 (em quadras)
  const rua = (j, i0, i1) => ({ A: { x: L.x + i0 * QW, z: L.z + (j + 0.5) * QH }, B: { x: L.x + i1 * QW, z: L.z + (j + 0.5) * QH } });
  const fN = frente(NEG);
  const r1 = rua(0, -0.42, -0.08), r2 = rua(1, -1.6, -0.2), rPub = rua(-1, -0.75, 0.15), rBau = rua(1, 0.1, 0.62), rCar = rua(1, -1.4, 2.6), rFim = rua(0, 0.2, 0.55);
  CHEST = forziere(); CHEST.position.set(rBau.B.x + LOTE * 0.25, L.hc + 0.0009, rBau.B.z); mappa.scene.add(CHEST);
  const passa = (f, o) => ({ A: { x: o.x - LOTE * 1.6, z: f.z }, B: { x: o.x + LOTE * 0.1, z: f.z }, yaw: -Math.PI / 2 + f.lado * 0.45 });
  const veicolo = t => (t >= E.sports - 0.05 ? 'sportiva' : t >= E.scooter - 0.05 ? 'vespa' : 'bici');
  const cambio = t => (t >= E.sports - 0.05 ? E.sports - 0.05 : t >= E.scooter - 0.05 ? E.scooter - 0.05 : p(15));
  scene = [
    { t0: E.p2 - 0.05, t1: p(3), ...r1, yaw: -Math.PI / 2 + 0.35, pop: E.p2 },
    { t0: p(3), t1: p(5), A: r1.B, B: r1.B, anda: false, primo: true, ang0: -Math.PI / 2 - 0.15 },
    { t0: p(5), t1: E.shops - 0.1, ...r2, yaw: -Math.PI / 2 - 0.3 },
    { t0: E.shops - 0.1, t1: E.pub - 0.1, ...passa(fN, NEG) },
    { t0: E.pub - 0.1, t1: p(8), ...rPub, yaw: -Math.PI / 2 - 0.5 },
    { t0: p(8), t1: p(11), A: rBau.A, B: { x: rBau.B.x - LOTE * 0.2, z: rBau.B.z }, yaw: -Math.PI / 2 + 0.3, liscio: true },
    { t0: p(15), t1: p(17), ...rCar, yaw: -Math.PI / 2 + 0.4, veicolo, cambio },
    { t0: p(31), t1: 999, ...rFim, yaw: -Math.PI / 2 + 0.35 },
  ];
  cena.tagli = [E.p2 - 0.05, p(3), p(5), E.shops - 0.1, E.pub - 0.1, p(8), p(11), p(15), p(17), p(18), p(19), p(21) + 0.3, p(28), p(31)];
  cena.impatti = [[E.p2, 0.4], [E.credits10, 0.3], [E.oneguess, 0.3], [E.clock + 0.2, 0.3], [E.credits27, 0.3]];
  cena.flash = [[0, 0.3], [E.p2, 0.4], [E.credits10, 0.3], [E.credits27, 0.3]];
  // câmera do mapa: país → mergulho em Coventry; fundo dos painéis: Coventry de cima, girando
  const vista = (o = {}) => ({ x: L.x, z: L.z, dist: 1.3, az: 0.4, el: 40, giu: 0, dy: 0, su: 0, ...o });
  K.chaves([
    [0, K.uk({ dist: mappa.distPais() * 1.08 })],
    [E.p1, K.uk({ dist: mappa.distPais() * 0.95, az: 0.05 })],
    [E.p2 - 0.06, vista({ dist: 0.9, az: 0.6, el: 34 })],
    [p(17), vista({ dist: 1.6, az: -0.2, el: 46, cut: true })],
    [p(28), vista({ dist: 2.0, az: 0.8, el: 44 })],
    [p(31), vista({ dist: 1.2, az: 1.2, el: 40 })],
  ]);
  cena.timbri = [
    K.timbro('🚶 FROM <span class="g">TODAY</span>', '#1E5AA8', 250, E.p2 + 0.1, p(3), -3, 96),
    K.timbro('🎁 <span class="g">FREE</span> CREDITS', '#2FB36A', 1180, E.credits10 + 0.1, p(11), 3, 84),
    K.timbro('🛋️ <span class="g">YOUR</span> HOUSE', '#7B2CBF', 250, p(11) + 0.1, p(14), -3, 96),
    K.timbro('👀 Mates can visit', '#E0306E', 250, p(14), p(15), 3, 86),
    K.timbro('🛣️ NEXT <span class="g">TOWN</span>', '#1E5AA8', 250, E.road, p(17), -3, 96),
    K.timbro('🎮 NEW <span class="g">EVERY DAY</span>', '#0F9F8F', 1180, p(17), p(18), 3, 84),
    K.timbro('🏠 +5 POINTS', '#2FB36A', 1180, E.grows, p(21), -3, 90),
    K.timbro('⏱️ 10 SECONDS', '#E0306E', 1180, p(21), p(22) + 0.2, 3, 90),
    K.timbro('📤 Send to a mate', '#1E5AA8', 1150, E.p31, Infinity, -3, 84),
  ];
  $('#monete').innerHTML = MONETE.map(m => `<i>${m.em}</i>`).join('');
  $('#coriandoli').innerHTML = CORI.map(c => `<i>${c.em}</i>`).join('');
  tocchi = [[E.bio, () => centro($('#telefono .link'))], [E.signin, () => centro($('#btn-signin'))], [E.typeemail, () => centro($('#email'))], [E.insta + 0.2, () => centro($('#telefono [data-p="5"] .riga'))]];
  if (R.copertina) { K.capa(); for (const s of ['#tocco', '#velo', '#monete', '#coriandoli']) $(s).style.display = 'none'; }
  console.log(`dados ${D.snap.dati_fino} · ${L.nome} (${L.case} casas) · loja ${NEG.nome} lote ${NEG.lote}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
