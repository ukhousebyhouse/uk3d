// Imagens 1080x1920 prontas para a story: a casa, a blue plaque do fundador e a cidade.
import { REGOLE, NOMI_CARICHE, num } from './regole.js';
import { LOTE } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';
import { NAZIONI, saluto } from './nazioni.js';

export const PERFIL = 'ukhousebyhouse';
const W = 1080, H = 1920, INK = '#152033', GIALLO = '#FFC93C', ROSSO = '#C8102E', NAVY = '#1F3A6B', GRIGIO = '#5B6475';
const PLACCA = '#1E5AA8';
const FUSO = { timeZone: 'Europe/London' };

let logoP = null;
const logo = () => (logoP ??= new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = 'img/logo.png'; }));
const fontes = () => Promise.all(['900 80px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));

function tela(fundo) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (fundo === 'mattoni') {
    // parede de tijolo vermelho com juntas claras (a blue plaque fica presa nela)
    g.fillStyle = '#E3D8C8'; g.fillRect(0, 0, W, H);
    const bw = 120, bh = 46;
    for (let y = 0, fila = 0; y < H; y += bh, fila++) for (let x = (fila % 2) * -bw / 2; x < W; x += bw) {
      const t = ((x * 7 + y * 13) % 5) / 5;
      g.fillStyle = `rgb(${158 + t * 26},${66 + t * 14},${48 + t * 10})`;
      g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,10,5,0.4)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#BFD9EA'); gr.addColorStop(0.55, '#E6F0F6'); gr.addColorStop(1, '#F7F2E8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  return [c, g];
}
function caminho(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function contorno(g, txt, x, y, size, cor = '#fff', align = 'center') {
  g.font = `900 ${size}px Nunito`; g.textAlign = align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.lineWidth = size * 0.17; g.strokeStyle = INK; g.strokeText(txt, x, y);
  g.fillStyle = cor; g.fillText(txt, x, y);
}
function ajustar(g, txt, max, size, peso = 900) {
  g.font = `${peso} ${size}px Nunito`;
  while (g.measureText(txt).width > max && size > 24) { size -= 2; g.font = `${peso} ${size}px Nunito`; }
  return size;
}
// linha com partes de cores diferentes (ex.: "IN " branco + "LEEDS" amarelo), centralizada
function linhaMista(g, partes, cx, y, size, max = 980) {
  size = ajustar(g, partes.map(p => p[0]).join(''), max, size);
  g.font = `900 ${size}px Nunito`;
  let x = cx - partes.reduce((s, [t]) => s + g.measureText(t).width, 0) / 2;
  for (const [t, cor] of partes) { contorno(g, t, x, y, size, cor, 'left'); g.font = `900 ${size}px Nunito`; x += g.measureText(t).width; }
}
function texto(g, txt, x, y, size, cor = INK, peso = 800, align = 'center') {
  g.font = `${peso} ${size}px Nunito`; g.fillStyle = cor; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(txt, x, y);
}
function chip(g, txt, cx, yBase, { size = 36, fundo = '#fff', cor = INK } = {}) {
  g.font = `800 ${size}px Nunito`;
  const w = g.measureText(txt).width + 46, h = size + 26;
  caminho(g, cx - w / 2, yBase - h, w, h, h / 2);
  g.fillStyle = fundo; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, yBase - h / 2 + 2);
  g.textBaseline = 'alphabetic';
}
function moldura(g, src, x, y, w, h, r = 44, cor = INK) {
  g.save(); caminho(g, x, y, w, h, r); g.clip(); g.drawImage(src, x, y, w, h); g.restore();
  caminho(g, x, y, w, h, r); g.lineWidth = 10; g.strokeStyle = cor; g.stroke();
}
function cartao(g, x, y, w, h) {
  caminho(g, x, y, w, h, 40); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
}
// bunting vermelho, branco e azul pendurado num fio (festa de rua britânica)
function bandierine(g, y = 0) {
  const cores = [ROSSO, '#FFFFFF', NAVY], w = 72;
  g.beginPath(); g.moveTo(0, y + 2); g.lineTo(W, y + 2); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  for (let i = 0; i * w < W; i++) {
    const x = i * w;
    g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + w - 4, y); g.lineTo(x + w / 2, y + 52); g.closePath();
    g.fillStyle = cores[i % cores.length]; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  }
}
function cabecalho(g, img, y) {
  const s = 100, size = 56;
  g.font = `900 ${size}px Nunito`;
  const tw = g.measureText('UK House by House').width, x0 = (W - (s + 22 + tw)) / 2;
  g.save(); g.beginPath(); g.arc(x0 + s / 2, y - size * 0.36, s / 2, 0, Math.PI * 2); g.clip(); g.drawImage(img, x0, y - size * 0.36 - s / 2, s, s); g.restore();
  g.beginPath(); g.arc(x0 + s / 2, y - size * 0.36, s / 2, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  contorno(g, 'UK ', x0 + s + 22, y, size, '#fff', 'left');
  g.font = `900 ${size}px Nunito`;
  contorno(g, 'House by House', x0 + s + 22 + g.measureText('UK ').width, y, size, GIALLO, 'left');
}
function quebrar(g, txt, max) {
  const linhas = [];
  let atual = '';
  for (const p of txt.split(' ')) {
    const t = atual ? `${atual} ${p}` : p;
    if (g.measureText(t).width > max && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
const cargo = (D, c) => {
  const k = c.carica;
  if (!k) return null;
  if (k.tipo === 'presidente') return NOMI_CARICHE.presidente;
  if (k.regione) return `${NOMI_CARICHE[k.tipo]} · ${D.regPorCod.get(k.regione).nome}`;
  return `${NOMI_CARICHE[k.tipo]} of ${D.comunePorIstat.get(k.comune).nome}`;
};

// ---------- a minha casa ----------
export async function immagineCasa(fot, citta, D, casa) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela();
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa), alt = ALTURA_NIVEL[casa.livello] * LOTE;
  const fogo = casa.fiamme > Date.now() / 1000;
  bandierine(g);
  cabecalho(g, img, 160);
  linhaMista(g, [['MY HOUSE', '#fff']], W / 2, 300, 100);
  linhaMista(g, [['IN ', '#fff'], [l.nome.toUpperCase(), GIALLO]], W / 2, 410, 100);

  const f = fot.foto({ x: p.x, z: p.z, y: p.y + alt * 0.4, dist: 0.3 + alt * 2.6, az: 0.62, el: 0.5 });
  moldura(g, f.canvas, 60, 450, 960, 960);
  const q = fot.projetar(f, p.x, p.y + alt + LOTE * 0.3, p.z);
  chip(g, `${fogo ? '🔥 ' : '🏠 '}@${casa.conta}`, 60 + q.x, 450 + Math.max(90, q.y - 24), { fundo: NAVY, cor: '#fff', size: 40 });
  if (fogo) chip(g, '🔥 ON FIRE', 870, 530, { fundo: '#FFE2C7', size: 32 });

  const niv = REGOLE.livelli[casa.livello], k = cargo(D, casa);
  cartao(g, 60, 1450, 960, 270);
  texto(g, `@${casa.conta}`, W / 2, 1535, ajustar(g, `@${casa.conta}`, 880, 66, 900), INK, 900);
  texto(g, `${niv.nome} · level ${casa.livello + 1} of ${REGOLE.livelli.length}`, W / 2, 1600, 40, GRIGIO, 800);
  if (k) chip(g, `🏛 ${k}`, W / 2, 1690, { fundo: casa.carica.tipo === 'presidente' ? ROSSO : GIALLO, cor: casa.carica.tipo === 'presidente' ? '#fff' : INK, size: 34 });
  else texto(g, `${num(casa.tot)} points · no. ${num(casa.pos)} this week`, W / 2, 1675, 38, INK, 800);

  texto(g, 'Comment your town + country', W / 2, 1795, 40, INK, 800);
  texto(g, 'and get a house with your @', W / 2, 1845, 40, INK, 800);
  contorno(g, `@${PERFIL}`, W / 2, 1900, 44, ROSSO);
  return c;
}

// ---------- blue plaque do fundador ----------
export async function immagineFondazione(fot, citta, D, l) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela('mattoni');
  cabecalho(g, img, 140);

  // a placa: círculo azul com aro branco, texto branco centralizado
  const cx = W / 2, cy = 560, R = 380;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = PLACCA; g.fill(); g.restore();
  g.beginPath(); g.arc(cx, cy, R - 22, 0, Math.PI * 2); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
  const quando = new Date(l.fondatore_ts).toLocaleDateString('en-GB', { ...FUSO, day: 'numeric', month: 'long', year: 'numeric' });
  texto(g, 'UK HOUSE BY HOUSE', cx, cy - 250, 34, '#fff', 900);
  g.beginPath(); g.moveTo(cx - 200, cy - 225); g.lineTo(cx + 200, cy - 225); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
  texto(g, `@${l.fondatore}`, cx, cy - 120, ajustar(g, `@${l.fondatore}`, 600, 72, 900), '#fff', 900);
  texto(g, 'founded', cx, cy - 40, 48, '#fff', 800);
  texto(g, l.nome.toUpperCase(), cx, cy + 60, ajustar(g, l.nome.toUpperCase(), 620, 96, 900), '#fff', 900);
  texto(g, 'and built the first house here', cx, cy + 130, 38, '#fff', 800);
  texto(g, quando, cx, cy + 210, 42, '#fff', 900);

  const dist = Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075) * 0.85, hc = citta.dadosCidade(l).hc;
  const f = fot.foto({ x: l.x, z: l.z, y: hc, dist, az: 0.55, el: 0.72, w: 900, h: 640 });
  moldura(g, f.canvas, 90, 1000, 900, 640, 28, '#fff');

  cartao(g, 90, 1680, 900, 170);
  texto(g, `${l.nome} today: ${num(l.case)} ${l.case === 1 ? 'house' : 'houses'}`, W / 2, 1752, ajustar(g, `${l.nome} today: ${num(l.case)} houses`, 840, 44), INK, 900);
  texto(g, `Comment your town on @${PERFIL}`, W / 2, 1815, 34, ROSSO, 900);
  return c;
}

// ---------- a cidade ----------
export async function immagineCitta(fot, citta, D, l) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela();
  bandierine(g);
  cabecalho(g, img, 160);
  contorno(g, l.nome.toUpperCase(), W / 2, 310, ajustar(g, l.nome.toUpperCase(), 960, 120), GIALLO);
  linhaMista(g, [[`${num(l.case)} `, '#fff'], [l.case === 1 ? 'HOUSE' : 'HOUSES', '#fff']], W / 2, 410, 90);

  const dist = Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075), hc = citta.dadosCidade(l).hc;
  const f = fot.foto({ x: l.x, z: l.z, y: hc, dist, az: 0.55, el: 0.68, w: 960, h: 960 });
  moldura(g, f.canvas, 60, 450, 960, 960);

  const k = D.snap.cariche, sindaco = k.sindaci[l.comune.istat], N = NAZIONI[l.regione.cod] ?? {};
  cartao(g, 60, 1450, 960, 250);
  texto(g, `🔵 Founder: @${l.fondatore}`, W / 2, 1530, ajustar(g, `🔵 Founder: @${l.fondatore}`, 880, 40), INK, 800);
  texto(g, sindaco ? `🏛 Mayor: @${sindaco.conta}` : '🏛 Mayor: elected on Sunday at 9pm', W / 2, 1595, 38, INK, 800);
  texto(g, `${l.comune.sigla ? `${l.comune.sigla}, ` : ''}${l.regione.nome} ${N.emoji ?? ''}`, W / 2, 1660, ajustar(g, `${l.comune.sigla}, ${l.regione.nome}`, 880, 34), GRIGIO, 800);

  const frase = `${saluto(l.regione.cod, l.comune.sigla)} From ${l.nome}? Comment your town + country`;
  texto(g, frase, W / 2, 1795, ajustar(g, frase, 960, 40), INK, 800);
  texto(g, 'and get your house on the map', W / 2, 1845, 40, INK, 800);
  contorno(g, `@${PERFIL}`, W / 2, 1900, 44, ROSSO);
  return c;
}
