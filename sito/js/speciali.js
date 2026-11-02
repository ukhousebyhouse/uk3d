// Casas raras da loja (decori.js): modelos únicos que trocam a casa inteira. Só uma de cada por cidade ao mesmo tempo.
// Em lotes (1 = um lote), frente virada para +z, base no chão. Cada uma devolve { geo, h, extra, anima }:
// geo = corpo com cores por vértice; h = altura (rótulo e câmera); extra/anima = peças que se mexem (pás, farol, chama).
// a lista igual está em api/decora.php
import * as THREE from 'three';
import { Construtor, T, cabina } from './modelli.js';

export const SPECIALI = [
  { id: 'faro', em: '🗼', nome: 'Lighthouse' },
  { id: 'castello', em: '🏰', nome: 'Castle' },
  { id: 'mulino', em: '🌬️', nome: 'Windmill' },
  { id: 'barca', em: '🚤', nome: 'Narrowboat' },
  { id: 'bus', em: '🚌', nome: 'Double-decker' },
  { id: 'albero', em: '🌳', nome: 'Treehouse' },
  { id: 'capanne', em: '🏖️', nome: 'Beach huts' },
  { id: 'pastore', em: '🐑', nome: "Shepherd's hut" },
  { id: 'collina', em: '⛰️', nome: 'Hillside house' },
  { id: 'stregata', em: '👻', nome: 'Haunted manor' },
  { id: 'osservatorio', em: '🔭', nome: 'Observatory' },
  { id: 'zenzero', em: '🍪', nome: 'Gingerbread house' },
  { id: 'cabina', em: '☎️', nome: 'Giant phone box' },
  { id: 'teiera', em: '☕', nome: 'Teapot cottage' },
  { id: 'razzo', em: '🚀', nome: 'Rocket' },
];

const lambert = cor => new THREE.MeshLambertMaterial({ color: cor });
const luce = (cor, op = 0.5) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
// peça de cores por vértice (para as partes que giram)
const pezzo = f => { const b = new Construtor(); f(b); return new THREE.Mesh(b.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true })); };
// meio cilindro deitado ao longo de x (telhado curvo)
function arco(b, r, len, x, y, z, cor) { const g = new THREE.CylinderGeometry(r, r, len, 12, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); return b.add(g, cor, x, y, z); }
// disco virado para a frente (+z): portas e janelas redondas
function disco(b, r, x, y, z, cor, seg = 14) { const g = new THREE.CylinderGeometry(r, r, 0.012, seg); g.rotateX(Math.PI / 2); return b.add(g, cor, x, y, z); }
function grama(b, w = 0.96, d = 0.96, cor = '#8FC064') { b.quad(w, d, 0, 0.002, 0, cor); }
function aiuola(b, x, z) { for (let i = 0; i < 4; i++) b.esfera(0.018, x - 0.03 + i * 0.02, 0.018, z + (i % 2) * 0.012, ['#E0473C', '#FF7EB6', '#F2C230', '#9B5DE5'][i]); }

const COSTRUTTORI = {
  // farol listrado com a casinha do faroleiro; o facho gira
  faro() {
    const b = new Construtor();
    grama(b, 0.96, 0.96, '#9BC77A');
    for (const [x, z, r] of [[-0.3, 0.3, 0.07], [-0.36, 0.18, 0.05], [0.35, -0.32, 0.06], [-0.2, -0.36, 0.05]]) b.esfera(r, x, r * 0.4, z, '#8F918D');
    b.caixa(0.26, 0.2, 0.22, 0.24, 0, 0.18, T.bianco).telhado(0.28, 0.24, 0.1, 0.24, 0.2, 0.18, '#C8102E');
    b.caixa(0.06, 0.12, 0.012, 0.24, 0, 0.295, '#1F3A6B');
    const H = 1.25, n = 6;
    for (let k = 0; k < n; k++) {
      const r0 = 0.15 - k * 0.01, r1 = 0.15 - (k + 1) * 0.01;
      b.cilindro(r0, H / n, -0.08, k * H / n, -0.06, k % 2 ? T.bianco : '#C8102E', 14, r1);
    }
    b.cilindro(0.12, 0.03, -0.08, H, -0.06, T.scuro, 14).cilindro(0.07, 0.14, -0.08, H + 0.03, -0.06, '#FFE29A', 10);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.caixa(0.008, 0.14, 0.008, -0.08 + Math.cos(a) * 0.072, H + 0.03, -0.06 + Math.sin(a) * 0.072, T.scuro); }
    b.cupola(0.08, -0.08, H + 0.17, -0.06, '#C8102E').cilindro(0.006, 0.08, -0.08, H + 0.24, -0.06, T.scuro, 4);
    for (const y of [0.35, 0.65, 0.95]) b.caixa(0.04, 0.06, 0.012, -0.08, y, 0.075, T.scuro);
    const facho = new THREE.Group();
    facho.position.set(-0.08, H + 0.1, -0.06);
    for (const s of [-1, 1]) {
      const g = new THREE.ConeGeometry(0.12, 1.1, 12, 1, true); g.rotateZ(s * Math.PI / 2); g.translate(s * 0.55, 0, 0);
      facho.add(new THREE.Mesh(g, luce('#FFE9A8', 0.28)));
    }
    return { geo: b.geometria(), h: 1.5, extra: facho, anima: (t, notte) => { facho.rotation.y = t * 0.0012; facho.children.forEach(m => { m.material.opacity = notte ? 0.42 : 0.18; }); } };
  },

  // castelo: torre de menagem, 4 torres com ameias, portão e bandeira
  castello() {
    const b = new Construtor(), P = '#B9B2A3', P2 = '#A39C8E';
    grama(b);
    const ameias = (w, d, x, y, z) => {
      for (let k = 0; k < 5; k++) for (const s of [-1, 1]) {
        b.caixa(w / 9, 0.04, 0.03, x - w / 2 + (k * 2 + 0.5) * w / 9, y, z + s * (d / 2 - 0.015), P2);
        b.caixa(0.03, 0.04, d / 9, x + s * (w / 2 - 0.015), y, z - d / 2 + (k * 2 + 0.5) * d / 9, P2);
      }
    };
    b.caixa(0.62, 0.26, 0.56, 0, 0, -0.05, P);   // muralha
    ameias(0.62, 0.56, 0, 0.26, -0.05);
    b.caixa(0.32, 0.62, 0.3, 0, 0, -0.08, P2);    // menagem
    ameias(0.32, 0.3, 0, 0.62, -0.08);
    for (const x of [-0.31, 0.31]) for (const z of [-0.33, 0.23]) {
      b.cilindro(0.09, 0.44, x, 0, z, P, 10).cilindro(0.1, 0.03, x, 0.44, z, P2, 10).cone(0.11, 0.2, x, 0.47, z, '#3E5A7A', 10);
    }
    b.caixa(0.14, 0.18, 0.02, 0, 0, 0.23, '#4A3A2A').cupola(0.07, 0, 0.18, 0.232, '#4A3A2A');
    for (const x of [-0.17, 0.17]) b.caixa(0.03, 0.06, 0.012, x, 0.12, 0.23, T.scuro);
    for (const y of [0.36, 0.5]) b.caixa(0.03, 0.06, 0.012, 0, y, 0.075, T.scuro);
    b.quad(0.14, 0.24, 0, 0.003, 0.36, '#C9C2B2');
    b.cilindro(0.006, 0.3, 0.1, 0.62, -0.08, T.grigio, 4);
    b.caixa(0.14, 0.08, 0.008, 0.17, 0.82, -0.08, '#C8102E').caixa(0.04, 0.04, 0.01, 0.15, 0.84, -0.08, '#F2C230');
    return { geo: b.geometria(), h: 0.95 };
  },

  // moinho de torre (Norfolk): torre preta, chapéu branco em forma de barco; as pás giram
  mulino() {
    const b = new Construtor();
    grama(b);
    b.cilindro(0.2, 0.8, 0, 0, -0.05, '#3A3530', 8, 0.13);
    b.cupola(0.15, 0, 0.8, -0.05, T.bianco).caixa(0.06, 0.04, 0.12, 0, 0.82, -0.2, T.bianco);
    b.caixa(0.08, 0.16, 0.012, 0, 0, 0.14, T.bianco).caixa(0.065, 0.14, 0.014, 0, 0, 0.142, '#2E5E3A');
    for (const y of [0.3, 0.55]) b.caixa(0.05, 0.07, 0.012, 0, y, 0.115 - y * 0.08, T.bianco);
    b.caixa(0.3, 0.012, 0.12, 0, 0.18, 0.08, '#6E4A2D');   // varanda
    aiuola(b, -0.3, 0.3); aiuola(b, 0.3, 0.32);
    const pas = new THREE.Group();
    pas.position.set(0, 0.84, 0.13);
    pas.add(pezzo(p => {
      p.cilindro(0.025, 0.03, 0, -0.015, 0, T.scuro, 8);
      for (let k = 0; k < 4; k++) {
        const g = new THREE.BoxGeometry(0.02, 0.5, 0.01); g.translate(0, 0.27, 0); g.rotateZ(k * Math.PI / 2); p.add(g, '#6E4A2D', 0, 0, 0);
        const v = new THREE.BoxGeometry(0.075, 0.4, 0.006); v.translate(0.045, 0.3, 0.004); v.rotateZ(k * Math.PI / 2); p.add(v, '#F4F1EA', 0, 0, 0);
      }
    }));
    return { geo: b.geometria(), h: 1.3, extra: pas, anima: t => { pas.rotation.z = -t * 0.0011; } };
  },

  // narrowboat colorido no canal, com vasos de flor no teto
  barca() {
    const b = new Construtor();
    grama(b);
    b.quad(0.96, 0.4, 0, 0.004, 0.02, '#4F93B0');
    for (const z of [-0.19, 0.23]) b.caixa(0.96, 0.03, 0.04, 0, 0, z, '#9C9E9A');
    b.caixa(0.82, 0.07, 0.15, 0, -0.01, 0.02, '#1F4A30').caixa(0.82, 0.015, 0.152, 0, 0.045, 0.02, '#F2C230');
    b.caixa(0.6, 0.11, 0.12, -0.04, 0.06, 0.02, '#9A2A2A').caixa(0.62, 0.012, 0.13, -0.04, 0.17, 0.02, '#1F4A30');
    for (let k = 0; k < 6; k++) disco(b, 0.018, -0.3 + k * 0.1, 0.115, 0.082, '#FFE29A', 10);
    b.caixa(0.04, 0.07, 0.006, 0.23, 0.07, 0.082, '#F2C230');
    b.cilindro(0.012, 0.07, -0.25, 0.18, 0.02, T.scuro, 6);
    for (const [x, c] of [[-0.12, '#E0473C'], [0.0, '#FF7EB6'], [0.12, '#F2C230']]) b.cilindro(0.018, 0.025, x, 0.18, 0.02, '#C8693A', 6).esfera(0.022, x, 0.215, 0.02, c);
    b.caixa(0.012, 0.08, 0.012, 0.4, 0.04, 0.02, '#6E4A2D');
    for (const x of [-0.42, 0.42]) b.cilindro(0.015, 0.04, x, 0, -0.32, '#22252B', 6);   // amarras
    aiuola(b, -0.3, 0.36); aiuola(b, 0.25, 0.38);
    return { geo: b.geometria(), h: 0.4 };
  },

  // ônibus de dois andares vermelho virado casa, com jardinzinho
  bus() {
    const b = new Construtor();
    grama(b);
    b.caixa(0.72, 0.4, 0.24, 0, 0.05, -0.02, '#C8102E');
    b.caixa(0.73, 0.03, 0.245, 0, 0.24, -0.02, '#F4E9C9');
    for (const y of [0.12, 0.3]) b.caixa(0.66, 0.08, 0.246, 0.0, y, -0.02, '#3A4A5A');
    for (let k = 0; k < 6; k++) b.caixa(0.012, 0.08, 0.25, -0.3 + k * 0.12, 0.12, -0.02, '#C8102E').caixa(0.012, 0.08, 0.25, -0.3 + k * 0.12, 0.3, -0.02, '#C8102E');
    b.caixa(0.24, 0.05, 0.008, -0.2, 0.39, 0.102, T.scuro).caixa(0.06, 0.13, 0.008, 0.28, 0.06, 0.102, '#F2C230');
    for (const x of [-0.24, 0.24]) for (const z of [-0.14, 0.1]) { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12); g.rotateX(Math.PI / 2); b.add(g, '#22252B', x, 0.05, z); }
    for (let k = -4; k <= 4; k++) b.caixa(0.012, 0.06, 0.012, k * 0.1, 0, 0.4, T.bianco);
    b.caixa(0.86, 0.01, 0.01, 0, 0.05, 0.4, T.bianco);
    aiuola(b, -0.3, 0.3); aiuola(b, 0.05, 0.3);
    b.caixa(0.04, 0.03, 0.06, 0.32, 0, 0.28, '#3FA7F5');
    return { geo: b.geometria(), h: 0.55 };
  },

  // casa na árvore: carvalho enorme, plataforma, casinha e escada de corda
  albero() {
    const b = new Construtor();
    grama(b);
    b.cilindro(0.08, 0.7, 0, 0, -0.12, T.tronco, 7, 0.06);
    // copa atrás e dos lados: a casinha fica à mostra na frente
    for (const [x, y, z, r] of [[0, 0.86, -0.26, 0.28], [-0.27, 0.66, -0.12, 0.18], [0.28, 0.7, -0.16, 0.19], [0.06, 1.02, -0.2, 0.18]]) b.esfera(r, x, y, z, r > 0.25 ? T.foglia : '#4E9A43');
    b.caixa(0.44, 0.03, 0.36, 0, 0.42, 0.08, '#9C7148');
    b.caixa(0.28, 0.2, 0.22, 0, 0.45, 0.08, '#B98A5A').telhado(0.32, 0.26, 0.12, 0, 0.65, 0.08, '#C8102E');
    b.caixa(0.07, 0.12, 0.012, -0.05, 0.45, 0.195, '#6E4A2D');
    disco(b, 0.03, 0.08, 0.55, 0.195, '#FFE29A');
    for (const x of [-0.2, 0.2]) b.caixa(0.012, 0.08, 0.012, x, 0.45, 0.25, '#6E4A2D');
    b.caixa(0.42, 0.012, 0.012, 0, 0.52, 0.25, '#6E4A2D');
    for (const x of [0.15, 0.2]) b.caixa(0.006, 0.42, 0.006, x, 0, 0.3, '#C9A86A');
    for (let k = 1; k < 7; k++) b.caixa(0.05, 0.008, 0.012, 0.175, k * 0.06, 0.3, '#9C7148');
    b.esfera(0.06, -0.3, 0.06, 0.3, '#3F7F3A');
    return { geo: b.geometria(), h: 1.15 };
  },

  // fileira de beach huts coloridas na areia, com espreguiçadeira listrada
  capanne() {
    const b = new Construtor();
    b.quad(0.96, 0.96, 0, 0.002, 0, '#EED9A6');
    const cores = ['#F2B8C6', '#9FD3E6', '#F7DC6F', '#A8E0C2'];
    cores.forEach((c, k) => {
      const x = -0.33 + k * 0.22;
      b.caixa(0.19, 0.24, 0.2, x, 0, -0.08, c).telhado(0.21, 0.22, 0.08, x, 0.24, -0.08, T.bianco);
      b.caixa(0.08, 0.17, 0.012, x, 0, 0.022, T.bianco);
      for (let s = 0; s < 3; s++) b.caixa(0.012, 0.17, 0.014, x - 0.028 + s * 0.028, 0, 0.024, c);
      b.caixa(0.2, 0.02, 0.08, x, 0, 0.06, '#C9A86A');
    });
    // espreguiçadeira e guarda-sol
    b.caixa(0.1, 0.008, 0.06, 0.15, 0.04, 0.3, '#E0473C').caixa(0.1, 0.008, 0.06, 0.15, 0.048, 0.3, T.bianco);
    b.cilindro(0.004, 0.2, -0.2, 0, 0.3, T.bianco, 4).cone(0.1, 0.05, -0.2, 0.18, 0.3, '#3FA7F5', 8);
    b.caixa(0.04, 0.03, 0.03, -0.05, 0, 0.36, '#F2C230');   // balde
    return { geo: b.geometria(), h: 0.4 };
  },

  // shepherd's hut: carroça com teto curvo de zinco, rodas de ferro e ovelhas
  pastore() {
    const b = new Construtor();
    grama(b, 0.96, 0.96, '#92C96C');
    b.caixa(0.44, 0.18, 0.2, 0, 0.09, -0.06, '#2E5E3A');
    arco(b, 0.11, 0.48, 0, 0.27, -0.06, '#8F918D');
    for (const x of [-0.16, 0.16]) for (const z of [-0.17, 0.05]) { const g = new THREE.TorusGeometry(0.045, 0.01, 5, 12); g.translate(0, 0.045, 0); b.add(g, '#22252B', x, 0, z); }
    b.caixa(0.07, 0.13, 0.012, 0.12, 0.1, 0.045, '#C8102E').caixa(0.08, 0.06, 0.012, -0.08, 0.15, 0.045, '#FFE29A');
    for (let k = 0; k < 3; k++) b.caixa(0.07, 0.012, 0.04, 0.12, k * 0.03, 0.08 + (2 - k) * 0.03, '#9C7148');
    b.cilindro(0.01, 0.1, -0.14, 0.34, -0.06, T.scuro, 6);
    for (const [x, z, r] of [[-0.3, 0.28, 1], [-0.12, 0.36, 0.85], [0.3, 0.3, 0.9]]) {
      b.esfera(0.05 * r, x, 0.07 * r, z, '#F4F1EA').esfera(0.035 * r, x + 0.03 * r, 0.075 * r, z + 0.03 * r, '#F4F1EA').esfera(0.022 * r, x + 0.05 * r, 0.09 * r, z + 0.05 * r, '#22252B');
      for (const dx of [-0.02, 0.02]) b.caixa(0.008, 0.04 * r, 0.008, x + dx * r, 0, z, '#22252B');
    }
    for (let k = -4; k <= 4; k++) b.caixa(0.012, 0.07, 0.012, k * 0.11, 0, -0.42, '#9C7148');
    b.caixa(0.92, 0.012, 0.012, 0, 0.05, -0.42, '#9C7148');
    return { geo: b.geometria(), h: 0.48 };
  },

  // casa dentro da colina: morro de grama, porta redonda, janelas redondas e chaminé
  collina() {
    const b = new Construtor();
    grama(b, 0.96, 0.96, '#8FC064');
    const g = new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.6, 1); b.add(g, '#6FAE52', 0, 0, -0.06);
    b.esfera(0.12, -0.25, 0.08, -0.2, '#5E9E4A').esfera(0.1, 0.27, 0.07, -0.25, '#5E9E4A');
    disco(b, 0.1, 0, 0.1, 0.335, '#8E7E62', 16); disco(b, 0.085, 0, 0.1, 0.342, '#2E7D45', 16); b.esfera(0.01, 0, 0.1, 0.35, T.oro);
    for (const x of [-0.2, 0.2]) { disco(b, 0.05, x, 0.1, 0.285, T.bianco); disco(b, 0.038, x, 0.1, 0.292, '#FFE29A'); }
    b.caixa(0.06, 0.12, 0.06, 0.15, 0.2, -0.15, T.pietra).cilindro(0.012, 0.03, 0.15, 0.32, -0.15, T.vaso, 6);
    b.quad(0.12, 0.2, 0, 0.003, 0.4, '#C9C2B2');
    aiuola(b, -0.25, 0.36); aiuola(b, 0.25, 0.36);
    for (let k = -4; k <= 4; k++) if (Math.abs(k) > 0) b.caixa(0.012, 0.05, 0.012, k * 0.1, 0, 0.47, T.bianco);
    return { geo: b.geometria(), h: 0.4 };
  },

  // mansão assombrada: pedra escura, torre pontuda, janelas verdes acesas, árvore seca e lápides
  stregata() {
    const b = new Construtor(), M = '#4A4458', R = '#22252B';
    grama(b, 0.96, 0.96, '#6E7F55');
    b.caixa(0.5, 0.52, 0.36, -0.04, 0, -0.1, M).telhado(0.56, 0.4, 0.26, -0.04, 0.52, -0.1, R);
    b.caixa(0.18, 0.84, 0.18, 0.28, 0, -0.06, M).piramide(0.22, 0.22, 0.4, 0.28, 0.84, -0.06, R).cilindro(0.005, 0.08, 0.28, 1.24, -0.06, T.scuro, 4);
    for (const [x, y] of [[-0.18, 0.12], [0.1, 0.12], [-0.18, 0.34], [0.1, 0.34], [0.28, 0.5], [0.28, 0.68]]) b.caixa(0.06, 0.09, 0.012, x, y, x > 0.2 ? 0.035 : 0.085, '#9BE36A');
    b.caixa(0.09, 0.17, 0.012, -0.04, 0, 0.085, '#3A2410');
    // árvore seca
    b.cilindro(0.02, 0.36, -0.36, 0, 0.26, '#3A2A1E', 5);
    for (const [a, y] of [[0.7, 0.24], [-0.8, 0.3], [0.2, 0.34]]) { const g = new THREE.CylinderGeometry(0.006, 0.01, 0.16, 4); g.rotateZ(a); g.translate(-Math.sin(a) * 0.07, 0.07, 0); b.add(g, '#3A2A1E', -0.36, y, 0.26); }
    for (const [x, z] of [[0.05, 0.3], [0.2, 0.36], [0.35, 0.28]]) b.caixa(0.05, 0.07, 0.02, x, 0, z, '#8F918D').cupola(0.025, x, 0.07, z, '#8F918D');
    for (let k = -4; k <= 4; k++) b.caixa(0.008, 0.08, 0.008, k * 0.11, 0, 0.45, R).cone(0.008, 0.02, k * 0.11, 0.08, 0.45, R, 4);
    b.caixa(0.92, 0.008, 0.008, 0, 0.06, 0.45, R);
    // morcegos voando em volta da torre
    const mor = new THREE.Group();
    for (let k = 0; k < 4; k++) mor.add(pezzo(p => { p.caixa(0.06, 0.008, 0.02, 0, 0, 0, '#16131C').esfera(0.012, 0, 0.002, 0, '#16131C'); }));
    mor.position.set(0.28, 0.95, -0.06);
    return {
      geo: b.geometria(), h: 1.3, extra: mor,
      anima: t => mor.children.forEach((m, k) => { const a = t * 0.0012 + k * 1.57; m.position.set(Math.cos(a) * (0.25 + k * 0.03), Math.sin(t * 0.004 + k) * 0.05 + k * 0.04, Math.sin(a) * (0.25 + k * 0.03)); m.rotation.y = -a; m.scale.x = 0.7 + 0.3 * Math.abs(Math.sin(t * 0.02 + k)); }),
    };
  },

  // observatório: casinha com cúpula prateada que gira, com o telescópio para fora
  osservatorio() {
    const b = new Construtor();
    grama(b);
    b.caixa(0.36, 0.22, 0.26, 0.2, 0, 0.12, T.stucco).telhado(0.38, 0.28, 0.1, 0.2, 0.22, 0.12, '#4E5866');
    b.caixa(0.07, 0.14, 0.012, 0.28, 0, 0.255, '#1F3A6B').caixa(0.07, 0.07, 0.012, 0.12, 0.09, 0.255, '#FFE29A');
    b.cilindro(0.22, 0.34, -0.14, 0, -0.12, '#ECEAE2', 16);
    b.caixa(0.08, 0.15, 0.012, -0.14, 0, 0.1, '#1F3A6B');
    aiuola(b, 0.0, 0.38);
    const cup = new THREE.Group();
    cup.position.set(-0.14, 0.34, -0.12);
    cup.add(pezzo(p => {
      p.cupola(0.22, 0, 0, 0, '#C9CED6').caixa(0.07, 0.22, 0.24, 0, 0, 0.0, '#3A4A5A');
      const g = new THREE.CylinderGeometry(0.03, 0.04, 0.32, 10); g.rotateX(-0.9); g.translate(0, 0.12, 0.12); p.add(g, '#F2C230', 0, 0, 0);
    }));
    return { geo: b.geometria(), h: 0.65, extra: cup, anima: t => { cup.rotation.y = Math.sin(t * 0.0004) * 1.2; } };
  },

  // casa de biscoito de gengibre: cobertura branca, doces e bengalinhas
  zenzero() {
    const b = new Construtor(), G = '#B5763A', I = '#FFFFFF';
    grama(b, 0.96, 0.96, '#A8D98A');
    b.caixa(0.5, 0.34, 0.38, 0, 0, -0.06, G);
    b.telhado(0.58, 0.44, 0.24, 0, 0.34, -0.06, '#F7C1D9').telhado(0.6, 0.06, 0.02, 0, 0.56, -0.06, I);
    for (const z of [-0.27, 0.15]) b.caixa(0.6, 0.025, 0.03, 0, 0.33, z, I);
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) b.esfera(0.024, -0.22 + k * 0.088, 0.44, -0.06 + s * 0.14, ['#E0473C', '#2E9B55', '#F2C230', '#3FA7F5', '#9B5DE5', '#FF7EB6'][k]);
    b.caixa(0.1, 0.18, 0.012, 0, 0, 0.135, '#5A3416').cupola(0.05, 0, 0.18, 0.137, '#5A3416');
    for (const x of [-0.16, 0.16]) b.caixa(0.08, 0.08, 0.012, x, 0.16, 0.135, '#FFE29A').caixa(0.09, 0.014, 0.016, x, 0.16, 0.137, I).caixa(0.09, 0.014, 0.016, x, 0.24, 0.137, I);
    b.cilindro(0.025, 0.24, 0.17, 0.5, -0.12, G, 6).cilindro(0.03, 0.02, 0.17, 0.74, -0.12, I, 6);
    // bengalinhas listradas e pirulitos no jardim
    for (const x of [-0.32, 0.32]) for (let k = 0; k < 5; k++) b.cilindro(0.012, 0.03, x, k * 0.03, 0.3, k % 2 ? I : '#E0473C', 6);
    for (const [x, c] of [[-0.15, '#FF7EB6'], [0.15, '#3FA7F5']]) { b.cilindro(0.004, 0.12, x, 0, 0.38, I, 4); disco(b, 0.035, x, 0.14, 0.38, c); }
    return { geo: b.geometria(), h: 0.8 };
  },

  // cabine telefônica gigante (a vermelha clássica), com porta e jardim
  cabina() {
    const b = new Construtor();
    grama(b);
    cabina(b, 0, -0.05, 3.3);
    b.caixa(0.1, 0.24, 0.012, 0, 0, 0.155, '#9A0E22');
    b.quad(0.12, 0.26, 0, 0.003, 0.33, '#C9C2B2');
    aiuola(b, -0.28, 0.32); aiuola(b, 0.28, 0.32);
    b.esfera(0.07, -0.34, 0.07, -0.3, '#3F7F3A').esfera(0.06, 0.35, 0.06, -0.3, '#4E9A43');
    return { geo: b.geometria(), h: 1.3 };
  },

  // chalé-bule: bule branco com faixa azul (estilo willow), bico, alça, tampa, porta e janelas
  teiera() {
    const b = new Construtor(), W = '#F4F1EA', B = '#2F5DA8';
    grama(b);
    const corpo = new THREE.SphereGeometry(0.3, 18, 12); corpo.scale(1, 0.85, 1); b.add(corpo, W, 0, 0.255, -0.05);
    const faixa = new THREE.CylinderGeometry(0.303, 0.303, 0.06, 18, 1, true); b.add(faixa, B, 0, 0.3, -0.05);
    b.cilindro(0.2, 0.05, 0, 0.0, -0.05, B, 16);
    const bico = new THREE.CylinderGeometry(0.03, 0.06, 0.32, 8); bico.rotateZ(-0.9); bico.translate(0.36, 0.36, 0); b.add(bico, W, 0, 0, -0.05);
    const alca = new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.2); alca.rotateZ(0.4 * Math.PI); b.add(alca, W, -0.3, 0.3, -0.05);
    b.cupola(0.12, 0, 0.5, -0.05, B).esfera(0.04, 0, 0.62, -0.05, W);
    b.caixa(0.1, 0.17, 0.02, 0, 0.04, 0.245, '#C8102E').esfera(0.012, 0.03, 0.12, 0.26, T.oro);
    for (const x of [-0.16, 0.16]) disco(b, 0.045, x, 0.34, 0.215, '#FFE29A');
    // mesinha com xícaras
    b.cilindro(0.06, 0.008, 0.3, 0.07, 0.32, T.bianco, 12).cilindro(0.008, 0.07, 0.3, 0, 0.32, T.scuro, 4);
    for (const dx of [-0.025, 0.025]) b.cilindro(0.012, 0.016, 0.3 + dx, 0.078, 0.32, B, 8);
    aiuola(b, -0.3, 0.32);
    return { geo: b.geometria(), h: 0.75 };
  },

  // foguete na plataforma, com janelas redondas e chama que tremula
  razzo() {
    const b = new Construtor();
    grama(b);
    b.cilindro(0.3, 0.04, 0, 0, -0.04, '#9AA3AE', 16);
    for (const x of [-0.24, 0.24]) b.caixa(0.03, 0.6, 0.03, x, 0.04, -0.04, '#C8102E');
    b.caixa(0.5, 0.025, 0.025, 0, 0.5, -0.04, '#C8102E');
    b.cilindro(0.13, 0.75, 0, 0.12, -0.04, T.bianco, 14).cone(0.13, 0.32, 0, 0.87, -0.04, '#C8102E', 14);
    b.cilindro(0.09, 0.08, 0, 0.04, -0.04, T.scuro, 10);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2, g = new THREE.BoxGeometry(0.02, 0.22, 0.12); g.translate(0, 0.11, 0.17); g.rotateY(a); b.add(g, '#C8102E', 0, 0.1, -0.04);
    }
    for (const y of [0.55, 0.72]) { disco(b, 0.045, 0, y, 0.09, '#C9CED6'); disco(b, 0.034, 0, y, 0.096, '#3FA7F5'); }
    b.caixa(0.07, 0.13, 0.012, 0, 0.17, 0.088, '#1F3A6B');
    for (let k = 0; k < 4; k++) b.caixa(0.08, 0.012, 0.04, 0, k * 0.04, 0.16 + (3 - k) * 0.04, '#9AA3AE');
    const chama = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10).rotateX(Math.PI).translate(0, -0.08, 0), luce('#FF9F43', 0.85));
    chama.position.set(0, 0.06, -0.04);
    return { geo: b.geometria(), h: 1.25, extra: chama, anima: t => { chama.scale.set(1, 0.6 + 0.4 * Math.abs(Math.sin(t * 0.02)), 1); } };
  },
};

const cache = new Map();
const base = id => { if (!cache.has(id)) cache.set(id, COSTRUTTORI[id]()); return cache.get(id); };
export const altezzaSpeciale = id => (COSTRUTTORI[id] ? base(id).h : 1);
// geometria (fica em cache) + peças animadas novas a cada chamada (cada casa tem as suas)
export function costruisciSpeciale(id) {
  const f = COSTRUTTORI[id];
  if (!f) return null;
  const b0 = base(id);
  if (!b0.extra) return { geo: b0.geo, h: b0.h, extra: null, anima: null };
  const nuovo = f();   // peças animadas não podem ser compartilhadas entre casas
  nuovo.geo.dispose();
  return { geo: b0.geo, h: b0.h, extra: nuovo.extra, anima: nuovo.anima };
}
