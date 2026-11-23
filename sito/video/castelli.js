// Reel 46 "Nobody owns a castle yet" (B, venda, 22/11): 152 castelos, 1 por county, nenhum com dono (verdade em 22/11: nenhuma
// compra) → o 1º dono vira o 1º castelão do Reino Unido, com o nome em cima, para sempre → quando alguém do seu county pega, acabou
// → não quer castelo? "Your Home" por menos de £10, uma vez, para sempre, sem assinatura (casa trocando ao vivo) → pacotes com até
// +50% → Natal: presente para um amigo → começa com os créditos grátis → bio → Sign in → recarga → share.
// Casas de demonstração (o @ mostrado é inventado). window.preparar / quadro / suoni (cattura.mjs).
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { Decori } from '../js/decori.js';
import { kit, $, clamp, suave, ressalto, fase, esc } from './kit.js';

const $$ = s => [...document.querySelectorAll(s)];
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const PACCHI = [[500, '£4.99', 0], [1100, '£9.99', 10, 'most popular'], [2400, '£19.99', 20], [3750, '£29.99', 25], [7800, '£59.99', 30], [15000, '£99.99', 50, 'best value']];
const num = v => Number(v).toLocaleString('en-GB');

let D, mappa, citta, decori, K, R, E, L, CASA, CASA2, cena, pins = [], selK = '', selT = 0, sel2K = '', base = null, tocchi = [];
const p = i => E[`p${i}`] - 0.08;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar; window.quadro = quadro; window.suoni = suoni;
}
const fasi = () => [
  ['map', 0, E.becomes], ['casa', E.becomes, p(6)], ['map', p(6), p(9)], ['casa', p(9), p(15)], ['ui', p(15), p(17)], ['casa', p(17), p(20)],
  ['ui', p(20), p(23)], ['casa', p(23), 999],
];
const faseDi = t => fasi().find(([, a, b]) => t >= a && t < b)?.[0] ?? 'casa';

const S = (extra = [], o = {}) => ({ squadra: o.squadra ?? null, modello: o.modello ?? null, extra: new Set(extra) });
function selCasa(t) {
  if (t < p(9)) return ['castello', S(['castello', 'corona', 'fuochi'])];
  if (t < E.unlock - 0.05) return ['nada', S()];
  if (t < E.once - 0.05) return ['oro', S(['oro', 'corona'])];
  if (t < p(12)) return ['reds', S(['corona'], { squadra: 'reds' })];
  if (t < p(13)) return ['neon', S(['oro', 'neon'])];
  if (t < p(14)) return ['faro', S([], { modello: 'faro' })];
  if (t < p(14) + (p(15) - p(14)) / 2) return ['mulino', S(['fuochi'], { modello: 'mulino' })];
  if (t < p(23)) return ['arco', S(['arcobaleno', 'cuori', 'corona'])];
  return ['castello2', S(['castello', 'corona', 'fuochi'])];
}
function decorar(t) {
  const [k, sel] = selCasa(t);
  if (k !== selK) { selK = k; selT = t; decori.disegna(CASA, sel); }
  const a = decori.attive.get(CASA.conta);
  if (a) { a.g.visible = true; a.anima(t * 1000); a.g.scale.setScalar(LOTE * Math.max(0.001, t < 0.3 ? 1 : 0.6 + 0.4 * ressalto(fase(t, selT, 0.35)))); }
  if (!sel2K && t >= E.decoration - 0.12) { sel2K = 'ok'; decori.disegna(CASA2, S(['oro', 'neve', 'palloncini', 'cornice']), 'you'); }
  const b = decori.attive.get(CASA2.conta);
  if (b) { b.g.visible = true; b.anima(t * 1000); b.g.scale.setScalar(LOTE * Math.max(0.001, ressalto(fase(t, E.decoration - 0.1, 0.4)))); }
}
function tags(t, ph) {
  const out = [];
  const add = (c, h, html) => { citta.posCasa(c); const q = K.projetar(c.x, c.y + h * LOTE, c.z); if (q.ok && q.y > 300 && q.y < 1350) out.push(`<div class="tg oro" style="left:${clamp(q.x, 300, 780).toFixed(0)}px;top:${q.y.toFixed(0)}px">${html}</div>`); };
  const pil = c => (decori.attive.get(c.conta)?.pilha ?? 1.4) + 0.35;
  if (ph === 'casa' && t < p(9)) add(CASA, pil(CASA), `👑 @you<small>1ST CASTLE OWNER IN THE UK</small>`);
  if (ph === 'casa' && t >= p(17) && t < p(20) && t >= E.decoration) add(CASA2, pil(CASA2), '✨ @your_mate<small>🎁 FROM @YOU</small>');
  if (ph === 'casa' && t >= p(23)) add(CASA, pil(CASA), `🏰 @you<small>CASTLE · ${esc(L.comune.sigla.toUpperCase())}</small>`);
  const html = out.join(''), el = $('#tags'); if (el.innerHTML !== html) el.innerHTML = html;
}
function alfinetes(t, ph) {
  const vis = ph === 'map';
  pins.forEach((pn, i) => {
    if (!vis) { pn.el.style.opacity = '0'; return; }
    const q = K.projetar(pn.x, 0.02, pn.z), ti = 0.15 + (i / pins.length) * 1.4, k = t >= ti ? ressalto(fase(t, ti, 0.3)) : 0;
    const primo = pn.primo && t >= E.claim, preso = pn.mio && t >= E.claims;
    const grande = primo ? 3.2 + 0.15 * Math.sin(t * 8) : preso ? 2.4 : 1;
    pn.el.style.opacity = q.ok && k > 0 ? '1' : '0';
    pn.el.classList.toggle('grigio', t >= E.owner2 && !primo && !preso);
    pn.el.classList.toggle('oro', primo);
    pn.el.textContent = preso ? '🔒' : primo ? '👑' : '🏰';
    pn.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${k * grande})`;
  });
}
const MONETE = Array.from({ length: 12 }, (_, i) => ({ dx: ((i * 173) % 640) - 320, atraso: (i * 0.05) % 0.5, sobe: 300 + ((i * 89) % 320), em: i % 3 ? '💰' : '⭐' }));
const centro = el => { const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };

function quadro(t) {
  const ph = faseDi(t);
  const c = mappa.camera; c.fov = base.fov; c.far = base.far; mappa.mar.visible = true;
  K.camera(t);
  decorar(t);
  citta.grupo.visible = mappa.dist < 32;
  $('#scuro').style.opacity = String(ph === 'ui' ? 0.42 : ph === 'map' ? 0.1 : 0);
  K.pop($('#conta'), t, 0.2, E.becomes);
  $('#conta span').innerHTML = t >= E.owner2 ? '<span class="g">0</span> owners · 1 per county' : 'castles · 1 per county';
  alfinetes(t, ph);
  K.pop($('#prezzo'), t, E.ten - 0.1, p(12));
  // pacotes
  const pc = $('#pacchi');
  if (t >= p(15) && t < p(17)) {
    K.pop(pc, t, p(15) + 0.05, p(17));
    $$('#pacchi .pk').forEach((el, i) => {
      const ti = p(15) + 0.15 + i * 0.1; el.style.opacity = t >= ti ? '1' : '0';
      const luce = t >= E.packs && t < E.fifty ? i === Math.min(5, Math.floor((t - E.packs) / ((E.fifty - E.packs) / 6))) : t >= E.fifty && i === 5;
      el.classList.toggle('luce', luce);
      el.style.transform = `scale(${(t >= ti ? ressalto(fase(t, ti, 0.3)) : 0) * (luce && i === 5 ? 1 + 0.04 * Math.sin(t * 8) : 1)})`;
    });
  } else pc.style.opacity = '0';
  // créditos grátis (curto) e telefone
  const gr = $('#gratis');
  if (t >= p(20) && t < p(21)) {
    K.pop(gr, t, p(20) + 0.05, p(21));
    const dias = Math.min(7, Math.floor((t - p(20)) / ((p(21) - p(20)) / 8)));
    $$('#gratis .giorni div').forEach((el, i) => { el.classList.toggle('on', i < dias); el.classList.toggle('fuoco', i === 6 && dias >= 7); });
    $('#gratis .saldo .n').textContent = num(dias * 2 + (dias >= 7 ? 20 : 0)); $('#gratis .b7').classList.toggle('on', dias >= 7);
  } else gr.style.opacity = '0';
  const tf = $('#telefono');
  if (t >= p(21) && t < p(23)) {
    K.pop(tf, t, p(21), p(23));
    const passo = t >= E.topup - 0.2 ? 3 : t >= E.signin - 0.2 ? 2 : 1;
    $$('#telefono .passo').forEach(el => el.classList.toggle('on', +el.dataset.p === passo));
    $('#btn-top').style.transform = `scale(${batida(t, E.topup + 0.3)})`;
  } else tf.style.opacity = '0';
  const tm = t >= E.free20 - 0.1 && t < p(21) ? E.free20 : E.fifty;
  $$('#monete i').forEach((el, i) => {
    const m = MONETE[i], dt = t - tm - m.atraso, vis = dt > 0 && dt < 1.2;
    el.style.opacity = vis ? String(1 - fase(dt, 0.8, 0.4)) : '0';
    if (vis) el.style.transform = `translate(${500 + m.dx * suave(fase(dt, 0, 0.8))}px, ${1000 - m.sobe * Math.sin(Math.min(1, dt / 1.0) * Math.PI)}px)`;
  });
  for (const x of cena.timbri) K.pop(x.el, t, x.ini, x.fim, { base: `rotate(${x.rot}deg)` });
  const tc = $('#tocco'); let tocou = false;
  for (const [ti, alvo] of tocchi) { const k = fase(t, ti, 0.45); if (k <= 0 || k >= 1) continue; const a = alvo(); if (!a) continue; tc.style.left = `${a.x}px`; tc.style.top = `${a.y}px`; tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`; tocou = true; break; }
  if (!tocou) tc.style.opacity = '0';
  const fl = Math.max(0, ...cena.tagli.map(tt => (t >= tt ? 0.7 * (1 - fase(t, tt, 0.22)) : 0)));
  $('#velo').style.opacity = R.copertina ? '0' : String(fl);
  tags(t, ph);
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const Sx = [], add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata - 0.05) Sx.push({ t: +t.toFixed(3), tipo, vol: 0.7, ...o }); };
  add(0.02, 'whoosh', { dur: 0.5, vol: 0.5 });
  for (let i = 0; i < 14; i++) add(0.15 + i * 0.1, 'pop', { vol: 0.22, tono: 1.05 + i * 0.03 });
  add(E.n152, 'campana', { vol: 0.5 }); add(E.owner2, 'boom', { vol: 0.35 });
  cena.tagli.forEach(tc => { if (tc > 1) add(tc - 0.1, 'whoosh', { vol: 0.35, dur: 0.3 }); });
  add(E.claim, 'ding', { vol: 0.6, tono: 1.3 }); add(E.claim + 0.05, 'scintilla', { vol: 0.5 }); add(E.becomes + 0.1, 'campana', { vol: 0.6 }); add(E.forever4, 'scintilla', { vol: 0.45 });
  add(E.claims, 'errore', { vol: 0.45 }); add(E.gone, 'boom', { vol: 0.4 });
  add(E.unlock, 'tasto', { vol: 0.6 }); add(E.ten, 'coin', { vol: 0.6 }); add(E.once, 'ding', { vol: 0.55, tono: 1.2 }); add(E.nosub, 'stamp', { vol: 0.55 });
  for (const k of ['once', 'nosub']) add(E[k] - 0.05, 'pop', { vol: 0.5 });
  add(p(12), 'pop', { vol: 0.5, tono: 1.1 }); add(p(13), 'pop', { vol: 0.5, tono: 1.15 }); add(p(14), 'pop', { vol: 0.5, tono: 1.2 });
  for (let i = 0; i < 6; i++) add(p(15) + 0.15 + i * 0.1, 'pop', { vol: 0.35, tono: 1 + i * 0.06 });
  add(E.fifty, 'ding', { vol: 0.65, tono: 1.3 }); add(E.fifty + 0.1, 'coin', { vol: 0.5 });
  add(E.xmas, 'campana', { vol: 0.55, tono: 1.25 }); add(E.decoration, 'pop', { vol: 0.6 }); add(E.face, 'scintilla', { vol: 0.5 });
  MONETE.forEach((m, i) => { if (i % 3 === 0) add(E.free20 + m.atraso, 'coin', { vol: 0.3, tono: 1.1 + i * 0.03 }); });
  tocchi.forEach(([ti]) => { add(ti, 'tap', { vol: 0.7 }); add(ti + 0.08, 'select', { vol: 0.35 }); });
  add(E.send, 'stamp'); add(E.send + 0.4, 'notifica', { tono: 1.2 });
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
  base = { fov: mappa.camera.fov, far: mappa.camera.far };
  L = D.luoghi.find(l => l.nome === R.dati.citta); if (!L) throw new Error('cidade');
  L.hc = citta.dadosCidade(L).hc;
  const cand = L.casas.map(i => D.casas[i]).filter(x => x.livello >= 2 && x.livello <= 6 && x.lote < 16).sort((a, b) => a.lote - b.lote);
  CASA = cand.find(x => posLote(x.lote).rot === 0) ?? cand[0];
  CASA2 = cand.find(x => x.conta !== CASA.conta && posLote(x.lote).rot === 0 && Math.abs(x.lote - CASA.lote) > 2) ?? cand.find(x => x.conta !== CASA.conta);
  citta.posCasa(CASA); citta.posCasa(CASA2);
  // castelos: 1 por county com casas; o "primeiro" e o "seu" ficam em counties diferentes
  const cont = new Map();
  for (const l of D.luoghi) { const k = l.comune.sigla; if (!k) continue; const a = cont.get(k) ?? { x: 0, z: 0, n: 0, k }; a.x += l.x; a.z += l.z; a.n++; cont.set(k, a); }
  const lista = [...cont.values()].map(a => ({ k: a.k, x: a.x / a.n, z: a.z / a.n, n: a.n })).sort((a, b) => (a.z - b.z) || (a.x - b.x));
  const meu = L.comune.sigla, outro = [...lista].filter(x => x.k !== meu).sort((a, b) => b.n - a.n)[0].k;
  $('#pins').innerHTML = lista.map(() => '<i>🏰</i>').join('');
  pins = lista.map((x, i) => ({ ...x, el: $$('#pins i')[i], primo: x.k === outro, mio: x.k === meu }));
  $('#conta b').textContent = String(lista.length);
  $('#gratis .giorni').innerHTML = Array.from({ length: 7 }, (_, i) => `<div><b>${i === 6 ? '🔥' : '+2'}</b>Day ${i + 1}</div>`).join('');
  $('#pacchi .grid').innerHTML = PACCHI.map(([cr, pr, bo, lab]) => `<div class="pk">${lab ? `<i>${lab}</i>` : ''}<b>${num(cr)} 💰</b><span>${pr}</span>${bo ? `<small>+${bo}%</small>` : ''}</div>`).join('');
  $('#monete').innerHTML = MONETE.map(m => `<i>${m.em}</i>`).join('');
  const dP = mappa.distPais(), hC = 1.6, vista = (o = {}) => ({ x: L.x, z: L.z, dist: 1.4, az: 0.3, el: 42, giu: 0, dy: 0, su: 0, ...o });
  const casa = (cc, o, h) => K.casa(citta, cc, { dist: 0.24, az: 0.45, el: 18, su: 140, ...o }, h);
  K.chaves([
    [0, K.uk({ dist: dP * 1.04, su: -60 })],
    [E.becomes - 0.05, K.uk({ dist: dP * 0.93, az: 0.05, su: -60 })],
    [E.becomes, casa(CASA, { dist: 0.42, az: 0.8, el: 28, cut: true }, hC)],
    [p(5) - 0.05, K.deriva(0.36, 0.3)],
    [p(5), casa(CASA, { dist: 0.5, az: 1.2, el: 30 }, hC)],
    [p(6) - 0.05, casa(CASA, { dist: 1.1, az: 1.5, el: 36 }, hC)],
    [p(6), K.uk({ cut: true, su: -60 })],
    [p(9) - 0.05, K.uk({ dist: dP * 0.94, su: -60 })],
    [p(9), casa(CASA, { dist: 0.3, cut: true }, 1.2)],
    [p(13) - 0.05, K.deriva(0.26, 0.4)],
    [p(13), casa(CASA, { dist: 0.38, az: 0.2, el: 28, cut: true }, 1.6)],
    [p(15) - 0.05, K.deriva(0.34, 0.3)],
    [p(15), vista({ cut: true })],
    [p(17) - 0.05, K.deriva(1.25, 0.2)],
    [p(17), casa(CASA2, { dist: 0.34, az: -0.45, el: 28, cut: true }, 1.2)],
    [p(20) - 0.05, K.deriva(0.25, 0.35)],
    [p(20), vista({ dist: 1.5, az: -0.3, el: 44, cut: true })],
    [p(23) - 0.05, K.deriva(1.3, 0.2)],
    [p(23), casa(CASA, { dist: 0.42, az: 0.9, el: 28, cut: true }, hC)],
    [R.durata, K.deriva(0.34, 0.5)],
  ]);
  cena.tagli = [E.becomes, p(6), p(9), p(13), p(15), p(17), p(20), p(21), p(23)];
  cena.impatti = [[E.owner2, 0.4], [E.becomes, 0.4], [E.gone, 0.4], [E.ten, 0.3], [E.fifty, 0.3], [E.decoration, 0.3], [E.send, 0.3]];
  cena.flash = [[0, 0.3], [E.becomes, 0.4], [E.gone, 0.35], [E.fifty, 0.3]];
  cena.timbri = [
    K.timbro('🏰 <span class="g">0</span> OWNERS', '#7B2CBF', 1180, E.owner2, E.becomes, -3, 110),
    K.timbro('👑 THE <span class="g">FIRST</span> IN THE UK', '#E0306E', 250, E.becomes + 0.1, p(5), -3, 70),
    K.timbro('👀 EVERYONE SEES IT', '#1E5AA8', 250, p(5), p(6), 3, 86),
    K.timbro('🔒 GONE <span class="g">FOR GOOD</span>', '#E0306E', 1180, E.gone, p(9), -3, 92),
    K.timbro('❌ NO SUBSCRIPTION', '#E0306E', 1180, E.nosub, p(13), 3, 86),
    K.timbro('🎨 CHANGE IT ANY TIME', '#7B2CBF', 250, p(14), p(15), -3, 84),
    K.timbro('🎁 UP TO <span class="g">+50%</span> FREE', '#2FB36A', 1180, E.fifty, p(17), -3, 82),
    K.timbro('🎄 A CHRISTMAS GIFT', '#2FB36A', 250, E.xmas, p(20), 3, 88),
    K.timbro('🆓 START FREE', '#2FB36A', 1180, E.free20, p(21), -3, 96),
    K.timbro('📤 Send to a mate', '#1E5AA8', 1150, E.send, Infinity, -3, 84),
  ];
  tocchi = [[E.link, () => centro($('#telefono .link'))], [E.signin, () => centro($('#btn-signin'))], [E.topup, () => centro($('#btn-top'))]];
  if (R.copertina) { K.capa(); for (const s of ['#velo', '#monete', '#tocco']) $(s).style.display = 'none'; }
  console.log(`dados ${D.snap.dati_fino} · ${L.nome} · casas demo ${CASA.lote}/${CASA2.lote} · ${pins.length} counties · 1º castelo em ${outro}, o seu ${meu}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
