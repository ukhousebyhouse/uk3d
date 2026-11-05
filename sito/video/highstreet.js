// Reel 12 "The High Street is open" (05/11): numa cidade de verdade (plano village), a loja da High Street aparece
// uma a uma: chippy com o peixe gigante, pub com a pint, café com a cuppa; o outdoor da praça ("YOUR AD HERE"),
// "comment your town" com uma casa nova, marcar os comércios (+3), só 6 lojas por village (enchendo até FULL) e "like this".
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { aspetto, geometriaCasa, stileRegione, STILE_BASE } from '../js/modelli.js';
import { creaNegozio3D } from '../js/negozio3d.js';
import { REGOLE, num } from '../js/regole.js';
import { kit, $, ressalto, fase, esc } from './kit.js';

let D, mappa, citta, R, E, cena, K;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

function casaNormal(casa) {
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa);
  const m = new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stileRegione(l.regione.cod, l.comune.sigla)), citta.mat);
  m.position.set(p.x, p.y + 0.0009, p.z); m.rotation.y = posLote(casa.lote).rot; m.scale.setScalar(LOTE);
  citta.grupo.add(m);
  return m;
}
// loja no lugar de uma casa (escondida): cresce com ressalto em t
function loja(casa, cm, t) {
  const p = citta.posCasa(casa), g = creaNegozio3D(cm, { material: citta.mat });
  g.position.set(p.x, p.y + 0.0009, p.z); g.rotation.y = posLote(casa.lote).rot; g.scale.setScalar(LOTE);
  citta.grupo.add(g);
  return { g, t, casa };
}
const cresce = (o, t) => { const s = t >= o.t ? ressalto(fase(t, o.t, 0.4)) : 0; o.g.visible = s > 0; o.g.scale.set(LOTE, LOTE * Math.max(0.001, s), LOTE); };

function quadro(t) {
  const C = cena, dist = K.camera(t);
  citta.grupo.visible = dist < 32;
  K.pop($('#insegna'), t, E.open - 0.15, E.chippy - 0.05, { base: 'rotate(-2deg)' });
  C.lojas.forEach(o => cresce(o, t));
  const sN = t >= C.nova.t ? ressalto(fase(t, C.nova.t, 0.35)) : 0;
  C.nova.m.visible = sN > 0; C.nova.m.scale.set(LOTE, LOTE * Math.max(0.001, sN), LOTE);
  // só 6 lojas: os espaços enchem um por um
  if (K.pop($('#posti'), t, E.solo - 0.05, E.like - 0.05)) C.slot.forEach(s => {
    const on = t >= s.t, k = on ? ressalto(fase(t, s.t, 0.3)) : 0;
    s.el.classList.toggle('on', on); s.i.style.opacity = on ? '1' : '0'; s.i.style.transform = `scale(${Math.max(0.001, k)})`;
  });
  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim);
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.solo - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    const piu = b.el.querySelector('.piu');
    if (piu) { const sp = t >= b.t + 0.3 ? ressalto(fase(t, b.t + 0.3, 0.3)) : 0; piu.style.opacity = sp > 0 ? '1' : '0'; piu.style.transform = `scale(${Math.max(0.001, sp)})`; }
  });
  K.banner(t, [E.comment, E.comment + 0.4], R.banner, E.tag - 0.05);
  $('#scuro').style.opacity = String(0.3 * fase(t, E.tag - 0.1, 0.2) * (1 - fase(t, E.like - 0.1, 0.2)) + 0.2 * fase(t, E.comment - 0.1, 0.2) * (1 - fase(t, E.tag - 0.1, 0.1)));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'campana', { vol: 0.6 }); add(0.05, 'whoosh', { dur: 0.4, vol: 0.5 });
  add(E.open - 0.15, 'stamp'); add(E.open - 0.12, 'campana', { tono: 1.3, vol: 0.6 });
  add(E.next - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 });
  C.lojas.forEach((o, i) => { add(o.t - 0.12, 'whoosh', { dur: 0.25, vol: 0.5 }); add(o.t, 'pop', { tono: 1 + i * 0.1 }); add(o.t + 0.05, 'campana', { tono: 1.2 + i * 0.1, vol: 0.5 }); });
  add(E.fish, 'scintilla', { vol: 0.6 }); add(E.pint, 'ding', { tono: 1.1 }); add(E.cuppa, 'ding', { tono: 1.25 });
  add(E.billboard - 0.15, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.billboard, 'boom', { vol: 0.5 }); add(E.billboard + 0.03, 'stamp'); add(E.square, 'campana', { vol: 0.5 });
  add(E.non - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 }); add(E.non, 'notifica', { tono: 1.1 });
  add(E.comment - 0.2, 'silenzio', { dur: 0.18 }); add(E.comment, 'boom', { vol: 0.45 }); add(E.comment + 0.03, 'ding', { tono: 1.2 }); add(E.comment + 0.4, 'pop', { tono: 1.1 });
  add(C.nova.t, 'pop', { tono: 1.1 }); add(C.nova.t + 0.12, 'coin', { vol: 0.6 });
  add(E.tag - 0.12, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 });
  C.bolle.forEach((b, i) => { add(b.t, 'bolla', { tono: 1 + i * 0.08, vol: 0.65 }); add(b.t + 0.3, 'coin', { vol: 0.45 }); });
  add(E.solo - 0.12, 'whoosh', { dur: 0.3, vol: 0.55 });
  C.slot.forEach((s, i) => add(s.t, 'select', { tono: 1 + i * 0.1 }));
  add(E.full2, 'stamp'); add(E.full2 + 0.03, 'errore', { vol: 0.4 });
  add(E.like - 0.1, 'whoosh', { dur: 0.25, vol: 0.5 }); add(E.like, 'stamp'); add(E.like + 0.03, 'ding', { tono: 1.3 });
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
  // cidade de verdade no plano village (população < 30 000), com o outdoor da praça
  const tw = D.luoghi.filter(l => l.regione.cod === 'ENG' && l.case >= 18 && (l.comune.pop ?? 0) > 0 && l.comune.pop < 30000)
    .sort((a, b) => b.case - a.case)[0];
  const casas = tw.casas.map(i => D.casas[i]).sort((a, b) => a.lote - b.lote);
  // a fileira da frente do 1º quarteirão de casas (lotes 4-6, de frente para a câmera) vira a High Street
  const doLote = n => casas.find(c => c.lote === n) ?? casas[n];
  const sedi = [doLote(4), doLote(5), doLote(6)];
  const nova = casas.filter(c => !sedi.includes(c)).at(-1);
  for (const c of [...sedi, nova]) citta.nascoste.add(c.conta), citta.speciali.add(c.conta);
  citta.cache.delete(tw.id); citta.ultimo = null;
  const st = o => ({ ...STILE_BASE, ...o });
  C.lojas = [
    loja(sedi[0], { nome: 'The Golden Fry', colore: '#1F6FB5', logo: '', stile: st({ coloreTenda: '#1F6FB5', facciata: '#FFFFFF', oggetto: 'pesce', scala: 1.15, ornamenti: ['luci'] }) }, E.chippy),
    loja(sedi[1], { nome: 'The Red Lion', colore: '#C8102E', logo: '', stile: st({ tenda: 'nessuna', facciata: '#2E5E3A', porta: '#22252B', oggetto: 'pinta', scala: 1.15, insegna: 'bandiera', piani: 2, ornamenti: ['vasi', 'dehors'] }) }, E.pub),
    loja(sedi[2], { nome: 'Cuppa Corner', colore: '#D94F8A', logo: '', stile: st({ coloreTenda: '#D94F8A', facciata: '#F3E2C2', oggetto: 'tazza', scala: 1.15, ornamenti: ['dehors', 'bandierine'] }) }, E.cafe),
  ];
  C.nova = { casa: nova, m: casaNormal(nova), t: E.casa };
  // o outdoor da praça (o 1º ponto, à venda: "YOUR AD HERE")
  const dc = citta.dadosCidade(tw), bb = dc.alvos.find(a => a.tipo === 'pubblicita' && a.posto === 0);
  // só 6 lojas: espaços enchendo
  const ems = ['🐟', '🍺', '☕', '💈', '💐', '🏋️'], gr = $('#posti .griglia'), passo = (E.full1 - E.solo - 0.25) / 6;
  C.slot = ems.map((em, i) => { const el = document.createElement('div'); el.className = 'slot'; el.innerHTML = `<i>${em}</i>`; gr.appendChild(el); return { el, i: el.querySelector('i'), t: E.solo + 0.2 + i * passo }; });
  const topo = (c, h = 1.25) => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + h * LOTE + 0.002, p.z); };
  C.cartoes = [
    { el: K.cartao(`📍 ${esc(tw.nome)}`, 'COULD BE YOUR TOWN', 'rosa'), p: () => K.projetar(tw.x, mappa.altura(tw.x, tw.z) + 0.2, tw.z), ini: E.next, fim: E.chippy - 0.05 },
    { el: K.cartao('🐟 The chippy', 'GIANT FISH SUPPER', 'oro'), p: topo(sedi[0], 1.6), ini: E.fish, fim: E.pub - 0.05 },
    { el: K.cartao('🍺 The pub', 'GIANT PINT', 'oro'), p: topo(sedi[1], 2.0), ini: E.pint, fim: E.cafe - 0.05 },
    { el: K.cartao('☕ The café', 'A CUPPA ON TOP', 'oro'), p: topo(sedi[2], 1.6), ini: E.cuppa, fim: E.billboard - 0.3 },
    { el: K.cartao('📣 Billboard', 'THE TOWN SQUARE', 'rosa'), p: () => K.projetar(bb.x, bb.y + 1.0 * LOTE, bb.z), ini: E.billboard + 0.1, fim: E.non - 0.05 },
    { el: K.cartao(`🏠 @${esc(nova.conta)}`, 'JUST JOINED · FREE', 'verde'), p: topo(nova, 0.9), ini: C.nova.t + 0.2, fim: E.tag - 0.05 },
  ];
  C.timbri = [
    K.timbro('🛍️ New', '#E0306E', 300, E.high, E.open - 0.15, -4, 96),
    K.timbro('🚫 When it\'s full, it\'s full', '#E0473C', 1120, E.full2, E.like - 0.05, -3, 66),
    K.timbro('❤️ Like this', '#E0306E', 1120, E.like, Infinity, 3, 100),
  ];
  const tags = [['<span class="t">@your_local_chippy</span> get on the map 🐟', '#FFC93C'], ['<span class="t">@the_red_lion</span> you need this 🍺', '#9FD3E6'],
    ['<span class="t">@your_barber</span> a shop in 3D! 💈', '#F2B8C6']];
  const pos = [[50, 620, -3], [180, 790, 2], [60, 960, -2]];
  C.bolle = tags.map(([html, cor], i) => ({ el: K.bolla(html, cor, `+${REGOLE.punti.tag}`), t: E.tag + 0.1 + i * 0.25, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  C.impatti = [[E.open, 0.5], ...C.lojas.map(o => [o.t, 0.5]), [E.billboard, 0.7], [E.comment, 0.5], [E.full2, 0.5]];
  C.flash = [[0, 0.5], [E.open, 0.4], ...C.lojas.map(o => [o.t, 0.3]), [E.billboard, 0.5], [E.non, 0.3], [E.solo, 0.3], [E.like, 0.3]];
  // câmera: país; a cidade; cada loja; o outdoor; a cidade (casa nova); país
  const lojaCam = (c, o) => K.casa(citta, c, { dist: 0.42, az: 0.3, el: 18, ...o }, 1.3);
  K.chaves([
    [0, K.uk({ dist: dP * 1.1, az: -0.06 })],
    [E.next - 0.05, K.uk({ dist: dP * 0.95, az: 0.03 })],
    [E.next, { x: tw.x, z: tw.z, dist: 2.4, az: 0.45, el: 36, giu: 0, dy: 0, cut: true }],
    [E.chippy - 0.05, K.deriva(1.9, 0.15)],
    [E.chippy, lojaCam(sedi[0], { cut: true })],
    [E.pub - 0.05, K.deriva(0.36, 0.2)],
    [E.pub, lojaCam(sedi[1], { az: -0.25, el: 16, dist: 0.5, cut: true })],
    [E.cafe - 0.05, K.deriva(0.44, -0.15)],
    [E.cafe, lojaCam(sedi[2], { az: 0.45, cut: true })],
    [E.billboard - 0.3, K.deriva(0.38, 0.15)],
    [E.billboard - 0.25, { x: bb.x, z: bb.z, dist: 0.45, az: bb.rot + 0.25, el: 14, giu: 0, dy: 0.5 * LOTE, cut: true }],
    [E.non - 0.05, K.deriva(0.4, 0.15)],
    [E.non, { x: tw.x, z: tw.z, dist: 1.1, az: 0.5, el: 34, giu: 0, dy: 0, cut: true }],
    [E.casa - 0.3, K.deriva(0.95, 0.1)],
    [E.casa - 0.25, K.casa(citta, nova, { dist: 0.5, az: 0.35, el: 24, su: 380, cut: true })],
    [E.tag - 0.05, K.deriva(0.42, 0.2)],
    [E.tag, { x: tw.x, z: tw.z, dist: 1.3, az: 0.3, el: 38, giu: 0, dy: 0, su: 0, cut: true }],
    [E.like - 0.05, K.deriva(1.1, 0.25)],
    [E.like, { x: tw.x, z: tw.z, dist: 0.9, az: 0.65, el: 30, giu: 0, dy: 0, cut: true }],
    [R.durata, K.deriva(0.8, 0.25)],
  ]);
  K.capa();
  console.log(`cidade ${tw.nome} (${tw.case} casas, pop ${num(tw.comune.pop)}) · lojas nos lotes ${sedi.map(c => c.lote).join(',')} · casa nova @${nova.conta} · outdoor ${bb ? 'ok' : 'FALTA'}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
