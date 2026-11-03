// Reel 8 "New today: a challenge with a prize": o desafio Bring Your Mates (até a meia-noite), os amigos marcados,
// casas novas surgindo numa cidade de verdade com +25 para quem entra e +25 para quem trouxe, a casa rara de prêmio,
// a corrida pelo First Minister (líderes reais de cada nação) e a contagem no mapa.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL, aspetto, geometriaCasa, stileRegione } from '../js/modelli.js';
import { SPECIALI, costruisciSpeciale } from '../js/speciali.js';
import { REGOLE, num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';
import { kit, $, ressalto, suave, fase, esc, rolar } from './kit.js';

let D, mappa, citta, R, E, cena, K;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

const matVC = new THREE.MeshLambertMaterial({ vertexColors: true });
function naCasa(casa, obj) {
  const p = citta.posCasa(casa);
  obj.position.set(p.x, p.y + 0.0009, p.z); obj.rotation.y = posLote(casa.lote).rot; obj.scale.setScalar(LOTE);
  citta.grupo.add(obj);
  return obj;
}
function casaNormal(casa) {
  const l = D.luoghi[casa.luogo];
  return naCasa(casa, new THREE.Mesh(geometriaCasa(casa.livello, aspetto(casa.conta, casa.livello).v, stileRegione(l.regione.cod, l.comune.sigla)), citta.mat));
}

function quadro(t) {
  const dist = K.camera(t), C = cena, ms = t * 1000;
  citta.grupo.visible = dist < 32;

  K.pop($('#titolo'), t, E.sfida, E.mezzanotte - 0.05, { base: 'rotate(-3deg)' });
  $('#titolo small').style.opacity = t >= E.premio ? '1' : '0';
  $('#titolo small').style.transform = `scale(${ressalto(fase(t, E.premio, 0.3))})`;
  if (K.pop($('#orologio'), t, E.mezzanotte - 0.1, E.ogni - 0.05)) $('#orologio b').textContent = `23:59:${String(59 - Math.floor((t - E.mezzanotte) * 3) % 60).padStart(2, '0')}`;

  // amigos novos entrando: as casas surgem uma a uma com +25
  C.nuove.forEach(n => {
    const s = t >= n.t ? ressalto(fase(t, n.t, 0.35)) : 0;
    n.m.visible = s > 0; n.m.scale.set(LOTE, LOTE * Math.max(0.001, s), LOTE);
  });
  // o prêmio: a casa do jogador troca de modelo raro a cada batida
  const giro = t >= E.vince ? Math.floor((t - E.vince) / 0.55) % C.premi.length : -1;
  C.premio.normale.visible = giro < 0;
  C.premi.forEach((m, i) => { m.g.visible = i === giro; if (m.g.visible) { m.anima(ms, false); const t0 = E.vince + Math.floor((t - E.vince) / 0.55) * 0.55; m.g.scale.set(LOTE, LOTE * ressalto(fase(t, t0, 0.25)), LOTE); } });
  if (giro >= 0) C.cartPremio.querySelector('small').textContent = `${SPECIALI.find(s => s.id === C.premiIds[giro]).em} ${SPECIALI.find(s => s.id === C.premiIds[giro]).nome.toUpperCase()}? YOUR CHOICE`;

  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim, c.extra ? c.extra(t) : 1);
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.ogni - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    b.el.style.outline = t >= E.diversi && t < E.diversi + 0.6 && i % 2 === Math.floor((t - E.diversi) * 6) % 2 ? '6px solid #FFC93C' : '';
  });

  // a corrida pelo First Minister: líderes reais, e o +25 entrando nos pontos
  if (K.pop($('#elezione'), t, E.corsa - 0.1, E.countdown - 0.05)) C.righe.forEach((r, i) => {
    const extra = t >= E.conta + i * 0.12 ? 25 : 0;
    r.pts.textContent = num(rolar(t, E.corsa + 0.1 + i * 0.1, 0.8, r.n) + (extra ? rolar(t, E.conta + i * 0.12, 0.4, extra) : 0));
    r.piu.style.opacity = extra ? '1' : '0';
    r.piu.style.transform = `scale(${extra ? ressalto(fase(t, E.conta + i * 0.12, 0.3)) : 0})`;
  });
  if (K.pop($('#chip'), t, E.countdown, Infinity)) $('#chip b').style.opacity = Math.sin(t * 8) > -0.3 ? '1' : '0.35';
  K.banner(t, [E.cta, E.cta + 0.45], R.banner);
  $('#scuro').style.opacity = String(0.35 * fase(t, E.corsa - 0.15, 0.25) * (1 - fase(t, E.countdown - 0.1, 0.2)) + 0.3 * fase(t, E.cta - 0.1, 0.25));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'boom', { vol: 0.6 }); add(0.02, 'stamp'); add(0.05, 'scintilla');
  add(E.sfida - 0.1, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.sfida, 'campana', { vol: 0.6 }); add(E.premio, 'coin'); add(E.premio + 0.03, 'ding', { tono: 1.3 });
  add(E.mezzanotte - 0.1, 'whoosh', { dur: 0.25, vol: 0.5 });
  for (let t = E.mezzanotte; t < E.ogni - 0.1; t += 0.33) add(t, 'tick', { vol: 0.45, tono: 1.1 });
  C.bolle.forEach((b, i) => add(b.t, 'bolla', { tono: 1 + i * 0.08, vol: 0.65 }));
  add(E.diversi, 'select', { tono: 1.3 });
  add(E.ogni - 0.15, 'whoosh', { dur: 0.4, giu: true, vol: 0.6 });
  C.nuove.forEach((n, i) => { add(n.t, 'pop', { tono: 0.9 + i * 0.12 }); add(n.t + 0.12, 'coin', { vol: 0.55 }); });
  add(E.venticinque, 'ding', { tono: 1.3 });
  add(E.tu, 'coin', { vol: 0.8 }); add(E.tu + 0.04, 'scintilla', { vol: 0.6 });
  add(E.vince - 0.25, 'silenzio', { dur: 0.23 }); add(E.vince, 'boom', { vol: 0.6 });
  for (let t = E.vince; t < E.corsa - 0.2; t += 0.55) add(t, 'pop', { tono: 0.9 + ((t * 7) % 1) * 0.5, vol: 0.55 });
  add(E.rara, 'campana', { vol: 0.6 }); add(E.dieci, 'stamp'); add(E.dieci + 0.03, 'ding', { tono: 1.2 });
  add(E.corsa - 0.15, 'whoosh', { dur: 0.3, vol: 0.6 }); add(E.corsa, 'rullo', { dur: E.risultati - E.corsa, vol: 0.45 });
  add(E.ministro, 'campana', { tono: 0.9, vol: 0.6 });
  add(E.fine_mese, 'stamp'); add(E.fine_mese + 0.03, 'campana', { vol: 0.5 });
  C.righe.forEach((_, i) => add(E.conta + i * 0.12, 'coin', { vol: 0.6 }));
  add(E.countdown - 0.12, 'whoosh', { dur: 0.25, vol: 0.5 }); add(E.countdown, 'notifica', { tono: 1.2 });
  add(E.cta - 0.25, 'silenzio', { dur: 0.23 }); add(E.cta, 'boom', { vol: 0.45 }); add(E.cta + 0.03, 'ding', { tono: 1.2 }); add(E.cta + 0.45, 'pop', { tono: 1.1 }); add(E.cta + 0.5, 'scintilla', { vol: 0.5 });
  for (const f of R.frasi) for (const l of f.linee) for (const w of l) if (w[2] && !S.some(s => Math.abs(s.t - w[1]) < 0.15)) add(w[1], 'tap', { vol: 0.3 });
  return S.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 62px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  cena = {}; K = kit(mappa, cena); K.roteiro = R;
  const C = cena;
  // cidade de verdade (England, 30 a 60 casas): as 3 casas mais novas "chegam" no vídeo; uma casa antiga é a do jogador
  const tw = D.luoghi.filter(l => l.regione.cod === 'ENG' && l.case >= 30 && l.case <= 60).sort((a, b) => a.fondatore_ts - b.fondatore_ts)[1];
  const casas = tw.casas.map(i => D.casas[i]).sort((a, b) => a.lote - b.lote);
  const novas = casas.filter(c => c.livello <= 3).slice(-3), sua = casas.find(c => c.livello >= 1 && c.livello <= 5 && !novas.includes(c)) ?? casas[0];
  for (const c of [...novas, sua]) citta.nascoste.add(c.conta);
  citta.speciali.add(sua.conta);
  citta.cache.delete(tw.id); citta.ultimo = null;
  C.nuove = novas.map((c, i) => ({ casa: c, m: casaNormal(c), t: E.ogni + 0.25 + i * 0.55 }));
  C.premiIds = ['castello', 'faro', 'razzo', 'mulino', 'teiera', 'albero', 'stregata', 'zenzero', 'barca'];
  C.premio = { normale: casaNormal(sua) };
  C.premi = C.premiIds.map(id => { const sp = costruisciSpeciale(id), g = new THREE.Group(); g.add(new THREE.Mesh(sp.geo, matVC)); if (sp.extra) g.add(sp.extra); naCasa(sua, g); g.visible = false; return { g, anima: sp.anima ?? (() => {}) }; });
  const topo = (c, h = ALTURA_NIVEL[c.livello]) => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + h * LOTE * 1.05 + 0.002, p.z); };
  C.cartPremio = K.cartao('🏆 The prize', '&nbsp;', 'oro');
  C.cartoes = [
    ...C.nuove.map(n => ({ el: K.cartao(`+${REGOLE.punti.invitato}`, '🎉 NEW PLAYER', 'verde'), p: topo(n.casa), ini: n.t + 0.15, fim: E.vince - 0.05 })),
    { el: K.cartao(`+${REGOLE.punti.recluta} for you`, 'FOR EVERY MATE WHO JOINS', 'oro'), p: topo(sua), ini: E.tu, fim: E.vince - 0.05 },
    { el: C.cartPremio, p: topo(sua, 1.6), ini: E.vince + 0.1, fim: E.corsa - 0.15 },
  ];
  C.timbri = [
    K.timbro('⚡ New today', '#E0473C', 300, E.nuovo, E.sfida - 0.05, -4, 100),
    K.timbro('🙌 Different mates!', '#1E5AA8', 470, E.diversi, E.ogni - 0.05, 3, 64),
    K.timbro('🏰 A rare house', '#7B2CBF', 300, E.rara, E.corsa - 0.15, -3, 84),
    K.timbro('📅 For 10 days', '#2FB36A', 450, E.dieci, E.corsa - 0.15, 3, 70),
  ];
  const tags = [['<span class="t">@your_mate</span> join this 🏠', '#FFC93C'], ['<span class="t">@your_cousin</span> get on the map', '#9FD3E6'],
    ['<span class="t">@your_flatmate</span> comment your town!', '#F2B8C6'], ['<span class="t">@your_work_mate</span> you need this', '#A8E0C2'], ['<span class="t">@your_neighbour</span> 👀', '#FFB37A']];
  const pos = [[60, 640, -3], [210, 780, 2], [50, 920, -2], [230, 1060, 3], [110, 1200, -2]];
  C.bolle = tags.map(([html, cor], i) => ({ el: K.bolla(html, cor), t: E.tag + i * 0.17, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  // líderes reais de cada nação na disputa do First Minister
  const ge = D.snap.gran_elezione?.nazioni ?? {}, nomes = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'N. Ireland' };
  C.righe = ['ENG', 'SCT', 'WLS', 'NIR'].map(cod => {
    const top = ge[cod]?.[0], el = document.createElement('div');
    el.className = 'riga';
    el.innerHTML = `<div class="naz">${NAZIONI[cod].emoji}</div><div class="chi">@${esc(top?.conta ?? '…')}<small>${nomes[cod]} · leading</small></div><div class="pts"></div><div class="piu">+25</div>`;
    $('#righe').appendChild(el);
    return { n: top?.pts ?? 0, pts: el.querySelector('.pts'), piu: el.querySelector('.piu') };
  });
  C.impatti = [[0, 0.8], [E.sfida, 0.4], [E.premio, 0.4], [E.tu, 0.5], [E.vince, 0.8], [E.dieci, 0.4], [E.fine_mese, 0.5], [E.conta, 0.4], [E.cta, 0.5]];
  C.flash = [[0, 0.8], [E.sfida, 0.4], [E.mezzanotte, 0.3], [E.ogni, 0.5], [E.vince, 0.7], [E.corsa, 0.4], [E.countdown, 0.4], [E.cta, 0.3]];
  // câmera
  const dP = mappa.distPais(), casaT = (c, o) => K.casa(citta, c, o);
  const pn = novas.map(c => citta.posCasa(c)), centro = { x: pn.reduce((s, p) => s + p.x, 0) / pn.length, z: pn.reduce((s, p) => s + p.z, 0) / pn.length };
  K.chaves([
    [0, K.uk({ dist: dP * 1.06, az: -0.06 })],
    [E.mezzanotte, K.uk({ dist: dP * 0.96, az: 0.04 })],
    [E.ogni - 0.05, K.uk({ dist: dP * 0.92, az: 0.06 })],
    [E.ogni, { ...centro, dist: 0.62, az: posLote(novas[1].lote).rot + 0.35, el: 32, giu: 0, dy: 0.01, cut: true }],
    [E.tu - 0.02, K.deriva(0.55, 0.2)],
    [E.tu, casaT(sua, { dist: 0.42, az: 0.3, el: 26, cut: true })],
    [E.vince - 0.02, K.deriva(0.38, 0.1)],
    [E.vince, casaT(sua, { dist: 0.36, az: -0.2, el: 16, dy: 0.04, cut: true })],
    [E.corsa - 0.15, K.deriva(0.32, 0.6)],
    [E.corsa - 0.1, K.uk({ dist: dP * 1.02, az: -0.04, cut: true })],
    [E.countdown, K.uk({ dist: dP * 0.98, az: 0.02 })],
    [R.durata, K.uk({ dist: dP * 1.06, az: 0.05 })],
  ]);
  K.capa();
  console.log(`cidade ${tw.nome} (${tw.case}) · novas ${novas.map(c => c.conta).join(', ')} · sua @${sua.conta}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
