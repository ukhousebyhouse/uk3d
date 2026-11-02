// Vitrine das casas novas (teste visual e base do Reel 5): ?modo=rare (as 15 casas raras), ?modo=case (variedade de
// portas, telhados, floreiras e jardins), ?solo=<id> (uma casa rara grande); ?notte=1 de noite; ?t=<ms> tempo das animações.
import * as THREE from 'three';
import { geometriaCasa, geometriaFioriere, geometriaOrnamento, aspetto } from '../js/modelli.js';
import { SPECIALI, costruisciSpeciale } from '../js/speciali.js';

const q = new URLSearchParams(location.search), modo = q.get('modo') ?? 'rare', solo = q.get('solo'), notte = q.has('notte');
const r = new THREE.WebGLRenderer({ canvas: document.querySelector('#c'), antialias: true, preserveDrawingBuffer: true });
r.setSize(1080, 1920, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(notte ? '#1E3560' : '#86AFC4');
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c7a8, notte ? 0.8 : 2.3));
const sol = new THREE.DirectionalLight(notte ? 0x9fb4ff : 0xfff1dc, notte ? 0.7 : 2.4);
sol.position.set(-0.55, 1, 0.4); scene.add(sol);
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 200);
const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
const anim = [], etichette = [];

function lotto(x, z, w = 1.1, d = 1.1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: '#B6DC8F' }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); scene.add(m);
}
function rara(id, x, z) {
  const sp = costruisciSpeciale(id), g = new THREE.Group();
  g.add(new THREE.Mesh(sp.geo, mat));
  if (sp.extra) g.add(sp.extra);
  if (sp.anima) anim.push(t => sp.anima(t, notte));
  g.position.set(x, 0.001, z); scene.add(g);
  return sp.h;
}
function casa(conta, liv, stile, x, z) {
  const a = aspetto(conta, liv), g = new THREE.Group();
  g.add(new THREE.Mesh(geometriaCasa(liv, a.v, stile), mat));
  if (a.fiori) { const f = geometriaFioriere(liv, stile); if (f) g.add(new THREE.Mesh(f, mat)); }
  for (const o of a.orn) { const m = new THREE.Mesh(geometriaOrnamento(o.id), mat); m.position.set(o.x, 0, o.z); m.rotation.y = o.rot; g.add(m); }
  g.position.set(x, 0.001, z); scene.add(g);
}

if (solo) {
  lotto(0, 0, 1.4, 1.4);
  const h = rara(solo, 0, 0), az = +(q.get('az') ?? 0.5);
  cam.position.set(Math.sin(az) * (1.6 + h), 0.5 + h * 0.8, Math.cos(az) * (1.6 + h)); cam.lookAt(0, h * 0.4, 0);
} else if (modo === 'rare') {
  SPECIALI.forEach((m, i) => {
    const x = (i % 3 - 1) * 1.25, z = (Math.floor(i / 3) - 2) * 1.5;
    lotto(x, z); rara(m.id, x, z);
    etichette.push([m.em + ' ' + m.nome, new THREE.Vector3(x, -0.05, z + 0.62)]);
  });
  cam.fov = 22; cam.updateProjectionMatrix();
  cam.position.set(0, 11, 13.5); cam.lookAt(0, 0, 0.1);
} else {
  const stili = (q.get('stili') ?? 'eng,eng,wls,sct,thatch,nir').split(','), livs = (q.get('livelli') ?? '0,1,3,5').split(',').map(Number);
  stili.forEach((s, j) => livs.forEach((liv, i) => {
    const x = (i - (livs.length - 1) / 2) * 1.1, z = (j - (stili.length - 1) / 2) * 1.15;
    lotto(x, z, 1.05, 1.05); casa(`player.${s}.${i}.${j}`, liv, s, x, z);
  }));
  cam.fov = 24; cam.updateProjectionMatrix();
  cam.position.set(0, 10, 12.5); cam.lookAt(0, 0, 0.1);
}

const t = +(q.get('t') ?? 1500);
anim.forEach(f => f(t));
r.render(scene, cam);
const box = document.querySelector('#nomi');
for (const [txt, p] of etichette) {
  const v = p.clone().project(cam), d = document.createElement('div');
  d.className = 'nome'; d.textContent = txt;
  d.style.left = `${(v.x + 1) / 2 * 1080}px`; d.style.top = `${(1 - v.y) / 2 * 1920}px`;
  box.appendChild(d);
}
window.pronto = true;
