// Reel 2 "The rules" com dados reais: cidades fundadas (fundador de cada uma), as 4 regras para ganhar uma casa,
// as 4 nações acendendo no mapa, Ireland e Isle of Man de fora, a casa crescendo e Northern Ireland ainda vazia.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL, geometriaCasa, geometriaEspecial } from '../js/modelli.js';
import { REGOLE } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const ora = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
// soma de pulsos que decaem: impactos (tremor + punch zoom) e flashes
const pulso = (t, lista, dec) => lista.reduce((s, [ti, f]) => s + (t >= ti ? f * Math.exp(-(t - ti) / dec) : 0), 0);
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

// lat/lon -> mundo (mesma projeção do geo.json)
const mundo = (lat, lon) => { const P = D.geo.proj; return { x: (lon - P.LON0) * P.KM * Math.cos(lat * Math.PI / 180), z: (P.LAT0 - lat) * P.KZ }; };

// ---------- 3D ----------
// todas as cidades do mapa como pontinhos, por nação: acendem na cor da nação quando ela é falada
function criarNazioni() {
  const cods = ['ENG', 'SCT', 'WLS', 'NIR'], n = D.comuni.length;
  const pos = new Float32Array(n * 3), naz = new Float32Array(n);
  D.comuni.forEach((c, i) => { pos.set([c.x, mappa.altura(c.x, c.z) + 0.04, c.z], i * 3); naz[i] = Math.max(0, cods.indexOf(c.reg)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { base: { value: 0 }, luce: { value: [0, 0, 0, 0] }, cor: { value: cods.map(k => new THREE.Color(NAZIONI[k].cor)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float naz; uniform float base; uniform float luce[4]; uniform vec3 cor[4]; uniform float escala;
      varying vec3 vCor; varying float vA;
      void main() {
        int k = int(naz + 0.5);
        float l = luce[k];
        vCor = mix(vec3(1.0), cor[k], clamp(l * 1.4, 0.0, 1.0));
        vA = max(base * 0.6, l);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(2.2 * escala / -mv.z, 3.0, 9.0) * (1.0 + 0.5 * l);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0 || vA < 0.01) discard;
        gl_FragColor = vec4(vCor, vA * (1.0 - smoothstep(0.7, 1.0, d)));
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}

// placa azul FOUNDER num mastro ao lado da casa do fundador, que sobe e ondula
function texturaPlacca() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 200;
  const x = cv.getContext('2d');
  x.fillStyle = '#1E5AA8'; x.fillRect(0, 0, 512, 200);
  x.strokeStyle = '#FFFFFF'; x.lineWidth = 12; x.strokeRect(10, 10, 492, 180);
  x.fillStyle = '#FFFFFF'; x.font = '900 86px Nunito'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('FOUNDER', 256, 106, 460);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function criarPlacca(casa) {
  const g = new THREE.Group(), H = LOTE * 1.7, W = LOTE * 1.0, A = W * 0.39;
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(LOTE * 0.025, LOTE * 0.03, H, 8), new THREE.MeshLambertMaterial({ color: '#5A3A22' }));
  asta.position.y = H / 2;
  const palla = new THREE.Mesh(new THREE.SphereGeometry(LOTE * 0.06, 12, 8), new THREE.MeshLambertMaterial({ color: '#E8B33A' }));
  palla.position.y = H + LOTE * 0.04;
  const geo = new THREE.PlaneGeometry(W, A, 24, 4);
  geo.translate(W / 2, 0, 0);
  const pano = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texturaPlacca(), side: THREE.DoubleSide }));
  pano.userData.base = Float32Array.from(geo.attributes.position.array);
  g.add(asta, palla, pano);
  g.userData = { pano, H, A, W };
  g.position.set(casa.x + LOTE * 0.5, casa.y, casa.z + LOTE * 0.5);
  g.visible = false;
  mappa.scene.add(g);
  return g;
}
function animarPlacca(b, t, ini, fim) {
  b.visible = t >= ini && t < fim;
  if (!b.visible) return;
  const s = ressalto(fase(t, ini, 0.4)), { pano, H, A, W } = b.userData;
  b.scale.set(1, Math.max(0.001, s), 1);
  pano.position.y = H - A / 2 - (1 - suave(fase(t, ini + 0.15, 0.5))) * (H - A);
  const p = pano.geometry.attributes.position, base = pano.userData.base;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], k = x / W;
    p.setZ(i, Math.sin(x / W * 7 - t * 9) * LOTE * 0.09 * k);
    p.setY(i, base[i * 3 + 1] - k * k * LOTE * 0.05 * (1 + Math.sin(t * 5) * 0.3));
  }
  p.needsUpdate = true;
  pano.geometry.computeVertexNormals();
  b.rotation.y = mappa.az + 0.35;
}

// cena da casa que cresce: clareira com árvores no campo (Vale of York), longe de qualquer cidade do jogo
function criarDiorama() {
  const C = mundo(54.0, -1.3), g = new THREE.Group();
  let chao = -Infinity;
  for (let a = -0.4; a <= 0.4; a += 0.1) for (let b = -0.4; b <= 0.4; b += 0.1) chao = Math.max(chao, mappa.altura(C.x + a, C.z + b));
  chao += 0.002;
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1.2, 80), new THREE.MeshLambertMaterial({ color: '#8FC064' }));
  disco.rotation.x = -Math.PI / 2;
  disco.position.set(C.x, chao, C.z);
  g.add(disco);
  const lote = new THREE.Mesh(new THREE.PlaneGeometry(LOTE * 1.6, LOTE * 1.6), new THREE.MeshLambertMaterial({ color: '#C9C2B2' }));
  lote.rotation.x = -Math.PI / 2;
  lote.position.set(C.x, chao + 0.0004, C.z);
  g.add(lote);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  for (const [tipo, n] of [['quercia', 260], ['betulla', 120], ['abete', 70]]) {
    const im = new THREE.InstancedMesh(geometriaEspecial(tipo), new THREE.MeshLambertMaterial({ vertexColors: true }), n);
    for (let i = 0; i < n; i++) {
      const r = 0.075 + Math.pow(rnd(), 0.8) * 1.0, a = rnd() * Math.PI * 2, e = LOTE * (0.9 + rnd() * 0.7);
      m4.compose(v.set(C.x + Math.cos(a) * r, chao, C.z + Math.sin(a) * r), q.setFromAxisAngle(y, rnd() * 6.28), s.set(e, e, e));
      im.setMatrixAt(i, m4);
    }
    im.frustumCulled = false;
    g.add(im);
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const casas = R.crescita.map(([, nivel]) => {
    const m = new THREE.Mesh(geometriaCasa(nivel, 1, 'eng'), mat);
    m.position.set(C.x, chao + 0.0008, C.z);
    m.rotation.y = 0.55;
    m.scale.setScalar(LOTE);
    m.visible = false;
    g.add(m);
    return m;
  });
  g.visible = false;
  mappa.scene.add(g);
  return { g, casas, x: C.x, z: C.z, y: chao };
}

// ---------- câmera: chaves (t, { x, z, dist, az, el?, giu?, cut? }) ----------
function montarChaves() {
  const v = D.geo.vista, dP = mappa.distPais();
  const UK = { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: dP, az: 0, el: null, giu: 0 };
  const C = cena, casaK = (c, o) => ({ x: c.x, z: c.z, giu: 0.1, el: null, ...o });
  const nir = D.geo.regioni.find(r => r.cod === 'NIR');
  const lista = [
    [0, { ...UK, dist: dP * 2.6, az: -0.55, el: 88 }],
    [0.9, { ...UK, dist: dP * 1.03 }],
    [E.leeds, { ...UK, dist: dP * 0.95 }],
    [E.leeds + 1.25, casaK(C.leeds.casa, { dist: 0.55, az: 0.5 })],
    [E.then, { dist: 0.48, az: 0.78 }],
    [E.c1 - 0.06, { dist: 1.6, az: 0.95 }],
  ];
  C.citta.forEach((c, i) => {
    const fim = i < 5 ? E[`c${i + 2}`] : E.domande, az = 0.25 + (i % 2 ? 0.55 : 0);
    lista.push([E[`c${i + 1}`], casaK(c.casa, { dist: 0.66, az, cut: true })]);
    lista.push([fim - 0.02, { dist: 0.5, az: az + (i % 2 ? -0.2 : 0.2) }]);
  });
  lista.push(
    [E.domande + 1.05, { ...UK, dist: dP * 1.04 }],
    [E.r1, { ...UK, dist: dP * 0.98 }],
    [E.r1 + 1.3, { x: C.leeds.casa.x, z: C.leeds.casa.z, dist: 520, az: 0.08, el: null, giu: -0.12 }],
    [E.scrivi_a, { dist: 400, az: 0.14 }],
    [E.r2 - 0.05, { dist: 360, az: 0.18 }],
    [E.r2 + 1.1, { ...UK, dist: dP * 1.0 }],
    [E.n_nir + 0.7, { ...UK, dist: dP * 0.95, az: 0.02 }],
    [E.irl + 0.8, { x: -150, z: 128, dist: dP * 0.6, az: -0.1, el: null, giu: 0 }],
    [E.r3 - 0.02, { dist: dP * 0.54, az: -0.16 }],
    [E.r3, { x: C.londra.x, z: C.londra.z, dist: 0.72, az: 0.3, el: null, giu: 0.04, cut: true }],
    [E.r4 - 0.02, { dist: 0.6, az: 0.5 }],
    [E.r4, casaK(C.fond.casa, { dist: 0.72, az: 0.15, cut: true })],
    [E.fond, { dist: 0.5, az: 0.42 }],
    [E.ora, { dist: 0.44, az: 0.72 }],
    [E.ora + 1.0, { dist: 1.3, az: 0.95, giu: 0 }],
    [E.cresce - 0.02, { dist: 1.6, az: 1.1 }],
    [E.cresce, { x: C.diorama.x, z: C.diorama.z, dist: 0.4, az: 0.35, el: 30, giu: 0.16, cut: true }],
    [E.grow + 0.1, { dist: 0.46, az: 0.9, el: 33 }],
    [E.ni - 0.02, { dist: 0.5, az: 1.0, el: 34 }],
    [E.ni + 1.25, { x: (nir.lx + cena.belfast.x) / 2 + 6, z: nir.lz + 8, dist: 250, az: 0, el: null, giu: 0 }],
    [E.primo_ni, { dist: 215 }],
    [E.banner, { dist: 205 }],
    [E.banner + 1.0, { ...UK, dist: dP * 1.02 }],
    [R.durata, { ...UK, dist: dP * 0.96 }],
  );
  let ant = {};
  chaves = lista.map(([t, k]) => { const { cut, ...resto } = k; ant = { ...ant, ...resto }; return { t, k: { ...ant }, cut: !!cut }; });
}
const elDe = k => (k.el ?? mappa.elevacao(k.dist) * 180 / Math.PI);
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  // corte seco: segura a chave atual até a hora do corte
  const s0 = b.t > a.t && !b.cut ? clamp((t - a.t) / (b.t - a.t)) : (t >= b.t ? 1 : 0);
  const s = suave(s0), A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  // voo longo: mergulhando, o alvo chega antes do zoom; subindo, o zoom abre antes de o alvo andar
  const sxz = dxz > 20 ? (B.dist < A.dist ? suave(clamp(s0 / 0.55)) : suave(clamp((s0 - 0.4) / 0.6))) : s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az;
  mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  // elevação própria (vista do alto na abertura, rasante na casa que cresce) e tremor nos impactos
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
// entra com ressalto em ini e sai encolhendo em fim
function pop(el, t, ini, fim = Infinity, { sai = 0.2, base = 'translate(0,0)' } = {}) {
  const vis = t >= ini && t < fim;
  el.style.opacity = vis ? '1' : '0';
  if (!vis) return 0;
  const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - sai, sai)));
  el.style.transform = `${base} scale(${Math.max(0.001, s)})`;
  return s;
}
// rótulo preso a um ponto 3D (a ponta embaixo, no ponto)
function presa(el, t, p, ini, fim, extra = 1) {
  const vis = t >= ini && t < fim && p.ok;
  el.style.opacity = vis ? '1' : '0';
  if (!vis) return;
  const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - 0.18, 0.18))) * extra;
  const w = el.offsetWidth, x = clamp(p.x - w / 2, 24, 1056 - w);   // nunca sai pela borda da tela
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

function cartao(casa, titulo, sub, oro, badge) {
  const el = document.createElement('div');
  el.className = 'etichetta';
  el.innerHTML = `<div class="card${oro ? ' oro' : ''}"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}${badge ? `<div class="badge">${esc(badge)}</div>` : ''}</div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
const topoCasa = (c, alto = 0.004) => projetar(c.x, c.y + ALTURA_NIVEL[c.livello] * LOTE + alto, c.z);

function quadro(t) {
  const dist = camera(t), C = cena;
  const vista = dist > 40;
  citta.grupo.visible = dist < 32 && !(t >= E.cresce && t < E.ni + 0.5);
  C.diorama.g.visible = t >= E.cresce - 0.01 && t < E.ni + 0.6;

  // cabeçalho: DAY 1 e o contador que sobe na abertura
  const n = Math.round(C.totCase * suave(fase(t, 0.35, 2.7))), m = Math.round(C.totCitta * suave(fase(t, 0.35, 2.7)));
  $('#contatore').innerHTML = `<span class="g">${n}</span> HOUSES · <span class="g">${m}</span> TOWNS`;
  pop($('#testa'), t, 0.15, E.domande + 0.9);

  // cidades fundadas: bolinha amarela que pipoca na ordem de fundação (só na vista do país)
  const mostraPontos = vista && (t < E.r2 || t >= E.banner);
  for (const p of C.pontos) {
    if (!mostraPontos || t < p.ini) { p.el.style.transform = 'scale(0)'; continue; }
    const q = projetar(p.x, p.y, p.z);
    p.el.style.left = `${q.x}px`; p.el.style.top = `${q.y}px`;
    p.el.style.transform = `scale(${ressalto(fase(t, p.ini, 0.3)) * (t >= E.banner ? ressalto(fase(t, E.banner + 0.6 + p.k * 0.03, 0.3)) : 1)})`;
  }

  // Leeds, a 1ª cidade; depois os cortes rápidos cidade a cidade
  const lc = C.leeds;
  presa(lc.el, t, topoCasa(lc.casa), E.leeds + 1.0, E.c1 - 0.05);
  lc.el.querySelector('.badge').style.transform = `rotate(${8 - 14 * (1 - ressalto(fase(t, E.primo, 0.3)))}deg) scale(${t >= E.primo ? ressalto(fase(t, E.primo, 0.3)) : 0})`;
  C.citta.forEach((c, i) => presa(c.el, t, topoCasa(c.casa), E[`c${i + 1}`] + 0.04, i < 5 ? E[`c${i + 2}`] : E.domande + 0.35));

  // perguntas dos comentários subindo; depois o carimbo THE RULES com o fundo escurecido
  C.bolle.forEach((b, k) => {
    const ini = E.domande + 0.25 + k * 0.42, s = pop(b.el, t, ini, E.regole, { base: `translate(${b.x}px, ${b.y - 40 * fase(t, ini, 3)}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateX(${Math.sin(t * 2.2 + k) * 6}px)`;
  });
  $('#scuro').style.opacity = String(0.38 * fase(t, E.regole - 0.1, 0.2) * (1 - fase(t, E.r1 - 0.15, 0.2)));
  pop($('#titolo'), t, E.regole, E.r1 - 0.02, { base: `rotate(${-4 + 4 * suave(fase(t, E.regole, 0.4))}deg)` });

  // regra numerada no topo
  const regras = [[E.r1, E.r2], [E.r2, E.r3], [E.r3, E.r4], [E.r4, E.ora]];
  const kr = regras.findIndex(([a, b]) => t >= a && t < b);
  if (kr >= 0) {
    const g = $('#regola');
    if (g.dataset.k !== String(kr)) { g.dataset.k = String(kr); g.querySelector('.num').textContent = String(kr + 1); g.querySelector('.tit').textContent = R.regole[kr]; }
    pop(g, t, regras[kr][0], regras[kr][1], { sai: 0.15 });
  } else $('#regola').style.opacity = '0';

  // regra 1: comentário digitando "Leeds, England" e o ✓
  const cm = R.commento, cel = $('#commento'), ci = E.r1 + 1.0, cf = E.r2 - 0.1;
  if (pop(cel, t, ci, cf)) {
    const nch = Math.round(clamp((t - E.scrivi_da) / (E.scrivi_a - E.scrivi_da)) * cm.testo.length);
    const cursor = (t * 2.4) % 1 < 0.55 || (nch > 0 && nch < cm.testo.length) ? '<span class="cursore"></span>' : '';
    cel.querySelector('.testo').innerHTML = esc(cm.testo.slice(0, nch)) + cursor;
    cel.querySelector('.ok').style.transform = `scale(${t >= E.scrivi_a + 0.08 ? ressalto(fase(t, E.scrivi_a + 0.08, 0.3)) : 0})`;
  }

  // regra 2: as cidades do Reino Unido acendem; cada nação na sua cor, com o nome
  const U = C.nazioni.material.uniforms, fimNaz = E.r3;
  U.base.value = fase(t, E.uk - 0.1, 0.5) * (1 - fase(t, fimNaz - 0.1, 0.1));
  C.naz.forEach((nz, k) => {
    const s = fase(t, nz.t, 0.35) * (1 - fase(t, fimNaz - 0.1, 0.1));
    U.luce.value[k] = s * (1 + 0.25 * Math.exp(-(t - nz.t) / 0.25) * (t >= nz.t));
    presa(nz.el, t, projetar(nz.x, 0.5, nz.z), nz.t, E.irl + 0.2);
  });
  // Northern Ireland vazia: as cidades de lá pulsam, esperando o primeiro
  if (t >= E.ni + 0.8 && t < E.banner + 0.6) U.luce.value[3] = (0.55 + 0.3 * Math.sin((t - E.ni) * 6)) * fase(t, E.ni + 0.8, 0.4) * (1 - fase(t, E.banner + 0.2, 0.4));
  C.nazioni.visible = (t >= E.uk - 0.2 && t < fimNaz) || (t >= E.ni + 0.8 && t < E.banner + 0.6);
  // Ireland e Isle of Man: de fora (✖)
  C.fuori.forEach(f => presa(f.el, t, projetar(f.x, 0.3, f.z), f.t, E.r3));
  pop($('#nocount'), t, E.nocount, E.r3, { base: `rotate(-7deg)` });

  // regra 3: cada casa da cidade com o seu @
  C.londra.etich.forEach((e, k) => presa(e.el, t, topoCasa(e.casa, 0.004 + (k % 3) * LOTE * 1.15), E.r3 + 0.45 + k * 0.28, E.r4, 1 + 0.12 * Math.exp(-Math.max(0, t - E.at) / 0.2) * (t >= E.at)));

  // regra 4: o fundador e a placa azul, para sempre
  presa(C.fond.el, t, topoCasa(C.fond.casa, LOTE * 1.0), E.fond, E.ora + 0.7);
  animarPlacca(C.fond.placca, t, E.placca, E.cresce);
  pop($('#sempre'), t, E.sempre, E.ora + 0.05, { base: `rotate(-6deg)` });

  // aparece em até 1 hora: relógio que gira; link na bio
  if (pop($('#ora'), t, E.ora + 0.1, E.cresce)) {
    const a = suave(fase(t, E.ora + 0.25, E.entro - E.ora - 0.25)) * Math.PI * 2 * 0.999, xe = 50 + 42 * Math.sin(a), ye = 50 - 42 * Math.cos(a);
    $('#spicchio').setAttribute('d', a > 0.01 ? `M50 50 L50 8 A42 42 0 ${a > Math.PI ? 1 : 0} 1 ${xe.toFixed(2)} ${ye.toFixed(2)} Z` : '');
    $('#lancetta').setAttribute('transform', `rotate(${a * 180 / Math.PI} 50 50)`);
    if (t >= E.entro) $('#ora').style.transform += ` scale(${1 + 0.1 * Math.exp(-(t - E.entro) / 0.15)})`;
  }
  pop($('#bio'), t, E.bio, E.cresce);

  // a casa cresce a cada post comentado
  const fasi = R.crescita.map(([dt], k) => (k === R.crescita.length - 1 ? E.grow : E.cresce + dt));
  let kc = -1;
  fasi.forEach((ti, k) => { if (t >= ti) kc = k; });
  C.diorama.casas.forEach((m, k) => {
    m.visible = k === kc;
    if (k === kc) { const s = ressalto(fase(t, fasi[k], 0.3)); m.scale.set(LOTE * (1 + 0.25 * (1 - s)), LOTE * Math.max(0.05, s), LOTE * (1 + 0.25 * (1 - s))); }
  });
  const lv = $('#livello');
  if (kc >= 0 && pop(lv, t, E.cresce + 0.1, E.ni)) {
    const nome = REGOLE.livelli[R.crescita[kc][1]].nome;
    if (lv.dataset.k !== String(kc)) { lv.dataset.k = String(kc); lv.querySelector('b').textContent = nome; }
    lv.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-(t - fasi[kc]) / 0.15)})`;
  } else lv.style.opacity = '0';
  C.piu.forEach((p, k) => {
    const ti = fasi[k + 1], vis = t >= ti && t < ti + 0.75;
    p.style.opacity = vis ? String(1 - fase(t, ti + 0.45, 0.3)) : '0';
    if (vis) p.style.transform = `translate(${p.dataset.x}px, ${1040 - 160 * suave(fase(t, ti, 0.75))}px) scale(${ressalto(fase(t, ti, 0.25))})`;
  });

  // Northern Ireland ainda vazia: "0 HOUSES" e um "?" pulando em Belfast
  pop($('#vuota'), t, E.vuoto, E.banner);
  const bq = projetar(C.belfast.x, mappa.altura(C.belfast.x, C.belfast.z) + 0.2, C.belfast.z), dm = $('#domanda');
  if (t >= E.primo_ni - 0.3 && t < E.banner + 0.4) {
    const s = ressalto(fase(t, E.primo_ni - 0.3, 0.35)) * (1 - fase(t, E.banner + 0.15, 0.25)), pulo = Math.abs(Math.sin((t - E.primo_ni) * 5.5)) * 26;
    dm.style.opacity = '1';
    dm.style.transform = `translate(${bq.x - dm.offsetWidth / 2}px, ${bq.y - dm.offsetHeight - pulo}px) scale(${s})`;
  } else dm.style.opacity = '0';

  pop($('#banner'), t, E.banner, Infinity);
  legenda(t);
  // regra 2 e Ireland: os nomes das nações ocupam o meio do mapa; a legenda desce
  $('#sott').style.top = t >= E.r2 && t < E.r3 ? '1600px' : '';
  // punch zoom nos impactos e flash branco nos cortes
  $('#mappa').style.transform = R.copertina ? '' : `scale(${1 + 0.05 * pulso(t, C.impatti, 0.16)})`;
  $('#flash').style.opacity = R.copertina ? '0' : String(clamp(pulso(t, C.flash, 0.09) * 0.55));
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// ---------- efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada um) ----------
function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'whoosh', { dur: 0.95, giu: true });                     // descida do espaço até o mapa
  add(0.9, 'boom', { vol: 0.4 });
  C.pontos.forEach(p => add(p.ini, 'pop', { vol: 0.32, tono: 0.85 + (p.k % 7) * 0.06 }));
  for (let t = 0.4; t < 3.05; t += 0.09) add(t, 'tick', { vol: 0.35, tono: 1 + 0.4 * t / 3 });
  add(3.05, 'ding', { vol: 0.45, tono: 1.2 });
  add(E.leeds, 'whoosh', { dur: 1.25, giu: true });                // mergulho em Leeds
  add(E.leeds + 1.0, 'select');
  add(E.primo, 'stamp'); add(E.primo + 0.05, 'ding', { vol: 0.5 });
  add(E.c1 - 0.5, 'whoosh', { dur: 0.45, vol: 0.6 });
  C.citta.forEach((c, i) => { add(E[`c${i + 1}`] - 0.12, 'whoosh', { dur: 0.22, vol: 0.5 }); add(E[`c${i + 1}`] + 0.04, 'select', { tono: 1 + i * 0.06, vol: 0.8 }); });
  add(E.domande, 'whoosh', { dur: 1.0 });                          // sobe para o mapa
  C.bolle.forEach((b, k) => add(E.domande + 0.25 + k * 0.42, 'bolla', { tono: 1 + k * 0.12 }));
  add(E.regole - 0.85, 'riser', { dur: 0.85, vol: 0.5 });
  add(E.regole, 'stamp'); add(E.regole + 0.02, 'boom', { vol: 0.45 });
  for (const r of [E.r1, E.r2, E.r3, E.r4]) { add(r, 'stamp', { vol: 0.75 }); add(r + 0.04, 'select', { tono: 1.2 }); }
  add(E.r1 + 0.1, 'whoosh', { dur: 1.1, giu: true });
  add(E.r1 + 1.0, 'notifica');
  const cm = R.commento, nc = cm.testo.length;
  [...cm.testo].forEach((ch, k) => { if (ch !== ' ') add(E.scrivi_da + (k + 0.5) * (E.scrivi_a - E.scrivi_da) / nc, 'tasto'); });
  add(E.scrivi_a + 0.08, 'ding', { tono: 1.2 }); add(E.scrivi_a + 0.1, 'coin', { vol: 0.6 });
  add(E.r2 + 0.05, 'whoosh', { dur: 1.0 });
  add(E.uk - 0.1, 'scintilla', { vol: 0.8 });
  C.naz.forEach((nz, k) => { add(nz.t, 'pop', { tono: 0.9 + k * 0.1 }); add(nz.t + 0.03, 'ding', { vol: 0.45, tono: [1, 1.26, 1.5, 2][k] }); });
  add(E.irl - 0.05, 'whoosh', { dur: 0.8, vol: 0.7 });
  C.fuori.forEach(f => add(f.t + 0.04, 'errore'));
  add(E.nocount, 'stamp'); add(E.nocount + 0.06, 'errore', { vol: 0.7 });
  add(E.r3 - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  C.londra.etich.forEach((e, k) => add(E.r3 + 0.45 + k * 0.28, 'pop', { tono: 1 + k * 0.08, vol: 0.7 }));
  add(E.at, 'tap', { vol: 0.7 });
  add(E.r4 - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  add(E.fond, 'select', { tono: 1.25 });
  add(E.placca, 'flap'); add(E.placca + 0.05, 'pop', { tono: 0.8 });
  add(E.sempre, 'stamp'); add(E.sempre + 0.05, 'ding');
  add(E.ora + 0.1, 'whoosh', { dur: 0.9, vol: 0.6 });
  for (let t = E.ora + 0.3; t < E.entro - 0.05; t += 0.14) add(t, 'tick', { vol: 0.45 });
  add(E.entro, 'ding', { tono: 1.1 });
  add(E.bio, 'notifica', { tono: 1.1 });
  add(E.cresce - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  R.crescita.forEach(([dt], k) => {
    const ti = k === R.crescita.length - 1 ? E.grow : E.cresce + dt;
    if (k === R.crescita.length - 1) { add(ti, 'stamp'); add(ti + 0.04, 'scintilla'); }
    else { add(ti, 'pop', { tono: 0.8 + k * 0.1 }); if (k) add(ti + 0.03, 'coin', { vol: 0.5 }); }
  });
  add(E.ni, 'whoosh', { dur: 1.3 });
  add(E.vuoto, 'stamp', { vol: 0.8 });
  add(E.primo_ni - 0.3, 'pop', { tono: 0.7 }); add(E.primo_ni, 'bolla', { tono: 0.8 });
  add(E.banner - 0.45, 'silenzio', { dur: 0.42 });                 // a música respira antes do "Comment your town!"
  add(E.banner, 'ding', { tono: 1.2 }); add(E.banner + 0.02, 'boom', { vol: 0.3 });
  add(E.banner + 0.6, 'scintilla', { vol: 0.5 });
  // palavras em destaque da legenda: toque leve, só onde não há outro som perto
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) {
    if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.35 });
  }
  return S.sort((a, b) => a.t - b.t);
}

// ---------- preparação ----------
async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const luogo = nome => D.luoghi.find(l => l.nome === nome);
  const fondatore = l => { const c = [...l.casas].map(i => D.casas[i]).sort((a, b) => a.ts - b.ts)[0]; citta.posCasa(c); return c; };
  cena = { totCase: D.casas.length, totCitta: D.luoghi.length };
  const C = cena;
  // Leeds e as cidades da lista, cada uma com o seu fundador
  const lL = luogo(R.primo), fL = fondatore(lL);
  C.leeds = { casa: fL, el: cartao(fL, `★ @${esc(fL.conta)}`, `Founded ${esc(lL.nome)} at ${ora(fL.ts)}`, true, '1ST TOWN') };
  C.citta = R.citta_lista.map(nome => { const l = luogo(nome), f = fondatore(l); return { casa: f, el: cartao(f, `★ @${esc(f.conta)}`, `Founder of ${esc(l.nome)}`, true) }; });
  // regra 3: as casas da cidade com mais gente
  // (4 casas, @ curtos: rótulos legíveis sem encavalar)
  const lon = luogo(R.esempio_casa), casasLon = [...lon.casas].map(i => D.casas[i]).filter(c => c.conta.length <= 18).sort((a, b) => a.ts - b.ts).slice(0, 4);
  casasLon.forEach(c => citta.posCasa(c));
  C.londra = { x: casasLon.reduce((s, c) => s + c.x, 0) / casasLon.length, z: casasLon.reduce((s, c) => s + c.z, 0) / casasLon.length, etich: casasLon.map(c => ({ casa: c, el: cartao(c, `@${esc(c.conta)}`, '', false) })) };
  C.londra.etich.forEach(e => e.el.querySelector('.card').classList.add('mini'));
  // regra 4: fundador com a placa azul
  const lF = luogo(R.esempio_fondatore), fF = fondatore(lF);
  C.fond = { casa: fF, el: cartao(fF, `★ @${esc(fF.conta)}`, `Founder of ${esc(lF.nome)}`, true, 'FOREVER'), placca: criarPlacca(fF) };
  C.fond.el.querySelector('.badge').style.display = 'none';
  C.diorama = criarDiorama();
  C.nazioni = criarNazioni();
  // nomes das 4 nações (Northern Ireland: símbolo neutro, sem bandeira)
  const box = $('#punti');
  const nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };
  C.naz = ['ENG', 'SCT', 'WLS', 'NIR'].map(cod => {
    const r = D.geo.regioni.find(x => x.cod === cod), el = document.createElement('div');
    el.className = 'nazione';
    el.style.background = NAZIONI[cod].cor;
    el.textContent = `${NAZIONI[cod].emoji} ${nomes[cod]}`;
    box.appendChild(el);
    return { el, x: r.lx, z: r.lz, t: E[`n_${cod.toLowerCase()}`] };
  });
  C.fuori = [['Ireland', 53.75, -7.0, E.irl], ['Isle of Man', 54.23, -4.53, E.iom]].map(([nome, lat, lon2, t]) => {
    const el = document.createElement('div');
    el.className = 'fuori';
    el.innerHTML = `<i>✖</i>${esc(nome)}`;
    box.appendChild(el);
    return { el, ...mundo(lat, lon2), t };
  });
  C.belfast = mundo(54.597, -5.93);
  // bolinhas das cidades fundadas, na ordem de fundação
  const ord = [...D.luoghi].sort((a, b) => a.fondatore_ts - b.fondatore_ts);
  C.pontos = ord.map((l, k) => {
    const el = document.createElement('div');
    el.className = 'ponto';
    box.appendChild(el);
    return { el, k, x: l.x, y: mappa.altura(l.x, l.z) + 0.1, z: l.z, ini: 0.4 + 2.5 * k / Math.max(1, ord.length - 1) };
  });
  // perguntas (sem @: são dúvidas típicas, não pessoas)
  const pos = [[90, 560, -4], [430, 760, 3], [140, 960, 2], [470, 1130, -3]];
  C.bolle = R.domande.map((txt, k) => {
    const el = document.createElement('div');
    el.className = 'bolla';
    el.innerHTML = `<i></i><b>${esc(txt)}</b>`;
    $('#bolle').appendChild(el);
    return { el, x: pos[k][0], y: pos[k][1], rot: pos[k][2] };
  });
  // "+5 💬" a cada degrau da casa
  C.piu = R.crescita.slice(1).map((_, k) => {
    const el = document.createElement('div');
    el.className = 'piu forte g';
    el.textContent = '+5 💬';
    el.dataset.x = String(k % 2 ? 640 : 170);
    $('#piu').appendChild(el);
    return el;
  });
  $('#giorno').textContent = R.testa.titolo;
  $('#commento .chi').innerHTML = `${esc(R.commento.utente)} <span>· now</span>`;
  $('#banner').innerHTML = `📍 ${esc(R.banner).replace(' + ', '<br>+ ')}`;
  C.impatti = [[0.9, 0.5], [E.primo, 0.6], ...R.citta_lista.map((_, i) => [E[`c${i + 1}`], 0.3]), [E.regole, 1], [E.r1, 0.5], [E.scrivi_a + 0.08, 0.4], [E.r2, 0.5],
    ...C.naz.map(n => [n.t, 0.25]), ...C.fuori.map(f => [f.t, 0.4]), [E.nocount, 0.8], [E.r3, 0.5], [E.r4, 0.5], [E.placca, 0.3], [E.sempre, 0.8], [E.entro, 0.4],
    ...R.crescita.slice(1, -1).map(([dt]) => [E.cresce + dt, 0.25]), [E.grow, 0.8], [E.vuoto, 0.6], [E.primo_ni, 0.4], [E.banner, 0.5]];
  C.flash = [[0.9, 0.6], ...R.citta_lista.map((_, i) => [E[`c${i + 1}`], 0.7]), [E.regole, 0.5], [E.r3, 0.8], [E.r4, 0.8], [E.cresce, 0.8], [E.banner, 0.4]];
  montarChaves();
  // capa do reel: título grande no topo, cena deslocada para baixo (o perfil recorta a capa em 3:4)
  if (R.copertina) {
    const cp = R.copertina, el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    if (cp.giu) mappa.camera.setViewOffset(1080, 1920, 0, -cp.giu, 1080, 1920);
    for (const s of cp.nascondi ?? []) $(s).style.visibility = 'hidden';
  }
  console.log(`casas ${C.totCase} · cidades ${C.totCitta} · Leeds @${fL.conta} · ${R.citta_lista.map((n, i) => `${n} @${C.citta[i].casa.conta}`).join(' · ')} · ${R.esempio_fondatore} @${fF.conta}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
