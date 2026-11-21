// Casa decorada: cores de time, ouro, neon, coroa, fogos, cores da Union Jack... na própria casa ou de presente para um amigo.
// Ou uma casa rara (speciali.js): farol, castelo, moinho... só uma de cada por cidade ao mesmo tempo.
// Só estética. Desde 21/11 com créditos e PARA SEMPRE, sem pontos (data/proprieta.json, escrito pelo api/conto.php);
// as compras antigas em £ (data/decori.json, webhook da Stripe) continuam até vencer, com +50.
// Também: decorações automáticas do PM e dos Mayors, prêmios dos games, villa e castelo.
// Teste antes do lançamento: ?decora=1 mostra o botão mesmo com "decora.attivo": false em data/negozio.json.
import * as THREE from 'three';
import { geometriaCasa, ALTURA_NIVEL, stileRegione, aspetto, CORI_CASA } from './modelli.js';
import { SPECIALI, costruisciSpeciale, altezzaSpeciale } from './speciali.js';
import { LOTE, posLote } from './citta.js';
import { PERFIL } from './storie.js';
import { REGOLE } from './regole.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const variante = casa => aspetto(casa.conta, casa.livello).v;   // mesma variante que citta.js usa
const altezza = (casa, sel) => (sel.modello ? altezzaSpeciale(sel.modello) : ALTURA_NIVEL[casa.livello]);
const eur = cent => `£${(cent / 100).toFixed(2)}`;
const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const dataCurta = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

// cores das camisas (só as cores: nome e escudo dos clubes são marcas registradas)
// a lista igual está em api/decora.php
export const SQUADRE = [
  { id: 'reds', nome: 'Reds', muro: '#C8102E', tetto: '#F6F6F6' },
  { id: 'blues', nome: 'Blues', muro: '#034694', tetto: '#F6F6F6' },
  { id: 'skyblues', nome: 'Sky Blues', muro: '#6CABDD', tetto: '#F6F6F6' },
  { id: 'claret', nome: 'Claret & Blue', muro: '#7A263A', tetto: '#95BFE5' },
  { id: 'magpies', nome: 'Black & White', muro: '#F4F4F2', tetto: '#1C1C1C' },
  { id: 'amber', nome: 'Amber & Black', muro: '#FDB913', tetto: '#231F20' },
  { id: 'redblue', nome: 'Red & Blue', muro: '#C8102E', tetto: '#1B458F' },
  { id: 'tangerine', nome: 'Tangerine', muro: '#F68712', tetto: '#F6F6F6' },
  { id: 'greens', nome: 'Greens', muro: '#00965E', tetto: '#F6F6F6' },
];
const ORO = { muro: '#F2C230', tetto: '#C99A1E' };
// efeitos; regalo = pode ser dado de presente (só coisas positivas: cores de time e Union Jack ficam só para a própria casa)
// a lista igual está em api/decora.php
export const EFFETTI = [
  { id: 'oro', em: '✨', nome: 'Golden house', mia: true, regalo: true },
  { id: 'neon', em: '💡', nome: 'Neon', mia: true, regalo: true },
  { id: 'arcobaleno', em: '🌈', nome: 'Rainbow', mia: true, regalo: true },
  { id: 'cuori', em: '💖', nome: 'Hearts', mia: true, regalo: true },
  { id: 'neve', em: '❄️', nome: 'Snow', mia: true, regalo: true },
  { id: 'ufo', em: '🛸', nome: 'UFO', mia: true, regalo: true },
  { id: 'corona', em: '👑', nome: 'Crown', mia: true, regalo: true },
  { id: 'fuochi', em: '🎆', nome: 'Fireworks', mia: true, regalo: true },
  { id: 'campione', em: '🏆', nome: 'Champion', mia: true, regalo: true },
  { id: 'palloncini', em: '🎈', nome: 'Birthday', mia: false, regalo: true },
  { id: 'tricolore', em: '🇬🇧', nome: 'Union colours', mia: true, regalo: false },
  { id: 'cornice', em: '🖼', nome: 'Name frame', mia: true, regalo: true },
];

// ---------- cores: troca parede, telhado e porta da casa original pelas da paleta (as cores dos temas de modelli.js) ----------
const MURI = [...CORI_CASA.muri, '#F1EADB', '#D8CDB5', '#F2C230'];
const TETTI = [...CORI_CASA.tetti, '#C99A1E'];
const PERSIANE = CORI_CASA.porte;
const lin = l => l.map(h => new THREE.Color(h));
const [cMuri, cTetti, cPers] = [lin(MURI), lin(TETTI), lin(PERSIANE)];
const vicino = (r, g, b, lista) => lista.some(c => Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b) < 0.02);
const geoCache = new Map();
function geoCasa(liv, v, stile) {
  const k = `${liv}_${v}_${stile}`;
  if (!geoCache.has(k)) geoCache.set(k, geometriaCasa(liv, v, stile));
  return geoCache.get(k);
}
function ricolora(geo, pal) {
  const g = geo.clone(), col = g.attributes.color.clone(), a = col.array;
  const m = new THREE.Color(pal.muro), t = new THREE.Color(pal.tetto);
  for (let i = 0; i < a.length; i += 3) {
    const [r, gg, b] = [a[i], a[i + 1], a[i + 2]];
    const novo = vicino(r, gg, b, cTetti) ? t : vicino(r, gg, b, cMuri) ? m : vicino(r, gg, b, cPers) ? t : null;
    if (novo) { a[i] = novo.r; a[i + 1] = novo.g; a[i + 2] = novo.b; }
  }
  g.setAttribute('color', col);
  return g;
}
// casa rara dourada: cinzas e brancos (pedra, reboco, metal) viram ouro, do escuro ao claro; o resto (grama, telhado, bandeira) fica
function doura(geo) {
  const g = geo.clone(), col = g.attributes.color.clone(), a = col.array, hsl = {}, c = new THREE.Color();
  const esc = new THREE.Color(ORO.tetto), cla = new THREE.Color(ORO.muro);
  for (let i = 0; i < a.length; i += 3) {
    c.setRGB(a[i], a[i + 1], a[i + 2]).getHSL(hsl, THREE.SRGBColorSpace);
    if (hsl.s > 0.22 || hsl.l < 0.3) continue;
    c.copy(esc).lerp(cla, Math.min(1, Math.max(0, (hsl.l - 0.45) / 0.3)));
    a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b;
  }
  g.setAttribute('color', col);
  return g;
}

// ---------- peças 3D (em unidades de lote; o grupo é escalado por LOTE) ----------
const basico = cor => new THREE.MeshBasicMaterial({ color: cor });
const lambert = cor => new THREE.MeshLambertMaterial({ color: cor });
const matOro = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#4A3600') });
const oroMat = new THREE.MeshLambertMaterial({ color: '#F2C230', emissive: new THREE.Color('#5A4300') });

function corona() {
  const g = new THREE.Group();
  const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 14, 1, true), oroMat);
  anel.material.side = THREE.DoubleSide;
  g.add(anel);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 4), oroMat);
    p.position.set(Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16); g.add(p);
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), basico(k % 2 ? '#E0473C' : '#3FA7F5'));
    gem.position.set(Math.cos(a + 0.45) * 0.172, 0.0, Math.sin(a + 0.45) * 0.172); g.add(gem);
  }
  return g;
}
function trofeo() {
  const g = new THREE.Group();
  const add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.16, 0.06, 0.16), lambert('#3A3F4A'), 0.03);
  add(new THREE.CylinderGeometry(0.025, 0.04, 0.09, 8), oroMat, 0.105);
  add(new THREE.CylinderGeometry(0.11, 0.05, 0.16, 12), oroMat, 0.23);
  for (const s of [-1, 1]) { const m = add(new THREE.TorusGeometry(0.05, 0.014, 6, 12), oroMat, 0.25); m.position.x = s * 0.11; }
  return g;
}
function bandiera(colori) {
  const g = new THREE.Group(), w = 0.3 / colori.length;
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), lambert('#9AA3AE'));
  asta.position.y = 0.5; g.add(asta);
  const telo = new THREE.Group(); telo.position.y = 0.88; g.add(telo);
  colori.forEach((c, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.012), lambert(c)); s.position.x = 0.012 + w / 2 + i * w; telo.add(s); });
  g.userData.telo = telo;
  return g;
}
function palloncini(h) {
  const g = new THREE.Group(), cores = ['#E0473C', '#FFC93C', '#3FA7F5', '#2E9B55', '#FF7EB6'], base = new THREE.Vector3(0.32, 0.12, 0.3);
  const fili = [];
  cores.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), lambert(c));
    b.scale.y = 1.2;
    const a = i / cores.length * Math.PI * 2;
    b.userData.casa = new THREE.Vector3(base.x + Math.cos(a) * 0.14, h * 0.75 + 0.35 + (i % 2) * 0.14, base.z + Math.sin(a) * 0.14);
    b.position.copy(b.userData.casa);
    g.add(b);
    const filo = new THREE.Line(new THREE.BufferGeometry().setFromPoints([base, b.position.clone()]), new THREE.LineBasicMaterial({ color: '#FFFFFF' }));
    g.add(filo); fili.push([filo, b]);
  });
  g.userData.anima = t => fili.forEach(([f, b], i) => {
    b.position.copy(b.userData.casa); b.position.y += Math.sin(t * 0.002 + i) * 0.03; b.position.x += Math.sin(t * 0.0013 + i * 2) * 0.02;
    const p = f.geometry.attributes.position; p.setXYZ(1, b.position.x, b.position.y - 0.1, b.position.z); p.needsUpdate = true;
  });
  return g;
}
function scintille() {
  const g = new THREE.Group(), geo = new THREE.OctahedronGeometry(0.035), m = basico('#FFF6C8');
  for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(geo, m); s.userData.k = k; g.add(s); }
  return g;
}
function alone(cor) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012;
  return m;
}
// faísca redonda com brilho (as partículas sem textura saem quadradas)
let _bolinha = null;
function bolinha() {
  if (_bolinha) return _bolinha;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, '#fff'); r.addColorStop(0.35, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return (_bolinha = new THREE.CanvasTexture(c));
}
// fogos: 3 explosões que se revezam acima da casa (partículas aditivas)
function fuochi(h) {
  const N = 48, E = 3, pos = new Float32Array(N * E * 3), col = new Float32Array(N * E * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.0075, map: bolinha(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  const dirs = Array.from({ length: N }, () => new THREE.Vector3().randomDirection());
  const palette = ['#FF5A5A', '#FFD34D', '#5AD1FF', '#7DFF8A', '#FF8AE2', '#FFFFFF'];
  const scoppi = Array.from({ length: E }, () => ({ t0: -1e9, c: new THREE.Vector3(), cor: new THREE.Color() }));
  pts.userData.anima = t => {
    scoppi.forEach((s, e) => {
      const vita = 1500;
      if (t - s.t0 > vita) {
        s.t0 = t + e * 120; s.c.set((Math.random() - 0.5) * 0.9, h + 1.0 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9);
        s.cor.set(palette[Math.floor(Math.random() * palette.length)]);
      }
      const k = Math.max(0, Math.min(1, (t - s.t0) / vita)), r = 0.55 * (1 - Math.pow(1 - k, 3)), luz = k <= 0 ? 0 : Math.pow(1 - k, 1.5);
      for (let i = 0; i < N; i++) {
        const j = (e * N + i) * 3, d = dirs[i];
        pos[j] = s.c.x + d.x * r; pos[j + 1] = s.c.y + d.y * r - k * k * 0.25; pos[j + 2] = s.c.z + d.z * r;
        col[j] = s.cor.r * luz; col[j + 1] = s.cor.g * luz; col[j + 2] = s.cor.b * luz;
      }
    });
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  return pts;
}

// corações subindo e sumindo em volta da casa (também usado no gravador do Reel 5)
export function cuori(h) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.05); s.bezierCurveTo(-0.07, 0, -0.05, 0.06, 0, 0.03); s.bezierCurveTo(0.05, 0.06, 0.07, 0, 0, -0.05);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), g = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: k % 3 ? '#FF4F8B' : '#FF8FB8', transparent: true }));
    m.userData.k = k; g.add(m);
  }
  g.userData.anima = t => g.children.forEach(m => {
    const k = m.userData.k, f = ((t * 0.00025 + k / 7) % 1), a = k * 2.4 + t * 0.0004;
    m.position.set(Math.cos(a) * (0.3 + (k % 3) * 0.08), h * 0.5 + f * (h * 0.6 + 0.7), Math.sin(a) * (0.3 + (k % 3) * 0.08));
    m.rotation.y = -a + Math.PI / 2;
    m.scale.setScalar((0.8 + (k % 2) * 0.5) * (0.4 + Math.min(1, f * 4)));
    m.material.opacity = Math.min(1, (1 - f) * 2.5);
  });
  return g;
}
// neve caindo sobre a casa
function neve(h) {
  const N = 140, pos = new Float32Array(N * 3), seme = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425) * 0.5 + 0.5]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.0045, map: bolinha(), color: '#FFFFFF', transparent: true, depthWrite: false }));
  pts.frustumCulled = false;
  const alto = h + 1.0;
  pts.userData.anima = t => {
    for (let i = 0; i < N; i++) {
      const [a, r, f] = seme[i], y = alto - ((t * 0.00018 + f) % 1) * alto;
      pos[i * 3] = Math.cos(a * 6.28) * r * 0.62 + Math.sin(t * 0.001 + i) * 0.03; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a * 6.28) * r * 0.62;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
// arco-íris atrás da casa
const ARCO = ['#E0473C', '#FF9F43', '#F2C230', '#2E9B55', '#3FA7F5', '#7B2CBF'];
const raioArco = h => 0.62 + h * 0.35;
function arcobaleno(h) {
  const g = new THREE.Group(), R = raioArco(h);
  ARCO.forEach((c, k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R - k * 0.045, 0.024, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.88 })); g.add(m); });
  g.position.z = -0.32;
  return g;
}
// disco voador girando em cima da casa, com luzes que piscam e o raio verde
function ufo(yBase, h) {
  const g = new THREE.Group(), piatto = new THREE.Group();
  piatto.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.13, 0.05, 20), lambert('#C9CED6')));
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7FE3F0', emissive: new THREE.Color('#1E6A74') }));
  cup.position.y = 0.025; piatto.add(cup);
  const luci = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), basico(k % 2 ? '#FFD34D' : '#FF5A5A')); l.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); piatto.add(l); luci.push(l); }
  g.add(piatto);
  const lung = Math.max(0.2, yBase - h + 0.1);
  const raggio = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.32, lung, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#9BFFB0', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  raggio.position.y = -lung / 2 - 0.02; g.add(raggio);
  g.userData.anima = t => {
    piatto.rotation.y = t * 0.003;
    g.position.set(Math.sin(t * 0.0009) * 0.05, yBase + Math.sin(t * 0.002) * 0.04, 0);
    luci.forEach((l, k) => l.scale.setScalar(Math.sin(t * 0.008 + k * 0.8) > 0 ? 1.2 : 0.6));
    raggio.material.opacity = 0.16 + 0.08 * Math.sin(t * 0.005);
  };
  return g;
}

// ---------- decorações dos eleitos (não se compram: o motor dá a quem ganha a eleição de domingo) ----------
// no chão em volta da casa: três molduras rentes ao solo (azul por dentro, branca, vermelha por fora), dentro do lote
function fascia(corpo) {
  const g = new THREE.Group(), bb = (corpo.geometry.boundingBox ?? (corpo.geometry.computeBoundingBox(), corpo.geometry.boundingBox));
  const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2;
  // folga e largura de cada faixa: encolhem se a casa ocupa quase o lote inteiro (meio lote = 0.5)
  const livre = 0.48 - Math.max(w, d) / 2, vao = Math.max(0.012, Math.min(0.035, livre * 0.2)), fx = Math.max(0.02, Math.min(0.05, (livre - vao) / 3)), alt = 0.018;
  ['#1F3A6B', '#FFFFFF', '#C8102E'].forEach((cor, k) => {
    const m = lambert(cor), o = vao + k * fx;   // distância da parede até a borda de dentro desta faixa
    const W = w + 2 * (o + fx), Dz = d + 2 * o;
    for (const [sx, sz, px, pz] of [[W, fx, 0, d / 2 + o + fx / 2], [W, fx, 0, -(d / 2 + o + fx / 2)], [fx, Dz, w / 2 + o + fx / 2, 0], [fx, Dz, -(w / 2 + o + fx / 2), 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, alt, sz), m);
      b.position.set(cx + px, alt / 2, cz + pz); g.add(b);
    }
  });
  return g;
}
// cúpula dourada do Prime Minister (tambor + cúpula + lanterna com pináculo)
function cupola() {
  const g = new THREE.Group();
  const tamb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 18), oroMat); tamb.position.y = 0.05; g.add(tamb);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), oroMat); cup.position.y = 0.1; g.add(cup);
  const lant = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 8), oroMat); lant.position.y = 0.33; g.add(lant);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 8), oroMat); pin.position.y = 0.44; g.add(pin);
  return g;
}
// dois feixes de luz dourada subindo da casa do Prime Minister (girando devagar)
function fasci() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 7, 12, 1, true), mat);
    b.geometry.translate(0, 3.5, 0); b.rotation.z = s * 0.22; b.userData.s = s; g.add(b);
  }
  g.userData.mat = mat;
  return g;
}

// ---------- prêmios dos games (não se compram: série de dias jogando e Games Champion da semana; motore.mjs) ----------
// estrela dourada de 5 pontas (extrudada)
function stella() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.065 : 0.15, a = Math.PI / 2 + i * Math.PI / 5;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  geo.translate(0, 0, -0.02);
  const g = new THREE.Group(), m = new THREE.Mesh(geo, oroMat);
  m.position.y = 0.24; g.add(m);
  return g;
}
// medalha: disco dourado com fita verde-água e azul
function medaglia() {
  const g = new THREE.Group();
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), oroMat);
  disco.rotation.x = Math.PI / 2; disco.position.y = 0.1; g.add(disco);
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.034, 16), lambert('#E8B923'));
  centro.rotation.x = Math.PI / 2; centro.position.y = 0.1; g.add(centro);
  [['#14B8A6', -1], ['#3FA7F5', 1]].forEach(([cor, s]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.012), lambert(cor));
    f.position.set(s * 0.04, 0.26, 0); f.rotation.z = s * 0.35; g.add(f);
  });
  return g;
}

// ---------- villa e castelo (comprados com créditos, para sempre; data/proprieta.json) ----------
// em unidades de lote (1 = um lote), frente para +z (a rua); devolvem { g, h } com h = altura do telhado
const caixaM = (g, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const telhado = (w, d, h, m) => { const o = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), m); o.rotation.y = Math.PI / 4; o.scale.set(w, h, d); return o; };
let MV = null;
const matV = () => (MV ??= { muro: lambert('#F6EEDC'), muro2: lambert('#EFE2C6'), tetto: lambert('#6B5A4E'), bianco: lambert('#FFFFFF'), vetro: lambert('#5B7FA8'), porta: lambert('#1F3A6B'),
  prato: lambert('#9BD37A'), acqua: new THREE.MeshLambertMaterial({ color: '#4FC3F7', emissive: '#0E5E80' }), bordo: lambert('#F1EEE6'), siepe: lambert('#2F6B3A'), tronco: lambert('#6B4A2A'),
  pietra: lambert('#D8D2C4'), pietra2: lambert('#BFB7A6'), rosso: lambert('#C8102E'), blu: lambert('#1F3A6B'), legno: lambert('#5A3A22') });
function villaModello() {
  const g = new THREE.Group(), M = matV();
  caixaM(g, 0.96, 0.02, 0.96, 0, 0, 0, M.prato);
  caixaM(g, 0.64, 0.4, 0.44, -0.12, 0.02, -0.16, M.muro);                       // térreo
  caixaM(g, 0.5, 0.34, 0.38, -0.16, 0.42, -0.18, M.muro2);                      // 1º andar
  const t1 = telhado(0.72, 0.52, 0.16, M.tetto); t1.position.set(-0.12, 0.42 + 0.08, -0.16); g.add(t1);
  const t2 = telhado(0.58, 0.46, 0.2, M.tetto); t2.position.set(-0.16, 0.76 + 0.1, -0.18); g.add(t2);
  caixaM(g, 0.5, 0.03, 0.14, -0.12, 0.4, 0.13, M.bianco);                       // pórtico
  for (const x of [-0.34, -0.2, -0.04, 0.1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.38, 8), M.bianco); c.position.set(x, 0.21, 0.18); g.add(c); }
  caixaM(g, 0.1, 0.2, 0.01, -0.12, 0.02, 0.065, M.porta);
  for (const x of [-0.36, 0.12]) caixaM(g, 0.09, 0.12, 0.01, x, 0.16, 0.065, M.vetro);
  for (const x of [-0.34, -0.16, 0.02]) caixaM(g, 0.08, 0.11, 0.01, x, 0.54, 0.015, M.vetro);
  caixaM(g, 0.4, 0.025, 0.3, 0.26, 0.02, 0.27, M.bordo);                        // piscina
  caixaM(g, 0.34, 0.012, 0.24, 0.26, 0.035, 0.27, M.acqua);
  for (const [x, z] of [[0.4, -0.38], [0.4, -0.1], [-0.42, 0.36]]) {          // árvores redondas (jardim inglês)
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), M.tronco); tr.position.set(x, 0.07, z); g.add(tr);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.siepe); ch.position.set(x, 0.2, z); g.add(ch);
  }
  return { g, h: 0.96 };
}
function castelloModello() {
  const g = new THREE.Group(), M = matV();
  caixaM(g, 0.96, 0.02, 0.96, 0, 0, 0, M.prato);
  const muro = (w, d, x, z) => { caixaM(g, w, 0.42, d, x, 0.02, z, M.pietra); };
  muro(0.8, 0.08, 0, 0.36); muro(0.8, 0.08, 0, -0.36); muro(0.08, 0.8, 0.36, 0); muro(0.08, 0.8, -0.36, 0);
  for (let i = -3; i <= 3; i += 2) for (const [x, z, w, d] of [[i * 0.1, 0.36, 0.06, 0.09], [i * 0.1, -0.36, 0.06, 0.09], [0.36, i * 0.1, 0.09, 0.06], [-0.36, i * 0.1, 0.09, 0.06]]) caixaM(g, w, 0.07, d, x, 0.44, z, M.pietra);
  caixaM(g, 0.16, 0.26, 0.02, 0, 0.02, 0.405, M.legno);                         // portão
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {   // torres redondas com ameias (sem telhado cônico: castelo britânico)
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.62, 10), M.pietra2); t.position.set(x, 0.33, z); g.add(t);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; caixaM(g, 0.04, 0.06, 0.04, x + Math.cos(a) * 0.085, 0.64, z + Math.sin(a) * 0.085, M.pietra2); }
  }
  caixaM(g, 0.36, 1.25, 0.36, 0, 0.02, -0.04, M.pietra);                       // torre de menagem (keep)
  for (const x of [-0.14, 0, 0.14]) for (const z of [-0.18, 0.1]) caixaM(g, 0.07, 0.08, 0.07, x, 1.27, z, M.pietra);
  for (const x of [-0.14, 0.14]) caixaM(g, 0.07, 0.08, 0.07, x, 1.27, -0.04, M.pietra);
  for (const y of [0.6, 0.95]) caixaM(g, 0.07, 0.11, 0.01, 0, y, 0.145, M.legno);
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), M.legno); asta.position.set(0, 1.35 + 0.18, -0.04); g.add(asta);
  const band = new THREE.Group(); band.position.set(0, 1.62, -0.04); g.add(band);
  [M.blu, M.bianco, M.rosso].forEach((m, i) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), m.clone()); f.material.side = THREE.DoubleSide; f.position.set(0.035 + i * 0.07, 0, 0); band.add(f); });
  g.userData.band = band;
  return { g, h: 1.35 };
}
// altura do corpo: villa/castelo mudam a altura da casa; casa rara tem a altura do modelo
const altCorpo = (casa, sel) => {
  const ex = sel.extra;
  if (ex.has('castello')) return 1.35;
  if (ex.has('villa')) return Math.max(0.96, Math.min(ALTURA_NIVEL[casa.livello], 1.2));
  return altezza(casa, sel);
};

// altura total com o que flutua e os fogos (em lotes; para enquadrar a câmera)
const topoDi = (casa, sel) => {
  const ex = sel.extra, h = altCorpo(casa, sel) + (ex.has('castello') ? 0.35 : 0);
  const y = h + 0.25 + (ex.has('presidenza') ? 0.5 : 0) + (ex.has('corona') ? 0.35 : 0) + (ex.has('campione') ? 0.42 : 0) + (ex.has('ufo') ? 0.45 : 0)
    + (ex.has('stella') ? 0.45 : 0) + (ex.has('medaglia') ? 0.4 : 0);
  const base = Math.max(y, ex.has('palloncini') ? h * 0.75 + 0.6 : 0, ex.has('arcobaleno') ? raioArco(h) : 0, ex.has('cuori') ? h * 1.1 + 0.6 : 0);
  return ex.has('fuochi') ? Math.max(base, y + 0.9) : base;
};

// monta o grupo 3D da casa decorada: { g, anima, pilha } (pilha = topo do que flutua; o rótulo do @ fica acima)
// (também usado pelos gravadores de reel)
export function costruisci(D, citta, notte, casa, sel) {
  const l = D.luoghi[casa.luogo], stile = stileRegione(l.regione.cod, l.comune.sigla), ex = sel.extra;
  const g = new THREE.Group(), anim = [];
  const p = citta.posCasa(casa);
  g.position.set(p.x, p.y + 0.0009, p.z);
  g.rotation.y = posLote(casa.lote).rot;
  g.scale.setScalar(LOTE);
  const forma = ex.has('castello') ? 'castello' : ex.has('villa') ? 'villa' : null;
  const sp = !forma && sel.modello ? costruisciSpeciale(sel.modello) : null;
  // casa rara: o modelo troca a casa inteira (sem cores de time). Ouro numa casa rara só vem de prêmio
  // (amministra omaggio; a loja não deixa escolher): as pedras e paredes claras viram ouro
  const oro = ex.has('oro') || (!forma && !!SPECIALI.find(m => m.id === sel.modello)?.oro), squadra = sp || forma ? null : SQUADRE.find(s => s.id === sel.squadra);
  const h = altCorpo(casa, sel);
  let corpo;
  if (forma) {   // villa/castelo no lugar da casa (as decorações ficam por cima)
    const mod = forma === 'castello' ? castelloModello() : villaModello();
    corpo = mod.g; g.add(corpo);
    if (mod.g.userData.band) anim.push(t => { mod.g.userData.band.rotation.y = Math.sin(t * 0.004) * 0.35; });
    const finto = new THREE.BoxGeometry(0.84, h, 0.84); finto.translate(0, h / 2, 0); corpo.geometry = finto;   // caixa para a faixa do Mayor
  } else {
    const base = sp ? (oro ? doura(sp.geo) : sp.geo) : geoCasa(casa.livello, variante(casa), stile);
    const pal = sp ? null : oro ? ORO : squadra;
    corpo = new THREE.Mesh(pal ? ricolora(base, pal) : base, oro ? matOro : citta.mat);
    g.add(corpo);
    if (sp?.extra) g.add(sp.extra);
    if (sp?.anima) anim.push(t => sp.anima(t, notte()));
  }
  // bandeira: num mastro ao lado da casa; nas torres (casa alta), no terraço
  const pianta = (b, lado) => {
    if (h > 1.5) { b.position.set(lado * 0.12, h - 0.05, 0); b.scale.setScalar(0.8); }
    else { b.position.set(lado * 0.38, 0, 0.36); b.scale.setScalar(Math.max(1, h * 0.9)); }
    g.add(b);
  };
  if (squadra) { const b = bandiera([squadra.muro, squadra.tetto, squadra.muro, squadra.tetto]); pianta(b, -1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004) * 0.35; }); }
  if (ex.has('tricolore') || ex.has('fascia')) { const b = bandiera(['#C8102E', '#FFFFFF', '#1F3A6B']); pianta(b, 1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004 + 1) * 0.35; }); }
  // games: bandeirinha amarela e azul atrás da casa (7 dias seguidos jogando); Games Champion: aura verde-água pulsando
  if (ex.has('bandierina')) {
    const b = bandiera(['#FFC93C', '#3FA7F5', '#FFC93C']);
    if (h > 1.5) { b.position.set(0, h - 0.05, -0.12); b.scale.setScalar(0.8); } else { b.position.set(-0.38, 0, -0.36); b.scale.setScalar(Math.max(1, h * 0.9)); }
    g.add(b); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.0045 + 2) * 0.35; });
  }
  if (ex.has('campione_g')) {
    const au = alone('#2DE1C2'); au.scale.setScalar(1.2); g.add(au);
    anim.push(t => { const k = 0.5 + 0.5 * Math.sin(t * 0.0035); au.material.opacity = 0.25 + 0.35 * k; au.scale.setScalar(1.1 + 0.25 * k); });
  }
  if (oro) {
    const s = scintille(); g.add(s); g.add(alone('#FFC93C'));
    anim.push(t => {
      matOro.emissive.set(notte() ? '#9C7608' : '#4A3600'); oroMat.emissive.set(notte() ? '#B38A10' : '#5A4300');
      s.children.forEach(c => { const k = c.userData.k, a = t * 0.0009 + k * 0.63; c.position.set(Math.cos(a) * 0.55, 0.15 + ((k * 0.37) % 1) * (h + 0.3), Math.sin(a) * 0.55); c.rotation.y = t * 0.004; c.scale.setScalar(0.5 + 0.6 * Math.abs(Math.sin(t * 0.005 + k))); });
    });
  }
  if (ex.has('neon')) {
    const m = new THREE.MeshBasicMaterial({ color: '#00E5FF', side: THREE.BackSide });
    if (corpo.isMesh) { const guscio = new THREE.Mesh(corpo.geometry, m); guscio.scale.set(1.07, 1.035, 1.07); guscio.position.y = -0.01; g.add(guscio); }
    const a = alone('#00E5FF'); g.add(a);
    anim.push(t => { m.color.setHSL((t * 0.00012) % 1, 1, 0.55); a.material.color.copy(m.color); });
  }
  // eleitos: faixa no chão (Mayor e PM); o PM ganha ainda cúpula dourada, feixes de luz e aura pulsando
  if (ex.has('fascia')) g.add(fascia(corpo));
  let y = h + 0.25;
  if (ex.has('presidenza')) {
    const cup = cupola(); cup.position.y = h; g.add(cup);
    const fx = fasci(); fx.position.y = h + 0.45; g.add(fx);
    const au = alone('#FFD34D'); au.scale.setScalar(1.25); g.add(au);
    anim.push(t => {
      oroMat.emissive.set(notte() ? '#B38A10' : '#5A4300');
      fx.rotation.y = t * 0.0004;
      fx.children.forEach(b => { b.rotation.z = b.userData.s * (0.22 + 0.08 * Math.sin(t * 0.0011 + b.userData.s)); });
      fx.userData.mat.opacity = (notte() ? 0.42 : 0.22) + 0.08 * Math.sin(t * 0.002);
      const k = 0.5 + 0.5 * Math.sin(t * 0.003); au.material.opacity = 0.3 + 0.3 * k; au.scale.setScalar(1.15 + 0.2 * k);
    });
    y += 0.5;
  }
  // coisas que flutuam em cima da casa, uma acima da outra
  if (ex.has('corona')) { const c = corona(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003) * 0.04, 0); c.rotation.y = t * 0.0012; }); y += 0.35; }
  if (ex.has('campione')) { const c = trofeo(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003 + 1) * 0.04, 0); c.rotation.y = -t * 0.001; }); y += 0.42; }
  if (ex.has('stella')) { const c = stella(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003 + 2) * 0.04, 0); c.rotation.y = t * 0.0016; }); y += 0.45; }
  if (ex.has('medaglia')) { const c = medaglia(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003 + 3) * 0.04, 0); c.rotation.y = -t * 0.0012; }); y += 0.4; }
  if (ex.has('ufo')) { const u = ufo(y + 0.15, h); g.add(u); anim.push(u.userData.anima); y += 0.45; }
  if (ex.has('palloncini')) { const b = palloncini(h); g.add(b); anim.push(b.userData.anima); }
  if (ex.has('arcobaleno')) g.add(arcobaleno(h));
  if (ex.has('cuori')) { const c = cuori(h); g.add(c); anim.push(c.userData.anima); }
  if (ex.has('neve')) { const n = neve(h); g.add(n); anim.push(n.userData.anima); }
  if (ex.has('fuochi')) { const f = fuochi(y - 0.35); g.add(f); anim.push(f.userData.anima); }
  const anima = t => anim.forEach(f => f(t));
  anima(performance.now());   // posições iniciais (a foto da story pode sair antes do próximo quadro)
  return { g, anima, pilha: y - 0.25 > h ? y - 0.1 : h };
}

const vuota = () => ({ squadra: null, modello: null, extra: new Set() });
const copia = s => ({ squadra: s.squadra, modello: s.modello ?? null, extra: new Set(s.extra) });
const quanti = s => (s.squadra ? 1 : 0) + (s.modello ? 1 : 0) + s.extra.size;
const emojiDi = s => [SPECIALI.find(m => m.id === s.modello)?.em, ...[...s.extra].map(id => EFFETTI.find(e => e.id === id)?.em)].filter(Boolean).join(' ');
const num = v => Number(v).toLocaleString('en-GB');

export class Decori {
  constructor(D, mappa, citta, festa) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.festa = festa;
    this.ui = null;              // ligado pelo main.js depois de criar a UI
    this.pagate = new Map();     // conta -> { id, conta, da, sel, scade } (data/decori.json: compras antigas em £, até vencer)
    this.attive = new Map();     // conta -> { casa, sel, da, g, anima, pilha } (desenhadas agora)
    this.ed = null;              // edição aberta: { modo, casa, sel, da }
    this.giro = null;            // câmera girando em volta da casa
    this.cfg = { attivo: false, prezzo: 499, prezzo_mini: 0, giorni: 10, checkout: '', provedor: 'hotmart' };
    this.recenti = new Map();    // conta -> { sel, scade } (compras pagas dos últimos 30 dias)
    // teste da Stripe antes da troca: ?stripe=<código> fica guardado neste aparelho até pagar
    const q = new URLSearchParams(location.search).get('stripe');
    if (q) gravar('stripe_prova', q);
    this.prova = ler('stripe_prova');
    this.ANIM = {}; this.GIRO = {};
    // eleitos da última eleição (snapshot): o Prime Minister e um Mayor por cidade ganham a decoração do cargo
    const k = D.snap.cariche ?? {};
    this.presidente = k.presidente?.conta ?? null;
    this.sindacoDi = new Map();   // id da cidade -> conta do Mayor (desenhado só quando a cidade chega perto)
    for (const s of Object.values(k.sindaci ?? {})) { const c = D.porConta.get(s.conta); if (c) this.sindacoDi.set(D.luoghi[c.luogo].id, s.conta); }
    this.sindaci = new Set(this.sindacoDi.values());
    // games: Champion da semana (desenhado logo) e enfeites da série de dias (desenhados quando a cidade chega perto)
    const ms = D.snap.missioni ?? {};
    this.campioneMs = ms.campione && D.porConta.has(ms.campione.conta) ? ms.campione.conta : null;
    this.premiMs = new Map();     // conta -> ['bandierina', 'stella', 'medaglia'] (os já conquistados na série atual)
    this.premiDi = new Map();     // id da cidade -> [contas com enfeite]
    for (const [conta, n] of Object.entries(ms.serie ?? {})) {
      const c = D.porConta.get(conta), ids = (REGOLE.missioni?.serie ?? []).filter(([min]) => n >= min).map(x => x[1]);
      if (!c || !ids.length) continue;
      this.premiMs.set(conta, ids);
      const id = D.luoghi[c.luogo].id;
      (this.premiDi.get(id) ?? this.premiDi.set(id, []).get(id)).push(conta);
    }
    // villas e castelos comprados e decorações para sempre (data/proprieta.json): desenhados quando a cidade chega perto
    this.prop = { ville: new Set(), castelli: {}, castelloDi: new Map(), decori: new Map(), case: new Set() };   // castelloDi: conta -> county; decori: conta -> {sel, da}; case: quem tem "your home"
    this.propDi = new Map();      // id da cidade -> [contas com villa/castelo/decoração]
    this.desenhando = false;
    mappa.aoFrame.push(t => this.quadro(t));
    mappa.aoMover.push(() => this.visibili());
    mappa.canvas.addEventListener('pointerdown', () => this.ferma());
    mappa.canvas.addEventListener('wheel', () => this.ferma());
  }

  get aperto() { return this.cfg.attivo || new URLSearchParams(location.search).has('decora'); }
  get stripe() { return this.cfg.provedor === 'stripe' || !!this.prova; }

  async iniciar() {
    try { Object.assign(this.cfg, (await (await fetch(`data/negozio.json?t=${Date.now()}`)).json()).decora ?? {}); } catch { /* sem config: fica desligado */ }
    if (this.aperto) this.ligarPillola();
    await this.ricaricaProprieta();
    await this.ricarica();
    if (this.presidente && !this.attive.has(this.presidente)) this.ridisegna(this.presidente);
    if (this.campioneMs && !this.attive.has(this.campioneMs)) this.ridisegna(this.campioneMs);
    if (this.aperto && location.hash === '#decora') this.home();
    setInterval(() => this.ricarica(), 120e3);
    // voltou do pagamento (compras antigas em £): espera o webhook confirmar
    const at = ler('decora_attesa');
    if (at && Date.now() - at.t < 3 * 3600e3) this.aspetta(at);
    else gravar('decora_attesa', null);
  }

  // ---------- compras pagas em £ (data/decori.json; antigas, até vencer) ----------
  async ricarica() {
    let lista = [];
    try { const r = await fetch(`data/decori.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); lista = j.decori ?? []; this.recenti = new Map((j.recenti ?? []).map(x => [x.conta, { scade: Date.parse(x.scade), sel: { squadra: x.squadra || null, modello: x.modello || null, extra: new Set(x.extra ?? []) } }])); } } catch { /* sem arquivo ainda */ }
    const agora = Date.now(), novas = new Map();
    for (const x of lista) {
      if (Date.parse(x.scade) <= agora || !this.D.porConta.has(x.conta)) continue;
      novas.set(x.conta, { id: x.id, conta: x.conta, da: x.da || null, scade: Date.parse(x.scade), sel: { squadra: x.squadra || null, modello: x.modello || null, extra: new Set(x.extra ?? []) } });
    }
    const chave = m => JSON.stringify([...m.values()].map(x => [x.id, x.conta]));
    if (chave(novas) === chave(this.pagate)) return;
    const vecchie = this.pagate;
    this.pagate = novas;
    for (const conta of new Set([...vecchie.keys(), ...novas.keys()])) {
      if (this.ed?.casa.conta === conta) continue;   // prévia aberta: não mexe
      this.ridisegna(conta);
    }
    // painel dessa casa aberto (ex.: ?casa= no carregamento): refaz para mostrar o selo
    const aberta = !this.ed && !this.ui.painel.hidden && $('#pannello h2.conta')?.textContent.slice(1);
    if (aberta && (vecchie.has(aberta) || novas.has(aberta))) this.ui.casa(this.D.porConta.get(aberta), false);
  }
  // ---------- villas, castelos e decorações para sempre (data/proprieta.json, escrito pelo api/conto.php a cada compra) ----------
  async ricaricaProprieta() {
    let j = null;
    try { const r = await fetch(`data/proprieta.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) j = await r.json(); } catch { /* ainda não existe */ }
    const firma = conta => JSON.stringify([this.prop.ville.has(conta), this.prop.castelloDi.get(conta) ?? null, this.prop.decori.get(conta)?.k ?? null]);
    const velhas = new Map([...new Set([...this.prop.ville, ...this.prop.castelloDi.keys(), ...this.prop.decori.keys()])].map(c => [c, firma(c)]));
    const ville = new Set((j?.ville ?? []).filter(c => this.D.porConta.has(c))), castelloDi = new Map(), decori = new Map();
    for (const x of Object.values(j?.castelli ?? {})) if (this.D.porConta.has(x.conta)) castelloDi.set(x.conta, x.regione);
    const deco = (conta, x) => { if (this.D.porConta.has(conta)) decori.set(conta, { sel: { squadra: x.squadra || null, modello: x.modello || null, extra: new Set(x.extra ?? []) }, da: x.da || null, k: JSON.stringify(x) }); };
    for (const [conta, x] of Object.entries(j?.decori ?? {})) deco(conta, x);
    // dono do jogo testando: villa/castelo/decoração de prova aparecem só no navegador dele
    const pr = this.ui?.conto?.p;
    if (pr?.proprietario) {
      for (const [conta, x] of Object.entries(pr.deco_prova ?? {})) deco(conta, x);
      if (this.D.porConta.has(pr.conta)) {
        const ow = pr.oggetti ?? [], c = this.D.porConta.get(pr.conta);
        if (ow.includes('castello')) castelloDi.set(pr.conta, `${this.D.luoghi[c.luogo].comune.sigla} (test)`);
        else if (ow.includes('villa')) ville.add(pr.conta);
      }
    }
    this.prop = { ville, castelli: j?.castelli ?? {}, castelloDi, decori, case: new Set(j?.case ?? []) };
    this.propDi = new Map();
    for (const conta of new Set([...ville, ...castelloDi.keys(), ...decori.keys()])) {
      const id = this.D.luoghi[this.D.porConta.get(conta).luogo].id;
      (this.propDi.get(id) ?? this.propDi.set(id, []).get(id)).push(conta);
    }
    // quem mudou: redesenha
    for (const conta of new Set([...velhas.keys(), ...ville, ...castelloDi.keys(), ...decori.keys()])) {
      if (velhas.get(conta) === firma(conta) && !this.citta.perto.includes(this.D.luoghi[this.D.porConta.get(conta)?.luogo])) continue;
      if (this.ed?.casa.conta === conta || !this.D.porConta.has(conta)) continue;
      this.ridisegna(conta);
    }
  }
  // seleção base da casa: decoração para sempre (créditos) > decoração paga em £ (antigas, até vencer) > nada
  base(conta) {
    const d = this.prop.decori.get(conta);
    if (d) return { sel: copia(d.sel), da: d.da };
    const p = this.pagata(conta);
    return p ? { sel: copia(p.sel), da: p.da } : { sel: vuota(), da: null };
  }
  ridisegna(conta) { const b = this.base(conta); this.disegna(this.D.porConta.get(conta), this.unisci(conta, b.sel), b.da); }
  forma(conta) { return this.prop.castelloDi.has(conta) ? 'castello' : this.prop.ville.has(conta) ? 'villa' : null; }
  pagata(conta) { const p = this.pagate.get(conta); return p && p.scade > Date.now() ? p : null; }
  // casa rara já tomada nesta cidade por outra conta (só uma de cada por cidade): a decoração, ou null
  occupato(casa, id) {
    for (const [conta, d] of this.prop.decori) if (d.sel.modello === id && conta !== casa.conta && this.D.porConta.get(conta)?.luogo === casa.luogo) return { conta, scade: null };
    for (const p of this.pagate.values()) if (p.sel.modello === id && p.conta !== casa.conta && p.scade > Date.now() && this.D.porConta.get(p.conta)?.luogo === casa.luogo) return p;
    return null;
  }
  // cargo da conta (presidente / sindaco / null) e a seleção com a decoração do cargo somada à comprada
  cargo(conta) { return conta === this.presidente ? 'presidente' : this.sindaci.has(conta) ? 'sindaco' : null; }
  unisci(conta, sel) {
    const c = this.cargo(conta), pr = this.premiMs.get(conta), camp = conta === this.campioneMs, fo = this.forma(conta);
    if (!c && !pr && !camp && !fo) return sel;
    const s = copia(sel);
    if (fo) s.extra.add(fo);
    if (c) s.extra.add('fascia');
    if (c === 'presidente') s.extra.add('presidenza');
    pr?.forEach(x => s.extra.add(x));
    if (camp) s.extra.add('campione_g');
    return s;
  }

  // ---------- desenho ----------
  // tira a casa do InstancedMesh da cidade (a cidade é remontada) e desenha a versão decorada; sel vazia = casa normal
  disegna(casa, sel, da = null) {
    if (!casa) return;
    const c = this.citta, l = this.D.luoghi[casa.luogo], velha = this.attive.get(casa.conta);
    if (velha) c.grupo.remove(velha.g);
    const tinha = c.nascoste.has(casa.conta), vazia = !quanti(sel), eraRara = c.speciali.has(casa.conta);
    const rara = !vazia && (!!sel.modello || sel.extra.has('villa') || sel.extra.has('castello'));
    if (vazia) { this.attive.delete(casa.conta); c.nascoste.delete(casa.conta); }
    else c.nascoste.add(casa.conta);
    if (rara) c.speciali.add(casa.conta); else c.speciali.delete(casa.conta);
    if (tinha === vazia || eraRara !== rara) { c.cache.delete(l.id); c.ultimo = null; c.atualizar(true); }   // muda quem está no InstancedMesh
    if (!vazia) {
      const o = costruisci(this.D, c, () => !!this.mappa.notte, casa, sel);
      c.grupo.add(o.g);
      this.attive.set(casa.conta, { casa, sel, da, ...o });
    }
    this.visibili();
    this.mappa.sujo = true;
  }
  // só as decorações das cidades perto da câmera aparecem e animam (longe não gasta bateria)
  visibili() {
    const perto = new Set(this.citta.grupo.visible ? this.citta.perto : []);
    // Mayors, prêmios e villas: a casa decorada só é montada quando a cidade chega perto (são milhares)
    if (!this.desenhando) {
      this.desenhando = true;
      for (const l of perto) {
        for (const conta of [this.sindacoDi.get(l.id), ...(this.premiDi.get(l.id) ?? []), ...(this.propDi.get(l.id) ?? [])]) {
          if (conta && !this.attive.has(conta) && this.ed?.casa.conta !== conta) this.ridisegna(conta);
        }
      }
      this.desenhando = false;
    }
    let alguma = false;
    for (const a of this.attive.values()) { a.g.visible = perto.has(this.D.luoghi[a.casa.luogo]); alguma ||= a.g.visible; }
    if (alguma) this.mappa.animatori.add(this.ANIM); else this.mappa.animatori.delete(this.ANIM);
  }
  quadro(t) {
    for (const a of this.attive.values()) if (a.g.visible) a.anima(t);
    if (this.giro && !this.mappa.voo) { this.giro.az += 0.0022; this.inquadra(this.giro.casa, this.giro.az); }
  }

  // rótulo do @ das casas decoradas (etichette.js): cargo, castelo, moldura dourada, "🎁 from @fulano"...; null = casa normal
  etichetta(casa) {
    const a = this.attive.get(casa.conta);
    if (!a) return null;
    const fogo = casa.fiamme > Date.now() / 1000, base = `${fogo ? '🔥 ' : ''}@${esc(casa.conta)}`, cornice = a.sel.extra.has('cornice');
    const y = casa.y + (a.pilha + 0.25) * LOTE;
    const cg = this.cargo(casa.conta);
    if (cg === 'presidente') return { cls: 'et-casa vip', html: `👑 ${base}<small>PRIME MINISTER</small>`, y };
    if (cg === 'sindaco') return { cls: 'et-casa vip', html: `🏛️ ${base}<small>MAYOR OF ${esc(this.D.luoghi[casa.luogo].nome).toUpperCase()}</small>`, y };
    if (this.prop.castelloDi.has(casa.conta)) return { cls: 'et-casa vip', html: `🏰 ${base}<small>CASTLE · ${esc(String(this.prop.castelloDi.get(casa.conta)).toUpperCase())}</small>`, y };
    if (casa.conta === this.campioneMs) return { cls: 'et-casa vip', html: `🏆 ${base}<small>GAMES CHAMPION</small>`, y };
    if (this.prop.ville.has(casa.conta) && !a.da && !this.pagata(casa.conta)) return { cls: 'et-casa vip', html: `🏡 ${base}<small>VILLA</small>`, y };
    if (!this.pagata(casa.conta) && !this.prop.decori.has(casa.conta) && this.premiMs.has(casa.conta)) return { cls: 'et-casa deco', html: `🎮 ${base}`, y };
    if (a.da) return { cls: `et-casa ${cornice ? 'vip' : 'regalo'}`, html: `${cornice ? '✨ ' : ''}${base}<small>🎁 from @${esc(a.da)}</small>`, y };
    if (cornice) return { cls: 'et-casa vip', html: `✨ ${base}<small>SPECIAL HOUSE</small>`, y };
    const rara = SPECIALI.find(m => m.id === a.sel.modello);
    if (rara) return { cls: 'et-casa regalo', html: `${base}<small>${rara.em} ${esc(rara.nome.toUpperCase())}</small>`, y };
    return { cls: 'et-casa deco', html: `✨ ${base}`, y };
  }
  vicine(perto) {
    const s = new Set(perto), out = [];
    for (const a of this.attive.values()) if (s.has(this.D.luoghi[a.casa.luogo])) out.push(a.casa);
    return out;
  }

  // ---------- painel da casa (ui.js) ----------
  badge(casa) {
    const d = this.prop.decori.get(casa.conta);
    if (d) return d.da ? `<span class="badge regalo">🎁 Gift from @${esc(d.da)} · forever</span>` : '<span class="badge regalo">✨ Decorated · forever</span>';
    const p = this.pagata(casa.conta);
    if (!p) return '';
    const pts = `+${REGOLE.punti.decoro} pts`;
    return p.da ? `<span class="badge regalo">🎁 Gift from @${esc(p.da)} · ${pts} · until ${dataCurta(p.scade)}</span>` : `<span class="badge regalo">✨ Special house · ${pts} · until ${dataCurta(p.scade)}</span>`;
  }
  // 21/11: decoração agora é com créditos e para sempre (cartão "Your home" em ui.js): os botões antigos em £ saem
  bottone() { return ''; }

  // ---------- câmera ----------
  enquadra(casa) {
    const sel = this.attive.get(casa.conta)?.sel ?? vuota(), topo = topoDi(casa, sel) * LOTE;
    return { d: 0.24 + topo * 3.4, k: innerWidth >= 900 ? [-0.32, 0] : [0, altCorpo(casa, sel) > 1.5 ? 0.05 : 0.2] };
  }
  inquadra(casa, az) {
    const alvo = this.enquadra(casa), g = this.giro, mp = this.mappa;
    // muda devagar quando a seleção muda a altura (ex.: ligou os fogos)
    g.d = g.d ? g.d + (alvo.d - g.d) * 0.06 : mp.dist;
    g.k = g.k ? g.k + (alvo.k[1] - g.k) * 0.06 : alvo.k[1];
    const d = g.d, k = [alvo.k[0], g.k];
    mp.alvo.x = casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d;
    mp.alvo.z = casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d;
    mp.dist = d; mp.az = az;
    mp.atualizarCamera();
  }
  vaiACasa(casa) {
    this.citta.posCasa(casa);
    const az = posLote(casa.lote).rot === 0 ? 0.5 : Math.PI + 0.5;   // de frente para a porta
    const { d, k } = this.enquadra(casa);
    document.body.classList.add('decora-edit');
    this.mappa.voar({ x: casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d, z: casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d, dist: d, az });
    this.giro = { casa, az };
    this.mappa.animatori.add(this.GIRO);
    this.ui.et.destaque = casa.conta;
  }
  ferma() { this.giro = null; this.mappa.animatori.delete(this.GIRO); }
  // fechou o painel: desfaz a prévia não salva (ui.fechar chama)
  chiudi() {
    this.annulla(); this.ferma();
    document.body.classList.remove('decora-edit');
  }
  annulla() {
    if (!this.ed) return;
    const casa = this.ed.casa;
    this.ed = null;
    this.ridisegna(casa.conta);
  }

  // ---------- pílula ----------
  // botão do mapa: oferece a RECARGA de créditos (a decoração fica no cartão da casa); troca a frase a cada 3,2 s,
  // de tempos em tempos borda brilhante + pulinho; selo "NEW" alternando até a pessoa tocar uma vez (NOVITA_VER)
  ligarPillola() {
    const b = $('#decora'), velho = $('#fai-video');
    if (!b) return;
    b.hidden = false;
    if (velho) velho.hidden = true;
    const NOVITA_VER = 'v-ricarica';
    const testo = b.querySelector('.testo'), selo = b.querySelector('.novita');
    const vista = () => ler('decora_vista') === NOVITA_VER;
    if (selo) selo.hidden = vista();
    testo.textContent = '💰 Top up credits';
    // curtas (cabem numa linha no celular)
    const frasi = ['💰 Top up credits', '🎨 Your home, inside & out', '🏰 Castles and villas', '🛵 Bikes, scooters, cars', '🎁 Up to +50% credits'];
    const seli = ['NEW', '+50%', '🏰 1 PER COUNTY'];
    let i = 0, k = 0;
    setInterval(() => {
      testo.classList.add('via');
      setTimeout(() => { i = (i + 1) % frasi.length; testo.textContent = frasi[i]; testo.classList.remove('via'); }, 250);
      if (selo && !selo.hidden) { k = (k + 1) % seli.length; selo.textContent = seli[k]; }
    }, 3200);
    // brilho: logo ao abrir o mapa e depois a cada 18 s (mais raro depois que a pessoa já abriu)
    const brilha = () => { b.classList.remove('brilha'); void b.offsetWidth; b.classList.add('brilha'); };
    setTimeout(brilha, 2500);
    setInterval(() => { if (!vista() || Math.random() < 0.35) brilha(); }, 18000);
    b.addEventListener('animationend', e => { if (e.animationName === 'decora-brilha') b.classList.remove('brilha'); });
    b.onclick = () => { gravar('decora_vista', NOVITA_VER); if (selo) selo.hidden = true; this.ui.conto?.apriRicarica(); };
  }

  // ---------- telas ----------
  azione(t) {
    const d = t.dataset, v = d.v, ed = this.ed;
    ({
      mia: () => { const c = this.D.porConta.get(this.ui.conto?.p?.conta); if (c) return this.editor('mia', c); this.ui.aviso('Sign in and link your Instagram: then you can decorate your house.'); this.ui.conto?.apri(); },
      regalo: () => this.scegli('regalo'),
      scelto: () => this.editor(d.modo, this.D.porConta.get(v)),
      squadra: () => { ed.sel.squadra = ed.sel.squadra === v ? null : v; if (ed.sel.squadra) { ed.sel.extra.delete('oro'); ed.sel.modello = null; } this.aggiorna(); },
      eff: () => { const s = ed.sel.extra; s.has(v) ? s.delete(v) : s.add(v); if (v === 'oro' && s.has('oro')) { ed.sel.squadra = null; ed.sel.modello = null; } this.aggiorna(); },
      modello: () => {
        const p = this.occupato(ed.casa, v);
        if (p) return this.ui.aviso(`${this.D.luoghi[ed.casa.luogo].nome} already has one: @${p.conta}'s. Pick another!`);
        ed.sel.modello = ed.sel.modello === v ? null : v;
        if (ed.sel.modello) { ed.sel.squadra = null; ed.sel.extra.delete('oro'); }
        this.aggiorna();
      },
      notte: () => { this.mappa.definirNotte(v === '1'); if (this.festa?.luci) this.festa.luci.visible = v === '1'; },
      salva: () => (this.ui.conto?.p ? this.salva(t) : (this.ui.aviso('Sign in to your account to decorate.'), this.ui.conto?.apri())),
      fuori: () => { const ps = this.ui.passeggio; if (ps?.ativo) { ps.esci(); setTimeout(() => this.apri(v), 1000); } else this.apri(v); },
      checkout: () => this.checkout(),
      paga: () => this.paga(t),
      indietro: () => this.editor(ed.modo, ed.casa, true),
      home: () => this.home(),
    })[d.dp]?.();
  }

  home() {
    this.annulla(); this.ferma(); document.body.classList.remove('decora-edit');
    this.ui.abrir(`
      <h2>Make a house special ✨</h2>
      <div class="sub">Try it <b>free</b> here on the map. With credits it's <b>forever</b>: your home ${num(this.ui.conto?.cfg?.interni?.prezzo ?? 990)} 💰 (inside and out), a gift ${num(this.prezzoRegalo())} 💰.</div>
      <div class="scelta2">
        <button data-dp="mia"><span class="em">🏠</span><span><b>My house</b><small>A rare house (castle, lighthouse, windmill…), your team's colours, golden house, crown…</small></span></button>
        <button data-dp="regalo"><span class="em">🎁</span><span><b>Send a mate a gift</b><small>A surprise on their house, with your name on it</small></span></button>
      </div>
      <div class="regola">✅ Looks only: decorations don't give points. The players always choose the Prime Minister and the Mayors.</div>`);
  }
  // botão do painel da casa: casa de outra pessoa = presente; a sua = decorar
  apri(conta) {
    const casa = this.D.porConta.get(conta);
    if (casa) this.editor(this.ui.conto?.p?.conta === conta ? 'mia' : 'regalo', casa);
  }
  // preço do presente: 490 💰 para quem tem "your home", 990 💰 para quem não tem
  prezzoRegalo() { const c = this.ui.conto, d = c?.cfg?.decora ?? { regalo_con_casa: 490, regalo: 990 }; return (c?.p?.oggetti ?? []).includes('interni') ? d.regalo_con_casa : d.regalo; }
  // salva a decoração (própria: grátis com a casa; presente: 490/990 💰). Para sempre, sem pontos.
  async salva(botao) {
    const ed = this.ed, conto = this.ui.conto;
    if (!conto?.p) { this.ui.aviso('Sign in to your account to decorate.'); return conto?.apri(); }
    const mia = ed.modo === 'mia', haCasa = (conto.p.oggetti ?? []).includes('interni');
    if (mia && !haCasa) {   // ainda não tem a casa: compra (990) e já salva
      const prezzo = conto.cfg?.interni?.prezzo ?? 990;
      if (!(await conto.compra('interni', 'your home (inside and out)', prezzo, 'Decorate it inside and out whenever you like, forever. 5 pieces of furniture free.'))) return;
    } else if (!mia) {
      const pr = this.prezzoRegalo(), manca = pr - (conto.p.saldo ?? 0);
      if (manca > 0) { if (confirm(`The gift costs ${num(pr)} 💰: you need ${num(manca)} 💰 more.\n\nWould you like to top up your credits?`)) conto.apriRicarica(); return; }
      if (!confirm(`Give this decoration to @${ed.casa.conta} for ${num(pr)} 💰?\nIt stays on their house forever${conto.p.conta ? `, with “🎁 from @${conto.p.conta}”` : ''}.`)) return;
    }
    botao.disabled = true;
    try {
      conto.p = (await conto.api('decora', { conta: ed.casa.conta, squadra: ed.sel.squadra ?? '', modello: ed.sel.modello ?? '', extra: [...ed.sel.extra] })).profilo;
      conto.desenharBotao();
      const casa = ed.casa;
      this.ed = null;
      await this.ricaricaProprieta();
      this.ridisegna(casa.conta);
      this.coriandoli();
      this.ui.aviso(mia ? '✨ Your house is decorated, forever!' : `🎁 Gift delivered to @${casa.conta}!`);
      this.ui.casa(casa, false);
    } catch (e) { botao.disabled = false; this.ui.aviso(e.message); }
  }

  scegli(modo) {
    this.ui.abrir(`
      <h2>${modo === 'regalo' ? 'Who is the gift for? 🎁' : 'Which house is yours? 🏠'}</h2>
      <div class="sub">${modo === 'regalo' ? 'Type their Instagram @: they need a house on the map already.' : 'Type your Instagram @.'}</div>
      <div class="cerca-dec"><span>@</span><input id="dec-q" placeholder="${modo === 'regalo' ? 'their_account' : 'your_account'}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <div class="sugg-dec" id="dec-sugg"></div>
      <div class="bottoni"><button class="sec" data-dp="home">← back</button></div>`);
    const q = $('#dec-q'), out = $('#dec-sugg');
    q.oninput = () => {
      const t = q.value.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) { out.innerHTML = ''; return; }
      const res = [];
      for (const c of this.D.casas) { if (c.conta.startsWith(t)) res.push(c); if (res.length >= 6) break; }
      out.innerHTML = res.length ? res.map(c => `<button data-dp="scelto" data-modo="${modo}" data-v="${esc(c.conta)}">@${esc(c.conta)}<small>${esc(this.D.luoghi[c.luogo].nome)}</small></button>`).join('')
        : '<div class="nota">No house with that @. To get one, just comment your town and country under one of our posts.</div>';
    };
    setTimeout(() => q.focus(), 50);
  }

  editor(modo, casa, manter = false) {
    if (!casa) return;
    if (!manter || !this.ed) {
      this.annulla();
      const b = this.base(casa.conta), sua = modo === 'mia' && !b.da;
      this.ed = { modo, casa, sel: sua ? b.sel : vuota(), da: modo === 'regalo' ? (this.ui.conto?.p?.conta ?? null) : null };
    }
    const ed = this.ed;
    this.vaiACasa(casa);
    const l = this.D.luoghi[casa.luogo], regalo = modo === 'regalo';
    const eff = EFFETTI.filter(e => (regalo ? e.regalo : e.mia)), d = this.prop.decori.get(casa.conta);
    this.ui.abrir(`
      <div class="tag-luogo">📍 ${esc(l.nome)}</div>
      <h2 class="conta">${regalo ? '🎁 ' : '🎨 '}@${esc(casa.conta)}</h2>
      <div class="sub">${regalo ? 'Tap a gift: you\'ll see it on their house straight away. It stays forever.' : 'Tap and watch your house change. You can change it whenever you like.'}</div>
      ${regalo && d?.da ? `<div class="regola">🎁 Already has a gift from @${esc(d.da)}: yours replaces it.</div>` : ''}
      <div class="gruppo-dec raro">🏰 Rare houses <small>· one of a kind in your town</small></div>
      <div class="griglia-dec rare">${SPECIALI.map(m => { const p = this.occupato(casa, m.id); const cls = [p && 'preso', m.oro && 'dorato'].filter(Boolean).join(' '); return `<button data-dp="modello" data-v="${m.id}"${cls ? ` class="${cls}"` : ''}>${m.novo ? '<i class="novo">NEW</i>' : ''}<span class="em">${m.em}</span><b>${m.nome}</b>${p ? '<small>🔒 taken</small>' : ''}</button>`; }).join('')}</div>
      ${regalo ? '' : `<div class="gruppo-dec">⚽ Your team's colours</div>
      <div class="griglia-dec">${SQUADRE.map(s => `<button data-dp="squadra" data-v="${s.id}"><span class="sw" style="background:linear-gradient(90deg,${s.muro} 0 25%,${s.tetto} 25% 50%,${s.muro} 50% 75%,${s.tetto} 75%)"></span><b>${s.nome}</b></button>`).join('')}</div>`}
      <div class="gruppo-dec">${regalo ? '🎁 Pick the gift' : '✨ Effects'} <small>· pick as many as you like</small></div>
      <div class="griglia-dec">${eff.map(e => `<button data-dp="eff" data-v="${e.id}"><span class="em">${e.em}</span><b>${e.nome}</b></button>`).join('')}</div>
      <div class="riga-vista"><button data-dp="notte" data-v="0">☀️ By day</button><button data-dp="notte" data-v="1">🌙 By night</button></div>
      <div class="conto-dec" id="dec-conto"></div>`);
    this.aggiorna();
  }

  aggiorna(ridisegna = true) {
    const ed = this.ed;
    if (!ed) return;
    const painel = $('#pannello-contenuto');
    painel.querySelectorAll('[data-dp="squadra"]').forEach(b => b.classList.toggle('on', ed.sel.squadra === b.dataset.v));
    painel.querySelectorAll('[data-dp="eff"]').forEach(b => b.classList.toggle('on', ed.sel.extra.has(b.dataset.v)));
    painel.querySelectorAll('[data-dp="modello"]').forEach(b => b.classList.toggle('on', ed.sel.modello === b.dataset.v));
    const regalo = ed.modo === 'regalo', conto = this.ui.conto, haCasa = (conto?.p?.oggetti ?? []).includes('interni');
    if (ridisegna) this.disegna(ed.casa, this.unisci(ed.casa.conta, ed.sel), regalo ? (ed.da || '…') : null);
    const n = quanti(ed.sel);
    let tit, sub;
    if (!conto?.p) { tit = '👤 Sign in to decorate'; sub = 'you need an account (free)'; }
    else if (regalo) { tit = `🎁 Give it · ${num(this.prezzoRegalo())} 💰`; sub = `forever${haCasa ? ' · special price: you\'ve got your home' : ' · 490 💰 if you\'ve got your home'}`; }
    else if (haCasa) { tit = '✅ Save · it\'s yours forever'; sub = 'change it whenever you like, free'; }
    else { tit = `🏠 Unlock your home · ${num(conto.cfg?.interni?.prezzo ?? 990)} 💰`; sub = 'decorate it inside and out, forever'; }
    $('#dec-conto').innerHTML = `<button class="paga-dec" data-dp="salva" ${n || (!regalo && haCasa) ? '' : 'disabled'}>${n || (!regalo && haCasa) ? tit : 'Pick at least one effect'}<small>${sub}</small></button>
      <p class="nota" style="text-align:center;margin-top:6px">Looks only: decorations don't give points.</p>`;
  }

  // compras antigas em £ (Stripe): o fluxo fica para quem voltar do pagamento; a loja nova é com créditos
  checkout() {
    const ed = this.ed, n = quanti(ed.sel);
    this.ferma();
    this.ui.abrir(`
      <h2>Nearly there! 🔒</h2>
      <div class="sub">${ed.modo === 'regalo' ? `Gift for @${esc(ed.casa.conta)} from @${esc(ed.da)}` : `@${esc(ed.casa.conta)}'s house`} · ${n} ${n === 1 ? 'effect' : 'effects'} · ${this.cfg.giorni} days · <b>${eur(this.cfg.prezzo)}</b> (VAT included)</div>
      <label class="consenso-dec"><input type="checkbox" id="dec-ok"><span>I want the decoration to start straight after payment, and I understand I lose my 14-day right to cancel once it starts. I've read the <a href="terms.html#purchases" target="_blank" rel="noopener">terms</a> and the <a href="privacy.html#decorazioni" target="_blank" rel="noopener">privacy notice</a>.</span></label>
      <div class="regola">👨‍👩‍👧 Under 18? Ask a parent or carer before paying.</div>
      <button class="paga-dec" data-dp="paga" style="margin-top:12px">Go to secure checkout · ${eur(this.cfg.prezzo)}<small>${this.stripe ? 'card, Apple Pay, Google Pay · secure checkout by Stripe' : 'card, PayPal, Google Pay · via Hotmart'}</small></button>
      <div class="bottoni"><button class="sec" data-dp="indietro">← back</button></div>`);
  }

  async paga(botao) {
    const ed = this.ed;
    if (!$('#dec-ok')?.checked) return this.ui.aviso('Tick the box to carry on.');
    if (!this.stripe && !this.cfg.checkout) return this.ui.aviso('Payment isn\'t available yet. Please try again later.');
    botao.disabled = true;
    try {
      const r = await fetch('api/decora.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: ed.casa.conta, modo: ed.modo, da: ed.modo === 'regalo' ? ed.da : '', squadra: ed.sel.squadra ?? '', modello: ed.sel.modello ?? '', extra: [...ed.sel.extra], prova: this.prova ?? '' }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro || 'We couldn\'t set up the payment. Please try again.');
      gravar('decora_attesa', { id: j.id, conta: ed.casa.conta, modo: ed.modo, da: ed.da, sel: { squadra: ed.sel.squadra, modello: ed.sel.modello, extra: [...ed.sel.extra] }, t: Date.now() });
      location.href = j.url ?? `${this.cfg.checkout}${this.cfg.checkout.includes('?') ? '&' : '?'}sck=${j.id}`;
    } catch (e) {
      botao.disabled = false;
      this.ui.aviso(e.message);
    }
  }

  // de volta do pagamento: confere o data/decori.json até o webhook confirmar (ou desistir em 3 h)
  aspetta(at) {
    let avisou = false;
    const tenta = async () => {
      await this.ricarica();
      if ([...this.pagate.values()].some(x => x.id === at.id)) { gravar('decora_attesa', null); return this.fatto(at); }
      if (Date.now() - at.t > 3 * 3600e3) return gravar('decora_attesa', null);
      if (!avisou) { avisou = true; this.ui.aviso('⏳ Waiting for the payment to be confirmed…'); }
      setTimeout(tenta, 15000);
    };
    tenta();
  }

  async fatto(at) {
    const casa = this.D.porConta.get(at.conta), p = this.pagate.get(at.conta);
    if (!casa || !p) return;
    this.coriandoli();
    this.vaiACasa(casa);
    const regalo = !!p.da, emoji = emojiDi(p.sel);
    this.ui.abrir(`
      <h2>${regalo ? 'Gift delivered! 🎁' : 'Sorted! Your house is shining ✨'}</h2>
      <div class="sub">${regalo ? `@${esc(casa.conta)} sees it as soon as they open the map. Send them the story and tag them! 👇` : `Everyone can see it on the map now, until ${dataCurta(p.scade)}.`}</div>
      <div class="anteprima vuota" id="dec-img">making your story…</div>
      <div class="bottoni"><button class="sec" data-dp="home">✨ Decorate another house</button></div>`);
    await new Promise(r => setTimeout(r, 1800));   // espera o voo da câmera
    const url = await this.storia(casa, regalo ? '🎁 A gift for' : 'My house is special ✨', `@${casa.conta}${regalo ? '!' : ''}`, regalo ? `${emoji} from @${p.da}` : `${emoji} ${this.D.luoghi[casa.luogo].nome}`.trim());
    const box = $('#dec-img');
    if (box) box.outerHTML = `<img class="anteprima" src="${url}" alt="storia"><a class="botao" download="${regalo ? 'gift' : 'my-house'}.png" href="${url}">⬇️ Download the story</a>`;
  }

  coriandoli() {
    const box = document.createElement('div'); box.className = 'coriandoli';
    const cores = ['#E0473C', '#FFC93C', '#3FA7F5', '#2E9B55', '#FF7EB6', '#7B2CBF'];
    for (let i = 0; i < 70; i++) { const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = cores[i % cores.length]; c.style.animationDelay = `${Math.random() * 0.6}s`; box.appendChild(c); }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // imagem de story 1080x1920: foto 3D da casa decorada + textos
  async storia(casa, t1, t2, t3) {
    await document.fonts.load('900 80px Nunito');
    const p = this.citta.posCasa(casa), topo = topoDi(casa, this.attive.get(casa.conta)?.sel ?? vuota()) * LOTE, notte = !!this.mappa.notte;
    const f = this.ui.fot.foto({ x: p.x, z: p.z, y: p.y + topo * 0.45, dist: 0.09 + topo * 2.6, az: this.mappa.az, el: 0.38, w: 1000, h: 1000 });
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
    const g = cv.getContext('2d');
    const fundo = g.createLinearGradient(0, 0, 0, 1920); fundo.addColorStop(0, notte ? '#1E3560' : '#86AFC4'); fundo.addColorStop(1, notte ? '#0E1A33' : '#5E9DB8');
    g.fillStyle = fundo; g.fillRect(0, 0, 1080, 1920);
    const testo = (s, y, size, cor) => {
      let sz = size; g.font = `900 ${sz}px Nunito`;
      while (g.measureText(s).width > 980 && sz > 40) { sz -= 4; g.font = `900 ${sz}px Nunito`; }
      g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = sz * 0.2; g.strokeStyle = '#152033'; g.strokeText(s, 540, y); g.fillStyle = cor; g.fillText(s, 540, y);
    };
    testo(t1, 260, 92, '#FFFFFF');
    testo(t2, 380, 100, '#FFC93C');
    g.save(); g.beginPath(); g.roundRect(40, 470, 1000, 1000, 48); g.clip(); g.drawImage(f.canvas, 40, 470, 1000, 1000); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#152033'; g.beginPath(); g.roundRect(40, 470, 1000, 1000, 48); g.stroke();
    testo(t3, 1590, 70, '#FFFFFF');
    testo(`ukhousebyhouse.com · @${PERFIL}`, 1760, 52, '#FFC93C');
    return cv.toDataURL('image/png');
  }
}
