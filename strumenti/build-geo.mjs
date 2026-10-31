// Gera os dados geográficos do mapa do Reino Unido:
//   sito/data/geo.json      -> projeção, nações, metadados
//   sito/data/comuni.json   -> todas as cidades/vilas (GeoNames) com posição, county e nome bilíngue
//   sito/data/rilievo.bin   -> grade de altitude (Uint16, metros) para a malha 3D
//   sito/data/terreno.png   -> textura do mapa (relevo sombreado, urze nas terras altas, divisas)
//   strumenti/dati/nomi-alternativi.json -> nomes em galês/Gaelic/Irish para o resolvedor (não vai para o site)
// Uso: node strumenti/build-geo.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { proj, desproj, PROJ, BBOX } from './geo-comum.mjs';
import { lerPNG, gravarPNG } from './png.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GREZZI = path.join(RAIZ, 'dati-grezzi');
const SAIDA = path.join(RAIZ, 'sito', 'data');
fs.mkdirSync(path.join(GREZZI, 'terrarium'), { recursive: true });
fs.mkdirSync(SAIDA, { recursive: true });

const ONS = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services';
const FONTES = {
  nazioni: `${ONS}/Countries_December_2023_Boundaries_UK_BGC/FeatureServer/0/query?where=1%3D1&outFields=CTRY23CD,CTRY23NM&outSR=4326&f=geojson`,
  contee: `${ONS}/Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BGC/FeatureServer/0/query?where=1%3D1&outFields=CTYUA23CD,CTYUA23NM&outSR=4326&f=geojson`,
  vicini: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson',
  laghi: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
  laghiEuropa: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes_europe.geojson',
  geonames: 'https://download.geonames.org/export/dump/GB.zip',
  alternativi: 'https://download.geonames.org/export/dump/alternatenames/GB.zip',
  terrarium: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
};

// as 4 nações: código = admin1 do GeoNames; população: estimativa ONS de meados de 2023
const NAZIONI = {
  E92000001: { cod: 'ENG', nome: 'England', sigla: 'ENGLAND', pop: 57690300, cor: '#CE1124' },
  S92000003: { cod: 'SCT', nome: 'Scotland', sigla: 'SCOTLAND', pop: 5490100, cor: '#005EB8' },
  W92000004: { cod: 'WLS', nome: 'Wales', sigla: 'WALES', nome_cy: 'Cymru', pop: 3164400, cor: '#00B140' },
  N92000002: { cod: 'NIR', nome: 'Northern Ireland', sigla: 'N. IRELAND', pop: 1920400, cor: '#3A7D7C' },
};
const ORDEM = ['ENG', 'SCT', 'WLS', 'NIR'];
// terra vizinha (sem casas): Ireland, dependências da Coroa e o continente
const VICINI = new Set(['IRL', 'FXX', 'IMN', 'JEY', 'GGY', 'BFR', 'BWR', 'BCR', 'NLD']);

// metropolitan districts e boroughs de Londres: o britânico diz o county metropolitano ("Leeds, West Yorkshire")
function nomeContea(cod, nome) {
  if (cod.startsWith('E09')) return 'Greater London';
  if (cod.startsWith('E08')) {
    const n = +cod.slice(3);
    if (n <= 10) return 'Greater Manchester';
    if (n <= 15) return 'Merseyside';
    if (n <= 19) return 'South Yorkshire';
    if (n <= 24 || n === 37) return 'Tyne and Wear';
    if (n <= 31) return 'West Midlands';
    if (n <= 36) return 'West Yorkshire';
  }
  return nome.replace(/, (City|County) of$/, '').replace(/^City of /, '').replace(/ City$/, '');
}

async function baixar(url, arq) {
  if (fs.existsSync(arq)) return fs.readFileSync(arq);
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(arq, b);
      return b;
    } catch (e) {
      if (t >= 3) throw e;
      await new Promise(ok => setTimeout(ok, 1000 * (t + 1)));
    }
  }
}

// lê um arquivo de dentro de um .zip (método deflate), sem dependências
// (pelo diretório central: o GeoNames grava o tamanho só depois dos dados, não no cabeçalho local)
function lerZip(buf, nome) {
  let fimDir = buf.length - 22;
  while (fimDir >= 0 && buf.readUInt32LE(fimDir) !== 0x06054b50) fimDir--;
  const total = buf.readUInt16LE(fimDir + 10);
  for (let k = 0, p = buf.readUInt32LE(fimDir + 16); k < total; k++) {
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20), ln = buf.readUInt16LE(p + 28);
    const le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + ln) === nome) {
      const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), d = buf.subarray(ini, ini + tam);
      return metodo === 8 ? zlib.inflateRawSync(d) : d;
    }
    p += 46 + ln + le + lc;
  }
  throw new Error(`${nome} não está no zip`);
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 1. fontes ----------
log('baixando fontes…');
const nazioniGeo = JSON.parse(await baixar(FONTES.nazioni, path.join(GREZZI, 'nazioni.geojson')));
const conteeGeo = JSON.parse(await baixar(FONTES.contee, path.join(GREZZI, 'contee.geojson')));
const viciniGeo = JSON.parse(await baixar(FONTES.vicini, path.join(GREZZI, 'ne_units.geojson')));
const laghiGeo = [
  ...JSON.parse(await baixar(FONTES.laghi, path.join(GREZZI, 'ne_lakes.geojson'))).features,
  ...JSON.parse(await baixar(FONTES.laghiEuropa, path.join(GREZZI, 'ne_lakes_europe.geojson'))).features,
];
const gnTxt = lerZip(await baixar(FONTES.geonames, path.join(GREZZI, 'GB.zip')), 'GB.txt').toString('utf8');
const altTxt = lerZip(await baixar(FONTES.alternativi, path.join(GREZZI, 'alt-GB.zip')), 'GB.txt').toString('utf8');

// ---------- 2. raster: grade da textura ----------
const RES = 0.5; // km por pixel
const W = Math.round((BBOX.x1 - BBOX.x0) / RES), H = Math.round((BBOX.z1 - BBOX.z0) / RES);
log(`textura ${W}x${H}`);

const aneisExternos = geom => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map(p => p[0]);

// preenche um anel (em coordenadas de pixel) com scanline
function preencher(anel, raster, valor) {
  let ymin = Infinity, ymax = -Infinity;
  for (const [, y] of anel) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(H - 1, Math.ceil(ymax));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i], [xj, yj] = anel[j];
      if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) raster[y * W + x] = valor;
    }
  }
}
const paraPixel = ([lon, lat]) => { const [x, z] = proj(lon, lat); return [(x - BBOX.x0) / RES, (z - BBOX.z0) / RES]; };
const pintar = (geom, raster, valor) => { for (const anel of aneisExternos(geom)) preencher(anel.map(paraPixel), raster, valor); };

const regioes = nazioniGeo.features.map(f => ({ ...NAZIONI[f.properties.CTRY23CD], geom: f.geometry }))
  .sort((a, b) => ORDEM.indexOf(a.cod) - ORDEM.indexOf(b.cod));
log(`${regioes.length} nações`);

const vicino = new Uint8Array(W * H);
for (const f of viciniGeo.features) if (VICINI.has(f.properties.GU_A3)) pintar(f.geometry, vicino, 1);
const idRegiao = new Uint8Array(W * H); // 0 = mar ou terra vizinha
regioes.forEach((r, i) => pintar(r.geom, idRegiao, i + 1));
for (let i = 0; i < W * H; i++) if (idRegiao[i]) vicino[i] = 0;
// lagos (Lough Neagh, Loch Ness, Loch Lomond…): água dentro da terra, sem divisa branca em volta
const lago = new Uint8Array(W * H);
for (const f of laghiGeo) pintar(f.geometry, lago, 1);
let nLago = 0;
for (let i = 0; i < W * H; i++) if (lago[i] && (idRegiao[i] || vicino[i])) nLago++; else lago[i] = 0;
log(`lagos: ${nLago} pixels`);

const contee = conteeGeo.features.map(f => ({ cod: f.properties.CTYUA23CD, nome: nomeContea(f.properties.CTYUA23CD, f.properties.CTYUA23NM), geom: f.geometry }));
const idContea = new Uint16Array(W * H);
contee.forEach((c, i) => pintar(c.geom, idContea, i + 1));
log(`${contee.length} counties/unitary authorities`);

// ---------- 3. altitude (terrarium z8) ----------
const Z = 8, N = 2 ** Z;
const gx = lon => (lon + 180) / 360 * N * 256;
const gy = lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N * 256; };
// a sinusoidal é curva: os extremos de longitude ficam nos cantos de baixo (lat menor) e de cima
let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
for (const [x, z] of [[BBOX.x0, BBOX.z0], [BBOX.x1, BBOX.z0], [BBOX.x0, BBOX.z1], [BBOX.x1, BBOX.z1]]) {
  const [lon, lat] = desproj(x, z);
  lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon); latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
}
const tx0 = Math.floor(gx(lonMin) / 256), tx1 = Math.floor(gx(lonMax) / 256);
const ty0 = Math.floor(gy(latMax) / 256), ty1 = Math.floor(gy(latMin) / 256);
const MW = (tx1 - tx0 + 1) * 256, MH = (ty1 - ty0 + 1) * 256;
const mosaico = new Float32Array(MW * MH);
const tiles = [];
for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) tiles.push([x, y]);
log(`baixando ${tiles.length} tiles de relevo…`);
let feitos = 0;
async function trabalhador() {
  while (tiles.length) {
    const [x, y] = tiles.pop();
    const png = lerPNG(await baixar(FONTES.terrarium(Z, x, y), path.join(GREZZI, 'terrarium', `${Z}_${x}_${y}.png`)));
    for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
      const o = (py * 256 + px) * png.bpp;
      mosaico[((y - ty0) * 256 + py) * MW + (x - tx0) * 256 + px] = png.px[o] * 256 + png.px[o + 1] + png.px[o + 2] / 256 - 32768;
    }
    if (++feitos % 20 === 0) log(`  ${feitos} tiles`);
  }
}
await Promise.all(Array.from({ length: 8 }, trabalhador));

function altitude(lon, lat) {
  const fx = gx(lon) - tx0 * 256 - 0.5, fy = gy(lat) - ty0 * 256 - 0.5;
  const x = Math.max(0, Math.min(MW - 2, Math.floor(fx))), y = Math.max(0, Math.min(MH - 2, Math.floor(fy)));
  const ax = fx - x, ay = fy - y, i = y * MW + x;
  return (mosaico[i] * (1 - ax) + mosaico[i + 1] * ax) * (1 - ay) + (mosaico[i + MW] * (1 - ax) + mosaico[i + MW + 1] * ax) * ay;
}

const alt = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (!idRegiao[i] && !vicino[i]) continue;
  const [lon, lat] = desproj(BBOX.x0 + (x + 0.5) * RES, BBOX.z0 + (y + 0.5) * RES);
  alt[i] = Math.max(1, altitude(lon, lat));
}
log('altitude amostrada');

// ---------- 4. textura ----------
// paleta britânica: pasto verde nos vales, charneca oliva, urze castanho-lilás nas terras altas, rocha cinza no topo
const PALETA = [
  [0, [152, 201, 112]], [120, [140, 192, 102]], [250, [128, 176, 94]], [400, [146, 163, 101]],
  [550, [158, 145, 118]], [750, [150, 128, 130]], [950, [160, 154, 150]], [1150, [204, 203, 199]], [1400, [240, 240, 238]],
];
function corAlt(h) {
  for (let k = 1; k < PALETA.length; k++) if (h <= PALETA[k][0]) {
    const [h0, c0] = PALETA[k - 1], [h1, c1] = PALETA[k], t = (h - h0) / (h1 - h0);
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
  }
  return PALETA[PALETA.length - 1][1];
}

// halo de água rasa perto da costa: máscara borrada
let halo = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) halo[i] = idRegiao[i] || vicino[i] ? 1 : 0;
function borrar(src, r) {
  const tmp = new Float32Array(W * H), dst = new Float32Array(W * H), k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s * k; s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = s * k; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  return dst;
}
halo = borrar(borrar(halo, 7), 7);

// mar do norte, mais frio que o Mediterrâneo (mesma cor de COR_MAR em sito/js/mappa.js)
const MAR = [134, 175, 196], RASO = [166, 200, 214];
const ALT_SOL = 50 * Math.PI / 180, ZF = 3.2, PLANO = Math.sin(ALT_SOL);
const L = [-Math.cos(ALT_SOL) * Math.SQRT1_2, -Math.cos(ALT_SOL) * Math.SQRT1_2, Math.sin(ALT_SOL)]; // luz do noroeste
const rgb = Buffer.alloc(W * H * 3);
const A = (x, y) => alt[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
const R = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : idRegiao[y * W + x]);
const C = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : idContea[y * W + x]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  let c;
  if (lago[i]) {
    c = vicino[i] ? [176, 196, 204] : RASO;
  } else if (!idRegiao[i] && !vicino[i]) {
    const t = Math.min(1, halo[i] * 2.4);
    c = [MAR[0] + (RASO[0] - MAR[0]) * t, MAR[1] + (RASO[1] - MAR[1]) * t, MAR[2] + (RASO[2] - MAR[2]) * t];
  } else {
    const dx = (A(x + 1, y) - A(x - 1, y)) / (2 * RES * 1000) * ZF;
    const dy = (A(x, y + 1) - A(x, y - 1)) / (2 * RES * 1000) * ZF;
    const n = 1 / Math.hypot(dx, dy, 1);
    const luz = Math.max(0, (-dx * L[0] - dy * L[1] + L[2]) * n);
    const m = Math.min(1.28, Math.max(0.58, 1 + (luz - PLANO) * 0.9));
    if (vicino[i]) {
      // terra vizinha: cinza-areia apagado, só com o relevo
      c = [206, 204, 194].map(v => v * (0.82 + (m - 1) * 0.6 + 0.18));
    } else {
      c = corAlt(alt[i]).map(v => v * m);
      const r = idRegiao[i];
      // divisa entre nações (e com a Ireland): branca e grossa
      let nacao = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if ((idRegiao[j] && idRegiao[j] !== r) || vicino[j]) { nacao = true; break; }
      }
      if (nacao) c = c.map(v => v * 0.25 + 255 * 0.75);
      // divisa entre counties da mesma nação: fina e discreta
      else {
        const k = idContea[i];
        if (k && [[1, 0], [0, 1]].some(([ox, oy]) => { const o = C(x + ox, y + oy); return o && o !== k && R(x + ox, y + oy) === r; })) c = c.map(v => v * 0.72 + 255 * 0.28);
      }
    }
  }
  rgb[i * 3] = Math.min(255, c[0]); rgb[i * 3 + 1] = Math.min(255, c[1]); rgb[i * 3 + 2] = Math.min(255, c[2]);
}
gravarPNG(path.join(SAIDA, 'terreno.png'), W, H, rgb);
log(`terreno.png ${(fs.statSync(path.join(SAIDA, 'terreno.png')).size / 1e6).toFixed(1)} MB`);

// ---------- 5. grade de altitude para a malha ----------
const GW = Math.round((BBOX.x1 - BBOX.x0) / 2.5) + 1, GH = Math.round((BBOX.z1 - BBOX.z0) / 2.5) + 1;
const grade = new Uint16Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const cx = i / (GW - 1) * W, cy = j / (GH - 1) * H;
  let s = 0, n = 0;
  for (let y = Math.round(cy) - 2; y <= Math.round(cy) + 2; y++) for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    s += alt[y * W + x]; n++;
  }
  grade[j * GW + i] = Math.round(n ? s / n : 0);
}
fs.writeFileSync(path.join(SAIDA, 'rilievo.bin'), Buffer.from(grade.buffer));
log(`rilievo.bin ${GW}x${GH}`);

// ---------- 6. cidades e vilas (GeoNames) ----------
// PPLX (bairros) e localidades/fazendas ficam de fora: o resolvedor leva o bairro para a cidade pelo nome
const TIPOS = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC']);
const RANGO = { PPLC: 5, PPLA: 4, PPLA2: 3, PPLA3: 2, PPLA4: 1, PPL: 0 };
// nomes com as duas formas oficiais (a "/" vira alternativa no resolvedor, como os comuni bilíngues da Itália)
const NOMI_FISSI = { 2643736: 'Derry/Londonderry' };
const lugares = [];
for (const l of gnTxt.split('\n')) {
  const r = l.split('\t');
  if (r[6] !== 'P' || !TIPOS.has(r[7]) || !ORDEM.includes(r[10])) continue;
  const lat = +r[4], lon = +r[5], [x, z] = proj(lon, lat);
  if (x < BBOX.x0 || x > BBOX.x1 || z < BBOX.z0 || z > BBOX.z1) continue;
  lugares.push({ id: r[0], nome: NOMI_FISSI[r[0]] ?? r[1], reg: r[10], x, z, pop: +r[14] || 0, rango: RANGO[r[7]] });
}
// mesmo nome a menos de 2 km: fica o mais importante
lugares.sort((a, b) => b.rango - a.rango || b.pop - a.pop);
const vistos = new Map(), cidades = [];
for (const l of lugares) {
  const k = l.nome.toLowerCase(), outros = vistos.get(k) ?? [];
  if (outros.some(o => Math.hypot(o.x - l.x, o.z - l.z) < 2)) continue;
  outros.push(l); vistos.set(k, outros); cidades.push(l);
}

// county pelo raster (ilhotas e litoral: o pixel de county mais próximo)
function conteaEm(x, z) {
  const px = Math.round((x - BBOX.x0) / RES), py = Math.round((z - BBOX.z0) / RES);
  for (let d = 0; d <= 12; d++) for (let oy = -d; oy <= d; oy++) for (let ox = -d; ox <= d; ox++) {
    if (Math.max(Math.abs(ox), Math.abs(oy)) !== d) continue;
    const k = C(px + ox, py + oy);
    if (k) return k - 1;
  }
  return -1;
}
const nomesContea = [...new Set(contee.map(c => c.nome))].sort();
const idxContea = new Map(nomesContea.map((n, i) => [n, i]));

// nomes em galês (cy), Gaelic escocês (gd) e Irish (ga)
const alt3 = new Map();
for (const l of altTxt.split('\n')) {
  const r = l.split('\t');
  if (!['cy', 'gd', 'ga'].includes(r[2]) || r[7] === '1') continue;
  const m = alt3.get(r[1]) ?? {};
  if (!m[r[2]] || r[4] === '1') m[r[2]] = r[3];
  alt3.set(r[1], m);
}
const normBil = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
// placas bilíngues de verdade: toda a Wales; na Scotland, só onde o Gaelic é oficial nas placas
const GAELICO = new Set(['Highland', 'Na h-Eileanan Siar', 'Argyll and Bute']);

// Greater London é uma cidade só (como Roma era um comune): bairros e boroughs viram "quartieri" de London.
// O resolvedor só usa esses nomes quando não há outra cidade com o nome, ou quando "London" também foi escrito
// ("Richmond" sozinho continua sendo Richmond, North Yorkshire).
const LONDRA = '2643743', quartieri = {};
const comuni = [], nomiAlt = {};
for (const l of cidades) {
  const ci = conteaEm(l.x, l.z), contea = ci >= 0 ? contee[ci].nome : '';
  if (contea === 'Greater London' && l.id !== LONDRA) { quartieri[l.nome.toLowerCase()] = LONDRA; continue; }
  const a = alt3.get(l.id) ?? {};
  let bil = 0;
  if (l.reg === 'WLS' && a.cy && normBil(a.cy) !== normBil(l.nome)) bil = a.cy;
  if (l.reg === 'SCT' && GAELICO.has(contea) && a.gd && normBil(a.gd) !== normBil(l.nome)) bil = a.gd;
  const extras = [a.cy, a.gd, a.ga].filter(n => n && normBil(n) !== normBil(l.nome));
  if (extras.length) nomiAlt[l.id] = [...new Set(extras)];
  comuni.push([l.id, l.nome, contea ? idxContea.get(contea) : -1, l.reg, +l.x.toFixed(2), +l.z.toFixed(2), l.pop, l.rango, bil]);
}
const porNacao = {};
for (const c of comuni) porNacao[c[3]] = (porNacao[c[3]] || 0) + 1;
log(`${comuni.length} cidades/vilas`, porNacao, `${comuni.filter(c => c[8]).length} com placa bilíngue`);
fs.writeFileSync(path.join(SAIDA, 'comuni.json'), JSON.stringify({ campi: ['id', 'nome', 'contea', 'reg', 'x', 'z', 'pop', 'rango', 'bil'], contee: nomesContea, dados: comuni }));
fs.mkdirSync(path.join(RAIZ, 'strumenti', 'dati'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'strumenti', 'dati', 'nomi-alternativi.json'), JSON.stringify(nomiAlt));
fs.writeFileSync(path.join(RAIZ, 'strumenti', 'dati', 'quartieri.json'), JSON.stringify(quartieri));
log(`${Object.keys(quartieri).length} bairros de Londres viram London`);

// ---------- 7. nações: ponto do rótulo (polo de inacessibilidade aproximado) ----------
function pontoRotulo(idx) {
  let melhor = null, dist = -1;
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    if (idRegiao[y * W + x] !== idx + 1) continue;
    let d = 0;
    busca: for (d = 1; d < 120; d++) {
      for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || idRegiao[yy * W + xx] !== idx + 1) break busca;
      }
    }
    if (d > dist) { dist = d; melhor = [x, y]; }
  }
  return [+(BBOX.x0 + melhor[0] * RES).toFixed(1), +(BBOX.z0 + melhor[1] * RES).toFixed(1)];
}
const regioni = regioes.map((r, i) => {
  const [lx, lz] = pontoRotulo(i);
  const { geom, ...resto } = r;
  return { ...resto, lx, lz, comuni: porNacao[r.cod] || 0 };
});

fs.writeFileSync(path.join(SAIDA, 'geo.json'), JSON.stringify({
  proj: PROJ, bbox: BBOX,
  // enquadramento da câmera: só o Reino Unido (de Northern Ireland a East Anglia, de Shetland às Scilly), sem a Ireland
  vista: { x0: -330, x1: 340, z0: -650, z1: 565 },
  terreno: { arquivo: 'terreno.png', w: W, h: H },
  rilievo: { arquivo: 'rilievo.bin', w: GW, h: GH },
  regioni,
}, null, 1));
log('geo.json — pronto');
