// Reel 6 "The first gift" com dados reais: o 1º presente do mapa (@alexsouth8 -> @0_lozza_0, casa dourada com neon),
// à noite: o mapa do Reino Unido, a casa ficando dourada e acendendo o neon, o nº 1, o país inteiro vendo,
// "who would you gift a house?" e comentários marcando amigos com +3 pontos.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL, aspetto, geometriaCasa, stileRegione } from '../js/modelli.js';
import { costruisci } from '../js/decori.js';
import { REGOLE, num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pulso = (t, lista, dec) => lista.reduce((s, [ti, f]) => s + (t >= ti ? f * Math.exp(-(t - ti) / dec) : 0), 0);
const COD = ['ENG', 'SCT', 'WLS', 'NIR'];

let D, mappa, citta, R, E, chaves, cena;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// ---------- 3D: as cidades como pontos (vista do país); a da casa do presente pulsa dourada ----------
function criarPontos(alvo) {
  const L = D.luoghi, n = L.length, pos = new Float32Array(n * 3), naz = new Float32Array(n), dest = new Float32Array(n);
  L.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.06, l.z], i * 3); naz[i] = Math.max(0, COD.indexOf(l.regione.cod)); dest[i] = l === alvo ? 1 : 0; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  g.setAttribute('dest', new THREE.BufferAttribute(dest, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { agora: { value: 0 }, cor: { value: COD.map(k => new THREE.Color(NAZIONI[k].cor)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float naz; attribute float dest;
      uniform float agora; uniform vec3 cor[4]; uniform float escala;
      varying vec3 vCor; varying float vD;
      void main() {
        int k = int(naz + 0.5);
        vD = dest; vCor = cor[k];
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulsa = dest > 0.5 ? 2.4 + 0.8 * sin(agora * 7.0) : 1.0;
        gl_PointSize = clamp(3.2 * escala / -mv.z, 7.0, 16.0) * pulsa;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vD;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 dentro = vD > 0.5 ? vec3(1.0, 0.85, 0.3) : mix(vec3(1.0, 0.82, 0.45), vCor, 0.35);
        gl_FragColor = vec4(d > 0.62 ? vec3(0.05, 0.08, 0.15) : dentro, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}

// ---------- câmera ----------
function montarChaves() {
  const v = D.geo.vista, dP = mappa.distPais(), C = cena, c = C.casa, p = citta.posCasa(c), rot = posLote(c.lote).rot;
  const UK = { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: dP, az: 0, el: null, giu: 0, dy: 0 };
  const h = ALTURA_NIVEL[c.livello] * LOTE;
  const casa = o => ({ x: p.x, z: p.z, el: 24, giu: 0, dy: h * 0.5, ...o, az: rot + (o.az ?? 0) });
  const deriva = (dist, daz, o = {}) => ({ dist, daz, ...o });
  const lista = [
    [0, { ...UK, dist: dP * 1.15, az: -0.1 }],
    [0.35, { ...UK, dist: dP * 1.06, az: -0.05 }],
    [E.alex - 0.05, { x: p.x, z: p.z, dist: 2.4, az: rot + 0.5, el: null, giu: 0, dy: 0 }],
    [E.alex, casa({ dist: 0.6, az: 0.5, el: 30, cut: true })],
    [E.oro - 0.02, deriva(0.48, 0.12)],
    [E.oro, casa({ dist: 0.36, az: 0.25, el: 20, cut: true })],
    [E.neon - 0.02, deriva(0.33, 0.1)],
    [E.neon, casa({ dist: 0.3, az: -0.35, el: 16, cut: true })],
    [E.uno - 0.02, deriva(0.28, -0.12)],
    [E.uno, casa({ dist: 0.55, az: 0.7, el: 32, cut: true })],
    [E.paese - 0.02, deriva(0.48, 0.18)],
    [E.paese + 1.2, { x: p.x, z: p.z, dist: dP * 0.95, az: 0.02, el: null, giu: 0, dy: 0 }],
    [E.chi - 0.02, { dist: dP * 0.93, az: 0.04 }],
    [E.chi, { ...UK, dist: dP * 1.06, az: -0.04, cut: true }],
    [R.durata, { ...UK, dist: dP * 1.14, az: 0.05 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k]) => { const { cut, daz, ...resto } = k; if (daz != null) resto.az = ant.az + daz; ant = { ...ant, ...resto }; return { t, k: { ...ant }, cut: !!cut }; });
}
const elDe = k => (k.el ?? mappa.elevacao(k.dist) * 180 / Math.PI);
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s0 = b.t > a.t && !b.cut ? clamp((t - a.t) / (b.t - a.t)) : (t >= b.t ? 1 : 0);
  const s = suave(s0), A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  const sxz = dxz > 20 ? (B.dist < A.dist ? suave(clamp(s0 / 0.55)) : suave(clamp((s0 - 0.4) / 0.6))) : s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az;
  mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  mappa.alvo.y += l(A.dy ?? 0, B.dy ?? 0);
  const el = l(elDe(A), elDe(B)) * Math.PI / 180, c = mappa.camera, al = mappa.alvo;
  c.position.set(al.x + Math.sin(az) * Math.cos(el) * dist, al.y + Math.sin(el) * dist, al.z + Math.cos(az) * Math.cos(el) * dist);
  const tr = pulso(t, cena.impatti, 0.12) * dist * 0.012;
  if (tr > 1e-6) c.position.add(new THREE.Vector3(Math.sin(t * 83) * tr, Math.cos(t * 71) * tr * 0.6, Math.sin(t * 97 + 1) * tr));
  c.near = Math.max(0.003, dist * 0.02);
  c.updateProjectionMatrix();
  c.up.set(0, 1, 0);
  if (el > 1.5) c.up.set(-Math.sin(az), 0, -Math.cos(az));
  c.lookAt(al);
  c.updateMatrixWorld(true);
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(mappa.camera);
  return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 };
}
function pop(el, t, ini, fim = Infinity, { sai = 0.2, base = 'translate(0,0)' } = {}) {
  const vis = t >= ini && t < fim;
  el.style.opacity = vis ? '1' : '0';
  if (!vis) return 0;
  const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - sai, sai)));
  el.style.transform = `${base} scale(${Math.max(0.001, s)})`;
  return s;
}
function presa(el, t, p, ini, fim, extra = 1) {
  const vis = t >= ini && t < fim && p.ok;
  el.style.opacity = vis ? '1' : '0';
  if (!vis) return;
  const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - 0.18, 0.18))) * extra;
  const w = el.offsetWidth, x = clamp(p.x - w / 2, 24, 1056 - w);
  el.style.transform = `translate(${x}px, ${p.y - el.offsetHeight}px) scale(${Math.max(0.001, s)})`;
}
function legenda(t) {
  const i = R.frasi.findIndex(x => t >= x.ini && t < x.fim), el = $('#sott');
  if (i < 0 || R.copertina) { if (el.innerHTML) { el.innerHTML = ''; el.dataset.f = ''; } return; }
  const f = R.frasi[i];
  if (el.dataset.f !== String(i)) {
    el.dataset.f = String(i);
    el.innerHTML = f.linee.map(l => l.map(w => `<span class="w${w[2] ? ' g' : ''}">${esc(w[0])}</span>`).join(' ')).join('<br>');
  }
  const spans = el.querySelectorAll('.w');
  let k = 0;
  for (const l of f.linee) for (const w of l) {
    const s = fase(t, w[1], 0.2), sp = spans[k++];
    sp.style.visibility = s > 0 ? 'visible' : 'hidden';
    const extra = w[2] ? 1 + 0.06 * clamp(1 - (t - w[1]) / 0.45) : 1;
    sp.style.transform = `translateY(${(1 - suave(s)) * 26}px) scale(${(0.35 + 0.65 * ressalto(s)) * extra})`;
  }
}
function cartao(titulo, sub, cls = '') {
  const el = document.createElement('div');
  el.className = 'etichetta';
  el.innerHTML = `<div class="card ${cls}"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
function timbro(txt, cor, top, ini, fim, rot = -4, size = 80) {
  const el = document.createElement('div');
  el.className = 'pop timbro';
  el.style.cssText = `top:${top}px;color:${cor}`;
  el.innerHTML = `<span style="font-size:${size}px">${txt}</span>`;
  $('#timbri').appendChild(el);
  return { el, ini, fim, rot };
}
const rolar = (t, a, dur, alvo, de = 0) => Math.round(de + (alvo - de) * suave(fase(t, a, dur)));

function quadro(t) {
  const dist = camera(t), C = cena, ms = t * 1000;
  citta.grupo.visible = dist < 32;
  C.pontos.visible = dist > 40;
  C.pontos.material.uniforms.agora.value = t;

  // a casa: normal -> dourada (no "golden") -> dourada com neon (no "neon")
  const fase3 = t < E.oro ? 0 : t < E.neon ? 1 : 2;
  C.normale.visible = fase3 === 0;
  C.oro.g.visible = fase3 === 1;
  C.neon.g.visible = fase3 === 2;
  for (const o of [C.oro, C.neon]) if (o.g.visible) { o.anima(ms); const s = 1 + 0.18 * Math.exp(-Math.max(0, t - (o === C.oro ? E.oro : E.neon)) / 0.12); o.g.scale.setScalar(LOTE * s); }

  for (const s of C.timbri) pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  // quem deu e quem ganhou
  const sc = $('#scambio');
  sc.style.opacity = t >= E.alex && t < E.uno - 0.05 ? '1' : '0';
  [[$('#p-da'), E.alex, -3], [sc.querySelector('.dono'), E.lozza - 0.25, 0], [$('#p-a'), E.lozza, 3]].forEach(([el, ti, r]) => {
    const s = t >= ti && t < E.uno - 0.05 ? ressalto(fase(t, ti, 0.3)) * (1 - suave(fase(t, E.uno - 0.25, 0.2))) : 0;
    el.style.opacity = s > 0 ? '1' : '0';
    el.style.transform = `scale(${Math.max(0.001, s)}) rotate(${r + (el.classList.contains('dono') ? Math.sin(t * 9) * 8 : 0)}deg)`;
  });
  for (const c of C.cartoes) presa(c.el, t, c.p(), c.ini, c.fim, c.extra ? c.extra(t) : 1);

  pop($('#domanda'), t, E.chi, E.cta - 0.05, { base: 'rotate(-3deg)' });
  C.bolle.forEach((b, k) => {
    const s = pop(b.el, t, b.t, E.cta - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + k) * 6}px)`;
    const piu = b.el.querySelector('.piu'), sp = t >= b.tp ? ressalto(fase(t, b.tp, 0.3)) : 0;
    piu.style.opacity = sp > 0 ? '1' : '0';
    piu.style.transform = `scale(${sp}) rotate(8deg)`;
  });
  const bn = $('#banner');
  bn.style.opacity = t >= E.cta ? '1' : '0';
  [...bn.children].forEach((d, k) => {
    const ti = [E.cta, E.cta2][k], s = t >= ti ? ressalto(fase(t, ti, 0.32)) : 0;
    d.style.opacity = s > 0 ? '1' : '0';
    d.style.transform = `scale(${s}) rotate(${k ? 2 : -2}deg)`;
  });
  $('#scuro').style.opacity = String(0.5 * fase(t, E.chi - 0.1, 0.3));

  legenda(t);
  $('#mappa').style.transform = R.copertina ? '' : `scale(${1 + 0.05 * pulso(t, C.impatti, 0.16)})`;
  $('#flash').style.opacity = R.copertina ? '0' : String(clamp(pulso(t, C.flash, 0.09) * 0.55));
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// ---------- efeitos sonoros ----------
function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'campana', { tono: 1.5, vol: 0.5 }); add(0.05, 'scintilla', { vol: 0.5 });
  add(E.gift, 'stamp'); add(E.gift + 0.03, 'bolla', { tono: 1.3, vol: 0.6 });
  add(0.4, 'whoosh', { dur: E.alex - 0.45, giu: true, vol: 0.7 });
  add(E.alex, 'pop', { tono: 1.0 }); add(E.lozza - 0.25, 'bolla', { tono: 1.4, vol: 0.6 }); add(E.lozza, 'pop', { tono: 1.2 });
  add(E.oro - 0.3, 'riser', { dur: 0.3, vol: 0.6 });
  add(E.oro, 'campana', { vol: 0.8 }); add(E.oro + 0.02, 'scintilla'); add(E.oro + 0.05, 'coin', { vol: 0.7 });
  add(E.neon - 0.25, 'silenzio', { dur: 0.23 });
  add(E.neon, 'boom', { vol: 0.5 }); add(E.neon + 0.03, 'notifica', { tono: 1.4, vol: 0.6 }); add(E.neon + 0.06, 'scintilla', { vol: 0.6 });
  add(E.uno - 0.1, 'whoosh', { dur: 0.25, vol: 0.5 }); add(E.uno + 0.05, 'select', { tono: 1.2 });
  for (let t = E.uno + 0.1; t < E.uno + 1.0; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1 + (t - E.uno) * 0.4 });
  add(E.uno + 1.0, 'coin'); add(E.uk, 'ding', { tono: 1.3 });
  add(E.paese, 'whoosh', { dur: 1.2, vol: 0.7 }); add(E.paese + 1.2, 'boom', { vol: 0.4 }); add(E.paese + 1.25, 'scintilla', { vol: 0.5 });
  add(E.chi - 0.3, 'silenzio', { dur: 0.28 }); add(E.chi, 'stamp'); add(E.chi + 0.03, 'campana', { tono: 1.2, vol: 0.5 });
  C.bolle.forEach((b, k) => { add(b.t, 'bolla', { tono: 1 + k * 0.1, vol: 0.7 }); add(b.tp, 'coin', { vol: 0.55 }); });
  add(E.punti2, 'ding', { tono: 1.3 });
  add(E.cta - 0.3, 'silenzio', { dur: 0.28 }); add(E.cta, 'ding', { tono: 1.2 }); add(E.cta + 0.02, 'boom', { vol: 0.35 }); add(E.cta2, 'pop', { tono: 1.1 }); add(E.cta2 + 0.05, 'scintilla', { vol: 0.5 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) {
    if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.3 });
  }
  return S.sort((a, b) => a.t - b.t);
}

// ---------- preparação ----------
async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  mappa.definirNotte(true);
  citta = new Citta(mappa, D);
  cena = {};
  const C = cena;
  const casa = D.porConta.get(R.regalo.conta), l = D.luoghi[casa.luogo];
  C.casa = casa;
  // a casa do presente sai da cidade e é desenhada aqui: normal, dourada e dourada com neon
  citta.nascoste.add(casa.conta);
  citta.cache.delete(l.id); citta.ultimo = null;
  const p = citta.posCasa(casa), stile = stileRegione(l.regione.cod, l.comune.sigla);
  C.normale = new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stile), citta.mat);
  C.normale.position.set(p.x, p.y + 0.0009, p.z); C.normale.rotation.y = posLote(casa.lote).rot; C.normale.scale.setScalar(LOTE);
  citta.grupo.add(C.normale);
  const notte = () => true;
  C.oro = costruisci(D, citta, notte, casa, { squadra: null, modello: null, extra: new Set(['oro']) });
  C.neon = costruisci(D, citta, notte, casa, { squadra: null, modello: null, extra: new Set(['oro', 'neon']) });
  for (const o of [C.oro, C.neon]) { o.g.visible = false; citta.grupo.add(o.g); }
  C.pontos = criarPontos(l);
  const pts = casa.tot - (casa.fonti?.[8] ?? 0), h = ALTURA_NIVEL[casa.livello] * LOTE;
  const sopra = (k = 1.25) => () => projetar(p.x, p.y + h * k + 0.004, p.z);
  const bate = t0 => t => 1 + 0.1 * Math.exp(-Math.max(0, t - t0) / 0.15) * (t >= t0);
  const elNo1 = cartao(`👑 @${esc(casa.conta)}`, '&nbsp;', 'oro');
  C.cartoes = [
    { el: cartao(`🎁 from @${esc(R.regalo.da)}`, 'THE FIRST GIFT EVER', 'rosa'), p: sopra(), ini: E.oro + 0.15, fim: E.uno, extra: bate(E.neon) },
    { el: elNo1, p: sopra(), ini: E.uno, fim: E.paese, extra: t => { elNo1.querySelector('small').textContent = `NO. 1 IN THE UK · ${num(rolar(t, E.uno + 0.1, 0.9, pts))} PTS`; return bate(E.uk)(t); } },
    { el: cartao(`✨ @${esc(casa.conta)}`, `${esc(l.nome.toUpperCase())} · 🎁 GOLD + NEON`, 'oro'), p: () => projetar(p.x, p.y + 0.004, p.z), ini: E.paese + 1.0, fim: E.chi },
  ];
  $('#p-da').textContent = `@${R.regalo.da}`;
  $('#p-a').textContent = `@${casa.conta}`;
  C.timbri = [timbro('🎁 First gift ever', '#E0306E', 290, E.gift, E.alex - 0.05)];
  // comentários marcando amigos, cada marcação vale +3
  const tags = [['Gift for <span class="t">@your_mate</span> 🎁', '#FFC93C'], ['<span class="t">@your_sister</span> deserves a castle 🏰', '#9FD3E6'],
    ['Sending one to <span class="t">@your_best_mate</span>', '#F2B8C6'], ['<span class="t">@your_nan</span> needs the teapot ☕', '#A8E0C2']];
  const pos = [[70, 760, -3], [210, 910, 2], [60, 1060, -2], [240, 1210, 3]];
  C.bolle = tags.map(([txt, cor], k) => {
    const el = document.createElement('div');
    el.className = 'bolla';
    el.innerHTML = `<i style="background:${cor}"></i><b>${txt}</b><div class="piu">+${REGOLE.punti.tag}</div>`;
    $('#bolle').appendChild(el);
    return { el, t: E.tag + k * 0.24, tp: E.punti + 0.2 + k * 0.32, x: pos[k][0], y: pos[k][1], rot: pos[k][2] };
  });
  $('#banner').innerHTML = R.banner.map((x, k) => `<div${k ? ' class="g"' : ''}>${esc(x)}</div>`).join('');
  C.impatti = [[E.alex, 0.4], [E.oro, 1.1], [E.neon, 0.8], [E.uno, 0.4], [E.paese + 1.2, 0.5], [E.chi, 0.4], [E.punti2, 0.3], [E.cta, 0.5]];
  C.flash = [[E.gift, 0.4], [E.alex, 0.5], [E.oro, 1], [E.neon, 0.8], [E.uno, 0.4], [E.chi, 0.3], [E.cta, 0.3]];
  montarChaves();
  if (R.copertina) {
    const cp = R.copertina, el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    for (const s of cp.nascondi ?? []) $(s).style.visibility = 'hidden';
  }
  console.log(`casa @${casa.conta} (${l.nome}) nível ${casa.livello} · ${pts} pts · presente de @${R.regalo.da}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
