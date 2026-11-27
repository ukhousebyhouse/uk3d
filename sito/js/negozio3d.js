// Loja 3D completa de um comércio (prédio + letreiros com nome/logo), usada no mapa e na prévia do editor.
import * as THREE from 'three';
import { costruisciNegozio } from './modelli.js';
import { texturaFaccia, carregarImagem, fontePronta } from './insegne.js';
import { nataleAttivo } from './regole.js';
import { conNeve } from './neve.js';

// no Natal a loja também ganha neve em cima, menos na prévia do editor (negozio.html), para o lojista ver as cores reais
const _matLoja = new THREE.MeshLambertMaterial({ vertexColors: true });
const matLoja = nataleAttivo() && typeof location !== 'undefined' && !/negozio\.html/.test(location.pathname) ? conNeve(_matLoja) : _matLoja;

// van de comida (unidades de lote): comprimento no eixo x, a janela de atendimento virada para +z (rua / câmera)
function furgone(cor, st = {}) {
  const g = new THREE.Group(), L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const corpo = cor, branco = '#F6F3EC', scuro = '#1E2430', vetro = '#9FD3E6';
  box(0.5, 0.3, 0.28, -0.08, 0.07, 0, corpo);                 // caixa traseira
  box(0.52, 0.03, 0.3, -0.08, 0.37, 0, branco);               // teto
  box(0.2, 0.22, 0.28, 0.27, 0.07, 0, corpo);                 // cabine
  box(0.02, 0.1, 0.24, 0.37, 0.18, 0, vetro);                 // para-brisa
  box(0.1, 0.08, 0.005, 0.28, 0.19, 0.142, vetro);            // janela da porta
  box(0.5, 0.035, 0.005, -0.08, 0.1, 0.142, branco);          // faixa
  box(0.3, 0.13, 0.006, -0.1, 0.19, 0.143, scuro);            // janela de atendimento
  box(0.32, 0.02, 0.06, -0.1, 0.17, 0.17, '#C9CED6');         // balcão
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.12), L(st.coloreTenda ?? '#FFC93C'));
  toldo.position.set(-0.1, 0.34, 0.19); toldo.rotation.x = 0.5; g.add(toldo);
  for (const [x, z] of [[-0.24, 0.13], [0.06, 0.13], [-0.24, -0.13], [0.26, 0.13], [0.26, -0.13], [0.06, -0.13]].filter((_, i) => i !== 1 && i !== 5)) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), L(scuro)); r.rotation.x = Math.PI / 2; r.position.set(x, 0.055, z); g.add(r);
  }
  box(0.46, 0.12, 0.02, -0.06, 0.41, 0, scuro);               // suporte do letreiro do teto
  return g;
}

// "Negozio di Natale" (patrocínio pago, data/natale.json): neve no telhado, luzinhas na fachada, guirlanda na porta e
// arvorezinha com estrela ao lado. Medidas do prédio de costruisciNegozio: W 0.72, frente em z 0.2, altura H.
const _mn = new Map();
const mN = (c, brilho = false) => { const k = c + brilho; if (!_mn.has(k)) _mn.set(k, brilho ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c })); return _mn.get(k); };
function addobbiNatale(H, tx = 0.42) {   // tx: lado da arvorezinha (UK: do outro lado quando a loja tem a van ao lado)
  const g = new THREE.Group(), F = 0.2;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(0.8, 0.035, 0.48), mN('#FFFFFF'), 0, H + 0.075, 0);                                   // neve sul tetto
  for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.03, 6, 4), mN('#FFFFFF'), -0.33 + k * 0.13, H + 0.07, F + 0.03).scale.set(1.4, 0.7, 1);   // neve che cola
  const luci = ['#FF3B3B', '#FFD23F', '#3FD06B', '#3FA9F5'];
  for (let k = 0; k < 11; k++) add(new THREE.SphereGeometry(0.014, 6, 4), mN(luci[k % 4], true), -0.34 + k * 0.068, H + 0.01 - Math.sin(k / 10 * Math.PI * 5) ** 2 * 0.02, F + 0.035);   // luminarie
  add(new THREE.TorusGeometry(0.045, 0.014, 6, 14), mN('#2E7D3A'), 0.22, 0.2, F + 0.02);                         // ghirlanda sulla porta
  add(new THREE.SphereGeometry(0.014, 6, 4), mN('#D3252B'), 0.22, 0.16, F + 0.035);
  // alberello con stella e palline, accanto alla porta
  for (const [r, y, h] of [[0.09, 0.03, 0.14], [0.07, 0.12, 0.12], [0.05, 0.2, 0.1]]) add(new THREE.ConeGeometry(r, h, 8), mN('#2E7D3A'), tx, y + h / 2, F + 0.1);
  add(new THREE.CylinderGeometry(0.035, 0.04, 0.04, 8), mN('#B83A3A'), tx, 0.02, F + 0.1);
  add(new THREE.OctahedronGeometry(0.025), mN('#FFD23F', true), tx, 0.32, F + 0.1);
  for (const [x, y, z, c] of [[tx - 0.04, 0.09, F + 0.15, '#FF3B3B'], [tx + 0.04, 0.15, F + 0.13, '#FFD23F'], [tx - 0.02, 0.2, F + 0.13, '#3FA9F5']]) add(new THREE.SphereGeometry(0.012, 6, 4), mN(c, true), x, y, z);
  return g;
}

// cm: { nome, colore, logo, stile }. aoMudar(): chamado quando as texturas ficam prontas (para redesenhar)
export function creaNegozio3D(cm, { aoMudar = () => {}, material = matLoja } = {}) {
  const g = new THREE.Group();
  const { geo, facce } = costruisciNegozio(cm.colore, cm.stile ?? {});
  g.add(new THREE.Mesh(geo, material));
  const malhas = facce.map(f => {
    const pg = new THREE.PlaneGeometry(f.p.w, f.p.h);
    if (f.ry) { pg.rotateY(f.ry); pg.translate(f.dx ?? 0, f.p.y + f.p.h / 2, f.dz ?? 0); }
    else pg.translate(f.p.x ?? 0, f.p.y + f.p.h / 2, f.p.z);
    const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: f.tipo === 'neon' }));
    m.userData.tipo = f.tipo;
    g.add(m);
    return m;
  });
  // chippy/food truck: van estacionada na rua ao lado da loja (stile.van), com o nome no letreiro do teto
  if (cm.stile?.van) {
    const v = furgone(cm.stile.coloreVan ?? cm.colore, cm.stile);
    v.position.set(cm.stile.vanX ?? 0.62, 0, cm.stile.vanZ ?? 0.5);
    g.add(v);
    const pg = new THREE.PlaneGeometry(0.44, 0.1); pg.translate(-0.06, 0.47, 0.012);
    const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.userData.tipo = 'insegna';
    m.position.copy(v.position); g.add(m); malhas.push(m);
  }
  const pintar = logo => {
    for (const m of malhas) { m.material.map?.dispose(); m.material.map = texturaFaccia(m.userData.tipo, cm, logo); m.material.needsUpdate = true; }
    aoMudar();
  };
  pintar(null);
  Promise.all([carregarImagem(cm.logo), fontePronta]).then(([logo]) => pintar(logo));
  if (cm.natale && nataleAttivo()) g.add(addobbiNatale(cm.stile?.piani === 2 ? 1.0 : 0.62, cm.stile?.van ? -0.42 : 0.42));
  g.userData.descartar = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== material) { o.material.map?.dispose(); o.material.dispose(); } } });
  return g;
}
