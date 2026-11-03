// Reel 7 "Gifts are taking over the map" com dados reais (03/11): as casas decoradas pipocando no mapa, à noite;
// o castelo que @finleyedwards763 deu para @noahmullen ganhando os efeitos um a um (fogos, UFO, arco-íris, neve, todos);
// o farol de @gunwharfgoonette em Portsmouth; "who's getting one from you?", comentários com +3 e a loja.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { aspetto, geometriaCasa, stileRegione } from '../js/modelli.js';
import { altezzaSpeciale } from '../js/speciali.js';
import { costruisci } from '../js/decori.js';
import { REGOLE } from '../js/regole.js';
import { kit, $, ressalto, suave, fase, esc } from './kit.js';

let D, mappa, citta, R, E, cena, K;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// a casa normal (antes do presente) e as versões decoradas, desenhadas fora do InstancedMesh da cidade
function casaNormal(casa) {
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa);
  const m = new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stileRegione(l.regione.cod, l.comune.sigla)), citta.mat);
  m.position.set(p.x, p.y + 0.0009, p.z); m.rotation.y = posLote(casa.lote).rot; m.scale.setScalar(LOTE);
  citta.grupo.add(m);
  return m;
}
function decorata(casa, modello, extra) {
  const o = costruisci(D, citta, () => true, casa, { squadra: null, modello, extra: new Set(extra) });
  o.g.visible = false; citta.grupo.add(o.g);
  return o;
}
function scambio(el, t, ini, meio, fim) {
  el.style.opacity = t >= ini && t < fim ? '1' : '0';
  [[el.children[0], ini, -3], [el.children[1], meio - 0.25, 0], [el.children[2], meio, 3]].forEach(([e, ti, r]) => {
    const s = t >= ti && t < fim ? ressalto(fase(t, ti, 0.3)) * (1 - suave(fase(t, fim - 0.2, 0.2))) : 0;
    e.style.opacity = s > 0 ? '1' : '0';
    e.style.transform = `scale(${Math.max(0.001, s)}) rotate(${r + (e.classList.contains('dono') ? Math.sin(t * 9) * 8 : 0)}deg)`;
  });
}

function quadro(t) {
  const dist = K.camera(t), C = cena, ms = t * 1000;
  citta.grupo.visible = dist < 32;

  // alfinetes das casas decoradas no mapa do país
  C.spilli.forEach((s, k) => {
    const p = K.projetar(s.x, s.y + 0.02, s.z), ti = 0.15 + k * 0.17, vis = t >= ti && t < E.finley - 0.05 && p.ok;
    s.el.style.opacity = vis ? '1' : '0';
    if (vis) s.el.style.transform = `translate(${p.x - 32}px, ${p.y - 70}px) scale(${ressalto(fase(t, ti, 0.3)) * (1 + 0.08 * Math.sin(t * 6 + k))})`;
  });

  // Noah: casa normal -> castelo -> os efeitos chegando um a um
  const passos = [E.castello, E.fuochi, E.ufo, E.arcobaleno, E.neve, E.tutto];
  const k = passos.filter(x => t >= x).length - 1;
  C.noah.normale.visible = k < 0;
  C.noah.fasi.forEach((o, i) => {
    o.g.visible = i === k;
    if (o.g.visible) { o.anima(ms); o.g.scale.setScalar(LOTE * (1 + 0.15 * Math.exp(-Math.max(0, t - passos[i]) / 0.12))); }
  });
  // Gunwharf: casa normal -> farol com tudo
  C.gun.normale.visible = t < E.faro;
  C.gun.faro.g.visible = t >= E.faro;
  if (t >= E.faro) { C.gun.faro.anima(ms); C.gun.faro.g.scale.setScalar(LOTE * (1 + 0.15 * Math.exp(-Math.max(0, t - E.faro) / 0.12))); }

  scambio($('#sc-noah'), t, E.finley, E.noah, E.portsmouth - 0.1);
  scambio($('#sc-gun'), t, E.portsmouth + 0.2, E.faro - 0.6, E.faro + 0.25);   // dá lugar ao cartão do farol
  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim, c.extra ? c.extra(t) : 1);

  K.pop($('#domanda'), t, E.chi, E.regalo - 0.05, { base: 'rotate(-3deg)' });
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.regalo - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    const piu = b.el.querySelector('.piu'), sp = t >= b.tp ? ressalto(fase(t, b.tp, 0.3)) : 0;
    piu.style.opacity = sp > 0 ? '1' : '0';
    piu.style.transform = `scale(${sp}) rotate(8deg)`;
  });
  // a loja: o dedo toca "Send a mate a gift" e depois "My house"
  const pan = $('#negozio');
  if (K.pop(pan, t, E.regalo - 0.1, Infinity, { base: `translateY(${(1 - suave(fase(t, E.regalo - 0.1, 0.3))) * 160}px)` })) {
    $('#bt-regalo').classList.toggle('on', t >= E.regalo + 0.35 && t < E.decora);
    $('#bt-mia').classList.toggle('on', t >= E.decora + 0.35);
  }
  const dito = $('#dito');
  if (t >= E.regalo + 0.05) {
    const alvo = (t < E.decora ? $('#bt-regalo') : $('#bt-mia')).getBoundingClientRect(), anterior = $('#bt-regalo').getBoundingClientRect();
    const mov = t < E.decora ? fase(t, E.regalo + 0.05, 0.3) : fase(t, E.decora, 0.3), de = t < E.decora ? { left: 900, top: 1500, width: 0, height: 0 } : anterior;
    const x = de.left + de.width * 0.75 + (alvo.left + alvo.width * 0.75 - de.left - de.width * 0.75) * suave(mov), y = de.top + de.height * 0.5 + (alvo.top + alvo.height * 0.5 - de.top - de.height * 0.5) * suave(mov);
    dito.style.opacity = '1';
    const toque = (t >= E.regalo + 0.35 && t < E.regalo + 0.47) || (t >= E.decora + 0.35 && t < E.decora + 0.47);
    dito.style.transform = `translate(${x - 30}px, ${y}px) scale(${toque ? 0.85 : 1})`;
  } else dito.style.opacity = '0';

  $('#scuro').style.opacity = String(0.5 * fase(t, E.chi - 0.1, 0.3) * (1 - 0.4 * fase(t, E.regalo, 0.3)));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'campana', { tono: 1.4, vol: 0.5 });
  C.spilli.forEach((_, k) => add(0.15 + k * 0.17, 'pop', { tono: 0.9 + k * 0.08, vol: 0.55 }));
  add(0.5, 'stamp', { vol: 0.7 });
  add(E.finley - 0.4, 'whoosh', { dur: 0.45, giu: true, vol: 0.7 });
  add(E.finley, 'pop'); add(E.noah - 0.25, 'bolla', { tono: 1.4, vol: 0.6 }); add(E.noah, 'pop', { tono: 1.2 });
  add(E.castello - 0.25, 'silenzio', { dur: 0.23 }); add(E.castello, 'boom', { vol: 0.8 }); add(E.castello + 0.03, 'campana', { vol: 0.6 }); add(E.castello + 0.05, 'scintilla');
  add(E.effetti, 'riser', { dur: E.fuochi - E.effetti, vol: 0.5 });
  add(E.fuochi, 'fuoco', { vol: 0.8 }); add(E.fuochi + 0.05, 'stamp', { vol: 0.6 });
  add(E.ufo, 'notifica', { tono: 0.7, vol: 0.6 }); add(E.ufo + 0.05, 'stamp', { vol: 0.6 });
  add(E.arcobaleno, 'scintilla', { vol: 0.8 }); add(E.arcobaleno + 0.05, 'stamp', { vol: 0.6 });
  add(E.neve, 'vento', { dur: 0.6, vol: 0.5 }); add(E.neve + 0.05, 'stamp', { vol: 0.6 });
  add(E.tutto - 0.2, 'silenzio', { dur: 0.18 }); add(E.tutto, 'boom', { vol: 0.9 }); add(E.tutto + 0.03, 'fuoco', { vol: 0.6 }); add(E.tutto + 0.05, 'campana', { vol: 0.6 });
  add(E.portsmouth - 0.35, 'whoosh', { dur: 0.4, vol: 0.7 }); add(E.portsmouth + 0.2, 'pop');
  add(E.faro - 0.3, 'riser', { dur: 0.28, vol: 0.6 }); add(E.faro, 'boom', { vol: 0.8 }); add(E.faro + 0.03, 'scintilla'); add(E.faro + 0.05, 'campana', { tono: 1.2, vol: 0.5 });
  add(E.chi - 0.3, 'silenzio', { dur: 0.28 }); add(E.chi, 'stamp'); add(E.chi + 0.03, 'bolla', { tono: 1.3, vol: 0.6 });
  C.bolle.forEach((b, i) => { add(b.t, 'bolla', { tono: 1 + i * 0.1, vol: 0.7 }); add(b.tp, 'coin', { vol: 0.55 }); });
  add(E.regalo - 0.15, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.regalo + 0.35, 'tap', { vol: 0.7 }); add(E.regalo + 0.4, 'scintilla', { vol: 0.5 });
  add(E.decora + 0.35, 'tap', { vol: 0.7 }); add(E.decora + 0.4, 'ding', { tono: 1.3 });
  add(E.mappa, 'pop', { tono: 1.1 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.3 });
  return S.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  mappa.definirNotte(true);
  citta = new Citta(mappa, D);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const C = cena;
  const [rn, rg] = R.regali, noah = D.porConta.get(rn.conta), gun = D.porConta.get(rg.conta);
  for (const c of [noah, gun]) { citta.nascoste.add(c.conta); citta.speciali.add(c.conta); citta.cache.delete(D.luoghi[c.luogo].id); }
  citta.ultimo = null;
  const ef = R.noah_effetti, passi = [[], ['fuochi'], ['fuochi', 'ufo'], ['fuochi', 'ufo', 'arcobaleno'], ['fuochi', 'ufo', 'arcobaleno', 'neve'], ef];
  C.noah = { casa: noah, normale: casaNormal(noah), fasi: passi.map(x => decorata(noah, 'castello', x)) };
  C.gun = { casa: gun, normale: casaNormal(gun), faro: decorata(gun, 'faro', R.gun_effetti) };
  // alfinetes: onde estão as casas decoradas
  C.spilli = R.decorate.map(([conta, em]) => {
    const c = D.porConta.get(conta); if (!c) return null;
    const l = D.luoghi[c.luogo], el = document.createElement('div');
    el.className = 'spillo'; el.textContent = em; $('#spilli').appendChild(el);
    return { el, x: l.x, z: l.z, y: mappa.altura(l.x, l.z) };
  }).filter(Boolean);
  $('#sc-noah').children[0].textContent = `@${rn.da}`; $('#sc-noah').children[2].textContent = `@${rn.conta}`;
  $('#sc-gun').children[0].textContent = `@${rg.da}`; $('#sc-gun').children[2].textContent = `@${rg.conta}`;
  const topo = (c, h) => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + h * LOTE + 0.004, p.z); };
  const hC = altezzaSpeciale('castello'), hF = altezzaSpeciale('faro');
  const lG = D.luoghi[gun.luogo];
  const posFM = (() => { const l = D.snap.gran_elezione?.nazioni?.ENG ?? []; const i = l.findIndex(x => x.conta === gun.conta); return i >= 0 ? `🏛️ ${['1ST', '2ND', '3RD', '4TH', '5TH'][i]} IN ENGLAND FOR FIRST MINISTER` : `${esc(lG.nome.toUpperCase())}`; })();
  C.cartoes = [
    { el: K.cartao(`🗼 @${esc(gun.conta)}`, posFM, 'oro'), p: topo(gun, hF + 2.2), ini: E.faro + 0.2, fim: E.chi },
  ];
  C.timbri = [
    K.timbro('🎁 Gifts everywhere', '#E0306E', 300, 0.5, E.finley - 0.05),
    K.timbro('✨ Every single effect', '#1E5AA8', 300, E.effetti, E.fuochi),
    K.timbro('🎆 Fireworks', '#E0473C', 300, E.fuochi, E.ufo, -4, 90),
    K.timbro('🛸 A UFO', '#2FB36A', 300, E.ufo, E.arcobaleno, 3, 90),
    K.timbro('🌈 A rainbow', '#7B2CBF', 300, E.arcobaleno, E.neve, -3, 90),
    K.timbro('❄️ Snow', '#1E5AA8', 300, E.neve, E.tutto, 3, 90),
    K.timbro('💥 The lot', '#E0306E', 300, E.tutto, E.portsmouth - 0.05, -4, 100),
    K.timbro('🗺️ ukhousebyhouse.com', '#152033', 1170, E.mappa - 0.1, Infinity, 0, 64),
  ];
  const tags = [['Gift for <span class="t">@your_mate</span> 🎁', '#FFC93C'], ['<span class="t">@your_bestie</span> needs a castle 🏰', '#9FD3E6'],
    ['Lighthouse for <span class="t">@your_brother</span> 🗼', '#F2B8C6'], ['<span class="t">@your_nan</span> gets the teapot ☕', '#A8E0C2']];
  const pos = [[60, 760, -3], [220, 910, 2], [60, 1060, -2], [240, 1210, 3]];
  C.bolle = tags.map(([html, cor], i) => ({ el: K.bolla(html, cor, `+${REGOLE.punti.tag}`), t: E.tag + i * 0.22, tp: E.punti + 0.15 + i * 0.3, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  C.impatti = [[E.castello, 1.1], [E.fuochi, 0.5], [E.ufo, 0.4], [E.arcobaleno, 0.4], [E.neve, 0.4], [E.tutto, 1.0], [E.faro, 1.0], [E.chi, 0.4], [E.decora + 0.35, 0.3]];
  C.flash = [[0.5, 0.3], [E.finley, 0.5], [E.castello, 1], [E.fuochi, 0.5], [E.ufo, 0.5], [E.arcobaleno, 0.6], [E.neve, 0.5], [E.tutto, 0.9], [E.portsmouth, 0.5], [E.faro, 1], [E.chi, 0.3], [E.regalo, 0.3]];
  // câmera
  const casaN = o => K.casa(citta, noah, o, hC), casaG = o => K.casa(citta, gun, o, hF);
  const pN = citta.posCasa(noah);
  K.chaves([
    [0, K.uk({ dist: mappa.distPais() * 1.12, az: -0.08 })],
    [E.finley - 0.45, K.uk({ dist: mappa.distPais() * 0.98, az: 0.02 })],
    [E.finley - 0.05, { x: pN.x, z: pN.z, dist: 2.2, az: posLote(noah.lote).rot + 0.5, el: null, giu: 0, dy: 0 }],
    [E.finley, casaN({ dist: 0.5, az: 0.5, el: 26, cut: true })],
    [E.castello - 0.02, K.deriva(0.45, 0.1)],
    [E.castello, casaN({ dist: 0.3, az: 0.25, el: 16, dy: hC * LOTE * 0.55, cut: true })],
    [E.fuochi - 0.02, K.deriva(0.28, 0.15)],
    [E.fuochi, casaN({ dist: 0.42, az: -0.3, el: 12, dy: hC * LOTE * 1.7, cut: true })],
    [E.ufo, casaN({ dist: 0.38, az: 0.4, el: 14, dy: hC * LOTE * 1.6, cut: true })],
    [E.arcobaleno, casaN({ dist: 0.42, az: -0.15, el: 10, dy: hC * LOTE * 1.1, cut: true })],
    [E.neve, casaN({ dist: 0.34, az: 0.3, el: 16, dy: hC * LOTE * 1.0, cut: true })],
    [E.tutto, casaN({ dist: 0.5, az: -0.4, el: 14, dy: hC * LOTE * 1.5, cut: true })],
    [E.portsmouth - 0.02, K.deriva(0.46, 0.25)],
    [E.portsmouth, casaG({ dist: 0.36, az: 0.45, el: 22, cut: true })],
    [E.faro - 0.02, K.deriva(0.32, 0.15)],
    [E.faro, casaG({ dist: 0.46, az: -0.2, el: 12, dy: hF * LOTE * 1.1, cut: true })],
    [E.chi - 0.02, K.deriva(0.42, -0.25)],
    [E.chi, K.uk({ dist: mappa.distPais() * 1.05, az: -0.04, cut: true })],
    [E.regalo - 0.02, K.uk({ dist: mappa.distPais() * 1.0, az: 0 })],
    [E.regalo, casaN({ dist: 0.75, az: 0.6, el: 22, dy: hC * LOTE * 1.2, su: 0, cut: true })],
    [R.durata, casaN({ dist: 0.7, az: 1.1, el: 22, dy: hC * LOTE * 1.2 })],
  ]);
  K.capa();
  console.log(`noah ${D.luoghi[noah.luogo].nome} · gun ${D.luoghi[gun.luogo].nome} · alfinetes ${C.spilli.length}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
