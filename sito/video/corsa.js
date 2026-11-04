// Reel 10 "25 days to First Minister": contagem até 29/11, um First Minister por nação (as 4 acendem), os líderes reais
// de cada nação (corte na casa de cada um), o placar apertado, marcar amigos (+3), amigo que entra (+25) e "você"
// subindo no placar real da Northern Ireland. window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL, aspetto, geometriaCasa, stileRegione } from '../js/modelli.js';
import { REGOLE, num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';
import { kit, $, ressalto, fase, esc, rolar, suave } from './kit.js';

let D, mappa, citta, R, E, cena, K;
const COD = ['ENG', 'SCT', 'WLS', 'NIR'], NOMI = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// cidades como pontinhos na cor de cada nação
function criarNazioni() {
  const n = D.comuni.length, pos = new Float32Array(n * 3), naz = new Float32Array(n);
  D.comuni.forEach((c, i) => { pos.set([c.x, mappa.altura(c.x, c.z) + 0.04, c.z], i * 3); naz[i] = Math.max(0, COD.indexOf(c.reg)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('naz', new THREE.BufferAttribute(naz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { luce: { value: [0, 0, 0, 0] }, cor: { value: COD.map(k => new THREE.Color(NAZIONI[k].cor)) }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float naz; uniform float luce[4]; uniform vec3 cor[4]; uniform float escala;
      varying vec3 vCor; varying float vA;
      void main() {
        int k = int(naz + 0.5);
        float l = luce[k]; vCor = mix(vec3(1.0), cor[k], clamp(l * 1.4, 0.0, 1.0)); vA = l;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(2.2 * escala / -mv.z, 3.0, 9.0) * (1.0 + 0.5 * l);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0 || vA < 0.01) discard; gl_FragColor = vec4(vCor, vA * (1.0 - smoothstep(0.7, 1.0, d)));
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}

function casaNormal(casa) {
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa);
  const m = new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stileRegione(l.regione.cod, l.comune.sigla)), citta.mat);
  m.position.set(p.x, p.y + 0.0009, p.z); m.rotation.y = posLote(casa.lote).rot; m.scale.setScalar(LOTE);
  citta.grupo.add(m);
  return m;
}

function quadro(t) {
  const C = cena, dist = K.camera(t);
  citta.grupo.visible = dist < 32;

  // 25 dias: o número desce de 29 para 25
  if (K.pop($('#giorni'), t, 0, E.mappa - 0.05, { base: 'rotate(-3deg)' })) $('#giorni b').textContent = String(29 - Math.round(4 * suave(fase(t, 0.15, 0.85))));
  K.pop($('#data'), t, E.giorni + 0.1, E.mappa - 0.05, { base: 'rotate(2deg)' });
  K.pop($('#titolo'), t, E.mappa, E.eng - 0.05, { base: 'rotate(-3deg)' });
  const sm = $('#titolo small'), ss = t >= E.primi ? ressalto(fase(t, E.primi, 0.3)) : 0;
  sm.style.opacity = ss > 0 ? '1' : '0'; sm.style.transform = `scale(${Math.max(0.001, ss)})`;

  // as 4 nações acendem, cada uma com o seu cartão; voltam a pulsar no final
  const U = C.nazioni.material.uniforms;
  C.naz.forEach((nz, k) => {
    const s = fase(t, nz.t, 0.3) * (1 - fase(t, E.ora - 0.15, 0.15));
    const fim = t >= E.cta ? (0.6 + 0.3 * Math.sin((t - E.cta) * 5 + k)) * fase(t, E.cta, 0.4) : 0;
    U.luce.value[k] = Math.max(s * (1 + 0.3 * Math.exp(-(t - nz.t) / 0.25) * (t >= nz.t)), fim);
    K.presa(nz.el, t, K.projetar(nz.x, 0.5, nz.z), nz.t, E.ora - 0.05);
  });
  C.nazioni.visible = (t >= E.eng - 0.1 && t < E.ora) || t >= E.cta;

  // líderes: um corte por nação
  const iL = C.leader.findIndex(L => t >= L.t && t < L.fim);
  if (K.pop($('#leader'), t, E.ora, E.vicino - 0.05) && iL >= 0) {
    const L = C.leader[iL];
    if ($('#leader').dataset.i !== String(iL)) {
      $('#leader').dataset.i = String(iL);
      $('#leader .naz').textContent = `${NAZIONI[L.cod].emoji} Leading ${NOMI[L.cod]}`;
      $('#leader .chi').textContent = `👑 @${L.conta}`;
    }
    $('#leader .pts').textContent = `${num(rolar(t, L.t, 0.5, L.pts))} points`;
    $('#leader .pan').style.transform = `scale(${ressalto(fase(t, L.t, 0.25))})`;
  }

  // placar apertado; os pontos não param de subir
  if (K.pop($('#tabella'), t, E.vicino - 0.05, E.tag - 0.05)) C.righe.forEach((r, i) => {
    const extra = t >= E.mai ? Math.floor((t - E.mai) * (5 + i * 2)) : 0;
    r.pts.textContent = num(rolar(t, E.vicino + i * 0.1, 0.6, r.n) + extra);
  });

  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim);
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.entra - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    const piu = b.el.querySelector('.piu'), sp = t >= b.t + 0.3 ? ressalto(fase(t, b.t + 0.3, 0.3)) : 0;
    piu.style.opacity = sp > 0 ? '1' : '0'; piu.style.transform = `scale(${Math.max(0.001, sp)})`;
  });
  // amigo entrando: a casa nova surge
  const sN = t >= C.nova.t ? ressalto(fase(t, C.nova.t, 0.35)) : 0;
  C.nova.m.visible = sN > 0; C.nova.m.scale.set(LOTE, LOTE * Math.max(0.001, sN), LOTE);

  // você subindo no placar real (cada amigo que entra: +25)
  if (K.pop($('#scala'), t, E.piu - 0.05, E.cta - 0.05)) {
    // ordem depois de n passos (empate: você fica embaixo); posição interpolada entre o passo anterior e o atual
    const ordem = n => [...C.scala, { tu: true, conta: '@you', pts: C.tu0 + n * REGOLE.punti.recluta }].sort((a, b) => b.pts - a.pts || (a.tu ? 1 : b.tu ? -1 : 0));
    const n = C.passi.filter(x => t >= x).length, cur = ordem(n), prev = ordem(Math.max(0, n - 1));
    const mov = n ? suave(fase(t, C.passi[n - 1], 0.35)) : 1;
    cur.forEach((r, k) => {
      const kp = prev.findIndex(x => x.conta === r.conta), el = r.tu ? C.elTu : C.elScala[r.conta];
      el.style.transform = `translateY(${(kp + (k - kp) * mov) * 100}px)`;
      el.querySelector('.p').textContent = `#${k + 1}`;
      if (r.tu) el.querySelector('.n').textContent = num(rolar(t, C.passi[n - 1] ?? 0, 0.3, r.pts, prev.find(x => x.tu).pts));
    });
  }
  K.banner(t, [E.cta, E.cta + 0.45], R.banner);
  $('#scuro').style.opacity = String(0.3 * fase(t, E.ora - 0.1, 0.2) * (1 - fase(t, E.ora + 0.1, 0.2)) + 0.4 * fase(t, E.tag - 0.15, 0.25) * (1 - fase(t, E.entra - 0.1, 0.2)) + 0.25 * fase(t, E.cta - 0.1, 0.25));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'boom', { vol: 0.6 }); add(0.02, 'stamp');
  for (let k = 1; k <= 4; k++) add(0.15 + 0.85 * (k / 4) ** 0.6, 'tick', { vol: 0.6, tono: 0.9 + k * 0.08 });
  add(E.giorni, 'campana', { vol: 0.6 }); add(E.giorni + 0.1, 'pop', { tono: 1.1 });
  add(E.mappa - 0.1, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.mappa, 'stamp'); add(E.primi, 'ding', { tono: 1.2 }); add(E.ministri, 'campana', { tono: 0.9, vol: 0.6 });
  C.naz.forEach((nz, k) => { add(nz.t, 'pop', { tono: 0.9 + k * 0.12 }); add(nz.t + 0.02, 'ding', { tono: 1 + k * 0.1, vol: 0.55 }); });
  add(E.ora - 0.25, 'silenzio', { dur: 0.23 });
  C.leader.forEach((L, k) => { add(L.t - 0.08, 'whoosh', { dur: 0.2, vol: 0.5 }); add(L.t, 'select', { tono: 1 + k * 0.1 }); add(L.t + 0.05, 'coin', { vol: 0.5 }); });
  add(E.vicino - 0.1, 'whoosh', { dur: 0.25, vol: 0.55 }); add(E.vicino + 0.1, 'stamp'); add(E.punti, 'rullo', { dur: E.tag - E.punti - 0.1, vol: 0.4 });
  add(E.tag - 0.12, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 });
  C.bolle.forEach((b, i) => { add(b.t, 'bolla', { tono: 1 + i * 0.08, vol: 0.65 }); add(b.t + 0.3, 'coin', { vol: 0.5 }); });
  add(E.entra - 0.1, 'whoosh', { dur: 0.25, vol: 0.5 }); add(C.nova.t, 'pop', { tono: 1.1 }); add(C.nova.t + 0.12, 'coin', { vol: 0.6 });
  add(E.venticinque, 'coin', { vol: 0.8 }); add(E.venticinque + 0.04, 'scintilla', { vol: 0.6 });
  add(E.piu - 0.12, 'whoosh', { dur: 0.3, vol: 0.5 });
  C.passi.forEach((x, k) => { add(x, 'select', { tono: 1 + k * 0.15 }); add(x + 0.05, 'coin', { vol: 0.5 }); });
  add(E.top, 'ding', { tono: 1.3 });
  add(E.cta - 0.25, 'silenzio', { dur: 0.23 }); add(E.cta, 'boom', { vol: 0.45 }); add(E.cta + 0.03, 'ding', { tono: 1.2 }); add(E.cta + 0.45, 'pop', { tono: 1.1 });
  add(E.corsa, 'campana', { vol: 0.5 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.3 });
  return S.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const C = cena, dP = mappa.distPais();
  C.nazioni = criarNazioni();
  const centro = cod => { const cs = D.comuni.filter(c => c.reg === cod); return { x: cs.reduce((s, c) => s + c.x, 0) / cs.length, z: cs.reduce((s, c) => s + c.z, 0) / cs.length }; };
  // (England mais a leste e ao norte, para não cobrir o cartão de Wales)
  const bigENG = D.luoghi.filter(l => l.regione.cod === 'ENG').sort((a, b) => b.case - a.case)[0];
  const posNaz = cod => cod === 'ENG' ? { x: bigENG.x, z: centro('ENG').z - 0.35 * (centro('ENG').z - centro('SCT').z) } : centro(cod);
  C.naz = [['ENG', E.eng], ['SCT', E.sct], ['WLS', E.wls], ['NIR', E.nir]].map(([cod, t]) => ({ ...posNaz(cod), t, el: K.cartao(`${NAZIONI[cod].emoji} ${NOMI[cod]}`, '🏛️ 1 FIRST MINISTER', 'oro') }));
  // líderes reais
  const ge = D.snap.gran_elezione?.nazioni ?? {};
  const slot = (E.vicino - 0.1 - E.ora) / 4;
  C.leader = COD.map((cod, k) => { const top = ge[cod]?.[0]; return { cod, conta: top?.conta ?? '…', pts: top?.pts ?? 0, casa: D.porConta.get(top?.conta), t: E.ora + k * slot, fim: E.ora + (k + 1) * slot }; });
  C.righe = COD.map(cod => {
    const [a, b] = ge[cod] ?? [], el = document.createElement('div'), gap = (a?.pts ?? 0) - (b?.pts ?? 0);
    el.className = 'riga';
    el.innerHTML = `<div class="naz">${NAZIONI[cod].emoji}</div><div class="chi">@${esc(a?.conta ?? '…')}<small>${NOMI[cod]}</small></div><div class="pts"></div><div class="gap">${b ? `+${num(gap)}` : ''}</div>`;
    $('#righe').appendChild(el);
    return { n: a?.pts ?? 0, gap, el, pts: el.querySelector('.pts') };
  });
  const stretta = C.righe.reduce((m, r) => (r.gap < m.gap ? r : m), C.righe[0]);
  stretta.el.classList.add('stretta');
  // placar real da Northern Ireland (o mais apertado): "você" entra no fim e sobe +25 a cada amigo
  const nir = (ge.NIR ?? []).slice(0, 5);
  C.scala = nir.map(x => ({ conta: x.conta, pts: x.pts }));
  // 4 amigos (+100): você começa abaixo do último e termina em 2º, logo atrás do 1º ("almost the top")
  C.passi = [E.piu + 0.15, E.mates + 0.3, E.vicino2, E.top - 0.05];
  const p1 = nir[0]?.pts ?? 200, p2 = nir[1]?.pts ?? 150, salto = C.passi.length * REGOLE.punti.recluta;
  C.tu0 = Math.max(0, Math.min((nir.at(-1)?.pts ?? 50) - 15, Math.floor((p1 + p2) / 2) - salto));
  const lista = $('#scala .lista');
  C.elScala = {};
  for (const r of C.scala) { const el = document.createElement('div'); el.className = 'r'; el.innerHTML = `<span class="p"></span><span class="c">@${esc(r.conta)}</span><span class="n">${num(r.pts)}</span>`; lista.appendChild(el); C.elScala[r.conta] = el; }
  C.elTu = document.createElement('div'); C.elTu.className = 'r tu'; C.elTu.innerHTML = '<span class="p"></span><span class="c">🙋 YOU</span><span class="n"></span>'; lista.appendChild(C.elTu);
  // amigo que entra: cidade de verdade em England, a casa mais nova surge; a casa antiga de lá é a "sua"
  const tw = D.luoghi.filter(l => l.regione.cod === 'ENG' && l.case >= 30 && l.case <= 60).sort((a, b) => a.fondatore_ts - b.fondatore_ts)[3];
  const casas = tw.casas.map(i => D.casas[i]).sort((a, b) => a.lote - b.lote);
  const nova = casas.filter(c => c.livello <= 3).at(-1), sua = casas.find(c => c.livello >= 1 && c.livello <= 5 && c !== nova) ?? casas[0];
  citta.nascoste.add(nova.conta); citta.cache.delete(tw.id); citta.ultimo = null;
  C.nova = { casa: nova, m: casaNormal(nova), t: E.entra + 0.1 };
  const topo = (c, h = ALTURA_NIVEL[c.livello]) => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + h * LOTE * 1.05 + 0.002, p.z); };
  C.cartoes = [
    { el: K.cartao('🎉 New mate', 'JUST JOINED THE MAP', 'verde'), p: topo(nova), ini: C.nova.t + 0.2, fim: E.piu - 0.05 },
    { el: K.cartao(`+${REGOLE.punti.recluta} for you`, '25 MORE POINTS', 'oro'), p: topo(sua), ini: E.venticinque, fim: E.piu - 0.05 },
  ];
  C.timbri = [
    K.timbro('⚔️ It\'s close!', '#E0473C', 1120, E.vicino + 0.1, E.tag - 0.05, -3, 84),
    K.timbro('🏆 Almost the top!', '#2FB36A', 1120, E.top, E.cta - 0.05, 3, 76),
  ];
  const tags = [['<span class="t">@your_mate</span> join the race 🏛️', '#FFC93C'], ['<span class="t">@your_cousin</span> get on the map', '#9FD3E6'], ['<span class="t">@your_flatmate</span> comment your town!', '#F2B8C6']];
  const pos = [[60, 620, -3], [210, 790, 2], [60, 960, -2]];
  C.bolle = tags.map(([html, cor], i) => ({ el: K.bolla(html, cor, `+${REGOLE.punti.tag}`), t: E.tag + 0.1 + i * 0.25, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  C.impatti = [[0, 0.8], [E.giorni, 0.5], [E.mappa, 0.5], [E.vicino, 0.4], [E.venticinque, 0.5], [E.cta, 0.5]];
  C.flash = [[0, 0.8], [E.mappa, 0.4], [E.ora, 0.4], ...C.leader.slice(1).map(L => [L.t, 0.25]), [E.vicino, 0.3], [E.entra, 0.4], [E.piu, 0.3], [E.cta, 0.3]];
  // câmera: país; corte em cada líder; país; cidade do amigo; país
  const lead = C.leader.filter(L => L.casa).map(L => [L.t, K.casa(citta, L.casa, { dist: 0.5, az: 0.3, el: 22, cut: true })]);
  const leadDer = C.leader.filter(L => L.casa).map(L => [L.fim - 0.03, K.deriva(0.42, 0.18)]);
  K.chaves([
    [0, K.uk({ dist: dP * 1.1, az: -0.06 })],
    [E.mappa, K.uk({ dist: dP * 1.0, az: 0.02 })],
    [E.ora - 0.05, K.uk({ dist: dP * 0.95, az: 0.05 })],
    ...lead, ...leadDer,
    [E.vicino - 0.05, K.uk({ dist: dP * 1.02, az: -0.03, cut: true })],
    [E.tag - 0.05, K.uk({ dist: dP * 0.98, az: 0.02 })],
    [E.entra - 0.05, K.uk({ dist: dP * 0.96, az: 0.03 })],
    [E.entra, K.casa(citta, nova, { dist: 0.62, az: 0.35, el: 30, cut: true })],
    [E.piu - 0.05, K.deriva(0.52, 0.25)],
    [E.piu, K.uk({ dist: dP * 1.02, az: -0.02, cut: true })],
    [E.cta, K.uk({ dist: dP * 1.0, az: 0.02 })],
    [R.durata, K.uk({ dist: dP * 1.06, az: 0.05 })],
  ]);
  K.capa();
  console.log(`líderes ${C.leader.map(L => `${L.cod} @${L.conta} ${L.pts}${L.casa ? '' : ' (sem casa!)'}`).join(' · ')} · amigo em ${tw.nome} · NIR ${C.scala.map(r => r.pts).join('/')} você ${C.tu0}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
