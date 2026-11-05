// Reel 13 "Bonfire Night tonight" (05/11), feito a partir do Reel 9 (fogos.js): o mapa vira noite, fogos nas cidades com
// mais casas, "is your town big enough?", cidade média, casa nova que "goes up today", amigos marcados, show maior e "like this".
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { aspetto, geometriaCasa, stileRegione } from '../js/modelli.js';
import { REGOLE, num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';
import { kit, $, ressalto, fase, esc, clamp } from './kit.js';

let D, mappa, citta, R, E, cena, K;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// sorteio com semente (mulberry32)
const semente = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- luzes das casas à noite (um ponto quente por casa) ----------
function criarLuci() {
  const n = D.casas.length, pos = new Float32Array(n * 3);
  D.casas.forEach((casa, i) => { const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z; pos.set([x, mappa.altura(x, z) + 0.05, z], i * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) }, a: { value: 0 } },
    vertexShader: `uniform float escala; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(0.12 * escala / -mv.z, 3.0, 12.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float a; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * (1.0 - d * d) * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}

// ---------- nações acendendo (cidades como pontinhos na cor da nação) ----------
function criarNazioni() {
  const cods = ['ENG', 'SCT', 'WLS', 'NIR'], n = D.comuni.length;
  const pos = new Float32Array(n * 3), naz = new Float32Array(n);
  D.comuni.forEach((c, i) => { pos.set([c.x, mappa.altura(c.x, c.z) + 0.04, c.z], i * 3); naz[i] = Math.max(0, cods.indexOf(c.reg)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { luce: { value: [0, 0, 0, 0] }, cor: { value: cods.map(k => new THREE.Color(NAZIONI[k].cor).lerp(new THREE.Color('#ffffff'), 0.25)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float naz; uniform float luce[4]; uniform vec3 cor[4]; uniform float escala;
      varying vec3 vCor; varying float vA;
      void main() {
        int k = int(naz + 0.5);
        vA = luce[k]; vCor = cor[k];
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(2.2 * escala / -mv.z, 3.0, 9.0) * (1.0 + 0.4 * vA);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0 || vA < 0.01) discard; gl_FragColor = vec4(vCor * vA * (1.0 - smoothstep(0.6, 1.0, d)), 1.0); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 7;
  mappa.scene.add(p);
  return p;
}

// ---------- fogos: foguete subindo + explosão; tamanho acompanha o zoom (como no site) ----------
const PAL = { oro: ['#FFD66B', '#FFF1B8'], rosso: ['#FF5A4E', '#FFC2B8'], verde: ['#3FE07A', '#C9FFD9'], bianco: ['#FFFFFF', '#DDE8FF'], blu: ['#5AA8FF', '#CDE6FF'], rosa: ['#FF6FB5', '#FFD0EA'] };
const NPART = 64, CAP = 9000, VIDA = 2.6, SALITA = 0.65;
function criarFuochi() {
  const g = new THREE.BufferGeometry();
  const aPos = new Float32Array(CAP * 3), aCor = new Float32Array(CAP * 3), aAlfa = new Float32Array(CAP), aTam = new Float32Array(CAP);
  g.setAttribute('position', new THREE.BufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('cor', new THREE.BufferAttribute(aCor, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alfa', new THREE.BufferAttribute(aAlfa, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('tam', new THREE.BufferAttribute(aTam, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `attribute vec3 cor; attribute float alfa; attribute float tam; uniform float escala; varying vec3 vCor; varying float vA;
      void main() { vCor = cor; vA = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = alfa <= 0.0 ? 0.0 : clamp(tam * escala / -mv.z, 4.0, 34.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vCor; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float nucleo = smoothstep(0.55, 0.0, d), alone = (1.0 - d) * 0.45; gl_FragColor = vec4(vCor * (nucleo + alone) * vA * 2.2, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 20;
  mappa.scene.add(pts);
  return { pts, aPos, aCor, aAlfa, aTam };
}
// fontes: { l, rate, da, a, forza } -> lista fixa de estouros
function sortearScoppi(fonti) {
  const rnd = semente(1605), out = [], cores = Object.keys(PAL);
  for (const f of fonti) {
    let t = f.da + rnd() / f.rate;
    while (t < f.a) {
      const [c1, c2] = PAL[(f.pal ?? cores)[Math.floor(rnd() * (f.pal ?? cores).length)]];
      const dirs = [];
      for (let i = 0; i < NPART; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = 0.75 + rnd() * 0.35; dirs.push([Math.cos(a) * s * v, u * v, Math.sin(a) * s * v, new THREE.Color(rnd() < 0.5 ? c1 : c2)]); }
      const sp = f.spread ?? 0.8;
      out.push({ x: f.l.x + (rnd() - 0.5) * sp, z: f.l.z + (rnd() - 0.5) * sp, y: mappa.altura(f.l.x, f.l.z), t, dirs, forza: f.forza ?? 1, l: f.l });
      t += (0.35 + rnd() * 1.3) / f.rate;
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
function disegnaFuochi(t, dist) {
  // de longe (país) os estouros ficam proporcionalmente menores, para não cobrir o mapa
  const F = cena.fuochi, R0 = Math.max(0.05, Math.min(70, dist * 0.045 / (1 + dist / 1100)));
  let k = 0;
  for (const s of cena.scoppi) {
    const tau = t - s.t;
    if (tau < 0) break;
    if (tau >= VIDA) continue;
    const Rr = R0 * s.forza, tamF = Rr * 0.2, apice = s.y + Rr * 1.6;
    if (tau < SALITA) {
      if (k >= CAP) break;
      const p = tau / SALITA, yy = s.y + (apice - s.y) * (1 - (1 - p) * (1 - p));
      F.aPos.set([s.x, yy, s.z], k * 3); F.aCor.set([1, 0.9, 0.69], k * 3); F.aAlfa[k] = 0.9; F.aTam[k] = tamF * 0.8; k++;
      continue;
    }
    const e = tau - SALITA, esp = 1 - Math.exp(-3.2 * e), caduta = 0.35 * e * e, alfa = Math.max(0, 1 - e / 1.9) * (0.75 + 0.25 * Math.sin(e * 40 + s.x));
    for (const [dx, dy, dz, c] of s.dirs) {
      if (k >= CAP) break;
      F.aPos.set([s.x + dx * Rr * esp, apice + dy * Rr * esp - caduta * Rr, s.z + dz * Rr * esp], k * 3);
      F.aCor.set([c.r, c.g, c.b], k * 3); F.aAlfa[k] = alfa; F.aTam[k] = tamF; k++;
    }
  }
  for (let i = k; i < (cena.kAnt ?? CAP); i++) F.aAlfa[i] = 0;
  cena.kAnt = k;
  const at = F.pts.geometry.attributes;
  at.position.needsUpdate = at.cor.needsUpdate = at.alfa.needsUpdate = at.tam.needsUpdate = true;
  F.pts.geometry.setDrawRange(0, Math.max(k, 1));
}

const matPadrao = () => citta.mat;
function casaNormal(casa) {
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa);
  const m = new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stileRegione(l.regione.cod, l.comune.sigla)), matPadrao());
  m.position.set(p.x, p.y + 0.0009, p.z); m.rotation.y = posLote(casa.lote).rot; m.scale.setScalar(LOTE);
  citta.grupo.add(m);
  return m;
}

function quadro(t) {
  const C = cena, dist = K.camera(t);
  citta.grupo.visible = dist < 32;
  // o dia vira noite em "night"
  const notte = t >= E.luci;
  if (mappa.notte !== notte) mappa.definirNotte(notte);
  C.luci.material.uniforms.a.value = fase(t, E.luci, 0.8);
  C.luci.visible = notte && dist > 6;
  disegnaFuochi(t, dist);

  K.pop($('#titolo'), t, E.bonfire - 0.05, E.unisce - 0.05, { base: 'rotate(-3deg)' });
  // o maior show: ranking real das cidades com mais casas
  if (K.pop($('#classifica'), t, E.most - 0.05, E.domanda - 0.05)) C.righe.forEach((r, i) => {
    const ti = E.most + 0.1 + i * 0.2, s = t >= ti ? ressalto(fase(t, ti, 0.3)) : 0;
    r.el.style.opacity = s > 0 ? '1' : '0'; r.el.style.transform = `scale(${Math.max(0.001, s)})`;
  });
  K.pop($('#domanda'), t, E.domanda, E.non - 0.05, { base: 'rotate(-3deg)' });
  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim);
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.ogni - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    const piu = b.el.querySelector('.piu');
    if (piu) { const sp = t >= b.t + 0.3 ? ressalto(fase(t, b.t + 0.3, 0.3)) : 0; piu.style.opacity = sp > 0 ? '1' : '0'; piu.style.transform = `scale(${Math.max(0.001, sp)})`; }
  });
  // casa nova "goes up today"
  const sN = t >= C.nova.t ? ressalto(fase(t, C.nova.t, 0.35)) : 0;
  C.nova.m.visible = sN > 0; C.nova.m.scale.set(LOTE, LOTE * Math.max(0.001, sN), LOTE);
  if (t < E.tag) K.banner(t, [E.cta, E.cta + 0.45], R.banner, E.tag - 0.05);
  else K.banner(t, [E.like, E.like + 0.45], R.banner);
  $('#scuro').style.opacity = String(0.35 * fase(t, E.domanda - 0.1, 0.2) * (1 - fase(t, E.non - 0.1, 0.15)) + 0.42 * fase(t, E.tag - 0.15, 0.25) * (1 - fase(t, E.ogni - 0.1, 0.2)) + 0.25 * fase(t, E.like - 0.1, 0.25));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'whoosh', { dur: 0.4, vol: 0.5 }); add(0.05, 'campana', { vol: 0.5 });
  add(E.bonfire - 0.1, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.bonfire, 'stamp'); add(E.bonfire + 0.03, 'campana', { vol: 0.6 });
  add(E.luci - 0.2, 'silenzio', { dur: 0.18 }); add(E.luci, 'boom', { vol: 0.7 }); add(E.luci + 0.05, 'scintilla', { vol: 0.7 });
  add(E.unisce, 'stamp', { vol: 0.7 });
  add(E.dusk - 0.1, 'whoosh', { dur: 0.3, vol: 0.55 }); add(E.dusk, 'stamp', { vol: 0.7 });
  // estouros: no máximo ~1 a cada 0,45 s
  let ult = -1;
  for (const s of C.scoppi) {
    const tb = s.t + SALITA - 0.32;
    if (tb - ult < 0.45 || tb < E.fuochi - 0.2) continue;
    ult = tb; add(tb, 'fuoco', { tono: 0.8 + (s.x * 13 % 1 + 1) % 1 * 0.5, vol: s.forza > 1 ? 0.75 : 0.45 });
  }
  add(E.most - 0.12, 'whoosh', { dur: 0.3, vol: 0.6 });
  C.righe.forEach((_, i) => add(E.most + 0.1 + i * 0.2, 'select', { tono: 1 + i * 0.15 }));
  add(E.domanda - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 }); add(E.domanda, 'bolla', { tono: 1.2, vol: 0.6 });
  add(E.non - 0.1, 'whoosh', { dur: 0.3, vol: 0.55 }); add(E.non, 'notifica', { tono: 1.1 });
  add(E.cta - 0.2, 'silenzio', { dur: 0.18 }); add(E.cta, 'boom', { vol: 0.45 }); add(E.cta + 0.03, 'ding', { tono: 1.2 }); add(E.cta + 0.45, 'pop', { tono: 1.1 });
  add(C.nova.t, 'pop', { tono: 1.1 }); add(C.nova.t + 0.12, 'coin', { vol: 0.6 });
  add(E.tag - 0.12, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 });
  C.bolle.forEach((b, i) => { add(b.t, 'bolla', { tono: 1 + i * 0.08, vol: 0.65 }); add(b.t + 0.3, 'coin', { vol: 0.45 }); });
  add(E.ogni - 0.1, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.bigger, 'stamp'); add(E.bigger + 0.03, 'scintilla', { vol: 0.6 });
  add(E.like - 0.2, 'silenzio', { dur: 0.18 }); add(E.like, 'boom', { vol: 0.5 }); add(E.like + 0.03, 'ding', { tono: 1.3 }); add(E.like + 0.45, 'pop', { tono: 1.1 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.3 });
  return S.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const C = cena, dP = mappa.distPais(), fim = R.durata;
  C.luci = criarLuci();
  C.fuochi = criarFuochi();
  // cidades com fogos: as 90 com mais casas de England, Scotland e Wales (como no site hoje)
  const gb = D.luoghi.filter(l => l.regione.cod !== 'NIR').sort((a, b) => b.case - a.case);
  const top = gb.slice(0, 90), big = gb[0];
  const media = gb.filter(l => l.case >= 25 && l.case <= 45).sort((a, b) => a.fondatore_ts - b.fondatore_ts)[0];
  const piccola = gb.filter(l => l.case >= 8 && l.case <= 14 && l !== media).sort((a, b) => a.fondatore_ts - b.fondatore_ts)[2];
  const fonti = [
    ...gb.slice(0, 12).map(l => ({ l, rate: 0.35, da: E.bonfire, a: E.dusk })),
    ...top.map((l, k) => ({ l, rate: k < 12 ? 0.7 : 0.3, da: E.dusk, a: fim })),
    { l: big, rate: 4.5, da: E.most - 0.6, a: E.domanda + 0.3, forza: 1.15, spread: 1.6 },
    { l: media, rate: 2.2, da: E.domanda - 0.8, a: E.non + 0.3, spread: 0.5 },
    { l: piccola, rate: 1.6, da: E.non - 0.8, a: E.tag + 0.3, spread: 0.35 },
    { l: media, rate: 6, da: E.ogni - 0.6, a: E.like + 0.3, forza: 1.2, spread: 0.7 },
  ];
  C.scoppi = sortearScoppi(fonti);
  const nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales' };
  C.righe = gb.slice(0, 3).map((l, i) => {
    const el = document.createElement('div');
    el.className = 'riga';
    el.innerHTML = `<div class="m">${['🥇', '🥈', '🥉'][i]}</div><div class="q">${esc(l.nome)}<small>${esc(nomes[l.regione.cod] ?? '')}</small></div><div class="n">${num(l.case)} 🏠</div>`;
    $('#righe').appendChild(el);
    return { el };
  });
  // casa nova na cidade pequena (a mais nova de lá)
  const ult = piccola.casas.map(i => D.casas[i]).sort((a, b) => b.ts - a.ts)[0];
  citta.nascoste.add(ult.conta); citta.cache.delete(piccola.id); citta.ultimo = null;
  C.nova = { casa: ult, m: casaNormal(ult), t: E.casa };
  const sobre = (l, h = 0.6) => () => K.projetar(l.x, mappa.altura(l.x, l.z) + h, l.z);
  const topoCasa = c => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + 0.5 * LOTE + 0.002, p.z); };
  C.cartoes = [
    { el: K.cartao('🎆 Your town?', `${esc(media.nome)} · ${num(media.case)} HOUSES`, 'rosa'), p: sobre(media, 1.0), ini: E.domanda + 0.3, fim: E.non - 0.05 },
    { el: K.cartao(`🏠 @${esc(ult.conta)}`, 'UP TODAY 🎆', 'verde'), p: topoCasa(ult), ini: C.nova.t + 0.2, fim: E.tag - 0.05 },
    { el: K.cartao('🏠 +1 house', 'BIGGER SHOW 🎆', 'oro'), p: sobre(media, 1.0), ini: E.ogni + 0.2, fim: E.like - 0.05 },
  ];
  C.timbri = [
    K.timbro('🌙 Tonight', '#1E5AA8', 300, E.stasera, E.bonfire - 0.05, -4, 96),
    K.timbro('🗺️ Our map joins in', '#7B2CBF', 300, E.unisce, E.dusk - 0.05, -3, 84),
    K.timbro('🌆 At dusk', '#E0473C', 300, E.dusk, E.most - 0.1, -3, 92),
    K.timbro('❤️ Like this', '#E0306E', 1120, E.like, Infinity, -3, 100),
  ];
  const tags = [['<span class="t">@your_mate</span> get on the map 🎆', '#FFC93C'], ['<span class="t">@your_cousin</span> our town needs you', '#9FD3E6'],
    ['<span class="t">@your_flatmate</span> comment your town!', '#F2B8C6'], ['<span class="t">@your_neighbour</span> bigger show 👀', '#A8E0C2']];
  const pos = [[60, 560, -3], [200, 720, 2], [50, 880, -2], [220, 1040, 3]];
  C.bolle = tags.map(([html, cor], i) => ({ el: K.bolla(html, cor, `+${REGOLE.punti.tag}`), t: E.tag + 0.1 + i * 0.2, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  C.impatti = [[E.luci, 0.8], [E.bonfire, 0.5], [E.cta, 0.5], [E.bigger, 0.6], [E.like, 0.5]];
  C.flash = [[E.luci, 0.9], [E.bonfire, 0.4], [E.dusk, 0.3], [E.most, 0.3], [E.non, 0.3], [E.cta, 0.3], [E.bigger, 0.4], [E.like, 0.3]];
  // câmera
  const meio = { x: (top[0].x + top[5].x) / 2, z: (top[0].z + top[5].z) / 2 };
  K.chaves([
    [0, K.uk({ dist: dP * 1.1, az: -0.08 })],
    [E.luci, K.uk({ dist: dP * 1.02, az: -0.03 })],
    [E.dusk - 0.05, K.uk({ dist: dP * 0.95, az: 0.03 })],
    [E.dusk, { ...meio, dist: dP * 0.22, az: 0.1, el: 34, giu: 0, dy: 0, cut: true }],
    [E.most - 0.1, K.deriva(dP * 0.17, 0.12)],
    [E.most, { x: big.x, z: big.z, dist: 26, az: 0.25, el: 30, giu: 0.1, dy: 0, cut: true }],
    [E.domanda - 0.05, K.deriva(19, 0.25)],
    [E.domanda, { x: media.x, z: media.z, dist: 9, az: -0.3, el: 30, giu: 0.05, dy: 0, cut: true }],
    [E.non - 0.05, K.deriva(7, 0.15)],
    [E.non, K.casa(citta, ult, { dist: 0.55, az: 0.35, el: 24, cut: true })],
    [E.tag - 0.05, K.deriva(0.4, 0.3)],
    [E.tag, K.uk({ dist: dP * 0.98, az: 0, cut: true })],
    [E.ogni - 0.05, K.uk({ dist: dP * 0.95, az: 0.02 })],
    [E.ogni, { x: media.x, z: media.z, dist: 8, az: 0.2, el: 28, giu: 0.05, dy: 0, cut: true }],
    [E.like - 0.05, K.deriva(6, 0.2)],
    [E.like, K.uk({ dist: dP * 1.0, az: -0.02, cut: true })],
    [fim, K.uk({ dist: dP * 1.06, az: 0.04 })],
  ]);
  K.capa();
  console.log(`maior ${big.nome} (${big.case}) · média ${media.nome} (${media.case}) · pequena ${piccola.nome} (${piccola.case}) · casa nova @${ult.conta} · ${C.scoppi.length} estouros`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
