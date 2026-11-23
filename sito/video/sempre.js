// Reel 44 "Your house, yours forever" (lançamento, 21/11): casa decorada → como funcionam os créditos (grátis todo dia, série 7 e 30,
// baú do tesouro) → recarga (pacotes em £, bônus até +50%) → "Your home" para sempre: a casa trocando ao vivo (cores de time, ouro,
// neon, coroa, fogos, farol, moinho) → villa com piscina → castelo: 1 por county (152 castelos no mapa, um já tomado) → presente para
// um amigo, scooter/esportivo, boneco com roupa e cachorrinho → créditos não compram pontos nem votos → share. Casas de demonstração
// (o @ mostrado é inventado). window.preparar / quadro / suoni (cattura.mjs).
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, RUA, QW, QH, posLote } from '../js/citta.js';
import { Decori } from '../js/decori.js';
import { costruisci, animaAcc } from '../js/personaggio.js';
import { costruisciVeicolo, SEDUTO } from '../js/veicoli.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { kit, $, clamp, suave, ressalto, fase, esc } from './kit.js';

const $$ = s => [...document.querySelectorAll(s)];
const H = LOTE * 0.3;
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const PG = [
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 4, pant: 1, gonna: true },
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 4, pant: 1, gonna: false, acc: ['elegante', 'borsalino'] },
  { c: 'donna', pelle: 3, capelli: 'coda', colCap: 0, maglia: 4, pant: 1, gonna: false, acc: ['elegante', 'borsalino', 'cane', 'aura'] },
];
const PACCHI = [[500, '£4.99', 0], [1100, '£9.99', 10, 'most popular'], [2400, '£19.99', 20], [3750, '£29.99', 25], [7800, '£59.99', 30], [15000, '£99.99', 50, 'best value']];

let D, mappa, citta, decori, K, R, E, L, CASA, CASA2, CHEST, cena, omini = [], veic = {}, scene = [], base = null, pins = [], selK = '', selT = 0, sel2K = '';
const p = i => E[`p${i}`] - 0.08;
const num = v => Number(v).toLocaleString('en-GB');

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar; window.quadro = quadro; window.suoni = suoni;
}

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
  ['casa', 0, p(2)], ['ui', p(2), p(6)], ['rua', p(6), p(8)], ['ui', p(8), p(12)], ['casa', p(12), p(23)], ['map', p(23), p(26)],
  ['casa', p(26), p(27)], ['rua', p(27), p(30)], ['map', p(30), p(32)], ['casa', p(32), 999],
];
const faseDi = t => fasi().find(([, a, b]) => t >= a && t < b)?.[0] ?? 'casa';
function restaurarMapa() { const c = mappa.camera; c.fov = base.fov; c.far = base.far; mappa.scene.fog.near = base.fogN; mappa.scene.fog.far = base.fogF; mappa.mar.visible = true; }

// ---------- decoração da casa ao longo do vídeo ----------
const S = (extra = [], o = {}) => ({ squadra: o.squadra ?? null, modello: o.modello ?? null, extra: new Set(extra) });
function selCasa(t) {
  if (t < p(12)) return ['gancio', S(['oro', 'corona', 'fuochi'])];
  if (t < E.team - 0.05) return ['nada', S()];
  if (t < E.golden - 0.05) return ['team', S([], { squadra: 'reds' })];
  if (t < E.neon - 0.05) return ['oro', S(['oro'])];
  if (t < E.crown - 0.05) return ['neon', S(['oro', 'neon'])];
  if (t < E.fireworks - 0.05) return ['corona', S(['oro', 'neon', 'corona'])];
  if (t < E.lighthouse - 0.05) return ['fuochi', S(['oro', 'neon', 'corona', 'fuochi'])];
  if (t < E.windmill - 0.05) return ['faro', S([], { modello: 'faro' })];
  if (t < p(18)) return ['mulino', S([], { modello: 'mulino' })];
  if (t < p(18) + (p(19) - p(18)) / 2) return ['blues', S(['neve', 'cornice'], { squadra: 'blues' })];
  if (t < E.villa - 0.05) return ['arco', S(['arcobaleno', 'cuori', 'corona'])];
  if (t < E.castle - 0.05) return ['villa', S(['villa', 'fuochi'])];
  return ['castello', S(['castello', 'fuochi', 'corona'])];
}
function decorar(t) {
  const [k, sel] = selCasa(t);
  if (k !== selK) { selK = k; selT = t; decori.disegna(CASA, sel); }
  const a = decori.attive.get(CASA.conta);
  if (a) { a.g.visible = true; a.anima(t * 1000); a.g.scale.setScalar(LOTE * Math.max(0.001, k === 'gancio' && t < 0.3 ? 1 : 0.6 + 0.4 * ressalto(fase(t, selT, 0.35)))); }
  if (!sel2K && t >= p(26) - 0.1) { sel2K = 'ok'; decori.disegna(CASA2, S(['oro', 'cornice', 'corona']), 'you'); }
  const b = decori.attive.get(CASA2.conta);
  if (b) { b.g.visible = true; b.anima(t * 1000); b.g.scale.setScalar(LOTE * Math.max(0.001, t >= p(26) ? ressalto(fase(t, p(26) + 0.1, 0.4)) : 1)); }
}

// ---------- rua ----------
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
  const qual = t >= E.puppy - 0.05 ? 2 : t >= E.dress - 0.05 ? 1 : 0;
  omini.forEach((o, i) => { o.visible = i === qual; });
  const o = omini[qual], a = o.userData;
  const dist = Math.hypot(sc.B.x - sc.A.x, sc.B.z - sc.A.z) * ks, fa = dist / (H * 0.55), sw = Math.sin(fa * Math.PI) * 0.7;
  const dir = Math.atan2(sc.B.x - sc.A.x, sc.B.z - sc.A.z);
  o.position.set(x, L.hc + 0.0009 + Math.abs(Math.sin(fa * Math.PI)) * H * 0.04, z); o.rotation.y = dir; o.scale.setScalar(Math.max(0.001, sc.pop ? ressalto(fase(t, sc.pop(t), 0.3)) : 1));
  a.pe.rotation.x = sw; a.pd.rotation.x = -sw; a.be.rotation.x = -sw * 0.8; a.bd.rotation.x = sw * 0.8;
  if (o.userData.cane) o.userData.cane.position.z = -0.3 * H / 0.3 * 0.3;
  if (sc.veicolo && t < E.dress - 0.05) {
    const id = t >= E.sports - 0.05 ? 'sportiva' : 'vespa', v = veic[id], sed = SEDUTO[id], ti = id === 'sportiva' ? E.sports - 0.05 : p(27);
    v.visible = true; v.position.set(x, L.hc + 0.0009, z); v.rotation.y = dir; v.scale.setScalar(Math.max(0.001, ressalto(fase(t, ti, 0.3))));
    for (const r of v.userData.ruote) r.rotation.x = dist / v.userData.raggio;
    o.visible = !!sed;
    if (sed) { o.position.set(x + Math.sin(dir) * sed.z * H, L.hc + 0.0009 + sed.y * H, z + Math.cos(dir) * sed.z * H); a.pe.rotation.x = -1.25; a.pd.rotation.x = -1.25; a.be.rotation.x = -1.1; a.bd.rotation.x = -1.1; }
  }
  animaAcc(o, t * 1000);
  const yaw = sc.yaw, kd = sc.veicolo && t < E.dress - 0.05 ? 1.5 : t >= E.dress - 0.05 ? 0.75 : 1, d = LOTE * 1.8 * kd, alt = LOTE * 1.28 * kd;
  c.position.set(x + Math.sin(yaw) * d, L.hc + alt, z + Math.cos(yaw) * d);
  c.lookAt(x - Math.sin(yaw) * LOTE * 0.45, L.hc + H * 0.6, z - Math.cos(yaw) * LOTE * 0.45);
  c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
}
function bau(t) {
  const o = CHEST, a = o.userData, vis = t >= p(6) - 0.2 && t < p(8);
  o.visible = vis; if (!vis) return;
  const ko = suave(fase(t, E.payout - 0.15, 0.5));
  a.cop.rotation.x = -1.9 * ko; if (!ko) o.rotation.y = t * 1.2;
  o.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * fase(t, E.payout - 0.15, 0.9)));
  a.raio.material.opacity = ko > 0 ? 0.6 * (1 - ko) : 0.25 + 0.15 * Math.sin(t * 4);
}

// rótulos: presente "from @you" (casa do amigo), castelo, villa
function tags(t, ph) {
  const out = [];
  const add = (c, h, html, cls = '') => { citta.posCasa(c); const q = K.projetar(c.x, c.y + h * LOTE, c.z); if (q.ok && q.y > 300 && q.y < 1350) out.push(`<div class="tg ${cls}" style="left:${clamp(q.x, 280, 800).toFixed(0)}px;top:${q.y.toFixed(0)}px">${html}</div>`); };
  if (ph === 'casa' && t >= p(26) && t < p(27)) add(CASA2, (decori.attive.get(CASA2.conta)?.pilha ?? 1) + 0.35, '✨ @your_mate<small>🎁 FROM @YOU</small>', 'oro');
  if (ph === 'casa' && ((t >= E.castle && t < p(23)) || t >= p(32))) add(CASA, (decori.attive.get(CASA.conta)?.pilha ?? 1.4) + 0.35, `🏰 @you<small>CASTLE · ${esc(L.comune.sigla.toUpperCase())}</small>`, 'oro');
  if (ph === 'casa' && t >= E.villa && t < E.castle) add(CASA, (decori.attive.get(CASA.conta)?.pilha ?? 1) + 0.35, '🏡 @you<small>VILLA</small>', 'oro');
  const html = out.join(''), el = $('#tags'); if (el.innerHTML !== html) el.innerHTML = html;
}

// castelos: 1 alfinete por county com casas
function alfinetes(t, ph) {
  const vis = ph === 'map' && t < p(26);
  pins.forEach((pn, i) => {
    if (!vis) { pn.el.style.opacity = '0'; return; }
    const q = K.projetar(pn.x, 0.02, pn.z), ti = p(23) + 0.15 + (i / pins.length) * 1.6, k = t >= ti ? ressalto(fase(t, ti, 0.3)) : 0;
    const pulse = t >= E.still ? 1 + 0.18 * Math.sin((t - E.still) * 9 + i) : 1;
    pn.el.style.opacity = q.ok && k > 0 ? '1' : '0';
    pn.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${k * pulse * (pn.preso && t >= E.taken ? 1.5 : 1)})`;
    pn.el.classList.toggle('preso', !!pn.preso && t >= E.taken);
  });
}

const MONETE = Array.from({ length: 12 }, (_, i) => ({ dx: ((i * 173) % 640) - 320, atraso: (i * 0.05) % 0.5, sobe: 300 + ((i * 89) % 320), em: i % 3 ? '💰' : '⭐' }));
function quadro(t) {
  const ph = faseDi(t);
  omini.forEach(o => { o.visible = false; }); Object.values(veic).forEach(v => { v.visible = false; });
  if (ph === 'rua') cameraRua(t); else { restaurarMapa(); K.camera(t); }
  decorar(t); bau(t);
  citta.grupo.visible = ph === 'rua' || mappa.dist < 32;
  $('#scuro').style.opacity = String(ph === 'ui' ? 0.42 : ph === 'map' && t >= p(30) ? 0.3 : 0);
  K.pop($('#titolo'), t, E.forever - 0.1, p(2));
  // créditos grátis
  const gr = $('#gratis');
  if (t >= p(2) && t < p(6)) {
    K.pop(gr, t, p(2) + 0.05, p(6));
    const d0 = p(3), d7 = E.seven, dias = t < d0 ? 0 : Math.min(7, 1 + Math.floor((t - d0) / ((d7 - d0) / 6)));
    $$('#gratis .giorni div').forEach((el, i) => { el.classList.toggle('on', i < dias); el.classList.toggle('fuoco', i === 6 && dias >= 7); el.style.transform = `scale(${batida(t, d0 + i * (d7 - d0) / 6)})`; });
    const v = dias * 2 + (t >= E.twenty ? 20 : 0) + (t >= E.hundred ? 100 : 0);
    $('#gratis .saldo .n').textContent = num(v);
    $('#gratis .b7').classList.toggle('on', t >= E.twenty); $('#gratis .b30').classList.toggle('on', t >= E.thirty);
    $('#gratis .b7').style.transform = `scale(${batida(t, E.twenty)})`; $('#gratis .b30').style.transform = `scale(${batida(t, E.hundred)})`;
  } else gr.style.opacity = '0';
  // pacotes
  const pc = $('#pacchi');
  if (t >= p(8) && t < p(12)) {
    K.pop(pc, t, p(8) + 0.05, p(12));
    $$('#pacchi .pk').forEach((el, i) => {
      const ti = E.topup - 0.1 + i * 0.12; el.style.opacity = t >= ti ? '1' : '0';
      const luce = t >= E.pack && t < E.fifty ? i === Math.min(5, Math.floor((t - E.pack) / ((E.fifty - E.pack) / 6))) : t >= E.fifty && i === 5;
      el.classList.toggle('luce', luce);
      el.style.transform = `scale(${(t >= ti ? ressalto(fase(t, ti, 0.3)) : 0) * (luce && i === 5 ? 1 + 0.04 * Math.sin(t * 8) : 1)})`;
    });
  } else pc.style.opacity = '0';
  K.pop($('#conta'), t, p(23) + 0.1, p(26));
  alfinetes(t, ph);
  // moedas: baú e "+100"
  const tm = t >= E.payout - 0.1 && t < p(8) ? E.payout : E.hundred;
  $$('#monete i').forEach((el, i) => {
    const m = MONETE[i], dt = t - tm - m.atraso, vis = dt > 0 && dt < 1.2;
    el.style.opacity = vis ? String(1 - fase(dt, 0.8, 0.4)) : '0';
    if (vis) el.style.transform = `translate(${500 + m.dx * suave(fase(dt, 0, 0.8))}px, ${1000 - m.sobe * Math.sin(Math.min(1, dt / 1.0) * Math.PI)}px)`;
  });
  for (const x of cena.timbri) K.pop(x.el, t, x.ini, x.fim, { base: `rotate(${x.rot}deg)` });
  const fl = Math.max(0, ...cena.tagli.map(tt => (t >= tt ? 0.7 * (1 - fase(t, tt, 0.22)) : 0)));
  $('#velo').style.opacity = R.copertina ? '0' : String(fl);
  tags(t, ph);
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const Sx = [], add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata - 0.05) Sx.push({ t: +t.toFixed(3), tipo, vol: 0.7, ...o }); };
  add(0.02, 'whoosh', { dur: 0.5, vol: 0.5 }); add(0.1, 'scintilla', { vol: 0.5 }); add(E.forever, 'campana', { vol: 0.55, tono: 1.1 });
  cena.tagli.forEach(tc => { if (tc > 1) add(tc - 0.1, 'whoosh', { vol: 0.35, dur: 0.3 }); });
  for (let i = 0; i < 7; i++) add(p(3) + i * (E.seven - p(3)) / 6, 'coin', { vol: 0.35, tono: 1 + i * 0.05 });
  add(E.twenty, 'ding', { vol: 0.6, tono: 1.2 }); add(E.twenty + 0.05, 'fuoco', { vol: 0.4 }); add(E.hundred, 'coin', { vol: 0.8 }); add(E.hundred + 0.05, 'scintilla', { vol: 0.5 });
  MONETE.forEach((m, i) => { if (i % 3 === 0) { add(E.hundred + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); add(E.payout + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); } });
  for (let x = p(6) + 0.1; x < p(8) - 0.05; x += 0.27) add(x, 'tap', { vol: 0.16, tono: 0.8 });
  add(E.chests, 'scintilla', { vol: 0.4 }); add(E.payout - 0.15, 'flap', { vol: 0.5 }); add(E.payout, 'coin', { vol: 0.75 });
  for (let i = 0; i < 6; i++) add(E.topup - 0.1 + i * 0.12, 'pop', { vol: 0.4, tono: 1 + i * 0.06 });
  for (let i = 0; i < 6; i++) add(E.pack + i * (E.fifty - E.pack) / 6, 'tick', { vol: 0.35, tono: 1 + i * 0.08 });
  add(E.fifty, 'ding', { vol: 0.65, tono: 1.3 }); add(E.free11, 'coin', { vol: 0.6 });
  add(E.unlock, 'tasto', { vol: 0.6 }); add(E.good, 'ding', { vol: 0.55, tono: 1.25 });
  for (const k of ['team', 'golden', 'neon', 'crown', 'fireworks', 'lighthouse', 'windmill', 'villa', 'castle']) { add(E[k] - 0.05, 'pop', { vol: 0.6, tono: 1.05 }); add(E[k], 'scintilla', { vol: 0.35 }); }
  add(E.fireworks + 0.3, 'fuoco', { vol: 0.45 }); add(E.castle + 0.2, 'campana', { vol: 0.5 });
  for (let i = 0; i < 10; i++) add(p(23) + 0.15 + i * 0.16, 'pop', { vol: 0.25, tono: 1.1 + i * 0.04 });
  add(E.taken, 'errore', { vol: 0.4 }); add(E.still, 'riser', { dur: 0.8, vol: 0.3 });
  add(p(26) + 0.1, 'notifica', { vol: 0.5 }); add(E.scooter, 'whoosh', { vol: 0.4, dur: 0.4 }); add(E.sports, 'pop', { vol: 0.6 }); add(E.dress, 'select', { vol: 0.5 }); add(E.puppy, 'pop', { vol: 0.5, tono: 1.3 });
  add(E.points, 'stamp', { vol: 0.5 }); add(E.fair, 'ding', { vol: 0.5, tono: 1.2 }); add(E.send, 'stamp'); add(E.send + 0.4, 'notifica', { tono: 1.2 });
  for (const x of cena.timbri) if (x.ini > 1) add(x.ini, 'stamp', { vol: 0.4 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !Sx.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.22 });
  return Sx.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  decori = new Decori(D, mappa, citta, null);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const c = mappa.camera; base = { fov: c.fov, far: c.far, fogN: mappa.scene.fog.near, fogF: mappa.scene.fog.far };
  L = D.luoghi.find(l => l.nome === R.dati.citta); if (!L) throw new Error('cidade');
  L.hc = citta.dadosCidade(L).hc;
  // casas de demonstração: duas casas de nível médio da 1ª quadra, viradas para a rua da frente
  const cand = L.casas.map(i => D.casas[i]).filter(x => x.livello >= 2 && x.livello <= 6 && x.lote < 16).sort((a, b) => a.lote - b.lote);
  CASA = cand.find(x => posLote(x.lote).rot === 0) ?? cand[0];
  CASA2 = cand.find(x => x.conta !== CASA.conta && posLote(x.lote).rot === 0 && Math.abs(x.lote - CASA.lote) > 2) ?? cand.find(x => x.conta !== CASA.conta);
  citta.posCasa(CASA); citta.posCasa(CASA2);
  omini = PG.map(pg => { const o = costruisci(pg, H); o.visible = false; mappa.scene.add(o); return o; });
  for (const id of ['vespa', 'sportiva']) { const v = costruisciVeicolo(id, H); v.visible = false; mappa.scene.add(v); veic[id] = v; }
  const rua = (j, i0, i1) => ({ A: { x: L.x + i0 * QW, z: L.z + (j + 0.5) * QH }, B: { x: L.x + i1 * QW, z: L.z + (j + 0.5) * QH } });
  const rBau = rua(1, 0.1, 0.62), rCar = rua(-2, -1.4, 1.0), rPg = rua(-2, 1.0, 1.5);
  CHEST = forziere(); CHEST.position.set(rBau.B.x + LOTE * 0.25, L.hc + 0.0009, rBau.B.z); mappa.scene.add(CHEST);
  scene = [
    { t0: p(6), t1: p(8), A: rBau.A, B: { x: rBau.B.x - LOTE * 0.2, z: rBau.B.z }, yaw: -Math.PI / 2 + 0.3, liscio: true },
    { t0: p(27), t1: E.dress - 0.05, ...rCar, yaw: -Math.PI / 2 + 0.4, veicolo: true },
    { t0: E.dress - 0.05, t1: 999, ...rPg, yaw: -Math.PI / 2 + 0.5, pop: t => (t >= E.puppy - 0.05 ? E.puppy - 0.05 : E.dress - 0.05) },
  ];
  // alfinetes dos castelos: centro das cidades com casas de cada county
  const cont = new Map();
  for (const l of D.luoghi) { const k = l.comune.sigla; if (!k) continue; const a = cont.get(k) ?? { x: 0, z: 0, n: 0, k }; a.x += l.x; a.z += l.z; a.n++; cont.set(k, a); }
  const lista = [...cont.values()].map(a => ({ k: a.k, x: a.x / a.n, z: a.z / a.n })).sort((a, b) => (a.z - b.z) || (a.x - b.x));
  const meu = L.comune.sigla;
  $('#pins').innerHTML = lista.map(() => '<i>🏰</i>').join('');
  pins = lista.map((x, i) => ({ ...x, el: $$('#pins i')[i], preso: x.k === meu }));
  $('#conta b').textContent = String(lista.length);
  // painéis
  $('#gratis .giorni').innerHTML = Array.from({ length: 7 }, (_, i) => `<div><b>${i === 6 ? '🔥' : '+2'}</b>Day ${i + 1}</div>`).join('');
  $('#pacchi .grid').innerHTML = PACCHI.map(([cr, pr, bo, lab]) => `<div class="pk">${lab ? `<i>${lab}</i>` : ''}<b>${num(cr)} 💰</b><span>${pr}</span>${bo ? `<small>+${bo}%</small>` : ''}</div>`).join('');
  $('#monete').innerHTML = MONETE.map(m => `<i>${m.em}</i>`).join('');
  // câmera
  const hC = 1.6, vista = (o = {}) => ({ x: L.x, z: L.z, dist: 1.4, az: 0.3, el: 42, giu: 0, dy: 0, su: 0, ...o }), dP = mappa.distPais();
  const casa = (cc, o, h) => K.casa(citta, cc, { dist: 0.24, az: 0.45, el: 18, su: 140, ...o }, h);
  K.chaves([
    [0, casa(CASA, { dist: 0.3 }, 1.3)],
    [p(2) - 0.05, K.deriva(0.25, 0.35)],
    [p(2), vista({ cut: true })],
    [p(6) - 0.05, K.deriva(1.2, 0.25)],
    [p(8), vista({ dist: 1.5, az: -0.3, el: 44, cut: true })],
    [p(12) - 0.05, K.deriva(1.3, 0.25)],
    [p(12), casa(CASA, { cut: true }, 1.1)],
    [E.lighthouse - 0.1, K.deriva(0.22, 0.35)],
    [E.lighthouse, casa(CASA, { dist: 0.38, az: 0.3, el: 28, cut: true }, 1.6)],
    [p(20) - 0.05, K.deriva(0.33, 0.4)],
    [p(20), casa(CASA, { dist: 0.38, az: -0.5, el: 28, cut: true }, hC)],
    [p(23) - 0.05, K.deriva(0.33, 0.35)],
    [p(23), K.uk({ cut: true, su: -60 })],
    [p(26) - 0.05, K.uk({ dist: dP * 0.95, su: -60 })],
    [p(26), casa(CASA2, { dist: 0.28, az: 0.4, cut: true }, 1.2)],
    [p(27) - 0.05, K.deriva(0.25, 0.3)],
    [p(30), K.uk({ cut: true, su: -60 })],
    [p(32) - 0.05, K.uk({ dist: dP * 0.93, su: -60 })],
    [p(32), casa(CASA, { dist: 0.42, az: 0.9, el: 28, cut: true }, hC)],
    [R.durata, K.deriva(0.34, 0.5)],
  ]);
  cena.tagli = [p(2), p(6), p(8), p(12), E.lighthouse, p(20), p(23), p(26), p(27), p(30), p(32)];
  cena.impatti = [[E.hundred, 0.3], [E.payout, 0.3], [E.fifty, 0.3], [E.good, 0.3], [E.castle, 0.4], [E.taken, 0.3], [E.send, 0.3]];
  cena.flash = [[0, 0.3], [E.hundred, 0.3], [E.fifty, 0.3], [E.castle, 0.35]];
  cena.timbri = [
    K.timbro('💰 HOW CREDITS WORK', '#1E5AA8', 1180, p(1), p(2), -3, 76),
    K.timbro('🧭 TREASURE <span class="g">+2</span>', '#2FB36A', 250, E.payout, p(8), 3, 90),
    K.timbro('🎁 UP TO <span class="g">+50%</span>', '#E0306E', 1180, E.fifty, p(12), -3, 88),
    K.timbro('🔑 YOURS <span class="g">FOREVER</span>', '#7B2CBF', 250, E.unlock, E.team - 0.05, -3, 92),
    K.timbro('🛋️ +5 FURNITURE FREE', '#2FB36A', 1180, E.five, E.team - 0.05, 3, 76),
    K.timbro('♾️ NEVER RUNS OUT', '#1E5AA8', 250, E.never, p(20), 3, 88),
    K.timbro('🔒 TAKEN = <span class="g">GONE</span>', '#E0306E', 1180, E.taken, E.still - 0.05, -3, 86),
    K.timbro('👀 Is yours <span class="g">free?</span>', '#1E5AA8', 1180, E.still, p(26), 3, 90),
    K.timbro('⚖️ NO POINTS · NO VOTES', '#2FB36A', 1180, E.points, p(32), -3, 76),
    K.timbro('📤 Send to a mate', '#1E5AA8', 1150, E.send, Infinity, -3, 84),
  ];
  if (R.copertina) { K.capa(); for (const s of ['#velo', '#monete']) $(s).style.display = 'none'; }
  console.log(`dados ${D.snap.dati_fino} · ${L.nome} · casa demo lote ${CASA.lote} (liv ${CASA.livello}) e lote ${CASA2.lote} · ${pins.length} counties`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
