// Modelos low-poly (cores por vértice). Casas em "unidades de lote" (1 = um lote), frente virada para +z.
// Arquitetura britânica: tijolo e ardósia, sash windows brancas, chaminés com potes de barro; cada nação com o seu estilo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const T = {
  muri: ['#A94A34', '#B85A3E', '#9A4430'],    // tijolo vermelho
  tetto: '#4E5866', tettoScuro: '#3E4652', verde: '#2E5E3A', porta: '#1F3A6B', vetro: '#7FA9C2',
  pietra: '#B9B2A3', bianco: '#F4F1EA', oro: '#F2C230', acqua: '#5FA8C8', foglia: '#3F8A44', ulivo: '#8FA36A',
  cipresso: '#2F6B3A', tronco: '#6E4A2D', grigio: '#9AA3AE', siepe: '#3F7F3A', scuro: '#2A2E36', rosso: '#C8102E', navy: '#1F3A6B',
  vetroSash: '#6E95AE', vaso: '#C8693A', paglia: '#B8955A', pagliaScura: '#9C7C48', legnoTudor: '#3A2A1E', stucco: '#F1EADB',
};

function pintar(g, cor) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const c = new THREE.Color(cor), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function deTriangulos(v) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  return g;
}

export class Construtor {
  constructor() { this.partes = []; }
  add(g, cor, x, y, z, ry = 0) {
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.partes.push(pintar(g, cor));
    return this;
  }
  caixa(w, h, d, x, y, z, cor, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z, ry); }
  // telhado de duas águas, cumeeira ao longo de x
  telhado(w, d, h, x, y, z, cor, ry = 0) {
    const a = w / 2, b = d / 2;
    return this.add(deTriangulos([
      -a, 0, b, a, 0, b, a, h, 0, -a, 0, b, a, h, 0, -a, h, 0,
      a, 0, -b, -a, 0, -b, -a, h, 0, a, 0, -b, -a, h, 0, a, h, 0,
      -a, 0, -b, -a, 0, b, -a, h, 0,
      a, 0, b, a, 0, -b, a, h, 0,
      -a, 0, -b, a, 0, -b, a, 0, b, -a, 0, -b, a, 0, b, -a, 0, b,
    ]), cor, x, y, z, ry);
  }
  piramide(w, d, h, x, y, z, cor) {
    const a = w / 2, b = d / 2;
    return this.add(deTriangulos([
      -a, 0, b, a, 0, b, 0, h, 0, a, 0, b, a, 0, -b, 0, h, 0,
      a, 0, -b, -a, 0, -b, 0, h, 0, -a, 0, -b, -a, 0, b, 0, h, 0,
    ]), cor, x, y, z);
  }
  cilindro(r, h, x, y, z, cor, seg = 8, rTopo = r) { const g = new THREE.CylinderGeometry(rTopo, r, h, seg); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z); }
  cone(r, h, x, y, z, cor, seg = 6) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z); }
  esfera(r, x, y, z, cor) { return this.add(new THREE.IcosahedronGeometry(r, 0), cor, x, y, z); }
  cupola(r, x, y, z, cor) { return this.add(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cor, x, y, z); }
  quad(w, d, x, y, z, cor) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return this.add(g, cor, x, y, z); }
  geometria() {
    const g = mergeGeometries(this.partes);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- estilos de cada nação (e das regiões da England) ----------
// C = tema em uso enquanto uma casa é montada (geometriaCasa troca e depois volta ao padrão)
// porte: 4 cores de porta; tetto2: o outro telhado ([telhado, telhado escuro]); palha2: a palha mais clara
const TEMI = {
  // England: tijolo vermelho; ardósia ou telha de barro; porta azul-marinho, preta, vermelha ou verde
  eng: { ...T, porte: ['#1F3A6B', '#22252B', '#C8102E', '#2E5E3A'], camino: '#9A4430', tetto2: ['#8A4B3C', '#73402F'] },
  // Cotswolds e Bath: pedra cor de mel, telhado de pedra (ou ardósia)
  cotswold: { ...T, muri: ['#D8B878', '#E2C590', '#CDAE6E'], tetto: '#8E7E62', tettoScuro: '#7A6C54', camino: '#CDAE6E', porte: ['#5E7A6A', '#2E4A3A', '#7A4B2A', '#4A5A7A'], tetto2: ['#6E7178', '#5C5F66'] },
  // sudoeste e East Anglia: chalé caiado com telhado de palha
  thatch: { ...T, muri: ['#F2EEE3', '#F5E9D0', '#EFE6D6'], soloPaglia: true, camino: '#B85A3E', porte: ['#2E5E3A', '#1F3A6B', '#7A4B2A', '#C8102E'], palha2: ['#CBB079', '#AD9260'] },
  // Scotland: granito cinza, empena em degraus (crow-stepped), ardósia escura
  sct: { ...T, muri: ['#9C9E9A', '#B0ADA5', '#8F918D'], tetto: '#3C434D', tettoScuro: '#30363E', gradini: true, camino: '#8F918D', porte: ['#1F3A6B', '#6B1F2A', '#2E5E3A', '#22252B'], baronial: true, tetto2: ['#5A626C', '#4A515A'] },
  // Highlands e ilhas: chalé branco caiado (harled), ardósia ou o telhado vermelho de zinco dos crofts
  highland: { ...T, muri: ['#F1EFE9', '#ECEAE2', '#F4F2EC'], tetto: '#3C434D', tettoScuro: '#30363E', camino: '#E4E1D8', porte: ['#C8102E', '#1F3A6B', '#2E5E3A', '#F2C230'], baronial: true, tetto2: ['#9A3A30', '#7E2F27'] },
  // Wales: fileiras de casas pastel (estilo Tenby) com ardósia galesa
  wls: { ...T, muri: ['#F2B8C6', '#9FD3E6', '#F7DC6F'], tetto: '#454B55', tettoScuro: '#373C44', camino: '#8A8F96', porte: ['#1F3A6B', '#C8102E', '#2E5E3A', '#22252B'], tetto2: ['#5E646E', '#4D535C'] },
  // Northern Ireland: chalé branco com porta de cor viva; palha nas casas pequenas
  nir: { ...T, muri: ['#F5F3EC', '#F0EEE6', '#F7F4EB'], tetto: '#454B55', tettoScuro: '#373C44', camino: '#E4E1D8', porte: ['#C8102E', '#1F6FB5', '#2E7D45', '#F2C230'], pagliaFino: 3, tetto2: ['#5A606A', '#4A5058'], palha2: ['#CBB079', '#AD9260'] },
};
for (const [k, t] of Object.entries(TEMI)) t.stile = k;
TEMI.base = TEMI.eng;
let C = TEMI.base, NIV = 0;

// todas as cores de parede, telhado e porta dos temas (decori.js troca essas pelas cores de time / ouro)
const todas = f => [...new Set(Object.values(TEMI).flatMap(f))];
export const CORI_CASA = {
  muri: todas(t => t.muri),
  tetti: todas(t => [t.tetto, t.tettoScuro, ...(t.tetto2 ?? []), ...(t.palha2 ?? []), T.paglia, T.pagliaScura]),
  porte: todas(t => t.porte),
};

// nação (+ county, para as regiões da England e as Highlands) -> estilo
const THATCH = /Cornwall|Devon|Dorset|Somerset|Wiltshire|Norfolk|Suffolk|Isles of Scilly/;
const COTSWOLD = /Gloucestershire|Oxfordshire|Bath and North East Somerset/;
const HIGHLAND = /Highland|Na h-Eileanan Siar|Argyll and Bute|Orkney|Shetland/;
export const stileRegione = (cod, contea = '') => (cod === 'SCT' ? (HIGHLAND.test(contea) ? 'highland' : 'sct')
  : cod === 'WLS' ? 'wls' : cod === 'NIR' ? 'nir'
    : COTSWOLD.test(contea) ? 'cotswold' : THATCH.test(contea) ? 'thatch' : 'eng');

// ---------- peças ----------
// FINESTRE != null: em vez de montar a casa, só coleta as janelas (acesas à noite), na mesma posição das sash windows
let FINESTRE = null;
// FIORI != null: só coleta as floreiras embaixo das janelas da frente (camada à parte, nas casas que têm flores)
let FIORI = null;
const LUCI = ['#FFD36B', '#FFC24A', '#FFE29A'];
const PETALI = ['#E0473C', '#FF7EB6', '#F2C230', '#9B5DE5', '#FFFFFF', '#FF9F43'];
// sash window: moldura branca, vidro e a barra do meio (onde as duas folhas se encontram)
function persiana(b, x, y, z, lado = 'frente') {
  if (FIORI) {
    if (lado !== 'frente') return;
    const f = new Construtor(), k = FIORI.length;
    f.caixa(0.1, 0.026, 0.034, x, y - 0.026, z + 0.016, k % 2 ? '#F4F1EA' : '#7A5236').caixa(0.092, 0.012, 0.03, x, y, z + 0.016, '#3F7F3A');
    for (let i = 0; i < 4; i++) f.esfera(0.013, x - 0.036 + i * 0.024, y + 0.014, z + 0.02 + (i % 2) * 0.008, PETALI[(k + i * 2) % PETALI.length]);
    FIORI.push(...f.partes);
    return;
  }
  if (FINESTRE) {
    const g = lado === 'frente' ? new THREE.BoxGeometry(0.075, 0.1, 0.024) : new THREE.BoxGeometry(0.024, 0.1, 0.075);
    g.translate(x, y + 0.065, z);
    FINESTRE.push(pintar(g, LUCI[FINESTRE.length % 3]));
    return;
  }
  if (lado === 'frente') {
    b.caixa(0.1, 0.13, 0.02, x, y, z, T.bianco).caixa(0.074, 0.1, 0.022, x, y + 0.015, z, T.vetroSash).caixa(0.074, 0.01, 0.024, x, y + 0.06, z, T.bianco);
  } else {
    b.caixa(0.02, 0.13, 0.1, x, y, z, T.bianco).caixa(0.022, 0.1, 0.074, x, y + 0.015, z, T.vetroSash).caixa(0.024, 0.01, 0.074, x, y + 0.06, z, T.bianco);
  }
}
// chaminé de tijolo/pedra com dois potes de barro
function camino(b, x, y, z, h = 0.14) {
  b.caixa(0.08, h, 0.07, x, y, z, C.camino ?? T.muri[2]).caixa(0.09, 0.015, 0.08, x, y + h, z, C.tettoScuro);
  for (const dx of [-0.018, 0.018]) b.cilindro(0.012, 0.035, x + dx, y + h + 0.015, z, T.vaso, 6);
}
// telhado do tema: palha grossa e arredondada, ou ardósia com empena em degraus na Scotland
function tetto(b, w, d, h, x, y, z) {
  const paglia = C.soloPaglia || NIV < (C.pagliaFino ?? 0);   // (T.paglia é a cor; a opção é soloPaglia)
  const hr = Math.min(w, d) * (paglia ? 0.55 : 0.42);
  if (paglia) {
    b.telhado(w + 0.12, d + 0.12, hr, x, y - 0.02, z, C.paglia ?? T.paglia).telhado(w * 0.6, 0.06, 0.03, x, y + hr - 0.03, z, C.pagliaScura ?? T.pagliaScura);
  } else b.telhado(w + 0.06, d + 0.06, hr, x, y, z, C.tetto);
  if (C.gradini && !paglia) {
    // empena em degraus: blocos de pedra subindo nas duas pontas
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const larg = d * (1 - (k + 1) / 3.6);
      for (const lz of [-1, 1]) b.caixa(0.045, hr * 0.34, 0.06, x + s * (w / 2 - 0.02), y + k * hr * 0.3, z + lz * larg / 2, C.muri[1]);
    }
  }
  return hr;
}
function casaBase(b, w, h, d, x, z, muro, { piani = 1, tetto: comTetto = true, porta = true, cor = muro, camini = 2 } = {}) {
  b.caixa(w, h, d, x, 0, z, cor);
  if (comTetto) {
    const hr = tetto(b, w, d, h, x, h, z);
    if (camini >= 1) camino(b, x + w / 2 - 0.06, h + hr * 0.2, z, hr * 0.8 + 0.06);
    if (camini >= 2) camino(b, x - w / 2 + 0.06, h + hr * 0.2, z, hr * 0.8 + 0.06);
  }
  if (porta) {
    b.caixa(0.12, 0.21, 0.018, x, 0, z + d / 2 + 0.006, T.bianco).caixa(0.09, 0.18, 0.02, x, 0, z + d / 2 + 0.01, C.porta);
    b.caixa(0.016, 0.016, 0.022, x + 0.025, 0.09, z + d / 2 + 0.012, T.oro);
  }
  const ph = h / piani;
  for (let p = 0; p < piani; p++) {
    const y = p * ph + ph * 0.38;
    for (const s of [-1, 1]) persiana(b, x + s * w * 0.3, y, z + d / 2 + 0.01);
    persiana(b, x + w / 2 + 0.01, y, z, 'lado');
  }
}
// carvalho (copa irregular), bétula (tronco branco), pinheiro escocês (copa achatada)
function albero(b, x, z, r = 0.13, cor = T.foglia) { b.cilindro(0.025, 0.14, x, 0, z, T.tronco, 5); b.esfera(r, x, 0.14 + r * 0.7, z, cor).esfera(r * 0.7, x + r * 0.5, 0.14 + r * 0.9, z - r * 0.2, '#4E9A43'); }
function siepe(b, w, x, z, h = 0.08) { b.caixa(w, h, 0.06, x, 0, z, T.siepe); }
function muretto(b, w, x, z) { b.caixa(w, 0.06, 0.05, x, 0, z, C.muri[2]).caixa(w + 0.01, 0.012, 0.06, x, 0.06, z, T.pietra); }
function cestino(b, x, y, z) { b.cilindro(0.025, 0.02, x, y, z, '#4A3A2A', 6).esfera(0.03, x, y + 0.02, z, '#E0473C').esfera(0.022, x + 0.015, y + 0.03, z, '#F2C230'); }
function bowWindow(b, x, z, h, muro) {
  // bay window de dois andares (as semis dos anos 30)
  b.caixa(0.2, h, 0.08, x, 0, z, muro).caixa(0.16, h * 0.32, 0.084, x, h * 0.12, z, T.bianco).caixa(0.13, h * 0.24, 0.088, x, h * 0.16, z, T.vetroSash);
  b.caixa(0.16, h * 0.28, 0.084, x, h * 0.6, z, T.bianco).caixa(0.13, h * 0.2, 0.088, x, h * 0.63, z, T.vetroSash);
  b.caixa(0.22, 0.02, 0.1, x, h, z, C.tettoScuro);
}

// ---------- os 15 níveis (a property ladder) ----------
const tinta = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const NIVEIS = [
  // 0 Tiny Cottage
  (b, m) => { casaBase(b, 0.44, 0.32, 0.36, 0, 0, m, { camini: 1 }); cestino(b, -0.14, 0.2, 0.2); },
  // 1 Terraced House: três casas coladas, a do meio é a do jogador
  (b, m) => terraced(b, m, 0),
  // 2 Terraced House with Garden
  (b, m) => { terraced(b, m, -0.14); muretto(b, 0.92, 0, 0.44); siepe(b, 0.3, -0.3, 0.38); albero(b, 0.3, 0.3, 0.09); },
  // 3 Semi-Detached: duas metades espelhadas com bay windows
  (b, m) => semi(b, m, 0, 0.8),
  // 4 Semi with Garage
  (b, m) => { semi(b, m, -0.12, 0.66); b.caixa(0.26, 0.24, 0.42, 0.34, 0, 0.0, m).caixa(0.28, 0.025, 0.44, 0.34, 0.24, 0, C.tettoScuro).caixa(0.2, 0.18, 0.02, 0.34, 0, 0.215, T.bianco); },
  // 5 Detached House: porch, duas chaminés, cerca viva
  (b, m) => { detached(b, m, 0, 0); siepe(b, 0.36, -0.28, 0.44); siepe(b, 0.36, 0.28, 0.44); },
  // 6 Detached with Conservatory
  (b, m) => {
    detached(b, m, -0.12, -0.08, 0.56);
    b.caixa(0.32, 0.04, 0.3, 0.3, 0, 0.18, T.bianco).caixa(0.3, 0.24, 0.28, 0.3, 0.04, 0.18, '#BFE3EE');
    for (const dx of [-0.14, -0.05, 0.05, 0.14]) b.caixa(0.012, 0.24, 0.29, 0.3 + dx, 0.04, 0.18, T.bianco);
    b.piramide(0.32, 0.3, 0.1, 0.3, 0.28, 0.18, '#D7EEF5');
    albero(b, -0.36, 0.36, 0.09);
  },
  // 7 Georgian Townhouse: 3 andares, pórtico branco e grade preta
  (b, m) => {
    const w = 0.62, h = 1.0, d = 0.5, z = -0.12;
    b.caixa(w, h, d, 0, 0, z, m).caixa(w + 0.01, 0.3, d + 0.01, 0, 0, z, T.stucco);
    b.caixa(w + 0.04, 0.06, d + 0.04, 0, h, z, T.stucco);
    for (const s of [-1, 1]) camino(b, s * (w / 2 - 0.05), h + 0.06, z, 0.12);
    for (const y of [0.4, 0.7]) for (const x of [-0.2, 0, 0.2]) persiana(b, x, y, z + d / 2 + 0.01);
    persiana(b, -0.2, 0.1, z + d / 2 + 0.01); persiana(b, 0.2, 0.1, z + d / 2 + 0.01);
    b.caixa(0.1, 0.2, 0.02, 0, 0, z + d / 2 + 0.012, T.scuro).cupola(0.05, 0, 0.2, z + d / 2 + 0.013, '#F2D27A');
    for (const x of [-0.08, 0.08]) b.cilindro(0.015, 0.24, x, 0, z + d / 2 + 0.06, T.bianco, 6);
    b.caixa(0.22, 0.03, 0.1, 0, 0.24, z + d / 2 + 0.05, T.bianco).telhado(0.22, 0.1, 0.05, 0, 0.27, z + d / 2 + 0.05, T.bianco);
    for (let k = -4; k <= 4; k++) if (Math.abs(k) > 1) b.caixa(0.008, 0.1, 0.008, k * 0.07, 0, 0.32, T.scuro);
    b.caixa(0.6, 0.008, 0.008, 0, 0.1, 0.32, T.scuro);
  },
  // 8 Country House: duas alas com empena, entrada no meio, caminho de cascalho e topiaria
  (b, m) => {
    b.quad(0.2, 0.36, 0, 0.002, 0.28, '#E3DCCB');
    casaBase(b, 0.5, 0.56, 0.4, 0, -0.16, m, { piani: 2 });
    casaBase(b, 0.22, 0.56, 0.5, -0.36, -0.1, m, { piani: 2, porta: false, camini: 1 });
    casaBase(b, 0.22, 0.56, 0.5, 0.36, -0.1, m, { piani: 2, porta: false, camini: 1 });
    for (const x of [-0.18, 0.18]) b.cilindro(0.03, 0.04, x, 0, 0.36, '#9C7148', 6).cone(0.06, 0.16, x, 0.04, 0.36, T.siepe, 6);
  },
  // 9 Manor House: Tudor (meia-enxaimel preto e branco) na England, baronial com torrinhas na Scotland
  (b, m) => (C.baronial ? baronial(b, m) : tudor(b)),
  // 10 Clock Tower
  (b, m) => {
    casaBase(b, 0.36, 0.34, 0.34, 0.22, 0.24, m, { camini: 1 });
    const x = -0.16, z = -0.14, P = C.baronial ? C.muri[0] : T.pietra;
    b.caixa(0.3, 1.6, 0.3, x, 0, z, P).caixa(0.34, 0.36, 0.34, x, 1.6, z, '#CFC6B2');
    for (const [dx, dz, ry] of [[0, 0.175, 0], [0.175, 0, Math.PI / 2]]) {
      const g = new THREE.CylinderGeometry(0.11, 0.11, 0.01, 16); g.rotateX(Math.PI / 2); g.rotateY(ry); b.add(g, T.bianco, x + dx, 1.78, z + dz);
      b.caixa(ry ? 0.012 : 0.012, 0.07, ry ? 0.012 : 0.012, x + dx * 1.04, 1.78, z + dz * 1.04, T.scuro);
      b.caixa(ry ? 0.012 : 0.05, 0.012, ry ? 0.05 : 0.012, x + dx * 1.04 + (ry ? 0 : 0.02), 1.78, z + dz * 1.04 + (ry ? 0.02 : 0), T.scuro);
    }
    b.piramide(0.36, 0.36, 0.5, x, 1.96, z, '#3E5A50').cilindro(0.008, 0.1, x, 2.46, z, T.oro, 4);
    for (const y of [0.5, 0.95, 1.35]) b.caixa(0.06, 0.12, 0.02, x, y, z + 0.16, T.scuro);
  },
  // 11 Skyscraper: torre de vidro afunilada com ponta
  (b) => {
    for (let k = 0; k < 12; k++) { const s = 0.62 - k * 0.035; b.caixa(s, 0.22, s, 0, k * 0.27, 0, T.vetro).caixa(s + 0.02, 0.05, s + 0.02, 0, k * 0.27 + 0.22, 0, '#DDE3EA'); }
    b.piramide(0.22, 0.22, 0.42, 0, 3.24, 0, '#A9C4D6').cilindro(0.01, 0.2, 0, 3.6, 0, T.grigio, 4);
  },
  // 12 Country Estate: muro de pedra, portão, gramado listrado e a casa de pedra
  (b, m) => {
    for (let k = 0; k < 6; k++) b.quad(0.86, 0.06, 0, 0.002, 0.12 + k * 0.06, k % 2 ? '#7FB95C' : '#92C96C');
    for (const [w, d, x, z] of [[0.92, 0.04, 0, 0.45], [0.92, 0.04, 0, -0.45], [0.04, 0.92, -0.45, 0], [0.04, 0.92, 0.45, 0]]) if (z !== 0.45) b.caixa(w, 0.1, d, x, 0, z, T.pietra);
    for (const x of [-0.45, -0.12, 0.12, 0.45]) b.caixa(Math.abs(x) > 0.3 ? 0.33 : 0.04, 0.1, 0.04, x > 0 ? x - (Math.abs(x) > 0.3 ? 0.165 : 0) : x + (Math.abs(x) > 0.3 ? 0.165 : 0), 0, 0.45, T.pietra);
    for (const x of [-0.12, 0.12]) b.caixa(0.06, 0.18, 0.06, x, 0, 0.45, T.pietra).esfera(0.035, x, 0.2, 0.45, T.pietra);
    casaBase(b, 0.6, 0.5, 0.34, 0, -0.22, T.pietra, { piani: 2, cor: C.baronial ? C.muri[0] : '#D8CDB5' });
    albero(b, -0.32, 0.0, 0.11); albero(b, 0.32, 0.0, 0.11);
  },
  // 13 Palace: fachada clássica de pedra clara, colunas, frontão, balaustrada e mastro
  (b) => {
    const P = '#E8E1D0';
    b.caixa(0.96, 0.7, 0.62, 0, 0, -0.12, P).caixa(1.0, 0.05, 0.66, 0, 0.7, -0.12, '#D6CDB8');
    for (let k = -6; k <= 6; k++) b.caixa(0.02, 0.06, 0.02, k * 0.075, 0.75, 0.2, '#D6CDB8');
    for (const y of [0.12, 0.42]) for (const x of [-0.4, -0.28, 0.28, 0.4]) persiana(b, x, y, 0.2);
    for (const x of [-0.15, -0.05, 0.05, 0.15]) b.cilindro(0.025, 0.56, x, 0, 0.26, P, 8);
    b.caixa(0.42, 0.05, 0.14, 0, 0.56, 0.26, P).telhado(0.42, 0.14, 0.12, 0, 0.61, 0.26, P);
    b.caixa(0.12, 0.2, 0.02, 0, 0, 0.2, T.scuro);
    b.cilindro(0.008, 0.36, 0, 0.75, -0.12, T.grigio, 4);
    b.caixa(0.16, 0.09, 0.008, 0.08, 0.99, -0.12, T.navy).caixa(0.16, 0.022, 0.01, 0.08, 1.024, -0.12, T.bianco).caixa(0.03, 0.09, 0.01, 0.08, 0.99, -0.12, T.bianco);
    b.caixa(0.16, 0.012, 0.012, 0.08, 1.029, -0.12, T.rosso).caixa(0.014, 0.09, 0.012, 0.08, 0.99, -0.12, T.rosso);
    for (const x of [-0.34, 0.34]) b.caixa(0.03, 0.14, 0.03, x, 0, 0.44, T.oro);
  },
  // 14 Top of the Map: torre dourada com coroa
  (b) => {
    for (let k = 0; k < 9; k++) b.caixa(0.5, 0.26, 0.5, 0, k * 0.38, 0, T.oro).caixa(0.52, 0.12, 0.52, 0, k * 0.38 + 0.26, 0, '#C99A1E');
    b.cilindro(0.26, 0.12, 0, 3.42, 0, T.oro, 10);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.cone(0.06, 0.24, Math.cos(a) * 0.2, 3.54, Math.sin(a) * 0.2, T.oro, 4); }
    b.esfera(0.08, 0, 3.66, 0, T.rosso);
  },
];
function terraced(b, m, z0) {
  const w = 0.3, h = 0.56, d = 0.42;
  for (const [x, k] of [[-0.31, 0.88], [0, 1], [0.31, 0.93]]) {
    const cor = x === 0 ? m : C.stile === 'wls' ?C.muri[(C.muri.indexOf(m) + (x < 0 ? 1 : 2)) % 3] : tinta(m, k);
    b.caixa(w + 0.01, h, d, x, 0, z0, cor);
    b.caixa(0.09, 0.18, 0.02, x - 0.06, 0, z0 + d / 2 + 0.01, x === 0 ? C.porta : C.porte[(C.porte.indexOf(C.porta) + 1) % 3]);
    persiana(b, x + 0.07, 0.06, z0 + d / 2 + 0.01); persiana(b, x, 0.34, z0 + d / 2 + 0.01);
  }
  const hr = tetto(b, 0.93, d, h, 0, h, z0);
  for (const x of [-0.155, 0.155]) camino(b, x, h + hr * 0.25, z0, hr * 0.75 + 0.06);
}
function semi(b, m, x0, W) {
  const h = 0.62, d = 0.46, z = -0.06;
  b.caixa(W / 2, h, d, x0 - W / 4, 0, z, m).caixa(W / 2, h, d, x0 + W / 4, 0, z, tinta(m, 1.08));
  const hr = tetto(b, W, d, h, x0, h, z);
  camino(b, x0, h + hr * 0.3, z, hr * 0.7 + 0.08);
  for (const s of [-1, 1]) {
    bowWindow(b, x0 + s * W * 0.16, z + d / 2 + 0.04, h * 0.9, s < 0 ? m : tinta(m, 1.08));
    b.caixa(0.09, 0.19, 0.02, x0 + s * (W / 2 - 0.08), 0, z + d / 2 + 0.01, C.porta);
  }
}
function detached(b, m, x, z, w = 0.66) {
  casaBase(b, w, 0.62, 0.48, x, z, m, { piani: 2 });
  b.caixa(0.18, 0.025, 0.1, x, 0.24, z + 0.29, C.tettoScuro).telhado(0.18, 0.1, 0.06, x, 0.265, z + 0.29, C.tetto);
  b.quad(0.1, 0.2, x, 0.002, z + 0.42, '#D9D5CB');
}
function tudor(b) {
  const W = 0.86, h = 0.72, d = 0.5, z = -0.12;
  b.caixa(W, h * 0.4, d, 0, 0, z, T.muri[0]).caixa(W, h * 0.6, d, 0, h * 0.4, z, T.stucco);
  for (let k = 0; k <= 8; k++) b.caixa(0.016, h * 0.6, 0.012, -W / 2 + k * W / 8, h * 0.4, z + d / 2 + 0.004, T.legnoTudor);
  b.caixa(W, 0.02, 0.012, 0, h * 0.4, z + d / 2 + 0.004, T.legnoTudor).caixa(W, 0.02, 0.012, 0, h * 0.7, z + d / 2 + 0.004, T.legnoTudor);
  const hr = tetto(b, W, d, h, 0, h, z);
  for (const x of [-0.28, 0.28]) { b.caixa(0.24, h, 0.14, x, 0, z + d / 2 + 0.07, T.stucco).telhado(0.26, 0.16, 0.16, x, h, z + d / 2 + 0.07, C.tetto, Math.PI / 2); persiana(b, x, h * 0.55, z + d / 2 + 0.145); }
  for (const x of [-0.38, 0, 0.38]) { camino(b, x, h + hr * 0.2, z - 0.05, hr + 0.12); }
  b.caixa(0.12, 0.22, 0.02, 0, 0, z + d / 2 + 0.01, T.legnoTudor);
  for (const x of [-0.14, 0.14]) persiana(b, x, 0.08, z + d / 2 + 0.01);
  b.quad(0.16, 0.3, 0, 0.002, 0.32, '#E3DCCB');
}
function baronial(b, m) {
  const W = 0.7, h = 0.8, d = 0.48, z = -0.12;
  casaBase(b, W, h, d, 0, z, m, { piani: 3 });
  for (const [x, zz] of [[-W / 2, z + d / 2], [W / 2, z + d / 2]]) b.cilindro(0.1, h + 0.12, x, 0, zz, m, 10).cone(0.13, 0.32, x, h + 0.12, zz, C.tetto, 10);
  b.cilindro(0.07, h + 0.4, 0.12, 0, z - d / 2, m, 8).cone(0.09, 0.26, 0.12, h + 0.4, z - d / 2, C.tetto, 8);
}

// altura aproximada (lotes) de cada nível — usada para clique e posição de rótulos/chamas
export const ALTURA_NIVEL = [0.5, 0.78, 0.78, 0.88, 0.88, 0.9, 0.9, 1.12, 0.9, 1.25, 2.5, 3.8, 0.8, 1.05, 3.75];

// janelas acesas de uma casa (mesmo nível e estilo), para a camada da noite; null se a casa não tem janelas
export function geometriaFinestre(nivel, stile = 'base') {
  FINESTRE = [];
  C = TEMI[stile] ?? TEMI.base; NIV = nivel;
  C.porta = C.porte[0];
  try { NIVEIS[nivel](new Construtor(), C.muri[0]); } finally { C = TEMI.base; NIV = 0; }
  const partes = FINESTRE; FINESTRE = null;
  if (!partes.length) return null;
  const g = mergeGeometries(partes); g.computeBoundingSphere();
  return g;
}

// poste de luz vitoriano preto (de dia: só o poste; a lâmpada acesa é uma camada à parte, visível à noite)
export function geometriaLampione() {
  const b = new Construtor();
  b.cilindro(0.022, 0.06, 0, 0, 0, T.scuro, 6).cilindro(0.014, 0.56, 0, 0.06, 0, T.scuro, 6).caixa(0.04, 0.012, 0.012, 0, 0.5, 0, T.scuro);
  b.cilindro(0.028, 0.07, 0, 0.56, 0, T.scuro, 4, 0.04).cone(0.035, 0.03, 0, 0.63, 0, T.scuro, 4);
  return b.geometria();
}
export function geometriaLuceLampione() {
  const b = new Construtor();
  b.cilindro(0.024, 0.055, 0, 0.565, 0, '#FFF1C2', 4, 0.034);
  // poça de luz no chão: degradê do centro (quente) para a borda (preto = some, a mistura é aditiva)
  const alone = new THREE.CircleGeometry(0.17, 20).toNonIndexed();
  alone.rotateX(-Math.PI / 2); alone.translate(0, 0.004, 0);
  const p = alone.attributes.position, cor = new Float32Array(p.count * 3), quente = new THREE.Color('#8A6526');
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, 1 - Math.hypot(p.getX(i), p.getZ(i)) / 0.17); quente.clone().multiplyScalar(k).toArray(cor, i * 3); }
  alone.deleteAttribute('normal'); alone.deleteAttribute('uv');
  alone.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  b.partes.push(alone);
  return b.geometria();
}

// ---------- Halloween ----------
// abóbora (em lotes, base no chão, cara virada para +z); x/z/s posicionam dentro do lote da casa
function zuccaEm(b, x, z, s) {
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, g = new THREE.SphereGeometry(0.045 * s, 8, 6);
    g.scale(0.75, 1, 0.75); b.add(g, k % 2 ? '#E8751A' : '#F28C28', x + Math.cos(a) * 0.022 * s, 0.045 * s, z + Math.sin(a) * 0.022 * s);
  }
  b.cilindro(0.008 * s, 0.025 * s, x, 0.085 * s, z, '#4E7A2A', 5);
}
// cara da abóbora: olhos e boca (escuros de dia, acesos à noite)
function facciaZucca(b, x, z, s, cor) {
  const zz = z + 0.06 * s;
  for (const dx of [-0.022, 0.022]) b.caixa(0.016 * s, 0.016 * s, 0.006 * s, x + dx * s, 0.05 * s, zz, cor);
  b.caixa(0.05 * s, 0.012 * s, 0.006 * s, x, 0.025 * s, zz, cor);
}
// posições: uma ao lado da porta da casa; no village green, uma gigante
const ZUCCA_CASA = [0.3, 0.4, 1.8], ZUCCA_PIAZZA = [-0.9, 0.25, 6];
export function geometriaZucca(dove = 'casa') {
  const [x, z, s] = dove === 'casa' ? ZUCCA_CASA : ZUCCA_PIAZZA, b = new Construtor();
  zuccaEm(b, x, z, s); facciaZucca(b, x, z, s, '#3A2410');
  if (dove === 'piazza') for (const [dx, dz, k] of [[0.35, 0.05, 0.7], [-0.32, 0.1, 0.55]]) { zuccaEm(b, x + dx, z + dz, k * s * 0.6); facciaZucca(b, x + dx, z + dz, k * s * 0.6, '#3A2410'); }
  return b.geometria();
}
export function geometriaZuccaLuce(dove = 'casa') {
  const [x, z, s] = dove === 'casa' ? ZUCCA_CASA : ZUCCA_PIAZZA, b = new Construtor();
  facciaZucca(b, x, z + 0.002, s, '#FFB437');
  if (dove === 'piazza') for (const [dx, dz, k] of [[0.35, 0.05, 0.7], [-0.32, 0.1, 0.55]]) facciaZucca(b, x + dx, z + dz + 0.002, k * s * 0.6, '#FFB437');
  return b.geometria();
}

// floreiras embaixo das janelas da frente (mesmo nível e estilo); null se a casa não tem janelas
export function geometriaFioriere(nivel, stile = 'base') {
  FIORI = [];
  C = { ...(TEMI[stile] ?? TEMI.base) }; NIV = nivel;
  C.porta = C.porte[0];
  try { NIVEIS[nivel](new Construtor(), C.muri[0]); } finally { C = TEMI.base; NIV = 0; }
  const partes = FIORI; FIORI = null;
  if (!partes.length) return null;
  const g = mergeGeometries(partes); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// variante (0..23) = parede (3) x porta (4) x telhado (2); as variantes 0..2 são as antigas (só a parede muda)
export const VARIANTI = 24;
export function geometriaCasa(nivel, variante, stile = 'base') {
  const b = new Construtor(), tema = TEMI[stile] ?? TEMI.base;
  const muro = variante % 3, porta = Math.floor(variante / 3) % 4, outro = Math.floor(variante / 12) % 2;
  C = { ...tema, porta: tema.porte[porta % tema.porte.length] }; NIV = nivel;
  if (outro && tema.tetto2) [C.tetto, C.tettoScuro] = tema.tetto2;
  if (outro && tema.palha2) [C.paglia, C.pagliaScura] = tema.palha2;
  try { NIVEIS[nivel](b, C.muri[muro]); } finally { C = TEMI.base; NIV = 0; }
  return b.geometria();
}

// ---------- jardim: enfeites na frente da casa (cada tipo é uma camada só, para todas as casas) ----------
export const ORNAMENTI = ['aiuola', 'rose', 'bidoni', 'bici', 'panchina', 'gnomo', 'vasi', 'ciliegio', 'stendino', 'altalena'];
export function geometriaOrnamento(id) {
  const b = new Construtor();
  if (id === 'aiuola') {
    b.caixa(0.15, 0.022, 0.075, 0, 0, 0, '#6B4A2E');
    for (let i = 0; i < 7; i++) b.cilindro(0.003, 0.03, -0.06 + i * 0.02, 0.02, (i % 2 ? 0.014 : -0.014), '#3F7F3A', 3).esfera(0.016, -0.06 + i * 0.02, 0.05, (i % 2 ? 0.014 : -0.014), PETALI[i % PETALI.length]);
  } else if (id === 'rose') {
    b.esfera(0.05, -0.03, 0.045, 0, '#3F7F3A').esfera(0.04, 0.035, 0.038, 0.005, '#4E8F43');
    for (const [x, y, z] of [[-0.05, 0.075, 0.03], [-0.01, 0.085, 0.02], [0.02, 0.06, 0.035], [0.05, 0.07, 0.01], [-0.06, 0.04, 0.04]]) b.esfera(0.014, x, y, z, '#C8102E');
  } else if (id === 'bidoni') {
    // wheelie bins: preto (lixo), verde (jardim) e azul (reciclagem)
    for (const [x, cor] of [[-0.05, '#2A2E36'], [0, '#2E7D45'], [0.05, '#1F6FB5']]) b.caixa(0.042, 0.085, 0.05, x, 0, 0, cor).caixa(0.046, 0.008, 0.056, x, 0.085, -0.002, cor);
  } else if (id === 'bici') {
    for (const x of [-0.042, 0.042]) { const g = new THREE.TorusGeometry(0.03, 0.005, 4, 14); g.translate(0, 0.03, 0); b.add(g, '#22252B', x, 0, 0); }
    b.caixa(0.07, 0.007, 0.007, 0, 0.045, 0, '#C8102E').caixa(0.007, 0.035, 0.007, -0.012, 0.03, 0, '#C8102E').caixa(0.007, 0.04, 0.007, 0.035, 0.03, 0, '#C8102E');
    b.caixa(0.025, 0.008, 0.012, -0.012, 0.066, 0, '#22252B').caixa(0.006, 0.006, 0.04, 0.035, 0.07, 0, '#22252B');
  } else if (id === 'panchina') {
    b.caixa(0.13, 0.012, 0.042, 0, 0.035, 0, '#9C7148').caixa(0.13, 0.035, 0.008, 0, 0.05, -0.018, '#9C7148');
    for (const x of [-0.055, 0.055]) b.caixa(0.008, 0.035, 0.04, x, 0, 0, '#2A2E36').caixa(0.008, 0.05, 0.008, x, 0.035, -0.018, '#2A2E36');
  } else if (id === 'gnomo') {
    for (const [x, s, c] of [[-0.025, 1, '#1F6FB5'], [0.03, 0.8, '#2E7D45']]) {
      b.cilindro(0.016 * s, 0.035 * s, x, 0, 0, c, 6, 0.012 * s).esfera(0.013 * s, x, 0.045 * s, 0, '#F1C6A0').esfera(0.011 * s, x, 0.036 * s, 0.008 * s, '#FFFFFF').cone(0.015 * s, 0.04 * s, x, 0.05 * s, 0, '#E0473C', 6);
    }
  } else if (id === 'vasi') {
    for (const [x, r, h] of [[-0.05, 0.022, 0.035], [0.0, 0.018, 0.028], [0.045, 0.025, 0.04]]) b.cilindro(r * 0.8, h, x, 0, 0, '#C8693A', 8, r).esfera(r * 1.2, x, h + r * 0.8, 0, x > 0 ? '#2E5E3A' : '#4E9A43');
    b.esfera(0.012, -0.05, 0.075, 0.01, '#FF7EB6').esfera(0.012, 0.0, 0.06, 0.01, '#F2C230');
  } else if (id === 'ciliegio') {
    b.cilindro(0.012, 0.11, 0, 0, 0, T.tronco, 5).esfera(0.07, 0, 0.15, 0, '#F4A6C6').esfera(0.05, 0.04, 0.17, -0.02, '#F7C1D9').esfera(0.045, -0.04, 0.18, 0.01, '#EE8FB6');
  } else if (id === 'stendino') {
    // varal com roupa colorida (o clássico do quintal britânico)
    for (const x of [-0.07, 0.07]) b.caixa(0.006, 0.11, 0.006, x, 0, 0, '#9AA3AE');
    b.caixa(0.14, 0.003, 0.003, 0, 0.105, 0, '#FFFFFF');
    for (const [x, w, h, c] of [[-0.045, 0.024, 0.04, '#E0473C'], [-0.012, 0.03, 0.03, '#3FA7F5'], [0.022, 0.022, 0.045, '#F2C230'], [0.05, 0.02, 0.025, '#FFFFFF']]) b.caixa(w, h, 0.004, x, 0.105 - h, 0, c);
  } else if (id === 'altalena') {
    for (const x of [-0.06, 0.06]) for (const z of [-0.025, 0.025]) { const g = new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4); g.rotateX(z > 0 ? 0.35 : -0.35); g.translate(0, 0.062, 0); b.add(g, '#C8102E', x, 0, z * 0.2); }
    b.caixa(0.13, 0.007, 0.007, 0, 0.12, 0, '#C8102E');
    for (const x of [-0.015, 0.015]) b.caixa(0.002, 0.08, 0.002, x, 0.04, 0, '#DDDDDD');
    b.caixa(0.04, 0.005, 0.02, 0, 0.038, 0, '#F2C230');
  }
  return b.geometria();
}
// onde cabe um enfeite em cada nível (em lotes, frente = +z): espaços livres do jardim da frente
const SLOT = [
  [[-0.33, 0.32], [0.33, 0.3]], [[-0.3, 0.37], [0.3, 0.37]], [[-0.3, 0.22], [0.12, 0.24]], [[-0.15, 0.37], [0.15, 0.37]],
  [[-0.22, 0.37], [0.0, 0.37]], [[-0.26, 0.33], [0.26, 0.33]], [[0.0, 0.32], [0.3, 0.42]], [[-0.4, 0.38], [0.4, 0.38]],
  [[-0.36, 0.3], [0.36, 0.3]], [[-0.3, 0.4], [0.3, 0.4]], [[-0.3, 0.3], [-0.1, 0.42]], [[-0.4, 0.4], [0.4, 0.4]],
  [[-0.22, 0.28], [0.22, 0.28]], [[-0.22, 0.38], [0.22, 0.38]], [[-0.38, 0.38], [0.38, 0.38]],
];

export const hashConta = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
// aparência fixa de cada casa, tirada do @: variante (parede/porta/telhado), floreiras e enfeites do jardim
// (a parede é a mesma de antes: hash % 3)
export function aspetto(conta, livello) {
  const h = hashConta(conta), h2 = hashConta(`${conta}*`);
  const v = h % 3 + 3 * (Math.floor(h / 3) % 4) + 12 * (Math.floor(h / 12) % 2);
  const fiori = h2 % 5 < 2, orn = [];
  (SLOT[livello] ?? []).forEach(([x, z], s) => {
    const k = Math.floor(h2 / (5 * 13 ** s)) % 13;   // 10 enfeites + 3 "nada" (nem todo jardim tem tudo)
    if (k < ORNAMENTI.length) orn.push({ id: ORNAMENTI[k], x, z, rot: ((h2 >> (s * 3)) % 7 - 3) * 0.12 });
  });
  return { v, fiori, orn };
}

// cabine telefônica vermelha e pillar box (em lotes, base no chão)
export function cabina(b, x, z, s = 1) {
  b.caixa(0.12 * s, 0.32 * s, 0.12 * s, x, 0, z, T.rosso).cupola(0.075 * s, x, 0.32 * s, z, T.rosso);
  for (let k = 0; k < 3; k++) b.caixa(0.08 * s, 0.05 * s, 0.124 * s, x, (0.1 + k * 0.065) * s, z, '#F4E9C9');
  b.caixa(0.1 * s, 0.03 * s, 0.126 * s, x, 0.27 * s, z, T.scuro);
}
function pillarBox(b, x, z, s = 1) {
  b.cilindro(0.04 * s, 0.015 * s, x, 0, z, T.scuro, 10).cilindro(0.035 * s, 0.15 * s, x, 0.015 * s, z, T.rosso, 10).cupola(0.04 * s, x, 0.165 * s, z, T.rosso);
  b.caixa(0.03 * s, 0.006 * s, 0.01 * s, x, 0.13 * s, z + 0.034 * s, T.scuro);
}

// ---------- prédios especiais (em lotes; uma quadra = 4 x 2 lotes) ----------
export function geometriaEspecial(tipo) {
  const b = new Construtor();
  if (tipo === 'piazza') {
    // village green: carvalho grande e duas árvores; o resto vem com os desbloqueios (REGOLE.traguardi)
    b.cilindro(0.05, 0.3, -0.3, 0, -0.2, T.tronco, 6).esfera(0.36, -0.3, 0.52, -0.2, T.foglia).esfera(0.24, -0.1, 0.62, -0.32, '#4E9A43');
    for (const [x, z] of [[-1.6, 0.6], [1.6, -0.65]]) albero(b, x, z, 0.16);
  } else if (tipo === 'cabina') {
    cabina(b, -1.55, -0.55, 1.1);
  } else if (tipo === 'fermata') {
    // pillar box e ponto de ônibus: abrigo de vidro com banco e a placa (branca com faixa vermelha)
    pillarBox(b, -1.3, -0.5, 1.1);
    const x = 0.85, z = -0.8;
    b.caixa(0.4, 0.22, 0.012, x, 0, z - 0.07, T.vetro).caixa(0.012, 0.22, 0.14, x - 0.2, 0, z, T.vetro);
    for (const dx of [-0.2, 0.2]) b.caixa(0.016, 0.24, 0.016, x + dx, 0, z - 0.07, T.scuro);
    b.caixa(0.44, 0.018, 0.18, x, 0.24, z, '#22252B').caixa(0.3, 0.015, 0.05, x, 0.07, z - 0.04, T.grigio);
    b.cilindro(0.008, 0.34, x + 0.32, 0, z - 0.02, T.scuro, 5).caixa(0.1, 0.07, 0.01, x + 0.32, 0.27, z - 0.02, T.bianco).caixa(0.1, 0.02, 0.012, x + 0.32, 0.32, z - 0.02, T.rosso);
  } else if (tipo === 'stagno') {
    // lago dos patos e dois bancos
    const lago = new THREE.CircleGeometry(0.3, 14); lago.rotateX(-Math.PI / 2); lago.scale(1.4, 1, 1); b.add(lago, T.acqua, 0.75, 0.003, 0.15);
    for (const [x, z] of [[0.55, 0.12], [0.95, 0.2]]) b.caixa(0.04, 0.03, 0.025, x, 0.004, z, '#F2F2EC').caixa(0.012, 0.012, 0.012, x + 0.02, 0.03, z, '#3E7A3E');
    for (const [x, z] of [[-0.8, 0.55], [0.1, 0.55]]) b.caixa(0.3, 0.025, 0.08, x, 0.06, z, T.tronco).caixa(0.3, 0.07, 0.015, x, 0.085, z - 0.035, T.tronco).caixa(0.02, 0.06, 0.06, x - 0.13, 0, z, T.scuro).caixa(0.02, 0.06, 0.06, x + 0.13, 0, z, T.scuro);
  } else if (tipo === 'negozi') {
    // chippy (frente azul, peixe na placa) e corner shop (toldo verde, cavalete de jornal), entre a igreja e o pub
    for (const [x, frente, faixa] of [[-0.33, '#1F6FB5', '#F2C230'], [0.13, '#A94A34', '#2E5E3A']]) {
      b.caixa(0.38, 0.44, 0.45, x, 0, 0.185, T.stucco).caixa(0.385, 0.2, 0.455, x, 0, 0.185, frente);
      b.caixa(0.385, 0.05, 0.02, x, 0.2, 0.41, faixa).telhado(0.4, 0.47, 0.12, x, 0.44, 0.185, T.tetto);
      b.caixa(0.22, 0.12, 0.02, x - 0.05, 0.04, 0.415, '#FFE7A0').caixa(0.07, 0.16, 0.02, x + 0.12, 0, 0.415, T.scuro);
      persiana(b, x, 0.27, 0.41);
    }
    const peixe = new THREE.SphereGeometry(0.03, 8, 6); peixe.scale(1.8, 0.8, 0.4); b.add(peixe, '#E8751A', -0.35, 0.225, 0.424);
    b.add(new THREE.ConeGeometry(0.02, 0.03, 4).rotateZ(Math.PI / 2), '#E8751A', -0.29, 0.225, 0.424);
    b.caixa(0.36, 0.012, 0.1, 0.13, 0.19, 0.46, '#2E5E3A').caixa(0.06, 0.09, 0.03, 0.27, 0, 0.5, T.bianco);
  } else if (tipo === 'parco2') {
    // parque com o meio livre (lá ficam as lojas, desbloqueio "negozi")
    for (const [x, z] of [[-1.2, -0.3], [1.2, -0.2], [-1.6, 0.5], [1.0, 0.55]]) albero(b, x, z, 0.17);
  } else if (tipo === 'campo') {
    // campo de futebol do time local: listras, linhas, traves, arquibancada coberta e refletores
    for (let k = 0; k < 7; k++) b.caixa(0.5, 0.012, 1.6, -1.5 + k * 0.5, 0, 0.1, k % 2 ? '#58B95C' : '#4CAF50');
    for (const [w, d, x, z] of [[3.3, 0.02, 0, -0.62], [3.3, 0.02, 0, 0.82], [0.02, 1.44, -1.65, 0.1], [0.02, 1.44, 1.65, 0.1], [0.02, 1.44, 0, 0.1],
      [0.02, 0.7, -1.25, 0.1], [0.02, 0.7, 1.25, 0.1], [0.4, 0.02, -1.45, -0.25], [0.4, 0.02, -1.45, 0.45], [0.4, 0.02, 1.45, -0.25], [0.4, 0.02, 1.45, 0.45]]) b.caixa(w, 0.014, d, x, 0, z, T.bianco);
    const roda = new THREE.RingGeometry(0.18, 0.2, 24); roda.rotateX(-Math.PI / 2); b.add(roda, T.bianco, 0, 0.0145, 0.1);
    for (const s of [-1, 1]) {
      const x = s * 1.67;
      b.caixa(0.012, 0.09, 0.012, x, 0, -0.06, T.bianco).caixa(0.012, 0.09, 0.012, x, 0, 0.26, T.bianco).caixa(0.012, 0.012, 0.33, x, 0.09, 0.1, T.bianco);
    }
    for (let k = 0; k < 3; k++) b.caixa(1.6, 0.06, 0.08, 0, k * 0.06, -0.78 - k * 0.07, '#B8202E');
    b.caixa(1.7, 0.02, 0.32, 0, 0.32, -0.84, '#3A3F4A');
    for (const x of [-0.8, 0, 0.8]) b.caixa(0.02, 0.32, 0.02, x, 0, -0.98, T.scuro);
    for (const [x, z] of [[-1.85, -0.85], [1.85, -0.85], [-1.85, 0.9], [1.85, 0.9]]) b.cilindro(0.012, 0.72, x, 0, z, T.grigio, 5).caixa(0.1, 0.06, 0.03, x, 0.72, z, '#E8EEF2');
  } else if (tipo === 'stazione') {
    // estação de trem: linha com dormentes, plataforma coberta, prédio de tijolo com relógio e um trem parado
    b.caixa(4.0, 0.02, 0.5, 0, 0, -0.55, '#8A8378');
    for (let x = -1.9; x <= 1.9; x += 0.15) b.caixa(0.04, 0.025, 0.28, x, 0.005, -0.55, '#6E4A2D');
    for (const dz of [-0.09, 0.09]) b.caixa(4.0, 0.03, 0.02, 0, 0.02, -0.55 + dz, '#5E5A55');
    b.caixa(3.4, 0.07, 0.34, 0, 0, -0.12, T.pietra).caixa(3.4, 0.006, 0.025, 0, 0.07, -0.27, T.oro);
    for (let x = -1.2; x <= 1.21; x += 0.6) b.caixa(0.02, 0.3, 0.02, x, 0.07, -0.05, '#2E5E3A');
    b.caixa(2.8, 0.02, 0.28, 0, 0.37, -0.1, '#2E5E3A').caixa(2.8, 0.04, 0.01, 0, 0.33, -0.24, T.bianco);
    b.caixa(1.3, 0.42, 0.4, -0.5, 0, 0.4, '#A94A34').telhado(1.36, 0.46, 0.18, -0.5, 0.42, 0.4, T.tetto);
    for (const x of [-0.95, -0.05]) persiana(b, x, 0.12, 0.6);
    b.caixa(0.16, 0.24, 0.02, -0.5, 0, 0.605, '#2E5E3A');
    const quadrante = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16); quadrante.rotateX(Math.PI / 2); b.add(quadrante, T.bianco, -0.5, 0.33, 0.61);
    b.caixa(0.008, 0.045, 0.004, -0.5, 0.33, 0.618, T.scuro).caixa(0.035, 0.008, 0.004, -0.5 + 0.017, 0.33, 0.618, T.scuro);
    for (const x of [-1.1, 0, 1.1]) b.caixa(1.0, 0.2, 0.2, x, 0.04, -0.55, '#1F3A6B').caixa(1.01, 0.05, 0.205, x, 0.15, -0.55, T.vetro).caixa(0.98, 0.02, 0.18, x, 0.24, -0.55, T.grigio);
    b.caixa(0.02, 0.2, 0.2, -1.61, 0.04, -0.55, T.oro);
  } else if (tipo === 'municipio') {
    // town hall de pedra: pórtico com colunas e frontão, torre do relógio no meio (sem bandeiras)
    const PEDRA = '#D8CFBE', CLARA = '#E8E1D2';
    b.caixa(1.4, 0.04, 0.22, 0, 0, 0.76, T.pietra);
    b.caixa(3.0, 0.7, 1.0, 0, 0, -0.05, PEDRA).caixa(3.06, 0.06, 1.06, 0, 0.7, -0.05, '#C9BFAA').telhado(3.0, 1.0, 0.22, 0, 0.76, -0.05, T.tetto);
    for (let k = 0; k < 6; k++) b.cilindro(0.04, 0.55, -0.45 + k * 0.18, 0.04, 0.6, T.bianco, 8);
    b.caixa(1.1, 0.08, 0.24, 0, 0.59, 0.58, CLARA).telhado(0.24, 1.1, 0.18, 0, 0.67, 0.58, CLARA, Math.PI / 2);
    for (const x of [-1.3, -1.0, -0.7, 0.7, 1.0, 1.3]) for (const y of [0.1, 0.42]) persiana(b, x, y, 0.46);
    b.caixa(0.42, 1.0, 0.42, 0, 0.7, -0.05, PEDRA).caixa(0.46, 0.04, 0.46, 0, 1.7, -0.05, '#C9BFAA');
    b.caixa(0.34, 0.25, 0.34, 0, 1.74, -0.05, CLARA).piramide(0.4, 0.4, 0.38, 0, 1.99, -0.05, T.verde);
    for (const [ry, dx, dz] of [[0, 0, 0.215], [Math.PI, 0, -0.215], [Math.PI / 2, 0.215, 0], [-Math.PI / 2, -0.215, 0]]) {
      const q = new THREE.CylinderGeometry(0.12, 0.12, 0.01, 18); q.rotateX(Math.PI / 2); b.add(q, T.bianco, dx, 1.45, -0.05 + dz, ry);
      const p = new THREE.BoxGeometry(0.012, 0.09, 0.006); p.translate(0, 0.035, 0.008); b.add(p, T.scuro, dx, 1.45, -0.05 + dz, ry);
    }
    for (const s of [-1, 1]) albero(b, s * 1.75, 0.72, 0.15);
  } else if (tipo === 'bandiera') {
    // blue plaque do fundador num pedestal
    b.caixa(0.12, 0.5, 0.08, 0, 0, 0, '#B85A3E').caixa(0.14, 0.02, 0.1, 0, 0.5, 0, T.pietra);
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20); g.rotateX(Math.PI / 2); b.add(g, '#1E5AA8', 0, 0.36, 0.046);
    const anel = new THREE.TorusGeometry(0.088, 0.006, 4, 20); b.add(anel, T.bianco, 0, 0.36, 0.054);
  } else if (tipo === 'chiesa') {
    // igreja paroquial de pedra com torre ameada + o pub da cidade ao lado
    b.caixa(0.7, 0.62, 1.3, -0.95, 0, -0.15, T.pietra).telhado(1.36, 0.76, 0.34, -0.95, 0.62, -0.15, T.tetto, Math.PI / 2);
    b.caixa(0.34, 1.25, 0.34, -0.95, 0, 0.62, '#ADA596');
    for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13], [0, -0.13], [0, 0.13], [-0.13, 0], [0.13, 0]]) b.caixa(0.06, 0.08, 0.06, -0.95 + dx, 1.25, 0.62 + dz, '#ADA596');
    b.caixa(0.12, 0.24, 0.02, -0.95, 0, 0.8, T.legnoTudor).caixa(0.06, 0.16, 0.02, -0.95, 0.85, 0.8, T.scuro);
    for (const z of [-0.6, -0.25, 0.1]) b.caixa(0.02, 0.2, 0.08, -0.6, 0.25, z, '#4F6B8A');
    // pub: dois andares caiados, telhado de ardósia, placa pendurada e cestos de flores
    b.caixa(0.95, 0.56, 0.6, 0.85, 0, 0.1, T.bianco).caixa(0.96, 0.2, 0.61, 0.85, 0, 0.1, '#22252B');
    b.telhado(1.0, 0.66, 0.24, 0.85, 0.56, 0.1, T.tetto);
    camino(b, 0.45, 0.62, 0.1, 0.24); camino(b, 1.25, 0.62, 0.1, 0.24);
    for (const x of [0.6, 1.1]) { b.caixa(0.14, 0.11, 0.02, x, 0.05, 0.41, '#FFD98A'); persiana(b, x, 0.33, 0.41); }
    b.caixa(0.11, 0.18, 0.02, 0.85, 0, 0.41, '#7A1F1F');
    b.cilindro(0.012, 0.62, 1.42, 0, 0.42, T.scuro, 5).caixa(0.12, 0.012, 0.012, 1.36, 0.6, 0.42, T.scuro).caixa(0.1, 0.13, 0.015, 1.36, 0.45, 0.42, '#7A1F1F').caixa(0.08, 0.1, 0.017, 1.36, 0.465, 0.42, T.oro);
    for (const x of [0.5, 1.2]) cestino(b, x, 0.5, 0.43);
  } else if (tipo === 'palazzina') {
    // bloco de apartamentos de tijolo com telhado plano
    for (const [x, cor] of [[-0.95, '#A94A34'], [0.95, '#C9A07A']]) {
      b.caixa(1.5, 1.45, 1.45, x, 0, 0, cor).caixa(1.56, 0.05, 1.51, x, 1.45, 0, '#5E5A55');
      for (let p = 0; p < 4; p++) for (const dx of [-0.5, -0.17, 0.17, 0.5]) b.caixa(0.16, 0.18, 0.02, x + dx, 0.16 + p * 0.33, 0.73, T.bianco).caixa(0.12, 0.14, 0.022, x + dx, 0.18 + p * 0.33, 0.73, T.vetroSash);
    }
  } else if (tipo === 'ospedale') {
    // hospital: faixas de vidro e o "H" azul no telhado (nada de cruz vermelha: símbolo protegido)
    b.caixa(3.4, 1.15, 1.6, 0, 0, 0, T.bianco).caixa(3.42, 0.14, 1.62, 0, 0.45, 0, T.vetro).caixa(3.42, 0.14, 1.62, 0, 0.82, 0, T.vetro);
    b.caixa(3.42, 0.08, 1.62, 0, 0.2, 0, '#005EB8');
    b.cilindro(0.38, 0.03, 0.8, 1.15, 0, '#3A3F4A', 16);
    b.caixa(0.06, 0.035, 0.36, 0.68, 1.15, 0, T.bianco).caixa(0.06, 0.035, 0.36, 0.92, 1.15, 0, T.bianco).caixa(0.24, 0.035, 0.06, 0.8, 1.15, 0, T.bianco);
  } else if (tipo === 'stadio') {
    b.caixa(3.0, 0.03, 1.5, 0, 0, 0, '#4CAF50').caixa(2.6, 0.035, 0.03, 0, 0, 0, T.bianco);
    for (let k = 0; k < 6; k++) b.caixa(0.42, 0.031, 1.4, -1.25 + k * 0.5, 0.001, 0, k % 2 ? '#58B95C' : '#4CAF50');
    for (const [w, d, x, z] of [[3.6, 0.3, 0, 0.9], [3.6, 0.3, 0, -0.9], [0.3, 1.5, 1.65, 0], [0.3, 1.5, -1.65, 0]]) b.caixa(w, 0.45, d, x, 0, z, '#B8202E').caixa(w, 0.08, d, x, 0.45, z, T.grigio);
  } else if (tipo === 'parco') {
    for (const [x, z] of [[-1.2, -0.3], [0, 0.35], [1.2, -0.2], [-0.5, 0.5]]) albero(b, x, z, 0.17);
  } else if (tipo === 'fiamma') {
    b.cone(0.13, 0.5, 0, 0, 0, '#FF8A00', 5).cone(0.08, 0.34, 0.07, 0, 0.04, '#FFD23F', 5).cone(0.07, 0.3, -0.07, 0, -0.03, '#FF5A1F', 5);
  } else if (tipo === 'liberoV' || tipo === 'liberoL') {
    // lote livre: estacas nos cantos + placa (a face com texto é um plano à parte, ver PLACCA)
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.caixa(0.03, 0.07, 0.03, x, 0, z, T.bianco);
    if (tipo === 'liberoL') {
      b.quad(0.78, 0.78, 0, 0.002, 0, '#B98D5F');
      b.piramide(0.36, 0.3, 0.13, -0.16, 0, -0.14, '#9C7148');
      for (const [w, d, x, z] of [[0.6, 0.05, 0, -0.3], [0.05, 0.5, -0.3, -0.05], [0.05, 0.5, 0.3, -0.05]]) b.caixa(w, 0.06, d, x, 0, z, '#A94A34');
      for (let k = 0; k < 4; k++) b.caixa(0.11, 0.07, 0.03, -0.27 + k * 0.11, 0.06, 0.4, k % 2 ? T.bianco : '#E0473C');
      for (const x of [-0.33, 0.06]) b.caixa(0.025, 0.13, 0.025, x, 0, 0.4, T.scuro);
      b.cone(0.04, 0.1, 0.3, 0, 0.2, '#FF7A1A', 6);
    }
    const p = PLACCA;
    b.cilindro(0.016, p.y + p.h, p.x, 0, p.z - 0.012, T.tronco, 5);
    b.caixa(p.w + 0.02, p.h + 0.02, 0.018, p.x, p.y - 0.01, p.z, T.bianco);
  } else if (tipo === 'cartellone') {
    // outdoor: dois postes e moldura; a face com texto é um plano à parte (CARTELLONE)
    const c = CARTELLONE;
    for (const x of [-c.w * 0.33, c.w * 0.33]) b.caixa(0.04, c.y + c.h * 0.5, 0.04, x, 0, c.z - 0.03, T.scuro);
    b.caixa(c.w + 0.05, c.h + 0.05, 0.03, 0, c.y - 0.025, c.z, T.scuro);
    b.caixa(c.w * 0.7, 0.02, 0.08, 0, c.y - 0.03, c.z + 0.03, T.grigio);
  } else if (tipo === 'alberoNatale') {
    b.cilindro(0.05, 0.14, 0, 0, 0, T.tronco, 6);
    for (const [r, h, y] of [[0.36, 0.42, 0.1], [0.28, 0.38, 0.38], [0.19, 0.34, 0.64]]) b.cone(r, h, 0, y, 0, '#2E7D45', 8);
    const pallina = ['#E0473C', '#F2C230', '#4FA3E8', '#F6F3EC'];
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4, y = 0.16 + (k % 8) * 0.085, r = 0.33 - y * 0.32;
      b.esfera(0.028, Math.cos(a) * r, y, Math.sin(a) * r, pallina[k % 4]);
    }
    b.cilindro(0.17, 0.05, 0, 0, 0, '#B23A30', 10);
  } else if (tipo === 'quercia') {        // carvalho inglês: copa larga e irregular
    b.cilindro(0.035, 0.2, 0, 0, 0, T.tronco, 5).esfera(0.2, 0, 0.36, 0, '#3F8A44').esfera(0.14, 0.12, 0.44, 0.05, '#4E9A43').esfera(0.13, -0.11, 0.42, -0.06, '#367A3C');
  } else if (tipo === 'abete') {          // pinheiro escocês: tronco alto e copa achatada lá em cima
    b.cilindro(0.025, 0.42, 0, 0, 0, '#8A5A3A', 5);
    const g = new THREE.IcosahedronGeometry(0.17, 0); g.scale(1.3, 0.55, 1.3); b.add(g, '#2C5E3A', 0, 0.48, 0);
  } else if (tipo === 'betulla') {        // bétula: tronco branco e fino
    b.cilindro(0.015, 0.34, 0, 0, 0, '#ECEAE4', 5);
    const g = new THREE.IcosahedronGeometry(0.12, 0); g.scale(0.9, 1.4, 0.9); b.add(g, '#7DB55A', 0, 0.42, 0);
  } else if (tipo === 'palma') {          // cabbage palm da Cornualha
    b.cilindro(0.022, 0.5, 0, 0, 0, '#8A6A45', 5, 0.016);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, g = new THREE.BoxGeometry(0.2, 0.01, 0.025); g.translate(0.1, 0, 0); g.rotateZ(-0.6); g.rotateY(a); b.add(g, '#5E8E3E', 0, 0.5, 0); }
  } else if (tipo === 'anello') {         // anel de destaque da casa selecionada
    const g = new THREE.RingGeometry(0.5, 0.62, 32); g.rotateX(-Math.PI / 2); b.add(g, '#E0473C', 0, 0.01, 0);
  } else if (tipo === 'stellaNatale') {
    b.esfera(0.075, 0, 1.02, 0, T.oro);
  }
  return b.geometria();
}

// placas de texto (em lotes): posição do centro da face, largura e altura
export const PLACCA = { x: 0.2, y: 0.24, z: 0.3, w: 0.44, h: 0.25 };
export const CARTELLONE = { y: 0.42, z: 0, w: 1.0, h: 0.48 };
// letreiro com o nome do pub, acima do térreo (o pub fica à direita na quadra da igreja)
export const INSEGNA_PUB = { x: 0.85, y: 0.205, z: 0.405, w: 0.88, h: 0.1 };
// plano com UV para a face da placa, virado para +z, um pouco à frente da moldura
export function geometriaFaccia(p, dz = 0.011) {
  const g = new THREE.PlaneGeometry(p.w, p.h);
  g.translate(p.x ?? 0, p.y + p.h / 2, p.z + dz);
  return g;
}

// luzes de Natal sobre a rua: dois postes e um fio de lâmpadas (vão ao longo de x)
export function geometriaLuminaria(vao) {
  const postes = new Construtor(), luci = new Construtor(), a = vao / 2, cores = ['#FFE7A0', '#FFD23F', '#FF6B5A', '#FFF6DA'];
  for (const x of [-a, a]) postes.cilindro(0.014, 0.62, x, 0, 0, T.scuro, 5);
  const n = 13;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = -a + t * vao, y = 0.6 - Math.sin(t * Math.PI) * 0.12;
    luci.esfera(0.022, x, y, 0, cores[k % cores.length]);
  }
  // estrela no meio
  luci.esfera(0.05, 0, 0.66, 0, T.oro);
  return { postes: postes.geometria(), luci: luci.geometria() };
}

// ---------- loja de um comércio ("custom": todas as opções do editor) ----------
// Em lotes, frente para +z. Devolve a geometria e as faces de texto (letreiros), que são planos à parte com textura.
export const STILE_BASE = {
  tenda: 'righe', coloreTenda: null, coloreRighe: '#FFFFFF', facciata: '#F3E2C2', porta: '#1F3A6B', bordo: T.bianco,
  piani: 1, vetrina: 'normale', serranda: false, insegna: 'facciata', tetto: false, oggetto: 'nessuno', scala: 1, ornamenti: ['vasi'],
};
export const OPZIONI_STILE = {
  tenda: [['righe', 'Striped'], ['liscia', 'Plain'], ['nessuna', 'No awning']],
  coloreTenda: ['#C8102E', '#F28C28', '#FFC93C', '#2E5E3A', '#1F9E89', '#1F3A6B', '#6C4FD3', '#D94F8A', '#152033', '#FFFFFF'],
  coloreRighe: ['#FFFFFF', '#152033', '#FFC93C', '#C8102E', '#2E5E3A', '#1F3A6B'],
  facciata: ['#F3E2C2', '#A94A34', '#22252B', '#1F3A6B', '#2E5E3A', '#7A1F1F', '#FFE08A', '#FFFFFF', '#9AA3AE', '#F2B8C6'],
  porta: ['#1F3A6B', '#C8102E', '#2E5E3A', '#22252B', '#7A4B2A', '#FFFFFF'],
  bordo: ['#F6F3EC', '#9AA3AE', '#B0623A', '#FFC93C', '#152033', '#1F3A6B'],
  piani: [[1, '1 storey'], [2, '2 storeys']],
  vetrina: [['normale', 'Normal'], ['larga', 'Wide'], ['finestre', 'Windows']],
  serranda: [[false, 'No'], [true, 'Yes']],
  insegna: [['facciata', 'On the front'], ['cassonetto', 'Lightbox'], ['neon', 'Neon'], ['bandiera', 'Hanging sign']],
  tetto: [[false, 'No'], [true, 'Yes']],
  oggetto: [['pesce', '🐟 Fish & chips'], ['pinta', '🍺 Pint'], ['tazza', '🫖 Cuppa'], ['pizza', '🍕 Pizza'], ['gelato', '🍦 Ice cream'], ['cornetto', '🥐 Croissant'], ['pane', '🥖 Bread'], ['torta', '🎂 Cake'],
    ['ciambella', '🍩 Doughnut'], ['maglietta', '👕 T-shirt'], ['scarpa', '👟 Trainer'], ['barbiere', '💈 Barber pole'], ['fiore', '🌸 Flower'],
    ['manubrio', '🏋️ Dumbbell'], ['smartphone', '📱 Mobile'], ['chiave', '🔧 Spanner'], ['libro', '📚 Book'], ['zampa', '🐾 Paw'], ['nessuno', 'None']],
  ornamenti: [['vasi', '🪴 Hanging baskets'], ['dehors', '⛱️ Tables outside'], ['luci', '💡 Fairy lights'], ['bandierine', '🎏 Bunting']],
};
const scuro = (c, k = 0.72) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

function oggettoGigante(b, tipo, y0, s) {
  const S = v => v * s;
  if (tipo === 'pesce') {
    // peixe empanado dourado sobre o papel, com as batatas ao lado
    const g = new THREE.SphereGeometry(S(0.1), 10, 6); g.scale(2.4, 1, 0.7); b.add(g, '#E8A94A', 0, y0 + S(0.14), 0);
    const cauda = new THREE.ConeGeometry(S(0.08), S(0.14), 4); cauda.rotateZ(Math.PI / 2); b.add(cauda, '#D99A3A', S(0.3), y0 + S(0.14), 0);
    for (let k = 0; k < 6; k++) b.caixa(S(0.025), S(0.16), S(0.025), S(-0.16 + k * 0.03), y0, S(0.08), '#F5D16A');
  } else if (tipo === 'pinta') {
    b.cilindro(S(0.11), S(0.36), 0, y0, 0, '#C77A1E', 12, S(0.13)).cilindro(S(0.135), S(0.08), 0, y0 + S(0.36), 0, '#FFF6E0', 12);
    const h = new THREE.TorusGeometry(S(0.07), S(0.02), 6, 12); b.add(h, '#E9E4D8', S(0.15), y0 + S(0.2), 0);
  } else if (tipo === 'tazza') {
    // bule de chá
    b.esfera(S(0.17), 0, y0 + S(0.17), 0, T.bianco).cupola(S(0.06), 0, y0 + S(0.32), 0, T.navy);
    const bico = new THREE.CylinderGeometry(S(0.02), S(0.04), S(0.18), 6); bico.rotateZ(-0.9); b.add(bico, T.bianco, S(0.2), y0 + S(0.22), 0);
    const h = new THREE.TorusGeometry(S(0.07), S(0.02), 6, 12); b.add(h, T.bianco, S(-0.18), y0 + S(0.2), 0);
  } else if (tipo === 'pizza') {
    // fatia de pé, ponta para baixo, de frente para a rua
    const forma = new THREE.Shape([new THREE.Vector2(-S(0.26), S(0.58)), new THREE.Vector2(S(0.26), S(0.58)), new THREE.Vector2(0, S(0.04))]);
    const g = new THREE.ExtrudeGeometry(forma, { depth: S(0.05), bevelEnabled: false });
    g.translate(0, 0, -S(0.025));
    b.add(g, '#F5C04A', 0, y0, 0);
    b.caixa(S(0.58), S(0.07), S(0.07), 0, y0 + S(0.56), 0, '#C98A3A');
    for (const [x, y] of [[-0.08, 0.44], [0.08, 0.42], [0, 0.28], [0.03, 0.15]]) { const p = new THREE.CylinderGeometry(S(0.04), S(0.04), S(0.012), 10); p.rotateX(Math.PI / 2); b.add(p, '#C8402E', S(x), y0 + S(y), S(0.03)); }
  } else if (tipo === 'gelato') {
    // casquinha com o "flake" de chocolate espetado (o 99 das vans de sorvete)
    const g = new THREE.ConeGeometry(S(0.11), S(0.36), 8); g.rotateX(Math.PI); g.translate(0, y0 + S(0.18), 0); b.add(g, '#D9A35A', 0, 0, 0);
    b.esfera(S(0.13), 0, y0 + S(0.44), 0, '#FFF6E6');
    const fl = new THREE.BoxGeometry(S(0.04), S(0.2), S(0.04)); fl.rotateZ(0.4); b.add(fl, '#6B3E1E', S(0.07), y0 + S(0.55), 0);
  } else if (tipo === 'cornetto') {
    for (let k = -2; k <= 2; k++) { const r = S(0.09 - Math.abs(k) * 0.02); b.esfera(r, S(k * 0.09), y0 + S(0.12) + Math.abs(k) * S(0.03), 0, k % 2 ? '#D99A45' : '#E8AE5A'); }
  } else if (tipo === 'pane') {
    const g = new THREE.SphereGeometry(S(0.1), 10, 6); g.scale(3, 1, 1); b.add(g, '#D9A35A', 0, y0 + S(0.1), 0);
    for (const x of [-0.12, 0, 0.12]) b.caixa(S(0.02), S(0.02), S(0.12), S(x), y0 + S(0.19), 0, '#F2D49A');
  } else if (tipo === 'torta') {
    b.cilindro(S(0.24), S(0.12), 0, y0, 0, '#F7B6C8', 16).cilindro(S(0.17), S(0.1), 0, y0 + S(0.12), 0, '#FFF3D6', 16).cilindro(S(0.1), S(0.08), 0, y0 + S(0.22), 0, '#F7B6C8', 16);
    b.cilindro(S(0.012), S(0.1), 0, y0 + S(0.3), 0, '#2F7DD1', 6).esfera(S(0.02), 0, y0 + S(0.42), 0, '#FFC93C');
  } else if (tipo === 'ciambella') {
    const g = new THREE.TorusGeometry(S(0.17), S(0.08), 8, 18); b.add(g, '#E8AE5A', 0, y0 + S(0.26), 0);
    const gl = new THREE.TorusGeometry(S(0.17), S(0.07), 8, 18, Math.PI * 2); gl.translate(0, 0, S(0.025)); b.add(gl, '#F27FA8', 0, y0 + S(0.26), 0);
  } else if (tipo === 'maglietta') {
    b.caixa(S(0.3), S(0.36), S(0.06), 0, y0, 0, '#2F7DD1').caixa(S(0.5), S(0.11), S(0.06), 0, y0 + S(0.25), 0, '#2F7DD1').caixa(S(0.1), S(0.03), S(0.065), 0, y0 + S(0.34), 0, T.bianco);
  } else if (tipo === 'scarpa') {
    b.caixa(S(0.44), S(0.06), S(0.16), 0, y0, 0, T.bianco).caixa(S(0.4), S(0.1), S(0.15), S(-0.01), y0 + S(0.06), 0, '#E0473C').caixa(S(0.18), S(0.12), S(0.15), S(-0.11), y0 + S(0.16), 0, '#E0473C');
  } else if (tipo === 'barbiere') {
    for (let k = 0; k < 6; k++) b.cilindro(S(0.08), S(0.09), 0, y0 + S(k * 0.09), 0, ['#E0473C', T.bianco, '#2F7DD1'][k % 3], 12);
    b.esfera(S(0.09), 0, y0 + S(0.58), 0, '#DDE1E8');
  } else if (tipo === 'fiore') {
    b.cilindro(S(0.02), S(0.34), 0, y0, 0, T.foglia, 6);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.esfera(S(0.08), Math.cos(a) * S(0.11), y0 + S(0.42), Math.sin(a) * S(0.04), '#F27FA8'); }
    b.esfera(S(0.07), 0, y0 + S(0.42), S(0.04), '#FFC93C');
  } else if (tipo === 'manubrio') {
    const g = new THREE.CylinderGeometry(S(0.025), S(0.025), S(0.5), 8); g.rotateZ(Math.PI / 2); b.add(g, T.grigio, 0, y0 + S(0.16), 0);
    for (const x of [-0.2, 0.2]) { const d = new THREE.CylinderGeometry(S(0.14), S(0.14), S(0.07), 14); d.rotateZ(Math.PI / 2); b.add(d, T.scuro, S(x), y0 + S(0.16), 0); }
  } else if (tipo === 'smartphone') {
    b.caixa(S(0.24), S(0.46), S(0.04), 0, y0, 0, T.scuro).caixa(S(0.2), S(0.38), S(0.01), 0, y0 + S(0.04), S(0.022), '#4FA3E8');
  } else if (tipo === 'chiave') {
    // spanner inclinado: cabo + boca aberta
    const cabo = new THREE.BoxGeometry(S(0.09), S(0.5), S(0.05)); cabo.rotateZ(-0.6); b.add(cabo, '#B8BEC6', 0, y0 + S(0.3), 0);
    for (const dx of [-0.07, 0.07]) { const d = new THREE.BoxGeometry(S(0.06), S(0.14), S(0.05)); d.rotateZ(-0.6); b.add(d, '#9AA3AE', S(0.16 + dx * 0.8), y0 + S(0.52 + dx * 0.55), 0); }
    const base = new THREE.CylinderGeometry(S(0.08), S(0.08), S(0.05), 12); base.rotateX(Math.PI / 2); b.add(base, '#9AA3AE', S(-0.14), y0 + S(0.1), 0);
  } else if (tipo === 'libro') {
    for (const s0 of [-1, 1]) { const g = new THREE.BoxGeometry(S(0.24), S(0.03), S(0.32)); g.rotateZ(s0 * -0.35); b.add(g, s0 < 0 ? '#2F7DD1' : '#E0473C', s0 * S(0.12), y0 + S(0.08), 0); }
    for (const s0 of [-1, 1]) { const g = new THREE.BoxGeometry(S(0.22), S(0.02), S(0.29)); g.rotateZ(s0 * -0.35); b.add(g, T.bianco, s0 * S(0.115), y0 + S(0.1), 0); }
  } else if (tipo === 'zampa') {
    b.esfera(S(0.13), 0, y0 + S(0.13), 0, '#7A4B2A');
    for (const [x, y] of [[-0.14, 0.3], [-0.05, 0.36], [0.05, 0.36], [0.14, 0.3]]) b.esfera(S(0.055), S(x), y0 + S(y), 0, '#7A4B2A');
  }
}

export function costruisciNegozio(cor, stileIn = {}) {
  const st = { ...STILE_BASE, coloreTenda: cor, ...stileIn };
  const b = new Construtor(), facce = [];
  const W = 0.72, D = 0.4, F = 0.2, hP = 0.62, H = st.piani === 2 ? 1.0 : hP;
  b.caixa(W, H, D, 0, 0, 0, st.facciata).caixa(W + 0.04, 0.04, D + 0.04, 0, H, 0, st.bordo);
  // vitrine e porta
  if (st.vetrina === 'larga') b.caixa(0.5, 0.26, 0.02, -0.08, 0.05, F, T.vetro);
  else if (st.vetrina === 'finestre') for (const x of [-0.25, -0.05]) b.caixa(0.13, 0.15, 0.02, x, 0.14, F, T.vetro).caixa(0.15, 0.02, 0.025, x, 0.13, F, T.bianco);
  else b.caixa(0.36, 0.24, 0.02, -0.12, 0.06, F, T.vetro);
  b.caixa(0.13, 0.26, 0.02, 0.22, 0, F, st.porta);
  if (st.serranda) {
    const larg = st.vetrina === 'larga' ? 0.5 : 0.36, x = st.vetrina === 'larga' ? -0.08 : -0.12;
    for (let k = 0; k < 4; k++) b.caixa(larg + 0.02, 0.022, 0.026, x, 0.31 - k * 0.026, F, k % 2 ? '#B8BEC6' : '#9AA3AE');
  }
  if (st.piani === 2) for (const x of [-0.22, 0, 0.22]) b.caixa(0.12, 0.14, 0.02, x, 0.74, F, T.vetro).caixa(0.14, 0.02, 0.03, x, 0.73, F, st.bordo);
  // toldo
  if (st.tenda === 'righe') for (let k = 0; k < 6; k++) { const g = new THREE.BoxGeometry(0.13, 0.015, 0.16); g.rotateX(0.45); b.add(g, k % 2 ? st.coloreRighe : st.coloreTenda, -0.325 + k * 0.13, 0.36, 0.27); }
  else if (st.tenda === 'liscia') { const g = new THREE.BoxGeometry(0.78, 0.015, 0.16); g.rotateX(0.45); b.add(g, st.coloreTenda, 0, 0.36, 0.27); }
  // letreiros (faces com o nome)
  if (st.insegna === 'cassonetto') {
    b.caixa(0.62, 0.17, 0.06, 0, H + 0.04, F - 0.04, scuro(cor)).cilindro(0.01, 0.04, -0.2, H + 0.02, F - 0.04, T.scuro, 4).cilindro(0.01, 0.04, 0.2, H + 0.02, F - 0.04, T.scuro, 4);
    facce.push({ tipo: 'insegna', p: { x: 0, y: H + 0.045, z: F - 0.04 + 0.031, w: 0.58, h: 0.15 } });
  } else if (st.insegna === 'bandiera') {
    b.caixa(0.03, 0.03, 0.18, 0.33, 0.5, F + 0.07, T.scuro).caixa(0.025, 0.2, 0.16, 0.33, 0.29, F + 0.1, T.scuro);
    facce.push({ tipo: 'bandiera', p: { x: 0, y: 0.3, z: 0, w: 0.15, h: 0.18 }, ry: Math.PI / 2, dx: 0.344, dz: F + 0.1 });
    facce.push({ tipo: 'bandiera', p: { x: 0, y: 0.3, z: 0, w: 0.15, h: 0.18 }, ry: -Math.PI / 2, dx: 0.316, dz: F + 0.1 });
  } else {
    const y = st.tenda === 'nessuna' ? 0.38 : 0.47;
    b.caixa(0.7, 0.17, 0.025, 0, y - 0.01, F, st.insegna === 'neon' ? '#14161F' : scuro(cor));
    facce.push({ tipo: st.insegna === 'neon' ? 'neon' : 'insegna', p: { x: 0, y, z: F + 0.014, w: 0.66, h: 0.15 } });
  }
  const conOggetto = st.oggetto && st.oggetto !== 'nessuno', zTetto = conOggetto ? -0.17 : -0.12;
  if (st.tetto) {
    for (const x of [-0.24, 0.24]) b.caixa(0.03, 0.12, 0.03, x, H + 0.04, zTetto, T.scuro);
    b.caixa(0.66, 0.3, 0.03, 0, H + 0.14, zTetto, T.scuro);
    facce.push({ tipo: 'tetto', p: { x: 0, y: H + 0.155, z: zTetto + 0.016, w: 0.62, h: 0.27 } });
  }
  // objeto gigante no telhado (à frente da placa do telhado, quando as duas existem)
  if (conOggetto) {
    const ob = new Construtor();
    oggettoGigante(ob, st.oggetto, H + 0.04 + (st.insegna === 'cassonetto' ? 0.14 : 0), Math.max(0.5, Math.min(1.5, +st.scala || 1)));
    for (const p of ob.partes) { if (st.tetto) p.translate(0, 0, 0.07); b.partes.push(p); }
  }
  // enfeites
  const orn = new Set(st.ornamenti ?? []);
  if (orn.has('vasi')) for (const x of [-0.3, 0.33]) cestino(b, x, H * 0.62, F + 0.04);
  if (orn.has('dehors')) for (const x of [-0.18, 0.12]) {
    b.cilindro(0.05, 0.004, x, 0.07, 0.41, T.bianco, 10).cilindro(0.006, 0.07, x, 0, 0.41, T.scuro, 4);
    b.cilindro(0.006, 0.22, x, 0, 0.41, T.grigio, 4).cone(0.11, 0.06, x, 0.2, 0.41, x < 0 ? st.coloreTenda : T.bianco, 8);
  }
  if (orn.has('luci')) for (let k = 0; k <= 10; k++) { const t = k / 10; b.esfera(0.014, -0.36 + t * 0.72, H - 0.04 - Math.sin(t * Math.PI) * 0.05, F + 0.03, ['#FFE7A0', '#FFD23F', '#FF6B5A'][k % 3]); }
  if (orn.has('bandierine')) for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9, g = new THREE.BufferGeometry();
    // ordem anti-horária vista da rua (+z), senão o triângulo fica de costas e some
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.025, 0, 0, 0, -0.05, 0, 0.025, 0, 0]), 3));
    b.add(g, ['#C8102E', '#FFFFFF', '#1F3A6B'][k % 3], -0.36 + t * 0.72, H + 0.02 - Math.sin(t * Math.PI) * 0.04, F + 0.04);
  }
  return { geo: b.geometria(), facce, stile: st };
}
// compatibilidade: loja padrão (sem personalização) e posição do letreiro padrão
export const INSEGNA = { x: 0, y: 0.47, z: 0.215, w: 0.66, h: 0.15 };
export const geometriaNegozio = cor => costruisciNegozio(cor).geo;
