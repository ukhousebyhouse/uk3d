// Reel 5 "48 hours + new houses" com dados reais: o mapa vazio, a explosão das cidades até agora (casas, cidades,
// comentários, seguidores), a rua de London com as casas variadas (portas, telhados, floreiras, enfeites do jardim),
// a vitrine das 15 casas raras, "só uma por cidade" numa cidade de verdade, a loja, o preço, o presente e o convite.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL, aspetto, geometriaCasa, geometriaEspecial, stileRegione } from '../js/modelli.js';
import { SPECIALI, costruisciSpeciale } from '../js/speciali.js';
import { cuori } from '../js/decori.js';
import { num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pulso = (t, lista, dec) => lista.reduce((s, [ti, f]) => s + (t >= ti ? f * Math.exp(-(t - ti) / dec) : 0), 0);
const LONDRA = { timeZone: 'Europe/London' };
const COD = ['ENG', 'SCT', 'WLS', 'NIR'];
let semente = 11;
const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };

let D, mappa, citta, R, E, chaves, cena;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}
const mundo = (lat, lon) => { const P = D.geo.proj; return { x: (lon - P.LON0) * P.KM * Math.cos(lat * Math.PI / 180), z: (P.LAT0 - lat) * P.KZ }; };
const acharLugar = cands => cands.map(([la, lo]) => mundo(la, lo)).find(p => D.luoghi.every(l => Math.hypot(l.x - p.x, l.z - p.z) > 6) && mappa.altura(p.x, p.z) > 0.02) ?? mundo(...cands[0]);

// ---------- tempo real (48 h) <-> tempo do vídeo: a explosão inteira cabe em "Today: nearly ten thousand houses" ----------
const realDe = t => { const [r0, r1, v0, v1] = cena.trecho; return t <= v0 ? r0 : t >= v1 ? r1 : r0 + (r1 - r0) * suave((t - v0) / (v1 - v0)); };
function videoDe(r) {
  const [r0, r1, v0, v1] = cena.trecho, x = clamp((r - r0) / (r1 - r0));
  let a = 0, b = 1;   // inverso do suave (busca binária)
  for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (suave(m) < x) a = m; else b = m; }
  return v0 + (v1 - v0) * a;
}
const contarAte = (lista, r) => { let a = 0, b = lista.length; while (a < b) { const m = (a + b) >> 1; if (lista[m] <= r) a = m + 1; else b = m; } return a; };

// ---------- 3D ----------
function criarPontos() {
  const L = D.luoghi, n = L.length, pos = new Float32Array(n * 3), ini = new Float32Array(n), naz = new Float32Array(n);
  L.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.06, l.z], i * 3); ini[i] = videoDe(l.fondatore_ts); naz[i] = Math.max(0, COD.indexOf(l.regione.cod)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ini', new THREE.BufferAttribute(ini, 1));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { agora: { value: 0 }, evid: { value: [0, 0, 0, 0] }, cor: { value: COD.map(k => new THREE.Color(NAZIONI[k].cor)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ini; attribute float naz;
      uniform float agora; uniform float evid[4]; uniform vec3 cor[4]; uniform float escala;
      varying float vE; varying vec3 vCor;
      void main() {
        float x = clamp((agora - ini) / 0.3, 0.0, 1.0);
        float s = agora < ini ? 0.0 : 1.0 + 2.9 * pow(x - 1.0, 3.0) + 1.9 * pow(x - 1.0, 2.0);
        int k = int(naz + 0.5);
        vE = evid[k]; vCor = cor[k];
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(4.5 * escala / -mv.z, 11.0, 24.0) * s * (1.0 + 0.7 * vE);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vE; varying vec3 vCor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 dentro = mix(vec3(1.0, 0.79, 0.24), vCor, clamp(vE, 0.0, 1.0));
        gl_FragColor = vec4(d > 0.6 ? vec3(0.08, 0.13, 0.2) : dentro, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}
const matVC = new THREE.MeshLambertMaterial({ vertexColors: true });
// casa rara num lugar (em lotes): grupo + animação
function rara(id, x, y, z, rot = 0) {
  const sp = costruisciSpeciale(id), g = new THREE.Group();
  g.add(new THREE.Mesh(sp.geo, matVC));
  if (sp.extra) g.add(sp.extra);
  g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(LOTE);
  mappa.scene.add(g);
  return { g, h: sp.h, anima: sp.anima ?? (() => {}) };
}
// vitrine no campo: as 15 casas raras em 3 fileiras de 5, num gramado redondo com árvores
function criarVitrine() {
  const C = acharLugar([[52.75, -1.95], [53.9, -1.2], [52.35, -0.6], [51.85, -1.35], [54.3, -2.2]]), g = new THREE.Group();
  let chao = -Infinity;
  for (let a = -0.5; a <= 0.5; a += 0.1) for (let b = -0.5; b <= 0.5; b += 0.1) chao = Math.max(chao, mappa.altura(C.x + a, C.z + b));
  chao += 0.002;
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1.6, 80), new THREE.MeshLambertMaterial({ color: '#8FC064' }));
  disco.rotation.x = -Math.PI / 2; disco.position.set(C.x, chao, C.z); g.add(disco);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  for (const [tipo, n] of [['quercia', 260], ['betulla', 120], ['abete', 70]]) {
    const im = new THREE.InstancedMesh(geometriaEspecial(tipo), matVC, n);
    let k = 0;
    while (k < n) {
      const r = 0.36 + Math.pow(rnd(), 0.7) * 1.2, a = rnd() * Math.PI * 2, e = LOTE * (0.9 + rnd() * 0.7);
      m4.compose(v.set(C.x + Math.cos(a) * r, chao, C.z + Math.sin(a) * r), q.setFromAxisAngle(y, rnd() * 6.28), s.set(e, e, e));
      im.setMatrixAt(k++, m4);
    }
    im.frustumCulled = false; g.add(im);
  }
  mappa.scene.add(g);
  const P = LOTE * 1.3, lotti = SPECIALI.map((m, i) => {
    const col = i % 5, fila = Math.floor(i / 5), x = C.x + (col - 2) * P, z = C.z + (fila - 1) * P * 1.15;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(LOTE * 1.12, LOTE * 1.12), new THREE.MeshLambertMaterial({ color: '#C9E6A8' }));
    t.rotation.x = -Math.PI / 2; t.position.set(x, chao + 0.0004, z); g.add(t);
    return { ...m, ...rara(m.id, x, chao + 0.0008, z), x, z, y: chao };
  });
  return { x: C.x, z: C.z, y: chao, lotti };
}
const porId = id => cena.vit.lotti.find(l => l.id === id);
// posição de um enfeite do jardim (o deslocamento gira com a casa, igual a citta.js)
function posOrn(casa, o) {
  const p = citta.posCasa(casa), r = posLote(casa.lote).rot, cs = Math.cos(r), sn = Math.sin(r);
  return { x: p.x + (o.x * cs + o.z * sn) * LOTE, y: p.y, z: p.z + (-o.x * sn + o.z * cs) * LOTE };
}
// troca a casa da cidade por um grupo próprio (casa rara ou casa normal que some/aparece)
function tirarDaCidade(casa) {
  citta.nascoste.add(casa.conta); citta.speciali.add(casa.conta);
  citta.cache.delete(D.luoghi[casa.luogo].id); citta.ultimo = null;
}
function naCasa(casa, obj) {
  const p = citta.posCasa(casa);
  obj.position.set(p.x, p.y + 0.0009, p.z); obj.rotation.y = posLote(casa.lote).rot; obj.scale.setScalar(LOTE);
  mappa.scene.add(obj);
  return obj;
}

// ---------- câmera ----------
function montarChaves() {
  const v = D.geo.vista, dP = mappa.distPais(), C = cena;
  const UK = { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: dP, az: 0, el: null, giu: 0, dy: 0, su: 0, y0: null };
  // casa e enfeite vistos de frente: az relativo à frente da casa (o lote gira a casa)
  const frente = c => posLote(c.lote).rot;
  const casa = (c, o) => { const p = citta.posCasa(c); return { x: p.x, z: p.z, el: 24, giu: 0, dy: ALTURA_NIVEL[c.livello] * LOTE * 0.4, su: 0, y0: null, ...o, az: frente(c) + (o.az ?? 0) }; };
  const orn = (p, o) => ({ x: p.x, z: p.z, el: 48, giu: 0, dy: 0.002, su: 0, y0: null, ...o, az: p.rot + (o.az ?? 0) });
  const mod = (id, o) => { const m = porId(id); return { x: m.x, z: m.z, el: 14, giu: 0, dy: m.h * LOTE * 0.42, su: 0, y0: m.y, ...o }; };
  const deriva = (dist, daz, o = {}) => ({ dist, daz, ...o });   // segue a última posição, girando um pouco
  const vit = C.vit, lon = C.londra, tw = C.paese;
  const lista = [
    [0, { ...UK, dist: dP * 1.16, az: -0.14 }],
    [E.oggi - 0.02, { ...UK, dist: dP * 1.1, az: -0.07 }],
    [E.case_fim, { dist: dP * 0.98, az: 0 }],
    [E.commenti, { dist: dP * 0.95, az: 0.03 }],
    [E.esplode, { dist: dP * 0.92, az: 0.05 }],
    [E.so - 0.02, { dist: dP * 0.86, az: 0.07 }],
    [E.so, { x: lon.x, z: lon.z, dist: 1.25, az: 0.45, el: null, giu: 0.04, dy: 0, cut: true }],
    [E.unica - 0.02, deriva(0.8, 0.17)],
    [E.unica, casa(C.fila, { dist: 0.55, az: 0.35, el: 30, cut: true })],
    [E.porte - 0.02, deriva(0.48, 0.15)],
    [E.porte, casa(C.cPorte, { dist: 0.27, az: 0.18, el: 16, cut: true })],
    [E.tetti - 0.02, deriva(0.25, 0.12)],
    [E.tetti, casa(C.cTetti, { dist: 0.34, az: -0.3, el: 36, cut: true })],
    [E.fiori - 0.02, deriva(0.31, 0.12)],
    [E.fiori, casa(C.cFiori, { dist: 0.24, az: 0.25, el: 14, cut: true })],
    [E.gnomi - 0.02, deriva(0.22, 0.12)],
    [E.gnomi, orn(C.oGnomo, { dist: 0.12, az: 0.3, cut: true })],
    [E.bici - 0.02, deriva(0.11, 0.12)],
    [E.bici, orn(C.oBici, { dist: 0.11, az: -0.3, el: 72, cut: true })],
    [E.stendino - 0.62, deriva(0.11, 0.12)],
    [E.stendino - 0.6, orn(C.oStend, { dist: 0.13, az: 0.3, cut: true })],
    [E.british - 0.02, deriva(0.14, 0.12)],
    [E.british, { x: lon.x, z: lon.z, dist: 0.95, az: 0.75, el: null, giu: 0.04, dy: 0, y0: null, cut: true }],
    [E.rare - 0.02, deriva(0.85, 0.13)],
    [E.rare, { x: vit.x, z: vit.z + LOTE * 0.4, dist: 0.62, az: 0.15, el: 24, giu: 0, dy: 0.02, y0: vit.y, cut: true }],
    [E.faro - 0.02, deriva(0.55, 0.15)],
    ...['faro', 'castello', 'mulino', 'barca', 'bus', 'stregata', 'razzo'].flatMap((id, k, a) => {
      const ini = E[id], fim = k < a.length - 1 ? E[a[k + 1]] : E.quindici, az = k % 2 ? -0.32 : 0.32;
      const d = { faro: 0.3, castello: 0.24, mulino: 0.27, barca: 0.18, bus: 0.18, stregata: 0.26, razzo: 0.27 }[id];
      return [[ini, mod(id, { dist: d, az, cut: true })], [fim - 0.02, deriva(d * 0.86, -az * 0.45)]];
    }),
    [E.quindici, { x: vit.x, z: vit.z, dist: 0.95, az: 0.12, el: 38, giu: 0, dy: 0.01, y0: vit.y, cut: true }],
    [E.citta_castello - 0.02, deriva(0.86, 0.18)],
    [E.citta_castello, casa(C.cA, { dist: 0.62, az: 0.45, el: 32, dy: 0.01, cut: true })],
    [E.prova - 0.02, deriva(0.55, 0.16)],
    [E.prova, casa(C.cC, { dist: 0.3, az: 0.2, el: 20, su: 380, cut: true })],
    [E.ama, deriva(0.27, 0.12, { su: 120 })],
    [E.paese, deriva(0.25, 0.08, { su: 0 })],
    [E.dieci, { x: tw.x, z: tw.z, dist: dP * 0.9, az: 0.02, el: null, giu: 0, dy: 0 }],
    [E.regalo - 0.02, deriva(dP * 0.88, 0.02)],
    [E.regalo, casa(C.cD, { dist: 0.3, az: -0.3, el: 22, su: 260, cut: true })],
    [E.solo - 0.02, deriva(0.26, 0.15)],
    [E.solo, { x: tw.x, z: tw.z, dist: 0.85, az: 0.55, el: null, giu: 0.04, dy: 0, su: 0, cut: true }],
    [E.diecimila - 0.02, deriva(0.72, 0.2)],
    [E.diecimila, { ...UK, dist: dP * 1.02, az: -0.05, cut: true }],
    [E.cta, { ...UK, dist: dP * 1.06, az: 0 }],
    [R.durata, { ...UK, dist: dP * 1.12, az: 0.05 }],
  ].sort((a, b) => a[0] - b[0]);
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
  // vitrine no campo: a altura do alvo é a do gramado (o relevo em volta não serve)
  if (A.y0 != null || B.y0 != null) { const base = mappa.alvo.y; mappa.alvo.y = l(A.y0 ?? base, B.y0 ?? base); }
  mappa.alvo.y += l(A.dy ?? 0, B.dy ?? 0);
  const el = l(elDe(A), elDe(B)) * Math.PI / 180, c = mappa.camera, al = mappa.alvo;
  c.position.set(al.x + Math.sin(az) * Math.cos(el) * dist, al.y + Math.sin(el) * dist, al.z + Math.cos(az) * Math.cos(el) * dist);
  const tr = pulso(t, cena.impatti, 0.12) * dist * 0.012;
  if (tr > 1e-6) c.position.add(new THREE.Vector3(Math.sin(t * 83) * tr, Math.cos(t * 71) * tr * 0.6, Math.sin(t * 97 + 1) * tr));
  c.near = Math.max(0.003, dist * 0.02);
  const su = R.copertina ? (R.copertina.giu ?? 0) : l(A.su ?? 0, B.su ?? 0);
  if (su) c.setViewOffset(1080, 1920, 0, -su, 1080, 1920); else c.clearViewOffset();
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
  el.style.cssText = `top:${top}px;color:${cor};--fs:${size}px`;
  el.innerHTML = `<span>${txt}</span>`;
  $('#timbri').appendChild(el);
  return { el, ini, fim, rot };
}
const rolar = (t, a, dur, alvo, de = 0) => Math.round(de + (alvo - de) * suave(fase(t, a, dur)));

function quadro(t) {
  const dist = camera(t), C = cena, U = C.pontos.material.uniforms, ms = t * 1000;
  C.tAtual = t;
  citta.grupo.visible = dist < 32;
  C.pontos.visible = dist > 40;
  U.agora.value = t;

  // relógio: parado às 05:08 do 1º dia; corre as 48 h em "nearly ten thousand houses"; ao vivo no fim
  const r = realDe(t), live = t >= E.case_fim, ro = $('#orologio');
  ro.classList.toggle('live', live);
  if (pop(ro, t, 0.1, E.so - 0.05)) {
    const dia = new Date(r).toLocaleDateString('en-GB', { ...LONDRA, weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    ro.querySelector('small').textContent = live ? `🔴 RIGHT NOW · ${dia}` : dia;
    ro.querySelector('b').textContent = live ? `${Math.round((r - C.trecho[0]) / 36e5)} HOURS` : new Date(r).toLocaleTimeString('en-GB', { ...LONDRA, hour: '2-digit', minute: '2-digit' });
    const marco = [E.oggi, E.case_fim].filter(x => t >= x).pop() ?? -9;
    ro.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-Math.max(0, t - marco) / 0.15)})`;
  }
  // contador: casas -> cidades -> comentários -> seguidores
  const ct = $('#conta');
  if (pop(ct, t, E.oggi, E.so - 0.05)) {
    const [n, lab, sub] = t < E.citta ? [contarAte(C.tsCase, r), 'HOUSES 🏠', `🎯 NEXT STOP: 10,000`]
      : t < E.commenti ? [rolar(t, E.citta_num, 0.8, C.nCitta, 0), 'TOWNS 🏘️', '']
        : t < E.follower ? [rolar(t, E.commenti, 1.2, C.nCommenti), 'COMMENTS 💬', '']
          : [rolar(t, E.follower_num, 1.0, C.nFollower), 'OF YOU FOLLOWING 👥', ''];
    ct.querySelector('.num').textContent = num(n);
    ct.querySelector('.lab').textContent = lab;
    ct.querySelector('.sub').textContent = t < E.citta ? sub : '';
    const marco = [E.case_fim, E.citta_num + 0.8, E.commenti + 1.2, E.follower_num + 1.0, E.boom].filter(x => t >= x).pop() ?? -9;
    ct.style.transform += ` scale(${1 + 0.1 * Math.exp(-Math.max(0, t - marco) / 0.15)})`;
  }
  C.bolle.forEach((b, k) => {
    const s = pop(b.el, t, b.t, E.follower - 0.05, { base: `translate(${b.x}px, ${b.y - 50 * fase(t, b.t, 2.5)}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateX(${Math.sin(t * 2.3 + k) * 5}px)`;
  });
  // as 4 nações pulsando na explosão
  for (let k = 0; k < 4; k++) U.evid.value[k] = t >= E.boom && t < E.so ? 0.5 + 0.5 * Math.sin((t - E.boom) * 6 + k) : t >= E.diecimila ? 0.3 + 0.3 * Math.sin((t - E.diecimila) * 4 + k) : 0;

  // carimbos
  for (const s of C.timbri) pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  pop($('#titolo'), t, E.rare, E.faro - 0.05, { base: 'rotate(-3deg)' });

  // rua de London: cartões nas casas e nos enfeites
  for (const c of C.cartoes) presa(c.el, t, c.p(), c.ini, c.fim, c.extra ? c.extra(t) : 1);

  // casas raras animadas (vitrine e cidade)
  // close na vitrine: as casas da fileira da frente somem (a câmera olha de +z)
  const foco = t >= E.faro && t < E.quindici ? porId(['faro', 'castello', 'mulino', 'barca', 'bus', 'stregata', 'razzo'].filter(id => t >= E[id]).pop()) : null;
  for (const m of C.vit.lotti) m.g.visible = !foco || m.z <= foco.z + 1e-6;
  for (const m of C.vit.lotti) m.anima(m.id === 'mulino' && t >= E.gira ? ms * 1.0 + (t - E.gira) * 1800 : ms, false);
  for (const o of C.animadas) o.anima(ms, false);
  // o castelo da cidade e a loja: a casa troca de modelo a cada toque
  C.castello.g.visible = t >= E.citta_castello - 0.02;
  const toque = C.toques.filter(x => t >= x.t).pop();
  C.prova.normale.visible = !toque;
  C.prova.modelli.forEach((m, i) => { m.g.visible = toque?.i === i; if (m.g.visible) { const s = ressalto(fase(t, toque.t, 0.3)); m.g.scale.set(LOTE, LOTE * s, LOTE); } });
  const pan = $('#negozio');
  if (pop(pan, t, E.prova + 0.05, E.ama, { base: `translateY(${(1 - suave(fase(t, E.prova, 0.3))) * -200}px)` })) {
    pan.querySelectorAll('.bt').forEach((b, k) => b.classList.toggle('on', toque?.k === k));
  }
  const dito = $('#dito'), dt = C.toques.find(x => t < x.t + 0.25 && t >= x.t - 0.35);
  if (dt && t >= E.prova + 0.1 && t < E.ama) {
    const b = pan.querySelectorAll('.bt')[dt.k].getBoundingClientRect(), k = fase(t, dt.t - 0.35, 0.3);
    const prev = C.toques[C.toques.indexOf(dt) - 1], pb = prev ? pan.querySelectorAll('.bt')[prev.k].getBoundingClientRect() : { left: 900, top: 1300, width: 0, height: 0 };
    const x = pb.left + pb.width * 0.55 + (b.left + b.width * 0.55 - pb.left - pb.width * 0.55) * suave(k), y = pb.top + pb.height * 0.5 + (b.top + b.height * 0.5 - pb.top - pb.height * 0.5) * suave(k);
    dito.style.opacity = '1';
    dito.style.transform = `translate(${x - 30}px, ${y}px) scale(${t >= dt.t && t < dt.t + 0.12 ? 0.85 : 1})`;
  } else dito.style.opacity = '0';
  if (pop($('#cuore'), t, E.ama, E.prezzo + 0.1)) $('#cuore').style.transform += ` scale(${1 + 0.15 * Math.max(0, Math.sin((t - E.ama) * 12))})`;
  if (pop($('#prezzo'), t, E.prezzo, E.paese + 0.4)) $('#prezzo .carta').style.transform = `rotate(-3deg) scale(${1 + 0.1 * Math.exp(-Math.max(0, t - E.prezzo - 0.35) / 0.15) * (t >= E.prezzo + 0.35)})`;
  pop($('#giorni'), t, E.dieci, E.regalo - 0.05, { base: 'rotate(2deg)' });
  C.cuori.visible = t >= E.regalo;

  // fim: rumo às 10.000, banner e "qual você vai pegar?"
  const ob = $('#obiettivo');
  if (pop(ob, t, E.diecimila + 0.05, E.cta - 0.05)) {
    const n = rolar(t, E.diecimila + 0.2, 1.4, C.nCase, Math.round(C.nCase * 0.6));
    ob.querySelector('b').textContent = `${num(n)} / 10,000`;
    ob.querySelector('.barra i').style.width = `${n / 100}%`;
  }
  const bn = $('#banner');
  bn.style.opacity = t >= E.cta && t < E.quale ? '1' : '0';
  [...bn.children].forEach((d, k) => {
    const ti = [E.cta, E.cta2][k], s = t >= ti ? ressalto(fase(t, ti, 0.32)) * (1 - suave(fase(t, E.quale - 0.2, 0.2))) : 0;
    d.style.opacity = s > 0 ? '1' : '0';
    d.style.transform = `scale(${Math.max(0.001, s)}) rotate(${k ? 2 : -2}deg)`;
  });
  const qu = $('#quale');
  if (pop(qu, t, E.quale, Infinity)) qu.querySelectorAll('.em').forEach((e, k) => {
    const ti = E.quale + 0.25 + k * 0.08, s = t >= ti ? ressalto(fase(t, ti, 0.3)) : 0;
    e.style.opacity = s > 0 ? '1' : '0';
    e.style.transform = `scale(${s}) translateY(${Math.sin(t * 3 + k) * 6}px)`;
  });
  $('#scuro').style.opacity = String(0.78 * fase(t, E.big, 0.25) * (1 - fase(t, E.rare - 0.02, 0.05)) + 0.35 * fase(t, E.solo, 0.2) * (1 - fase(t, E.diecimila - 0.05, 0.05)) + 0.28 * fase(t, E.cta - 0.2, 0.3));

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
  add(0, 'vento', { dur: 3.4, vol: 0.4 });
  add(0.1, 'pop', { tono: 0.8, vol: 0.5 });
  add(E.vuoto, 'tick', { vol: 0.5 });
  // explosão: silêncio, "Today" e uma chuva de pops com tique acelerando
  add(E.oggi - 0.4, 'silenzio', { dur: 0.38 });
  add(E.oggi, 'whoosh', { dur: 0.5, vol: 0.7 }); add(E.oggi + 0.05, 'notifica', { tono: 1.1 });
  for (let t = E.oggi + 0.1; t < E.case_fim; t += 0.055) add(t, 'pop', { tono: 0.8 + ((t * 13) % 1) * 0.6, vol: 0.3 });
  for (let t = E.oggi + 0.1; t < E.case_fim; t += 0.09) add(t, 'tick', { vol: 0.25, tono: 1 + 0.6 * (t - E.oggi) / 3 });
  add(E.case_fim, 'stamp'); add(E.case_fim + 0.02, 'boom', { vol: 0.55 }); add(E.case_fim + 0.04, 'scintilla');
  for (let t = E.citta_num; t < E.citta_num + 0.8; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1.2 + (t - E.citta_num) * 0.5 });
  add(E.citta_num + 0.8, 'ding', { tono: 1.1 });
  C.bolle.forEach((b, k) => add(b.t, 'bolla', { tono: 1 + (k % 5) * 0.1, vol: 0.7 }));
  add(E.commenti + 1.2, 'coin');
  for (let t = E.follower_num; t < E.follower_num + 1.0; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1.3 + (t - E.follower_num) * 0.4 });
  add(E.follower_num + 1.0, 'notifica', { tono: 1.25 });
  add(E.boom - 0.4, 'riser', { dur: 0.4, vol: 0.6 });
  add(E.boom - 0.02, 'silenzio', { dur: 0.02 });
  add(E.boom, 'boom', { vol: 1 }); add(E.boom + 0.02, 'stamp'); add(E.boom + 0.05, 'scintilla'); add(E.boom + 0.1, 'fuoco', { vol: 0.5 });
  // rua
  add(E.so - 0.35, 'whoosh', { dur: 0.7, giu: true });
  add(E.gratis, 'stamp', { vol: 0.8 }); add(E.gratis + 0.03, 'ding', { tono: 1.2 });
  add(E.unica - 0.12, 'whoosh', { dur: 0.25, vol: 0.5 }); add(E.unica2, 'scintilla', { vol: 0.6 }); add(E.unica2 + 0.02, 'stamp', { vol: 0.6 });
  for (const k of ['porte', 'tetti', 'fiori', 'gnomi', 'bici']) { add(E[k] - 0.1, 'whoosh', { dur: 0.2, vol: 0.5 }); add(E[k] + 0.05, 'select', { tono: 1 + ['porte', 'tetti', 'fiori', 'gnomi', 'bici'].indexOf(k) * 0.06 }); }
  add(E.porte + 0.12, 'tap', { vol: 0.5 }); add(E.fiori + 0.15, 'bolla', { tono: 1.3, vol: 0.6 }); add(E.gnomi + 0.2, 'pop', { tono: 1.4 });
  add(E.bici + 0.2, 'campana', { tono: 2.2, vol: 0.35 });
  add(E.stendino - 0.7, 'whoosh', { dur: 0.2, vol: 0.5 }); add(E.stendino - 0.5, 'select', { tono: 1.3 }); add(E.stendino, 'flap', { vol: 0.6 });
  add(E.british - 0.2, 'whoosh', { dur: 0.4, vol: 0.6 }); add(E.british + 0.1, 'stamp'); add(E.british + 0.12, 'campana', { vol: 0.5 });
  // casas raras: tambor, silêncio e o estrondo
  add(E.big, 'rullo', { dur: E.rare - E.big - 0.3, vol: 0.6 });
  add(E.rare - 0.3, 'silenzio', { dur: 0.28 });
  add(E.rare, 'boom', { vol: 1 }); add(E.rare + 0.02, 'campana', { vol: 0.7 }); add(E.rare + 0.05, 'scintilla'); add(E.rare + 0.1, 'fuoco', { vol: 0.4 });
  const ids = ['faro', 'castello', 'mulino', 'barca', 'bus', 'stregata', 'razzo'];
  ids.forEach((id, k) => { add(E[id] - 0.1, 'whoosh', { dur: 0.22, vol: 0.55 }); add(E[id] + 0.04, 'pop', { tono: 0.9 + k * 0.07 }); add(E[id] + 0.08, 'select', { tono: 1 + k * 0.05, vol: 0.6 }); });
  add(E.castello + 0.3, 'campana', { tono: 0.8, vol: 0.35 }); add(E.gira, 'vento', { dur: 0.9, vol: 0.5 }); add(E.gira + 0.1, 'scintilla', { vol: 0.5 });
  add(E.barca + 0.3, 'bolla', { tono: 0.8, vol: 0.5 }); add(E.bus + 0.25, 'tasto', { vol: 0.5 }); add(E.stregata + 0.2, 'vento', { dur: 0.8, vol: 0.45 });
  add(E.razzo + 0.15, 'riser', { dur: 0.9, vol: 0.6 }); add(E.razzo + 1.05, 'fuoco', { vol: 0.6 });
  add(E.quindici - 0.15, 'whoosh', { dur: 0.5, giu: true });
  C.vit.lotti.forEach((m, k) => add(E.quindici + 0.1 + k * 0.06, 'pop', { tono: 0.9 + (k % 5) * 0.08, vol: 0.4 }));
  add(E.uno - 0.05, 'stamp'); add(E.uno, 'ding', { tono: 1.3 });
  add(E.citta_castello - 0.15, 'whoosh', { dur: 0.4, vol: 0.6 }); add(E.citta_castello + 0.15, 'campana', { vol: 0.5, tono: 0.9 });
  add(E.preso - 0.25, 'silenzio', { dur: 0.23 }); add(E.preso, 'errore', { vol: 0.7 }); add(E.preso + 0.05, 'stamp');
  // loja
  add(E.prova - 0.1, 'whoosh', { dur: 0.3, vol: 0.6 });
  C.toques.forEach((x, k) => { add(x.t, 'tap', { vol: 0.7 }); add(x.t + 0.03, 'pop', { tono: 1 + k * 0.1, vol: 0.6 }); add(x.t + 0.06, 'scintilla', { vol: 0.35 }); });
  add(E.ama, 'bolla', { tono: 1.4, vol: 0.7 }); add(E.ama + 0.05, 'scintilla', { vol: 0.5 });
  add(E.prezzo, 'coin', { vol: 0.9 }); add(E.prezzo + 0.35, 'stamp'); add(E.prezzo + 0.38, 'ding', { tono: 1.2 });
  add(E.paese, 'whoosh', { dur: E.dieci - E.paese, giu: false, vol: 0.7 }); add(E.dieci, 'notifica', { tono: 1.15 }); add(E.dieci + 0.03, 'stamp', { vol: 0.6 });
  add(E.regalo - 0.15, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.regalo + 0.1, 'campana', { tono: 1.5, vol: 0.5 }); add(E.amico, 'bolla', { tono: 1.2, vol: 0.6 });
  add(E.solo, 'stamp'); add(E.solo + 0.02, 'tap', { vol: 0.5 }); add(E.punti, 'stamp'); add(E.punti + 0.02, 'errore', { vol: 0.35 });
  add(E.vince, 'stamp'); add(E.vince + 0.03, 'ding', { tono: 1.3 }); add(E.vince + 0.05, 'scintilla', { vol: 0.6 });
  // fim
  add(E.diecimila - 0.15, 'whoosh', { dur: 0.4, vol: 0.6 });
  for (let t = E.diecimila + 0.2; t < E.diecimila + 1.6; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1 + (t - E.diecimila) * 0.35 });
  add(E.diecimila + 1.6, 'ding', { tono: 1.3 });
  add(E.cta - 0.3, 'silenzio', { dur: 0.28 }); add(E.cta, 'ding', { tono: 1.2 }); add(E.cta + 0.02, 'boom', { vol: 0.35 }); add(E.cta2, 'pop', { tono: 1.1 }); add(E.cta2 + 0.05, 'scintilla', { vol: 0.5 });
  add(E.quale, 'whoosh', { dur: 0.3, vol: 0.5 });
  SPECIALI.forEach((_, k) => add(E.quale + 0.25 + k * 0.08, 'pop', { tono: 0.9 + (k % 5) * 0.1, vol: 0.4 }));
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
  citta = new Citta(mappa, D);
  cena = {};
  const C = cena;
  C.trecho = [Date.parse(R.inizio), Date.parse(D.snap.dati_fino), E.oggi + 0.05, E.case_fim];
  C.tsCase = D.casas.map(c => c.ts).sort((a, b) => a - b);
  const cnt = D.snap.contatori;
  C.nCase = D.casas.length; C.nCitta = D.luoghi.length; C.nCommenti = cnt.commenti; C.nFollower = cnt.follower;
  C.pontos = criarPontos();
  C.vit = criarVitrine();
  C.animadas = [];
  const nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };

  // London: casas para cada detalhe (níveis baixos, onde porta, telhado e jardim aparecem)
  const londra = [...D.luoghi].sort((a, b) => b.case - a.case)[0];
  C.londra = londra;
  const casasL = londra.casas.map(i => D.casas[i]).filter(c => c.livello >= 1 && c.livello <= 6);
  const asp = c => aspetto(c.conta, c.livello), usados = new Set();
  const achar = f => { const c = casasL.find(x => !usados.has(x.conta) && f(asp(x), x)) ?? casasL.find(x => !usados.has(x.conta)); usados.add(c.conta); return c; };
  C.fila = achar(() => true);
  C.cPorte = achar(a => Math.floor(a.v / 3) % 4 >= 2);
  C.cTetti = achar(a => Math.floor(a.v / 12) % 2 === 1);
  C.cFiori = achar(a => a.fiori);
  const comOrn = id => { const c = achar(a => a.orn.some(o => o.id === id)); return { ...posOrn(c, asp(c).orn.find(o => o.id === id) ?? asp(c).orn[0] ?? { x: 0, z: 0.35 }), rot: posLote(c.lote).rot }; };
  C.oGnomo = comOrn('gnomo'); C.oBici = comOrn('bici'); C.oStend = comOrn('stendino');
  const topoCasa = c => () => { const p = citta.posCasa(c); return projetar(p.x, p.y + ALTURA_NIVEL[c.livello] * LOTE * 1.05, p.z); };
  const topoOrn = (o, h = 0.012) => () => projetar(o.x, o.y + h, o.z);
  const bate = (t0) => t => 1 + 0.1 * Math.exp(-Math.max(0, t - t0 - 0.3) / 0.15) * (t >= t0 + 0.3);
  C.cartoes = [
    { el: cartao('🚪 New doors', ''), p: topoCasa(C.cPorte), ini: E.porte + 0.1, fim: E.tetti },
    { el: cartao('🏠 New roofs', 'SLATE · CLAY · THATCH'), p: topoCasa(C.cTetti), ini: E.tetti + 0.1, fim: E.fiori },
    { el: cartao('🌸 Window boxes', ''), p: topoCasa(C.cFiori), ini: E.fiori + 0.1, fim: E.gnomi },
    { el: cartao('🧙 Gnomes', ''), p: topoOrn(C.oGnomo), ini: E.gnomi + 0.1, fim: E.bici },
    { el: cartao('🚲 Bikes', ''), p: topoOrn(C.oBici), ini: E.bici + 0.1, fim: E.stendino - 0.6 },
    { el: cartao('👕 Washing line', ''), p: topoOrn(C.oStend, 0.008), ini: E.stendino - 0.5, fim: E.british },
  ];
  // vitrine: um cartão por casa rara no momento dela; o moinho ganha "it actually turns"
  const ids = ['faro', 'castello', 'mulino', 'barca', 'bus', 'stregata', 'razzo'];
  ids.forEach((id, k) => {
    const m = porId(id), fim = k < ids.length - 1 ? E[ids[k + 1]] : E.quindici;
    const el = cartao(`${m.em} ${esc(m.nome)}`, id === 'mulino' ? '&nbsp;' : '', 'oro');
    C.cartoes.push({ el, p: () => projetar(m.x, m.y + m.h * LOTE * 1.02, m.z), ini: E[id] + 0.08, fim, extra: id === 'mulino' ? (t => { el.querySelector('small').textContent = t >= E.gira ? 'IT ACTUALLY TURNS 🌀' : ' '; return 1 + 0.1 * Math.exp(-Math.max(0, t - E.gira) / 0.15) * (t >= E.gira); }) : null });
  });
  C.vit.lotti.forEach((m, k) => C.cartoes.push({ el: cartao(m.em, ''), p: () => projetar(m.x, m.y + m.h * LOTE * 1.02, m.z), ini: E.quindici + 0.1 + k * 0.06, fim: E.citta_castello - 0.02 }));

  // cidade de verdade (England, 30 a 60 casas): o castelo de alguém, a loja, o presente
  const tw = D.luoghi.filter(l => l.regione.cod === 'ENG' && l.case >= 30 && l.case <= 60).sort((a, b) => a.fondatore_ts - b.fondatore_ts)[0];
  C.paese = tw;
  const casasT = tw.casas.map(i => D.casas[i]).filter(c => c.livello <= 5).sort((a, b) => a.lote - b.lote);
  [C.cA, C.cB, C.cC, C.cD] = [casasT[1], casasT[4], casasT[6], casasT[9] ?? casasT[3]];
  for (const c of [C.cA, C.cC]) tirarDaCidade(c);
  citta.dadosCidade(tw);
  const castello = rara('castello', 0, 0, 0); naCasa(C.cA, castello.g); C.castello = castello; C.animadas.push(castello);
  const stile = stileRegione(tw.regione.cod, tw.comune.sigla);
  const normale = naCasa(C.cC, new THREE.Mesh(geometriaCasa(C.cC.livello, aspetto(C.cC.conta, C.cC.livello).v, stile), citta.mat));
  const PROVA = ['mulino', 'faro', 'albero', 'razzo'];
  C.prova = { normale, modelli: PROVA.map(id => { const m = rara(id, 0, 0, 0); naCasa(C.cC, m.g); m.g.visible = false; C.animadas.push(m); return m; }) };
  // k = botão na loja (índice em SPECIALI); i = modelo que aparece na casa
  C.toques = PROVA.map((id, i) => ({ t: E.prova + 0.4 + i * ((E.ama - E.prova - 0.55) / PROVA.length), k: SPECIALI.findIndex(s => s.id === id), i }));
  $('#negozio .grid').innerHTML = SPECIALI.map(s => `<div class="bt"><span class="em">${s.em}</span><b>${esc(s.nome)}</b></div>`).join('');
  // a casa mostrada durante a loja: nome e o modelo do toque
  const elProva = cartao('@your.name', '&nbsp;', 'rosa');
  C.cartoes.push({ el: elProva, p: () => { const p = citta.posCasa(C.cC), m = C.toques.filter(x => cena.tAtual >= x.t).pop(); return projetar(p.x, p.y + (m ? C.prova.modelli[m.i].h : ALTURA_NIVEL[C.cC.livello]) * LOTE * 1.02, p.z); }, ini: E.prova + 0.3, fim: E.paese - 0.1,
    extra: t => { const m = C.toques.filter(x => t >= x.t).pop(); elProva.querySelector('small').textContent = m ? `${SPECIALI[m.k].em} ${SPECIALI[m.k].nome.toUpperCase()}` : 'TAP TO PREVIEW'; return 1; } });
  // castelo da cidade: dono e "taken"
  C.cartoes.push({ el: cartao('🏰 @first.in.town', `${esc(tw.nome.toUpperCase())}'S CASTLE`, 'oro'), p: () => { const p = citta.posCasa(C.cA); return projetar(p.x, p.y + castello.h * LOTE * 1.02, p.z); }, ini: E.citta_castello + 0.25, fim: E.prova });
  C.cartoes.push({ el: cartao('🔒 Castle taken', 'PICK ANOTHER ONE', 'rosa'), p: topoCasa(C.cB), ini: E.preso + 0.05, fim: E.prova, extra: bate(E.preso - 0.3) });
  // toda a UK vê: o ponto da casa no mapa
  const ult = SPECIALI[C.toques.at(-1).k];
  C.cartoes.push({ el: cartao('✨ @your.name', `${ult.em} ${esc(ult.nome.toUpperCase())}`, 'oro'), p: () => { const p = citta.posCasa(C.cC); return projetar(p.x, p.y + 0.004, p.z); }, ini: E.paese + 0.6, fim: E.regalo - 0.05 });
  // presente: corações na casa do amigo
  const hD = ALTURA_NIVEL[C.cD.livello];
  C.cuori = naCasa(C.cD, cuori(hD)); C.cuori.visible = false; C.animadas.push({ anima: t => C.cuori.userData.anima(t) });
  C.cartoes.push({ el: cartao('@your.mate', '🎁 FROM @YOU', 'rosa'), p: () => { const p = citta.posCasa(C.cD); return projetar(p.x, p.y + (hD + 0.9) * LOTE, p.z); }, ini: E.regalo + 0.15, fim: E.solo, extra: bate(E.amico - 0.3) });

  C.timbri = [
    timbro('🚀 Blowing up!', '#E0473C', 830, E.boom, E.so),
    timbro('✅ Free upgrade', '#2FB36A', 300, E.gratis, E.unica),
    timbro('✨ One of a kind', '#1E5AA8', 300, E.unica2, E.porte),
    timbro('☕ Proper British', '#1F3A6B', 300, E.british + 0.05, E.big),
    timbro('☝️ Only 1 per town', '#E0473C', 300, E.uno, E.citta_castello),
    timbro('💨 Gone!', '#E0473C', 300, E.preso, E.prova, 4),
    timbro('✨ Looks only', '#1E5AA8', 330, E.solo, E.diecimila),
    timbro('🚫 No points', '#E0473C', 520, E.punti, E.diecimila, 3),
    timbro('🏆 Players always win', '#2FB36A', 710, E.vince, E.diecimila, -4, 64),
  ];
  // comentários chovendo: as maiores cidades, no formato certo
  const big = [...D.luoghi].sort((a, b) => b.case - a.case).slice(0, 9), pos = [[70, 760, -4], [470, 860, 3], [130, 980, 2], [520, 1090, -3], [60, 1200, 3], [440, 1300, -2], [150, 700, 2], [560, 1180, 4], [90, 1080, -2]];
  C.bolle = big.map((l, k) => {
    const el = document.createElement('div');
    el.className = 'bolla';
    el.innerHTML = `<i></i><b>${esc(l.nome.replace(' upon Tyne', ''))}, ${esc(nomes[l.regione.cod])}</b><em>✓</em>`;
    $('#bolle').appendChild(el);
    return { el, t: E.commenti + 0.05 + k * 0.2, x: pos[k][0], y: pos[k][1], rot: pos[k][2] };
  });
  $('#quale .grid').innerHTML = SPECIALI.map(s => `<div class="em">${s.em}</div>`).join('');
  $('#banner').innerHTML = R.banner.map((l, k) => `<div${k ? ' class="g"' : ''}>${esc(l)}</div>`).join('');
  C.impatti = [[E.case_fim, 0.6], [E.boom, 1.3], [E.gratis, 0.4], [E.british, 0.4], [E.rare, 1.3], ...ids.map(id => [E[id], 0.25]), [E.uno, 0.5], [E.preso, 0.6],
    [E.prezzo + 0.35, 0.6], [E.dieci, 0.4], [E.solo, 0.3], [E.punti, 0.3], [E.vince, 0.5], [E.cta, 0.5]];
  C.flash = [[E.oggi, 0.5], [E.boom, 1], [E.so, 0.5], [E.british, 0.5], [E.rare, 1], ...ids.map(id => [E[id], 0.45]), [E.quindici, 0.6], [E.citta_castello, 0.6], [E.prova, 0.4], [E.prezzo, 0.5], [E.regalo, 0.6], [E.diecimila, 0.6], [E.cta, 0.3], [E.quale, 0.3]];
  montarChaves();
  if (R.copertina) {
    const cp = R.copertina, el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    for (const s of cp.nascondi ?? []) $(s).style.visibility = 'hidden';
  }
  console.log(`casas ${C.nCase} · cidades ${C.nCitta} · comentários ${C.nCommenti} · seguidores ${C.nFollower} · London ${londra.case} · cidade ${tw.nome} (${tw.case}) · vitrine ${C.vit.x.toFixed(1)},${C.vit.z.toFixed(1)}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
