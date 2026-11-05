// Reel diário "Daily update" (1º reel do dia), com os dados do snapshot: casas novas nas últimas 24 h acendendo no mapa,
// o total, a cidade que mais cresceu e a maior, o First Minister de uma nação (líder × 2º), a disputa mais apertada,
// o derby e o convite para quem ainda não joga (comentar a cidade, curtir). Usado a partir do Reel 11 (05/11).
// O roteiro escolhe as nações em R.dati: { fm: 'ENG', stretta: 'NIR' } (padrão: maior vantagem e menor vantagem).
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { num } from '../js/regole.js';
import { NAZIONI } from '../js/nazioni.js';
import { kit, $, ressalto, fase, esc, suave, clamp } from './kit.js';

let D, mappa, citta, R, E, cena, K;
const NOMI = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// ---------- todas as casas como pontinhos; as das últimas 24 h maiores, em rosa, pulsando ----------
function criarPunti(desde) {
  const n = D.casas.length, pos = new Float32Array(n * 3), nova = new Float32Array(n);
  D.casas.forEach((casa, i) => {
    const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z;
    pos.set([x, mappa.altura(x, z) + 0.05, z], i * 3); nova[i] = casa.ts >= desde ? 1 : 0;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('nova', new THREE.BufferAttribute(nova, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) }, aN: { value: 0 }, aT: { value: 0 }, pulso: { value: 0 } },
    vertexShader: `attribute float nova; uniform float escala; uniform float aN; uniform float aT; uniform float pulso; varying float vN; varying float vA;
      void main() { vN = nova; vA = nova > 0.5 ? max(aN, aT) : aT; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float base = nova > 0.5 && aN > 0.01 ? 0.5 * (1.0 + 0.35 * pulso) : 0.16;
        gl_PointSize = vA < 0.01 ? 0.0 : clamp(base * escala / -mv.z, nova > 0.5 && aN > 0.01 ? 15.0 : 6.0, nova > 0.5 && aN > 0.01 ? 26.0 : 10.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vN; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = vN > 0.5 ? vec3(1.0, 0.25, 0.55) : vec3(1.0, 0.82, 0.25); float borda = smoothstep(0.62, 0.8, d);
        gl_FragColor = vec4(mix(c, vec3(0.08, 0.12, 0.2), borda), vA); }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 8;
  mappa.scene.add(p);
  return p;
}

// painel de duelo (líder × 2º, derby): o conteúdo troca conforme o trecho
function painel(t, d) {
  const el = $('#duello');
  if (!d) { el.style.opacity = '0'; el.dataset.k = ''; return; }
  if (el.dataset.k !== d.k) {
    el.dataset.k = d.k;
    el.querySelector('h3').innerHTML = `${d.titolo}<small>${d.sub}</small>`;
    $('#righe').innerHTML = d.righe.map(r => `<div class="riga"><div class="testo"><span class="chi">${r.nome}</span><span class="n"></span></div><div class="barra"><i style="background:${r.cor}"></i></div></div>`).join('');
  }
  K.pop(el, t, d.ini, d.fim);
  const max = Math.max(...d.righe.map(r => r.n)), s = suave(fase(t, d.ini + 0.15, 0.7));
  el.querySelectorAll('.riga').forEach((x, i) => {
    const r = d.righe[i];
    x.querySelector('.n').textContent = `${num(Math.round(r.n * s))} ${d.unita}`;
    x.querySelector('i').style.width = `${(r.n / max) * 100 * s}%`;
  });
}

function quadro(t) {
  const C = cena, dist = K.camera(t);
  citta.grupo.visible = dist < 32;
  // pontos: novas a partir de "344", todas a partir de "12,200"; somem perto das cidades
  const U = C.punti.material.uniforms;
  U.aN.value = fase(t, E.nuove, 0.4) * (1 - fase(t, E.crescita - 0.15, 0.15)) + fase(t, E.cta, 0.3);
  U.aT.value = fase(t, E.totale, 0.5) * (1 - fase(t, E.crescita - 0.15, 0.15)) + fase(t, E.cta, 0.3) * 0.8;
  U.pulso.value = Math.abs(Math.sin(t * 5));
  C.punti.visible = dist > 8;

  K.pop($('#titolo'), t, E.nonmappa, E.nuove - 0.05, { base: 'rotate(-3deg)' });
  // número grande: +344 (novas) e depois o total
  const nb = $('#numero');
  if (t >= E.nuove && t < E.crescita - 0.05) {
    const total = t >= E.totale, ini = total ? E.totale : E.nuove, alvo = total ? C.totale : C.nuove;
    K.pop(nb, t, ini, total ? E.crescita - 0.05 : E.totale - 0.05);
    nb.querySelector('b').textContent = `${total ? '' : '+'}${num(Math.round(alvo * suave(fase(t, ini, 0.8))))}`;
    nb.querySelector('span').textContent = total ? 'houses on the map' : 'new houses today';
  } else nb.style.opacity = '0';
  // duelos
  const d = C.duelli.find(x => t >= x.ini && t < x.fim);
  painel(t, d);
  for (const s of C.timbri) K.pop(s.el, t, s.ini, s.fim, { base: `rotate(${s.rot}deg)` });
  for (const c of C.cartoes) K.presa(c.el, t, c.p(), c.ini, c.fim);
  C.bolle.forEach((b, i) => {
    const s = K.pop(b.el, t, b.t, E.like - 0.05, { base: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)` });
    if (s) b.el.style.transform += ` translateY(${Math.sin(t * 2.2 + i) * 6}px)`;
    const piu = b.el.querySelector('.piu');
    if (piu) { const sp = t >= b.t + 0.3 ? ressalto(fase(t, b.t + 0.3, 0.3)) : 0; piu.style.opacity = sp > 0 ? '1' : '0'; piu.style.transform = `scale(${Math.max(0.001, sp)})`; }
  });
  K.banner(t, [E.comment, E.comment + 0.4], R.banner, E.like - 0.05);
  $('#scuro').style.opacity = String(0.25 * fase(t, E.fm + 0.2, 0.2) * (1 - fase(t, E.cta - 0.1, 0.1)) + 0.3 * fase(t, E.cta - 0.1, 0.25) * (1 - fase(t, E.like - 0.1, 0.2)));
  K.legenda(t);
  K.fechar(t);
  return true;
}

function suoni() {
  const S = [], C = cena;
  const add = (t, tipo, o = {}) => { if (t >= 0 && t < R.durata) S.push({ t: +t.toFixed(3), tipo, ...o }); };
  add(0, 'whoosh', { dur: 0.4, vol: 0.5 }); add(0.05, 'bolla', { tono: 1.2, vol: 0.6 });
  add(E.missing, 'notifica', { tono: 1 });
  add(E.nuove - 0.2, 'silenzio', { dur: 0.18 }); add(E.nuove, 'boom', { vol: 0.6 }); add(E.nuove + 0.05, 'rullo', { dur: 0.75, vol: 0.4 }); add(E.nuove + 0.8, 'ding', { tono: 1.2 });
  add(E.totale - 0.1, 'whoosh', { dur: 0.3, vol: 0.55 }); add(E.totale + 0.05, 'rullo', { dur: 0.75, vol: 0.4 }); add(E.totale + 0.8, 'campana', { vol: 0.6 });
  add(E.crescita - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 }); add(E.crescita + 0.1, 'pop', { tono: 1.1 });
  add(E.leader - 0.1, 'whoosh', { dur: 0.3, vol: 0.55 }); add(E.leader + 0.1, 'stamp', { vol: 0.7 });
  add(E.fm - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 }); add(E.lozza, 'select', { tono: 1.1 }); add(E.miles, 'stamp');
  add(E.stretta - 0.1, 'whoosh', { dur: 0.3, vol: 0.55 }); add(E.tight, 'tasto', { vol: 0.6 }); add(E.gap, 'stamp'); add(E.gap + 0.03, 'campana', { vol: 0.5 });
  add(E.derby - 0.1, 'whoosh', { dur: 0.3, giu: true, vol: 0.55 }); add(E.liverpool, 'pop', { tono: 1 }); add(E.manchester, 'pop', { tono: 0.85 }); add(E.thrash, 'boom', { vol: 0.5 });
  add(E.cta - 0.2, 'silenzio', { dur: 0.18 }); add(E.cta, 'whoosh', { dur: 0.3, vol: 0.5 });
  add(E.comment, 'boom', { vol: 0.45 }); add(E.comment + 0.03, 'ding', { tono: 1.2 }); add(E.comment + 0.4, 'pop', { tono: 1.1 });
  C.bolle.forEach((b, i) => { add(b.t, 'bolla', { tono: 1 + i * 0.08, vol: 0.65 }); add(b.t + 0.3, 'coin', { vol: 0.45 }); });
  add(E.free, 'scintilla', { vol: 0.6 });
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
  const C = cena, dP = mappa.distPais(), dati = R.dati ?? {};
  // últimas 24 h até a hora do snapshot
  const agora = Date.parse(D.snap.gerado_em), desde = agora - 86400e3;
  C.punti = criarPunti(desde);
  const novas = D.casas.filter(c => c.ts >= desde);
  C.nuove = dati.nuove ?? novas.length; C.totale = D.casas.length;
  const porL = new Map(); novas.forEach(c => porL.set(c.luogo, (porL.get(c.luogo) ?? 0) + 1));
  // (o roteiro pode fixar o que a voz disse: dati.cresce / dati.nCresce, se o snapshot andou depois da gravação)
  let [liCresce, nCresce] = [...porL.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dati.cresce) { const l = D.luoghi.find(x => x.nome === dati.cresce); if (l) { liCresce = l.id; nCresce = dati.nCresce ?? porL.get(l.id) ?? nCresce; } }
  const cresce = D.luoghi[liCresce], grande = [...D.luoghi].sort((a, b) => b.case - a.case)[0];
  // First Minister: a nação do roteiro (padrão: a maior vantagem) e a mais apertada
  const ge = D.snap.gran_elezione?.nazioni ?? {}, gap = cod => (ge[cod]?.[0]?.pts ?? 0) - (ge[cod]?.[1]?.pts ?? 0);
  const cods = Object.keys(NOMI).filter(c => ge[c]?.length >= 2);
  const fm = dati.fm ?? cods.sort((a, b) => gap(b) - gap(a))[0], stretta = dati.stretta ?? [...cods].sort((a, b) => gap(a) - gap(b))[0];
  const lider = D.porConta.get(ge[fm][0].conta);
  const der = D.snap.derby, cA = D.comunePorIstat.get(der.a), cB = D.comunePorIstat.get(der.b);
  const [vince, perde] = der.pts_a >= der.pts_b ? [[cA, der.pts_a], [cB, der.pts_b]] : [[cB, der.pts_b], [cA, der.pts_a]];
  const cor = cod => NAZIONI[cod].cor;
  C.duelli = [
    { k: 'fm', ini: E.lozza, fim: E.stretta - 0.05, titolo: `${NAZIONI[fm].emoji} First Minister`, sub: `${NOMI[fm].toUpperCase()} · RIGHT NOW`, unita: 'pts',
      righe: ge[fm].slice(0, 2).map((x, i) => ({ nome: `${i ? '2.' : '1.'} @${esc(x.conta)}`, n: x.pts, cor: i ? '#9AA3AE' : cor(fm) })) },
    { k: 'stretta', ini: E.stretta + 0.1, fim: E.derby - 0.05, titolo: `${NAZIONI[stretta].emoji} ${NOMI[stretta]}`, sub: 'FIRST MINISTER · SO CLOSE', unita: 'pts',
      righe: ge[stretta].slice(0, 2).map((x, i) => ({ nome: `${i ? '2.' : '1.'} @${esc(x.conta)}`, n: x.pts, cor: i ? '#9AA3AE' : cor(stretta) })) },
    { k: 'derby', ini: E.liverpool, fim: E.cta - 0.05, titolo: '⚔️ The derby', sub: 'POINTS FROM EACH TOWN', unita: 'pts',
      righe: [vince, perde].map(([c, n], i) => ({ nome: `${i ? '' : '🏆 '}${esc(c.nome)}`, n, cor: i ? '#6CABDD' : '#C8102E' })) },
  ];
  const sobre = (l, h = 0.6) => () => K.projetar(l.x, mappa.altura(l.x, l.z) + h, l.z);
  const topo = c => () => { const p = citta.posCasa(c); return K.projetar(p.x, p.y + ALTURA_NIVEL[c.livello] * LOTE * 1.05 + 0.002, p.z); };
  C.cartoes = [
    { el: K.cartao(`📈 ${esc(cresce.nome)}`, `+${nCresce} HOUSES TODAY`, 'verde'), p: sobre(cresce, 0.15), ini: E.crescita + 0.1, fim: E.leader - 0.05 },
    { el: K.cartao(`👑 ${esc(grande.nome)}`, `${num(grande.case)} HOUSES · No.1`, 'oro'), p: sobre(grande, 0.25), ini: E.leader + 0.1, fim: E.fm - 0.05 },
    { el: K.cartao(`🏛️ @${esc(lider.conta)}`, `LEADS ${NOMI[fm].toUpperCase()}`, 'oro'), p: topo(lider), ini: E.fm + 0.1, fim: E.lozza - 0.05 },
  ];
  C.timbri = [
    K.timbro(`📰 Daily update · ${new Date(agora).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}`, '#1E5AA8', 300, E.missing, E.nuove - 0.05, -3, 72),
    K.timbro('🚀 Miles ahead', '#2FB36A', 1120, E.miles, E.stretta - 0.05, 3, 84),
    K.timbro(`👀 Just ${num(dati.gap ?? gap(stretta))} in it`, '#E0473C', 1120, E.gap, E.derby - 0.05, -3, 84),
    K.timbro('🔥 Thrashing', '#E0473C', 1120, E.thrash, E.cta - 0.05, 3, 84),
    K.timbro('🆓 It\'s free', '#2FB36A', 1120, E.free, E.like - 0.05, -3, 90),
    K.timbro('❤️ Like this', '#E0306E', 1120, E.like, Infinity, 3, 100),
  ];
  // comentários de quem está chegando (cidades reais que cresceram hoje)
  const cidades = [...porL.entries()].sort((a, b) => b[1] - a[1]).slice(1, 5).map(([li]) => D.luoghi[li]);
  const cores = ['#FFC93C', '#9FD3E6', '#F2B8C6', '#A8E0C2'], pos = [[60, 780, -3], [200, 940, 2], [50, 1100, -2], [220, 1260, 3]];
  C.bolle = cidades.map((l, i) => ({ el: K.bolla(`${esc(l.nome)}, ${NOMI[l.regione.cod]} 🏠`, cores[i], '+1 🏠'), t: E.comment + 0.5 + i * 0.25, x: pos[i][0], y: pos[i][1], rot: pos[i][2] }));
  C.impatti = [[E.nuove, 0.6], [E.totale, 0.5], [E.miles, 0.4], [E.gap, 0.5], [E.thrash, 0.6], [E.comment, 0.5]];
  C.flash = [[0, 0.5], [E.nuove, 0.5], [E.crescita, 0.4], [E.leader, 0.3], [E.fm, 0.4], [E.stretta, 0.3], [E.derby, 0.4], [E.cta, 0.3], [E.like, 0.3]];
  // câmera
  const centro = cod => { const cs = D.luoghi.filter(l => l.regione.cod === cod); return { x: cs.reduce((s, c) => s + c.x, 0) / cs.length, z: cs.reduce((s, c) => s + c.z, 0) / cs.length }; };
  const nz = centro(stretta), meioD = { x: (cA.x + cB.x) / 2, z: (cA.z + cB.z) / 2 }, dD = Math.hypot(cA.x - cB.x, cA.z - cB.z);
  K.chaves([
    [0, K.uk({ dist: dP * 1.1, az: -0.06 })],
    [E.nuove - 0.05, K.uk({ dist: dP * 1.02, az: 0.0 })],
    [E.totale, K.uk({ dist: dP * 0.98, az: 0.03 })],
    [E.crescita - 0.05, K.uk({ dist: dP * 0.95, az: 0.05 })],
    [E.crescita, { x: cresce.x, z: cresce.z, dist: 3.2, az: 0.4, el: 34, giu: 0, dy: 0, cut: true }],
    [E.leader - 0.05, K.deriva(2.6, 0.2)],
    [E.leader, { x: grande.x, z: grande.z, dist: 5, az: -0.2, el: 36, giu: 0, dy: 0, cut: true }],
    [E.fm - 0.05, K.deriva(4.2, 0.2)],
    [E.fm, K.casa(citta, lider, { dist: 0.55, az: 0.35, el: 22, cut: true })],
    [E.stretta - 0.05, K.deriva(0.45, 0.3)],
    [E.stretta, { ...nz, dist: dP * 0.3, az: 0, el: null, giu: 0, dy: 0, cut: true }],
    [E.derby - 0.05, K.deriva(dP * 0.27, 0.06)],
    [E.derby, { ...meioD, dist: Math.max(40, dD * 2.2), az: 0.1, el: 45, giu: 0, dy: 0, cut: true }],
    [E.cta - 0.05, K.deriva(Math.max(34, dD * 1.9), 0.1)],
    [E.cta, K.uk({ dist: dP * 1.0, az: -0.02, cut: true })],
    [R.durata, K.uk({ dist: dP * 1.06, az: 0.04 })],
  ]);
  C.cartoes.push(
    { el: K.cartao(`🏆 ${esc(vince[0].nome)}`, `${num(vince[1])} PTS`, 'oro'), p: sobre(vince[0], 0.3), ini: E.liverpool + 0.1, fim: E.cta - 0.05 },
    { el: K.cartao(esc(perde[0].nome), `${num(perde[1])} PTS`, ''), p: sobre(perde[0], 0.3), ini: E.manchester + 0.1, fim: E.cta - 0.05 },
  );
  K.capa();
  console.log(`snapshot ${D.snap.gerado_em} · novas 24h ${C.nuove} · total ${C.totale} · cresce ${cresce.nome} +${nCresce} · maior ${grande.nome} ${grande.case} · FM ${fm} @${lider.conta} (+${gap(fm)}) · apertada ${stretta} (+${gap(stretta)}) · derby ${vince[0].nome} ${vince[1]} × ${perde[0].nome} ${perde[1]}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
