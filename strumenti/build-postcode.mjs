// Postcode district (a primeira metade do postcode: "LS6", "M1", "CF10", "BT9") -> cidade do mapa.
// O britânico sabe o seu de cor: "LS6 Leeds" ou só "BT9" já dizem onde a pessoa mora.
// Fonte: GeoNames postal codes (GB.zip, só districts). Saída: strumenti/dati/postcode.json { "LS6": "2644688", ... }
// Uso: node strumenti/build-postcode.mjs   (depois do build-geo.mjs)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { proj } from './geo-comum.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ARQ = path.join(RAIZ, 'dati-grezzi', 'postcode-GB.zip');
const URL_ZIP = 'https://download.geonames.org/export/zip/GB.zip';

if (!fs.existsSync(ARQ)) fs.writeFileSync(ARQ, Buffer.from(await (await fetch(URL_ZIP)).arrayBuffer()));
// GB.txt de dentro do zip (pelo diretório central, como no build-geo.mjs)
function lerZip(buf, nome) {
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  for (let k = 0, p = buf.readUInt32LE(fim + 16); k < buf.readUInt16LE(fim + 10); k++) {
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20), ln = buf.readUInt16LE(p + 28), local = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + ln) === nome) {
      const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), d = buf.subarray(ini, ini + tam);
      return metodo === 8 ? zlib.inflateRawSync(d) : d;
    }
    p += 46 + ln + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  throw new Error(`${nome} não está no zip`);
}

const { dados } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'comuni.json'), 'utf8'));
const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
const porNome = new Map();
for (const c of dados) { const k = norm(c[1].split('/')[0]); if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(c); }

const saida = {};
let porNomeOk = 0, perto = 0, sem = 0;
for (const l of lerZip(fs.readFileSync(ARQ), 'GB.txt').toString('utf8').split('\n')) {
  const r = l.split('\t');
  if (r.length < 11) continue;
  const out = r[1].trim().split(' ')[0].toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(out) || saida[out]) continue;
  const [x, z] = proj(+r[10], +r[9]);
  // Greater London é uma cidade só no mapa (build-geo.mjs): todo postcode de lá é London
  if (r[5] === 'Greater London' || /^(E|EC|N|NW|SE|SW|W|WC)\d/.test(out)) { saida[out] = '2643743'; porNomeOk++; continue; }
  // 0) cidade grande (50 mil+) a até 6 km: "PL1" é Plymouth, não o bairro Devonport
  const grande = dados.filter(c => c[6] >= 50000).map(c => [c, Math.hypot(c[4] - x, c[5] - z)]).filter(([, d]) => d < 6).sort((a, b) => b[0][6] - a[0][6])[0];
  if (grande) { saida[out] = grande[0][0]; porNomeOk++; continue; }
  // 1) cidade com o mesmo nome a até 15 km; 2) senão, a mais importante a até 6 km
  const mesmo =(porNome.get(norm(r[2])) ?? []).map(c => [c, Math.hypot(c[4] - x, c[5] - z)]).filter(([, d]) => d < 15).sort((a, b) => a[1] - b[1])[0];
  if (mesmo) { saida[out] = mesmo[0][0]; porNomeOk++; continue; }
  let melhor = null, nota = -Infinity;
  for (const c of dados) {
    const d = Math.hypot(c[4] - x, c[5] - z);
    if (d > 10) continue;
    const v = c[7] * 3 + Math.log10(c[6] + 10) - d * 0.6;
    if (v > nota) { nota = v; melhor = c; }
  }
  if (melhor) { saida[out] = melhor[0]; perto++; } else sem++;
}
fs.writeFileSync(path.join(RAIZ, 'strumenti', 'dati', 'postcode.json'), JSON.stringify(saida));
console.log(`${Object.keys(saida).length} postcode districts (${porNomeOk} pelo nome, ${perto} pela proximidade, ${sem} sem cidade)`);
for (const k of ['LS6', 'M1', 'CF10', 'BT9', 'EH1', 'SW1A', 'G1', 'PL1', 'TR1', 'IV1']) console.log(k, dados.find(c => c[0] === saida[k])?.[1]);
