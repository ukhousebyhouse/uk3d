// Reel 3 "How to win" com dados reais: a casa sobe a escada de níveis, +5 / +3 / +25 (comentar, marcar, amigo que entra),
// "Manchester, England" vira casa, uma cidade de demonstração desbloqueia cabine, lago, chippy e o pub (nome votado)
// e a Grande Eleição de 29/11 com o líder de agora em cada nação.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, QH, posLote } from '../js/citta.js';
import { ALTURA_NIVEL, geometriaCasa, geometriaEspecial, stileRegione } from '../js/modelli.js';
import { REGOLE, livelloDi, num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pulso = (t, lista, dec) => lista.reduce((s, [ti, f]) => s + (t >= ti ? f * Math.exp(-(t - ti) / dec) : 0), 0);
let semente = 7;
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
// lugar no campo, longe de qualquer cidade com casas (a cena não pode encostar numa cidade de verdade)
const acharLugar = cands => cands.map(([la, lo]) => mundo(la, lo)).find(p => D.luoghi.every(l => Math.hypot(l.x - p.x, l.z - p.z) > 6) && mappa.altura(p.x, p.z) > 0.02) ?? mundo(...cands[0]);

// ---------- 3D ----------
function criarNazioni() {
  const cods = ['ENG', 'SCT', 'WLS', 'NIR'], n = D.comuni.length;
  const pos = new Float32Array(n * 3), naz = new Float32Array(n);
  D.comuni.forEach((c, i) => { pos.set([c.x, mappa.altura(c.x, c.z) + 0.04, c.z], i * 3); naz[i] = Math.max(0, cods.indexOf(c.reg)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { luce: { value: [0, 0, 0, 0] }, cor: { value: cods.map(k => new THREE.Color(NAZIONI[k].cor)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float naz; uniform float luce[4]; uniform vec3 cor[4]; uniform float escala;
      varying vec3 vCor; varying float vA;
      void main() {
        int k = int(naz + 0.5);
        float l = luce[k];
        vCor = mix(vec3(1.0), cor[k], clamp(l * 1.4, 0.0, 1.0));
        vA = l;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(2.2 * escala / -mv.z, 3.0, 9.0) * (1.0 + 0.5 * l);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0 || vA < 0.01) discard;
        gl_FragColor = vec4(vCor, min(1.0, vA) * (1.0 - smoothstep(0.7, 1.0, d)));
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = 6;
  p.visible = false;
  mappa.scene.add(p);
  return p;
}

// clareira no campo: a casa "@your.name" em todos os níveis (um mesh por nível) e a casa do amigo ao lado
function criarDiorama() {
  const C = acharLugar([[54.0, -1.3], [53.75, -0.6], [52.9, -0.55], [52.5, -2.6]]), g = new THREE.Group();
  let chao = -Infinity;
  for (let a = -0.4; a <= 0.4; a += 0.1) for (let b = -0.4; b <= 0.4; b += 0.1) chao = Math.max(chao, mappa.altura(C.x + a, C.z + b));
  chao += 0.002;
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1.4, 80), new THREE.MeshLambertMaterial({ color: '#8FC064' }));
  disco.rotation.x = -Math.PI / 2;
  disco.position.set(C.x, chao, C.z);
  g.add(disco);
  for (const dx of [0, LOTE * 1.25]) {
    const lote = new THREE.Mesh(new THREE.PlaneGeometry(LOTE * 1.15, LOTE * 1.3), new THREE.MeshLambertMaterial({ color: '#C9C2B2' }));
    lote.rotation.x = -Math.PI / 2;
    lote.position.set(C.x + dx, chao + 0.0004, C.z);
    g.add(lote);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  for (const [tipo, n] of [['quercia', 300], ['betulla', 130], ['abete', 80]]) {
    const im = new THREE.InstancedMesh(geometriaEspecial(tipo), new THREE.MeshLambertMaterial({ vertexColors: true }), n);
    for (let i = 0; i < n; i++) {
      const r = 0.11 + Math.pow(rnd(), 0.8) * 1.2, a = rnd() * Math.PI * 2, e = LOTE * (0.9 + rnd() * 0.7);
      m4.compose(v.set(C.x + Math.cos(a) * r, chao, C.z + Math.sin(a) * r), q.setFromAxisAngle(y, rnd() * 6.28), s.set(e, e, e));
      im.setMatrixAt(i, m4);
    }
    im.frustumCulled = false;
    g.add(im);
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const nova = (nivel, variante, dx) => {
    const m = new THREE.Mesh(geometriaCasa(nivel, variante, 'eng'), mat);
    m.position.set(C.x + dx, chao + 0.0008, C.z);
    m.scale.setScalar(LOTE);
    m.visible = false;
    g.add(m);
    return m;
  };
  const casas = REGOLE.livelli.map((_, k) => nova(k, 1, 0));
  const amico = nova(0, 2, LOTE * 1.25);
  g.visible = false;
  mappa.scene.add(g);
  return { g, casas, amico, x: C.x, z: C.z, y: chao };
}

// cidade de demonstração: entra em D.luoghi como uma cidade normal e cresce de 1 a 30 casas (Citta desenha os desbloqueios)
function criarCittaDemo() {
  const T = acharLugar([[52.95, -0.55], [52.6, -0.25], [53.3, -0.95], [52.3, -1.05], [51.4, -1.6]]);
  const id = D.luoghi.length, comune = { istat: 'reel-your-town', nome: 'Your Town', sigla: '', reg: 'ENG', x: T.x, z: T.z, pop: 0, rango: 0, bil: '' };
  const l = { id, comune, nome: 'Your Town', x: T.x, z: T.z, case: 0, lotti: 0, fondatore: 'your.name', fondatore_ts: 0, casas: [], regione: D.regPorCod.get('ENG'), pub: [] };
  comune.luogo = l;
  D.luoghi.push(l);
  const NIV = [1, 0, 2, 1, 3, 0, 2, 4, 1, 5, 0, 2, 3, 1, 6, 0, 2, 1, 4, 3];
  const idx = Array.from({ length: 32 }, (_, k) => {
    const i = D.casas.length;
    D.casas.push({ i, conta: `your.town.${k}`, luogo: id, lote: k, ts: 0, tot: 0, sett: 0, fiamme: 0, fonti: [0, 0, 0, 0, 0, 0, 0, 0, 0], serie: 0, livello: NIV[k % NIV.length], carica: null });
    return i;
  });
  return { l, idx, x: T.x, z: T.z, n: -1, pub: '' };
}
function impostaCitta(n, pub) {
  const c = cena.demo, k = JSON.stringify(pub);
  if (c.n === n && c.pub === k) return;
  Object.assign(c.l, { case: n, lotti: n, casas: c.idx.slice(0, n), pub });
  delete c.l._raio;
  citta.cache.delete(c.l.id);
  c.n = n; c.pub = k;
  citta.atualizar(true);
}

// ---------- câmera: chaves (t, { x, z, dist, az, el?, giu?, cut? }) ----------
function montarChaves() {
  const v = D.geo.vista, dP = mappa.distPais(), C = cena;
  const UK = { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: dP, az: 0, el: null, giu: 0 };
  const DI = { x: C.dio.x, z: C.dio.z, el: 28, giu: 0.1 }, TW = (dx, dz) => ({ x: C.demo.x + dx, z: C.demo.z + dz, giu: 0 });
  const ap = C.apertura.casa, man = C.manc;
  const lista = [
    [0, { ...UK, dist: dP * 2.6, az: -0.5, el: 88 }],
    [0.85, { ...UK, dist: dP * 1.02 }],
    [E.mappa - 0.4, { ...UK, dist: dP * 0.96 }],
    [E.mappa + 0.75, { x: ap.x, z: ap.z, dist: 0.62, az: 0.45, el: null, giu: 0.1 }],
    [E.vinci - 0.1, { dist: 0.5, az: 0.75 }],
    [E.punto - 0.02, { dist: 0.75, az: 1.05 }],
    [E.punto, { ...DI, dist: 0.36, az: 0.3, cut: true }],
    [E.scala, { dist: 0.42, az: 0.55 }],
    [E.palazzo + 0.1, { dist: 0.6, az: 0.85, el: 24 }],
    [E.c5 - 0.02, { dist: 0.66, az: 0.95 }],
    [E.c5, { ...DI, x: DI.x + LOTE * 0.3, dist: 0.4, az: 0.2, el: 30, cut: true }],
    [E.tag - 0.02, { dist: 0.36, az: 0.45 }],
    [E.join - 0.25, { x: DI.x + LOTE * 0.62, dist: 0.46, az: 0.25 }],
    [E.veloce, { dist: 0.5, az: 0.5 }],
    [E.su, { dist: 0.62, az: 1.0, el: 22 }],
    [E.nocasa - 0.02, { dist: 0.7, az: 1.1 }],
    [E.nocasa, { ...UK, dist: dP * 1.06, cut: true }],
    [E.scrivi_da - 0.25, { ...UK, dist: dP * 0.98 }],
    [E.scrivi_a + 0.15, { x: man.x, z: man.z, dist: 0.5, az: 0.35, el: null, giu: 0.06 }],
    [E.citta - 0.02, { dist: 0.44, az: 0.5 }],
    [E.citta, { ...TW(0, -0.03), dist: 1.35, az: 0.75, el: null, cut: true }],
    [E.su_citta + 0.6, { dist: 0.9, az: 0.45 }],
    [E.tre, { ...TW(-0.06, -0.02), dist: 0.5, az: 0.55, el: 32 }],
    [E.cabina + 0.4, { dist: 0.36, az: 0.35 }],
    [E.dieci, { ...TW(0.03, 0.0), dist: 0.55, az: 0.15, el: 34 }],
    [E.stagno + 0.4, { dist: 0.46, az: 0.0 }],
    [E.venti, { ...TW(0, -0.12), dist: 0.55, az: -0.1, el: 28 }],
    [E.chippy + 0.4, { dist: 0.44, az: 0.1 }],
    [E.trenta, { ...TW(0, -0.07), dist: 1.15, az: 0.35, el: null }],
    [E.pub - 0.35, { ...TW(0.04, -0.13), dist: 0.44, az: 0.15, el: 18 }],
    [E.nome + 0.5, { dist: 0.36, az: 0.05, el: 16 }],
    [E.grande - 0.02, { dist: 0.33, az: 0.0 }],
    [E.grande, { ...UK, dist: dP * 1.25, az: 0.25, cut: true }],
    [E.data, { ...UK, dist: dP * 1.05, az: 0.05 }],
    [E.nazioni, { ...UK, dist: dP * 0.98, az: 0 }],
    [E.vincitori + 0.5, { ...UK, dist: dP * 1.0 }],
    [R.durata, { ...UK, dist: dP * 0.94 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k]) => { const { cut, ...resto } = k; ant = { ...ant, ...resto }; return { t, k: { ...ant }, cut: !!cut }; });
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
  const el = l(elDe(A), elDe(B)) * Math.PI / 180, c = mappa.camera, al = mappa.alvo;
  c.position.set(al.x + Math.sin(az) * Math.cos(el) * dist, al.y + Math.sin(el) * dist, al.z + Math.cos(az) * Math.cos(el) * dist);
  const tr = pulso(t, cena.impatti, 0.12) * dist * 0.012;
  if (tr > 1e-6) c.position.add(new THREE.Vector3(Math.sin(t * 83) * tr, Math.cos(t * 71) * tr * 0.6, Math.sin(t * 97 + 1) * tr));
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
function cartao(titulo, sub, oro) {
  const el = document.createElement('div');
  el.className = 'etichetta';
  el.innerHTML = `<div class="card${oro ? ' oro' : ''}"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
// texto que digita entre a e b (o @ em azul) com cursor piscando
function digitar(el, t, txt, a, b) {
  const n = Math.round(clamp((t - a) / (b - a)) * txt.length), parte = esc(txt.slice(0, n)).replace(/(@[\w.]+)/g, '<span class="tag">$1</span>');
  const cursor = (t * 2.4) % 1 < 0.55 || (n > 0 && n < txt.length) ? '<span class="cursore"></span>' : '';
  el.innerHTML = parte + cursor;
}

// ---------- pontos da casa "@your.name" ----------
// escada: nível k em E.scala + k * passo; depois os pontos de verdade de cada ação
function estadoCasa(t) {
  const sc = R.scala, passo = (E.palazzo - E.scala) / (sc.length - 1);
  if (t < E.c5) {
    const k = t < E.scala ? 0 : Math.min(sc.length - 1, Math.floor((t - E.scala) / passo + 0.001));
    return { nivel: sc[k], pts: REGOLE.livelli[sc[k]].min, ti: k ? E.scala + k * passo : E.punto, ladder: true };
  }
  const passos = [[E.c5, 20], [E.piu5, 25], [E.piu3, 28], [E.piu25, 53]];
  let pts = 20, ti = E.c5;
  for (const [a, p] of passos) if (t >= a) { pts = p; ti = a; }
  if (t >= E.veloce) { const s = suave(fase(t, E.veloce + 0.2, E.su - E.veloce - 0.2)); pts = Math.round(53 + (150 - 53) * s); }
  const nivel = livelloDi(pts);
  // hora em que o nível atual começou (para o ressalto da casa)
  let tn = ti;
  if (t >= E.veloce) { for (let x = t; x > E.veloce; x -= 1 / 60) { const s = suave(fase(x, E.veloce + 0.2, E.su - E.veloce - 0.2)); if (livelloDi(Math.round(53 + 97 * s)) < nivel) { tn = x; break; } } }
  return { nivel, pts, ti: tn, ladder: false };
}
// casas da cidade de demonstração ao longo do tempo
function casasCitta(t) {
  if (t < E.su_citta) return 1;
  if (t < E.cabina) return 2;
  const seg = [[E.cabina, E.dieci, 3, 3], [E.dieci, E.stagno, 3, 10], [E.stagno, E.venti, 10, 10], [E.venti, E.chippy, 10, 20], [E.chippy, E.trenta, 20, 20], [E.trenta, E.pub - 0.95, 20, 30]];
  for (const [a, b, n0, n1] of seg) if (t < b) return Math.round(n0 + (n1 - n0) * clamp((t - a) / Math.max(0.01, b - a)));
  return 30;
}
function votiPub(t) {
  const P = R.pub_nomi, v1 = E.voto - 0.35, v2 = E.voto + 0.2, v3 = E.nome;
  if (t >= v3) return [[P[2], 3], [P[1], 2], [P[0], 1]];
  if (t >= v2) return [[P[1], 2], [P[0], 1]];
  if (t >= v1) return [[P[0], 1]];
  return [];
}

function quadro(t) {
  const dist = camera(t), C = cena;
  const dio = t >= E.punto && t < E.nocasa;
  C.dio.g.visible = dio;
  impostaCitta(casasCitta(t), votiPub(t));
  citta.grupo.visible = dist < 32 && !dio;

  // abertura: contador e as cidades pipocando
  const n = Math.round(C.totCase * suave(fase(t, 0.3, 2.4))), m = Math.round(C.totCitta * suave(fase(t, 0.3, 2.4)));
  $('#contatore').innerHTML = `<span class="g">${num(n)}</span> HOUSES · <span class="g">${num(m)}</span> TOWNS`;
  pop($('#testa'), t, 0.15, E.vinci - 0.05);
  const vistaUK = dist > 40;
  for (const p of C.pontos) {
    if (!vistaUK || t < p.ini || t >= E.vinci) { p.el.style.transform = 'scale(0)'; continue; }
    const q = projetar(p.x, p.y, p.z);
    p.el.style.left = `${q.x}px`; p.el.style.top = `${q.y}px`;
    p.el.style.transform = `scale(${ressalto(fase(t, p.ini, 0.3))})`;
  }
  const ap = C.apertura;
  presa(ap.el, t, projetar(ap.casa.x, ap.casa.y + ALTURA_NIVEL[ap.casa.livello] * LOTE + 0.004, ap.casa.z), E.mappa + 0.55, E.punto);

  // HOW TO WIN
  $('#scuro').style.opacity = String(0.4 * fase(t, E.vinci - 0.1, 0.2) * (1 - fase(t, E.punto - 0.15, 0.15))
    + 0.45 * fase(t, E.grande - 0.05, 0.25) * (1 - fase(t, E.nazioni - 0.2, 0.4))
    + 0.3 * fase(t, E.cta1 - 0.2, 0.3));
  pop($('#titolo'), t, E.vinci, E.punto, { base: `rotate(${-5 + 5 * suave(fase(t, E.vinci, 0.4))}deg)` });

  // a casa e os níveis
  const st = estadoCasa(t);
  C.dio.casas.forEach((mh, k) => {
    mh.visible = dio && k === st.nivel;
    if (mh.visible) { const s = ressalto(fase(t, st.ti, 0.28)); mh.scale.set(LOTE * (1 + 0.25 * (1 - s)), LOTE * Math.max(0.05, s), LOTE * (1 + 0.25 * (1 - s))); }
  });
  const am = C.dio.amico;
  am.visible = dio && t >= E.join;
  if (am.visible) { const s = ressalto(fase(t, E.join, 0.3)); am.scale.set(LOTE, LOTE * Math.max(0.05, s), LOTE); }
  const lv = $('#livello');
  if (pop(lv, t, E.punto + 0.15, E.nocasa - 0.02)) {
    const nome = REGOLE.livelli[st.nivel].nome, k = `${nome}|${st.pts}`;
    if (lv.dataset.k !== k) { lv.dataset.k = k; lv.querySelector('b').textContent = nome; lv.querySelector('i').textContent = `${num(st.pts)} PTS`; }
    lv.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-Math.max(0, t - st.ti) / 0.15)})`;
  }
  // escada à esquerda durante "from a tiny cottage... all the way to a palace"
  const sc = $('#scala');
  if (pop(sc, t, E.cottage - 0.2, E.c5 - 0.05, { base: 'translate(0,0)' })) {
    [...sc.children].forEach((d, k) => { d.className = k < st.nivel ? 'on' : k === st.nivel ? 'ora' : ''; d.style.transform = k === st.nivel ? `scale(${1 + 0.15 * Math.exp(-Math.max(0, t - st.ti) / 0.12)})` : ''; });
  }
  pop($('#veloce'), t, E.su - 0.05, E.nocasa, { base: 'rotate(-6deg)' });
  // +5 / +3 / +25 voando para a casa
  const alvoCasa = projetar(C.dio.x, C.dio.y + ALTURA_NIVEL[st.nivel] * LOTE * 0.6, C.dio.z);
  C.piu.forEach(p => {
    const vis = dio && t >= p.t && t < p.t + 1.05, el = p.el;
    el.style.opacity = vis ? String(1 - fase(t, p.t + 0.8, 0.25)) : '0';
    if (!vis) return;
    const s = fase(t, p.t + 0.45, 0.5), x = p.x + (alvoCasa.x - p.x) * suave(s), y = p.y + (alvoCasa.y - p.y) * suave(s);
    el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px) scale(${ressalto(fase(t, p.t, 0.3)) * (1 - 0.6 * suave(s))}) rotate(${p.rot}deg)`;
  });
  // comentários: "Love this map", "@your.mate look!", "Manchester, England"
  const cm = $('#commento'), tx = cm.querySelector('.testo'), ok = cm.querySelector('.ok');
  let okT = Infinity;
  if (t < E.nocasa) {
    if (pop(cm, t, E.c5 + 0.05, E.join - 0.15)) {
      if (t < E.tag) digitar(tx, t, R.commenti.post, E.c5 + 0.25, E.c5 + 1.15);
      else digitar(tx, t, R.commenti.tag, E.tag + 0.05, E.tag + 0.75);
      okT = t < E.tag ? E.piu5 - 0.05 : E.piu3 - 0.05;
      if (t >= E.tag && t < E.tag + 0.2) cm.style.transform += ` translateY(${-20 * (1 - fase(t, E.tag, 0.2))}px)`;
    }
  } else if (pop(cm, t, E.scrivi + 0.1, E.citta - 0.05)) {
    digitar(tx, t, R.commenti.citta, E.scrivi_da, E.scrivi_a);
    okT = E.scrivi_a + 0.08;
  }
  ok.style.transform = `scale(${t >= okT ? ressalto(fase(t, okT, 0.3)) : 0})`;
  // amigo que entrou
  presa(C.amicoEl, t, projetar(C.dio.x + LOTE * 1.25, C.dio.y + ALTURA_NIVEL[0] * LOTE + 0.004, C.dio.z), E.join + 0.15, E.veloce + 0.1);

  // "No house yet?" e a casa nova em Manchester
  pop($('#nocasa'), t, E.nocasa, E.scrivi + 0.1, { base: 'rotate(-3deg)' });
  const mc = C.manc;
  mc.mesh.visible = t >= E.scrivi_a + 0.08 && t < E.citta;
  if (mc.mesh.visible) { const s = ressalto(fase(t, E.scrivi_a + 0.08, 0.3)); mc.mesh.scale.set(LOTE, LOTE * Math.max(0.05, s), LOTE); }
  presa(mc.el, t, projetar(mc.x, mc.y + ALTURA_NIVEL[0] * LOTE + 0.004, mc.z), E.scrivi_a + 0.2, E.citta);

  // a cidade sobe de nível: contador de casas, barra até o próximo desbloqueio e o desbloqueio da vez
  const nc = casasCitta(t), prox = REGOLE.traguardi.find(x => x.case > nc), ant = [...REGOLE.traguardi].reverse().find(x => x.case <= nc);
  const ce = $('#casette');
  if (pop(ce, t, E.citta + 0.15, E.grande - 0.02)) {
    ce.querySelector('b').innerHTML = `🏠 <span>${nc}</span> ${nc === 1 ? 'HOUSE' : 'HOUSES'}`;
    const a0 = ant?.case ?? 0;
    ce.querySelector('.barra i').style.width = `${prox ? Math.round(100 * (nc - a0) / (prox.case - a0)) : 100}%`;
    ce.querySelector('small').textContent = prox ? `NEXT: ${prox.emoji} ${prox.nome.toUpperCase()} AT ${prox.case}` : '';
    const ult = Math.max(...C.marcos.filter(x => t >= x.t).map(x => x.t), -9);
    ce.querySelector('.carta').style.transform = `scale(${1 + 0.1 * Math.exp(-Math.max(0, t - ult) / 0.12)})`;
  }
  const sb = $('#sblocco'), so = C.sblocchi.filter(x => t >= x.t).pop();
  if (so && t < so.fim) {
    if (sb.dataset.k !== so.id) { sb.dataset.k = so.id; sb.querySelector('b').textContent = so.txt; }
    pop(sb, t, so.t, so.fim, { base: 'rotate(-2deg)' });
  } else sb.style.opacity = '0';
  C.voti.forEach((b, k) => {
    const s = pop(b.el, t, b.t, E.grande - 0.05, { base: `translate(${b.x}px, ${b.y - 30 * fase(t, b.t, 2)}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateX(${Math.sin(t * 2.4 + k) * 5}px)`;
  });

  // a Grande Eleição
  pop($('#grande'), t, E.big - 0.05, E.data - 0.02, { base: `rotate(${-6 + 6 * suave(fase(t, E.big, 0.3))}deg)` });
  const cal = $('#calendario');
  if (pop(cal, t, E.data, E.nazioni - 0.05)) {
    const gi = cal.querySelector('.giorno'), me = cal.querySelector('.mese'), or = cal.querySelector('.ora');
    gi.style.transform = `scale(${t >= E.data + 0.55 ? ressalto(fase(t, E.data + 0.55, 0.3)) : 0})`;
    me.style.transform = `scale(${t >= E.nov ? ressalto(fase(t, E.nov, 0.3)) : 0})`;
    or.style.transform = `scale(${t >= E.nove ? ressalto(fase(t, E.nove, 0.3)) : 0}) rotate(-4deg)`;
  }
  const U = C.nazioni.material.uniforms;
  C.nazioni.visible = t >= E.nazioni - 0.1;
  C.naz.forEach((nz, k) => {
    const acc = E.nazioni + 0.1 + k * 0.32;
    U.luce.value[k] = fase(t, acc, 0.3) * (1 + 0.6 * Math.exp(-Math.max(0, t - nz.t) / 0.25) * (t >= nz.t)) * (1 - 0.45 * fase(t, E.cta1 - 0.2, 0.4));
    presa(nz.el, t, projetar(nz.x, 0.5, nz.z), nz.t, E.cta1 + 0.1);
  });
  pop($('#fm'), t, E.fm - 0.05, E.n_eng - 0.05, { base: 'rotate(-4deg)' });
  pop($('#vincitori'), t, E.vincitori, E.cta1 - 0.02, { base: 'rotate(-3deg)' });

  // banner final, linha a linha
  const bn = $('#banner');
  bn.style.opacity = t >= E.cta1 ? '1' : '0';
  [...bn.children].forEach((d, k) => {
    const ti = [E.cta1, E.cta2, E.cta3 - 0.3][k], s = t >= ti ? ressalto(fase(t, ti, 0.32)) : 0;
    d.style.opacity = s > 0 ? '1' : '0';
    d.style.transform = `scale(${s}) rotate(${k % 2 ? 2 : -2}deg)`;
  });

  legenda(t);
  // legenda desce quando o meio da tela está ocupado (comentário, nações)
  $('#sott').style.top = (t >= E.nazioni && t < E.cta1) ? '1700px' : (t >= E.voto - 0.5 && t < E.grande) ? '1420px' :(t >= E.c5 && t < E.join) || (t >= E.scrivi && t < E.citta) ? '1250px' : '';
  $('#mappa').style.transform = R.copertina ? '' : `scale(${1 + 0.05 * pulso(t, C.impatti, 0.16)})`;
  $('#flash').style.opacity = R.copertina ? '0' : String(clamp(pulso(t, C.flash, 0.09) * 0.55));
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// ---------- efeitos sonoros (strumenti/suoni.mjs sintetiza cada um) ----------
function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'whoosh', { dur: 0.9, giu: true });
  add(0.85, 'boom', { vol: 0.4 });
  C.pontos.forEach(p => add(p.ini, 'pop', { vol: 0.22, tono: 0.85 + (p.k % 7) * 0.06 }));
  for (let t = 0.35; t < 2.7; t += 0.09) add(t, 'tick', { vol: 0.3, tono: 1 + 0.4 * t / 2.7 });
  add(E.mappa - 0.4, 'whoosh', { dur: 1.15, giu: true });
  add(E.mappa + 0.55, 'select');
  add(E.vinci - 0.6, 'riser', { dur: 0.6, vol: 0.5 });
  add(E.vinci, 'stamp'); add(E.vinci + 0.02, 'boom', { vol: 0.5 }); add(E.vinci + 0.08, 'scintilla', { vol: 0.6 });
  add(E.punto - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  add(E.punto + 0.05, 'pop', { tono: 0.8 }); add(E.punto + 0.15, 'select', { tono: 0.9 });
  add(E.cottage - 0.2, 'whoosh', { dur: 0.35, vol: 0.4 });
  const sc = R.scala, passo = (E.palazzo - E.scala) / (sc.length - 1);
  sc.forEach((_, k) => { if (k) add(E.scala + k * passo, k === sc.length - 1 ? 'stamp' : 'pop', { tono: 0.8 + k * 0.06, vol: 0.7 }); });
  add(E.palazzo + 0.02, 'boom', { vol: 0.5 }); add(E.palazzo + 0.05, 'scintilla'); add(E.palazzo + 0.08, 'ding', { tono: 1.3 });
  add(E.c5 - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  add(E.c5 + 0.05, 'notifica');
  const tasti = (txt, a, b) => [...txt].forEach((ch, k) => { if (ch !== ' ') add(a + (k + 0.5) * (b - a) / txt.length, 'tasto'); });
  tasti(R.commenti.post, E.c5 + 0.25, E.c5 + 1.15);
  tasti(R.commenti.tag, E.tag + 0.05, E.tag + 0.75);
  for (const p of C.piu) { add(p.t, 'pop', { tono: 1.1 }); add(p.t + 0.95, 'coin', { vol: p.grande ? 0.9 : 0.6 }); if (p.grande) add(p.t + 1.0, 'scintilla', { vol: 0.6 }); }
  add(E.join, 'pop', { tono: 0.75 }); add(E.join + 0.15, 'select', { tono: 1.2 });
  add(E.veloce, 'riser', { dur: E.su - E.veloce, vol: 0.45 });
  for (let t = E.veloce + 0.2; t < E.su - 0.05; t += 0.07) add(t, 'tick', { vol: 0.35, tono: 1 + 0.6 * (t - E.veloce) / (E.su - E.veloce) });
  add(E.su - 0.05, 'stamp'); add(E.su, 'boom', { vol: 0.45 });
  add(E.nocasa - 0.12, 'whoosh', { dur: 0.3, vol: 0.7 });
  add(E.nocasa, 'bolla', { tono: 0.8 });
  add(E.scrivi + 0.1, 'notifica', { tono: 1.1 });
  tasti(R.commenti.citta, E.scrivi_da, E.scrivi_a);
  add(E.scrivi_da - 0.25, 'whoosh', { dur: E.scrivi_a - E.scrivi_da + 0.4, giu: true, vol: 0.7 });
  add(E.scrivi_a + 0.08, 'ding', { tono: 1.2 }); add(E.scrivi_a + 0.1, 'pop', { tono: 0.8 }); add(E.scrivi_a + 0.2, 'coin', { vol: 0.6 });
  add(E.citta - 0.12, 'whoosh', { dur: 0.3, vol: 0.7 });
  add(E.citta + 0.15, 'select');
  // cada casa nova da cidade: pop subindo de tom; cada desbloqueio: carimbo + ding
  let ant = 1;
  for (let t = E.citta; t < E.pub; t += 1 / 30) { const n = casasCitta(t); if (n > ant) { add(t, 'pop', { tono: 0.8 + n * 0.02, vol: 0.5 }); ant = n; } }
  for (const s of C.sblocchi) { add(s.t, 'stamp', { vol: 0.8 }); add(s.t + 0.04, 'ding', { tono: 1 + C.sblocchi.indexOf(s) * 0.12 }); add(s.t + 0.06, 'scintilla', { vol: 0.5 }); }
  for (const b of C.voti) { add(b.t, 'bolla', { tono: 1 + C.voti.indexOf(b) * 0.15 }); add(b.t + 0.05, 'flap', { vol: 0.6 }); }
  add(E.grande - 0.75, 'riser', { dur: 0.75, vol: 0.6 });
  add(E.grande, 'whoosh', { dur: 0.5, vol: 0.8 }); add(E.big - 0.03, 'boom', { vol: 0.7 }); add(E.big, 'stamp');
  add(E.data, 'flap'); add(E.data + 0.55, 'stamp'); add(E.nov, 'pop', { tono: 1.1 });
  add(E.data + 0.1, 'rullo', { dur: E.nove - E.data - 0.1, vol: 0.5 });
  add(E.nove, 'campana', { vol: 0.8 }); add(E.nove + 0.02, 'boom', { vol: 0.4 });
  add(E.nazioni - 0.1, 'whoosh', { dur: 0.6, vol: 0.6 });
  C.naz.forEach((nz, k) => { add(E.nazioni + 0.1 + k * 0.32, 'scintilla', { vol: 0.45, tono: 1 + k * 0.1 }); add(nz.t, 'pop', { tono: 0.9 + k * 0.1 }); add(nz.t + 0.03, 'ding', { vol: 0.45, tono: [1, 1.26, 1.5, 2][k] }); });
  add(E.fm - 0.5, 'riser', { dur: 0.5, vol: 0.5 });
  add(E.fm - 0.05, 'stamp'); add(E.fm, 'boom', { vol: 0.6 }); add(E.fm + 0.05, 'campana', { vol: 0.6, tono: 1.2 });
  add(E.vincitori, 'stamp'); add(E.vincitori + 0.05, 'scintilla');
  add(E.cta1 - 0.4, 'silenzio', { dur: 0.38 });
  add(E.cta1, 'ding', { tono: 1.2 }); add(E.cta1 + 0.02, 'boom', { vol: 0.3 });
  add(E.cta2, 'pop', { tono: 1.1 }); add(E.cta3 - 0.3, 'whoosh', { dur: 0.4, vol: 0.5 }); add(E.cta3, 'scintilla', { vol: 0.6 });
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
  // contagens e líderes só com as casas de verdade (antes da cidade de demonstração)
  cena = { totCase: D.casas.length, totCitta: D.luoghi.length };
  const C = cena, reais = [...D.casas];
  const lideres = {};
  for (const cod of ['ENG', 'SCT', 'WLS', 'NIR']) {
    lideres[cod] = reais.filter(c => D.luoghi[c.luogo].regione.cod === cod).map(c => ({ c, pts: c.tot - (c.fonti?.[8] ?? 0) }))
      .sort((a, b) => b.pts - a.pts || a.c.ts - b.c.ts)[0] ?? null;
  }
  citta = new Citta(mappa, D);
  C.dio = criarDiorama();
  C.demo = criarCittaDemo();
  C.nazioni = criarNazioni();
  // abertura: a casa do líder da England
  const ap = lideres.ENG.c, lap = D.luoghi[ap.luogo];
  citta.posCasa(ap);
  C.apertura = { casa: ap, el: cartao(`🏠 @${esc(ap.conta)}`, `${esc(lap.nome)}, England`, true) };
  // Manchester: a casa nova aparece no próximo lote livre
  const lm = D.luoghi.find(l => l.nome === R.esempio_citta), qm = posLote(lm.lotti), hc = citta.dadosCidade(lm).hc;
  const mesh = new THREE.Mesh(geometriaCasa(0, 0, stileRegione('ENG', lm.comune.sigla)), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(lm.x + qm.x, hc + 0.0009, lm.z + qm.z); mesh.rotation.y = qm.rot; mesh.scale.setScalar(LOTE); mesh.visible = false;
  mappa.scene.add(mesh);
  C.manc = { mesh, x: lm.x + qm.x, y: hc, z: lm.z + qm.z, el: cartao('🏠 YOUR HOUSE', `${esc(lm.nome)}, England`, true) };
  C.amicoEl = cartao('@your.mate', 'just joined!', false);
  // escada de níveis (de baixo para cima)
  $('#scala').innerHTML = R.scala.map(k => `<div>${esc(REGOLE.livelli[k].nome)}</div>`).join('');
  // +5 / +3 / +25
  C.piu = [[E.piu5, '+5', 'COMMENT 💬', 300, 760, -6], [E.piu3, '+3', 'TAG A MATE 👥', 780, 760, 5], [E.piu25, '+25', 'MATE JOINED 🏠', 540, 700, -3, true]].map(([t, n, txt, x, y, rot, grande]) => {
    const el = document.createElement('div');
    el.className = 'piu forte g';
    el.innerHTML = `${n}<small>${txt}</small>`;
    if (grande) el.style.fontSize = '190px';
    $('#piu').appendChild(el);
    return { t, el, x, y, rot, grande };
  });
  // desbloqueios da cidade (cartão amarelo) e os marcos do contador
  const tr = id => REGOLE.traguardi.find(x => x.id === id);
  C.sblocchi = [['cabina', E.cabina, E.dieci], ['stagno', E.stagno, E.venti], ['negozi', E.chippy, E.trenta], ['chiesa', E.pub - 0.95, E.voto - 0.4]]
    .map(([id, t, fim]) => ({ id, t, fim, txt: `${tr(id).emoji} ${id === 'chiesa' ? 'Your own pub' : id === 'negozi' ? 'A chippy' : tr(id).nome}` }));
  C.marcos = [{ t: E.cabina }, { t: E.stagno }, { t: E.chippy }, { t: E.pub - 0.95 }];
  // votos no nome do pub
  const vpos = [[60, 900, -4], [500, 1030, 3], [120, 1160, 2]], P = R.pub_nomi, tv = [E.voto - 0.35, E.voto + 0.2, E.nome];
  C.voti = P.map((i, k) => {
    const el = document.createElement('div');
    el.className = 'voto';
    el.innerHTML = `<i></i><b>pub ${esc(REGOLE.pub_nomi[i].replace(/^The /, ''))} 🗳️</b>`;
    $('#voti').appendChild(el);
    return { el, t: tv[k], x: vpos[k][0], y: vpos[k][1], rot: vpos[k][2] };
  });
  // as 4 nações com o líder de agora (Northern Ireland: símbolo neutro, sem bandeira)
  const box = $('#punti'), nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };
  C.naz = ['ENG', 'SCT', 'WLS', 'NIR'].map(cod => {
    const r = D.geo.regioni.find(x => x.cod === cod), el = document.createElement('div'), ld = lideres[cod];
    el.className = 'nazione';
    el.innerHTML = `<div class="nome" style="background:${NAZIONI[cod].cor}">${NAZIONI[cod].emoji} ${nomes[cod]}</div>`
      + (ld ? `<div class="capo"><small>LEADING NOW</small><b>@${esc(ld.c.conta)}</b><i>${num(ld.pts)} PTS</i></div>` : '<div class="capo"><small>LEADING NOW</small><b>YOU?</b></div>');
    box.appendChild(el);
    return { el, x: r.lx, z: r.lz, t: E[`n_${cod.toLowerCase()}`] };
  });
  // bolinhas das cidades fundadas, na ordem de fundação
  const ord = D.luoghi.filter(l => l !== C.demo.l).sort((a, b) => a.fondatore_ts - b.fondatore_ts);
  C.pontos = ord.map((l, k) => {
    const el = document.createElement('div');
    el.className = 'ponto';
    box.appendChild(el);
    return { el, k, x: l.x, y: mappa.altura(l.x, l.z) + 0.1, z: l.z, ini: 0.35 + 2.3 * k / Math.max(1, ord.length - 1) };
  });
  $('#banner').innerHTML = R.banner.map((l, k) => `<div${k === 1 ? ' class="g"' : ''}>${esc(l)}</div>`).join('');
  C.impatti = [[0.85, 0.5], [E.vinci, 1], [E.punto, 0.4], [E.palazzo, 0.9], [E.c5, 0.3], ...C.piu.map(p => [p.t + 0.95, p.grande ? 0.7 : 0.35]), [E.join, 0.4], [E.su, 0.8],
    [E.nocasa, 0.5], [E.scrivi_a + 0.08, 0.5], [E.citta, 0.4], ...C.sblocchi.map(s => [s.t, 0.6]), ...C.voti.map(v => [v.t, 0.2]),
    [E.big, 1], [E.data + 0.55, 0.5], [E.nove, 0.7], ...C.naz.map(n => [n.t, 0.3]), [E.fm, 0.9], [E.vincitori, 0.6], [E.cta1, 0.5]];
  C.flash = [[0.85, 0.6], [E.vinci, 0.4], [E.punto, 0.8], [E.palazzo, 0.7], [E.c5, 0.7], [E.nocasa, 0.8], [E.citta, 0.8], ...C.sblocchi.map(s => [s.t, 0.35]), [E.grande, 0.9], [E.fm, 0.5], [E.cta1, 0.4]];
  montarChaves();
  if (R.copertina) {
    const cp = R.copertina, el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    if (cp.giu) mappa.camera.setViewOffset(1080, 1920, 0, -cp.giu, 1080, 1920);
    for (const s of cp.nascondi ?? []) $(s).style.visibility = 'hidden';
  }
  console.log(`casas ${C.totCase} · cidades ${C.totCitta} · abertura @${ap.conta} (${lap.nome}) · líderes ${Object.entries(lideres).map(([k, v]) => `${k} @${v?.c.conta} ${v?.pts}`).join(' · ')}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
