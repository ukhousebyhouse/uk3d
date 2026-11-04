// Casa decorada: cores de time, ouro, neon, coroa, fogos, cores da Union Jack... na própria casa ou de presente para um amigo.
// Ou uma casa rara (speciali.js): farol, castelo, moinho... só uma de cada por cidade ao mesmo tempo.
// Só estética (não dá pontos). Compras pagas ficam em data/decori.json (reescrito pelo webhook da Hotmart a cada pagamento).
// Teste antes do lançamento: ?decora=1 mostra o botão mesmo com "decora.attivo": false em data/negozio.json.
import * as THREE from 'three';
import { geometriaCasa, ALTURA_NIVEL, stileRegione, aspetto, CORI_CASA } from './modelli.js';
import { SPECIALI, costruisciSpeciale, altezzaSpeciale } from './speciali.js';
import { LOTE, posLote } from './citta.js';
import { PERFIL } from './storie.js';

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

// altura total com o que flutua e os fogos (em lotes; para enquadrar a câmera)
const topoDi = (casa, sel) => {
  const ex = sel.extra, h = altezza(casa, sel);
  const y = h + 0.25 + (ex.has('corona') ? 0.35 : 0) + (ex.has('campione') ? 0.42 : 0) + (ex.has('ufo') ? 0.45 : 0);
  const base = Math.max(y, ex.has('palloncini') ? h * 0.75 + 0.6 : 0, ex.has('arcobaleno') ? raioArco(h) : 0, ex.has('cuori') ? h * 1.1 + 0.6 : 0);
  return ex.has('fuochi') ? Math.max(base, y + 0.9) : base;
};

// monta o grupo 3D da casa decorada: { g, anima, pilha } (pilha = topo do que flutua; o rótulo do @ fica acima)
// (também usado pelos gravadores de reel)
export function costruisci(D, citta, notte, casa, sel) {
  const l = D.luoghi[casa.luogo], stile = stileRegione(l.regione.cod, l.comune.sigla), h = altezza(casa, sel);
  const g = new THREE.Group(), anim = [];
  const p = citta.posCasa(casa);
  g.position.set(p.x, p.y + 0.0009, p.z);
  g.rotation.y = posLote(casa.lote).rot;
  g.scale.setScalar(LOTE);
  const ex = sel.extra, sp = sel.modello ? costruisciSpeciale(sel.modello) : null;
  // casa rara: o modelo troca a casa inteira (sem cores de time). Ouro numa casa rara só vem de prêmio
  // (amministra omaggio; a loja não deixa escolher): as pedras e paredes claras viram ouro
  const oro = ex.has('oro') || !!SPECIALI.find(m => m.id === sel.modello)?.oro, squadra = sp ? null : SQUADRE.find(s => s.id === sel.squadra);
  const base = sp ? (oro ? doura(sp.geo) : sp.geo) : geoCasa(casa.livello, variante(casa), stile);
  const pal = sp ? null : oro ? ORO : squadra;
  const corpo = new THREE.Mesh(pal ? ricolora(base, pal) : base, oro ? matOro : citta.mat);
  g.add(corpo);
  if (sp?.extra) g.add(sp.extra);
  if (sp?.anima) anim.push(t => sp.anima(t, notte()));
  // bandeira: num mastro ao lado da casa; nas torres (casa alta), no terraço
  const pianta = (b, lado) => {
    if (h > 1.5) { b.position.set(lado * 0.12, h - 0.05, 0); b.scale.setScalar(0.8); }
    else { b.position.set(lado * 0.38, 0, 0.36); b.scale.setScalar(Math.max(1, h * 0.9)); }
    g.add(b);
  };
  if (squadra) { const b = bandiera([squadra.muro, squadra.tetto, squadra.muro, squadra.tetto]); pianta(b, -1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004) * 0.35; }); }
  if (ex.has('tricolore')) { const b = bandiera(['#C8102E', '#FFFFFF', '#1F3A6B']); pianta(b, 1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004 + 1) * 0.35; }); }
  if (oro) {
    const s = scintille(); g.add(s); g.add(alone('#FFC93C'));
    anim.push(t => {
      matOro.emissive.set(notte() ? '#9C7608' : '#4A3600'); oroMat.emissive.set(notte() ? '#B38A10' : '#5A4300');
      s.children.forEach(c => { const k = c.userData.k, a = t * 0.0009 + k * 0.63; c.position.set(Math.cos(a) * 0.55, 0.15 + ((k * 0.37) % 1) * (h + 0.3), Math.sin(a) * 0.55); c.rotation.y = t * 0.004; c.scale.setScalar(0.5 + 0.6 * Math.abs(Math.sin(t * 0.005 + k))); });
    });
  }
  if (ex.has('neon')) {
    const m = new THREE.MeshBasicMaterial({ color: '#00E5FF', side: THREE.BackSide });
    const guscio = new THREE.Mesh(corpo.geometry, m);
    guscio.scale.set(1.07, 1.035, 1.07); guscio.position.y = -0.01; g.add(guscio);
    const a = alone('#00E5FF'); g.add(a);
    anim.push(t => { m.color.setHSL((t * 0.00012) % 1, 1, 0.55); a.material.color.copy(m.color); });
  }
  // coisas que flutuam em cima da casa, uma acima da outra
  let y = h + 0.25;
  if (ex.has('corona')) { const c = corona(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003) * 0.04, 0); c.rotation.y = t * 0.0012; }); y += 0.35; }
  if (ex.has('campione')) { const c = trofeo(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003 + 1) * 0.04, 0); c.rotation.y = -t * 0.001; }); y += 0.42; }
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

export class Decori {
  constructor(D, mappa, citta, festa) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.festa = festa;
    this.ui = null;              // ligado pelo main.js depois de criar a UI
    this.pagate = new Map();     // conta -> { id, conta, da, sel, scade } (data/decori.json)
    this.attive = new Map();     // conta -> { casa, sel, da, g, anima, pilha } (desenhadas agora: pagas + prévia)
    this.ed = null;              // edição aberta: { modo, casa, sel, da }
    this.giro = null;            // câmera girando em volta da casa
    this.cfg = { attivo: false, prezzo: 499, giorni: 10, checkout: '', provedor: 'hotmart' };
    // teste da Stripe antes da troca: ?stripe=<código> fica guardado neste aparelho até pagar
    const q = new URLSearchParams(location.search).get('stripe');
    if (q) gravar('stripe_prova', q);
    this.prova = ler('stripe_prova');
    this.ANIM = {}; this.GIRO = {};
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
    await this.ricarica();
    if (this.aperto && location.hash === '#decora') this.home();   // link da página do produto na Hotmart
    setInterval(() => this.ricarica(), 120e3);
    // voltou do pagamento: espera o webhook confirmar
    const at = ler('decora_attesa');
    if (at && Date.now() - at.t < 3 * 3600e3) this.aspetta(at);
    else gravar('decora_attesa', null);
  }

  // ---------- compras pagas (data/decori.json) ----------
  async ricarica() {
    let lista = [];
    try { const r = await fetch(`data/decori.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) lista = (await r.json()).decori ?? []; } catch { /* sem arquivo ainda */ }
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
      const p = novas.get(conta);
      this.disegna(this.D.porConta.get(conta), p ? p.sel : vuota(), p?.da);
    }
    // painel dessa casa aberto (ex.: ?casa= no carregamento): refaz para mostrar o selo
    const aberta = !this.ed && !this.ui.painel.hidden && $('#pannello h2.conta')?.textContent.slice(1);
    if (aberta && (vecchie.has(aberta) || novas.has(aberta))) this.ui.casa(this.D.porConta.get(aberta), false);
  }
  pagata(conta) { const p = this.pagate.get(conta); return p && p.scade > Date.now() ? p : null; }
  // casa rara já tomada nesta cidade por outra conta (só uma de cada por cidade): a compra ativa, ou null
  occupato(casa, id) {
    for (const p of this.pagate.values()) if (p.sel.modello === id && p.conta !== casa.conta && p.scade > Date.now() && this.D.porConta.get(p.conta)?.luogo === casa.luogo) return p;
    return null;
  }

  // ---------- desenho ----------
  // tira a casa do InstancedMesh da cidade (a cidade é remontada) e desenha a versão decorada; sel vazia = casa normal
  disegna(casa, sel, da = null) {
    if (!casa) return;
    const c = this.citta, l = this.D.luoghi[casa.luogo], velha = this.attive.get(casa.conta);
    if (velha) c.grupo.remove(velha.g);
    const tinha = c.nascoste.has(casa.conta), vazia = !quanti(sel), eraRara = c.speciali.has(casa.conta), rara = !vazia && !!sel.modello;
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
    let alguma = false;
    for (const a of this.attive.values()) { a.g.visible = perto.has(this.D.luoghi[a.casa.luogo]); alguma ||= a.g.visible; }
    if (alguma) this.mappa.animatori.add(this.ANIM); else this.mappa.animatori.delete(this.ANIM);
  }
  quadro(t) {
    for (const a of this.attive.values()) if (a.g.visible) a.anima(t);
    if (this.giro && !this.mappa.voo) { this.giro.az += 0.0022; this.inquadra(this.giro.casa, this.giro.az); }
  }

  // rótulo do @ das casas decoradas (etichette.js): moldura dourada e/ou "🎁 da @fulano"; null = casa normal
  etichetta(casa) {
    const a = this.attive.get(casa.conta);
    if (!a) return null;
    const fogo = casa.fiamme > Date.now() / 1000, base = `${fogo ? '🔥 ' : ''}@${esc(casa.conta)}`, cornice = a.sel.extra.has('cornice');
    const y = casa.y + (a.pilha + 0.25) * LOTE;
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
    const p = this.pagata(casa.conta);
    if (!p) return '';
    return p.da ? `<span class="badge regalo">🎁 Gift from @${esc(p.da)} · until ${dataCurta(p.scade)}</span>` : `<span class="badge regalo">✨ Special house until ${dataCurta(p.scade)}</span>`;
  }
  bottone(casa, eMinha) {
    if (!this.aperto) return '';
    return eMinha ? `<button class="decora-btn" data-decora="${esc(casa.conta)}" data-modo="mia">✨ Decorate your house</button>`
      : `<button class="decora-btn" data-decora="${esc(casa.conta)}">🎁 Send a gift to @${esc(casa.conta)}</button>`;
  }

  // ---------- câmera ----------
  enquadra(casa) {
    const sel = this.attive.get(casa.conta)?.sel ?? vuota(), topo = topoDi(casa, sel) * LOTE;
    return { d: 0.24 + topo * 3.4, k: innerWidth >= 900 ? [-0.32, 0] : [0, altezza(casa, sel) > 1.5 ? 0.05 : 0.2] };
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
  // fechou o painel: desfaz a prévia não paga (ui.fechar chama)
  chiudi() {
    this.annulla(); this.ferma();
    document.body.classList.remove('decora-edit');
  }
  annulla() {
    if (!this.ed) return;
    const casa = this.ed.casa, p = this.pagata(casa.conta);
    this.ed = null;
    this.disegna(casa, p ? copia(p.sel) : vuota(), p?.da);
  }

  // ---------- pílula ----------
  ligarPillola() {
    const b = $('#decora'), velho = $('#fai-video');
    if (!b) return;
    b.hidden = false;
    if (velho) velho.hidden = true;
    const testo = b.querySelector('.testo'), frasi = ['✨ Decorate your house', '🏰 Get a rare house', '🎁 Send a mate a gift'];
    let i = 0;
    setInterval(() => { testo.classList.add('via'); setTimeout(() => { i = (i + 1) % frasi.length; testo.textContent = frasi[i]; testo.classList.remove('via'); }, 250); }, 3200);
    b.onclick = () => this.home();
  }

  // ---------- telas ----------
  azione(t) {
    const d = t.dataset, v = d.v, ed = this.ed;
    ({
      mia: () => (this.ui.minha && this.D.porConta.get(this.ui.minha) ? this.editor('mia', this.D.porConta.get(this.ui.minha)) : this.scegli('mia')),
      regalo: () => this.scegli('regalo'),
      scelto: () => this.editor(d.modo, this.D.porConta.get(v)),
      squadra: () => { ed.sel.squadra = ed.sel.squadra === v ? null : v; if (ed.sel.squadra) { ed.sel.extra.delete('oro'); ed.sel.modello = null; } this.aggiorna(); },
      eff: () => { const s = ed.sel.extra; s.has(v) ? s.delete(v) : s.add(v); if (v === 'oro' && s.has('oro')) { ed.sel.squadra = null; ed.sel.modello = null; } this.aggiorna(); },
      modello: () => {
        const p = this.occupato(ed.casa, v);
        if (p) return this.ui.aviso(`${this.D.luoghi[ed.casa.luogo].nome} already has one: @${p.conta}'s, until ${dataCurta(p.scade)}. Pick another!`);
        ed.sel.modello = ed.sel.modello === v ? null : v;
        if (ed.sel.modello) { ed.sel.squadra = null; ed.sel.extra.delete('oro'); }
        this.aggiorna();
      },
      notte: () => { this.mappa.definirNotte(v === '1'); if (this.festa?.luci) this.festa.luci.visible = v === '1'; },
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
      <div class="sub">Try it <b>free</b> here on the map. Only pay if you love it: <b>${eur(this.cfg.prezzo)}</b>, VAT included, for ${this.cfg.giorni} days.</div>
      <div class="scelta2">
        <button data-dp="mia"><span class="em">🏠</span><span><b>My house</b><small>A rare house (castle, lighthouse, windmill…), your team's colours, golden house, crown…</small></span></button>
        <button data-dp="regalo"><span class="em">🎁</span><span><b>Send a mate a gift</b><small>A surprise on their house, with your name on it</small></span></button>
      </div>
      <div class="regola">✅ Looks only: no points and no change to the league table. The players always win.</div>`);
  }
  // botão do painel da casa: casa de outra pessoa = presente; a sua = decorar
  apri(conta, modo) {
    const casa = this.D.porConta.get(conta);
    if (casa) this.editor(modo === 'mia' || this.ui.minha === conta ? 'mia' : 'regalo', casa);
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
      const p = this.pagata(casa.conta);
      this.ed = { modo, casa, sel: p && !p.da && modo === 'mia' ? copia(p.sel) : vuota(), da: modo === 'regalo' ? (this.ui.minha ?? '') : null };
    }
    const ed = this.ed;
    this.vaiACasa(casa);
    const l = this.D.luoghi[casa.luogo], regalo = modo === 'regalo';
    const eff = EFFETTI.filter(e => (regalo ? e.regalo : e.mia)), p = this.pagata(casa.conta);
    this.ui.abrir(`
      <div class="tag-luogo">📍 ${esc(l.nome)}</div>
      <h2 class="conta">${regalo ? '🎁 ' : ''}@${esc(casa.conta)}</h2>
      <div class="sub">${regalo ? 'Tap a gift: you\'ll see it on their house straight away.' : 'Tap and watch your house change. It\'s just a preview.'}</div>
      ${p ? `<div class="regola">${p.da ? `🎁 Already has a gift from @${esc(p.da)}` : '✨ Already decorated'} until ${dataCurta(p.scade)}: a new purchase replaces it.</div>` : ''}
      ${regalo ? `<div class="cerca-dec"><span>from @</span><input id="dec-da" placeholder="your_account" value="${esc(ed.da ?? '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></div><div class="nota" id="dec-da-nota" style="margin-top:4px"></div>` : ''}
      <div class="gruppo-dec">🏰 Rare houses <small>· only one of each per town</small></div>
      <div class="griglia-dec">${SPECIALI.map(m => { const p = this.occupato(casa, m.id); const cls = [p && 'preso', m.oro && 'dorato'].filter(Boolean).join(' '); return `<button data-dp="modello" data-v="${m.id}"${cls ? ` class="${cls}"` : ''}>${m.novo ? '<i class="novo">NEW</i>' : ''}<span class="em">${m.em}</span><b>${m.nome}</b>${p ? '<small>🔒 taken</small>' : ''}</button>`; }).join('')}</div>
      ${regalo ? '' : `<div class="gruppo-dec">⚽ Your team's colours</div>
      <div class="griglia-dec">${SQUADRE.map(s => `<button data-dp="squadra" data-v="${s.id}"><span class="sw" style="background:linear-gradient(90deg,${s.muro} 0 25%,${s.tetto} 25% 50%,${s.muro} 50% 75%,${s.tetto} 75%)"></span><b>${s.nome}</b></button>`).join('')}</div>`}
      <div class="gruppo-dec">${regalo ? '🎁 Pick the gift' : '✨ Effects'} <small>· pick as many as you like</small></div>
      <div class="griglia-dec">${eff.map(e => `<button data-dp="eff" data-v="${e.id}"><span class="em">${e.em}</span><b>${e.nome}</b></button>`).join('')}</div>
      <div class="riga-vista"><button data-dp="notte" data-v="0">☀️ By day</button><button data-dp="notte" data-v="1">🌙 By night</button></div>
      <div class="conto-dec" id="dec-conto"></div>`);
    $('#dec-da')?.addEventListener('input', e => { ed.da = e.target.value.trim().replace(/^@/, '').toLowerCase(); this.aggiorna(false); });
    this.aggiorna();
  }

  okDa() { const e = this.ed; return e.modo !== 'regalo' || (!!e.da && this.D.porConta.has(e.da) && e.da !== e.casa.conta); }
  aggiorna(ridisegna = true) {
    const ed = this.ed;
    if (!ed) return;
    const painel = $('#pannello-contenuto');
    painel.querySelectorAll('[data-dp="squadra"]').forEach(b => b.classList.toggle('on', ed.sel.squadra === b.dataset.v));
    painel.querySelectorAll('[data-dp="eff"]').forEach(b => b.classList.toggle('on', ed.sel.extra.has(b.dataset.v)));
    painel.querySelectorAll('[data-dp="modello"]').forEach(b => b.classList.toggle('on', ed.sel.modello === b.dataset.v));
    const regalo = ed.modo === 'regalo', okDa = this.okDa();
    if (ridisegna) this.disegna(ed.casa, ed.sel, regalo ? (ed.da || '…') : null);
    else { const a = this.attive.get(ed.casa.conta); if (a) a.da = ed.da || '…'; }
    const nota = $('#dec-da-nota');
    if (nota) nota.textContent = !ed.da ? 'Your @ will show above the house: you need a house on the map.' : okDa ? `✓ It'll say “🎁 from @${ed.da}”` : ed.da === ed.casa.conta ? 'You can\'t gift yourself: use “My house”.' : 'That @ hasn\'t got a house on the map yet.';
    const n = quanti(ed.sel);
    $('#dec-conto').innerHTML = `
      <button class="paga-dec" data-dp="checkout" ${n && okDa ? '' : 'disabled'}>${n ? `${regalo ? '🎁 Send the gift' : '✨ Show everyone'} · ${eur(this.cfg.prezzo)}` : 'Pick at least one effect'}
        <small>${n && !okDa ? 'type your @ above' : `VAT included · everyone sees it for ${this.cfg.giorni} days`}</small></button>`;
  }

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
      // Stripe: o servidor devolve a página de pagamento; Hotmart: link fixo com o id do pedido
      location.href = j.url ?? `${this.cfg.checkout}${this.cfg.checkout.includes('?') ? '&' : '?'}sck=${j.id}`;
    } catch (e) {
      botao.disabled = false;
      this.ui.aviso(e.message);
    }
  }

  // de volta da Hotmart: confere o data/decori.json até o webhook confirmar (ou desistir em 3 h)
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
