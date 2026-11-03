// Peças comuns dos gravadores de reel: câmera por chaves (corte, deriva, frente da casa), legendas palavra a palavra,
// cartões presos a pontos 3D, carimbos, contadores, comentários e capa. Cada gravador cria um kit(mappa, cena).
import * as THREE from 'three';
import { LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';

export const $ = s => document.querySelector(s);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
export const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
export const fase = (t, ini, dur) => clamp((t - ini) / dur);
export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const pulso = (t, lista, dec) => lista.reduce((s, [ti, f]) => s + (t >= ti ? f * Math.exp(-(t - ti) / dec) : 0), 0);
export const rolar = (t, a, dur, alvo, de = 0) => Math.round(de + (alvo - de) * suave(fase(t, a, dur)));

export function kit(mappa, cena) {
  let chaves = [], R = null;
  const elDe = k => (k.el ?? mappa.elevacao(k.dist) * 180 / Math.PI);
  const K = {
    set roteiro(r) { R = r; },
    // vista do país, casa vista de frente (az relativo à porta), deriva (segue girando a partir da chave anterior)
    uk(o = {}) { const v = mappa.geo.vista; return { x: (v.x0 + v.x1) / 2, z: (v.z0 + v.z1) / 2 + 0.035 * (v.z1 - v.z0), dist: mappa.distPais(), az: 0, el: null, giu: 0, dy: 0, su: 0, ...o }; },
    casa(citta, c, o = {}, h = ALTURA_NIVEL[c.livello]) { const p = citta.posCasa(c); return { x: p.x, z: p.z, el: 24, giu: 0, dy: h * LOTE * 0.45, su: 0, ...o, az: posLote(c.lote).rot + (o.az ?? 0) }; },
    deriva: (dist, daz, o = {}) => ({ dist, daz, ...o }),
    chaves(lista) {
      let ant = {};
      chaves = [...lista].sort((a, b) => a[0] - b[0]).map(([t, k]) => { const { cut, daz, ...resto } = k; if (daz != null) resto.az = ant.az + daz; ant = { ...ant, ...resto }; return { t, k: { ...ant }, cut: !!cut }; });
    },
    camera(t) {
      let i = 0;
      while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
      const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
      const s0 = b.t > a.t && !b.cut ? clamp((t - a.t) / (b.t - a.t)) : (t >= b.t ? 1 : 0);
      const s = suave(s0), A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
      const dxz = Math.hypot(B.x - A.x, B.z - A.z);
      const sxz = dxz > 20 ? (B.dist < A.dist ? suave(clamp(s0 / 0.55)) : suave(clamp((s0 - 0.4) / 0.6))) : s;
      const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
      const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
      mappa.az = az; mappa.dist = dist;
      mappa.alvo.x = x - Math.sin(az) * giu * dist;
      mappa.alvo.z = z - Math.cos(az) * giu * dist;
      mappa.atualizarCamera();
      if (A.y0 != null || B.y0 != null) { const base = mappa.alvo.y; mappa.alvo.y = l(A.y0 ?? base, B.y0 ?? base); }
      mappa.alvo.y += l(A.dy ?? 0, B.dy ?? 0);
      const el = l(elDe(A), elDe(B)) * Math.PI / 180, c = mappa.camera, al = mappa.alvo;
      c.position.set(al.x + Math.sin(az) * Math.cos(el) * dist, al.y + Math.sin(el) * dist, al.z + Math.cos(az) * Math.cos(el) * dist);
      const tr = pulso(t, cena.impatti ?? [], 0.12) * dist * 0.012;
      if (tr > 1e-6) c.position.add(new THREE.Vector3(Math.sin(t * 83) * tr, Math.cos(t * 71) * tr * 0.6, Math.sin(t * 97 + 1) * tr));
      c.near = Math.max(0.003, dist * 0.02);
      const su = R?.copertina ? (R.copertina.giu ?? 0) : l(A.su ?? 0, B.su ?? 0);
      if (su) c.setViewOffset(1080, 1920, 0, -su, 1080, 1920); else c.clearViewOffset();
      c.updateProjectionMatrix();
      c.up.set(0, 1, 0);
      if (el > 1.5) c.up.set(-Math.sin(az), 0, -Math.cos(az));
      c.lookAt(al);
      c.updateMatrixWorld(true);
      return dist;
    },
    projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 }; },
    pop(el, t, ini, fim = Infinity, { sai = 0.2, base = 'translate(0,0)' } = {}) {
      const vis = t >= ini && t < fim;
      el.style.opacity = vis ? '1' : '0';
      if (!vis) return 0;
      const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - sai, sai)));
      el.style.transform = `${base} scale(${Math.max(0.001, s)})`;
      return s;
    },
    presa(el, t, p, ini, fim, extra = 1) {
      const vis = t >= ini && t < fim && p.ok;
      el.style.opacity = vis ? '1' : '0';
      if (!vis) return;
      const s = ressalto(fase(t, ini, 0.32)) * (1 - suave(fase(t, fim - 0.18, 0.18))) * extra;
      const w = el.offsetWidth, x = clamp(p.x - w / 2, 24, 1056 - w);
      el.style.transform = `translate(${x}px, ${p.y - el.offsetHeight}px) scale(${Math.max(0.001, s)})`;
    },
    legenda(t) {
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
    },
    cartao(titulo, sub, cls = '') {
      const el = document.createElement('div');
      el.className = 'etichetta';
      el.innerHTML = `<div class="card ${cls}"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="freccia"></div>`;
      $('#etichette').appendChild(el);
      return el;
    },
    timbro(txt, cor, top, ini, fim, rot = -4, size = 80) {
      const el = document.createElement('div');
      el.className = 'pop timbro';
      el.style.cssText = `top:${top}px;color:${cor}`;
      el.innerHTML = `<span style="font-size:${size}px">${txt}</span>`;
      $('#timbri').appendChild(el);
      return { el, ini, fim, rot };
    },
    // comentário com avatar colorido e um selo (+3, +25...) que pula depois
    bolla(html, cor, selo = '') {
      const el = document.createElement('div');
      el.className = 'bolla';
      el.innerHTML = `<i style="background:${cor}"></i><b>${html}</b>${selo ? `<div class="piu">${selo}</div>` : ''}`;
      $('#bolle').appendChild(el);
      return el;
    },
    banner(t, E, linhas, fim = Infinity) {
      const bn = $('#banner');
      if (!bn.children.length) bn.innerHTML = linhas.map((x, k) => `<div${k ? ' class="g"' : ''}>${esc(x)}</div>`).join('');
      bn.style.opacity = t >= E[0] && t < fim ? '1' : '0';
      [...bn.children].forEach((d, k) => {
        const ti = E[k] ?? E[0], s = t >= ti ? ressalto(fase(t, ti, 0.32)) * (1 - suave(fase(t, fim - 0.2, 0.2))) : 0;
        d.style.opacity = s > 0 ? '1' : '0';
        d.style.transform = `scale(${Math.max(0.001, s)}) rotate(${k ? 2 : -2}deg)`;
      });
    },
    // efeitos finais do quadro: pulso de zoom no mapa, flash e render
    fechar(t) {
      $('#mappa').style.transform = R.copertina ? '' : `scale(${1 + 0.05 * pulso(t, cena.impatti ?? [], 0.16)})`;
      $('#flash').style.opacity = R.copertina ? '0' : String(clamp(pulso(t, cena.flash ?? [], 0.09) * 0.55));
      mappa.renderer.render(mappa.scene, mappa.camera);
    },
    capa() {
      if (!R.copertina) return;
      const cp = R.copertina, el = document.createElement('div');
      el.className = 'forte';
      el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
      el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
      document.body.appendChild(el);
      for (const s of cp.nascondi ?? []) $(s).style.visibility = 'hidden';
    },
  };
  return K;
}
