// Reel 4 "Day one" com dados reais: o mapa vazio às 05:08 do dia 31/10, as cidades aparecendo na ordem real de fundação
// (26 casas em 6 h, depois a explosão), meia-noite, agora, comentários, o pódio das cidades, cabine e pub desbloqueados,
// Northern Ireland de 0 a centenas, a Battle of the Nations, o 1º colocado e o obrigado.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, QH } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
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

let D, mappa, citta, R, E, chaves, cena;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}
const mundo = (lat, lon) => { const P = D.geo.proj; return { x: (lon - P.LON0) * P.KM * Math.cos(lat * Math.PI / 180), z: (P.LAT0 - lat) * P.KZ }; };

// ---------- tempo real (dia 1) <-> tempo do vídeo ----------
// trechos: [real0, real1, video0, video1]; entre os trechos o relógio para
function trechos() {
  const T0 = Date.parse(R.inizio), T6 = T0 + 6 * 3600e3, TM = Date.parse(R.mezzanotte), TN = Date.parse(D.snap.dati_fino);
  return [[T0, T6, 2.4, E.ventisei + 0.5], [T6, TM, E.boom, E.m_num + 0.35], [TM, TN, E.ora + 0.1, E.o_citta + 0.3]];
}
function realDe(t) {
  const S = cena.trechos;
  if (t <= S[0][2]) return S[0][0];
  for (const [r0, r1, v0, v1] of S) if (t <= v1) return t < v0 ? r0 : r0 + (r1 - r0) * (t - v0) / (v1 - v0);
  return S.at(-1)[1];
}
function videoDe(r) {
  for (const [r0, r1, v0, v1] of cena.trechos) if (r <= r1) return v0 + (v1 - v0) * clamp((r - r0) / (r1 - r0));
  return cena.trechos.at(-1)[3];
}
const contarAte = (lista, r) => { let a = 0, b = lista.length; while (a < b) { const m = (a + b) >> 1; if (lista[m] <= r) a = m + 1; else b = m; } return a; };

// ---------- 3D: as cidades como bolinhas que pipocam na hora em que foram fundadas ----------
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

// ---------- câmera ----------
function montarChaves() {
  const v = D.geo.vista, dP = mappa.distPais(), C = cena;
  const UK = { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: dP, az: 0, el: null, giu: 0 };
  const cid = (l, o) => ({ x: l.x, z: l.z, el: null, giu: 0.04, ...o });
  const nir = D.geo.regioni.find(r => r.cod === 'NIR'), bel = mundo(54.597, -5.93);
  const [lon, liv, nwc, bir] = C.podio.map(p => p.l), cab = C.cab, pub = C.pub, top = C.top;
  const lista = [
    [0, { ...UK, dist: dP * 1.16, az: -0.14 }],
    [E.boom - 0.02, { ...UK, dist: dP * 1.04, az: -0.04 }],
    [E.mezzanotte, { dist: dP * 0.97, az: 0.02 }],
    [E.commenti, { dist: dP * 0.93, az: 0.06 }],
    [E.londra - 0.5, { dist: dP * 0.98, az: 0.04 }],
    [E.londra + 0.75, cid(lon, { dist: 1.25, az: 0.35 })],
    [E.liv - 0.02, { dist: 0.95, az: 0.6 }],
    [E.liv, cid(liv, { dist: 1.05, az: 0.2, cut: true })],
    [E.new - 0.02, { dist: 0.9, az: 0.4 }],
    [E.new, cid(nwc, { dist: 1.05, az: -0.2, cut: true })],
    [E.bir - 0.02, { dist: 0.9, az: 0.0 }],
    [E.bir, cid(bir, { dist: 1.0, az: 0.5, cut: true })],
    [E.cabina - 0.02, { dist: 0.85, az: 0.75 }],
    [E.cabina, { x: cab.l.x - 1.55 * LOTE, z: cab.l.z - 0.55 * LOTE, dist: 0.42, az: 0.55, el: 30, giu: 0, cut: true }],
    [E.pub - 0.02, { dist: 0.32, az: 0.3 }],
    [E.pub, { x: pub.l.x + 0.85 * LOTE, z: pub.l.z - QH + 0.1 * LOTE, dist: 0.42, az: 0.2, el: 18, giu: 0, cut: true }],
    [E.ni - 0.02, { dist: 0.34, az: 0.0 }],
    [E.ni, { x: (nir.lx + bel.x) / 2 + 6, z: nir.lz + 8, dist: 290, az: -0.08, el: null, giu: 0, cut: true }],
    [E.battaglia - 0.02, { dist: 220, az: 0.06 }],
    [E.battaglia, { ...UK, dist: dP * 1.08, az: -0.05, cut: true }],
    [E.top - 0.35, { ...UK, dist: dP * 0.98, az: 0.03 }],
    [E.shrews + 0.1, { x: top.x, z: top.z, dist: 0.55, az: 0.45, el: null, giu: 0.1 }],
    [E.grazie - 0.02, { dist: 0.42, az: 0.95 }],
    [E.grazie, { ...UK, dist: dP * 1.18, az: -0.1, cut: true }],
    [E.cta, { ...UK, dist: dP * 1.02, az: 0 }],
    [R.durata, { ...UK, dist: dP * 0.95, az: 0.04 }],
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
function cartao(titulo, sub, oro, medaglia = '') {
  const el = document.createElement('div');
  el.className = 'etichetta';
  el.innerHTML = `<div class="card${oro ? ' oro' : ''}">${medaglia ? `<div class="medaglia">${medaglia}</div>` : ''}<b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
const rolar = (t, a, dur, alvo) => Math.round(alvo * suave(fase(t, a, dur)));
const topoCidade = l => { const c = citta.dadosCidade(l); return projetar(l.x, c.hc + LOTE * 2.2, l.z); };

function quadro(t) {
  const dist = camera(t), C = cena, U = C.pontos.material.uniforms;
  citta.grupo.visible = dist < 32;
  C.pontos.visible = dist > 40;
  U.agora.value = t;

  // relógio e contador do 1º dia
  const r = realDe(t), live = t >= E.ora;
  const ro = $('#orologio');
  ro.classList.toggle('live', live);
  if (pop(ro, t, 0.1, E.commenti - 0.05)) {
    const mezz = r >= Date.parse(R.mezzanotte) - 60e3 && t < E.ora;
    ro.querySelector('small').textContent = live ? `🔴 RIGHT NOW · ${new Date(r).toLocaleDateString('en-GB', { ...LONDRA, weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}`
      : mezz ? '🌙 MIDNIGHT' : new Date(r).toLocaleDateString('en-GB', { ...LONDRA, weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    ro.querySelector('b').textContent = new Date(r).toLocaleTimeString('en-GB', { ...LONDRA, hour: '2-digit', minute: '2-digit' });
    const marco = [E.sei, E.boom, E.mezzanotte, E.ora].filter(x => t >= x).pop() ?? -9;
    ro.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-Math.max(0, t - marco) / 0.15)})`;
  }
  const ct = $('#conta');
  if (pop(ct, t, 0.35, E.londra - 0.05)) {
    if (t < E.commenti) {
      const nc = contarAte(C.tsCase, r), nl = contarAte(C.tsCitta, r);
      ct.querySelector('.num').textContent = num(nc);
      ct.querySelector('.lab').textContent = nc === 1 ? 'HOUSE' : 'HOUSES';
      ct.querySelector('.sub').textContent = nl ? `🏘️ ${num(nl)} ${nl === 1 ? 'TOWN' : 'TOWNS'}` : '';
    } else {
      ct.querySelector('.num').textContent = num(rolar(t, E.commenti, 0.9, C.commenti));
      ct.querySelector('.lab').textContent = 'COMMENTS 💬';
      ct.querySelector('.sub').textContent = '';
    }
    const marco = [E.ventisei, E.m_num, E.o_num, E.commenti + 0.9].filter(x => t >= x).pop() ?? -9;
    ct.style.transform += ` scale(${1 + 0.1 * Math.exp(-Math.max(0, t - marco) / 0.15)})`;
  }
  pop($('#trovato'), t, E.boom, E.mezzanotte - 0.1, { base: 'rotate(-5deg)' });
  // comentários chovendo (só "cidade, nação": o jeito certo de entrar no jogo)
  C.bolle.forEach((b, k) => {
    const s = pop(b.el, t, b.t, E.londra - 0.1, { base: `translate(${b.x}px, ${b.y - 50 * fase(t, b.t, 2.5)}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateX(${Math.sin(t * 2.3 + k) * 5}px)`;
  });

  // pódio das cidades
  C.podio.forEach((p, k) => presa(p.el, t, topoCidade(p.l), p.t + (k ? 0.05 : 0.7), k < 3 ? C.podio[k + 1].t : E.cabina, 1 + 0.1 * Math.exp(-Math.max(0, t - (k ? p.t : E.l_num)) / 0.15)));
  // cabine e pub: quantas cidades já têm
  const sb = $('#sblocco'), cab = t < E.pub;
  if (pop(sb, t, cab ? E.cabina + 0.1 : E.pub + 0.1, cab ? E.pub : E.ni)) {
    sb.querySelector('small').textContent = cab ? '☎️ RED PHONE BOX' : '🍺 THEIR OWN PUB';
    sb.querySelector('b').textContent = num(cab ? rolar(t, E.cabina + 0.2, 1.4, C.nCabine) : rolar(t, E.pub + 0.2, 1.1, C.nPub));
    sb.querySelector('i').textContent = 'TOWNS';
    const fim = cab ? E.cabina + 1.6 : E.pub + 1.3;
    sb.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-Math.max(0, t - fim) / 0.15) * (t >= fim)})`;
  }
  presa(C.cab.el, t, projetar(C.cab.l.x - 1.55 * LOTE, citta.dadosCidade(C.cab.l).hc + LOTE * 0.55, C.cab.l.z - 0.55 * LOTE), E.cabina_x - 0.1, E.pub);
  presa(C.pub.el, t, projetar(C.pub.l.x + 0.85 * LOTE, citta.dadosCidade(C.pub.l).hc + LOTE * 1.0, C.pub.l.z - QH + 0.1 * LOTE), E.pub_x - 0.15, E.ni);

  // Northern Ireland: "0 HOUSES" riscado e o número de agora
  const ni = $('#nir');
  if (pop(ni, t, E.ni + 0.1, E.battaglia)) {
    const n = t < E.ni_num ? 0 : rolar(t, E.ni_num, 1.0, C.nNir);
    ni.querySelector('b').textContent = `${num(n)} HOUSES`;
    const br = ni.querySelector('.barra');
    br.style.opacity = t >= E.zero && t < E.ni_num ? '1' : '0';
    br.style.transform = `scaleX(${suave(fase(t, E.zero, 0.25))})`;
    ni.querySelector('.carta').style.transform = `scale(${1 + 0.12 * Math.exp(-Math.max(0, t - E.ni_num - 1.0) / 0.15) * (t >= E.ni_num + 1.0)})`;
  }
  // destaque por nação: NI pulsando; Wales vencendo; todo mundo no obrigado
  U.evid.value[3] = t >= E.ni_num && t < E.battaglia ? 0.6 + 0.4 * Math.sin((t - E.ni_num) * 7) : 0;
  U.evid.value[2] = t >= E.galles && t < E.top + 0.5 ? 0.7 + 0.3 * Math.sin((t - E.galles) * 7) : 0;
  if (t >= E.grazie) for (let k = 0; k < 4; k++) U.evid.value[k] = 0.5 + 0.5 * Math.sin((t - E.grazie) * 4 + k);

  // Battle of the Nations: barras crescem com suspense; Wales ganha a coroa
  const bt = $('#battaglia');
  if (pop(bt, t, E.battaglia + 0.05, E.top)) {
    C.righe.forEach((rg, k) => {
      rg.barra.style.width = `${100 * rg.pm / C.pmMax * suave(fase(t, E.battaglia + 0.3 + k * 0.1, E.galles - E.battaglia - 0.6))}%`;
      const vence = rg.cod === C.vincitore && t >= E.galles;
      rg.cor.textContent = vence ? '👑' : '';
      rg.cor.style.transform = vence ? `scale(${ressalto(fase(t, E.galles, 0.3))})` : '';
      rg.el.style.transform = vence ? `scale(${1 + 0.08 * Math.exp(-(t - E.galles) / 0.2)})` : '';
    });
  }
  pop($('#galles'), t, E.vince - 0.05, E.top, { base: 'rotate(-4deg)' });

  // o 1º colocado
  const tp = C.top;
  if (t >= E.shrews - 0.2 && t < E.grazie) tp.el.querySelector('small').textContent = `NO. 1 IN THE UK · ${num(rolar(t, E.shrews, E.punti - E.shrews + 0.2, tp.pts))} PTS`;
  presa(tp.el, t, projetar(tp.x, tp.y + ALTURA_NIVEL[tp.casa.livello] * LOTE + 0.004, tp.z), E.shrews - 0.2, E.grazie, 1 + 0.12 * Math.exp(-Math.max(0, t - E.punti - 0.2) / 0.15) * (t >= E.punti + 0.2));

  // obrigado e o banner final
  if (pop($('#grazie'), t, E.grazie, E.cta - 0.05, { base: 'rotate(-3deg)' })) $('#grazie .cuore').style.transform = `scale(${1 + 0.25 * Math.max(0, Math.sin((t - E.davvero) * 9)) * (t >= E.davvero)})`;
  const bn = $('#banner');
  bn.style.opacity = t >= E.cta ? '1' : '0';
  [...bn.children].forEach((d, k) => {
    const ti = [E.cta, E.cta2][k], s = t >= ti ? ressalto(fase(t, ti, 0.32)) : 0;
    d.style.opacity = s > 0 ? '1' : '0';
    d.style.transform = `scale(${s}) rotate(${k ? 2 : -2}deg)`;
  });
  $('#scuro').style.opacity = String(0.42 * fase(t, E.battaglia - 0.05, 0.2) * (1 - fase(t, E.top - 0.2, 0.3)) + 0.25 * fase(t, E.cta - 0.2, 0.3));

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
  add(0, 'vento', { dur: 2.4, vol: 0.4 });                               // o mapa vazio, silêncio de madrugada
  add(0.1, 'pop', { tono: 0.8, vol: 0.5 });
  // primeiras casas: um pop por cidade nova no começo (devagar); na explosão, pops densos e um tique contínuo
  let ultimo = -1;
  for (const v of C.iniCitta) {
    if (v < 2.3 || v > E.ventisei + 0.6) continue;
    if (v - ultimo > 0.12) { add(v, 'pop', { tono: 0.9 + (S.length % 6) * 0.05, vol: 0.55 }); ultimo = v; }
  }
  add(E.sei, 'tick', { vol: 0.6 }); add(E.ventisei, 'ding', { tono: 1.1, vol: 0.5 });
  add(E.boom - 0.45, 'silenzio', { dur: 0.42 });
  add(E.boom, 'boom', { vol: 0.9 }); add(E.boom + 0.02, 'stamp'); add(E.boom + 0.05, 'scintilla');
  for (let t = E.boom + 0.1; t < E.m_num + 0.35; t += 0.06) add(t, 'pop', { tono: 0.8 + ((t * 13) % 1) * 0.6, vol: 0.32 });
  for (let t = E.boom + 0.1; t < E.m_num + 0.35; t += 0.1) add(t, 'tick', { vol: 0.25, tono: 1 + 0.5 * (t - E.boom) / 4 });
  add(E.mezzanotte, 'campana', { vol: 0.7 }); add(E.m_num + 0.35, 'ding', { tono: 1.2 });
  add(E.ora - 0.3, 'whoosh', { dur: 0.4, vol: 0.6 });
  add(E.ora, 'notifica', { tono: 1.1 });
  for (let t = E.ora + 0.15; t < E.o_citta + 0.3; t += 0.08) add(t, 'tick', { vol: 0.3, tono: 1.2 + 0.5 * (t - E.ora) / 4 });
  add(E.o_citta + 0.3, 'stamp'); add(E.o_citta + 0.32, 'boom', { vol: 0.5 }); add(E.o_citta + 0.35, 'scintilla');
  C.bolle.forEach((b, k) => add(b.t, 'bolla', { tono: 1 + (k % 5) * 0.1, vol: 0.7 }));
  add(E.commenti + 0.9, 'coin');
  add(E.londra - 0.5, 'whoosh', { dur: 1.2, giu: true });
  add(E.londra + 0.7, 'select'); add(E.l_num, 'ding', { tono: 1.3 }); add(E.l_num + 0.03, 'scintilla', { vol: 0.5 });
  C.podio.slice(1).forEach((p, k) => { add(p.t - 0.12, 'whoosh', { dur: 0.22, vol: 0.55 }); add(p.t + 0.05, 'select', { tono: 1.15 - k * 0.08 }); });
  add(E.cabina - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  add(E.cabina + 0.1, 'pop', { tono: 0.9 });
  for (let t = E.cabina + 0.2; t < E.cabina + 1.6; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1 + (t - E.cabina) * 0.3 });
  add(E.cabina + 1.6, 'stamp', { vol: 0.8 }); add(E.cabina + 1.62, 'ding');
  add(E.cabina_x - 0.1, 'campana', { vol: 0.5, tono: 1.4 });
  add(E.pub - 0.12, 'whoosh', { dur: 0.25, vol: 0.6 });
  add(E.pub + 0.1, 'pop', { tono: 0.9 });
  for (let t = E.pub + 0.2; t < E.pub + 1.3; t += 0.08) add(t, 'tick', { vol: 0.3, tono: 1 + (t - E.pub) * 0.3 });
  add(E.pub + 1.3, 'stamp', { vol: 0.8 }); add(E.pub + 1.32, 'ding', { tono: 1.1 });
  add(E.pub_x - 0.15, 'select', { tono: 1.2 });
  add(E.ni - 0.12, 'whoosh', { dur: 0.5, vol: 0.7 });
  add(E.ni + 0.1, 'pop', { tono: 0.8 });
  add(E.zero, 'errore', { vol: 0.6 });
  for (let t = E.ni_num; t < E.ni_num + 1.0; t += 0.06) add(t, 'tick', { vol: 0.32, tono: 1 + (t - E.ni_num) * 0.6 });
  add(E.ni_num + 1.0, 'stamp'); add(E.ni_num + 1.02, 'scintilla');
  add(E.battaglia - 0.1, 'whoosh', { dur: 0.4, vol: 0.7 });
  add(E.battaglia + 0.2, 'rullo', { dur: E.galles - E.battaglia - 0.25, vol: 0.55 });
  add(E.galles - 0.35, 'silenzio', { dur: 0.33 });
  add(E.galles, 'boom', { vol: 0.8 }); add(E.galles + 0.02, 'campana', { vol: 0.7 }); add(E.vince - 0.05, 'stamp'); add(E.vince, 'scintilla');
  add(E.top - 0.35, 'whoosh', { dur: E.shrews - E.top + 0.4, giu: true });
  add(E.shrews - 0.2, 'select');
  for (let t = E.shrews; t < E.punti + 0.2; t += 0.07) add(t, 'tick', { vol: 0.3, tono: 1 + (t - E.shrews) * 0.25 });
  add(E.punti + 0.2, 'coin'); add(E.punti + 0.22, 'ding', { tono: 1.3 });
  add(E.grazie - 0.12, 'whoosh', { dur: 0.6, vol: 0.6 });
  add(E.grazie, 'scintilla', { vol: 0.7 }); add(E.davvero, 'campana', { vol: 0.4, tono: 1.2 });
  add(E.cta - 0.35, 'silenzio', { dur: 0.33 });
  add(E.cta, 'ding', { tono: 1.2 }); add(E.cta + 0.02, 'boom', { vol: 0.35 }); add(E.cta2, 'pop', { tono: 1.1 }); add(E.cta2 + 0.05, 'scintilla', { vol: 0.5 });
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
  C.trechos = trechos();
  C.tsCase = D.casas.map(c => c.ts).sort((a, b) => a - b);
  C.tsCitta = D.luoghi.map(l => l.fondatore_ts).sort((a, b) => a - b);
  C.iniCitta = C.tsCitta.map(videoDe);
  C.commenti = D.snap.contatori.commenti;
  C.pontos = criarPontos();
  const luogo = nome => D.luoghi.find(l => l.nome === nome);
  // pódio (a ordem é a do site na hora da gravação)
  const med = ['🥇', '🥈', '🥉', '4️⃣'], tl = [E.londra, E.liv, E.new, E.bir];
  C.podio = R.podio.map((nome, k) => { const l = luogo(nome); return { l, t: tl[k], el: cartao(`${esc(l.nome.replace(' upon Tyne', ''))}`, `${num(l.case)} HOUSES${l.case >= 100 ? ' · 🚉 STATION' : ''}`, k === 0, med[k]) }; });
  // cabine: cidade com 5 a 9 casas; pub: cidade com 30 a 49 (a mais antiga de cada faixa)
  const faixa = (a, b) => D.luoghi.filter(l => l.case >= a && l.case <= b && l.regione.cod === 'ENG').sort((x, y) => x.fondatore_ts - y.fondatore_ts)[0];
  const lc = faixa(5, 9), lp = faixa(30, 49);
  C.cab = { l: lc, el: cartao(`☎️ ${esc(lc.nome)}`, `${num(lc.case)} HOUSES`, false) };
  C.pub = { l: lp, el: cartao(`🍺 ${esc(lp.nome)}`, `${num(lp.case)} HOUSES`, false) };
  C.nCabine = D.luoghi.filter(l => l.case >= 3).length;
  C.nPub = D.luoghi.filter(l => l.case >= 30).length;
  C.nNir = D.regPorCod.get('NIR').case;
  // Battle of the Nations
  const guerra = D.snap.cariche.guerra, nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };
  C.vincitore = guerra[0].cod;
  C.pmMax = Math.max(...guerra.map(g => g.per_milione));
  C.righe = COD.map(cod => {
    const g = guerra.find(x => x.cod === cod), el = document.createElement('div');
    el.className = 'riga';
    el.innerHTML = `<div class="nome">${NAZIONI[cod].emoji} ${nomes[cod]}</div><div class="barra"><i style="background:${NAZIONI[cod].cor}"></i></div><div class="cor"></div>`;
    $('#righe').appendChild(el);
    return { cod, pm: g?.per_milione ?? 0, el, barra: el.querySelector('.barra i'), cor: el.querySelector('.cor') };
  });
  // 1º colocado (sem os pontos de negócio no mapa, como nas eleições)
  const top = [...D.casas].sort((a, b) => (b.tot - (b.fonti?.[8] ?? 0)) - (a.tot - (a.fonti?.[8] ?? 0)) || a.ts - b.ts)[0], pt = citta.posCasa(top);
  C.top = { casa: top, x: pt.x, y: pt.y, z: pt.z, pts: top.tot - (top.fonti?.[8] ?? 0), el: cartao(`👑 @${esc(top.conta)}`, '&nbsp;', true) };
  // comentários: as maiores cidades, no formato certo
  const big = [...D.luoghi].sort((a, b) => b.case - a.case).slice(0, 9), pos = [[70, 760, -4], [470, 860, 3], [130, 980, 2], [520, 1090, -3], [60, 1200, 3], [440, 1300, -2], [150, 700, 2], [560, 1180, 4], [90, 1080, -2]];
  C.bolle = big.map((l, k) => {
    const el = document.createElement('div');
    el.className = 'bolla';
    el.innerHTML = `<i></i><b>${esc(l.nome.replace(' upon Tyne', ''))}, ${esc(nomes[l.regione.cod])}</b><em>✓</em>`;
    $('#bolle').appendChild(el);
    return { el, t: E.commenti + 0.05 + k * 0.2, x: pos[k][0], y: pos[k][1], rot: pos[k][2] };
  });
  $('#banner').innerHTML = R.banner.map((l, k) => `<div${k ? ' class="g"' : ''}>${esc(l)}</div>`).join('');
  C.impatti = [[E.boom, 1.2], [E.m_num + 0.35, 0.5], [E.o_citta + 0.3, 0.9], [E.commenti + 0.9, 0.3], [E.l_num, 0.5], ...C.podio.slice(1).map(p => [p.t, 0.35]),
    [E.cabina + 1.6, 0.6], [E.pub + 1.3, 0.6], [E.zero, 0.4], [E.ni_num + 1.0, 0.7], [E.galles, 1.1], [E.punti + 0.2, 0.6], [E.grazie, 0.4], [E.cta, 0.5]];
  C.flash = [[E.boom, 1], [E.mezzanotte, 0.3], [E.o_citta + 0.3, 0.5], ...C.podio.slice(1).map(p => [p.t, 0.7]), [E.cabina, 0.8], [E.pub, 0.8], [E.ni, 0.8], [E.battaglia, 0.6], [E.galles, 0.7], [E.grazie, 0.8], [E.cta, 0.3]];
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
  console.log(`casas ${D.casas.length} · cidades ${D.luoghi.length} · comentários ${C.commenti} · pódio ${C.podio.map(p => `${p.l.nome} ${p.l.case}`).join(', ')} · cabine ${C.nCabine} (${lc.nome}) · pub ${C.nPub} (${lp.nome}) · NIR ${C.nNir} · vence ${C.vincitore} · top @${top.conta} ${C.top.pts} (${D.luoghi[top.luogo].nome})`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
